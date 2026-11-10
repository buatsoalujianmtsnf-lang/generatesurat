/* =============================================================
   print.js — Logika cetak dokumen
   =============================================================
   Mengambil konfigurasi kertas, margin, dan skala dari
   State.getSettings() agar sinkron dengan tab Pengaturan.
   Print TIDAK menggunakan transform scale dari preview —
   preview zoom dan print scale adalah dua hal yang terpisah.
*/

const Print = (() => {

  /* ── ID style element yang diinjeksi ── */
  const STYLE_ID = 'print-page-style';

  /* ── Cetak surat ── */
  let _printing = false;

  async function printDocument() {
    if (_printing) return false;

    // Flush first: validasi, layout, dan data yang dicetak harus konsisten.
    if (typeof Utils.flushDebounces === 'function') Utils.flushDebounces();

    const templateId = State.getActiveTemplate();
    if (!templateId) {
      UI.toast('Pilih template surat terlebih dahulu.', 'warning');
      return false;
    }
    const tpl = TemplateRegistry.get(templateId);
    if (!tpl) {
      UI.toast('Template tidak ditemukan.', 'error');
      return false;
    }
    if (!State.getFormData(templateId)) {
      UI.toast('Data surat belum diisi.', 'warning');
      return false;
    }

    _printing = true;
    try {
      // Pagination harus selesai sebelum mengambil DOM cetak.
      if (typeof PreviewRenderer !== 'undefined' && typeof PreviewRenderer.waitForReady === 'function') {
        await PreviewRenderer.waitForReady();
      }
      if (State.getActiveTemplate() !== templateId) {
        UI.toast('Template berubah saat mempersiapkan cetak. Coba kembali.', 'warning');
        return false;
      }
      if (typeof window.print !== 'function') {
        UI.toast('Browser ini tidak mendukung dialog cetak.', 'error');
        return false;
      }

      _applyPageStyle();

      // Panggil langsung setelah preview siap. Menunda lagi dengan timer
      // dapat kehilangan user activation (terutama browser mobile).
      window.print();
      return true;
    } catch (error) {
      console.error('[Print] Gagal membuka dialog cetak:', error);
      UI.toast('Tidak dapat membuka dialog cetak. Periksa browser atau coba lagi.', 'error');
      return false;
    } finally {
      _printing = false;
      // Pada browser yang memblokir atau mengabaikan afterprint, cleanup
      // tetap berjalan agar style @page tidak tertinggal di aplikasi.
      setTimeout(_cleanupPageStyle, 5000);
    }
  }

  /* ── Bangun dan injeksi @page style dari State.settings ── */
  function _applyPageStyle() {
    _cleanupPageStyle();

    const s    = State.getSettings();
    const dim  = State.getPaperDimensions(); // sudah memperhitungkan orientasi

    // Gunakan dimensi fisik aktual dari State, setelah orientasi diterapkan.
    // Ini menghindari perbedaan antara nama ukuran CSS (mis. F4/Legal) dan
    // dimensi halaman yang dipakai PreviewRenderer.
    const pageSize = `${dim.widthMm}mm ${dim.heightMm}mm`;

    // Skala cetak bukan bagian dari layout Preview. Jangan menerapkan transform
    // di sini karena transform dapat mengubah clipping, tinggi efektif, dan
    // pagination. Browser print dialog tetap menjadi kontrol akhir skala fisik.

    const css = `
@page {
  size: ${pageSize};
  margin: 0;
}
@media print {
  /* Typography, margin, table style, KOP, dan seluruh style isi
     dipertahankan dari DOM Preview/current State. */
  .surat-preview {
    box-shadow: none !important;
  }
}`;

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  /* ── Hapus injected style ── */
  function _cleanupPageStyle() {
    document.getElementById(STYLE_ID)?.remove();
  }

  /* ── Public API ── */
  return {
    printDocument,
  };

})();
