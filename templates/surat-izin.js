/* =============================================================
   templates/surat-izin.js — Surat Permohonan Izin Tidak Masuk Sekolah
   =============================================================
   Berdasarkan dokumen: "Format Surat Izin"
   Pengirim : Orang Tua/Wali Murid
   Tujuan   : Guru di sekolah/madrasah
   Ukuran kertas: A4 Portrait
*/

const TemplateSuratIzin = (() => {

  /* ── ID Template ── */
  const TEMPLATE_ID = 'surat-izin';

  /* ── Metadata ── */
  const meta = {
    id: TEMPLATE_ID,
    name: 'Surat Izin Tidak Masuk',
    description: 'Surat permohonan izin tidak masuk sekolah dari orang tua/wali murid.',
    icon: '✉️',
    orientation: 'portrait',
    paperSize: 'a4',
    category: 'izin',
    usesKop: false, // Surat pribadi orang tua/wali, tanpa KOP madrasah
  };

  /* ── Pilihan Alasan Izin sesuai panduan ── */
  const ALASAN_PILIHAN = [
    { value: "sakit", label: "Sakit", text: "Sedang sakit dan membutuhkan waktu untuk beristirahat serta memulihkan kondisi kesehatan." },
    { value: "mengikuti-orang-tua", label: "Mengikuti orang tua", text: "Harus mengikuti orang tua untuk suatu keperluan keluarga yang tidak dapat ditinggalkan." },
    { value: "urusan-keluarga", label: "Urusan keluarga", text: "Terdapat keperluan keluarga penting yang mengharuskan anak kami tidak masuk sekolah." },
    { value: "acara-keluarga", label: "Acara keluarga", text: "Menghadiri acara keluarga yang tidak dapat ditinggalkan." },
    { value: "berobat", label: "Berobat", text: "Menjalani pemeriksaan atau pengobatan kesehatan." },
    { value: "musibah-keluarga", label: "Musibah keluarga", text: "Mengalami musibah keluarga sehingga belum dapat mengikuti kegiatan pembelajaran." },
    { value: "lainnya", label: "Keperluan lainnya", text: "Memiliki keperluan penting, yaitu …" },
  ];

  /* Ubah alasan bebas pada draft lama menjadi pilihan yang bisa diedit. */
  function normalizeLegacyAlasan(izin) {
    const raw = typeof izin?.alasanIzin === 'string' ? izin.alasanIzin.trim() : '';
    if (!raw || ALASAN_PILIHAN.some(pilihan => pilihan.value === raw)) return null;
    const match = ALASAN_PILIHAN.find(pilihan =>
      pilihan.label.toLowerCase() === raw.toLowerCase()
      || pilihan.text.toLowerCase() === raw.toLowerCase());
    if (match && match.value !== 'lainnya') {
      return { alasanIzin: match.value, alasanIzinLainnya: '' };
    }
    const detail = typeof izin?.alasanIzinLainnya === 'string' && izin.alasanIzinLainnya.trim()
      ? izin.alasanIzinLainnya
      : raw;
    return { alasanIzin: 'lainnya', alasanIzinLainnya: detail };
  }

  /* Satu sumber redaksi untuk preview, cetak, dan ekspor PDF. */
  function getAlasanIzinText(izin) {
    const kode = typeof izin?.alasanIzin === 'string' ? izin.alasanIzin.trim() : '';
    const pilihan = ALASAN_PILIHAN.find(item => item.value === kode);
    if (!pilihan) return kode; // Kompatibilitas dokumen lama sebelum normalisasi.
    if (kode !== 'lainnya') return pilihan.text;
    const detail = typeof izin?.alasanIzinLainnya === 'string' ? izin.alasanIzinLainnya.trim() : '';
    return detail ? `Memiliki keperluan penting, yaitu ${detail.replace(/[.\s]+$/, '')}.` : '';
  }

  /* Izinkan hanya data URL PNG berukuran wajar untuk gambar tanda tangan. */
  function getSignatureDataUrl(value) {
    if (typeof value !== 'string' || value.length > 350000) return '';
    return /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
  }

  /* ── Default form data ── */
  function createDefaultData() {
    return {
      sekolah: {
        namaSekolahan: 'MTs Nurul Falah',
      },
      murid: {
        namaOrangTuaWali: '',
        namaMurid: '',
        kelasMurid: '',
      },
      izin: {
        hariTanggalIzin: '',   // teks bebas, mis. "Senin, 10 November 2026"
        durasiIzin: '',        // teks bebas, mis. "1 (satu) hari"
        alasanIzin: '',
        alasanIzinLainnya: '',
      },
      pengirim: {
        namaLokasi:       'Terawas',
        tanggalKeluarSurat: '',  // ISO: YYYY-MM-DD
        tandaTanganDataUrl: '', // PNG transparan, opsional; disimpan bersama draf
      },
    };
  }

  /* ── Form sections ── */
  const formSections = [
    {
      id: 'sekolah',
      title: 'Data Sekolah',
      icon: '🏫',
      fields: [
        {
          key: 'sekolah.namaSekolahan',
          label: 'Nama Sekolah/Madrasah',
          type: 'text',
          placeholder: 'Contoh: MTs Nurul Falah',
          required: true,
        },
      ],
    },
    {
      id: 'murid',
      title: 'Data Murid',
      icon: '👤',
      fields: [
        {
          key: 'murid.namaOrangTuaWali',
          label: 'Nama Orang Tua/Wali',
          type: 'text',
          placeholder: 'Nama lengkap orang tua atau wali',
          required: true,
        },
        {
          key: 'murid.namaMurid',
          label: 'Nama Murid',
          type: 'text',
          placeholder: 'Nama lengkap murid',
          required: true,
        },
        {
          key: 'murid.kelasMurid',
          label: 'Kelas',
          type: 'text',
          placeholder: 'Contoh: VII A',
          required: true,
        },
      ],
    },
    {
      id: 'izin',
      title: 'Keterangan Izin',
      icon: '📅',
      fields: [
        {
          key: 'izin.hariTanggalIzin',
          label: 'Hari, Tanggal Izin',
          type: 'text',
          placeholder: 'Contoh: Senin, 10 November 2026',
          required: true,
          hint: 'Isi dengan hari dan tanggal lengkap.',
        },
        {
          key: 'izin.durasiIzin',
          label: 'Lama Izin',
          type: 'text',
          placeholder: 'Contoh: 1 (satu) hari',
          required: true,
        },
        {
          key: 'izin.alasanIzin',
          label: 'Alasan Izin',
          type: 'select',
          required: true,
          hint: 'Pilih kondisi yang sesuai. Kalimat alasan akan otomatis dimasukkan ke surat.',
          options: [
            { value: '', label: 'Pilih alasan izin...' },
            ...ALASAN_PILIHAN.map(pilihan => ({
              value: pilihan.value,
              label: pilihan.label,
              description: pilihan.value === 'lainnya'
                ? 'Tuliskan keperluan lainnya pada kolom yang muncul.'
                : pilihan.text,
            })),
          ],
          clearDependent: { key: 'izin.alasanIzinLainnya', keepValue: 'lainnya' },
        },
        {
          key: 'izin.alasanIzinLainnya',
          label: 'Detail Keperluan Lainnya',
          type: 'text',
          placeholder: 'Contoh: menghadiri kegiatan keluarga yang mendesak',
          maxLength: 255,
          required: true,
          showIf: data => data?.izin?.alasanIzin === 'lainnya',
        },
      ],
    },
    {
      id: 'pengirim',
      title: 'Tanda Tangan',
      icon: '✍️',
      fields: [
        {
          key: 'pengirim.namaLokasi',
          label: 'Nama Kota/Lokasi',
          type: 'text',
          placeholder: 'Contoh: Terawas',
          required: false,
        },
        {
          key: 'pengirim.tanggalKeluarSurat',
          label: 'Tanggal Surat',
          type: 'date',
          required: false,
        },
        {
          key: 'pengirim.tandaTanganDataUrl',
          label: 'Tanda Tangan Orang Tua/Wali',
          type: 'signature',
          required: false,
          hint: 'Gambar menggunakan jari, stylus, atau mouse. Kosongkan bila ingin menandatangani surat setelah dicetak.',
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
    ALASAN_PILIHAN,
    getAlasanIzinText,
    getSignatureDataUrl,
    normalizeLegacyAlasan,
    tableColumns,
  };

})();
