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
  for (const path of [
    'templates/surat-permohonan-pindah.js',
    'templates/surat-keterangan-pindah.js',
  ]) runInNewContext(read(path), ctx);
  runInNewContext(read('js/validation.js'), ctx);
  // Expose private document functions through the existing renderer source
  // without constructing a fake DOM or changing public application APIs.
  const renderer = read('js/preview-renderer.js');
  const injected = renderer.replace(
    '    init,\n    render,\n    setZoomMode:',
    '    init,\n    render,\n    buildDocumentHtml: _buildDocumentHtml,\n    setZoomMode:'
  );
  expect(injected).not.toBe(renderer);
  runInNewContext(injected, ctx);
  return {
    ctx,
    validation: runInNewContext('Validation', ctx),
    renderer: runInNewContext('PreviewRenderer', ctx),
    request: runInNewContext('TemplateSuratPermohonanPindah', ctx),
    certificate: runInNewContext('TemplateSuratKeteranganPindah', ctx),
  };
}

describe('Two DOCX-based Surat Pindah templates', () => {
  it('provides distinct identities, A4 portrait, and appropriate KOP rules', () => {
    const { request, certificate, renderer } = setup();
    expect(request.TEMPLATE_ID).toBe('surat-permohonan-pindah');
    expect(certificate.TEMPLATE_ID).toBe('surat-keterangan-pindah');
    expect(request.meta.usesKop).toBe(false);
    expect(certificate.meta.usesKop).toBe(true);
    for (const tpl of [request, certificate]) {
      expect(tpl.meta.paperSize).toBe('a4');
      expect(tpl.meta.orientation).toBe('portrait');
      expect(renderer.usesMultiPageLayout(tpl.TEMPLATE_ID)).toBe(true);
      expect(tpl.tableColumns).toHaveLength(0);
    }
  });

  it('renders request with student, destination, parent and no institutional KOP', () => {
    const { request, renderer } = setup();
    const data = request.createDefaultData();
    data.surat.tanggalSurat = '2026-11-10';
    data.siswa = {
      namaLengkap: 'Siswa Contoh', tempatLahir: 'Terawas',
      tanggalLahir: '2013-06-05', jenisKelamin: 'Perempuan',
      nisn: '0123456789', kelas: 'VIII A',
    };
    data.pindah.sekolahTujuan = 'Madrasah Tujuan';
    data.pindah.alamatSekolahTujuan = 'Jalan Tujuan';
    data.pindah.alasan = 'mengikuti orang tua';
    data.pengirim.namaOrangTuaWali = 'Wali Contoh';
    const html = renderer.buildDocumentHtml(request, data, {}, null, null);
    expect(html).toContain('Hal</td>');
    expect(html).toContain('Lampiran');
    expect(html).toContain('Permohonan Pindah Sekolah');
    expect(html).toContain('Siswa Contoh');
    expect(html).toContain('Madrasah Tujuan');
    expect(html).toContain('Jalan Tujuan');
    expect(html).toContain('mengikuti orang tua');
    expect(html).toContain('Wali Contoh');
    expect(html).toContain('10 November 2026');
    expect(html).not.toContain('doc-kop-divider');
    expect(html).not.toContain('class="doc-kop"');
  });

  it('exposes the same optional direct-signature component as Surat Izin', () => {
    const { request } = setup();
    const section = request.formSections.find(item => item.id === 'pengirim');
    const field = section.fields.find(item => item.key === 'pengirim.tandaTanganDataUrl');
    expect(field).toMatchObject({
      type: 'signature', required: false, label: 'Tanda Tangan Orang Tua/Wali',
    });
    expect(request.createDefaultData().pengirim.tandaTanganDataUrl).toBe('');
    const source = read('js/form-renderer.js');
    expect(source).toContain("case 'signature':");
    expect(source).toContain('SignaturePad.mount(group');
    expect(source).toContain('onChange: imageData => _saveFieldValue');
    const pad = read('js/signature-pad.js');
    expect(pad).toContain("canvas.toDataURL('image/png')");
    expect(pad).toContain("closeActive");
    expect(pad).toContain('Simpan Tanda Tangan');
  });

  it('renders validated transparent PNG signature above the parent name', () => {
    const { request, renderer } = setup();
    const data = request.createDefaultData();
    data.pengirim.namaOrangTuaWali = 'Wali Contoh';
    const validPng = 'data:image/png;base64,iVBORw0KGgo=';
    data.pengirim.tandaTanganDataUrl = validPng;
    const html = renderer.buildDocumentHtml(request, data, {}, null, null);
    const signatureIndex = html.indexOf('src="' + validPng + '"');
    const parentIndex = html.lastIndexOf('>Wali Contoh</p>');
    expect(signatureIndex).toBeGreaterThan(-1);
    expect(parentIndex).toBeGreaterThan(signatureIndex);
    expect(html).toContain('object-fit:contain');
    expect(html).toContain('alt="Tanda tangan Orang Tua/Wali"');
    // The rest of the letter stays unchanged (no institutional KOP).
    expect(html).not.toContain('doc-kop-divider');
    expect(html).toContain('Permohonan Pindah Sekolah');
  });

  it('rejects injected or oversized signature images without affecting other values', () => {
    const { request, renderer } = setup();
    const data = request.createDefaultData();
    const values = [
      'data:image/svg+xml,<svg onload="alert(1)">',
      'javascript:alert(1)',
      'https://example.com/signature.png',
      'data:image/png;base64,' + 'A'.repeat(350001),
      'data:image/png;base64,abc" onerror="alert(1)',
    ];
    for (const value of values) {
      data.pengirim.tandaTanganDataUrl = value;
      const html = renderer.buildDocumentHtml(request, data, {}, null, null);
      expect(request.getSignatureDataUrl(value)).toBe('');
      expect(html).not.toContain('alt="Tanda tangan Orang Tua/Wali"');
      expect(html).not.toContain('<svg onload');
      expect(html).not.toContain('src="javascript:');
    }
  });

  it('preserves a stable blank signature area for manual signing', () => {
    const { request, renderer } = setup();
    const data = request.createDefaultData();
    const html = renderer.buildDocumentHtml(request, data, {}, null, null);
    expect(html).toContain('height:23mm;display:flex;align-items:center;justify-content:center;');
    expect(html).not.toContain('alt="Tanda tangan Orang Tua/Wali"');
    expect(request.createDefaultData().pengirim.tandaTanganDataUrl).toBe('');
  });

  it('renders certificate with KOP, source wording, report card and kepala/NIP', () => {
    const { certificate, renderer } = setup();
    const data = certificate.createDefaultData();
    data.surat.nomorSurat = '421/123/MTs/2026';
    data.surat.tanggalSurat = '2026-11-10';
    data.pindah.tanggalPermohonan = '2026-11-09';
    data.pindah.namaOrangTuaWali = 'Wali Murid';
    data.pindah.sekolahTujuan = 'MTs Tujuan';
    data.pindah.alamatSekolahTujuan = 'Kecamatan Tujuan';
    data.pindah.alasan = 'mengikuti keluarga';
    data.kepala.nama = 'Kepala Madrasah';
    data.kepala.nip = '123456789';
    const html = renderer.buildDocumentHtml(certificate, data, {}, null, null);
    expect(html).toContain('class="doc-kop"');
    expect(html).toContain('doc-kop-divider');
    expect(html).toContain('SURAT KETERANGAN PINDAH SEKOLAH');
    expect(html).toContain('421/123/MTs/2026');
    expect(html).toContain('9 November 2026');
    expect(html).toContain('Buku Laporan Pendidikan (Rapor) Asli.');
    expect(html).toContain('tidak lagi berstatus sebagai siswa');
    expect(html).toContain('Kepala Madrasah');
    expect(html).toContain('NIP. 123456789');
  });

  it('checks required fields and validates dates for each template', () => {
    const { request, certificate, validation } = setup();
    for (const tpl of [request, certificate]) {
      const data = tpl.createDefaultData();
      const invalid = validation.formTemplate(data, tpl);
      expect(invalid.valid).toBe(false);
      expect(invalid.errors.some(e => e.field === 'siswa.namaLengkap')).toBe(true);
      expect(invalid.errors.some(e => e.field === 'pindah.sekolahTujuan')).toBe(true);
      data.siswa.tanggalLahir = '2026-02-30';
      const invalidDate = validation.formTemplate(data, tpl);
      expect(invalidDate.errors.some(e => e.field === 'siswa.tanggalLahir')).toBe(true);
    }
  });

  it('rejects malformed NISN but accepts a valid 10-digit value in both letters', () => {
    const { request, certificate, validation } = setup();
    for (const template of [request, certificate]) {
      const data = template.createDefaultData();
      data.siswa.nisn = '00012345';
      expect(validation.formTemplate(data, template).errors.some(e =>
        e.field === 'siswa.nisn' && e.message.includes('10 digit'))).toBe(true);
      data.siswa.nisn = '0123456789';
      expect(validation.formTemplate(data, template).errors.some(e =>
        e.field === 'siswa.nisn')).toBe(false);
      data.siswa.nisn = '12345a7890';
      expect(validation.formTemplate(data, template).errors.some(e =>
        e.field === 'siswa.nisn')).toBe(true);
    }
  });

  it('rejects inconsistent chronological dates while allowing same-day documents', () => {
    const { request, certificate, validation } = setup();
    for (const template of [request, certificate]) {
      const data = template.createDefaultData();
      data.surat.tanggalSurat = '2026-11-10';
      data.siswa.tanggalLahir = '2026-11-11';
      expect(validation.formTemplate(data, template).errors.some(e =>
        e.field === 'siswa.tanggalLahir')).toBe(true);
      data.siswa.tanggalLahir = '2012-11-10';
      expect(validation.formTemplate(data, template).errors.some(e =>
        e.field === 'siswa.tanggalLahir')).toBe(false);
    }
    const data = certificate.createDefaultData();
    data.surat.tanggalSurat = '2026-11-10';
    data.pindah.tanggalPermohonan = '2026-11-11';
    expect(validation.formTemplate(data, certificate).errors.some(e =>
      e.field === 'pindah.tanggalPermohonan')).toBe(true);
    data.pindah.tanggalPermohonan = '2026-11-10';
    expect(validation.formTemplate(data, certificate).errors.some(e =>
      e.field === 'pindah.tanggalPermohonan')).toBe(false);
  });

  it('renders a single period and keeps long text inside the paper content', () => {
    const { request, renderer } = setup();
    const data = request.createDefaultData();
    data.pindah.alasan = 'Pindah mengikuti orang tua.';
    data.pindah.alamatSekolahTujuan = 'Kompleks Madrasah';
    let html = renderer.buildDocumentHtml(request, data, {}, null, null);
    expect(html).toMatch(/dikarenakan Pindah mengikuti orang tua\.\s*<\/p>/);
    expect(html).not.toContain('orang tua..');
    expect(html).toContain('overflow-wrap:anywhere');
    data.pindah.alasan = 'Pindah mengikuti orang tua';
    html = renderer.buildDocumentHtml(request, data, {}, null, null);
    expect(html).toMatch(/dikarenakan Pindah mengikuti orang tua\.\s*<\/p>/);
  });

  it('shows explicit placeholders for missing birth details instead of a blank table cell', () => {
    const { request, renderer } = setup();
    const html = renderer.buildDocumentHtml(request, request.createDefaultData(), {}, null, null);
    expect(html).toContain('……………………, ……………………');
  });

  it('aligns the head name and NIP in the moving certificate on one left edge', () => {
    const { certificate, renderer } = setup();
    const data = certificate.createDefaultData();
    data.kepala.nama = 'Nama Kepala Contoh';
    data.kepala.nip = '197601012006041001';
    const html = renderer.buildDocumentHtml(certificate, data, {}, null, null);
    expect(html).toContain('class="doc-signature__identity"');
    expect(html).toMatch(/doc-signature__identity"[^>]*text-align:left[^>]*>/);
    expect(html).toMatch(/Nama Kepala Contoh<\/p><p[^>]*>NIP\. 197601012006041001<\/p>/);
  });

  it('escapes user-supplied markup rather than injecting into the letter', () => {
    const { request, renderer } = setup();
    const data = request.createDefaultData();
    data.siswa.namaLengkap = '<img src=x onerror=alert(1)>';
    const html = renderer.buildDocumentHtml(request, data, {}, null, null);
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img');
  });

  it('exposes new static routes and precaches both templates for offline PWA', () => {
    const html = read('index.html');
    const sw = read('sw.js');
    for (const tpl of ['surat-permohonan-pindah', 'surat-keterangan-pindah']) {
      expect(html).toContain('templates/' + tpl + '.js');
      expect(sw).toContain("'./templates/" + tpl + ".js'");
      expect(read('js/routes.js')).toContain("'" + tpl + "'");
      expect(read('js/template-registry.js')).toContain("'" + tpl + "'");
    }
    expect(sw).toContain("CACHE_PREFIX + 'v66'");
  });
});
