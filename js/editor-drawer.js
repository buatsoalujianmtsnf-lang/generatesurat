/* DaisyUI drawer state and accessibility; one dedicated in-workspace edge trigger. */
const EditorDrawer = (() => {
  const QUERY = '(max-width: 1023px)';
  const MOBILE_QUERY = '(max-width: 767px)';
  const TRIGGER_ID = 'editor-drawer-button';
  let root = null;
  let toggle = null;
  let editor = null;
  let media = null;
  let initialized = false;
  let restoreFocus = null;

  function isCompact() {
    return media ? media.matches : window.matchMedia?.(QUERY).matches === true;
  }

  function isMobile() {
    return window.matchMedia?.(MOBILE_QUERY).matches === true;
  }

  // Offset the compact drawer below the actual header (including safe-area insets).
  function syncHeaderOffset() {
    const header = document.querySelector?.('.app-header');
    const rect = header?.getBoundingClientRect?.();
    if (rect && Number.isFinite(rect.bottom)) {
      root?.style?.setProperty?.('--drawer-header-offset', Math.max(0, Math.round(rect.bottom)) + 'px');
    }
  }

  function setOpen(open, options = {}) {
    if (!root || !toggle || !editor) return;
    const next = Boolean(open);
    const compact = isCompact();
    syncHeaderOffset();
    toggle.checked = next;
    root.dataset.open = String(next);
    editor.inert = !next;
    editor.setAttribute('aria-hidden', String(!next));
    document.documentElement.classList.toggle('editor-drawer-open', compact && next);

    // One visible action outside the app navbar on all screen sizes.
    const trigger = document.getElementById(TRIGGER_ID);
    if (trigger) {
      const label = next ? 'Tutup Editor' : 'Buka Editor';
      trigger.setAttribute('aria-expanded', String(next));
      trigger.setAttribute('aria-label', label);
      trigger.title = label;
      const text = trigger.querySelector?.('.editor-drawer__toggle-label');
      if (text) text.textContent = label;
    }

    if (compact && next && options.focus !== false) {
      (editor.querySelector('.editor-tab.active') || editor).focus?.();
    }
    if (!next && options.returnFocus) {
      (trigger || restoreFocus)?.focus?.();
    }
  }

  function open(options = {}) {
    if (!root) return;
    if (!toggle.checked) {
      restoreFocus = document.activeElement instanceof HTMLElement
        ? document.activeElement : null;
    }
    setOpen(true, options);
  }

  function close(options = {}) { setOpen(false, options); }
  function toggleDrawer() {
    if (toggle?.checked) close({ returnFocus: true });
    else open();
  }
  function init() {
    if (initialized) return;
    root = document.getElementById('editor-drawer');
    toggle = /** @type {HTMLInputElement|null} */ (document.getElementById('editor-drawer-toggle'));
    editor = document.getElementById('editor-panel');
    const trigger = document.getElementById(TRIGGER_ID);
    if (!root || !toggle || !editor || !trigger) return;
    initialized = true;
    media = window.matchMedia?.(QUERY) || null;
    setOpen(!isCompact(), { focus: false });
    trigger.addEventListener('click', toggleDrawer);
    toggle.addEventListener('change', () => setOpen(toggle.checked, { focus: false }));

    const onViewport = () => {
      // Keep the existing desktop-open / compact-preview-first behavior on breakpoint changes.
      setOpen(!isCompact(), { focus: false });
    };
    if (media?.addEventListener) media.addEventListener('change', onViewport);
    else if (media?.addListener) media.addListener(onViewport);
    window.addEventListener?.('resize', syncHeaderOffset);
    window.addEventListener?.('orientationchange', syncHeaderOffset);

    document.addEventListener('keydown', event => {
      if (!isCompact() || !toggle.checked) return;
      // Existing confirmation modal owns Escape when visible.
      const modal = document.getElementById('modal-overlay');
      if (modal && !modal.classList.contains('hidden')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close({ returnFocus: true });
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...editor.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter(el => !el.hidden && !el.closest('[hidden]') && el.getClientRects().length > 0);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      // Keep focus cycling through the dedicated edge trigger (not the header menu).
      const anchor = trigger;
      if (event.shiftKey && document.activeElement === first && anchor) {
        event.preventDefault(); anchor.focus();
      } else if (!event.shiftKey && document.activeElement === last && anchor) {
        event.preventDefault(); anchor.focus();
      } else if (event.shiftKey && document.activeElement === anchor) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === anchor &&
                 !document.getElementById('header-overflow-group')?.classList.contains('is-open')) {
        event.preventDefault(); first.focus();
      }
    });
  }
  return { init, open, close, setOpen, isCompact };
})();