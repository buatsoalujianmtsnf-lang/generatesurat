/**
 * PP-04: isolated, genuine headless Chromium browser integration/UAT.
 * Never uses production, personal student records, real sponsor state, or OS capture.
 * Emulated mobile viewports are not physical iOS/Android/Safari UAT.
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = resolve(root, 'artifacts/pp04-browser');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};
const report = {
  stage: 'PP-04',
  environment: 'isolated same-origin headless Chromium on GitHub Actions',
  physicalDeviceUat: false,
  safariFirefoxUat: false,
  actualOsScreenshotOrRecordingBlocked: 'not testable/guaranteed by web app',
  realSponsorOrProductionBackend: false,
  status: 'RUNNING',
  viewports: [],
  templateResults: [],
  pdfPayload: null,
  error: null,
};
const pdfRequests = [];
const server = createServer(async (req, res) => {
  try {
    const uri = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(uri.pathname);
    if (pathname.startsWith('/api/')) {
      if (pathname === '/api/export-pdf' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) {
          body += String(chunk);
          if (body.length > 9_000_000) break;
        }
        const payload = JSON.parse(body || '{}');
        pdfRequests.push({
          method: req.method,
          hasDocument: typeof payload.html === 'string' && payload.html.includes('id="surat-preview"'),
          hasWatermarkLayer: /preview-protection-layer|preview-protection-sheet/.test(payload.html || ''),
          hasProtectionLabel: /Preview berwatermark|Preview disamarkan/.test(payload.html || ''),
          stylesheetHasPrintExclusion: (payload.css || '').includes('#preview-protection-layer')
            && (payload.css || '').includes('@media print'),
          htmlLength: (payload.html || '').length,
          cssLength: (payload.css || '').length,
        });
      }
      res.writeHead(503, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify({ error: 'PP04_FAKE_BACKEND_UNAVAILABLE' }));
      return;
    }
    const route = pathname === '/' || pathname === '/editor' ? '/index.html' : pathname;
    if (route.includes('\0') || route.includes('\\') || route.includes('..')) {
      res.writeHead(403); res.end(); return;
    }
    const full = resolve(root, '.' + route);
    if (full !== root && !full.startsWith(root + sep)) {
      res.writeHead(403); res.end(); return;
    }
    try {
      const bytes = await readFile(full);
      res.writeHead(200, {
        'Content-Type': mime[extname(full)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(bytes);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  } catch {
    res.writeHead(400); res.end();
  }
});
function check(value, label) {
  if (!value) throw Error('[PP04 browser] ' + label);
}
const rafTwo = async page => page.evaluate(() =>
  new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
);
const layout = () => {
  const rootEl = document.getElementById('surat-preview');
  const overlay = document.getElementById('preview-protection-layer');
  const pages = [...rootEl.querySelectorAll(':scope > .surat-page')];
  const sheets = [...overlay.querySelectorAll('.preview-protection-sheet')];
  const drifts = pages.map((page, i) => {
    const a = page.getBoundingClientRect();
    const b = sheets[i]?.getBoundingClientRect();
    return b ? Math.max(
      Math.abs(a.left - b.left), Math.abs(a.top - b.top),
      Math.abs(a.width - b.width), Math.abs(a.height - b.height)
    ) : Infinity;
  });
  return {
    pageCount: pages.length,
    sheetCount: sheets.length,
    maxGeometryErrorPx: drifts.length ? Math.max(...drifts) : Infinity,
    hasTile: sheets.length > 0 && sheets.every(sheet =>
      sheet.style.backgroundImage.startsWith('url("data:image/svg+xml,')
    ),
    sheetsArePointerTransparent: sheets.every(sheet =>
      getComputedStyle(sheet).pointerEvents === 'none'
    ),
    htmlContainsOverlay: /preview-protection-sheet|preview-protection-layer/.test(rootEl.outerHTML),
    correctSibling: overlay.parentElement === rootEl.parentElement,
    status: PreviewProtection.getStatus(),
    rootScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  };
};
const devices = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'tablet', width: 820, height: 1180, isMobile: true },
  { name: 'mobile-portrait', width: 390, height: 844, isMobile: true },
  { name: 'mobile-landscape', width: 844, height: 390, isMobile: true },
];
let browser;
let failed = null;
try {
  await mkdir(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    headless: true,
    args: chromium.args,
    timeout: 45000,
  });
  for (const device of devices) {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(String(err?.message || err).slice(0, 350)));
    await page.setViewport({
      width: device.width, height: device.height,
      isMobile: device.isMobile, hasTouch: device.isMobile, deviceScaleFactor: 1,
    });
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (new URL(req.url()).origin !== origin) {
        void req.abort();
        return;
      }
      void req.continue();
    });
    await page.goto(origin + '/editor', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForFunction(() =>
      typeof PreviewProtection !== 'undefined'
      && typeof TemplateRegistry !== 'undefined'
      && typeof PreviewRenderer !== 'undefined'
      && PreviewProtection.getStatus().initialized,
    { timeout: 20000 });
    const initial = await page.evaluate(() => ({
      flag: document.documentElement.dataset.previewProtection,
      status: PreviewProtection.getStatus(),
      templateCount: TemplateRegistry.count(),
      visibleBadgeRemoved: !document.getElementById('preview-protection-status'),
    }));
    check(initial.flag === 'on' && initial.status.enabled
      && initial.status.mode === 'strict' && initial.status.interactionsProtected
      && initial.visibleBadgeRemoved,
      device.name + ': preview protection must be active in strict mode by default');
    check(initial.templateCount === 18, device.name + ': expected 18 registered templates');

    // The real app preview/render/pagination pipeline on dummy default form data.
    await page.evaluate(async () => {
      const template = TemplateRegistry.get('surat-izin');
      State.initFormData('surat-izin', template.createDefaultData());
      State.setActiveTemplate('surat-izin');
      await PreviewRenderer.waitForReady(110);
      document.documentElement.dataset.previewProtection = 'on';
      document.documentElement.dataset.previewProtectionMode = 'strict';
      PreviewProtection.refresh();
    });
    await rafTwo(page);
    let geometry = await page.evaluate(layout);
    check(geometry.pageCount > 0 && geometry.sheetCount === geometry.pageCount,
      device.name + ': overlay page count mismatch ' + JSON.stringify(geometry));
    check(geometry.hasTile && geometry.correctSibling && !geometry.htmlContainsOverlay,
      device.name + ': watermark not isolated from document');
    check(geometry.maxGeometryErrorPx < 3,
      device.name + ': watermark/page drift ' + geometry.maxGeometryErrorPx);
    check(geometry.sheetsArePointerTransparent, device.name + ': watermark blocks pointer');
    check(geometry.status.interactionsProtected, device.name + ': strict pointer handlers not attached');
    check(geometry.rootScrollWidth <= geometry.viewportWidth + 24,
      device.name + ': major horizontal page overflow');

    // Real DOM-dispatched pointer/keyboard interactions without a mocked DOM.
    const interaction = await page.evaluate(() => {
      const doc = document.querySelector('#surat-preview .doc-content');
      const outside = document.querySelector('.preview-toolbar');
      function fire(target, name, opts = {}) {
        const event = name === 'dragstart'
          ? new Event(name, { bubbles: true, cancelable: true })
          : new MouseEvent(name, { bubbles: true, cancelable: true, button: opts.button ?? 2, ctrlKey: !!opts.ctrlKey });
        target.dispatchEvent(event);
        return event.defaultPrevented;
      }
      const image = document.createElement('img');
      image.alt = 'dummy test fixture';
      doc.appendChild(image);
      const answer = {
        rightClick: fire(doc, 'contextmenu'),
        ctrlClick: fire(doc, 'contextmenu', { button: 0, ctrlKey: true }),
        keyboardMenu: fire(doc, 'contextmenu', { button: -1 }),
        outsideMenu: fire(outside, 'contextmenu'),
        dragImage: fire(image, 'dragstart'),
        dragText: fire(doc, 'dragstart'),
        copy: fire(doc, 'copy'),
      };
      image.remove();
      return answer;
    });
    check(interaction.rightClick && interaction.ctrlClick && interaction.dragImage,
      device.name + ': strict pointer guard not enforced');
    check(!interaction.keyboardMenu && !interaction.outsideMenu
      && !interaction.dragText && !interaction.copy,
      device.name + ': keyboard/text/editor interactions were blocked');

    // Simulate the browser visibility event, not an OS capture API.
    const visibility = await page.evaluate(() => {
      const descriptors = ['hidden', 'visibilityState'].map(key => ({
        key, desc: Object.getOwnPropertyDescriptor(document, key),
      }));
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      const whenHidden = {
        masked: PreviewProtection.getStatus().masked,
        css: document.getElementById('preview-protection-layer').classList.contains('is-masked'),
      };
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      const whenVisible = {
        masked: PreviewProtection.getStatus().masked,
        css: document.getElementById('preview-protection-layer').classList.contains('is-masked'),
      };
      for (const entry of descriptors) {
        if (entry.desc) Object.defineProperty(document, entry.key, entry.desc);
        else delete document[entry.key];
      }
      return { whenHidden, whenVisible };
    });
    check(visibility.whenHidden.masked && visibility.whenHidden.css
      && !visibility.whenVisible.masked && !visibility.whenVisible.css,
      device.name + ': background-tab masking restore failed');

    const modes = await page.evaluate(() => {
      const html = document.documentElement;
      html.dataset.previewProtectionMode = 'standard';
      PreviewProtection.refresh();
      const standard = PreviewProtection.getStatus();
      html.dataset.previewProtectionMode = 'strict';
      PreviewProtection.refresh();
      const strict = PreviewProtection.getStatus();
      return { standard, strict };
    });
    check(modes.standard.enabled && !modes.standard.masked && !modes.standard.interactionsProtected
      && modes.strict.interactionsProtected, device.name + ': mode transitions wrong');

    // Zoom and focus-mode fallback must not move overlay away from paper.
    await page.evaluate(() => State.setZoom(0.65));
    await rafTwo(page);
    geometry = await page.evaluate(layout);
    check(geometry.maxGeometryErrorPx < 3 && geometry.sheetCount === geometry.pageCount,
      device.name + ': zoom breaks watermark geometry');

    if (device.name === 'desktop') {
      const ids = await page.evaluate(() => TemplateRegistry.getAll().map(t => t.TEMPLATE_ID));
      for (const id of ids) {
        await page.evaluate(async templateId => {
          const tpl = TemplateRegistry.get(templateId);
          State.initFormData(templateId, tpl.createDefaultData());
          State.setActiveTemplate(templateId);
          await PreviewRenderer.waitForReady(110);
        }, id);
        await rafTwo(page);
        const g = await page.evaluate(layout);
        check(g.pageCount > 0 && g.sheetCount === g.pageCount
          && g.maxGeometryErrorPx < 3 && g.correctSibling && !g.htmlContainsOverlay,
        'template ' + id + ' failed: ' + JSON.stringify(g));
        report.templateResults.push({ templateId: id, pages: g.pageCount, status: 'PASS' });
      }
      check(report.templateResults.length === 18, '18 template UAT missing');
    }

    // Verify real PDF export payload is document-only using an unavailable fake backend.
    const beforePdf = pdfRequests.length;
    await page.evaluate(async () => {
      const templateId = 'surat-izin';
      State.initFormData(templateId, TemplateRegistry.get(templateId).createDefaultData());
      State.setActiveTemplate(templateId);
      await PreviewRenderer.waitForReady(110);
      await PdfExport.exportDocument();
    });
    check(pdfRequests.length === beforePdf + 1, device.name + ': PDF export did not call fake backend');
    const payload = pdfRequests.at(-1);
    check(payload.hasDocument && !payload.hasWatermarkLayer && !payload.hasProtectionLabel
      && payload.stylesheetHasPrintExclusion,
      device.name + ': PDF payload includes preview protection DOM or lacks print guard');
    if (device.name === 'desktop') report.pdfPayload = payload;

    // Sponsor required must fail closed: no POST without sponsor receipt.
    const beforeSponsorPdf = pdfRequests.length;
    const sponsorGuard = await page.evaluate(async () => {
      document.documentElement.dataset.sponsorGate = 'required';
      const result = await PdfExport.exportDocument();
      const required = SponsorExportGate.isRequired();
      document.documentElement.dataset.sponsorGate = 'off';
      return { result, required };
    });
    check(sponsorGuard.required && sponsorGuard.result === false
      && pdfRequests.length === beforeSponsorPdf,
      device.name + ': sponsor PDF authorization can be bypassed');

    // Print CSS & Chromium PDF use a document with watermark ON.
    await page.emulateMediaType('print');
    const printState = await page.evaluate(() => ({
      layer: getComputedStyle(document.getElementById('preview-protection-layer')).display,
      paper: getComputedStyle(document.querySelector('#surat-preview > .surat-page')).display,
    }));
    check(printState.layer === 'none'
      && printState.paper !== 'none', device.name + ': printed page leaks watermark overlay');
    if (device.name === 'desktop') {
      const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
      check(pdf.length > 800 && Buffer.from(pdf).subarray(0, 5).toString() === '%PDF-',
        'Chromium print-to-PDF failed');
      await writeFile(resolve(output, 'dummy-print-smoke.pdf'), pdf);
    }
    await page.emulateMediaType('screen');

    await page.evaluate(() => {
      document.documentElement.dataset.previewProtection = 'off';
      PreviewProtection.refresh();
    });
    const rollback = await page.evaluate(() => ({
      status: PreviewProtection.getStatus(),
      overlayHidden: document.getElementById('preview-protection-layer').hidden,
    }));
    check(!rollback.status.enabled && !rollback.status.interactionsProtected
      && rollback.overlayHidden,
    device.name + ': rollback did not clear protection');
    check(pageErrors.length === 0, device.name + ': uncaught errors ' + pageErrors.join('; '));

    if (device.name === 'desktop' || device.name === 'mobile-portrait') {
      await page.evaluate(() => {
        document.documentElement.dataset.previewProtection = 'on';
        PreviewProtection.refresh();
      });
      await rafTwo(page);
      await page.screenshot({
        path: resolve(output, device.name + '-watermark.png'), fullPage: false,
      });
    }

    // Landing UAT on the real browser: five native group-level accordions
    // remain collapsed until activated; template-level details remain nested.
    // Separate tab avoids the editor's unsaved-draft beforeunload dialog.
    const landingPage = await browser.newPage();
    await landingPage.setViewport({
      width: device.width, height: device.height,
      isMobile: device.isMobile, hasTouch: device.isMobile, deviceScaleFactor: 1,
    });
    await landingPage.setBypassServiceWorker(true);
    await landingPage.setRequestInterception(true);
    landingPage.on('request', req => {
      if (new URL(req.url()).origin !== origin) { void req.abort(); return; }
      void req.continue();
    });
    await landingPage.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await landingPage.waitForFunction(() =>
      document.querySelectorAll('#lp-template-groups > .lp-group').length === 5,
    { timeout: 20000 });
    const landingBaseline = await landingPage.evaluate(() => {
      const groups = [...document.querySelectorAll('#lp-template-groups > .lp-group')];
      const accordions = groups.map(group => group.querySelector('.lp-group__accordion'));
      return {
        groups: groups.length,
        groupAccordions: accordions.length,
        allNative: accordions.every(details => details?.tagName === 'DETAILS'
          && details.firstElementChild?.tagName === 'SUMMARY'),
        allClosed: accordions.every(details => details && !details.open),
        nestedTemplates: groups.reduce((n, group) => n + group.querySelectorAll('.lp-template').length, 0),
        nestedClosed: [...document.querySelectorAll('#lp-template-groups .lp-template')]
          .every(details => !details.open),
        groupLinks: groups.every(group => !!group.querySelector('.lp-group__link[href]')),
        overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      };
    });
    check(landingBaseline.groups === 5 && landingBaseline.groupAccordions === 5
      && landingBaseline.allNative && landingBaseline.allClosed
      && landingBaseline.nestedTemplates === 18 && landingBaseline.nestedClosed
      && landingBaseline.groupLinks,
      device.name + ': landing group accordion baseline failed: ' + JSON.stringify(landingBaseline));
    check(landingBaseline.overflowPx <= 24,
      device.name + ': landing page has horizontal overflow ' + landingBaseline.overflowPx);

    // Actual keyboard Enter toggles the group without navigating.
    const firstSummary = await landingPage.$('#lp-template-groups .lp-group__accordion > summary');
    check(Boolean(firstSummary), device.name + ': landing group summary not found');
    await firstSummary.focus();
    await landingPage.keyboard.press('Enter');
    const afterEnter = await landingPage.evaluate(() =>
      document.querySelector('#lp-template-groups .lp-group__accordion').open
    );
    check(afterEnter, device.name + ': pressing Enter did not open group');
    await landingPage.keyboard.press('Enter');
    const afterSecondEnter = await landingPage.evaluate(() =>
      document.querySelector('#lp-template-groups .lp-group__accordion').open
    );
    check(!afterSecondEnter, device.name + ': pressing Enter did not collapse group');

    // Search makes matching groups visible/open; clearing restores collapse.
    const searched = await landingPage.evaluate(() => {
      const search = document.getElementById('lp-template-search');
      search.value = 'surat izin';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      const groups = [...document.querySelectorAll('#lp-template-groups > .lp-group')];
      const visible = groups.filter(group => !group.hidden);
      return {
        visibleGroups: visible.length,
        openMatching: visible.every(group => group.querySelector('.lp-group__accordion')?.open),
        matchedTemplates: visible.reduce((n, group) =>
          n + [...group.querySelectorAll('.lp-template')].filter(card => !card.hidden).length, 0),
      };
    });
    check(searched.visibleGroups >= 1 && searched.openMatching
      && searched.matchedTemplates >= 1,
      device.name + ': search did not reveal nested matches ' + JSON.stringify(searched));

    const cleared = await landingPage.evaluate(() => {
      const search = document.getElementById('lp-template-search');
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      const groups = [...document.querySelectorAll('#lp-template-groups > .lp-group')];
      return {
        allVisible: groups.every(group => !group.hidden),
        allCollapsed: groups.every(group => !group.querySelector('.lp-group__accordion')?.open),
        allTemplatesVisible: [...document.querySelectorAll('#lp-template-groups .lp-template')]
          .every(card => !card.hidden),
      };
    });
    check(cleared.allVisible && cleared.allCollapsed && cleared.allTemplatesVisible,
      device.name + ': clearing search did not restore collapsed category cards');
    if (device.name === 'mobile-portrait') {
      await landingPage.evaluate(() => document.getElementById('koleksi').scrollIntoView());
      await landingPage.screenshot({
        path: resolve(output, 'mobile-landing-group-accordion.png'), fullPage: false,
      });
    }

    await landingPage.close();

    // Regression: the editor control is an independent, visible work-area
    // toggle at every breakpoint, and remains usable after state changes.
    const drawerProbe = await page.evaluate(() => {
      const button = document.getElementById('editor-drawer-button');
      const root = document.getElementById('editor-drawer');
      const rect = button.getBoundingClientRect();
      const initial = root.dataset.open;
      const isVisible = rect.width > 24 && rect.height >= 40
        && rect.left >= 0 && rect.top >= 0
        && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1
        && getComputedStyle(button).visibility === 'visible';
      const outsideNavbar = !button.closest('.app-header')
        && !button.closest('.preview-toolbar');
      button.click();
      const changed = root.dataset.open !== initial
        && button.getAttribute('aria-expanded') === root.dataset.open;
      button.click();
      return {
        isVisible, outsideNavbar, changed,
        restored: root.dataset.open === initial,
        hasStatusBadge: !!document.getElementById('preview-protection-status'),
      };
    });
    check(drawerProbe.isVisible && drawerProbe.outsideNavbar
      && drawerProbe.changed && drawerProbe.restored && !drawerProbe.hasStatusBadge,
      device.name + ': editor edge action / status removal regression: ' + JSON.stringify(drawerProbe));

    // Use four dummy paper sheets to cover real page navigation, even if the
    // currently selected template normally renders as only one page.
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluate(() => {
      const preview = document.getElementById('surat-preview');
      const viewport = document.getElementById('preview-viewport');
      preview.replaceChildren();
      preview.classList.add('surat-preview--document');
      preview.dataset.pageCount = '4';
      for (let i = 0; i < 4; i++) {
        const paper = document.createElement('div');
        paper.className = 'surat-page';
        paper.style.cssText = 'width:210mm;height:297mm;min-height:297mm;flex:0 0 auto';
        paper.dataset.pageNumber = String(i + 1);
        preview.appendChild(paper);
      }
      viewport.scrollTop = 0;
      DocumentViewer.refresh();
    });
    await rafTwo(page);
    const navBefore = await page.evaluate(() => ({
      toolbarTop: document.querySelector('.preview-toolbar').getBoundingClientRect().top,
      windowY: window.scrollY,
      viewportY: document.getElementById('preview-viewport').scrollTop,
      scrollable: document.getElementById('preview-viewport').scrollHeight
        > document.getElementById('preview-viewport').clientHeight + 50,
    }));
    await page.evaluate(() => document.getElementById('viewer-page-last').click());
    await rafTwo(page);
    const navLast = await page.evaluate(() => ({
      toolbarTop: document.querySelector('.preview-toolbar').getBoundingClientRect().top,
      windowY: window.scrollY,
      viewportY: document.getElementById('preview-viewport').scrollTop,
      pageInput: document.getElementById('viewer-page-current').value,
      toolbarVisible: (() => {
        const toolbar = document.querySelector('.preview-toolbar');
        const panel = document.getElementById('preview-panel');
        const rect = toolbar.getBoundingClientRect(), container = panel.getBoundingClientRect();
        return rect.height >= 30 && rect.top >= container.top - 2
          && rect.bottom <= container.bottom + 2;
      })(),
    }));
    check(navBefore.scrollable && navLast.viewportY > navBefore.viewportY + 250
      && navLast.pageInput === '4'
      && Math.abs(navLast.toolbarTop - navBefore.toolbarTop) < 2
      && Math.abs(navLast.windowY - navBefore.windowY) < 2
      && navLast.toolbarVisible,
      device.name + ': page navigation scrolled the toolbar or wrong ancestor: '
      + JSON.stringify({ navBefore, navLast }));
    await page.evaluate(() => document.getElementById('viewer-page-first').click());
    await rafTwo(page);
    const navFirst = await page.evaluate(() => ({
      top: document.getElementById('preview-viewport').scrollTop,
      pageInput: document.getElementById('viewer-page-current').value,
    }));
    check(navFirst.top < 3 && navFirst.pageInput === '1',
      device.name + ': first-page navigation did not reset preview scroll');

    // Theme must visibly switch with ONE click, and dark branding must
    // contrast with the editor header, in both desktop and mobile layouts.
    const themeProbe = await page.evaluate(() => {
      const button = document.getElementById('btn-theme-toggle');
      Theme.set('auto');
      const before = document.documentElement.dataset.theme;
      button.click();
      const after = document.documentElement.dataset.theme;
      button.click();
      const back = document.documentElement.dataset.theme;
      Theme.set('dark');
      const title = document.querySelector('.app-header__title');
      const header = document.querySelector('.app-header');
      const actionBar = document.querySelector('.app-header__actions');
      const rgb = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const lum = value => {
        const v = rgb(value).map(x => x / 255).map(x =>
          x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4
        );
        return .2126 * v[0] + .7152 * v[1] + .0722 * v[2];
      };
      const a = lum(getComputedStyle(title).color);
      const bg = lum(getComputedStyle(header).backgroundColor);
      return {
        before, after, back,
        contrast: (Math.max(a, bg) + .05) / (Math.min(a, bg) + .05),
        brandVisible: title.getBoundingClientRect().width > 10,
        navbarAlign: getComputedStyle(actionBar).justifyContent,
      };
    });
    check(themeProbe.before !== themeProbe.after && themeProbe.back === themeProbe.before,
      device.name + ': toggle requires more than one click ' + JSON.stringify(themeProbe));
    check(themeProbe.brandVisible && themeProbe.contrast >= 4.5,
      device.name + ': dark editor branding contrast failed ' + JSON.stringify(themeProbe));
    if (device.name === 'desktop') {
      check(themeProbe.navbarAlign.includes('flex-end'),
        'desktop: editor navbar actions are not aligned right');
    }

    if (device.name !== 'desktop') {
      const floating = await page.evaluate(() => {
        const button = document.getElementById('editor-drawer-button');
        const drawer = document.getElementById('editor-drawer');
        const initiallyOpen = drawer.dataset.open === 'true';
        if (!initiallyOpen) button.click();
        const a = button.getBoundingClientRect();
        const workflow = document.getElementById('workflow-actions');
        const w = workflow.getBoundingClientRect();
        const intersects = a.left < w.right && a.right > w.left
          && a.top < w.bottom && a.bottom > w.top;
        const output = {
          intersects,
          button: { top:a.top, bottom:a.bottom, left:a.left, right:a.right },
          workflow: { top:w.top, bottom:w.bottom, left:w.left, right:w.right },
          edgeDocked: a.right >= innerWidth - 2 && a.left >= innerWidth - 70,
          reachable: a.top >= 0 && a.bottom <= innerHeight + 1,
        };
        if (!initiallyOpen) button.click();
        return output;
      });
      check(!floating.intersects && floating.edgeDocked && floating.reachable,
        device.name + ': editor toggle overlaps workflow actions ' + JSON.stringify(floating));
    }

    // The guide section must remain readable against dark surfaces.
    const guideContrast = await landingPage.evaluate(() => {
      document.documentElement.dataset.theme = 'dark';
      document.documentElement.classList.add('dark-mode');
      const rgb = v => (v.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const lum = v => {
        const channels = rgb(v).map(x => x / 255).map(x =>
          x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4
        );
        return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
      };
      return [...document.querySelectorAll('.lp__guide-card')].map(card => {
        const bg = lum(getComputedStyle(card).backgroundColor);
        const fg = lum(getComputedStyle(card.querySelector('h3')).color);
        const body = lum(getComputedStyle(card.querySelector('p')).color);
        const tag = lum(getComputedStyle(card.querySelector('.lp__guide-tag')).color);
        const ratio = value => (Math.max(value, bg) + .05) / (Math.min(value, bg) + .05);
        return { heading:ratio(fg), description:ratio(body), tag:ratio(tag) };
      });
    });
    check(guideContrast.length === 3 && guideContrast.every(x =>
      x.heading >= 4.5 && x.description >= 4.5 && x.tag >= 4.5),
      device.name + ': landing guide text illegible in dark mode ' + JSON.stringify(guideContrast));

    // All six information pages share the same persisted theme and can
    // switch light/dark independently without changing their routes.
    if (device.name === 'desktop' || device.name === 'mobile-portrait') {
      const publicPage = await browser.newPage();
      await publicPage.setViewport({
        width:device.width, height:device.height,
        isMobile:device.isMobile, hasTouch:device.isMobile, deviceScaleFactor:1,
      });
      await publicPage.setRequestInterception(true);
      publicPage.on('request', req => {
        if (new URL(req.url()).origin !== origin) { void req.abort(); return; }
        void req.continue();
      });
      const paths = [
        '/panduan.html','/panduan-cetak-pdf.html','/faq.html',
        '/tentang.html','/privasi.html','/ketentuan.html',
      ];
      for (const route of paths) {
        await publicPage.goto(origin + route, { waitUntil:'domcontentloaded', timeout:25000 });
        await publicPage.waitForFunction(() =>
          typeof Theme !== 'undefined'
          && document.getElementById('btn-theme-toggle')?.dataset.theme === 'dark',
        { timeout:12000 });
        const state = await publicPage.evaluate(() => {
          const button = document.getElementById('btn-theme-toggle');
          const article = document.querySelector('.article');
          const rgb = v => (v.match(/[\d.]+/g) || []).slice(0,3).map(Number);
          const lum = v => {
            const channels = rgb(v).map(x => x / 255).map(x =>
              x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4
            );
            return .2126*channels[0] + .7152*channels[1] + .0722*channels[2];
          };
          const bg = lum(getComputedStyle(article).backgroundColor);
          const fg = lum(getComputedStyle(article.querySelector('p')).color);
          const contrast = (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
          const initiallyDark = document.documentElement.dataset.theme === 'dark';
          button.click();
          const afterLight = document.documentElement.dataset.theme === 'light';
          button.click();
          const afterDark = document.documentElement.dataset.theme === 'dark';
          return { initiallyDark, afterLight, afterDark, contrast };
        });
        check(state.initiallyDark && state.afterLight && state.afterDark && state.contrast >= 4.5,
          device.name + ': public theme/contrast failed on ' + route + ': '+JSON.stringify(state));
      }
      await publicPage.close();
    }

    report.viewports.push({
      name: device.name, viewport: device.width + 'x' + device.height,
      status: 'PASS', pages: geometry.pageCount,
      initialEnabled: true, watermarkAligned: true,
      strictMaskRestores: true, standardMode: true,
      interactionsScoped: true, exportedPayloadClean: true,
      serverSponsorGatePreserved: 'client guard only; server covered by existing suites',
      printLayerHidden: true,
      landingGroupAccordions: landingBaseline.groupAccordions,
      landingTemplates: landingBaseline.nestedTemplates,
      landingSearch: true,
      editorEdgeControl: true,
      toolbarStableOnPageNavigation: true,
      statusLabelRemoved: true,
      themeOneClick: true,
      darkBrandContrast: themeProbe.contrast,
      darkGuideContrast: guideContrast,
      mobileToggleClearOfWorkflow: device.name === 'desktop' ? null : true,
      publicDarkPagesVerified: device.name === 'desktop' || device.name === 'mobile-portrait',
      pageErrors: [],
    });
    console.info('[PP04 UAT PASS]', device.name, JSON.stringify({
      pages: geometry.pageCount, maxGeometryErrorPx: geometry.maxGeometryErrorPx,
      checkedTemplates: report.templateResults.length,
    }));
    await page.close();
  }
  report.status = 'PASS';
} catch (error) {
  failed = String(error?.stack || error);
  report.status = 'FAILED';
  report.error = failed;
  console.error('[PP04 UAT FAILED]', failed);
} finally {
  await browser?.close().catch(() => {});
  if (server.listening) await new Promise(resolve => server.close(resolve));
  report.generatedAt = new Date().toISOString();
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'summary.json'), JSON.stringify(report, null, 2));
  if (failed) process.exitCode = 1;
}
