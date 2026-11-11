import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it, expect, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function harness() {
  const handlers = new Map();
  const controls = new Map();
  function makeControl(id) {
    const listeners = new Map();
    const node = {
      id, value: '', max: '', disabled: false, textContent: '',
      listeners,
      addEventListener(name, fn) { listeners.set(name, fn); },
      setAttribute: vi.fn(),
      querySelector: () => null,
    };
    controls.set(id, node);
    return node;
  }
  for (const id of [
    'viewer-page-first','viewer-page-prev','viewer-page-next','viewer-page-last',
    'viewer-page-current','viewer-page-total','viewer-page-status',
    'viewer-template-label','viewer-focus-toggle',
  ]) makeControl(id);

  const viewport = {
    scrollTop: 0, scrollLeft: 0, scrollHeight: 3400, clientHeight: 500,
    listeners: new Map(),
    scrollTo: vi.fn(function ({ top }) { this.scrollTop = top; }),
    addEventListener(name, fn) { this.listeners.set(name, fn); },
    getBoundingClientRect() { return { top: 100, height: 500 }; },
  };
  const pages = Array.from({ length: 3 }, (_, index) => ({
    scrollIntoView: vi.fn(),
    getBoundingClientRect() {
      return { top: 100 + index * 1000 - viewport.scrollTop, height: 900 };
    },
  }));
  const preview = {
    dataset: { pageCount: '3' },
    querySelectorAll: () => pages,
    querySelector: () => null,
    classList: { contains: x => x === 'surat-preview--document' },
  };
  const document = {
    getElementById(id) {
      return id === 'preview-viewport' ? viewport
        : id === 'surat-preview' ? preview
        : id === 'preview-panel' ? { hidden: false, inert: false, getAttribute: () => null }
        : controls.get(id) || null;
    },
    querySelectorAll() { return [...controls.values()]; },
    addEventListener(name, fn) { handlers.set(name, fn); },
  };
  const ctx = {
    document,
    window: { matchMedia: () => ({ matches: true }) },
    State: { on: vi.fn(), getActiveTemplate: () => 'surat-izin' },
    TemplateRegistry: { get: () => ({ meta: { name: 'Surat Izin' } }) },
    requestAnimationFrame: cb => { cb(); return 1; },
    HTMLElement: class {},
  };
  runInNewContext(read('js/document-viewer.js') + '\n;globalThis.viewerApi=DocumentViewer;', ctx);
  const api = ctx.viewerApi;
  api.init();
  function click(name) {
    controls.get(name).listeners.get('click')();
  }
  return { viewport, pages, preview, controls, api, click };
}

describe('Preview page navigation never scrolls the document shell', () => {
  it('scrolls only #preview-viewport for next and last navigation', () => {
    const h = harness();
    h.click('viewer-page-next');
    expect(h.viewport.scrollTo).toHaveBeenCalledTimes(1);
    const arg = h.viewport.scrollTo.mock.calls[0][0];
    expect(arg.top).toBe(1000);
    expect(arg.left).toBe(0);
    expect(arg.behavior).toBe('auto');
    expect(h.controls.get('viewer-page-current').value).toBe('2');
    expect(h.pages.every(p => p.scrollIntoView.mock.calls.length === 0)).toBe(true);

    h.click('viewer-page-last');
    expect(h.viewport.scrollTop).toBe(2000);
    expect(h.controls.get('viewer-page-current').value).toBe('3');
    expect(h.controls.get('viewer-page-last').disabled).toBe(true);
  });

  it('clamps page input and handles first/previous without ancestor scroll', () => {
    const h = harness();
    h.click('viewer-page-last');
    h.controls.get('viewer-page-current').value = '99';
    h.controls.get('viewer-page-current').listeners.get('change')({
      target: h.controls.get('viewer-page-current'),
    });
    expect(h.viewport.scrollTop).toBe(2000);
    h.click('viewer-page-first');
    expect(h.viewport.scrollTop).toBe(0);
    expect(h.controls.get('viewer-page-first').disabled).toBe(true);
    expect(h.pages.every(p => p.scrollIntoView.mock.calls.length === 0)).toBe(true);
  });

  it('never calls scrollIntoView in the viewer source', () => {
    const viewer = read('js/document-viewer.js');
    expect(viewer).toContain('_viewport.scrollTo({ top, left: _viewport.scrollLeft, behavior })');
    expect(viewer).not.toMatch(/\.scrollIntoView\s*\(/);
    expect(read('index.html')).toContain('class="preview-toolbar"');
  });
});
