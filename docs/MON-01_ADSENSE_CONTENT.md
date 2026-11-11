# MON-01 — Landasan konten AdSense (Generate Suratku)

Status: **siap untuk review PR, BELUM aktivasi iklan / BELUM lolos semua gate go-live**.
Tanggal: 11 November 2026 WIB.
Repositori yang benar: `buatsoalujianmtsnf-lang/generatesurat` (bukan repositori legacy MTsNurulFalahTrs/GeneratorSurat).

## Konten publik yang dibuat
- `/` menautkan Panduan, FAQ, dan halaman kebijakan.
- `/panduan`: langkah penggunaan, validasi, KOP, form, pratinjau, penyimpanan.
- `/panduan-cetak-pdf`: proses, troubleshooting, privasi, keterbatasan browser.
- `/faq`: pertanyaan relevan mengenai dokumen, layanan, dan rencana sponsor.
- `/tentang`: informasi pengelola, kontak, ruang lingkup dan pendanaan.
- `/privasi`: transparansi pengolahan di browser, PDF Vercel, rencana pihak ketiga.
- `/ketentuan`: otorisasi, tanggung jawab dan disklosur sponsor.

Halaman ini memakai HTML statis dengan metadata unik, canonical, navigasi yang dapat di-crawl dan CSS yang responsif. **Tidak memuat unit AdSense dan tidak mengaktifkan sponsor gate**.

## SEO
`robots.txt` memberi lokasi sitemap; `sitemap.xml` memuat halaman publik, tidak memuat editor, rute template, API atau data pengguna. Pada saat PR di-merge, verifikasi HTTP 200 dan canonical untuk tiap URL. Jika host domain berubah, ubah canonical/sitemap/robots. Editor masih memiliki shell SEO sendiri; penanganan noindex per-route adalah pekerjaan terpisah yang perlu pengujian di Vercel.

## ads.txt (WAJIB dilengkapi sebelum aktivasi)
File `/ads.txt` disediakan sebagai *placeholder komentar* tanpa entri penjual. Ini **belum memenuhi verifikasi AdSense** dan bukan konfigurasi final. Setelah Publisher ID tersedia dari akun resmi, ganti dengan entri yang disalin dari Google (contoh format: `google.com, pub-<ID-ASLI>, DIRECT, f08c47fec0942fa0`). Jangan mengarang ID. Pastikan `https://<domain>/ads.txt` tersedia sebagai text/plain dan dapat diambil crawler.
Sumber: https://support.google.com/adsense/answer/12171612?hl=id

## Zona iklan
Konfigurasi awal `config/adsense-zones.json` menetapkan `enabled:false`, `publisherId:null`, `autoAds:false`. Pada MON-08 hanya boleh diaktifkan setelah review Google, pemisahan CSP publik dan editor, CMP yang diperlukan, dan pemeriksaan ulang performa/kebijakan. Jangan menggunakan AdSense pada editor, gerbang video sponsor, atau keluaran cetak/PDF.

## PWA / CSP
Aset konten publik tidak dimasukkan ke App Shell wajib: halaman statis online, dan tidak mengganti bootstrap editor. CSP produksi saat ini masih `script-src 'self'` sehingga memblokir AdSense; **jangan melemahkan CSP pada MON-01**. Rencanakan pemisahan CSP untuk halaman publik pada MON-06.

## Validasi setelah PR
1. `npm ci && npm run check && npm run test:coverage && npm audit --audit-level=moderate`
2. HTTP 200/HTML pada `/`, `/panduan`, `/panduan-cetak-pdf`, `/faq`, `/tentang`, `/privasi`, `/ketentuan`, `/robots.txt`, `/sitemap.xml`, `/ads.txt`.
3. Chrome, Firefox, Safari: navigasi keyboard, focus, mobile portrait/landscape, zoom 200%, dark/light, long page scroll.
4. Pastikan Editor, preview, `Print.printDocument()`, `PdfExport.exportDocument()`, `IzinDeclaration`, PWA tetap sama dan tak memuat AdSense.
5. Verifikasi versi produksi secara manual, karena GitHub HEAD `b9425ff` berbeda dengan deployment READY `4ab21dc` pada audit MON-00.
6. Pastikan auto-deploy dinonaktifkan di **Project Settings** Vercel. File `vercel.json` diberi `git.deploymentEnabled:false` sebagai lapisan eksplisit; verifikasi konfigurasi aktual dengan uji tanpa deployment yang tidak diinginkan.

## Gate
- Kode dan halaman publik tersedia untuk review: PASS (setelah CI).
- Iklan Google publik diaktifkan: NO, menunggu ID dan approval Google.
- Sponsor gate 15 detik setiap tindakan: NO, dikerjakan MON-02 s.d. MON-07.
- Peluncuran produksi MON-08: BLOCKED sampai MON-00 blocker dan kriteria MON-06/07/08 dipenuhi.
