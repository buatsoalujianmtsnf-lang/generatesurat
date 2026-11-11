# PP-00 — Audit dan Baseline Perlindungan Preview Surat

**Proyek:** Generate Suratku  
**Audit:** 11 November 2026  
**Basis kode:** main SHA c018ed3372b2b1c4e55a81df67981793307adc99  
**Ruang lingkup:** Audit statis struktur dan kontrak, inventaris tes, rancangan acceptance, tanpa mengubah perilaku produksi. UAT visual/browser fisik, percobaan screenshot OS, screen recorder nyata, serta pembandingan print/PDF **belum dijalankan**.

## 1. Sasaran dan keterbatasan

Perlindungan harus berupa *best-effort deterrence* terbatas **hanya area Preview Surat**, bukan anti-screenshot OS yang absolut. Browser JavaScript tidak dapat menjamin pemblokiran semua screenshot, perekaman OS/aplikasi eksternal, kamera kedua, atau DevTools. Jangan menyatakan bahwa aktivitas tersebut berhasil dicegah atau terdeteksi dengan pasti.

Repositori referensi yang diaudit:
- https://github.com/dxvzz/Screenshot-PrivacyProtectionWeb — konsep watermark, overlay, respons pintasan, hook clipboard. Adopsi hanya visual/watermark dan notifikasi yang tidak invasif.
- https://github.com/bmiit145/secure-web — beragam hook document-level, disableRightClick, keyboard, inspect, dan overlay body. Hindari impor langsung karena efek global. Catatan: LICENSE GitHub menunjukkan MIT tetapi package.json menunjukkan ISC; jangan menyalin kode pustaka tanpa konfirmasi lisensi yang berlaku.

PP-00 tidak menambah dependensi atau perlindungan baru.

## 2. Peta kode dan kontrak

### 2.1 Elemen dan siklus hidup

Pada index.html, struktur runtime berurutan:
- #preview-panel — kontainer viewer dan toolbar;
- #preview-viewport — area scroll dokumen;
- #preview-canvas-wrapper — transform/zoom;
- #surat-preview — **DOM isi surat yang diserialisasi untuk PDF**;
- .surat-page > .doc-content — halaman fisik hasil pagination.

js/app.js menginisialisasi PreviewRenderer, DocumentViewer, Settings, Workflow, SponsorExportGate. js/preview-renderer.js berlangganan event kop/form/template/settings/table, render debounce 200 ms, memakai render token untuk membatalkan pagination stale, membangun innerHTML surat, menunggu asset/layout dan memecah ke halaman. DPU memakai paginator khusus untuk tabel kompleks. Setelah halaman terbangun, ia mengisi data-page-count, memperbarui ukuran wrapper dan memanggil DocumentViewer.refresh. Pada reset/placeholder konten lama dihapus; watermark PP-01 harus bersih dalam keadaan itu.

js/preview-renderer.js menerapkan zoom melalui transform scale pada #preview-canvas-wrapper dan tinggi wrapper yang dikompensasi. js/document-viewer.js mengurus navigasi, scroll tracking dan mode fokus melalui fullscreen API / fallback viewer-focus-mode. Keyboard viewer mengecualikan input, textarea, select, button dan contenteditable.

**Keputusan desain PP-01:** render lapisan watermark sebagai sibling #surat-preview di dalam preview-canvas-wrapper, bukan anak #surat-preview; tempatkan masing-masing watermark tepat di atas setiap .surat-page, setelah pagination mutakhir dan perubahan zoom. Jangan membuat node di dalam konten surat. Isi header/toolbar/editor tidak tertutup, pointer-events noninteraktif, ukuran dokumen tidak berubah. Implementasi harus idempotent dan membersihkan listener saat teardown.

### 2.2 Seluruh template (17)

dpu, mutasi-masuk, siswa-baru, ijop-permohonan, ijop-sptjm-satpen, ijop-rekomendasi-pengawas, ijop-rekomendasi-kankemenag, ijop-sptjm-kankemenag, rekap-nilai, surat-izin, surat-permohonan-pindah, surat-keterangan-pindah, surat-pemberitahuan-kegiatan, surat-keterangan-siswa-aktif, surat-panggilan-orang-tua, surat-perjanjian-siswa, berita-acara-pertemuan-ortu.

