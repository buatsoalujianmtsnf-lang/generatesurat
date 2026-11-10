import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
// index.html is the runtime source of truth for templates loaded before the registry.
// Avoid a manually maintained eight-template fixture that silently misses additions.
const indexHtml = read('index.html');
const runtimeScripts = [...indexHtml.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)]
  .map(match => match[1]);
const templateFiles = runtimeScripts
  .filter(path => /^templates\/[^/]+\.js$/.test(path))
  .map(path => [path.slice('templates/'.length, -'.js'.length), path]);

const REQUIRED_TEMPLATE_IDS = [
  'dpu',
  'mutasi-masuk',
  'siswa-baru',
  'ijop-permohonan',
  'ijop-sptjm-satpen',
  'ijop-rekomendasi-pengawas',
  'ijop-rekomendasi-kankemenag',
  'ijop-sptjm-kankemenag',
  'rekap-nilai',
  'surat-izin',
  'surat-permohonan-pindah',
  'surat-keterangan-pindah',
  'surat-pemberitahuan-kegiatan',
  'surat-keterangan-siswa-aktif',
];

function loadTemplateRegistry() {
  const context = { console: { info: vi.fn(), warn: vi.fn() } };
  runInNewContext(read('js/utils.js'), context, { filename: 'js/utils.js' });
  for (const [, path] of templateFiles) {
    runInNewContext(read(path), context, { filename: path });
  }
  runInNewContext(
    read('js/template-registry.js') + '\nglobalThis.__registry = TemplateRegistry; TemplateRegistry.init();',
    context,
    { filename: 'js/template-registry.js' },
  );
  return context.__registry;
}

