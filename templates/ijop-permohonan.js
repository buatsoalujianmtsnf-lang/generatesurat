/* =============================================================
   templates/ijop-permohonan.js — Surat Permohonan Perpanjangan Izin Operasional
   =============================================================
   Berdasarkan dokumen: "IJOP - SURAT PERMOHONAN PERPANJANGAN IZIN OPERASIONAL
   DARI LEMBAGA"
   Instansi: RA/Madrasah, ditujukan ke Kankemenag Kabupaten/Kota pilihan pengguna
   Ukuran kertas: A4 Portrait
*/

const TemplateIjopPermohonan = (() => {

  const TEMPLATE_ID = 'ijop-permohonan';

  const meta = {
    id: TEMPLATE_ID,
    name: 'IJOP: Surat Permohonan Lembaga',
    description: 'Surat permohonan perpanjangan izin operasional RA/Madrasah dari lembaga ke Kankemenag.',
    icon: '📝',
    orientation: 'portrait',
    paperSize: 'a4',
    category: 'ijop',
  };

  function createDefaultData() {
    return {
      surat: {
        nomor: '',
        namaKabupatenKota: '',
        bentukPemerintahan: '',
        namaLokasiInstansi: '',
        tanggal: '',          // ISO: YYYY-MM-DD
      },
      lembaga: {
        bentukSatuanPendidikan: '',
        namaRaMadrasah: '',
        nsm: '',
        npsn: '',
        alamat: '',
        akteNotaris: '',
        pengesahanAkteNotaris: '',
        peringkatAkreditasi: '',
      },
      kepala: {
        namaKepala: '',
        nip: '',
        jabatan: '',
      },
    };
  }

  const formSections = [
    {
      id: 'surat',
      title: 'Identitas Surat',
      icon: '📋',
      fields: [
        {
          key: 'surat.nomor',
          label: 'Nomor Surat',
          type: 'text',
          placeholder: '……………………',
          required: false,
        },
        {
          key: 'surat.bentukPemerintahan',
          label: 'Bentuk Pemerintahan',
          type: 'select',
          options: [{ value: '', label: '…………………' }, 'Kabupaten', 'Kota'],
          required: false,
        },
        {
          key: 'surat.namaKabupatenKota',
          label: 'Nama Kabupaten/Kota',
          type: 'text',
          placeholder: '……………………',
          required: true,
        },
        {
          key: 'surat.namaLokasiInstansi',
          label: 'Nama Lokasi Instansi',
          type: 'text',
          placeholder: '……………………',
          required: false,
        },
        {
          key: 'surat.tanggal',
          label: 'Tanggal Surat',
          type: 'date',
          required: false,
        },
      ],
    },
    {
      id: 'lembaga',
      title: 'Data RA/Madrasah',
      icon: '🏫',
      fields: [
        {
          key: 'lembaga.bentukSatuanPendidikan',
          label: 'Bentuk Satuan Pendidikan',
          type: 'select',
          options: [{ value: '', label: '…………………' }, 'RA', 'Madrasah'],
          required: false,
        },
        {
          key: 'lembaga.namaRaMadrasah',
          label: 'Nama RA/Madrasah',
          type: 'text',
          placeholder: '……………………',
          required: true,
        },
        {
          key: 'lembaga.nsm',
          label: 'NSM',
          type: 'text',
          placeholder: '……………………',
          required: false,
        },
        {
          key: 'lembaga.npsn',
          label: 'NPSN',
          type: 'text',
          placeholder: '……………………',
          required: false,
        },
        {
          key: 'lembaga.alamat',
          label: 'Alamat',
          type: 'text',
          placeholder: '……………………',
          required: false,
        },
        {
          key: 'lembaga.akteNotaris',
          label: 'Akte Notaris',
          type: 'text',
          placeholder: '……………………',
          required: false,
        },
        {
          key: 'lembaga.pengesahanAkteNotaris',
          label: 'Pengesahan Akte Notaris',
          type: 'text',
          placeholder: '……………………',
          required: false,
        },
        {
          key: 'lembaga.peringkatAkreditasi',
          label: 'Peringkat Akreditasi',
          type: 'select',
          options: [{ value: '', label: '…………………' }, 'A', 'B', 'C', 'Belum Terakreditasi'],
          required: false,
        },
      ],
    },
    {
      id: 'kepala',
      title: 'Kepala',
      icon: '✍️',
      fields: [
        {
          key: 'kepala.jabatan',
          label: 'Jabatan',
          type: 'text',
          placeholder: '……………………',
          required: false,
        },
        {
          key: 'kepala.namaKepala',
          label: 'Nama Kepala',
          type: 'text',
          placeholder: '……………………',
          required: true,
        },
        {
          key: 'kepala.nip',
          label: 'NIP. Kepala RA/Madrasah',
          type: 'text',
          placeholder: '……………………',
          maxLength: 30,
          required: false,
        },
      ],
    },
  ];

  /* ── Tidak ada tabel ── */
  const tableColumns = [];

  return {
    TEMPLATE_ID,
    meta,
    createDefaultData,
    formSections,
    tableColumns,
  };

})();
