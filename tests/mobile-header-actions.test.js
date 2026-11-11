import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html = read('index.html');
const navbar = html.split('<!-- HEADER -->')[1].split('</header>')[0];
const actions = navbar.split('class="app-header__actions"')[1];
const menu = navbar.split('id="header-overflow-group" role="group"')[1];

describe('Mobile editor navbar actions', () => {
  it('keeps PDF and Cetak visible while offering an accessible Lainnya trigger', () => {
    expect(actions).toBeTruthy();
    for (const id of ['btn-export-pdf', 'btn-print', 'btn-header-more']) {
      expect(actions).toContain('id="' + id + '"');
    }
    expect(navbar).toMatch(/id="btn-header-more"[\s\S]*?aria-controls="header-overflow-group"/);
    expect(navbar).toContain('aria-expanded="false"');
    expect(actions.indexOf('id="btn-print"')).toBeLessThan(actions.indexOf('id="btn-header-more"'));
    expect(actions.indexOf('id="btn-header-more"')).toBeLessThan(actions.indexOf('id="header-overflow-group"'));
  });

  it('keeps all remaining actions inside the single overflow group', () => {
    expect(menu).toBeTruthy();
    for (const id of [
      'editor-drawer-button', 'btn-install-app', 'btn-update-app',
      'btn-about', 'btn-theme-toggle', 'btn-undo', 'btn-redo',
      'btn-save', 'btn-export-data', 'btn-import-data', 'btn-reset',
    ]) expect(menu).toContain('id="' + id + '"');
    expect(menu).not.toContain('id="btn-export-pdf"');
    expect(menu).not.toContain('id="btn-print"');
  });

  it('uses mobile-only dropdown instead of horizontal scroll, preserving desktop controls', () => {
    const css = read('css/header-scroll.css');
    expect(css).toContain('@media screen and (max-width: 767px)');
    expect(css).toContain('.app-header__actions #header-overflow-group');
    expect(css).toContain('.app-header__actions > #btn-header-more');
    expect(css).toContain('.app-header__actions #header-overflow-group.is-open');
    expect(css).toContain('overflow: visible;');
    expect(css).toContain('overscroll-behavior: contain;');
    const js = read('js/ui.js');
    expect(js).toContain("document.getElementById('btn-header-more')");
    expect(js).toContain("e.key === 'Escape'");
    const drawer = read('js/editor-drawer.js');
    expect(drawer).toContain("const TRIGGER_ID = 'editor-drawer-button'");
  });

  it('refreshes the offline PWA shell for the navbar change', () => {
    expect(read('sw.js')).toContain("CACHE_PREFIX + 'v54'");
  });
});
