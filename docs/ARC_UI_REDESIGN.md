# Audit dan Modernisasi UI/UX Generate Suratku — Acuan Arc Library

**Baseline:** `main` pada commit `b9425ff7cb9b8c792f2c060e49f9474c13bb7b9b` (11 November 2026).  
**Referensi:** [kuratlielia/arc-library](https://github.com/kuratlielia/arc-library) (MIT, Elia Kuratli, 2026).  
**Implementasi:** `css/arc-inspired.css` dan perbaikan antarmuka pencarian pada `index.html` + `js/landing.js`.

## 1. Hasil audit arsitektur

- Aplikasi adalah **vanilla HTML/CSS/JavaScript**. Tidak menggunakan React, Vite, Next.js, atau komponen React runtime.
- daisyUI 5 sudah dimuat via CSS CDN dengan fallback CSS lokal; Tabler Icons menggunakan sprite lokal.
- Engine dokumen menggunakan template registry, state/draf browser, KOP, Form Renderer, Settings, Signature Pad, Preview Renderer, dan printer/PDF server-side tersendiri.
- Beranda (`/`), editor (`/editor`), tautan langsung template (`/surat/:slug`), dan kategori (`/kategori/:slug`) dipertahankan.
- Drawer editor bekerja berbeda antara desktop dan viewport kompak; jangan mengganti mekanisme fokus, `inert`, atau `aria-hidden`.
- Berkas `css/preview.css` dan `css/print.css` memegang pengaturan fisik dokumen A4. Jangan mengubah skala, margin, KOP, blok tanda tangan, pagination, atau hasil PDF demi estetika UI.
- `sw.js` menyimpan app shell untuk offline. Semua file CSS/JS baru yang ditambahkan ke HTML harus masuk precache.
- Kebijakan CSP tidak memperbolehkan skrip pihak ketiga. Style Arc diadaptasi lokal tanpa CDN/React/Motion baru.

## 2. Keputusan adaptasi terhadap Arc Library

Arc Library membagikan komponen **React 19**, **CSS Modules**, token desain, animasi berbasis **Motion**, dan pola keyboard/focus. Memasang komponen TSX tersebut langsung akan menuntut penulisan ulang runtime serta dapat memutus integrasi draf dan ekspor. Oleh karena itu dipilih **adaptasi prinsip desain** secara native: bukan vendor atau copy-paste komponen React.

| Pola dari Arc | Penerapan pada Generate Suratku |
| --- | --- |
| Foundation: neutral surfaces, radii, low-elevation shadow, gradient wash | CSS vars `--arc-ui-*` dengan token kompatibilitas `--color-*` |
| Button, input, card | CTA, editor actions, forms, template cards, storage cards |
| Tabs dan accordion | Tampilan segmented, hover/focus; event dan status collapse lama tetap |
| Site header, hero, page header | Navbar beranda yang sticky, hero dengan gradient lembut, hirarki tipografi |
| Dialog, drawer, empty state | Modal, sisi editor, placeholder, pesan status; mekanisme JavaScript lama tetap |
| Motion accessibility | Transisi berkurva pendek dan `prefers-reduced-motion` |
| Keyboard shortcuts dan search | `/` untuk fokus pencarian, `Escape` menghapus input, tombol Hapus |
| Theme | Dukungan light, dark, dan preferensi sistem, dengan kontras terpisah |
| Accessibility | Skip link untuk landing/editor, focus visible, 44px target di mobile |

## 3. Area perubahan

1. **Beranda publik:** navbar, hero, pratinjau dekoratif (bukan hasil surat asli), statistik, pencarian, kelompok template, kartu fitur, CTA, dan footer.
2. **Editor:** header, tombol Cetak/PDF, state tombol, drawer, tab navigasi, pemilihan template, form Input, Pengaturan, toolbar preview, dan panel langkah.
3. **Fitur pendukung:** editor KOP, penyimpanan draf, Tentang, modal, toast, dan modal tanda tangan.
4. **Perangkat:** desktop, tablet, mobile portrait/landscape; menjaga aliran layout lama dan tidak menambah overflow.
5. **PWA/offline:** stylesheet baru ikut app shell; cache bertambah dari `v50` menjadi `v51`.

## 4. Batasan integrasi & keamanan

- Identitas elemen, route, nama form, template, penyimpanan, event handler, API, backend PDF, logika cetak, dan format dokumen **tidak diubah**.
- Tidak menambah skrip eksternal atau kebijakan CSP.
- Tidak mengubah Vercel atau memicu deploy manual. Pengaturan **auto-deploy tetap harus nonaktif**.
- Perubahan visual hanya memengaruhi UI. `@media print` menjamin latar dokumen putih dan menyingkirkan skip link.
- Gerbang sponsor cetak/PDF yang direncanakan terpisah dari pekerjaan ini; tidak ditambahkan secara diam-diam.

## 5. Validasi otomatis dan manual

**Automated gate:** `npm run check`: check:syntax, TypeScript JS check, Vitest. Tambahan tes pada `tests/arc-ui-refresh.test.js` untuk kontrak UI, PWA, pencarian, keyboard, dan pemisahan print.

**Uji manual sebelum merge/deploy:**

- Landing: scroll halaman; tautan `/#koleksi`, `/#keunggulan`; cari template dengan huruf Indonesia, pencarian nihil dan Hapus; buka template.
- Keyboard: Tab/Shift+Tab, skip link, `/` saat fokus bukan input, Escape; navigasi Arrow pada editor-tab.
- Template: pilih semua 17, periksa field, accordion default collapsed, perubahan data real-time, tambah/hapus baris.
- KOP: edit teks, logo dan setting; periksa preview; modal signature dengan mouse/touch/stylus.
- Browser: cetak dan PDF masing-masing template, bandingkan dokumen dengan baseline (`main`); periksa Ctrl+P tanpa perubahan.
- Responsivitas: 320/375/430/768/1024/1440px, orientasi, zoom 200%, browser iOS/Android, tanpa overflow/elemen terpotong.
- Light, dark, dan OS auto; preferensi reduce motion; offline reload PWA.
- Modal/dialog/Toast: buka/tutup, fokus kembali, interaksi form, tombol disabled/loading dan pesan error.

**Keterbatasan validasi:** Tes kode/CI tidak menggantikan screenshot visual perangkat sesungguhnya atau pengujian cetak fisik. Merge ke `main` dan deploy produksi harus menunggu verifikasi tersebut.

## 6. Ketertelusuran

Arc Library menggunakan lisensi MIT. Desain ini adalah **adaptasi mandiri** dari prinsip visual referensi; tidak memasukkan kode TSX, package React, atau salinan komponen bermerek. Referensi lisensi: [Arc LICENSE](https://github.com/kuratlielia/arc-library/blob/main/LICENSE). Pertahankan atribusi ini saat mendistribusikan ulang dokumen pengembangan.

