import { describe,it,expect,vi } from 'vitest';
import { createSponsorLedger, PROGRESS_SCRIPT, COMPLETE_SCRIPT, CONSUME_SCRIPT,
  RATE_SCRIPT, sessionKey, receiptKey, tokenValid, createUpstashCommand } from '../api/sponsor-ledger.js';
import { createSponsorService, sponsorIsReady, activeSponsor, SponsorFault } from '../api/sponsor-service.js';
import { validateSponsorRequest } from '../api/sponsor-http.js';
import { readFileSync } from 'node:fs';

const token = 'a'.repeat(43), receipt = 'b'.repeat(43);
const env = { SPONSOR_GATE_ENABLED:'true',UPSTASH_REDIS_REST_URL:'https://redis.example.test',
  UPSTASH_REDIS_REST_TOKEN:'fake-token-for-tests',
  SPONSOR_IP_HASH_SECRET:'s'.repeat(40), NODE_ENV:'production'};
const policy = {enabled:true,releasePhase:'production'};
const campaign = {id:'campaign-001',status:'approved',startsAt:'2026-01-01T00:00:00Z',
  endsAt:'2028-01-01T00:00:00Z', media:{path:'assets/sponsors/campaign-001/ad.mp4',mimeType:'video/mp4'},
  approvals:{agreementSigned:true,rightsVerified:true,contentApproved:true,
    privacyApproved:true,operatorApproved:true}};
const registry = {enabled:true,campaigns:[campaign]};
const startTime = Date.parse('2026-11-11T00:00:00Z');

