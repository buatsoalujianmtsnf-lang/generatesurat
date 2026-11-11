import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('css/document-viewer.css');

describe('Preview Fokus/Keluar Fokus layout regression', () => {
  it('uses a content-sized button instead of an icon-only square button', () => {
    const tag = html.match(/<button[^>]*id="viewer-focus-toggle"[^>]*>/)?.[0];
    expect(tag).toBeTruthy();
    expect(tag).toContain('type="button"');
    expect(tag).toContain('class="viewer-focus-toggle btn btn-ghost btn-sm"');
    expect(tag).not.toMatch(/\bbtn-square\b|\bbtn-icon\b/);
    expect(html).toContain('class="viewer-focus-label">Fokus</span>');
    const script = read('js/document-viewer.js');
    expect(script).toContain("active ? 'Keluar Fokus' : 'Fokus'");
    expect(script).toContain("button.setAttribute('aria-pressed', String(active))");
  });

  it('allows enough width for desktop labels without spilling out of the toolbar', () => {
    expect(css).toMatch(/\.preview-toolbar\s*\{[^}]*overflow-x:\s*auto;/s);
    expect(css).toMatch(/\.preview-toolbar__actions\s*\{[^}]*min-width:\s*max-content;/s);
    expect(css).toMatch(/\.preview-toolbar__actions \.viewer-focus-toggle\.btn\s*\{[^}]*width:\s*max-content;[^}]*min-width:\s*max-content;[^}]*white-space:\s*nowrap;/s);
    expect(css).toContain('.viewer-focus-toggle .viewer-focus-label');
  });

  it('switches to accessible icon-only control on narrow screens', () => {
    expect(css).toContain('@media screen and (max-width: 767px)');
    expect(css).toMatch(/\.preview-toolbar__actions \.viewer-focus-toggle \.viewer-focus-label\s*\{[^}]*display:\s*none;/s);
    expect(css).toMatch(/\.preview-toolbar__actions \.viewer-focus-toggle\.btn\s*\{[^}]*width:\s*40px;/s);
    expect(html).toContain('aria-label="Buka preview dalam mode fokus"');
    expect(read('js/document-viewer.js')).toContain("active ? 'Keluar dari mode fokus preview' : 'Buka preview dalam mode fokus'");
  });

  it('refreshes cached stylesheet for installed PWA users', () => {
    const sw = read('sw.js');
    expect(sw).toContain("CACHE_PREFIX + 'v65'");
    expect(sw).toContain("'./css/document-viewer.css'");
  });
});
