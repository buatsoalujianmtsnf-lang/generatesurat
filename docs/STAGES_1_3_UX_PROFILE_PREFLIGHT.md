# Tahap 1–3: UX, Profil Lembaga, Pemeriksaan Dokumen

Tanggal: 12 November 2026. Branch kerja: feat/ux-profiles-smart-preflight-stage1-3.

## Tahap 1 — UI/UX editor
- Pemilihan Mode Mudah / Mode Lanjutan pada header panel editor.
- Status penyimpanan dengan role=status agar pembaca layar menerima perubahan penting.
- Mode Mudah hanya merampingkan pengaturan teknis KOP dan pengaturan dokumen; data surat tidak disembunyikan dan tidak dihapus.
- Mode disimpan di browser ini. Mode tidak merupakan bagian dari draft/backup surat.
- Navigasi tab keyboard yang telah tersedia dipertahankan.
- Pembatasan zoom halaman sesuai permintaan sebelumnya dipertahankan. Diperlukan keputusan terpisah untuk kompatibilitas penuh WCAG saat memperbesar teks.

## Tahap 2 — Profil & preset KOP
- Profil terdiri dari nama lembaga, instansi induk, yayasan, alamat, dan kepala lembaga (referensi saja).
- Data disimpan lokal pada perangkat; tidak otomatis diterapkan atau dikirim ke server.
- Tombol Terapkan Profil ke KOP mengganti teks KOP setelah konfirmasi, mempertahankan logo yang ada.
- Hingga 5 preset KOP bernama dapat disimpan beserta logo. Memuat preset mengganti seluruh KOP setelah konfirmasi; Undo dapat mengembalikannya.
- Profil/preset belum termasuk file backup JSON dan tidak sinkron lintas perangkat. Periksa data pribadi pada perangkat bersama.
- Nama kepala sekolah/madrasah tidak dimasukkan otomatis ke semua penandatangan karena struktur template berbeda.

## Tahap 3 — Pemeriksaan Dokumen
- Panel Periksa Surat di Pengaturan menggunakan mekanisme validasi wajib yang sama dengan ekspor.
- Pemeriksaan menunggu preview/page layout terbaru sebelum melakukan pemeriksaan overflow horizontal/vertikal dan halaman kosong.
- Klik kesalahan untuk berpindah ke tab/input relevan. Jika data berubah sesudah pemeriksaan, status menjadi perlu diperiksa ulang.
- Pemeriksaan visual hanya peringatan; browser dan printer mempunyai karakteristik berbeda. Pastikan pemeriksaan akhir pada PDF serta cetak perangkat nyata.
- Validasi wajib dan gerbang sponsor/otorisasi yang sudah ada tidak dilonggarkan atau dilewati.

## Batasan dan penerimaan
- Jalankan pemeriksaan TypeScript, Vitest, preview 18 template, PWA, impor Excel, tanda tangan, export PDF, dan Chromium UAT.
- Pengujian perangkat fisik Android, iOS, Safari/Firefox dan hasil cetak fisik tetap memerlukan UAT manual.
- Tidak ada perubahan database, konfigurasi auto-deploy Vercel, merge ke main, atau deployment manual.
