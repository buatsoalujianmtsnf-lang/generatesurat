/**
 * MON-07 operational readiness ledger. Never activates a feature or reads
 * secret values. PASS requires actual signed evidence, not simulated fixtures.
 * --expect-blocked is a CI safety contract until MON-08 go/no-go approval.
 * --strict reports failure for deployment gating when not fully approved.
 */
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');
const policy=JSON.parse(read('config/sponsor-policy.json'));
const campaigns=JSON.parse(read('config/sponsor-campaigns.json'));
const vercel=JSON.parse(read('vercel.json'));
const evidence=JSON.parse(read('docs/mon-07-evidence.json'));
const html=read('index.html');
const flags=[
  {id:'signed-sponsor-and-materials',ok:evidence.externalApprovals.sponsorContractSigned===true
    && evidence.externalApprovals.rightsAndMaterialsValidated===true},
  {id:'approved-privacy-and-accessibility',ok:evidence.externalApprovals.privacyAndChildDataReviewApproved===true
    && evidence.externalApprovals.accessibilityFallbackApproved===true},
  {id:'production-redis-and-failover',ok:evidence.externalApprovals.redisProductionConfigured===true
    && evidence.externalApprovals.redisProductionFailoverTested===true},
  {id:'staging-security-and-pwa-rollback',ok:evidence.externalApprovals.stagingGateVerified===true
    && evidence.externalApprovals.pwaRollbackDrillPassed===true},
  {id:'devices-and-incident-owner',ok:evidence.externalApprovals.browserDeviceUatApproved===true
    && evidence.externalApprovals.incidentOwnerSignedOff===true},
  {id:'adsense-public-consent-policy',ok:evidence.externalApprovals.adsensePublicOnlyAndCmpReviewApproved===true},
  {id:'all-manual-uat-evidence',ok:evidence.manualUat.length>=15
    && evidence.manualUat.every(x=>x.status==='PASS'
      && typeof x.evidenceRef==='string'&&x.evidenceRef.length>=10)},
  {id:'full-ci-evidence-linked',ok:evidence.automatedEvidence.resultsPending===false
    && typeof evidence.automatedEvidence.redis7IntegrationRun==='string'
    && typeof evidence.automatedEvidence.headlessChromiumRun==='string'
    && typeof evidence.automatedEvidence.gitHubQualityRun==='string'},
];
const safeMode={
  autoDeployDisabled:vercel.git?.deploymentEnabled===false,
  editorSponsorDisabled:html.includes('data-sponsor-gate="off"'),
  sponsorPolicyDisabled:policy.enabled===false&&policy.releasePhase==='prelaunch',
  campaignRegistryDisabled:campaigns.enabled===false&&campaigns.campaigns.length===0,
  editorAdSenseExcluded:!/adsbygoogle|pagead2\.googlesyndication/i.test(html),
};
const missing=flags.filter(x=>!x.ok).map(x=>x.id);
const status=missing.length===0?'READY_FOR_HUMAN_GO_NO_GO':'BLOCKED';
const result={
  stage:'MON-07',status,technicalValidation:'CI_RESULT_SEPARATE',
  productionActivation:false,manualCases:evidence.manualUat.length,
  manualPassed:evidence.manualUat.filter(x=>x.status==='PASS').length,
  safeMode,unmet:missing,
  explanation:'True Redis CI and headless Chromium smoke do not replace actual Redis production, devices, legal and operational approvals.'
};
if(process.argv.includes('--json')) console.log(JSON.stringify(result,null,2));
else {
  console.info('[MON-07] '+status+'; UAT '+result.manualPassed+'/'+result.manualCases);
  console.info('[MON-07] pending gates: '+(missing.join(', ')||'none'));
  console.info('[MON-07] safe baseline: '+JSON.stringify(safeMode));
}
if(Object.values(safeMode).some(v=>v!==true)) {
  console.error('[MON-07] UNSAFE baseline changed before final acceptance.');
  process.exitCode=1;
}else if(process.argv.includes('--expect-blocked') && status!=='BLOCKED'){
  console.error('[MON-07] Unexpected activation state; review MON-08 gate before enabling.');
  process.exitCode=1;
}else if(process.argv.includes('--strict') && status!=='READY_FOR_HUMAN_GO_NO_GO'){
  console.error('[MON-07] Release is blocked until evidence and sign-offs are available.');
  process.exitCode=2;
}
export {result as mon07Readiness};
