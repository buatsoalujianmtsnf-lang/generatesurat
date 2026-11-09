import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function createRoutes(pathname = '/') {
  const listeners = {};
  const location = { pathname, assign: vi.fn(next => { location.pathname = next; }) };
  const history = {
    pushState: vi.fn((state, title, path) => { location.pathname = path; }),
    replaceState: vi.fn((state, title, path) => { location.pathname = path; }),
    state: null,
  };
  const document = { documentElement: { dataset: {} }, title: '', getElementById: vi.fn() };
  const ctx = {
    window: { location, addEventListener: (name, fn) => { listeners[name] = fn; } },
    document, history,
    console,
  };
  runInNewContext(read('js/routes.js'), ctx);
  return { routes: runInNewContext('Routes', ctx), ctx, history, location, document, listeners };
}

describe('Friendly routes and landing page', () => {
  it('maps every registered template to its own unique shareable URL', () => {
    const { routes } = createRoutes();
    const ids = [
      'dpu', 'mutasi-masuk', 'siswa-baru', 'ijop-permohonan', 'ijop-sptjm-satpen',
      'ijop-rekomendasi-pengawas', 'ijop-rekomendasi-kankemenag',
      'ijop-sptjm-kankemenag', 'rekap-nilai', 'surat-izin',
    ];
    const paths = ids.map(id => routes.templateUrl(id));
    expect(new Set(paths).size).toBe(ids.length);
    expect(paths.every(path => path.startsWith('/surat/'))).toBe(true);
    for (let i = 0; i < ids.length; i++) {
      expect(routes.resolve(paths[i])).toMatchObject({ kind: 'template', templateId: ids[i] });
    }
    expect(routes.resolve('/surat/izin-tidak-masuk/')).toMatchObject({
      kind: 'template', templateId: 'surat-izin',
    });
    expect(routes.resolve('/surat/tidak-ada').kind).toBe('unknown');
  });

  it('supports /, /editor, all four category paths, and the legacy DPUdanRegis URL', () => {
    const { routes } = createRoutes();
    expect(routes.resolve('/').kind).toBe('landing');
    expect(routes.resolve('/index.html').kind).toBe('landing');
    expect(routes.resolve('/editor').kind).toBe('editor');
    expect(routes.resolve('/DPUdanRegis')).toMatchObject({
      kind: 'category', groupId: 'registrasi-dpu', legacy: true,
    });
    for (const group of [
      'registrasi-dpu', 'ijop', 'pengolahan-nilai', 'surat-menyurat-siswa',
    ]) {
      expect(routes.resolve(routes.categoryUrl(group))).toMatchObject({
        kind: 'category', groupId: group,
      });
    }
  });

  it('opens a deep-linked template, updates URL on selection, and handles browser back', () => {
    const h = createRoutes('/surat/izin-tidak-masuk');
    const selected = vi.fn();
    const cards = { querySelectorAll: () => [] };
    const openGroup = vi.fn();
    const switchTab = vi.fn();
    const listeners = {};
    h.document.getElementById.mockReturnValue(cards);
    h.ctx.State = { on: (event, callback) => { listeners[event] = callback; }, getActiveTemplate: () => 'surat-izin' };
    h.ctx.TemplateRegistry = {
      get: id => ({ meta: { name: id } }),
      updateActiveCard: vi.fn(),
      openGroup,
    };
    h.ctx.UI = { switchTab };

    h.routes.initEditor(selected);
    expect(selected).toHaveBeenCalledWith('surat-izin');
    expect(h.document.title).toContain('surat-izin');
    expect(h.history.pushState).not.toHaveBeenCalled();

    h.routes.onSelected('dpu');
    expect(h.location.pathname).toBe('/surat/daftar-peserta-ujian');
    expect(h.history.pushState).toHaveBeenCalledTimes(1);

    h.location.pathname = '/kategori/ijop';
    h.listeners.popstate();
    expect(openGroup).toHaveBeenCalledWith(cards, 'ijop');
    expect(switchTab).toHaveBeenCalledWith('template');
    expect(h.history.pushState).toHaveBeenCalledTimes(1);

    h.location.pathname = '/DPUdanRegis';
    h.listeners.popstate();
    expect(h.location.pathname).toBe('/kategori/registrasi-dpu');
    expect(h.history.replaceState).toHaveBeenCalled();
  });

  it('skips editor initialization on landing page and keeps links in the app shell', () => {
    const h = createRoutes('/');
    expect(h.document.documentElement.dataset.routePage).toBe('landing');
    const select = vi.fn();
    h.routes.initEditor(select);
    expect(select).not.toHaveBeenCalled();

    const html = read('index.html');
    expect(html).toContain('<base href="/"');
    expect(html).toContain('id="landing-page"');
    expect(html).toContain('id="lp-template-groups"');
    expect(html).toContain('id="lp-template-search"');
    expect(html.indexOf('js/routes.js')).toBeLessThan(html.indexOf('js/template-registry.js'));
    expect(html.indexOf('js/template-registry.js')).toBeLessThan(html.indexOf('js/landing.js'));
    expect(html.indexOf('js/landing.js')).toBeLessThan(html.indexOf('js/app.js'));
  });

  it('Vercel rewrites deep links and cache includes landing assets', () => {
    const config = JSON.parse(read('vercel.json'));
    const rewriteFor = source => config.rewrites.find(item => item.source === source)?.destination;
    for (const route of ['/editor', '/surat/:slug', '/kategori/:slug', '/DPUdanRegis']) {
      expect(rewriteFor(route)).toBe('/index.html');
    }
    const worker = read('sw.js');
    for (const asset of ['./js/routes.js', './js/landing.js', './css/landing.css']) {
      expect(worker).toContain(asset);
    }
  });
});
