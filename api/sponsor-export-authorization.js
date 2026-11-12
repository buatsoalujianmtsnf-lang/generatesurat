/* MON-05: server-side PDF sponsor authorization, never based on HTML state.
 * A video receipt is required only if an approved sponsor campaign is live.
 * When no video campaign is published, downloads remain available even when
 * an old SPONSOR_GATE_ENABLED env flag is still set. If a campaign is active,
 * missing Redis/verification fails closed (no security bypass).
 */
import { activeSponsor, liveSponsorService, sponsorIsReady } from './sponsor-service.js';

const TOKEN = /^[A-Za-z0-9_-]{40,90}$/;
export function pdfSponsorRequired(env = process.env, hasActiveVideo = () => !!activeSponsor(Date.now())) {
  return env.SPONSOR_GATE_ENABLED === 'true' && hasActiveVideo();
}

/**
 * @param {unknown} receipt Header X-Sponsor-Receipt, never a query parameter.
 * @param {{env?: NodeJS.ProcessEnv, hasActiveVideo?: () => boolean, ready?: typeof sponsorIsReady, getService?: typeof liveSponsorService}} options
 * @returns {Promise<{ok:boolean,status:number,error?:string}>}
 */
export async function verifyPdfSponsorReceipt(receipt, {
  env = process.env,
  hasActiveVideo = () => !!activeSponsor(Date.now()),
  ready = sponsorIsReady,
  getService = liveSponsorService,
} = {}) {
  if (!pdfSponsorRequired(env, hasActiveVideo)) return { ok: true, status: 200 };
  if (typeof receipt !== 'string' || !TOKEN.test(receipt)) {
    return { ok: false, status: 403, error: 'Selesaikan video sponsor sebelum mengunduh PDF.' };
  }
  if (!ready(env)) {
    return { ok: false, status: 503, error: 'Layanan sponsor belum siap. Ekspor PDF tidak dapat dilanjutkan.' };
  }
  try {
    const allowed = await getService(env).consumePdfReceipt({ receipt });
    if (allowed !== true) {
      return { ok: false, status: 403, error: 'Izin PDF sudah digunakan, kedaluwarsa, atau tidak sesuai tindakan.' };
    }
    return { ok: true, status: 200 };
  } catch (error) {
    // Avoid logging the raw receipt, document contents or Redis credentials.
    console.error('[sponsor-export] Receipt verification unavailable:', error?.name || 'Error');
    return { ok: false, status: 503, error: 'Verifikasi sponsor tidak tersedia. Silakan coba lagi.' };
  }
}
