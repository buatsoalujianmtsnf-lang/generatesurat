import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function makeHarness(flag = 'off') {
  const frames = [];
  const observers = [];
  const subscriptions = new Map();
  const removed = [];
  const listeners = [];
  const page = (left, top, width = 100, height = 120) => ({
    getBoundingClientRect: () => ({ left, top, width, height }),
  });
  const pages = [page(20, 40), page(20, 180)];
  const wrapper = {
    offsetWidth: 100,
    offsetHeight: 300,
    getBoundingClientRect: () => ({ left: 20, top: 40, width: 100, height: 300 }),
  };
  const viewport = {};
  const preview = {
    parentElement: wrapper,
    dataset: { pageCount: '2' },
    querySelectorAll: selector => selector === ':scope > .surat-page' ? pages : [],
    querySelector: () => null,
  };
  const layer = {
    hidden: true,
    parentElement: wrapper,
    sheets: [],
    replaceChildren(fragment) {
      this.sheets = fragment ? [...fragment.children] : [];
    },
  };
  const elements = {
    'preview-canvas-wrapper': wrapper,
    'preview-viewport': viewport,
    'surat-preview': preview,
    'preview-protection-layer': layer,
  };
  const document = {
    documentElement: { dataset: { previewProtection: flag } },
    getElementById: id => elements[id] || null,
    createDocumentFragment: () => ({
      children: [],
      appendChild(el) { this.children.push(el); },
    }),
    createElement: () => ({
      style: {},
      setAttribute: vi.fn(),
    }),
    addEventListener: (name, fn) => { listeners.push(['document', name, fn]); },
    removeEventListener: (name, fn) => { removed.push(['document', name, fn]); },
  };
  const window = {
    requestAnimationFrame(fn) { frames.push(fn); return frames.length; },
    cancelAnimationFrame: vi.fn(),
    addEventListener: (name, fn) => { listeners.push(['window', name, fn]); },
    removeEventListener: (name, fn) => { removed.push(['window', name, fn]); },
  };
  class FakeObserver {
    constructor(callback) { this.callback = callback; this.disconnect = vi.fn(); observers.push(this); }
    observe() {}
  }
  const State = {
    on(name, callback) {
      subscriptions.set(name, callback);
      return () => { subscriptions.delete(name); };
    },
  };
  const context = { document, window, State, MutationObserver: FakeObserver, ResizeObserver: FakeObserver };
  runInNewContext(read('js/preview-protection.js') + '\n;globalThis._api = PreviewProtection;', context);
  const api = context._api;
  function flush() {
    // Drain the most recent frame once; the module intentionally batches work.
    while (frames.length) frames.shift()();
  }
  return { api, document, layer, pages, preview, frames, flush, observers, subscriptions, listeners, removed, window };
}

