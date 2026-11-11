import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const index = read('index.html');
const renderer = read('js/preview-renderer.js');
const viewer = read('js/document-viewer.js');
const print = read('js/print.js');
const printCss = read('css/print.css');
const pdf = read('js/pdf-export.js');
const pdfServer = read('api/export-pdf.js');
const sponsor = read('js/sponsor-export-gate.js');

describe('PP-00 — existing preview / print / PDF baseline contracts', () => {
  it('keeps the document preview in its dedicated viewer scroll and zoom subtree', () => {
    const nodes = [
      'id="preview-panel"',
      'id="preview-viewport"',
      'id="preview-canvas-wrapper"',
      'id="surat-preview"',
    ];
    let preceding = -1;
    for (const node of nodes) {
      const at = index.indexOf(node);
      expect(at, node).toBeGreaterThan(preceding);
      preceding = at;
    }
    expect(index).toContain('<div id="surat-preview" class="surat-preview">');
    expect(renderer).toContain('_previewEl.innerHTML = html;');
  });

  it('loads all 17 editor templates and retains async pagination readiness', () => {
    const templates = [...index.matchAll(/<script\b[^>]*src="(templates\/[^"]+\.js)"/g)]
      .map(match => match[1]);
    expect(templates).toHaveLength(17);
    expect(new Set(templates).size).toBe(templates.length);
    for (const path of templates) {
      expect(existsSync(new URL('../' + path, import.meta.url)), path).toBe(true);
    }
    expect(renderer).toContain('_renderToken');
    expect(renderer).toContain('_paginateDpuPreview(');
    expect(renderer).toContain('async function _paginatePreview(');
    expect(renderer).toContain('waitForReady');
  });

  it('preserves zoom, viewer refresh, fullscreen/fallback, and input-safe navigation', () => {
    expect(renderer).toContain('scale(');
    expect(renderer).toContain('DocumentViewer.refresh()');
    expect(viewer).toContain('await panel.requestFullscreen()');
    expect(viewer).toContain("panel.classList.toggle('viewer-focus-mode', _fullscreenFallback)");
    expect(viewer).toContain("['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)");
    expect(viewer).toContain('if (target.isContentEditable) return false;');
  });

  it('snapshots the document element for PDF and verifies sponsor on the server', () => {
    expect(pdf).toContain("const preview = document.getElementById('surat-preview')");
    expect(pdf).toContain('html: preview.outerHTML');
    expect(pdf).toContain('css: await _collectStylesheets()');
    expect(pdfServer).toContain('verifyPdfSponsorReceipt(');
    expect(pdfServer).toContain('await page.pdf(');
  });

  it('keeps print readiness, sponsor authorization, keyboard interception and paper styles', () => {
    expect(print).toContain('await PreviewRenderer.waitForReady()');
    expect(print).toContain('window.print()');
    expect(print).toContain("dataset.sponsorPrintAuthorized = 'true'");
    expect(sponsor).toContain("document.addEventListener('keydown', onKeyboard, true)");
    expect(printCss).toContain('html[data-sponsor-gate="required"]');
    expect(printCss).toContain('.surat-page');
    expect(printCss).toContain('@media print');
  });

  it('precaches all existing preview-related assets for offline PWA', () => {
    const sw = read('sw.js');
    for (const asset of [
      './css/preview.css',
      './css/print.css',
      './css/document-viewer.css',
      './js/preview-renderer.js',
      './js/document-viewer.js',
      './js/print.js',
      './js/pdf-export.js',
    ]) {
      expect(sw, asset).toContain("'" + asset + "'");
    }
  });
});
