import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../js/workflow.js', import.meta.url), 'utf8');

function createHarness(usesKop) {
  const elements = new Map();
  for (const id of [
    'workflow-actions', 'workflow-step-label', 'workflow-status',
    'workflow-back', 'workflow-next', 'workflow-next-label',
  ]) {
    const handlers = {};
    elements.set(id, {
      innerHTML: '', textContent: '', hidden: false, dataset: {},
      classList: { toggle: vi.fn() },
      setAttribute: vi.fn(),
      addEventListener: vi.fn((event, callback) => { handlers[event] = callback; }),
      click: () => handlers.click?.(),
    });
  }

  const state = {
    getActiveTemplate: () => usesKop ? 'rekap-nilai' : 'surat-izin',
    getFormData: () => ({}),
    getKop: () => ({}),
    getUi: () => ({ activeTab: 'template' }),
    on: vi.fn(),
  };
  const ui = {
    switchTab: vi.fn(),
    toast: vi.fn(),
    showModal: vi.fn(),
  };
  const validation = {
    kopConfig: vi.fn(() => ({ valid: false, errors: [
      { field: 'logoLeft', message: 'Logo kiri harus diisi.' },
    ] })),
    formTemplate: vi.fn(() => ({ valid: true, errors: [] })),
  };
  const print = { printDocument: vi.fn() };
  const pdf = { exportDocument: vi.fn() };
  const context = {
    document: {
      getElementById: id => elements.get(id) || null,
      querySelectorAll: () => [],
    },
    State: state,
    TemplateRegistry: { get: () => ({ meta: { usesKop } }) },
    UI: ui,
    Validation: validation,
    Utils: { flushDebounces: vi.fn(), escapeHtml: text => String(text) },
    Print: print,
    PdfExport: pdf,
  };
  runInNewContext(source, context);
  const workflow = runInNewContext('Workflow', context);
  workflow.init();
  return { workflow, elements, ui, validation, print, pdf };
}

describe('Surat izin pribadi tanpa KOP', () => {
  it('skips the KOP step, validation, and allows print/PDF', () => {
    const h = createHarness(false);
    expect(h.elements.get('workflow-step-label').textContent).toContain('Langkah 1 dari 3');
    expect(h.elements.get('workflow-next-label').textContent).toBe('Ke Isi Surat');
    h.elements.get('workflow-next').click();
    expect(h.ui.switchTab).toHaveBeenCalledWith('form');

    expect(h.workflow.preparePrint()).toBe(true);
    expect(h.workflow.preparePdf()).toBe(true);
    expect(h.validation.kopConfig).not.toHaveBeenCalled();
    expect(h.print.printDocument).toHaveBeenCalledOnce();
    expect(h.pdf.exportDocument).toHaveBeenCalledOnce();
  });

  it('preserves KOP navigation and validation for other templates', () => {
    const h = createHarness(true);
    expect(h.elements.get('workflow-step-label').textContent).toContain('Langkah 1 dari 4');
    expect(h.elements.get('workflow-next-label').textContent).toBe('Ke KOP Surat');
    h.elements.get('workflow-next').click();
    expect(h.ui.switchTab).toHaveBeenCalledWith('kop');

    expect(h.workflow.preparePrint()).toBe(false);
    expect(h.validation.kopConfig).toHaveBeenCalled();
    expect(h.print.printDocument).not.toHaveBeenCalled();
    expect(h.ui.showModal).toHaveBeenCalled();
  });
});
