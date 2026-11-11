import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { validateSponsorRegistry } from '../scripts/validate-sponsor-campaigns.js';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const policy = read('config/sponsor-policy.json');
const registry = read('config/sponsor-campaigns.json');
function clone(x) { return structuredClone(x); }
function approvedCampaign() {
  return {
    id:'sponsor-pendidikan-2026',
    sponsorDisplayName:'Sponsor Pendidikan',
    status:'approved',
    startsAt:'2026-12-01T00:00:00Z',
    endsAt:'2027-01-01T00:00:00Z',
    destinationUrl:'https://example.org/',
    thirdPartyTracking:false,
    targeting:null,
    agreement:{reference:'AGR_2026_001',signedAt:'2026-11-30T00:00:00Z'},
    approvals:{agreementSigned:true,rightsVerified:true,contentApproved:true,privacyApproved:true,operatorApproved:true},
    media:{path:'assets/sponsors/sponsor-pendidikan-2026/ad-15.mp4',
      mimeType:'video/mp4',sha256:'f'.repeat(64),hasSpeech:true,
      captionsPath:'assets/sponsors/sponsor-pendidikan-2026/ad-id.vtt'}
  };
}
function inspected() {
  return { durationSeconds:15, bytes:1500000, width:1280, height:720, codec:'h264', sha256:'f'.repeat(64) };
}

describe('MON-02 first-party sponsor campaign rules', () => {
  it('begins safely disabled with no fabricated sponsor', () => {
    expect(policy.enabled).toBe(false);
    expect(policy.releasePhase).toBe('prelaunch');
    expect(registry.enabled).toBe(false);
    expect(registry.campaigns).toEqual([]);
    expect(validateSponsorRegistry(policy,registry)).toMatchObject({ok:true,approvedCount:0,enabled:false});
    expect(policy.video.requiredDurationSeconds).toBe(15);
    expect(policy.frequency).toBe('every-new-action');
  });
  it('blocks enabling registry before production, even if media is valid', () => {
    const p=clone(policy), r=clone(registry);
    r.enabled=true; r.campaigns=[approvedCampaign()];
    expect(validateSponsorRegistry(p,r,inspected).ok).toBe(false);
  });
  it('requires five independent approvals and a signed contract reference', () => {
    const r=clone(registry), c=approvedCampaign();
    c.approvals.agreementSigned=false;
    r.campaigns=[c];
    const out=validateSponsorRegistry(policy,r,inspected);
    expect(out.ok).toBe(false);
    expect(out.errors.join(' ')).toContain('approvals.agreementSigned');
  });
  it('accepts valid approved campaign for staging while registry stays disabled', () => {
    const r=clone(registry); r.campaigns=[approvedCampaign()];
    const out=validateSponsorRegistry(policy,r,inspected);
    expect(out).toMatchObject({ok:true,approvedCount:1,enabled:false});
  });
  it('rejects videos with non-15-second duration, wrong codec or hash', () => {
    const r=clone(registry); r.campaigns=[approvedCampaign()];
    expect(validateSponsorRegistry(policy,r,() => ({...inspected(),durationSeconds:14.4})).ok).toBe(false);
    expect(validateSponsorRegistry(policy,r,() => ({...inspected(),codec:'hevc'})).ok).toBe(false);
    expect(validateSponsorRegistry(policy,r,() => ({...inspected(),sha256:'1'.repeat(64)})).ok).toBe(false);
  });
  it('rejects remote media, relative traversal, mismatched MIME, and missing files', () => {
    const r=clone(registry); r.campaigns=[approvedCampaign()];
    for (const path of ['https://attacker.test/ad.mp4','assets/sponsors/../secret.mp4',
      'assets/sponsors/%2e%2e/secret.mp4','assets/sponsors/test/ad.webm']) {
      r.campaigns[0].media.path=path;
      expect(validateSponsorRegistry(policy,r,inspected).ok).toBe(false);
    }
    r.campaigns=[approvedCampaign()];
    expect(validateSponsorRegistry(policy,r,()=>{throw new Error('missing');}).ok).toBe(false);
  });
  it('blocks third-party trackers, user targeting and unsafe sponsor URLs', () => {
    const r=clone(registry); r.campaigns=[approvedCampaign()];
    r.campaigns[0].thirdPartyTracking=true;
    r.campaigns[0].targeting={student:'test'};
    r.campaigns[0].destinationUrl='https://example.org/?user=sensitive';
    const out=validateSponsorRegistry(policy,r,inspected);
    expect(out.ok).toBe(false);
    expect(out.errors.join(' ')).toContain('thirdPartyTracking');
    expect(out.errors.join(' ')).toContain('targeting');
  });
  it('requires subtitle when narration is present', () => {
    const r=clone(registry); r.campaigns=[approvedCampaign()];
    r.campaigns[0].media.captionsPath=null;
    expect(validateSponsorRegistry(policy,r,inspected).ok).toBe(false);
  });
  it('denies invalid schedule and duplicate campaign IDs', () => {
    const r=clone(registry),c=approvedCampaign();
    r.campaigns=[c,clone(c)];
    c.endsAt='2026-10-01T00:00:00Z';
    expect(validateSponsorRegistry(policy,r,inspected).ok).toBe(false);
  });
  it('does not accidentally activate AdSense or sponsor gate in user-facing entrypoints', () => {
    const readText=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
    expect(readText('config/adsense-zones.json')).toContain('"enabled": false');
    expect(readText('js/print.js')).not.toMatch(/adsbygoogle|ca-pub-/);
    expect(readText('js/pdf-export.js')).not.toMatch(/adsbygoogle|ca-pub-/);
    expect(readText('index.html')).not.toMatch(/pagead2\.googlesyndication|adsbygoogle/);
    expect(readText('docs/sponsor/KONTRAK_SPONSOR_DRAFT.md')).toContain('BELUM DITANDATANGANI');
  });
});
