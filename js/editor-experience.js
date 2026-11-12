/* Stage 1-2: focused editor experience, unobtrusive status and mode preference. */
const EditorExperience = (() => {
  const MODE_KEY = 'generatesurat-editor-mode-v1';
  let started = false;
  function getMode() {
    try { return localStorage.getItem(MODE_KEY) === 'advanced' ? 'advanced' : 'simple'; }
    catch { return 'simple'; }
  }
  function setMode(mode) {
    if (mode !== 'simple' && mode !== 'advanced') return;
    document.documentElement.dataset.editorMode = mode;
    if (mode === 'simple') {
      const details = /** @type {HTMLDetailsElement|null} */ (document.querySelector('#institution-profile-root details'));
      if (details) details.open = true;
    }
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* private browsing */ }
    const select = /** @type {HTMLSelectElement|null} */ (document.getElementById('editor-mode'));
    if (select) select.value = mode;
  }
  function refreshStatus() {
    const el = document.getElementById('editor-save-status');
    if (!el || typeof State === 'undefined') return;
    const meta = State.getState().storage;
    if (State.isDirty()) {
      el.dataset.state = 'dirty';
      el.textContent = 'Perubahan belum disimpan';
    } else if (meta.lastSavedAt) {
      el.dataset.state = 'saved';
      el.textContent = 'Disimpan sementara di perangkat (2 jam)';
    } else {
      el.dataset.state = 'empty';
      el.textContent = 'Simpan data sementara atau buat draft bernama';
    }
  }
  function init() {
    if (started || !document.getElementById('editor-mode')) return;
    started = true;
    setMode(getMode());
    document.getElementById('editor-mode').addEventListener('change', event => {
      setMode(/** @type {HTMLSelectElement} */ (event.currentTarget).value);
    });
    for (const event of ['state:change', 'state:saved', 'state:restore', 'state:reset']) {
      State.on(event, refreshStatus);
    }
    refreshStatus();
  }
  return { init, getMode, setMode, refreshStatus };
})();
