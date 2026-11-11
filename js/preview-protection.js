/* =============================================================
   PP-01 — Fondasi Perlindungan Preview Surat.
   Hanya kerangka overlay; watermark/masking menyusul di PP-02.
   Feature flag: <html data-preview-protection="off"> (DEFAULT).
   Tidak mengintersepsi keyboard, clipboard, cetak, maupun PDF.
   ============================================================= */
/* global State */
const PreviewProtection = (() => {
  /** @type {HTMLElement|null} */
  let wrapper = null;
  /** @type {HTMLElement|null} */
  let viewport = null;
  /** @type {HTMLElement|null} */
  let preview = null;
  /** @type {HTMLElement|null} */
  let layer = null;
  let initialized = false;
  let enabled = false;
  /** @type {number|null} */
  let frameId = null;
  /** @type {MutationObserver|null} */
  let mutationObserver = null;
  /** @type {ResizeObserver|null} */
  let resizeObserver = null;
  /** @type {Array<() => void>} */
  let unsubscribe = [];
  /** @type {Array<{left:number,top:number,width:number,height:number}>} */
  let pageGeometry = [];

  function _flagEnabled() {
    // Default DENY. Never infer activation from existence of the overlay.
    return document.documentElement?.dataset?.previewProtection === 'on';
  }

  function _clear() {
    pageGeometry = [];
    if (layer) {
      layer.replaceChildren();
      layer.hidden = true;
    }
  }

  function _renderGeometry() {
    if (!enabled || !wrapper || !preview || !layer) return;

    const pages = Array.from(preview.querySelectorAll(':scope > .surat-page'));
    // While pagination is in flight, page-count=0 is a deliberate not-ready state.
    const isPending = preview.dataset.pageCount === '0';
    if (!pages.length && !isPending && preview.querySelector(':scope > .doc-content')) {
      pages.push(preview);
    }
    if (!pages.length) {
      _clear();
      return;
    }

    // getBoundingClientRect includes CSS transform. Remove the parent zoom to
    // position overlay sheets in wrapper-local CSS pixels; both scale together.
    const bounds = wrapper.getBoundingClientRect();
    const scaleX = bounds.width / (wrapper.offsetWidth || 1);
    const scaleY = bounds.height / (wrapper.offsetHeight || 1);
    if (!(scaleX > 0) || !(scaleY > 0)) {
      _clear();
      return;
    }

    const fragment = document.createDocumentFragment();
    /** @type {Array<{left:number,top:number,width:number,height:number}>} */
    const nextGeometry = [];
    for (const page of pages) {
      const rect = page.getBoundingClientRect();
      if (!(rect.width > 0) || !(rect.height > 0)) continue;
      const box = {
        left: (rect.left - bounds.left) / scaleX,
        top: (rect.top - bounds.top) / scaleY,
        width: rect.width / scaleX,
        height: rect.height / scaleY,
      };
      if (!Object.values(box).every(Number.isFinite)) continue;

      const sheet = document.createElement('div');
      sheet.className = 'preview-protection-sheet';
      sheet.setAttribute('aria-hidden', 'true');
      sheet.style.left = box.left + 'px';
      sheet.style.top = box.top + 'px';
      sheet.style.width = box.width + 'px';
      sheet.style.height = box.height + 'px';
      fragment.appendChild(sheet);
      nextGeometry.push(box);
    }

    layer.replaceChildren(fragment);
    pageGeometry = nextGeometry;
    layer.hidden = nextGeometry.length === 0;
  }

  function _schedule() {
    if (!enabled || frameId !== null) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      _renderGeometry();
    });
  }

  function _stop() {
    enabled = false;
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
      frameId = null;
    }
    mutationObserver?.disconnect();
    resizeObserver?.disconnect();
    mutationObserver = null;
    resizeObserver = null;

    window.removeEventListener('resize', _schedule);
    document.removeEventListener('fullscreenchange', _schedule);
    document.removeEventListener('visibilitychange', _schedule);
    unsubscribe.forEach(dispose => dispose());
    unsubscribe = [];
    _clear();
  }

  function _start() {
    if (enabled || !wrapper || !viewport || !preview || !layer) return;
    enabled = true;

    // PreviewRenderer recreates page nodes on every edit/pagination.
    if (typeof MutationObserver === 'function') {
      mutationObserver = new MutationObserver(_schedule);
      mutationObserver.observe(preview, { childList: true, subtree: true });
    }
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(_schedule);
      resizeObserver.observe(wrapper);
      resizeObserver.observe(viewport);
      resizeObserver.observe(preview);
    }
    if (typeof State !== 'undefined' && typeof State.on === 'function') {
      for (const eventName of ['template:change', 'state:restore', 'state:reset', 'ui:zoomChange', 'settings:change']) {
        const dispose = State.on(eventName, _schedule);
        if (typeof dispose === 'function') unsubscribe.push(dispose);
      }
    }
    window.addEventListener('resize', _schedule, { passive: true });
    document.addEventListener('fullscreenchange', _schedule);
    document.addEventListener('visibilitychange', _schedule);
    _schedule();
  }

  /** Bind only to the actual preview subtree. Safe to call more than once. */
  function init() {
    if (initialized) return true;
    wrapper = document.getElementById('preview-canvas-wrapper');
    viewport = document.getElementById('preview-viewport');
    preview = document.getElementById('surat-preview');
    layer = document.getElementById('preview-protection-layer');

    if (!wrapper || !viewport || !preview || !layer
        || preview.parentElement !== wrapper
        || layer.parentElement !== wrapper) {
      wrapper = viewport = preview = layer = null;
      return false;
    }
    initialized = true;
    _clear();
    refresh();
    return true;
  }

  /** Re-evaluate the explicit flag; useful for controlled pilot/rollback. */
  function refresh() {
    if (!initialized) return false;
    if (_flagEnabled()) {
      _start();
      _schedule();
    } else if (enabled) {
      _stop();
    } else {
      _clear();
    }
    return enabled;
  }

  /** Idempotent teardown (including when the flag is OFF). */
  function destroy() {
    _stop();
    initialized = false;
    wrapper = viewport = preview = layer = null;
  }

  /** Exposes no document content or personal data. */
  function getStatus() {
    return Object.freeze({
      initialized,
      enabled,
      pageCount: pageGeometry.length,
    });
  }

  return Object.freeze({ init, refresh, destroy, getStatus });
})();