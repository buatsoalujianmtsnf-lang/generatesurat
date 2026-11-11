# MON-08 — Persetujuan Google AdSense dan Aktivasi Monetisasi Terkendali

Tanggal: 11 November 2026 (WIB). Repositori: buatsoalujianmtsnf-lang/generatesurat.

## Keputusan hari ini
**NO_GO / BLOCKED — Tidak dilakukan permintaan review atau aktivasi pada akun AdSense maupun deployment Vercel.** Kode MON-07 sudah di-merge melalui PR #49 ke `main` (`e2d5482214daf940692f29ba6ba5703c5b58fba0`).
Alasan faktual: Tidak ada ID penayang Google, situs belum memiliki bukti status AdSense **Ready**, `ads.txt` masih komentar, akun Google tidak terhubung sebagai sumber status penayang, belum ada kontrak dan video sponsor 15 detik resmi, Redis Upstash produksi belum dikonfigurasi di proyek Vercel, 15 UAT manual MON-07 masih `NOT_RUN` dan belum ada persetujuan legal/privasi serta SOP rollback yang sudah diuji.

**Yang benar-benar dilaksanakan pada MON-08:**
- Memisahkan lane AdSense publik dan sponsor mandiri Cetak/PDF dengan gerbang kesiapan masing-masing.
- Menambahkan catatan bukti persetujuan `docs/mon08-approval-evidence.json` dan konfigurasi nonaktif `config/mon08-rollout.json`.
- Menambahkan `scripts/mon08-approval-gate.js`, termasuk penolakan otomatis bila flag diaktifkan tanpa bukti Google, hak video, Redis, UAT, CMP yang diperlukan, dan persetujuan manusia.
- Menambahkan pengujian CI dan artefak keputusan `BLOCKED`.
- Membatasi kandidat konten AdSense ke halaman HTML publik mandiri: `/panduan`, `/panduan-cetak-pdf`, `/faq`; rute `/` tidak disiapkan untuk iklan karena memakai HTML/CSP yang sama dengan `/editor`. Tidak ada pemasangan skrip Google ataupun unit iklan aktif.

## Alur persetujuan Google yang harus dilakukan pemilik akun

