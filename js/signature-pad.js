/* =============================================================
   js/signature-pad.js — Tanda tangan langsung menggunakan Pointer Events
   Goresan disimpan sebagai PNG transparan di State formulir.
   ============================================================= */

const SignaturePad = (() => {
  const WIDTH = 800;
  const HEIGHT = 240;
  const MAX_URL_LENGTH = 350000;
  const INK_BLUE = '#1d4ed8'; // Biru tinta pena — digunakan pada canvas maupun PNG

  function normalize(value) {
    if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return '';
    return /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
  }

  function mount(group, config) {
    if (!group || !config || typeof config.onChange !== 'function') return;
    const id = String(config.id || 'signature-canvas').replace(/[^A-Za-z0-9_-]/g, '');
    const label = Utils.escapeHtml(config.label || 'Tanda tangan');
    const hint = Utils.escapeHtml(config.hint || 'Gambar tanda tangan pada area berikut.');
    group.innerHTML = `
      <label class="form-label" for="${id}">${label}<span class="optional-mark">(opsional)</span></label>
      <div class="signature-pad">
        <canvas id="${id}" class="signature-pad__canvas" width="${WIDTH}" height="${HEIGHT}"
          role="img" tabindex="0" aria-label="Area menggambar ${label}"
          aria-describedby="${id}-help">${label}</canvas>
        <div class="signature-pad__toolbar">
          <span class="signature-pad__status" aria-live="polite">Belum ditandatangani</span>
          <button type="button" class="btn btn--secondary btn--sm signature-pad__clear"
            aria-label="Hapus tanda tangan">Hapus tanda tangan</button>
        </div>
        <small class="form-helper signature-pad__help" id="${id}-help">${hint}</small>
      </div>`;

    const canvas = /** @type {HTMLCanvasElement|null} */ (group.querySelector('canvas'));
    const clearButton = /** @type {HTMLButtonElement|null} */ (group.querySelector('.signature-pad__clear'));
    const status = /** @type {HTMLElement|null} */ (group.querySelector('.signature-pad__status'));
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !clearButton || !status || !ctx) {
      group.innerHTML += '<span class="form-helper signature-pad__fallback">Peramban tidak mendukung area tanda tangan. Anda tetap dapat menandatangani surat setelah dicetak.</span>';
      return;
    }

    ctx.strokeStyle = INK_BLUE;
    ctx.fillStyle = INK_BLUE;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let activePointer = null;
    let signed = Boolean(normalize(config.value));
    let changed = false;
    let interacted = false;

    function updateStatus() {
      clearButton.disabled = !signed;
      status.textContent = signed ? 'Tanda tangan tersimpan dalam draf' : 'Belum ditandatangani';
    }

    function point(event) {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return null;
      return {
        x: Math.max(0, Math.min(WIDTH, (event.clientX - bounds.left) * WIDTH / bounds.width)),
        y: Math.max(0, Math.min(HEIGHT, (event.clientY - bounds.top) * HEIGHT / bounds.height)),
      };
    }

    function persist() {
      if (!changed) return;
      changed = false;
      let png;
      try {
        png = normalize(canvas.toDataURL('image/png'));
      } catch {
        png = '';
      }
      if (!png) {
        status.textContent = 'Gagal menyimpan tanda tangan. Silakan coba lagi.';
        return;
      }
      signed = true;
      config.onChange(png);
      updateStatus();
    }

    function stop(event) {
      if (activePointer === null || event.pointerId !== activePointer) return;
      const pos = point(event);
      if (pos && event.type === 'pointerup') {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
      const endedPointer = activePointer;
      activePointer = null;
      canvas.classList.remove('is-drawing');
      if (canvas.hasPointerCapture?.(endedPointer)) {
        canvas.releasePointerCapture(endedPointer);
      }
      persist();
    }

    canvas.addEventListener('pointerdown', event => {
      if (activePointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const pos = point(event);
      if (!pos) return;
      event.preventDefault();
      activePointer = event.pointerId;
      changed = true;
      interacted = true;
      canvas.classList.add('is-drawing');
      canvas.setPointerCapture?.(event.pointerId);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      // Titik tunggal juga menghasilkan goresan, walaupun pointer tidak bergerak.
      ctx.lineTo(pos.x + 0.01, pos.y + 0.01);
      ctx.stroke();
    });

    canvas.addEventListener('pointermove', event => {
      if (activePointer === null || event.pointerId !== activePointer) return;
      const pos = point(event);
      if (!pos) return;
      event.preventDefault();
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    });

    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('lostpointercapture', stop);

    clearButton.addEventListener('click', () => {
      activePointer = null;
      changed = false;
      interacted = true;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      signed = false;
      config.onChange('');
      updateStatus();
    });

    const saved = normalize(config.value);
    if (saved) {
      const img = new Image();
      img.onload = () => {
        // Hindari goresan baru tertimpa saat gambar lama selesai memuat.
        if (interacted || activePointer !== null || !signed) return;
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);

        // Draf lama dapat berisi tinta hitam. Recolor dengan mempertahankan
        // alpha/ketebalan goresan, lalu simpan satu kali bila warnanya berubah.
        // PNG biru yang sudah sesuai tidak diproses ulang.
        let mustRecolor = true;
        try {
          const pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
          const rgb = [29, 78, 216]; // #1d4ed8
          mustRecolor = false;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] < 192) continue; // Abaikan pinggiran antialias.
            if (Math.abs(pixels[i] - rgb[0]) > 5 ||
                Math.abs(pixels[i + 1] - rgb[1]) > 5 ||
                Math.abs(pixels[i + 2] - rgb[2]) > 5) {
              mustRecolor = true;
              break;
            }
          }
        } catch {
          // Canvas yang tidak bisa dibaca: masih dapat diganti tintanya.
        }

        if (mustRecolor) {
          ctx.globalCompositeOperation = 'source-in';
          ctx.fillStyle = INK_BLUE;
          ctx.fillRect(0, 0, WIDTH, HEIGHT);
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = INK_BLUE;
          // Simpan ulang PNG hasil recolor agar pratinjau, cetak dan PDF biru.
          try {
            const bluePng = normalize(canvas.toDataURL('image/png'));
            if (!interacted && bluePng && bluePng !== saved) {
              config.onChange(bluePng);
            }
          } catch {
            // Draf tetap utuh bila ekspor kanvas tidak tersedia.
          }
        }
      };
      img.onerror = () => {
        if (interacted) return;
        signed = false;
        updateStatus();
      };
      img.src = saved;
    }
    updateStatus();
  }

  return { mount, normalize };
})();
