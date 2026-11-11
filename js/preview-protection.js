/* =============================================================
   PP-03 — Watermark, masking, dan interaksi terbatas Preview Surat.
   Deterrent visual; tidak dapat memblokir screenshot/recording OS.
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
  /** @type {HTMLElement|null} */
  let statusEl = null;
  let initialized = false;
  let enabled = false;
  let masked = false;
  let sessionCode = '';
  let tileKey = '';
  let tileImage = '';
  let lastNoticeAt = 0;
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

  /** Standard mode = watermark only; strict = watermark + background-tab masking. */
  function _mode() {
    return document.documentElement?.dataset?.previewProtectionMode === 'standard'
      ? 'standard' : 'strict';
  }

  function _isHidden() {
    return document.visibilityState === 'hidden' || document.hidden === true;
  }

  function _watermarkImage() {
    // Ephemeral anonymous label. Not a credential, identity or tracking ID.
    const now = new Date();
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const clock = hour + ':' + minute;
    const key = sessionCode + '-' + clock;
    if (key === tileKey && tileImage) return tileImage;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="180" viewBox="0 0 360 180"><g transform="rotate(-24 180 90)" fill="#344B77" text-anchor="middle" font-family="Arial,sans-serif"><text x="180" y="81" font-size="19" font-weight="700" letter-spacing="1.6" fill-opacity=".17">GENERATE SURATKU</text><text x="180" y="105" font-size="12" font-weight="600" letter-spacing="1.3" fill-opacity=".20">PRATINJAU · ${sessionCode} · ${clock}</text></g></svg>`;
    tileKey = key;
    tileImage = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    return tileImage;
  }

  function _syncStatus() {
    if (!statusEl) return;
    statusEl.hidden = !enabled || pageGeometry.length === 0;
    if (statusEl.hidden) return;
    const label = statusEl.querySelector?.('.preview-protection-status__label');
    if (label) label.textContent = masked ? 'Preview disamarkan' : 'Preview berwatermark';
    else statusEl.textContent = masked ? 'Preview disamarkan' : 'Preview berwatermark';
    statusEl.title = 'Watermark membantu melindungi pratinjau; screenshot dan perekaman layar sistem operasi tidak dapat diblokir sepenuhnya.';
  }

  /** Runs synchronously on visibilitychange; background tabs may suspend RAF. */
  function _syncMask() {
    masked = enabled && _mode() === 'strict' && _isHidden();
    layer?.classList?.toggle('is-masked', masked);
    _syncStatus();
  }

  function _onVisibilityChange() {
    _syncMask();
    _schedule();
  }

  function _clear() {
    pageGeometry = [];
    if (layer) {
      layer.replaceChildren();
      layer.hidden = true;
    }
    _syncStatus();
  }

  function _renderGeometry() {
    if (!enabled || !wrapper || !preview || !layer) return;

    const pages = Array.from(preview.querySelectorAll(':scope > .surat-page'));
    // In-flight pagination must not display stale / half-built watermarks.
    const isPending = preview.dataset.pageCount === '0';
    if (isPending) {
      _clear();
      return;
    }
    if (!pages.length && preview.querySelector(':scope > .doc-content')) {
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
    const watermarkImage = _watermarkImage();
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
      sheet.style.backgroundImage = watermarkImage;
      fragment.appendChild(sheet);
      nextGeometry.push(box);
    }

    layer.replaceChildren(fragment);
    pageGeometry = nextGeometry;
    layer.hidden = nextGeometry.length === 0;
    _syncStatus();
  }

  function _schedule() {
    if (!enabled || frameId !== null) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      _renderGeometry();
    });
  }


  /* PP-03: limit pointer-based content-menu and embedded media drag only.
     Never cancel copy, keyboard shortcuts, touch scrolling or editor events. */
  function _insidePreview(event) {
    if (!preview || !event?.target) return null;
    const target = event.target;
    const node = target.nodeType === 3 ? target.parentElement : target;
    if (!node || (node !== preview && !preview.contains?.(node))) return null;
    return node;
  }

  function _isEditableOrInteractive(node) {
    return Boolean(node.closest?.(
      'input, textarea, select, button, a, [contenteditable], [role="textbox"], [role="button"]'
    ));
  }

  function _notice(message) {
    // Avoid repeated toasts from touch/long-press and rapid gestures.
    const now = Date.now();
    if (now - lastNoticeAt < 5000) return;
    lastNoticeAt = now;
    if (typeof UI !== 'undefined' && typeof UI.toast === 'function') {
      UI.toast(message, 'info', 4000);
    }
  }

  function _onPreviewContextMenu(event) {
    if (!enabled || event.defaultPrevented || event.cancelable === false) return;
    const node = _insidePreview(event);
    if (!node || _isEditableOrInteractive(node)) return;

    // Allow the keyboard context-menu key / Shift+F10 for accessibility.
    // Right-click, macOS Ctrl-click and touch context-menu are pointer gestures.
    const isPointerMenu = event.button === 2
      || (event.button === 0 && event.ctrlKey === true)
      || event.pointerType === 'touch';
    if (!isPointerMenu) return;

    event.preventDefault();
    _notice('Menu klik kanan pada Preview Surat dibatasi. Gunakan Cetak atau PDF untuk dokumen resmi.');
  }

  function _onPreviewDragStart(event) {
    if (!enabled || event.defaultPrevented || event.cancelable === false) return;
    const node = _insidePreview(event);
    if (!node || _isEditableOrInteractive(node)) return;
    // Drag text selection is preserved. Only embedded visual assets are guarded.
    if (!node.closest?.('img, picture, svg, canvas')) return;
    event.preventDefault();
    _notice('Gambar pada Preview Surat tidak dapat diseret. Gunakan Cetak atau PDF.');
  }

  function _stop() {
    enabled = false;
    masked = false;
    sessionCode = '';
    tileKey = '';
    tileImage = '';
    layer?.classList?.remove('is-masked');
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
    document.removeEventListener('visibilitychange', _onVisibilityChange);
    preview?.removeEventListener?.('contextmenu', _onPreviewContextMenu);
    preview?.removeEventListener?.('dragstart', _onPreviewDragStart);
    unsubscribe.forEach(dispose => dispose());
    unsubscribe = [];
    _clear();
  }

  function _start() {
    if (enabled || !wrapper || !viewport || !preview || !layer) return;
    enabled = true;
    lastNoticeAt = 0;
    preview.addEventListener?.('contextmenu', _onPreviewContextMenu);
    preview.addEventListener?.('dragstart', _onPreviewDragStart);
    // Anonymous per-activation label to make copied previews less reusable.
    sessionCode = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');

    // PreviewRenderer recreates page nodes on every edit/pagination.
    if (typeof MutationObserver === 'function') {
      mutationObserver = new MutationObserver(_schedule);
      mutationObserver.observe(preview, {
        childList: true, subtree: true,
        attributes: true, attributeFilter: ['data-page-count'],
      });
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
    document.addEventListener('visibilitychange', _onVisibilityChange);
    _syncMask();
    _schedule();
  }

  /** Bind only to the actual preview subtree. Safe to call more than once. */
  function init() {
    if (initialized) return true;
    wrapper = document.getElementById('preview-canvas-wrapper');
    viewport = document.getElementById('preview-viewport');
    preview = document.getElementById('surat-preview');
    layer = document.getElementById('preview-protection-layer');
    statusEl = document.getElementById('preview-protection-status');

    if (!wrapper || !viewport || !preview || !layer
        || preview.parentElement !== wrapper
        || layer.parentElement !== wrapper) {
      wrapper = viewport = preview = layer = statusEl = null;
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
      _syncMask();
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
    wrapper = viewport = preview = layer = statusEl = null;
  }

  /** Exposes no document content or personal data. */
  function getStatus() {
    return Object.freeze({
      initialized,
      enabled,
      mode: enabled ? _mode() : 'off',
      interactionsProtected: enabled,
      masked,
      pageCount: pageGeometry.length,
    });
  }

  return Object.freeze({ init, refresh, destroy, getStatus });
})();