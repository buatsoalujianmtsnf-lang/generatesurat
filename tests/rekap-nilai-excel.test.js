import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it, expect, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function harness(mode = 'lengkap') {
  let data = {
    header: { modePengisian: mode, jumlahBab: 2, jumlahTpBab: 2, jumlahLm: 1,
      namaGuru: 'Guru', namaKelas: 'VIII A' },
    murid: [{ id: 'murid-old', no: 1, namaMurid: 'Murid Lama', sts: 88 }],
  };
  let active = 'rekap-nilai';
  let modal = null;
  let confirm = null;
  const written = vi.fn();
  const excel = {
    utils: {
      book_new: () => ({ SheetNames: [], Sheets: {} }),
      aoa_to_sheet: aoa => ({ aoa }),
      book_append_sheet: (wb, sheet, name) => {
        wb.SheetNames.push(name);
        wb.Sheets[name] = sheet;
      },
      sheet_to_json: (sheet, opts) => opts?.header === 1 ? (sheet.aoa || []) : (sheet.rows || []),
      encode_cell: ({ r, c }) => String.fromCharCode(65 + c) + (r + 1),
    },
    writeFile: written,
    read: vi.fn(),
  };
  const ui = {
    showModal: vi.fn(value => { modal = value; }),
    hideModal: vi.fn(),
    toast: vi.fn(),
    confirm: vi.fn((title, message, callback) => { confirm = callback; }),
  };
  const state = {
    getFormData: vi.fn(() => data),
    getActiveTemplate: vi.fn(() => active),
    setFormData: vi.fn((id, patch) => {
      data = { ...data, ...patch, header: { ...data.header, ...(patch.header || {}) } };
    }),
  };
  const document = { querySelector: vi.fn(() => ({ value: 'format' })) };
  const ctx = {
    Utils: { generateId: () => 'murid-new', escapeHtml: x => String(x)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;') },
    State: state, UI: ui, document, window: { XLSX: excel }, XLSX: excel,
    console,
  };
  runInNewContext(read('templates/rekap-nilai.js'), ctx);
  ctx.TemplateRekapNilai = runInNewContext('TemplateRekapNilai', ctx);
  runInNewContext(read('js/excel-import.js'), ctx);
  return {
    api: runInNewContext('ExcelImport', ctx), excel, ui, state, written,
    getData: () => data, getModal: () => modal, getConfirm: () => confirm,
    setActive: v => { active = v; },
    updateHeader: patch => { data.header = { ...data.header, ...patch }; },
  };
}

function workbook(headers, rows, info = []) {
  return {
    Sheets: {
      'Data Murid': { rows: rows.map(values =>
        Object.fromEntries(headers.map((head, index) => [head, values[index] ?? '']))) },
      'Petunjuk': { aoa: info },
    },
  };
}

describe('Excel Rekap Nilai: mode dan kolom dinamis', () => {
  it('template Format Saja tepat No. dan Nama Murid', () => {
    const h = harness();
    expect(h.api.getRekapConfig('format').columns.map(col => col.header))
      .toEqual(['No.', 'Nama Murid']);
    h.api.downloadTemplate('rekap-nilai', 'format');
    expect(h.written).toHaveBeenCalledOnce();
    const [wb, filename] = h.written.mock.calls[0];
    expect(filename).toContain('Format_Saja.xlsx');
    expect(wb.Sheets['Data Murid'].aoa[0]).toEqual(['No.', 'Nama Murid']);
    expect(wb.Sheets['Petunjuk'].aoa).toContainEqual(['Mode Pengisian', 'format']);
  });

  it('template Lengkap mengikuti jumlah BAB, TP dan LM dan memiliki panduan', () => {
    const h = harness('format');
    const cfg = h.api.getRekapConfig('lengkap');
    expect(cfg.columns.map(col => col.key)).toEqual([
      'no', 'namaMurid',
      'bab1_tp1', 'bab1_tp2', 'bab2_tp1', 'bab2_tp2',
      'lm1', 'sts', 'sas', 'praktik', 'nilaiAkhir',
    ]);
    h.api.downloadTemplate('rekap-nilai', 'lengkap');
    const [wb, filename] = h.written.mock.calls[0];
    expect(filename).toContain('Lengkap.xlsx');
    expect(wb.Sheets['Data Murid'].aoa[0]).toEqual(cfg.columns.map(col => col.header));
    expect(wb.Sheets['Petunjuk'].aoa).toContainEqual(['Jumlah BAB', 2]);
    expect(wb.Sheets['Petunjuk'].aoa).toContainEqual(['Jumlah TP per BAB', 2]);
    expect(wb.Sheets['Petunjuk'].aoa).toContainEqual(['Jumlah LM', 1]);
  });

  it('modal meminta mode dahulu dan tidak mengubah pilihan mode dokumen', () => {
    const h = harness('lengkap');
    h.api.showRekapDownloadModal();
    const modal = h.getModal();
    expect(modal.title).toContain('Pilih Mode');
    expect(modal.body).toContain('Format Saja');
    expect(modal.body).toContain('Lengkap');
    expect(h.written).not.toHaveBeenCalled();
    modal.footer[1].onClick();
    expect(h.written).toHaveBeenCalledOnce();
    expect(h.getData().header.modePengisian).toBe('lengkap');
    expect(h.ui.hideModal).toHaveBeenCalledOnce();
  });

  it('merinci jumlah BAB, TP per BAB, total TP aktif, LM dan jumlah kolom sesuai dokumen', () => {
    const h = harness('lengkap');
    h.api.showRekapDownloadModal();
    const content = h.getModal().body;
    expect(content).toContain('Konfigurasi aktif saat ini');
    expect(content).toMatch(/Jumlah BAB<\/span><strong>2<\/strong>/);
    expect(content).toMatch(/TP per BAB<\/span><strong>2<\/strong>/);
    expect(content).toMatch(/Total TP aktif<\/span><strong>4<\/strong>/);
    expect(content).toMatch(/Jumlah LM<\/span><strong>1<\/strong>/);
    expect(content).toContain('2 kolom identitas + 4 kolom TP + 1 kolom LM + 4 kolom nilai tetap');
    expect(content).toContain('11 kolom');
    expect(content).toContain('9 kolom nilai');
    expect(content).toContain('2 kolom');
    expect(content).toContain('Murid yang sudah terisi di editor:');
    expect(content).toContain('<strong>1</strong>');
    expect(content).toContain('VIII A');
    expect(content).toContain('file berformat');
    expect(content).toContain('0–100');
    expect(h.written).not.toHaveBeenCalled();
  });

  it('mengambil konfigurasi terbaru setiap modal dibuka, termasuk nilai maksimum dan escape teks', () => {
    const h = harness('format');
    h.api.showRekapDownloadModal();
    expect(h.getModal().body).toContain('11 kolom');
    h.updateHeader({
      jumlahBab: 5, jumlahTpBab: 4, jumlahLm: 4,
      mataPelajaran: '<img onerror=alert(1)>',
      tahunPelajaran: '2026/2027',
    });
    h.api.showRekapDownloadModal();
    const content = h.getModal().body;
    expect(content).toMatch(/Jumlah BAB<\/span><strong>5<\/strong>/);
    expect(content).toMatch(/TP per BAB<\/span><strong>4<\/strong>/);
    expect(content).toMatch(/Total TP aktif<\/span><strong>20<\/strong>/);
    expect(content).toMatch(/Jumlah LM<\/span><strong>4<\/strong>/);
    expect(content).toContain('30 kolom');
    expect(content).toContain('2026/2027');
    expect(content).not.toContain('<img onerror=');
    expect(h.state.setFormData).not.toHaveBeenCalled();
  });

  it('mengimpor format dengan metadata, menyimpan data lain dan menunggu konfirmasi', () => {
    const h = harness('lengkap');
    const wb = workbook(['No.', 'Nama Murid'], [[1, 'Ali'], [2, 'Budi']],
      [['Mode Pengisian', 'format']]);
    const result = h.api.parseRekapWorkbook(wb);
    expect(result.mode).toBe('format');
    expect(result.items.map(item => item.namaMurid)).toEqual(['Ali', 'Budi']);
    expect(result.items[0].sts).toBe('');
    h.api.importRekapWorkbook(wb);
    expect(h.state.setFormData).not.toHaveBeenCalled();
    expect(h.ui.confirm).toHaveBeenCalledOnce();
    expect(h.getData().murid[0].namaMurid).toBe('Murid Lama');
    const callback = h.getConfirm();
    // The FormRenderer is only invoked after the user confirms.
    const context = { FormRenderer: { render: vi.fn() } };
    expect(typeof callback).toBe('function');
  });

  it('membaca nilai 0 sampai 100 serta konfigurasi kolom dari Petunjuk', () => {
    const h = harness('format');
    const columns = h.api.getRekapConfig('lengkap').columns;
    const headers = columns.map(col => col.header);
    const row = [1, 'Siti', ...columns.slice(2).map((_, i) => i === 0 ? 0 : i === 1 ? 100 : '')];
    const wb = workbook(headers, [row], [
      ['Mode Pengisian', 'lengkap'],
      ['Jumlah BAB', 2],
      ['Jumlah TP per BAB', 2],
      ['Jumlah LM', 1],
    ]);
    const parsed = h.api.parseRekapWorkbook(wb);
    expect(parsed.items[0].bab1_tp1).toBe(0);
    expect(parsed.items[0].bab1_tp2).toBe(100);
    expect(parsed.items[0].bab2_tp1).toBe('');
    expect(parsed.header.modePengisian).toBe('lengkap');
  });

  it('menolak nilai invalid, nomor ganda, sheet salah dan kolom tidak sesuai', () => {
    const h = harness();
    const cols = h.api.getRekapConfig('lengkap').columns.map(col => col.header);
    const base = [1, 'Taufik', ...cols.slice(2).map(() => '')];
    const metadata = [['Mode Pengisian', 'lengkap'], ['Jumlah BAB', 2],
      ['Jumlah TP per BAB', 2], ['Jumlah LM', 1]];
    expect(() => h.api.parseRekapWorkbook(workbook(cols,
      [base.map((v, i) => i === 2 ? 101 : v)], metadata))).toThrow('0–100');
    expect(() => h.api.parseRekapWorkbook(workbook(
      ['No.', 'Nama Murid'], [[1, 'Ali'], [1, 'Budi']]
    ))).toThrow('unik');
    expect(() => h.api.parseRekapWorkbook({ Sheets: {} })).toThrow('Data Murid');
    expect(() => h.api.parseRekapWorkbook(workbook(
      ['No.', 'Nama Murid', 'STS'], [[1, 'Ali', 90]], [['Mode Pengisian', 'format']]
    ))).toThrow('Format Saja');
  });
});
