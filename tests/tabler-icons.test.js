import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('js/app-icons.js');
const sprite = read('assets/icons/tabler-sprite.svg');
const iconCss = read('css/tabler-icons.css');
const html = read('index.html');
const sw = read('sw.js');

function iconApi() {
  const ctx = {};
  runInNewContext(source, ctx);
  return runInNewContext('AppIcons', ctx);
}

describe('Tabler Icons: standardized local icon system', () => {
  it('uses official Tabler outline symbols with valid unique identifiers', () => {
    const ids = [...sprite.matchAll(/<symbol id="(ti-[a-z0-9-]+)"/g)].map(x => x[1]);
    expect(ids.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ids).size).toBe(ids.length);
    expect(sprite).toContain('https://github.com/tabler/tabler-icons');
    expect(sprite).toContain('stroke="currentColor"');
    const api = iconApi();
    for (const name of api.names) {
      expect(ids).toContain('ti-' + name);
    }
  });

  it('generates local accessible decorative SVG without external network, script or HTML injection', () => {
    const api = iconApi();
    expect(api.svg('settings', 'custom-icon')).toContain('class="ti-icon custom-icon"');
    expect(api.svg('settings')).toContain('aria-hidden="true"');
    expect(api.svg('settings')).toContain('tabler-sprite.svg#ti-settings');
    expect(api.svg('📋')).toContain('tabler-sprite.svg#ti-clipboard-list');
    expect(api.svg('unavailable')).toContain('tabler-sprite.svg#ti-file-text');
    expect(api.svg('"><img src=x onerror=alert(1)>')).not.toContain('<img');
    expect(api.svg('settings', 'foo" onload="alert(1)')).not.toContain('onload');
  });

  it('hydrates icon placeholders only once while retaining app DOM hooks', () => {
    const api = iconApi();
    const attrs = new Map([['data-tabler-icon', 'printer']]);
    const el = {
      innerHTML: '',
      getAttribute: vi.fn(key => attrs.get(key) ?? null),
      setAttribute: vi.fn((key, value) => attrs.set(key, value)),
    };
    api.apply({ querySelectorAll: () => [el] });
    expect(el.innerHTML).toContain('ti-printer');
    expect(attrs.get('data-tabler-rendered')).toBe('true');
    api.apply({ querySelectorAll: () => [el] });
    expect(el.setAttribute).toHaveBeenCalledTimes(1);
  });

  it('loads icon module before templates and registers icons in offline cache', () => {
    expect(html.indexOf('js/app-icons.js')).toBeGreaterThan(0);
    expect(html.indexOf('js/app-icons.js')).toBeLessThan(html.indexOf('templates/dpu.js'));
    expect(html.indexOf('js/icon-init.js')).toBeGreaterThan(html.indexOf('js/app.js'));
    expect(html).toContain('css/tabler-icons.css');
    for (const asset of ['js/app-icons.js', 'js/icon-init.js', 'css/tabler-icons.css',
      'assets/icons/tabler-sprite.svg']) {
      expect(sw).toContain("'./" + asset + "'");
    }
    expect(sw).toContain("const CACHE_NAME = CACHE_PREFIX + 'v46';");
  });

  it('preserves logo/favicon and print layout independent of icons', () => {
    expect(html).toContain('assets/icons/logo.svg');
    expect(html).toContain('assets/icons/favicon.svg');
    expect(iconCss).toContain('@media print');
    expect(iconCss).toContain('.ti-icon');
    expect(read('js/icon-init.js')).toContain("node.closest('#surat-preview')");
    expect(read('js/preview-renderer.js')).not.toContain('data-tabler-icon');
  });

  it('uses Tabler names in all template metadata', () => {
    const files = [
      'dpu', 'mutasi-masuk', 'siswa-baru', 'ijop-permohonan',
      'ijop-sptjm-satpen', 'ijop-rekomendasi-pengawas',
      'ijop-rekomendasi-kankemenag', 'ijop-sptjm-kankemenag',
      'rekap-nilai', 'surat-izin', 'surat-permohonan-pindah', 'surat-keterangan-pindah',
      'surat-pemberitahuan-kegiatan', 'surat-keterangan-siswa-aktif',
      'surat-panggilan-orang-tua', 'surat-perjanjian-siswa', 'berita-acara-pertemuan-ortu',
    ];
    const api = iconApi();
    for (const name of files) {
      const content = read('templates/' + name + '.js');
      const icons = [...content.matchAll(/(?:['"]?icon['"]?)\s*:\s*['"]([^'"]+)['"]/g)].map(x => x[1]);
      expect(icons.length, name).toBeGreaterThan(0);
      for (const icon of icons) expect(api.names.has(icon), name + ': ' + icon).toBe(true);
    }
  });
});
