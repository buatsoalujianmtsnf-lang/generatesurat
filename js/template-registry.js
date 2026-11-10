/* =============================================================
   template-registry.js — Registrasi dan manajemen template surat
   =============================================================
   Sistem ini bersifat extensible: untuk menambah template baru,
   cukup buat file definisi di /templates/ lalu daftarkan di sini
   dengan memanggil TemplateRegistry.register(templateObject).
*/

const TemplateRegistry = (() => {

  /* ── Penyimpanan template ── */
  const _templates = new Map();

  /* ── Register template ── */
  function register(templateDef) {
    if (!templateDef || !templateDef.TEMPLATE_ID) {
      console.warn('[TemplateRegistry] Template tidak valid:', templateDef);
      return;
    }
    if (_templates.has(templateDef.TEMPLATE_ID)) {
      console.warn(`[TemplateRegistry] Template "${templateDef.TEMPLATE_ID}" sudah terdaftar, menimpa.`);
    }
    _templates.set(templateDef.TEMPLATE_ID, templateDef);
    console.info(`[TemplateRegistry] Template "${templateDef.TEMPLATE_ID}" terdaftar.`);
  }

  /* ── Ambil template berdasarkan ID ── */
  function get(templateId) {
    const tpl = _templates.get(templateId);
    if (!tpl) {
      console.warn(`[TemplateRegistry] Template "${templateId}" tidak ditemukan.`);
      return null;
    }
    return tpl;
  }

  /* ── Ambil semua template ── */
  function getAll() {
    return Array.from(_templates.values());
  }

  /* ── Jumlah template terdaftar ── */
  function count() {
    return _templates.size;
  }

  /* ── Kelompok template (urutan mengikuti alur administrasi surat) ── */
  const TEMPLATE_GROUPS = [
    {
      id: 'registrasi-dpu', title: 'Registrasi dan DPU', icon: 'books',
      ids: ['dpu', 'mutasi-masuk', 'siswa-baru'],
    },
    {
      id: 'ijop', title: 'IJOP (Izin Operasional)', icon: 'file-description',
      ids: [
        'ijop-permohonan', 'ijop-sptjm-satpen', 'ijop-rekomendasi-pengawas',
        'ijop-rekomendasi-kankemenag', 'ijop-sptjm-kankemenag',
      ],
    },
    {
      id: 'pengolahan-nilai', title: 'Pengolahan Nilai', icon: 'chart-bar',
      ids: ['rekap-nilai'],
    },
    {
      id: 'surat-menyurat-siswa', title: 'Surat Menyurat Siswa', icon: 'mail',
      ids: ['surat-izin', 'surat-permohonan-pindah', 'surat-keterangan-pindah'],
    },
  ];

  function getGroupedTemplates() {
    const registered = getAll();
    const included = new Set();
    const groups = TEMPLATE_GROUPS.map(group => {
      const templates = group.ids.map(id => _templates.get(id)).filter(Boolean);
      templates.forEach(template => included.add(template.TEMPLATE_ID));
      return { id: group.id, title: group.title, icon: group.icon, templates };
    }).filter(group => group.templates.length > 0);

    // Template baru tetap muncul meski belum dimasukkan ke kelompok baku.
    const uncategorized = registered.filter(template => !included.has(template.TEMPLATE_ID));
    if (uncategorized.length) {
      groups.push({
        id: 'template-lainnya', title: 'Template Lainnya', icon: 'file-text',
        templates: uncategorized,
      });
    }
    return groups;
  }

  /* ── Render daftar template sebagai accordion kelompok ── */
  function renderTemplateList(containerEl, activeTemplateId, onSelect) {
    if (!containerEl) return;

    containerEl.innerHTML = '';
    const groups = getGroupedTemplates();

    if (!groups.length) {
      containerEl.innerHTML = `
        <div class="form-empty-state card">
          <p>Tidak ada template tersedia.</p>
        </div>`;
      return;
    }

    groups.forEach((group, groupIndex) => {
      const hasActive = group.templates.some(tpl => tpl.TEMPLATE_ID === activeTemplateId);
      const details = document.createElement('details');
      details.className = `template-group collapse collapse-arrow${hasActive ? ' has-active' : ''}`;
      details.dataset.groupId = group.id;
      details.open = hasActive || (!activeTemplateId && groupIndex === 0);

      const summary = document.createElement('summary');
      summary.className = 'template-group__heading collapse-title';
      summary.innerHTML = `
        <span class="template-group__icon" aria-hidden="true">${typeof AppIcons !== "undefined" ? AppIcons.svg(group.icon) : Utils.escapeHtml(group.icon)}</span>
        <span class="template-group__title">${Utils.escapeHtml(group.title)}</span>
        <span class="template-group__count" aria-label="${group.templates.length} template">${group.templates.length}</span>
        <span class="template-group__chevron" aria-hidden="true">${typeof AppIcons !== "undefined" ? AppIcons.svg("chevron-down") : "⌄"}</span>`;
      details.appendChild(summary);

      const items = document.createElement('div');
      items.className = 'template-group__items collapse-content';
      group.templates.forEach(tpl => {
        const isActive = tpl.TEMPLATE_ID === activeTemplateId;
        const card = document.createElement('div');
        card.className = `template-card card${isActive ? ' active' : ''}`;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        card.dataset.templateId = tpl.TEMPLATE_ID;

        const orientLabel = tpl.meta.orientation === 'landscape' ? 'A4 Landscape' : 'A4 Portrait';
        card.innerHTML = `
          <div class="template-card__icon">${typeof AppIcons !== 'undefined' ? AppIcons.svg(tpl.meta.icon || 'file-text') : Utils.escapeHtml(tpl.meta.icon || '📄')}</div>
          <div class="template-card__name">${Utils.escapeHtml(tpl.meta.name)}</div>
          <div class="template-card__desc">${Utils.escapeHtml(tpl.meta.description)}</div>
          <span class="template-card__badge badge badge-outline">${orientLabel}</span>
        `;

        const choose = () => {
          if (typeof onSelect === 'function') onSelect(tpl.TEMPLATE_ID);
        };
        card.addEventListener('click', choose);
        card.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            choose();
          }
        });
        items.appendChild(card);
      });

      details.appendChild(items);
      details.addEventListener('toggle', () => {
        if (!details.open) return;
        containerEl.querySelectorAll('.template-group').forEach(other => {
          if (other !== details) other.open = false;
        });
      });
      containerEl.appendChild(details);
    });
  }

  /* ── Buka satu kelompok dari URL /kategori/:slug ── */
  function openGroup(containerEl, groupId) {
    if (!containerEl || !groupId) return false;
    let found = false;
    containerEl.querySelectorAll('.template-group').forEach(group => {
      const match = group.dataset.groupId === groupId;
      group.open = match;
      if (match) found = true;
    });
    return found;
  }

  /* ── Update penanda kartu aktif dan buka kelompoknya saat dipilih/restore ── */
  function updateActiveCard(containerEl, activeTemplateId) {
    if (!containerEl) return;
    containerEl.querySelectorAll('.template-card').forEach(card => {
      const isActive = card.dataset.templateId === activeTemplateId;
      card.classList.toggle('active', isActive);
      card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    containerEl.querySelectorAll('.template-group').forEach(group => {
      const hasActive = Array.from(group.querySelectorAll('.template-card')).some(
        card => card.dataset.templateId === activeTemplateId
      );
      group.classList.toggle('has-active', hasActive);
      if (hasActive) group.open = true;
      else if (activeTemplateId) group.open = false;
    });
  }

  /* ── Cek apakah template memiliki tabel ── */
  function templateHasTables(templateId) {
    const tpl = _templates.get(templateId);
    if (!tpl) return false;
    // Template dianggap punya tabel jika ada tableColumns atau tables array
    if (Array.isArray(tpl.tableColumns) && tpl.tableColumns.length > 0) return true;
    if (Array.isArray(tpl.tables) && tpl.tables.length > 0) return true;
    return false;
  }

  /**
   * Kembalikan definisi semua tabel yang ada di template.
   * Mendukung dua format:
   *   1. Legacy: template.tableColumns (single table)
   *   2. Multi-table: template.tables = [{ id, label, columns }]
   *
   * Selalu return array: [{ id, label, columns }]
   */
  function getTableDefinitions(templateId) {
    const tpl = _templates.get(templateId);
    if (!tpl) return [];

    // Format baru: multi-table
    if (Array.isArray(tpl.tables) && tpl.tables.length > 0) {
      return tpl.tables.map(t => ({
        id:      t.id      || 'table-0',
        label:   t.label   || 'Tabel',
        columns: Array.isArray(t.columns) ? t.columns : [],
        tableDefaultConfig: t.tableDefaultConfig || null,
      }));
    }

    // Format legacy: single tableColumns → dibungkus jadi satu tabel
    if (Array.isArray(tpl.tableColumns) && tpl.tableColumns.length > 0) {
      // Gunakan template ID sebagai table ID agar stabil
      return [{
        id:      templateId,
        label:   tpl.meta?.name || 'Tabel Utama',
        columns: tpl.tableColumns,
        tableDefaultConfig: tpl.tableDefaultConfig || null,
      }];
    }

    return [];
  }

  /* ── Inisialisasi: daftarkan semua template yang sudah di-load ── */
  function init() {
    // Template didefinisikan di file terpisah dan sudah di-load sebelum registry
    // Urutkan sesuai urutan yang diinginkan di UI

    if (typeof TemplateDPU !== 'undefined') {
      register(TemplateDPU);
    }
    if (typeof TemplateMutasiMasuk !== 'undefined') {
      register(TemplateMutasiMasuk);
    }
    if (typeof TemplateSiswaBaru !== 'undefined') {
      register(TemplateSiswaBaru);
    }
    // ── Template IJOP (Izin Operasional) ──
    if (typeof TemplateIjopPermohonan !== 'undefined') {
      register(TemplateIjopPermohonan);
    }
    if (typeof TemplateIjopSptjmSatpen !== 'undefined') {
      register(TemplateIjopSptjmSatpen);
    }
    if (typeof TemplateIjopRekomendasiPengawas !== 'undefined') {
      register(TemplateIjopRekomendasiPengawas);
    }
    if (typeof TemplateIjopRekomendasiKankemenag !== 'undefined') {
      register(TemplateIjopRekomendasiKankemenag);
    }
    if (typeof TemplateIjopSptjmKankemenag !== 'undefined') {
      register(TemplateIjopSptjmKankemenag);
    }
    // ── Template Nilai ──
    if (typeof TemplateRekapNilai !== 'undefined') {
      register(TemplateRekapNilai);
    }
    // ── Template Izin ──
    if (typeof TemplateSuratIzin !== 'undefined') {
      register(TemplateSuratIzin);
    }
    if (typeof TemplateSuratPermohonanPindah !== 'undefined') {
      register(TemplateSuratPermohonanPindah);
    }
    if (typeof TemplateSuratKeteranganPindah !== 'undefined') {
      register(TemplateSuratKeteranganPindah);
    }

    /*
     * ── CARA MENAMBAH TEMPLATE BARU ──
     * 1. Buat file baru di /templates/nama-template.js
     * 2. Ekspor objek dengan struktur {TEMPLATE_ID, meta, createDefaultData, createItem, formSections, tableColumns}
     * 3. Load file tersebut di index.html sebelum <script src="js/template-registry.js">
     * 4. Tambahkan baris di bawah ini:
     *    if (typeof TemplateNamaBaru !== 'undefined') register(TemplateNamaBaru);
     * 5. Tambahkan renderer di preview-renderer.js (_buildDocumentHtml dispatch + fungsi _render*)
     */

    console.info(`[TemplateRegistry] ${count()} template terdaftar.`);
  }

  /* ── Public API ── */
  return {
    register,
    get,
    getAll,
    getGroupedTemplates,
    openGroup,
    count,
    renderTemplateList,
    updateActiveCard,
    templateHasTables,
    getTableDefinitions,
    init,
  };

})();
