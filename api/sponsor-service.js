/* MON-03: server-only sponsor session orchestration. No advertisement SDK. */
import { randomBytes, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createSponsorLedger, createUpstashCommand, tokenValid } from './sponsor-ledger.js';

const policy = JSON.parse(readFileSync(new URL('../config/sponsor-policy.json', import.meta.url), 'utf8'));
const registry = JSON.parse(readFileSync(new URL('../config/sponsor-campaigns.json', import.meta.url), 'utf8'));
const APPROVAL_KEYS = ['agreementSigned','rightsVerified','contentApproved','privacyApproved','operatorApproved'];
const TOKEN = () => randomBytes(32).toString('base64url');

export class SponsorFault extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'SponsorFault';
    this.code = code;
    this.status = status;
  }
}
export function activeSponsor(now, p = policy, r = registry) {
  if (p.enabled !== true || r.enabled !== true || p.releasePhase !== 'production') return null;
  return (r.campaigns || []).find(c => c.status === 'approved'
    && Date.parse(c.startsAt) <= now && now < Date.parse(c.endsAt)
    && APPROVAL_KEYS.every(key => c.approvals?.[key] === true)
    && typeof c.media?.path === 'string'
    && /^assets\/sponsors\/[a-z0-9/-]+\.(mp4|webm)$/.test(c.media.path)) || null;
}
export function sponsorIsReady(env = process.env, p = policy, r = registry, now = Date.now()) {
  return env.SPONSOR_GATE_ENABLED === 'true'
    && typeof env.UPSTASH_REDIS_REST_URL === 'string'
    && typeof env.UPSTASH_REDIS_REST_TOKEN === 'string'
    && typeof env.SPONSOR_IP_HASH_SECRET === 'string'
    && env.SPONSOR_IP_HASH_SECRET.length >= 32
    && !!activeSponsor(now,p,r);
}
export function createSponsorService({
  command, now = Date.now, makeToken = TOKEN,
  env = process.env, sponsorPolicy = policy, campaigns = registry
}) {
  const ledger = createSponsorLedger(command);
  const guard = () => {
    const at = now();
    if (!sponsorIsReady(env, sponsorPolicy, campaigns, at)) {
      throw new SponsorFault('SPONSOR_UNAVAILABLE',503);
    }
    return { at, campaign: activeSponsor(at,sponsorPolicy,campaigns) };
  };
  const limit = async (ip, purpose, max) => {
    if (typeof ip !== 'string' || !ip) throw new SponsorFault('SPONSOR_UNAVAILABLE',503);
    const digest = createHmac('sha256',env.SPONSOR_IP_HASH_SECRET)
      .update(ip).digest('hex');
    const key = 'gs:sponsor:rate:' + purpose + ':' + digest;
    if (!(await ledger.rateLimit({key,limit:max,windowMs:60_000}))) {
      throw new SponsorFault('TOO_MANY_REQUESTS',429);
    }
  };
  return {
    async start({ action, source = 'button', ip }) {
      const { at, campaign } = guard();
      if (!['print','pdf'].includes(action)
        || !['button','keyboard'].includes(source)
        || (source === 'keyboard' && action !== 'print')) {
        throw new SponsorFault('BAD_REQUEST',400);
      }
      await limit(ip,'start',12);
      const sessionToken=makeToken();
      const ok=await ledger.createSession({
        token:sessionToken,action,campaignId:campaign.id,now:at
      });
      if (!ok) throw new SponsorFault('CONFLICT',409);
      const captions = campaign.media?.captionsPath;
      const captionsPath = typeof captions === 'string'
        && /^assets\/sponsors\/[a-z0-9/-]+\.vtt$/.test(captions) ? '/' + captions : null;
      return { sessionToken, action, campaignId:campaign.id,
        sponsorName: typeof campaign.sponsorDisplayName === 'string'
          ? campaign.sponsorDisplayName.slice(0,120) : 'Sponsor',
        mediaPath:'/'+campaign.media.path, mediaType:campaign.media.mimeType,
        captionsPath,
        durationSeconds:15, expiresAt:at+300_000 };
    },
    async progress({ sessionToken, positionMs, playing, visible, ip }) {
      const { at } = guard();
      await limit(ip,'progress',150);
      if (!tokenValid(sessionToken)) throw new SponsorFault('BAD_REQUEST',400);
      const code = await ledger.progress({
        token:sessionToken,now:at,positionMs,playing,visible
      });
      if (code === 'EXPIRED') throw new SponsorFault('SESSION_EXPIRED',410);
      if (code === 'CLOCK' || code === 'SEEK') throw new SponsorFault('INVALID_PLAYBACK',409);
      if (code === 'INVALID') throw new SponsorFault('BAD_REQUEST',400);
      const creditedMs = Number(code);
      if (!Number.isFinite(creditedMs) || creditedMs < 0 || creditedMs > 15000) {
        throw new SponsorFault('SPONSOR_UNAVAILABLE',503);
      }
      return { accepted:true, creditedMs };
    },
    async complete({ sessionToken, ended, ip }) {
      const { at } = guard();
      await limit(ip,'complete',24);
      if (!tokenValid(sessionToken) || ended !== true) {
        throw new SponsorFault('BAD_REQUEST',400);
      }
      const receipt=makeToken();
      const code=await ledger.complete({token:sessionToken,receipt,now:at});
      if (code === 'EXPIRED') throw new SponsorFault('SESSION_EXPIRED',410);
      if (code === 'NOT_READY') throw new SponsorFault('PLAYBACK_INCOMPLETE',409);
      if (code !== 'OK') throw new SponsorFault('SPONSOR_UNAVAILABLE',503);
      return { receipt, expiresAt:at+120_000 };
    },
    async authorizePrint({ receipt, ip }) {
      const { at } = guard();
      await limit(ip,'print',24);
      if (!tokenValid(receipt)) throw new SponsorFault('BAD_REQUEST',400);
      const code=await ledger.consume({receipt,action:'print',now:at});
      if (code !== 'OK') throw new SponsorFault('RECEIPT_INVALID',409);
      return { authorized:true };
    },
    /* Reserved for MON-05: call from /api/export-pdf after existing input/origin validation.
       Never expose PDF receipt consumption via a public sponsor endpoint. */
    async consumePdfReceipt({receipt}) {
      const { at } = guard();
      if (!tokenValid(receipt)) return false;
      return (await ledger.consume({receipt,action:'pdf',now:at})) === 'OK';
    }
  };
}
export function liveSponsorService(env = process.env) {
  return createSponsorService({ command:createUpstashCommand(env), env });
}
