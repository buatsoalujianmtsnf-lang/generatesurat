import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {mon07Readiness} from '../scripts/mon07-release-readiness.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
describe('MON-07 operational acceptance remains evidence-based',()=>{
 it('does not turn isolated CI results into a production sign-off',()=>{
   expect(mon07Readiness.status).toBe('BLOCKED');
   expect(mon07Readiness.productionActivation).toBe(false);
   expect(mon07Readiness.manualPassed).toBe(0);
   expect(mon07Readiness.manualCases).toBeGreaterThanOrEqual(15);
 });
 it('requires secure launch baseline and disabled Vercel auto-deploy',()=>{
   expect(Object.values(mon07Readiness.safeMode).every(Boolean)).toBe(true);
   expect(JSON.parse(read('config/sponsor-policy.json')).enabled).toBe(false);
   expect(JSON.parse(read('config/sponsor-campaigns.json')).enabled).toBe(false);
   expect(JSON.parse(read('vercel.json')).git.deploymentEnabled).toBe(false);
 });
 it('keeps exact unapproved UAT cases and no fabricated completion',()=>{
   const evidence=JSON.parse(read('docs/mon-07-evidence.json'));
   expect(evidence.manualUat.every(x=>x.status==='NOT_RUN' && x.evidenceRef===null)).toBe(true);
   expect(evidence.automatedEvidence.resultsPending).toBe(true);
   expect(Object.values(evidence.externalApprovals).every(v=>v===false)).toBe(true);
 });
 it('defines distinct Redis, browser and operations evidence sources',()=>{
   const wf=read('.github/workflows/quality-checks.yml');
   expect(wf).toContain('redis:7.4-alpine');
   expect(wf).toContain('mon07-redis:');
   expect(wf).toContain('mon07-browser:');
   expect(wf).toContain('npm run test:mon07:redis');
   expect(wf).toContain('npm run test:mon07:browser');
   const uat=read('docs/MON-07_UAT_ACCEPTANCE.md');
   expect(uat).toContain('BLOCKED');
   expect(uat).toContain('50 tindakan paralel');
   expect(uat).toContain('Firefox');
   expect(uat).toContain('Safari');
   expect(uat).toContain('AdSense');
 });
});
