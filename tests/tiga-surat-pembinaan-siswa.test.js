import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function setup() {
  const ctx = {
    console: { info: vi.fn(), warn: vi.fn() },
    State: {
      getMarginMm: () => ({ top: 20, bottom: 20, left: 25.4, right: 25.4 }),
      getTypography: () => ({ fontFamily: 'Times New Roman', fontSize: 12, lineHeight: 1.2 }),
    },
    KopEditor: { renderKopHtml: () => '<div class="doc-kop">KOP dari editor</div>' },
  };
  runInNewContext(read('js/utils.js'), ctx);
  const sources = [
    'templates/surat-panggilan-orang-tua.js',
    'templates/surat-perjanjian-siswa.js',
    'templates/berita-acara-pertemuan-ortu.js',
  ];
  sources.forEach(path => runInNewContext(read(path), ctx));
  runInNewContext(read('js/validation.js'), ctx);
  const src = read('js/preview-renderer.js');
  const withPublicTestHook = src.replace(
    '    init,\n    render,\n    setZoomMode:',
    '    init,\n    render,\n    buildDocumentHtml: _buildDocumentHtml,\n    setZoomMode:'
  );
  expect(withPublicTestHook).not.toBe(src);
  runInNewContext(withPublicTestHook, ctx);
  return {
    call: runInNewContext('TemplateSuratPanggilanOrangTua', ctx),
    agreement: runInNewContext('TemplateSuratPerjanjianSiswa', ctx),
    minutes: runInNewContext('TemplateBeritaAcaraPertemuanOrtu', ctx),
    renderer: runInNewContext('PreviewRenderer', ctx),
    validation: runInNewContext('Validation', ctx),
  };
}

