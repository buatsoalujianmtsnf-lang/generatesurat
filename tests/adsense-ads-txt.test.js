import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const expected='google.com, pub-4751617120862559, DIRECT, f08c47fec0942fa0';
describe('AdSense owner supplied ads.txt root seller declaration',()=>{
  it('publishes exact Google seller line once in root ads.txt with no duplicates or placeholder',()=>{
    const file=read('ads.txt');
    expect(file).toBe(expected+'\n');
    expect(file.split(/\r?\n/).filter(Boolean)).toHaveLength(1);
    expect(file).not.toMatch(/pub-0000000000000000|pub-XXXXXXXXXXXXXXXX|Belum ada ID penayang/);
  });
  it('matches meta, script and code publisher identifiers',()=>{
    const ads=JSON.parse(read('config/adsense-zones.json'));
    const html=read('index.html');
    expect(ads.publisherId).toBe('pub-4751617120862559');
    expect(html).toContain('name="google-adsense-account" content="ca-pub-4751617120862559"');
    for(const file of ['panduan.html','panduan-cetak-pdf.html','faq.html']){
      expect(read(file)).toContain('client=ca-pub-4751617120862559');
    }
  });
  it('does not equate supplying seller line with verified Google approval or activate any ad',()=>{
    const e=JSON.parse(read('docs/mon08-approval-evidence.json'));
    const rollout=JSON.parse(read('config/mon08-rollout.json'));
    const zones=JSON.parse(read('config/adsense-zones.json'));
    expect(e.google.adsTxtStatus).toBe('FILE_CONFIGURED_UNVERIFIED');
    expect(e.google.adsTxtEvidenceRef).toBeNull();
    expect(e.google.siteStatus).toBe('UNVERIFIED');
    expect(e.google.siteStatusEvidenceRef).toBeNull();
    expect(rollout.decision).toBe('NO_GO');
    expect(rollout.google.requestedState).toBe('off');
    expect(zones.enabled).toBe(false);
    expect(zones.autoAds).toBe(false);
    expect(zones.units.every(z=>!z.enabled&&z.slotId===null)).toBe(true);
    expect(JSON.parse(read('config/sponsor-policy.json')).enabled).toBe(false);
    expect(JSON.parse(read('config/mon09-monitoring.json')).enabled).toBe(false);
    expect(JSON.parse(read('vercel.json')).git.deploymentEnabled).toBe(false);
  });
});
