import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function setup() {
  const ctx = {
    console: { warn: vi.fn(), info: vi.fn() },
    State: {
      getMarginMm: () => ({ top: 20, bottom: 20, left: 25.4, right: 25.4 }),
      getTypography: () => ({ fontFamily: 'Times New Roman', fontSize: 12, lineHeight: 1.25 }),
    },
    KopEditor: { renderKopHtml: () => '<div class="doc-kop">KOP resmi</div>' },
  };
  runInNewContext(read('js/utils.js'), ctx);
  for (const path of [
    'templates/surat-pemberitahuan-kegiatan.js',
    'templates/surat-keterangan-siswa-aktif.js',
  ]) runInNewContext(read(path), ctx);
  runInNewContext(read('js/validation.js'), ctx);
  const renderer = read('js/preview-renderer.js');
  const injectable = renderer.replace(
    '    init,\n    render,\n    setZoomMode:',
    '    init,\n    render,\n    buildDocumentHtml: _buildDocumentHtml,\n    setZoomMode:'
  );
  expect(injectable).not.toBe(renderer);
  runInNewContext(injectable, ctx);
  return {
    notice: runInNewContext('TemplateSuratPemberitahuanKegiatan', ctx),
    active: runInNewContext('TemplateSuratKeteranganSiswaAktif', ctx),
    validation: runInNewContext('Validation', ctx),
    renderer: runInNewContext('PreviewRenderer', ctx),
  };
}

