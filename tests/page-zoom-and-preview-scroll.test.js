import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const publicPages = ['index', 'panduan', 'panduan-cetak-pdf', 'faq', 'tentang', 'privasi', 'ketentuan'];

function guardHarness() {
  const listeners = new Map();
  const addEventListener = vi.fn((type, callback, options) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push({ callback, options });
  });
  const document = { addEventListener };
  const window = {};
  const context = { document, window };
  const source = read('js/page-zoom-guard.js');
  runInNewContext(source, context);
  function emit(type, options = {}) {
    const event = {
      cancelable: options.cancelable ?? true,
      ctrlKey: !!options.ctrlKey,
      metaKey: !!options.metaKey,
      altKey: !!options.altKey,
      key: options.key ?? '',
      code: options.code ?? '',
      touches: options.touches,
      prevented: false,
      preventDefault() { this.prevented = true; },
    };
    for (const { callback } of listeners.get(type) || []) callback(event);
    return event;
  }
  return { source, context, window, listeners, addEventListener, emit };
}

describe('Page zoom restriction — best effort without breaking letter zoom', () => {
  it('adds a same-origin guard to every route and mobile viewport policy', () => {
    for (const slug of publicPages) {
      const html = read(slug + '.html');
      expect(html).toMatch(/<meta\s+name="viewport"\s+content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"\s*\/>/);
      const src = slug === 'index' ? 'js/page-zoom-guard.js' : '/js/page-zoom-guard.js';
      expect(html).toContain('src="' + src + '" defer');
      expect(html.match(/src="[^"]*page-zoom-guard\.js"/g)).toHaveLength(1);
      expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>\s*\S/);
    }
    expect(read('sw.js')).toContain("'./js/page-zoom-guard.js'");
  });

  it('prevents Ctrl/Meta wheel zoom and Safari multi-touch gestures', () => {
    const h = guardHarness();
    expect(h.emit('wheel', { ctrlKey: true }).prevented).toBe(true);
    expect(h.emit('wheel', { metaKey: true }).prevented).toBe(true);
    expect(h.emit('gesturestart').prevented).toBe(true);
    expect(h.emit('gesturechange').prevented).toBe(true);
    expect(h.emit('touchmove', { touches: [{}, {}] }).prevented).toBe(true);
    for (const evt of ['wheel', 'gesturestart', 'gesturechange', 'touchmove']) {
      const handlers = h.listeners.get(evt);
      expect(handlers[0].options.passive).toBe(false);
      expect(handlers[0].options.capture).toBe(true);
    }
  });

  it('does not block ordinary scrolling, single-touch pan or keystrokes', () => {
    const h = guardHarness();
    expect(h.emit('wheel').prevented).toBe(false);
    expect(h.emit('touchmove', { touches: [{}] }).prevented).toBe(false);
    expect(h.emit('keydown', { ctrlKey: true, key: 'c' }).prevented).toBe(false);
    expect(h.emit('keydown', { ctrlKey: true, key: 'z' }).prevented).toBe(false);
    expect(h.emit('keydown', { key: '+', code: 'Equal' }).prevented).toBe(false);
    expect(h.emit('wheel', { ctrlKey: true, cancelable: false }).prevented).toBe(false);
  });

  it('blocks common browser zoom shortcuts without touching preview toolbar clicks', () => {
    const h = guardHarness();
    for (const [key, code] of [
      ['+', 'Equal'], ['=', 'Equal'], ['-', 'Minus'],
      ['_', 'Minus'], ['0', 'Digit0'], ['+', 'NumpadAdd'],
      ['-', 'NumpadSubtract'], ['0', 'Numpad0'],
    ]) {
      expect(h.emit('keydown', { ctrlKey: true, key, code }).prevented).toBe(true);
      expect(h.emit('keydown', { metaKey: true, key, code }).prevented).toBe(true);
    }
    expect(h.listeners.has('click')).toBe(false);
    const html = read('index.html');
    for (const id of ['btn-zoom-in', 'btn-zoom-out', 'btn-zoom-reset', 'btn-fit-width', 'btn-fit-page']) {
      expect(html).toContain('id="' + id + '"');
    }
    const renderer = read('js/preview-renderer.js');
    expect(renderer).toContain("document.getElementById('btn-zoom-in')?.addEventListener('click'");
    expect(renderer).toContain("document.getElementById('btn-zoom-out')?.addEventListener('click'");
  });

  it('installs listeners only once per page and does not affect print markup', () => {
    const h = guardHarness();
    const n = h.addEventListener.mock.calls.length;
    runInNewContext(h.source, h.context);
    expect(h.addEventListener.mock.calls.length).toBe(n);
    expect(h.window.__pageZoomGuardInstalled).toBe(true);
    const html = read('index.html');
    const stage = html.indexOf('id="preview-scroll-stage"');
    const wrapper = html.indexOf('id="preview-canvas-wrapper"');
    const preview = html.indexOf('id="surat-preview"');
    const layer = html.indexOf('id="preview-protection-layer"');
    expect(stage).toBeGreaterThan(0);
    expect(wrapper).toBeGreaterThan(stage);
    expect(preview).toBeGreaterThan(wrapper);
    expect(layer).toBeGreaterThan(preview);
    expect(read('css/print.css')).toContain('  .preview-scroll-stage {');
    expect(read('css/print.css')).toContain('    position: static !important;');
    expect(read('js/pdf-export.js')).toContain('preview.outerHTML');
  });

  it('gives the zoomed preview a genuine horizontally scrollable stage', () => {
    const css = read('css/preview.css');
    const js = read('js/preview-renderer.js');
    expect(css).toContain('.preview-scroll-stage {');
    expect(css).toContain('margin-inline: auto;');
    expect(css).toContain('overflow: hidden;');
    expect(css).toContain('transform-origin: top left;');
    expect(css).toContain('touch-action: pan-x pan-y;');
    expect(js).toContain("document.getElementById('preview-scroll-stage')");
    expect(js).toContain('Math.ceil(naturalW * safeZoom) + 32');
    expect(js).toContain('Math.ceil(naturalH * safeZoom) + 48');
    expect(js).toContain('_stageEl.style.width');
    expect(js).toContain('_stageEl.style.height');
  });
});
