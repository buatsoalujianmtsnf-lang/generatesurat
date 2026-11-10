/* Berita Acara Pertemuan Orang Tua/Wali Siswa: adapted from user-provided Word source, retaining its clauses and structure.
   Form data remains in the standard local State/draft workflow. */
const TemplateBeritaAcaraPertemuanOrtu = (() => {
  const TEMPLATE_ID = 'berita-acara-pertemuan-ortu';
  const meta = {
  "id": "berita-acara-pertemuan-ortu",
  "name": "Berita Acara Pertemuan Orang Tua/Wali Siswa",
  "description": "Berita acara pembinaan siswa dengan identitas, pihak hadir, klarifikasi, komitmen, rencana tindak lanjut dan tanda tangan.",
  "icon": "file-text",
  "orientation": "portrait",
  "paperSize": "a4",
  "category": "surat-menyurat-siswa",
  "usesKop": true
};
  const createDefaultData = () => ({
  "surat": {
    "nomor": "",
    "kota": "Musi Rawas",
    "tanggal": ""
  },
  "sekolah": {
    "nama": "MTs Nurul Falah",
    "jenisSatdik": "Madrasah"
  },
  "siswa": {
    "nama": "",
    "nis": "",
    "nisn": "",
    "tempatLahir": "",
    "tanggalLahir": "",
    "kelas": "",
    "alamat": "",
    "namaOrangTua": ""
  },
  "pertemuan": {
    "tanggal": "",
    "waktu": "",
    "lokasi": ""
  },
  "pihakAutoSyncV1": true,
  "pihakHadir": [
    { "id": "pihak-orang-tua", "nama": "", "jabatan": "Orang Tua/Wali Siswa" },
    { "id": "pihak-siswa", "nama": "", "jabatan": "Siswa yang Bersangkutan" },
    { "id": "pihak-wali-kelas", "nama": "", "jabatan": "Wali Kelas" },
    { "id": "pihak-guru-bk", "nama": "", "jabatan": "Guru BK/Bidang Kesiswaan" },
    { "id": "pihak-kepala", "nama": "", "jabatan": "Kepala Madrasah" }
  ],
  "permasalahan": {
    "jenis": "",
    "tanggal": "",
    "lokasi": "",
    "uraian": ""
  },
  "klarifikasi": {
    "sekolah": "",
    "siswa": "",
    "orangTua": "",
    "bersama": ""
  },
  "kesepakatanTambahan": [],
  "tindakLanjut": {
    "pembinaan": "",
    "penanggungJawab": "",
    "tanggalEvaluasi": "",
    "waktuEvaluasi": "",
    "indikator": "",
    "keterangan": ""
  },
  "penandatangan": {
    "waliKelas": "",
    "nipWaliKelas": "",
    "guruBk": "",
    "nipGuruBk": "",
    "kepala": "",
    "nipKepala": ""
  }
});
  const FIXED_ROLES = [
    'Orang Tua/Wali Siswa',
    'Siswa yang Bersangkutan',
    'Wali Kelas',
    'Guru BK/Bidang Kesiswaan',
    'Kepala Madrasah',
  ];

  function createPihak() { return { id: Utils.generateId('pihak-hadir'), nama: '', jabatan: '' }; }

  /**
   * Builds effective attendance from a draft without mutating it.
   * 1–2 are bound to student identity. 3–5 are editable but anchored, while
   * 6+ can be added/removed. For old drafts, retain displaced first-two rows
   * as extra attendees rather than silently discarding user-entered names.
   */
  function getPihakHadir(data = {}) {
    const raw = Array.isArray(data.pihakHadir) ? data.pihakHadir : [];
    const pupil = data.siswa || {};
    const legacy = data.penandatangan || {};
    const legacyNames = ['', '', legacy.waliKelas, legacy.guruBk, legacy.kepala];
    const derivedNames = [
      String(pupil.namaOrangTua || ''),
      String(pupil.nama || ''),
    ];
    const used = new Set();
    function uniqueId(candidate) {
      const id = typeof candidate === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(candidate)
        && !used.has(candidate)
        ? candidate : Utils.generateId('pihak-hadir');
      used.add(id);
      return id;
    }

    const initial = FIXED_ROLES.map((role, index) => {
      const old = raw[index] && typeof raw[index] === 'object' ? raw[index] : {};
      const id = uniqueId(old.id || ['pihak-orang-tua','pihak-siswa','pihak-wali-kelas','pihak-guru-bk','pihak-kepala'][index]);
      const name = index < 2 ? derivedNames[index]
        : (typeof old.nama === 'string' ? old.nama : String(legacyNames[index] || ''));
      const status = index < 2 ? role
        : (typeof old.jabatan === 'string' && old.jabatan.trim() ? old.jabatan : role);
      return { ...old, id, nama: name, jabatan: status };
    });

    const extras = raw.slice(5).filter(item => item && typeof item === 'object')
      .map(item => ({ ...item, id: uniqueId(item.id), nama: String(item.nama || ''),
        jabatan: String(item.jabatan || '') }));

    // One-time migration: old unlinked rows 1/2 must not be lost.
    if (data.pihakAutoSyncV1 !== true) {
      raw.slice(0, 2).forEach((item, index) => {
        if (!item || typeof item !== 'object') return;
        const name = String(item.nama || '').trim();
        const status = String(item.jabatan || '').trim();
        const duplicate = !name && (!status || status === FIXED_ROLES[index]);
        const alreadyBound = name === derivedNames[index].trim()
          && (!status || status === FIXED_ROLES[index]);
        if (!duplicate && !alreadyBound) {
          extras.push({ ...item, id: uniqueId(''), nama: String(item.nama || ''),
            jabatan: String(item.jabatan || '') });
        }
      });
    }
    return [...initial, ...extras];
  }

  /** Called by the editor after restore and on changes to student identity. */
  function normalizePihakHadir(data = {}) {
    const normalized = getPihakHadir(data);
    if (data.pihakAutoSyncV1 === true &&
        JSON.stringify(data.pihakHadir) === JSON.stringify(normalized)) return null;
    return { pihakHadir: normalized, pihakAutoSyncV1: true };
  }
  function createKesepakatan() { return { id: Utils.generateId('kesepakatan'), teks: '' }; }
  const formSections = [
  {
    "id": "surat",
    "title": "Identitas Berita Acara",
    "icon": "file-text",
    "fields": [
      {
        "key": "surat.nomor",
        "label": "Nomor Berita Acara",
        "type": "text",
        "required": true
      },
      {
        "key": "surat.kota",
        "label": "Kabupaten/Kota",
        "type": "text",
        "required": true
      },
      {
        "key": "surat.tanggal",
        "label": "Tanggal Berita Acara",
        "type": "date",
        "required": true
      }
    ]
  },
  {
    "id": "sekolah",
    "title": "Sekolah/Madrasah",
    "icon": "school",
    "fields": [
      {
        "key": "sekolah.nama",
        "label": "Nama Sekolah/Madrasah",
        "type": "text",
        "required": true
      },
      {
        "key": "sekolah.jenisSatdik",
        "label": "Jenis Satdik",
        "type": "select",
        "required": true,
        "options": [
          {
            "value": "Madrasah",
            "label": "Madrasah"
          },
          {
            "value": "Sekolah",
            "label": "Sekolah"
          }
        ]
      }
    ]
  },
  {
    "id": "siswa",
    "title": "A. Identitas Siswa",
    "icon": "user",
    "fields": [
      {
        "key": "siswa.nama",
        "label": "Nama Lengkap Siswa",
        "type": "text",
        "required": true
      },
      {
        "key": "siswa.nis",
        "label": "NIS",
        "type": "text",
        "required": true
      },
      {
        "key": "siswa.nisn",
        "label": "NISN",
        "type": "text",
        "required": true,
        "placeholder": "10 digit angka"
      },
      {
        "key": "siswa.tempatLahir",
        "label": "Tempat Lahir",
        "type": "text",
        "required": true
      },
      {
        "key": "siswa.tanggalLahir",
        "label": "Tanggal Lahir",
        "type": "date",
        "required": true
      },
      {
        "key": "siswa.kelas",
        "label": "Kelas",
        "type": "text",
        "required": true
      },
      {
        "key": "siswa.alamat",
        "label": "Alamat Siswa",
        "type": "textarea",
        "required": true
      },
      {
        "key": "siswa.namaOrangTua",
        "label": "Nama Orang Tua/Wali",
        "type": "text",
        "required": true
      }
    ]
  },
  {
    "id": "pertemuan",
    "title": "B. Waktu dan Tempat Pertemuan",
    "icon": "file-text",
    "fields": [
      {
        "key": "pertemuan.tanggal",
        "label": "Tanggal Pertemuan",
        "type": "date",
        "required": true
      },
      {
        "key": "pertemuan.waktu",
        "label": "Waktu (WIB)",
        "type": "text",
        "required": true,
        "placeholder": "Contoh: 09.00"
      },
      {
        "key": "pertemuan.lokasi",
        "label": "Lokasi Pertemuan",
        "type": "textarea",
        "required": true
      }
    ]
  },
  {
    "id": "pihakHadir",
    "title": "C. Pihak yang Hadir",
    "icon": "user",
    "type": "repeatable",
    "itemLabel": "Pihak yang Hadir",
    itemFactory: createPihak,
    protectedCount: 5,
    syncedCount: 2,
    "required": true,
    "fields": [
      {
        "key": "nama",
        "label": "Nama",
        "type": "text",
        "required": true
      },
      {
        "key": "jabatan",
        "label": "Jabatan/Status",
        "type": "text",
        "required": true
      }
    ]
  },
  {
    "id": "permasalahan",
    "title": "D. Pokok Permasalahan",
    "icon": "file-text",
    "fields": [
      {
        "key": "permasalahan.jenis",
        "label": "Jenis Permasalahan",
        "type": "text",
        "required": true
      },
      {
        "key": "permasalahan.tanggal",
        "label": "Tanggal Kejadian",
        "type": "date",
        "required": true
      },
      {
        "key": "permasalahan.lokasi",
        "label": "Tempat Kejadian",
        "type": "textarea",
        "required": true
      },
      {
        "key": "permasalahan.uraian",
        "label": "Uraian Permasalahan",
        "type": "textarea",
        "required": true
      }
    ]
  },
  {
    "id": "klarifikasi",
    "title": "E. Hasil Klarifikasi dan Pembahasan",
    "icon": "file-text",
    "fields": [
      {
        "key": "klarifikasi.sekolah",
        "label": "Keterangan Pihak Sekolah/Madrasah",
        "type": "textarea",
        "required": true
      },
      {
        "key": "klarifikasi.siswa",
        "label": "Keterangan Siswa",
        "type": "textarea",
        "required": true
      },
      {
        "key": "klarifikasi.orangTua",
        "label": "Keterangan Orang Tua/Wali",
        "type": "textarea",
        "required": true
      },
      {
        "key": "klarifikasi.bersama",
        "label": "Hasil Pembahasan Bersama",
        "type": "textarea",
        "required": true
      }
    ]
  },
  {
    "id": "kesepakatanTambahan",
    "title": "F. Kesepakatan Tambahan/Khusus",
    "icon": "file-text",
    "type": "repeatable",
    "itemLabel": "Kesepakatan",
    itemFactory: createKesepakatan,
    "required": false,
    "fields": [
      {
        "key": "teks",
        "label": "Isi Kesepakatan",
        "type": "textarea",
        "required": false
      }
    ]
  },
  {
    "id": "tindakLanjut",
    "title": "G. Rencana Tindak Lanjut",
    "icon": "file-text",
    "fields": [
      {
        "key": "tindakLanjut.pembinaan",
        "label": "Bentuk Pembinaan",
        "type": "textarea",
        "required": true
      },
      {
        "key": "tindakLanjut.penanggungJawab",
        "label": "Penanggung Jawab",
        "type": "text",
        "required": true
      },
      {
        "key": "tindakLanjut.tanggalEvaluasi",
        "label": "Tanggal Evaluasi",
        "type": "date",
        "required": true
      },
      {
        "key": "tindakLanjut.waktuEvaluasi",
        "label": "Waktu Evaluasi (opsional)",
        "type": "text",
        "required": false,
        "placeholder": "Contoh: 10.00 WIB"
      },
      {
        "key": "tindakLanjut.indikator",
        "label": "Indikator Keberhasilan",
        "type": "textarea",
        "required": true
      },
      {
        "key": "tindakLanjut.keterangan",
        "label": "Keterangan Tambahan",
        "type": "textarea",
        "required": false
      }
    ]
  },
  {
    "id": "penandatangan",
    "title": "H. Tanda Tangan — Nama dan Jabatan Otomatis dari Pihak yang Hadir",
    "icon": "signature",
    "fields": [
      { "key": "penandatangan.nipWaliKelas", "label": "NIP Pihak 3 (opsional)", "type": "text", "required": false },
      { "key": "penandatangan.nipGuruBk", "label": "NIP Pihak 4 (opsional)", "type": "text", "required": false },
      { "key": "penandatangan.nipKepala", "label": "NIP Pihak 5 (opsional)", "type": "text", "required": false }
    ]
  }
];
  const tableColumns = [];
  return {
    TEMPLATE_ID, meta, createDefaultData, formSections, tableColumns,
    createPihak, createKesepakatan, getPihakHadir, normalizePihakHadir,
  };
})();
