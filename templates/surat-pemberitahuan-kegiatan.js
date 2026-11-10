/* Surat Pemberitahuan Kegiatan — berdasarkan dokumen Word sumber.
   KOP dan logo mengikuti pengaturan KOP global milik pengguna. */
const TemplateSuratPemberitahuanKegiatan = (() => {
  const TEMPLATE_ID = 'surat-pemberitahuan-kegiatan';
  const meta = {
    id: TEMPLATE_ID,
    name: 'Surat Pemberitahuan Kegiatan',
    description: 'Pemberitahuan kegiatan madrasah kepada orang tua/wali, termasuk jadwal, peserta, tujuan, dan ketentuan khusus.',
    icon: 'mail',
    orientation: 'portrait',
    paperSize: 'a4',
    category: 'surat-menyurat-siswa',
    usesKop: true,
  };

  function createDefaultData() {
    return {
      surat: { nomorSurat: '', kabupatenKota: 'Musi Rawas', tanggalSurat: '' },
      sekolah: { nama: 'MTs Nurul Falah' },
      kegiatan: {
        dalamRangka: '', nama: '', tanggal: '', waktu: '',
        lokasi: '', peserta: '', tujuan: '',
      },
      ketentuanTambahan: [],
      kepala: { nama: '', nip: '' },
    };
  }

  function createItem() {
    return { id: Utils.generateId('ketentuan'), teks: '' };
  }

  const formSections = [
    {
      id: 'surat', title: 'Identitas Surat', icon: 'file-text',
      fields: [
        { key: 'surat.nomorSurat', label: 'Nomor Surat', type: 'text', required: true },
        { key: 'surat.kabupatenKota', label: 'Kabupaten/Kota', type: 'text', required: true },
        { key: 'surat.tanggalSurat', label: 'Tanggal Surat', type: 'date', required: true },
      ],
    },
    {
      id: 'sekolah', title: 'Sekolah/Madrasah', icon: 'school',
      fields: [
        { key: 'sekolah.nama', label: 'Nama Sekolah/Madrasah', type: 'text', required: true },
      ],
    },
    {
      id: 'kegiatan', title: 'Rincian Kegiatan', icon: 'file-text',
      fields: [
        { key: 'kegiatan.dalamRangka', label: 'Dalam Rangka', type: 'textarea', required: true, rows: 2 },
        { key: 'kegiatan.nama', label: 'Nama Kegiatan/Acara', type: 'text', required: true },
        { key: 'kegiatan.tanggal', label: 'Tanggal Kegiatan/Acara', type: 'date', required: true,
          hint: 'Hari kegiatan otomatis mengikuti tanggal yang dipilih.' },
        { key: 'kegiatan.waktu', label: 'Waktu Mulai (WIB)', type: 'text', required: true,
          placeholder: 'Contoh: 08.00' },
        { key: 'kegiatan.lokasi', label: 'Tempat/Lokasi Kegiatan', type: 'textarea', required: true, rows: 2 },
        { key: 'kegiatan.peserta', label: 'Peserta', type: 'text', required: true,
          placeholder: 'Contoh: Seluruh siswa kelas VII dan VIII' },
        { key: 'kegiatan.tujuan', label: 'Tujuan Kegiatan/Acara', type: 'textarea', required: true, rows: 2 },
      ],
    },
    {
      id: 'ketentuanTambahan',
      title: 'Ketentuan Tambahan/Khusus',
      icon: 'file-text',
      type: 'repeatable',
      itemLabel: 'Ketentuan',
      itemFactory: createItem,
      required: false,
      fields: [
        { key: 'teks', label: 'Isi Ketentuan', type: 'textarea', required: false,
          rows: 2, placeholder: 'Tulis ketentuan untuk orang tua/wali atau peserta' },
      ],
    },
    {
      id: 'kepala', title: 'Tanda Tangan Kepala Sekolah/Madrasah', icon: 'signature',
      fields: [
        { key: 'kepala.nama', label: 'Nama Kepala Sekolah/Madrasah', type: 'text', required: true },
        { key: 'kepala.nip', label: 'NIP (jika ada)', type: 'text', required: false },
      ],
    },
  ];

  const tableColumns = [];
  return { TEMPLATE_ID, meta, createDefaultData, createItem, formSections, tableColumns };
})();
