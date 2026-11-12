import { describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { pdfSponsorRequired, verifyPdfSponsorReceipt } from '../api/sponsor-export-authorization.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url),'utf8');
const receipt = 'r'.repeat(43);
const flush = () => new Promise(resolve => setTimeout(resolve,8));
function harness({ required=false, video=null, online=true, fetchImpl }={}) {
  const events={};
  const document={ documentElement:{dataset:{sponsorGate:required?'required':'off'}},
    addEventListener:vi.fn((name,fn)=>{events[name]=fn;}) };
  const UI={toast:vi.fn()};
  const sponsor={request:vi.fn(async()=>video)};
  const fetch=fetchImpl||vi.fn(async()=>({ok:true,json:async()=>({authorized:true})}));
  const workflow={preparePrint:vi.fn()};
  const context={document,UI,SponsorVideoModal:sponsor,fetch,Workflow:workflow,
    navigator:{onLine:online},console,Promise};
  runInNewContext(read('js/sponsor-export-gate.js'),context);
  const gate=runInNewContext('SponsorExportGate',context);
  return {gate,document,UI,sponsor,fetch,workflow,events};
}
describe('MON-05 export gate UX',()=>{
  it('keeps legacy exports working when mode off, including no ad requests',async()=>{
    const h=harness(),cb=vi.fn();
    expect(h.gate.run({action:'print'},cb)).toBe(true);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0]).toBeNull();
    expect(h.sponsor.request).not.toHaveBeenCalled();
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it('requires a fresh video and print-receipt consumption for each print action',async()=>{
    const h=harness({required:true,video:{action:'print',receipt,expiresAt:Date.now()+60000}});
    const cb=vi.fn();
    expect(h.gate.run({action:'print'},cb)).toBe(true);
    await flush();
    expect(cb).toHaveBeenCalledOnce();
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.fetch.mock.calls[0][0]).toBe('/api/sponsor-print-authorize');
    expect(h.gate.run({action:'print'},cb)).toBe(true);
    await flush();
    expect(h.sponsor.request).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenCalledTimes(2);
  });
  it('carries PDF receipt to export function without print authorization',async()=>{
    const h=harness({required:true,video:{action:'pdf',receipt,expiresAt:Date.now()+60000}}),cb=vi.fn();
    expect(h.gate.run({action:'pdf'},cb)).toBe(true);
    await flush();
    expect(cb.mock.calls[0][0].receipt).toBe(receipt);
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it('handles cancel, mismatch, expired, denied receipt, and offline as fail-closed',async()=>{
    const cb=vi.fn();
    const cancelled=harness({required:true,video:null});
    cancelled.gate.run({action:'print'},cb);await flush();
    const mismatch=harness({required:true,video:{action:'pdf',receipt,expiresAt:Date.now()+60000}});
    mismatch.gate.run({action:'print'},cb);await flush();
    const expired=harness({required:true,video:{action:'pdf',receipt,expiresAt:Date.now()-5}});
    expired.gate.run({action:'pdf'},cb);await flush();
    const denied=harness({required:true,video:{action:'print',receipt,expiresAt:Date.now()+60000},
      fetchImpl:vi.fn(async()=>({ok:false,json:async()=>({error:'REPLAY'})}))});
    denied.gate.run({action:'print'},cb);await flush();
    const offline=harness({required:true,online:false});
    expect(offline.gate.run({action:'print'},cb)).toBe(false);
    expect(cb).not.toHaveBeenCalled();
  });
  it('disallows double clicks during video and resets after the first action',async()=>{
    let resolveVideo;
    const h=harness({required:true}),cb=vi.fn();
    h.sponsor.request.mockImplementation(()=>new Promise(resolve=>{resolveVideo=resolve;}));
    expect(h.gate.run({action:'pdf'},cb)).toBe(true);
    expect(h.gate.run({action:'pdf'},cb)).toBe(false);
    resolveVideo({action:'pdf',receipt,expiresAt:Date.now()+60000});
    await flush();
    expect(cb).toHaveBeenCalledOnce();
    expect(h.gate.isPending()).toBe(false);
  });
  it('handles Ctrl+P and Cmd+P in required mode while excluding repeat/Shift',()=>{
    const h=harness({required:true});
    h.gate.init();h.gate.init();
    expect(h.document.addEventListener).toHaveBeenCalledTimes(1);
    const evt=o=>({ctrlKey:true,metaKey:false,key:'p',altKey:false,shiftKey:false,
      defaultPrevented:false,repeat:false,preventDefault:vi.fn(),...o});
    let e=evt({});h.events.keydown(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(h.workflow.preparePrint).toHaveBeenCalledWith('keyboard');
    e=evt({ctrlKey:false,metaKey:true,key:'P'});h.events.keydown(e);
    expect(h.workflow.preparePrint).toHaveBeenCalledTimes(2);
    e=evt({repeat:true});h.events.keydown(e);
    expect(h.workflow.preparePrint).toHaveBeenCalledTimes(2);
    e=evt({shiftKey:true});h.events.keydown(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    const off=harness();off.gate.onKeyboard(evt({}));
    expect(off.workflow.preparePrint).not.toHaveBeenCalled();
  });
});
describe('MON-05 server receipt security',()=>{
  it('bypasses Redis only when disabled',async()=>{
    const ready=vi.fn(),getService=vi.fn();
    expect(pdfSponsorRequired({})).toBe(false);
    expect(await verifyPdfSponsorReceipt(null,{env:{},ready,getService})).toEqual({ok:true,status:200});
    expect(ready).not.toHaveBeenCalled();expect(getService).not.toHaveBeenCalled();
  });
  it('permits PDF when the deployment has no active sponsor video despite a stale env gate',async()=>{
    const env={SPONSOR_GATE_ENABLED:'true'};
    const ready=vi.fn(),getService=vi.fn(),hasActiveVideo=vi.fn(()=>false);
    // The checked-in policy/registry are prelaunch with no sponsored video.
    expect(pdfSponsorRequired(env)).toBe(false);
    expect(pdfSponsorRequired(env,()=>true)).toBe(true);
    expect(await verifyPdfSponsorReceipt(null,{env,ready,getService,hasActiveVideo}))
      .toEqual({ok:true,status:200});
    expect(hasActiveVideo).toHaveBeenCalledOnce();
    expect(ready).not.toHaveBeenCalled();
    expect(getService).not.toHaveBeenCalled();
  });
  it('rejects missing or forged receipts when server flag on',async()=>{
    const ready=vi.fn();
    for(const value of [null, 'short', 99, 'z'.repeat(1000)]){
      const r=await verifyPdfSponsorReceipt(value,{env:{SPONSOR_GATE_ENABLED:'true'},hasActiveVideo:()=>true,ready});
      expect(r.ok).toBe(false);expect(r.status).toBe(403);
    }
    expect(ready).not.toHaveBeenCalled();
  });
  it('fails closed with unconfigured Redis and on server exceptions',async()=>{
    const env={SPONSOR_GATE_ENABLED:'true'};
    expect(await verifyPdfSponsorReceipt(receipt,{env,hasActiveVideo:()=>true,ready:()=>false})).toMatchObject({ok:false,status:503});
    const spy=vi.spyOn(console,'error').mockImplementation(()=>{});
    const r=await verifyPdfSponsorReceipt(receipt,{env,hasActiveVideo:()=>true,ready:()=>true,
      getService:()=>({consumePdfReceipt:async()=>{throw new Error('secret');}})});
    expect(r).toMatchObject({ok:false,status:503});
    expect(r.error).not.toContain('secret');spy.mockRestore();
  });
  it('consumes a PDF receipt once and denies replay',async()=>{
    const consume=vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const options={env:{SPONSOR_GATE_ENABLED:'true'},hasActiveVideo:()=>true,ready:()=>true,
      getService:()=>({consumePdfReceipt:consume})};
    expect(await verifyPdfSponsorReceipt(receipt,options)).toMatchObject({ok:true,status:200});
    expect(await verifyPdfSponsorReceipt(receipt,options)).toMatchObject({ok:false,status:403});
    expect(consume).toHaveBeenCalledTimes(2);
  });
  it('keeps receipt out of PDF body and consumes before Chromium rendering',()=>{
    const pdf=read('api/export-pdf.js'),js=read('js/pdf-export.js'),wf=read('js/workflow.js');
    expect(pdf).toContain("verifyPdfSponsorReceipt(req.headers['x-sponsor-receipt'])");
    expect(pdf.indexOf("verifyPdfSponsorReceipt(req.headers['x-sponsor-receipt'])"))
      .toBeLessThan(pdf.indexOf('activeRenders += 1;'));
    expect(js).toContain("'X-Sponsor-Receipt': sponsorReceipt");
    expect(wf).toContain("IzinDeclaration.request('print', proceed)");
    expect(wf).toContain("IzinDeclaration.request('pdf', proceed)");
    expect(wf).toContain('_collectPrintChecks()');
    expect(read('index.html')).toContain('data-sponsor-gate="off"');
    expect(read('css/print.css')).toContain('[data-sponsor-gate="required"]:not([data-sponsor-print-authorized="true"])');
    expect(read('js/print.js')).toContain('sponsorAuthorized !== true');
  });
});
