/**
 * MON-02: pemeriksa kontrak/materi sponsor yang aman sebelum rilis.
 * Tidak ada koneksi jaringan atau ad SDK, dan tidak mengaktifkan gate.
 * Node 22 ESM; format JSON bersifat kontrol rilis, bukan bukti hukum tunggal.
 */
import { readFileSync, statSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const STATES = new Set(['draft', 'in_review', 'approved', 'paused', 'archived']);
const REQUIRED_APPROVALS = [
  'agreementSigned',
  'rightsVerified',
  'contentApproved',
  'privacyApproved',
  'operatorApproved',
];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function safeLocalPath(path, prefix, extension) {
  if (typeof path !== 'string' || !path.startsWith(prefix)
    || !/^[A-Za-z0-9/_-]+\.[a-z0-9]+$/.test(path)
    || path.includes('//') || path.includes('..') || path.includes('\\')
    || (extension && !extension.includes(extname(path)))) return false;
  const full = resolve(PROJECT_ROOT, path);
  const base = resolve(PROJECT_ROOT, prefix);
  return full.startsWith(base + sep);
}
function isoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}
function httpsDestination(value) {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password
      && !u.search && !u.hash && u.href === value;
  } catch { return false; }
}

/** Baca media nyata dengan ffprobe, SHA-256 dan stat; tidak mempercayai metadata JSON. */
export function inspectVideo(filePath) {
  const full = resolve(PROJECT_ROOT, filePath);
  const stat = statSync(full);
  if (!stat.isFile()) throw new Error('asset bukan berkas reguler');
  const info = JSON.parse(execFileSync('ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,codec_type,width,height', '-of', 'json', full],
    { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 }));
  const video = info.streams?.find(stream => stream.codec_type === 'video');
  if (!video) throw new Error('ffprobe tidak menemukan stream video');
  return {
    durationSeconds: Number(info.format?.duration),
    codec: video.codec_name,
    width: video.width,
    height: video.height,
    bytes: stat.size,
    sha256: createHash('sha256').update(readFileSync(full)).digest('hex')
  };
}

/**
 * Dependency injection hanya untuk test. Saat CLI inspectVideo harus nyata.
 * @returns {{ok:boolean,errors:string[],approvedCount:number,enabled:boolean}}
 */
