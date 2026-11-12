/* Tahap 2 — profil lembaga & preset KOP lokal opsional. */
const InstitutionProfile = (() => {
  const PROFILE_KEY = 'gs-institution-v1', PRESET_KEY = 'gs-kop-presets-v1';
  const fields = ['institution', 'parent', 'foundation', 'address', 'principal'];
  let started = false;
  const clean = (value, max = 160) => String(value ?? '').trim().slice(0, max);
  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { UI.toast('Penyimpanan perangkat tidak tersedia atau penuh.', 'error'); return false; }
  }
  function getProfile() {
    const data = read(PROFILE_KEY, {});
    return Object.fromEntries(fields.map(k => [k, clean(data[k], k === 'address' ? 280 : 160)]));
  }
  function getPresets() {
    const data = read(PRESET_KEY, []);
    return Array.isArray(data) ? data.filter(x => x && typeof x.name === 'string' && x.kop && Array.isArray(x.kop.rows)).slice(0, 5) : [];
  }
  function field(id) {
    return /** @type {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement|null} */ (document.getElementById(id));
  }
  function presetSelect() {
    return /** @type {HTMLSelectElement|null} */ (document.getElementById('institution-preset-select'));
  }
  function formValues() {
    return Object.fromEntries(fields.map(k => [k, clean(field('institution-' + k)?.value, k === 'address' ? 280 : 160)]));
  }
  function notify(message, type = 'info') { UI.toast(message, type); }
  function refreshPresets() {
    const select = presetSelect();
    if (!select) return;
    const previous = select.value;
    select.replaceChildren(new Option('Pilih preset KOP', ''));
    getPresets().forEach(x => select.add(new Option(x.name, x.id)));
    if (getPresets().some(x => x.id === previous)) select.value = previous;
  }
  function applyKop(kop) {
    if (!State.replaceKop(kop)) { notify('Preset KOP tidak valid.', 'warning'); return; }
    KopEditor.refresh();
    notify('KOP diterapkan. Periksa logo kiri dan pratinjau.', 'success');
  }
  function saveProfile(event) {
    event.preventDefault();
    const data = formValues();
    if (!data.institution) {
      document.getElementById('institution-institution')?.focus();
      notify('Nama lembaga wajib diisi.', 'warning'); return;
    }
    if (write(PROFILE_KEY, data)) notify('Profil tersimpan di perangkat ini.', 'success');
  }
  function applyProfile() {
    const data = getProfile();
    if (!data.institution || !data.address) {
      notify('Simpan nama lembaga dan alamat terlebih dahulu.', 'warning'); return;
    }
    const lines = [data.parent, data.foundation, data.institution, 'Alamat: ' + data.address].filter(Boolean);
    const kop = State.getKop();
    kop.rows = lines.map((text, index) => ({
      ...State.createDefaultKopRow(index),
      text,
      fontSize: text === data.institution ? 14 : text.startsWith('Alamat:') ? 9 : 11,
      bold: text === data.institution,
      italic: text.startsWith('Alamat:'),
      textAlign: 'center',
    }));
    UI.confirm('Terapkan Profil ke KOP', 'Baris teks KOP akan diganti. Logo tetap dipertahankan. Lanjutkan?', () => applyKop(kop));
  }
  function savePreset() {
    const input = field('institution-preset-name');
    const name = clean(input?.value, 50);
    if (!name) { input?.focus(); notify('Masukkan nama preset KOP.', 'warning'); return; }
    const presets = getPresets();
    const old = presets.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!old && presets.length >= 5) { notify('Maksimal 5 preset KOP.', 'warning'); return; }
    const kop = State.getKop();
    if (JSON.stringify(kop).length > 800000) { notify('Ukuran logo terlalu besar untuk preset lokal.', 'warning'); return; }
    const id = old?.id || ('kop-' + Date.now().toString(36));
    if (write(PRESET_KEY, [...presets.filter(x => x.id !== id), { id, name, kop }])) {
      input.value = '';
      refreshPresets();
      presetSelect().value = id;
      notify('Preset KOP disimpan di perangkat.', 'success');
    }
  }
  function loadPreset() {
    const id = presetSelect()?.value;
    const preset = getPresets().find(x => x.id === id);
    if (!preset) { notify('Pilih preset KOP.', 'warning'); return; }
    UI.confirm('Gunakan Preset KOP', 'Seluruh KOP termasuk logo akan diganti. Lanjutkan?', () => applyKop(preset.kop));
  }
  function deletePreset() {
    const id = presetSelect()?.value;
    const preset = getPresets().find(x => x.id === id);
    if (!preset) return;
    UI.confirm('Hapus Preset KOP', 'Hapus preset terpilih dari perangkat ini?', () => {
      if (write(PRESET_KEY, getPresets().filter(x => x.id !== id))) {
        refreshPresets(); notify('Preset dihapus.', 'success');
      }
    });
  }
  function init() {
    const root = document.getElementById('institution-profile-root');
    if (started || !root) return;
    started = true;
    root.innerHTML = [
      '<details class="institution-card">',
      '<summary><strong>Profil Lembaga & Preset KOP</strong><span>Gunakan kembali</span></summary>',
      '<div class="institution-card__body">',
      '<p class="institution-hint">Data hanya di perangkat ini, terpisah dari backup surat. Tidak otomatis mengubah dokumen.</p>',
      '<form id="institution-form" autocomplete="off">',
      '<label for="institution-institution">Nama sekolah/madrasah *</label>',
      '<input id="institution-institution" required maxlength="160" placeholder="Nama resmi lembaga">',
      '<label for="institution-parent">Instansi induk (opsional)</label>',
      '<input id="institution-parent" maxlength="160" placeholder="Contoh: Kementerian Agama">',
      '<label for="institution-foundation">Yayasan (opsional)</label>',
      '<input id="institution-foundation" maxlength="160" placeholder="Nama yayasan">',
      '<label for="institution-address">Alamat lengkap</label>',
      '<textarea id="institution-address" rows="2" maxlength="280" placeholder="Alamat untuk KOP"></textarea>',
      '<label for="institution-principal">Nama kepala (referensi)</label>',
      '<input id="institution-principal" maxlength="160" placeholder="Tidak otomatis mengganti penandatangan">',
      '<div class="institution-actions">',
      '<button type="submit" class="btn btn-primary btn--primary btn-sm">Simpan Profil</button>',
      '<button type="button" id="institution-apply" class="btn btn-outline btn-sm">Terapkan ke KOP</button>',
      '</div></form>',
      '<div class="institution-presets">',
      '<label for="institution-preset-name">Nama preset KOP</label>',
      '<input id="institution-preset-name" maxlength="50" placeholder="Contoh: KOP resmi">',
      '<button type="button" id="institution-save-preset" class="btn btn-outline btn-sm">Simpan KOP Saat Ini</button>',
      '<label for="institution-preset-select">Preset KOP tersimpan (maksimal 5)</label>',
      '<select id="institution-preset-select"><option value="">Pilih preset KOP</option></select>',
      '<div class="institution-actions">',
      '<button type="button" id="institution-load-preset" class="btn btn-primary btn--primary btn-sm">Gunakan Preset</button>',
      '<button type="button" id="institution-delete-preset" class="btn btn-outline btn-sm">Hapus Preset</button>',
      '</div></div></div></details>'
    ].join('');
    const values = getProfile();
    fields.forEach(k => { const input = field('institution-' + k); if (input) input.value = values[k]; });
    refreshPresets();
    root.querySelector('#institution-form')?.addEventListener('submit', saveProfile);
    root.querySelector('#institution-apply')?.addEventListener('click', applyProfile);
    root.querySelector('#institution-save-preset')?.addEventListener('click', savePreset);
    root.querySelector('#institution-load-preset')?.addEventListener('click', loadPreset);
    root.querySelector('#institution-delete-preset')?.addEventListener('click', deletePreset);
  }
  return { init, getProfile, getPresets };
})();
