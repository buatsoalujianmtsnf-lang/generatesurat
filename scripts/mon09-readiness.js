/* MON-09 safety: CI must never mistakenly treat no metrics as launch approval. */
import {readFileSync} from 'node:fs';
import {loadMon08} from './mon08-approval-gate.js';
const load=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
export function mon09Readiness(){
  const mon08=loadMon08();
  const mon09=load('config/mon09-monitoring.json');
  const vercel=load('vercel.json');
  const preflight={
    rolloutStillBlocked:mon08.status==='BLOCKED'
      && mon08.actualActivation===false
      && mon08.productionAcceptance===false,
    metricsDisabledByDefault:mon09.enabled===false,
    retentionAtMost14Days:Number.isInteger(mon09.retentionDays)
      && mon09.retentionDays>=1&&mon09.retentionDays<=14,
    onlyServerAggregates:mon09.collection==='aggregate-server-only'
      && mon09.allowedMeasurements.join(',')==='request-count,http-status-count,latency-bucket',
    staticRoutesOnly:mon09.routes?.join(',')===
      'sponsor-start,sponsor-progress,sponsor-complete,sponsor-print,pdf-export',
    autoDeployRemainsOff:vercel.git?.deploymentEnabled===false,
    manualDeploymentPolicy:mon09.deploymentPolicy==='manual-only',
  };
  return {stage:'MON-09',status:Object.values(preflight).every(Boolean)?
    'MONITORING_NOT_ACTIVATED':'UNSAFE_CONFIGURATION',
    operationalMonitoringActive:false,
    productionHealth:'UNOBSERVED',preflight,
    note:'CI contract, not a production dashboard. MON-08 remains NO_GO.'};
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).pathname===new URL(import.meta.url).pathname){
  const result=mon09Readiness();
  if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));
  else console.log('[MON-09] '+result.status+' / production health: '+result.productionHealth);
  if(result.status!=='MONITORING_NOT_ACTIVATED')process.exitCode=1;
}