describe('Application shell integration', () => {
  it('loads core scripts in dependency order, with the app bootstrap last', () => {
    const scripts = runtimeScripts;
    const position = path => scripts.indexOf(path);

    expect(position('js/utils.js')).toBeGreaterThanOrEqual(0);
    expect(position('js/utils.js')).toBeLessThan(position('js/storage.js'));
    expect(position('js/storage.js')).toBeLessThan(position('js/state.js'));
    expect(templateFiles).toHaveLength(REQUIRED_TEMPLATE_IDS.length);
    expect(templateFiles.map(([id]) => id)).toEqual(REQUIRED_TEMPLATE_IDS);
    expect(new Set(scripts).size).toBe(scripts.length);
    for (const [, templatePath] of templateFiles) {
      expect(position(templatePath), templatePath).toBeGreaterThan(position('js/validation.js'));
      expect(position(templatePath), templatePath).toBeLessThan(position('js/template-registry.js'));
    }
    expect(position('js/preview-renderer.js')).toBeLessThan(position('js/print.js'));
    expect(position('js/pdf-export.js')).toBeLessThan(position('js/app.js'));
    expect(position('js/platform.js')).toBeLessThan(position('js/app.js'));
    // Icon hydrator runs after the main app so dynamic UI is fully mounted.
    expect(position('js/app.js')).toBe(scripts.length - 2);
    expect(position('js/icon-init.js')).toBe(scripts.length - 1);
  });

  it('loads and registers all runtime templates with unique stable identifiers', () => {
    const registry = loadTemplateRegistry();
    const templates = registry.getAll();
    const ids = templates.map(template => template.TEMPLATE_ID);

    expect(registry.count()).toBe(REQUIRED_TEMPLATE_IDS.length);
    expect(new Set(ids).size).toBe(REQUIRED_TEMPLATE_IDS.length);
    expect(ids).toEqual(templateFiles.map(([id]) => id));
    expect(registry.get('not-a-template')).toBeNull();
  });

  it('provides required metadata and form contracts for every registered template', () => {
    const registry = loadTemplateRegistry();
    for (const template of registry.getAll()) {
      expect(template.meta?.id, template.TEMPLATE_ID).toBe(template.TEMPLATE_ID);
      expect(template.meta?.name, template.TEMPLATE_ID).toBeTruthy();
      expect(template.meta?.description, template.TEMPLATE_ID).toBeTruthy();
      expect(['portrait', 'landscape']).toContain(template.meta?.orientation);
      expect(typeof template.createDefaultData, template.TEMPLATE_ID).toBe('function');
      const defaults = template.createDefaultData();
      expect(defaults, template.TEMPLATE_ID).toBeTruthy();
      expect(typeof defaults, template.TEMPLATE_ID).toBe('object');
      expect(Array.isArray(defaults), template.TEMPLATE_ID).toBe(false);
      expect(Array.isArray(template.formSections), template.TEMPLATE_ID).toBe(true);
      expect(template.formSections.length, template.TEMPLATE_ID).toBeGreaterThan(0);
      expect(Array.isArray(template.tableColumns), template.TEMPLATE_ID).toBe(true);
    }
  });

  it('verifies the new templates expose their expected form structures', () => {
    const registry = loadTemplateRegistry();
    const rekap = registry.get('rekap-nilai');
    const izin = registry.get('surat-izin');

    expect(rekap.meta.orientation).toBe('landscape');
    expect(rekap.createDefaultData().murid).toBeDefined();
    expect(Array.isArray(rekap.createDefaultData().murid)).toBe(true);
    expect(rekap.formSections.length).toBeGreaterThan(0);

    expect(izin.meta.orientation).toBe('portrait');
    expect(izin.meta.usesKop).toBe(false);
    expect(izin.createDefaultData().murid).toBeDefined();
    expect(izin.createDefaultData().izin).toBeDefined();
    expect(izin.createDefaultData().pengirim).toBeDefined();
    expect(izin.formSections.map(section => section.id)).toEqual([
      'sekolah', 'murid', 'izin', 'pengirim',
    ]);
    expect(izin.tableColumns).toHaveLength(0);
    const signature = izin.formSections.find(section => section.id === 'pengirim').fields
      .find(field => field.key === 'pengirim.tandaTanganDataUrl');
    expect(signature.type).toBe('signature');
    expect(signature.required).toBe(false);
    expect(izin.createDefaultData().pengirim.tandaTanganDataUrl).toBe('');
    const fields = izin.formSections.find(section => section.id === 'izin').fields;
    const tanggal = fields.find(field => field.key === 'izin.hariTanggalIzin');
    const durasi = fields.find(field => field.key === 'izin.durasiIzin');
    expect(tanggal.type).toBe('date');
    expect(tanggal.required).toBe(true);
    expect(durasi.type).toBe('number');
    expect(durasi).toMatchObject({ min: 1, max: 7, step: 1, integer: true, required: true });
    const alasan = fields.find(field => field.key === 'izin.alasanIzin');
    const detail = fields.find(field => field.key === 'izin.alasanIzinLainnya');
    expect(alasan.type).toBe('select');
    expect(alasan.required).toBe(true);
    expect(alasan.options.map(option => option.label)).toEqual([
      'Pilih alasan izin...', 'Sakit', 'Mengikuti orang tua', 'Urusan keluarga',
      'Acara keluarga', 'Berobat', 'Musibah keluarga', 'Keperluan lainnya',
    ]);
    expect(detail.required).toBe(true);
    expect(detail.showIf({ izin: { alasanIzin: 'lainnya' } })).toBe(true);
    expect(detail.showIf({ izin: { alasanIzin: 'sakit' } })).toBe(false);
  });

  it('validates the required other-reason detail and rejects invalid selections', () => {
    const registry = loadTemplateRegistry();
    const izin = registry.get('surat-izin');
    const ctx = {};
    runInNewContext(read('js/utils.js'), ctx);
    runInNewContext(read('js/validation.js'), ctx);
    const validation = runInNewContext('Validation', ctx);
    const data = izin.createDefaultData();
    data.murid.namaOrangTuaWali = 'Orang Tua';
    data.murid.namaMurid = 'Siswa';
    data.murid.kelasMurid = 'VII A';
    data.izin.hariTanggalIzin = '2026-11-09';
    data.izin.durasiIzin = 1;

    data.izin.alasanIzin = 'lainnya';
    expect(validation.formTemplate(data, izin).errors.some(error =>
      error.field === 'izin.alasanIzinLainnya')).toBe(true);
    data.izin.alasanIzinLainnya = 'kegiatan keluarga mendesak';
    expect(validation.formTemplate(data, izin).valid).toBe(true);
    data.izin.alasanIzin = 'sakit';
    data.izin.alasanIzinLainnya = '';
    expect(validation.formTemplate(data, izin).valid).toBe(true);
    data.izin.alasanIzin = 'pilihan-palsu';
    expect(validation.formTemplate(data, izin).errors.some(error =>
      error.field === 'izin.alasanIzin')).toBe(true);
  });

  it('keeps install and update controls hidden until browser support is available', () => {
    const html = read('index.html');
    expect(html).toMatch(/id="btn-install-app"[^>]*hidden/);
    expect(html).toMatch(/id="btn-update-app"[^>]*hidden/);
    expect(read('js/platform.js')).toContain("window.addEventListener('beforeinstallprompt'");
    expect(read('js/platform.js')).toContain("window.addEventListener('appinstalled'");
  });
});
