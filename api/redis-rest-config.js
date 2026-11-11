/* Shared server-only REST Redis credential resolver for existing Vercel KV.
 * Never copies credentials into the repository or client bundles.
 * Explicit Upstash credentials take priority; partial sets fail closed and
 * must NOT be mixed with a different KV database.
 */
export function resolveRedisRestConfig(env = process.env) {
  const has = key => Object.prototype.hasOwnProperty.call(env,key);
  const explicit = has('UPSTASH_REDIS_REST_URL') || has('UPSTASH_REDIS_REST_TOKEN');
  const keys = explicit
    ? ['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN']
    : ['KV_REST_API_URL','KV_REST_API_TOKEN'];
  if (!explicit && !keys.every(has)) return null;
  const urlValue = env[keys[0]], tokenValue = env[keys[1]];
  if (typeof urlValue !== 'string' || !urlValue
    || typeof tokenValue !== 'string' || !tokenValue) return null;
  try {
    const url = new URL(urlValue);
    if (url.protocol !== 'https:' || url.username || url.password
      || url.search || url.hash || url.pathname !== '/') return null;
    return Object.freeze({ url: url.origin, token: tokenValue,
      source: explicit ? 'explicit-upstash' : 'existing-vercel-kv' });
  } catch {
    return null;
  }
}
export function redisRestConfigured(env = process.env) {
  return resolveRedisRestConfig(env) !== null;
}
