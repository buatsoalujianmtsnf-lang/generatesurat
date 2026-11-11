import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const publisher='ca-pub-4751617120862559';
const script='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+publisher;
const allowed=['panduan','panduan-cetak-pdf','faq'];
const excluded=['tentang','ketentuan','privasi'];
const conf=JSON.parse(read('vercel.json'));
const header=(source,key)=>conf.headers.find(x=>x.source===source)?.headers.find(x=>x.key===key)?.value;
const tags=html=>[...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(x=>x[0]);
describe('MON-08 supplied AdSense code, verification-only public pages',()=>{
  it('places the exact async AdSense snippet inside head only on approved public articles',()=>{
    for(const p of allowed){
      const html=read(p+'.html');
      const head=html.split('</head>')[0];
      expect(head).toContain('src="'+script+'"');
      expect(head).toMatch(/<script\s+async\s+src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-4751617120862559"\s+crossorigin="anonymous"><\/script>/);
      const scripts = tags(html);
      expect(scripts).toHaveLength(5);
      expect(scripts.filter(tag => tag.includes('src="'+script+'"'))).toHaveLength(1);
      expect(scripts.filter(tag => tag.includes('src="/js/routes.js"'))).toHaveLength(1);
      const themeScripts = ['/js/routes.js', '/js/theme-init.js', '/js/theme.js', '/js/public-theme.js'];
      expect(scripts.every(tag => tag.includes('src="'+script+'"') ||
        themeScripts.some(asset => tag.includes('src="'+asset+'"')))).toBe(true);
      for (const asset of themeScripts) {
        expect(scripts.filter(tag => tag.includes('src="'+asset+'"'))).toHaveLength(1);
      }
      expect(html).not.toMatch(/<ins\b[^>]*\badsbygoogle|adsbygoogle\s*=\s*window\.adsbygoogle/i);
    }
  });
  it('verifies root with a meta tag, never injecting third-party ad scripts into editor shell',()=>{
    const html=read('index.html');
    const head=html.split('</head>')[0];
    expect(head).toContain('<meta name="google-adsense-account" content="'+publisher+'">');
    expect(html).not.toMatch(/pagead2\.googlesyndication\.com|adsbygoogle\.js/);
    expect(html).toContain('data-sponsor-gate="off"');
    for(const p of excluded)expect(read(p+'.html')).not.toMatch(/adsbygoogle|pagead2\.googlesyndication/);
  });
  it('does not broaden editor CSP and restricts initial verification exception to public articles',()=>{
    const global=header('/(.*)','Content-Security-Policy');
    expect(global).toContain("script-src 'self';");
    expect(global).toContain("frame-src 'none';");
    expect(global).not.toMatch(/googlesyndication|google\.com|doubleclick/);
    const routes=conf.headers.filter(x=>x.headers.some(h=>h.key==='Content-Security-Policy'&&h.value.includes('googlesyndication'))).map(x=>x.source);
    expect(routes).toEqual(['/panduan','/panduan-cetak-pdf','/faq']);
    for(const route of routes){
      const csp=header(route,'Content-Security-Policy');
      expect(csp).toContain("script-src 'self' https://pagead2.googlesyndication.com;");
      expect(csp).toContain("connect-src 'self';");
      expect(csp).toContain("frame-src 'none';");
      expect(csp).toContain("object-src 'none';");
      expect(csp).toContain("frame-ancestors 'none'");
    }
  });
  it('keeps all revenue, consent and deploy approval gates OFF until independently verified',()=>{
    const zones=JSON.parse(read('config/adsense-zones.json'));
    const rollout=JSON.parse(read('config/mon08-rollout.json'));
    const approvals=JSON.parse(read('docs/mon08-approval-evidence.json'));
    expect(zones.publisherId).toBe('pub-4751617120862559');
    expect(zones.enabled).toBe(false);
    expect(zones.autoAds).toBe(false);
    expect(zones.units.every(u=>u.enabled===false&&u.slotId===null)).toBe(true);
    expect(rollout.decision).toBe('NO_GO');
    expect(rollout.google.requestedState).toBe('off');
    expect(rollout.google.verificationOnly).toBe(true);
    expect(rollout.release.manualDeploymentAuthorized).toBe(false);
    expect(approvals.google.siteStatus).toBe('UNVERIFIED');
    expect(JSON.parse(read('config/mon09-monitoring.json')).enabled).toBe(false);
    expect(JSON.parse(read('config/sponsor-policy.json')).enabled).toBe(false);
    expect(conf.git.deploymentEnabled).toBe(false);
    expect(read('ads.txt').trim()).toBe('google.com, pub-4751617120862559, DIRECT, f08c47fec0942fa0');
    expect(approvals.google.adsTxtStatus).not.toBe('AUTHORIZED');
    expect(approvals.google.adsTxtEvidenceRef).toBeNull();
  });
  it('publishes accurate third-party verification disclosure',()=>{
    const html=read('privasi.html');
    expect(html).toContain('Tag meta identifikasi akun AdSense');
    expect(html).toContain('Skrip verifikasi Google hanya dimuat pada halaman informasi publik');
    expect(html).toContain('metadata koneksi');
    expect(html).toContain('CMP');
    expect(html).toContain('Penayangan iklan Google AdSense');
  });
});
