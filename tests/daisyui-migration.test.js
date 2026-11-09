import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const html = read('index.html');

describe('daisyUI 5 migration contract: vanilla JS application', () => {
  it('loads daisyUI CSS before existing CSS with a local adapter after all styles', () => {
    const cdn = html.indexOf('https://cdn.jsdelivr.net/npm/daisyui@5');
    const local = html.indexOf('css/main.css');
    const adapter = html.indexOf('css/daisyui-adapter.css');
    const lastCustom = html.indexOf('css/izin-declaration.css');
    expect(cdn).toBeGreaterThan(0);
    expect(local).toBeGreaterThan(cdn);
    expect(adapter).toBeGreaterThan(lastCustom);
  });

  it('allows style CDN but does not allow third-party scripts', () => {
    const csp = JSON.parse(read('vercel.json')).headers[0].headers.find(x => x.key === 'Content-Security-Policy').value;
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*cdn\.jsdelivr/i);
    expect(html).not.toContain('https://cdn.jsdelivr.net/npm/@tailwindcss/browser');
  });

  it('preserves offline app CSS fallback in service worker and leaves print document isolated', () => {
    const sw = read('sw.js');
    const adapter = read('css/daisyui-adapter.css');
    expect(sw).toContain("'./css/daisyui-adapter.css'");
    expect(sw).toContain("'./css/preview.css'");
    expect(sw).toContain("'./css/print.css'");
    expect(adapter).toContain('@media print');
    expect(adapter).toContain('.doc-content');
    expect(adapter).toContain('#modal-overlay.modal.hidden');
  });

  it('has daisyUI primitives in global shell without losing existing DOM IDs', () => {
    expect(html).toMatch(/id="modal-overlay" class="[^"]*modal[^"]*"/);
    expect(html).toMatch(/class="[^"]*editor-tabs[^"]*tabs[^"]*"/);
    expect(html).toMatch(/class="[^"]*app-header[^"]*navbar[^"]*"/);
    expect(html).toMatch(/class="[^"]*lp__feature[^"]*card[^"]*"/);
    for (const id of ['btn-export-pdf', 'btn-print', 'template-list', 'form-container', 'preview-viewport']) {
      expect(html).toContain('id="' + id + '"');
    }
  });

  it('applies daisyUI to dynamic UI while preserving original class hooks', () => {
    const form = read('js/form-renderer.js');
    const settings = read('js/settings.js');
    const table = read('js/table-config-ui.js');
    const ui = read('js/ui.js');
    const landing = read('js/landing.js');
    expect(form).toMatch(/class="form-input input"/);
    expect(form).toMatch(/class="form-select select"/);
    expect(settings).toContain('settings-card card');
    expect(table).toContain('form-input input');
    expect(ui).toContain('toast--${type} alert alert-');
    expect(landing).toContain("'lp-group': 'card'");
  });

  it('keeps explicit light / dark theme selection and early bootstrap', () => {
    expect(read('js/theme-init.js')).toContain('document.documentElement.dataset.theme');
    expect(read('js/theme.js')).toContain('html.dataset.theme');
    expect(read('js/theme.js')).toContain("localStorage.setItem(STORAGE_KEY");
  });
});
