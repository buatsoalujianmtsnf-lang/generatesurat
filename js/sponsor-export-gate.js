/* MON-05: centralized sponsor gate for editor print, PDF and Ctrl/Cmd+P.
 * The HTML data-sponsor-gate switch is an application UX setting, NOT security.
 * The PDF server independently checks SPONSOR_GATE_ENABLED and consumes receipts.
 * Native browser menu print cannot be fully prevented by any web application.
 */
/* global SponsorVideoModal, Workflow */
const SponsorExportGate = (() => {
  const TOKEN = /^[A-Za-z0-9_-]{40,90}$/;
  let initialized = false;
  let pending = false;

  function isRequired() {
    return document.documentElement?.dataset?.sponsorGate === 'required';
  }
  function notice(text) {
    if (typeof UI !== 'undefined' && typeof UI.toast === 'function') {
      UI.toast(text, 'error', 5500);
    }
  }
  async function authorizePrint(receipt) {
    const response = await fetch('/api/sponsor-print-authorize', {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'error',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ receipt }),
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result?.authorized === true;
  }

  /**
   * Execute the validated action once. When disabled no sponsor endpoint is
   * contacted, preserving the existing editor/offline print workflow.
   * @param {{action:'print'|'pdf',source?:'button'|'keyboard'}} options
   * @param {(grant: {receipt:string,expiresAt:number}|null)=>any} invoke
   * @returns {boolean} Whether a new export flow was accepted.
   */
  function run({ action, source = 'button' }, invoke) {
    if (!['print', 'pdf'].includes(action) || !['button', 'keyboard'].includes(source)
      || (source === 'keyboard' && action !== 'print') || typeof invoke !== 'function') return false;
    if (pending) return false;
    if (!isRequired()) {
      // The currently released MON-01..MON-04 flags are disabled.
      try { void Promise.resolve(invoke(null)).catch(() => notice('Tindakan ekspor tidak berhasil.')); }
      catch { notice('Tindakan ekspor tidak berhasil.'); }
      return true;
    }
    if (typeof SponsorVideoModal === 'undefined'
      || typeof SponsorVideoModal.request !== 'function') {
      notice('Modul sponsor tidak tersedia. Muat ulang aplikasi.');
      return false;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      notice('Iklan sponsor memerlukan koneksi internet sebelum Cetak/PDF.');
      return false;
    }
    pending = true;
    void (async () => {
      const grant = await SponsorVideoModal.request({ action, source });
      if (!grant) return; // User cancelled or browser cannot display the video.
      if (grant.action !== action || !TOKEN.test(grant.receipt || '')
        || !Number.isFinite(grant.expiresAt) || grant.expiresAt <= Date.now()) {
        notice('Izin ekspor sponsor tidak sah atau sudah kedaluwarsa.');
        return;
      }
      if (action === 'print') {
        // Atomic one-use consume in Redis before opening the native dialog.
        const ok = await authorizePrint(grant.receipt);
        if (!ok) { notice('Verifikasi izin cetak gagal. Tindakan dibatalkan.'); return; }
      }
      await invoke({ receipt: grant.receipt, expiresAt: grant.expiresAt });
    })().catch(() => {
      notice('Layanan sponsor tidak dapat dijangkau. Ekspor dibatalkan.');
    }).finally(() => { pending = false; });
    return true;
  }

  function onKeyboard(event) {
    if (!isRequired() || !event || event.defaultPrevented) return;
    const mod = event.ctrlKey || event.metaKey;
    if (!mod || event.altKey || event.shiftKey
      || String(event.key).toLowerCase() !== 'p') return;
    // Browser menus/system dialogs remain outside JavaScript control.
    event.preventDefault();
    if (event.repeat) return;
    if (typeof Workflow !== 'undefined' && typeof Workflow.preparePrint === 'function') {
      Workflow.preparePrint('keyboard');
    } else notice('Alur cetak belum tersedia. Coba muat ulang aplikasi.');
  }

  function init() {
    if (initialized) return;
    initialized = true;
    document.addEventListener('keydown', onKeyboard, true);
  }

  return Object.freeze({ init, run, isRequired, isPending: () => pending, onKeyboard });
})();
