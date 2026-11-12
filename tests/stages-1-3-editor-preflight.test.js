import { readFileSync } from 'node:fs';
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
