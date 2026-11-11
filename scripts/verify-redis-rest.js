/**
 * Explicit read-only KV/Upstash REST probe from approved server environment.
 * Does NOT auto-run in CI, access production on its own, write Redis, expose
 * secrets, or activate ads/telemetry. No sensitive output or HTTP body logging.
 */
import { resolveRedisRestConfig } from '../api/redis-rest-config.js';
const configured=resolveRedisRestConfig();
const live=process.argv.includes('--live');
if (!live) {
  console.log(JSON.stringify({stage:'production-readiness',check:'redis-rest-ping',
    status:configured?'CONFIG_PRESENT_NOT_TESTED':'NOT_CONFIGURED',
    liveProbe:false,details:'Read-only PING requires explicit --live and server credentials.'}));
} else if (!configured) {
  console.log(JSON.stringify({stage:'production-readiness',check:'redis-rest-ping',
    status:'NOT_CONFIGURED',liveProbe:false}));
  process.exitCode=2;
} else {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),4500);
  try {
    const response=await fetch(configured.url,{
      method:'POST',headers:{'Content-Type':'application/json',
        Authorization:'Bearer '+configured.token},
      body:JSON.stringify(['PING']),signal:controller.signal,
    });
    if (!response.ok)throw new Error('non-200 response');
    const body=await response.json();
    if(body?.result!=='PONG')throw new Error('unexpected response');
    console.log(JSON.stringify({stage:'production-readiness',
      check:'redis-rest-ping',status:'CONNECTED',liveProbe:true,
      provider:configured.source,readOnly:true}));
  } catch {
    console.log(JSON.stringify({stage:'production-readiness',
      check:'redis-rest-ping',status:'UNREACHABLE',liveProbe:true,readOnly:true}));
    process.exitCode=2;
  } finally {clearTimeout(timeout);}
}
