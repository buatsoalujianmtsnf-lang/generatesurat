import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const scripts = [...read('index.html').matchAll(/<script\b[^>]*src=["'](templates\/[^"']+\.js)["']/g)]
  .map(match => match[1]);

function makeElement(tagName, height = 0) {
  const attributes = {};
  const style = { setProperty(name, value) { this[name] = value; } };
  const element = {
    tagName, height, style, dataset: {}, attributes, children: [], parentNode: null,
    className: '', textContent: '', _html: '',
    get offsetHeight() { return this.height || 600; },
    get clientHeight() { return this.height || 600; },
    get scrollHeight() {
      return this.children.reduce((sum, child) => sum + child.height, 0);
    },
    get lastElementChild() { return this.children.at(-1) || null; },
    getBoundingClientRect() {
      const siblings = this.parentNode?.children || [];
      const index = siblings.indexOf(this);
      const previous = index >= 0
        ? siblings.slice(0, index).reduce((total, item) => total + item.height, 0)
        : 0;
      return { top: previous, bottom: previous + this.offsetHeight, height: this.offsetHeight };
    },
    getAttribute(name) { return attributes[name] || null; },
    setAttribute(name, value) { attributes[name] = String(value); },
    matches(selector) { return selector === '.doc-table-wrap' ? false : false; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      child.parentNode = null;
      return child;
    },
    remove() { this.parentNode?.removeChild(this); },
  };
  const classes = new Set();
  element.classList = {
    add(...names) { names.forEach(name => classes.add(name)); },
    remove(...names) { names.forEach(name => classes.delete(name)); },
    contains(name) { return classes.has(name); },
    toggle(name, force) {
      if (force === undefined ? !classes.has(name) : force) classes.add(name);
      else classes.delete(name);
    },
  };
  Object.defineProperty(element, 'innerHTML', {
    get() { return element._html; },
    set(html) {
      element._html = String(html);
      element.children.length = 0;
      if (tagName === 'preview' && html) {
        const source = makeElement('source', 600);
        source.children = element._fixtureHeights.map(height => makeElement('block', height));
        for (const child of source.children) child.parentNode = source;
        source.getAttribute = name => name === 'style' ? 'padding:20mm;' : null;
        element._source = source;
      } else if (tagName === 'preview') {
        element._source = null;
      }
    },
  });
  return element;
}

