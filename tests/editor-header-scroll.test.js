import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('Navbar editor desktop dan mobile', () => {
  it('mempertahankan semua tindakan lama dan menambahkan menu Lainnya di mobile', () => {
    const html = read('index.html');
    const start = html.indexOf('<div class="app-header__actions"');
    const end = html.indexOf('</header>', start);
    expect(start).toBeGreaterThan(-1);
    const header = html.slice(start, end);
    expect(header).toContain('role="group" aria-label="Tindakan editor"');
    for (const id of [
      'btn-export-pdf', 'btn-print', 'btn-header-more',
      'btn-install-app', 'btn-update-app', 'btn-about', 'btn-theme-toggle',
      'btn-undo', 'btn-redo', 'btn-save', 'btn-export-data',
      'btn-import-data', 'btn-reset',
    ]) {
      expect(header).toContain('id="' + id + '"');
    }
    expect(header).not.toContain('id="editor-drawer-button"');
    expect(html.slice(end)).toContain('id="editor-drawer-button"');
    expect(header).toContain('id="header-overflow-group"');
    expect(header).toContain('aria-controls="header-overflow-group"');
    expect(header).toContain('aria-expanded="false"');
  });

  it('menjaga deretan desktop dan menggunakan dropdown tanpa scroll rail di mobile', () => {
    const css = read('css/header-scroll.css');
    expect(css).toMatch(/\.app-header__actions\s*\{[^}]*flex-wrap:\s*nowrap;/s);
    expect(css).toMatch(/\.app-header__actions\s*\{[^}]*overflow-x:\s*auto;/s);
    expect(css).toMatch(/\.app-header__actions\s*>\s*\.btn[\s\S]*?flex:\s*0\s+0\s+auto/);
    expect(css).toContain('.header-overflow-group');
    expect(css).toContain('display: contents;'); // khusus desktop
    expect(css).toContain('@media screen and (max-width: 767px)');
    expect(css).toMatch(/\.app-header__actions\s*#header-overflow-group\s*\{[^}]*display:\s*none;/s);
    expect(css).toMatch(/\.app-header__actions\s*#header-overflow-group\.is-open\s*\{[^}]*display:\s*flex;/s);
    expect(css).toMatch(/\.app-header__actions\s*\{[^}]*overflow:\s*visible;/s);
    expect(css).toContain('scroll-snap-type: none;');
  });

  it('memuat CSS navbar setelah responsive dan mempertahankan dokumen cetak', () => {
    const html = read('index.html');
    expect(html.indexOf('css/header-scroll.css')).toBeGreaterThan(html.indexOf('css/responsive.css'));
    expect(html.indexOf('css/header-scroll.css')).toBeGreaterThan(html.indexOf('css/dark-mode.css'));
    const css = read('css/header-scroll.css');
    expect(css.trimStart().indexOf('@media screen')).toBeGreaterThan(-1);
    expect(read('sw.js')).toContain('./css/header-scroll.css');
  });
});
