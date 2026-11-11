import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe,expect,it,vi} from 'vitest';

const code=readFileSync(new URL('../js/about.js',import.meta.url),'utf8');

function createAbout(){
  const listeners=new Map();
  const button={
    addEventListener:vi.fn((name,fn)=>{
      listeners.set(name,fn);
    })
  };
  const showModal=vi.fn();
  const localStorage={getItem:vi.fn(()=>null),setItem:vi.fn()};
  const requestAnimationFrame=vi.fn();
  const document={
    getElementById:vi.fn(id=>id==='btn-about'?button:null),
    querySelector:vi.fn(()=>null),
  };
  const globals={UI:{showModal},localStorage,requestAnimationFrame,document};
  runInNewContext(code,globals);
  const About=runInNewContext('About',globals);
  return {About,listeners,button,document,showModal,localStorage,requestAnimationFrame};
}
describe('first-visit welcome modal removal',()=>{
  it('does not automatically open any modal, including in a fresh browser',()=>{
    const a=createAbout();
    a.About.init();
    expect(a.button.addEventListener).toHaveBeenCalledOnce();
    expect(a.listeners.has('click')).toBe(true);
    expect(a.showModal).not.toHaveBeenCalled();
    expect(a.requestAnimationFrame).not.toHaveBeenCalled();
    expect(a.localStorage.getItem).not.toHaveBeenCalled();
    expect(a.localStorage.setItem).not.toHaveBeenCalled();
    a.About.init();
    expect(a.button.addEventListener).toHaveBeenCalledOnce();
  });

  it('preserves the About dialog on explicit button click, with no required consent',()=>{
    const a=createAbout();
    a.About.init();
    a.listeners.get('click')();
    expect(a.showModal).toHaveBeenCalledOnce();
    const dialog=a.showModal.mock.calls[0][0];
    expect(dialog.title).toBe('Tentang / About');
    expect(dialog.body).toContain('Generate Suratku');
    expect(dialog.body).toContain('Syarat dan Ketentuan');
    expect(dialog.body).toContain('Ekspor PDF');
    expect(dialog.body).not.toContain('about-consent-checkbox');
    expect(dialog.body).not.toContain('S&amp;K penggunaan aplikasi telah disetujui pada perangkat ini.');
    expect(dialog.footer[0].label).toBe('Tutup');
    expect(dialog.showCloseButton).toBe(true);
    expect(dialog.closeOnBackdrop).toBe(true);
    expect(dialog.closeOnEscape).toBe(true);
    expect(a.localStorage.setItem).not.toHaveBeenCalled();
  });

  it('keeps manual About.open accessible when the header button is absent',()=>{
    const a=createAbout();
    a.document.getElementById=vi.fn(()=>null);
    a.About.init();
    expect(a.showModal).not.toHaveBeenCalled();
    a.About.open();
    expect(a.showModal).toHaveBeenCalledOnce();
    expect(a.showModal.mock.calls[0][0].title).toBe('Tentang / About');
  });

  it('removes legacy acceptance scripts, first-visit blockers and styles',()=>{
    const css=readFileSync(new URL('../css/about.css',import.meta.url),'utf8');
    const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
    const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
    expect(code).not.toMatch(/Selamat Datang di Generate Suratku|firstVisit|CONSENT_KEY|_hasAccepted|_saveAcceptance/);
    expect(code).not.toMatch(/requestAnimationFrame|about-consent-checkbox/);
    expect(css).not.toMatch(/\.about-consent-box|\.about-acknowledged/);
    expect(app).toContain('About.init()');
    expect(sw).toContain("CACHE_PREFIX + 'v57'");
    expect(sw).toContain("'./js/about.js'");
    expect(sw).toContain("'./css/about.css'");
  });
});
