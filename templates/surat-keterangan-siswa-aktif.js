/* Surat Keterangan Siswa Aktif — berdasarkan dokumen Word sumber.
   KOP dan logo mengikuti pengaturan KOP global milik pengguna. */
const TemplateSuratKeteranganSiswaAktif = (() => {
  const TEMPLATE_ID = 'surat-keterangan-siswa-aktif';
  const meta = {
    id: TEMPLATE_ID,
    name: 'Surat Keterangan Siswa Aktif',
    description: 'Keterangan resmi bahwa siswa masih aktif dan mengikuti pembelajaran pada semester dan tahun pelajaran tertentu.',
    icon: 'school',
    orientation: 'portrait',
    paperSize: 'a4',
    category: 'surat-menyurat-siswa',
    usesKop: true,
  };

  function createDefaultData() {
    return {
      surat: { nomorSurat: '', kabupatenKota: 'Musi Rawas', tanggalSurat: '' },
      kepala: { nama: '', nip: '' },
      sekolah: {
        nama: 'MTs Nurul Falah',
        alamat: 'Jl. Jambi Lama RT. 004 Kelurahan Terawas Kecamatan STL. Ulu Terawas 30771',
      },
      siswa: {
        namaLengkap: '', tempatLahir: '', tanggalLahir: '',
        nis: '', nisn: '', jenisKelamin: '', kelas: '',
        semester: '', tahunPelajaran: '',
      },
    };
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
      id: 'kepala', title: 'Identitas Kepala Sekolah/Madrasah', icon: 'signature',
      fields: [
        { key: 'kepala.nama', label: 'Nama Kepala Sekolah/Madrasah', type: 'text', required: true },
        { key: 'kepala.nip', label: 'NIP (jika ada)', type: 'text', required: false },
      ],
    },
    {
      id: 'sekolah', title: 'Identitas Sekolah/Madrasah', icon: 'school',
      fields: [
        { key: 'sekolah.nama', label: 'Nama Sekolah/Madrasah', type: 'text', required: true },
        { key: 'sekolah.alamat', label: 'Alamat Sekolah/Madrasah', type: 'textarea',
          required: true, rows: 2 },
      ],
    },
    {
      id: 'siswa', title: 'Identitas Siswa', icon: 'user',
      fields: [
        { key: 'siswa.namaLengkap', label: 'Nama Lengkap Siswa', type: 'text', required: true },
        { key: 'siswa.tempatLahir', label: 'Tempat Lahir', type: 'text', required: true },
        { key: 'siswa.tanggalLahir', label: 'Tanggal Lahir', type: 'date', required: true },
        { key: 'siswa.nis', label: 'NIS', type: 'text', required: true },
        { key: 'siswa.nisn', label: 'NISN', type: 'text', required: true,
          placeholder: '10 digit angka' },
        { key: 'siswa.jenisKelamin', label: 'Jenis Kelamin', type: 'select', required: true,
          options: [
            { value: '', label: 'Pilih jenis kelamin' },
            { value: 'Laki-laki', label: 'Laki-laki' },
            { value: 'Perempuan', label: 'Perempuan' },
          ] },
        { key: 'siswa.kelas', label: 'Kelas', type: 'text', required: true },
        { key: 'siswa.semester', label: 'Semester', type: 'select', required: true,
          options: [
            { value: '', label: 'Pilih semester' },
            { value: 'Ganjil', label: 'Ganjil' },
            { value: 'Genap', label: 'Genap' },
          ] },
        { key: 'siswa.tahunPelajaran', label: 'Tahun Pelajaran', type: 'text', required: true,
          placeholder: 'Contoh: 2026/2027' },
      ],
    },
  ];

  const tableColumns = [];
  return { TEMPLATE_ID, meta, createDefaultData, formSections, tableColumns };
})();
