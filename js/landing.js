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
    if (value !== undefined) node.textContent = value;
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
      const head = element('div', 'lp-group__heading');
      const icon = element('span', 'lp-group__icon', group.icon);
      icon.setAttribute('aria-hidden', 'true');
      const titleWrap = element('div', 'lp-group__headline');
      titleWrap.appendChild(element('h3', '', group.title));
      titleWrap.appendChild(element('p', '', info[group.id] || 'Template surat siap digunakan.'));
      head.appendChild(icon);
      head.appendChild(titleWrap);
      head.appendChild(element('span', 'lp-group__count', String(group.templates.length) + ' template'));
      section.appendChild(head);

      const cards = element('div', 'lp-group__templates');
      for (const template of group.templates) {
        const link = element('a', 'lp-template');
        link.setAttribute('href', Routes.href(Routes.templateUrl(template.TEMPLATE_ID) || '/editor'));
        const glyph = element('span', 'lp-template__icon', template.meta.icon || '📄');
        glyph.setAttribute('aria-hidden', 'true');
        const details = element('span', 'lp-template__details');
        details.appendChild(element('strong', '', template.meta.name));
        details.appendChild(element('span', '', template.meta.description || 'Template surat'));
        const arrow = element('span', 'lp-template__arrow', '↗');
        arrow.setAttribute('aria-hidden', 'true');
        link.appendChild(glyph);
        link.appendChild(details);
        link.appendChild(arrow);
        cards.appendChild(link);
        entries.push({
          link,
          haystack: (template.meta.name + ' ' + template.meta.description + ' ' + group.title)
            .toLocaleLowerCase('id-ID'),
        });
      }
      section.appendChild(cards);
      const footer = element('a', 'lp-group__link', 'Buka semua template kelompok ini');
      footer.setAttribute('href', Routes.href(Routes.categoryUrl(group.id)));
      section.appendChild(footer);
      groupRoot.appendChild(section);
    }

    const empty = element('p', 'lp-search-empty', 'Tidak ada template yang sesuai. Coba kata kunci lain.');
    empty.hidden = true;
    groupRoot.appendChild(empty);

    search.addEventListener('input', () => {
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
      });
      empty.hidden = visibleCount > 0;
      if (searchResults) {
        searchResults.textContent = visibleCount + ' template ditemukan';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init };
})();
