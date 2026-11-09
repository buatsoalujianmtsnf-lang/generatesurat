/* DaisyUI drawer state and accessibility; no changes to letter content. */
const EditorDrawer = (() => {
  const QUERY = '(max-width: 1023px)';
  let root = null;
  let toggle = null;
  let editor = null;
  let media = null;
  let initialized = false;
  let restoreFocus = null;

  function isCompact() {
    return media ? media.matches : window.matchMedia?.(QUERY).matches === true;
  }

  function setOpen(open, options = {}) {
    if (!root || !toggle || !editor) return;
    const next = Boolean(open);
    const compact = isCompact();
    toggle.checked = next;
    root.dataset.open = String(next);
    editor.inert = !next;
    editor.setAttribute('aria-hidden', String(!next));
    document.documentElement.classList.toggle('editor-drawer-open', compact && next);
    for (const id of ['editor-drawer-button', 'editor-drawer-preview-open', 'btn-editor-panel-mobile']) {
      const trigger = document.getElementById(id);
      if (!trigger) continue;
      trigger.setAttribute('aria-expanded', String(next));
      trigger.setAttribute('aria-label', next ? 'Tutup panel editor' : 'Buka panel editor');
    }
    if (compact && next && options.focus !== false) {
      editor.querySelector('#editor-drawer-close')?.focus();
    }
    if (!next && options.returnFocus && restoreFocus?.isConnected) {
      restoreFocus.focus();
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
    if (!root || !toggle || !editor) return;
    initialized = true;
    media = window.matchMedia?.(QUERY) || null;
    setOpen(!isCompact(), { focus: false });
    for (const id of ['editor-drawer-button', 'editor-drawer-preview-open', 'btn-editor-panel-mobile']) {
      document.getElementById(id)?.addEventListener('click', toggleDrawer);
    }
    for (const id of ['editor-drawer-close', 'editor-drawer-preview']) {
      document.getElementById(id)?.addEventListener('click', () => close({ returnFocus: true }));
    }
    root.querySelector('.editor-drawer__overlay')?.addEventListener('click', () => {
      close({ returnFocus: true });
    });
    toggle.addEventListener('change', () => setOpen(toggle.checked, { focus: false }));
    const onViewport = () => {
      // Desktop defaults to an expanded sidebar; compact starts as preview-first.
      setOpen(!isCompact(), { focus: false });
    };
    if (media?.addEventListener) media.addEventListener('change', onViewport);
    else if (media?.addListener) media.addListener(onViewport);

    document.addEventListener('keydown', event => {
      if (!isCompact() || !toggle.checked) return;
      // The application's confirmation modal owns focus and Escape when visible.
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
      const first = items[0], last = items[items.length-1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    });
  }
  return { init, open, close, setOpen, isCompact };
})();
