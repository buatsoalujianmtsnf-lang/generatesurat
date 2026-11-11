# Aktivasi Perlindungan Preview Surat dan Accordion Kelompok Beranda

**Proyek:** Generate Suratku  
**Tanggal:** 11 November 2026  
**Dasar:** PP-00 s.d. PP-04 serta instruksi aktivasi setelah merge PR #64.

## Fitur aktif pada konfigurasi kode

Atribut root editor kini **data-preview-protection="on"** dengan **data-preview-protection-mode="strict"**.

Saat halaman editor memuat surat, modul PreviewProtection aktif dan menampilkan:
- Watermark transparan berulang pada setiap halaman pratinjau, dengan merek Generate Suratku, penanda sesi anonim dan jam lokal.
- Penyamaran bidang kertas saat tab tersembunyi dan pemulihan saat tab aktif kembali.
- Pembatasan klik kanan berbasis pointer dan seret gambar/logo **hanya di dalam** `#surat-preview`, dengan notifikasi yang dibatasi frekuensinya.
- Status perlindungan pada toolbar pratinjau.

Perlindungan tidak menghapus atau mengganti isi dokumen. Watermark terpisah dari DOM surat sehingga tidak tersisip pada hasil cetak atau ekspor PDF. Tidak ada pemblokiran keyboard/copy/scroll secara global dan tidak ada perubahan otorisasi sponsor.

**Keterbatasan penting:** Browser tidak dapat secara andal memblokir atau mendeteksi semua screenshot maupun screen recording tingkat sistem operasi; watermark hanya penghalang visual dan penyamaran saat tab disembunyikan. Jangan menyebut fitur ini "anti screenshot 100%".

## Beranda — accordion kelompok templat

Kelima kartu kelompok kini membungkus daftar templat dengan HTML native `details` + `summary`.
- **Default semua kelompok tertutup**.
- Ringkasan kartu tetap menampilkan ikon, nama kelompok, deskripsi, jumlah templat, dan chevron.
- Setelah kelompok dibuka, pengguna dapat mengakses daftar templat serta tautan ke seluruh kelompok.
- Tiap templat mempertahankan accordion detailnya sendiri yang juga default tertutup.
- Pencarian membuka secara otomatis hanya kelompok yang memiliki hasil; menghapus pencarian menutup semua kelompok kembali.
- Keyboard Enter/Space pada summary, fokus yang terlihat, perangkat mobile dan navigasi tautan kategori tetap didukung.

Jumlah templat aktif: **18** dalam **5 kelompok**.

## PWA dan validasi

Cache aplikasi dinaikkan dari v60 menjadi **v61** agar pembaruan HTML, CSS dan JavaScript terbaca konsisten di PWA yang diinstal.

Regression suite memeriksa rendering nested accordion, pencarian dan clear, mode perlindungan aktif dari awal, pengamanan pointer, watermark, PDF/cetak, serta jalur sponsor. Headless Chromium UAT juga dijalankan di desktop, tablet dan viewport mobile. Validasi real-device Safari/Firefox/iOS/Android serta hasil PDF server produksi dan cetak fisik **belum dilakukan**; status otomatis hijau tidak dapat dijadikan pengganti validasi tersebut.

## Rollback dan operasional

Rollback perlindungan tanpa menghapus data: ubah atribut root menjadi `data-preview-protection="off"` dan panggil `PreviewProtection.refresh()`, atau rilis konfigurasi sebelumnya. Untuk beralih hanya ke watermark, gunakan mode `standard` dan `PreviewProtection.refresh()`.

**Status rilis:** fitur dinyalakan pada sumber kode PR terkait; belum terlihat pada situs produksi sebelum PR di-merge dan deployment manual berhasil. Pada konfigurasi Vercel, `git.deploymentEnabled` tetap `false`. Tidak ada migrasi database.
