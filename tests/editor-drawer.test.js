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

  it('keeps all previous editor and preview DOM targets', () => {
    for (const id of [
      'tab-btn-template', 'tab-btn-kop', 'tab-btn-form', 'tab-btn-settings',
      'tab-template','tab-kop','tab-form','tab-settings',
      'template-list','form-container','kop-editor-root','settings-root',
      'workflow-actions','surat-preview','preview-viewport',
      'btn-export-pdf','btn-print','viewer-page-first',
    ]) expect(html).toContain('id="' + id + '"');
    for (const id of ['editor-drawer-button','editor-drawer-preview-open',
      'editor-drawer-close','editor-drawer-preview']) expect(html).toContain('id="'+id+'"');
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
      'editor-drawer-button','editor-drawer-preview-open',
      'editor-drawer-close','editor-drawer-preview']) create(id);
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
});
