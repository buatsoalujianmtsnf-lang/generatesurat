/* Stage 3: on-demand advisory document QA. Export gate still enforces validation. */
const DocumentPreflight = (() => {
  let initialized = false, revision = 0, pending = false;
  let lastIssues = [];
  function collectLayoutWarnings() {
    const result = [];
    if (!State.getActiveTemplate()) return result;
    const preview = document.getElementById('surat-preview');
    const pages = preview?.querySelectorAll(':scope > .surat-page') || [];
    if (!pages.length) {
      result.push('Pratinjau belum siap. Periksa tampilan dokumen sebelum mencetak.');
      return result;
    }
    for (const page of pages) {
      const number = page.dataset.pageNumber || 'dokumen';
      if (page.clientWidth > 0 && page.scrollWidth > page.clientWidth + 8)
        result.push('Halaman ' + number + ' berpotensi meluber secara horizontal.');
      if (page.clientHeight > 0 && page.scrollHeight > page.clientHeight + 8)
        result.push('Halaman ' + number + ' berpotensi terpotong vertikal.');
      if (!page.textContent.trim() && !page.querySelector('img,svg,table'))
        result.push('Halaman ' + number + ' tampak kosong.');
    }
    return result;
  }
  function paint(issues, warnings) {
    const status = document.getElementById('preflight-status');
    const list = document.getElementById('preflight-results');
    if (!status || !list) return;
    list.replaceChildren();
    if (!issues.length && !warnings.length) {
      status.textContent = 'Validasi dasar lulus. Tetap periksa tampilan dan tanda tangan.';
      status.dataset.state = 'ready';
      return;
    }
    status.textContent = issues.length
      ? issues.length + ' masalah wajib diperbaiki; ' + warnings.length + ' peringatan visual.'
      : warnings.length + ' peringatan visual untuk diperiksa.';
    status.dataset.state = issues.length ? 'blocked' : 'warning';
    const ul = document.createElement('ul');
    ul.className = 'preflight-list';
    issues.slice(0, 30).forEach((issue, index) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'preflight-issue';
      button.dataset.issueIndex = String(index);
      button.textContent = (issue.step === 'kop' ? 'KOP: ' : issue.step === 'template' ? 'Template: ' : 'Isi Surat: ') + issue.message;
      li.appendChild(button);
      ul.appendChild(li);
    });
    if (issues.length > 30) {
      const li = document.createElement('li');
      li.textContent = 'Ada ' + (issues.length - 30) + ' masalah tambahan.';
      ul.appendChild(li);
    }
    warnings.forEach(message => {
      const li = document.createElement('li');
      li.textContent = 'Periksa visual: ' + message;
      ul.appendChild(li);
    });
    list.appendChild(ul);
  }
  async function run() {
    if (pending) return;
    pending = true;
    const button = /** @type {HTMLButtonElement|null} */ (document.getElementById('preflight-run'));
    const status = document.getElementById('preflight-status');
    if (button) button.disabled = true;
    if (status) { status.textContent = 'Memeriksa data dan menunggu pratinjau…'; status.dataset.state = 'checking'; }
    const snapshot = revision;
    try {
      if (typeof Utils.flushDebounces === 'function') Utils.flushDebounces();
      const issues = Workflow.collectIssues();
      if (State.getActiveTemplate() && typeof PreviewRenderer.waitForReady === 'function')
        await PreviewRenderer.waitForReady();
      if (snapshot !== revision) {
        if (status) { status.textContent = 'Data berubah. Periksa ulang.'; status.dataset.state = 'stale'; }
        return;
      }
      lastIssues = issues;
      paint(issues, collectLayoutWarnings());
    } catch {
      if (status) { status.textContent = 'Pemeriksaan gagal. Coba lagi.'; status.dataset.state = 'blocked'; }
    } finally {
      pending = false;
      if (button) button.disabled = false;
    }
  }
  function init() {
    if (initialized || !document.getElementById('preflight-run')) return;
    initialized = true;
    document.getElementById('preflight-run').addEventListener('click', run);
    document.getElementById('preflight-results').addEventListener('click', event => {
      const button = event.target instanceof Element ? event.target.closest('[data-issue-index]') : null;
      const index = Number(/** @type {HTMLElement|null} */ (button)?.dataset.issueIndex);
      if (button && Number.isInteger(index) && lastIssues[index]) Workflow.focusIssue(lastIssues[index]);
    });
    const invalidate = () => {
      revision++;
      const status = document.getElementById('preflight-status');
      if (status && status.dataset.state !== 'unchecked') {
        status.textContent = 'Data berubah. Periksa ulang.';
        status.dataset.state = 'stale';
      }
    };
    State.on('state:change', invalidate);
    State.on('state:restore', invalidate);
    State.on('state:reset', invalidate);
  }
  return { init, run, collectLayoutWarnings };
})();
