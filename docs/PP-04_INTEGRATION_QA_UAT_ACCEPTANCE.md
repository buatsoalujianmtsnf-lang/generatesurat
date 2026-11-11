# PP-04 — Integrasi, QA, UAT dan Validasi Akhir Preview Surat

**Produk:** Generate Suratku
**Tanggal:** 11 November 2026
**Basis:** PP-00 audit, PP-01 fondasi, PP-02 watermark/masking, PP-03 interaksi
**Branch:** qa/pp-04-preview-protection-uat
**Hasil:** **PASS pada pengujian otomatis dan Chromium headless terisolasi; FINAL PRODUCTION GO masih ditahan** karena UAT perangkat fisik, Firefox/Safari, kesetaraan visual PDF produksi, dan tes OS screen recording belum dapat diverifikasi.

## 1. Ringkasan yang sudah dilaksanakan

- PR #63 berhasil di-merge ke main pada commit `9c32b660bff64b87d6fa15a6c814dc91c94bf899`.
- Dibuat `scripts/pp04-browser-uat.js` yang menjalankan aplikasi editor nyata melalui HTTP localhost dengan Chromium headless, Puppeteer dan sumber codebase PR.
- Ditambahkan `npm run test:pp04:browser` pada package.json.
- Job otomatis `pp04-browser` ditambahkan pada `.github/workflows/quality-checks.yml` untuk tiap PR main dan dapat dijalankan ulang via workflow_dispatch.
- Artefak workflow: `pp04-preview-protection-uat`, berisi `summary.json`, screenshot dummy desktop dan mobile portrait, serta PDF cetak dummy. Tidak ada data siswa pribadi, akses backend sponsor sungguhan, maupun lalu lintas eksternal.
- Tidak ada perubahan pada kode aplikasi `js/`, `css/`, `index.html`, `sw.js`, basis data, konfigurasi sponsor atau Vercel dalam PP-04. Feature flag tetap OFF.

## 2. Evidence CI yang dapat diverifikasi

