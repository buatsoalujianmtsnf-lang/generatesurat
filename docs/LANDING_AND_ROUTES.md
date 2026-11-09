# Landing Page dan URL Generator Surat

## Struktur

Aplikasi tetap menggunakan HTML/JS statis dan Vercel; tidak perlu menambahkan framework atau server/router baru.

- `/` — landing page.
- `/editor` — editor daftar template.
- `/kategori/<slug>` — editor daftar template dengan accordion kategori terkait terbuka.
- `/surat/<slug>` — langsung memilih template terkait pada editor.
- `/DPUdanRegis` — URL lama/contoh yang diarahkan secara client-side ke `/kategori/registrasi-dpu`.

## URL kategori

| Kelompok | URL |
| --- | --- |
| Registrasi dan DPU | `/kategori/registrasi-dpu` |
| IJOP (Izin Operasional) | `/kategori/ijop` |
| Pengolahan Nilai | `/kategori/pengolahan-nilai` |
| Surat Menyurat Siswa | `/kategori/surat-menyurat-siswa` |

## URL langsung template

| Template | URL |
| --- | --- |
| DPU | `/surat/daftar-peserta-ujian` |
| Pengesahan Siswa Mutasi Masuk | `/surat/pengesahan-mutasi-masuk` |
| Pengesahan Siswa Baru | `/surat/pengesahan-siswa-baru` |
| Surat Permohonan Lembaga | `/surat/ijop-permohonan-lembaga` |
| SPTJM Kepala Satpen | `/surat/ijop-sptjm-kepala-satpen` |
| Rekomendasi Pengawas | `/surat/ijop-rekomendasi-pengawas` |
| Rekomendasi Kakankemenag | `/surat/ijop-rekomendasi-kakankemenag` |
| SPTJM Kakankemenag | `/surat/ijop-sptjm-kakankemenag` |
| Rekapitulasi Nilai | `/surat/rekapitulasi-nilai` |
| Surat Izin Tidak Masuk | `/surat/izin-tidak-masuk` |

## Implementasi teknis

- `js/routes.js` adalah pusat peta ID template dan URL.
- `js/landing.js` menyusun kategori dan kartu landing page dari `TemplateRegistry.getGroupedTemplates()`, supaya daftar tidak diduplikasi secara manual.
- `js/app.js` mempertahankan alur editor; saat template dipilih, `history.pushState` memperbarui URL tanpa reload, sedangkan `popstate` memulihkan pilihan pada navigasi browser.
- `vercel.json` me-rewrite rute editor, template, kategori, dan alias lama ke `/index.html`.
- Tag `<base href="/">` memastikan asset CSS/JS/ikon tidak dicari dari subpath `/surat` atau `/kategori`.
- `css/landing.css` hanya berlaku untuk landing; sistem stylesheet editor tetap digunakan.
- Service worker meng-cache modul dan gaya baru untuk instalasi PWA/offline.

## Menambahkan template baru

1. Daftarkan template di `js/template-registry.js`.
2. Tambahkan ID dan slug di `TEMPLATE_SLUGS` pada `js/routes.js`.
3. Tambahkan ID ke kelompok di `TEMPLATE_GROUPS` bila sesuai. Template yang belum dikelompokkan tetap muncul sebagai **Template Lainnya** di UI.
4. Tambahkan unit test pada `tests/landing-routes.test.js` untuk memastikan URL unik, terbuka langsung, dan dapat dimuat kembali.
5. Bila aset berubah, naikkan versi cache `sw.js`.

## Uji penerimaan setelah deployment

- Buka `/` melalui desktop dan mobile; pastikan dapat di-scroll, tautan CTA dapat digunakan, 4 kategori dan 10 template terlihat.
- Coba pencarian template, termasuk hasil kosong.
- Buka setiap URL `/surat/<slug>` langsung di tab baru dan refresh; pastikan template yang benar dipilih.
- Pilih template lain di editor; pastikan URL dan judul tab berubah tanpa reload, serta data form tidak hilang.
- Uji Back/Forward browser setelah berpindah antar-template dan kategori.
- Buka `/DPUdanRegis` lalu pastikan kategori Registrasi dan DPU terbuka dan URL dikonversi ke format baru.
- Uji draf lama: pemulihan tidak mengganti data secara keliru dan URL mengacu pada template aktif.
- Uji ekspor PDF/cetak, install PWA, offline fallback, dan halaman error.

**Catatan:** URL adalah navigasi ke template, bukan identitas draf pribadi. Tidak ada data siswa atau isi surat yang dimasukkan ke alamat URL.
