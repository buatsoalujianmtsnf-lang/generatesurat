import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../js/signature-pad.js', import.meta.url), 'utf8');

function createPad(value = '', oldInk = false) {
  const images = [];
  const canvasHandlers = {};
  const buttonHandlers = {};
  const context2d = {
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    clearRect: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(oldInk ? [23, 33, 47, 255] : [29, 78, 216, 255]) })),
  };
  let captured = null;
  const canvas = {
    getContext: () => context2d,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 400, height: 120 }),
    toDataURL: vi.fn(() => 'data:image/png;base64,iVBORw0KGgo='),
    addEventListener: (event, callback) => { canvasHandlers[event] = callback; },
    setPointerCapture: pointerId => { captured = pointerId; },
    hasPointerCapture: pointerId => captured === pointerId,
    releasePointerCapture: () => { captured = null; },
    classList: { add: vi.fn(), remove: vi.fn() },
  };
  const button = { disabled: false, addEventListener: (ev, cb) => { buttonHandlers[ev] = cb; } };
  const status = { textContent: '' };
  const imageAttributes = new Map();
  const previewImage = {
    hidden: true,
    getAttribute: vi.fn(name => imageAttributes.get(name) ?? null),
    hasAttribute: vi.fn(name => imageAttributes.has(name)),
    setAttribute: vi.fn((name, value) => imageAttributes.set(name, value)),
    removeAttribute: vi.fn(name => imageAttributes.delete(name)),
  };
  const previewEmpty = { hidden: false };
  const group = {
    innerHTML: '',
    querySelector: selector => {
      if (selector === 'canvas') return canvas;
      if (selector === '.signature-pad__clear') return button;
      if (selector === '.signature-pad__status') return status;
      if (selector === '.signature-pad__preview-image') return previewImage;
      if (selector === '.signature-pad__preview-empty') return previewEmpty;
      return null;
    },
  };
  const changes = vi.fn();
  const context = {
    Utils: { escapeHtml: text => String(text).replaceAll('<', '&lt;').replaceAll('"', '&quot;') },
    Image: class {
      constructor() { images.push(this); }
      set src(next) { this._src = next; }
    },
  };
  runInNewContext(source, context);
  const pad = runInNewContext('SignaturePad', context);
  const controller = pad.mount(group, {
    id: 'field-pengirim-tandaTanganDataUrl',
    label: 'Tanda Tangan Orang Tua/Wali',
    hint: 'Gunakan jari atau mouse',
    value,
    onChange: changes,
  });
  return { group, canvas, button, status, previewImage, previewEmpty, changes, pad, controller, context2d, canvasHandlers, buttonHandlers, images };
}

