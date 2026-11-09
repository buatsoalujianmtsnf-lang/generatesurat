/* Routes: stable, shareable URLs for the static Vercel app. */
const Routes = (() => {
  const TEMPLATE_SLUGS = Object.freeze({
    'dpu': 'daftar-peserta-ujian',
    'mutasi-masuk': 'pengesahan-mutasi-masuk',
    'siswa-baru': 'pengesahan-siswa-baru',
    'ijop-permohonan': 'ijop-permohonan-lembaga',
    'ijop-sptjm-satpen': 'ijop-sptjm-kepala-satpen',
    'ijop-rekomendasi-pengawas': 'ijop-rekomendasi-pengawas',
    'ijop-rekomendasi-kankemenag': 'ijop-rekomendasi-kakankemenag',
    'ijop-sptjm-kankemenag': 'ijop-sptjm-kakankemenag',
    'rekap-nilai': 'rekapitulasi-nilai',
    'surat-izin': 'izin-tidak-masuk',
  });
  const GROUP_IDS = ['registrasi-dpu', 'ijop', 'pengolahan-nilai', 'surat-menyurat-siswa'];
  const ID_BY_SLUG = Object.fromEntries(
    Object.entries(TEMPLATE_SLUGS).map(([id, slug]) => [slug, id])
  );
  let initialized = false;
  let applyingRoute = false;

  function resolve(path) {
    const cleaned = String(path || '/').replace(/\/+$/, '') || '/';
    if (cleaned === '/' || cleaned === '/index.html') return { kind: 'landing' };
    if (cleaned === '/editor') return { kind: 'editor' };
    if (cleaned.toLowerCase() === '/dpudanregis') {
      return { kind: 'category', groupId: 'registrasi-dpu', legacy: true };
    }
    const templateMatch = /^\/surat\/([a-z0-9-]+)$/i.exec(cleaned);
    if (templateMatch) {
      const templateId = ID_BY_SLUG[templateMatch[1].toLowerCase()];
      return templateId ? { kind: 'template', templateId } : { kind: 'unknown' };
    }
    const categoryMatch = /^\/kategori\/([a-z0-9-]+)$/i.exec(cleaned);
    if (categoryMatch && GROUP_IDS.includes(categoryMatch[1].toLowerCase())) {
      return { kind: 'category', groupId: categoryMatch[1].toLowerCase() };
    }
    return { kind: 'unknown' };
  }

  function templateUrl(templateId) {
    const slug = TEMPLATE_SLUGS[templateId];
    return slug ? '/surat/' + slug : null;
  }

  function categoryUrl(groupId) {
    return GROUP_IDS.includes(groupId) ? '/kategori/' + groupId : '/editor';
  }

  function isLanding() {
    return resolve(window.location.pathname).kind === 'landing';
  }

  function setEditorTitle(templateId) {
    const template = templateId && typeof TemplateRegistry !== 'undefined'
      ? TemplateRegistry.get(templateId) : null;
    document.title = template
      ? template.meta.name + ' | Generator Surat Madrasah'
      : 'Editor Surat | Generator Surat Madrasah';
  }

  function initEditor(selectTemplate) {
    if (initialized || isLanding()) return;
    initialized = true;
    const container = document.getElementById('template-list');

    function applyLocation() {
      const route = resolve(window.location.pathname);
      applyingRoute = true;
      try {
        if (route.kind === 'template') {
          selectTemplate(route.templateId);
          TemplateRegistry.updateActiveCard(container, route.templateId);
          setEditorTitle(route.templateId);
        } else if (route.kind === 'category') {
          UI.switchTab('template');
          TemplateRegistry.openGroup(container, route.groupId);
          setEditorTitle(null);
          if (route.legacy) {
            history.replaceState(history.state, '', categoryUrl(route.groupId));
          }
        } else if (route.kind === 'editor') {
          UI.switchTab('template');
          setEditorTitle(null);
        } else if (route.kind === 'landing') {
          window.location.assign('/');
        } else {
          history.replaceState(history.state, '', '/editor');
          UI.switchTab('template');
          setEditorTitle(null);
        }
      } finally {
        applyingRoute = false;
      }
    }

    function sync(templateId) {
      if (applyingRoute) return;
      const url = templateUrl(templateId) || '/editor';
      if (window.location.pathname !== url) {
        history.pushState({ templateId: templateId || null }, '', url);
      }
      setEditorTitle(templateId);
    }

    State.on('template:change', ({ templateId }) => sync(templateId));
    State.on('state:restore', () => sync(State.getActiveTemplate()));
    State.on('state:reset', () => sync(null));
    window.addEventListener('popstate', applyLocation);
    applyLocation();
  }

  function onSelected(templateId) {
    if (!initialized) return;
    if (applyingRoute) return;
    const url = templateUrl(templateId);
    if (!url) return;
    if (window.location.pathname !== url) {
      history.pushState({ templateId }, '', url);
    }
    setEditorTitle(templateId);
  }

  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.routePage = isLanding() ? 'landing' : 'editor';
  }

  return { resolve, templateUrl, categoryUrl, isLanding, initEditor, onSelected };
})();
