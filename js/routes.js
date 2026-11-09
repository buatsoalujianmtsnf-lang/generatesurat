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

  /* Vercel me-rewrite deep link ke index; server lokal statis tidak.
     Pada localhost gunakan query ?route=... agar semua navigasi serta reload
     selalu meminta entry HTML yang memang tersedia. */
  function isLocal() {
    const hostname = String(window.location.hostname || '').toLowerCase();
    return ['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'].includes(hostname);
  }

  function currentPath() {
    if (isLocal()) {
      const requested = new URLSearchParams(window.location.search || '').get('route');
      if (requested && requested.startsWith('/') && !requested.startsWith('//')) {
        return requested;
      }
    }
    return window.location.pathname;
  }

  function href(path) {
    if (!isLocal()) return path; // URL kanonis di Vercel tidak berubah.
    // Pertahankan /index.html bila localhost dibuka sebagai file eksplisit.
    const pathname = window.location.pathname;
    const entry = pathname.endsWith('/index.html') ? pathname : '/';
    return path === '/' ? entry : entry + '?route=' + encodeURIComponent(path);
  }

  function rewriteLocalLinks() {
    if (!isLocal() || typeof document === 'undefined'
        || typeof document.querySelectorAll !== 'function') return;
    // CTA/navbar dirender statis dalam HTML; kartu landing menggunakan href()
    // ketika dibuat dari registry.
    document.querySelectorAll('a[href^="/"]').forEach(link => {
      const path = link.getAttribute('href');
      if (path && path.startsWith('/') && !path.startsWith('//')) {
        link.setAttribute('href', href(path));
      }
    });
  }

  function resolve(path) {
    const cleaned = String(path || '/').replace(/\/+$/, '') || '/';
    if (cleaned === '/' || cleaned === '/index' || cleaned === '/index.html') return { kind: 'landing' };
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
    return resolve(currentPath()).kind === 'landing';
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
      const route = resolve(currentPath());
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
            history.replaceState(history.state, '', href(categoryUrl(route.groupId)));
          }
        } else if (route.kind === 'editor') {
          // Draft yang dipulihkan tetap memiliki template aktif dan URL kanonisnya.
          const activeId = State.getActiveTemplate();
          const activeUrl = templateUrl(activeId);
          if (activeUrl) {
            history.replaceState({ templateId: activeId }, '', href(activeUrl));
            setEditorTitle(activeId);
          } else {
            UI.switchTab('template');
            setEditorTitle(null);
          }
        } else if (route.kind === 'landing') {
          window.location.assign(href('/'));
        } else {
          history.replaceState(history.state, '', href('/editor'));
          UI.switchTab('template');
          setEditorTitle(null);
        }
      } finally {
        applyingRoute = false;
      }
    }

    function sync(templateId) {
      if (applyingRoute) return;
      const url = href(templateUrl(templateId) || '/editor');
      if (window.location.pathname + window.location.search !== url) {
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
    const path = templateUrl(templateId);
    if (!path) return;
    const url = href(path);
    if (window.location.pathname + window.location.search !== url) {
      history.pushState({ templateId }, '', url);
    }
    setEditorTitle(templateId);
  }

  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.routePage = isLanding() ? 'landing' : 'editor';
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', rewriteLocalLinks);
    } else {
      rewriteLocalLinks();
    }
  }

  return {
    resolve, templateUrl, categoryUrl, isLanding, initEditor, onSelected,
    currentPath, href, isLocal,
  };
})();
