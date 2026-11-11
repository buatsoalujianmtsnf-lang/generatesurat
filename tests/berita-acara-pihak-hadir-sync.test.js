import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it, expect, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function setup() {
  const ctx = {
    console: { info: vi.fn(), warn: vi.fn() },
    State: {
      getMarginMm: () => ({ top: 20, bottom: 20, left: 25.4, right: 25.4 }),
      getTypography: () => ({ fontFamily: 'Times New Roman', fontSize: 12, lineHeight: 1.2 }),
    },
    KopEditor: { renderKopHtml: () => '<div class="doc-kop">KOP</div>' },
  };
  runInNewContext(read('js/utils.js'), ctx);
  runInNewContext(read('templates/berita-acara-pertemuan-ortu.js'), ctx);
  runInNewContext(read('js/validation.js'), ctx);
  const source = read('js/preview-renderer.js');
  const hooked = source.replace(
    '    init,\n    render,\n    setZoomMode:',
    '    init,\n    render,\n    buildDocumentHtml: _buildDocumentHtml,\n    setZoomMode:'
  );
  expect(hooked).not.toBe(source);
  runInNewContext(hooked, ctx);
  return {
    tpl: runInNewContext('TemplateBeritaAcaraPertemuanOrtu', ctx),
    renderer: runInNewContext('PreviewRenderer', ctx),
    validation: runInNewContext('Validation', ctx),
  };
}

