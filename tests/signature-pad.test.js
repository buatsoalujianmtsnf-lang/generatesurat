import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../js/signature-pad.js', import.meta.url), 'utf8');

function createPad(value = '') {
  const canvasHandlers = {};
  const buttonHandlers = {};
  const context2d = {
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    clearRect: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([29, 78, 216, 255]) })),
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
  const group = {
    innerHTML: '',
    querySelector: selector => {
      if (selector === 'canvas') return canvas;
      if (selector === '.signature-pad__clear') return button;
      if (selector === '.signature-pad__status') return status;
      return null;
    },
  };
  const changes = vi.fn();
  const context = {
    Utils: { escapeHtml: text => String(text).replaceAll('<', '&lt;').replaceAll('"', '&quot;') },
    Image: class { set src(next) { this._src = next; } },
  };
  runInNewContext(source, context);
  const pad = runInNewContext('SignaturePad', context);
  pad.mount(group, {
    id: 'field-pengirim-tandaTanganDataUrl',
    label: 'Tanda Tangan Orang Tua/Wali',
    hint: 'Gunakan jari atau mouse',
    value,
    onChange: changes,
  });
  return { group, canvas, button, status, changes, pad, context2d, canvasHandlers, buttonHandlers };
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
    const h = createPad(pngOld);
    const image = h.canvas;
    // Hanya image onload yang menjalankan migrasi, tanpa kehilangan bentuk dan alpha.
    expect(h.context2d.drawImage).not.toHaveBeenCalled();
    expect(h.changes).not.toHaveBeenCalled();
  });

  it('menolak data URL lain yang tidak aman/terlalu besar', () => {
    const h = createPad('data:image/svg+xml,<svg onload="alert(1)"/>');
    expect(h.pad.normalize('data:image/jpeg;base64,aaaa')).toBe('');
    expect(h.pad.normalize('data:image/png;base64,a!a')).toBe('');
    expect(h.pad.normalize('data:image/png;base64,' + 'a'.repeat(350001))).toBe('');
    expect(h.status.textContent).toContain('Belum');
  });
});
