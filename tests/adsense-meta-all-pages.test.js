import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const meta = '<meta name="google-adsense-account" content="ca-pub-4751617120862559">';
const jsAllowlist = new Set(['panduan.html', 'panduan-cetak-pdf.html', 'faq.html']);
const expected = ['faq.html','index.html','ketentuan.html','panduan-cetak-pdf.html','panduan.html','privasi.html','tentang.html'];

describe('AdSense account meta verification on every HTML page', () => {
  it('includes the exact Google-supplied meta tag once in each HTML head', () => {
    const pages = readdirSync(root).filter(file => file.endsWith('.html')).sort();
    expect(pages).toEqual(expected);
    for(const file of pages) {
      const html = read(file);
      const match = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
      expect(match, 'Head missing in '+file).not.toBeNull();
      const head = match[1];
      expect(head, 'No account meta in '+file).toContain(meta);
      expect(head.match(/<meta\s+name="google-adsense-account"/gi), 'Duplicate meta in '+file).toHaveLength(1);
      expect(html.match(/<meta\s+name="google-adsense-account"/gi), 'Duplicate account tag in '+file).toHaveLength(1);
    }
  });
  it('does not put Google ad scripts on the shared editor or non-eligible pages',()=>{
    for(const file of expected) {
      const source=read(file);
      const hasAdScript=/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/.test(source);
      expect(hasAdScript, 'Incorrect ad script scope on '+file).toBe(jsAllowlist.has(file));
      if(!jsAllowlist.has(file))expect(source).not.toMatch(/<ins\b[^>]*adsbygoogle/);
    }
    expect(read('index.html')).toContain('data-sponsor-gate="off"');
  });
  it('keeps release approval and auto-deployment disabled',()=>{
    const ads=JSON.parse(read('config/adsense-zones.json'));
    const release=JSON.parse(read('config/mon08-rollout.json'));
    const vercel=JSON.parse(read('vercel.json'));
    expect(ads.enabled).toBe(false);
    expect(ads.autoAds).toBe(false);
    expect(ads.units.every(unit=>unit.enabled===false)).toBe(true);
    expect(release.decision).toBe('NO_GO');
    expect(release.google.requestedState).toBe('off');
    expect(release.google.verificationOnly).toBe(true);
    expect(vercel.git.deploymentEnabled).toBe(false);
    expect(JSON.parse(read('config/sponsor-policy.json')).enabled).toBe(false);
    expect(JSON.parse(read('config/mon09-monitoring.json')).enabled).toBe(false);
  });
});
