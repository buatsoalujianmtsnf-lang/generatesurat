import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function harness(flag = 'off', mode = 'strict') {
  const listeners = { window: new Map(), document: new Map() };
  const frames = [];
  const observers = [];
  const subscriptions = new Map();
  const removed = [];
  const createPage = (left, top, width = 360, height = 300) => ({
    getBoundingClientRect: () => ({ left, top, width, height }),
  });
  const pages = [createPage(20, 30), createPage(20, 355)];
  const wrapper = {
    offsetWidth: 360,
    offsetHeight: 700,
    getBoundingClientRect: () => ({ left: 20, top: 30, width: 360, height: 700 }),
  };
  const classSet = new Set();
  const layer = {
    parentElement: wrapper,
    hidden: true,
    sheets: [],
    classList: {
      toggle(name, force) {
        if (force === undefined ? !classSet.has(name) : force) classSet.add(name);
        else classSet.delete(name);
      },
      add(name) { classSet.add(name); },
      remove(name) { classSet.delete(name); },
      contains(name) { return classSet.has(name); },
    },
    replaceChildren(fragment) {
      this.sheets = fragment ? [...fragment.children] : [];
    },
  };
  const status = { hidden: true, textContent: '', title: '' };
  const previewHtml = '<div id="surat-preview"><div class="doc-content">SURAT UJI DUMMY</div></div>';
  const preview = {
    parentElement: wrapper,
    dataset: { pageCount: '2' },
    outerHTML: previewHtml,
    querySelectorAll: selector => selector === ':scope > .surat-page' ? pages : [],
    querySelector: () => null,
  };
  const elements = {
    'preview-canvas-wrapper': wrapper,
    'preview-viewport': {},
    'surat-preview': preview,
    'preview-protection-layer': layer,
    'preview-protection-status': status,
  };
  const appendListener = (who, name, fn) => {
    const group = listeners[who].get(name) || [];
    group.push(fn);
    listeners[who].set(name, group);
  };
  const removeListener = (who, name, fn) => {
    removed.push(name);
    listeners[who].set(name, (listeners[who].get(name) || []).filter(cb => cb !== fn));
  };
  const document = {
    documentElement: { dataset: { previewProtection: flag, previewProtectionMode: mode } },
    hidden: false,
    visibilityState: 'visible',
    getElementById: id => elements[id] || null,
    createDocumentFragment: () => ({
      children: [],
      appendChild(node) { this.children.push(node); },
    }),
    createElement: () => ({
      className: '',
      style: {},
      setAttribute: vi.fn(),
    }),
    addEventListener: (name, fn) => appendListener('document', name, fn),
    removeEventListener: (name, fn) => removeListener('document', name, fn),
  };
  const window = {
    requestAnimationFrame(fn) { frames.push(fn); return frames.length; },
    cancelAnimationFrame: vi.fn(),
    addEventListener: (name, fn) => appendListener('window', name, fn),
    removeEventListener: (name, fn) => removeListener('window', name, fn),
  };
  class FakeObserver {
    constructor(callback) { this.callback = callback; this.disconnect = vi.fn(); observers.push(this); }
    observe() {}
  }
  const State = {
    on(name, fn) {
      subscriptions.set(name, fn);
      return () => { subscriptions.delete(name); };
    },
  };
  const context = { document, window, State, MutationObserver: FakeObserver, ResizeObserver: FakeObserver };
  runInNewContext(read('js/preview-protection.js') + '\n;globalThis.previewProtectionApi = PreviewProtection;', context);
  const api = context.previewProtectionApi;
  function flush() {
    let iterations = 0;
    while (frames.length) {
      if (++iterations > 20) throw new Error('Unexpected RAF loop');
      frames.shift()();
    }
  }
  function emit(who, name) {
    for (const callback of listeners[who].get(name) || []) callback();
  }
  return { api, pages, createPage, wrapper, layer, preview, previewHtml, status, document,
    window, frames, flush, emit, observers, subscriptions, listeners, removed };
}

