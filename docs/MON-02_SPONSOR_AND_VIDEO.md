# MON-02 — KONTRAK SPONSOR DAN MATERI VIDEO

Tanggal kerja: 11 November 2026. Repositori produksi: `buatsoalujianmtsnf-lang/generatesurat`.
**Status implementasi:** source, template, katalog kampanye dan validator dibuat dalam branch MON-02. **Status go-live:** BLOCKED hingga sponsor nyata dan kontrak sah diserahkan.

## Ruang lingkup yang diselesaikan
1. `config/sponsor-policy.json`: keputusan 15 detik, tiap tindakan Cetak/PDF/Ctrl+P, isolasi sponsor dari AdSense, pembatasan konten pendidikan, default `enabled:false`.
2. `config/sponsor-campaigns.json`: katalog kampanye kosong dan nonaktif (tidak mengarang sponsor maupun hak tayang).
3. `scripts/validate-sponsor-campaigns.js`: validasi kontrak dan persetujuan, jadwal, MIME, file lokal, hash SHA-256, dimensi, codec dan durasi video hasil `ffprobe`.
4. `docs/sponsor/KONTRAK_SPONSOR_DRAFT.md`: draft perjanjian tertulis dengan klausul penayangan wajib, klaim, lisensi, iklan tidak boleh meminta klik, privasi, laporan agregat dan penarikan.
5. `docs/sponsor/SPESIFIKASI_VIDEO_15_DETIK.md`: standar teknis, aksesibilitas, media dan moderasi.
6. `docs/sponsor/SOP_MODERASI.md` dan `CHECKLIST_PENERIMAAN.md`: alur review dua peran, kontrol privasi, risiko lingkungan pendidikan.
7. `tests/sponsor-contract-materials.test.js`: tes mode nonaktif, invaliditas konten/kontrak, media 15 detik, file tidak ada, injeksi URL dan codec.
8. `npm run check:sponsor` ikut dalam `npm run check` dan GitHub Actions yang sudah ada.

## Larangan aktivasi dini
- **Tidak ada** JS modal sponsor, penayangan video, perubahan Ctrl+P, server receipt, atau pembayaran.
- **Tidak ada** materi video sponsor nyata, kontrak bertanda tangan, atau pernyataan bahwa sponsor telah lulus verifikasi.
- `enabled:false` di kedua konfigurasi. Nilai true tanpa kelulusan MON-03 hingga MON-08 dilarang.
- Tetap `git.deploymentEnabled:false` dan tidak melakukan deploy Vercel.
- AdSense tetap hanya untuk halaman konten publik dan belum diaktifkan.

## Gate MON-02
**PASS:** draft kontrak, ketentuan materi, SOP moderasi, konfigurasi aman, validator dan tes CI.
**BLOCKED:** kontrak pihak sponsor belum ditandatangani, lisensi belum diverifikasi, video 15 detik belum diserahkan/diperiksa, persetujuan operator dan privasi belum lengkap.
MON-03 boleh dipersiapkan tanpa mengaktifkan iklan; MON-08 tidak boleh go-live sebelum semua syarat MON-02 terpenuhi.

## Kriteria selanjutnya
- Sponsor nyata + kesepakatan tertulis yang mengizinkan video wajib 15 detik setiap tindakan.
- Video berkualitas sesuai spesifikasi + caption jika ada narasi, hash dan hasil probe.
- Moderator dan peninjau privasi menyetujui materi dan merekam bukti secara privat.
- Pemisahan AdSense/editor tetap ketat, tinjauan peraturan PDP dan kebijakan AdSense terkini.
