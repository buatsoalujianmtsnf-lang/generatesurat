/* Landing page: populated from the same TemplateRegistry as the editor. */
const Landing = (() => {
  let initialized = false;
  const info = {
    'registrasi-dpu': 'Administrasi peserta ujian, siswa mutasi masuk, dan siswa baru.',
    'ijop': 'Dokumen permohonan dan rekomendasi izin operasional madrasah.',
    'pengolahan-nilai': 'Rekapitulasi hasil penilaian dalam format dokumen siap pakai.',
    'surat-menyurat-siswa': 'Surat untuk keperluan siswa dan orang tua/wali.',
    'template-lainnya': 'Koleksi template tambahan yang telah tersedia.',
  };

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) {
      // Card/badge resmi daisyUI pada daftar template yang dibuat secara dinamis.
      const variants = {
        'lp-group': 'card', 'lp-template': 'card',
        'lp-group__count': 'badge badge-ghost',
        'lp-group__link': 'link link-primary',
        'lp-search-empty': 'alert alert-info',
      };
      node.className = [className, variants[className] || ''].filter(Boolean).join(' ');
    }
    if (value !== undefined) {
      if (typeof AppIcons !== 'undefined' && /(?:__icon$|__arrow$)/.test(className)) {
        node.innerHTML = AppIcons.svg(className.endsWith('__arrow') ? 'chevron-right' : value);
      } else node.textContent = value;
    }
    return node;
  }

  function init() {
    if (initialized || !Routes.isLanding()) return;
    initialized = true;
    TemplateRegistry.init();

    const groupRoot = document.getElementById('lp-template-groups');
    const count = document.getElementById('lp-template-count');
    const groupCount = document.getElementById('lp-group-count');
    const search = /** @type {HTMLInputElement|null} */ (document.getElementById('lp-template-search'));
    const searchResults = document.getElementById('lp-search-results');
    if (!groupRoot || !search) return;

    const groups = TemplateRegistry.getGroupedTemplates();
    if (count) count.textContent = String(TemplateRegistry.count());
    if (groupCount) groupCount.textContent = String(groups.length);
    const entries = [];

    for (const group of groups) {
      const section = element('section', 'lp-group');
      section.id = 'lp-' + group.id;
      // Native group-level accordion: every category is collapsed on first paint.
      // Nested template-level <details> remain intact inside this group.
      const accordion = element('details', 'lp-group__accordion');
      const head = element('summary', 'lp-group__heading');
      const icon = element('span', 'lp-group__icon', group.icon);
      icon.setAttribute('aria-hidden', 'true');
      const titleWrap = element('div', 'lp-group__headline');
      titleWrap.appendChild(element('h3', '', group.title));
      titleWrap.appendChild(element('p', '', info[group.id] || 'Template surat siap digunakan.'));
      head.appendChild(icon);
      head.appendChild(titleWrap);
      head.appendChild(element('span', 'lp-group__count', String(group.templates.length) + ' template'));
      const chevron = element('span', 'lp-group__chevron', '⌄');
      chevron.setAttribute('aria-hidden', 'true');
      head.appendChild(chevron);
      accordion.appendChild(head);

      const cards = element('div', 'lp-group__templates');
      for (const template of group.templates) {
        // Native details/summary: keyboard-friendly and collapsed by default.
        // Navigation is a separate link inside the expanded panel, so tapping
        // the card opens its details instead of immediately leaving the page.
        const card = element('details', 'lp-template');
        const summary = element('summary', 'lp-template__summary');
        const glyph = element('span', 'lp-template__icon', template.meta.icon || '📄');
        glyph.setAttribute('aria-hidden', 'true');
        const title = element('span', 'lp-template__details');
        title.appendChild(element('strong', '', template.meta.name));
        const arrow = element('span', 'lp-template__arrow', '›');
        arrow.setAttribute('aria-hidden', 'true');
        summary.appendChild(glyph);
        summary.appendChild(title);
        summary.appendChild(arrow);

        const panel = element('div', 'lp-template__panel');
        panel.appendChild(element('p', 'lp-template__description',
          template.meta.description || 'Template surat siap digunakan.'));
        const open = element('a', 'lp-template__open', 'Buka Editor Surat');
        open.setAttribute('href', Routes.href(Routes.templateUrl(template.TEMPLATE_ID) || '/editor'));
        panel.appendChild(open);
        card.appendChild(summary);
        card.appendChild(panel);
        cards.appendChild(card);
        entries.push({
          link: card,
          haystack: (template.meta.name + ' ' + template.meta.description + ' ' + group.title)
            .toLocaleLowerCase('id-ID'),
        });
      }
      const body = element('div', 'lp-group__body');
      body.appendChild(cards);
      const footer = element('a', 'lp-group__link', 'Buka semua template kelompok ini');
      footer.setAttribute('href', Routes.href(Routes.categoryUrl(group.id)));
      body.appendChild(footer);
      accordion.appendChild(body);
      section.appendChild(accordion);
      groupRoot.appendChild(section);
    }

    const empty = element('p', 'lp-search-empty', 'Tidak ada template yang sesuai. Coba kata kunci lain.');
    empty.hidden = true;
    groupRoot.appendChild(empty);

    const clear = document.getElementById('lp-search-clear');
    function updateResults() {
      const q = search.value.trim().toLocaleLowerCase('id-ID');
      let visibleCount = 0;
      for (const entry of entries) {
        const visible = !q || entry.haystack.includes(q);
        entry.link.hidden = !visible;
        if (visible) visibleCount++;
      }
      groupRoot.querySelectorAll('.lp-group').forEach(group => {
        const visibleCards = Array.from(group.querySelectorAll('.lp-template'))
          .some(link => !link.hasAttribute('hidden'));
        group.toggleAttribute('hidden', !visibleCards);
        // Match results should be reachable without opening each category by hand.
        // Clearing the query restores the requested collapsed state.
        const accordion = group.querySelectorAll('.lp-group__accordion')[0];
        if (accordion) accordion.open = Boolean(q && visibleCards);
      });
      empty.hidden = visibleCount > 0;
      if (clear) clear.hidden = search.value.length === 0;
      if (searchResults) {
        searchResults.textContent = q
          ? visibleCount + ' template ditemukan'
          : 'Pilih template untuk mulai membuat surat';
      }
    }
    search.addEventListener('input', updateResults);
    clear?.addEventListener('click', () => {
      search.value = '';
      updateResults();
      search.focus();
    });
    // Search shortcut is intentionally landing-only and never intercepts editor input.
    document.addEventListener('keydown', event => {
      if (!Routes.isLanding()) return;
      const target = /** @type {HTMLElement|null} */ (/** @type {unknown} */ (event.target));
      const editing = Boolean(target?.isContentEditable) ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || '');
      if (event.key === '/' && !editing && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        search.focus();
        search.scrollIntoView?.({ behavior: 'auto', block: 'center' });
      } else if (event.key === 'Escape' && document.activeElement === search && search.value) {
        event.preventDefault();
        search.value = '';
        updateResults();
      }
    });
    if (search.value) updateResults();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init };
})();
