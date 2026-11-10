import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function createRoutes(pathname = '/', { hostname = 'generatesuratku.vercel.app', search = '' } = {}) {
  const listeners = {};
  const location = {
    pathname, hostname, search,
    assign: vi.fn(next => {
      const [nextPath, nextQuery = ''] = next.split('?');
      location.pathname = nextPath;
      location.search = nextQuery ? '?' + nextQuery : '';
    }),
  };
  const moveTo = path => {
    const [nextPath, nextQuery = ''] = path.split('?');
    location.pathname = nextPath;
    location.search = nextQuery ? '?' + nextQuery : '';
  };
  const history = {
    pushState: vi.fn((state, title, path) => moveTo(path)),
    replaceState: vi.fn((state, title, path) => moveTo(path)),
    state: null,
  };
  const document = { documentElement: { dataset: {} }, title: '', getElementById: vi.fn() };
  const ctx = {
    window: { location, addEventListener: (name, fn) => { listeners[name] = fn; } },
    document, history,
    URLSearchParams,
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
      'surat-permohonan-pindah', 'surat-keterangan-pindah',
      'surat-pemberitahuan-kegiatan', 'surat-keterangan-siswa-aktif',
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
    expect(routes.resolve('/index').kind).toBe('landing');
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

  it('mengalihkan link statis localhost ke query route tanpa mengubah URL Vercel', () => {
    const h = createRoutes('/', { hostname: 'localhost', search: '' });
    expect(h.routes.isLocal()).toBe(true);
    expect(h.routes.href('/editor')).toBe('/?route=%2Feditor');
    expect(h.routes.href('/surat/izin-tidak-masuk')).toBe('/?route=%2Fsurat%2Fizin-tidak-masuk');
    expect(h.routes.href('/kategori/ijop')).toBe('/?route=%2Fkategori%2Fijop');
    expect(h.routes.href('/')).toBe('/');

    const prod = createRoutes('/', { hostname: 'generatesuratku.vercel.app' });
    expect(prod.routes.isLocal()).toBe(false);
    expect(prod.routes.href('/editor')).toBe('/editor');
    expect(prod.routes.href('/surat/izin-tidak-masuk')).toBe('/surat/izin-tidak-masuk');
  });

  it('memuat editor langsung dari localhost melalui query, lalu mendukung template dan Back', () => {
    const h = createRoutes('/', { hostname: '127.0.0.1', search: '?route=%2Fsurat%2Fizin-tidak-masuk' });
    expect(h.routes.isLanding()).toBe(false);
    expect(h.document.documentElement.dataset.routePage).toBe('editor');
    expect(h.routes.currentPath()).toBe('/surat/izin-tidak-masuk');
    const selected = vi.fn();
    const activeCard = { querySelectorAll: () => [] };
    h.document.getElementById.mockReturnValue(activeCard);
    const handlers = {};
    h.ctx.State = {
      on: (event, callback) => { handlers[event] = callback; },
      getActiveTemplate: () => 'surat-izin',
    };
    h.ctx.TemplateRegistry = {
      get: id => ({ meta: { name: id } }),
      updateActiveCard: vi.fn(), openGroup: vi.fn(),
    };
    h.ctx.UI = { switchTab: vi.fn() };
    h.routes.initEditor(selected);
    expect(selected).toHaveBeenCalledWith('surat-izin');
    h.routes.onSelected('dpu');
    expect(h.location.search).toBe('?route=%2Fsurat%2Fdaftar-peserta-ujian');
    expect(h.location.pathname).toBe('/');
    h.location.search = '?route=%2Fkategori%2Fijop';
    h.listeners.popstate();
    expect(h.ctx.TemplateRegistry.openGroup).toHaveBeenCalledWith(activeCard, 'ijop');
  });

  it('tetap menggunakan index.html sebagai entry bila server lokal dibuka dengan path itu', () => {
    const h = createRoutes('/index.html', { hostname: 'localhost', search: '?route=%2Feditor' });
    expect(h.routes.isLanding()).toBe(false);
    expect(h.routes.href('/surat/izin-tidak-masuk'))
      .toBe('/index.html?route=%2Fsurat%2Fizin-tidak-masuk');
  });

  it('Vercel rewrites deep links and cache includes landing assets', () => {
    const config = JSON.parse(read('vercel.json'));
    const rewriteFor = source => config.rewrites.find(item => item.source === source)?.destination;
    for (const route of ['/editor', '/surat/:slug', '/kategori/:slug', '/DPUdanRegis']) {
      expect(rewriteFor(route)).toBe('/index');
    }
    // Vercel tidak mengenali tujuan rewrite dengan ekstensi .html saat
    // cleanUrls=true. Cegah regresi 404 pada semua deep-link.
    expect(config.cleanUrls).toBe(true);
    expect(config.rewrites).toHaveLength(4);
    expect(config.rewrites.every(route =>
      route.destination === '/index' && !route.destination.endsWith('.html')
    )).toBe(true);
    const worker = read('sw.js');
    for (const asset of ['./js/routes.js', './js/landing.js', './css/landing.css']) {
      expect(worker).toContain(asset);
    }
  });
});
