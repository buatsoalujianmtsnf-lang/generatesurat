/* ==============================================================
   Tanda tangan Surat Izin: tinta biru, Undo/Redo dan modal mobile.
   Data tetap PNG transparan, disimpan ke State hanya saat Save di mobile.
   ============================================================== */
const SignaturePad = (() => {
  const WIDTH = 800;
  const HEIGHT = 240;
  const MAX_URL_LENGTH = 350000;
  const MAX_HISTORY = 25;
  const INK_BLUE = '#1d4ed8';
  let dismissActiveModal = null;

  function normalize(value) {
    if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return '';
    return /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
  }

  function isMobile() {
    return typeof window !== 'undefined'
      && window.matchMedia?.('(max-width: 767px)')?.matches === true;
  }

  function mount(group, config) {
    if (!group || !config || typeof config.onChange !== 'function') return;
    const id = String(config.id || 'signature-canvas').replace(/[^A-Za-z0-9_-]/g, '');
    const label = Utils.escapeHtml(config.label || 'Tanda tangan');
    const hint = Utils.escapeHtml(config.hint || 'Gambar tanda tangan pada area berikut.');

    group.innerHTML =
      '<label class="form-label" for="' + id + '">' + label
      + '<span class="optional-mark">(opsional)</span></label>'
      + '<div class="signature-pad__mobile-entry">'
      + '  <div class="signature-pad__mobile-preview">'
      + '    <img class="signature-pad__preview-image" alt="Tanda tangan tersimpan" hidden>'
      + '    <span class="signature-pad__preview-empty">Belum ada tanda tangan</span>'
      + '  </div>'
      + '  <button type="button" class="btn btn--primary signature-pad__open"'
      + '     title="Buka modal untuk membubuhkan tanda tangan" aria-haspopup="dialog">'
      + '    ✍️ <span class="signature-pad__open-label">Bubuhkan tanda tangan</span>'
      + '  </button>'
      + '</div>'
      + '<div class="signature-pad">'
      + '  <canvas id="' + id + '" class="signature-pad__canvas" width="' + WIDTH
      + '" height="' + HEIGHT + '" tabindex="0" role="img"'
      + '    aria-label="Area menggambar ' + label + '" aria-describedby="' + id + '-help">'
      + label + '</canvas>'
      + '  <div class="signature-pad__toolbar">'
      + '    <div class="signature-pad__tools" role="toolbar" aria-label="Alat tanda tangan">'
      + '      <button type="button" class="signature-pad__tool signature-pad__undo"'
      + '        aria-label="Undo: batalkan goresan terakhir"'
      + '        title="Undo — batalkan goresan terakhir" data-tooltip="Undo" disabled>'
      + '        <span aria-hidden="true">↶</span><span>Undo</span>'
      + '      </button>'
      + '      <button type="button" class="signature-pad__tool signature-pad__redo"'
      + '        aria-label="Redo: ulangi goresan"'
      + '        title="Redo — ulangi goresan" data-tooltip="Redo" disabled>'
      + '        <span aria-hidden="true">↷</span><span>Redo</span>'
      + '      </button>'
      + '      <button type="button" class="signature-pad__tool signature-pad__tool--danger signature-pad__clear"'
      + '        aria-label="Hapus seluruh tanda tangan"'
      + '        title="Hapus — kosongkan area tanda tangan" data-tooltip="Hapus" disabled>'
      + '        <span aria-hidden="true">⌫</span><span>Hapus</span>'
      + '      </button>'
      + '    </div>'
      + '    <span class="signature-pad__status" role="status" aria-live="polite">Belum ditandatangani</span>'
      + '  </div>'
      + '  <small class="form-helper signature-pad__help" id="' + id + '-help">' + hint + '</small>'
      + '</div>';

    const canvas = /** @type {HTMLCanvasElement|null} */ (group.querySelector('canvas'));
    const clearButton = /** @type {HTMLButtonElement|null} */ (group.querySelector('.signature-pad__clear'));
    const undoButton = /** @type {HTMLButtonElement|null} */ (group.querySelector('.signature-pad__undo'));
    const redoButton = /** @type {HTMLButtonElement|null} */ (group.querySelector('.signature-pad__redo'));
    const status = /** @type {HTMLElement|null} */ (group.querySelector('.signature-pad__status'));
    const openButton = /** @type {HTMLButtonElement|null} */ (group.querySelector('.signature-pad__open'));
    const preview = /** @type {HTMLImageElement|null} */ (group.querySelector('.signature-pad__preview-image'));
    const previewEmpty = group.querySelector('.signature-pad__preview-empty');
    const editor = group.querySelector('.signature-pad');
    const ctx = canvas?.getContext?.('2d');

    if (!canvas || !clearButton || !status || !ctx) {
      group.innerHTML += '<span class="form-helper signature-pad__fallback">'
        + 'Peramban tidak mendukung area tanda tangan. '
        + 'Surat masih dapat ditandatangani setelah dicetak.</span>';
      return;
    }

    const originalParent = editor?.parentNode || group;
    let persisted = normalize(config.value);
    let history = [persisted];
    let index = 0;
    let activePointer = null;
    let interacted = false;
    let restoreGeneration = 0;
    let restoring = false;
    let initialLoading = Boolean(persisted);
    let modalOpen = false;
    let overlay = null;
    let restoreFocus = null;
    let previousBodyOverflow = '';
    let lastError = '';

    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK_BLUE;
    ctx.fillStyle = INK_BLUE;

    function snapshot() {
      return history[index] || '';
    }

    function syncPreview() {
      if (preview) {
        preview.hidden = !persisted;
        if (persisted && preview.getAttribute('src') !== persisted) preview.setAttribute('src', persisted);
        else preview.removeAttribute('src');
      }
      if (previewEmpty) previewEmpty.hidden = Boolean(persisted);
      if (openButton) {
        const labelNode = openButton.querySelector('.signature-pad__open-label');
        if (labelNode) labelNode.textContent = persisted
          ? 'Ubah tanda tangan' : 'Bubuhkan tanda tangan';
      }
    }

    function refresh() {
      if (undoButton) undoButton.disabled = index <= 0 || restoring;
      if (redoButton) redoButton.disabled = index >= history.length - 1 || restoring;
      clearButton.disabled = !snapshot() || restoring;
      const saveButton = /** @type {HTMLButtonElement|null} */ (overlay?.querySelector('.signature-modal__save'));
      if (saveButton) saveButton.disabled = restoring || activePointer !== null;
      status.textContent = lastError || (modalOpen
        ? (snapshot() === persisted ? 'Siap untuk ditandatangani' : 'Perubahan belum disimpan')
        : (persisted ? 'Tanda tangan tersimpan dalam draf' : 'Belum ditandatangani'));
      syncPreview();
    }

    function setCommitted(value) {
      persisted = value;
      config.onChange(value);
      refresh();
    }

    function emitChange() {
      lastError = '';
      if (!modalOpen) setCommitted(snapshot());
      else refresh();
    }

    function push(value) {
      if (value === snapshot()) return;
      history = history.slice(0, index + 1);
      history.push(value);
      if (history.length > MAX_HISTORY) history.shift();
      index = history.length - 1;
      emitChange();
    }

    function recolorIfNeeded() {
      let recolor = true;
      try {
        const pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
        recolor = false;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] < 192) continue;
          if (Math.abs(pixels[i] - 29) > 5
            || Math.abs(pixels[i + 1] - 78) > 5
            || Math.abs(pixels[i + 2] - 216) > 5) {
            recolor = true;
            break;
          }
        }
      } catch {
        // Tetap izinkan recolor jika pixel tidak dapat diinspeksi.
      }
      if (!recolor) return null;
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = INK_BLUE;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = INK_BLUE;
      ctx.fillStyle = INK_BLUE;
      try { return normalize(canvas.toDataURL('image/png')); }
      catch { return null; }
    }

    function restore(value, migrate = false) {
      const generation = ++restoreGeneration;
      restoring = Boolean(value);
      initialLoading = Boolean(value) && migrate;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      refresh();
      if (!value) {
        restoring = false;
        initialLoading = false;
        refresh();
        return;
      }

      const img = new Image();
      img.onload = () => {
        if (generation !== restoreGeneration || interacted) return;
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);

        if (migrate) {
          const blue = recolorIfNeeded();
          if (blue && blue !== value) {
            history[index] = blue;
            // Jangan simpan otomatis dalam modal mobile; Simpan adalah
            // satu-satunya commit. Desktop tetap kompatibel dengan draf lama.
            if (!modalOpen && !isMobile()) setCommitted(blue);
          }
        }
        restoring = false;
        initialLoading = false;
        refresh();
      };
      img.onerror = () => {
        if (generation !== restoreGeneration || interacted) return;
        restoring = false;
        initialLoading = false;
        lastError = 'Gagal memuat tanda tangan. Silakan gambar ulang.';
        refresh();
      };
      img.src = value;
    }

    function completeStroke() {
      let value;
      try { value = normalize(canvas.toDataURL('image/png')); }
      catch { value = ''; }
      if (!value) {
        lastError = 'Tanda tangan terlalu besar atau gagal disimpan. Coba ulangi.';
        restore(snapshot());
        refresh();
        return;
      }
      push(value);
    }

    function point(event) {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return null;
      return {
        x: Math.max(0, Math.min(WIDTH, (event.clientX - bounds.left) * WIDTH / bounds.width)),
        y: Math.max(0, Math.min(HEIGHT, (event.clientY - bounds.top) * HEIGHT / bounds.height)),
      };
    }

    function endStroke(event) {
      if (activePointer === null || event.pointerId !== activePointer) return;
      const canceled = event.type !== 'pointerup';
      const pos = point(event);
      if (!canceled && pos) {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
      const pointer = activePointer;
      activePointer = null;
      canvas.classList.remove('is-drawing');
      if (canvas.hasPointerCapture?.(pointer)) canvas.releasePointerCapture(pointer);
      if (canceled) {
        interacted = false;
        restore(snapshot());
      } else {
        completeStroke();
      }
    }

    canvas.addEventListener('pointerdown', event => {
      if (activePointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if (restoring && !initialLoading) return;
      const pos = point(event);
      if (!pos) return;
      event.preventDefault();
      // Pengguna menggambar sebelum PNG lama selesai dimuat: abaikan hasil
      // gambar async lama agar tidak menimpa tanda tangan baru.
      restoreGeneration++;
      restoring = false;
      initialLoading = false;
      interacted = true;
      activePointer = event.pointerId;
      canvas.classList.add('is-drawing');
      canvas.setPointerCapture?.(event.pointerId);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x + 0.01, pos.y + 0.01);
      ctx.stroke();
      refresh();
    });

    canvas.addEventListener('pointermove', event => {
      if (activePointer !== event.pointerId) return;
      const pos = point(event);
      if (!pos) return;
      event.preventDefault();
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    });
    canvas.addEventListener('pointerup', endStroke);
    canvas.addEventListener('pointercancel', endStroke);
    canvas.addEventListener('lostpointercapture', endStroke);

    function clear() {
      if (restoring || activePointer !== null || !snapshot()) return;
      interacted = false;
      restoreGeneration++;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      push('');
    }

    function moveHistory(direction) {
      const next = index + direction;
      if (activePointer !== null || next < 0 || next >= history.length) return;
      index = next;
      interacted = false;
      restore(snapshot());
      emitChange();
    }

    clearButton.addEventListener('click', clear);
    undoButton?.addEventListener('click', () => moveHistory(-1));
    redoButton?.addEventListener('click', () => moveHistory(1));

    function closeModal(save = false) {
      if (!modalOpen) return;
      if (activePointer !== null) {
        // Jangan mengubah draf ketika pengguna menutup saat menggambar.
        restoreGeneration++;
        activePointer = null;
      }
      const chosen = snapshot();
      modalOpen = false;
      if (overlay) {
        overlay.removeEventListener('keydown', handleDialogKeydown);
        overlay.remove();
      }
      if (editor) originalParent.appendChild(editor);
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.overflow = previousBodyOverflow;
      }
      overlay = null;
      dismissActiveModal = null;
      if (save && chosen !== persisted) {
        setCommitted(chosen);
      } else if (!save) {
        history = [persisted];
        index = 0;
        interacted = false;
        restore(persisted);
      }
      refresh();
      restoreFocus?.focus?.();
      restoreFocus = null;
    }

    function handleDialogKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal(false);
        return;
      }
      if (event.key !== 'Tab' || !overlay) return;
      const focusable = Array.from(
        /** @type {NodeListOf<HTMLElement>} */ (
          overlay.querySelectorAll('button:not([disabled]), [tabindex="0"]')
        )
      ).filter(node => !node.hidden && node.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function openModal() {
      if (modalOpen || !editor || typeof document === 'undefined' || !document.body) return;
      if (typeof dismissActiveModal === 'function') dismissActiveModal();
      restoreFocus = document.activeElement;
      modalOpen = true;
      history = [persisted];
      index = 0;
      interacted = false;

      overlay = document.createElement('div');
      overlay.className = 'signature-modal-overlay';
      overlay.innerHTML =
        '<section class="signature-modal" role="dialog" aria-modal="true"'
        + ' aria-labelledby="' + id + '-modal-title"'
        + ' aria-describedby="' + id + '-modal-desc">'
        + '  <header class="signature-modal__header">'
        + '    <div class="signature-modal__heading">'
        + '      <span class="signature-modal__icon" aria-hidden="true">✍️</span>'
        + '      <div><h2 id="' + id + '-modal-title">Bubuhkan Tanda Tangan</h2>'
        + '      <p id="' + id + '-modal-desc">Gunakan jari atau stylus pada area putih.'
        + '        Tinta berwarna biru.</p></div>'
        + '    </div>'
        + '    <button type="button" class="signature-modal__close"'
        + '      title="Tutup tanpa menyimpan" aria-label="Tutup modal tanpa menyimpan">×</button>'
        + '  </header>'
        + '  <div class="signature-modal__content">'
        + '    <div class="signature-modal__canvas-slot"></div>'
        + '  </div>'
        + '  <footer class="signature-modal__footer">'
        + '    <span class="signature-modal__tip">'
        + '      <span aria-hidden="true">ⓘ</span> Undo membatalkan goresan,'
        + '      Redo mengulangi, Hapus mengosongkan.</span>'
        + '    <div class="signature-modal__footer-actions">'
        + '      <button type="button" class="btn btn--secondary signature-modal__cancel">'
        + '        Batal</button>'
        + '      <button type="button" class="btn btn--primary signature-modal__save">'
        + '        Simpan Tanda Tangan</button>'
        + '    </div>'
        + '  </footer>'
        + '</section>';

      const slot = overlay.querySelector('.signature-modal__canvas-slot');
      slot?.appendChild(editor);
      document.body.appendChild(overlay);
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      overlay.querySelector('.signature-modal__close')?.addEventListener('click', () => closeModal(false));
      overlay.querySelector('.signature-modal__cancel')?.addEventListener('click', () => closeModal(false));
      overlay.querySelector('.signature-modal__save')?.addEventListener('click', () => {
        if (restoring || activePointer !== null) return;
        closeModal(true);
      });
      overlay.addEventListener('click', event => {
        if (event.target === overlay) closeModal(false);
      });
      overlay.addEventListener('keydown', handleDialogKeydown);
      dismissActiveModal = () => closeModal(false);
      restore(persisted, true);
      refresh();
      overlay.querySelector('.signature-modal__close')?.focus();
    }

    openButton?.addEventListener('click', openModal);
    restore(persisted, true);
    refresh();

    return { openModal, closeModal, undo: () => moveHistory(-1), redo: () => moveHistory(1), clear };
  }

  function closeActive() {
    if (typeof dismissActiveModal === 'function') dismissActiveModal();
  }

  return { mount, normalize, closeActive };
})();
