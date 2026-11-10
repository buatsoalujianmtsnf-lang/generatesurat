import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function harness() {
  const context = { console: { warn: vi.fn(), info: vi.fn() } };
  runInNewContext(read('js/utils.js'), context);
  for (const file of [
    'templates/surat-permohonan-pindah.js',
    'templates/surat-keterangan-pindah.js',
    'templates/mutasi-masuk.js',
    'templates/siswa-baru.js',
  ]) runInNewContext(read(file), context);
  const request = runInNewContext('TemplateSuratPermohonanPindah', context);
  const certificate = runInNewContext('TemplateSuratKeteranganPindah', context);
  const incoming = runInNewContext('TemplateMutasiMasuk', context);
  const newStudents = runInNewContext('TemplateSiswaBaru', context);
  const registry = new Map([request, certificate, incoming, newStudents]
    .map(template => [template.TEMPLATE_ID, template]));
  context.TemplateRegistry = {
    get: id => registry.get(id) || null,
    getAll: () => [...registry.values()],
  };
  const source = read('js/data-manager.js');
  const injected = source.replace('    init,\n    mount,',
    '    validatePayloadForTest: _validatePayload,\n    init,\n    mount,');
  expect(injected).not.toBe(source);
  runInNewContext(injected, context);
  runInNewContext(read('js/validation.js'), context);
  const manager = runInNewContext('DataManager', context);
  const validator = runInNewContext('Validation', context);
  return { manager, validator, request, certificate, incoming, newStudents };
}

describe('Audit Surat Pindah: draft and form contracts', () => {
  it('accepts student-object forms in both new templates for draft/backup restore', () => {
    const h = harness();
    for (const template of [h.request, h.certificate]) {
      const form = template.createDefaultData();
      form.siswa.namaLengkap = 'Contoh';
      const payload = {
        activeTemplate: template.TEMPLATE_ID,
        forms: { [template.TEMPLATE_ID]: form },
      };
      expect(h.manager.validatePayloadForTest(payload).valid).toBe(true);
    }
  });

  it('rejects array in single-student section and object in repeatable student section', () => {
    const h = harness();
    const request = h.request.createDefaultData();
    request.siswa = [{ namaLengkap: 'Salah Bentuk' }];
    const a = h.manager.validatePayloadForTest({
      activeTemplate: h.request.TEMPLATE_ID,
      forms: { [h.request.TEMPLATE_ID]: request },
    });
    expect(a.valid).toBe(false);
    expect(a.reason).toContain('siswa');

    const incoming = h.incoming.createDefaultData();
    incoming.siswa = { namaSiswa: 'Bukan Array' };
    const b = h.manager.validatePayloadForTest({
      activeTemplate: h.incoming.TEMPLATE_ID,
      forms: { [h.incoming.TEMPLATE_ID]: incoming },
    });
    expect(b.valid).toBe(false);
    expect(b.reason).toContain('siswa');
    expect(b.reason).toContain('array');
  });

  it('keeps existing repeatable students and participants compatible with backup validation', () => {
    const h = harness();
    for (const template of [h.incoming, h.newStudents]) {
      const form = template.createDefaultData();
      expect(Array.isArray(form.siswa)).toBe(true);
      expect(h.manager.validatePayloadForTest({
        activeTemplate: template.TEMPLATE_ID,
        forms: { [template.TEMPLATE_ID]: form },
      }).valid).toBe(true);
    }
  });

  it('rejects malformed child section without discarding partial legacy backup sections', () => {
    const h = harness();
    const id = h.certificate.TEMPLATE_ID;
    expect(h.manager.validatePayloadForTest({
      activeTemplate: id, forms: { [id]: { surat: { nomorSurat: '01' } } },
    }).valid).toBe(true);
    const result = h.manager.validatePayloadForTest({
      activeTemplate: id, forms: { [id]: { siswa: null } },
    });
    expect(result.valid).toBe(false);
  });

  it('requires a 10-digit NISN, preserving leading zeroes', () => {
    const h = harness();
    for (const template of [h.request, h.certificate]) {
      const nisnField = template.formSections.flatMap(section => section.fields)
        .find(field => field.key === 'siswa.nisn');
      expect(nisnField).toMatchObject({
        type: 'text', validator: 'nisn', maxLength: 10, inputMode: 'numeric',
      });
      const data = template.createDefaultData();
      data.siswa.nisn = '123';
      expect(h.validator.formTemplate(data, template).errors.some(error =>
        error.field === 'siswa.nisn' && error.message.includes('10 digit'))).toBe(true);
      data.siswa.nisn = '0123456789';
      expect(h.validator.formTemplate(data, template).errors.some(error =>
        error.field === 'siswa.nisn')).toBe(false);
    }
    expect(read('js/form-renderer.js')).toContain("fieldDef.inputMode === 'numeric'");
  });

  it('avoids raw dates and preserves multiline destination data in the preview', () => {
    const source = read('js/preview-renderer.js');
    expect(source).toContain('function _formatPindahDate(value)');
    expect(source).toContain('Date.UTC(year, month - 1, day)');
    expect(source).toContain('_formatPindahDate(pindah.tanggalPermohonan)');
    expect(source).toContain('white-space:pre-line');
  });
});
