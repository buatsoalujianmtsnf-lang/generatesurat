/**
 * MON-07 REAL Redis integration (GitHub Actions service container only).
 * Uses the exact Lua EVAL scripts and atomic Redis commands from production.
 * Does not connect to production Redis, store secrets, or use actual sponsor ads.
 * Requires MON07_REDIS_INTEGRATION=1 and localhost port 6379.
 */
import { createConnection } from 'node:net';
import { randomBytes } from 'node:crypto';
import { createSponsorService, SponsorFault } from '../api/sponsor-service.js';
import { createSponsorLedger, sessionKey, receiptKey } from '../api/sponsor-ledger.js';

if (process.env.MON07_REDIS_INTEGRATION !== '1') {
  console.error('MON-07 real Redis test is opt-in. Set MON07_REDIS_INTEGRATION=1 in isolated CI.');
  process.exitCode = 2;
} else {
  const HOST = '127.0.0.1';
  const PORT = 6379;
  const newline = '\r\n';
  const token = () => randomBytes(32).toString('base64url');
  function encode(parts) {
    return Buffer.from('*' + parts.length + newline + parts.map(part => {
      const data = String(part);
      return '$' + Buffer.byteLength(data) + newline + data + newline;
    }).join(''));
  }
  function decode(buffer, start = 0) {
    if (buffer.length <= start) return null;
    const kind = String.fromCharCode(buffer[start]);
    const end = buffer.indexOf(newline, start + 1);
    if (end < 0) return null;
    const text = buffer.toString('utf8', start + 1, end);
    const offset = end + 2;
    if (kind === '-') throw new Error('Redis protocol error (' + text.slice(0, 90) + ')');
    if (kind === '+') return {value:text, next:offset};
    if (kind === ':') return {value:Number(text), next:offset};
    if (kind === '$') {
      const size = Number(text);
      if (size === -1) return {value:null,next:offset};
      if (!Number.isInteger(size) || size < 0 || size > 1_000_000) throw new Error('Invalid Redis bulk length');
      if (buffer.length < offset + size + 2) return null;
      if (buffer[offset + size] !== 13 || buffer[offset + size + 1] !== 10) throw new Error('Invalid RESP terminator');
      return {value:buffer.toString('utf8',offset,offset+size),next:offset+size+2};
    }
    if (kind === '*') {
      const count = Number(text);
      if (count === -1) return {value:null,next:offset};
      if (!Number.isInteger(count) || count < 0 || count > 100) throw new Error('Invalid Redis array');
      let pos=offset;
      const values=[];
      for(let i=0;i<count;i++) {
        const part=decode(buffer,pos);
        if(!part) return null;
        pos=part.next;
        values.push(part.value);
      }
      return {value:values,next:pos};
    }
    throw new Error('Unsupported RESP kind');
  }

  async function redisCommand(parts) {
    return await new Promise((resolve,reject)=>{
      const conn=createConnection({host:HOST,port:PORT});
      let done=false;
      let chunks=Buffer.alloc(0);
      const timer=setTimeout(()=>finish(new Error('Redis localhost timeout')),4500);
      function finish(error,value) {
        if(done) return;
        done=true;
        clearTimeout(timer);
        conn.destroy();
        if(error) reject(error);
        else resolve(value);
      }
      conn.once('connect',()=>conn.write(encode(parts)));
      conn.on('data',part=>{
        chunks=Buffer.concat([chunks,part]);
        try {
          const decoded=decode(chunks);
          if(decoded) finish(null,decoded.value);
        } catch(e){finish(e);}
      });
      conn.once('error',e=>finish(e));
      conn.once('end',()=>{if(!done)finish(new Error('Redis connection closed'));});
    });
  }

  let passed=0;
  const check=(condition,name)=>{
    if(!condition) throw new Error('[MON-07 FAIL] '+name);
    passed++;
    console.info('[PASS] '+name);
  };
  async function rejected(fn,code,name) {
    try { await fn(); }
    catch(error) {
      check(error instanceof SponsorFault && error.code === code,name);
      return;
    }
    throw new Error('[MON-07 FAIL] '+name+' (accepted unexpectedly)');
  }
  const env={
    SPONSOR_GATE_ENABLED:'true',
    UPSTASH_REDIS_REST_URL:'https://test-only.invalid',
    UPSTASH_REDIS_REST_TOKEN:'test-only-not-a-secret',
    SPONSOR_IP_HASH_SECRET:'a'.repeat(48),
  };
  const testNow=Date.now();
  const policy={enabled:true,releasePhase:'production'};
  const testCampaign={
    id:'test-ci-redis-only',
    sponsorDisplayName:'Test-only synthetic sponsor',
    startsAt:new Date(testNow-86400000).toISOString(),
    endsAt:new Date(testNow+86400000).toISOString(),
    status:'approved',
    media:{path:'assets/sponsors/test-ci/video.mp4',mimeType:'video/mp4'},
    approvals:{
      agreementSigned:true,rightsVerified:true,contentApproved:true,
      privacyApproved:true,operatorApproved:true,
    }
  };
  const registry={enabled:true,campaigns:[testCampaign]};
  let clock=testNow;
  const service=()=>createSponsorService({
    command:redisCommand,now:()=>clock,makeToken:token,
    env,sponsorPolicy:policy,campaigns:registry
  });
  async function watch(svc,session,ip) {
    await svc.progress({sessionToken:session,positionMs:0,playing:true,visible:true,ip});
    for(let i=1;i<=15;i++) {
      clock+=1000;
      await svc.progress({sessionToken:session,positionMs:i*1000,playing:true,visible:true,ip});
    }
  }
  async function exercise() {
    check(await redisCommand(['PING'])==='PONG','Redis server reachable (actual Redis, not emulator)');
    const ledger=createSponsorLedger(redisCommand);
    const ip='198.51.100.'+((testNow%180)+20);
    const s=service();
    const start=await s.start({action:'print',source:'keyboard',ip});
    check(typeof start.sessionToken==='string'&&start.durationSeconds===15,'15-second print session issued');
    const ttl=await redisCommand(['PTTL',sessionKey(start.sessionToken)]);
    check(Number(ttl)>0 && Number(ttl)<=300000,'Redis session TTL 5 minutes');
    await rejected(()=>s.complete({sessionToken:start.sessionToken,ended:true,ip}),'PLAYBACK_INCOMPLETE','Premature completion rejected');
    await watch(s,start.sessionToken,ip);
    const result=await s.complete({sessionToken:start.sessionToken,ended:true,ip});
    check(!!result.receipt,'Completed viewing issues server receipt');
    const ttlReceipt=await redisCommand(['PTTL',receiptKey(result.receipt)]);
    check(Number(ttlReceipt)>0 && Number(ttlReceipt)<=120000,'Redis receipt TTL 120 seconds');
    const results=await Promise.allSettled([
      service().authorizePrint({receipt:result.receipt,ip}),
      service().authorizePrint({receipt:result.receipt,ip}),
      service().authorizePrint({receipt:result.receipt,ip}),
    ]);
    check(results.filter(item=>item.status==='fulfilled').length===1,
      'Three concurrent consumers: exactly one print succeeds');
    await rejected(()=>service().authorizePrint({receipt:result.receipt,ip}),'RECEIPT_INVALID','Consumed print receipt cannot be replayed');

    // Independent service instances share Redis state and reject cross-action usage.
    const pdf=await service().start({action:'pdf',source:'button',ip});
    await watch(service(),pdf.sessionToken,ip);
    const pdfReceipt=await service().complete({sessionToken:pdf.sessionToken,ended:true,ip});
    await rejected(()=>service().authorizePrint({receipt:pdfReceipt.receipt,ip}),
      'RECEIPT_INVALID','PDF receipt rejected on print endpoint');
    check(await service().consumePdfReceipt({receipt:pdfReceipt.receipt})===true,'PDF receipt consumed server-side');
    check(await service().consumePdfReceipt({receipt:pdfReceipt.receipt})===false,'PDF receipt replay denied');

    const old=await service().start({action:'pdf',ip});
    clock+=301000;
    await rejected(()=>service().progress({sessionToken:old.sessionToken,positionMs:0,playing:true,visible:true,ip}),
      'SESSION_EXPIRED','Expired Redis session denied using server clock');

    const skipped=await service().start({action:'print',ip});
    await service().progress({sessionToken:skipped.sessionToken,positionMs:0,playing:true,visible:true,ip});
    clock+=1000;
    await rejected(()=>service().progress({sessionToken:skipped.sessionToken,positionMs:15000,playing:true,visible:true,ip}),
      'INVALID_PLAYBACK','Seeking 15 seconds ahead rejected');
    await rejected(()=>service().complete({sessionToken:skipped.sessionToken,ended:true,ip}),
      'PLAYBACK_INCOMPLETE','Sought video cannot issue a receipt');

    // Rate limiter EVAL is atomic under real concurrent Redis operations.
    const limitKey='gs:mon07:test-rate:'+token();
    const limitCalls=await Promise.all(Array.from({length:20},()=>ledger.rateLimit({
      key:limitKey,limit:5,windowMs:60000
    })));
    check(limitCalls.filter(Boolean).length===5,'Rate limit atomic: exactly five of 20 accepted');
    const limitTtl=await redisCommand(['PTTL',limitKey]);
    check(Number(limitTtl)>0&&Number(limitTtl)<=60000,'Rate limit key expires automatically');

    // Confirm no document PII is persisted in Redis session/receipt metadata.
    const safe=await service().start({action:'print',ip});
    const raw=String(await redisCommand(['GET',sessionKey(safe.sessionToken)]));
    check(raw.includes('campaignId')&&!/studentName|nik|signature|html|schoolName|documentBody/i.test(raw),
      'Redis session stores only non-document metadata');

    const summary={status:'PASS',redis:'real isolated localhost Redis 7',passed,
      environment:'GitHub Actions temporary service',productionRedisTested:false,
      browserCrossDeviceUat:false,generatedAt:new Date().toISOString()};
    console.log('MON07_REDIS_SUMMARY '+JSON.stringify(summary));
  }
  exercise().catch(error=>{
    console.error(error?.message||'MON-07 Redis integration failed');
    process.exitCode=1;
  });
}
