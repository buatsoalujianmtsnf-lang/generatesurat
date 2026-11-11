/* MON-03: common API ingress, anti-CSRF/origin/abuse and fail-closed errors. */
import { getClientIp, getEffectiveRequestOrigin, getRequestOrigin, isOriginAllowed }
  from './export-pdf-security.js';
import { liveSponsorService, SponsorFault, sponsorIsReady } from './sponsor-service.js';
import { recordMon09Outcome } from './mon09-metrics.js';

const OPERATIONS = new Set(['start','progress','complete','authorizePrint']);
const REQUEST_LIMIT = 2048;
const ALLOWED_FIELDS = Object.freeze({
  start:['action','source'],
  progress:['sessionToken','positionMs','playing','visible'],
  complete:['sessionToken','ended'],
  authorizePrint:['receipt'],
});

export function validateSponsorRequest(req, env = process.env, operation = null) {
  const headers = req.headers || {};
  if (req.method !== 'POST') throw new SponsorFault('METHOD_NOT_ALLOWED',405);
  if (String(headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') {
    throw new SponsorFault('FORBIDDEN_ORIGIN',403);
  }
  const origin = getEffectiveRequestOrigin(headers);
  const hostOrigin = getRequestOrigin(headers);
  if (!isOriginAllowed(origin,env,hostOrigin) || !hostOrigin || origin !== hostOrigin) {
    throw new SponsorFault('FORBIDDEN_ORIGIN',403);
  }
  if (!String(headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    throw new SponsorFault('BAD_CONTENT_TYPE',415);
  }
  const size = String(headers['content-length'] || '');
  if (size && (!/^\d+$/.test(size) || Number(size) > REQUEST_LIMIT)) {
    throw new SponsorFault('BODY_TOO_LARGE',413);
  }
  let body=req.body;
  if (typeof body === 'string') {
    try { body=JSON.parse(body); } catch { throw new SponsorFault('BAD_REQUEST',400); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Buffer.byteLength(JSON.stringify(body),'utf8') > REQUEST_LIMIT) {
    throw new SponsorFault('BAD_REQUEST',400);
  }
  if (operation && (!ALLOWED_FIELDS[operation]
    || Object.keys(body).some(key => !ALLOWED_FIELDS[operation].includes(key)))) {
    throw new SponsorFault('BAD_REQUEST',400);
  }
  const ip=getClientIp(headers,req.socket?.remoteAddress || '');
  if (!ip) throw new SponsorFault('SPONSOR_UNAVAILABLE',503);
  return {body,ip};
}
export function sponsorEndpoint(operation) {
  if (!OPERATIONS.has(operation)) throw new Error('unknown sponsor operation');
  return async (req,res) => {
    const startedAt=Date.now();
    const route=operation==='authorizePrint' ? 'sponsor-print' : 'sponsor-'+operation;
    const respond=async(status,payload)=>{
      await recordMon09Outcome({route,status,durationMs:Date.now()-startedAt});
      return res.status(status).json(payload);
    };
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('X-Robots-Tag','noindex, nofollow');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Vary','Origin');
    res.setHeader('Pragma','no-cache');
    try {
      // A disabled ad gate must not even contact Redis or accept sponsor receipts.
      if (!sponsorIsReady(process.env)) throw new SponsorFault('SPONSOR_UNAVAILABLE',503);
      const {body,ip}=validateSponsorRequest(req,process.env,operation);
      const svc=liveSponsorService();
      let output;
      if (operation === 'start') output=await svc.start({action:body.action,source:body.source,ip});
      else if (operation === 'progress') output=await svc.progress({...body,ip});
      else if (operation === 'complete') output=await svc.complete({...body,ip});
      else output=await svc.authorizePrint({receipt:body.receipt,ip});
      return await respond(200,output);
    } catch(error) {
      if (error instanceof SponsorFault) {
        if (error.status === 429) res.setHeader('Retry-After','60');
        else if (error.status === 503) res.setHeader('Retry-After','15');
        return await respond(error.status,{error:error.code});
      }
      res.setHeader('Retry-After','15');
      // No body, token, query, IP or personal document fields in error logs.
      console.error('[sponsor-api] unavailable:', error?.name || 'Error');
      return await respond(503,{error:'SPONSOR_UNAVAILABLE'});
    }
  };
}
