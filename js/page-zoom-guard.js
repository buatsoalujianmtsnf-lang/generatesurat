/* PageZoomGuard — one shared best-effort browser page-zoom policy.
   The editor's document-only zoom buttons use State.setZoom and remain usable.
   Browser settings, assistive technology and OS-level magnification cannot be
   reliably overridden by a website. Avoid blocking ordinary scroll and typing. */
(() => {
  const guardWindow = /** @type {Window & { __pageZoomGuardInstalled?: boolean }} */ (window);
  if (guardWindow.__pageZoomGuardInstalled) return;
  guardWindow.__pageZoomGuardInstalled = true;

  const cancel = (event) => {
    if (event.cancelable) event.preventDefault();
  };

  // Trackpad pinch is often exposed as Ctrl+wheel; Meta+wheel on some systems.
  document.addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.metaKey) cancel(event);
  }, { capture: true, passive: false });

  // Common browser zoom shortcuts (+, -, 0); other Ctrl/Meta shortcuts are
  // intentionally untouched (copy, paste, find, save, accessibility, etc).
  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = String(event.key || '');
    const code = String(event.code || '');
    if (key === '+' || key === '=' || key === '-' || key === '_' || key === '0'
      || code === 'Equal' || code === 'Minus' || code === 'Digit0'
      || code === 'NumpadAdd' || code === 'NumpadSubtract' || code === 'Numpad0') {
      cancel(event);
    }
  }, { capture: true });

  // Safari gesture events and older WebKit multi-touch zoom fallbacks.
  document.addEventListener('gesturestart', cancel, { capture: true, passive: false });
  document.addEventListener('gesturechange', cancel, { capture: true, passive: false });
  document.addEventListener('touchmove', (event) => {
    if (event.touches && event.touches.length > 1) cancel(event);
  }, { capture: true, passive: false });
})();
