import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function modalHarness() {
  class HTMLElementMock {}
  const elements = new Map();
  function node(id) {
    const el = new HTMLElementMock();
    const tokens = new Set();
    const attributes = {};
    el.id = id;
    el.innerHTML = '';
    el.textContent = '';
    el.hidden = false;
    el.children = [];
    el.attrs = attributes;
    el.classList = {
      add: value => tokens.add(value),
      remove: value => tokens.delete(value),
      contains: value => tokens.has(value),
    };
    el.setAttribute = (key, value) => { attributes[key] = String(value); };
    el.appendChild = child => { el.children.push(child); return child; };
    el.querySelector = () => null;
    el.focus = vi.fn();
    return el;
  }
  for (const id of ['modal-overlay', 'modal-title', 'modal-body', 'modal-footer', 'modal-close-btn']) {
    elements.set(id, node(id));
  }
  elements.get('modal-overlay').classList.add('hidden');
  const handlers = new Map();
  const ctx = {
    Storage: {},
    Utils: { escapeHtml: value => String(value) },
    HTMLElement: HTMLElementMock,
    document: {
      activeElement: elements.get('modal-overlay'),
      getElementById: id => elements.get(id) || null,
      createElement: () => {
        const item = node('dynamic');
        item.addEventListener = (type, fn) => { item['on' + type] = fn; };
        return item;
      },
      contains: () => false,
      addEventListener: (type, fn) => handlers.set(type, fn),
      removeEventListener: (type, fn) => { if (handlers.get(type) === fn) handlers.delete(type); },
    },
    requestAnimationFrame: cb => cb(),
    setTimeout: () => 1,
    clearTimeout: () => {},
    console,
  };
  runInNewContext(read('js/ui.js'), ctx);
  return { ui: runInNewContext('UI', ctx), elements };
}

describe('Editor action regression: PDF, Cetak, Tentang, Reset', () => {
  it('opens a daisyUI modal as modal-open, then removes it on close', () => {
    const { ui, elements } = modalHarness();
    const overlay = elements.get('modal-overlay');
    ui.showModal({ title: 'Tentang / About', body: '<p>Informasi</p>' });
    expect(overlay.classList.contains('hidden')).toBe(false);
    expect(overlay.classList.contains('modal-open')).toBe(true);
    expect(overlay.attrs['aria-hidden']).toBe('false');
    ui.hideModal();
    expect(overlay.classList.contains('modal-open')).toBe(false);
    expect(overlay.classList.contains('hidden')).toBe(true);
    expect(overlay.attrs['aria-hidden']).toBe('true');
  });

  it('executes Reset only after confirmation, not on cancel', () => {
    const { ui, elements } = modalHarness();
    const reset = vi.fn();
    ui.confirm('Reset Data', 'Hapus data?', reset);
    const footer = elements.get('modal-footer');
    expect(footer.children).toHaveLength(2);
    footer.children[0].onclick();
    expect(reset).not.toHaveBeenCalled();
    ui.confirm('Reset Data', 'Hapus data?', reset);
    const buttons = footer.children.slice(-2);
    buttons[1].onclick();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('keeps four navbar actions as dedicated non-submit buttons', () => {
    const html = read('index.html');
    for (const id of ['btn-export-pdf', 'btn-print', 'btn-about', 'btn-reset']) {
      expect(html).toContain('type="button" id="' + id + '"');
    }
    const app = read('js/app.js');
    expect(app).toContain("document.getElementById('btn-export-pdf')?.addEventListener('click'");
    expect(app).toContain("document.getElementById('btn-print')?.addEventListener('click'");
    expect(app).toContain("document.getElementById('btn-reset')?.addEventListener('click'");
    expect(read('js/about.js')).toContain("button.addEventListener('click', open)");
    expect(read('js/workflow.js')).toContain('preparePdf');
    expect(read('js/workflow.js')).toContain('preparePrint');
  });

  it('makes active modal visibly interactive despite daisyUI default modal styles', () => {
    const css = read('css/daisyui-adapter.css');
    expect(css).toContain('#modal-overlay.modal.modal-open:not(.hidden)');
    expect(css).toContain('visibility: visible');
    expect(css).toContain('opacity: 1');
    expect(css).toContain('pointer-events: auto');
  });

  it('does not defer window.print behind timers, and handles print errors', async () => {
    const print = vi.fn();
    const timers = [];
    const toast = vi.fn();
    const styles = [];
    const doc = {
      head: { appendChild: item => styles.push(item) },
      getElementById: () => null,
      createElement: () => ({ id:'', textContent:'' }),
    };
    const ctx = {
      document: doc,
      window: { print },
      setTimeout: callback => { timers.push(callback); return timers.length; },
      console,
      State: {
        getActiveTemplate: () => 'dpu',
        getFormData: () => ({ header: {} }),
        getSettings: () => ({ print: {} }),
        getPaperDimensions: () => ({ widthMm: 297, heightMm: 210 }),
      },
      Utils: { flushDebounces: vi.fn() },
      TemplateRegistry: { get: () => ({}) },
      PreviewRenderer: { waitForReady: async () => true },
      UI: { toast },
    };
    runInNewContext(read('js/print.js'), ctx);
    const api = runInNewContext('Print', ctx);
    expect(await api.printDocument()).toBe(true);
    expect(print).toHaveBeenCalledTimes(1);
    expect(styles).toHaveLength(1);
    expect(timers).toHaveLength(1); // cleanup only
    print.mockImplementation(() => { throw new Error('blocked'); });
    expect(await api.printDocument()).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('dialog cetak'), 'error');
  });

  it('restores PDF label and export state in the finally path', () => {
    const source = read('js/pdf-export.js');
    expect(source).toContain("label.textContent = isExporting ? 'Membuat PDF…' : 'PDF'");
    expect(source).toMatch(/_exporting = true;[\s\S]*?try \{[\s\S]*?await PreviewRenderer\.waitForReady\(\)/);
    expect(source).toContain('} finally {');
    expect(source).toContain('_setExportState(false)');
    expect(source).toContain('_exporting = false');
  });

  it('bumps offline cache after the synchronized action update', () => {
    expect(read('sw.js')).toContain("CACHE_PREFIX + 'v62'");
    expect(read('sw.js')).toContain("'./js/ui.js'");
    expect(read('sw.js')).toContain("'./js/print.js'");
    expect(read('sw.js')).toContain("'./js/pdf-export.js'");
  });
});