describe('Attendance and signature synchronization in Berita Acara', () => {
  it('provides five stable attendee slots, with the first two bound to student identity', () => {
    const { tpl } = setup();
    const data = tpl.createDefaultData();
    expect(data.pihakHadir).toHaveLength(5);
    expect(data.pihakAutoSyncV1).toBe(true);
    const section = tpl.formSections.find(section => section.id === 'pihakHadir');
    expect(section.protectedCount).toBe(5);
    expect(section.syncedCount).toBe(2);
    data.siswa.namaOrangTua = 'Ibu Wali';
    data.siswa.nama = 'Anak Contoh';
    const parties = tpl.getPihakHadir(data);
    expect(parties.map(x => x.nama).slice(0, 2)).toEqual(['Ibu Wali', 'Anak Contoh']);
    expect(parties.map(x => x.jabatan)).toEqual([
      'Orang Tua/Wali Siswa',
      'Siswa yang Bersangkutan',
      'Wali Kelas',
      'Guru BK/Bidang Kesiswaan',
      'Kepala Madrasah',
    ]);
    expect(tpl.normalizePihakHadir(data)).toMatchObject({ pihakAutoSyncV1: true });
    data.pihakHadir = parties;
    expect(tpl.normalizePihakHadir(data)).toBeNull();
    data.siswa.namaOrangTua = 'Wali Baru';
    expect(tpl.normalizePihakHadir(data).pihakHadir[0].nama).toBe('Wali Baru');
  });

  it('uses attendee names and freely entered statuses for all five signature positions', () => {
    const { tpl, renderer } = setup();
    const data = tpl.createDefaultData();
    data.siswa.namaOrangTua = 'Wali Murid Baru';
    data.siswa.nama = 'Siswa Baru';
    data.siswa.kelas = 'VIII';
    data.pihakHadir[2].nama = 'Pak Ahmad';
    data.pihakHadir[2].jabatan = 'Wali Kelas VIII A';
    data.pihakHadir[3].nama = 'Bu Siti';
    data.pihakHadir[3].jabatan = 'Koordinator BK dan Kesiswaan';
    data.pihakHadir[4].nama = 'Pak Hasan';
    data.pihakHadir[4].jabatan = 'Kepala Sekolah';
    data.penandatangan = {
      waliKelas: 'NAMA LAMA WALIKELAS',
      guruBk: 'NAMA LAMA BK',
      kepala: 'NAMA LAMA KEPALA',
      nipWaliKelas: '111',
      nipGuruBk: '222',
      nipKepala: '333',
    };
    const html = renderer.buildDocumentHtml(tpl, data, {}, null, null);
    for (const value of [
      'Wali Murid Baru', 'Siswa Baru', 'Pak Ahmad', 'Wali Kelas VIII A',
      'Bu Siti', 'Koordinator BK dan Kesiswaan', 'Pak Hasan', 'Kepala Sekolah',
      'NIP. 111', 'NIP. 222', 'NIP. 333',
    ]) expect(html).toContain(value);
    expect(html).not.toContain('NAMA LAMA WALIKELAS');
    expect(html).not.toContain('NAMA LAMA BK');
    expect(html).not.toContain('NAMA LAMA KEPALA');
    expect(html).not.toContain('Wali Kelas VIII,');
    expect(html).not.toContain('Kepala Madrasah MTs Nurul Falah,');
    // Signature order is consistent with attendee order.
    const signatures = html.slice(html.indexOf('class="doc-case__sign-grid"'));
    expect(signatures.indexOf('Wali Murid Baru')).toBeLessThan(signatures.indexOf('Siswa Baru'));
    expect(signatures.indexOf('Siswa Baru')).toBeLessThan(signatures.indexOf('Pak Ahmad'));
    expect(signatures.indexOf('Pak Ahmad')).toBeLessThan(signatures.indexOf('Bu Siti'));
    expect(signatures.indexOf('Bu Siti')).toBeLessThan(signatures.indexOf('Pak Hasan'));
  });

  it('preserves extra attendees and includes them in attendance but not the five signature slots', () => {
    const { tpl, renderer } = setup();
    const data = tpl.createDefaultData();
    data.pihakHadir.push(
      { id: 'extra-6', nama: 'Saksi Satu', jabatan: 'Ketua Komite' },
      { id: 'extra-7', nama: 'Saksi Dua', jabatan: 'Petugas TU' }
    );
    const items = tpl.getPihakHadir(data);
    expect(items).toHaveLength(7);
    const html = renderer.buildDocumentHtml(tpl, data, {}, null, null);
    expect(html).toContain('Saksi Satu');
    expect(html).toContain('Saksi Dua');
    expect(html.slice(html.indexOf('class="doc-case__sign-grid"'))).not.toContain('Saksi Satu');
  });

  it('migrates legacy independent signers without losing old attendee rows', () => {
    const { tpl } = setup();
    const legacy = tpl.createDefaultData();
    delete legacy.pihakAutoSyncV1;
    legacy.pihakHadir = [
      { id: 'legacy-p1', nama: 'Saksi Lama A', jabatan: 'Ketua Komite' },
      { id: 'legacy-p2', nama: 'Saksi Lama B', jabatan: 'Pengawas' },
    ];
    legacy.penandatangan = {
      waliKelas: 'Wali Lama', guruBk: 'BK Lama', kepala: 'Kepala Lama',
      nipWaliKelas: '', nipGuruBk: '', nipKepala: '',
    };
    legacy.siswa.namaOrangTua = 'Wali Baru';
    legacy.siswa.nama = 'Anak Baru';
    const patch = tpl.normalizePihakHadir(legacy);
    expect(patch.pihakAutoSyncV1).toBe(true);
    expect(patch.pihakHadir.map(row => row.nama)).toEqual([
      'Wali Baru', 'Anak Baru', 'Wali Lama', 'BK Lama', 'Kepala Lama',
      'Saksi Lama A', 'Saksi Lama B',
    ]);
    const updated = { ...legacy, ...patch };
    expect(tpl.normalizePihakHadir(updated)).toBeNull();
  });

  it('keeps required first two names and removes duplicate name inputs from signature form', () => {
    const { tpl, validation } = setup();
    const data = tpl.createDefaultData();
    const missing = validation.formTemplate(data, tpl).errors;
    expect(missing.some(x => x.field === 'pihakHadir[0].nama')).toBe(true);
    expect(missing.some(x => x.field === 'pihakHadir[1].nama')).toBe(true);
    const signer = tpl.formSections.find(section => section.id === 'penandatangan');
    expect(signer.fields.map(x => x.key)).toEqual([
      'penandatangan.tandaTanganOrangTuaDataUrl',
      'penandatangan.tandaTanganSiswaDataUrl',
      'penandatangan.nipWaliKelas',
      'penandatangan.nipGuruBk',
      'penandatangan.nipKepala',
    ]);
    const editor = read('js/form-renderer.js');
    expect(editor).toContain("const isProtected = idx < (section.protectedCount || 0)");
    expect(editor).toContain('if (isSynced)');
    expect(editor).toContain('input.readOnly = true');
    expect(editor).toContain('_syncBeritaAcaraPihakHadir(templateId)');
    expect(read('sw.js')).toContain("CACHE_PREFIX + 'v59'");
  });


  it('exposes two independent direct signature fields using the Surat Izin drawing widget', () => {
    const { tpl } = setup();
    const data = tpl.createDefaultData();
    expect(data.penandatangan.tandaTanganOrangTuaDataUrl).toBe('');
    expect(data.penandatangan.tandaTanganSiswaDataUrl).toBe('');
    const fields = tpl.formSections.find(section => section.id === 'penandatangan').fields;
    expect(fields.slice(0, 2).map(field => field.key)).toEqual([
      'penandatangan.tandaTanganOrangTuaDataUrl',
      'penandatangan.tandaTanganSiswaDataUrl',
    ]);
    for (const field of fields.slice(0, 2)) {
      expect(field.type).toBe('signature');
      expect(field.required).toBe(false);
    }
    const editor = read('js/form-renderer.js');
    expect(editor).toContain("case 'signature':");
    expect(editor).toContain('SignaturePad.mount(group');
    expect(editor).toContain('onChange: imageData => _saveFieldValue');
    const signaturePad = read('js/signature-pad.js');
    expect(signaturePad).toContain("canvas.toDataURL('image/png')");
    expect(signaturePad).toContain('signature-pad__undo');
    expect(signaturePad).toContain('signature-pad__redo');
    expect(signaturePad).toContain('signature-pad__clear');
  });

  it('renders each saved PNG only inside its matching parent/student signature box', () => {
    const { tpl, renderer } = setup();
    const data = tpl.createDefaultData();
    data.siswa.namaOrangTua = 'Wali Nomor Satu';
    data.siswa.nama = 'Siswa Nomor Dua';
    const parentPng = 'data:image/png;base64,iVBORw0KGgo=';
    const studentPng = 'data:image/png;base64,AAECAwQ=';
    data.penandatangan.tandaTanganOrangTuaDataUrl = parentPng;
    data.penandatangan.tandaTanganSiswaDataUrl = studentPng;
    const html = renderer.buildDocumentHtml(tpl, data, {}, null, null);
    const signature = html.slice(html.indexOf('class="doc-case__sign-grid"'));
    const parentIndex = signature.indexOf('src="' + parentPng + '"');
    const parentName = signature.indexOf('Wali Nomor Satu', parentIndex);
    const studentIndex = signature.indexOf('src="' + studentPng + '"');
    const studentName = signature.indexOf('Siswa Nomor Dua', studentIndex);
    expect(parentIndex).toBeGreaterThan(-1);
    expect(parentName).toBeGreaterThan(parentIndex);
    expect(studentIndex).toBeGreaterThan(parentName);
    expect(studentName).toBeGreaterThan(studentIndex);
    expect(signature).toContain('alt="Tanda tangan Orang Tua/Wali Siswa"');
    expect(signature).toContain('alt="Tanda tangan Siswa yang Bersangkutan"');
    expect(signature.match(/object-fit:contain/g)).toHaveLength(2);
  });

  it('does not require drawn signatures and retains both manual signing spaces', () => {
    const { tpl, renderer } = setup();
    const data = tpl.createDefaultData();
    const html = renderer.buildDocumentHtml(tpl, data, {}, null, null);
    const grid = html.slice(html.indexOf('class="doc-case__sign-grid"'));
    expect(grid).not.toContain('alt="Tanda tangan Orang Tua/Wali Siswa"');
    expect(grid).not.toContain('alt="Tanda tangan Siswa yang Bersangkutan"');
    expect((grid.match(/height:20mm/g) || []).length).toBeGreaterThanOrEqual(2);
    data.penandatangan.tandaTanganOrangTuaDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const partiallySigned = renderer.buildDocumentHtml(tpl, data, {}, null, null);
    expect(partiallySigned).toContain('alt="Tanda tangan Orang Tua/Wali Siswa"');
    expect(partiallySigned).not.toContain('alt="Tanda tangan Siswa yang Bersangkutan"');
  });

  it('does not render malformed, oversized, or injected signature URLs', () => {
    const { tpl, renderer } = setup();
    const data = tpl.createDefaultData();
    const badUrls = [
      'javascript:alert(1)',
      'data:image/svg+xml,<svg onload=alert(1)>',
      'https://example.com/sign.png',
      'data:image/png;base64,abc" onerror="alert(1)',
      'data:image/png;base64,' + 'A'.repeat(350001),
    ];
    for (const bad of badUrls) {
      data.penandatangan.tandaTanganOrangTuaDataUrl = bad;
      data.penandatangan.tandaTanganSiswaDataUrl = bad;
      expect(tpl.getSignatureDataUrl(bad)).toBe('');
      const html = renderer.buildDocumentHtml(tpl, data, {}, null, null);
      expect(html).not.toContain('alt="Tanda tangan Orang Tua/Wali Siswa"');
      expect(html).not.toContain('alt="Tanda tangan Siswa yang Bersangkutan"');
      expect(html).not.toContain('src="javascript:');
      expect(html).not.toContain('<svg onload');
    }
  });

  it('escapes attendee statuses to prevent HTML injection in PDF and print markup', () => {
    const { tpl, renderer } = setup();
    const data = tpl.createDefaultData();
    data.pihakHadir[2].jabatan = '<img src=x onerror=alert(1)>';
    data.pihakHadir[2].nama = 'Nama <script>alert(1)</script>';
    const html = renderer.buildDocumentHtml(tpl, data, {}, null, null);
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
