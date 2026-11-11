import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('Landing hero mobile eyebrow label', () => {
  it('keeps the complete visible text inside a dedicated wrappable child', () => {
    const html = read('index.html');
    expect(html).toContain('class="lp__eyebrow badge badge-primary badge-soft"');
    expect(html).toContain('class="lp__eyebrow-dot" aria-hidden="true"');
    expect(html).toContain('<span class="lp__eyebrow-text">Generate Suratku · Surat sekolah &amp; madrasah</span>');
  });

  it('overrides DaisyUI fixed-height single-line badge metrics only in the landing hero', () => {
    const css = read('css/arc-inspired.css');
    const marker = css.indexOf('.lp .lp__eyebrow.badge {');
    const end = css.indexOf('\n}', marker);
    expect(marker).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(marker);
    const rule = css.slice(marker, end);
    expect(rule).toContain('height: auto;');
    expect(rule).toContain('max-width: 100%;');
    expect(rule).toContain('white-space: normal;');
    expect(rule).toContain('width: fit-content;');
    expect(rule).toContain('display: inline-flex;');
    expect(css).toContain('.lp .lp__eyebrow-text {');
    expect(css).toContain('overflow-wrap: break-word;');
    expect(css).toContain('.lp__hero-grid > :first-child { min-width: 0; }');
    expect(read('css/landing.css')).toContain('@media (max-width:420px)');
  });

  it('preserves the same label in dark mode and confines changes to the landing page', () => {
    const css = read('css/arc-inspired.css');
    expect(css).toContain('html[data-theme="dark"] .lp__eyebrow');
    expect(css).toContain('.lp .lp__eyebrow.badge');
    expect(read('css/print.css')).not.toContain('.lp__eyebrow');
  });
});