Sumber: 17 berkas templates yang dimuat index.html. Harness yang sudah tersedia: tests/preview-all-templates.test.js, preview-pagination.test.js, viewer-focus-layout.test.js, app-integration.test.js. Harness pagination bukan pengganti tes visual pada browser nyata.

### 2.3 Print / PDF / sponsor

- js/print.js memvalidasi surat, menunggu PreviewRenderer.waitForReady, memasang marker sponsor bila sah, lalu window.print.
- css/print.css mengatur geometri halaman dan menyembunyikan UI. Jika sponsor wajib tetapi marker otorisasi tidak aktif, aturan print menyembunyikan dokumen dan menampilkan instruksi sponsor.
- js/pdf-export.js mengirim **html: preview.outerHTML** bersama **css: await _collectStylesheets()**, dimensi kertas dan filename ke endpoint /api/export-pdf. Semua CSS same-origin dan inline dikumpulkan, sehingga CSS perlindungan baru juga dapat ikut ke PDF walaupun DOM watermark tidak diserialisasi.
- api/export-pdf.js memverifikasi sponsor PDF **di server** (receipt single-use), kemudian menjalankan Chromium/Puppeteer.
- js/sponsor-export-gate.js menangkap Ctrl/Cmd+P pada capture phase saat mode required. Browser native print menu tidak sepenuhnya dapat dikendalikan aplikasi web.

**Kontrak keras:** watermark harus di luar #surat-preview; tambahkan aturan print nonaktif untuk lapisan perlindungan, CSS screen-only, dan assertion PDF/print; tidak mengganggu atau mengganti gate sponsor. Jangan menambahkan blokir Ctrl/Cmd+P, Ctrl/Cmd+C, F12 atau seluruh keyboard. Tidak boleh ada bypass video sponsor melalui lapisan perlindungan.

### 2.4 Mobile / PWA / aksesibilitas

css/document-viewer.css sudah menangani viewport 767px/374px dan landscape. Toolbar dapat di-scroll pada mobile. Watermark PP-01 tidak boleh menambah overflow atau memblokir kontrol zoom, navigasi, fokus. sw.js pada snapshot audit memakai **CACHE_PREFIX + v54** dan precache modul preview, PDF, print dan stylesheet. Tambahkan berkas PP-01 ke precache dan bump versi dengan pembaruan tes yang relevan. Status visual perlindungan wajib memiliki label dan informasi yang tidak mengklaim pencegahan absolut.

## 3. Baseline evidence

| ID | Kondisi | Referensi audit | Status |
| --- | --- | --- | --- |
| B01 | Root preview dan viewport terpisah dari editor | index.html, css/preview.css | Terverifikasi kode |
| B02 | 17 template ada dan dipaginasi | index.html, js/preview-renderer.js, tes pagination | Terverifikasi kode |
| B03 | Render asinkron, token stale dan placeholder | js/preview-renderer.js | Terverifikasi kode |
| B04 | Zoom dan mode fokus | js/document-viewer.js, js/preview-renderer.js | Terverifikasi kode |
| B05 | Print dan sponsor marker | js/print.js, css/print.css, sponsor-export-gate.js | Terverifikasi kode |
| B06 | PDF menerima outerHTML preview + CSS gabungan | js/pdf-export.js, api/export-pdf.js | Terverifikasi kode |
| B07 | Aset preview telah tercakup offline PWA | sw.js v54 | Terverifikasi kode |
| B08 | Modul perlindungan khusus preview belum ada | Inventaris index/js/css | Terverifikasi kode |
| B09 | Screenshot/recording OS dapat diblokir | Tidak tersedia API browser yang menjamin ini | Tidak mungkin dijadikan kontrak |
| B10 | Baseline visual/device print-PDF parity | Belum dilakukan tes browser fisik | **Belum diverifikasi** |

Tes kontrak PP-00 ditambahkan pada tests/preview-protection-baseline.test.js. CI akan menguji npm run check (syntax + types + sponsor + vitest), test:coverage, npm audit, serta job tambahan sesuai .github/workflows/quality-checks.yml. Penting: docs/coverage.md mengingatkan angka coverage V8 pada classic scripts via VM tidak setara dengan cakupan UX/browser, jadi hasil CI hijau tidak membuktikan kesetaraan visual.

