/* MON-09: privacy-minimal, aggregate-only server metrics.
 * No user/document data, IP, token, receipt, campaign, User-Agent or URL stored.
 * Collector is independent from sponsor/export authorization: monitoring must
 * never turn a denial into an authorization or fail an otherwise valid export.
 */
import { readFileSync } from 'node:fs';
const defaultConfig = JSON.parse(readFileSync(new URL('../config/mon09-monitoring.json',import.meta.url),'utf8'));
const ROUTES = new Set(['sponsor-start','sponsor-progress','sponsor-complete','sponsor-print','pdf-export']);
const BUCKETS = [250,500,1000,3000,8000,30000];
const MAX_DURATION_MS = 120_000;
export const MON09_RECORD_LUA = String.raw`-- MON09_RECORD_AGGREGATE_V1; hash contains only fixed count fields
for i = 1, 3 do
  redis.call('HINCRBY', KEYS[1], ARGV[i], 1)
end
local ttl=redis.call('TTL', KEYS[1])
if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
end
return 1
`;

export function monitoringEnabled(env=process.env, config=defaultConfig) {
  return config?.schemaVersion===1 && config.enabled===true
    && env.MON09_METRICS_ENABLED==='true'
    && typeof env.UPSTASH_REDIS_REST_URL==='string' && !!env.UPSTASH_REDIS_REST_URL
    && typeof env.UPSTASH_REDIS_REST_TOKEN==='string' && !!env.UPSTASH_REDIS_REST_TOKEN;
}
export function makeMon09Sample({route,status,durationMs,now=Date.now()},config=defaultConfig) {
  if (!ROUTES.has(route) || !config.routes?.includes(route)) return null;
  if (!Number.isInteger(status) || status<200 || status>599
    || !Number.isFinite(durationMs) || durationMs<0
    || !Number.isFinite(now)) return null;
  const day=new Date(now).toISOString().slice(0,10);
  const bucket=BUCKETS.find(upper=>durationMs<=upper);
  const timeLabel=bucket? 'le'+bucket : 'gt30000';
  const base=route+'|';
  return {
    key:'gs:mon09:v1:'+day,
    fields:[base+'requests',base+'http_'+status,base+'latency_'+timeLabel],
    ttlSeconds:config.retentionDays*86400,
  };
}
export function createMon09RedisCommand(env=process.env, fetchImpl=fetch, config=defaultConfig) {
  if (!monitoringEnabled(env,config)) throw new Error('MON-09 is not configured');
  if (!Number.isInteger(config.redisTimeoutMs) || config.redisTimeoutMs<100 || config.redisTimeoutMs>1500) {
    throw new Error('MON-09 timeout out of bounds');
  }
  const url=new URL(env.UPSTASH_REDIS_REST_URL);
  if (url.protocol!=='https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('MON-09 requires a trusted HTTPS Redis endpoint');
  }
  return async args => {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),config.redisTimeoutMs);
    try {
      const response=await fetchImpl(url.href,{
        method:'POST',headers:{'Content-Type':'application/json',
          Authorization:'Bearer '+env.UPSTASH_REDIS_REST_TOKEN},
        body:JSON.stringify(args),signal:controller.signal,
      });
      if (!response.ok) throw new Error('Redis transport unavailable');
      const value=await response.json();
      if (!value || value.error || value.result===undefined) throw new Error('Invalid Redis response');
      return value.result;
    } finally {
      clearTimeout(timer);
    }
  };
}
/** Always best effort: no error can change authorization or HTTP response. */
export async function recordMon09Outcome({route,status,durationMs,now},
  {env=process.env,config=defaultConfig,command}={}) {
  if (!monitoringEnabled(env,config)) return false;
  try {
    const sample=makeMon09Sample({route,status,durationMs,now},config);
    if (!sample || sample.ttlSeconds!==14*86400) return false;
    const send=command || createMon09RedisCommand(env,fetch,config);
    const result=await send(['EVAL',MON09_RECORD_LUA,'1',sample.key,
      ...sample.fields,String(sample.ttlSeconds)]);
    return Number(result)===1;
  } catch {
    // Intentionally omit error messages and external payloads from logs.
    // Metrics can fail independently; core policy remains fail closed.
    console.warn('[mon09] aggregate metric unavailable');
    return false;
  }
}
export function parseMon09RedisHash(raw) {
  let entries=[];
  if (Array.isArray(raw)) {
    if (raw.length%2!==0) throw new Error('Invalid Redis HGETALL');
    for(let i=0;i<raw.length;i+=2) entries.push([raw[i],raw[i+1]]);
  } else if (raw && typeof raw==='object') entries=Object.entries(raw);
  else if(raw!==null) throw new Error('Unexpected Redis HGETALL type');
  const out={};
  for(const [key,value] of entries) {
    // Only allow controlled aggregate field names to enter reports.
    if (typeof key!=='string' || !/^(sponsor-(start|progress|complete|print)|pdf-export)\|(requests|http_[2-5]\d\d|latency_(le(250|500|1000|3000|8000|30000)|gt30000))$/.test(key)) continue;
    const amount=Number(value);
    if(!Number.isSafeInteger(amount)||amount<0)throw new Error('Invalid aggregate counter');
    out[key]=amount;
  }
  return out;
}
export function summarizeMon09(days,config=defaultConfig) {
  const totals={};
  for(const route of config.routes) {
    totals[route]={requests:0,success:0,errors4xx:0,errors5xx:0,status403:0,status409:0,
      status410:0,status429:0,status503:0,latencyHistogram:{}};
  }
  for(const day of days) {
    if(!day || typeof day.day!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.day)) throw new Error('Invalid day label');
    const fields=parseMon09RedisHash(day.values);
    for(const route of config.routes) {
      const out=totals[route];
      out.requests+=(fields[route+'|requests']||0);
      for(let status=200;status<=599;status++) {
        const n=fields[route+'|http_'+status]||0;
        if(status<300)out.success+=n;
        if(status>=400&&status<500)out.errors4xx+=n;
        if(status>=500)out.errors5xx+=n;
        if([403,409,410,429,503].includes(status))out['status'+status]+=n;
      }
      for(const label of [...BUCKETS.map(n=>'le'+n),'gt30000']) {
        out.latencyHistogram[label]=(out.latencyHistogram[label]||0)+
          (fields[route+'|latency_'+label]||0);
      }
    }
  }
  for(const route of config.routes) {
    const out=totals[route];
    const target=Math.ceil(out.requests*.95);
    let cumulative=0;out.p95UpperBoundMs=null;
    for(const upper of [...BUCKETS,Infinity]) {
      cumulative+=out.latencyHistogram[upper===Infinity?'gt30000':'le'+upper]||0;
      if(out.requests>0&&cumulative>=target) {
        out.p95UpperBoundMs=Number.isFinite(upper)?upper:null;
        break;
      }
    }
  }
  const alerts=[],pending=[];
  for(const rule of config.thresholds) {
    const row=totals[rule.route];
    if(!row || row.requests<rule.minSamples) {
      pending.push({code:rule.code,reason:'INSUFFICIENT_SAMPLES',requests:row?.requests||0});
      continue;
    }
    let exceeded=false,value;
    if(rule.metric==='p95-latency') {
      value=row.p95UpperBoundMs;
      // null can mean >30000 or malformed histogram: warn, not green.
      exceeded=value===null || value>rule.upperBoundMsAbove;
    }else{
      const count=rule.metric==='5xx'?row.errors5xx:row['status'+rule.metric]||0;
      value=count/row.requests;
      exceeded=value>rule.rateAbove;
    }
    if(exceeded)alerts.push({code:rule.code,route:rule.route,value,
      requests:row.requests});
  }
  const totalRequests=Object.values(totals).reduce((a,v)=>a+v.requests,0);
  return {stage:'MON-09',
    status:alerts.length?'ALERT':totalRequests===0?'NO_DATA':pending.length?'INSUFFICIENT_DATA':'OBSERVED',
    totalRequests,daysEvaluated:days.length,routes:totals,alerts,pending,
    privacy:'Aggregate-only. No PII or user events.',
    note:'Bucket p95 is an approximate upper bound, not a measured exact percentile. No data never means healthy.'};
}
export { defaultConfig as mon09Config };
