import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it, expect, vi } from 'vitest';

const read = name => readFileSync(new URL('../'+name, import.meta.url), 'utf8');
const html = read('index.html');

describe('DaisyUI editor drawer sidebar', () => {
  it('uses the semantic drawer structure with preview content and editor side', () => {
    expect(html).toContain('id="editor-drawer"');
    expect(html).toContain('class="drawer-toggle"');
    expect(html).toContain('class="drawer-content editor-drawer__content"');
    expect(html).toContain('class="drawer-side editor-drawer__side"');
    expect(html).toContain('class="drawer-overlay editor-drawer__overlay"');
    const checkbox = html.indexOf('id="editor-drawer-toggle"');
    const preview = html.indexOf('id="preview-panel"');
    const editor = html.indexOf('id="editor-panel"');
    expect(checkbox).toBeGreaterThan(0);
    expect(preview).toBeGreaterThan(checkbox);
    expect(editor).toBeGreaterThan(preview);
    expect(html).not.toContain('id="panel-resizer"');
    expect(html).not.toContain('id="mobile-preview-toggle"');
  });

  it('positions the one editor toggle in the work area, not in the application navbar', () => {
    const header = html.slice(html.indexOf('<header class="app-header'), html.indexOf('</header>'));
    const drawer = html.slice(html.indexOf('id="editor-drawer"'), html.indexOf('class="drawer-content editor-drawer__content"'));
    expect(header).not.toContain('id="editor-drawer-button"');
    expect(drawer).toContain('id="editor-drawer-button"');
    const css = read('css/editor-drawer.css');
    expect(css).toContain('#editor-drawer > .editor-drawer__edge-button');
    expect(css).toContain('.editor-drawer__toggle-slot--closed');
    expect(css).toContain('.editor-drawer__toggle-slot--open');
    expect(css).toContain('position: static;');
    expect(css).not.toContain('top: clamp(136px, 42dvh, 340px)');
    expect(css).toContain('focus-visible');
  });

  it('keeps all previous editor and preview DOM targets', () => {
    for (const id of [
      'tab-btn-template', 'tab-btn-kop', 'tab-btn-form', 'tab-btn-settings',
      'tab-template','tab-kop','tab-form','tab-settings',
      'template-list','form-container','kop-editor-root','settings-root',
      'workflow-actions','surat-preview','preview-viewport',
      'btn-export-pdf','btn-print','viewer-page-first',
    ]) expect(html).toContain('id="' + id + '"');
    expect(html.match(/id="editor-drawer-button"/g)).toHaveLength(1);
    expect(html).toContain('id="editor-drawer-toggle-slot-open"');
    expect(html).toContain('id="editor-drawer-toggle-slot-closed"');
    const previewPart = html.slice(html.indexOf('class="preview-toolbar__identity"'));
    expect(previewPart.indexOf('id="editor-drawer-toggle-slot-closed"'))
      .toBeLessThan(previewPart.indexOf('class="preview-toolbar__label">Preview Surat'));
    const headingPart = html.slice(html.indexOf('class="editor-drawer__heading"'));
    expect(headingPart.indexOf('<strong>Editor Surat</strong>'))
      .toBeLessThan(headingPart.indexOf('id="editor-drawer-toggle-slot-open"'));
    for (const id of ['editor-drawer-preview-open','editor-drawer-close',
      'editor-drawer-preview','btn-editor-panel-mobile']) {
      expect(html).not.toContain('id="'+id+'"');
    }
  });

  it('loads local drawer styles and script in order; PWA caches both', () => {
    expect(html).toContain('css/editor-drawer.css');
    const ui = html.indexOf('src="js/ui.js"');
    const drawer = html.indexOf('src="js/editor-drawer.js"');
    const app = html.indexOf('src="js/app.js"');
    expect(ui).toBeGreaterThan(0);
    expect(drawer).toBeGreaterThan(ui);
    expect(app).toBeGreaterThan(drawer);
    const shell = read('sw.js');
    expect(shell).toContain("'./css/editor-drawer.css'");
    expect(shell).toContain("'./js/editor-drawer.js'");
  });

  it('preserves document print styling and mobile overlay, including reduced motion', () => {
    const css = read('css/editor-drawer.css');
    expect(css).toContain('@media print');
    expect(css).toContain('@media (max-width: 1023px)');
    expect(css).toContain('.drawer-overlay');
    expect(css).toContain('html.editor-drawer-open');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(read('js/app.js')).toContain('EditorDrawer.init()');
    expect(read('js/ui.js')).toContain('EditorDrawer.open({ focus: false })');
  });

  it('sets initial compact state closed, desktop open, and toggles without changing letter data', () => {
    const nodes = new Map();
    const create = id => {
      const attrs = new Map();
      const events = {};
      const node = {
        id, checked: true, dataset: {}, inert:false, attrs, events,
        classList: {toggle: vi.fn()},
        getAttribute: k => attrs.get(k) || null,
        setAttribute: (k,v) => attrs.set(k,String(v)),
        addEventListener: (k,fn) => { events[k] = fn; },
        querySelector: () => null,
        closest:()=>null,
        focus:vi.fn(),
        querySelectorAll:()=>[],
      };
      nodes.set(id,node);return node;
    };
    for(const id of ['editor-drawer','editor-drawer-toggle','editor-panel',
      'editor-drawer-button']) create(id);
    const listeners = {};
    const compact = {matches:true,addEventListener:(k,fn)=>listeners.media=fn};
    const doc = {
      documentElement:{classList:{toggle:vi.fn()}},
      getElementById:id=>nodes.get(id)||null,
      addEventListener:(k,fn)=>{listeners[k]=fn},
      activeElement:null,
    };
    const ctx = {
      document:doc, HTMLElement:class {},
      window:{matchMedia:()=>compact}, console,
    };
    nodes.get('editor-drawer').querySelector = () => ({ addEventListener: vi.fn() });
    runInNewContext(read('js/editor-drawer.js'),ctx);
    const api = runInNewContext('EditorDrawer',ctx);
    api.init();
    expect(nodes.get('editor-drawer-toggle').checked).toBe(false);
    expect(nodes.get('editor-drawer').dataset.open).toBe('false');
    api.open({focus:false});
    expect(nodes.get('editor-drawer-toggle').checked).toBe(true);
    expect(nodes.get('editor-panel').inert).toBe(false);
    api.close();
    expect(nodes.get('editor-panel').inert).toBe(true);
    compact.matches = false;
    listeners.media();
    expect(nodes.get('editor-drawer-toggle').checked).toBe(true);
    expect(nodes.get('editor-panel').inert).toBe(false);
  });

  it('uses the same visible action to open and close at compact sizes', () => {
    const elements = new Map();
    const create = id => {
      const events = {};
      const attrs = {};
      const el = {
        id, checked: true, dataset: {}, inert: false, events, attrs, style: { setProperty: vi.fn() },
        classList: { toggle: vi.fn() }, focus: vi.fn(), title: '',
        setAttribute: (key, value) => { attrs[key] = String(value); },
        getAttribute: key => attrs[key] || null,
        addEventListener: (key, fn) => { events[key] = fn; },
        querySelector: selector => selector === '.editor-drawer__toggle-label' ? label : null,
        querySelectorAll: () => [], closest: () => null,
      };
      elements.set(id, el);
      return el;
    };
    const label = { textContent: '' };
    for (const id of ['editor-drawer','editor-drawer-toggle','editor-panel',
      'editor-drawer-button','btn-header-more']) create(id);
    const media = { matches: true, addEventListener: vi.fn() };
    const ctx = {
      console, HTMLElement: class {},
      window: { matchMedia: query => query.includes('767') ? { matches: true } : media,
        addEventListener: vi.fn() },
      document: {
        documentElement: { classList: { toggle: vi.fn() } },
        getElementById: id => elements.get(id) || null,
        addEventListener: vi.fn(),
        activeElement: null,
      },
    };
    runInNewContext(read('js/editor-drawer.js'), ctx);
    const api = runInNewContext('EditorDrawer', ctx);
    api.init();
    const root = elements.get('editor-drawer');
    const trigger = elements.get('editor-drawer-button');
    expect(root.dataset.open).toBe('false');
    expect(trigger.attrs['aria-expanded']).toBe('false');
    expect(label.textContent).toBe('Buka Editor');
    expect(typeof trigger.events.click).toBe('function');
    trigger.events.click();
    expect(root.dataset.open).toBe('true');
    expect(trigger.attrs['aria-expanded']).toBe('true');
    expect(label.textContent).toBe('Tutup Editor');
    trigger.events.click();
    expect(root.dataset.open).toBe('false');
    expect(trigger.attrs['aria-expanded']).toBe('false');
    expect(label.textContent).toBe('Buka Editor');
    expect(trigger.focus).toHaveBeenCalled();
    expect(elements.get('btn-header-more').focus).not.toHaveBeenCalled();
  });

  it('does not install click-close listeners on overlay or secondary buttons', () => {
    const js = read('js/editor-drawer.js');
    expect(js).toContain("const TRIGGER_ID = 'editor-drawer-button'");
    expect(js).toContain("trigger.addEventListener('click', toggleDrawer)");
    expect(js).toContain("syncTriggerPlacement(compact, next, trigger)");
    expect(js).toContain("'editor-drawer-toggle-slot-open'");
    expect(js).toContain("'editor-drawer-toggle-slot-closed'");
    expect(js).not.toContain("querySelector('.editor-drawer__overlay')?.addEventListener");
    for (const id of ['editor-drawer-preview-open', 'editor-drawer-close',
      'editor-drawer-preview', 'btn-editor-panel-mobile']) {
      expect(js).not.toContain("'"+id+"'");
    }
    const css = read('css/editor-drawer.css');
    expect(css).toContain('--drawer-header-offset');
    expect(css).toContain('z-index: 36');
    expect(css).toContain('min-height: 40px');
  });

});