import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const publicPages = ['panduan', 'panduan-cetak-pdf', 'faq', 'tentang', 'privasi', 'ketentuan'];

function createTheme({ systemDark = false, stored = null } = {}) {
  const listeners = new Map();
  const classes = new Set();
  const attributes = new Map();
  const storage = new Map(stored === null ? [] : [['ui-theme', stored]]);
  let systemDarkNow = systemDark;
  let systemListener = null;
  const buttonLabel = { textContent: '' };
  const button = {
    dataset: {},
    addEventListener: vi.fn((event, cb) => listeners.set(event, cb)),
    setAttribute: vi.fn((k, v) => attributes.set(k, String(v))),
    querySelector: vi.fn(selector => selector === '.theme-switch__label' ? buttonLabel : null),
  };
  const document = {
    documentElement: {
      dataset: {},
      classList: {
        add: name => classes.add(name),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: name => classes.has(name),
      },
    },
    getElementById: id => id === 'btn-theme-toggle' ? button : null,
  };
  const window = {
    matchMedia: vi.fn(() => ({
      get matches() { return systemDarkNow; },
      addEventListener(event, callback) {
        if (event === 'change') systemListener = callback;
      },
    })),
  };
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  const context = { document, window, localStorage };
  runInNewContext(read('js/theme.js') + '\n;globalThis._theme = Theme;', context);
  return {
    theme: context._theme, button, buttonLabel, classes, attributes, storage, document,
    click() { listeners.get('click')?.(); },
    changeSystem(value) {
      systemDarkNow = value;
      systemListener?.();
    },
  };
}

describe('Shared accessible light/dark theme regression', () => {
  it('changes visual theme from auto-light to dark in ONE click', () => {
    const h = createTheme({ systemDark: false });
    h.theme.init();
    expect(h.theme.get()).toBe('auto');
    expect(h.document.documentElement.dataset.theme).toBe('light');
    h.click();
    expect(h.theme.get()).toBe('dark');
    expect(h.document.documentElement.dataset.theme).toBe('dark');
    expect(h.classes.has('dark-mode')).toBe(true);
    expect(h.storage.get('ui-theme')).toBe('dark');
    expect(h.buttonLabel.textContent).toBe('Mode Gelap');
    expect(h.attributes.get('aria-pressed')).toBe('true');
    expect(h.attributes.get('aria-label')).toBe('Aktifkan mode terang');
  });

  it('changes auto-dark to light immediately, never through auto or a visually identical state', () => {
    const h = createTheme({ systemDark: true });
    h.theme.init();
    expect(h.document.documentElement.dataset.theme).toBe('dark');
    h.click();
    expect(h.theme.get()).toBe('light');
    expect(h.document.documentElement.dataset.theme).toBe('light');
    expect(h.classes.has('light-mode')).toBe(true);
    expect(h.attributes.get('aria-pressed')).toBe('false');
    h.click();
    expect(h.theme.get()).toBe('dark');
    expect(h.document.documentElement.dataset.theme).toBe('dark');
  });

  it('preserves explicit preference and automatic system monitoring when requested', () => {
    const h = createTheme({ systemDark: false, stored: 'dark' });
    h.theme.init();
    expect(h.document.documentElement.dataset.theme).toBe('dark');
    h.changeSystem(true);
    h.changeSystem(false);
    expect(h.document.documentElement.dataset.theme).toBe('dark');
    h.theme.set('auto');
    expect(h.theme.get()).toBe('auto');
    h.changeSystem(true);
    expect(h.document.documentElement.dataset.theme).toBe('dark');
    h.changeSystem(false);
    expect(h.document.documentElement.dataset.theme).toBe('light');
    h.click();
    expect(h.document.documentElement.dataset.theme).toBe('dark');
    expect(h.storage.get('ui-theme')).toBe('dark');
    expect(h.button.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('shares the CSP-safe theme setup on all six public informational pages', () => {
    for (const page of publicPages) {
      const html = read(page + '.html');
      expect(html).toContain('<script src="/js/theme-init.js"></script>');
      expect(html).toContain('<script src="/js/theme.js" defer></script>');
      expect(html).toContain('<script src="/js/public-theme.js" defer></script>');
      expect(html).toContain('href="/css/public-content.css"');
      expect(html).toContain('id="btn-theme-toggle"');
      expect(html).toContain('class="theme-switch__label"');
      expect(html).not.toMatch(/on(?:click|change)=/);
      expect(html).toContain('src="/js/routes.js"');
    }
    expect(read('js/public-theme.js')).toContain('Theme.init()');
    expect(read('js/theme-init.js')).toContain("localStorage.getItem('ui-theme')");
  });

  it('provides readable dark surfaces and text for landing help cards, editor branding and public pages', () => {
    const landing = read('css/landing.css');
    const arc = read('css/arc-inspired.css');
    const article = read('css/public-content.css');
    const header = read('css/header-scroll.css');
    expect(landing).toContain('html[data-theme="dark"] .lp__guide-card h3');
    expect(landing).toContain('html[data-theme="dark"] .lp__guide-card p');
    expect(landing).toContain('html[data-theme="dark"] .lp__guide-card a');
    expect(arc).toContain('html[data-route-page="editor"][data-theme="dark"] .app-header__title');
    expect(arc).toContain('html[data-route-page="editor"][data-theme="dark"] .app-header__logo-icon');
    expect(article).toContain('html[data-theme="dark"] .article');
    expect(article).toContain('html[data-theme="dark"] .lead');
    expect(article).toContain('html[data-theme="dark"] .cardlinks a');
    expect(article).toContain('.theme-switch:');
    expect(header).toContain('justify-content: safe flex-end;');
  });

  it('docks mobile editor button away from workflow buttons without hiding drawer trigger', () => {
    const css = read('css/editor-drawer.css');
    expect(css).toContain('.editor-drawer__toggle-slot--open');
    expect(css).toContain('.editor-drawer__toggle-slot--closed');
    expect(css).toContain('position: static;');
    expect(css).not.toContain('top: clamp(136px, 42dvh, 340px)');
    expect(read('index.html')).toContain('id="workflow-actions"');
    expect(read('index.html')).toContain('id="editor-drawer-button"');
  });

  it('refreshes offline cache with the shared public theme assets', () => {
    const worker = read('sw.js');
    expect(worker).toContain("CACHE_PREFIX + 'v64'");
    expect(worker).toContain("'./js/public-theme.js'");
    expect(worker).toContain("'./css/public-content.css'");
  });
});
