/* Template Notulensi Rapat beserta lampiran Daftar Hadir Peserta Rapat.
   Mengikuti struktur dokumen Word yang disediakan pengguna (bagian A–I dan lampiran A–E). */
const TemplateNotulensiRapat = (() => {
  const TEMPLATE_ID = 'notulensi-rapat';
  const meta = {
    id: TEMPLATE_ID,
    name: 'Notulensi Rapat dan Daftar Hadir',
    description: 'Notulensi lengkap dengan pembahasan, keputusan, tindak lanjut dan lampiran daftar hadir peserta rapat.',
    icon: 'clipboard-list',
    orientation: 'portrait',
    paperSize: 'a4',
    category: 'administrasi-rapat',
    usesKop: true,
  };

  const makeItem = (prefix, values = {}) => ({ id: Utils.generateId(prefix), ...values });
  const createTujuan = () => makeItem('tujuan-rapat', { teks: '' });
  const createAcara = () => makeItem('acara-rapat', { teks: '' });
  const createPembahasan = () => makeItem('pembahasan-rapat', {
    topik: '', uraian: '', tanggapan: '', kesimpulan: '',
  });
  const createKeputusan = () => makeItem('keputusan-rapat', { teks: '' });
  const createTindakLanjut = () => makeItem('tindak-lanjut', {
    keputusan: '', penanggungJawab: '', batasWaktu: '',
  });
  const createCatatan = () => makeItem('catatan-rapat', { teks: '' });
  const createPeserta = () => makeItem('peserta-rapat', {
    nama: '', jabatan: '', status: 'Hadir', tandaTanganDataUrl: '',
  });

  const createDefaultData = () => ({
    surat: { nomor: '', kota: 'Musi Rawas', tanggalNotulen: '' },
    sekolah: { nama: 'MTs Nurul Falah', jenisSatdik: 'Madrasah', namaKepala: '', nipKepala: '' },
    rapat: {
      namaJenis: '', tanggal: '', waktuMulai: '', waktuSelesai: '',
      tempatMedia: '', agenda: '', namaPimpinan: '', namaNotulis: '',
      jumlahDiundang: '',
    },
    tujuan: [],
    acara: [],
    pembahasan: [createPembahasan(), createPembahasan()],
    keputusan: [],
    tindakLanjut: [],
    monitoringEvaluasi: '',
    catatanKhusus: [],
    penutup: { namaPenutup: '' },
    pengesahan: {
      nipNotulis: '', nipPimpinan: '', namaPencatat: '', nipPencatat: '',
      tandaTanganNotulisDataUrl: '', tandaTanganPimpinanDataUrl: '',
      tandaTanganKepalaDataUrl: '', tandaTanganPencatatDataUrl: '',
    },
    peserta: [],
    catatanKehadiran: '',
  });

  const field = (key, label, type = 'text', required = false, extra = {}) =>
    ({ key, label, type, required, ...extra });
  const section = (id, title, fields, icon = 'file-text') => ({ id, title, icon, fields });
  const repeat = (id, title, itemLabel, itemFactory, fields, icon = 'list') =>
    ({ id, title, icon, type: 'repeatable', itemLabel, itemFactory, fields });

  const formSections = [
    section('surat', 'Identitas Dokumen', [
      field('surat.nomor', 'Nomor Notulensi', 'text', true),
      field('surat.kota', 'Kabupaten/Kota Pengesahan', 'text', true),
      field('surat.tanggalNotulen', 'Tanggal Notulensi', 'date', false, {
        hint: 'Jika dikosongkan, mengikuti tanggal rapat.',
      }),
    ]),
    section('sekolah', 'Identitas Sekolah/Madrasah', [
      field('sekolah.nama', 'Nama Sekolah/Madrasah', 'text', true),
      field('sekolah.jenisSatdik', 'Jenis Satuan Pendidikan', 'select', true, {
        options: [{ value: 'Madrasah', label: 'Madrasah' }, { value: 'Sekolah', label: 'Sekolah' }],
      }),
      field('sekolah.namaKepala', 'Nama Kepala Sekolah/Madrasah', 'text'),
      field('sekolah.nipKepala', 'NIP Kepala (jika ada)', 'text'),
    ], 'school'),
    section('rapat', 'A. Identitas Rapat', [
      field('rapat.namaJenis', 'Nama/Jenis Rapat', 'text', true),
      field('rapat.tanggal', 'Tanggal Rapat', 'date', true),
      field('rapat.waktuMulai', 'Waktu Mulai', 'text', true, { placeholder: '08.00' }),
      field('rapat.waktuSelesai', 'Waktu Selesai', 'text', true, { placeholder: '10.00' }),
      field('rapat.tempatMedia', 'Tempat/Media Pelaksanaan', 'textarea', true),
      field('rapat.agenda', 'Agenda Rapat', 'textarea', true),
      field('rapat.namaPimpinan', 'Nama Pimpinan Rapat', 'text', true),
      field('rapat.namaNotulis', 'Nama Notulis', 'text', true),
      field('rapat.jumlahDiundang', 'Jumlah Peserta Diundang', 'number', false, {
        integer: true, min: 0, max: 9999,
      }),
    ]),
    repeat('tujuan', 'B. Tujuan Rapat', 'Tujuan Rapat', createTujuan, [
      field('teks', 'Uraian Tujuan', 'textarea'),
    ]),
    repeat('acara', 'C. Susunan Acara', 'Acara', createAcara, [
      field('teks', 'Nama Acara (antara Pembukaan dan Penutup)', 'text'),
    ]),
    repeat('pembahasan', 'D. Jalannya Rapat dan Hasil Pembahasan', 'Pokok Pembahasan', createPembahasan, [
      field('topik', 'Topik', 'text'),
      field('uraian', 'Uraian Pembahasan', 'textarea'),
      field('tanggapan', 'Tanggapan/Usulan Peserta', 'textarea'),
      field('kesimpulan', 'Kesimpulan Pembahasan', 'textarea'),
    ]),
    section('pembukaan', 'Arahan Pimpinan Rapat', [
      field('pembukaan', 'Pembukaan dan Arahan Pimpinan', 'textarea'),
    ]),
    repeat('keputusan', 'E. Hasil Keputusan Rapat', 'Keputusan', createKeputusan, [
      field('teks', 'Isi Keputusan', 'textarea'),
    ]),
    repeat('tindakLanjut', 'F. Rencana Tindak Lanjut (Jika Ada)', 'Tindak Lanjut', createTindakLanjut, [
      field('keputusan', 'Keputusan/Tindak Lanjut', 'textarea'),
      field('penanggungJawab', 'Penanggung Jawab', 'text'),
      field('batasWaktu', 'Batas Waktu', 'date'),
    ]),
    section('monitoring', 'Monitoring dan Evaluasi', [
      field('monitoringEvaluasi', 'Mekanisme Monitoring dan Evaluasi', 'textarea'),
    ]),
    repeat('catatanKhusus', 'G. Catatan Tambahan/Khusus', 'Catatan', createCatatan, [
      field('teks', 'Catatan/Kendala/Usulan', 'textarea'),
    ]),
    section('penutup', 'H. Penutup', [
      field('penutup.namaPenutup', 'Nama yang Menutup Rapat', 'text'),
    ]),
    section('pengesahan', 'I. Pengesahan dan Tanda Tangan', [
      field('pengesahan.nipNotulis', 'NIP Notulis (jika ada)'),
      field('pengesahan.nipPimpinan', 'NIP Pimpinan Rapat (jika ada)'),
      field('pengesahan.namaPencatat', 'Petugas Pencatat Kehadiran'),
      field('pengesahan.nipPencatat', 'NIP Petugas Pencatat (jika ada)'),
      field('pengesahan.tandaTanganNotulisDataUrl', 'Tanda Tangan Notulis', 'signature'),
      field('pengesahan.tandaTanganPimpinanDataUrl', 'Tanda Tangan Pimpinan Rapat', 'signature'),
      field('pengesahan.tandaTanganKepalaDataUrl', 'Tanda Tangan Kepala', 'signature'),
      field('pengesahan.tandaTanganPencatatDataUrl', 'Tanda Tangan Petugas Kehadiran', 'signature'),
    ], 'signature'),
    repeat('peserta', 'Lampiran — Daftar Kehadiran Peserta', 'Peserta Rapat', createPeserta, [
      field('nama', 'Nama Peserta'),
      field('jabatan', 'Jabatan/Unsur'),
      field('status', 'Status Kehadiran', 'select', true, {
        options: ['Hadir', 'Izin', 'Sakit', 'Tanpa Keterangan'],
      }),
      field('tandaTanganDataUrl', 'Tanda Tangan Peserta (jika hadir)', 'signature'),
    ], 'users'),
    section('catatanKehadiran', 'Lampiran — Catatan Kehadiran', [
      field('catatanKehadiran', 'Catatan Kehadiran (Jika Ada)', 'textarea'),
    ]),
  ];

  function getAttendanceSummary(data = {}) {
    const people = (Array.isArray(data.peserta) ? data.peserta : [])
      .filter(item => item && String(item.nama || '').trim());
    const counts = { hadir: 0, izin: 0, sakit: 0, tanpaKeterangan: 0 };
    for (const person of people) {
      if (person.status === 'Izin') counts.izin += 1;
      else if (person.status === 'Sakit') counts.sakit += 1;
      else if (person.status === 'Tanpa Keterangan') counts.tanpaKeterangan += 1;
      else counts.hadir += 1;
    }
    const invitedRaw = data.rapat?.jumlahDiundang;
    const manual = invitedRaw !== '' && invitedRaw !== null && invitedRaw !== undefined;
    const invited = manual && Number.isFinite(Number(invitedRaw)) && Number(invitedRaw) >= 0
      ? Math.floor(Number(invitedRaw)) : people.length;
    const tidakHadir = counts.izin + counts.sakit + counts.tanpaKeterangan;
    return {
      ...counts, diundang: invited, tidakHadir,
      persenHadir: invited > 0 ? (counts.hadir / invited * 100).toFixed(2).replace(/\.00$/, '') : '0',
      terdata: people.length,
      belumTerdata: Math.max(0, invited - people.length),
    };
  }

  function safeSignature(value) {
    return typeof value === 'string' && value.length <= 350000 &&
      /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
  }

  return {
    TEMPLATE_ID, meta, createDefaultData, formSections, tableColumns: [],
    createTujuan, createAcara, createPembahasan, createKeputusan,
    createTindakLanjut, createCatatan, createPeserta,
    getAttendanceSummary, safeSignature,
  };
})();