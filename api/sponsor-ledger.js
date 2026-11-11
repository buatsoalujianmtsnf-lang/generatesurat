/* MON-03: Redis-backed one-action sponsor sessions and atomic receipts.
 * This is a server-only module. Its client-reported media signals are NOT proof
 * that a human watched; elapsed time and monotonic heartbeat are guardrails.
 */
import { createHash } from 'node:crypto';

export const SESSION_TTL_MS = 5 * 60 * 1000;
export const RECEIPT_TTL_MS = 120 * 1000;
export const MIN_SERVER_ELAPSED_MS = 15_000;
export const MIN_CREDITED_PLAYBACK_MS = 14_000;
export const MIN_FINAL_POSITION_MS = 14_800;

export const PROGRESS_SCRIPT = String.raw`-- SPONSOR_PROGRESS_V1
local old = redis.call('GET', KEYS[1])
if not old then return 'EXPIRED' end
local s = cjson.decode(old)
local now = tonumber(ARGV[1])
local position = tonumber(ARGV[2])
local playing = ARGV[3] == '1'
local visible = ARGV[4] == '1'
if now >= tonumber(s.expiresAt) then
  redis.call('DEL', KEYS[1])
  return 'EXPIRED'
end
if now < tonumber(s.lastSeenAt) then return 'CLOCK' end
local elapsed = now - tonumber(s.lastSeenAt)
local advanced = position - tonumber(s.lastPositionMs)
if position < tonumber(s.lastPositionMs) - 200 then return 'SEEK' end
if advanced > 2800 and elapsed <= 2500 then return 'SEEK' end
if s.playing and s.visible and playing and visible
   and elapsed > 0 and elapsed <= 2500
   and advanced > 0 and advanced >= elapsed - 500
   and advanced <= elapsed + 350 then
  s.creditedMs = math.min(15000, tonumber(s.creditedMs) + math.min(advanced, elapsed))
end
s.lastSeenAt = now
s.lastPositionMs = position
s.playing = playing
s.visible = visible
redis.call('SET', KEYS[1], cjson.encode(s), 'PX', math.max(1, tonumber(s.expiresAt) - now))
return tostring(math.floor(tonumber(s.creditedMs)))
`;

export const COMPLETE_SCRIPT = String.raw`-- SPONSOR_COMPLETE_V1
local old = redis.call('GET', KEYS[1])
if not old then return 'EXPIRED' end
local s = cjson.decode(old)
local now = tonumber(ARGV[1])
if now >= tonumber(s.expiresAt) then
  redis.call('DEL', KEYS[1])
  return 'EXPIRED'
end
if now - tonumber(s.startedAt) < 15000
   or tonumber(s.creditedMs) < 14000
   or tonumber(s.lastPositionMs) < 14800
   or now - tonumber(s.lastSeenAt) > 2500
   or not s.visible then
  return 'NOT_READY'
end
local receipt = cjson.encode({
  action = s.action, campaignId = s.campaignId,
  issuedAt = now, expiresAt = now + 120000
})
local created = redis.call('SET', KEYS[2], receipt, 'NX', 'PX', 120000)
if not created then return 'CONFLICT' end
redis.call('DEL', KEYS[1])
return 'OK'
`;

export const CONSUME_SCRIPT = String.raw`-- SPONSOR_CONSUME_V1
local old = redis.call('GET', KEYS[1])
if not old then return 'REPLAY_OR_EXPIRED' end
local item = cjson.decode(old)
local now = tonumber(ARGV[1])
if now >= tonumber(item.expiresAt) then
  redis.call('DEL', KEYS[1])
  return 'EXPIRED'
end
if item.action ~= ARGV[2] then return 'WRONG_ACTION' end
redis.call('DEL', KEYS[1])
return 'OK'
`;

export const RATE_SCRIPT = String.raw`-- SPONSOR_RATE_V1
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[1])) end
return n
`;

const TOKEN_RE = /^[A-Za-z0-9_-]{40,90}$/;
export const tokenValid = token => typeof token === 'string' && TOKEN_RE.test(token);
export const sessionKey = token => 'gs:sponsor:session:' + createHash('sha256').update(token).digest('hex');
export const receiptKey = token => 'gs:sponsor:receipt:' + createHash('sha256').update(token).digest('hex');

export function createSponsorLedger(command) {
  if (typeof command !== 'function') throw new Error('Redis command adapter required');
  return {
    async createSession({ token, action, campaignId, now }) {
      if (!tokenValid(token) || !['print', 'pdf'].includes(action)) throw new Error('invalid session');
      const record = {
        action, campaignId, startedAt: now, expiresAt: now + SESSION_TTL_MS,
        lastSeenAt: now, lastPositionMs: 0, creditedMs: 0,
        playing: false, visible: false
      };
      return (await command(['SET', sessionKey(token), JSON.stringify(record),
        'NX', 'PX', String(SESSION_TTL_MS)])) === 'OK';
    },
    async progress({ token, now, positionMs, playing, visible }) {
      if (!tokenValid(token) || !Number.isInteger(positionMs)
        || positionMs < 0 || positionMs > 15300
        || typeof playing !== 'boolean' || typeof visible !== 'boolean') return 'INVALID';
      return String(await command(['EVAL', PROGRESS_SCRIPT, '1', sessionKey(token),
        String(now), String(positionMs), playing ? '1' : '0', visible ? '1' : '0']));
    },
    async complete({ token, receipt, now }) {
      if (!tokenValid(token) || !tokenValid(receipt)) return 'INVALID';
      return String(await command(['EVAL', COMPLETE_SCRIPT, '2',
        sessionKey(token), receiptKey(receipt), String(now)]));
    },
    async consume({ receipt, action, now }) {
      if (!tokenValid(receipt) || !['print', 'pdf'].includes(action)) return 'INVALID';
      return String(await command(['EVAL', CONSUME_SCRIPT, '1',
        receiptKey(receipt), String(now), action]));
    },
    async rateLimit({ key, limit, windowMs }) {
      const count = Number(await command(['EVAL', RATE_SCRIPT, '1', key, String(windowMs)]));
      if (!Number.isFinite(count) || count < 1) throw new Error('invalid rate limit response');
      return count <= limit;
    }
  };
}

export function createUpstashCommand(env = process.env, fetchImpl = fetch) {
  const endpoint = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!endpoint || !token) throw new Error('Sponsor Redis not configured');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Sponsor Redis endpoint must use HTTPS');
  }
  return async words => {
    const res = await fetchImpl(url.href, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + token },
      body:JSON.stringify(words),
      signal:AbortSignal.timeout(4500)
    });
    if (!res.ok) throw new Error('Sponsor Redis unavailable');
    const result = await res.json();
    if (!result || result.error || result.result === undefined) {
      throw new Error('Sponsor Redis response invalid');
    }
    return result.result;
  };
}
