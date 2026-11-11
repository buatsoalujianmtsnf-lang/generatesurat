import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {loadMon08,assessMon08} from '../scripts/mon08-approval-gate.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const json=p=>JSON.parse(read(p));
function inputs(){
  return {
    rollout:json('config/mon08-rollout.json'),
    evidence:json('docs/mon08-approval-evidence.json'),
    mon07:json('docs/mon-07-evidence.json'),
    zones:json('config/adsense-zones.json'),
    policy:json('config/sponsor-policy.json'),
    campaigns:json('config/sponsor-campaigns.json'),
    vercel:json('vercel.json'),html:read('index.html'),
    adsTxt:read('ads.txt'),
    pages:{
      '/panduan':read('panduan.html'),
      '/panduan-cetak-pdf':read('panduan-cetak-pdf.html'),
      '/faq':read('faq.html'),
    },
  };
}
describe('MON-08 independent provider and controlled launch approval',()=>{
  it('blocks production activation while all evidence is unverified',()=>{
    const r=loadMon08();
    expect(r.status).toBe('BLOCKED');
    expect(r.actualActivation).toBe(false);
    expect(r.productionAcceptance).toBe(false);
    expect(r.readiness.google).toBe(false);
    expect(r.readiness.sponsor).toBe(false);
    expect(r.hazards).toHaveLength(0);
    expect(Object.values(r.baseline).every(Boolean)).toBe(true);
  });
  it('does not count a GitHub CI pass as Google site approval',()=>{
    const r=loadMon08();
    expect(r.missing.google).toContain('realSiteStatus');
    expect(r.missing.google).toContain('verifiedPublisherAndAdsTxt');
    expect(r.missing.google).toContain('isolatedPublicCspAndScript');
    expect(r.missing.operator).toContain('manualGoNoGo');
    expect(json('docs/mon08-approval-evidence.json').google.siteStatus).toBe('UNVERIFIED');
  });
  it('requires public content-only routes independent from the shared home/editor shell',()=>{
    const p=inputs();
    expect(p.zones.allowedRoutes).toEqual(['/panduan','/panduan-cetak-pdf','/faq']);
    expect(p.zones.allowedRoutes).not.toContain('/');
    expect(p.zones.autoAds).toBe(false);
    expect(p.rollout.google.excludeRootSharedWithEditor).toBe(true);
    p.zones.allowedRoutes.push('/');
    const r=assessMon08(p);
    expect(r.status).toBe('UNSAFE_CONFIGURATION');
    expect(r.hazards).toContain('UNSAFE_PUBLIC_ROUTES');
  });
  it('does not permit Google monetization without verified provider consent and ad IDs',()=>{
    const p=inputs();
    p.rollout.google.requestedState='on';
    p.zones.enabled=true;
    const r=assessMon08(p);
    expect(r.status).toBe('UNSAFE_CONFIGURATION');
    expect(r.hazards).toContain('GOOGLE_APPROVAL_NOT_VERIFIED');
    expect(r.hazards).toContain('NO_SIGNED_RELEASE_GO_NO_GO');
  });
  it('does not accept a purported Ready status without signed evidence',()=>{
    const p=inputs();
    p.evidence.google.siteStatus='Ready';
    p.evidence.google.accountStatus='ACTIVE';
    p.evidence.google.approvedHost='generatesuratku.vercel.app';
    p.rollout.google.approvedDomain='generatesuratku.vercel.app';
    const r=assessMon08(p);
    expect(r.readiness.google).toBe(false);
    expect(r.missing.google).toContain('realSiteStatus');
    expect(r.missing.google).toContain('verifiedPublisherAndAdsTxt');
  });
  it('rejects sponsor activation if Redis and manual phone/browser evidence is missing',()=>{
    const p=inputs();
    p.rollout.sponsor.requestedState='on';
    p.policy.enabled=true;
    const r=assessMon08(p);
    expect(r.status).toBe('UNSAFE_CONFIGURATION');
    expect(r.hazards).toContain('SPONSOR_NOT_OPERATIONALLY_APPROVED');
    expect(r.hazards).toContain('PWA_VERSION_SKEW_RISK');
  });
  it('does not allow auto deployment to be re-enabled',()=>{
    const p=inputs();
    p.vercel.git.deploymentEnabled=true;
    const r=assessMon08(p);
    expect(r.hazards).toContain('AUTO_DEPLOY_NOT_DISABLED');
  });
  it('blocks third-party ad script accidentally added to the editor',()=>{
    const p=inputs();
    p.html+='<script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>';
    const r=assessMon08(p);
    expect(r.hazards).toContain('GOOGLE_ADS_IN_EDITOR_SHARED_HTML');
  });
  it('never accepts Google Auto Ads as part of public-only manual placement policy',()=>{
    const p=inputs();
    p.zones.autoAds=true;
    const r=assessMon08(p);
    expect(r.hazards).toContain('AUTO_ADS_MUST_STAY_OFF');
  });
  it('accepts owner-supplied ads.txt while withholding Google authorization until independently verified',()=>{
    const p=inputs();
    expect(p.zones.publisherId).toBe('pub-4751617120862559');
    expect(p.rollout.google.verificationOnly).toBe(true);
    expect(p.rollout.google.requestedState).toBe('off');
    expect(p.adsTxt.trim()).toBe('google.com, pub-4751617120862559, DIRECT, f08c47fec0942fa0');
    expect(p.evidence.google.adsTxtStatus).not.toBe('AUTHORIZED');
    expect(p.evidence.google.adsTxtEvidenceRef).toBeNull();
    expect(json('docs/mon08-approval-evidence.json').google.siteStatusEvidenceRef).toBeNull();
  });
});
