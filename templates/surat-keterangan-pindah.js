/* Template Surat Keterangan Pindah Sekolah — diadaptasi dari DOCX yang dilampirkan. */
const TemplateSuratKeteranganPindah = (() => {
  const TEMPLATE_ID = 'surat-keterangan-pindah';
  const meta = {
  "id": "surat-keterangan-pindah",
  "name": "Surat Keterangan Pindah Sekolah",
  "description": "Surat resmi keterangan siswa pindah dari sekolah/madrasah asal menuju sekolah tujuan.",
  "icon": "school",
  "orientation": "portrait",
  "paperSize": "a4",
  "category": "surat-menyurat-siswa",
  "usesKop": true
};
  const createDefaultData = () => ({
  "surat": {
    "nomorSurat": "",
    "kota": "Musi Rawas",
    "tanggalSurat": ""
  },
  "sekolah": {
    "nama": "MTs Nurul Falah",
    "kelurahanDesa": "Kelurahan Terawas"
  },
  "siswa": {
    "namaLengkap": "",
    "tempatLahir": "",
    "tanggalLahir": "",
    "jenisKelamin": "",
    "nisn": "",
    "kelas": ""
  },
  "pindah": {
    "namaOrangTuaWali": "",
    "tanggalPermohonan": "",
    "sekolahTujuan": "",
    "alamatSekolahTujuan": "",
    "alasan": ""
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
        "key": "surat.nomorSurat",
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
        "key": "surat.tanggalSurat",
        "label": "Tanggal Surat",
        "type": "date",
        "required": true
      }
    ]
  },
  {
    "id": "sekolah",
    "title": "Sekolah/Madrasah Asal",
    "icon": "school",
    "fields": [
      {
        "key": "sekolah.nama",
        "label": "Nama Sekolah/Madrasah",
        "type": "text",
        "required": true
      },
      {
        "key": "sekolah.kelurahanDesa",
        "label": "Nama Kelurahan/Desa",
        "type": "text",
        "required": true
      }
    ]
  },
  {
    "id": "siswa",
    "title": "Data Siswa",
    "icon": "user",
    "fields": [
      {
        "key": "siswa.namaLengkap",
        "label": "Nama Lengkap Siswa",
        "type": "text",
        "required": true
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
        "key": "siswa.jenisKelamin",
        "label": "Jenis Kelamin",
        "type": "select",
        "required": true,
        "options": [
          {
            "value": "",
            "label": "Pilih jenis kelamin"
          },
          {
            "value": "Laki-laki",
            "label": "Laki-laki"
          },
          {
            "value": "Perempuan",
            "label": "Perempuan"
          }
        ]
      },
      {
        "key": "siswa.nisn",
        "label": "NISN",
        "type": "text",
        "required": true,
        "maxLength": 10,
        "inputMode": "numeric"
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
    "id": "pindah",
    "title": "Data Kepindahan",
    "icon": "arrows-exchange",
    "fields": [
      {
        "key": "pindah.namaOrangTuaWali",
        "label": "Nama Orang Tua/Wali",
        "type": "text",
        "required": true
      },
      {
        "key": "pindah.tanggalPermohonan",
        "label": "Tanggal Surat Permohonan Orang Tua/Wali",
        "type": "date",
        "required": true
      },
      {
        "key": "pindah.sekolahTujuan",
        "label": "Nama Sekolah/Madrasah Tujuan",
        "type": "text",
        "required": true
      },
      {
        "key": "pindah.alamatSekolahTujuan",
        "label": "Alamat Sekolah/Madrasah Tujuan",
        "type": "textarea",
        "required": true
      },
      {
        "key": "pindah.alasan",
        "label": "Alasan Pindah",
        "type": "textarea",
        "required": true
      }
    ]
  },
  {
    "id": "kepala",
    "title": "Tanda Tangan Kepala Sekolah/Madrasah",
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
