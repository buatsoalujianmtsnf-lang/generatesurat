/* MON-04: isolated first-party sponsor modal. Not wired into Print/PDF until MON-05. */
/* global SponsorVideoState */
const SponsorVideoModal = (() => {
  const API = Object.freeze({start:'/api/sponsor-start',progress:'/api/sponsor-progress',complete:'/api/sponsor-complete'});
  const VIDEO = /^\/assets\/sponsors\/[a-z0-9][a-z0-9/-]*\.(mp4|webm)$/;
  const VTT = /^\/assets\/sponsors\/[a-z0-9][a-z0-9/-]*\.vtt$/;
  const TOKEN = /^[a-zA-Z0-9_-]{40,90}$/;
  const DURATION = 15;
  let current = null, nodes = null, initialized = false;

  function elements() {
    if (nodes) return nodes;
    const dialog = /** @type {HTMLDialogElement|null} */(document.getElementById('sponsor-video-modal'));
    if (!dialog || typeof dialog.showModal !== 'function') return null;
    const byId = id => dialog.querySelector('#'+id);
    nodes = {
      dialog, video: /** @type {HTMLVideoElement} */(byId('sponsor-video')),
      sponsor: byId('sponsor-advertiser'), action: byId('sponsor-action'),
      status: byId('sponsor-status'), count: byId('sponsor-count'),
      meter: /** @type {HTMLProgressElement} */(byId('sponsor-meter')),
      play: /** @type {HTMLButtonElement} */(byId('sponsor-play')),
      mute: /** @type {HTMLButtonElement} */(byId('sponsor-mute')),
      cancel: /** @type {HTMLButtonElement} */(byId('sponsor-cancel')),
      retry: /** @type {HTMLButtonElement} */(byId('sponsor-retry')),
      caption: byId('sponsor-caption'),
    };
    if (Object.values(nodes).some(value => !value)) { nodes = null; return null; }
    return nodes;
  }
  function live(ctx, attempt = ctx.attempt) {
    return current === ctx && ctx.attempt === attempt && !ctx.abort.signal.aborted;
  }
  function setState(ctx,event) {
    if (!live(ctx)) return;
    ctx.state = SponsorVideoState.transition(ctx.state,event);
    render(ctx);
  }
  function message(error) {
    const messages = {
      SPONSOR_UNAVAILABLE:'Iklan sponsor belum tersedia. Tindakan ini belum dapat dilanjutkan.',
      SESSION_EXPIRED:'Sesi iklan kedaluwarsa. Mulai ulang untuk mencoba lagi.',
      PLAYBACK_INCOMPLETE:'Pemutaran belum dapat diverifikasi. Mulai lagi dan tonton sampai selesai.',
      INVALID_PLAYBACK:'Posisi atau kecepatan pemutaran tidak valid. Mulai ulang penayangan.',
      TOO_MANY_REQUESTS:'Terlalu banyak permintaan. Silakan coba kembali kemudian.',
      NETWORK_ERROR:'Koneksi ke layanan iklan gagal. Periksa internet lalu coba lagi.',
      MEDIA_STALLED:'Video tidak dapat dimuat atau macet terlalu lama. Periksa koneksi atau pemblokir konten, lalu coba lagi.',
    };
    return messages[error] || 'Iklan belum dapat diverifikasi. Silakan coba kembali atau batalkan.';
  }
  function render(ctx) {
    if (!live(ctx)) return;
    const e = elements();
    if (!e) return;
    const text = {
      starting:'Menghubungkan ke layanan sponsor…',
      ready:'Video siap. Tekan Putar untuk memulai.',
      playing:'Video sponsor sedang diputar. Biarkan tab tetap aktif.',
      paused:'Pemutaran dijeda. Tekan Lanjutkan untuk meneruskan.',
      verifying:'Memeriksa penyelesaian penayangan di server…',
      authorized:'Penayangan berhasil diverifikasi.',
      error:ctx.problem || 'Terjadi kesalahan.',
    };
    e.dialog.dataset.state = ctx.state;
    e.sponsor.textContent = ctx.sponsorName || 'Sponsor';
    e.action.textContent = ctx.action==='pdf' ? 'mengunduh PDF' : 'mencetak surat';
    e.status.textContent = text[ctx.state] || '';
    e.play.hidden = !['ready','playing','paused'].includes(ctx.state);
    e.play.textContent = ctx.state==='playing'?'Jeda':ctx.state==='paused'?'Lanjutkan':'Putar video';
    e.play.disabled = ctx.state==='ready' && !ctx.mediaReady;
    e.retry.hidden = ctx.state!=='error';
    e.mute.disabled = !ctx.mediaReady || !['ready','playing','paused'].includes(ctx.state);
    e.mute.textContent = e.video.muted ? 'Aktifkan suara' : 'Bisukan';
    e.caption.textContent = ctx.hasCaptions
      ? 'Takarir bahasa Indonesia tersedia.' : 'Materi ini tidak memiliki takarir yang dilampirkan.';
    const position = Math.max(0,Math.min(DURATION,Number(e.video.currentTime)||0));
    e.meter.value = position;
    e.count.textContent = 'Sisa video ' + Math.max(0,Math.ceil(DURATION-position)) + ' detik';
    // Countdown is informational; only server result may authorize an export.
  }
  function stopTimer(ctx) {
    if (ctx.interval !== null) { clearInterval(ctx.interval); ctx.interval=null; }
    if (ctx.stallTimer !== null) { clearTimeout(ctx.stallTimer); ctx.stallTimer=null; }
    if (ctx.mediaLoadTimer !== null) { clearTimeout(ctx.mediaLoadTimer); ctx.mediaLoadTimer=null; }
  }
  function armStallTimer(ctx) {
    if (!live(ctx) || ctx.stallTimer !== null) return;
    ctx.stallTimer=setTimeout(() => {
      ctx.stallTimer=null;
      if (live(ctx) && ctx.state==='playing') fail(ctx,'MEDIA_STALLED');
    },12000);
  }
  function clearMedia() {
    const e = elements();
    if (!e) return;
    e.video.pause();
    e.video.removeAttribute('src');
    for (const item of Array.from(e.video.querySelectorAll('track'))) item.remove();
    e.video.load();
  }
  function finish(ctx,value) {
    if (current !== ctx) return;
    current=null;
    stopTimer(ctx);
    ctx.abort.abort();
    clearMedia();
    const e=elements();
    if (e?.dialog.open) e.dialog.close();
    if (ctx.returnFocus && document.contains(ctx.returnFocus)) ctx.returnFocus.focus();
    ctx.sessionToken=null;
    ctx.resolve(value);
  }
  function fail(ctx,code) {
    if (!live(ctx) || ['error','authorized','cancelled'].includes(ctx.state)) return;
    stopTimer(ctx);
    elements()?.video.pause();
    ctx.problem=message(code);
    setState(ctx,'FAIL');
  }
  async function post(ctx,endpoint,payload,attempt=ctx.attempt) {
    if (!live(ctx,attempt)) throw new Error('CANCELLED');
    const controller=new AbortController();
    const onAbort=()=>controller.abort();
    ctx.abort.signal.addEventListener('abort',onAbort,{once:true});
    const timeout=setTimeout(onAbort,8000);
    try {
      const response=await fetch(endpoint,{
        method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        signal:controller.signal,body:JSON.stringify(payload),
      });
      let json;
      try { json=await response.json(); } catch { throw new Error('NETWORK_ERROR'); }
      if(!live(ctx,attempt))throw new Error('CANCELLED');
      if(!response.ok)throw new Error(typeof json?.error==='string'?json.error:'NETWORK_ERROR');
      return json;
    } catch(error) {
      if(!live(ctx,attempt))throw new Error('CANCELLED');
      throw new Error(controller.signal.aborted?'NETWORK_ERROR':(error?.message||'NETWORK_ERROR'));
    } finally {
      clearTimeout(timeout);
      ctx.abort.signal.removeEventListener('abort',onAbort);
    }
  }
  async function begin(ctx) {
    const attempt=ctx.attempt;
    try {
      const result=await post(ctx,API.start,{action:ctx.action,source:ctx.source},attempt);
      if(!TOKEN.test(result?.sessionToken||'') || !VIDEO.test(result?.mediaPath||'')
        || result.durationSeconds!==DURATION || !Number.isFinite(result.expiresAt)
        || !['video/mp4','video/webm'].includes(result.mediaType))throw new Error('BAD_SESSION');
      if ((result.mediaType==='video/mp4' && !result.mediaPath.endsWith('.mp4'))
        || (result.mediaType==='video/webm' && !result.mediaPath.endsWith('.webm'))
        || (result.captionsPath && !VTT.test(result.captionsPath)))throw new Error('BAD_SESSION');
      if(!live(ctx,attempt))return;
      const e=elements();
      ctx.sessionToken=result.sessionToken;
      ctx.sponsorName=typeof result.sponsorName==='string' ? result.sponsorName.slice(0,120):'Sponsor';
      ctx.hasCaptions=!!result.captionsPath;
      e.video.muted=true;
      e.video.playbackRate=1;
      if(result.captionsPath){
        const t=document.createElement('track');
        t.kind='captions';t.srclang='id';t.label='Bahasa Indonesia';t.src=result.captionsPath;t.default=true;
        e.video.appendChild(t);
      }
      e.video.src=result.mediaPath;
      e.video.load();
      setState(ctx,'READY');
      ctx.mediaLoadTimer=setTimeout(() => {
        ctx.mediaLoadTimer=null;
        if(live(ctx,attempt) && ctx.state==='ready' && !ctx.mediaReady) fail(ctx,'MEDIA_STALLED');
      },12000);
    } catch(error){if(live(ctx,attempt))fail(ctx,error?.message||'NETWORK_ERROR');}
  }
  async function heartbeat(ctx,ended=false) {
    const attempt=ctx.attempt;
    if(!live(ctx,attempt)||!ctx.sessionToken)return;
    // Serialize all Redis progress calls; never deliver two out of order.
    if(ctx.pending) {
      try {await ctx.pending;}catch{/* handled in originating call */}
    }
    if(!live(ctx,attempt)||ctx.state==='error')return;
    const e=elements(),v=e.video;
    const request=post(ctx,API.progress,{
      sessionToken:ctx.sessionToken,
      positionMs:Math.min(15300,Math.max(0,Math.round((v.currentTime||0)*1000))),
      playing:ended || (!v.paused && ctx.state==='playing'),
      visible:document.visibilityState==='visible',
    },attempt);
    ctx.pending=request;
    try {
      const answer=await request;
      if(!Number.isFinite(answer?.creditedMs) || answer.creditedMs<0 || answer.creditedMs>15000)
        throw new Error('NETWORK_ERROR');
    }catch(error){
      if(live(ctx,attempt))fail(ctx,error?.message||'NETWORK_ERROR');
      throw error;
    }finally{if(ctx.pending===request)ctx.pending=null;}
  }
  async function ended(ctx) {
    if (!live(ctx) || !['playing','paused'].includes(ctx.state)
      || document.visibilityState!=='visible' || !elements().video.ended) return;
    setState(ctx,'ENDED');
    stopTimer(ctx);
    const attempt=ctx.attempt;
    try{
      await heartbeat(ctx,true);
      if(!live(ctx,attempt)||ctx.state!=='verifying')return;
      const result=await post(ctx,API.complete,{sessionToken:ctx.sessionToken,ended:true},attempt);
      if(!TOKEN.test(result?.receipt||'') || !Number.isFinite(result.expiresAt))
        throw new Error('NETWORK_ERROR');
      setState(ctx,'AUTHORIZED');
      finish(ctx,{action:ctx.action,receipt:result.receipt,expiresAt:result.expiresAt});
    }catch(error){if(live(ctx,attempt))fail(ctx,error?.message||'NETWORK_ERROR');}
  }
  function cancel() {
    const ctx=current;
    if(!ctx)return;
    if(!['authorized','cancelled'].includes(ctx.state))setState(ctx,'CANCEL');
    finish(ctx,null);
  }
  function retry() {
    const ctx=current;
    if(!ctx||ctx.state!=='error')return;
    stopTimer(ctx);
    ctx.abort.abort();
    ctx.abort=new AbortController();
    ctx.attempt++;
    ctx.pending=null;ctx.sessionToken=null;ctx.mediaReady=false;ctx.hasCaptions=false;ctx.problem='';
    ctx.sponsorName='';
    clearMedia();
    setState(ctx,'RETRY');
    void begin(ctx);
  }
  function attachOnce() {
    if(initialized)return !!elements();
    const e=elements();
    if(!e)return false;
    initialized=true;
    e.dialog.addEventListener('cancel',ev=>{ev.preventDefault();cancel();});
    e.dialog.addEventListener('click',ev=>{if(ev.target===e.dialog)cancel();});
    e.cancel.addEventListener('click',cancel);
    e.retry.addEventListener('click',retry);
    e.play.addEventListener('click',()=>{
      const ctx=current;
      if(!ctx)return;
      if(ctx.state==='playing'){e.video.pause();return;}
      if(!['ready','paused'].includes(ctx.state)||!ctx.mediaReady)return;
      e.video.play().catch(()=>{if(live(ctx))e.status.textContent='Pemutaran diblokir browser. Tekan Putar lagi.';});
    });
    e.mute.addEventListener('click',()=>{if(current?.mediaReady){e.video.muted=!e.video.muted;render(current);}});
    e.video.addEventListener('loadedmetadata',()=>{
      const ctx=current;
      if(!ctx || ctx.state!=='ready')return;
      if(!Number.isFinite(e.video.duration)||Math.abs(e.video.duration-DURATION)>0.6){
        fail(ctx,'INVALID_PLAYBACK');return;
      }
      if(ctx.mediaLoadTimer!==null){clearTimeout(ctx.mediaLoadTimer);ctx.mediaLoadTimer=null;}
      ctx.mediaReady=true;render(ctx);
    });
    e.video.addEventListener('error',()=>{if(current&&current.state!=='starting')fail(current,'NETWORK_ERROR');});
    e.video.addEventListener('play',()=>{
      const ctx=current;
      if(!ctx||!['ready','paused'].includes(ctx.state))return;
      setState(ctx,'PLAY');
      if(ctx.interval===null)ctx.interval=setInterval(()=>{
        if(live(ctx)&&['playing','paused'].includes(ctx.state)){
          void heartbeat(ctx).catch(()=>{});
          render(ctx);
        }
      },1000);
      void heartbeat(ctx).catch(()=>{});
    });
    e.video.addEventListener('pause',()=>{
      const ctx=current;
      if(!ctx||ctx.state!=='playing'||e.video.ended)return;
      setState(ctx,'PAUSE');
      void heartbeat(ctx).catch(()=>{});
    });
    e.video.addEventListener('waiting',()=>{
      const ctx=current;
      if(ctx && ctx.state==='playing'){
        e.status.textContent='Video sedang memuat… Pemutaran yang terhenti tidak dihitung.';
        armStallTimer(ctx);
      }
    });
    e.video.addEventListener('playing',()=>{
      const ctx=current;
      if(ctx && ctx.stallTimer!==null){clearTimeout(ctx.stallTimer);ctx.stallTimer=null;render(ctx);}
    });
    e.video.addEventListener('timeupdate',()=>{if(current)render(current);});
    e.video.addEventListener('ended',()=>{if(current)void ended(current);});
    e.video.addEventListener('seeking',()=>{
      if(current&&['playing','paused'].includes(current.state)&&e.video.currentTime>0.3)
        fail(current,'INVALID_PLAYBACK');
    });
    e.video.addEventListener('ratechange',()=>{
      if(current&&['ready','playing','paused'].includes(current.state)
        && e.video.playbackRate!==1){
        e.video.playbackRate=1;fail(current,'INVALID_PLAYBACK');
      }
    });
    document.addEventListener('visibilitychange',()=>{
      if(current&&document.visibilityState!=='visible'&&current.state==='playing')e.video.pause();
    });
    window.addEventListener('offline',()=>{if(current&&!['error','authorized','cancelled'].includes(current.state))fail(current,'NETWORK_ERROR');});
    return true;
  }
  /**
   * Resolves null on cancel/busy/unsupported browser, otherwise returns
   * { action, receipt, expiresAt } issued by the server. MON-05 must consume it.
   */
  /** @param {{ action?: 'print' | 'pdf', source?: 'button' | 'keyboard' }} [options] */
  function request({action,source='button'}={}) {
    if(!['print','pdf'].includes(action)||!['button','keyboard'].includes(source)
      ||(action==='pdf'&&source==='keyboard')||current||!attachOnce())return Promise.resolve(null);
    const e=elements();
    if(e.dialog.open)return Promise.resolve(null);
    return new Promise(resolve=>{
      const ctx={
        action,source,resolve,returnFocus:document.activeElement,
        state:'idle',attempt:1,abort:new AbortController(),interval:null,pending:null,
        stallTimer:null,mediaLoadTimer:null,
        sessionToken:null,mediaReady:false,hasCaptions:false,sponsorName:'',problem:'',
      };
      current=ctx;
      try{
        e.video.muted=true;
        setState(ctx,'BEGIN');
        e.dialog.showModal();
        e.cancel.focus();
        void begin(ctx);
      }catch{finish(ctx,null);}
    });
  }
  return Object.freeze({request,cancel,getState:()=>current?.state||'idle'});
})();
