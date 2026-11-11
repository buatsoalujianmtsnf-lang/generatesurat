import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const pages = ['panduan','panduan-cetak-pdf','faq','tentang','privasi','ketentuan'];
describe('MON-01 public AdSense content foundation', () => {
  it('has substantial and individually indexable static public pages', () => {
    const canonicalUrls = new Set();
    for (const slug of pages) {
      const html = read(slug + '.html');
      expect(html).toContain('<html lang="id">');
      expect(html).toMatch(/<title>[^<]+ \| Generate Suratku<\/title>/);
      expect(html).toContain('<h1>');
      expect(html.length).toBeGreaterThan(3200);
      expect(html).toContain('href="/privasi"');
      expect(html).toContain('href="/ketentuan"');
      const match = html.match(/<link rel="canonical" href="([^"]+)" \/>/);
      expect(match?.[1]).toBe('https://generatesuratku.vercel.app/' + slug);
      canonicalUrls.add(match[1]);
      expect(html).not.toMatch(/adsbygoogle|pagead2\.googlesyndication|ca-pub-\d+/i);
      expect(html).not.toMatch(/<script\b/i);
    }
    expect(canonicalUrls.size).toBe(pages.length);
  });
  it('makes pages discoverable from the landing and sitemap, without linking ads into the editor', () => {
    const index = read('index.html');
    const sitemap = read('sitemap.xml');
    expect(index).toContain('href="/panduan"');
    expect(index).toContain('href="/faq"');
    expect(index).toContain('href="/privasi"');
    expect(index).toContain('rel="canonical" href="https://generatesuratku.vercel.app/"');
    for (const slug of pages) expect(sitemap).toContain('https://generatesuratku.vercel.app/' + slug);
    expect(sitemap).not.toContain('https://generatesuratku.vercel.app/editor');
    expect(read('robots.txt')).toContain('Sitemap: https://generatesuratku.vercel.app/sitemap.xml');
    expect(index).not.toMatch(/adsbygoogle|pagead2\.googlesyndication|ca-pub-\d+/i);
  });
  it('keeps publisher placeholders disabled and prohibits Google ads on the editor', () => {
    const cfg = JSON.parse(read('config/adsense-zones.json'));
    expect(cfg.enabled).toBe(false);
    expect(cfg.publisherId).toBeNull();
    expect(cfg.autoAds).toBe(false);
    expect(cfg.deniedRoutePrefixes).toContain('/surat/');
    expect(cfg.deniedRoutePrefixes).toContain('/editor');
    expect(cfg.units.every(z=>z.enabled===false && z.slotId===null)).toBe(true);
    expect(read('ads.txt')).not.toContain('pub-0000000000000000');
    expect(read('ads.txt')).toContain('ID penayang');
    expect(read('vercel.json')).toContain('"deploymentEnabled": false');
  });
  it('discloses PDF processing and planned sponsor mode without stating it is active', () => {
    expect(read('privasi.html')).toContain('HTML/CSS');
    expect(read('privasi.html')).toContain('Vercel');
    expect(read('ketentuan.html')).toContain('belum aktif');
    expect(read('faq.html')).toContain('Belum.');
    expect(read('panduan-cetak-pdf.html')).toContain('15 detik');
  });
});
