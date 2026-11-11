import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const config=JSON.parse(read('vercel.json'));
function header(source,key){
  return config.headers.find(r=>r.source===source)?.headers.find(h=>h.key===key)?.value;
}
describe('MON-06 CSP, privacy and failure controls',()=>{
  it('keeps sponsor media first-party and does not enable AdSense in the editor',()=>{
    const csp=header('/(.*)','Content-Security-Policy');
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("media-src 'self'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/googlesyndication|doubleclick|adsbygoogle/);
    expect(read('index.html')).not.toMatch(/adsbygoogle|pagead2\.googlesyndication/);
    expect(JSON.parse(read('config/adsense-zones.json')).enabled).toBe(false);
  });
  it('prevents storage of sponsor media and token endpoints',()=>{
    expect(header('/assets/sponsors/(.*)','Cache-Control')).toContain('no-store');
    expect(header('/assets/sponsors/(.*)','Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(header('/assets/sponsors/(.*)','Referrer-Policy')).toBe('no-referrer');
    expect(header('/api/(.*)','Cache-Control')).toContain('no-store');
    expect(header('/api/(.*)','X-Robots-Tag')).toContain('noindex');
    const sw=read('sw.js');
    expect(sw).toContain('function isSponsorPrivateRequest(request)');
    expect(sw).toContain("pathname.startsWith('/assets/sponsors/')");
    expect(sw).toContain("pathname.startsWith('/api/')");
    expect(sw).toContain('if (isSponsorPrivateRequest(request)) return;');
    expect(sw).toContain("CACHE_PREFIX + 'v55'");
    expect(sw).not.toMatch(/'\.\/assets\/sponsors\//);
  });
  it('does not run two keyboard print actions for a single event',()=>{
    const platform=read('js/platform.js');
    const gate=read('js/sponsor-export-gate.js');
    expect(platform).toContain('if (event.defaultPrevented) return;');
    expect(platform).toContain("SponsorExportGate.isRequired()");
    expect(gate).toContain('event.stopPropagation?.()');
  });
  it('fails gracefully when network/video stall or sponsor server fails',()=>{
    const video=read('js/sponsor-video-modal.js');
    expect(video).toContain("MEDIA_STALLED:");
    expect(video).toContain("fail(ctx,'MEDIA_STALLED')");
    expect(video).toContain("e.video.addEventListener('waiting'");
    expect(video).toContain('ctx.mediaLoadTimer=setTimeout');
    expect(video).toContain('ctx.stallTimer=setTimeout');
    const api=read('api/sponsor-http.js');
    expect(api).toContain("res.setHeader('Retry-After','60')");
    expect(api).toContain("res.setHeader('Retry-After','15')");
    expect(api).toContain("res.setHeader('Pragma','no-cache')");
    const gate=read('js/sponsor-export-gate.js');
    expect(gate).toContain('controller.abort()');
  });
  it('clears the temporary browser print marker on afterprint or timeout',()=>{
    const printer=read('js/print.js');
    expect(printer).toContain("window.addEventListener?.('afterprint', clearGrant");
    expect(printer).toContain('fallback = setTimeout(clearGrant, 8000)');
    expect(printer).toContain('delete document.documentElement.dataset.sponsorPrintAuthorized');
  });
  it('publishes real scope and TTL disclosures without asserting sponsor is live',()=>{
    const privacy=read('privasi.html');
    expect(privacy).toContain('5 menit');
    expect(privacy).toContain('120 detik');
    expect(privacy).toContain('60 detik');
    expect(privacy).toContain('belum diaktifkan');
    expect(privacy).toContain('CMP');
    expect(privacy).toContain('nama siswa');
    const terms=read('ketentuan.html');
    expect(terms).toContain('Gerbang sponsor belum aktif');
    expect(terms).toContain('tidak diwajibkan mengeklik iklan');
    expect(JSON.parse(read('config/sponsor-policy.json')).enabled).toBe(false);
    expect(JSON.parse(read('config/sponsor-campaigns.json')).enabled).toBe(false);
    expect(config.git.deploymentEnabled).toBe(false);
  });
});
