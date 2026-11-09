import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('Navbar editor scroll horizontal', () => {
  it('mempertahankan seluruh tombol utama dan aksi tambahan dalam rail', () => {
    const html = read('index.html');
    const start = html.indexOf('<div class="app-header__actions"');
    const end = html.indexOf('</header>', start);
    expect(start).toBeGreaterThan(-1);
    const header = html.slice(start, end);
    expect(header).toContain('tabindex="0"');
    expect(header).toContain('aria-label="Tombol tindakan editor');
    for (const id of [
      'btn-export-pdf', 'btn-print', 'btn-install-app', 'btn-update-app',
      'btn-about', 'btn-theme-toggle', 'btn-undo', 'btn-redo', 'btn-save',
      'btn-export-data', 'btn-import-data', 'btn-reset',
    ]) {
      expect(header).toContain('id="' + id + '"');
    }
    expect(header).not.toContain('id="btn-header-more"');
    expect(header).toContain('id="header-overflow-group"');
  });

  it('membuat navbar satu baris, dapat digeser, dan tombol tidak menyusut', () => {
    const css = read('css/header-scroll.css');
    expect(css).toMatch(/\.app-header__actions\s*\{[^}]*flex-wrap:\s*nowrap;/s);
    expect(css).toMatch(/\.app-header__actions\s*\{[^}]*overflow-x:\s*auto;/s);
    expect(css).toMatch(/\.app-header__actions\s*>\s*\.btn[\s\S]*?flex:\s*0\s+0\s+auto/);
    expect(css).toContain('.header-overflow-group');
    expect(css).toContain('display: contents;');
    expect(css).toContain('scroll-snap-type: x proximity;');
  });

  it('mengutamakan CSS navbar sesudah CSS responsive tanpa memengaruhi halaman cetak', () => {
    const html = read('index.html');
    expect(html.indexOf('css/header-scroll.css')).toBeGreaterThan(html.indexOf('css/responsive.css'));
    expect(html.indexOf('css/header-scroll.css')).toBeGreaterThan(html.indexOf('css/dark-mode.css'));
    const css = read('css/header-scroll.css');
    expect(css.trimStart().indexOf('@media screen')).toBeGreaterThan(-1);
    expect(read('sw.js')).toContain("./css/header-scroll.css");
  });
});
