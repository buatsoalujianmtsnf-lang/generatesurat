import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const publicPaths = [
  'panduan.html', 'panduan-cetak-pdf.html', 'faq.html',
  'tentang.html', 'privasi.html', 'ketentuan.html',
];

function themeHarness({ saved = null, systemDark = false } = {}) {
  const classes = new Set();
  const listeners = {};
  const storage = new Map(saved ? [['ui-theme', saved]] : []);
  const localStorage = {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, value),
  };
  const label = { textContent: '' };
  const button = {
    dataset: {}, attrs: {},
    querySelector: selector => selector === '.theme-toggle__text' ? label : null,
    setAttribute(key, value) { this.attrs[key] = value; },
    addEventListener(name, fn) {
      if (!listeners[name]) listeners[name] = [];
      listeners[name].push(fn);
    },
  };
  const document = {
    documentElement: {
      dataset: {},
      classList: {
        add(...items) { items.forEach(item => classes.add(item)); },
        remove(...items) { items.forEach(item => classes.delete(item)); },
        contains(item) { return classes.has(item); },
      },
    },
    getElementById: id => id === 'btn-theme-toggle' ? button : null,
  };
  const window = {
    matchMedia: () => ({
      matches: systemDark,
      addEventListener: vi.fn(),
    }),
  };
  const ctx = { document, window, localStorage };
  runInNewContext(read('js/theme.js') + '\nglobalThis.themeApi = Theme;', ctx);
  return {
    theme: ctx.themeApi, button, label, classes, storage, document, listeners,
    click() { for (const fn of listeners.click || []) fn(); },
  };
}

describe('Shared single-click theme and public information pages', () => {
  it('changes visible light AUTO into dark on the first click and back on the second', () => {
    const h = themeHarness();
    h.theme.init();
    expect(h.theme.get()).toBe('auto');
    expect(h.document.documentElement.dataset.theme).toBe('light');
    h.click();
    expect(h.theme.get()).toBe('dark');
    expect(h.document.documentElement.dataset.theme).toBe('dark');
    expect(h.storage.get('ui-theme')).toBe('dark');
    expect(h.label.textContent).toBe('Mode gelap');
    h.click();
    expect(h.theme.get()).toBe('light');
    expect(h.document.documentElement.dataset.theme).toBe('light');
    expect(h.label.textContent).toBe('Mode terang');
    expect(h.listeners.click).toHaveLength(1);
    h.theme.init();
    expect(h.listeners.click).toHaveLength(1);
  });

  it('changes visible dark AUTO into light with one click', () => {
    const h = themeHarness({ systemDark: true });
    h.theme.init();
    expect(h.theme.isDark()).toBe(true);
    h.click();
    expect(h.theme.get()).toBe('light');
    expect(h.document.documentElement.dataset.theme).toBe('light');
    expect(h.classes.has('light-mode')).toBe(true);
  });

  it('restores saved theme and toggles the opposite color in one click', () => {
    const h = themeHarness({ saved: 'dark' });
    h.theme.init();
    expect(h.document.documentElement.dataset.theme).toBe('dark');
    h.click();
    expect(h.document.documentElement.dataset.theme).toBe('light');
    expect(h.storage.get('ui-theme')).toBe('light');
  });

  it('provides shared theme toggle and early boot on all six information pages', () => {
    for (const path of publicPaths) {
      const html = read(path);
      expect(html).toContain('<script src="/js/theme-init.js"></script>');
      expect(html).toContain('<script src="/js/theme.js" defer></script>');
      expect(html).toContain('<script src="/js/public-theme.js" defer></script>');
      expect(html).toContain('id="btn-theme-toggle"');
      expect(html.indexOf('theme-init.js')).toBeLessThan(html.indexOf('public-content.css'));
      expect(html.indexOf('theme.js" defer')).toBeLessThan(html.indexOf('public-theme.js" defer'));
    }
    expect(read('js/public-theme.js')).toContain('Theme.init()');
  });

  it('uses real dark tokens for public article, cards, body copy and links', () => {
    const css = read('css/public-content.css');
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain('color-scheme: dark');
    expect(css).toContain('background:var(--page-surface)');
    expect(css).toContain('color:var(--body-ink)');
    expect(css).toContain('background:var(--panel-alt)');
    expect(css).toContain('.theme-toggle');
  });

  it('corrects guide card contrast, dark editor branding and desktop alignment', () => {
    const landing = read('css/landing.css');
    const arc = read('css/arc-inspired.css');
    const header = read('css/header-scroll.css');
    expect(landing).toContain('.lp .lp__guide-card h3 { color: var(--color-text); }');
    expect(landing).toContain('.lp .lp__guide-card p { color: var(--color-text-secondary); }');
    expect(arc).toContain('html[data-theme="dark"] .app-header .app-header__brand .app-header__title');
    expect(header).toContain('justify-content: safe flex-end;');
    expect(header).toContain('margin-left: auto;');
  });

  it('docks compact editor action away from bottom workflow buttons', () => {
    const css = read('css/editor-drawer.css');
    expect(css).toContain('top: clamp(102px, 34dvh, 236px)');
    expect(css).toContain('bottom: auto;');
    expect(css).toContain('writing-mode: vertical-rl;');
    expect(css).toContain('right: 0;');
  });

  it('precaches all information pages and shared theme files in v63 offline shell', () => {
    const sw = read('sw.js');
    expect(sw).toContain("CACHE_PREFIX + 'v63'");
    expect(sw).toContain("'./css/public-content.css'");
    expect(sw).toContain("'./js/public-theme.js'");
    for (const path of publicPaths) expect(sw).toContain("'./" + path + "'");
  });
});