describe('PP-01 preview protection foundation', () => {
  it('is inert when deliberately disabled and mounts no listeners or overlay sheets', () => {
    const h = makeHarness();
    expect(h.api.init()).toBe(true);
    expect(h.api.init()).toBe(true);
    h.flush();
    expect(h.api.getStatus()).toMatchObject({ initialized: true, enabled: false, pageCount: 0 });
    expect(h.layer.hidden).toBe(true);
    expect(h.layer.sheets).toHaveLength(0);
    expect(h.observers).toHaveLength(0);
    expect(h.listeners).toHaveLength(0);
  });

  it('requires an explicit on flag and positions transparent sheets using zoom-local coordinates', () => {
    const h = makeHarness('on');
    expect(h.api.init()).toBe(true);
    expect(h.frames).toHaveLength(1);
    h.flush();
    expect(h.api.getStatus()).toMatchObject({ enabled: true, pageCount: 2 });
    expect(h.layer.hidden).toBe(false);
    expect(h.layer.sheets).toHaveLength(2);
    expect(h.layer.sheets[0].style).toMatchObject({ left: '0px', top: '0px', width: '100px', height: '120px' });
    expect(h.layer.sheets[1].style.top).toBe('140px');
    expect(h.observers).toHaveLength(2);
    expect(h.subscriptions.has('ui:zoomChange')).toBe(true);
  });

  it('stays accurate under scaled wrapper geometry', () => {
    const h = makeHarness('on');
    const wrapper = h.document.getElementById('preview-canvas-wrapper');
    wrapper.getBoundingClientRect = () => ({ left: 5, top: 10, width: 50, height: 150 });
    h.pages[0].getBoundingClientRect = () => ({ left: 5, top: 10, width: 50, height: 60 });
    h.pages[1].getBoundingClientRect = () => ({ left: 5, top: 80, width: 50, height: 60 });
    h.api.init();
    h.flush();
    expect(h.layer.sheets[0].style.width).toBe('100px');
    expect(h.layer.sheets[1].style.top).toBe('140px');
  });

  it('does not show pages while pagination is pending or preview is empty', () => {
    const h = makeHarness('on');
    h.api.init();
    h.flush();
    h.pages.length = 0;
    h.preview.dataset.pageCount = '0';
    h.observers[0].callback();
    h.flush();
    expect(h.layer.hidden).toBe(true);
    expect(h.api.getStatus().pageCount).toBe(0);
  });

  it('synchronizes on state, mutation and resize events without duplicate listeners', () => {
    const h = makeHarness('on');
    h.api.init();
    h.api.init();
    h.flush();
    expect(h.listeners.filter(x => x[1] === 'resize')).toHaveLength(1);
    h.subscriptions.get('ui:zoomChange')();
    h.observers[0].callback();
    h.observers[1].callback();
    expect(h.frames).toHaveLength(1);
    h.flush();
    expect(h.api.getStatus().pageCount).toBe(2);
  });

  it('cleans up on flag OFF, supports reactivation and destroys idempotently', () => {
    const h = makeHarness('on');
    h.api.init();
    h.flush();
    h.document.documentElement.dataset.previewProtection = 'off';
    expect(h.api.refresh()).toBe(false);
    expect(h.layer.hidden).toBe(true);
    expect(h.layer.sheets).toHaveLength(0);
    expect(h.subscriptions.size).toBe(0);
    expect(h.observers.every(x => x.disconnect.mock.calls.length > 0)).toBe(true);
    h.document.documentElement.dataset.previewProtection = 'on';
    expect(h.api.refresh()).toBe(true);
    h.flush();
    expect(h.api.getStatus().pageCount).toBe(2);
    h.api.destroy();
    h.api.destroy();
    expect(h.api.getStatus()).toMatchObject({ initialized: false, enabled: false, pageCount: 0 });
    expect(h.layer.hidden).toBe(true);
    expect(h.removed.some(x => x[1] === 'resize')).toBe(true);
  });

  it('does not mutate document HTML, listen to keyboard, read clipboard or bypass export gate', () => {
    const html = read('index.html');
    const source = read('js/preview-protection.js');
    const css = read('css/preview-protection.css');
    const pdf = read('js/pdf-export.js');
    const sponsor = read('js/sponsor-export-gate.js');
    expect(html).toContain('data-preview-protection="on"');
    expect(html).toMatch(/id="surat-preview"[\s\S]*?id="preview-protection-layer"/);
    expect(source).not.toMatch(/addEventListener\(['"](?:keydown|keyup|contextmenu)/);
    expect(source).not.toMatch(/navigator\.clipboard|innerHTML\s*=|outerHTML\s*=/);
    expect(css).toContain('@media print');
    expect(css).toContain('pointer-events: none');
    expect(pdf).toContain('html: preview.outerHTML');
    expect(sponsor).toContain("document.addEventListener('keydown', onKeyboard, true)");
  });

  it('precaches both assets in the new offline app shell', () => {
    const sw = read('sw.js');
    expect(sw).toContain("'./js/preview-protection.js'");
    expect(sw).toContain("'./css/preview-protection.css'");
    expect(sw).toContain("CACHE_PREFIX + 'v66'");
  });
});
