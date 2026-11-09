import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function loadForm() {
  const groups = ['no', 'namaMurid', 'bab1_tp1', 'lm1', 'sts', 'sas', 'praktik', 'nilaiAkhir']
    .map(key => {
      const inputs = [{ disabled: false }];
      return {
        dataset: { fieldKey: key },
        hidden: false,
        querySelectorAll: vi.fn(() => inputs),
        inputs,
      };
    });
  const section = { querySelectorAll: vi.fn(() => groups) };
  const getElementById = vi.fn(id => id === 'section-murid' ? section : null);
  let mode = 'lengkap';
  const context = {
    document: { getElementById },
    State: { getFormData: vi.fn(() => ({ header: { modePengisian: mode } })) },
  };
  runInNewContext(read('js/form-renderer.js'), context);
  const form = runInNewContext('FormRenderer', context);
  return {
    form, groups, section, getElementById,
    setMode(next) { mode = next; },
  };
}

describe('Rekap Nilai: Format Saja menyembunyikan input nilai tanpa menghapus data', () => {
  it('hanya No. dan Nama Murid yang terlihat ketika mode Format Saja', () => {
    const h = loadForm();
    h.setMode('format');
    h.form.syncRekapNilaiMuridFields('rekap-nilai');
    expect(h.groups.filter(g => !g.hidden).map(g => g.dataset.fieldKey)).toEqual(['no', 'namaMurid']);
    for (const group of h.groups) {
      expect(group.inputs[0].disabled).toBe(group.hidden);
    }
  });

  it('mengembalikan semua field jika mode Lengkap dipilih lagi', () => {
    const h = loadForm();
    h.setMode('format');
    h.form.syncRekapNilaiMuridFields('rekap-nilai');
    h.setMode('lengkap');
    h.form.syncRekapNilaiMuridFields('rekap-nilai');
    expect(h.groups.every(group => !group.hidden && !group.inputs[0].disabled)).toBe(true);
  });

  it('tidak mengubah template surat lainnya', () => {
    const h = loadForm();
    h.setMode('format');
    h.form.syncRekapNilaiMuridFields('surat-izin');
    expect(h.getElementById).not.toHaveBeenCalled();
    expect(h.groups.every(group => !group.hidden)).toBe(true);
  });

  it('menyembunyikan input nilai tanpa menghapus nilai dari state', () => {
    const code = read('js/form-renderer.js');
    const template = read('templates/rekap-nilai.js');
    const css = read('css/components.css');
    expect(code).toContain("_syncRekapNilaiMuridFields(templateId);");
    expect(code).toContain("fieldDef.key === 'header.modePengisian'");
    expect(code).toContain('group.hidden = hide');
    expect(code).toContain('input.disabled = hide');
    expect(template).toContain("key: 'namaMurid'");
    expect(template).toContain("key: 'no'");
    expect(css).toContain('#section-murid .row-entry__body .form-group[hidden]');
  });
});
