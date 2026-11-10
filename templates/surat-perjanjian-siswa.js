/* Surat Perjanjian Siswa: adapted from user-provided Word source, retaining its clauses and structure.
   Form data remains in the standard local State/draft workflow. */
const TemplateSuratPerjanjianSiswa = (() => {
  const TEMPLATE_ID = 'surat-perjanjian-siswa';
  const meta = {
  "id": "surat-perjanjian-siswa",
  "name": "Surat Perjanjian Siswa",
  "description": "Perjanjian kepatuhan tata tertib dengan empat pasal serta persetujuan orang tua, wali kelas, guru BK, dan kepala sekolah/madrasah.",
  "icon": "file-text",
  "orientation": "portrait",
  "paperSize": "a4",
  "category": "surat-menyurat-siswa",
  "usesKop": false
};
  const createDefaultData = () => ({
  "sekolah": {
    "nama": "MTs Nurul Falah",
    "jenisSatdik": "Madrasah"
  },
  "surat": {
    "kota": "Musi Rawas",
    "tanggal": ""
  },
  "siswa": {
    "nama": "",
    "nis": "",
    "nisn": "",
    "tempatLahir": "",
    "tanggalLahir": "",
    "kelas": ""
  },
  "orangTua": {
    "nama": "",
    "alamat": ""
  },
  "pelanggaran": {
    "uraian": "",
    "tanggal": "",
    "lokasi": ""
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

  const formSections = [
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
    "id": "surat",
    "title": "Tanggal Surat",
    "icon": "file-text",
    "fields": [
      {
        "key": "surat.kota",
        "label": "Kabupaten/Kota",
        "type": "text",
        "required": true
      },
      {
        "key": "surat.tanggal",
        "label": "Tanggal Surat",
        "type": "date",
        "required": true
      }
    ]
  },
  {
    "id": "siswa",
    "title": "Identitas Siswa",
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
      }
    ]
  },
  {
    "id": "orangTua",
    "title": "Orang Tua/Wali",
    "icon": "user",
    "fields": [
      {
        "key": "orangTua.nama",
        "label": "Nama Orang Tua/Wali",
        "type": "text",
        "required": true
      },
      {
        "key": "orangTua.alamat",
        "label": "Alamat Orang Tua/Wali",
        "type": "textarea",
        "required": true
      }
    ]
  },
  {
    "id": "pelanggaran",
    "title": "Pasal 1 — Pelanggaran Tata Tertib",
    "icon": "file-text",
    "fields": [
      {
        "key": "pelanggaran.uraian",
        "label": "Uraian Pelanggaran",
        "type": "textarea",
        "required": true
      },
      {
        "key": "pelanggaran.tanggal",
        "label": "Tanggal Kejadian",
        "type": "date",
        "required": true
      },
      {
        "key": "pelanggaran.lokasi",
        "label": "Tempat Kejadian",
        "type": "textarea",
        "required": true
      }
    ]
  },
  {
    "id": "penandatangan",
    "title": "Pihak yang Mengetahui dan Mengesahkan",
    "icon": "signature",
    "fields": [
      {
        "key": "penandatangan.waliKelas",
        "label": "Nama Wali Kelas",
        "type": "text",
        "required": true
      },
      {
        "key": "penandatangan.nipWaliKelas",
        "label": "NIP Wali Kelas",
        "type": "text",
        "required": false
      },
      {
        "key": "penandatangan.guruBk",
        "label": "Nama Guru BK/Bidang Kesiswaan",
        "type": "text",
        "required": true
      },
      {
        "key": "penandatangan.nipGuruBk",
        "label": "NIP Guru BK/Bidang Kesiswaan",
        "type": "text",
        "required": false
      },
      {
        "key": "penandatangan.kepala",
        "label": "Nama Kepala Sekolah/Madrasah",
        "type": "text",
        "required": true
      },
      {
        "key": "penandatangan.nipKepala",
        "label": "NIP Kepala Sekolah/Madrasah",
        "type": "text",
        "required": false
      }
    ]
  }
];
  const tableColumns = [];
  return { TEMPLATE_ID, meta, createDefaultData, formSections, tableColumns };
})();
