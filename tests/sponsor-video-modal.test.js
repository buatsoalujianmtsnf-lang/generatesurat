import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe,it,expect } from 'vitest';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const getMachine=()=>{const ctx={};runInNewContext(read('js/sponsor-video-state.js'),ctx);return runInNewContext('SponsorVideoState',ctx);};
describe('MON-04 sponsor modal and verified state',()=>{
  it('requires server-verified progress before authorization',()=>{
    const m=getMachine();let state='idle';
    for(const step of ['BEGIN','READY','PLAY','PAUSE','PLAY','ENDED','AUTHORIZED'])state=m.transition(state,step);
    expect(state).toBe('authorized');
    expect(m.transition(state,'RESET')).toBe('idle');
    for(const bad of [['starting','AUTHORIZED'],['ready','AUTHORIZED'],['playing','AUTHORIZED'],['verifying','PLAY']])
      expect(()=>m.transition(bad[0],bad[1])).toThrow('Invalid sponsor transition');
  });
  it('cancels every active stage and allows a full restart on error',()=>{
    const m=getMachine();
    for(const state of ['starting','ready','playing','paused','verifying','error']){
      expect(m.transition(state,'CANCEL')).toBe('cancelled');
      expect(m.transition('cancelled','RESET')).toBe('idle');
    }
    expect(m.transition('error','RETRY')).toBe('starting');
  });
  it('renders a native, labeled, keyboard accessible dialog',()=>{
    const html=read('index.html');
    expect(html).toContain('<dialog id="sponsor-video-modal"');
    expect(html).toContain('aria-labelledby="sponsor-title"');
    expect(html).toContain('aria-describedby="sponsor-description"');
    expect(html).toContain('role="status" aria-live="polite"');
    expect(html).toContain('id="sponsor-play"');
    expect(html).toContain('id="sponsor-mute"');
    expect(html).toContain('id="sponsor-cancel"');
    expect(html).toContain('id="sponsor-retry"');
    expect(html).toContain('playsinline preload="metadata"');
    expect(html).toContain('css/sponsor-video.css');
    expect(html.indexOf('js/sponsor-video-state.js')).toBeLessThan(html.indexOf('js/sponsor-video-modal.js'));
    expect(html.indexOf('js/sponsor-video-modal.js')).toBeLessThan(html.indexOf('js/workflow.js'));
    expect(html).not.toMatch(/adsbygoogle|pagead2\.googlesyndication/);
  });
  it('uses server results and not a countdown to generate receipts',()=>{
    const s=read('js/sponsor-video-modal.js');
    expect(s).toContain('/api/sponsor-start');
    expect(s).toContain('/api/sponsor-progress');
    expect(s).toContain('/api/sponsor-complete');
    expect(s).toContain("setState(ctx,'AUTHORIZED')");
    expect(s).toContain('result.receipt');
    expect(s).toContain('function elements()');
  });
  it('never prints video, caches advertiser media, or activates AdSense',()=>{
    const css=read('css/sponsor-video.css'),sw=read('sw.js'),s=read('js/sponsor-video-modal.js');
    expect(css).toContain('@media print');
    expect(css).toContain('display:none!important');
    expect(sw).toContain("'./js/sponsor-video-state.js'");
    expect(sw).toContain("'./js/sponsor-video-modal.js'");
    expect(sw).toContain("'./css/sponsor-video.css'");
    expect(sw).toContain("CACHE_PREFIX + 'v69'");
    // The worker now explicitly BLOCKS this path from cache: mentioning the
    // route in a deny rule is correct, but pre-caching sponsor media is not.
    expect(sw).toContain("pathname.startsWith('/assets/sponsors/')");
    expect(sw).not.toMatch(/'\.\/assets\/sponsors\//);
    expect(s).not.toMatch(/window\.print\(|PdfExport\.exportDocument\(|adsbygoogle|localStorage|sessionStorage/);
    expect(s).toContain("redirect:'error'");
    expect(s).toContain("cache:'no-store'");
    expect(JSON.parse(read('config/sponsor-policy.json')).enabled).toBe(false);
    expect(JSON.parse(read('config/sponsor-campaigns.json')).enabled).toBe(false);
    expect(JSON.parse(read('vercel.json')).git.deploymentEnabled).toBe(false);
  });
  it('gets sponsor label and optional VTT caption only from approved server campaign',()=>{
    const api=read('api/sponsor-service.js');
    expect(api).toContain('sponsorName:');
    expect(api).toContain('captionsPath,');
    expect(api).toContain('campaign.sponsorDisplayName');
  });
});
