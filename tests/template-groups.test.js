import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const scripts = [...read('index.html').matchAll(/<script\b[^>]*src="(templates\/[^"]+\.js)"/g)].map(match => match[1]);

function loadRegistry() {
  const ctx = { console: { info: vi.fn(), warn: vi.fn() } };
  runInNewContext(read('js/utils.js'), ctx);
  for (const path of scripts) runInNewContext(read(path), ctx);
  runInNewContext(read('js/template-registry.js'), ctx);
  const registry = runInNewContext('TemplateRegistry', ctx);
  registry.init();
  return { registry, ctx };
}

function makeElement(tagName) {
  const handlers = {};
  const attributes = {};
  const element = {
    tagName, className: '', innerHTML: '', dataset: {}, children: [],
    open: false,
    setAttribute: (name, value) => { attributes[name] = value; },
    getAttribute: name => attributes[name],
    addEventListener: (name, callback) => { handlers[name] = callback; },
    appendChild(child) { this.children.push(child); return child; },
    querySelectorAll(selector) {
      const descendants = [];
      const visit = node => {
        for (const child of node.children) {
          if ((selector === '.template-card' && child.className.split(/\s+/).includes('template-card'))
              || (selector === '.template-group' && child.className.split(/\s+/).includes('template-group'))) {
            descendants.push(child);
          }
          visit(child);
        }
      };
      visit(this);
      return descendants;
    },
    classList: {
      toggle(name, enable) {
        const classes = new Set(element.className.split(/\s+/).filter(Boolean));
        if (enable) classes.add(name);
        else classes.delete(name);
        element.className = [...classes].join(' ');
      },
    },
    click() { handlers.click?.({}); },
    keydown(key) { handlers.keydown?.({ key, preventDefault: vi.fn() }); },
    toggle() { handlers.toggle?.(); },
  };
  return element;
}

describe('Daftar template dikelompokkan menjadi accordion', () => {
  it('membagi 18 template menjadi 5 kategori dengan urutan yang diminta', () => {
    const { registry } = loadRegistry();
    const groups = registry.getGroupedTemplates();
    expect(groups.map(group => group.title)).toEqual([
      'Registrasi dan DPU',
      'IJOP (Izin Operasional)',
      'Pengolahan Nilai',
      'Administrasi Rapat',
      'Surat Menyurat Siswa',
    ]);
    expect(groups.map(group => group.templates.map(template => template.TEMPLATE_ID))).toEqual([
      ['dpu', 'mutasi-masuk', 'siswa-baru'],
      ['ijop-permohonan', 'ijop-sptjm-satpen', 'ijop-rekomendasi-pengawas',
        'ijop-rekomendasi-kankemenag', 'ijop-sptjm-kankemenag'],
      ['rekap-nilai'],
      ['notulensi-rapat'],
      ['surat-izin', 'surat-permohonan-pindah', 'surat-keterangan-pindah',
        'surat-pemberitahuan-kegiatan', 'surat-keterangan-siswa-aktif',
        'surat-panggilan-orang-tua', 'surat-perjanjian-siswa', 'berita-acara-pertemuan-ortu'],
    ]);
    expect(groups.reduce((total, group) => total + group.templates.length, 0)).toBe(18);
  });

  it('mempertahankan pilihan aktif, dukungan keyboard, dan buka grup yang aktif', () => {
    const { registry, ctx } = loadRegistry();
    ctx.document = { createElement: tag => makeElement(tag) };
    const container = makeElement('div');
    const onSelect = vi.fn();
    registry.renderTemplateList(container, 'surat-izin', onSelect);

    const groups = container.querySelectorAll('.template-group');
    expect(groups).toHaveLength(5);
    expect(groups.map(group => group.open)).toEqual([false, false, false, false, true]);
    expect(groups.map(group => group.querySelectorAll('.template-card').length)).toEqual([3, 5, 1, 1, 8]);
    const cards = container.querySelectorAll('.template-card');
    expect(cards).toHaveLength(18);
    const active = cards.find(card => card.dataset.templateId === 'surat-izin');
    expect(active.className).toContain('active');
    expect(active.getAttribute('aria-pressed')).toBe('true');
    active.keydown('Enter');
    expect(onSelect).toHaveBeenCalledWith('surat-izin');

    registry.updateActiveCard(container, 'dpu');
    expect(groups.map(group => group.open)).toEqual([true, false, false, false, false]);
    const dpu = cards.find(card => card.dataset.templateId === 'dpu');
    expect(dpu.getAttribute('aria-pressed')).toBe('true');
    expect(active.getAttribute('aria-pressed')).toBe('false');

    // Hanya satu kelompok boleh terbuka ketika pengguna membuka kelompok lain.
    groups[2].open = true;
    groups[2].toggle();
    expect(groups.map(group => group.open)).toEqual([false, false, true, false, false]);
  });

  it('membuka kelompok pertama secara bawaan dan menampung template baru', () => {
    const { registry, ctx } = loadRegistry();
    registry.register({
      TEMPLATE_ID: 'jenis-baru',
      meta: { name: 'Jenis Baru', description: 'Template baru', orientation: 'portrait' },
    });
    const groups = registry.getGroupedTemplates();
    expect(groups.at(-1).title).toBe('Template Lainnya');
    expect(groups.at(-1).templates[0].TEMPLATE_ID).toBe('jenis-baru');

    const container = makeElement('div');
    ctx.document = { createElement: tag => makeElement(tag) };
    registry.renderTemplateList(container, null, vi.fn());
    expect(container.querySelectorAll('.template-group').map(group => group.open)).toEqual([
      true, false, false, false, false, false,
    ]);
  });
});
