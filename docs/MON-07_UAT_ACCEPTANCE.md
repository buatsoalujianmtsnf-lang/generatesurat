# MON-07 — UAT dan Penerimaan Operasional Generate Suratku
Tanggal: 11 November 2026, Asia/Jakarta.
Repositori: buatsoalujianmtsnf-lang/generatesurat.

## 1. Status aktual
**Teknis:** Quality Checks, Redis 7.4 nyata yang terisolasi (17 cek), serta Chromium headless 3 viewport sudah **PASS** pada workflow [42975128670](https://github.com/buatsoalujianmtsnf-lang/generatesurat/actions/runs/42975128670) untuk commit `44e87a24`. Bukti tersimpan dalam `docs/mon-07-evidence.json`; screenshot dan ringkasan Chromium berada di [artefak GitHub](https://github.com/buatsoalujianmtsnf-lang/generatesurat/actions/runs/42975128670/artifacts/13834389398). Ini **bukan** tes Redis produksi, Safari/iOS, atau perangkat fisik.
**Produksi:** **BLOCKED — TIDAK DIIZINKAN GO-LIVE**. Tidak ditemukan variabel lingkungan Redis sponsor pada konfigurasi Vercel yang diperiksa. Sponsor resmi, kontrak, file video 15 detik, persetujuan privasi, UAT perangkat fisik, serta latihan rollback produksi belum tersedia.
**Perubahan aktivasi:** tidak ada. HTML `data-sponsor-gate="off"`; policy dan registry sponsor `enabled:false`; AdSense belum aktif; `vercel.json.git.deploymentEnabled:false`.

## 2. Kriteria uji otomatis dan tingkat bukti
| Pengujian | Pelaksanaan | Bukti yang diterima | Keterbatasan |
|---|---|---|---|
| Unit/test suite & dependency audit | GitHub Actions quality | Run URL dengan conclusion=success | Tidak otomatis memvalidasi browser fisik |
| Redis EVAL Lua/TTL/race/replay/rate-limit | Service `redis:7.4-alpine` dalam CI, `npm run test:mon07:redis` | Log job MON-07 real Redis | Redis lokal CI ≠ Upstash/Vercel produksi |
| Chromium desktop dan mobile emulation | `npm run test:mon07:browser` | Screenshot/JSON artefak job CI | Emulasi viewport ≠ browser Safari/iOS, ≠ manusia menonton |
| Kontrak keamanan/privas/PWA | `npm run check` + tes MON-06 | Tes CI | Integrasi lama, cache browser nyata dan banner consent perlu UAT |

## 3. Matriks UAT manual wajib
Laksanakan seluruh ID pada `docs/mon-07-evidence.json` dan lampirkan bukti bertanggal, versi browser/OS, hasil aktual, insiden, nama reviewer, serta tautan arsip privat. **NOT_RUN bukan PASS.**

**BR-01 s.d. BR-06** Chrome Windows, Edge, Firefox, Safari macOS, Chrome Android, Safari iOS/PWA: pengisian template; aturan setiap tindakan Cetak/PDF; Ctrl+P/Cmd+P; menu Print asli (catat kemampuan *bypass*); video 15 detik; Play/Pause/Mute/Caption; rotasi layar, keyboard, kesesuaian PDF, ukuran modal.
**AC-01** screen reader, fokus keyboard, ESC, zoom 200%, high contrast, caption, tombol minimal 44px, dan alternatif akses jika pengguna tidak dapat menonton video.
**NT-01/NT-02** offline sejak awal/tengah video, throttling, timeout 8/12 detik, iklan 404/403, pemblokir konten, Redis 429/503/failover; harus muncul status yang jelas tanpa bypass token.
**SE-01/SE-02** POST langsung `/api/export-pdf` tanpa receipt pada **staging aktif** harus 403; salah action/replay/TTL harus ditolak, satu dari balapan Redis menang, tidak ada data siswa/token mentah di log. Uji Upstash real dengan approval terpisah.
**PW-01/PW-02** migrasi cache `v53→v54`, tab lama, service worker menunggu, server aktif sebelum klien update, rollback kedua flag, offline/online dan histori browser.
**OP-01** simulasi insiden dan prosedur rollback bersama pemilik layanan, bukti waktu pemulihan dan komunikasi kepada pengguna.
**PO-01** skrip Google hanya pada halaman konten publik. Tinjau kebijakan situs dan certified CMP Google untuk wilayah EEA/UK/CH sebelum AdSense; cek tidak ada sponsor pixel di editor atau PDF.

## 4. Keamanan dan ancaman tersisa
1. **Browser print tidak dapat dikunci 100%** oleh JavaScript; menu cetak, ekstensi, DevTools, screenshot, dan perangkat/OS dapat melewati pengendali aplikasi. Catat sebagai risiko yang diterima/ditolak resmi.
2. Playback dilaporkan browser dan *receipt* Redis tidak membuktikan mata pengguna benar-benar melihat iklan. Risiko penipuan penayangan harus masuk kontrak sponsor.
3. PWA yang masih memakai HTML versi lama bisa mempunyai flag berbeda dengan server. Jangan mengaktifkan server hanya dengan mengubah env.
4. `window.print()` setelah proses asinkron dapat dibatasi browser; jika dialog cetak terblokir, butuh tombol "Cetak Sekarang" dengan user gesture baru (bukan bypass receipt).
5. Tidak ada jalur ekspor darurat/alternatif aksesibilitas yang sudah disetujui. Kegagalan iklan selama insiden menghambat proses; perlu kebijakan kompensasi atau **kill-switch yang menonaktifkan server dan UI secara sinkron**.
6. Receipt dikonsumsi sebelum Chromium render, sehingga bila render gagal token hilang. Harus ada pesan dan penanganan komplain komersial yang jelas.

## 5. Kriteria terukur sebagai target penerimaan (bukan hasil yang telah dicapai)
- **100%** tes negatif receipt (tanpa token, salah aksi, replay, expired) ditolak pada staging.
- **1 dari N** konsumen receipt dalam tes balapan yang berhasil, sisanya ditolak.
- **0** isi surat/nama siswa/tanda tangan atau token mentah di telemetry sponsor.
- **0** iklan AdSense/third-party pixel di editor, modal atau dokumen hasil.
- **0** aktivasi tanpa kontrak/hak tayang dan tanda tangan review.
- Uji beban pilot dengan **minimum 50 tindakan paralel** dan dokumentasi p95/p99 latensi, error rate, throttle, dan biaya; angka target SLO perlu disetujui berdasarkan anggaran/kapasitas Redis/Vercel.
- 100% variasi browser/perangkat target pada matriks manual teruji atau diberi pengecualian beralasan oleh pemilik layanan.
- Latihan rollback diverifikasi dan melampirkan waktu pemulihan aktual.

## 6. Keputusan gate
Gunakan `npm run check:mon07` untuk memverifikasi status keamanan default **BLOCKED**, atau `node scripts/mon07-release-readiness.js --strict --json` untuk memastikan penolakan operasional sampai semua bukti terpenuhi.
Tidak boleh menyimpulkan MON-07 diterima produksi hanya karena GitHub CI lulus. Penanggung jawab operasional harus mengisi bukti, menjalankan UAT nyata, lalu menandatangani keputusan go/no-go.

## 7. Sumber kebijakan
- Google publisher consent/CMP: https://support.google.com/adsense/answer/13554116?hl=en
- Google AdSense policies: https://support.google.com/adsense/answer/48182?hl=id
- Google publisher policy center: https://support.google.com/publisherpolicies/
