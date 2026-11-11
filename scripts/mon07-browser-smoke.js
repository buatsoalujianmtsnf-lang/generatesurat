/**
 * MON-07 smoke UAT in real headless Chromium (not a physical device UAT).
 * Loads the actual editor from a same-origin static server, never production.
 * Sponsor remains OFF; the disabled backend responds 503 for modal smoke.
 * Screenshots are of an empty test editor without school or student data.
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'artifacts/mon07-browser');
const mime={
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.woff':'font/woff',
  '.woff2':'font/woff2',
  '.webmanifest':'application/manifest+json',
};
let failure=null;
function assert(condition,description){
  if(!condition) throw new Error('[MON-07 browser] '+description);
}
const requests=[];
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url||'/', 'http://127.0.0.1').pathname;
    if(path.startsWith('/api/')){
      requests.push({type:'sponsor',method:req.method,path});
      res.writeHead(503,{
        'Content-Type':'application/json',
        'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff',
        'Access-Control-Allow-Origin':'null', // no access: default browser CORS still rejects origin
      });
      res.end(JSON.stringify({error:'SPONSOR_UNAVAILABLE'}));
      return;
    }
    const route=(path==='/'||path==='/editor')?'/index.html':path;
    const decoded=decodeURIComponent(route);
    if(decoded.includes('\0')||decoded.includes('\\')||decoded.includes('..')) {
      res.writeHead(403);res.end();return;
    }
    const full=resolve(root,'.'+decoded);
    if(full!==root&&!full.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    try{
      const data=await readFile(full);
      res.writeHead(200,{'Content-Type':mime[extname(full)]||'application/octet-stream',
        'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      res.end(data);
    }catch{
      res.writeHead(404,{'Content-Type':'text/plain'});
      res.end('Not found');
    }
  }catch{
    res.writeHead(400);res.end();
  }
});
const startServer=()=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const closeServer=()=>new Promise(resolve=>server.close(resolve));
const viewports=[
  {name:'desktop',width:1440,height:900,isMobile:false},
  {name:'mobile-portrait',width:390,height:844,isMobile:true},
  {name:'mobile-landscape',width:844,height:390,isMobile:true},
];
let browserInstance;
const results=[];
try{
  await mkdir(output,{recursive:true});
  await startServer();
  const origin='http://127.0.0.1:'+server.address().port;
  const executablePath=await chromium.executablePath();
  browserInstance=await puppeteer.launch({
    executablePath,headless:true,args:chromium.args,
    timeout:30000,
  });
  for(const device of viewports){
    const page=await browserInstance.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e.message||e).slice(0,200)));
    await page.setViewport({
      width:device.width,height:device.height,
      isMobile:device.isMobile,deviceScaleFactor:1,
      hasTouch:device.isMobile,
    });
    await page.setRequestInterception(true);
    page.on('request',req=>{
      const url=new URL(req.url());
      if(url.origin!==origin){void req.abort();return;}
      void req.continue();
    });
    await page.goto(origin+'/editor',{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>typeof SponsorVideoModal!=='undefined'
      && typeof SponsorExportGate!=='undefined',{timeout:15000});
    const snapshot=await page.evaluate(()=>{
      const modal=document.getElementById('sponsor-video-modal');
      const before={
        sponsorGate:document.documentElement.dataset.sponsorGate,
        modalExists:!!modal,
        nativeDialog:typeof modal?.showModal==='function',
        state:SponsorVideoModal.getState(),
        hasAria:!!modal?.getAttribute('aria-labelledby')&&!!modal?.getAttribute('aria-describedby'),
        adSenseScripts:[...document.scripts].filter(s=>/adsbygoogle|googlesyndication/.test(s.src)).length,
        width:document.documentElement.scrollWidth,
        viewportWidth:window.innerWidth,
      };
      modal.showModal();
      const rect=modal.getBoundingClientRect();
      const visible={width:Math.ceil(rect.width),height:Math.ceil(rect.height),
        withinViewport:rect.width<=window.innerWidth+2 && rect.height<=window.innerHeight+2};
      modal.close();
      return {...before,visible};
    });
    assert(snapshot.sponsorGate==='off',device.name+': sponsor must be OFF');
    assert(snapshot.modalExists&&snapshot.nativeDialog&&snapshot.hasAria,device.name+': dialog missing semantics');
    assert(snapshot.state==='idle',device.name+': modal not idle');
    assert(snapshot.adSenseScripts===0,device.name+': AdSense loaded inside editor');
    assert(snapshot.visible.withinViewport,device.name+': modal exceeds viewport');
    assert(snapshot.width<=snapshot.viewportWidth+20,device.name+': editor has major horizontal overflow');

    // User interaction with the unused modal: service returns 503 because no
    // sponsor is approved. The UI must report failure, never issue a receipt.
    const beforeCalls=requests.length;
    await page.evaluate(()=>{
      window.__mon07Pending='pending';
      SponsorVideoModal.request({action:'print',source:'button'})
        .then(value=>{ window.__mon07Pending=value; });
    });
    await page.waitForFunction(()=>{
      const dialog=document.getElementById('sponsor-video-modal');
      return dialog?.dataset.state==='error';
    },{timeout:12000});
    const errorSnapshot=await page.evaluate(()=>({
      state:document.getElementById('sponsor-video-modal').dataset.state,
      status:document.getElementById('sponsor-status').textContent,
      receiptVisible:document.body.textContent.includes('receipt:'),
    }));
    assert(requests.length>beforeCalls,device.name+': sponsor API not contacted for manual modal test');
    assert(errorSnapshot.state==='error',device.name+': invalid state on 503');
    assert(!errorSnapshot.receiptVisible,device.name+': receipt leaked to UI');
    await page.evaluate(()=>SponsorVideoModal.cancel());
    await page.waitForFunction(()=>window.__mon07Pending===null,{timeout:5000});
    assert(errors.length===0,device.name+': uncaught page errors: '+errors.join('; '));
    await page.screenshot({path:resolve(output,device.name+'.png'),fullPage:false});
    results.push({device:device.name,viewport:device.width+'x'+device.height,
      status:'PASS',sponsorRequired:false,modalFits:true,
      failClosedOn503:true,privacyNoAdSense:true,
      horizontalOverflowPx:Math.max(0,snapshot.width-snapshot.viewportWidth),
      pageErrors:errors});
    await page.close();
    console.info('[MON-07 browser PASS]',device.name,
      'viewport',device.width+'x'+device.height);
  }
}catch(e){
  failure=String(e?.message||e);
  console.error('[MON-07 browser FAIL]',failure);
}finally{
  try {await browserInstance?.close();}catch{}
  try {await closeServer();}catch{}
  await mkdir(output,{recursive:true});
  await writeFile(resolve(output,'summary.json'),JSON.stringify({
    status:failure?'FAILED':'PASS',headlessChromium:true,
    genuinePhoneTabletUat:false,realSponsorVideo:false,
    productionEnvironment:false,tests:results,error:failure,
    generatedAt:new Date().toISOString()
  },null,2));
  if(failure)process.exitCode=1;
}
