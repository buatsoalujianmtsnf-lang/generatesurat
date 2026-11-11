import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function harness(flag = 'on') {
  const listeners = new Map();
  const windowListeners = new Map();
  const documentListeners = new Map();
  const frames = [];
  const observers = [];
  const UI = { toast: vi.fn() };
  const add = (map, name, callback) => {
    map.set(name, [...(map.get(name) || []), callback]);
  };
  const remove = (map, name, callback) => {
    map.set(name, (map.get(name) || []).filter(fn => fn !== callback));
  };
  const wrapper = {
    offsetWidth: 210,
    offsetHeight: 297,
    getBoundingClientRect() { return { left: 0, top: 0, width: 210, height: 297 }; },
  };
  const preview = {
    parentElement: wrapper,
    dataset: { pageCount: '1' },
    querySelectorAll(selector) {
      return selector === ':scope > .surat-page'
        ? [{ getBoundingClientRect: () => ({ left: 0, top: 0, width: 210, height: 297 }) }]
        : [];
    },
    querySelector() { return null; },
    contains(node) { return node?.inPreview === true; },
    addEventListener(name, callback) { add(listeners, name, callback); },
    removeEventListener(name, callback) { remove(listeners, name, callback); },
  };
  const layer = {
    parentElement: wrapper,
    classList: { toggle() {}, remove() {} },
    hidden: true,
    replaceChildren() {},
  };
  const status = { hidden: true, querySelector() { return { textContent: '' }; } };
  const document = {
    documentElement: { dataset: { previewProtection: flag, previewProtectionMode: 'strict' } },
    hidden: false,
    visibilityState: 'visible',
    getElementById(id) {
      return ({
        'surat-preview': preview,
        'preview-protection-layer': layer,
        'preview-protection-status': status,
        'preview-canvas-wrapper': wrapper,
        'preview-viewport': {},
      })[id] || null;
    },
    createDocumentFragment() { return { children: [], appendChild(node) { this.children.push(node); } }; },
    createElement() { return { style: {}, setAttribute() {} }; },
    addEventListener(name, callback) { add(documentListeners, name, callback); },
    removeEventListener(name, callback) { remove(documentListeners, name, callback); },
  };
  const window = {
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
    cancelAnimationFrame: vi.fn(),
    addEventListener(name, callback) { add(windowListeners, name, callback); },
    removeEventListener(name, callback) { remove(windowListeners, name, callback); },
  };
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnect = vi.fn(); observers.push(this); }
    observe() {}
  }
  const State = { on() { return () => {}; } };
  runInNewContext(read('js/preview-protection.js') + '\nglobalThis._pp = PreviewProtection;', {
    UI, State, document, window, MutationObserver: Observer, ResizeObserver: Observer,
  });
  // NOTE: capture the global returned by the same evaluation context below.
  const ctx = { UI, State, document, window, MutationObserver: Observer, ResizeObserver: Observer };
  runInNewContext(read('js/preview-protection.js') + '\nglobalThis._pp = PreviewProtection;', ctx);
  const api = ctx._pp;
  function flush() {
    let safety = 0;
    while (frames.length && safety++ < 20) frames.shift()();
    if (frames.length) throw new Error('Unexpected RAF loop');
  }
  function node({ media = false, editable = false, inPreview = true, textNode = false } = {}) {
    const element = {
      nodeType: 1,
      inPreview,
      closest(selector) {
        if (selector.startsWith('input,') || selector.startsWith('input,')) return editable ? this : null;
        if (selector.startsWith('img,')) return media ? this : null;
        return null;
      },
    };
    return textNode ? { nodeType: 3, parentElement: element, inPreview } : element;
  }
  function event(target, options = {}) {
    return {
      target,
      button: options.button ?? 2,
      ctrlKey: options.ctrlKey ?? false,
      pointerType: options.pointerType ?? '',
      cancelable: options.cancelable ?? true,
      defaultPrevented: options.defaultPrevented ?? false,
      preventDefault: vi.fn(function () { this.defaultPrevented = true; }),
    };
  }
  function dispatch(type, e) { for (const callback of listeners.get(type) || []) callback(e); }
  return { api, UI, preview, document, listeners, documentListeners, windowListeners,
    node, event, dispatch, flush, observers };
}