function createPreviewHarness(heights = [350, 350, 350], withTableConfig = false) {
  const preview = makeElement('preview');
  preview._fixtureHeights = heights;
  preview.querySelector = selector => {
    if (selector === ':scope > .doc-content') return preview._source;
    if (selector === ':scope > .surat-page') return preview.children[0] || null;
    return null;
  };
  preview.querySelectorAll = selector => {
    if (selector === ':scope > .surat-page[data-page-count]') return preview.children;
    return [];
  };
  const wrapper = makeElement('wrapper');
  const pageInfo = makeElement('info');
  const zoomInfo = makeElement('zoom');
  const elements = {
    'surat-preview': preview,
    'preview-canvas-wrapper': wrapper,
    'preview-page-info': pageInfo,
    'zoom-level-text': zoomInfo,
  };
  const document = {
    getElementById: id => elements[id] || null,
    createElement: tag => makeElement(tag, tag === 'section' ? 600 : 600),
    fonts: { ready: Promise.resolve() },
  };
  const state = {
    currentId: null, currentData: null, tables: {}, listeners: {},
    on: vi.fn((event, callback) => {
      (state.listeners[event] ||= []).push(callback);
    }),
    getTableConfig: templateId => state.tables[templateId] || {},
    initTableConfig: (templateId, config) => { state.tables[templateId] = config; },
    setTableConfig: (templateId, tableId, config) => {
      const templateTables = (state.tables[templateId] ||= {});
      const previous = templateTables[tableId] || {};
      // Production State.setTableConfig uses Utils.deepMerge instead of replace.
      templateTables[tableId] = {
        ...previous, ...config,
        columnWidths: {
          byKey: {
            ...(previous.columnWidths?.byKey || {}),
            ...(config.columnWidths?.byKey || {}),
          },
        },
        header: { columns: { ...(previous.header?.columns || {}), ...(config.header?.columns || {}) } },
        body: { columns: { ...(previous.body?.columns || {}), ...(config.body?.columns || {}) } },
      };
      (state.listeners['table:change'] || []).forEach(callback => callback({ templateId, tableId }));
    },
    getUi: () => ({ previewZoom: 1 }),
    getActiveTemplate: () => state.currentId,
    getFormData: () => state.currentData,
    getKop: () => ({}),
    getSettings: () => ({
      orientation: 'portrait',
      preview: { showMarginGuide: false, showPrintableArea: false },
      pageNumber: { enabled: true },
    }),
    getMarginMm: () => ({ top: 20, bottom: 20, left: 20, right: 20 }),
    getPaperDimensions: () => ({ widthMm: 210, heightMm: 297 }),
    getTypography: () => ({
      fontFamily: 'Times New Roman', fontSize: 12, lineHeight: 1.2,
      tableSize: 8, headingSize: 12,
    }),
    setZoom: vi.fn(), setSettings: vi.fn(),
  };
  const context = {
    console: { warn: vi.fn(), info: vi.fn() },
    document, State: state, Promise, Set, setTimeout, clearTimeout,
    requestAnimationFrame: callback => Promise.resolve().then(() => callback()),
    getComputedStyle: () => ({ paddingBottom: '0' }),
    KopEditor: { renderKopHtml: () => '<div class="doc-kop">KOP</div>' },
    TableRenderer: {
      render: () => '<div class="doc-table-wrap"><table></table></div>',
      renderDpuTable: () => '<div class="doc-table-wrap"><table></table></div>',
    },
  };
  runInNewContext(read('js/utils.js'), context);
  for (const path of scripts) runInNewContext(read(path), context, { filename: path });
  runInNewContext(read('js/template-registry.js'), context);
  if (withTableConfig) {
    runInNewContext(read('js/table-config.js'), context);
    runInNewContext(read('js/table-config-ui.js'), context);
  }
  runInNewContext(read('js/preview-renderer.js'), context);
  const registry = runInNewContext('TemplateRegistry', context);
  const renderer = runInNewContext('PreviewRenderer', context);
  registry.init();
  renderer.init();
  return { renderer, registry, state, preview, wrapper, pageInfo, context };
}

