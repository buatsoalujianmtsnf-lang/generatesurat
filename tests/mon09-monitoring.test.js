import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {
  monitoringEnabled,makeMon09Sample,recordMon09Outcome,parseMon09RedisHash,
  summarizeMon09,mon09Config,MON09_RECORD_LUA,createMon09RedisCommand
} from '../api/mon09-metrics.js';
import {mon09Readiness} from '../scripts/mon09-readiness.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const env={
  MON09_METRICS_ENABLED:'true',
  UPSTASH_REDIS_REST_URL:'https://redis.example.test',
  UPSTASH_REDIS_REST_TOKEN:'fake-token-test-only',
};
const on=()=>({...mon09Config,enabled:true});
describe('MON-09 safe server aggregates',()=>{
  it('defaults to monitoring disabled, independent from receipt or print',async()=>{
    expect(mon09Readiness().status).toBe('MONITORING_NOT_ACTIVATED');
    expect(mon09Readiness().productionHealth).toBe('UNOBSERVED');
    expect(mon09Config.enabled).toBe(false);
    expect(monitoringEnabled(env)).toBe(false);
    const cmd=vi.fn();
    expect(await recordMon09Outcome({route:'sponsor-start',status:200,durationMs:100},
      {env,command:cmd})).toBe(false);
    expect(cmd).not.toHaveBeenCalled();
    expect(JSON.parse(read('config/mon08-rollout.json')).decision).toBe('NO_GO');
  });
  it('limits metric keys and fields to fixed routes/status/duration only',()=>{
    const sample=makeMon09Sample({
      route:'pdf-export',status:503,durationMs:600,now:Date.UTC(2026,10,11)});
    expect(sample).toEqual({
      key:'gs:mon09:v1:2026-11-11',
      fields:['pdf-export|requests','pdf-export|http_503','pdf-export|latency_le1000'],
      ttlSeconds:14*86400,
    });
    const serialized=JSON.stringify(sample);
    for(const secret of ['studentName','nik','receipt','sessionToken','198.51.100.1']){
      expect(serialized).not.toContain(secret);
    }
    expect(makeMon09Sample({route:'student-123',status:200,durationMs:1})).toBeNull();
    expect(makeMon09Sample({route:'pdf-export',status:100,durationMs:1})).toBeNull();
    expect(makeMon09Sample({route:'pdf-export',status:200,durationMs:-1})).toBeNull();
    expect(MON09_RECORD_LUA).toContain("redis.call('EXPIRE'");
    expect(MON09_RECORD_LUA).not.toContain('LPUSH');
  });
  it('records only three fixed aggregate counters and never emits PII',async()=>{
    const send=vi.fn(async()=>1);
    const result=await recordMon09Outcome({
      route:'sponsor-complete',status:409,durationMs:1800,now:Date.UTC(2026,10,11)
    },{env,config:on(),command:send});
    expect(result).toBe(true);
    expect(send).toHaveBeenCalledOnce();
    const call=send.mock.calls[0][0];
    expect(call.slice(0,4)).toEqual(['EVAL',MON09_RECORD_LUA,'1','gs:mon09:v1:2026-11-11']);
    expect(call.slice(4,7)).toEqual([
      'sponsor-complete|requests','sponsor-complete|http_409','sponsor-complete|latency_le3000']);
    expect(call.at(-1)).toBe(String(14*86400));
  });
  it('telemetry outage never changes an export/receipt decision',async()=>{
    const spy=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const result=await recordMon09Outcome({
      route:'pdf-export',status:200,durationMs:800
    },{env,config:on(),command:async()=>{throw Error('redis secret hidden');}});
    expect(result).toBe(false);
    expect(spy).toHaveBeenCalledWith('[mon09] aggregate metric unavailable');
    spy.mockRestore();
  });
  it('requires credentials and rejects insecure Redis URL before any fetch',()=>{
    expect(monitoringEnabled({...env,MON09_METRICS_ENABLED:'false'},on())).toBe(false);
    expect(monitoringEnabled({...env,UPSTASH_REDIS_REST_TOKEN:''},on())).toBe(false);
    expect(()=>createMon09RedisCommand({...env,UPSTASH_REDIS_REST_URL:'http://redis.test'},vi.fn(),on()))
      .toThrow('trusted HTTPS Redis');
  });
  it('parses Redis HGETALL without accepting uncontrolled or sensitive labels',()=>{
    expect(parseMon09RedisHash([
      'pdf-export|requests','3','pdf-export|http_503','2',
      'student_name','Alice','pdf-export|user_123','5'
    ])).toEqual({'pdf-export|requests':3,'pdf-export|http_503':2});
    expect(()=>parseMon09RedisHash(['pdf-export|requests'])).toThrow();
    expect(()=>parseMon09RedisHash(['pdf-export|requests','-1'])).toThrow();
    expect(parseMon09RedisHash(null)).toEqual({});
  });
  it('never calls no-data or under-sampled data healthy',()=>{
    const empty=summarizeMon09([]);
    expect(empty.status).toBe('NO_DATA');
    expect(empty.totalRequests).toBe(0);
    const low=summarizeMon09([{day:'2026-11-11',values:{
      'pdf-export|requests':'3','pdf-export|http_200':'3',
      'pdf-export|latency_le500':'3'
    }}]);
    expect(low.status).toBe('INSUFFICIENT_DATA');
    expect(low.routes['pdf-export'].requests).toBe(3);
  });
  it('raises alerts only above operator-review thresholds with enough data',()=>{
    const alert=summarizeMon09([{day:'2026-11-11',values:{
      'pdf-export|requests':'40','pdf-export|http_503':'8',
      'pdf-export|http_200':'32','pdf-export|latency_le1000':'30',
      'pdf-export|latency_le30000':'10',
      'sponsor-start|requests':'50','sponsor-start|http_503':'5',
      'sponsor-start|http_429':'8','sponsor-start|http_200':'37',
      'sponsor-start|latency_le250':'50'
    }}]);
    expect(alert.status).toBe('ALERT');
    expect(alert.alerts.map(x=>x.code)).toEqual(expect.arrayContaining([
      'PDF_SERVER_ERRORS','SPONSOR_UNAVAILABLE','SPONSOR_RATE_LIMIT','PDF_LATENCY'
    ]));
    expect(alert.routes['pdf-export'].p95UpperBoundMs).toBe(30000);
  });
  it('integrates only on backend endpoints, with no browser tracking or editor ads',()=>{
    const sponsor=read('api/sponsor-http.js'),pdf=read('api/export-pdf.js');
    expect(sponsor).toContain("recordMon09Outcome({route,status,durationMs");
    expect(sponsor).toContain('await respond(200,output)');
    expect(pdf).toContain("route:'pdf-export'");
    expect(pdf).toContain('await recordMon09Outcome(');
    expect(read('index.html')).not.toMatch(/mon09|adsbygoogle|googlesyndication/);
    expect(read('js/sponsor-video-modal.js')).not.toContain('mon09');
    expect(read('privasi.html')).toContain('Rencana monitoring teknis');
    expect(read('privasi.html')).toContain('maksimum 14 hari');
    expect(JSON.parse(read('vercel.json')).git.deploymentEnabled).toBe(false);
  });
});