function memoryRedis() {
  const rows = new Map();
  const rate = new Map();
  return async parts => {
    const [command,...args]=parts;
    if (command === 'SET') {
      const [key,value] = args;
      if (rows.has(key)) return null;
      rows.set(key,JSON.parse(value));
      return 'OK';
    }
    if (command !== 'EVAL') throw new Error('unexpected Redis command');
    const [script, countStr] = args, count=Number(countStr);
    const keys=args.slice(2,2+count), a=args.slice(2+count);
    if (script === RATE_SCRIPT) {
      const next=(rate.get(keys[0])||0)+1;rate.set(keys[0],next);return next;
    }
    if (script === PROGRESS_SCRIPT) {
      const [key]=keys,s=rows.get(key);
      if (!s) return 'EXPIRED';
      const [time,pos,play,visibility]=a.map(Number);
      if (time >= s.expiresAt) {rows.delete(key);return 'EXPIRED';}
      if (time < s.lastSeenAt) return 'CLOCK';
      const elapsed=time-s.lastSeenAt,advanced=pos-s.lastPositionMs;
      if (pos < s.lastPositionMs-200 || (advanced>2800 && elapsed<=2500)) return 'SEEK';
      if (s.playing && s.visible && play===1 && visibility===1
          && elapsed>0 && elapsed<=2500 && advanced>0
          && advanced>=elapsed-500 && advanced<=elapsed+350) {
        s.creditedMs=Math.min(15000,s.creditedMs+Math.min(advanced,elapsed));
      }
      s.lastSeenAt=time;s.lastPositionMs=pos;s.playing=play===1;s.visible=visibility===1;
      rows.set(key,s);
      return String(Math.floor(s.creditedMs));
    }
    if (script === COMPLETE_SCRIPT) {
      const [key,receiptKey]=keys, s=rows.get(key),time=Number(a[0]);
      if (!s) return 'EXPIRED';
      if (time>=s.expiresAt){rows.delete(key);return 'EXPIRED';}
      if (time-s.startedAt<15000 || s.creditedMs<14000 || s.lastPositionMs<14800
         || time-s.lastSeenAt>2500 || !s.visible) return 'NOT_READY';
      if (rows.has(receiptKey)) return 'CONFLICT';
      rows.set(receiptKey,{action:s.action,campaignId:s.campaignId,
        issuedAt:time,expiresAt:time+120000});
      rows.delete(key);return 'OK';
    }
    if (script === CONSUME_SCRIPT) {
      const [key]=keys,s=rows.get(key),time=Number(a[0]),kind=a[1];
      if (!s) return 'REPLAY_OR_EXPIRED';
      if (time>=s.expiresAt){rows.delete(key);return 'EXPIRED';}
      if (s.action!==kind) return 'WRONG_ACTION';
      rows.delete(key);return 'OK';
    }
    throw new Error('unknown LUA script');
  };
}
const build = (command,clock) => createSponsorService({
  command, now:()=>clock.time,makeToken:()=>clock.tokens.shift(),
  env, sponsorPolicy:policy,campaigns:registry
});
async function playback(svc,clock,sessionToken) {
  await svc.progress({sessionToken,positionMs:0,playing:true,visible:true,ip:'203.0.113.1'});
  for(let i=1;i<=15;i++){
    clock.time+=1000;
    await svc.progress({sessionToken,positionMs:i*1000,playing:true,visible:true,ip:'203.0.113.1'});
  }
}
describe('MON-03 sponsor backend session/receipt',()=>{
  it('ships disabled with no actual sponsor and refuses activation',()=>{
    const cfg=JSON.parse(readFileSync(new URL('../config/sponsor-policy.json',import.meta.url),'utf8'));
    const campaigns=JSON.parse(readFileSync(new URL('../config/sponsor-campaigns.json',import.meta.url),'utf8'));
    expect(sponsorIsReady({},cfg,campaigns,startTime)).toBe(false);
    expect(campaigns.campaigns).toEqual([]);
    expect(activeSponsor(startTime,cfg,campaigns)).toBeNull();
    expect(tokenValid(token)).toBe(true);
    expect(sessionKey(token)).not.toContain(token);
    expect(receiptKey(receipt)).not.toContain(receipt);
  });
  it('needs elapsed time and monotonic visible playback before print receipt',async()=>{
    const clock={time:startTime,tokens:[token,'c'.repeat(43),receipt,'d'.repeat(43)]};
    const svc=build(memoryRedis(),clock);
    const session=await svc.start({action:'print',source:'keyboard',ip:'203.0.113.1'});
    expect(session.sessionToken).toBe(token);
    expect(session.mediaPath).toBe('/assets/sponsors/campaign-001/ad.mp4');
    await expect(svc.complete({sessionToken:token,ended:true,ip:'203.0.113.1'}))
      .rejects.toMatchObject({code:'PLAYBACK_INCOMPLETE'});
    await playback(svc,clock,token);
    const result=await svc.complete({sessionToken:token,ended:true,ip:'203.0.113.1'});
    expect(result.receipt).toBe(receipt);
    await expect(svc.complete({sessionToken:token,ended:true,ip:'203.0.113.1'}))
      .rejects.toMatchObject({code:'SESSION_EXPIRED'});
    expect(await svc.authorizePrint({receipt,ip:'203.0.113.1'})).toEqual({authorized:true});
    await expect(svc.authorizePrint({receipt,ip:'203.0.113.1'}))
      .rejects.toMatchObject({code:'RECEIPT_INVALID'});
  });
  it('consumes PDF receipt once and denies print on a PDF receipt',async()=>{
    const clock={time:startTime,tokens:[token,receipt]};
    const svc=build(memoryRedis(),clock);
    await svc.start({action:'pdf',source:'button',ip:'203.0.113.1'});
    await playback(svc,clock,token);
    await svc.complete({sessionToken:token,ended:true,ip:'203.0.113.1'});
    await expect(svc.authorizePrint({receipt,ip:'203.0.113.1'}))
      .rejects.toMatchObject({code:'RECEIPT_INVALID'});
    expect(await svc.consumePdfReceipt({receipt})).toBe(true);
    expect(await svc.consumePdfReceipt({receipt})).toBe(false);
  });
  it('rejects race: one receipt can only be consumed by one concurrent caller',async()=>{
    const clock={time:startTime,tokens:[token,receipt]};
    const svc=build(memoryRedis(),clock);
    await svc.start({action:'print',ip:'203.0.113.1'});
    await playback(svc,clock,token);
    await svc.complete({sessionToken:token,ended:true,ip:'203.0.113.1'});
    const result=await Promise.allSettled([
      svc.authorizePrint({receipt,ip:'203.0.113.1'}),
      svc.authorizePrint({receipt,ip:'203.0.113.1'})
    ]);
    expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  });
  it('denies session expiration, late replay and expiry of receipt',async()=>{
    const clock={time:startTime,tokens:[token,receipt]};
    const svc=build(memoryRedis(),clock);
    await svc.start({action:'pdf',ip:'203.0.113.1'});
    clock.time+=301000;
    await expect(svc.progress({sessionToken:token,positionMs:0,playing:true,visible:true,ip:'203.0.113.1'}))
      .rejects.toMatchObject({code:'SESSION_EXPIRED'});
  });
  it('does not credit hidden or buffered gaps and refuses seeking',async()=>{
    const clock={time:startTime,tokens:[token,receipt]};
    const svc=build(memoryRedis(),clock);
    await svc.start({action:'print',ip:'203.0.113.1'});
    await svc.progress({sessionToken:token,positionMs:0,playing:true,visible:true,ip:'203.0.113.1'});
    clock.time+=1000;
    const hidden=await svc.progress({sessionToken:token,positionMs:1000,playing:true,visible:false,ip:'203.0.113.1'});
    expect(hidden.creditedMs).toBe(0);
    clock.time+=4000;
    const buffered=await svc.progress({sessionToken:token,positionMs:5000,playing:true,visible:true,ip:'203.0.113.1'});
    expect(buffered.creditedMs).toBe(0);
    clock.time+=1000;
    await expect(svc.progress({sessionToken:token,positionMs:14000,playing:true,visible:true,ip:'203.0.113.1'}))
      .rejects.toMatchObject({code:'INVALID_PLAYBACK'});
  });
  it('rejects invalid actions and malformed tokens',async()=>{
    const clock={time:startTime,tokens:[token,receipt]};
    const svc=build(memoryRedis(),clock);
    await expect(svc.start({action:'print',source:'malicious',ip:'203.0.113.1'}))
      .rejects.toMatchObject({code:'BAD_REQUEST'});
    await expect(svc.start({action:'pdf',source:'keyboard',ip:'203.0.113.1'}))
      .rejects.toMatchObject({code:'BAD_REQUEST'});
    await expect(svc.complete({sessionToken:'wrong',ended:true,ip:'203.0.113.1'}))
      .rejects.toMatchObject({code:'BAD_REQUEST'});
  });
  it('enforces rate limits per hashed IP',async()=>{
    const clock={time:startTime,tokens:[token,receipt]};
    const svc=build(memoryRedis(),clock);
    for(let i=0;i<12;i++){
      clock.tokens.unshift(String(i).padStart(43,'b'));
      await svc.start({action:'pdf',ip:'203.0.113.77'});
    }
    await expect(svc.start({action:'pdf',ip:'203.0.113.77'}))
      .rejects.toMatchObject({code:'TOO_MANY_REQUESTS'});
  });
  it('checks CSRF origin, content type, size and method on HTTPS',()=>{
    const headers={origin:'https://generatesuratku.vercel.app',
      host:'generatesuratku.vercel.app','x-forwarded-proto':'https',
      'sec-fetch-site':'same-origin','content-type':'application/json',
      'x-real-ip':'203.0.113.1'};
    expect(validateSponsorRequest({method:'POST',headers,body:{action:'print'}}))
      .toMatchObject({body:{action:'print'},ip:'203.0.113.1'});
    expect(()=>validateSponsorRequest({method:'GET',headers,body:{}}))
      .toThrowError(SponsorFault);
    expect(()=>validateSponsorRequest({method:'POST',headers:{...headers,origin:'https://evil.example'},body:{}}))
      .toThrowError(SponsorFault);
    expect(()=>validateSponsorRequest({method:'POST',headers:{...headers,'sec-fetch-site':'cross-site'},body:{}}))
      .toThrowError(SponsorFault);
    expect(()=>validateSponsorRequest({method:'POST',headers:{...headers,'content-type':'text/plain'},body:{}}))
      .toThrowError(SponsorFault);
    expect(()=>validateSponsorRequest({method:'POST',headers,body:{excess:'A'.repeat(2200)}}))
      .toThrowError(SponsorFault);
  });
  it('requires secure Upstash HTTPS and denies missing credentials',()=>{
    expect(()=>createUpstashCommand({})).toThrow();
    expect(()=>createUpstashCommand({UPSTASH_REDIS_REST_URL:'http://redis.example.com',UPSTASH_REDIS_REST_TOKEN:'x'})).toThrow();
    expect(sponsorIsReady({...env,SPONSOR_GATE_ENABLED:'false'},policy,registry,startTime)).toBe(false);
    expect(sponsorIsReady({...env,SPONSOR_IP_HASH_SECRET:'x'},policy,registry,startTime)).toBe(false);
  });
  it('does not let client-provided text or document details into sponsor request schema',()=>{
    // Any sponsor response exposes opaque tokens and campaign ID, never document contents.
    expect(activeSponsor(startTime,policy,registry).id).toBe('campaign-001');
    expect([PROGRESS_SCRIPT,COMPLETE_SCRIPT,CONSUME_SCRIPT].every(script=>script.includes('SPONSOR_'))).toBe(true);
    expect(RATE_SCRIPT).toContain('PEXPIRE');
  });
});