describe('GS-005: pagination integration across all runtime templates', () => {
  it('covers the ten real templates loaded by index.html', () => {
    expect(scripts).toHaveLength(10);
    expect(scripts).toContain('templates/rekap-nilai.js');
    expect(scripts).toContain('templates/surat-izin.js');
  });

  for (const path of scripts) {
    const id = path.slice('templates/'.length, -'.js'.length);
    it('renders ' + id + ' through the physical-page paginator with overflow and numbering', async () => {
      const h = createPreviewHarness();
      const template = h.registry.get(id);
      expect(template).toBeTruthy();
      h.state.currentId = id;
      h.state.currentData = template.createDefaultData();
      h.renderer.render(template, h.state.currentData, {});
      expect(h.preview.innerHTML).toContain('doc-content');
      expect(h.preview.style.minHeight).toBe('0');
      await h.renderer.waitForReady(30);
      expect(h.preview.classList.contains('surat-preview--document')).toBe(true);
      expect(h.preview.dataset.pageCount).toBe('3');
      expect(h.preview.children).toHaveLength(3);
      expect(h.preview.children.map(page => page.dataset.pageNumber)).toEqual(['1', '2', '3']);
      expect(h.preview.children.every(page => page.dataset.pageCount === '3')).toBe(true);
      expect(h.pageInfo.textContent).toBe('3 halaman');
      expect(h.preview.children.every(page => page.style.height.endsWith('px'))).toBe(true);
    });
  }

  it('renders surat izin without KOP or KOP dividers while retaining the letter body', async () => {
    const h = createPreviewHarness([120]);
    const template = h.registry.get('surat-izin');
    h.state.currentId = template.TEMPLATE_ID;
    h.state.currentData = template.createDefaultData();
    h.renderer.render(template, h.state.currentData, {});
    expect(h.preview.innerHTML).toContain('SURAT PERMOHONAN IZIN TIDAK MASUK SEKOLAH');
    expect(h.preview.innerHTML).toContain('Orang Tua/Wali Murid');
    expect(h.preview.innerHTML).not.toContain('class="doc-kop"');
    expect(h.preview.innerHTML).not.toContain('doc-kop-divider');
    await h.renderer.waitForReady(30);
    expect(h.preview.dataset.pageCount).toBe('1');
  });

  it('shows Indonesian date and numeric duration with words in Surat Izin', () => {
    const h = createPreviewHarness([120]);
    const template = h.registry.get('surat-izin');
    const data = template.createDefaultData();
    data.izin.hariTanggalIzin = '2026-11-09';
    data.izin.durasiIzin = 3;
    h.renderer.render(template, data, {});
    expect(h.preview.innerHTML).toContain('Senin, 09 November 2026');
    expect(h.preview.innerHTML).toContain('3 (tiga) Hari');
    expect(h.preview.innerHTML).not.toContain('>2026-11-09<');
  });

  it('keeps the Nama Orang Tua/Wali label on one line in Surat Izin', () => {
    const h = createPreviewHarness([120]);
    const template = h.registry.get('surat-izin');
    h.state.currentId = template.TEMPLATE_ID;
    h.state.currentData = template.createDefaultData();
    h.renderer.render(template, h.state.currentData, {});
    expect(h.preview.innerHTML).toMatch(
      /<td[^>]*white-space:nowrap;[^>]*>Nama Orang Tua\/Wali<\/td>/
    );
  });

  it('renders the full selected reason text, including custom other reasons, without KOP', () => {
    const h = createPreviewHarness([120]);
    const tpl = h.registry.get('surat-izin');
    const data = tpl.createDefaultData();
    data.izin.alasanIzin = 'sakit';
    h.renderer.render(tpl, data, {});
    expect(h.preview.innerHTML).toContain('Sedang sakit dan membutuhkan waktu untuk beristirahat');
    expect(h.preview.innerHTML).not.toContain('class="doc-kop"');

    data.izin.alasanIzin = 'lainnya';
    data.izin.alasanIzinLainnya = 'menghadiri urusan mendesak';
    h.renderer.render(tpl, data, {});
    expect(h.preview.innerHTML).toContain('Memiliki keperluan penting, yaitu menghadiri urusan mendesak.');
    data.izin.alasanIzinLainnya = '<script>alert(1)</script>';
    h.renderer.render(tpl, data, {});
    expect(h.preview.innerHTML).not.toContain('<script>alert(1)</script>');
  });

  it('places only validated PNG signatures above the parent name in preview and PDF markup', () => {
    const h = createPreviewHarness([120]);
    const tpl = h.registry.get('surat-izin');
    const data = tpl.createDefaultData();
    data.murid.namaOrangTuaWali = 'Orang Tua';
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    data.pengirim.tandaTanganDataUrl = png;
    h.renderer.render(tpl, data, {});
    const image = h.preview.innerHTML.indexOf('src="' + png + '"');
    const name = h.preview.innerHTML.lastIndexOf('>Orang Tua</p>');
    expect(image).toBeGreaterThan(-1);
    expect(name).toBeGreaterThan(image);
    expect(h.preview.innerHTML).toContain('object-fit:contain');

    data.pengirim.tandaTanganDataUrl = 'data:image/svg+xml,<svg onload="alert(1)"/>';
    h.renderer.render(tpl, data, {});
    expect(h.preview.innerHTML).not.toContain('<svg onload=');
    expect(h.preview.innerHTML).not.toContain('src="data:image/svg+xml');
    data.pengirim.tandaTanganDataUrl = '';
    h.renderer.render(tpl, data, {});
    expect(h.preview.innerHTML).not.toContain('alt="Tanda tangan Orang Tua/Wali"');
  });

  it('keeps short content on one physical page without introducing a blank page', async () => {
    const h = createPreviewHarness([120]);
    const template = h.registry.get('surat-izin');
    h.state.currentId = template.TEMPLATE_ID;
    h.state.currentData = template.createDefaultData();
    h.renderer.render(template, h.state.currentData, {});
    await h.renderer.waitForReady(30);
    expect(h.preview.dataset.pageCount).toBe('1');
    expect(h.preview.children).toHaveLength(1);
    expect(h.pageInfo.textContent).toBe('1 halaman');
  });
});



