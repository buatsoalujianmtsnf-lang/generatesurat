/* Template Surat Permohonan Pindah Sekolah — diadaptasi dari DOCX yang dilampirkan. */
const TemplateSuratPermohonanPindah = (() => {
  const TEMPLATE_ID = 'surat-permohonan-pindah';
  const meta = {
  "id": "surat-permohonan-pindah",
  "name": "Surat Permohonan Pindah Sekolah",
  "description": "Permohonan tertulis dari orang tua/wali untuk memindahkan siswa ke sekolah/madrasah tujuan.",
  "icon": "mail",
  "orientation": "portrait",
  "paperSize": "a4",
  "category": "surat-menyurat-siswa",
  "usesKop": false
};
  const createDefaultData = () => ({
  "surat": {
    "kota": "Musi Rawas",
    "tanggalSurat": ""
  },
  "sekolah": {
    "nama": "MTs Nurul Falah"
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
    "sekolahTujuan": "",
    "alamatSekolahTujuan": "",
    "alasan": ""
  },
  "pengirim": {
    "namaOrangTuaWali": "",
    "tandaTanganDataUrl": ""
  }
});
  const formSections = [
  {
    "id": "surat",
    "title": "Identitas Surat",
    "icon": "file-text",
    "fields": [
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
        "label": "Nama Sekolah/Madrasah Asal",
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
    "title": "Permohonan Pindah",
    "icon": "arrows-exchange",
    "fields": [
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
    "id": "pengirim",
    "title": "Tanda Tangan Orang Tua/Wali",
    "icon": "signature",
    "fields": [
      {
        "key": "pengirim.namaOrangTuaWali",
        "label": "Nama Orang Tua/Wali",
        "type": "text",
        "required": true
      },
      {
        "key": "pengirim.tandaTanganDataUrl",
        "label": "Tanda Tangan Orang Tua/Wali",
        "type": "signature",
        "required": false,
        "hint": "Tanda tangan menggunakan tinta biru. Gambar langsung dengan jari, stylus, atau mouse, atau kosongkan untuk tanda tangan manual setelah dicetak."
      }
    ]
  }
];
  /* Saring gambar tanda tangan saat rendering agar hanya PNG data URL
     berukuran wajar yang dapat dimasukkan ke HTML/PDF/Cetak. */
  function getSignatureDataUrl(value) {
    if (typeof value !== 'string' || value.length > 350000) return '';
    return /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
  }
  const tableColumns = [];
  return { TEMPLATE_ID, meta, createDefaultData, formSections, getSignatureDataUrl, tableColumns };
})();
