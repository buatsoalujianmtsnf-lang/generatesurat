import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it, expect } from 'vitest';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
describe('Stage 1–3 editor integration', () => {
  it('provides accessible mode and save feedback without replacing tabs', () => {
    const html = read('index.html');
    expect(html).toContain('id="editor-mode"');
    expect(html).toContain('id="editor-save-status" role="status"');
    expect(html).toContain('role="tablist"');
    expect(read('js/editor-experience.js')).toContain("State.on(event, refreshStatus)");
  });
  it('uses an atomic KOP change with explicit consent', () => {
    const profile = read('js/institution-profile.js');
    const state = read('js/state.js');
    expect(profile).toContain('UI.confirm');
    expect(profile).toContain('State.replaceKop(kop)');
    expect(profile).toContain("localStorage.setItem");
    expect(state).toMatch(/function replaceKop\(kop\) \{[\s\S]*?_historyPush\(\)/);
    expect(read('js/kop-editor.js')).toContain('refresh: _render');
  });
  it('supports actionable checks without bypassing export validation', () => {
    const ui = read('js/document-preflight.js');
    const flow = read('js/workflow.js');
    expect(ui).toContain('Workflow.collectIssues()');
    expect(ui).toContain('PreviewRenderer.waitForReady()');
    expect(ui).toContain('snapshot !== revision');
    expect(ui).toContain('Workflow.focusIssue');
    expect(flow).toContain('collectIssues: _collectPrintChecks');
    expect(flow).toContain('focusIssue: _focusError');
    expect(flow).toContain('const errors = _collectPrintChecks()');
    expect(read('sw.js')).toContain("CACHE_PREFIX + 'v69'");
  });
});

describe('Stage 1–3 behavior', () => {
  it('restores mode preference and announces unsaved changes', () => {
    const store = new Map([['generatesurat-editor-mode-v1','advanced']]);
    const listeners = {};
    const modeInput = { value: '', addEventListener(name, fn) { listeners[name] = fn; } };
    const status = { textContent: '', dataset: {} };
    const doc = {
      documentElement: { dataset: {} },
      querySelector: () => null,
      getElementById: id => id === 'editor-mode' ? modeInput : id === 'editor-save-status' ? status : null,
    };
    let dirty = true;
    const state = { isDirty: () => dirty, getState: () => ({ storage: { lastSavedAt: 100 } }), on() {} };
    const localStorage = { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) };
    const ctx = { document: doc, State: state, localStorage };
    runInNewContext(read('js/editor-experience.js') + '\nglobalThis.editorApi = EditorExperience;', ctx);
    ctx.editorApi.init();
    expect(doc.documentElement.dataset.editorMode).toBe('advanced');
    expect(status.dataset.state).toBe('dirty');
    dirty = false;
    ctx.editorApi.refreshStatus();
    expect(status.dataset.state).toBe('saved');
    ctx.editorApi.setMode('simple');
    expect(store.get('generatesurat-editor-mode-v1')).toBe('simple');
  });
  it('warns when a rendered page exceeds its measurable bounds', () => {
    const page = {
      dataset: { pageNumber: '2' }, clientWidth: 200, scrollWidth: 240,
      clientHeight: 300, scrollHeight: 300, textContent: 'Surat',
      querySelector: () => null,
    };
    const ctx = {
      State: { getActiveTemplate: () => 'dpu' },
      document: { getElementById: id => id === 'surat-preview' ? { querySelectorAll: () => [page] } : null },
    };
    runInNewContext(read('js/document-preflight.js') + '\nglobalThis.preflightApi = DocumentPreflight;', ctx);
    const warnings = ctx.preflightApi.collectLayoutWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Halaman 2');
  });
});