describe('DOCX-based new official school letters', () => {
  it('registers the two KOP-based portrait letter schemas', () => {
    const { notice, active, renderer } = setup();
    for (const tpl of [notice, active]) {
      expect(tpl.meta.usesKop).toBe(true);
      expect(tpl.meta.orientation).toBe('portrait');
      expect(tpl.meta.paperSize).toBe('a4');
      expect(tpl.tableColumns).toHaveLength(0);
      expect(renderer.usesMultiPageLayout(tpl.TEMPLATE_ID)).toBe(true);
    }
    expect(notice.formSections.map(x => x.id)).toEqual([
      'surat', 'sekolah', 'kegiatan', 'ketentuanTambahan', 'kepala',
    ]);
    expect(active.formSections.map(x => x.id)).toEqual([
      'surat', 'kepala', 'sekolah', 'siswa',
    ]);
  });

  it('renders full activity notice with weekday, time, KOP, and optional numbered rules', () => {
    const { notice, renderer } = setup();
    const data = notice.createDefaultData();
    data.surat = { nomorSurat: '123/MTs/2026', kabupatenKota: 'Musi Rawas', tanggalSurat: '2026-11-10' };
    data.kegiatan = {
      dalamRangka: 'peringatan Hari Guru', nama: 'Seminar Pendidikan',
      tanggal: '2026-11-10', waktu: '08.00', lokasi: 'Aula Madrasah',
      peserta: 'Siswa dan orang tua', tujuan: 'meningkatkan literasi',
    };
    data.kepala.nama = 'Kepala MTs';
    data.ketentuanTambahan = [
      { id: 'a', teks: 'Mengenakan seragam' }, { id: 'b', teks: 'Hadir tepat waktu' },
    ];
    const html = renderer.buildDocumentHtml(notice, data, {}, null, null);
    expect(html).toContain('class="doc-kop"');
    expect(html).toContain('doc-kop-divider');
    expect(html).toContain('123/MTs/2026');
    expect(html).toContain('Pemberitahuan Kegiatan');
    expect(html).toContain('Selasa, 10 November 2026');
    expect(html).toContain('Pukul 08.00 WIB s.d. selesai');
    expect(html).toContain('Seminar Pendidikan');
    expect(html).toContain('Mengenakan seragam');
    expect(html).toContain('Hadir tepat waktu');
    expect(html).toContain('<ol');
    expect(html).toContain('Kepala MTs');
    expect(html).toContain('Wassalamu’alaikum');
  });

  it('omits the optional additional rules section when none have content', () => {
    const { notice, renderer } = setup();
    const data = notice.createDefaultData();
    data.ketentuanTambahan = [{ id: 'r1', teks: '' }, { id: 'r2', teks: '   ' }];
    const html = renderer.buildDocumentHtml(notice, data, {}, null, null);
    expect(html).not.toContain('Ketentuan Tambahan/Khusus:</p>');
    expect(html).not.toContain('<ol');
    expect(notice.formSections.find(x => x.id === 'ketentuanTambahan').type).toBe('repeatable');
    expect(typeof notice.formSections.find(x => x.id === 'ketentuanTambahan').itemFactory).toBe('function');
  });

  it('renders identity data and official active enrollment attestation', () => {
    const { active, renderer } = setup();
    const data = active.createDefaultData();
    data.surat.nomorSurat = '421/456/2026';
    data.surat.tanggalSurat = '2026-11-10';
    data.siswa = {
      namaLengkap: 'Siswa Contoh', tempatLahir: 'Terawas', tanggalLahir: '2013-05-02',
      nis: '123', nisn: '0123456789', jenisKelamin: 'Perempuan',
      kelas: 'VIII A', semester: 'Ganjil', tahunPelajaran: '2026/2027',
    };
    data.kepala.nama = 'Nama Kepala';
    const html = renderer.buildDocumentHtml(active, data, {}, null, null);
    expect(html).toContain('SURAT KETERANGAN SISWA AKTIF');
    expect(html).toContain('421/456/2026');
    expect(html).toContain('Siswa Contoh');
    expect(html).toContain('Terawas, 2 Mei 2013');
    expect(html).toContain('123/0123456789');
    expect(html).toContain('Ganjil');
    expect(html).toContain('2026/2027');
    expect(html).toContain('masih berstatus aktif');
    expect(html).toContain('Nama Kepala');
    expect(html).toContain('class="doc-kop"');
  });

  it('validates school year and NISN format without altering other templates', () => {
    const { active, notice, validation } = setup();
    const data = active.createDefaultData();
    data.siswa.nisn = '12345';
    data.siswa.tahunPelajaran = '2026/2029';
    let errors = validation.formTemplate(data, active).errors;
    expect(errors.some(e => e.field === 'siswa.nisn')).toBe(true);
    expect(errors.some(e => e.field === 'siswa.tahunPelajaran')).toBe(true);
    data.siswa.nisn = '0123456789';
    data.siswa.tahunPelajaran = '2026/2027';
    data.surat.tanggalSurat = '2026-11-10';
    data.siswa.tanggalLahir = '2026-11-11';
    errors = validation.formTemplate(data, active).errors;
    expect(errors.some(e => e.field === 'siswa.nisn')).toBe(false);
    expect(errors.some(e => e.field === 'siswa.tahunPelajaran')).toBe(false);
    expect(errors.some(e => e.field === 'siswa.tanggalLahir')).toBe(true);
    const noticeErrors = validation.formTemplate(notice.createDefaultData(), notice).errors;
    expect(noticeErrors.some(e => e.field === 'kegiatan.nama')).toBe(true);
  });

  it('escapes user-controlled strings and preserves saved line breaks', () => {
    const { notice, active, renderer } = setup();
    const data = notice.createDefaultData();
    data.kegiatan.nama = '<img src=x onerror=alert(1)>';
    data.ketentuanTambahan = [{ id: 'x', teks: '<svg onload=alert(1)>\nBaris kedua' }];
    const output = renderer.buildDocumentHtml(notice, data, {}, null, null);
    expect(output).not.toContain('<img src=x onerror=alert(1)>');
    expect(output).not.toContain('<svg onload=alert(1)>');
    expect(output).toContain('&lt;img');
    expect(output).toContain('white-space:pre-line');
    const activeData = active.createDefaultData();
    activeData.siswa.namaLengkap = '<b>Malicious</b>';
    const html = renderer.buildDocumentHtml(active, activeData, {}, null, null);
    expect(html).toContain('&lt;b&gt;Malicious&lt;/b&gt;');
    expect(html).not.toContain('<b>Malicious</b>');
  });


  it('provides both Satdik options and keeps legacy drafts compatible', () => {
    const { notice, active, renderer } = setup();
    for (const template of [notice, active]) {
      const data = template.createDefaultData();
      const schoolFields = template.formSections.find(section => section.id === 'sekolah').fields;
      const choice = schoolFields.find(field => field.key === 'sekolah.jenisSatdik');
      expect(choice.type).toBe('select');
      expect(choice.options.map(option => option.value)).toEqual(['Madrasah', 'Sekolah']);
      expect(data.sekolah.jenisSatdik).toBe('Madrasah');

      data.sekolah.jenisSatdik = 'Sekolah';
      let html = renderer.buildDocumentHtml(template, data, {}, null, null);
      expect(html).toContain('Kepala MTs Nurul Falah,');
      expect(html).not.toContain('Kepala Sekolah/Madrasah,');

      delete data.sekolah.jenisSatdik;
      html = renderer.buildDocumentHtml(template, data, {}, null, null);
      expect(html).toContain('Kepala MTs Nurul Falah,');
    }
  });

  it('shows school name immediately beneath the addressee on activity notices', () => {
    const { notice, renderer } = setup();
    const data = notice.createDefaultData();
    data.sekolah.nama = 'Sekolah Contoh A';
    data.sekolah.jenisSatdik = 'Sekolah';
    const html = renderer.buildDocumentHtml(notice, data, {}, null, null);
    expect(html).toMatch(/Yth\. Bapak\/Ibu Orang Tua\/Wali Murid<\/p>\s*<p[^>]*>Sekolah Contoh A<\/p>/);
    expect(html).toContain('pihak sekolah.');
    expect(html).not.toContain('pihak sekolah/madrasah.');
  });

  it('supports single-day and chronological date ranges with automatic weekday names', () => {
    const { notice, renderer, validation } = setup();
    const data = notice.createDefaultData();
    const fields = notice.formSections.find(section => section.id === 'kegiatan').fields;
    const mode = fields.find(field => field.key === 'kegiatan.modeTanggal');
    const finish = fields.find(field => field.key === 'kegiatan.tanggalSelesai');
    expect(mode.type).toBe('select');
    expect(mode.options.map(o => o.value)).toEqual(['tunggal', 'rentang']);
    expect(finish.required).toBe(true);
    expect(finish.showIf(data)).toBe(false);
    expect(data.kegiatan.modeTanggal).toBe('tunggal');

    data.kegiatan.tanggal = '2026-11-10';
    data.kegiatan.tanggalSelesai = '2026-11-13';
    let html = renderer.buildDocumentHtml(notice, data, {}, null, null);
    expect(html).toContain('Selasa, 10 November 2026');
    expect(html).not.toContain('Jumat, 13 November 2026');
    expect(validation.formTemplate(data, notice).errors.some(e =>
      e.field === 'kegiatan.tanggalSelesai')).toBe(false);

    data.kegiatan.modeTanggal = 'rentang';
    expect(finish.showIf(data)).toBe(true);
    html = renderer.buildDocumentHtml(notice, data, {}, null, null);
    expect(html).toContain('Selasa, 10 November 2026 s.d. Jumat, 13 November 2026');

    data.kegiatan.tanggalSelesai = '2026-11-09';
    expect(validation.formTemplate(data, notice).errors.some(e =>
      e.field === 'kegiatan.tanggalSelesai')).toBe(true);

    data.kegiatan.tanggalSelesai = '';
    expect(validation.formTemplate(data, notice).errors.some(e =>
      e.field === 'kegiatan.tanggalSelesai')).toBe(true);

    data.kegiatan.tanggalSelesai = '2026-11-10';
    expect(validation.formTemplate(data, notice).errors.some(e =>
      e.field === 'kegiatan.tanggalSelesai')).toBe(false);
  });

  it('renders explicit sequential numbering even if the global CSS resets list markers', () => {
    const { notice, renderer } = setup();
    const data = notice.createDefaultData();
    data.ketentuanTambahan = [
      { id: 'a', teks: 'Membawa alat tulis' },
      { id: 'blank', teks: '' },
      { id: 'b', teks: 'Hadir tepat waktu' },
      { id: 'c', teks: 'Menjaga ketertiban' },
    ];
    const html = renderer.buildDocumentHtml(notice, data, {}, null, null);
    expect(html).toContain('class="doc-activity__conditions"');
    expect(html).toContain('list-style-type:decimal');
    expect(html).toContain('<li value="1"');
    expect(html).toContain('<li value="2"');
    expect(html).toContain('<li value="3"');
    expect(html).not.toContain('<li value="4"');
  });

  it('left-aligns NIP with the first character of the head name on both new templates', () => {
    const { notice, active, renderer } = setup();
    for (const template of [notice, active]) {
      const data = template.createDefaultData();
      data.kepala.nama = 'Kepala Contoh';
      data.kepala.nip = '197601012006041001';
      const html = renderer.buildDocumentHtml(template, data, {}, null, null);
      expect(html).toContain('class="doc-signature__identity"');
      expect(html).toMatch(/doc-signature__identity"[^>]*text-align:left[^>]*>/);
      expect(html).toMatch(/Kepala Contoh<\/p><p[^>]*>NIP\. 197601012006041001<\/p>/);
    }
  });

  it('is included in routes, classic script order, and PWA app shell', () => {
    const html = read('index.html');
    const cache = read('sw.js');
    for (const name of ['surat-pemberitahuan-kegiatan', 'surat-keterangan-siswa-aktif']) {
      expect(html).toContain('src="templates/' + name + '.js"');
      expect(cache).toContain("'./templates/" + name + ".js'");
      expect(read('js/routes.js')).toContain("'" + name + "'");
      expect(read('js/template-registry.js')).toContain("'" + name + "'");
    }
    expect(cache).toContain("CACHE_PREFIX + 'v61'");
  });
});
