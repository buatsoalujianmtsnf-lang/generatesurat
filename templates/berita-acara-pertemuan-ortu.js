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
  "pihakHadir": [],
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
  function createPihak() { return { id: Utils.generateId('pihak-hadir'), nama: '', jabatan: '' }; }
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
    "itemFactory": "createPihak",
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
    "itemFactory": "createKesepakatan",
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
    "title": "H. Pihak yang Menandatangani",
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
  return { TEMPLATE_ID, meta, createDefaultData, formSections, tableColumns, createPihak, createKesepakatan };
})();
