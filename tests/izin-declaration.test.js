import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../js/izin-declaration.js', import.meta.url), 'utf8');

function createHarness(templateId = 'surat-izin') {
  const listeners = {};
  const overlay = { classList: { add: vi.fn(), remove: vi.fn() } };
  const body = {};
  const footer = {};
  const checkbox = {
    checked: false,
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  const proceed = { disabled: true };
  const elements = new Map([
    ['modal-overlay', overlay],
    ['modal-body', body],
    ['modal-footer', footer],
    ['izin-declaration-check', checkbox],
  ]);
  const document = {
    getElementById: id => elements.get(id) || null,
    querySelector: query => query === '#modal-footer .izin-declaration-continue' ? proceed : null,
  };
  let latestOptions = null;
  const ui = {
    showModal: vi.fn(options => { latestOptions = options; }),
    hideModal: vi.fn(),
    toast: vi.fn(),
  };
  const state = {
    getActiveTemplate: vi.fn(() => templateId),
    getFormData: vi.fn(() => ({
      murid: {
        namaMurid: '<Siswa>',
        namaOrangTuaWali: 'Wali & Keluarga',
      },
      izin: { durasiIzin: 3 },
    })),
  };
  const context = {
    document,
    State: state,
    UI: ui,
    Utils: {
      escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    },
    TemplateSuratIzin: { formatLamaIzin: value => value + ' (tiga) Hari' },
  };
  runInNewContext(source, context);
  return {
    declaration: runInNewContext('IzinDeclaration', context),
    getOptions: () => latestOptions,
    ui, state, proceed, checkbox, listeners, elements, overlay,
  };
}

describe('Pernyataan wajib sebelum PDF/Cetak Surat Izin', () => {
  it.each([
    ['pdf', 'Lanjutkan ke PDF'],
    ['print', 'Lanjutkan Cetak'],
  ])('membuka konfirmasi %s, memblokir tanpa centang, lalu melanjutkan hanya sekali', (action, label) => {
    const h = createHarness();
    const execute = vi.fn();
    expect(h.declaration.request(action, execute)).toBe(true);
    const options = h.getOptions();
    expect(options.title).toContain('Orang Tua/Wali');
    expect(options.body).toContain('&lt;Siswa&gt;');
    expect(options.body).toContain('Wali &amp; Keluarga');
    expect(options.body).toContain('3 (tiga) Hari');
    expect(options.body).toContain('tidak berlaku');
    expect(options.body).toContain('tanpa');
    expect(options.body).toContain('(alpa)');
    expect(options.body).toContain('checkbox');
    expect(options.initialFocusSelector).toBe('#izin-declaration-check');

    const continueButton = options.footer[1];
    expect(continueButton.label).toBe(label);
    expect(continueButton.disabled).toBe(true);
    expect(h.proceed.disabled).toBe(true);
    continueButton.onClick(); // even synthetic click without checkbox cannot bypass
    expect(execute).not.toHaveBeenCalled();

    // Modal yang sama tidak boleh ditampilkan dua kali secara bersamaan.
    expect(h.declaration.request(action, execute)).toBe(false);
    h.checkbox.checked = true;
    h.listeners.change();
    expect(h.proceed.disabled).toBe(false);
    continueButton.onClick();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(h.ui.hideModal).toHaveBeenCalledOnce();
    continueButton.onClick();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('membatalkan melalui Batal atau tutup tanpa mengekspor dokumen', () => {
    const h = createHarness();
    const execute = vi.fn();
    h.declaration.request('print', execute);
    const options = h.getOptions();
    options.footer[0].onClick();
    expect(execute).not.toHaveBeenCalled();
    expect(h.ui.hideModal).toHaveBeenCalledTimes(1);
    expect(h.declaration.request('print', execute)).toBe(true);
    h.getOptions().onClose();
    expect(execute).not.toHaveBeenCalled();
  });

  it('meminta persetujuan baru setiap kali tindakan dimulai', () => {
    const h = createHarness();
    const execute = vi.fn();
    h.declaration.request('pdf', execute);
    h.checkbox.checked = true;
    h.listeners.change();
    h.getOptions().footer[1].onClick();
    expect(execute).toHaveBeenCalledTimes(1);

    h.declaration.request('print', execute);
    expect(h.checkbox.checked).toBe(false);
    expect(h.proceed.disabled).toBe(true);
  });

  it('menolak melanjutkan bila template berubah atau elemen modal tidak tersedia', () => {
    const h = createHarness();
    const execute = vi.fn();
    h.declaration.request('pdf', execute);
    h.checkbox.checked = true;
    h.listeners.change();
    h.state.getActiveTemplate.mockReturnValue('dpu');
    h.getOptions().footer[1].onClick();
    expect(execute).not.toHaveBeenCalled();

    const broken = createHarness();
    broken.elements.delete('modal-footer');
    expect(broken.declaration.request('pdf', execute)).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });
});