describe('Canvas tanda tangan pada Surat Izin', () => {
  it('memiliki area gambar dan tombol hapus', () => {
    const h = createPad();
    expect(h.group.innerHTML).toContain('signature-pad__canvas');
    expect(h.group.innerHTML).toContain('Hapus tanda tangan');
    expect(h.button.disabled).toBe(true);
    expect(h.status.textContent).toContain('Belum');
  });

  it('menggambar dengan pointer lalu menyimpan PNG hanya setelah goresan selesai', () => {
    const h = createPad();
    h.canvasHandlers.pointerdown({
      pointerId: 1, pointerType: 'touch', clientX: 30, clientY: 40,
      preventDefault: vi.fn(),
    });
    h.canvasHandlers.pointermove({
      pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 50,
      preventDefault: vi.fn(),
    });
    expect(h.changes).not.toHaveBeenCalled();
    h.canvasHandlers.pointerup({ pointerId: 1, pointerType: 'touch', clientX: 110, clientY: 55 });
    expect(h.context2d.stroke).toHaveBeenCalled();
    expect(h.context2d.strokeStyle).toBe('#1d4ed8');
    expect(h.context2d.fillStyle).toBe('#1d4ed8');
    expect(h.changes).toHaveBeenCalledTimes(1);
    expect(h.changes).toHaveBeenCalledWith('data:image/png;base64,iVBORw0KGgo=');
    expect(h.button.disabled).toBe(false);

    h.buttonHandlers.click();
    expect(h.context2d.clearRect).toHaveBeenCalled();
    expect(h.changes).toHaveBeenLastCalledWith('');
    expect(h.button.disabled).toBe(true);
  });

  it('mewarnai ulang tanda tangan lama hitam ke biru ketika draf dibuka', () => {
    const pngOld = 'data:image/png;base64,AAAA';
    const h = createPad(pngOld, true);
    expect(h.images).toHaveLength(1);
    h.images[0].onload();
    expect(h.context2d.drawImage).toHaveBeenCalledTimes(1);
    expect(h.context2d.globalCompositeOperation).toBe('source-over');
    expect(h.context2d.fillStyle).toBe('#1d4ed8');
    expect(h.context2d.fillRect).toHaveBeenCalledWith(0, 0, 800, 240);
    expect(h.changes).toHaveBeenCalledWith('data:image/png;base64,iVBORw0KGgo=');
  });

  it('tidak menulis ulang tanda tangan yang sudah biru', () => {
    const h = createPad('data:image/png;base64,iVBORw0KGgo=');
    h.images[0].onload();
    expect(h.context2d.fillRect).not.toHaveBeenCalled();
    expect(h.changes).not.toHaveBeenCalled();
  });

  it('tidak menimpa goresan baru bila gambar draf lama terlambat dimuat', () => {
    const h = createPad('data:image/png;base64,AAAA', true);
    h.canvasHandlers.pointerdown({
      pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 30,
      preventDefault: vi.fn(),
    });
    h.canvasHandlers.pointerup({ pointerId: 1, pointerType: 'touch', clientX: 25, clientY: 35 });
    const before = h.changes.mock.calls.length;
    h.images[0].onload();
    expect(h.context2d.drawImage).not.toHaveBeenCalled();
    expect(h.changes).toHaveBeenCalledTimes(before);
  });

  it('undo dan redo bekerja berdasarkan riwayat goresan tanpa kehilangan PNG', () => {
    const h = createPad();
    expect(h.controller).toBeDefined();
    h.canvasHandlers.pointerdown({
      pointerId: 1, pointerType: 'touch', clientX: 30, clientY: 40,
      preventDefault: vi.fn(),
    });
    h.canvasHandlers.pointerup({
      pointerId: 1, pointerType: 'touch', clientX: 45, clientY: 48,
    });
    const signature = 'data:image/png;base64,iVBORw0KGgo=';
    expect(h.changes).toHaveBeenLastCalledWith(signature);
    h.controller.undo();
    expect(h.changes).toHaveBeenLastCalledWith('');
    h.controller.redo();
    expect(h.changes).toHaveBeenLastCalledWith(signature);
  });

  it('hapus seluruh tanda tangan dapat di-undo dan redo', () => {
    const h = createPad();
    h.canvasHandlers.pointerdown({
      pointerId: 5, pointerType: 'mouse', button: 0,
      clientX: 50, clientY: 45, preventDefault: vi.fn(),
    });
    h.canvasHandlers.pointerup({ pointerId: 5, pointerType: 'mouse', clientX: 60, clientY: 45 });
    h.controller.clear();
    expect(h.changes).toHaveBeenLastCalledWith('');
    h.controller.undo();
    expect(h.changes).toHaveBeenLastCalledWith('data:image/png;base64,iVBORw0KGgo=');
    h.controller.redo();
    expect(h.changes).toHaveBeenLastCalledWith('');
  });

  it('kontrol modal, tooltip dan aturan commit disediakan untuk perangkat mobile', () => {
    const source = readFileSync(new URL('../js/signature-pad.js', import.meta.url), 'utf8');
    expect(source).toContain('signature-pad__open');
    expect(source).toContain('aria-haspopup="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('signature-modal__save');
    expect(source).toContain('signature-modal__cancel');
    expect(source).toContain('data-tooltip="Undo"');
    expect(source).toContain('data-tooltip="Redo"');
    expect(source).toContain('data-tooltip="Hapus"');
    expect(source).toContain('if (!modalOpen) setCommitted(snapshot())');
    expect(source).toContain("closeModal(false)");
    const css = readFileSync(new URL('../css/signature-modal.css', import.meta.url), 'utf8');
    expect(css).toContain('.signature-pad__mobile-entry { display: block; }');
    expect(css).toContain('touch-action: none;');
    expect(css).toContain('.signature-modal-overlay');
    expect(css).toContain('max-height: 100%;');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });

  it('mempertahankan src gambar pada refresh berulang setelah tanda tangan tersimpan', () => {
    const h = createPad();
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    h.canvasHandlers.pointerdown({
      pointerId: 7, pointerType: 'touch', clientX: 30, clientY: 40, preventDefault: vi.fn(),
    });
    h.canvasHandlers.pointerup({ pointerId: 7, pointerType: 'touch', clientX: 45, clientY: 48 });
    expect(h.changes).toHaveBeenLastCalledWith(png);
    expect(h.previewImage.getAttribute('src')).toBe(png);
    expect(h.previewImage.hidden).toBe(false);
    expect(h.previewEmpty.hidden).toBe(true);

    // Pada kode lama, refresh berikutnya akan memanggil removeAttribute('src').
    h.canvasHandlers.pointerdown({
      pointerId: 8, pointerType: 'touch', clientX: 34, clientY: 46, preventDefault: vi.fn(),
    });
    expect(h.previewImage.getAttribute('src')).toBe(png);
    expect(h.previewImage.removeAttribute).not.toHaveBeenCalled();
    expect(h.previewImage.setAttribute).toHaveBeenCalledTimes(1);
  });

  it('mempertahankan gambar tanda tangan dari draf setelah gambar selesai dimuat', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const h = createPad(png);
    expect(h.previewImage.hidden).toBe(false);
    expect(h.previewImage.getAttribute('src')).toBe(png);
    expect(h.images).toHaveLength(1);
    h.images[0].onload();
    expect(h.previewImage.getAttribute('src')).toBe(png);
    expect(h.previewImage.removeAttribute).not.toHaveBeenCalled();
    expect(h.previewImage.setAttribute).toHaveBeenCalledTimes(1);
  });

  it('menghapus gambar editor saat tanda tangan benar-benar dibersihkan', () => {
    const h = createPad();
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    h.canvasHandlers.pointerdown({
      pointerId: 1, pointerType: 'mouse', button: 0, clientX: 50, clientY: 50,
      preventDefault: vi.fn(),
    });
    h.canvasHandlers.pointerup({ pointerId: 1, pointerType: 'mouse', clientX: 60, clientY: 55 });
    expect(h.previewImage.getAttribute('src')).toBe(png);
    h.controller.clear();
    expect(h.changes).toHaveBeenLastCalledWith('');
    expect(h.previewImage.hidden).toBe(true);
    expect(h.previewEmpty.hidden).toBe(false);
    expect(h.previewImage.getAttribute('src')).toBeNull();
    expect(h.previewImage.removeAttribute).toHaveBeenCalledWith('src');
  });

  it('menolak data URL lain yang tidak aman/terlalu besar', () => {
    const h = createPad('data:image/svg+xml,<svg onload="alert(1)"/>');
    expect(h.pad.normalize('data:image/jpeg;base64,aaaa')).toBe('');
    expect(h.pad.normalize('data:image/png;base64,a!a')).toBe('');
    expect(h.pad.normalize('data:image/png;base64,' + 'a'.repeat(350001))).toBe('');
    expect(h.status.textContent).toContain('Belum');
  });
});
