/* =============================================================
   form-renderer.js — Render form input dinamis per template
   ============================================================= */

const FormRenderer = (() => {

  let _containerEl = null;

  /* ── Inisialisasi ── */
  function init() {
    _containerEl = document.getElementById('form-container');
    if (!_containerEl) {
      console.warn('[FormRenderer] Container tidak ditemukan.');
      return;
    }

    // Delegasi event agar tombol empty-state tidak membutuhkan inline onclick.
    _containerEl.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target.closest('[data-action="select-template"]')
        : null;
      if (!target || !_containerEl.contains(target)) return;
      event.preventDefault();
      if (typeof window.App?.switchTab === 'function') {
        window.App.switchTab('template');
      }
    });

    // Buat mount point untuk TableConfigUI (accordion Pengaturan Tabel)
    // Mount point ini berada di luar #form-container agar tidak terhapus
    // saat FormRenderer.render() mengosongkan innerHTML #form-container.
    let mountEl = document.getElementById('table-config-mount');
    if (!mountEl) {
      mountEl = document.createElement('div');
      mountEl.id = 'table-config-mount';
      mountEl.setAttribute('hidden', '');
      mountEl.style.display = 'none';
      // Sisipkan tepat setelah #form-container di dalam tab-form
      const tabForm = document.getElementById('tab-form');
      if (tabForm) {
        tabForm.appendChild(mountEl);
      } else {
        // Fallback: sisipkan setelah form-container
        _containerEl.parentNode?.insertBefore(mountEl, _containerEl.nextSibling);
      }
    }

    // Init TableConfigUI dengan mount point
    if (typeof TableConfigUI !== 'undefined') {
      TableConfigUI.init(mountEl);
    }

    State.on('template:change', ({ templateId }) => {
      render(templateId);
    });

    State.on('state:restore', () => {
      const activeId = State.getActiveTemplate();
      if (activeId) render(activeId);
    });

    State.on('state:reset', () => {
      _showEmpty();
    });
  }

  /* ── Render form untuk template tertentu ── */
  function render(templateId) {
    if (!_containerEl) return;

    const tpl = TemplateRegistry.get(templateId);
    if (!tpl) {
      _showEmpty();
      return;
    }

    // Pastikan default form data sudah ada
    const existingData = State.getFormData(templateId);
    if (!existingData) {
      State.initFormData(templateId, tpl.createDefaultData());
    }

    // Pastikan modal penyuntingan sementara ditutup sebelum form dirender ulang.
    if (typeof SignaturePad !== 'undefined') SignaturePad.closeActive?.();
    _containerEl.innerHTML = '';

    let formData = State.getFormData(templateId);

    // Draft lama menyimpan Alasan Izin sebagai teks bebas. Pertahankan isinya.
    if (typeof tpl.normalizeLegacyAlasan === 'function') {
      const patch = tpl.normalizeLegacyAlasan(formData?.izin);
      if (patch) {
        State.setFormData(templateId, { izin: patch });
        formData = State.getFormData(templateId);
      }
    }

    // Normalisasi draf surat izin yang lama (tanggal/durasi teks bebas).
    if (typeof tpl.normalizeLegacyIzinFields === 'function') {
      const patch = tpl.normalizeLegacyIzinFields(formData?.izin);
      if (patch) {
        State.setFormData(templateId, { izin: patch });
        formData = State.getFormData(templateId);
      }
    }

    tpl.formSections.forEach(section => {
      const sectionEl = _buildSection(section, formData, templateId);
      _containerEl.appendChild(sectionEl);
    });
    _syncRekapNilaiMuridFields(templateId);

    // Init & render accordion Pengaturan Tabel
    // TableConfigManager.initForTemplate dipanggil oleh TableConfigUI.render
    // via state event, tapi panggil juga langsung di sini untuk keamanan
    if (typeof TableConfigManager !== 'undefined') {
      TableConfigManager.initForTemplate(templateId);
    }
    if (typeof TableConfigUI !== 'undefined') {
      TableConfigUI.render(templateId);
    }
  }

  /* ── Tampilkan empty state ── */
  function _showEmpty() {
    if (!_containerEl) return;
    if (typeof SignaturePad !== 'undefined') SignaturePad.closeActive?.();
    _containerEl.innerHTML = `
      <div class="form-empty-state card">
        <svg class="ti-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="assets/icons/tabler-sprite.svg#ti-file-text"></use></svg>
        <p>Pilih template surat terlebih dahulu.</p>
        <button class="btn btn--sm btn--secondary btn-sm btn-outline" type="button"
          data-action="select-template">
          Pilih Template
        </button>
      </div>`;

    // Sembunyikan accordion Pengaturan Tabel
    const mountEl = document.getElementById('table-config-mount');
    if (mountEl) {
      mountEl.setAttribute('hidden', '');
      mountEl.style.display = 'none';
      mountEl.innerHTML = '';
    }
  }

  /* ── Build satu section ── */
  function _buildSection(section, formData, templateId) {
    const wrap = document.createElement('div');
    wrap.className = 'form-section card';
    wrap.id = `section-${section.id}`;

    const isRepeatable = section.type === 'repeatable';

    wrap.innerHTML = `
      <div class="form-section__header collapse-title" role="button" tabindex="0"
        aria-expanded="true" data-section="${section.id}">
        <span class="form-section__title card-title">
          <span>${typeof AppIcons !== 'undefined' ? AppIcons.svg(section.icon || 'file-text') : Utils.escapeHtml(section.icon || '')} ${Utils.escapeHtml(section.title)}</span>
        </span>
        <svg class="ti-icon form-section__toggle" viewBox="0 0 24 24" aria-hidden="true"><use href="assets/icons/tabler-sprite.svg#ti-chevron-down"></use></svg>
      </div>
      <div class="form-section__body card-body" id="section-body-${section.id}"></div>`;

    const header  = wrap.querySelector('.form-section__header');
    const body    = wrap.querySelector('.form-section__body');
    const chevron = wrap.querySelector('.form-section__toggle');

    // Toggle collapse
    header.addEventListener('click', () => {
      const isOpen = !body.classList.contains('collapsed');
      body.classList.toggle('collapsed', isOpen);
      chevron.classList.toggle('collapsed', isOpen);
      header.setAttribute('aria-expanded', String(!isOpen));
    });
    header.addEventListener('keydown', (e) => {
      const ke = /** @type {KeyboardEvent} */ (e);
      if (ke.key === 'Enter' || ke.key === ' ') { ke.preventDefault(); /** @type {HTMLElement} */ (header).click(); }
    });

    if (isRepeatable) {
      _buildRepeatableSection(section, formData, templateId, body);
    } else {
      _buildFieldsGroup(section.fields, formData, templateId, body, null);
    }

    return wrap;
  }

  /* ── Build repeatable section (daftar siswa/peserta) ── */
  function _buildRepeatableSection(section, formData, templateId, bodyEl) {
    const dataKey = section.id; // 'peserta' | 'siswa'
    let items = Array.isArray(formData[dataKey]) ? formData[dataKey] : [];
    let normalized = false;

    items = items.map((item, index) => {
      if (!item || typeof item !== 'object') {
        normalized = true;
        return typeof section.itemFactory === 'function'
          ? section.itemFactory(index + 1)
          : {};
      }

      if (typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(item.id)) {
        normalized = true;
        return {
          ...item,
          id: Utils.generateId(section.id === 'peserta' ? 'peserta' : 'siswa'),
        };
      }

      return item;
    });

    if (!Array.isArray(formData[dataKey]) || normalized) {
      State.setFormData(templateId, { [dataKey]: items });
      formData = State.getFormData(templateId) || formData;
    }
    const listEl    = document.createElement('div');
    listEl.id       = `repeatable-list-${section.id}`;

    // Render semua item yang sudah ada
    items.forEach((item, idx) => {
      const entry = _buildRepeatableEntry(section, item, idx, templateId, listEl);
      listEl.appendChild(entry);
    });

    // Tombol tambah
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add-row-btn btn btn-outline';
    addBtn.innerHTML = `
      <svg class="ti-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="assets/icons/tabler-sprite.svg#ti-plus"></use></svg>
      Tambah ${Utils.escapeHtml(section.itemLabel || 'Item')}`;

    addBtn.addEventListener('click', () => {
      const current = State.getFormData(templateId);
      const currentItems = Array.isArray(current?.[dataKey]) ? current[dataKey] : [];
      const newItem = section.itemFactory(currentItems.length + 1);
      const updatedItems = [...currentItems, newItem];

      State.setFormData(templateId, { [dataKey]: updatedItems });

      const entry = _buildRepeatableEntry(
        section, newItem, currentItems.length, templateId, listEl
      );
      listEl.appendChild(entry);
      _syncRekapNilaiMuridFields(templateId);

      // Auto expand entry baru
      const body = entry.querySelector('.row-entry__body');
      const chev = entry.querySelector('.row-entry__chevron');
      if (body) { body.classList.add('is-open'); }
      if (chev) { chev.classList.add('is-open'); }

      // Scroll ke bawah
      setTimeout(() => entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    });

    // Toolbar import Excel ditempatkan sebelum daftar siswa/peserta.
    if (typeof ExcelImport !== 'undefined') {
      const excelToolbar = ExcelImport.buildToolbar(templateId, section.id);
      if (excelToolbar) bodyEl.appendChild(excelToolbar);
    }

    bodyEl.appendChild(listEl);
    bodyEl.appendChild(addBtn);
  }

  /* ── Build satu entry repeatable ── */
  function _buildRepeatableEntry(section, item, idx, templateId, listEl) {
    const entry = document.createElement('div');
    entry.className = 'row-entry card';
    entry.dataset.itemId = item.id;

    const labelText = _getItemLabel(section, item, idx);

    entry.innerHTML = `
      <div class="row-entry__header collapse-title" role="button" tabindex="0" aria-expanded="true">
        <span class="row-entry__num">${idx + 1}</span>
        <span class="row-entry__label">${Utils.escapeHtml(labelText)}</span>
        <div class="row-entry__actions">
          <button type="button" class="btn-icon entry-delete-btn btn btn-square btn-ghost btn-sm" title="Hapus" aria-label="Hapus">
            <svg class="ti-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="assets/icons/tabler-sprite.svg#ti-trash"></use></svg>
          </button>
        </div>
        <svg class="ti-icon row-entry__chevron" viewBox="0 0 24 24" aria-hidden="true"><use href="assets/icons/tabler-sprite.svg#ti-chevron-down"></use></svg>
      </div>
      <div class="row-entry__body"></div>`;

    const header    = entry.querySelector('.row-entry__header');
    const body      = entry.querySelector('.row-entry__body');
    const chevron   = entry.querySelector('.row-entry__chevron');
    const deleteBtn = entry.querySelector('.entry-delete-btn');

    // Toggle collapse (klik header, bukan tombol delete)
    const toggleEntry = () => {
      const isOpen = body.classList.contains('is-open');
      body.classList.toggle('is-open', !isOpen);
      chevron.classList.toggle('is-open', !isOpen);
      header.setAttribute('aria-expanded', String(!isOpen));
    };

    header.addEventListener('click', (e) => {
      if (deleteBtn.contains(/** @type {Node} */ (e.target))) return;
      toggleEntry();
    });

    header.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
      if (deleteBtn.contains(/** @type {Node} */ (e.target))) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleEntry();
      }
    });

    // Delete
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.confirm(
        `Hapus ${section.itemLabel || 'Item'} #${idx + 1}`,
        `Yakin ingin menghapus ${section.itemLabel || 'item'} ini?`,
        () => {
          const current = State.getFormData(templateId);
          const dataKey = section.id;
          const newItems = Array.isArray(current?.[dataKey])
            ? current[dataKey].filter(it => it.id !== item.id)
            : [];
          State.setFormData(templateId, { [dataKey]: newItems });
          entry.remove();
          // Renumber entries
          _renumberEntries(listEl);
        }
      );
    });

    // Render fields
    _buildFieldsGroup(section.fields, item, templateId, body, item.id, section.id);

    return entry;
  }

  /* ── Build grup fields ── */
  function _buildFieldsGroup(fields, formData, templateId, containerEl, itemId, sectionId) {
    fields.forEach(fieldDef => {
      // showIf condition
      if (fieldDef.showIf && !fieldDef.showIf(formData)) return;

      const group = _buildField(fieldDef, formData, templateId, itemId, sectionId);
      if (group) containerEl.appendChild(group);
    });
  }

  /* ── Build satu field ── */
  function _buildField(fieldDef, formData, templateId, itemId, sectionId) {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.dataset.fieldKey = fieldDef.key;

    const value = _getNestedValue(formData, fieldDef.key);
    // Repeatable fields need unique DOM IDs per student item. Duplicate IDs can
    // make label/autofill/DOM targeting point to another field instance.
    const fieldDomId = `field-${fieldDef.key.replace(/\./g, '-')}${itemId ? `-${itemId}` : ''}`;
    const labelHtml = `
      <label class="form-label" for="${fieldDomId}">
        ${Utils.escapeHtml(fieldDef.label)}
        ${fieldDef.required ? '<span class="required-mark" aria-label="wajib">*</span>' : '<span class="optional-mark">(opsional)</span>'}
      </label>`;

    switch (fieldDef.type) {
      case 'text':
        group.innerHTML = labelHtml + `
          <input type="text" class="form-input input"
            id="${fieldDomId}"
            value="${Utils.escapeHtml(String(value ?? ''))}"
            placeholder="${Utils.escapeHtml(fieldDef.placeholder || '')}"
            maxlength="${fieldDef.maxLength || 255}"
            ${fieldDef.required ? 'required' : ''}
            ${fieldDef.inputAlign ? `style="text-align:${Utils.escapeHtml(fieldDef.inputAlign)};"` : ''} />`;
        _bindInput(group.querySelector('input'), fieldDef, templateId, itemId, sectionId);
        break;

      case 'number':
        group.innerHTML = labelHtml + `
          <input type="number" class="form-input input"
            id="${fieldDomId}"
            value="${Utils.escapeHtml(String(value ?? ''))}"
            min="${fieldDef.min ?? 0}"
            max="${fieldDef.max ?? 9999}"
            step="${fieldDef.step ?? 'any'}"
            ${fieldDef.integer ? 'inputmode="numeric"' : ''}
            ${fieldDef.required ? 'required' : ''}
            ${fieldDef.inputAlign ? `style="text-align:${Utils.escapeHtml(fieldDef.inputAlign)};"` : ''} />`;
        _bindInput(group.querySelector('input'), fieldDef, templateId, itemId, sectionId);
        break;

      case 'date':
        group.innerHTML = labelHtml + `
          <input type="date" class="form-input input"
            id="${fieldDomId}"
            value="${Utils.escapeHtml(String(value ?? ''))}"
            ${fieldDef.required ? 'required' : ''} />`;
        _bindInput(group.querySelector('input'), fieldDef, templateId, itemId, sectionId);
        break;

      case 'select': {
        const opts = fieldDef.options.map(opt => {
          if (typeof opt === 'string') {
            return `<option value="${Utils.escapeHtml(opt)}" ${value === opt ? 'selected' : ''}>${Utils.escapeHtml(opt)}</option>`;
          }
          return `<option value="${Utils.escapeHtml(opt.value)}" ${value === opt.value ? 'selected' : ''}>${Utils.escapeHtml(opt.label)}</option>`;
        }).join('');
        group.innerHTML = labelHtml + `
          <select class="form-select select" id="${fieldDomId}"
            ${fieldDef.required ? 'required' : ''}
            ${fieldDef.inputAlign ? `style="text-align:${Utils.escapeHtml(fieldDef.inputAlign)};"` : ''}>${opts}</select>`;
        const select = group.querySelector('select');
        _bindInput(select, fieldDef, templateId, itemId, sectionId);
        if (fieldDef.hint || fieldDef.options.some(opt => opt && typeof opt === 'object' && opt.description)) {
          const helper = document.createElement('small');
          helper.className = 'form-helper';
          helper.setAttribute('aria-live', 'polite');
          const refreshHelper = () => {
            const selected = fieldDef.options.find(opt => opt && typeof opt === 'object' && opt.value === select.value);
            helper.textContent = selected?.description || fieldDef.hint || '';
          };
          select.addEventListener('change', refreshHelper);
          refreshHelper();
          group.appendChild(helper);
        }
        break;
      }

      case 'signature':
        if (typeof SignaturePad === 'undefined') {
          group.innerHTML = labelHtml + '<span class="form-helper">Editor tanda tangan belum tersedia.</span>';
          break;
        }
        SignaturePad.mount(group, {
          id: fieldDomId,
          label: fieldDef.label,
          hint: fieldDef.hint,
          value,
          onChange: imageData => _saveFieldValue(fieldDef, imageData, templateId, itemId, sectionId),
        });
        break;

      case 'textarea':
        group.innerHTML = labelHtml + `
          <textarea class="form-textarea textarea"
            id="${fieldDomId}"
            placeholder="${Utils.escapeHtml(fieldDef.placeholder || '')}"
            rows="${fieldDef.rows || 3}"
            ${fieldDef.required ? 'required' : ''}>${Utils.escapeHtml(String(value ?? ''))}</textarea>`;
        _bindInput(group.querySelector('textarea'), fieldDef, templateId, itemId, sectionId);
        break;

      case 'checkbox': {
        const checked = value === true || value === 'true';
        group.innerHTML = `
          <label class="form-label">${Utils.escapeHtml(fieldDef.label)}</label>
          <label class="form-check checkbox">
            <input type="checkbox" id="${fieldDomId}"
              ${checked ? 'checked' : ''} />
            <span>${checked ? (fieldDef.labelTrue || 'Ya') : (fieldDef.labelFalse || 'Tidak')}</span>
          </label>`;
        const cbInput = /** @type {HTMLInputElement} */ (group.querySelector('input[type="checkbox"]'));
        const cbLabel = group.querySelector('.form-check span');
        cbInput.addEventListener('change', () => {
          const val = cbInput.checked;
          cbLabel.textContent = val ? (fieldDef.labelTrue || 'Ya') : (fieldDef.labelFalse || 'Tidak');
          _saveFieldValue(fieldDef, val, templateId, itemId, sectionId);

          // Checkbox dapat mengubah visibilitas field dengan showIf.
          // Sinkronkan hanya field kondisional agar input lain tidak dire-render
          // dan fokus pengguna tidak hilang.
          if (itemId && sectionId) {
            const section = TemplateRegistry.get(templateId)
              ?.formSections?.find(s => s.id === sectionId);
            const updated = State.getFormData(templateId)?.[sectionId]
              ?.find(item => item.id === itemId);
            const body = group.parentElement;
            if (section && updated && body) {
              _syncConditionalFields(section.fields, updated, templateId, itemId, sectionId, body);
            }
          }
        });
        break;
      }

      default:
        return null;
    }

    return group;
  }

  function _syncConditionalFields(fields, formData, templateId, itemId, sectionId, containerEl) {
    if (!Array.isArray(fields) || !containerEl) return;

    fields.forEach((fieldDef, index) => {
      if (typeof fieldDef?.showIf !== 'function') return;

      let shouldShow = false;
      try {
        shouldShow = fieldDef.showIf(formData) === true;
      } catch (err) {
        console.warn('[FormRenderer] showIf gagal dievaluasi:', fieldDef.key, err);
      }

      const existing = Array.from(containerEl.querySelectorAll('.form-group[data-field-key]'))
        .find(group => group.dataset.fieldKey === fieldDef.key);

      if (!shouldShow) {
        existing?.remove();
        return;
      }

      if (existing) return;

      const group = _buildField(fieldDef, formData, templateId, itemId, sectionId);

      if (!group) return;

      // Sisipkan tepat setelah field sebelumnya yang dirender.
      for (let previous = index - 1; previous >= 0; previous -= 1) {
        const previousDef = fields[previous];
        const previousGroup = Array.from(containerEl.querySelectorAll('.form-group[data-field-key]'))
          .find(el => el.dataset.fieldKey === previousDef.key);
        if (previousGroup) {
          previousGroup.insertAdjacentElement('afterend', group);
          return;
        }
      }

      containerEl.appendChild(group);
    });
  }

  /* ── Bind input event ke state ── */
  function _bindInput(inputEl, fieldDef, templateId, itemId, sectionId) {
    if (!inputEl) return;

    // Buat debounced handler unik per input
    const debSave = Utils.debounce((val) => {
      _saveFieldValue(fieldDef, val, templateId, itemId, sectionId);
    }, 300);

    const eventType = (fieldDef.type === 'select' || fieldDef.type === 'date') ? 'change' : 'input';

    inputEl.addEventListener(eventType, (e) => {
      let val = e.target.value;
      if (fieldDef.type === 'number' && fieldDef.integer) {
        // Nilai harus berupa bilangan bulat sesuai rentang field.
        const raw = String(val).trim();
        const number = Number(raw);
        const valid = raw !== '' && /^\d+$/.test(raw) && Number.isSafeInteger(number)
          && number >= (fieldDef.min ?? 0) && number <= (fieldDef.max ?? 9999);
        if (raw !== '' && !valid) {
          e.target.value = '';
          _saveFieldValue(fieldDef, '', templateId, itemId, sectionId);
          return;
        }
        _saveFieldValue(fieldDef, valid ? number : '', templateId, itemId, sectionId);
        return;
      }
      if (fieldDef.type === 'number') {
        val = e.target.value === '' ? '' : Utils.safeFloat(val, 0);
      }
      if (fieldDef.type === 'select' || fieldDef.type === 'date' || fieldDef.key === 'izin.alasanIzinLainnya') {
        // Dropdown dan detail kondisional langsung tersimpan untuk mencegah
        // nilai yang tertunda muncul kembali setelah pengguna mengganti alasan.
        _saveFieldValue(fieldDef, val, templateId, itemId, sectionId);
      } else {
        debSave(val);
      }
    });

    // Validasi on blur untuk field required
    if (fieldDef.required) {
      inputEl.addEventListener('blur', () => {
        const v = Validation.required(inputEl.value, fieldDef.label);
        Validation.validateAndShow(inputEl, v);
      });
      inputEl.addEventListener('focus', () => {
        Validation.clearFieldError(inputEl);
      });
    }
  }

  /* ── Simpan nilai field ke State ── */
  function _saveFieldValue(fieldDef, value, templateId, itemId, sectionId) {
    const current = State.getFormData(templateId);
    if (!current) return;

    if (itemId && sectionId) {
      // Field berada di dalam repeatable item
      const items = current[sectionId] || [];
      const itemIdx = items.findIndex(it => it.id === itemId);
      if (itemIdx === -1) return;

      const updatedItem = Utils.deepClone(items[itemIdx]);
      _setNestedValue(updatedItem, fieldDef.key, value);
      const updatedItems = [...items];
      updatedItems[itemIdx] = updatedItem;

      State.setFormData(templateId, { [sectionId]: updatedItems });

      // Kalau ini field 'namaSiswa' atau 'namaSiswa'/'urt', update label entry
      if (['namaSiswa', 'urt', 'indk', 'nama'].some(k => fieldDef.key === k || fieldDef.key.endsWith('.' + k))) {
        const listEl = document.getElementById(`repeatable-list-${sectionId}`);
        if (listEl) {
          const entry = listEl.querySelector(`[data-item-id="${itemId}"]`);
          if (entry) {
            const tpl = TemplateRegistry.get(templateId);
            const updatedData = State.getFormData(templateId);
            const updatedItem2 = (updatedData[sectionId] || []).find(it => it.id === itemId);
            if (updatedItem2 && tpl) {
              const newLabel = _getItemLabel(
                tpl.formSections.find(s => s.id === sectionId),
                updatedItem2,
                itemIdx
              );
              const labelEl = entry.querySelector('.row-entry__label');
              if (labelEl) labelEl.textContent = newLabel;
            }
          }
        }
      }
    } else {
      // Field root level (meta, tandaTangan, dll)
      const update = {};
      _setNestedValue(update, fieldDef.key, value);
      if (fieldDef.clearDependent && value !== fieldDef.clearDependent.keepValue) {
        _setNestedValue(update, fieldDef.clearDependent.key, '');
      }
      State.setFormData(templateId, update);
      if (fieldDef.key === 'header.modePengisian') {
        _syncRekapNilaiMuridFields(templateId);
      }

      // Kondisi showIf juga berlaku untuk field biasa, bukan hanya repeatable.
      const section = TemplateRegistry.get(templateId)?.formSections?.find(s =>
        Array.isArray(s.fields) && s.fields.includes(fieldDef));
      if (section?.fields?.some(f => typeof f.showIf === 'function')) {
        const body = document.getElementById(`section-body-${section.id}`);
        _syncConditionalFields(section.fields, State.getFormData(templateId), templateId, null, null, body);
      }
    }
  }

  /* Mode "Format Saja" hanya menampilkan No. dan Nama Murid.
     Elemen input nilai tidak dibuang agar berpindah kembali ke "Lengkap"
     dapat memulihkan nilai tanpa kehilangan draft. */
  function _syncRekapNilaiMuridFields(templateId) {
    if (templateId !== 'rekap-nilai') return;
    const section = document.getElementById('section-murid');
    if (!section) return;
    const isFormat = State.getFormData(templateId)?.header?.modePengisian === 'format';
    /** @type {NodeListOf<HTMLElement>} */ (
      section.querySelectorAll('.row-entry__body .form-group')
    ).forEach(group => {
      const visible = group.dataset.fieldKey === 'no' || group.dataset.fieldKey === 'namaMurid';
      const hide = isFormat && !visible;
      group.hidden = hide;
      /** @type {NodeListOf<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>} */ (
        group.querySelectorAll('input, select, textarea')
      ).forEach(input => {
        input.disabled = hide;
      });
    });
  }

  /* ── Helper: ambil nilai nested dari object (misal 'meta.namaMadrasah') ── */
  function _getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    return parts.reduce((cur, key) => {
      if (cur === null || cur === undefined) return undefined;
      return cur[key];
    }, obj);
  }

  /* ── Helper: set nilai nested pada object ── */
  function _setNestedValue(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') {
        cur[parts[i]] = {};
      }
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  /* ── Helper: label untuk entry repeatable ── */
  function _getItemLabel(section, item, idx) {
    if (!section) return `Item ${idx + 1}`;
    const nameSrc = item.namaSiswa || item.nama || '';
    const numSrc  = item.urt || item.nis || (idx + 1);
    if (nameSrc) return `${numSrc}. ${nameSrc}`;
    return `${section.itemLabel || 'Item'} ${numSrc}`;
  }

  /* ── Renumber entries setelah delete ── */
  function _renumberEntries(listEl) {
    if (!listEl) return;
    const entries = listEl.querySelectorAll('.row-entry');
    entries.forEach((entry, idx) => {
      const numEl = entry.querySelector('.row-entry__num');
      if (numEl) numEl.textContent = idx + 1;
    });
  }

  /* ── Public API ── */
  return {
    init,
    render,
    syncRekapNilaiMuridFields: _syncRekapNilaiMuridFields,
  };

})();
