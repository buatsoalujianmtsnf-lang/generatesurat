import {describe,it,expect,vi} from 'vitest';
import {resolveRedisRestConfig,redisRestConfigured} from '../api/redis-rest-config.js';
import {createUpstashCommand} from '../api/sponsor-ledger.js';
import {monitoringEnabled,createMon09RedisCommand,mon09Config} from '../api/mon09-metrics.js';

const full={
 KV_REST_API_URL:'https://kv.example.test',
 KV_REST_API_TOKEN:'ci-fixture-not-a-production-secret',
};
describe('Production readiness: pre-existing Vercel KV credentials',()=>{
 it('resolves KV HTTPS pair without copying or revealing credentials',()=>{
   const v=resolveRedisRestConfig(full);
   expect(v?.url).toBe('https://kv.example.test');
   expect(v?.source).toBe('existing-vercel-kv');
   expect(v?.token).toBe(full.KV_REST_API_TOKEN);
   expect(redisRestConfigured(full)).toBe(true);
 });
 it('explicit Upstash pair wins over legacy KV without mixing providers',()=>{
   const conf={...full,UPSTASH_REDIS_REST_URL:'https://upstash.example.test',
     UPSTASH_REDIS_REST_TOKEN:'fixture-explicit-test-token'};
   expect(resolveRedisRestConfig(conf).source).toBe('explicit-upstash');
   expect(resolveRedisRestConfig(conf).url).toBe('https://upstash.example.test');
   expect(resolveRedisRestConfig(conf).token).toBe(conf.UPSTASH_REDIS_REST_TOKEN);
 });
 it('fails closed on partial explicit config instead of falling back to KV',()=>{
   expect(resolveRedisRestConfig({...full,UPSTASH_REDIS_REST_URL:'https://upstash.example.test'})).toBeNull();
   expect(resolveRedisRestConfig({...full,UPSTASH_REDIS_REST_TOKEN:'token'})).toBeNull();
   expect(resolveRedisRestConfig({KV_REST_API_URL:'https://kv.example.test'})).toBeNull();
   expect(resolveRedisRestConfig({KV_REST_API_TOKEN:'token'})).toBeNull();
   expect(redisRestConfigured({})).toBe(false);
 });
 it('rejects insecure URLs, embedded credentials, query strings and paths',()=>{
   for (const url of ['http://kv.example.test','https://user:pass@kv.example.test',
     'https://kv.example.test/?x=1','https://kv.example.test/x',
     'https://kv.example.test/#token','not-a-url']) {
     expect(resolveRedisRestConfig({...full,KV_REST_API_URL:url})).toBeNull();
   }
 });
 it('uses Redis REST with Bearer auth only on the server',async()=>{
   const fetchMock=vi.fn(async()=>({ok:true,json:async()=>({result:'PONG'})}));
   const command=createUpstashCommand(full,fetchMock);
   expect(await command(['PING'])).toBe('PONG');
   expect(fetchMock).toHaveBeenCalledOnce();
   const [url,options]=fetchMock.mock.calls[0];
   expect(url).toBe('https://kv.example.test');
   expect(options.method).toBe('POST');
   expect(options.headers.Authorization).toBe('Bearer '+full.KV_REST_API_TOKEN);
   expect(JSON.parse(options.body)).toEqual(['PING']);
 });
 it('keeps sponsor and monitoring independent from mere existence of KV',()=>{
   expect(monitoringEnabled({...full,MON09_METRICS_ENABLED:'true'})).toBe(false);
   expect(monitoringEnabled({...full,MON09_METRICS_ENABLED:'false'},
     {...mon09Config,enabled:true})).toBe(false);
   expect(monitoringEnabled({...full,MON09_METRICS_ENABLED:'true'},
     {...mon09Config,enabled:true})).toBe(true);
 });
 it('monitoring command accepts existing KV REST with explicit approval',async()=>{
   const env={...full,MON09_METRICS_ENABLED:'true'};
   const fetchMock=vi.fn(async()=>({ok:true,json:async()=>({result:3})}));
   const command=createMon09RedisCommand(env,fetchMock,{...mon09Config,enabled:true});
   expect(await command(['HGETALL','safe:test-key'])).toBe(3);
   expect(fetchMock.mock.calls[0][0]).toBe('https://kv.example.test');
 });
});