function decodeTile(sheet) {
  const match = String(sheet.style.backgroundImage).match(/^url\("data:image\/svg\+xml,([^"]+)"\)$/);
  expect(match).toBeTruthy();
  return decodeURIComponent(match[1]);
}

describe('PP-02 watermark & strict background-tab masking', () => {
  it('respects an explicit OFF flag without mounting listeners or tiles', () => {
    const h = harness();
    expect(h.api.init()).toBe(true);
    h.flush();
    expect(h.api.getStatus()).toMatchObject({ enabled: false, masked: false, pageCount: 0, mode: 'off' });
    expect(h.layer.hidden).toBe(true);
    expect(h.layer.sheets).toHaveLength(0);
    expect(h.observers).toHaveLength(0);
    expect(h.listeners.document.size).toBe(0);
  });

  it('shows repeated anonymous SVG watermark on each page without altering document HTML', () => {
    const h = harness('on');
    h.api.init();
    h.flush();
    expect(h.layer.hidden).toBe(false);
    expect(h.layer.sheets).toHaveLength(2);
    const imageA = h.layer.sheets[0].style.backgroundImage;
    const imageB = h.layer.sheets[1].style.backgroundImage;
    expect(imageA).toBe(imageB);
    const svg = decodeTile(h.layer.sheets[0]);
    expect(svg).toContain('GENERATE SURATKU');
    expect(svg).toContain('PRATINJAU');
    expect(svg).toContain('rotate(-24');
    expect(svg).toMatch(/PRATINJAU · [A-Z0-9]{6} · \d{2}:\d{2}/);
    expect(h.preview.outerHTML).toBe(h.previewHtml);
    expect(h.preview.outerHTML).not.toContain('preview-protection-sheet');
    expect(h.api.getStatus()).toMatchObject({ mode: 'strict', pageCount: 2, masked: false });
  });

  it('masks paper synchronously when the tab becomes hidden and restores on visibility', () => {
    const h = harness('on');
    h.api.init();
    h.flush();
    const sheets = h.layer.sheets;
    h.document.visibilityState = 'hidden';
    h.document.hidden = true;
    h.emit('document', 'visibilitychange');
    expect(h.api.getStatus().masked).toBe(true);
    expect(h.layer.classList.contains('is-masked')).toBe(true);
    expect(h.layer.sheets).toBe(sheets); // class changes before deferred re-render
    h.document.visibilityState = 'visible';
    h.document.hidden = false;
    h.emit('document', 'visibilitychange');
    expect(h.api.getStatus().masked).toBe(false);
    expect(h.layer.classList.contains('is-masked')).toBe(false);
    h.flush();
  });

  it('supports watermark-only standard mode without masking', () => {
    const h = harness('on', 'standard');
    h.api.init();
    h.flush();
    h.document.visibilityState = 'hidden';
    h.document.hidden = true;
    h.emit('document', 'visibilitychange');
    expect(h.api.getStatus()).toMatchObject({ enabled: true, mode: 'standard', masked: false });
    expect(h.layer.classList.contains('is-masked')).toBe(false);

    h.document.documentElement.dataset.previewProtectionMode = 'strict';
    expect(h.api.refresh()).toBe(true);
    expect(h.layer.classList.contains('is-masked')).toBe(true);
    h.document.documentElement.dataset.previewProtectionMode = 'standard';
    h.api.refresh();
    expect(h.layer.classList.contains('is-masked')).toBe(false);
  });

  it('hides stale pages while data-page-count is zero, then re-renders after completion', () => {
    const h = harness('on');
    h.api.init();
    h.flush();
    h.preview.dataset.pageCount = '0';
    h.observers[0].callback();
    h.flush();
    expect(h.layer.hidden).toBe(true);
    expect(h.layer.sheets).toHaveLength(0);
    h.preview.dataset.pageCount = '2';
    h.observers[0].callback();
    h.flush();
    expect(h.layer.hidden).toBe(false);
    expect(h.layer.sheets).toHaveLength(2);
  });

  it('recomputes zoom-relative sheet positions and handles a long paginated document', () => {
    const h = harness('on');
    h.pages.push(...Array.from({ length: 48 }, (_, i) => h.createPage(20, 680 + i * 325)));
    h.preview.dataset.pageCount = '50';
    h.api.init();
    h.flush();
    expect(h.layer.sheets).toHaveLength(50);
    h.wrapper.getBoundingClientRect = () => ({ left: 10, top: 15, width: 180, height: 350 });
    h.pages[0].getBoundingClientRect = () => ({ left: 10, top: 15, width: 180, height: 150 });
    h.subscriptions.get('ui:zoomChange')();
    expect(h.frames).toHaveLength(1);
    h.flush();
    expect(h.layer.sheets).toHaveLength(50);
    expect(h.layer.sheets[0].style.width).toBe('360px');
    expect(h.layer.sheets[0].style.height).toBe('300px');
  });

  it('removes mask and watermark when disabled, and re-enables idempotently', () => {
    const h = harness('on');
    h.api.init();
    h.flush();
    h.document.visibilityState = 'hidden';
    h.emit('document', 'visibilitychange');
    h.document.documentElement.dataset.previewProtection = 'off';
    expect(h.api.refresh()).toBe(false);
    expect(h.layer.classList.contains('is-masked')).toBe(false);
    expect(h.layer.hidden).toBe(true);
    expect(h.layer.sheets).toHaveLength(0);
    expect(h.subscriptions.size).toBe(0);
    expect(h.observers.every(ob => ob.disconnect.mock.calls.length === 1)).toBe(true);

    h.document.visibilityState = 'visible';
    h.document.documentElement.dataset.previewProtection = 'on';
    expect(h.api.refresh()).toBe(true);
    h.api.init();
    h.flush();
    expect(h.layer.sheets).toHaveLength(2);
    h.api.destroy();
    h.api.destroy();
    expect(h.api.getStatus()).toMatchObject({ initialized: false, enabled: false, masked: false, pageCount: 0 });
    expect(h.layer.classList.contains('is-masked')).toBe(false);
    expect(h.removed).toContain('visibilitychange');
  });

  it('isolates preview protection from editor, printed paper, PDF and sponsor enforcement', () => {
    const html = read('index.html');
    const css = read('css/preview-protection.css');
    const js = read('js/preview-protection.js');
    const pdf = read('js/pdf-export.js');
    const sponsor = read('js/sponsor-export-gate.js');
    expect(html).toContain('data-preview-protection="on"');
    expect(html).toContain('data-preview-protection-mode="strict"');
    expect(html).not.toContain('id="preview-protection-status"');
    expect(html).not.toContain('Preview berwatermark');
    expect(js).not.toContain('statusEl');
    expect(css).not.toContain('#preview-protection-status');
    expect(html).toMatch(/id="surat-preview"[\s\S]*?id="preview-protection-layer"/);
    expect(css).toContain('@media screen');
    expect(css).toContain('@media print');
    expect(css).toContain('background-image: none !important');
    expect(css).toContain('background-repeat: repeat');
    expect(css).toContain('pointer-events: none');
    expect(js).not.toMatch(/navigator\.clipboard|addEventListener\(['"](?:keydown|keyup|contextmenu)/);
    expect(js).not.toMatch(/innerHTML\s*=|outerHTML\s*=/);
    expect(pdf).toContain('html: preview.outerHTML');
    expect(sponsor).toContain("document.addEventListener('keydown', onKeyboard, true)");
  });

  it('keeps the PP-02 assets precached in the v66 PWA shell', () => {
    const sw = read('sw.js');
    expect(sw).toContain("CACHE_PREFIX + 'v66'");
    expect(sw).toContain("'./js/preview-protection.js'");
    expect(sw).toContain("'./css/preview-protection.css'");
  });
});
