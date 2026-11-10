/* Surat Panggilan Orang Tua/Wali: adapted from user-provided Word source, retaining its clauses and structure.
   Form data remains in the standard local State/draft workflow. */
const TemplateSuratPanggilanOrangTua = (() => {
  const TEMPLATE_ID = 'surat-panggilan-orang-tua';
  const meta = {
  "id": "surat-panggilan-orang-tua",
  "name": "Surat Panggilan Orang Tua/Wali",
  "description": "Panggilan resmi orang tua/wali untuk klarifikasi, pembinaan, dan tindak lanjut kedisiplinan siswa.",
  "icon": "mail",
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
    "kelas": ""
  },
  "pertemuan": {
    "tanggal": "",
    "waktu": "",
    "lokasi": "",
    "bertemuDengan": ""
  },
  "kontak": {
    "nomorWa": "",
    "pemilikWa": ""
  },
  "kepala": {
    "nama": "",
    "nip": ""
  }
});

  const formSections = [
  {
    "id": "surat",
    "title": "Identitas Surat",
    "icon": "file-text",
    "fields": [
      {
        "key": "surat.nomor",
        "label": "Nomor Surat",
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
        "label": "Tanggal Surat",
        "type": "date",
        "required": true
      }
    ]
  },
  {
    "id": "sekolah",
    "title": "Identitas Satuan Pendidikan",
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
    "title": "Siswa yang Dipanggil",
    "icon": "user",
    "fields": [
      {
        "key": "siswa.nama",
        "label": "Nama Siswa",
        "type": "text",
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
    "id": "pertemuan",
    "title": "Jadwal Pertemuan",
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
        "placeholder": "Contoh: 08.00"
      },
      {
        "key": "pertemuan.lokasi",
        "label": "Lokasi Pertemuan",
        "type": "textarea",
        "required": true
      },
      {
        "key": "pertemuan.bertemuDengan",
        "label": "Bertemu Dengan",
        "type": "text",
        "required": true
      }
    ]
  },
  {
    "id": "kontak",
    "title": "Kontak Jika Berhalangan",
    "icon": "mail",
    "fields": [
      {
        "key": "kontak.nomorWa",
        "label": "Nomor HP/WhatsApp",
        "type": "text",
        "required": true
      },
      {
        "key": "kontak.pemilikWa",
        "label": "Nama Pemilik Nomor",
        "type": "text",
        "required": true
      }
    ]
  },
  {
    "id": "kepala",
    "title": "Tanda Tangan Kepala",
    "icon": "signature",
    "fields": [
      {
        "key": "kepala.nama",
        "label": "Nama Kepala Sekolah/Madrasah",
        "type": "text",
        "required": true
      },
      {
        "key": "kepala.nip",
        "label": "NIP",
        "type": "text",
        "required": false
      }
    ]
  }
];
  const tableColumns = [];
  return { TEMPLATE_ID, meta, createDefaultData, formSections, tableColumns };
})();