**GitHub Actions run [#43020249571](https://github.com/buatsoalujianmtsnf-lang/generatesurat/actions/runs/43020249571)** — status: **SUCCESS**, **6 dari 6 job berhasil**.

| Job | Hasil |
| --- | --- |
| Syntax, tests, dependency audit | SUCCESS |
| PP-04 isolated Chromium preview protection UAT | SUCCESS |
| MON-07 isolated headless Chromium editor and sponsor modal UAT | SUCCESS |
| MON-07 real Redis state and receipt integration | SUCCESS |
| MON-08 Google and sponsor approval dry-run (NO_GO) | SUCCESS |
| MON-09 monitoring readiness and report dry-run (NO_GO) | SUCCESS |

Pemeriksaan utama melaporkan **55 test files / 425 tests passed**, sintaks/TypeScript/coverage step selesai, dan **npm audit: 0 vulnerabilities**. Angka coverage V8 untuk classic scripts yang di-load melalui VM tetap mempunyai keterbatasan instrumentasi (lihat docs/coverage.md); tidak dapat digunakan sebagai klaim coverage visual frontend.

## 3. UAT integrasi Chromium sungguhan (bukan perangkat fisik)

| Lingkungan emulasi | Resolusi | Max drift watermark terhadap halaman | Hasil |
| --- | --- | ---: | --- |
| Desktop | 1440 × 900 | 0,218 px | PASS |
| Tablet | 820 × 1180 | 0,301 px | PASS |
| Mobile portrait | 390 × 844 | 0,008 px | PASS |
| Mobile landscape | 844 × 390 | 0,305 px | PASS |

Seluruh pengujian ini dijalankan di Chromium Linux headless dalam GitHub Actions, dengan `hasTouch` aktif pada emulasi tablet/mobile. **Bukan** perangkat Android/iPhone fisik dan tidak menguji mesin rendering Safari/WebKit ataupun Firefox/Gecko.

### Matriks hasil otomatis

| ID | Skenario | Hasil / tingkat bukti |
| --- | --- | --- |
| UAT-01 | Default OFF di editor tanpa watermark, masking, atau status badge | PASS browser |
| UAT-02 | Opt-in sementara strict dan overlay pada tiap lembar kertas | PASS browser |
| UAT-03 | Geometri watermark mengikuti zoom 65% di semua viewport | PASS browser, toleransi 3px |
| UAT-04 | Overlay sibling, bukan descendant `#surat-preview` | PASS browser |
| UAT-05 | Overlay tidak menerima pointer event | PASS computed CSS |
| UAT-06 | 18 template memakai renderer dan pagination riil | PASS desktop Chromium; masing-masing minimal satu halaman |
| UAT-07 | Klik kanan dan Ctrl-click pointer, drag gambar | PASS DOM event browser |
| UAT-08 | Menu konteks keyboard, drag teks, copy dan toolbar tidak diblokir | PASS DOM event browser |
| UAT-09 | Standard tidak mengaktifkan guard; strict mengaktifkannya | PASS browser |
| UAT-10 | Simulasi `visibilitychange` hidden -> visible memask lalu restore | PASS browser (simulasi event, bukan OS capture) |
| UAT-11 | OFF/rollback membersihkan overlay, badge dan status guard | PASS browser |
| UAT-12 | Client PDF mengirim `preview.outerHTML` tanpa DOM watermark, aturan print CSS tersedia | PASS browser + backend palsu 503 |
| UAT-13 | Sponsor required tanpa receipt tidak melakukan POST PDF | PASS client guard; server authorization diuji dalam suite terdahulu |
| UAT-14 | CSS media cetak menyembunyikan watermark dan badge | PASS Chromium computed style |
| UAT-15 | Cetak Chromium menghasilkan PDF dengan header %PDF- dan payload nonkosong | PASS PDF dummy; **bukan PDF produksi** |
| UAT-16 | Tidak ada error JavaScript tak tertangani dan overflow horizontal besar | PASS pada empat viewport |
| UAT-17 | PWA dan sponsor/sistem lainnya tidak rusak | PASS pipeline regresi/CI; **offline fisik belum dites** |

Pengujian menggunakan data form default dari template (tanpa memasukkan identitas murid sungguhan). Seluruh komunikasi berjalan terhadap server HTTP lokal, dengan permintaan origin luar dibatalkan. Endpoint PDF palsu sengaja mengembalikan 503 untuk memeriksa payload tanpa membuat atau mengunduh PDF produksi.

## 4. Temuan dan mitigasi

- Tidak ada kegagalan regresi pada suite otomatis, smoke Chromium atau gate sponsor pada snapshot PR PP-04.
- Perlindungan tidak mendeteksi/menghalangi screenshot dan perekaman OS. Tidak mungkin menjanjikan 100% pencegahan dengan JavaScript browser.
- Webhook/konfigurasi sponsor, pelaporan monitoring dan aktivasi provider tetap tidak disentuh. Status NO_GO pada MON-08/MON-09 adalah ekspektasi gate yang sengaja aman, bukan kegagalan tes.
- `data-preview-protection="off"` tetap nilai default; mode `strict` hanya efektif jika feature flag diaktifkan lewat langkah uji/internal. **Tidak ada aktivasi produksi dalam PR ini.**
- Hasil screenshot visual diarsipkan; verifikasi manual oleh manusia pada perangkat target masih dibutuhkan sebelum production GO.

## 5. Item yang belum dapat dinyatakan selesai

1. **UAT perangkat fisik:** Chrome/Edge Windows, Chrome Android, Safari iPhone/iPad dan Safari macOS, Firefox desktop; portrait/landscape, touch long-press, resize/orientasi, keyboard navigation, focus/fallback.
2. **Kesetaraan hasil dokumen final:** cetak fisik dan ekspor PDF *server produksi dengan otorisasi sponsor sah*; bandingkan ukuran kertas, margin, halaman, tabel, tanda tangan, kop, nomor halaman, dan ketiadaan watermark.
3. **Pengujian perekam layar OS:** verifikasi keterbatasan, dokumentasi perilaku, dan redaksi UI; jangan menetapkan syarat mustahil “seluruh screenshot diblokir”.
4. **Aksesibilitas manual:** pembaca layar, high-contrast, zoom browser, context-menu keyboard, navigasi keyboard dan kemampuan menyalin isi surat yang memang diperbolehkan.
5. **Beban dan memori:** dokumen 50+ halaman pada ponsel kelas rendah, pergantian template cepat, refresh PWA/offline dengan CacheStorage lama.
6. **Release flag dan komunikasi:** setelah seluruh gate di atas disetujui, putuskan mode dan cakupan rollout; preview-only, jelas bahwa efektivitasnya terbatas.

## 6. Gate penerimaan dan keputusan

| Komponen | Keputusan |
| --- | --- |
| Audit, implementasi PP-01–03 dan regresi kode | PASS |
| Pengujian UAT Chromium otomatis PP-04 | PASS |
| CI dan audit dependensi | PASS |
| Keamanan alur sponsor dalam suite otomasi | PASS sesuai lingkungan uji |
| Perangkat nyata lintas-browser | **OPEN / BELUM TERUJI** |
| PDF produksi dan cetak fisik | **OPEN / BELUM TERUJI** |
| Tangkapan layar dan rekaman OS fisik | **Bukan kemampuan yang bisa dijamin web** |
| Aktivasi flag pada pengguna produksi | **NO_GO sementara** |
| Merge PR PP-04 (penguatan QA tanpa aktivasi fitur) | **Layak ditinjau setelah CI hijau; tidak otomatis merge** |

**Rekomendasi teknis:** PR #64 dapat di-merge untuk menambahkan pipeline pengujian dan bukti tanpa mengaktifkan fitur. Tetap pertahankan Vercel auto-deploy nonaktif dan jangan aktifkan flag perlindungan pada semua pengguna sebelum UAT fisik dan cetak/PDF nyata selesai.

## 7. Perintah reproduksi

Pada checkout repo yang benar, dengan Node.js 22:

~~~bash
npm ci
npm run check
npm run test:coverage
npm run test:pp04:browser
npm audit --audit-level=moderate
~~~

Artefak lokal (setelah eksekusi): `artifacts/pp04-browser/summary.json`, screenshot UAT dummy, dan `dummy-print-smoke.pdf`. Artefak CI tersedia di halaman [run #43020249571](https://github.com/buatsoalujianmtsnf-lang/generatesurat/actions/runs/43020249571) selama 14 hari sesuai workflow.

**Deploy/merge:** PP-03 sudah masuk main; PP-04 tetap berada di PR terpisah. Tidak melakukan deployment Vercel atau pengubahan auto-deploy.