## 4. Temuan dan risk register

| ID | Tingkat | Risiko | Mitigasi PP-01—PP-04 |
| --- | --- | --- | --- |
| R01 | Kritis | Klaim salah bahwa web memblokir capture OS/screen recorder | Komunikasikan deterrent, bukan blokir absolut |
| R02 | Tinggi | Watermark terikut print/PDF karena outerHTML atau CSS gabungan | Overlay sibling; test payload/CSS; bandingkan PDF |
| R03 | Tinggi | Shortcut global merusak editor atau bypass sponsor | Scoped interactions; biarkan sponsor gate menangani Ctrl/Cmd+P |
| R04 | Tinggi | Watermark lepas saat pagination, render ulang, zoom, multi-page | Sync setelah render token valid; ResizeObserver; tests DPU/rekap |
| R05 | Tinggi | Masking saat tab tersembunyi tidak pulih | State UI terpisah; restore visibilitychange; tidak mutasi DOM surat |
| R06 | Sedang | Overlay menutup toolbar/editor saat fullscreen mobile | Scoped positioning, pointer-events none, UAT breakpoint |
| R07 | Sedang | Aset PWA lama / cache campuran | Bump cache + precache + SW tests |
| R08 | Sedang | CSS screen baru merusak hasil Chromium PDF | CSS screen-only; explicit @media print; parity tests |
| R09 | Sedang | Clipboard/DevTools polling berat serta invasif | Jangan implementasikan polling/clipboard/anti-debug |
| R10 | Sedang | 50+ halaman membuat terlalu banyak overlay/lag | Minimal nodes, batching, no polling, benchmark nyata |
| R11 | Sedang | Listener ganda akibat redraw banyak | init-once/destroy cleanup; unit test lifecycle |
| R12 | Sedang | Aksesibilitas: copy/read/keyboard terblokir | Batas area, jangan blanket user-select:none pada konten, ARIA jelas |

## 5. UAT matrix yang harus dipertahankan

- Semua 17 template, khusus DPU dan rekap-nilai; kosong/1 halaman/2/3/50 halaman; portrait dan landscape.
- Scroll, zoom 30%–250%, fit width, fit page, resize, rotate, tablet dan smartphone.
- Fullscreen API berhasil dan fallback fullscreen, interaksi dengan editor drawer.
- Ganti template cepat, ketik cepat, restore/reset draft dan placeholder.
- Berpindah tab (visibilitychange), kembali aktif, fokus input, layar terkunci.
- Preview dengan dan tanpa watermark; cetak/PDF setelah sponsor sah, sponsor belum sah, sponsor off sesuai environment; Ctrl/Cmd+P dan print menu browser.
- Perbandingan ukuran kertas, margin, baris tabel, tanda tangan, nomor halaman, dan kebersihan PDF/cetak.
- PWA online/offline/cache update, screen reader, fokus keyboard, klik kanan pada preview vs editor.
- Windows/Chrome/Edge, macOS/Safari/Chrome, Android/Chrome, iOS/Safari. Gunakan **data dummy**. Screenshot OS dan screen recorder untuk menunjukkan batas perlindungan, bukan untuk mengklaim pemblokiran.

**UAT visual dan screenshot per-device di atas masih OPEN** pada PP-00 karena belum ada eksekusi browser fisik; harus dieksekusi saat validasi implementasi PP-04 sebelum menyatakan layak produksi.

## 6. Gate dan handoff

**PP-00 selesai untuk audit statis:** ruang lingkup, dependensi, kontrak preview, titik integrasi, 17 template, PDF/print/sponsor, PWA, risiko, dan acceptance matrix terdokumentasi. Tes kontrak baseline ditambahkan sebagai guard otomatis dan perlu dibuktikan CI hijau di PR.

**PP-01 tidak boleh melanggar:** isolasi overlay dari #surat-preview, tanpa update global keyboard/clipboard, tanpa mutasi konten surat, tanpa perubahan bisnis sponsor. PP-01 perlu feature flag default OFF dan rollback yang jelas. Tuntaskan UAT visual/manual yang masih terbuka pada PP-04.

**Tidak ada perubahan produksi, main, auto-deploy Vercel, maupun deployment pada PP-00.**
