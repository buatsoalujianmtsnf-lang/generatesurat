/* Tabler Icons outline sprite. Icons are local, CSP-compatible and available offline.
   MIT — https://github.com/tabler/tabler-icons */
const AppIcons = (() => {
  const names = new Set('search file-text file-type-pdf printer download upload refresh info-circle sun moon device-desktop arrow-back-up arrow-forward-up device-floppy trash layout-sidebar settings chevron-down chevron-left chevron-right chevrons-left chevrons-right plus photo eye arrows-maximize arrows-horizontal zoom-in zoom-out circle-check file-description file-spreadsheet school users user calendar mail building-bank signature list-check clipboard-list books chart-bar arrows-exchange writing palette pinned shield-check'.split(' '));
  const emojis = Object.freeze({
    '📄':'file-text','📋':'clipboard-list','📑':'file-description','📚':'books',
    '📊':'chart-bar','✉️':'mail','✉':'mail','📝':'writing',
    '🏛️':'building-bank','🏫':'school','👥':'users','👤':'user',
    '✅':'circle-check','✓':'check','🖋️':'signature','🖊️':'signature','✍️':'signature','✍':'signature',
    '🔄':'arrows-exchange','🎓':'school','📅':'calendar','🖼️':'photo',
    '👁️':'eye','👁':'eye','📥':'download','💾':'device-floppy','⚠️':'info-circle',
    '🔒':'shield-check','🖨️':'printer','🧩':'layout-sidebar','📐':'arrows-maximize',
    '🔤':'file-text','🔢':'list-check','⚙️':'settings','📌':'pinned',
    '🎨':'palette','🛡️':'shield-check','🗂️':'books','❌':'trash',
    'ℹ️':'info-circle','📜':'file-description','❓':'info-circle','🧭':'arrows-horizontal',
    '♥':'circle-check','✉':'mail','⬅':'chevron-left','➡':'chevron-right',
    '↔':'arrows-horizontal','☰':'list-check','↻':'refresh','⇩':'download','⇧':'upload',
  });
  function svg(name, className = '') {
    const mapped = emojis[String(name ?? '')] || String(name ?? '');
    const safe = names.has(mapped) ? mapped : 'file-text';
    const cls = /^[a-zA-Z0-9 _-]{0,120}$/.test(className) ? className.trim() : '';
    return '<svg class="ti-icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><use href="assets/icons/tabler-sprite.svg#ti-' + safe + '"></use></svg>';
  }
  function apply(root = document) {
    root.querySelectorAll('[data-tabler-icon]').forEach(el => {
      const name = el.getAttribute('data-tabler-icon');
      if (!name) return;
      el.innerHTML = svg(name);
    });
  }
  return Object.freeze({ svg, apply, names, emojis });
})();
