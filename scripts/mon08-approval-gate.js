/**
 * MON-08: read-only, evidence-based Google/first-party sponsor release gate.
 * A JSON status or evidence URL does not prove provider approval; the operator
 * must inspect real AdSense Sites/Policy center and sign a separate go/no-go.
 * This tool never deploys, edits secrets, connects to Google or enables ads.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const parse=path=>JSON.parse(read(path));
const ref=value=>typeof value==='string' && /^https:\/\/[a-z0-9][^\s]+$/i.test(value);
const yes=value=>value===true;
const passed=checks=>Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);

export function assessMon08({
  rollout,evidence,mon07,zones,policy,campaigns,vercel,html,adsTxt,pages
}) {
  const g=evidence.google||{},s=evidence.sponsor||{},ops=evidence.operations||{};
  const routes=rollout.google?.publicPageAllowlist||[];
  const publicOnly=routes.length>0
    && routes.every(route=>['/panduan','/panduan-cetak-pdf','/faq'].includes(route))
    && routes.every(route=>typeof pages[route]==='string'
      && /<article[\s>]/i.test(pages[route])
      && /<h1[\s>]/i.test(pages[route])
      && /href="\/privasi"/i.test(pages[route]))
    && zones.allowedRoutes.every(route=>routes.includes(route))
    && zones.units.every(u=>!u.enabled||routes.includes(u.route))
    && routes.every(route=>route!=='/'&&!route.startsWith('/editor'))
    && zones.deniedRoutePrefixes.includes('/editor')
    && zones.deniedRoutePrefixes.includes('/api/');
  const ownerCheck=typeof g.approvedHost==='string'
    && g.approvedHost===rollout.google?.approvedDomain
    && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(g.approvedHost);
  const google={
    realSiteStatus:g.siteStatus==='Ready'&&g.accountStatus==='ACTIVE'
      && ownerCheck&&ref(g.siteStatusEvidenceRef)
      && typeof g.siteStatusCheckedAt==='string'
      && !Number.isNaN(Date.parse(g.siteStatusCheckedAt)),
    siteOwnership:yes(g.domainOwnershipVerified)&&ref(g.domainOwnershipEvidenceRef),
    verifiedPublisherAndAdsTxt:typeof g.publisherId==='string'
      && /^pub-\d{16}$/.test(g.publisherId)
      && zones.publisherId===g.publisherId
      && g.adsTxtStatus==='AUTHORIZED'&&ref(g.adsTxtEvidenceRef)
      && adsTxt.split(/\r?\n/).some(line=>line.trim()
        ==='google.com, '+g.publisherId+', DIRECT, f08c47fec0942fa0'),
    policyCenter:g.policyCenterStatus==='NO_ISSUES'&&ref(g.policyCenterEvidenceRef)
      && yes(g.publicContentReviewApproved)&&ref(g.publicContentEvidenceRef),
    privacyAndCmp:yes(g.audienceRegionReviewCompleted)
      && ref(g.regionReviewEvidenceRef)
      && ['CERTIFIED','NOT_REQUIRED_WITH_JUSTIFICATION'].includes(g.certifiedCmpStatus)
      && ref(g.cmpEvidenceRef),
    allowedManualPlacements:publicOnly&&zones.contentOnly===true
      && zones.autoAds===false&&yes(g.autoAdsOffVerified)
      && yes(g.adPlacementReviewed),
    isolatedPublicCspAndScript:yes(g.publicPageCspVerified)
      && ref(g.publicPageCspEvidenceRef)
      && yes(g.publicAdScriptReviewed)
      && ref(g.publicAdScriptEvidenceRef),
    namedGoogleReviewer:typeof g.approvedBy==='string'&&g.approvedBy.length>=3
      && typeof g.approvedAt==='string'&&!Number.isNaN(Date.parse(g.approvedAt)),
  };
  const approvals=mon07.externalApprovals||{};
  const sponsor={
    contractAnd15sRights:yes(approvals.sponsorContractSigned)
      && yes(approvals.rightsAndMaterialsValidated)
      && ref(s.signedAgreementEvidenceRef)
      && ref(s.approved15sVideoEvidenceRef)
      && ref(s.approvedModerationEvidenceRef),
    privacyAndAccessibility:yes(approvals.privacyAndChildDataReviewApproved)
      && yes(approvals.accessibilityFallbackApproved)
      && ref(s.accessibilityExceptionEvidenceRef),
    liveRedisAndStaging:yes(approvals.redisProductionConfigured)
      && yes(approvals.redisProductionFailoverTested)
      && yes(approvals.stagingGateVerified)
      && ref(s.productionUpstashEvidenceRef)
      && ref(s.stagingBrowserUatEvidenceRef),
    devicesAndRollback:yes(approvals.browserDeviceUatApproved)
      && yes(approvals.pwaRollbackDrillPassed)
      && yes(approvals.incidentOwnerSignedOff)
      && ref(s.pwaRollbackEvidenceRef)
      && mon07.manualUat?.length>=15
      && mon07.manualUat.every(x=>x.status==='PASS'&&ref(x.evidenceRef)),
    actualCampaignApproved:Array.isArray(campaigns.campaigns)
      && campaigns.campaigns.some(c=>c.status==='approved'
        && ['agreementSigned','rightsVerified','contentApproved',
          'privacyApproved','operatorApproved'].every(k=>c.approvals?.[k]===true)
        && typeof c.media?.path==='string'&&c.media.path.startsWith('assets/sponsors/')),
    sameActionContract:rollout.sponsor?.requiredSeconds===15
      && rollout.sponsor?.interval==='every-new-action'
      && rollout.sponsor?.activationScope==='all-users-synchronized',
  };
  const operator={
    namedOwners:typeof ops.releaseOwner==='string'&&ops.releaseOwner.length>=3
      && typeof ops.privacyOwner==='string'&&ops.privacyOwner.length>=3,
    manualGoNoGo:ref(ops.signedGoNoGoEvidenceRef)
      && ref(ops.manualDeploymentApprovalRef)
      && rollout.release?.manualDeploymentAuthorized===true
      && ref(rollout.release?.approvalReference)
      && typeof rollout.release?.approver==='string',
    rollbackAndCompatibility:yes(ops.previousDeploymentVerified)
      && yes(ops.incidentResponseRehearsed)
      && ref(ops.manualRollbackEvidenceRef)
      && ref(ops.canaryReviewEvidenceRef)
      && rollout.release?.rollbackRehearsed===true
      && rollout.release?.minimumClientCompatibilityVerified===true,
  };
  const missing={google:passed(google),sponsor:passed(sponsor),operator:passed(operator)};
  const readiness={
    google:missing.google.length===0&&missing.operator.length===0,
    sponsor:missing.sponsor.length===0&&missing.operator.length===0,
  };
  const requested={
    google:rollout.google?.requestedState==='on'||zones.enabled===true
      || zones.units.some(u=>u.enabled===true),
    sponsor:rollout.sponsor?.requestedState==='on'||policy.enabled===true
      || campaigns.enabled===true
      || /<html[^>]*data-sponsor-gate="required"/i.test(html),
  };
  const anyRequested=requested.google||requested.sponsor
    || rollout.decision==='GO'||rollout.release?.phase==='production';
  const baseline={
    autoDeployOff:vercel.git?.deploymentEnabled===false
      && rollout.deploymentPolicy==='manual-only',
    noGoogleInSharedEditor:!/adsbygoogle|pagead2\.googlesyndication|google_ad_client/i.test(html),
    eligibleRoutesOnly:publicOnly,
    autoAdsOff:zones.autoAds===false,
    initialFlagsOff:rollout.decision==='NO_GO'
      && rollout.google?.requestedState==='off'
      && rollout.sponsor?.requestedState==='off'
      && rollout.release?.manualDeploymentAuthorized===false
      && zones.enabled===false&&policy.enabled===false&&campaigns.enabled===false
      && /<html[^>]*data-sponsor-gate="off"/i.test(html),
  };
  const hazards=[];
  if(!baseline.autoDeployOff)hazards.push('AUTO_DEPLOY_NOT_DISABLED');
  if(!baseline.noGoogleInSharedEditor)hazards.push('GOOGLE_ADS_IN_EDITOR_SHARED_HTML');
  if(!baseline.eligibleRoutesOnly)hazards.push('UNSAFE_PUBLIC_ROUTES');
  if(!baseline.autoAdsOff)hazards.push('AUTO_ADS_MUST_STAY_OFF');
  if(requested.google&&!readiness.google)hazards.push('GOOGLE_APPROVAL_NOT_VERIFIED');
  if(requested.sponsor&&!readiness.sponsor)hazards.push('SPONSOR_NOT_OPERATIONALLY_APPROVED');
  if(anyRequested&&missing.operator.length>0)hazards.push('NO_SIGNED_RELEASE_GO_NO_GO');
  if(requested.sponsor&&rollout.release?.minimumClientCompatibilityVerified!==true)
    hazards.push('PWA_VERSION_SKEW_RISK');
  if(!anyRequested&&rollout.decision!=='NO_GO')hazards.push('RELEASE_DECISION_MISMATCH');
  const status=hazards.length?'UNSAFE_CONFIGURATION'
    :anyRequested?'FINAL_MANUAL_AUTHORIZATION_REQUIRED'
    :(readiness.google||readiness.sponsor)?'READY_FOR_HUMAN_REVIEW':'BLOCKED';
  return {stage:'MON-08',status,readiness,requested,missing,baseline,hazards,
    actualActivation:false,productionAcceptance:false,
    note:'Reported Google statuses are unverified attestations until independently checked in the real provider account. No automatic launch is performed.'};
}
export function loadMon08(){
  return assessMon08({
    rollout:parse('config/mon08-rollout.json'),
    evidence:parse('docs/mon08-approval-evidence.json'),
    mon07:parse('docs/mon-07-evidence.json'),
    zones:parse('config/adsense-zones.json'),
    policy:parse('config/sponsor-policy.json'),
    campaigns:parse('config/sponsor-campaigns.json'),
    vercel:parse('vercel.json'),html:read('index.html'),adsTxt:read('ads.txt'),
    pages:{
      '/panduan':read('panduan.html'),
      '/panduan-cetak-pdf':read('panduan-cetak-pdf.html'),
      '/faq':read('faq.html'),
    },
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),result=loadMon08();
  if(args.includes('--json'))console.log(JSON.stringify(result,null,2));
  else{
    console.log('[MON-08] '+result.status);
    console.log('Google missing: '+result.missing.google.join(', '));
    console.log('Sponsor missing: '+result.missing.sponsor.join(', '));
    console.log('Operator missing: '+result.missing.operator.join(', '));
  }
  const pos=args.indexOf('--write-report');
  if(pos>=0){
    const dest=args[pos+1];
    if(!dest || !/^artifacts\/[a-z0-9/._-]+\.json$/i.test(dest)||dest.includes('..')) {
      console.error('Invalid report path');
      process.exitCode=1;
    }else{
      const file=resolve(process.cwd(),dest);
      mkdirSync(dirname(file),{recursive:true});
      writeFileSync(file,JSON.stringify(result,null,2)+'\n');
    }
  }
  if(result.hazards.length){
    console.error('[MON-08] Unsafe configuration: '+result.hazards.join(', '));
    process.exitCode=1;
  }else if(args.includes('--expect-blocked')&&result.status!=='BLOCKED'){
    console.error('[MON-08] Approval status changed without explicit release review');
    process.exitCode=1;
  }else if(args.includes('--strict')&&result.status!=='READY_FOR_HUMAN_REVIEW'){
    console.error('[MON-08] Production activation prohibited until human approval');
    process.exitCode=2;
  }
}
