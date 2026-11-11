import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const css = read('css/form-accordion-spacing.css');
const html = read('index.html');

describe('Isi Surat accordion card spacing', () => {
  it('scopes the layout exclusively to the Isi Surat tab', () => {
    expect(html).toContain('id="tab-form"');
    expect(html).toContain('id="form-container"');
    expect(css).toContain('#tab-form #form-container');
    expect(css).toContain('#tab-form #form-container > .form-section.card');
    expect(css).not.toContain('.doc-content');
    expect(css).not.toContain('.surat-page');
  });

  it('separates the accordion cards with flex gap and preserves the last border', () => {
    expect(css).toMatch(/#tab-form #form-container\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*gap:\s*var\(--editor-card-gap\);/s);
    expect(css).toMatch(/#tab-form #form-container > \.form-section\.card\s*\{[^}]*margin:\s*0;[^}]*border:\s*1px solid var\(--color-border\);/s);
    expect(css).toContain('#tab-form #form-container > .form-section.card:last-child');
    expect(css).toContain('box-sizing: border-box');
  });

  it('gives nested participant accordions a predictable gap without extra margins', () => {
    expect(read('js/form-renderer.js')).toContain("wrap.className = 'form-section card'");
    expect(read('js/form-renderer.js')).toContain("entry.className = 'row-entry card'");
    expect(css).toMatch(/#tab-form \[id\^="repeatable-list-"\]\s*\{[^}]*display:\s*grid;[^}]*gap:\s*var\(--editor-nested-gap\);/s);
    expect(css).toContain('#tab-form [id^="repeatable-list-"] > .row-entry.card');
  });

  it('aligns the separate table configuration accordion and leaves hidden state intact', () => {
    const form = read('js/form-renderer.js');
    expect(form).toContain("mountEl.id = 'table-config-mount'");
    expect(css).toContain('#tab-form #table-config-mount');
    expect(css).toContain('#tab-form #table-config-mount[hidden]');
    expect(css).toContain('#tab-form #table-config-mount > .tbl-cfg-accordion');
  });

  it('loads responsive styles after the original card styles and caches them offline', () => {
    const addon = html.indexOf('css/form-accordion-spacing.css');
    expect(addon).toBeGreaterThan(html.indexOf('css/editor-drawer.css'));
    expect(addon).toBeGreaterThan(html.indexOf('css/daisyui-adapter.css'));
    expect(css).toContain('@media screen and (max-width: 767px)');
    const sw = read('sw.js');
    expect(sw).toContain("'./css/form-accordion-spacing.css'");
    expect(sw).toContain("CACHE_PREFIX + 'v66'");
  });
});