1. **Akun dan domain:** login ke [Google AdSense](https://www.google.com/adsense/start/), buka **Sites**. Pastikan akun aktif, alamat situs memenuhi syarat dan bisa diverifikasi; `generatesuratku.vercel.app` belum dapat dipastikan dapat didaftarkan. Jika subdomain ditolak, siapkan domain milik sendiri dan sinkronkan canonical URL, sitemap, iklan, `ads.txt`, dan kebijakan.
2. **Pratinjau dan konten:** periksa halaman publik berisi konten asli, manfaat bagi pengunjung, kontak, privasi, ketentuan, navigasi valid, tidak under-construction dan tidak didominasi iklan. Google dapat menolak halaman rendah konten; jangan menjanjikan persetujuan.
3. **Verifikasi situs:** dari akun AdSense, dapatkan **publisher ID sebenarnya** dan metode verifikasi (snippet/meta tag/ads.txt sesuai instruksi pada akun). Tinjau pemasangan agar tidak mengaktifkan iklan pada Editor. Perubahan kode untuk verifikasi hanya boleh dibuat setelah metode dan domain sah diketahui, kemudian melalui PR/deploy manual terpisah.
4. **Minta review:** submit lewat AdSense **Sites → Request review** setelah instruksi akun lengkap. Status `Requires review`, `Getting ready`, `Needs attention`, dan `Ready` tidak boleh ditebak; penetapan `Ready` harus berasal dari akun Google yang sebenarnya.
5. **Policy center dan ads.txt:** periksa Policy center dan persetujuan domain; setelah ID sah diperoleh, cantumkan baris `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0` dengan **ID sebenarnya**, bukan placeholder X. Cek status `ads.txt` yang terlihat di akun AdSense.
6. **Consent/CMP:** tinjau pengunjung EEA, UK, dan Swiss; jika menayangkan Google ads sesuai kebijakan di wilayah tersebut, gunakan CMP tersertifikasi Google yang mendukung IAB TCF sesuai persyaratan dan catat konfigurasi dalam bukti. Jangan menganggap pemberitahuan privasi sebagai CMP yang valid.
7. **Penayangan setelah Ready:** sebelum memasang kode iklan, siapkan CSP khusus halaman publik, URL/slot yang benar, Auto Ads tetap OFF, tidak ada iklan di editor, gerbang video, pratinjau, hasil Cetak/PDF, atau layar pemberitahuan/error. Halaman beranda `/` dikecualikan sampai dipisah dari HTML/editor.
8. **Verifikasi rilis:** lakukan smoke test manual konten, consent, responsivitas dan Google Policy center. Isi `docs/mon08-approval-evidence.json` hanya setelah pemeriksaan nyata dan lampirkan referensi privat ke bukti akun.

Rujukan resmi:
- Status: https://support.google.com/adsense/answer/12170222?hl=en
- Sites/jenis domain: https://support.google.com/adsense/answer/12170421?hl=id
- Persyaratan kepemilikan HTML: https://support.google.com/adsense/answer/91205?hl=id
- Kebijakan nilai inventaris: https://support.google.com/publisherpolicies/answer/11112688?hl=en
- Ads.txt: https://support.google.com/adsense/answer/12171612?hl=id
- CMP EEA/UK/Swiss: https://support.google.com/adsense/answer/13554116?hl=en
- Auto Ads: https://support.google.com/adsense/answer/9305577?hl=en

## Sponsor mandiri (tidak memerlukan persetujuan AdSense sebagai produk Google)
Sponsor mandiri bukan iklan yang dilayani Google; tetapi keberadaannya tetap harus dievaluasi dalam kebijakan situs jika AdSense digunakan pada halaman lain. Kontrak sponsor 15 detik, media/hak tayang, aksesibilitas, perlindungan anak, Upstash dan UAT harus disetujui sendiri-sendiri sebelum aktivasi.
- **Tahap A (staging):** buat video sintetis atau sponsor berizin, Redis staging, uji keamanan PDF receipt/print, sesi, playback, aksesibilitas serta rollback; jangan lakukan staging pada domain produksi.
- **Tahap B (tinjauan operator):** pastikan seluruh 15 matriks MON-07 telah lulus atau disetujui pengecualiannya secara tertulis; uji beban minimal 50 tindakan paralel; review consent/privasi dan lisensi.
- **Tahap C (satu rilis terkoordinasi):** atur UI `data-sponsor-gate`, config policy/registry, Vercel `SPONSOR_GATE_ENABLED` serta semua rahasia Redis. **Jangan aktifkan salah satu komponen sendirian**; validasi PWA cache lama, server dan klien sinkron.
- **Tahap D (pemantauan):** gunakan metrik agregat 403/409/410/429/503, error rendering, latensi Redis, gagal video dan komplain tanpa nama anak/isi surat/token mentah; tindakan rollback manual oleh operator bila perlu.
Tidak ada random canary % di browser karena implementasi saat ini memakai satu flag HTML untuk semua pengunjung; canary harus menggunakan lingkungan staging/hostname yang terisolasi dan approval operator.

## Gerbang pemeriksaan teknis
- `npm run check:mon08` = `BLOCKED` yang aman menghasilkan exit 0 di CI.
- `node scripts/mon08-approval-gate.js --json` = detail alasan status.
- `node scripts/mon08-approval-gate.js --strict` = exit 2 jika belum siap (gate deployment manual).
- Flag aktif tanpa bukti Google, SOP/UAT, operator akan menjadi `UNSAFE_CONFIGURATION` dan exit 1.
- Dokumen bukti/tautan bukan tanda tangan kriptografis; reviewer tetap harus memverifikasi langsung di akun Google dan lingkungan Vercel.

**Persyaratan eksplisit:** `vercel.json.git.deploymentEnabled=false` harus tetap; tidak mengaktifkan AdSense, sponsor video, Redis, atau deployment manual saat MON-08 ini.


## Pembaruan verifikasi situs — 11 November 2026 (kode dari pemilik akun)
- Pemilik memberikan cuplikan AdSense dengan `ca-pub-4751617120862559`. Ini hanya membuktikan bahwa ID disampaikan dalam instruksi, **bukan** bahwa akun Google telah disetujui.
- `<meta name="google-adsense-account" content="ca-pub-4751617120862559">` ditambahkan ke `index.html` agar Google dapat memverifikasi root domain tanpa memuat skrip pada beranda/editor (sesuai metode meta alternatif resmi Google).
- Cuplikan `adsbygoogle.js` async disisipkan di dalam `<head>` hanya untuk `/panduan`, `/panduan-cetak-pdf`, dan `/faq`; **tidak** ditambahkan pada `index.html`, `/editor`, `/surat/*`, `/privasi`, atau hasil Cetak/PDF.
- CSP domain Google diberikan **hanya untuk jalur artikel di atas** pada tahap verifikasi, sementara `frame-src 'none'`, `connect-src 'self'`, dan CSP editor tetap ketat. Ini **bukan** CSP yang menjamin penayangan iklan: panduan resmi AdSense menyarankan nonce acak per permintaan dan CSP `strict-dynamic` untuk iklan penuh. Situs statis saat ini tidak mempunyai nonce per permintaan; ini harus dirancang dan diuji ulang sebelum aktivasi monetisasi. Verifikasi setelah deployment harus memeriksa header aktual di tiap rute.
- `config/adsense-zones.json.publisherId` menyimpan ID yang diberikan pengguna, tetapi `enabled=false`, seluruh slot dan Auto Ads tetap OFF. `config/mon08-rollout.json.google.verificationOnly=true`, `requestedState=off`, keputusan tetap `NO_GO`, serta bukti Google Sites/Policy Center/CMP masih `UNVERIFIED`.
- Kode eksternal dapat melakukan permintaan ke Google; kebijakan privasi ditambahkan pengungkapan spesifik. Sebelum menayangkan iklan atau memproses data yang membutuhkan persetujuan, lakukan peninjauan wilayah dan CMP bila relevan.
- **Tidak mengubah `ads.txt`** dan tidak mengisi status `Ready` secara asumsi. Lakukan merge dan **deployment manual** secara terpisah; setelah versi produksi aktif, kunjungi Google AdSense → Sites → Verify → Request review. Bila subdomain `vercel.app` tidak dapat diterima, tindak lanjuti dengan domain milik sendiri.
- Penyedia referensi: https://support.google.com/adsense/answer/12169212?hl=id ; https://support.google.com/adsense/answer/16283098?hl=id
