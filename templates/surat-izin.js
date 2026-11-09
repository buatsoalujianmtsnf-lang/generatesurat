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
    icon: 'mail',
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


  /* Simpan tanggal ISO; format hari dan bulan Indonesia hanya untuk surat. */
  const BULAN_INDONESIA = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const HARI_INDONESIA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const TERBILANG_HARI = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh'];

  function isValidIzinDate(iso) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const [year, month, day] = iso.split('-').map(Number);
    if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  }

  function formatHariTanggalIzin(value) {
    if (!isValidIzinDate(value)) return '';
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return HARI_INDONESIA[date.getUTCDay()] + ', ' + String(day).padStart(2, '0')
      + ' ' + BULAN_INDONESIA[month - 1] + ' ' + year;
  }

  function formatLamaIzin(value) {
    const raw = String(value ?? '').trim();
    if (!/^[1-7]$/.test(raw)) return '';
    const number = Number(raw);
    return number + ' (' + TERBILANG_HARI[number] + ') Hari';
  }

  /* Normalisasi draf lama yang menggunakan tanggal/durasi sebagai teks bebas.
     Nilai yang tidak dikenali tidak dibuang agar data terdahulu tetap aman. */
  function normalizeLegacyIzinFields(izin) {
    if (!izin || typeof izin !== 'object') return null;
    const patch = {};
    const tanggal = typeof izin.hariTanggalIzin === 'string' ? izin.hariTanggalIzin.trim() : '';
    if (tanggal && !isValidIzinDate(tanggal)) {
      const found = /^(?:(?:[a-z']+),?\s+)?(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i.exec(tanggal);
      if (found) {
        const monthIndex = BULAN_INDONESIA.findIndex(name => name.toLowerCase() === found[2].toLowerCase());
        if (monthIndex !== -1) {
          const iso = [found[3], String(monthIndex + 1).padStart(2, '0'), found[1].padStart(2, '0')].join('-');
          if (isValidIzinDate(iso)) patch.hariTanggalIzin = iso;
        }
      }
    }
    const durasi = typeof izin.durasiIzin === 'string' ? izin.durasiIzin.trim() : '';
    if (durasi && !/^[1-7]$/.test(durasi)) {
      const found = /^([1-7])(?:\s*\([a-z]+\))?(?:\s+hari)?$/i.exec(durasi);
      if (found) patch.durasiIzin = Number(found[1]);
    }
    return Object.keys(patch).length ? patch : null;
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
        hariTanggalIzin: '',   // ISO YYYY-MM-DD
        durasiIzin: '',        // bilangan bulat 1 sampai 7
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
      icon: 'school',
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
      icon: 'user',
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
      icon: 'calendar',
      fields: [
        {
          key: 'izin.hariTanggalIzin',
          label: 'Hari, Tanggal Izin',
          type: 'date',
          required: true,
        },
        {
          key: 'izin.durasiIzin',
          label: 'Lama Izin',
          type: 'number',
          min: 1,
          max: 7,
          step: 1,
          integer: true,
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
      icon: 'signature',
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
          hint: 'Tanda tangan menggunakan tinta biru. Gambar dengan jari, stylus, atau mouse, atau kosongkan untuk tanda tangan manual setelah dicetak.',
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
    isValidIzinDate,
    formatHariTanggalIzin,
    formatLamaIzin,
    normalizeLegacyIzinFields,
    getSignatureDataUrl,
    normalizeLegacyAlasan,
    tableColumns,
  };

})();
