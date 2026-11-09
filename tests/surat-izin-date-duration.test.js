import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function createContext() {
  const ctx = {};
  runInNewContext(read('js/utils.js'), ctx);
  runInNewContext(read('templates/surat-izin.js'), ctx);
  runInNewContext(read('js/validation.js'), ctx);
  return {
    template: runInNewContext('TemplateSuratIzin', ctx),
    validation: runInNewContext('Validation', ctx),
  };
}

describe('Surat Izin — tanggal Indonesia dan lama izin 1 sampai 7', () => {
  it('menghasilkan hari/tanggal lengkap dalam zona independen', () => {
    const { template } = createContext();
    expect(template.formatHariTanggalIzin('2026-11-09')).toBe('Senin, 09 November 2026');
    expect(template.formatHariTanggalIzin('2024-02-29')).toBe('Kamis, 29 Februari 2024');
    expect(template.formatHariTanggalIzin('2026-12-31')).toBe('Kamis, 31 Desember 2026');
    for (const input of ['2025-02-29', '2026-13-01', '2026-02-31', '9 November 2026']) {
      expect(template.formatHariTanggalIzin(input)).toBe('');
    }
  });

  it('mengonversi seluruh lama izin 1–7 dan menolak 0, 8, pecahan serta teks', () => {
    const { template } = createContext();
    for (const [number, word] of ['satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh'].entries()) {
      expect(template.formatLamaIzin(number + 1)).toBe((number + 1) + ' (' + word + ') Hari');
    }
    for (const bad of [0, 8, 1.5, -1, 'dua', '2 hari', '', null]) {
      expect(template.formatLamaIzin(bad)).toBe('');
    }
  });

  it('memvalidasi tanggal serta rentang dan bilangan bulat sebelum cetak/PDF', () => {
    const { template, validation } = createContext();
    const data = template.createDefaultData();
    data.murid.namaOrangTuaWali = 'Wali';
    data.murid.namaMurid = 'Siswa';
    data.murid.kelasMurid = 'VIII';
    data.izin.alasanIzin = 'sakit';
    data.izin.hariTanggalIzin = '2026-11-09';
    data.izin.durasiIzin = 7;
    expect(validation.formTemplate(data, template).valid).toBe(true);
    for (const invalid of [0, 8, 2.5, 'dua']) {
      data.izin.durasiIzin = invalid;
      expect(validation.formTemplate(data, template).errors.some(
        error => error.field === 'izin.durasiIzin'
      )).toBe(true);
    }
    data.izin.durasiIzin = 1;
    data.izin.hariTanggalIzin = '2026-02-30';
    expect(validation.formTemplate(data, template).errors.some(
      error => error.field === 'izin.hariTanggalIzin'
    )).toBe(true);
  });

  it('menormalisasi format draf lama yang dapat dikenali tanpa menghapus data lain', () => {
    const { template } = createContext();
    expect(template.normalizeLegacyIzinFields({
      hariTanggalIzin: 'Senin, 9 November 2026',
      durasiIzin: '3 (tiga) hari',
    })).toMatchObject({
      hariTanggalIzin: '2026-11-09', durasiIzin: 3,
    });
    expect(template.normalizeLegacyIzinFields({
      hariTanggalIzin: '2026-11-09', durasiIzin: 2,
    })).toBeNull();
    expect(template.normalizeLegacyIzinFields({
      hariTanggalIzin: 'tanggal yang tidak diketahui', durasiIzin: 'sepuasnya',
    })).toBeNull();
  });
});
