import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('Generate Suratku brand and accordion defaults', () => {
  it('uses new branding throughout user-facing entry points', () => {
    const html = read('index.html');
    const manifest = JSON.parse(read('manifest.webmanifest'));
    expect(html).toContain('<title>Generate Suratku');
    expect(html).toContain('Buat surat lebih praktis bersama');
    expect(html).toContain('GENERATE SURATKU');
    expect(html).not.toContain('Generator Surat Madrasah');
    expect(manifest.name).toBe('Generate Suratku');
    expect(manifest.short_name).toBe('Generate Suratku');
    expect(read('js/routes.js')).toContain('Editor Surat | Generate Suratku');
    expect(read('js/about.js')).toContain("title: 'Tentang / About'");
    expect(read('js/about.js')).not.toContain('Selamat Datang di Generate Suratku');
    expect(read('js/platform.js')).toContain('Generate Suratku berhasil dipasang');
  });

  it('restores home page vertical scrolling without changing editor routing', () => {
    const css = read('css/landing.css');
    expect(css).toMatch(/html\[data-route-page="landing"\]\s*\{[^}]*overflow-y:\s*auto/s);
    expect(css).toMatch(/html\[data-route-page="landing"\]\s+body\s*\{[^}]*height:\s*auto;[^}]*overflow-y:\s*visible/s);
    expect(css).toMatch(/html\[data-route-page="landing"\]\s+#landing-page\s*\{[^}]*overflow:\s*visible/s);
    expect(css).toContain('html[data-route-page="editor"] #landing-page { display: none !important; }');
    expect(read('css/main.css')).toContain('overflow: hidden; /* App is full-viewport, no body scroll */');
  });

  it('initially collapses Isi Surat sections and nested rows', () => {
    const source = read('js/form-renderer.js');
    expect(source).toContain('aria-expanded="false" data-section=');
    expect(source).toContain('form-section__toggle collapsed');
    expect(source).toContain('form-section__body card-body collapsed');
    expect(source).toContain('row-entry__header collapse-title" role="button" tabindex="0" aria-expanded="false"');
    expect(source).toContain("entry.querySelector('.row-entry__header')?.setAttribute('aria-expanded', 'true')");
    expect(source).toContain("header.setAttribute('aria-expanded', String(!isOpen))");
  });

  it('initially collapses every settings card and table-config subaccordion', () => {
    const settings = read('js/settings.js');
    const tables = read('js/table-config-ui.js');
    expect(settings).toContain("header.setAttribute('aria-expanded', 'false')");
    expect(settings).toContain("card.classList.toggle('is-collapsed', !willOpen)");
    expect(tables).toContain('tbl-cfg-accordion__body is-collapsed');
    expect(tables).toContain('const isOpen = _openSections[sectionKey] === true;');
    expect(tables).toContain('_openSections[sectionKey] = !(_openSections[sectionKey] === true)');
    expect(tables).toContain('const isNowOpen     = _openSections[sectionKey] === true;');
  });

  it('prints Kepala followed directly by the school name in requested letters', () => {
    const source = read('js/preview-renderer.js');
    expect(source).toContain("Kepala ' + _officialValue(sekolah.nama) + ',</p>'");
    expect(source).toContain("const headTitle = 'Kepala ' + school + ',';");
    expect(source).not.toContain("'Kepala ' + _officialSatdik(data) + ' ' + _officialValue(sekolah.nama)");
  });

  it('bumps the service worker to refresh cache for new assets', () => {
    const sw = read('sw.js');
    expect(sw).toContain("CACHE_PREFIX + 'v57'");
    expect(sw).toContain("'./css/landing.css'");
    expect(sw).toContain("'./js/settings.js'");
  });
});
