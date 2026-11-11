import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function setup() {
  const ctx = {
    console: { warn: vi.fn(), info: vi.fn() },
    State: {
      getMarginMm: () => ({ top: 20, bottom: 20, left: 20, right: 20 }),
      getTypography: () => ({ fontFamily: 'Times New Roman', fontSize: 12, lineHeight: 1.2 }),
    },
    KopEditor: { renderKopHtml: () => '<div class="doc-kop">KOP resmi</div>' },
  };
  runInNewContext(read('js/utils.js'), ctx);
  runInNewContext(read('templates/notulensi-rapat.js'), ctx);
  runInNewContext(read('js/validation.js'), ctx);
  const rendererSource = read('js/preview-renderer.js');
  const previewWithTestHook = rendererSource.replace(
    '    init,\n    render,\n    setZoomMode:',
    '    init,\n    render,\n    buildDocumentHtml: _buildDocumentHtml,\n    setZoomMode:',
  );
  expect(previewWithTestHook).not.toBe(rendererSource);
  runInNewContext(previewWithTestHook, ctx);
  return {
    tpl: runInNewContext('TemplateNotulensiRapat', ctx),
    renderer: runInNewContext('PreviewRenderer', ctx),
    validation: runInNewContext('Validation', ctx),
  };
}

describe('Notulensi Rapat dan lampiran daftar hadir dari dokumen Word', () => {
  it('menyediakan seluruh A–I dan lampiran A–E serta pemisah halaman', () => {
    const { tpl, renderer } = setup();
    const data = tpl.createDefaultData();
    data.surat.nomor = '010/MTs/2026';
    data.rapat.namaJenis = 'Rapat Komite Madrasah';
    const html = renderer.buildDocumentHtml(tpl, data, {}, null, null);
    expect(tpl.meta.usesKop).toBe(true);
    expect(tpl.meta.orientation).toBe('portrait');
    expect(renderer.usesMultiPageLayout(tpl.TEMPLATE_ID)).toBe(true);
    expect(html).toContain('NOTULENSI RAPAT');
    expect(html).toContain('010/MTs/2026');
    expect(html).toContain('Rapat Komite Madrasah');
    expect(html).toContain('class="doc-annex-start"');
    expect(html).toContain('DAFTAR HADIR PESERTA RAPAT');
    const parts = [
      'A. IDENTITAS RAPAT', 'B. TUJUAN RAPAT', 'C. SUSUNAN ACARA',
      'D. JALANNYA RAPAT DAN HASIL PEMBAHASAN', 'E. HASIL KEPUTUSAN RAPAT',
      'F. RENCANA TINDAK LANJUT', 'G. CATATAN TAMBAHAN/KHUSUS',
      'H. PENUTUP', 'I. PENGESAHAN',
      'B. DAFTAR KEHADIRAN PESERTA', 'C. REKAPITULASI KEHADIRAN',
      'D. CATATAN KEHADIRAN', 'E. PENGESAHAN',
    ];
    parts.forEach(heading => expect(html).toContain(heading));
    expect(html.match(/class="doc-kop"/g)).toHaveLength(2);
    expect(html.indexOf('class="doc-annex-start"'))
      .toBeGreaterThan(html.indexOf('I. PENGESAHAN'));
    expect(html).toContain('<th scope="col"');
    expect(html).toContain('Tanda Tangan');
    expect(html).toContain('Kepala MTs Nurul Falah,');
  });

  it('menghitung status dan persentase dari peserta yang benar-benar terdaftar', () => {
    const { tpl, renderer } = setup();
    const data = tpl.createDefaultData();
    data.rapat.jumlahDiundang = 5;
    data.peserta = [
      { id: '1', nama: 'Ani', jabatan: 'Guru', status: 'Hadir' },
      { id: '2', nama: 'Budi', jabatan: 'Komite', status: 'Hadir' },
      { id: '3', nama: 'Cici', jabatan: 'Staf', status: 'Izin' },
      { id: '4', nama: 'Dedi', jabatan: 'Siswa', status: 'Sakit' },
      { id: '5', nama: 'Eka', jabatan: 'TU', status: 'Tanpa Keterangan' },
    ];
    const summary = tpl.getAttendanceSummary(data);
    expect(summary.hadir).toBe(2);
    expect(summary.izin).toBe(1);
    expect(summary.sakit).toBe(1);
    expect(summary.tanpaKeterangan).toBe(1);
    expect(summary.tidakHadir).toBe(3);
    expect(summary.diundang).toBe(5);
    expect(summary.persenHadir).toBe('40');
    const html = renderer.buildDocumentHtml(tpl, data, {}, null, null);
    for (const nama of ['Ani', 'Budi', 'Cici', 'Dedi', 'Eka']) expect(html).toContain(nama);
    expect(html).toContain('40 %');
    expect(html).toContain('2 orang');
    expect(html).toContain('3 orang');
  });

  it('menyesuaikan tabel tindak lanjut tepat dengan jumlah entri form, termasuk saat kosong', () => {
    const { tpl, renderer } = setup();
    const data = tpl.createDefaultData();
    for (const count of [0, 1, 3, 6, 24]) {
      data.tindakLanjut = Array.from({ length: count }, (_, index) => ({
        id: 'follow-' + index, keputusan: 'Keputusan ' + (index + 1),
        penanggungJawab: index % 2 ? '' : 'Petugas ' + (index + 1), batasWaktu: '',
      }));
      const html = renderer.buildDocumentHtml(tpl, data, {}, null, null);
      const section = html.split('F. RENCANA TINDAK LANJUT')[1].split('Mekanisme Monitoring')[0];
      expect((section.match(/<tr>/g) || []).length).toBe(count + 1); // header + data
      if (count) expect(section).toContain('Keputusan ' + count);
    }
    data.tindakLanjut = [{ id: 'new-blank', keputusan: '', penanggungJawab: '', batasWaktu: '' }];
    const blank = renderer.buildDocumentHtml(tpl, data, {}, null, null)
      .split('F. RENCANA TINDAK LANJUT')[1].split('Mekanisme Monitoring')[0];
    expect((blank.match(/<tr>/g) || []).length).toBe(2);
  });

  it('menyesuaikan tabel daftar hadir tepat dengan entri form, bukan minimum 20 baris', () => {
    const { tpl, renderer } = setup();
    const data = tpl.createDefaultData();
    for (const count of [0, 1, 2, 20, 22, 31]) {
      data.peserta = Array.from({ length: count }, (_, index) =>
        ({ id: String(index + 1), nama: 'Peserta ' + (index + 1), status: 'Hadir' }));
      const html = renderer.buildDocumentHtml(tpl, data, {}, null, null);
      const section = html.split('B. DAFTAR KEHADIRAN PESERTA')[1].split('C. REKAPITULASI KEHADIRAN')[0];
      expect((section.match(/<tr>/g) || []).length).toBe(count + 1); // header + data
      if (count) expect(section).toContain('Peserta ' + count);
    }
    data.peserta = [{ id: 'new-blank', nama: '', jabatan: '', status: 'Hadir' }];
    const blank = renderer.buildDocumentHtml(tpl, data, {}, null, null)
      .split('B. DAFTAR KEHADIRAN PESERTA')[1].split('C. REKAPITULASI KEHADIRAN')[0];
    expect((blank.match(/<tr>/g) || []).length).toBe(2);
    expect(tpl.getAttendanceSummary(data).terdata).toBe(0);
  });

  it('menghapus keterangan jika ada dan menjaga label panjang rekapitulasi satu baris', () => {
    const { tpl, renderer } = setup();
    const data = tpl.createDefaultData();
    const html = renderer.buildDocumentHtml(tpl, data, {}, null, null);
    const titlesAndLabels = tpl.formSections.flatMap(section => [
      section.title, ...(section.fields || []).map(field => field.label),
    ]);
    for (const value of [...titlesAndLabels, html]) {
      expect(value).not.toMatch(/\(jika ada\)/i);
    }
    const recap = html.split('C. REKAPITULASI KEHADIRAN')[1].split('D. CATATAN KEHADIRAN')[0];
    for (const label of ['Jumlah Peserta yang Diundang', 'Jumlah Peserta Tanpa Keterangan']) {
      expect(recap).toMatch(new RegExp('white-space:nowrap;[^"]*">' + label + '<\\/td>'));
    }
  });

  it('mempertahankan urutan acara, topik, keputusan, tindak lanjut, dan catatan', () => {
    const { tpl, renderer } = setup();
    const data = tpl.createDefaultData();
    data.acara = [{ id: 'x', teks: 'Sambutan' }];
    data.tujuan = [{ id: 't', teks: 'Peningkatan mutu' }];
    data.pembahasan = [{ id: 'p', topik: 'Akreditasi', uraian: 'Pelaksanaan',
      tanggapan: 'Usul pembinaan', kesimpulan: 'Disetujui' }];
    data.keputusan = [{ id: 'k', teks: 'Bentuk panitia' }];
    data.tindakLanjut = [{ id: 'l', keputusan: 'Susun rencana', penanggungJawab: 'Sekretaris',
      batasWaktu: '2026-11-20' }];
    data.catatanKhusus = [{ id: 'c', teks: 'Tindak lanjut anggaran' }];
    const html = renderer.buildDocumentHtml(tpl, data, {}, null, null);
    expect(html.indexOf('Pembukaan.')).toBeLessThan(html.indexOf('Sambutan'));
    expect(html.indexOf('Sambutan')).toBeLessThan(html.indexOf('Penutup.'));
    for (const value of ['Peningkatan mutu', 'Akreditasi', 'Usul pembinaan', 'Disetujui',
      'Bentuk panitia', 'Susun rencana', 'Sekretaris', '20 November 2026',
      'Tindak lanjut anggaran']) expect(html).toContain(value);
  });

  it('menerima PNG tanda tangan dan menolak HTML, SVG, atau data URL asing', () => {
    const { tpl, renderer } = setup();
    const data = tpl.createDefaultData();
    data.rapat.namaJenis = '<img src=x onerror=alert(1)>';
    data.peserta = [{ id: '1', nama: '<svg onload=alert(1)>', jabatan: 'Guru',
      status: 'Hadir', tandaTanganDataUrl: 'data:image/svg+xml,<svg/>' }];
    let html = renderer.buildDocumentHtml(tpl, data, {}, null, null);
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;svg');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('data:image/svg+xml');
    data.peserta[0].tandaTanganDataUrl = 'data:image/png;base64,aGVsbG8=';
    html = renderer.buildDocumentHtml(tpl, data, {}, null, null);
    expect(html).toContain('data:image/png;base64,aGVsbG8=');
    expect(tpl.safeSignature('https://evil.example/a.png')).toBe('');
  });

  it('menolak jumlah undangan yang kurang dan waktu selesai sebelum mulai', () => {
    const { tpl, validation } = setup();
    const data = tpl.createDefaultData();
    data.rapat.jumlahDiundang = 1;
    data.peserta = [
      { id: '1', nama: 'Ani', status: 'Hadir' },
      { id: '2', nama: 'Budi', status: 'Hadir' },
    ];
    data.rapat.waktuMulai = '10.00';
    data.rapat.waktuSelesai = '08.30';
    const errors = validation.formTemplate(data, tpl).errors;
    expect(errors.some(item => item.field === 'rapat.jumlahDiundang')).toBe(true);
    expect(errors.some(item => item.field === 'rapat.waktuSelesai')).toBe(true);
  });

  it('memuat template melalui registry, rute dan app shell offline', () => {
    const html = read('index.html');
    const sw = read('sw.js');
    expect(html).toContain('src="templates/notulensi-rapat.js"');
    expect(sw).toContain("'./templates/notulensi-rapat.js'");
    expect(read('js/template-registry.js')).toContain('register(TemplateNotulensiRapat)');
    expect(read('js/routes.js')).toContain("'notulensi-rapat': 'notulensi-rapat'");
    expect(sw).toContain("CACHE_PREFIX + 'v56'");
  });
});
