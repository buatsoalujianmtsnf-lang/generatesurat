import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('css/arc-inspired.css');
const landing = read('js/landing.js');

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.className = '';
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.textContent = '';
    this.value = '';
    this.focused = false;
  }
  appendChild(el) { this.children.push(el); return el; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  hasAttribute(name) { return name === 'hidden' ? this.hidden : this.attributes.has(name); }
  toggleAttribute(name, force) {
    if (name === 'hidden') this.hidden = Boolean(force);
    else if (force) this.setAttribute(name, '');
    else this.attributes.delete(name);
  }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  emit(name, event = {}) { this.listeners.get(name)?.(event); }
  querySelectorAll(selector) {
    const list = [];
    const className = selector.slice(1);
    const visit = el => {
      for (const child of el.children) {
        if (child.className.split(' ').includes(className)) list.push(child);
        visit(child);
      }
    };
    visit(this);
    return list;
  }
}

function bootLanding() {
  const root = new FakeElement();
  const search = new FakeElement('input');
  const clear = new FakeElement('button');
  clear.hidden = true;
  const count = new FakeElement();
  const groupCount = new FakeElement();
  const status = new FakeElement();
  const elements = {
    'lp-template-groups': root, 'lp-template-count': count,
    'lp-group-count': groupCount, 'lp-template-search': search,
    'lp-search-results': status, 'lp-search-clear': clear,
  };
  const listeners = {};
  const document = {
    readyState: 'complete',
    activeElement: null,
    getElementById(id) { return elements[id] || null; },
    createElement(tag) { return new FakeElement(tag); },
    addEventListener(type, callback) { listeners[type] = callback; },
  };
  search.focus = () => { document.activeElement = search; };
  search.scrollIntoView = vi.fn();
  const groups = [{
    id: 'surat-menyurat-siswa', icon: 'file', title: 'Surat Siswa',
    templates: [
      { TEMPLATE_ID: 'surat-izin', meta: { name: 'Surat Izin', description: 'Tidak masuk sekolah', icon: 'file' } },
      { TEMPLATE_ID: 'surat-perjanjian-siswa', meta: { name: 'Surat Perjanjian', description: 'Siswa', icon: 'file' } },
    ],
  }];
  const ctx = {
    document, console,
    Routes: { isLanding: () => true, href: x => x, templateUrl: x => '/surat/' + x, categoryUrl: x => '/kategori/' + x },
    TemplateRegistry: { init: vi.fn(), getGroupedTemplates: () => groups, count: () => 2 },
  };
  runInNewContext(landing, ctx);
  return { root, search, clear, status, listeners, document, count, groupCount };
}

describe('Arc-inspired UI modernization', () => {
  it('layers on top of daisyUI without replacing the vanilla app or print engine', () => {
    expect(html.indexOf('css/arc-inspired.css')).toBeGreaterThan(html.indexOf('css/form-accordion-spacing.css'));
    expect(html).toContain('https://cdn.jsdelivr.net/npm/daisyui@5');
    for (const id of ['btn-print', 'btn-export-pdf', 'editor-drawer', 'preview-viewport', 'form-container', 'modal-overlay']) {
      expect(html).toContain('id="' + id + '"');
    }
    expect(css).toContain('@media print');
    expect(css).toContain('.app-container .surat-preview');
    expect(css).not.toContain('@import');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('html.dark-mode');
  });

  it('pre-caches its own local stylesheet and increments PWA version', () => {
    const sw = read('sw.js');
    expect(sw).toContain("'./css/arc-inspired.css'");
    expect(sw).toContain("CACHE_PREFIX + 'v55'");
    expect(sw).toContain("'./css/print.css'");
    expect(sw).toContain("'./css/daisyui-adapter.css'");
    expect(sw).not.toContain('uiarc.dev/r/');
  });

  it('keeps landing search semantics and keyboard skip targets accessible', () => {
    expect(html).toContain('role="search"');
    expect(html).toContain('id="lp-search-clear"');
    expect(html).toContain('aria-keyshortcuts="/"');
    expect(html).toContain('class="arc-skip arc-skip--landing"');
    expect(html).toContain('class="arc-skip arc-skip--editor"');
    expect(html).toContain('id="koleksi"');
    expect(html).toContain('id="editor-panel"');
  });

  it('filters templates and clears search without replacing registry URLs', () => {
    const app = bootLanding();
    const cards = app.root.querySelectorAll('.lp-template');
    expect(cards).toHaveLength(2);
    expect(app.count.textContent).toBe('2');
    app.search.value = 'perjanjian';
    app.search.emit('input');
    expect(cards[0].hidden).toBe(true);
    expect(cards[1].hidden).toBe(false);
    expect(app.clear.hidden).toBe(false);
    expect(app.status.textContent).toContain('1 template ditemukan');
    app.clear.emit('click');
    expect(app.search.value).toBe('');
    expect(cards.every(el => !el.hidden)).toBe(true);
    expect(app.status.textContent).toContain('Pilih template');
    expect(app.document.activeElement).toBe(app.search);
  });

  it('uses / only outside input controls and clears search with Escape', () => {
    const app = bootLanding();
    const prevent = vi.fn();
    app.listeners.keydown({ key: '/', target: { tagName: 'DIV' }, preventDefault: prevent });
    expect(prevent).toHaveBeenCalledOnce();
    expect(app.document.activeElement).toBe(app.search);
    expect(app.search.scrollIntoView).toHaveBeenCalledOnce();
    prevent.mockClear();
    app.listeners.keydown({ key: '/', target: { tagName: 'INPUT' }, preventDefault: prevent });
    expect(prevent).not.toHaveBeenCalled();
    app.search.value = 'tidak-ada';
    app.search.emit('input');
    app.listeners.keydown({ key: 'Escape', target: app.search, preventDefault: prevent });
    expect(app.search.value).toBe('');
    expect(prevent).toHaveBeenCalledOnce();
  });
});