describe('IJOP Surat Permohonan Lembaga: form kosong dan tata letak', () => {
  const open = () => {
    const h = createPreviewHarness([120]);
    const template = h.registry.get('ijop-permohonan');
    const data = template.createDefaultData();
    h.state.currentId = template.TEMPLATE_ID;
    h.state.currentData = data;
    return { h, template, data, render: () => {
      h.renderer.render(template, data, {});
      return h.preview.innerHTML;
    } };
  };

  it('menyelaraskan baris Nomor dengan nama wilayah/tanggal serta Perihal satu tabel', () => {
    const { data, render } = open();
    data.surat.namaKabupatenKota = 'Musi Rawas';
    data.surat.tanggal = '2026-11-09';
    const html = render();
    const table = html.match(/<table class="ijop-permohonan__identitas"[\s\S]*?<\/table>/)?.[0];
    expect(table).toBeTruthy();
    expect(table).toMatch(/<tr>[\s\S]*?>Nomor<\/td>[\s\S]*?class="ijop-permohonan__tanggal"[\s\S]*?Musi Rawas, 9 November 2026[\s\S]*?<\/tr>/);
    expect(table).toContain('text-align:right;vertical-align:top;white-space:nowrap;');
    expect(table).toMatch(/>Perihal<\/td>[\s\S]*?<td colspan="2"[^>]*><strong>Permohonan Perpanjangan Izin Operasional Lembaga Pendidikan<\/strong><\/td>/);
    expect(html).not.toContain('style="width:55%;"');
    expect(html).toContain('<td style="white-space:nowrap;">Pengesahan Akte Notaris</td>');
  });

  it.each([
    ['Kabupaten', 'Musi Rawas', 'Kabupaten Musi Rawas'],
    ['Kota', 'Lubuklinggau', 'Kota Lubuklinggau'],
    ['Kabupaten', 'Kabupaten Musi Rawas', 'Kabupaten Musi Rawas'],
    ['Kota', 'Kota Palembang', 'Kota Palembang'],
  ])('membentuk alamat Kankemenag %s tanpa pengulangan awalan', (jenis, nama, lengkap) => {
    const { data, render } = open();
    data.surat.bentukPemerintahan = jenis;
    data.surat.namaKabupatenKota = nama;
    const html = render();
    expect(html).toContain('Yth. Kepala Kantor Kementerian Agama ' + lengkap);
    expect(html).not.toMatch(/(?:Kota Kota|Kabupaten Kabupaten)/);
  });

  it.each([
    ['RA', 'Nama RA', 'pendirian RA', 'Kepala RA'],
    ['Madrasah', 'Nama Madrasah', 'pendirian Madrasah', 'Kepala Madrasah'],
  ])('mengubah label dan jabatan sesuai bentuk satuan %s', (jenis, nama, pendirian, jabatan) => {
    const { data, render } = open();
    data.lembaga.bentukSatuanPendidikan = jenis;
    const html = render();
    expect(html).toContain('>' + nama + '</td>');
    expect(html).toContain('operasional/' + pendirian);
    expect(html).toContain('>' + jabatan + '</p>');
    expect(html).not.toContain('Nama RA/Madrasah');
    expect(html).not.toContain('pendirian RA/Madrasah');
  });

  it('menjorokkan lokasi instansi dan melindungi input berbahaya', () => {
    const { data, render } = open();
    data.surat.namaLokasiInstansi = 'Tugu Mulyo <img src=x onerror=alert(1)>';
    const html = render();
    expect(html).toContain('margin:0;padding-left:24pt;');
    expect(html).toContain('Tugu Mulyo &lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('nilai default seluruh input kosong, placeholder tampilan titik-titik, bukan data contoh', () => {
    const { data, template, render } = open();
    for (const section of Object.values(data)) {
      for (const value of Object.values(section)) {
        expect(value).toBe('');
      }
    }
    expect(render()).not.toContain('MTs Nurul Falah');
    expect(render()).not.toContain('Kabupaten Musi Rawas');
    expect(render()).not.toContain('Muara Beliti');
    expect(render()).toContain('……………………');
    expect(render()).toContain('Kepala RA/Madrasah');
    const selectedOptions = template.formSections.flatMap(section => section.fields)
      .filter(field => field.type === 'select');
    expect(selectedOptions.every(field => field.options[0].value === '')).toBe(true);
    expect(selectedOptions.every(field => field.options[0].label.includes('…'))).toBe(true);
  });

  it('draf lama tetap muncul tanpa mengganti nilai yang sudah diinput', () => {
    const { data, render } = open();
    data.surat.namaKabupatenKota = 'Musi Rawas';
    data.surat.bentukPemerintahan = 'Kabupaten';
    data.surat.namaLokasiInstansi = 'Muara Beliti';
    data.lembaga.bentukSatuanPendidikan = 'Madrasah';
    data.lembaga.namaRaMadrasah = 'MTs Nurul Falah';
    data.kepala.namaKepala = 'Ahmad';
    const html = render();
    expect(html).toContain('Kementerian Agama Kabupaten Musi Rawas');
    expect(html).toContain('<strong>Muara Beliti</strong>');
    expect(html).toContain('Nama Madrasah');
    expect(html).toContain('>Ahmad</p>');
  });

  it('NIP Kepala tampil tepat di bawah nama dengan posisi huruf pertama sejajar', () => {
    const { data, template, render } = open();
    data.lembaga.bentukSatuanPendidikan = 'RA';
    data.kepala.namaKepala = 'Siti Aminah, S.Pd.';
    data.kepala.nip = '198706152012032001';
    const html = render();
    const identity = html.match(/<div class="ijop-permohonan__ttd-identitas" style="([^"]+)">([\s\S]*?)<\/div>/);
    expect(identity).not.toBeNull();
    expect(identity[1]).toContain('display:inline-block;text-align:left;');
    expect(identity[2]).toContain('Siti Aminah, S.Pd.</p>');
    expect(identity[2]).toContain('NIP. 198706152012032001</p>');
    expect(html).toContain('>Kepala RA</p>');
    const fields = template.formSections.find(s => s.id === 'kepala').fields;
    expect(fields.find(field => field.key === 'kepala.nip')?.type).toBe('text');
  });

  it('nilai Alamat diawali sejajar dengan label serta titik dua, termasuk alamat panjang', () => {
    const { data, render } = open();
    data.lembaga.alamat = 'Jl. Mawar No. 8, Desa Contoh, Kecamatan Contoh, Provinsi Contoh';
    const html = render();
    expect(html).toMatch(/<tr><td style="vertical-align:top;">Alamat<\/td><td style="padding:0 6px;vertical-align:top;">:<\/td><td style="vertical-align:top;overflow-wrap:anywhere;white-space:normal;">Jl. Mawar/);
  });

  it('opsi dropdown wilayah dan satuan tetap tersedia dengan placeholder netral', () => {
    const { template } = open();
    const surat = template.formSections.find(section => section.id === 'surat').fields;
    const lembaga = template.formSections.find(section => section.id === 'lembaga').fields;
    expect(surat.find(field => field.key === 'surat.bentukPemerintahan').options.map(x => typeof x === 'string' ? x : x.value))
      .toEqual(['', 'Kabupaten', 'Kota']);
    expect(surat.find(field => field.key === 'surat.namaLokasiInstansi').type).toBe('text');
    expect(lembaga.find(field => field.key === 'lembaga.bentukSatuanPendidikan').options.map(x => typeof x === 'string' ? x : x.value))
      .toEqual(['', 'RA', 'Madrasah']);
  });
});

