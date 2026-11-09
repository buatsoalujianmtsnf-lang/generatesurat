/* =============================================================
   Konfirmasi pernyataan Surat Izin Tidak Masuk sebelum PDF atau Cetak.
   Persetujuan bersifat per tindakan, tidak disimpan sebagai preferensi.
   ============================================================= */
const IzinDeclaration = (() => {
  let pending = false;

  function request(action, onContinue) {
    if (pending || !['pdf', 'print'].includes(action)
        || typeof onContinue !== 'function') return false;

    const modal = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');
    if (!modal || !body || !footer
        || typeof UI === 'undefined' || typeof UI.showModal !== 'function') {
      if (typeof UI !== 'undefined') UI.toast?.('Modal pernyataan tidak tersedia. Proses dibatalkan.', 'error');
      return false; // Fail closed: tidak ada ekspor/cetak tanpa persetujuan.
    }

    const data = State.getFormData('surat-izin') || {};
    const student = Utils.escapeHtml(String(data.murid?.namaMurid || 'yang tercantum pada surat'));
    const parent = Utils.escapeHtml(String(data.murid?.namaOrangTuaWali || 'yang tercantum pada surat'));
    const duration = typeof TemplateSuratIzin !== 'undefined'
      ? TemplateSuratIzin.formatLamaIzin(data.izin?.durasiIzin) : '';
    const durationText = duration ? ', yaitu <strong>' + Utils.escapeHtml(duration) + '</strong>' : '';
    const actionLabel = action === 'pdf' ? 'ekspor PDF' : 'pencetakan surat';

    const reset = () => {
      pending = false;
      modal.classList.remove('izin-declaration-open');
    };
    const close = () => {
      reset();
      UI.hideModal();
    };

    pending = true;
    UI.showModal({
      title: 'Konfirmasi Pernyataan Orang Tua/Wali',
      body:
        '<div class="izin-declaration">'
        + '<div class="izin-declaration__intro">'
        + '<span class="izin-declaration__icon" aria-hidden="true">🛡️</span>'
        + '<div><strong>Verifikasi keaslian surat izin</strong><p>Sebelum melanjutkan '
        + Utils.escapeHtml(actionLabel) + ', baca dan setujui pernyataan berikut.</p></div></div>'
        + '<div class="izin-declaration__statement" id="izin-declaration-statement">'
        + '<p>Saya menyatakan bahwa <strong>saya yang membuat dan menandatangani surat izin ini'
        + ' adalah benar-benar orang tua/wali</strong> dari murid bernama <strong>'
        + student + '</strong>, dengan nama orang tua/wali <strong>' + parent
        + '</strong> sebagaimana tercantum dalam surat izin ini.</p>'
        + '<p>Apabila di kemudian hari diketahui bahwa yang membuat dan menandatangani'
        + ' surat izin ini <strong>bukan merupakan orang tua/wali</strong> dari murid'
        + ' yang namanya tercantum dalam surat, maka <strong>surat izin ini dianggap'
        + ' tidak berlaku</strong> dan murid yang bersangkutan <strong>dianggap tanpa'
        + ' keterangan (alpa)</strong> selama durasi/lama izin yang diajukan'
        + ' dalam surat izin ini' + durationText + '.</p></div>'
        + '<label class="izin-declaration__ack" for="izin-declaration-check">'
        + '<input type="checkbox" id="izin-declaration-check" required'
        + ' aria-describedby="izin-declaration-statement izin-declaration-hint">'
        + '<span>Saya telah membaca, memahami, dan menyetujui pernyataan di atas,'
        + ' serta menyatakan bahwa informasi yang saya berikan adalah benar.</span></label>'
        + '<p class="izin-declaration__hint" id="izin-declaration-hint">'
        + 'Centang kotak pernyataan untuk mengaktifkan tombol Lanjutkan.'
        + ' Persetujuan diminta setiap kali surat diekspor atau dicetak.</p></div>',
      initialFocusSelector: '#izin-declaration-check',
      onClose: reset,
      footer: [
        { label: 'Batal', class: 'btn--secondary', closeOnClick: false, onClick: close },
        {
          label: action === 'pdf' ? 'Lanjutkan ke PDF' : 'Lanjutkan Cetak',
          class: 'btn--primary izin-declaration-continue',
          disabled: true,
          closeOnClick: false,
          onClick: () => {
            // Tetap verifikasi checkbox walaupun tombol awalnya disabled.
            const checkbox = /** @type {HTMLInputElement|null} */ (
              document.getElementById('izin-declaration-check')
            );
            if (!pending || !checkbox?.checked
                || State.getActiveTemplate() !== 'surat-izin') return;
            close();
            onContinue();
          },
        },
      ],
    });

    const checkbox = /** @type {HTMLInputElement|null} */ (
      document.getElementById('izin-declaration-check')
    );
    const proceed = /** @type {HTMLButtonElement|null} */ (
      document.querySelector('#modal-footer .izin-declaration-continue')
    );
    if (!checkbox || !proceed) {
      close();
      UI.toast('Pernyataan belum dapat ditampilkan. Proses dibatalkan.', 'error');
      return false;
    }
    modal.classList.add('izin-declaration-open');
    proceed.disabled = true;
    checkbox.checked = false;
    checkbox.addEventListener('change', () => {
      proceed.disabled = !checkbox.checked;
    });
    return true;
  }

  return { request };
})();
