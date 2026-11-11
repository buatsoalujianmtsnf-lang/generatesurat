/* =============================================================
   globals.d.ts — Deklarasi global untuk semua IIFE module
   =============================================================
   Setiap file JS di proyek ini menggunakan pola IIFE dan di-load
   sebagai <script> klasik di index.html, sehingga variabelnya
   bersifat global di runtime. File ini memberitahu TypeScript
   tentang keberadaan variabel-variabel tersebut.
*/

/** Runtime storage API from js/storage.js (not the DOM Storage constructor). */
type GeneratorStorageApi = {
  init(options?: { onExpired?: (record: unknown) => void }): { available: boolean; hasData: boolean; expired: boolean; record?: unknown };
  load(): Record<string, unknown> | null;
  save(data: unknown, options?: { replaceExpired?: boolean }): { success: boolean; reason?: string; lastSavedAt?: number; expiresAt?: number };
  clear(): boolean;
  getMeta(): { lastSavedAt: number; expiresAt: number; version: string; remaining: unknown; expired: boolean } | null;
  getRecovery(): { id: string; data: any; source?: string } | null;
  removeRecovery(id: string): boolean;
  clearRecovery(): boolean;
  isAvailable(): boolean;
  checkExpiry(): boolean;
  readonly TTL_DURATION_MS: number;
};

declare var EditorDrawer: { init(): void; open(options?: {focus?: boolean}): void; close(options?: {returnFocus?: boolean}): void; isCompact(): boolean };
declare var AppIcons: { svg(name: string, className?: string): string; apply(root?: Document | Element): void }; 
declare var XLSX: any;
declare var TemplateDPU: any;
declare var TemplateMutasiMasuk: any;
declare var TemplateSiswaBaru: any;
declare var TemplateIjopPermohonan: any;
declare var TemplateIjopSptjmSatpen: any;
declare var TemplateIjopRekomendasiPengawas: any;
declare var TemplateIjopRekomendasiKankemenag: any;
declare var TemplateIjopSptjmKankemenag: any;
declare var TemplateRekapNilai: any;
declare var TemplateSuratIzin: any;
declare var TemplateSuratPermohonanPindah: any;
declare var TemplateSuratKeteranganPindah: any;
declare var TemplateSuratPemberitahuanKegiatan: any;
declare var TemplateSuratKeteranganSiswaAktif: any;
declare var TemplateSuratPanggilanOrangTua: any;
declare var TemplateSuratPerjanjianSiswa: any;
declare var TemplateBeritaAcaraPertemuanOrtu: any;
declare var About: any;
declare var App: any;
declare var Routes: any;
declare var IzinDeclaration: any;
declare var DataIO: any;
declare var DataManager: any;
declare var DocumentViewer: any;
declare var ExcelImport: any;
declare var FormRenderer: any;
declare var KopEditor: any;
declare var PdfExport: any;
declare var Platform: any;
declare var PreviewRenderer: any;
declare var Print: any;
declare var Settings: any;
declare var SignaturePad: any;
declare var State: any;
declare var Storage: GeneratorStorageApi;
declare var TableConfigManager: any;
declare var TableConfigUI: any;
declare var TableRenderer: any;
declare var TemplateRegistry: any;
declare var Theme: any;
declare var UI: any;
declare var Utils: any;
declare var Validation: any;
declare var Workflow: any;

/** MON-04 first-party sponsor video state and dialog; gate not enabled until MON-05. */
declare var SponsorVideoState: { transition(state: string, event: string): string; states: readonly string[] };
declare var SponsorVideoModal: {
  request(options?: { action?: 'print' | 'pdf'; source?: 'button' | 'keyboard' }): Promise<{ action: 'print' | 'pdf'; receipt: string; expiresAt: number } | null>;
  cancel(): void;
  getState(): string;
};

/** MON-05 export gate and keyboard shortcut controller. */
declare var SponsorExportGate: {
  init():void;
  run(options:{action:'print'|'pdf';source?:'button'|'keyboard'},invoke:(grant:{receipt:string,expiresAt:number}|null)=>unknown):boolean;
  isRequired():boolean;
  isPending():boolean;
  onKeyboard(event:KeyboardEvent):void;
};