export function validateSponsorRegistry(policy, registry, inspect = inspectVideo) {
  const errors = [];
  const error = (location, message) => errors.push(location + ': ' + message);
  if (!isRecord(policy) || policy.schemaVersion !== 1) {
    return { ok: false, errors: ['policy: schemaVersion harus 1'], approvedCount: 0, enabled: false };
  }
  if (!isRecord(registry) || registry.schemaVersion !== 1 || !Array.isArray(registry.campaigns)) {
    return { ok: false, errors: ['registry: format katalog tidak valid'], approvedCount: 0, enabled: false };
  }
  if (typeof policy.enabled !== 'boolean' || typeof registry.enabled !== 'boolean') {
    error('enabled', 'harus boolean eksplisit');
  }
  if (policy.releasePhase !== 'prelaunch' && policy.releasePhase !== 'production') {
    error('policy', 'releasePhase tidak dikenal');
  }
  if (policy.frequency !== 'every-new-action'
    || JSON.stringify(policy.exportActions) !== JSON.stringify(['print', 'pdf', 'keyboard-print'])) {
    error('policy', 'kewajiban tindakan harus sesuai blueprint');
  }
  const videoRules = policy.video;
  if (!isRecord(videoRules) || videoRules.requiredDurationSeconds !== 15
    || videoRules.firstPartyOnly !== true
    || videoRules.mediaRoot !== 'assets/sponsors/'
    || !Number.isFinite(videoRules.durationToleranceSeconds)
    || videoRules.durationToleranceSeconds < 0 || videoRules.durationToleranceSeconds > 0.25
    || videoRules.maxBytes > 10485760 || videoRules.maxBytes <= 0
    || videoRules.playbackRate !== 1
    || videoRules.skippable !== false || videoRules.clickRequired !== false) {
    error('policy.video', 'spesifikasi 15 detik dan keamanan konten wajib dipertahankan');
  }
  const eligible = policy.eligibility;
  if (!isRecord(eligible)
    || eligible.noDocumentData !== true || eligible.noUserTargeting !== true
    || eligible.noThirdPartyPixels !== true || eligible.noForcedClicks !== true
    || eligible.requirePublisherDisclosure !== true
    || !Array.isArray(eligible.requiredApprovals)
    || REQUIRED_APPROVALS.some(key => !eligible.requiredApprovals.includes(key))) {
    error('policy.eligibility', 'syarat hak, moderasi, privasi, dan disclosure belum terpenuhi');
  }
  if (!isRecord(policy.behavior) || policy.behavior.pdfServerVerificationRequired !== true
    || policy.behavior.printBrowserBestEffort !== true || policy.behavior.noVideoInsideExport !== true) {
    error('policy.behavior', 'batas enforcement dan kebersihan dokumen tidak boleh dilonggarkan');
  }
  if (registry.enabled && (!policy.enabled || policy.releasePhase !== 'production')) {
    error('registry.enabled', 'kampanye tidak boleh aktif sebelum status production dan policy enabled');
  }
  const seen = new Set();
  let approvedCount = 0;
  for (const [index, c] of registry.campaigns.entries()) {
    const where = 'campaigns[' + index + ']';
    if (!isRecord(c)) { error(where, 'harus object'); continue; }
    if (typeof c.id !== 'string' || !ID_PATTERN.test(c.id) || seen.has(c.id)) {
      error(where + '.id', 'ID tidak valid atau duplikat');
    }
    seen.add(c.id);
    if (!STATES.has(c.status)) error(where + '.status', 'status tidak valid');
    if (typeof c.sponsorDisplayName !== 'string'
      || c.sponsorDisplayName.trim().length < 3 || c.sponsorDisplayName.length > 120) {
      error(where + '.sponsorDisplayName', 'nama tampilan wajib diisi');
    }
    if (c.destinationUrl !== null && c.destinationUrl !== undefined
      && !httpsDestination(c.destinationUrl)) {
      error(where + '.destinationUrl', 'harus URL HTTPS tanpa tracking query/fragment');
    }
    if (c.thirdPartyTracking !== undefined && c.thirdPartyTracking !== false) {
      error(where + '.thirdPartyTracking', 'pelacakan sponsor pihak ketiga dilarang');
    }
    if (c.targeting !== undefined && c.targeting !== null) {
      error(where + '.targeting', 'profil/targeting pengguna dilarang');
    }
    const datesOk = isoDate(c.startsAt) && isoDate(c.endsAt)
      && Date.parse(c.startsAt) < Date.parse(c.endsAt);
    if (!datesOk) error(where + '.schedule', 'rentang UTC wajib sah dan terurut');
    if (c.status !== 'approved') continue;
    approvedCount++;
    const approvals = c.approvals;
    for (const key of REQUIRED_APPROVALS) {
      if (!isRecord(approvals) || approvals[key] !== true) {
        error(where + '.approvals.' + key, 'persetujuan tertulis/operator wajib lengkap');
      }
    }
    if (!isRecord(c.agreement)
      || typeof c.agreement.reference !== 'string'
      || !/^[A-Z0-9/_-]{5,80}$/.test(c.agreement.reference)
      || !isoDate(c.agreement.signedAt)
      || (datesOk && Date.parse(c.agreement.signedAt) > Date.parse(c.endsAt))) {
      error(where + '.agreement', 'referensi kontrak dan tanggal penandatanganan wajib valid');
    }
    const m = c.media;
    if (!isRecord(m)) { error(where + '.media', 'video asli wajib disediakan'); continue; }
    const extension = isRecord(videoRules?.allowedFormats) ? videoRules.allowedFormats[m.mimeType] : null;
    if (!extension || !safeLocalPath(m.path, videoRules.mediaRoot, [extension])) {
      error(where + '.media.path', 'hanya video lokal di bawah assets/sponsors dengan MIME yang cocok');
      continue;
    }
    if (!SHA256_PATTERN.test(m.sha256 || '')) error(where + '.media.sha256', 'hash SHA-256 wajib valid');
    if (m.captionsPath !== undefined && m.captionsPath !== null
      && !safeLocalPath(m.captionsPath, videoRules.mediaRoot, ['.vtt'])) {
      error(where + '.media.captionsPath', 'subtitle harus file VTT lokal');
    }
    if (m.hasSpeech === true && !m.captionsPath) {
      error(where + '.media.captionsPath', 'subtitle wajib untuk video dengan ucapan');
    }
    if (m.posterPath !== undefined && m.posterPath !== null
      && !safeLocalPath(m.posterPath, videoRules.mediaRoot, ['.webp', '.png', '.jpg'])) {
      error(where + '.media.posterPath', 'poster harus gambar lokal yang diizinkan');
    }
    try {
      const actual = inspect(m.path);
      if (!actual || !Number.isFinite(actual.durationSeconds)
        || Math.abs(actual.durationSeconds - 15) > videoRules.durationToleranceSeconds) {
        error(where + '.media.duration', 'durasi aktual ffprobe bukan 15 detik');
      }
      if (!Number.isInteger(actual.bytes) || actual.bytes <= 0
        || actual.bytes > videoRules.maxBytes) {
        error(where + '.media.size', 'ukuran video melampaui batas');
      }
      if (!Number.isInteger(actual.width) || !Number.isInteger(actual.height)
        || actual.width < 320 || actual.height < 180
        || actual.width > videoRules.maxWidth || actual.height > videoRules.maxHeight) {
        error(where + '.media.resolution', 'resolusi tidak sesuai standar');
      }
      if (!videoRules.allowedVideoCodecs?.[m.mimeType]?.includes(actual.codec)) {
        error(where + '.media.codec', 'codec tidak didukung untuk format video');
      }
      if (actual.sha256 !== m.sha256) {
        error(where + '.media.sha256', 'hash materi tidak sama dengan file yang telah disetujui');
      }
    } catch (cause) {
      error(where + '.media', 'file fisik/ffprobe tidak dapat diverifikasi: ' + cause.message);
    }
  }
  if (registry.enabled && approvedCount === 0) {
    error('registry', 'tidak ada kampanye approved untuk tayangan aktif');
  }
  return { ok: errors.length === 0, errors, approvedCount, enabled: policy.enabled && registry.enabled };
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const policy = JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'config/sponsor-policy.json'), 'utf8'));
  const registry = JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'config/sponsor-campaigns.json'), 'utf8'));
  const result = validateSponsorRegistry(policy, registry);
  if (!result.ok) {
    for (const issue of result.errors) console.error('[sponsor-contract] ' + issue);
    process.exitCode = 1;
  } else {
    console.info('[sponsor-contract] Valid: ' + result.approvedCount
      + ' kampanye approved; gerbang aktif: ' + result.enabled);
  }
}
