# Kesiapan Aktivasi Produksi — Generate Suratku

Tanggal pemeriksaan awal: 11 November 2026 (WIB), repo: `buatsoalujianmtsnf-lang/generatesurat`, proyek Vercel `generatesurat`.

## Konfigurasi yang benar-benar dilakukan
1. Proyek Vercel: `SPONSOR_GATE_ENABLED=false` dan `MON09_METRICS_ENABLED=false` disimpan untuk Production & Preview, tanpa pengaktifan iklan, telemetry, atau deployment.
2. Dua `SPONSOR_IP_HASH_SECRET` acak yang berbeda telah disimpan sebagai **sensitive** untuk Production dan Preview. **Nilainya tidak dimuat ke source atau laporan**.
3. Redis REST lama sudah ada dengan nama `KV_REST_API_URL` / `KV_REST_API_TOKEN` (sensitive). Backend sekarang dapat membaca pasangan tersebut tanpa menyalin rahasia. Bila kedua `UPSTASH_REDIS_REST_*` eksplisit diberikan, pasangan itu diutamakan. Konfigurasi parsial atau URL tidak aman ditolak dan **tidak** dicampur antarpenyedia.
4. Aplikasi `main` dan domain produksi belum disinkronkan: domain masih pada commit `4ab21dc`, sedangkan `main` di `ae7bffd` ketika audit dimulai. Auto-deploy tetap off. Rilis manual bukan bagian dari perubahan konfigurasi ini.

## Hasil yang BELUM boleh diklaim
- Keberadaan kredensial REST bukan bukti Redis provider aktif/terjangkau atau kapasitasnya cukup. **Tes PING server-to-server pada staging/production belum dilakukan**. Gunakan `npm run verify:redis-rest` di lingkungan *operator* yang sudah memiliki env dan izin; perintah hanya `PING`, tidak mengubah data. Output hanya status aman tanpa nilai rahasia.
- Integrasi Upstash pada GitHub CI memakai Redis kontainer sementara, bukan database proyek Vercel.
- Belum ada Publisher ID AdSense, review Google Sites `Ready`, verifikasi `ads.txt`, CMP, atau domain yang dinyatakan diterima Google. Jangan menganggap `vercel.app` otomatis memenuhi syarat AdSense. Catat keputusan langsung dari akun AdSense.
- Belum tersedia kontrak sponsor sah, video 15 detik, lisensi audio/talent/logo, persetujuan moderasi atau fallback aksesibilitas.
- 15 kasus UAT MON-07 masih `NOT_RUN` untuk browser/perangkat fisik; uji 50 tindakan simultan pada staging dan rollback belum disahkan.

## Checklist operasional dan langkah aman berikutnya
1. **Google AdSense (mandiri, jalur terpisah):** masuk [Google AdSense](https://www.google.com/adsense/), verifikasi identitas/akun, daftar situs/domain yang memenuhi syarat, tempel kode verifikasi yang diterima secara terbatas pada halaman publik, ajukan peninjauan dan tunggu status Sites **Ready**. Cantumkan Publisher ID dari akun asli dalam konfigurasi dan `ads.txt` yang diverifikasi; periksa Policy Center, CMP Google tersertifikasi bila relevan, dan penempatan hanya `/panduan`, `/panduan-cetak-pdf`, `/faq`. Auto Ads tetap OFF. Tidak ada izin menggunakan skrip Google pada editor.
2. **Sponsor:** dapatkan berkas kontrak dan video 15 detik asli beserta bukti hak tayang, kemudian validasi MON-02 (durasi/codec/hash/moderasi). Tinjau konsekuensi iklan wajib untuk pengguna pendidikan dan opsi aksesibilitas.
3. **Redis:** jalankan PING read-only dari staging server yang benar. Jalankan tes EVAL, TTL, receipt race/replay/expiry dalam namespace staging terpisah, bukan pada data produksi. Catat biaya, batas free-tier dan failover.
4. **UAT dan keamanan:** jalankan semua MON-07 kasus fisik, pilot 50 tindakan bersamaan, audit privasi/log tanpa PII, pengujian versi PWA lama, callback print browser, dan tindakan gagal dengan jaringan putus.
5. **Deployment:** hanya setelah CI, review keamanan, pemilik rilis dan persetujuan manual. Rilis kodenya dulu dalam mode flag `false`, uji smoke, kemudian buat keputusan terpisah untuk aktivasi. Jangan mengaktifkan Git auto-deploy.
6. **Monitoring:** setelah rilis sah, tetapkan operator, retensi 14 hari, biaya, batas alert, dan aktivasi serentak `config/mon09-monitoring.json.enabled` dengan `MON09_METRICS_ENABLED=true`; jalankan laporan baca-saja 7 hari hanya setelah data masuk. `NO_DATA` bukan berarti sehat.

## Kriteria keputusan
Gerbang MON-08 masih `NO_GO`, MON-07 `BLOCKED`, MON-09 `MONITORING_NOT_ACTIVATED`. Jangan mengubah bukti UAT atau approval menjadi PASS tanpa hasil penyedia/perangkat yang dapat diaudit.

## Batasan komersialisasi
Google AdSense hanya di halaman informasi publik, bukan editor, pratinjau atau dokumen. Sponsor mandiri tetap memerlukan izin pengguna dan data minimization; event browser tidak membuktikan perhatian penuh. Native menu Print/DevTools tidak dapat sepenuhnya dikunci.

## Referensi eksternal
- https://support.google.com/adsense/answer/7402256
- https://support.google.com/adsense/answer/13554116
- https://vercel.com/docs/deployments