describe('Three student guidance and parent meeting documents', () => {
  it('uses the source-specific KOP policy and A4 pagination', () => {
    const { call, agreement, minutes, renderer } = setup();
    expect(call.meta.usesKop).toBe(true);
    expect(agreement.meta.usesKop).toBe(false);
    expect(minutes.meta.usesKop).toBe(true);
    for (const template of [call, agreement, minutes]) {
      expect(template.meta.orientation).toBe('portrait');
      expect(template.meta.paperSize).toBe('a4');
      expect(renderer.usesMultiPageLayout(template.TEMPLATE_ID)).toBe(true);
      expect(template.tableColumns).toHaveLength(0);
    }
  });

  it('renders parent summons with meeting details, WhatsApp contact, and school signatory', () => {
    const { call, renderer } = setup();
    const data = call.createDefaultData();
    data.surat = { nomor: '400/001/2026', kota: 'Musi Rawas', tanggal: '2026-11-10' };
    data.sekolah = { nama: 'MTs Nurul Falah', jenisSatdik: 'Madrasah' };
    data.siswa = { nama: 'Siswa Contoh', kelas: 'VIII A' };
    data.pertemuan = { tanggal: '2026-11-12', waktu: '08.00', lokasi: 'Ruang BK', bertemuDengan: 'Guru BK' };
    data.kontak = { nomorWa: '08123456789', pemilikWa: 'Petugas Kesiswaan' };
    data.kepala = { nama: 'Kepala Madrasah', nip: '197601012006041001' };
    const html = renderer.buildDocumentHtml(call, data, {}, null, null);
    for (const snippet of [
      'class="doc-kop"', 'Panggilan Orang Tua/Wali Siswa', 'Siswa Contoh',
      'Kamis, 12 November 2026', 'Pukul 08.00 WIB s.d. selesai',
      'Ruang BK', 'Guru BK', '08123456789', 'Petugas Kesiswaan',
      'Kepala Madrasah', 'NIP. 197601012006041001',
      'Wassalamu’alaikum warahmatullahi wabarakatuh.',
    ]) expect(html).toContain(snippet);
    expect(html).toContain('secara langsung');
  });

  it('keeps the student agreement without KOP and preserves all four articles', () => {
    const { agreement, renderer } = setup();
    const data = agreement.createDefaultData();
    data.siswa = { nama: 'Siswa Perjanjian', nis: '00123', nisn: '0123456789', tempatLahir: 'Terawas', tanggalLahir: '2013-01-03', kelas: 'VIII' };
    data.orangTua = { nama: 'Wali Murid', alamat: 'Jalan Mawar' };
    data.pelanggaran = { uraian: 'tidak mematuhi peraturan', tanggal: '2026-11-09', lokasi: 'Ruang Kelas' };
    data.surat = { kota: 'Musi Rawas', tanggal: '2026-11-10' };
    data.penandatangan = { waliKelas: 'Wali Kelas', nipWaliKelas: '123', guruBk: 'Guru BK', nipGuruBk: '456', kepala: 'Kepala Madrasah', nipKepala: '789' };
    const html = renderer.buildDocumentHtml(agreement, data, {}, null, null);
    expect(html).not.toContain('class="doc-kop"');
    for (let n = 1; n <= 4; n++) expect(html).toContain('Pasal ' + n);
    for (const snippet of ['Siswa Perjanjian', 'Wali Murid', 'tidak mematuhi peraturan',
      'Senin, 9 November 2026', 'Mengesahkan,', 'Guru BK/Bidang Kesiswaan',
      'NIP. 123', 'NIP. 456', 'NIP. 789']) expect(html).toContain(snippet);
    expect(html).toContain('hak-hak saya sebagai peserta didik');
  });

  it('supports unlimited participant rows and optional numbered agreements', () => {
    const { minutes, renderer } = setup();
    const parties = minutes.formSections.find(section => section.id === 'pihakHadir');
    const extra = minutes.formSections.find(section => section.id === 'kesepakatanTambahan');
    expect(parties.type).toBe('repeatable');
    expect(typeof parties.itemFactory).toBe('function');
    expect(extra.type).toBe('repeatable');
    expect(typeof extra.itemFactory).toBe('function');
    expect(parties.itemFactory().id).toMatch(/^pihak-hadir-/);
    expect(extra.itemFactory().id).toMatch(/^kesepakatan-/);
    const data = minutes.createDefaultData();
    data.pertemuan.tanggal = '2026-11-10';
    // Lima posisi penandatangan bersifat tetap; delapan peserta tambahan mengikuti setelahnya.
    data.pihakHadir.push(...Array.from({ length: 8 }, (_, i) => ({
      id: 'p' + i, nama: 'Peserta ' + (i + 1), jabatan: 'Peran ' + i,
    })));
    data.kesepakatanTambahan = [
      { id: 'k1', teks: 'Mengikuti konseling' },
      { id: 'k2', teks: '' },
      { id: 'k3', teks: 'Evaluasi berkala' },
    ];
    const html = renderer.buildDocumentHtml(minutes, data, {}, null, null);
    for (let n = 1; n <= 8; n++) expect(html).toContain('Peserta ' + n);
    expect(html).toContain('<li value="13"');
    expect(html).toContain('Mengikuti konseling');
    expect(html).toContain('Evaluasi berkala');
    expect(html).not.toContain('<li value="3">Evaluasi berkala');
  });

  it('renders each A-H meeting section with written Indonesian date and signature grid', () => {
    const { minutes, renderer } = setup();
    const data = minutes.createDefaultData();
    data.pertemuan.tanggal = '2026-11-10';
    data.surat.tanggal = '2026-11-10';
    data.siswa = { nama: 'Siswa', nis: '012', nisn: '0123456789', tempatLahir: 'Terawas', tanggalLahir: '2013-02-10', kelas: 'VII', alamat: 'Terawas', namaOrangTua: 'Wali Siswa' };
    const html = renderer.buildDocumentHtml(minutes, data, {}, null, null);
    expect(html).toContain('class="doc-kop"');
    expect(html).toContain('Selasa tanggal sepuluh bulan November tahun dua ribu dua puluh enam');
    for (const heading of [
      'A. IDENTITAS SISWA', 'B. WAKTU DAN TEMPAT PERTEMUAN', 'C. PIHAK YANG HADIR',
      'D. POKOK PERMASALAHAN', 'E. HASIL KLARIFIKASI DAN PEMBAHASAN',
      'F. HASIL KESEPAKATAN DAN KOMITMEN', 'G. RENCANA TINDAK LANJUT',
      'H. PENUTUP',
    ]) expect(html).toContain(heading);
    expect(html).toContain('PIHAK-PIHAK YANG HADIR DAN MENANDATANGANI');
    expect(html).toContain('doc-case__sign-grid');
    expect(html).toContain('kerahasiaan informasi pribadi siswa');
  });

  it('validates NISN, date ordering and required identity of synced attendees', () => {
    const { agreement, minutes, validation } = setup();
    for (const template of [agreement, minutes]) {
      const data = template.createDefaultData();
      data.siswa.nisn = '999';
      data.surat.tanggal = '2026-11-10';
      data.siswa.tanggalLahir = '2026-11-11';
      const errors = validation.formTemplate(data, template).errors;
      expect(errors.some(err => err.field === 'siswa.nisn')).toBe(true);
      expect(errors.some(err => err.field === 'siswa.tanggalLahir')).toBe(true);
    }
    const data = minutes.createDefaultData();
    const errors = validation.formTemplate(data, minutes).errors;
    expect(errors.some(err => err.field === 'pihakHadir[0].nama')).toBe(true);
    expect(errors.some(err => err.field === 'pihakHadir[1].nama')).toBe(true);
  });

  it('escapes malicious user content and retains newline formatting', () => {
    const { minutes, renderer } = setup();
    const data = minutes.createDefaultData();
    data.permasalahan.uraian = '<img src=x onerror=alert(1)>\nUraian berikutnya';
    data.pihakHadir = [{ id: 'a', nama: '<script>alert(1)</script>', jabatan: 'Orang Tua' }];
    const html = renderer.buildDocumentHtml(minutes, data, {}, null, null);
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;img');
    expect(html).toContain('white-space:pre-line');
  });

  it('registers all three templates for the UI, routes, and offline PWA', () => {
    const html = read('index.html'), sw = read('sw.js'), routes = read('js/routes.js');
    for (const id of [
      'surat-panggilan-orang-tua', 'surat-perjanjian-siswa', 'berita-acara-pertemuan-ortu',
    ]) {
      expect(html).toContain('src="templates/' + id + '.js"');
      expect(sw).toContain("'./templates/" + id + ".js'");
      expect(routes).toContain("'" + id + "'");
      expect(read('js/template-registry.js')).toContain("'" + id + "'");
    }
    expect(sw).toContain("CACHE_PREFIX + 'v47'");
  });
});