describe('Rekap Nilai: panel Pengaturan Tabel vs preview', () => {
  const open = () => {
    const h = createPreviewHarness([120], true);
    const template = h.registry.get('rekap-nilai');
    const manager = runInNewContext('TableConfigManager', h.context);
    const tableUi = runInNewContext('TableConfigUI', h.context);
    h.state.currentId = 'rekap-nilai';
    h.state.currentData = template.createDefaultData();
    manager.initForTemplate('rekap-nilai');

    const mount = {
      innerHTML: '', style: {},
      querySelector: () => null,
      querySelectorAll: () => [],
      removeAttribute: () => {},
      addEventListener: () => {},
    };
    tableUi.init(mount);
    tableUi.render('rekap-nilai');
    return { ...h, template, manager, tableUi, mount };
  };
  const htmlCardCount = (html, className) =>
    (html.match(new RegExp('class="' + className + '"', 'g')) || []).length;

  it('tidak menampilkan keterangan Format pada isi dokumen dalam kedua mode', () => {
    const h = open();
    for (const mode of ['format', 'lengkap']) {
      h.state.currentData.header.modePengisian = mode;
      h.renderer.render(h.template, h.state.currentData, {});
      const html = h.preview.innerHTML;
      expect(html).toContain('REKAPITULASI NILAI');
      expect(html).not.toContain('kolom nilai dikosongkan, siap cetak');
      expect(html).not.toContain('(Format —');
    }
  });

  it('sejajarkan awal label dan nilai Semester/Tahun Pelajaran pada blok kanan', () => {
    const h = open();
    h.state.currentData.header.semester = 'Genap';
    h.state.currentData.header.tahunPelajaran = '2026/2027';
    h.renderer.render(h.template, h.state.currentData, {});
    const html = h.preview.innerHTML;
    expect(html).toContain('rekap-nilai-meta__grid');
    expect(html).toContain('justify-content:space-between');
    expect(html).toContain('rekap-nilai-meta__right');
    expect(html).toContain('margin-left:auto;flex-shrink:0;');
    const table = html.match(/<table class="rekap-nilai-meta__right"[^>]*>([\s\S]*?)<\/table>/);
    expect(table).not.toBeNull();
    const cells = [...table[1].matchAll(/<td style="([^"]+)">([^<]*)<\/td>/g)]
      .map(([, style, content]) => ({ style, content }));
    expect(cells).toHaveLength(6);
    expect(cells.map(cell => cell.content)).toEqual([
      'Semester', ':', 'Genap', 'Tahun Pelajaran', ':', '2026/2027',
    ]);
    // Sama-sama align kiri dalam kolom tabel yang sama, bukan align kanan
    // yang menyebabkan huruf pertama Semester/Genap bergeser.
    for (const idx of [0, 2, 3, 5]) {
      expect(cells[idx].style).toContain('white-space:nowrap;');
      expect(cells[idx].style).toContain('text-align:left;');
      expect(cells[idx].style).not.toContain('text-align:right;');
    }
    for (const idx of [1, 4]) {
      expect(cells[idx].style).toContain('text-align:center;');
    }
  });

  it('aligns each NIP with the leftmost letter of the related signatory name', () => {
    const h = open();
    h.state.currentData.tandaTangan.namaKepalaSekolah = 'Kepala Madrasah';
    h.state.currentData.tandaTangan.nipKepalaSekolah = '123456';
    h.state.currentData.tandaTangan.namaGuru = 'Guru Mata Pelajaran';
    h.state.currentData.tandaTangan.nipGuru = '789012';
    h.renderer.render(h.template, h.state.currentData, {});
    const html = h.preview.innerHTML;
    const blocks = [...html.matchAll(/<div class="rekap-nilai-ttd__identity" style="([^"]*)">([\s\S]*?)<\/div>/g)];
    expect(blocks).toHaveLength(2);
    expect(blocks.every(([, style]) => style.includes('display:inline-block;text-align:left'))).toBe(true);
    expect(blocks[0][2]).toContain('>Kepala Madrasah</p>');
    expect(blocks[0][2]).toContain('NIP. 123456</p>');
    expect(blocks[1][2]).toContain('>Guru Mata Pelajaran</p>');
    expect(blocks[1][2]).toContain('NIP. 789012</p>');
  });

  it('shows 17 editable width/header/body columns for default layout, not 30', () => {
    const h = open();
    const layout = h.template.getTableLayout(h.state.currentData);
    expect(layout.columns.map(c => c.key)).toHaveLength(17);
    expect(htmlCardCount(h.mount.innerHTML, 'tbl-cfg__width-row')).toBe(17);
    expect(htmlCardCount(h.mount.innerHTML, 'tbl-cfg__col-card')).toBe(34);
    expect(h.mount.innerHTML).not.toContain('data-col-key="bab5_tp4"');
    expect(h.mount.innerHTML).toContain('data-col-key="sts"');
    expect(h.mount.innerHTML).toContain('data-col-idx="26"');
  });

  it('rebuilds the panel when BAB/TP/LM counts change without shifting stable settings', () => {
    const h = open();
    const previous = h.template.getTableLayout(h.state.currentData);
    const originalIndex = previous.columns.find(c => c.key === 'sts').configIndex;
    h.manager.updateColumn('rekap-nilai', 'rekap-nilai', 'body', originalIndex, { italic: true });
    h.state.currentData.header = { ...h.state.currentData.header, jumlahBab: 1, jumlahTpBab: 1, jumlahLm: 1 };
    for (const callback of h.state.listeners['form:change'] || []) {
      callback({ templateId: 'rekap-nilai' });
    }
    const reduced = h.template.getTableLayout(h.state.currentData);
    expect(reduced.columns).toHaveLength(8);
    expect(reduced.columns.find(c => c.key === 'sts').configIndex).toBe(originalIndex);
    expect(htmlCardCount(h.mount.innerHTML, 'tbl-cfg__width-row')).toBe(8);
    expect(htmlCardCount(h.mount.innerHTML, 'tbl-cfg__col-card')).toBe(16);
    expect(h.manager.getResolvedConfig('rekap-nilai', 'rekap-nilai').body.columns[originalIndex].italic).toBe(true);

    h.state.currentData.header = { ...h.state.currentData.header, jumlahBab: 5, jumlahTpBab: 4, jumlahLm: 4 };
    for (const callback of h.state.listeners['form:change'] || []) callback({ templateId: 'rekap-nilai' });
    expect(h.template.getTableLayout(h.state.currentData).columns).toHaveLength(30);
    expect(htmlCardCount(h.mount.innerHTML, 'tbl-cfg__width-row')).toBe(30);
  });

  it('applies custom widths and per-column text styling at their actual preview positions', () => {
    const h = open();
    const keys = h.template.tableColumns;
    const idx = key => keys.findIndex(column => column.key === key);
    h.state.currentData.murid[0].bab2_tp2 = '42';
    h.state.currentData.murid[0].sts = '88';
    h.manager.updateColumnWidth('rekap-nilai', 'rekap-nilai', 'sts', {
      mode: 'custom', value: 24, unit: 'mm',
    });
    h.manager.updateColumn('rekap-nilai', 'rekap-nilai', 'header', idx('sts'), {
      italic: true, horizontalAlign: 'right',
    });
    h.manager.updateColumn('rekap-nilai', 'rekap-nilai', 'body', idx('bab2_tp2'), {
      italic: true, horizontalAlign: 'right',
    });
    h.manager.updateColumn('rekap-nilai', 'rekap-nilai', 'body', idx('sts'), {
      bold: true,
    });
    const config = h.manager.getResolvedConfig('rekap-nilai', 'rekap-nilai');
    expect(config.columnWidths.byKey.sts).toMatchObject({ mode: 'custom', value: 24, unit: 'mm' });
    h.renderer.render(h.template, h.state.currentData, {});
    expect(h.context.console.warn).not.toHaveBeenCalled();
    const html = h.preview.innerHTML;
    const layout = h.template.getTableLayout(h.state.currentData);
    const widths = [...html.matchAll(/<col(?: style="([^"]*)")?>/g)];
    expect(widths).toHaveLength(layout.columns.length);
    expect(widths[layout.columns.findIndex(c => c.key === 'sts')][1]).toContain('width:24mm');
    expect(html).toMatch(/style="[^"]*text-align:right[^"]*font-style:italic[^"]*">Sumatif Tengah Semester/);
    expect(html).toMatch(/<td style="[^"]*text-align:right[^"]*font-style:italic[^"]*">42<\/td>/);
    expect(html).toMatch(/<td style="[^"]*font-weight:bold[^"]*">88<\/td>/);
  });

  it('honors header controls on No, Nama, STS, SAS, Praktik, Nilai Akhir and LM', () => {
    const h = open();
    const keys = h.template.tableColumns;
    const labels = [
      ['no', 'No.'],
      ['namaMurid', 'Nama Murid'],
      ['sts', 'Sumatif Tengah Semester'],
      ['sas', 'Sumatif Akhir Semester'],
      ['praktik', 'Praktik'],
      ['nilaiAkhir', 'Nilai Akhir'],
      ['lm1', 'LM1'],
    ];
    for (const [key] of labels) {
      const index = keys.findIndex(col => col.key === key);
      h.manager.updateColumn('rekap-nilai', 'rekap-nilai', 'header', index, {
        horizontalAlign: 'right', italic: true, bold: false,
      });
    }
    h.renderer.render(h.template, h.state.currentData, {});
    const html = h.preview.innerHTML;
    for (const [, label] of labels) {
      const style = [...html.matchAll(/<th\b[^>]*style="([^"]*)"[^>]*>([^<]*)<\/th>/g)]
        .find(match => match[2] === label)?.[1];
      expect(style, 'Missing header: ' + label).toBeTruthy();
      expect(style).toContain('text-align:right');
      expect(style).toContain('font-style:italic');
      expect(style).toContain('font-weight:normal');
    }
  });

  it('applies bulk styling only to currently visible columns and retains hidden custom widths', () => {
    const h = open();
    const keys = h.template.tableColumns;
    const keyIndex = key => keys.findIndex(col => col.key === key);
    h.manager.updateColumnWidth('rekap-nilai', 'rekap-nilai', 'bab5_tp4', {
      mode: 'custom', value: 13, unit: 'mm',
    });
    h.manager.applyToAllColumns('rekap-nilai', 'rekap-nilai', 'header', { italic: true });
    const config = h.manager.getResolvedConfig('rekap-nilai', 'rekap-nilai');
    expect(config.header.columns[keyIndex('sts')].italic).toBe(true);
    expect(config.header.columns[keyIndex('bab5_tp4')].italic).toBe(false);
    h.manager.setAllColumnWidthMode('rekap-nilai', 'rekap-nilai', 'auto');
    expect(h.manager.getResolvedConfig('rekap-nilai', 'rekap-nilai').columnWidths.byKey.bab5_tp4.value).toBe(13);
  });
});