describe('PP-03 — preview-only interaction guard', () => {
  it('is inert when feature flag is off, including no preview handlers', () => {
    const h = harness('off');
    expect(h.api.init()).toBe(true);
    expect(h.api.getStatus()).toMatchObject({ enabled: false, interactionsProtected: false });
    expect(h.listeners.size).toBe(0);
    const e = h.event(h.node());
    h.dispatch('contextmenu', e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('attaches one contextmenu and dragstart handler only to #surat-preview', () => {
    const h = harness();
    h.api.init();
    h.api.init();
    h.flush();
    expect(h.listeners.get('contextmenu')).toHaveLength(1);
    expect(h.listeners.get('dragstart')).toHaveLength(1);
    expect(h.documentListeners.has('contextmenu')).toBe(false);
    expect(h.windowListeners.has('contextmenu')).toBe(false);
    expect(h.documentListeners.has('keydown')).toBe(false);
    expect(h.windowListeners.has('keydown')).toBe(false);
    expect(h.api.getStatus().interactionsProtected).toBe(true);
  });

  it('stops mouse right-click only inside actual preview, with a single UX notice', () => {
    const h = harness();
    h.api.init();
    const e = h.event(h.node(), { button: 2 });
    h.dispatch('contextmenu', e);
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
    expect(h.UI.toast).toHaveBeenCalledTimes(1);
    expect(h.UI.toast.mock.calls[0][0]).toContain('Preview Surat');
    const second = h.event(h.node());
    h.dispatch('contextmenu', second);
    expect(second.preventDefault).toHaveBeenCalledTimes(1);
    expect(h.UI.toast).toHaveBeenCalledTimes(1); // cooldown against spam
  });

  it('handles macOS Ctrl-click and touch contextmenu gestures', () => {
    const h = harness();
    h.api.init();
    const ctrl = h.event(h.node(), { button: 0, ctrlKey: true });
    h.dispatch('contextmenu', ctrl);
    expect(ctrl.preventDefault).toHaveBeenCalledTimes(1);
    const touch = h.event(h.node(), { button: 0, pointerType: 'touch' });
    h.dispatch('contextmenu', touch);
    expect(touch.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('preserves keyboard context menu and normal left click', () => {
    const h = harness();
    h.api.init();
    const keyboard = h.event(h.node(), { button: -1 });
    h.dispatch('contextmenu', keyboard);
    expect(keyboard.preventDefault).not.toHaveBeenCalled();
    const left = h.event(h.node(), { button: 0 });
    h.dispatch('contextmenu', left);
    expect(left.preventDefault).not.toHaveBeenCalled();
    expect(h.UI.toast).not.toHaveBeenCalled();
  });

  it('preserves input, contenteditable, links and controls in the preview', () => {
    const h = harness();
    h.api.init();
    const editable = h.event(h.node({ editable: true }));
    h.dispatch('contextmenu', editable);
    expect(editable.preventDefault).not.toHaveBeenCalled();
    const imageInsideLink = h.event(h.node({ editable: true, media: true }));
    h.dispatch('dragstart', imageInsideLink);
    expect(imageInsideLink.preventDefault).not.toHaveBeenCalled();
  });

  it('blocks dragstart of preview images/SVG only while preserving text drag', () => {
    const h = harness();
    h.api.init();
    const image = h.event(h.node({ media: true }));
    h.dispatch('dragstart', image);
    expect(image.preventDefault).toHaveBeenCalledTimes(1);
    const svg = h.event(h.node({ media: true, textNode: true }));
    h.dispatch('dragstart', svg);
    expect(svg.preventDefault).toHaveBeenCalledTimes(1);
    const text = h.event(h.node());
    h.dispatch('dragstart', text);
    expect(text.preventDefault).not.toHaveBeenCalled();
  });

  it('does not cancel outside elements, already-cancelled events or noncancelable events', () => {
    const h = harness();
    h.api.init();
    for (const options of [
      { target: h.node({ inPreview: false }), button: 2 },
      { target: h.node(), button: 2, defaultPrevented: true },
      { target: h.node(), button: 2, cancelable: false },
    ]) {
      const e = h.event(options.target, options);
      h.dispatch('contextmenu', e);
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
  });

  it('detaches handlers on refresh OFF and destroy, then binds once on reactivation', () => {
    const h = harness();
    h.api.init();
    h.document.documentElement.dataset.previewProtection = 'off';
    expect(h.api.refresh()).toBe(false);
    expect(h.listeners.get('contextmenu')).toHaveLength(0);
    expect(h.listeners.get('dragstart')).toHaveLength(0);
    h.document.documentElement.dataset.previewProtection = 'on';
    expect(h.api.refresh()).toBe(true);
    h.api.init();
    expect(h.listeners.get('contextmenu')).toHaveLength(1);
    h.api.destroy();
    h.api.destroy();
    expect(h.listeners.get('contextmenu')).toHaveLength(0);
    expect(h.api.getStatus().interactionsProtected).toBe(false);
  });

  it('keeps copy/select/keyboard/printing available and export authorization untouched', () => {
    const source = read('js/preview-protection.js');
    const print = read('js/print.js');
    const pdf = read('js/pdf-export.js');
    const sponsor = read('js/sponsor-export-gate.js');
    const css = read('css/preview-protection.css');
    const html = read('index.html');
    expect(source).toContain("preview.addEventListener?.('contextmenu', _onPreviewContextMenu)");
    expect(source).toContain("preview.addEventListener?.('dragstart', _onPreviewDragStart)");
    expect(source).not.toMatch(/(?:document|window)\.addEventListener\(['"](?:contextmenu|dragstart|copy|keydown)/);
    expect(source).not.toMatch(/addEventListener\??\.\?\(['"](?:copy|cut|selectstart|keyup|keydown)/);
    expect(css).not.toContain('user-select: none !important');
    expect(css).toContain('html[data-preview-protection="on"] #surat-preview img');
    expect(html).toContain('data-preview-protection="off"');
    expect(pdf).toContain('html: preview.outerHTML');
    expect(print).toContain('window.print()');
    expect(sponsor).toContain("document.addEventListener('keydown', onKeyboard, true)");
  });

  it('updates PWA cache when JS/CSS changes', () => {
    const sw = read('sw.js');
    expect(sw).toContain("CACHE_PREFIX + 'v60'");
    expect(sw).toContain("'./js/preview-protection.js'");
    expect(sw).toContain("'./css/preview-protection.css'");
  });
});
