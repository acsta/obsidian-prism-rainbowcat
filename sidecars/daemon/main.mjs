// Obsidian Prism Native Sidecar Daemon (sidecars/daemon/main.mjs)
// - Auto-discovers DevToolsActivePort across Windows/macOS/Linux + fast Target.setDiscoverTargets push
// - Registers Page.addScriptToEvaluateOnNewDocument + Runtime.evaluate (survives Ctrl+Shift+R reloads with zero app.asar touch!)
// - Hot-upgrades legacy instances to Obsidian Prism v1.0.7
// - Lazily serves real MetricsStore + DesktopUsage snapshots over __agPrismMetricsCall only when requested (0 idle CPU)
// - Registers __agPrismRepoCall (paired with window.__agPrismRepoBridge) for live Git status & safe git pull --ff-only + hot-reload!

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OmniServer, OMNI_BINDING, isBlockedUncPath } from '../../vendor/omni-viewer/omni-server.mjs';
import {
  buildRendererRpcExpression,
  extractModelLabelMap,
  normalizeRendererUserStatus,
  normalizeRendererQuotaSummary,
  normalizeRendererSummaries,
  normalizeRendererTrajectory,
} from '../../vendor/pulse-dashboard/sidecars/panel/renderer-rpc-adapter.mjs';
import { discoverLocalConversations } from '../../vendor/pulse-dashboard/sidecars/panel/local-conversations.mjs';
import { UpdateService, RELEASES_PAGE_URL } from './update-service.mjs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..', '..');
const defaultCdp = require(path.join(DEFAULT_ROOT_DIR, 'cdp.js'));

export const METRICS_BINDING = '__agPrismMetricsCall';
export const REPO_BINDING = '__agPrismRepoCall';
export const THOUGHT_BINDING = '__agPrismThoughtCall';
export const USAGE_BINDING = '__agPrismUsageCall';
export const INLINE_DIFF_BINDING = '__agPrismInlineDiffCall';
export const SIDEBAR_BINDING = '__agPrismSidebarCall';
export const WALLPAPER_BINDING = '__agPrismWallpaperCall';
export { OmniServer, OMNI_BINDING };
const WALLPAPER_MAX_PAYLOAD_BYTES = 131072;
const WALLPAPER_ALLOWED_ACTIONS = new Set([
  'get-config',
  'save-config',
  'pick-media',
  'clear-media',
  'get-media-blob',
  'status',
]);
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RPC_ROUTE_STORAGE = new AsyncLocalStorage();
const USAGE_CACHE_MAX_BYTES = 4 * 1024 * 1024;
const USAGE_CACHE_MAX_PER_SCOPE = 1200;
const USAGE_CACHE_MAX_SCOPES = 32;
const USAGE_CACHE_MAX_TOTAL_RECORDS = 2400;
const FORBIDDEN_SCOPE_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

export function resolveUsageCachePath(customPath = null) {
  if (typeof customPath === 'string' && customPath.trim()) {
    return path.resolve(customPath.trim());
  }
  const envPath = typeof process.env.PRISM_USAGE_CACHE_PATH === 'string' ? process.env.PRISM_USAGE_CACHE_PATH.trim() : '';
  if (envPath) {
    return path.resolve(envPath);
  }
  return path.join(os.homedir(), '.gemini', 'config', 'obsidian-prism-usage-rollup-cache.json');
}

function sanitizeScopeSegment(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  try {
    s = decodeURIComponent(s);
  } catch {}
  // VS Code Remote-SSH 有时将 authority JSON 编码为 hex 字符串（如 {"hostName":"prod-box"}）
  if (/^[0-9a-f]{8,}$/i.test(s) && s.length % 2 === 0 && s.length <= 512) {
    try {
      const decoded = Buffer.from(s, 'hex').toString('utf8');
      if (decoded.startsWith('{') && decoded.endsWith('}')) {
        const parsed = JSON.parse(decoded);
        const hostCand = parsed?.hostName || parsed?.host || parsed?.authority || '';
        if (typeof hostCand === 'string' && hostCand.trim()) s = hostCand.trim();
      }
    } catch {}
  }
  const clean = s
    .toLowerCase()
    .replace(/[^a-z0-9._:@-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (!clean || FORBIDDEN_SCOPE_SEGMENTS.has(clean)) return '';
  return clean;
}

export function normalizeUsageScopeKey(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const low = s.toLowerCase();
  if (low === 'local') return 'local';
  if (low.startsWith('ssh:')) {
    const host = sanitizeScopeSegment(s.slice(4));
    return host ? `ssh:${host}` : '';
  }
  if (low.startsWith('remote:')) {
    const id = sanitizeScopeSegment(s.slice(7));
    return id ? `remote:${id}` : '';
  }
  const fromUri = extractScopeKeyFromUri(s);
  if (fromUri) return fromUri;
  const fromTitle = extractScopeKeyFromTitle(s);
  if (fromTitle) return fromTitle;
  return '';
}

export function extractScopeKeyFromUri(rawUri) {
  let s = String(rawUri || '').trim();
  if (!s) return '';
  try {
    s = decodeURIComponent(s);
  } catch {}
  // 检查 URL query 中的 remoteAuthority=...
  const qm = s.match(/[?&#]remoteAuthority=([^&#\s]+)/i);
  const candidate = qm && qm[1] ? qm[1] : s;
  const sshMatch = candidate.match(/(?:^|vscode-remote:\/\/)ssh-remote\+([^/&#?\s]+)/i);
  if (sshMatch && sshMatch[1]) {
    const host = sanitizeScopeSegment(sshMatch[1]);
    return host ? `ssh:${host}` : '';
  }
  const remoteMatch = candidate.match(/(?:^|vscode-remote:\/\/)([a-z0-9_-]+)\+([^/&#?\s]+)/i);
  if (remoteMatch && remoteMatch[1] && remoteMatch[2]) {
    const kind = sanitizeScopeSegment(remoteMatch[1]);
    const target = sanitizeScopeSegment(remoteMatch[2]);
    if (kind === 'ssh-remote') return target ? `ssh:${target}` : '';
    const combined = sanitizeScopeSegment(`${kind}-${target}`);
    return combined ? `remote:${combined}` : '';
  }
  return '';
}

export function extractScopeKeyFromTitle(rawTitle) {
  const s = String(rawTitle || '').trim();
  if (!s) return '';
  const sshMatch = s.match(/\[SSH:\s*([^\]]+)\]/i);
  if (sshMatch && sshMatch[1]) {
    const host = sanitizeScopeSegment(sshMatch[1]);
    return host ? `ssh:${host}` : '';
  }
  const remMatch = s.match(/\[(WSL|Dev Container|Codespaces|Tunnel|Remote):\s*([^\]]+)\]/i);
  if (remMatch && remMatch[1] && remMatch[2]) {
    const combined = sanitizeScopeSegment(`${remMatch[1]}-${remMatch[2]}`);
    return combined ? `remote:${combined}` : '';
  }
  return '';
}

function inferRemoteScopeFromSummariesOrItems(records) {
  if (!Array.isArray(records) || records.length === 0) return '';
  let remoteScope = '';
  let remoteCount = 0;
  let localFileCount = 0;
  for (const item of records) {
    if (!item || typeof item !== 'object') continue;
    const uris = [];
    if (Array.isArray(item.workspaces)) {
      for (const w of item.workspaces) {
        if (typeof w === 'string' && w) uris.push(w);
        else if (w && typeof w === 'object') {
          const u = w.workspaceFolderAbsoluteUri || w.gitRootAbsoluteUri || w.uri || w.path || '';
          if (u) uris.push(String(u));
        }
      }
    }
    for (const single of [item.workspaceUri, item.workspacePath, item.workspace]) {
      if (typeof single === 'string' && single) uris.push(single);
    }
    let itemRemote = '';
    let itemLocal = false;
    for (const u of uris) {
      const sc = extractScopeKeyFromUri(u);
      if (sc) {
        itemRemote = sc;
        break;
      }
      if (/^file:\/\//i.test(u) || /^[a-z]:[\\/]/i.test(u)) {
        itemLocal = true;
      }
    }
    if (itemRemote) {
      if (!remoteScope) remoteScope = itemRemote;
      remoteCount += 1;
    } else if (itemLocal) {
      localFileCount += 1;
    }
  }
  // 只有存在明确远程工作区 URI 且未被本机 file:// 主导时才推断为远程 scope
  if (remoteScope && remoteCount > 0 && remoteCount >= localFileCount) {
    return remoteScope;
  }
  return '';
}

export function resolveUsageScopeKey({ explicitScopeKey = '', entry = null, items = null, summaries = null } = {}) {
  const explicit = normalizeUsageScopeKey(explicitScopeKey);
  if (explicit && explicit !== 'local') return explicit;
  if (entry && typeof entry === 'object') {
    const fromDetected = normalizeUsageScopeKey(entry.detectedScopeKey || entry.scopeKey || '');
    if (fromDetected && fromDetected !== 'local') return fromDetected;
    const fromUrl = extractScopeKeyFromUri(entry.url);
    if (fromUrl) return fromUrl;
    const fromTitle = extractScopeKeyFromTitle(entry.title);
    if (fromTitle) return fromTitle;
  }
  const fromItems = inferRemoteScopeFromSummariesOrItems(items);
  if (fromItems) return fromItems;
  const fromSums = inferRemoteScopeFromSummariesOrItems(summaries);
  if (fromSums) return fromSums;
  if (explicit === 'local') return 'local';
  return 'local';
}

function hasRealUsageRecord(record) {
  if (!record || typeof record !== 'object' || !record.days || typeof record.days !== 'object') return false;
  if (Number(record.calls || 0) > 0) return true;
  for (const d of Object.values(record.days)) {
    if (!d || typeof d !== 'object') continue;
    if (Number(d.total || d.tokens || 0) > 0 || Number(d.calls || 0) > 0) return true;
  }
  return false;
}

function execGit(args, cwd, timeoutMs = 12000, extraConfigs = []) {
  const cfgFlags = [
    '-c',
    'protocol.ext.allow=never',
    '-c',
    'submodule.recurse=false',
    '-c',
    'core.fsmonitor=false',
  ];
  for (const flag of extraConfigs) cfgFlags.push(flag);
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      [...cfgFlags, ...args],
      { cwd, encoding: 'utf8', windowsHide: true, timeout: timeoutMs, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const msg = String(stderr || err.message || 'git command failed').trim();
          reject(new Error(msg));
          return;
        }
        resolve(String(stdout || '').trim());
      }
    );
  });
}

const SECRET_TOKEN_RE =
  /(sk-[A-Za-z0-9_\-]{6,}|AIza[A-Za-z0-9_\-]{12,}|xai-[A-Za-z0-9_\-]{8,}|ghp_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{12,}|Bearer\s+[A-Za-z0-9._\-]{8,})/gi;

function sanitizeSecretText(text) {
  return String(text || '')
    .replace(/https?:\/\/[^/\s:@]+:[^/\s@]+@/gi, 'https://***@')
    .replace(SECRET_TOKEN_RE, '***REDACTED***');
}

function serializeJsonForEval(val) {
  const raw = JSON.stringify(val === undefined ? null : val);
  return String(raw).replace(/[<>/\u2028\u2029]/g, (ch) =>
    `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

export function sanitizeGitRemoteUrl(rawUrl) {
  const s = String(rawUrl || '').trim();
  if (!s) return '';
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      u.username = '';
      u.password = '';
      u.search = '';
      u.hash = '';
      return u.toString();
    }
  } catch {}
  return s.replace(/\/\/[^/\s:@]+:[^/\s@]+@/, '//');
}

function assertNotSymlinkSync(targetPath, label = 'path') {
  try {
    const st = fs.lstatSync(targetPath);
    if (st.isSymbolicLink()) {
      throw new Error(`Refusing symbolic link ${label}: ${targetPath}`);
    }
    return st;
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

export function writeFileAtomicSync(targetPath, content, { mode = 0o600 } = {}) {
  const resolvedTarget = path.resolve(targetPath);
  const dir = path.dirname(resolvedTarget);
  const dirStat = assertNotSymlinkSync(dir, 'target directory');
  if (dirStat && !dirStat.isDirectory()) {
    throw new Error(`Target parent is not a directory: ${dir}`);
  }
  assertNotSymlinkSync(resolvedTarget, 'target file');

  const base = path.basename(resolvedTarget);
  const tmpName = `.${base}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const tmpPath = path.join(dir, tmpName);
  let fd = null;
  try {
    fd = fs.openSync(tmpPath, 'wx', mode);
    fs.writeFileSync(fd, content, 'utf8');
    try { fs.fsyncSync(fd); } catch {}
    fs.closeSync(fd);
    fd = null;
    try { fs.chmodSync(tmpPath, mode); } catch {}
  } catch (err) {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
    try { fs.unlinkSync(tmpPath); } catch {}
    throw err;
  }

  try {
    assertNotSymlinkSync(dir, 'target directory');
    assertNotSymlinkSync(resolvedTarget, 'target file');
    let renamed = false;
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        fs.renameSync(tmpPath, resolvedTarget);
        renamed = true;
        break;
      } catch (err) {
        lastErr = err;
        if (process.platform !== 'win32' || !['EBUSY', 'EPERM', 'EACCES', 'EEXIST'].includes(err?.code)) {
          throw err;
        }
      }
    }
    if (!renamed) {
      // Windows 兼容回退：句柄短暂占用导致 renameSync 失败时先复核非符号链接再覆盖目标并清理临时文件
      if (process.platform === 'win32' && ['EBUSY', 'EPERM', 'EACCES', 'EEXIST'].includes(lastErr?.code)) {
        assertNotSymlinkSync(dir, 'target directory');
        assertNotSymlinkSync(resolvedTarget, 'target file');
        fs.copyFileSync(tmpPath, resolvedTarget);
        try { fs.unlinkSync(tmpPath); } catch {}
      } else {
        throw lastErr;
      }
    }
    assertNotSymlinkSync(resolvedTarget, 'target file');
    try { fs.chmodSync(resolvedTarget, mode); } catch {}
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch {}
    throw err;
  }
}

function isSafeRelativeSyncPath(rel) {
  if (typeof rel !== 'string') return false;
  const trimmed = rel.trim();
  if (!trimmed || trimmed.includes('\0') || path.isAbsolute(trimmed)) return false;
  const parts = trimmed.split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0) return false;
  return !parts.some((p) => p === '.' || p === '..');
}

function isPathWithinRoot(rootPath, candidatePath, allowEqual = false) {
  const rel = path.relative(rootPath, candidatePath);
  if (rel === '') return allowEqual;
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

function hasSymlinkSegment(rootDir, targetPath) {
  const rel = path.relative(rootDir, targetPath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return true;
  const parts = rel.split(path.sep).filter(Boolean);
  let cur = rootDir;
  for (const part of parts) {
    cur = path.join(cur, part);
    try {
      const st = fs.lstatSync(cur);
      if (st.isSymbolicLink()) return true;
    } catch (err) {
      if (err && err.code === 'ENOENT') break;
      return true;
    }
  }
  return false;
}

export function copyUpdatedRuntimeFromRepo(repoDir, pluginDir, syncFilesList) {
  if (!repoDir || !pluginDir) return 0;
  const repoRoot = path.resolve(repoDir);
  const pluginRoot = path.resolve(pluginDir);
  if (repoRoot.toLowerCase() === pluginRoot.toLowerCase()) return 0;

  let repoRootStat;
  try {
    repoRootStat = fs.lstatSync(repoRoot);
  } catch {
    return 0;
  }
  if (repoRootStat.isSymbolicLink() || !repoRootStat.isDirectory()) return 0;

  try {
    const pluginRootStat = fs.lstatSync(pluginRoot);
    if (pluginRootStat.isSymbolicLink() || !pluginRootStat.isDirectory()) return 0;
  } catch (err) {
    if (err && err.code !== 'ENOENT') return 0;
    fs.mkdirSync(pluginRoot, { recursive: true });
  }

  let realRepoRoot;
  let realPluginRoot;
  try {
    realRepoRoot = fs.realpathSync(repoRoot);
    realPluginRoot = fs.realpathSync(pluginRoot);
  } catch {
    return 0;
  }
  if (realRepoRoot.toLowerCase() === realPluginRoot.toLowerCase()) return 0;

  let resolvedFiles = null;
  const repoCdpPath = path.join(repoRoot, 'cdp.js');
  try {
    const cdpStat = fs.lstatSync(repoCdpPath);
    if (!cdpStat.isSymbolicLink() && cdpStat.isFile()) {
      const realCdp = fs.realpathSync(repoCdpPath);
      if (isPathWithinRoot(realRepoRoot, realCdp)) {
        const reqKey = require.resolve(repoCdpPath);
        delete require.cache[reqKey];
        const freshRepoCdp = require(repoCdpPath);
        if (Array.isArray(freshRepoCdp?.SYNC_ROOT_FILES) && freshRepoCdp.SYNC_ROOT_FILES.length > 0) {
          resolvedFiles = freshRepoCdp.SYNC_ROOT_FILES;
        }
      }
    }
  } catch {}

  const safeCopyFile = (rel) => {
    if (!isSafeRelativeSyncPath(rel)) return false;
    const src = path.resolve(repoRoot, rel);
    const dst = path.resolve(pluginRoot, rel);
    if (!isPathWithinRoot(repoRoot, src) || !isPathWithinRoot(pluginRoot, dst)) return false;
    if (hasSymlinkSegment(repoRoot, src)) return false;

    let srcStat;
    try {
      srcStat = fs.lstatSync(src);
    } catch {
      return false;
    }
    if (srcStat.isSymbolicLink() || !srcStat.isFile()) return false;
    try {
      const realSrc = fs.realpathSync(src);
      if (!isPathWithinRoot(realRepoRoot, realSrc)) return false;
    } catch {
      return false;
    }

    if (hasSymlinkSegment(pluginRoot, dst)) return false;
    try {
      const dstStat = fs.lstatSync(dst);
      if (dstStat.isSymbolicLink() || !dstStat.isFile()) return false;
    } catch (err) {
      if (!err || err.code !== 'ENOENT') return false;
    }

    const dstParent = path.dirname(dst);
    fs.mkdirSync(dstParent, { recursive: true });
    if (hasSymlinkSegment(pluginRoot, dst)) return false;
    try {
      const realDstParent = fs.realpathSync(dstParent);
      if (!isPathWithinRoot(realPluginRoot, realDstParent, true)) return false;
      try {
        const dstStatAfter = fs.lstatSync(dst);
        if (dstStatAfter.isSymbolicLink() || !dstStatAfter.isFile()) return false;
      } catch (err) {
        if (!err || err.code !== 'ENOENT') return false;
      }
    } catch {
      return false;
    }

    fs.copyFileSync(src, dst);
    return true;
  };

  let synced = 0;
  const files =
    resolvedFiles ||
    (Array.isArray(syncFilesList) && syncFilesList.length > 0 ? syncFilesList : ['cdp.js', 'style.css', 'ui-runtime.js']);
  for (const rel of files) {
    if (safeCopyFile(rel)) synced += 1;
  }
  const syncSubDir = (sub) => {
    if (!isSafeRelativeSyncPath(sub)) return;
    const sDir = path.resolve(repoRoot, sub);
    const dDir = path.resolve(pluginRoot, sub);
    if (!isPathWithinRoot(repoRoot, sDir) || !isPathWithinRoot(pluginRoot, dDir)) return;
    if (hasSymlinkSegment(repoRoot, sDir)) return;

    let sDirStat;
    try {
      sDirStat = fs.lstatSync(sDir);
    } catch {
      return;
    }
    if (sDirStat.isSymbolicLink() || !sDirStat.isDirectory()) return;
    try {
      const realSDir = fs.realpathSync(sDir);
      if (!isPathWithinRoot(realRepoRoot, realSDir)) return;
    } catch {
      return;
    }

    if (hasSymlinkSegment(pluginRoot, dDir)) return;
    try {
      const dDirStat = fs.lstatSync(dDir);
      if (dDirStat.isSymbolicLink() || !dDirStat.isDirectory()) return;
    } catch (err) {
      if (!err || err.code !== 'ENOENT') return;
    }
    fs.mkdirSync(dDir, { recursive: true });
    if (hasSymlinkSegment(pluginRoot, dDir)) return;
    try {
      const realDDir = fs.realpathSync(dDir);
      if (!isPathWithinRoot(realPluginRoot, realDDir)) return;
    } catch {
      return;
    }

    for (const ent of fs.readdirSync(sDir, { withFileTypes: true })) {
      if (ent.name === '__pycache__' || ent.name === '.DS_Store') continue;
      if (ent.isSymbolicLink()) continue;
      const childRel = path.join(sub, ent.name);
      const childSrc = path.join(sDir, ent.name);
      let childStat;
      try {
        childStat = fs.lstatSync(childSrc);
      } catch {
        continue;
      }
      if (childStat.isSymbolicLink()) continue;
      if (childStat.isDirectory()) syncSubDir(childRel);
      else if (childStat.isFile()) {
        if (safeCopyFile(childRel)) synced += 1;
      }
    }
  };
  syncSubDir('assets');
  syncSubDir('vendor');
  syncSubDir('sidecars');
  return synced;
}

const INLINE_DIFF_MAX_URI_LENGTH = 2048;
const INLINE_DIFF_MAX_PAYLOAD_BYTES = 16384;
const INLINE_DIFF_MAX_DIFF_LINES = 120;
const INLINE_DIFF_MAX_SNAPSHOT_LINES = 80;
const INLINE_DIFF_MAX_LINE_CHARS = 240;
const INLINE_DIFF_MAX_READ_BYTES = 24 * 1024;
const INLINE_DIFF_GIT_MAX_BUFFER = 512 * 1024;
const INLINE_DIFF_REV_PARSE_TIMEOUT_MS = 3000;
const INLINE_DIFF_GIT_DIFF_TIMEOUT_MS = 4500;
const INLINE_DIFF_MAX_GIT_POINTER_BYTES = 4096;

const INLINE_DIFF_SENSITIVE_BASENAMES = new Set([
  'config.json',
  'model-hub.config.json',
  'secrets.json',
  'credentials.json',
  'auth.json',
  'token.json',
  'mcp_config.json',
  'transcript.jsonl',
  'transcript_full.jsonl',
  'state.vscdb',
  '.claude.json',
  'keys.txt',
  '.npmrc',
  '.pypirc',
  '.git-credentials',
  '.netrc',
  'kubeconfig',
  'cookies',
  'cookies-journal',
  'login data',
  'login data-journal',
  'local state',
  'web data',
]);

const INLINE_DIFF_SENSITIVE_EXTS = new Set([
  '.env',
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  '.kdbx',
  '.jks',
  '.keystore',
  '.ppk',
  '.ovpn',
  '.vscdb',
  '.sqlite',
  '.sqlite3',
  '.db',
]);

const INLINE_DIFF_SENSITIVE_DIRS = new Set([
  '.ssh',
  '.aws',
  '.gnupg',
  '.kube',
  '.gemini',
  '.azure',
  '.claude',
  '.codex',
]);

const INLINE_DIFF_SENSITIVE_SSH_KEYS = new Set([
  'id_rsa',
  'id_ed25519',
  'id_ecdsa',
  'id_dsa',
  'id_ed25519_sk',
  'id_ecdsa_sk',
]);

const INLINE_DIFF_SENSITIVE_SYS_PREFIX_RE =
  /^(?:\/(?:proc|sys|dev|etc)(?:\/|$)|(?:[a-z]:)?\/(?:windows|program files(?: \(x86\))?|programdata)(?:\/|$))/;

const INLINE_DIFF_SENSITIVE_SUBPATH_RE =
  /(?:^|\/)(?:\.config\/(?:gcloud|gh)|appdata\/roaming|appdata\/local\/google|library\/application support\/google|library\/keychains)(?:\/|$)/;

const INLINE_DIFF_SENSITIVE_SYS_SUFFIXES = [
  '/etc/shadow',
  '/etc/gshadow',
  '/etc/master.passwd',
  '/etc/sudoers',
  '/windows/system32/config/sam',
  '/windows/system32/config/system',
  '/windows/system32/config/security',
];

function clampPositiveInt(value, fallback, maxAllowed) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(maxAllowed, Math.floor(n));
}

function hasBlockedInlineDiffUnc(rawInput) {
  if (typeof rawInput !== 'string' || !rawInput) return false;
  const s = rawInput.trim();
  if (!s) return false;
  if (isBlockedUncPath(s)) return true;
  // 拦截一切双斜杠/混合斜杠前导（\\、//、\/、/\、\\?\、\\.\），防止 SMB/NetNTLMv2 凭据泄露与 NT 设备路径绕过
  if (/^[\\/]{2}/.test(s)) return true;
  // 拦截单斜杠变体 NT 设备/对象管理器前缀（/?/、/./、\??\、/GLOBAL/UNC/、/GLOBALROOT/Device/Mup|LanmanRedirector|WebDavRedirector）
  if (/^[\\/](?:[?.]+[\\/])+/.test(s)) return true;
  if (/^[\\/]globalroot[\\/]/i.test(s)) return true;
  if (
    /^[\\/](?:global(?:root)?[\\/]+)*(?:unc|device[\\/]+(?:mup|lanmanredirector|webdavredirector|hgfs|vmhgfs|vboxsvr))(?:[\\/]|$)/i.test(
      s
    )
  ) {
    return true;
  }
  return false;
}

function hasDotDotPathSegment(rawPath) {
  if (typeof rawPath !== 'string') return true;
  const parts = rawPath.split(/[\\/]+/);
  return parts.some((seg) => seg === '..');
}

function isSensitiveInlineDiffPath(filePath) {
  if (typeof filePath !== 'string' || !filePath) return true;
  let normalized = filePath.replace(/\\/g, '/');
  while (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  if (!normalized) return true;
  const lower = normalized.toLowerCase();
  const base = path.posix.basename(lower);
  if (!base) return true;
  // 防 Windows 末尾点/空格归一化绕过（例如 config.json. / .env ）
  const cleanBase = base.replace(/[. ]+$/, '');
  const basesToCheck = cleanBase && cleanBase !== base ? [base, cleanBase] : [base];
  for (const b of basesToCheck) {
    // 拦截 .env* 及隐私配置与凭据文件
    if (b.startsWith('.env')) return true;
    if (b.endsWith('_history')) return true;
    if (b.startsWith('obsidian-prism-thought') && (b.endsWith('.json') || b.endsWith('.json.tmp'))) {
      return true;
    }
    if (INLINE_DIFF_SENSITIVE_BASENAMES.has(b)) return true;
    if (INLINE_DIFF_SENSITIVE_SSH_KEYS.has(b)) return true;
    const ext = path.posix.extname(b);
    if (ext && INLINE_DIFF_SENSITIVE_EXTS.has(ext)) return true;
  }
  const cleanLower = lower.replace(/[. ]+$/, '');
  if (
    INLINE_DIFF_SENSITIVE_SYS_PREFIX_RE.test(lower) ||
    INLINE_DIFF_SENSITIVE_SYS_PREFIX_RE.test(cleanLower) ||
    INLINE_DIFF_SENSITIVE_SUBPATH_RE.test(lower) ||
    INLINE_DIFF_SENSITIVE_SUBPATH_RE.test(cleanLower)
  ) {
    return true;
  }
  const segs = lower.split('/').filter(Boolean);
  for (let i = 0; i < segs.length; i += 1) {
    const seg = segs[i];
    if (INLINE_DIFF_SENSITIVE_DIRS.has(seg)) return true;
    if (i < segs.length - 1 && seg === '.git') return true;
    if (seg === 'thought-translator' && basesToCheck.some((b) => b.endsWith('.json'))) return true;
  }
  for (const suffix of INLINE_DIFF_SENSITIVE_SYS_SUFFIXES) {
    if (lower === suffix || lower.endsWith(suffix) || cleanLower === suffix || cleanLower.endsWith(suffix)) {
      return true;
    }
  }
  return false;
}

function truncateInlineDiffLine(text, maxChars = INLINE_DIFF_MAX_LINE_CHARS) {
  const s = String(text ?? '');
  if (s.length <= maxChars) return s;
  return `${s.slice(0, Math.max(0, maxChars - 1))}…`;
}

function resolveInlineDiffCandidatePath(rawUri) {
  if (typeof rawUri !== 'string') {
    return { ok: false, error: 'invalid_uri' };
  }
  const raw = rawUri.trim();
  if (!raw || raw.length > INLINE_DIFF_MAX_URI_LENGTH) {
    return { ok: false, error: 'invalid_uri' };
  }
  if (/[\x00-\x1f\x7f]/.test(raw) || /%00/i.test(raw)) {
    return { ok: false, error: 'invalid_uri' };
  }
  if (hasBlockedInlineDiffUnc(raw)) {
    return { ok: false, error: 'blocked_unc' };
  }

  let candidatePath = '';
  if (/^file:/i.test(raw)) {
    if (!/^file:\/\//i.test(raw)) {
      return { ok: false, error: 'invalid_uri' };
    }
    const afterScheme = raw.slice(7);
    const rawPathPart = afterScheme.split(/[?#]/, 1)[0];
    // 仅允许本机空主机 file:///...，拒绝 file://host/... 远程共享与 SMB 访问
    if (!rawPathPart.startsWith('/')) {
      return { ok: false, error: 'blocked_unc' };
    }
    if (hasDotDotPathSegment(rawPathPart)) {
      return { ok: false, error: 'blocked_traversal' };
    }
    let decodedPart;
    try {
      decodedPart = decodeURIComponent(rawPathPart);
    } catch {
      return { ok: false, error: 'invalid_uri' };
    }
    if (!decodedPart || /[\x00-\x1f\x7f]/.test(decodedPart)) {
      return { ok: false, error: 'invalid_uri' };
    }
    if (
      hasBlockedInlineDiffUnc(decodedPart) ||
      (decodedPart.startsWith('/') && hasBlockedInlineDiffUnc(decodedPart.slice(1)))
    ) {
      return { ok: false, error: 'blocked_unc' };
    }
    if (hasDotDotPathSegment(decodedPart)) {
      return { ok: false, error: 'blocked_traversal' };
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(raw);
    } catch {
      return { ok: false, error: 'invalid_uri' };
    }
    if (parsedUrl.protocol !== 'file:') {
      return { ok: false, error: 'invalid_uri' };
    }
    if (parsedUrl.hostname) {
      return { ok: false, error: 'blocked_unc' };
    }
    if (/^\/[A-Za-z]:[\\/]/.test(decodedPart)) {
      candidatePath = process.platform === 'win32' ? path.resolve(decodedPart.slice(1)) : decodedPart;
    } else if (decodedPart.startsWith('/')) {
      candidatePath = decodedPart;
    } else {
      return { ok: false, error: 'invalid_uri' };
    }
  } else {
    const isWinDriveAbs = /^[A-Za-z]:[\\/]/.test(raw);
    if (!isWinDriveAbs && /^[A-Za-z][A-Za-z0-9+.-]*:/.test(raw)) {
      return { ok: false, error: 'invalid_uri' };
    }
    if (hasDotDotPathSegment(raw)) {
      return { ok: false, error: 'blocked_traversal' };
    }
    if (!isWinDriveAbs && !raw.startsWith('/')) {
      return { ok: false, error: 'invalid_uri' };
    }
    candidatePath = isWinDriveAbs && process.platform === 'win32' ? path.resolve(raw) : raw;
  }

  if (hasBlockedInlineDiffUnc(candidatePath)) {
    return { ok: false, error: 'blocked_unc' };
  }
  if (isSensitiveInlineDiffPath(candidatePath)) {
    return { ok: false, error: 'blocked_sensitive' };
  }
  if (process.platform === 'win32') {
    if (!/^[A-Za-z]:[\\/]/.test(candidatePath)) {
      return { ok: false, error: 'invalid_uri' };
    }
    // 拦截 Windows NTFS 备用数据流（ADS，如 file.txt::$DATA）
    if (candidatePath.slice(2).includes(':')) {
      return { ok: false, error: 'invalid_uri' };
    }
  } else if (!candidatePath.startsWith('/')) {
    return { ok: false, error: 'invalid_uri' };
  }
  return { ok: true, candidatePath };
}

function resolveSafeGitCwd() {
  const tmp = os.tmpdir();
  if (typeof tmp !== 'string' || !tmp || tmp.includes('\0') || hasBlockedInlineDiffUnc(tmp)) {
    return null;
  }
  try {
    const realTmp = canonicalRealpathSync(tmp);
    const st = fs.lstatSync(realTmp);
    if (st.isSymbolicLink() || !st.isDirectory() || hasBlockedInlineDiffUnc(realTmp)) return null;
    return realTmp;
  } catch {
    return null;
  }
}

function execGitInlineDiff(
  args,
  { timeoutMs = INLINE_DIFF_REV_PARSE_TIMEOUT_MS, maxBuffer = INLINE_DIFF_GIT_MAX_BUFFER } = {}
) {
  const safeCwd = resolveSafeGitCwd();
  if (!safeCwd) {
    return Promise.resolve({ ok: false, code: 'INVALID_CWD', stdout: '' });
  }
  const fullArgs = [
    '--no-optional-locks',
    '--literal-pathspecs',
    '-c',
    'protocol.ext.allow=never',
    '-c',
    'submodule.recurse=false',
    '-c',
    'core.fsmonitor=false',
    '-c',
    'core.pager=cat',
    '-c',
    'diff.external=',
    ...args,
  ];
  return new Promise((resolve) => {
    execFile(
      'git',
      fullArgs,
      {
        cwd: safeCwd,
        encoding: 'utf8',
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_LITERAL_PATHSPECS: '1',
          GIT_OPTIONAL_LOCKS: '0',
          NoDefaultCurrentDirectoryInExePath: '1',
        },
      },
      (err, stdout) => {
        resolve({
          ok: !err,
          code: err?.code || null,
          stdout: typeof stdout === 'string' ? stdout : '',
        });
      }
    );
  });
}

function unescapeGitQuotedPath(rawToken) {
  if (typeof rawToken !== 'string') return '';
  let s = rawToken.trim();
  if (!s) return '';
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
    const bytes = [];
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i];
      if (ch === '\\' && i + 1 < s.length) {
        const next = s[i + 1];
        if (next >= '0' && next <= '7') {
          let oct = next;
          if (i + 2 < s.length && s[i + 2] >= '0' && s[i + 2] <= '7') {
            oct += s[i + 2];
            if (i + 3 < s.length && s[i + 3] >= '0' && s[i + 3] <= '7') {
              oct += s[i + 3];
            }
          }
          bytes.push(parseInt(oct, 8) & 0xff);
          i += oct.length;
          continue;
        }
        const escMap = { n: 0x0a, r: 0x0d, t: 0x09, b: 0x08, f: 0x0c, a: 0x07, v: 0x0b, '"': 0x22, '\\': 0x5c };
        if (Object.prototype.hasOwnProperty.call(escMap, next)) {
          bytes.push(escMap[next]);
        } else {
          const encoded = Buffer.from(next, 'utf8');
          for (const b of encoded) bytes.push(b);
        }
        i += 1;
      } else {
        const encoded = Buffer.from(ch, 'utf8');
        for (const b of encoded) bytes.push(b);
      }
    }
    return Buffer.from(bytes).toString('utf8');
  }
  return s;
}

function stripGitDiffPrefix(p) {
  const s = unescapeGitQuotedPath(p);
  if (!s || s === '/dev/null') return '';
  return s.replace(/^(?:a|b|i|w|c|o|1|2)\//, '');
}

function parseDiffGitHeaderPaths(line) {
  const rest = line.slice('diff --git '.length).trim();
  if (!rest) return null;
  const candidates = [];
  // 解析 C-style 引号或空白分隔的 2 个 token
  const tokens = [];
  let idx = 0;
  while (idx < rest.length && tokens.length < 3) {
    while (idx < rest.length && rest[idx] === ' ') idx += 1;
    if (idx >= rest.length) break;
    if (rest[idx] === '"') {
      let end = idx + 1;
      while (end < rest.length) {
        if (rest[end] === '\\' && end + 1 < rest.length) {
          end += 2;
          continue;
        }
        if (rest[end] === '"') {
          end += 1;
          break;
        }
        end += 1;
      }
      tokens.push(rest.slice(idx, end));
      idx = end;
    } else {
      let end = idx;
      while (end < rest.length && rest[end] !== ' ') end += 1;
      tokens.push(rest.slice(idx, end));
      idx = end;
    }
  }
  if (tokens.length === 2 && idx >= rest.length) {
    const p1 = stripGitDiffPrefix(tokens[0]);
    const p2 = stripGitDiffPrefix(tokens[1]);
    if (p1) candidates.push(p1);
    if (p2) candidates.push(p2);
  }
  // 兜底：无引号且文件名含空格时枚举所有 " b/" 切分点，宁严勿漏
  let splitPos = rest.indexOf(' b/');
  while (splitPos !== -1) {
    const left = stripGitDiffPrefix(rest.slice(0, splitPos));
    const right = stripGitDiffPrefix(rest.slice(splitPos + 1));
    if (left) candidates.push(left);
    if (right) candidates.push(right);
    splitPos = rest.indexOf(' b/', splitPos + 3);
  }
  return candidates.length > 0 ? candidates : null;
}

function isBlockedDiffHeaderPath(relPath) {
  if (typeof relPath !== 'string' || !relPath) return true;
  if (/[\x00-\x1f\x7f]/.test(relPath)) return true;
  if (hasBlockedInlineDiffUnc(relPath) || hasDotDotPathSegment(relPath)) return true;
  if (isSensitiveInlineDiffPath(relPath)) return true;
  return false;
}

function makeBlockedDiffParseResult() {
  return {
    ok: false,
    reason: 'blocked',
    blocked: true,
    isBinary: false,
    additions: 0,
    deletions: 0,
    truncated: false,
    focusedByHint: false,
    lines: [],
  };
}

function parseInlineUnifiedDiff(rawDiff, { maxLines = INLINE_DIFF_MAX_DIFF_LINES, maxLineChars = INLINE_DIFF_MAX_LINE_CHARS, hints = null } = {}) {
  const normalized = String(rawDiff || '').replace(/\r\n/g, '\n');
  const rawLines = normalized.split('\n');
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
    rawLines.pop();
  }
  const hunks = [];
  let curHunk = null;
  let additions = 0;
  let deletions = 0;
  let isBinary = false;
  let inHunk = false;
  let seenDiffHeaders = 0;
  let oldLn = 1;
  let newLn = 1;

  for (let i = 0; i < rawLines.length; i += 1) {
    const line = rawLines[i];
    if (line.startsWith('diff --git ')) {
      // 强制单文件输出：遇到第二个 diff --git 立即截断停止，防 glob/pathspec 多文件泄露
      if (seenDiffHeaders >= 1) {
        break;
      }
      seenDiffHeaders += 1;
      inHunk = false;
      curHunk = null;
      const headerPaths = parseDiffGitHeaderPaths(line);
      if (!headerPaths || headerPaths.some((p) => isBlockedDiffHeaderPath(p))) {
        return makeBlockedDiffParseResult();
      }
      continue;
    }
    if (!inHunk) {
      if (seenDiffHeaders >= 1 || /^(?:---|\+\+\+)\s+"?(?:a|b)\//.test(line)) {
        if (line.startsWith('--- ') || line.startsWith('+++ ')) {
          const rawHeaderPath = line.slice(4).split('\t', 1)[0].trim();
          if (rawHeaderPath && rawHeaderPath !== '/dev/null') {
            const p = stripGitDiffPrefix(rawHeaderPath);
            if (!p || isBlockedDiffHeaderPath(p)) {
              return makeBlockedDiffParseResult();
            }
          }
          continue;
        }
        if (seenDiffHeaders >= 1) {
          const metaPrefix = /^(?:rename from |rename to |copy from |copy to )/.exec(line);
          if (metaPrefix) {
            const p = unescapeGitQuotedPath(line.slice(metaPrefix[0].length));
            if (!p || isBlockedDiffHeaderPath(p)) {
              return makeBlockedDiffParseResult();
            }
            continue;
          }
        }
      }
      if ((line.startsWith('Binary files ') && line.endsWith(' differ')) || line === 'GIT binary patch') {
        if (line.startsWith('Binary files ')) {
          const bm = /^Binary files (.+) and (.+) differ$/.exec(line);
          if (bm) {
            const p1 = stripGitDiffPrefix(bm[1]);
            const p2 = stripGitDiffPrefix(bm[2]);
            if ((p1 && isBlockedDiffHeaderPath(p1)) || (p2 && isBlockedDiffHeaderPath(p2))) {
              return makeBlockedDiffParseResult();
            }
          }
        }
        isBinary = true;
        break;
      }
      const hm = /^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/.exec(line);
      if (!hm) continue;
      inHunk = true;
      oldLn = Number(hm[1]);
      newLn = Number(hm[2]);
      curHunk = {
        idx: hunks.length,
        adds: 0,
        dels: 0,
        rows: [{ kind: 'hunk', ln: '', sign: '@@', text: truncateInlineDiffLine(line, maxLineChars) }],
      };
      hunks.push(curHunk);
      continue;
    }

    const hm = /^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/.exec(line);
    if (hm) {
      oldLn = Number(hm[1]);
      newLn = Number(hm[2]);
      curHunk = {
        idx: hunks.length,
        adds: 0,
        dels: 0,
        rows: [{ kind: 'hunk', ln: '', sign: '@@', text: truncateInlineDiffLine(line, maxLineChars) }],
      };
      hunks.push(curHunk);
      continue;
    }
    if (line.startsWith('\\')) {
      continue;
    }
    if (line.startsWith('+')) {
      additions += 1;
      if (curHunk) {
        curHunk.adds += 1;
        curHunk.rows.push({ kind: 'add', ln: String(newLn), sign: '+', text: truncateInlineDiffLine(line.slice(1), maxLineChars) });
      }
      newLn += 1;
    } else if (line.startsWith('-')) {
      deletions += 1;
      if (curHunk) {
        curHunk.dels += 1;
        curHunk.rows.push({ kind: 'del', ln: String(oldLn), sign: '-', text: truncateInlineDiffLine(line.slice(1), maxLineChars) });
      }
      oldLn += 1;
    } else if (line.startsWith(' ') || line === '') {
      if (curHunk) {
        curHunk.rows.push({
          kind: 'ctx',
          ln: String(newLn),
          sign: ' ',
          text: truncateInlineDiffLine(line.startsWith(' ') ? line.slice(1) : '', maxLineChars),
        });
      }
      oldLn += 1;
      newLn += 1;
    }
  }

  if (isBinary) {
    return { blocked: false, isBinary: true, additions: 0, deletions: 0, truncated: false, focusedByHint: false, lines: [] };
  }

  let totalRowCount = 0;
  for (let i = 0; i < hunks.length; i += 1) totalRowCount += hunks[i].rows.length;

  const hintAdd = Math.max(0, Number(hints?.additions) || 0);
  const hintDel = Math.max(0, Number(hints?.deletions) || 0);
  const useHintFocus = totalRowCount > maxLines && hunks.length > 1 && (hintDel > 0 || hintAdd > 0);

  if (!useHintFocus) {
    const lines = [];
    for (let i = 0; i < hunks.length && lines.length < maxLines; i += 1) {
      const rows = hunks[i].rows;
      for (let j = 0; j < rows.length && lines.length < maxLines; j += 1) {
        lines.push(rows[j]);
      }
    }
    return { blocked: false, isBinary: false, additions, deletions, truncated: totalRowCount > maxLines, focusedByHint: false, lines };
  }

  // Hint-Aware Hunk Windowing：当步骤徽章带 -N 删除但文件很大时，优先挑选含红色删除/替换的变更块，避免被文件头部纯绿新增塞满切丢
  const scored = hunks.map((h) => {
    let score = 0;
    if (hintDel > 0) {
      if (h.dels > 0) score += 10000;
      if (hintAdd > 0 && h.adds > 0 && h.dels > 0) score += 5000;
    } else if (hintAdd > 0 && h.adds > 0 && h.dels === 0) {
      score += 4000;
    }
    score -= Math.abs(h.adds - hintAdd) * 4 + Math.abs(h.dels - hintDel) * 6;
    score -= h.idx * 0.5;
    return { h, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const firstDelHunkIdx = hintDel > 0 ? hunks.findIndex((x) => x.dels > 0) : -1;
  const picked = [];
  let used = 0;
  const singleHunkCap = Math.max(48, Math.floor(maxLines * 0.8));
  for (let i = 0; i < scored.length && used < maxLines; i += 1) {
    const h = scored[i].h;
    if (firstDelHunkIdx >= 0 && h.dels === 0 && h.idx < firstDelHunkIdx) continue;
    const rem = maxLines - used;
    if (rem < 4) break;
    const take = Math.min(h.rows.length, picked.length === 0 ? Math.min(rem, Math.max(singleHunkCap, Math.min(h.rows.length, maxLines))) : rem);
    picked.push({ idx: h.idx, slice: h.rows.slice(0, take) });
    used += take;
  }
  picked.sort((a, b) => a.idx - b.idx);

  const lines = [];
  for (let i = 0; i < picked.length; i += 1) {
    for (let j = 0; j < picked[i].slice.length && lines.length < maxLines; j += 1) {
      lines.push(picked[i].slice[j]);
    }
  }
  const skippedLeading = picked.length > 0 && picked[0].idx > 0;
  return {
    blocked: false,
    isBinary: false,
    additions,
    deletions,
    truncated: totalRowCount > lines.length,
    focusedByHint: skippedLeading || (hintDel > 0 && lines.some((r) => r.kind === 'del')),
    lines,
  };
}

function canonicalRealpathSync(targetPath) {
  if (typeof fs.realpathSync.native === 'function') {
    try {
      return fs.realpathSync.native(targetPath);
    } catch (err) {
      if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR' || err.code === 'EACCES' || err.code === 'EPERM')) {
        throw err;
      }
    }
  }
  return fs.realpathSync(targetPath);
}

const INLINE_DIFF_CACHE_MAX = 48;
const INLINE_DIFF_MAX_CONCURRENCY = 3;
const INLINE_DIFF_MAX_QUEUE = 16;
const INLINE_DIFF_MAX_GIT_CONFIG_BYTES = 64 * 1024;
const INLINE_DIFF_UNSAFE_GIT_CONFIG_FILTER_RE = /(^|\r?\n)\s*\[filter\s+/i;
const INLINE_DIFF_UNSAFE_GIT_CONFIG_FSMONITOR_RE = /\bfsmonitor\s*=/i;

const inlineDiffLruCache = new Map();
const inlineDiffInFlight = new Map();
let inlineDiffActiveCount = 0;
const inlineDiffWaitQueue = [];

function normalizeComparablePath(p) {
  let norm = path.normalize(String(p || ''));
  if (norm.length > 1 && (norm.endsWith(path.sep) || norm.endsWith('/'))) {
    norm = norm.slice(0, -1);
  }
  return process.platform === 'win32' ? norm.toLowerCase() : norm;
}

function isSameCanonicalPath(candidatePath, realPath, allowDarwinSystemRootAlias = false) {
  const a = normalizeComparablePath(candidatePath);
  const b = normalizeComparablePath(realPath);
  if (a === b) return true;
  if (allowDarwinSystemRootAlias && process.platform === 'darwin') {
    if ((a.startsWith('/var/') && `/private${a}` === b) || (a.startsWith('/tmp/') && `/private${a}` === b)) {
      return true;
    }
  }
  return false;
}

function readSmallNoFollowFileSync(filePath, maxBytes) {
  let fd = null;
  try {
    const openFlags =
      process.platform !== 'win32' && typeof fs.constants?.O_NOFOLLOW === 'number'
        ? fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW
        : 'r';
    fd = fs.openSync(filePath, openFlags);
    const fdStat = fs.fstatSync(fd);
    if (!fdStat.isFile() || fdStat.size > maxBytes) return null;
    const postStat = fs.lstatSync(filePath);
    if (postStat.isSymbolicLink() || !postStat.isFile()) return null;
    if (process.platform !== 'win32' && (fdStat.ino !== postStat.ino || fdStat.dev !== postStat.dev)) {
      return null;
    }
    const buf = Buffer.alloc(fdStat.size);
    let offset = 0;
    while (offset < fdStat.size) {
      const n = fs.readSync(fd, buf, offset, fdStat.size - offset, offset);
      if (n <= 0) break;
      offset += n;
    }
    return buf.subarray(0, offset).toString('utf8');
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
  }
}

function resolveValidatedCommonGitDir(realGitDir) {
  const commonPtrPath = path.join(realGitDir, 'commondir');
  let st;
  try {
    st = fs.lstatSync(commonPtrPath);
  } catch (err) {
    if (err && err.code === 'ENOENT') return realGitDir;
    return null;
  }
  if (st.isSymbolicLink() || !st.isFile() || st.size <= 0 || st.size > INLINE_DIFF_MAX_GIT_POINTER_BYTES) {
    return null;
  }
  const rawCommon = readSmallNoFollowFileSync(commonPtrPath, INLINE_DIFF_MAX_GIT_POINTER_BYTES);
  if (typeof rawCommon !== 'string') return null;
  const trimmed = rawCommon.trim();
  if (!trimmed || /[\x00-\x1f\x7f]/.test(trimmed) || hasBlockedInlineDiffUnc(trimmed)) return null;
  const commonPath = path.resolve(realGitDir, trimmed);
  if (hasBlockedInlineDiffUnc(commonPath)) return null;
  try {
    const cst = fs.lstatSync(commonPath);
    if (cst.isSymbolicLink() || !cst.isDirectory()) return null;
    const realCommon = canonicalRealpathSync(commonPath);
    if (hasBlockedInlineDiffUnc(realCommon)) return null;
    const rcst = fs.lstatSync(realCommon);
    if (rcst.isSymbolicLink() || !rcst.isDirectory()) return null;
    if (!isSameCanonicalPath(commonPath, realCommon, path.isAbsolute(trimmed))) return null;
    return realCommon;
  } catch {
    return null;
  }
}

function readGitIndexMtimeSafe(realGitDir) {
  const idxPath = path.join(realGitDir, 'index');
  try {
    const idxSt = fs.lstatSync(idxPath);
    if (idxSt.isSymbolicLink() || !idxSt.isFile()) return null;
    return idxSt.mtimeMs || 0;
  } catch (err) {
    if (err && err.code === 'ENOENT') return 0;
    return null;
  }
}

function findGitRootFast(startDir) {
  let cur = startDir;
  for (let depth = 0; depth < 24 && cur; depth += 1) {
    const gitMarker = path.join(cur, '.git');
    let gst;
    try {
      gst = fs.lstatSync(gitMarker);
    } catch (err) {
      if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
        const parent = path.dirname(cur);
        if (!parent || parent === cur) break;
        cur = parent;
        continue;
      }
      return null;
    }

    // 严格 Fail-Closed：.git 为符号链接或非常规文件/目录时一律立即拒绝
    if (gst.isSymbolicLink()) {
      return null;
    }

    let realCur;
    try {
      realCur = canonicalRealpathSync(cur);
    } catch {
      return null;
    }
    if (hasBlockedInlineDiffUnc(realCur)) return null;

    if (gst.isDirectory()) {
      let realGitDir;
      try {
        realGitDir = canonicalRealpathSync(gitMarker);
        const rgst = fs.lstatSync(realGitDir);
        if (rgst.isSymbolicLink() || !rgst.isDirectory()) return null;
      } catch {
        return null;
      }
      if (hasBlockedInlineDiffUnc(realGitDir)) return null;
      if (!isSameCanonicalPath(path.join(realCur, '.git'), realGitDir, false)) return null;
      const commonGitDir = resolveValidatedCommonGitDir(realGitDir);
      if (!commonGitDir) return null;
      const indexMtimeMs = readGitIndexMtimeSafe(realGitDir);
      if (indexMtimeMs === null) return null;
      return { root: realCur, gitDir: realGitDir, commonGitDir, indexMtimeMs };
    }

    if (gst.isFile()) {
      // gitfile 指针严格 Fail-Closed：超 4KB、非合法 gitdir:、UNC、含符号链接或 realpath 失败均立即 return null
      if (gst.size <= 0 || gst.size > INLINE_DIFF_MAX_GIT_POINTER_BYTES) {
        return null;
      }
      const gitPtrRaw = readSmallNoFollowFileSync(gitMarker, INLINE_DIFF_MAX_GIT_POINTER_BYTES);
      if (typeof gitPtrRaw !== 'string') return null;
      const gitPtr = gitPtrRaw.trim();
      const m = /^gitdir:\s*([^\r\n]+)$/i.exec(gitPtr);
      if (!m || !m[1]) return null;
      const rawPtr = m[1].trim();
      if (!rawPtr || /[\x00-\x1f\x7f]/.test(rawPtr) || hasBlockedInlineDiffUnc(rawPtr)) {
        return null;
      }
      const gitDirPath = path.resolve(realCur, rawPtr);
      if (hasBlockedInlineDiffUnc(gitDirPath)) return null;
      let realGitDir;
      try {
        const gdLstat = fs.lstatSync(gitDirPath);
        if (gdLstat.isSymbolicLink() || !gdLstat.isDirectory()) return null;
        realGitDir = canonicalRealpathSync(gitDirPath);
        if (hasBlockedInlineDiffUnc(realGitDir)) return null;
        const rgst = fs.lstatSync(realGitDir);
        if (rgst.isSymbolicLink() || !rgst.isDirectory()) return null;
      } catch {
        return null;
      }
      if (!isSameCanonicalPath(gitDirPath, realGitDir, path.isAbsolute(rawPtr))) {
        return null;
      }
      const commonGitDir = resolveValidatedCommonGitDir(realGitDir);
      if (!commonGitDir) return null;
      const indexMtimeMs = readGitIndexMtimeSafe(realGitDir);
      if (indexMtimeMs === null) return null;
      return { root: realCur, gitDir: realGitDir, commonGitDir, indexMtimeMs };
    }

    return null;
  }
  return null;
}

function hasUnsafeGitConfig(gitDir, commonGitDir = null) {
  const dirs = [];
  if (gitDir) dirs.push(gitDir);
  if (commonGitDir && commonGitDir !== gitDir) dirs.push(commonGitDir);
  for (const dir of dirs) {
    const cfgPath = path.join(dir, 'config');
    let st;
    try {
      st = fs.lstatSync(cfgPath);
    } catch (err) {
      if (err && err.code === 'ENOENT') continue;
      return true;
    }
    if (st.isSymbolicLink() || !st.isFile() || st.size > INLINE_DIFF_MAX_GIT_CONFIG_BYTES) {
      return true;
    }
    const content = readSmallNoFollowFileSync(cfgPath, INLINE_DIFF_MAX_GIT_CONFIG_BYTES);
    if (typeof content !== 'string') return true;
    if (
      INLINE_DIFF_UNSAFE_GIT_CONFIG_FILTER_RE.test(content) ||
      INLINE_DIFF_UNSAFE_GIT_CONFIG_FSMONITOR_RE.test(content)
    ) {
      return true;
    }
  }
  return false;
}

function getInlineDiffCached(cacheKey) {
  const hit = inlineDiffLruCache.get(cacheKey);
  if (!hit) return null;
  inlineDiffLruCache.delete(cacheKey);
  inlineDiffLruCache.set(cacheKey, hit);
  return hit;
}

function setInlineDiffCached(cacheKey, value) {
  if (!value || !value.ok) return value;
  while (inlineDiffLruCache.size >= INLINE_DIFF_CACHE_MAX) {
    const oldest = inlineDiffLruCache.keys().next().value;
    if (oldest === undefined) break;
    inlineDiffLruCache.delete(oldest);
  }
  inlineDiffLruCache.set(cacheKey, value);
  return value;
}

async function runWithInlineDiffSemaphore(taskFn) {
  if (inlineDiffActiveCount >= INLINE_DIFF_MAX_CONCURRENCY) {
    if (inlineDiffWaitQueue.length >= INLINE_DIFF_MAX_QUEUE) {
      return { ok: false, reason: 'busy', error: 'busy' };
    }
    await new Promise((resolve) => {
      inlineDiffWaitQueue.push(resolve);
    });
  } else {
    inlineDiffActiveCount += 1;
  }
  try {
    return await taskFn();
  } finally {
    const next = inlineDiffWaitQueue.shift();
    if (typeof next === 'function') {
      next();
    } else {
      inlineDiffActiveCount = Math.max(0, inlineDiffActiveCount - 1);
    }
  }
}

function projectInlineDiffEntry(rawEntry, { maxDiffLines, maxSnapshotLines, maxLineChars, hintAdd, hintDel }) {
  if (!rawEntry || !rawEntry.ok) {
    return rawEntry || { ok: false, error: 'read_failed' };
  }
  if (rawEntry.kind === 'binary') {
    return {
      ok: true,
      mode: 'binary',
      fileName: rawEntry.fileName,
      additions: 0,
      deletions: 0,
      truncated: false,
      lines: [],
    };
  }
  if (rawEntry.kind === 'git-diff') {
    const parsed = parseInlineUnifiedDiff(rawEntry.rawDiff, {
      maxLines: maxDiffLines,
      maxLineChars,
      hints: hintAdd > 0 || hintDel > 0 ? { additions: hintAdd, deletions: hintDel } : null,
    });
    if (parsed.ok === false || parsed.blocked) {
      return { ok: false, reason: 'blocked', error: 'blocked' };
    }
    if (parsed.isBinary) {
      return {
        ok: true,
        mode: 'binary',
        fileName: rawEntry.fileName,
        additions: 0,
        deletions: 0,
        truncated: false,
        lines: [],
      };
    }
    return {
      ok: true,
      mode: 'git-diff',
      fileName: rawEntry.fileName,
      additions: parsed.additions,
      deletions: parsed.deletions,
      truncated: parsed.truncated || Boolean(rawEntry.bufferTruncated),
      focused: Boolean(parsed.focusedByHint),
      lines: parsed.lines,
    };
  }
  const textLines = rawEntry.rawText.length > 0 ? rawEntry.rawText.split('\n') : [];
  if (!rawEntry.byteTruncated && textLines.length > 0 && textLines[textLines.length - 1] === '') {
    textLines.pop();
  }
  const lineTruncated = textLines.length > maxSnapshotLines;
  const capped = lineTruncated ? textLines.slice(0, maxSnapshotLines) : textLines;
  const isNewFile = Boolean(rawEntry.isUntracked || (hintAdd > 0 && hintDel === 0));
  const mode = isNewFile ? 'new-file' : 'snapshot';
  const kind = isNewFile ? 'add' : 'ctx';
  const sign = isNewFile ? '+' : ' ';
  const lines = capped.map((line, idx) => ({
    kind,
    ln: String(idx + 1),
    sign,
    text: truncateInlineDiffLine(line, maxLineChars),
  }));
  return {
    ok: true,
    mode,
    fileName: rawEntry.fileName,
    additions: isNewFile ? lines.length : 0,
    deletions: 0,
    truncated: Boolean(rawEntry.byteTruncated || lineTruncated),
    lines,
  };
}

// 受限只读行内 Diff 读取器：严防 UNC/NT 设备路径/路径穿越/符号链接逃逸/敏感凭据读取、非 Git 越界读取与 Shell 注入
export async function readSafeInlineDiff(rawUri, opts = {}) {
  const maxDiffLines = clampPositiveInt(opts?.maxDiffLines, INLINE_DIFF_MAX_DIFF_LINES, INLINE_DIFF_MAX_DIFF_LINES);
  const maxSnapshotLines = clampPositiveInt(
    opts?.maxSnapshotLines,
    INLINE_DIFF_MAX_SNAPSHOT_LINES,
    INLINE_DIFF_MAX_SNAPSHOT_LINES
  );
  const maxLineChars = clampPositiveInt(opts?.maxLineChars, INLINE_DIFF_MAX_LINE_CHARS, INLINE_DIFF_MAX_LINE_CHARS);
  const maxReadBytes = clampPositiveInt(opts?.maxReadBytes, INLINE_DIFF_MAX_READ_BYTES, INLINE_DIFF_MAX_READ_BYTES);
  const revParseTimeoutMs = clampPositiveInt(
    opts?.revParseTimeoutMs,
    INLINE_DIFF_REV_PARSE_TIMEOUT_MS,
    INLINE_DIFF_REV_PARSE_TIMEOUT_MS * 2
  );
  const diffTimeoutMs = clampPositiveInt(
    opts?.diffTimeoutMs,
    INLINE_DIFF_GIT_DIFF_TIMEOUT_MS,
    INLINE_DIFF_GIT_DIFF_TIMEOUT_MS * 2
  );
  const gitMaxBuffer = clampPositiveInt(opts?.gitMaxBuffer, INLINE_DIFF_GIT_MAX_BUFFER, INLINE_DIFF_GIT_MAX_BUFFER);
  const hintAdd = Number.isFinite(Number(opts?.hints?.additions)) ? Math.max(0, Math.trunc(Number(opts.hints.additions))) : 0;
  const hintDel = Number.isFinite(Number(opts?.hints?.deletions)) ? Math.max(0, Math.trunc(Number(opts.hints.deletions))) : 0;

  const resolved = resolveInlineDiffCandidatePath(rawUri);
  if (!resolved.ok) {
    return resolved;
  }

  let realPath;
  try {
    realPath = canonicalRealpathSync(resolved.candidatePath);
  } catch (err) {
    const code = err?.code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return { ok: false, error: 'not_found' };
    if (code === 'EACCES' || code === 'EPERM') return { ok: false, error: 'access_denied' };
    return { ok: false, error: 'read_failed' };
  }

  // 解析符号链接后的二次安全校验：防符号链接逃逸到 UNC 共享或敏感文件
  if (hasBlockedInlineDiffUnc(realPath)) {
    return { ok: false, error: 'blocked_unc' };
  }
  if (isSensitiveInlineDiffPath(realPath)) {
    return { ok: false, error: 'blocked_sensitive' };
  }

  let st;
  try {
    st = fs.lstatSync(realPath);
  } catch {
    return { ok: false, error: 'read_failed' };
  }
  if (!st.isFile() || st.isSymbolicLink()) {
    return { ok: false, error: 'not_a_file' };
  }

  const fileName = path.basename(realPath);
  const dir = path.dirname(realPath);

  // 0.1ms 纯 Node 向上探测 .git 仓根（严格 Fail-Closed，非 Git 仓库强制拒绝）
  let realRepoRoot = null;
  let realGitDir = null;
  let realCommonGitDir = null;
  let gitRelPath = '';
  let gitIndexMtimeMs = 0;
  const fastGit = findGitRootFast(dir);
  if (fastGit && fastGit.root && fastGit.gitDir && !hasBlockedInlineDiffUnc(fastGit.root)) {
    try {
      const candidateRoot = canonicalRealpathSync(fastGit.root);
      const rootStat = fs.lstatSync(candidateRoot);
      if (
        rootStat.isDirectory() &&
        !rootStat.isSymbolicLink() &&
        !hasBlockedInlineDiffUnc(candidateRoot) &&
        isPathWithinRoot(candidateRoot, realPath)
      ) {
        const relNative = path.relative(candidateRoot, realPath);
        const relPosix = relNative.split(path.sep).join('/');
        if (relPosix && !relPosix.includes('\0') && !path.isAbsolute(relNative) && !hasDotDotPathSegment(relPosix)) {
          realRepoRoot = candidateRoot;
          realGitDir = fastGit.gitDir;
          realCommonGitDir = fastGit.commonGitDir || fastGit.gitDir;
          gitRelPath = relPosix;
          gitIndexMtimeMs = fastGit.indexMtimeMs || 0;
        }
      }
    } catch {}
  }

  if (!realRepoRoot || !gitRelPath || !realGitDir) {
    return { ok: false, reason: 'outside_git_repo', error: 'outside_git_repo' };
  }

  // 调用 git 前扫描 <gitDir>/config（限 64 KiB），含 [filter 或 fsmonitor= 时跳过 git 子进程降级安全纯文件只读切片
  const skipGitSubprocess = hasUnsafeGitConfig(realGitDir, realCommonGitDir);
  const wantCommitFallback = hintDel > 0 ? 1 : 0;
  // rawDiff 缓存键彻底解耦客户端可控整数 hints 与输出窗口行数，防变换 hints 穿透缓存触发 git log 风暴
  const rawCacheKey = `${realPath}|${st.mtimeMs}|${st.size}|${gitIndexMtimeMs}|${skipGitSubprocess ? 1 : 0}|${wantCommitFallback}|${maxReadBytes}|${gitMaxBuffer}`;
  const projectionOpts = { maxDiffLines, maxSnapshotLines, maxLineChars, hintAdd, hintDel };

  if (!opts?.noCache) {
    const cachedRaw = getInlineDiffCached(rawCacheKey);
    if (cachedRaw) {
      return projectInlineDiffEntry(cachedRaw, projectionOpts);
    }
    const existingInFlight = inlineDiffInFlight.get(rawCacheKey);
    if (existingInFlight) {
      const sharedRaw = await existingInFlight;
      return projectInlineDiffEntry(sharedRaw, projectionOpts);
    }
  }

  const fetchRaw = () =>
    runWithInlineDiffSemaphore(async () => {
      if (!skipGitSubprocess) {
        // 单次 git diff HEAD 同时覆盖工作区未暂存与已暂存变更，直接砍半子进程冷启动时间
        let diffRes = await execGitInlineDiff(
          ['-C', realRepoRoot, 'diff', 'HEAD', '--no-color', '--no-ext-diff', '--no-textconv', '--unified=2', '--', gitRelPath],
          { timeoutMs: diffTimeoutMs, maxBuffer: gitMaxBuffer }
        );
        let rawDiff = diffRes.ok || diffRes.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? diffRes.stdout : '';
        let bufferTruncated = diffRes.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';

        // 兼容刚 git init 尚无 HEAD 的仓库：回退一次 --cached
        if (!diffRes.ok && !rawDiff.trim()) {
          diffRes = await execGitInlineDiff(
            ['-C', realRepoRoot, 'diff', '--cached', '--no-color', '--no-ext-diff', '--no-textconv', '--unified=2', '--', gitRelPath],
            { timeoutMs: diffTimeoutMs, maxBuffer: gitMaxBuffer }
          );
          rawDiff = diffRes.ok || diffRes.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? diffRes.stdout : '';
          bufferTruncated = diffRes.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
        }

        // 若工作区已提交干净但徽章明确提示有删改（历史步骤），拉取该文件最近一次真实 commit diff
        if (!rawDiff.trim() && wantCommitFallback) {
          const logRes = await execGitInlineDiff(
            ['-C', realRepoRoot, 'log', '-n', '1', '-p', '--no-color', '--no-ext-diff', '--no-textconv', '--unified=2', '--', gitRelPath],
            { timeoutMs: diffTimeoutMs, maxBuffer: gitMaxBuffer }
          );
          if (logRes.ok || logRes.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
            rawDiff = logRes.stdout || '';
            bufferTruncated = logRes.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
          }
        }

        if (rawDiff.trim()) {
          const probeParsed = parseInlineUnifiedDiff(rawDiff, { maxLines: 1, maxLineChars: 32 });
          if (probeParsed.ok === false || probeParsed.blocked) {
            return { ok: false, reason: 'blocked', error: 'blocked' };
          }
          if (probeParsed.isBinary) {
            return { ok: true, kind: 'binary', fileName };
          }
          if (probeParsed.lines.length > 0) {
            return { ok: true, kind: 'git-diff', fileName, rawDiff, bufferTruncated };
          }
        }
      }

      // 未命中 git diff（或跳过不安全 git config）时执行有界只读切片（最多 24 KiB），防符号链接 TOCTOU 替换
      const buf = Buffer.alloc(maxReadBytes);
      let bytesRead = 0;
      let fileSize = st.size;
      let fd = null;
      try {
        const openFlags =
          process.platform !== 'win32' && typeof fs.constants?.O_NOFOLLOW === 'number'
            ? fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW
            : 'r';
        fd = fs.openSync(realPath, openFlags);
        const fdStat = fs.fstatSync(fd);
        if (!fdStat.isFile()) {
          return { ok: false, error: 'not_a_file' };
        }
        const postStat = fs.lstatSync(realPath);
        if (postStat.isSymbolicLink() || !postStat.isFile()) {
          return { ok: false, error: 'not_a_file' };
        }
        if (process.platform !== 'win32' && (fdStat.ino !== postStat.ino || fdStat.dev !== postStat.dev)) {
          return { ok: false, error: 'read_failed' };
        }
        fileSize = fdStat.size;
        bytesRead = fs.readSync(fd, buf, 0, maxReadBytes, 0);
      } catch (err) {
        const code = err?.code;
        if (code === 'ELOOP') return { ok: false, error: 'not_a_file' };
        if (code === 'EACCES' || code === 'EPERM') return { ok: false, error: 'access_denied' };
        return { ok: false, error: 'read_failed' };
      } finally {
        if (fd !== null) {
          try { fs.closeSync(fd); } catch {}
        }
      }

      const slice = buf.subarray(0, bytesRead);
      if (slice.includes(0)) {
        return { ok: true, kind: 'binary', fileName };
      }

      let isUntracked = false;
      if (!skipGitSubprocess) {
        const statusRes = await execGitInlineDiff(
          ['-C', realRepoRoot, 'status', '--porcelain', '-uall', '--', gitRelPath],
          { timeoutMs: revParseTimeoutMs, maxBuffer: 64 * 1024 }
        );
        if (statusRes.ok && statusRes.stdout) {
          const firstLine = statusRes.stdout.replace(/^[\r\n]+/, '').split(/\r?\n/, 1)[0] || '';
          if (firstLine.startsWith('?? ')) {
            isUntracked = true;
          }
        }
      }

      const rawText = slice.toString('utf8').replace(/\r\n/g, '\n');
      const byteTruncated = bytesRead < fileSize;
      return { ok: true, kind: 'file', fileName, rawText, byteTruncated, isUntracked };
    });

  if (opts?.noCache) {
    const rawResult = await fetchRaw();
    return projectInlineDiffEntry(rawResult, projectionOpts);
  }

  const inFlightPromise = fetchRaw().then((rawResult) => {
    if (rawResult && rawResult.ok) {
      setInlineDiffCached(rawCacheKey, rawResult);
    }
    return rawResult;
  });
  inlineDiffInFlight.set(rawCacheKey, inFlightPromise);
  try {
    const rawResult = await inFlightPromise;
    return projectInlineDiffEntry(rawResult, projectionOpts);
  } finally {
    if (inlineDiffInFlight.get(rawCacheKey) === inFlightPromise) {
      inlineDiffInFlight.delete(rawCacheKey);
    }
  }
}

export function resolvePortFileCandidates() {
  const candidates = [];
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    candidates.push(path.join(appData, 'Antigravity', 'DevToolsActivePort'));
  } else if (process.platform === 'darwin') {
    candidates.push(path.join(os.homedir(), 'Library', 'Application Support', 'Antigravity', 'DevToolsActivePort'));
  } else {
    const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    candidates.push(path.join(xdg, 'Antigravity', 'DevToolsActivePort'));
  }
  return candidates;
}

const _portFileCache = new Map();
const _hostCfgEnabledCache = new Map();

function _setBoundedFileCache(map, key, val, limit = 16) {
  if (map.has(key)) map.delete(key);
  else if (map.size >= limit) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, val);
}

export function discoverActivePort(overridePort = null, customPortFile = null) {
  if (overridePort && Number.isInteger(Number(overridePort)) && Number(overridePort) > 0) {
    return Number(overridePort);
  }
  if (process.env.AG_CDP_PORT) {
    const p = parseInt(process.env.AG_CDP_PORT, 10);
    if (Number.isInteger(p) && p > 0 && p <= 65535) return p;
  }
  const files = customPortFile ? [customPortFile] : resolvePortFileCandidates();
  for (const file of files) {
    const key = path.resolve(file);
    try {
      let st;
      try {
        st = fs.statSync(file);
      } catch {
        _portFileCache.delete(key);
        continue;
      }
      if (!st.isFile()) {
        _portFileCache.delete(key);
        continue;
      }
      const sig = `${st.mtimeMs}:${st.size}:${st.ctimeMs}`;
      const cached = _portFileCache.get(key);
      if (cached && cached.sig === sig) {
        if (cached.port) return cached.port;
        continue;
      }
      if (st.size > 2048) {
        _setBoundedFileCache(_portFileCache, key, { sig, port: null });
        continue;
      }
      const text = fs.readFileSync(file, 'utf8');
      if (text.length > 2048) {
        _setBoundedFileCache(_portFileCache, key, { sig, port: null });
        continue;
      }
      const port = parseInt(text.split(/\r?\n/)[0].trim(), 10);
      const validPort = Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
      _setBoundedFileCache(_portFileCache, key, { sig, port: validPort });
      if (validPort) return validPort;
    } catch {
      _portFileCache.delete(key);
    }
  }
  return null;
}

export function isEligibleTarget(target) {
  return defaultCdp.isEligibleTarget(target);
}

export function isPluginEnabledInHostConfig(customConfigPath = null) {
  const cfgPath = customConfigPath || path.join(os.homedir(), '.gemini', 'config', 'config.json');
  const key = path.resolve(cfgPath);
  try {
    let st;
    try {
      st = fs.statSync(cfgPath);
    } catch {
      _hostCfgEnabledCache.delete(key);
      return true;
    }
    if (!st.isFile()) {
      _hostCfgEnabledCache.delete(key);
      return true;
    }
    const sig = `${st.mtimeMs}:${st.size}:${st.ctimeMs}`;
    const cached = _hostCfgEnabledCache.get(key);
    if (cached && cached.sig === sig) {
      return cached.enabled;
    }
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^\uFEFF/, ''));
    let enabled = true;
    if (raw?.plugins?.['obsidian-prism']?.enabled === false) enabled = false;
    else if (raw?.plugins?.['antigravity-prism']?.enabled === false && !raw?.plugins?.['obsidian-prism']) enabled = false;
    _setBoundedFileCache(_hostCfgEnabledCache, key, { sig, enabled });
    return enabled;
  } catch {
    _hostCfgEnabledCache.delete(key);
    return true;
  }
}

function isPidAlive(pid) {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch (err) {
    return Boolean(err && err.code === 'EPERM');
  }
}

function isAutomatedTestRuntime() {
  if (process.env.NODE_ENV === 'test') return true;
  if (process.env.NODE_TEST_CONTEXT) return true;
  return Array.isArray(process.execArgv) && process.execArgv.some((a) => a === '--test' || a.startsWith('--test-'));
}

function queryProcessCommandLineSync(pid) {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0) return null;
  try {
    if (process.platform === 'linux') {
      const raw = fs.readFileSync(`/proc/${n}/cmdline`);
      if (!raw || raw.length === 0) return '';
      return raw.toString('utf8').replace(/\0+/g, ' ').trim();
    }
    if (process.platform === 'win32') {
      const psScript = `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${n}' -ErrorAction SilentlyContinue).CommandLine`;
      const out = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psScript],
        { encoding: 'utf8', windowsHide: true, timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }
      );
      return String(out || '').trim();
    }
    const out = execFileSync('ps', ['-p', String(n), '-o', 'command='], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return String(out || '').trim();
  } catch {
    return null;
  }
}

export function isObsidianPrismDaemonCommandLine(commandLine) {
  const cmd = String(commandLine || '').replace(/\\/g, '/').trim().toLowerCase();
  if (!cmd) return false;
  if (/--type=/.test(cmd)) return false;
  const hasPrismBrand = /(?:obsidian-prism|antigravity-prism|agy-claude-style)/.test(cmd);
  const hasDaemonScript = /(?:sidecars\/daemon\/main\.mjs|\/daemon\/main\.mjs|\/watch\.js)\b/.test(cmd);
  if (hasPrismBrand && hasDaemonScript) return true;
  // 宿主以 sidecars/daemon 为工作目录拉起时，命令行为 node main.mjs 或 Antigravity --import=.../sidecar_sdk/register_loader.js main.mjs
  const hasRelativeMain = /(?:^|[\s"'=])main\.mjs(?:$|[\s"'])/.test(cmd);
  if (
    hasRelativeMain &&
    /(?:^|\s|\/)(?:node|nodejs)(?:\.exe)?(?:\s|"|'|$)|sidecar_sdk\/register_loader\.js\b/.test(cmd)
  ) {
    return true;
  }
  return false;
}

export class PrismDaemon {
  constructor({
    rootDir = DEFAULT_ROOT_DIR,
    gitRepoDir = null,
    bundleCachePath = undefined,
    usageCachePath = undefined,
    overridePort = null,
    portFile = null,
    pollIntervalMs = undefined,
    takeoverDebounceMs = undefined,
    startupJitterMs = undefined,
    enabledCheck = () => isPluginEnabledInHostConfig(),
    metricsProvider = null,
    thoughtService = null,
    wallpaperService = null,
    omniExecHooks = null,
    sidebarService = null,
    relaunchHooks = null,
    daemonPidVerifier = null,
    noPortRelaunchThresholdMs = 8000,
    shortcutCheckIntervalMs = 300000,
    shortcutBackoffIntervalMs = 45 * 60 * 1000,
    listPagesFallbackIntervalMs = 12000,
    _testUpdateService = null,
    updateCheckInitialDelayMs = 45000,
    updateCheckIntervalMs = 6 * 60 * 60 * 1000,
    enableAutoUpdateTimer = true,
    silent = false,
  } = {}) {
    this.rootDir = path.resolve(rootDir);
    this.gitRepoDir = gitRepoDir ? path.resolve(gitRepoDir) : null;
    this._bundleCachePathOpt = bundleCachePath;
    this.overridePort = overridePort;
    this.portFile = portFile;
    this._hasExplicitPollInterval = pollIntervalMs !== undefined && pollIntervalMs !== null;
    this.enabledCheck = enabledCheck;
    this.silent = Boolean(silent);
    this.cdp = require(path.join(this.rootDir, 'cdp.js'));
    this.pollIntervalMs = this._hasExplicitPollInterval
      ? Math.max(200, Number(pollIntervalMs) || 3000)
      : this._resolveConfiguredPollIntervalMs();
    const takeoverNum = Number(takeoverDebounceMs);
    this._takeoverDebounceMs = Number.isFinite(takeoverNum) && takeoverNum >= 0 ? Math.round(takeoverNum) : 220;
    const jitterNum = Number(startupJitterMs);
    this._startupJitterMs = Number.isFinite(jitterNum) && jitterNum >= 0 ? Math.round(jitterNum) : 80;
    this._startupTickTimer = null;
    this._tookOverExistingDaemon = false;
    this._loadedCdpVerifier = typeof this.cdp?.isExpectedDaemonProcess === 'function' ? this.cdp.isExpectedDaemonProcess : null;
    this._daemonPidVerifier = typeof daemonPidVerifier === 'function' ? daemonPidVerifier : null;
    this._cdpFileSig = this._readCdpFileSig();
    this._selfConfigWriteUntil = 0;
    this._configSeq = 0;
    this._broadcastRunning = false;
    this._broadcastPending = false;
    this._broadcastWaiters = [];
    this.sessions = new Map();
    this.ignoredTargets = new Map();
    this.browserSession = null;
    this.browserPort = null;
    this._browserDiscoverySubscribed = false;
    this._lastListPagesAt = 0;
    this._forceListPagesNextTick = false;
    const fallbackListMs = Number(listPagesFallbackIntervalMs);
    this._listPagesFallbackIntervalMs = Number.isFinite(fallbackListMs) ? Math.max(100, fallbackListMs) : 12000;
    this._discoverTimer = null;
    this._reloadTimer = null;
    this._bundleCacheFlushTimer = null;
    this._managedTimers = new Set();
    this._pendingTick = false;
    this.running = false;
    this.busy = false;
    this.timer = null;
    this.fsw = null;
    this.injectExpr = '';
    this.omniExpr = '';
    this.sidebarExpr = '';
    this.hostI18nExpr = '';
    this.thoughtExpr = '';
    this.thoughtCodeHash = '';
    this._thoughtHashSource = '';
    this.inlineDiffExpr = '';
    this.inlineDiffCodeHash = '';
    this._inlineDiffHashSource = '';
    this.wallpaperExpr = '';
    this.wallpaperCodeHash = '';
    this._wallpaperHashSource = '';
    this.catSanctuaryExpr = '';
    this.catSanctuaryCodeHash = '';
    this._catSanctuaryHashSource = '';
    this.effortSliderExpr = '';
    this.effortSliderCodeHash = '';
    this._effortSliderHashSource = '';
    this.chatSceneExpr = '';
    this.chatSceneCodeHash = '';
    this._chatSceneHashSource = '';
    this.codeHash = '';
    this.ownerToken = `${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    this.pidFile = path.join(this.rootDir, '.daemon.pid');
    this.logFile = path.join(this.rootDir, 'daemon.log');
    this._logBytes = -1;
    this._ownerFileCache = null;
    this._safeSidebarFileCache = null;
    this._lazyStore = null;
    this._lazyUsage = null;
    this._lazyLsClient = null;
    this._backendSummariesCache = null;
    this._backendSummariesAt = 0;
    this._usageCachePathOpt = usageCachePath;
    this._usageCacheFile = resolveUsageCachePath(usageCachePath);
    this._usageDiskCache = null;
    this._usageCacheDirty = false;
    this._usageCacheTimer = null;
    this._storageHealthCache = null;
    this._storageHealthAt = 0;
    this._lastTelemetryActivityAt = 0;
    this._telemetryInFlight = 0;
    this._customMetricsProvider = metricsProvider;
    this._lazyThoughtService = thoughtService;
    this._lazyWallpaperService = wallpaperService;
    this._wallpaperServicePromise = null;
    this._wallpaperStopped = false;
    this.omniServer = null;
    this._omniServerPromise = null;
    this._omniExecHooks = omniExecHooks;
    this.sidebarService = sidebarService;
    this._sidebarServicePromise = null;
    this._sidebarStopped = false;
    this._relaunchHooks = relaunchHooks;
    this.noPortRelaunchThresholdMs = Math.max(50, Number(noPortRelaunchThresholdMs) || 8000);
    this.shortcutCheckIntervalMs = Math.max(1000, Number(shortcutCheckIntervalMs) || 300000);
    const backoffMs = Number(shortcutBackoffIntervalMs);
    this._shortcutBackoffIntervalMs = Math.max(
      this.shortcutCheckIntervalMs,
      Number.isFinite(backoffMs) && backoffMs > 0 ? backoffMs : 45 * 60 * 1000
    );
    this._shortcutAllClean = false;
    this._hasActiveCdpPort = false;
    this._portState = 'unknown';
    this._noPortSinceMs = 0;
    this._promptInFlight = false;
    this._lastShortcutCheckAt = 0;
    this._lastObservedHostPid = 0;
    this._lastActiveCdpPort = null;
    this._prevAttachedCount = 0;
    this._disconnectedAllSessions = false;
    this._enableAutoUpdateTimer = enableAutoUpdateTimer !== false;
    const initDelayNum = Number(updateCheckInitialDelayMs);
    this._updateCheckInitialDelayMs = Number.isFinite(initDelayNum) ? Math.max(0, initDelayNum) : 45000;
    const intervalNum = Number(updateCheckIntervalMs);
    this._updateCheckIntervalMs = Number.isFinite(intervalNum) ? Math.max(1000, intervalNum) : 6 * 60 * 60 * 1000;
    this._updateInitialTimer = null;
    this._updateIntervalTimer = null;
    this._lastUpdateState = null;
    this._updateCheckInFlight = null;
    this._updateCheckInFlightChannel = null;
    const initialUpdateChannel = this._getUpdateChannelSetting();
    this.updateService =
      _testUpdateService ||
      new UpdateService({
        currentVersion: this.cdp?.PLUGIN_VERSION || '1.0.7',
        channel: initialUpdateChannel,
      });
    if (_testUpdateService && typeof _testUpdateService.setChannel === 'function') {
      try {
        _testUpdateService.setChannel(initialUpdateChannel);
      } catch {}
    }
  }

  _resolveConfiguredPollIntervalMs(cfgOverride = null) {
    try {
      const cfg = cfgOverride || (typeof this.cdp?.readConfig === 'function' ? this.cdp.readConfig() : null);
      const raw = cfg && cfg.pollIntervalMs !== undefined ? Number(cfg.pollIntervalMs) : NaN;
      if (Number.isFinite(raw) && raw > 0) {
        return Math.max(1500, Math.min(15000, Math.round(raw)));
      }
    } catch {}
    return 3000;
  }

  _syncPollIntervalFromConfig(cfgOverride = null) {
    if (this._hasExplicitPollInterval) return this.pollIntervalMs;
    const nextMs = this._resolveConfiguredPollIntervalMs(cfgOverride);
    if (nextMs !== this.pollIntervalMs) {
      this.pollIntervalMs = nextMs;
      if (this.running && this.timer) {
        clearInterval(this.timer);
        this.timer = setInterval(() => {
          void this.tick();
        }, this.pollIntervalMs);
      }
    }
    return this.pollIntervalMs;
  }

  log(msg) {
    if (!this.silent) {
      try {
        const MAX_LOG_BYTES = 512 * 1024;
        const MAX_LINE_CHARS = 16384;
        if (this._logBytes < 0) {
          try {
            this._logBytes = fs.statSync(this.logFile).size;
          } catch {
            this._logBytes = 0;
          }
        }
        const rawText = String(msg ?? '');
        const safeText = rawText.length > MAX_LINE_CHARS ? `${rawText.slice(0, MAX_LINE_CHARS)}...[truncated]` : rawText;
        const line = `[${new Date().toISOString()}] ${safeText}\n`;
        const lineBytes = Buffer.byteLength(line, 'utf8');
        if (this._logBytes > MAX_LOG_BYTES || this._logBytes + lineBytes > MAX_LOG_BYTES) {
          fs.writeFileSync(this.logFile, '', 'utf8');
          this._logBytes = 0;
        }
        fs.appendFileSync(this.logFile, line, 'utf8');
        this._logBytes += lineBytes;
      } catch {}
    }
  }

  resolveGitRepoDir() {
    const candidates = [];
    if (this.gitRepoDir) candidates.push(this.gitRepoDir);
    candidates.push(this.rootDir);

    const repoMetaPath = path.join(this.rootDir, 'repo-meta.json');
    if (fs.existsSync(repoMetaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(repoMetaPath, 'utf8'));
        if (meta && meta.sourceRepoDir) {
          const src = path.resolve(meta.sourceRepoDir);
          candidates.push(src);
          const parent = path.dirname(src);
          candidates.push(path.join(parent, 'obsidian-prism'));
        }
      } catch {}
    }

    for (const cand of candidates) {
      try {
        if (cand && fs.existsSync(path.join(cand, '.git'))) {
          return cand;
        }
      } catch {}
    }
    return null;
  }

  async _handleStorageAction(action, _testOverrides = null) {
    try {
      const modUrl = new URL('./conversation-archive.mjs', import.meta.url);
      const arch = await import(modUrl.href);
      const now = Number.isFinite(_testOverrides?.now) ? _testOverrides.now : Date.now();
      if (action === 'storage-health' && this._storageHealthCache && now - this._storageHealthAt < 300000) {
        return this._storageHealthCache;
      }
      const convDir = _testOverrides?.convDir || arch.getDefaultConversationsDir();
      const archiveDir = _testOverrides?.archiveDir || arch.getDefaultArchiveDir();
      let liveSummaries = null;
      const existingIdx = arch.loadCatalogIndex(archiveDir);
      const parsedUpdatedAt = existingIdx?.updatedAt ? Date.parse(existingIdx.updatedAt) : NaN;
      const idxAgeMs = Number.isFinite(parsedUpdatedAt) ? Math.max(0, now - parsedUpdatedAt) : Infinity;

      if (action === 'prepare-archive' || !existingIdx || idxAgeMs > 1800000) {
        // Reuse already-warm in-memory summaries first to avoid extra RPC traffic
        const warmReaderSums = this._lazyStore?.client?.reader?.summaries;
        if (action !== 'prepare-archive' && warmReaderSums && Object.keys(warmReaderSums).length > 0) {
          liveSummaries = warmReaderSums;
        } else {
          this._telemetryInFlight = (this._telemetryInFlight || 0) + 1;
          this._lastTelemetryActivityAt = Date.now();
          try {
            const client = await this.ensureLsClient();
            const raw = await client.call('GetAllCascadeTrajectories', { excludeSubtrajectories: false });
            if (raw?.trajectorySummaries && Object.keys(raw.trajectorySummaries).length > 0) {
              liveSummaries = raw.trajectorySummaries;
            }
          } catch {
          } finally {
            this._telemetryInFlight = Math.max(0, (this._telemetryInFlight || 1) - 1);
            this._lastTelemetryActivityAt = Date.now();
          }
        }
        if (liveSummaries) {
          try { arch.saveCatalogIndex(archiveDir, liveSummaries); } catch {}
        }
      }

      const scan =
        typeof arch.scanConversationStorageAsync === 'function'
          ? await arch.scanConversationStorageAsync({
              convDir,
              archiveDir,
              summaries: liveSummaries,
              subagentMaxAgeHours: action === 'prepare-archive' ? 1 : 6,
              now,
            })
          : arch.scanConversationStorage({
              convDir,
              archiveDir,
              summaries: liveSummaries,
              subagentMaxAgeHours: action === 'prepare-archive' ? 1 : 6,
              now,
            });
      const base = {
        ok: true,
        action,
        totalMb: scan.totalMb,
        conversationCount: scan.conversationCount,
        mainCount: scan.mainCount,
        mainMb: scan.mainMb,
        subagentCount: scan.subagentCount,
        subagentMb: scan.subagentMb,
        archivableSubagentCount: scan.archivableSubagentCount,
        archivableSubagentMb: scan.archivableSubagentMb,
        warn: scan.warn,
        archiveDir: scan.archiveDir,
      };
      if (action === 'prepare-archive') {
        const scriptPath = path.join(this.rootDir, 'sidecars', 'daemon', 'conversation-archive.mjs');
        const helpers = arch.writeHelperScripts({ scriptPath, archiveDir });
        // Do not overwrite 6h storage-health cache with prepare-archive's 1h threshold view
        this._storageHealthCache = null;
        this._storageHealthAt = 0;
        return { ...base, ...helpers };
      }
      this._storageHealthCache = base;
      this._storageHealthAt = now;
      return base;
    } catch (err) {
      return { ok: false, action, error: sanitizeSecretText(err?.message || err) };
    }
  }

  async _handleUninstallAction(rawInput = {}) {
    if (rawInput?.confirm !== true) {
      return { ok: false, action: 'uninstall', error: 'confirmation_required' };
    }
    const purgeData = rawInput?.purgeData === true;
    const ov = rawInput?._testOverrides && typeof rawInput._testOverrides === 'object' ? rawInput._testOverrides : null;
    const platform = ov?.platform || process.platform;
    const lstatFn = typeof ov?.lstatSync === 'function' ? ov.lstatSync : fs.lstatSync;
    const spawnFn = typeof ov?.spawn === 'function' ? ov.spawn : spawn;

    let installerPath = null;
    if (ov && Object.prototype.hasOwnProperty.call(ov, 'installerPath')) {
      installerPath = ov.installerPath || null;
    } else if (platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
      installerPath = path.join(localAppData, 'obsidian-prism', 'obsidian-prism-installer.exe');
    } else if (platform === 'darwin') {
      installerPath = path.join(os.homedir(), 'Library', 'Application Support', 'obsidian-prism', 'obsidian-prism-installer');
    }

    let engine = null;
    let spawnCmd = null;
    let spawnArgs = [];
    let spawnEnv = null;

    if (installerPath) {
      try {
        const lst = lstatFn(installerPath);
        if (lst && typeof lst.isSymbolicLink === 'function' && lst.isSymbolicLink()) {
          return { ok: false, action: 'uninstall', error: 'refused_symlink_installer' };
        }
        if (lst && typeof lst.isFile === 'function' && lst.isFile()) {
          engine = 'installer';
          spawnCmd = installerPath;
          spawnArgs = ['--uninstall', '--silent', ...(purgeData ? ['--purge-data'] : [])];
        }
      } catch (err) {
        if (err && err.code !== 'ENOENT') {
          return { ok: false, action: 'uninstall', error: sanitizeSecretText(err?.message || err) };
        }
      }
    }

    if (!spawnCmd) {
      engine = 'source-script';
      let scriptPath = null;
      if (ov && Object.prototype.hasOwnProperty.call(ov, 'installScriptPath')) {
        scriptPath = ov.installScriptPath || null;
      } else {
        const repoDir = this.resolveGitRepoDir();
        const candidates = [
          repoDir ? path.join(repoDir, 'tools', 'install-plugin.cjs') : null,
          path.join(this.rootDir, 'tools', 'install-plugin.cjs'),
        ].filter(Boolean);
        for (const cand of candidates) {
          try {
            const st = lstatFn(cand);
            if (st && !st.isSymbolicLink() && st.isFile()) {
              scriptPath = cand;
              break;
            }
          } catch {}
        }
      }

      const inlineRunner = scriptPath
        ? "setTimeout(async()=>{try{const m=require(process.env.AG_PRISM_UNINSTALL_SCRIPT);await m.uninstallPlugin({targetDir:process.env.AG_PRISM_UNINSTALL_TARGET,purgeData:process.env.AG_PRISM_PURGE_DATA==='1',cdpPort:Number(process.env.AG_PRISM_CDP_PORT)||undefined});}catch{}process.exit(0);},400);"
        : "setTimeout(()=>{try{const fs=require('fs'),path=require('path'),os=require('os');const t=process.env.AG_PRISM_UNINSTALL_TARGET;if(t){const r=path.resolve(t),h=path.resolve(os.homedir()),segs=r.split(/[\\\\/]+/).map(s=>s.toLowerCase()),rl=['conversations_archive','prism-knowledge-space','antigravity-spark'],prot=[path.parse(r).root,h,path.join(h,'.gemini'),path.join(h,'.gemini','config'),path.join(h,'.gemini','antigravity')].map(p=>p.toLowerCase());if(!prot.includes(r.toLowerCase())&&!rl.some(k=>segs.includes(k))&&fs.existsSync(r)&&!fs.lstatSync(r).isSymbolicLink())fs.rmSync(r,{recursive:true,force:true});}const cfgDir=path.join(os.homedir(),'.gemini','config'),cfg=path.join(cfgDir,'config.json');if(fs.existsSync(cfg)&&!fs.lstatSync(cfg).isSymbolicLink()){const d=JSON.parse(fs.readFileSync(cfg,'utf8'));if(d&&typeof d==='object'){if(d.plugins)delete d.plugins['obsidian-prism'];if(d.sidecars)delete d.sidecars['obsidian-prism/daemon'];const tmp=cfg+'.tmp.'+process.pid;fs.writeFileSync(tmp,JSON.stringify(d,null,2)+'\\n',{mode:0o600});fs.renameSync(tmp,cfg);}}}catch{}process.exit(0);},400);";
      spawnCmd = process.execPath;
      spawnArgs = ['-e', inlineRunner];
      spawnEnv = {
        ...process.env,
        AG_PRISM_UNINSTALL_TARGET: this.rootDir,
        AG_PRISM_PURGE_DATA: purgeData ? '1' : '0',
        ...(scriptPath ? { AG_PRISM_UNINSTALL_SCRIPT: scriptPath } : {}),
        ...(this.cdpPort ? { AG_PRISM_CDP_PORT: String(this.cdpPort) } : {}),
      };
    }

    const spawnOpts = {
      detached: true,
      cwd: os.tmpdir(),
      stdio: 'ignore',
      windowsHide: true,
      ...(spawnEnv ? { env: spawnEnv } : {}),
    };
    const child = spawnFn(spawnCmd, spawnArgs, spawnOpts);
    child?.unref?.();

    if (!ov?.skipStop) {
      const stopDelayMs = Number.isFinite(ov?.stopDelayMs) ? ov.stopDelayMs : 150;
      const stopFn = typeof ov?.stop === 'function' ? ov.stop : () => this.stop(!installerPath || engine !== 'installer');
      const exitFn = typeof ov?.exit === 'function' ? ov.exit : (code) => process.exit(code);
      const timer = setTimeout(() => {
        Promise.resolve(stopFn()).catch(() => {}).finally(() => exitFn(0));
      }, stopDelayMs);
      timer.unref?.();
    }

    return {
      ok: true,
      action: 'uninstall',
      scheduled: true,
      purgeData,
      engine,
    };
  }

  _getAutoUpdateSetting() {
    try {
      const cfg = typeof this.cdp?.readConfig === 'function' ? this.cdp.readConfig() : null;
      return cfg?.autoUpdate === 'on' ? 'on' : 'off';
    } catch {
      return 'off';
    }
  }

  async _inspectGitRepoState({ fetchRemote = false } = {}) {
    const repoDir = this.resolveGitRepoDir();
    if (!repoDir) {
      return {
        isGitRepo: false,
        repoDir: null,
        repoPath: path.basename(this.rootDir),
        branch: 'standalone',
        commit: this.cdp.PLUGIN_VERSION,
        dirty: false,
        remoteName: '',
        remoteUrl: '',
        hasRemote: false,
        noRemote: true,
        ahead: 0,
        behind: 0,
        netGitCfg: [],
        blockedUnc: false,
      };
    }

    let branch = 'HEAD';
    let commit = '';
    let dirty = false;
    let remoteName = '';
    let remoteUrl = '';

    try {
      branch = (await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoDir, 5000)) || 'HEAD';
    } catch {
      branch = 'main';
    }
    try {
      commit = await execGit(['rev-parse', '--short', 'HEAD'], repoDir, 5000);
    } catch {
      commit = 'uncommitted';
    }
    try {
      const porcelain = await execGit(['status', '--porcelain'], repoDir, 5000);
      dirty = Boolean(porcelain.trim());
    } catch {}

    let isNetworkRemote = false;
    let blockedUnc = false;
    try {
      const remotesRaw = await execGit(['remote'], repoDir, 4000);
      const remotes = remotesRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (remotes.length > 0) {
        remoteName = remotes.includes('origin') ? 'origin' : remotes[0];
        const rawRemoteUrl = await execGit(['remote', 'get-url', remoteName], repoDir, 4000).catch(() => '');
        if (rawRemoteUrl && isBlockedUncPath(rawRemoteUrl)) {
          blockedUnc = true;
        } else {
          isNetworkRemote = /^(?:https?|ssh|git):\/\/|^[^/\\:\s]+@[^/\\:\s]+:/i.test(rawRemoteUrl);
          remoteUrl = sanitizeGitRemoteUrl(rawRemoteUrl);
        }
      }
    } catch {}

    const netGitCfg = isNetworkRemote ? ['-c', 'protocol.file.allow=never'] : [];
    const safeRepoName = path.basename(repoDir);
    const hasRemote = Boolean(!blockedUnc && remoteName && remoteUrl);

    let ahead = 0;
    let behind = 0;
    if (hasRemote) {
      if (fetchRemote) {
        try {
          await execGit(['fetch', '--quiet', '--no-recurse-submodules', remoteName], repoDir, 8000, netGitCfg);
        } catch {}
      }
      try {
        const targetRef = branch && branch !== 'HEAD' ? `${remoteName}/${branch}` : '@{u}';
        const counts = await execGit(['rev-list', '--left-right', '--count', `HEAD...${targetRef}`], repoDir, 5000);
        const parts = counts.split(/\s+/).map((x) => parseInt(x, 10));
        if (Number.isInteger(parts[0])) ahead = parts[0];
        if (Number.isInteger(parts[1])) behind = parts[1];
      } catch {}
    }

    return {
      isGitRepo: true,
      repoDir,
      repoPath: safeRepoName,
      branch,
      commit,
      dirty,
      remoteName,
      remoteUrl,
      hasRemote,
      noRemote: !hasRemote,
      ahead,
      behind,
      netGitCfg,
      blockedUnc,
    };
  }

  async _executeGitPullHotReload(gitState, actionName = 'pull') {
    const { repoDir, repoPath, branch, commit: prevCommit, dirty, remoteName, remoteUrl, netGitCfg } = gitState;
    try {
      const prevFullSha = await execGit(['rev-parse', 'HEAD'], repoDir, 5000).catch(() => '');
      const pullArgs =
        branch && branch !== 'HEAD'
          ? ['pull', '--ff-only', '--no-recurse-submodules', remoteName, branch]
          : ['pull', '--ff-only', '--no-recurse-submodules'];
      const pullOut = await execGit(pullArgs, repoDir, 15000, netGitCfg);
      const nextCommit = await execGit(['rev-parse', '--short', 'HEAD'], repoDir, 5000).catch(() => prevCommit);
      const nextFullSha = await execGit(['rev-parse', 'HEAD'], repoDir, 5000).catch(() => prevFullSha);
      const updated = Boolean(nextCommit && nextCommit !== prevCommit);

      let changedFiles = [];
      if (prevFullSha && nextFullSha && prevFullSha !== nextFullSha) {
        try {
          const diffOut = await execGit(['diff', '--name-only', `${prevFullSha}..${nextFullSha}`], repoDir, 5000);
          changedFiles = diffOut.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        } catch {}
      }
      const needsHardReload = changedFiles.some((f) => /^(?:sidecars\/|installer\/|cdp\.js$)/.test(f));

      let hotReloaded = false;
      if (updated) {
        copyUpdatedRuntimeFromRepo(repoDir, this.rootDir, this.cdp.SYNC_ROOT_FILES);
      }
      this.rebuildBundle({ forceReloadCdp: updated });
      const activeItems = [...this.sessions.values()].filter((item) => item && !item.session.closed);
      if (activeItems.length > 0) {
        await Promise.allSettled(activeItems.map((item) => this.applyToEntry(item)));
        hotReloaded = true;
      }

      return {
        ok: true,
        action: actionName,
        isGitRepo: true,
        repoPath,
        branch,
        prevCommit,
        commit: nextCommit,
        shortHash: nextCommit,
        dirty,
        remoteName,
        remoteUrl,
        hasRemote: true,
        noRemote: false,
        ahead: 0,
        behind: 0,
        hasUpdates: false,
        upToDate: true,
        updated,
        hotReloaded,
        needsHardReload,
        needsHardReloadHint: needsHardReload,
        changedFiles,
        version: this.cdp.PLUGIN_VERSION,
        message: sanitizeSecretText(pullOut || (updated ? `Updated ${prevCommit} -> ${nextCommit}` : 'Already up to date')),
      };
    } catch (err) {
      const safeErr = sanitizeSecretText(err?.message || 'git pull --ff-only failed');
      return {
        ok: false,
        action: actionName,
        isGitRepo: true,
        repoPath,
        branch,
        commit: prevCommit,
        shortHash: prevCommit,
        dirty,
        remoteName,
        remoteUrl,
        hasRemote: true,
        noRemote: false,
        updated: false,
        version: this.cdp.PLUGIN_VERSION,
        error: safeErr,
        message: safeErr,
      };
    }
  }

  _getUpdateChannelSetting(cfgOverride = null) {
    try {
      const cfg = cfgOverride || this.cdp?.readConfig?.();
      return cfg?.updateChannel === 'beta' ? 'beta' : 'stable';
    } catch {
      return 'stable';
    }
  }

  _syncUpdateServiceChannel(cfgOverride = null) {
    const ch = this._getUpdateChannelSetting(cfgOverride);
    let changed = false;
    if (typeof this.updateService?.setChannel === 'function') {
      changed = Boolean(this.updateService.setChannel(ch));
    } else if (this.updateService && typeof this.updateService === 'object' && this.updateService.channel !== ch) {
      this.updateService.channel = ch;
      changed = true;
    }
    if (changed) {
      this._lastUpdateState = null;
    }
    return { channel: ch, changed };
  }

  _extractExplicitUpdateChannel(rawInput) {
    if (!rawInput || typeof rawInput !== 'object') return null;
    const candidates = [
      rawInput.channel,
      rawInput.updateChannel,
      rawInput.version && typeof rawInput.version === 'object' ? rawInput.version.channel : undefined,
      rawInput.version && typeof rawInput.version === 'object' ? rawInput.version.updateChannel : undefined,
      rawInput.input && typeof rawInput.input === 'object' ? rawInput.input.channel : undefined,
      rawInput.input && typeof rawInput.input === 'object' ? rawInput.input.updateChannel : undefined,
      rawInput.payload && typeof rawInput.payload === 'object' ? rawInput.payload.channel : undefined,
      rawInput.payload && typeof rawInput.payload === 'object' ? rawInput.payload.updateChannel : undefined,
    ];
    for (const c of candidates) {
      if (c === 'stable' || c === 'beta') return c;
    }
    return null;
  }

  _buildCombinedUpdateStatus({ relState = null, gitState = null, action = 'update-status', channelOverride = null } = {}) {
    const currentVersion = this.cdp?.PLUGIN_VERSION || this.updateService?.currentVersion || '1.0.7';
    const rel = relState || this.updateService?.getStatus?.() || {};
    const autoUpdate = this._getAutoUpdateSetting();
    const explicitChannel = channelOverride === 'beta' || channelOverride === 'stable' ? channelOverride : null;
    const updateChannel = explicitChannel || this._getUpdateChannelSetting();
    const channel =
      explicitChannel ||
      (rel.channel === 'beta' || rel.channel === 'stable' ? rel.channel : updateChannel);
    const isGitRemote = Boolean(gitState?.hasRemote);
    const isPrerelease = isGitRemote ? false : Boolean(rel.isPrerelease);
    const gitHasUpdate = Boolean(isGitRemote && gitState.behind > 0);
    const relHasUpdate = Boolean(rel.hasUpdate);
    const hasUpdate = gitHasUpdate || relHasUpdate;
    const mode = isGitRemote ? 'git' : rel.mode || (process.platform === 'win32' ? 'installer' : 'manual');
    const hotReloadCapable = isGitRemote ? true : Boolean(rel.hotReloadCapable);
    const manualRequired = isGitRemote ? false : Boolean(rel.manualRequired);
    return {
      ok: true,
      action,
      channel,
      updateChannel,
      isPrerelease,
      currentVersion,
      latestVersion: rel.latestVersion || currentVersion,
      latestTag: rel.latestTag || null,
      hasUpdate,
      autoUpdate,
      mode,
      hotReloadCapable,
      manualRequired,
      releaseUrl: rel.releaseUrl || RELEASES_PAGE_URL,
      downloadUrl: rel.downloadUrl || null,
      checkedAt: rel.checkedAt || (isGitRemote ? Date.now() : null),
      applying: Boolean(this.updateService?.applying),
      lastError: rel.lastError || rel.error || null,
      isGitRepo: Boolean(gitState?.isGitRepo),
      hasRemote: isGitRemote,
      behind: Number(gitState?.behind || 0),
      branch: gitState?.branch || 'standalone',
      commit: gitState?.commit || currentVersion,
    };
  }

  async runUpdateCheck({ force = false, manual = false, allowAutoApply = false, channel = null } = {}) {
    const explicitChannel = channel === 'beta' || channel === 'stable' ? channel : null;
    const { channel: activeChannel, changed: channelChanged } = explicitChannel
      ? this._syncUpdateServiceChannel({ updateChannel: explicitChannel })
      : this._syncUpdateServiceChannel();
    const effectiveForce = Boolean(force || channelChanged);
    if (this._updateCheckInFlight && !channelChanged && this._updateCheckInFlightChannel === activeChannel) {
      return this._updateCheckInFlight;
    }
    const run = async () => {
      try {
        const gitState = await this._inspectGitRepoState({ fetchRemote: true });
        let relState = null;
        try {
          relState = await this.updateService.checkForUpdates({
            force: effectiveForce,
            manual,
            channel: activeChannel,
          });
        } catch (err) {
          relState = {
            ...(this.updateService?.getStatus?.() || {}),
            channel: activeChannel,
            ok: false,
            lastError: String(err?.message || err || 'check_failed'),
          };
        }
        const combined = this._buildCombinedUpdateStatus({
          relState,
          gitState,
          action: manual ? 'check-update' : 'update-status',
          channelOverride: activeChannel,
        });
        const svcChannel = this.updateService?.channel;
        const channelStillCurrent = !svcChannel || svcChannel === activeChannel;
        if (channelStillCurrent && (this._getUpdateChannelSetting() === activeChannel || explicitChannel !== null)) {
          this._lastUpdateState = combined;
        }

        if (channelStillCurrent && allowAutoApply && this._getAutoUpdateSetting() === 'on' && combined.hasUpdate) {
          if (gitState.hasRemote && gitState.behind > 0) {
            const pullRes = await this._executeGitPullHotReload(gitState, 'apply-update');
            this._lastUpdateState = {
              ...combined,
              hasUpdate: false,
              behind: 0,
              commit: pullRes.commit || combined.commit,
              lastAutoApply: pullRes,
            };
          } else if (!gitState.hasRemote && relState?.hasUpdate) {
            const applyRes = await this.updateService.applyReleaseUpdate({ confirm: true, auto: true });
            this._lastUpdateState = {
              ...combined,
              lastError: applyRes.ok ? null : applyRes.error || combined.lastError,
              lastAutoApply: applyRes,
            };
          }
        }
        return channelStillCurrent ? this._lastUpdateState || combined : combined;
      } finally {
        if (this._updateCheckInFlight === p) {
          this._updateCheckInFlight = null;
          this._updateCheckInFlightChannel = null;
        }
      }
    };
    const p = run();
    this._updateCheckInFlight = p;
    this._updateCheckInFlightChannel = activeChannel;
    return p;
  }

  async executeRepoAction(rawInput = {}, secondArg = undefined) {
    if (typeof rawInput === 'string') {
      const extra =
        secondArg && typeof secondArg === 'object' && !Array.isArray(secondArg)
          ? secondArg
          : typeof secondArg === 'string'
            ? { version: secondArg }
            : {};
      rawInput = { ...extra, action: rawInput };
    }
    if (rawInput?.action === 'storage-health' || rawInput?.action === 'prepare-archive') {
      return this._handleStorageAction(rawInput.action);
    }
    if (rawInput?.action === 'uninstall') {
      return this._handleUninstallAction(rawInput);
    }
    if (rawInput?.action === 'update-status') {
      const explicitChannel = this._extractExplicitUpdateChannel(rawInput);
      const { channel, changed } = explicitChannel
        ? this._syncUpdateServiceChannel({ updateChannel: explicitChannel })
        : this._syncUpdateServiceChannel();
      const gitState = await this._inspectGitRepoState({ fetchRemote: false });
      const relState = this.updateService?.getStatus?.() || null;
      const hasFreshCached = Boolean(
        this._lastUpdateState &&
          !changed &&
          this._lastUpdateState.channel === channel &&
          this._lastUpdateState.checkedAt
      );
      if (hasFreshCached) {
        return {
          ...this._lastUpdateState,
          action: 'update-status',
          channel,
          updateChannel: channel,
          checking: false,
          autoUpdate: this._getAutoUpdateSetting(),
          applying: Boolean(this.updateService?.applying),
        };
      }
      const baseState = this._buildCombinedUpdateStatus({
        relState,
        gitState,
        action: 'update-status',
        channelOverride: channel,
      });
      const shouldAwaitFreshCheck = changed || (explicitChannel !== null && !baseState.checkedAt);
      if (shouldAwaitFreshCheck) {
        const rawWait = Number(rawInput?.waitTimeoutMs);
        const waitMs = Number.isFinite(rawWait) && rawWait >= 0 ? Math.min(10000, rawWait) : 2500;
        const checkPromise = this.runUpdateCheck({
          force: changed,
          manual: false,
          allowAutoApply: false,
          channel,
        });
        let timedOut = false;
        let timer = null;
        const settled = await Promise.race([
          checkPromise.then((res) => ({ done: true, res })).catch(() => ({ done: false, res: null })),
          new Promise((resolve) => {
            timer = setTimeout(() => {
              timedOut = true;
              resolve({ done: false, res: null });
            }, waitMs);
            if (typeof timer.unref === 'function') timer.unref();
          }),
        ]);
        if (timer) clearTimeout(timer);
        if (settled?.done && settled.res && settled.res.channel === channel) {
          return {
            ...settled.res,
            action: 'update-status',
            channel,
            updateChannel: channel,
            checking: false,
            autoUpdate: this._getAutoUpdateSetting(),
            applying: Boolean(this.updateService?.applying),
          };
        }
        return {
          ...baseState,
          action: 'update-status',
          channel,
          updateChannel: channel,
          checking: Boolean(
            timedOut || (this._updateCheckInFlight && this._updateCheckInFlightChannel === channel)
          ),
        };
      }
      if (!baseState.checkedAt) {
        void this.runUpdateCheck({ force: false, manual: false, allowAutoApply: false, channel }).catch(() => {});
        return { ...baseState, checking: true };
      }
      return { ...baseState, checking: false };
    }
    if (rawInput?.action === 'check-update') {
      const explicitChannel = this._extractExplicitUpdateChannel(rawInput);
      const res = await this.runUpdateCheck({
        force: rawInput?.force !== false,
        manual: Boolean(rawInput?.manual),
        allowAutoApply: false,
        channel: explicitChannel,
      });
      return { ...res, action: 'check-update' };
    }
    if (rawInput?.action === 'apply-update') {
      if (rawInput?.confirm !== true) {
        return { ok: false, action: 'apply-update', error: 'confirmation_required' };
      }
      const explicitChannel = this._extractExplicitUpdateChannel(rawInput);
      const { channel } = explicitChannel
        ? this._syncUpdateServiceChannel({ updateChannel: explicitChannel })
        : this._syncUpdateServiceChannel();
      const gitState = await this._inspectGitRepoState({ fetchRemote: false });
      if (gitState.blockedUnc) {
        return { ok: false, action: 'apply-update', error: 'Remote UNC Git paths are blocked' };
      }
      if (gitState.hasRemote) {
        const pullRes = await this._executeGitPullHotReload(gitState, 'apply-update');
        return {
          ...pullRes,
          channel,
          mode: 'git',
          hotReloadCapable: true,
          targetVersion: pullRes.commit,
        };
      }
      const applyRes = await this.updateService.applyReleaseUpdate({ confirm: true, auto: false });
      return {
        ...applyRes,
        action: 'apply-update',
        channel,
        currentVersion: this.cdp?.PLUGIN_VERSION || this.updateService?.currentVersion || '1.0.7',
      };
    }

    const action = rawInput?.action === 'pull' || rawInput?.action === 'sync' ? 'pull' : 'status';
    const gitState = await this._inspectGitRepoState({ fetchRemote: action === 'status' });
    if (!gitState.isGitRepo) {
      return {
        ok: true,
        action,
        isGitRepo: false,
        repoPath: path.basename(this.rootDir),
        branch: 'standalone',
        commit: this.cdp.PLUGIN_VERSION,
        shortHash: this.cdp.PLUGIN_VERSION,
        dirty: false,
        remoteUrl: '',
        hasRemote: false,
        noRemote: true,
        ahead: 0,
        behind: 0,
        hasUpdates: false,
        upToDate: true,
        updated: false,
        version: this.cdp.PLUGIN_VERSION,
        message: 'Installed standalone plugin (no linked Git repository)',
      };
    }
    if (gitState.blockedUnc) {
      return {
        ok: false,
        action,
        isGitRepo: true,
        repoPath: gitState.repoPath,
        branch: gitState.branch,
        commit: gitState.commit,
        shortHash: gitState.commit,
        dirty: gitState.dirty,
        error: 'Remote UNC Git paths are blocked',
        message: 'Remote UNC Git paths are blocked',
      };
    }
    if (!gitState.hasRemote) {
      return {
        ok: true,
        action,
        isGitRepo: true,
        repoPath: gitState.repoPath,
        branch: gitState.branch,
        commit: gitState.commit,
        shortHash: gitState.commit,
        dirty: gitState.dirty,
        remoteName: '',
        remoteUrl: '',
        hasRemote: false,
        noRemote: true,
        ahead: 0,
        behind: 0,
        hasUpdates: false,
        upToDate: true,
        updated: false,
        version: this.cdp.PLUGIN_VERSION,
        message: 'Local Git repository (no remote configured)',
      };
    }
    if (action === 'status') {
      return {
        ok: true,
        action: 'status',
        isGitRepo: true,
        repoPath: gitState.repoPath,
        branch: gitState.branch,
        commit: gitState.commit,
        shortHash: gitState.commit,
        dirty: gitState.dirty,
        remoteName: gitState.remoteName,
        remoteUrl: gitState.remoteUrl,
        hasRemote: true,
        noRemote: false,
        ahead: gitState.ahead,
        behind: gitState.behind,
        hasUpdates: gitState.behind > 0,
        upToDate: gitState.behind === 0,
        updated: false,
        version: this.cdp.PLUGIN_VERSION,
        message: gitState.behind > 0 ? `${gitState.behind} commit(s) available from ${gitState.remoteName}` : 'Already up to date',
      };
    }
    return this._executeGitPullHotReload(gitState, 'pull');
  }

  _readCdpFileSig() {
    try {
      const st = fs.statSync(path.join(this.rootDir, 'cdp.js'));
      return `${st.mtimeMs}:${st.size}`;
    } catch {
      return '';
    }
  }

  _isGitSourceDir(dirPath) {
    if (!dirPath) return false;
    try {
      const resolved = path.resolve(dirPath);
      if (this.gitRepoDir && resolved.toLowerCase() === this.gitRepoDir.toLowerCase()) {
        return true;
      }
      // 兼容普通仓库 .git 目录与 git worktree .git 文件，杜绝向源码目录写入缓存文件
      if (fs.existsSync(path.join(resolved, '.git'))) {
        return true;
      }
    } catch {}
    return false;
  }

  _isWritableCacheDir(dirPath) {
    if (!dirPath) return false;
    try {
      const st = fs.lstatSync(dirPath);
      if (st.isSymbolicLink() || !st.isDirectory()) return false;
      fs.accessSync(dirPath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  resolveBundleCachePath() {
    if (this._bundleCachePathOpt === false || this._bundleCachePathOpt === null) {
      return null;
    }
    if (typeof this._bundleCachePathOpt === 'string') {
      const trimmed = this._bundleCachePathOpt.trim();
      return trimmed ? path.resolve(trimmed) : null;
    }
    const envRaw = process.env.AG_PRISM_BUNDLE_CACHE_PATH;
    if (typeof envRaw === 'string' && envRaw.trim()) {
      const trimmed = envRaw.trim();
      if (/^(?:0|off|false|none)$/i.test(trimmed)) return null;
      return path.resolve(trimmed);
    }
    const cacheFileName =
      typeof this.cdp?.BUNDLE_CACHE_FILENAME === 'string' && this.cdp.BUNDLE_CACHE_FILENAME
        ? this.cdp.BUNDLE_CACHE_FILENAME
        : '.bundle-cache.json';

    // 1) 首选非 Git 源码且可写的已安装插件目录（如 ~/.gemini/config/plugins/obsidian-prism/.bundle-cache.json）：
    //    与 .daemon.pid / daemon.log / config.json 同目录，普通卸载与 --purge-data 均会随插件目录一并自动清理。
    if (!this._isGitSourceDir(this.rootDir) && this._isWritableCacheDir(this.rootDir)) {
      return path.join(this.rootDir, cacheFileName);
    }

    // 2) 自动化测试环境中若 rootDir 是 Git 源码目录或只读目录且未显式指定缓存路径，禁止触碰真实用户主目录
    if (isAutomatedTestRuntime()) {
      return null;
    }

    // 3) 若 rootDir 为 Git 源码目录（开发直跑）或只读安装目录，回退至用户可写 sidecar_data 状态目录
    //    （~/.gemini/antigravity/sidecar_data/obsidian-prism/telemetry/.bundle-cache.json，--purge-data 时可清理）
    try {
      const stateDir = this.resolveTelemetryDataDir();
      if (stateDir && this._isWritableCacheDir(stateDir)) {
        return path.join(stateDir, cacheFileName);
      }
    } catch {}
    return null;
  }

  _scheduleBundleCacheFlush() {
    if (this._bundleCacheFlushTimer) {
      clearTimeout(this._bundleCacheFlushTimer);
      this._bundleCacheFlushTimer = null;
    }
    this._bundleCacheFlushTimer = setTimeout(() => {
      this._bundleCacheFlushTimer = null;
      if (!this.running) return;
      try {
        this.cdp?.flushPendingBundleCache?.();
      } catch {}
    }, 350);
    if (this._bundleCacheFlushTimer && typeof this._bundleCacheFlushTimer.unref === 'function') {
      this._bundleCacheFlushTimer.unref();
    }
  }

  _getChannelCacheOpts(deferCacheWrite = true) {
    const cachePath = this.resolveBundleCachePath();
    if (!cachePath) return null;
    return deferCacheWrite ? { cachePath, deferCacheWrite: true } : { cachePath };
  }

  rebuildBundle({ forceReloadCdp = false, deferDiskCacheWrite = false } = {}) {
    const cdpPath = path.join(this.rootDir, 'cdp.js');
    const nextSig = this._readCdpFileSig();
    if (forceReloadCdp || !this.cdp || (nextSig && nextSig !== this._cdpFileSig)) {
      if (this._bundleCacheFlushTimer) {
        clearTimeout(this._bundleCacheFlushTimer);
        this._bundleCacheFlushTimer = null;
      }
      try {
        delete require.cache[require.resolve(cdpPath)];
      } catch {}
      this.cdp = require(cdpPath);
      this._loadedCdpVerifier = typeof this.cdp?.isExpectedDaemonProcess === 'function' ? this.cdp.isExpectedDaemonProcess : null;
      this._cdpFileSig = nextSig;
    }
    const hasReadConfig = typeof this.cdp.readConfig === 'function';
    const cfg = hasReadConfig ? this.cdp.readConfig() : null;
    const bundleCachePath = this.resolveBundleCachePath();
    const canBatchFlush = Boolean(bundleCachePath && typeof this.cdp.flushPendingBundleCache === 'function');
    const useDeferWrite = Boolean(deferDiskCacheWrite || canBatchFlush);
    const cacheOpts = bundleCachePath
      ? useDeferWrite
        ? { cachePath: bundleCachePath, deferCacheWrite: true }
        : { cachePath: bundleCachePath }
      : null;

    this.injectExpr = cacheOpts
      ? this.cdp.buildInjectExpression(cfg || undefined, cacheOpts)
      : this.cdp.buildInjectExpression(cfg || undefined);
    const m = this.injectExpr.match(/"codeHash":"([^"]+)"/);
    this.codeHash = m ? m[1] : '';
    const shouldBuildOmni =
      typeof this.cdp.buildOmniClientExpression === 'function' &&
      this._isOmniEnabled(cfg);
    if (shouldBuildOmni) {
      const meta = this.omniServer && this.omniServer.running ? this.omniServer.getServerInfo() : null;
      this.omniExpr = cacheOpts
        ? this.cdp.buildOmniClientExpression(meta, null, cacheOpts)
        : this.cdp.buildOmniClientExpression(meta);
    } else {
      this.omniExpr = '';
    }
    const shouldBuildSidebar =
      typeof this.cdp.buildSidebarStudioExpression === 'function' &&
      (!hasReadConfig || this._isSidebarStudioEnabled(cfg));
    if (shouldBuildSidebar) {
      this.sidebarExpr = this._buildSidebarExprForCurrentClient(cacheOpts);
    } else {
      this.sidebarExpr = '';
    }
    const shouldBuildHostI18n =
      typeof this.cdp.buildHostI18nExpression === 'function' &&
      this._isHostI18nEnabled(cfg);
    if (shouldBuildHostI18n) {
      this.hostI18nExpr = cacheOpts
        ? this.cdp.buildHostI18nExpression(cfg, null, cacheOpts)
        : this.cdp.buildHostI18nExpression(cfg);
    } else {
      this.hostI18nExpr = '';
    }
    this._buildThoughtExprForConfig(cfg, cacheOpts);
    this._buildInlineDiffExprForConfig(cfg, cacheOpts);
    this._buildWallpaperExprForConfig(cfg, cacheOpts);
    this._buildCatSanctuaryExprForConfig(cfg, cacheOpts);
    this._buildEffortSliderExprForConfig(cfg, cacheOpts);
    this._buildChatSceneExprForConfig(cfg, cacheOpts);

    if (bundleCachePath) {
      if (deferDiskCacheWrite) {
        this._scheduleBundleCacheFlush();
      } else if (canBatchFlush) {
        try {
          this.cdp.flushPendingBundleCache();
        } catch {}
      }
    }
    return this.injectExpr;
  }

  _hasOmniClientFile() {
    try {
      return fs.existsSync(path.join(this.rootDir, 'vendor', 'omni-viewer', 'omni-client.js'));
    } catch {
      return false;
    }
  }

  _hasSafeV2SidebarClientFile() {
    try {
      const p = path.join(this.rootDir, 'vendor', 'sidebar-studio', 'sidebar-client.js');
      let st;
      try {
        st = fs.statSync(p);
      } catch {
        this._safeSidebarFileCache = { path: p, sig: '', ok: false };
        return false;
      }
      if (!st.isFile()) {
        this._safeSidebarFileCache = { path: p, sig: '', ok: false };
        return false;
      }
      const sig = `${st.mtimeMs}:${st.size}:${st.ctimeMs}`;
      if (this._safeSidebarFileCache && this._safeSidebarFileCache.path === p && this._safeSidebarFileCache.sig === sig) {
        return this._safeSidebarFileCache.ok;
      }
      const src = fs.readFileSync(p, 'utf8');
      const ok =
        typeof this.cdp?.isSafeV2SidebarClientSource === 'function'
          ? Boolean(this.cdp.isSafeV2SidebarClientSource(src))
          : // 严禁挂载任何含旧版全局权限写入（setPrefValue/setPrefValues 任意形式）的客户端，仅放行 v2 零全局写渲染端
            src.includes('SIDEBAR_STUDIO_CLIENT_V2') && !/setPrefValues?/i.test(src);
      this._safeSidebarFileCache = { path: p, sig, ok };
      return ok;
    } catch {
      this._safeSidebarFileCache = null;
      return false;
    }
  }

  _isOmniEnabled(cfgOverride = null) {
    try {
      const cfg = cfgOverride || this.cdp?.readConfig?.();
      return cfg?.omniModule !== 'off' && cfg?.omniModule !== false;
    } catch {
      return true;
    }
  }

  _buildOmniCleanupExpression() {
    return "(() => { try { if (document.documentElement) document.documentElement.setAttribute('data-ag-prism-omni', 'off'); window.__agPrismOmni?.destroy?.(); delete window.__agPrismOmni; delete window.__agPrismOmniServerMeta; } catch {} return { ok: true, status: 'off' }; })()";
  }

  _isSidebarStudioEnabled(cfgOverride = null) {
    try {
      const cfg = cfgOverride || this.cdp?.readConfig?.();
      return cfg?.sidebarStudio === 'on';
    } catch {
      return false;
    }
  }

  _isHostI18nEnabled(cfgOverride = null) {
    try {
      const cfg = cfgOverride || this.cdp?.readConfig?.();
      if (typeof this.cdp?.shouldEnableHostI18n === 'function') {
        return Boolean(this.cdp.shouldEnableHostI18n(cfg));
      }
      return false;
    } catch {
      return false;
    }
  }

  _getHostI18nCfgSig(cfgOverride = null) {
    try {
      const cfg = cfgOverride || this.cdp?.readConfig?.() || {};
      return `${cfg.hostLocalization || 'auto'}:${cfg.language || cfg.lang || 'zh-CN'}`;
    } catch {
      return '';
    }
  }

  _getHostI18nCleanupExpression() {
    return (
      this.cdp?.HOST_I18N_REMOVE_EXPRESSION ||
      "(() => { try { window.__agPrismHostI18n?.destroy?.(); } catch {} return { ok: true, status: 'off' }; })()"
    );
  }

  _setThoughtExpr(expr) {
    const next = typeof expr === 'string' ? expr : '';
    this.thoughtExpr = next;
    this._thoughtHashSource = next;
    this.thoughtCodeHash = next
      ? crypto.createHash('sha256').update(next).digest('hex').slice(0, 16)
      : '';
    return next;
  }

  _buildThoughtExprForConfig(cfgOverride = null, cacheOpts = undefined) {
    const cfg = cfgOverride || (typeof this.cdp?.readConfig === 'function' ? this.cdp.readConfig() : null);
    if (!this._isThoughtEnabled(cfg) || typeof this.cdp?.buildThoughtExpression !== 'function') {
      return this._setThoughtExpr('');
    }
    const opts = cacheOpts !== undefined ? cacheOpts : this._getChannelCacheOpts(true);
    const expr = opts ? this.cdp.buildThoughtExpression(cfg, opts) : this.cdp.buildThoughtExpression(cfg);
    if (cacheOpts === undefined && opts && this.running) {
      this._scheduleBundleCacheFlush();
    }
    return this._setThoughtExpr(expr);
  }

  _getThoughtExprHash(expr = this.thoughtExpr) {
    const str = typeof expr === 'string' ? expr : '';
    if (!str) return '';
    if (str === this._thoughtHashSource && this.thoughtCodeHash) {
      return this.thoughtCodeHash;
    }
    const hash = crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
    if (str === this.thoughtExpr) {
      this._thoughtHashSource = str;
      this.thoughtCodeHash = hash;
    }
    return hash;
  }

  _isThoughtEnabled(cfgOverride = null) {
    try {
      const cfg = cfgOverride || this.cdp?.readConfig?.();
      if (typeof this.cdp?.shouldEnableThought === 'function') {
        return Boolean(this.cdp.shouldEnableThought(cfg));
      }
      const mode = typeof cfg?.thoughtTranslate === 'string' ? cfg.thoughtTranslate.trim().toLowerCase() : 'off';
      return Boolean(mode && mode !== 'off');
    } catch {
      return false;
    }
  }

  _getThoughtCfgSig(cfgOverride = null, exprOverride = null) {
    try {
      const cfg = cfgOverride || this.cdp?.readConfig?.() || {};
      if (!this._isThoughtEnabled(cfg)) return '';
      const mode = typeof cfg.thoughtTranslate === 'string' ? cfg.thoughtTranslate.trim().toLowerCase() : 'off';
      const exprHash = this._getThoughtExprHash(typeof exprOverride === 'string' ? exprOverride : this.thoughtExpr);
      return `1:${mode}:${exprHash}`;
    } catch {
      return '';
    }
  }

  _getThoughtCleanupExpression() {
    return (
      this.cdp?.THOUGHT_REMOVE_EXPRESSION ||
      "(() => { try { window.__agPrismThought?.destroy?.(); } catch {} try { document.querySelectorAll('[data-testid=\"prism-thought-ai-config\"]').forEach((n) => n.remove()); } catch {} try { delete window.__agPrismThought; } catch {} try { delete globalThis.__agPrismThought; } catch {} try { delete window.__agPrismThoughtSettingsUi; } catch {} try { delete globalThis.__agPrismThoughtSettingsUi; } catch {} return { ok: true, status: 'off' }; })()"
    );
  }

  _hasInlineDiffClientFile() {
    try {
      return fs.existsSync(path.join(this.rootDir, 'vendor', 'inline-diff', 'inline-diff-client.js'));
    } catch {
      return false;
    }
  }

  _extractInlineDiffCodeHash(expr) {
    const str = typeof expr === 'string' ? expr : '';
    if (!str) return '';
    const m = /const targetHash = "([^"]+)"/.exec(str);
    if (m && m[1]) return m[1];
    return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
  }

  _setInlineDiffExpr(expr) {
    const next = typeof expr === 'string' ? expr : '';
    this.inlineDiffExpr = next;
    this._inlineDiffHashSource = next;
    this.inlineDiffCodeHash = this._extractInlineDiffCodeHash(next);
    return next;
  }

  _buildInlineDiffExprForConfig(cfgOverride = null, cacheOpts = undefined) {
    const cfg = cfgOverride || (typeof this.cdp?.readConfig === 'function' ? this.cdp.readConfig() : null);
    if (typeof this.cdp?.buildInlineDiffInjectExpression !== 'function') {
      return this._setInlineDiffExpr('');
    }
    const opts = cacheOpts !== undefined ? cacheOpts : this._getChannelCacheOpts(true);
    const expr = opts
      ? this.cdp.buildInlineDiffInjectExpression(cfg, opts)
      : this.cdp.buildInlineDiffInjectExpression(cfg);
    if (cacheOpts === undefined && opts && this.running) {
      this._scheduleBundleCacheFlush();
    }
    return this._setInlineDiffExpr(expr);
  }

  _getInlineDiffExprHash(expr = this.inlineDiffExpr) {
    const str = typeof expr === 'string' ? expr : '';
    if (!str) return '';
    if (str === this._inlineDiffHashSource && this.inlineDiffCodeHash) {
      return this.inlineDiffCodeHash;
    }
    const hash = this._extractInlineDiffCodeHash(str);
    if (str === this.inlineDiffExpr) {
      this._inlineDiffHashSource = str;
      this.inlineDiffCodeHash = hash;
    }
    return hash;
  }

  _getInlineDiffCleanupExpression() {
    return (
      this.cdp?.INLINE_DIFF_REMOVE_EXPRESSION ||
      "(() => { try { window.__agPrismInlineDiff?.destroy?.(); } catch {} try { document.getElementById('ag-prism-inline-diff-css')?.remove(); } catch {} try { document.querySelectorAll('.ag-cs-inline-diff-box, .ag-cs-diff-ctx-menu').forEach((n) => n.remove()); } catch {} try { delete window.__agPrismInlineDiff; } catch {} try { delete globalThis.__agPrismInlineDiff; } catch {} try { delete window.__agPrismInlineDiffFactory; } catch {} try { delete globalThis.__agPrismInlineDiffFactory; } catch {} try { delete window.__agPrismInlineDiffResolve; } catch {} return { ok: true, status: 'off' }; })()"
    );
  }

  _hasWallpaperClientFile() {
    try {
      return fs.existsSync(path.join(this.rootDir, 'vendor', 'wallpaper', 'wallpaper-client.js'));
    } catch {
      return false;
    }
  }

  _extractWallpaperCodeHash(expr) {
    const str = typeof expr === 'string' ? expr : '';
    if (!str) return '';
    const m = /const targetHash = "([^"]+)"/.exec(str);
    if (m && m[1]) return m[1];
    return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
  }

  _setWallpaperExpr(expr) {
    const next = typeof expr === 'string' ? expr : '';
    this.wallpaperExpr = next;
    this._wallpaperHashSource = next;
    this.wallpaperCodeHash = this._extractWallpaperCodeHash(next);
    return next;
  }

  _buildWallpaperExprForConfig(cfgOverride = null, cacheOpts = undefined) {
    const cfg = cfgOverride || (typeof this.cdp?.readConfig === 'function' ? this.cdp.readConfig() : null);
    if (typeof this.cdp?.buildWallpaperExpression !== 'function') {
      return this._setWallpaperExpr('');
    }
    // 不在 NewDocument 脚本中内联含 mediaUrl/mediaPath Bearer Token 的静态快照，
    // 由前端挂载后通过 WALLPAPER_BINDING 实时 refresh() 获取最新有效配置与 Token。
    const rawOpts = cacheOpts !== undefined ? cacheOpts : this._getChannelCacheOpts(true);
    let safeOpts = rawOpts;
    if (rawOpts && typeof rawOpts === 'object' && Object.prototype.hasOwnProperty.call(rawOpts, 'initialWallpaperConfig')) {
      const { initialWallpaperConfig: _stripped, ...rest } = rawOpts;
      safeOpts = Object.keys(rest).length > 0 ? rest : undefined;
    }
    const expr = safeOpts
      ? this.cdp.buildWallpaperExpression(cfg, safeOpts)
      : this.cdp.buildWallpaperExpression(cfg);
    if (cacheOpts === undefined && safeOpts && this.running) {
      this._scheduleBundleCacheFlush();
    }
    return this._setWallpaperExpr(expr);
  }

  _getWallpaperExprHash(expr = this.wallpaperExpr) {
    const str = typeof expr === 'string' ? expr : '';
    if (!str) return '';
    if (str === this._wallpaperHashSource && this.wallpaperCodeHash) {
      return this.wallpaperCodeHash;
    }
    const hash = this._extractWallpaperCodeHash(str);
    if (str === this.wallpaperExpr) {
      this._wallpaperHashSource = str;
      this.wallpaperCodeHash = hash;
    }
    return hash;
  }

  _getWallpaperCleanupExpression() {
    return (
      this.cdp?.WALLPAPER_REMOVE_EXPRESSION ||
      "(() => { try { window.__agPrismWallpaper?.destroy?.(); } catch {} try { const root = document.getElementById('ag-prism-wallpaper-root'); if (root) { root.querySelectorAll('video').forEach((v) => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch {} }); root.remove(); } } catch {} try { document.getElementById('ag-prism-wallpaper-css')?.remove(); } catch {} try { document.documentElement?.removeAttribute?.('data-ag-prism-wallpaper'); } catch {} try { delete window.__agPrismWallpaper; } catch {} try { delete globalThis.__agPrismWallpaper; } catch {} try { delete window.__prismMountWallpaperUi; } catch {} try { delete globalThis.__prismMountWallpaperUi; } catch {} try { delete window.__agPrismWallpaperResolve; } catch {} return { ok: true, status: 'off' }; })()"
    );
  }

  _hasCatSanctuaryClientFile() {
    try {
      return fs.existsSync(path.join(this.rootDir, 'vendor', 'cat-sanctuary', 'cat-sanctuary-client.js'));
    } catch {
      return false;
    }
  }

  _isCatSanctuaryEnabled(cfgOverride = null) {
    try {
      const cfg = cfgOverride || this.cdp?.readConfig?.();
      if (typeof this.cdp?.shouldEnableCatSanctuary === 'function') {
        return Boolean(this.cdp.shouldEnableCatSanctuary(cfg));
      }
      return cfg?.mascot === 'cat';
    } catch {
      return false;
    }
  }

  _extractCatSanctuaryCodeHash(expr) {
    const str = typeof expr === 'string' ? expr : '';
    if (!str) return '';
    const m = /const targetHash = "([^"]+)"/.exec(str);
    if (m && m[1]) return m[1];
    return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
  }

  _setCatSanctuaryExpr(expr) {
    const next = typeof expr === 'string' ? expr : '';
    this.catSanctuaryExpr = next;
    this._catSanctuaryHashSource = next;
    this.catSanctuaryCodeHash = this._extractCatSanctuaryCodeHash(next);
    return next;
  }

  _buildCatSanctuaryExprForConfig(cfgOverride = null, cacheOpts = undefined) {
    const cfg = cfgOverride || (typeof this.cdp?.readConfig === 'function' ? this.cdp.readConfig() : null);
    if (!this._isCatSanctuaryEnabled(cfg) || typeof this.cdp?.buildCatSanctuaryExpression !== 'function') {
      return this._setCatSanctuaryExpr('');
    }
    const opts = cacheOpts !== undefined ? cacheOpts : this._getChannelCacheOpts(true);
    const expr = opts
      ? this.cdp.buildCatSanctuaryExpression(cfg, opts)
      : this.cdp.buildCatSanctuaryExpression(cfg);
    if (cacheOpts === undefined && opts && this.running) {
      this._scheduleBundleCacheFlush();
    }
    return this._setCatSanctuaryExpr(expr);
  }

  _getCatSanctuaryExprHash(expr = this.catSanctuaryExpr) {
    const str = typeof expr === 'string' ? expr : '';
    if (!str) return '';
    if (str === this._catSanctuaryHashSource && this.catSanctuaryCodeHash) {
      return this.catSanctuaryCodeHash;
    }
    const hash = this._extractCatSanctuaryCodeHash(str);
    if (str === this.catSanctuaryExpr) {
      this._catSanctuaryHashSource = str;
      this.catSanctuaryCodeHash = hash;
    }
    return hash;
  }

  _getCatSanctuaryCleanupExpression() {
    return (
      (typeof this.cdp?.buildCatSanctuaryCleanupExpression === 'function'
        ? this.cdp.buildCatSanctuaryCleanupExpression()
        : '') ||
      this.cdp?.CAT_SANCTUARY_REMOVE_EXPRESSION ||
      "(() => { try { (window.__agCatSanctuaryBridge || globalThis.__agCatSanctuaryBridge)?.dispose?.(); } catch {} try { document.querySelectorAll?.('.ag-v2-cat-sanctuary')?.forEach?.((el) => el.remove()); } catch {} try { document.querySelectorAll?.('[data-cat-sanctuary=\"1\"]')?.forEach?.((el) => el.removeAttribute('data-cat-sanctuary')); } catch {} try { document.documentElement?.removeAttribute?.('data-ag-cat-peek'); } catch {} try { delete window.__agCatSanctuaryFactory; } catch {} try { delete globalThis.__agCatSanctuaryFactory; } catch {} try { delete window.__agPrismCatRimState; } catch {} try { delete globalThis.__agPrismCatRimState; } catch {} return { ok: true, status: 'off' }; })()"
    );
  }

  _recordCatSanctuaryEvalOutcome(entry, evalRes, catSanctuaryHash) {
    const isSkipped = Boolean(
      evalRes && typeof evalRes.status === 'string' && evalRes.status.startsWith('skipped-')
    );
    if (evalRes && evalRes.ok) {
      entry.catSanctuaryMounted = true;
      entry.catSanctuarySkipped = false;
      entry.lastCatSanctuaryHash = catSanctuaryHash;
    } else if (isSkipped) {
      entry.catSanctuaryMounted = false;
      entry.catSanctuarySkipped = true;
      entry.lastCatSanctuaryHash = catSanctuaryHash;
    } else {
      entry.catSanctuaryMounted = false;
      entry.catSanctuarySkipped = false;
      entry.lastCatSanctuaryHash = '';
    }
  }

  _hasEffortSliderClientFiles() {
    try {
      return (
        fs.existsSync(path.join(this.rootDir, 'vendor', 'effort-slider', 'upstream-client.js')) &&
        fs.existsSync(path.join(this.rootDir, 'vendor', 'effort-slider', 'slider-coexist.js'))
      );
    } catch {
      return false;
    }
  }

  _isEffortSliderEnabled(cfgOverride = null) {
    try {
      const cfg = cfgOverride || this.cdp?.readConfig?.();
      if (typeof this.cdp?.shouldEnableEffortSlider === 'function') {
        return Boolean(this.cdp.shouldEnableEffortSlider(cfg));
      }
      return cfg?.effortSliderModule !== 'off' && cfg?.effortSliderModule !== false;
    } catch {
      return true;
    }
  }

  _extractEffortSliderCodeHash(expr) {
    const str = typeof expr === 'string' ? expr : '';
    if (!str) return '';
    const m = /const targetHash = "([^"]+)"/.exec(str);
    if (m && m[1]) return m[1];
    return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
  }

  _setEffortSliderExpr(expr) {
    const next = typeof expr === 'string' ? expr : '';
    this.effortSliderExpr = next;
    this._effortSliderHashSource = next;
    this.effortSliderCodeHash = this._extractEffortSliderCodeHash(next);
    return next;
  }

  _buildEffortSliderExprForConfig(cfgOverride = null, cacheOpts = undefined) {
    const cfg = cfgOverride || (typeof this.cdp?.readConfig === 'function' ? this.cdp.readConfig() : null);
    if (!this._isEffortSliderEnabled(cfg) || typeof this.cdp?.buildEffortSliderExpression !== 'function') {
      return this._setEffortSliderExpr('');
    }
    const opts = cacheOpts !== undefined ? cacheOpts : this._getChannelCacheOpts(true);
    const expr = opts
      ? this.cdp.buildEffortSliderExpression(cfg, opts)
      : this.cdp.buildEffortSliderExpression(cfg);
    if (cacheOpts === undefined && opts && this.running) {
      this._scheduleBundleCacheFlush();
    }
    return this._setEffortSliderExpr(expr);
  }

  _getEffortSliderExprHash(expr = this.effortSliderExpr) {
    const str = typeof expr === 'string' ? expr : '';
    if (!str) return '';
    if (str === this._effortSliderHashSource && this.effortSliderCodeHash) {
      return this.effortSliderCodeHash;
    }
    const hash = this._extractEffortSliderCodeHash(str);
    if (str === this.effortSliderExpr) {
      this._effortSliderHashSource = str;
      this.effortSliderCodeHash = hash;
    }
    return hash;
  }

  _getEffortSliderCleanupExpression() {
    return (
      (typeof this.cdp?.buildEffortSliderCleanupExpression === 'function'
        ? this.cdp.buildEffortSliderCleanupExpression()
        : '') ||
      this.cdp?.EFFORT_SLIDER_REMOVE_EXPRESSION ||
      "(() => { try { (window.__agPrismEffortSlider || globalThis.__agPrismEffortSlider)?.destroy?.(); } catch {} try { document.querySelector?.('#ag-codex-effort-slider-styles[data-ag-prism-slider=\"1\"]')?.remove?.(); } catch {} try { document.getElementById?.('ag-prism-effort-slider-hide')?.remove?.(); } catch {} try { delete window.__agPrismEffortSlider; } catch {} try { delete globalThis.__agPrismEffortSlider; } catch {} try { delete window.AntigravityCodexEffortSlider; } catch {} try { delete globalThis.AntigravityCodexEffortSlider; } catch {} return { ok: true, status: 'off' }; })()"
    );
  }

  _recordEffortSliderEvalOutcome(entry, evalRes, effortSliderHash) {
    const isSkipped = Boolean(
      evalRes && typeof evalRes.status === 'string' && evalRes.status.startsWith('skipped-')
    );
    if (evalRes && evalRes.ok) {
      entry.effortSliderMounted = true;
      entry.effortSliderSkipped = false;
      entry.lastEffortSliderHash = effortSliderHash;
    } else if (isSkipped) {
      entry.effortSliderMounted = false;
      entry.effortSliderSkipped = true;
      entry.lastEffortSliderHash = effortSliderHash;
    } else {
      entry.effortSliderMounted = false;
      entry.effortSliderSkipped = false;
      entry.lastEffortSliderHash = '';
    }
  }

  _hasChatSceneClientFile() {
    try {
      return fs.existsSync(path.join(this.rootDir, 'vendor', 'chat-scene', 'chat-scene-client.js'));
    } catch {
      return false;
    }
  }

  _isChatSceneEnabled(cfgOverride = null) {
    try {
      const cfg = cfgOverride || this.cdp?.readConfig?.();
      if (typeof this.cdp?.shouldEnableChatScene === 'function') {
        return Boolean(this.cdp.shouldEnableChatScene(cfg));
      }
      return cfg?.chatScene === 'sky' || cfg?.chatScene === 'stationery';
    } catch {
      return false;
    }
  }

  _extractChatSceneCodeHash(expr) {
    const str = typeof expr === 'string' ? expr : '';
    if (!str) return '';
    const m = /const targetHash = "([^"]+)"/.exec(str);
    if (m && m[1]) return m[1];
    return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
  }

  _setChatSceneExpr(expr) {
    const next = typeof expr === 'string' ? expr : '';
    this.chatSceneExpr = next;
    this._chatSceneHashSource = next;
    this.chatSceneCodeHash = this._extractChatSceneCodeHash(next);
    return next;
  }

  _buildChatSceneExprForConfig(cfgOverride = null, cacheOpts = undefined) {
    const cfg = cfgOverride || (typeof this.cdp?.readConfig === 'function' ? this.cdp.readConfig() : null);
    if (!this._isChatSceneEnabled(cfg) || typeof this.cdp?.buildChatSceneExpression !== 'function') {
      return this._setChatSceneExpr('');
    }
    const opts = cacheOpts !== undefined ? cacheOpts : this._getChannelCacheOpts(true);
    const expr = opts
      ? this.cdp.buildChatSceneExpression(cfg, opts)
      : this.cdp.buildChatSceneExpression(cfg);
    if (cacheOpts === undefined && opts && this.running) {
      this._scheduleBundleCacheFlush();
    }
    return this._setChatSceneExpr(expr);
  }

  _getChatSceneExprHash(expr = this.chatSceneExpr) {
    const str = typeof expr === 'string' ? expr : '';
    if (!str) return '';
    if (str === this._chatSceneHashSource && this.chatSceneCodeHash) {
      return this.chatSceneCodeHash;
    }
    const hash = this._extractChatSceneCodeHash(str);
    if (str === this.chatSceneExpr) {
      this._chatSceneHashSource = str;
      this.chatSceneCodeHash = hash;
    }
    return hash;
  }

  _getChatSceneCfgSig(cfgOverride = null, exprOverride = null) {
    try {
      const cfg = cfgOverride || this.cdp?.readConfig?.() || {};
      if (!this._isChatSceneEnabled(cfg)) return '';
      const mode = cfg.chatScene === 'stationery' ? 'stationery' : 'sky';
      const exprHash = this._getChatSceneExprHash(typeof exprOverride === 'string' ? exprOverride : this.chatSceneExpr);
      return `${mode}:${exprHash}`;
    } catch {
      return '';
    }
  }

  _getChatSceneCleanupExpression() {
    return (
      (typeof this.cdp?.buildChatSceneCleanupExpression === 'function'
        ? this.cdp.buildChatSceneCleanupExpression()
        : '') ||
      this.cdp?.CHAT_SCENE_REMOVE_EXPRESSION ||
      "(() => { try { (window.__agChatSceneController || globalThis.__agChatSceneController)?.dispose?.(); } catch {} try { document.getElementById?.('ag-prism-chat-scene-root')?.remove?.(); } catch {} try { document.getElementById?.('ag-prism-chat-scene-css')?.remove?.(); } catch {} try { document.documentElement?.removeAttribute?.('data-ag-chat-scene'); } catch {} try { delete window.__agChatSceneController; } catch {} try { delete globalThis.__agChatSceneController; } catch {} return { ok: true, status: 'off' }; })()"
    );
  }

  _recordChatSceneEvalOutcome(entry, evalRes, chatSceneSig) {
    const isSkipped = Boolean(
      evalRes && typeof evalRes.status === 'string' && evalRes.status.startsWith('skipped-')
    );
    if (evalRes && evalRes.ok) {
      entry.chatSceneMounted = true;
      entry.chatSceneSkipped = false;
      entry.lastChatSceneSig = chatSceneSig;
    } else if (isSkipped) {
      entry.chatSceneMounted = false;
      entry.chatSceneSkipped = true;
      entry.lastChatSceneSig = chatSceneSig;
    } else {
      entry.chatSceneMounted = false;
      entry.chatSceneSkipped = false;
      entry.lastChatSceneSig = '';
    }
  }

  _isTelemetryDisabled(cfgOverride = null) {
    try {
      const cfg = cfgOverride || this.cdp?.readConfig?.();
      return cfg?.telemetryModule === 'off';
    } catch {
      return false;
    }
  }

  _releaseIdleTelemetry(force = false) {
    if (!this._lazyStore && !this._lazyUsage && !this._lazyLsClient && !this._backendSummariesCache) {
      return false;
    }
    if ((this._telemetryInFlight || 0) > 0) {
      return false;
    }
    if (!force) {
      const idleMs = Date.now() - (this._lastTelemetryActivityAt || 0);
      if (idleMs < 120000) return false;
      if (
        this._lazyUsage?.syncing ||
        this._lazyUsage?.ledger?.diskWrites > 0 ||
        this._lazyUsage?.ledger?.diskSummaryPending ||
        this._lazyStore?.background?.active
      ) {
        return false;
      }
    }
    const storeClient = this._lazyStore?.client || null;
    const lsClient = this._lazyLsClient && this._lazyLsClient !== storeClient ? this._lazyLsClient : null;
    const targets = [this._lazyUsage, this._lazyStore, lsClient];
    this._lazyUsage = null;
    this._lazyStore = null;
    this._lazyLsClient = null;
    this._backendSummariesCache = null;
    this._backendSummariesAt = 0;
    this._flushUsageDiskCache();
    this._usageDiskCache = null;
    for (const svc of targets) {
      if (!svc) continue;
      try {
        if (typeof svc.dispose === 'function') svc.dispose();
        else if (typeof svc.close === 'function') svc.close();
      } catch {}
    }
    return true;
  }

  _buildSidebarCleanupExpression(force = false) {
    const residueGuard = force
      ? ''
      : `const hasResidue = Boolean(
          window.__agPrismSidebar ||
          document.getElementById('ag-prism-sidebar-studio-css') ||
          document.querySelector('[data-ag-prism-sidebar-owned="1"], .ag-prism-sidebar-studio, .ag-prism-sidebar-rail, .ag-prism-sidebar-popover, .ag-prism-sidebar-modal')
        );
        if (!hasResidue) return { ok: true, status: 'clean' };`;
    return `(() => {
      try {
        ${residueGuard}
        if (document.documentElement) {
          document.documentElement.setAttribute('data-ag-prism-sidebar-studio', 'off');
        }
        try { window.__agPrismSidebar?.destroy?.({ preserveRuntimeState: false }); } catch {}
        try { delete window.__agPrismSidebar; } catch {}
        try { delete window.${SIDEBAR_BINDING}; } catch {}
        document.getElementById('ag-prism-sidebar-studio-css')?.remove();
        document.querySelectorAll('[data-ag-prism-sidebar-owned="1"], .ag-prism-sidebar-studio, .ag-prism-sidebar-rail, .ag-prism-sidebar-popover, .ag-prism-sidebar-modal').forEach((n) => n.remove());
        if (document.documentElement) {
          ['data-ag-prism-mode', 'data-ag-prism-chat-kind', 'data-ag-prism-chat-telemetry', 'data-ag-cs-space', 'data-ag-cs-space-palette', 'data-ag-cs-space-accent'].forEach((a) => document.documentElement.removeAttribute(a));
        }
        return { ok: true, status: 'cleaned' };
      } catch {}
      return { ok: true, status: 'disabled' };
    })()`;
  }

  _findCurrentMainDefaultContextId(entry) {
    if (!entry?.contextFrames || !entry.mainFrameId) return null;
    let found = null;
    for (const [id, meta] of entry.contextFrames.entries()) {
      if (
        meta &&
        meta.isDefault === true &&
        meta.type === 'default' &&
        meta.frameId === entry.mainFrameId &&
        (typeof meta.docGen !== 'number' || meta.docGen === entry.sidebarDocument)
      ) {
        found = id;
      }
    }
    return found;
  }

  _markSidebarHostVerified(entry, expectedDoc, ok) {
    if (!entry || expectedDoc !== entry.sidebarDocument) return;
    if (ok) {
      entry.sidebarHostVerified = true;
      entry.sidebarVerifiedDocument = expectedDoc;
      entry.sidebarHostContextId = this._findCurrentMainDefaultContextId(entry);
    } else {
      entry.sidebarHostVerified = false;
      entry.sidebarVerifiedDocument = -1;
      entry.sidebarHostContextId = null;
    }
  }

  _buildSidebarExprForCurrentClient(cacheOpts = undefined) {
    if (typeof this.cdp.buildSidebarStudioExpression !== 'function') return '';
    const meta = this._getSidebarServerMeta();
    if (!this._hasSafeV2SidebarClientFile()) {
      return this.cdp.buildSidebarStudioExpression(meta, '');
    }
    const opts = cacheOpts !== undefined ? cacheOpts : this._getChannelCacheOpts(true);
    const expr = opts
      ? this.cdp.buildSidebarStudioExpression(meta, null, opts)
      : this.cdp.buildSidebarStudioExpression(meta);
    if (cacheOpts === undefined && opts && this.running) {
      this._scheduleBundleCacheFlush();
    }
    return expr;
  }

  _pickActiveSidebarHostEntry() {
    for (const entry of this.sessions.values()) {
      if (entry && !entry.session?.closed && entry.sidebarHostVerified === true) {
        return entry;
      }
    }
    return null;
  }

  _getSidebarServerMeta() {
    return {
      binding: SIDEBAR_BINDING,
      version: this.cdp?.PLUGIN_VERSION || '1.0.7',
      schemaVersion: 2,
      serviceReady: !this._sidebarStopped && typeof this.sidebarService?.handleRpc === 'function' &&
        !this.sidebarService.getBootDiagnostic?.(),
    };
  }

  async _ensureSidebarBinding(entry, timeoutMs = 2600, force = false) {
    if (!entry || entry.session.closed) return false;
    if (!force && entry.sidebarBindingAdded) return true;
    const ok = await entry.session
      .send('Runtime.addBinding', { name: SIDEBAR_BINDING }, timeoutMs)
      .then(() => true)
      .catch(() => false);
    if (ok) entry.sidebarBindingAdded = true;
    return ok;
  }

  async _removeSidebarBinding(entry, timeoutMs = 2000) {
    if (!entry || entry.session.closed) return;
    if (!entry.sidebarBindingAdded) return;
    await entry.session
      .send('Runtime.removeBinding', { name: SIDEBAR_BINDING }, timeoutMs)
      .catch(() => {});
    entry.sidebarBindingAdded = false;
  }

  async _ensureInlineDiffBinding(entry, timeoutMs = 2600, force = false) {
    if (!entry || entry.session.closed) return false;
    if (!force && entry.inlineDiffBindingAdded) return true;
    const ok = await entry.session
      .send('Runtime.addBinding', { name: INLINE_DIFF_BINDING }, timeoutMs)
      .then(() => true)
      .catch(() => false);
    if (ok) entry.inlineDiffBindingAdded = true;
    return ok;
  }

  async _removeInlineDiffBinding(entry, timeoutMs = 2000) {
    if (!entry || entry.session.closed) return;
    await entry.session
      .send('Runtime.removeBinding', { name: INLINE_DIFF_BINDING }, timeoutMs)
      .catch(() => {});
    entry.inlineDiffBindingAdded = false;
  }

  async _recordInlineDiffEvalOutcome(entry, evalRes, inlineDiffHash) {
    const isSkipped = Boolean(
      evalRes && typeof evalRes.status === 'string' && evalRes.status.startsWith('skipped-')
    );
    if (evalRes && evalRes.ok) {
      entry.inlineDiffMounted = true;
      entry.inlineDiffSkipped = false;
      entry.lastInlineDiffHash = inlineDiffHash;
    } else if (isSkipped) {
      entry.inlineDiffMounted = false;
      entry.inlineDiffSkipped = true;
      entry.lastInlineDiffHash = inlineDiffHash;
      if (evalRes.status === 'skipped-non-host') {
        await this._removeInlineDiffBinding(entry);
      }
    } else {
      entry.inlineDiffMounted = false;
      entry.inlineDiffSkipped = false;
      entry.lastInlineDiffHash = '';
    }
  }

  async _ensureWallpaperBinding(entry, timeoutMs = 2600, force = false) {
    if (!entry || entry.session.closed) return false;
    if (!force && entry.wallpaperBindingAdded) return true;
    const bindingName = this.cdp?.WALLPAPER_BINDING || WALLPAPER_BINDING;
    const ok = await entry.session
      .send('Runtime.addBinding', { name: bindingName }, timeoutMs)
      .then(() => true)
      .catch(() => false);
    if (ok) entry.wallpaperBindingAdded = true;
    return ok;
  }

  async _removeWallpaperBinding(entry, timeoutMs = 2000) {
    if (!entry || entry.session.closed) return;
    const bindingName = this.cdp?.WALLPAPER_BINDING || WALLPAPER_BINDING;
    await entry.session
      .send('Runtime.removeBinding', { name: bindingName }, timeoutMs)
      .catch(() => {});
    entry.wallpaperBindingAdded = false;
  }

  async _recordWallpaperEvalOutcome(entry, evalRes, wallpaperHash) {
    const isSkipped = Boolean(
      evalRes && typeof evalRes.status === 'string' && evalRes.status.startsWith('skipped-')
    );
    if (evalRes && evalRes.ok) {
      entry.wallpaperMounted = true;
      entry.wallpaperSkipped = false;
      entry.lastWallpaperHash = wallpaperHash;
    } else if (isSkipped) {
      entry.wallpaperMounted = false;
      entry.wallpaperSkipped = true;
      entry.lastWallpaperHash = wallpaperHash;
      if (evalRes.status === 'skipped-non-host') {
        await this._removeWallpaperBinding(entry);
      }
    } else {
      entry.wallpaperMounted = false;
      entry.wallpaperSkipped = false;
      entry.lastWallpaperHash = '';
    }
  }

  async ensureWallpaperService() {
    if (this._wallpaperStopped) return null;
    if (this._lazyWallpaperService) return this._lazyWallpaperService;
    if (this._wallpaperServicePromise) return this._wallpaperServicePromise;
    this._wallpaperServicePromise = (async () => {
      const svcPath = path.join(this.rootDir, 'vendor', 'wallpaper', 'wallpaper-service.mjs');
      if (!fs.existsSync(svcPath)) {
        return null;
      }
      const mod = await import(pathToFileURL(svcPath).href);
      const factory = mod?.createWallpaperService || mod?.default;
      if (this._wallpaperStopped || typeof factory !== 'function') return null;
      const svc = factory({ logger: (m) => this.log(m) });
      if (this._wallpaperStopped) {
        try {
          if (typeof svc?.dispose === 'function') await svc.dispose();
        } catch {}
        return null;
      }
      this._lazyWallpaperService = svc;
      return svc;
    })();
    try {
      return await this._wallpaperServicePromise;
    } finally {
      this._wallpaperServicePromise = null;
    }
  }

  async ensureSidebarService() {
    if (this._sidebarStopped) return null;
    if (this.sidebarService) return this.sidebarService;
    if (this._sidebarServicePromise) return this._sidebarServicePromise;
    this._sidebarServicePromise = (async () => {
      const svcPath = path.join(this.rootDir, 'vendor', 'sidebar-studio', 'sidebar-service.mjs');
      if (!fs.existsSync(svcPath)) {
        return null;
      }
      const mod = await import(pathToFileURL(svcPath).href);
      const Ctor = mod?.SidebarStudioService || mod?.default;
      if (this._sidebarStopped || typeof Ctor !== 'function') return null;

      let hostAdapter = null;
      const adapterPath = path.join(this.rootDir, 'vendor', 'sidebar-studio', 'live-host-adapter.mjs');
      if (fs.existsSync(adapterPath)) {
        try {
          const adapterMod = await import(pathToFileURL(adapterPath).href);
          if (typeof adapterMod?.createLiveHostAdapter === 'function') {
            hostAdapter = adapterMod.createLiveHostAdapter({
              logger: (m) => this.log(m),
              evaluateInHost: async (expr, timeoutMs = 4500) => {
                const entry = this._pickActiveSidebarHostEntry();
                if (!entry || entry.session.closed) {
                  return { ok: false, error: 'no-verified-host-window' };
                }
                return entry.session.evaluate(expr, true, timeoutMs);
              },
            });
          }
        } catch {}
      }

      const svc = new Ctor({ logger: (m) => this.log(m), hostAdapter });
      this.sidebarService = svc;
      if (typeof this.cdp.buildSidebarStudioExpression === 'function') {
        this.sidebarExpr = this._buildSidebarExprForCurrentClient();
      }
      return svc;
    })();
    try {
      return await this._sidebarServicePromise;
    } finally {
      this._sidebarServicePromise = null;
    }
  }

  async ensureOmniServer() {
    if (this.omniServer && this.omniServer.running) return this.omniServer;
    if (this._omniServerPromise) return this._omniServerPromise;
    this._omniServerPromise = (async () => {
      const srv = new OmniServer({
        rootDir: this.rootDir,
        execHooks: this._omniExecHooks,
      });
      await srv.start();
      this.omniServer = srv;
      if (typeof this.cdp.buildOmniClientExpression === 'function') {
        const opts = this._getChannelCacheOpts(true);
        this.omniExpr = opts
          ? this.cdp.buildOmniClientExpression(srv.getServerInfo(), null, opts)
          : this.cdp.buildOmniClientExpression(srv.getServerInfo());
        if (opts && this.running) {
          this._scheduleBundleCacheFlush();
        }
      }
      return srv;
    })();
    try {
      return await this._omniServerPromise;
    } finally {
      this._omniServerPromise = null;
    }
  }

  resolveTelemetryDataDir() {
    if (this._telemetryDataDir) return this._telemetryDataDir;
    const dir = path.join(os.homedir(), '.gemini', 'antigravity', 'sidecar_data', 'obsidian-prism', 'telemetry');
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
    this._telemetryDataDir = dir;
    return dir;
  }

  syncClientCdpPort(clientOrStore) {
    if (!clientOrStore) return null;
    const activePort = discoverActivePort(this.overridePort, this.portFile);
    if (activePort) {
      if (typeof clientOrStore.setCdpPort === 'function') {
        clientOrStore.setCdpPort(activePort);
      } else {
        clientOrStore.cdpPort = activePort;
        if (clientOrStore.client) clientOrStore.client.cdpPort = activePort;
      }
    }
    return activePort;
  }

  async _ensureLazyDesktopUsage() {
    if (this._lazyUsage || !this._lazyStore) return this._lazyUsage;
    const telemetryDataDir = this.resolveTelemetryDataDir();
    const usageModUrl = new URL('../../vendor/pulse-dashboard/sidecars/panel/usage.mjs', import.meta.url);
    const { DesktopUsage } = await import(usageModUrl.href);
    this._lazyUsage = new DesktopUsage(this._lazyStore, { dataDir: telemetryDataDir });
    this._lazyStore.onTrajectory = (scope, id, raw, options) =>
      typeof this._lazyUsage.ingestLive === 'function'
        ? this._lazyUsage.ingestLive(scope, id, raw, options)
        : this._lazyUsage.ingest(scope, id, raw);
    this._lazyStore.onBackgroundResult = (scope, id, jobDb, options) =>
      typeof this._lazyUsage.ingestDisk === 'function'
        ? this._lazyUsage.ingestDisk(scope, id, jobDb, options)
        : undefined;
    return this._lazyUsage;
  }

  _resolveEntryScopeKey(entry) {
    if (!entry || typeof entry !== 'object') return 'local';
    return resolveUsageScopeKey({ entry });
  }

  _getRendererRpcCandidates(opts = null) {
    const preferredEntry = opts?.preferredEntry || null;
    const explicitScope = normalizeUsageScopeKey(opts?.scopeKey || '');
    const preferredValid = Boolean(
      preferredEntry &&
        preferredEntry.session &&
        !preferredEntry.session.closed &&
        !/^(?:devtools|chrome-extension|chrome|about):/i.test(String(preferredEntry.url || ''))
    );
    if (opts?.strictEntry === true) {
      return preferredValid ? [preferredEntry] : [];
    }
    const targetScope = explicitScope || (preferredValid ? this._resolveEntryScopeKey(preferredEntry) : '');
    const out = [];
    if (preferredValid) {
      out.push(preferredEntry);
    }
    const others = [];
    if (this.sessions && typeof this.sessions.values === 'function') {
      for (const entry of this.sessions.values()) {
        if (!entry || entry === preferredEntry || !entry.session || entry.session.closed) continue;
        const url = String(entry.url || '');
        if (/^(?:devtools|chrome-extension|chrome|about):/i.test(url)) continue;
        const entryScope = this._resolveEntryScopeKey(entry);
        // 严格环境隔离：指定了 targetScope 或 preferredEntry 时，仅允许同 scope 候选回退，严禁 SSH 与 Local 互相跨路由
        if (targetScope && entryScope !== targetScope) continue;
        const isLocalHost = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//i.test(url);
        const isLocalScope = entryScope === 'local';
        others.push({
          entry,
          score: (isLocalScope ? 4 : 0) + (isLocalHost ? 2 : 0) + (entry.healthyStreak > 0 ? 1 : 0),
        });
      }
    }
    others.sort((a, b) => b.score - a.score);
    for (const x of others) out.push(x.entry);
    return out;
  }

  _createScopedRendererClient(entry, scopeKey, extraOpts = null) {
    const safeScope = normalizeUsageScopeKey(scopeKey) || 'local';
    const routeOpts = {
      preferredEntry: entry,
      scopeKey: safeScope,
      ...(extraOpts?.strictEntry ? { strictEntry: true } : {}),
    };
    return {
      server: { port: 0, csrf: '', pid: 0, mode: 'renderer-proxy', scopeKey: safeScope },
      call: (method, body = {}) => this._invokeRendererLsRpc(method, body, routeOpts),
      trajectory: (cascadeId) => this._invokeRendererLsRpc('GetCascadeTrajectory', { cascadeId }, routeOpts),
    };
  }

  _resolveActiveRpcScope() {
    const asyncCtx = RPC_ROUTE_STORAGE.getStore();
    if (asyncCtx && asyncCtx.daemon === this) {
      const sc =
        normalizeUsageScopeKey(asyncCtx.scopeKey || '') ||
        (asyncCtx.preferredEntry ? this._resolveEntryScopeKey(asyncCtx.preferredEntry) : '');
      return sc || 'local';
    }
    return 'local';
  }

  async _invokeRendererLsRpc(method, body = {}, opts = null) {
    const asyncCtx = RPC_ROUTE_STORAGE.getStore();
    const routeOpts = opts || (asyncCtx && asyncCtx.daemon === this ? asyncCtx : null);
    const candidates = this._getRendererRpcCandidates(routeOpts);
    if (!candidates.length) {
      throw new Error('等待 Antigravity 主窗口连接');
    }
    const expr = buildRendererRpcExpression(method, body);
    const timeoutMs = method === 'Probe' ? 2600 : 12000;
    let lastErr = null;
    for (const entry of candidates) {
      try {
        const res = await entry.session.evaluate(expr, true, timeoutMs);
        if (!res || res.ok !== true) {
          lastErr = new Error(String(res?.error || 'renderer_ls_unavailable'));
          continue;
        }
        const raw = res.data;
        if (method === 'Probe') return raw;
        if (method === 'GetUserStatus') {
          const normalized = normalizeRendererUserStatus(raw);
          const labels = extractModelLabelMap(normalized);
          if (labels.size > 0) {
            if (!this._rendererModelLabels) this._rendererModelLabels = new Map();
            for (const [k, v] of labels.entries()) {
              if (this._rendererModelLabels.size >= 256 && !this._rendererModelLabels.has(k)) break;
              this._rendererModelLabels.set(k, v);
            }
          }
          return normalized;
        }
        if (method === 'RetrieveUserQuotaSummary') {
          return normalizeRendererQuotaSummary(raw);
        }
        if (method === 'GetAllCascadeTrajectories') {
          const scopeHint = normalizeUsageScopeKey(raw?.scopeHint || '');
          const normalized = normalizeRendererSummaries(raw);
          const inferredRemote =
            (scopeHint && scopeHint !== 'local' ? scopeHint : '') ||
            inferRemoteScopeFromSummariesOrItems(Object.values(normalized?.trajectorySummaries || {}));
          if (inferredRemote) {
            entry.detectedScopeKey = inferredRemote;
            entry._usageScopeVerified = true;
            // 若调用方显式锁定 local（如本机 MetricsStore）且未指定该窗口探针，严禁把远程窗口会话写入本机遥测
            if (routeOpts?.scopeKey === 'local' && !routeOpts?.preferredEntry) {
              lastErr = new Error('renderer_scope_mismatch');
              continue;
            }
          }
          if (scopeHint) {
            Object.defineProperty(normalized, '_scopeHint', {
              value: scopeHint,
              enumerable: false,
              configurable: true,
            });
          }
          return normalized;
        }
        if (method === 'GetCascadeTrajectory') {
          return normalizeRendererTrajectory(raw, body?.cascadeId, this._rendererModelLabels || null);
        }
        return raw;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Antigravity 渲染器遥测通道暂不可用');
  }

  async ensureMetricsCollector() {
    if (this._customMetricsProvider) return this._customMetricsProvider;
    if (this._lazyStore) {
      return async (input) => {
        this.syncClientCdpPort(this._lazyStore);
        const safeId = input?.conversationId && GUID_RE.test(input.conversationId) ? input.conversationId : null;
        const base = await this._lazyStore.snapshot({
          conversationId: safeId,
          force: Boolean(input?.force),
          quotaRefresh: Boolean(input?.quotaRefresh),
          selectLatest: input?.selectLatest === false ? false : true,
        });
        let usageSnap = null;
        if (input?.includeUsage === true) {
          if (!this._lazyUsage) {
            await this._ensureLazyDesktopUsage().catch(() => null);
          }
          if (this._lazyUsage) {
            if (input?.force) void this._lazyUsage.sync(true);
            usageSnap = await this._lazyUsage
              .snapshot({ groups: Array.isArray(base?.groups) ? base.groups : null })
              .catch(() => null);
          }
        }
        return { ...base, usage: usageSnap };
      };
    }
    const telemetryDataDir = this.resolveTelemetryDataDir();
    const activePort = discoverActivePort(this.overridePort, this.portFile);
    const storeModUrl = new URL('../../vendor/pulse-dashboard/sidecars/panel/store.mjs', import.meta.url);
    const { MetricsStore } = await import(storeModUrl.href);
    this._lazyStore = new MetricsStore({
      dataDir: telemetryDataDir,
      rendererRpc: (m, b) => this._invokeRendererLsRpc(m, b, { scopeKey: 'local' }),
      ...(activePort ? { cdpPort: activePort } : {}),
    });
    return this.ensureMetricsCollector();
  }

  async ensureThoughtService() {
    if (this._lazyThoughtService) return this._lazyThoughtService;
    const modUrl = new URL('../../vendor/thought-translator/translator-service.mjs', import.meta.url);
    const { ThoughtTranslatorService } = await import(modUrl.href);
    this._lazyThoughtService = new ThoughtTranslatorService();
    return this._lazyThoughtService;
  }

  async ensureLsClient() {
    if (this._lazyLsClient) {
      this.syncClientCdpPort(this._lazyLsClient);
      return this._lazyLsClient;
    }
    if (this._lazyStore && this._lazyStore.client) {
      this._lazyLsClient = this._lazyStore.client;
      this._lazyLsClient.setScopeResolver?.(() => this._resolveActiveRpcScope());
      this.syncClientCdpPort(this._lazyLsClient);
      return this._lazyLsClient;
    }
    const activePort = discoverActivePort(this.overridePort, this.portFile);
    const clientModUrl = new URL('../../vendor/pulse-dashboard/sidecars/panel/client.mjs', import.meta.url);
    const { AntigravityClient } = await import(clientModUrl.href);
    this._lazyLsClient = new AntigravityClient({
      rendererRpc: (m, b) => this._invokeRendererLsRpc(m, b),
      scopeResolver: () => this._resolveActiveRpcScope(),
      ...(activePort ? { cdpPort: activePort } : {}),
    });
    return this._lazyLsClient;
  }

  async _fetchFullGeneratorMetadata(client, id) {
    if (typeof client._fetchMetadataOnly === 'function') {
      return await client._fetchMetadataOnly(id);
    }
    const allItems = [];
    let curOffset = 0;
    let totalGm = null;
    let totalSteps = 0;
    while (true) {
      const page = await client.call('GetCascadeTrajectoryGeneratorMetadata', {
        cascadeId: id,
        generatorMetadataOffset: curOffset,
        includeMessages: false,
      });
      const chunk = page?.generatorMetadata || page?.generatorMetadatas || [];
      if (page?.numTotalGeneratorMetadata !== undefined && page?.numTotalGeneratorMetadata !== null) {
        totalGm = Number(page.numTotalGeneratorMetadata);
      }
      if (page?.numTotalSteps !== undefined && page?.numTotalSteps !== null) {
        totalSteps = Math.max(totalSteps, Number(page.numTotalSteps) || 0);
      }
      if (!chunk.length) break;
      allItems.push(...chunk);
      curOffset += chunk.length;
      if (totalGm !== null && curOffset >= totalGm) break;
    }
    return {
      numTotalSteps: totalSteps,
      numTotalGeneratorMetadata: totalGm !== null ? totalGm : allItems.length,
      trajectory: {
        cascadeId: id,
        steps: [],
        generatorMetadata: allItems,
      },
    };
  }

  _discoverLocalAppConversations() {
    return discoverLocalConversations({ host: 'app' });
  }

  _getDiscoveredSubagents(scopeKey = 'local') {
    const safeScope = normalizeUsageScopeKey(scopeKey) || 'local';
    if (!this._discoveredSubagentsByScope) return null;
    return this._discoveredSubagentsByScope.get(safeScope) || null;
  }

  async _fetchBackendTrajectorySummaries(client, usageCore, force = false, ctx = null) {
    const now = Date.now();
    const entry = ctx?.entry || null;
    let scopeKey = resolveUsageScopeKey({ explicitScopeKey: ctx?.scopeKey, entry });
    const makeBucketKey = (sc) => (entry?.pageId ? `${sc}::${entry.pageId}` : sc);
    const initialBucketKey = makeBucketKey(scopeKey);
    if (!force && this._backendSummariesCache instanceof Map) {
      const hit = this._backendSummariesCache.get(initialBucketKey);
      if (hit && now - hit.at < 15000) {
        return hit.pack;
      }
    }
    try {
      const raw = await client.call('GetAllCascadeTrajectories', {});
      const mapOrList = raw?.trajectorySummaries || {};
      const entries = Array.isArray(mapOrList)
        ? mapOrList.map((sum) => [sum?.cascadeId || sum?.id || '', sum])
        : Object.entries(mapOrList);
      const list = [];
      const byId = new Map();
      const toSec = (v) => {
        if (!v) return 0;
        if (typeof usageCore?.tsSec === 'function') {
          const n = Number(usageCore.tsSec(v) || 0);
          if (n > 0) return Math.floor(n);
        }
        if (typeof v === 'object' && v.seconds !== undefined) return Math.max(0, Math.floor(Number(v.seconds) || 0));
        if (typeof v === 'string') {
          const ms = Date.parse(v);
          if (Number.isFinite(ms) && ms > 0) return Math.floor(ms / 1000);
        }
        return 0;
      };
      const extractWs = (sum) => {
        const wsArr = sum?.workspaces || sum?.trajectoryMetadata?.workspaces;
        const out = [];
        if (Array.isArray(wsArr)) {
          for (const w of wsArr) {
            const uri = String(
              w?.workspaceFolderAbsoluteUri || w?.gitRootAbsoluteUri || w?.uri || w?.path || ''
            ).trim();
            if (uri) out.push(uri);
          }
        }
        const single = String(sum?.workspaceUri || sum?.workspacePath || sum?.trajectoryMetadata?.workspaceUri || '').trim();
        if (single && !out.includes(single)) out.push(single);
        let workspace = '';
        if (out.length > 0) {
          try {
            const decoded = decodeURIComponent(out[0].replace(/^file:\/\//i, '')).replace(/[\\/]+$/, '');
            workspace = decoded.split(/[\\/]/).filter(Boolean).pop() || '';
          } catch {
            workspace = out[0].replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean).pop() || '';
          }
        }
        return { workspace, workspaces: out };
      };

      for (const [rawId, sum] of entries) {
        const id = String(rawId || sum?.cascadeId || sum?.id || '').trim();
        if (!GUID_RE.test(id) || !sum || typeof sum !== 'object') continue;
        const meta = sum.trajectoryMetadata && typeof sum.trajectoryMetadata === 'object' ? sum.trajectoryMetadata : {};
        const parentId = String(
          sum.parentConversationId ||
            meta.parentConversationId ||
            sum.parentCascadeId ||
            sum.parentTrajectoryId ||
            meta.parentCascadeId ||
            meta.parentTrajectoryId ||
            ''
        ).trim();
        const rootId = String(
          sum.rootConversationId || meta.rootConversationId || sum.rootCascadeId || meta.rootCascadeId || ''
        ).trim();
        const subagent = Boolean(
          (typeof usageCore?.isSubagentSummary === 'function' && usageCore.isSubagentSummary(sum)) ||
            parentId ||
            Number(meta.nestingDepth || sum.nestingDepth || 0) > 0 ||
            sum.isSubagent ||
            meta.isSubagent ||
            meta.subagentName
        );
        const stepCount = Math.max(0, Number(sum.stepCount ?? sum.numTotalSteps ?? 0) || 0);
        const lastModifiedSec = toSec(sum.lastModifiedTime || sum.modifiedAt || sum.updatedAt);
        const createdSec = toSec(sum.createdTime || sum.createdAt) || lastModifiedSec;
        const { workspace, workspaces } = extractWs(sum);
        const item = {
          id,
          stepCount,
          lastModifiedSec,
          createdSec,
          subagent,
          ...(parentId ? { parentId } : {}),
          ...(rootId ? { rootId } : {}),
          ...(workspace ? { workspace } : {}),
          ...(workspaces.length ? { workspaces } : {}),
          title: String(sum.summary || sum.title || '').slice(0, 140),
          status: String(sum.status || ''),
        };
        list.push(item);
        byId.set(id.toLowerCase(), item);
      }

      // 动态二次校准 scopeKey：在扫描本机磁盘前检查该窗口返回的工作区 URI 与 renderer scopeHint
      if (scopeKey === 'local') {
        const inferredScope = resolveUsageScopeKey({
          explicitScopeKey: raw?._scopeHint || entry?.detectedScopeKey || '',
          entry,
          summaries: list,
        });
        if (inferredScope && inferredScope !== 'local') {
          scopeKey = inferredScope;
          if (entry && typeof entry === 'object') {
            entry.detectedScopeKey = scopeKey;
            entry._usageScopeVerified = true;
          }
        } else if (entry && typeof entry === 'object') {
          // 仅当渲染器明确返回 local scopeHint 或包含本机 file:// 工作区路径时，才确认该窗口为可信 local
          const hasExplicitLocalHint = normalizeUsageScopeKey(raw?._scopeHint || '') === 'local';
          const hasLocalFileWs = list.some(
            (it) =>
              Array.isArray(it.workspaces) &&
              it.workspaces.some((u) => /^file:\/\//i.test(String(u || '')) || /^[a-z]:[\\/]/i.test(String(u || '')))
          );
          if (hasExplicitLocalHint || hasLocalFileWs) {
            entry._usageScopeVerified = true;
          }
        }
      } else if (entry && typeof entry === 'object') {
        entry._usageScopeVerified = true;
      }

      if (client?.server?.mode === 'renderer-proxy') {
        const subMap = this._getDiscoveredSubagents(scopeKey);
        // 严格隔离：仅已确认的本地窗口（或无 entry 直调）允许补充扫描本机磁盘会话；未验证窗口与 Remote-SSH 窗口绝不混入本机磁盘对话
        const allowLocalDiskScan = scopeKey === 'local' && (!entry || entry._usageScopeVerified === true);
        if (allowLocalDiskScan) {
          try {
            const localRes = await this._discoverLocalAppConversations();
            for (const localEntry of localRes?.conversations || []) {
              const lid = String(localEntry?.id || '').toLowerCase();
              if (!GUID_RE.test(lid) || byId.has(lid)) continue;
              // 直接复用 discoverLocalConversations 并发 lstat 返回的 mtimeMs，省去二次串行 lstat
              const rawMtimeMs = Number.isFinite(localEntry?.dbMtimeMs)
                ? localEntry.dbMtimeMs
                : Number.isFinite(localEntry?.mtimeMs)
                ? localEntry.mtimeMs
                : 0;
              const mtimeSec = rawMtimeMs > 0 ? Math.floor(rawMtimeMs / 1000) : 0;
              const knownSub = subMap?.get(lid) || null;
              const localItem = {
                id: lid,
                stepCount: 0,
                lastModifiedSec: mtimeSec,
                createdSec: mtimeSec,
                subagent: Boolean(knownSub),
                ...(knownSub?.parentId ? { parentId: knownSub.parentId } : {}),
                ...(knownSub?.workspace ? { workspace: knownSub.workspace } : {}),
                title: '',
                status: '',
              };
              list.push(localItem);
              byId.set(lid, localItem);
            }
          } catch {}
        }
        if (subMap && subMap.size > 0) {
          for (const item of list) {
            const info = subMap.get(item.id.toLowerCase());
            if (!info) continue;
            if (!item.subagent) item.subagent = true;
            if (!item.parentId && info.parentId) item.parentId = info.parentId;
            if (!item.workspace && info.workspace) item.workspace = info.workspace;
          }
        }
        list.sort((a, b) => (b.lastModifiedSec || 0) - (a.lastModifiedSec || 0));
      }

      const pack = { list, byId, scopeKey };
      if (!(this._backendSummariesCache instanceof Map)) {
        this._backendSummariesCache = new Map();
      }
      const finalBucketKey = makeBucketKey(scopeKey);
      this._backendSummariesCache.delete(finalBucketKey);
      this._backendSummariesCache.set(finalBucketKey, { pack, at: now });
      while (this._backendSummariesCache.size > 32) {
        this._backendSummariesCache.delete(this._backendSummariesCache.keys().next().value);
      }
      this._backendSummariesAt = now;
      return pack;
    } catch {
      return { list: [], byId: new Map(), scopeKey };
    }
  }

  _recordDiscoveredSubagents(parentId, traj, parentWorkspace = '', scopeKey = 'local') {
    const steps = traj?.trajectory?.steps;
    if (!Array.isArray(steps) || !GUID_RE.test(String(parentId || ''))) return;
    const pid = String(parentId).toLowerCase();
    const safeScope = normalizeUsageScopeKey(scopeKey) || 'local';
    if (!this._discoveredSubagentsByScope) this._discoveredSubagentsByScope = new Map();
    let scopeMap = this._discoveredSubagentsByScope.get(safeScope);
    if (!scopeMap) {
      scopeMap = new Map();
      this._discoveredSubagentsByScope.set(safeScope, scopeMap);
      while (this._discoveredSubagentsByScope.size > USAGE_CACHE_MAX_SCOPES) {
        this._discoveredSubagentsByScope.delete(this._discoveredSubagentsByScope.keys().next().value);
      }
    }
    const register = (rawChildId) => {
      const cid = String(rawChildId || '').toLowerCase();
      if (!GUID_RE.test(cid) || cid === pid) return;
      scopeMap.delete(cid);
      scopeMap.set(cid, { parentId: pid, workspace: String(parentWorkspace || '') });
      while (scopeMap.size > 512) {
        scopeMap.delete(scopeMap.keys().next().value);
      }
    };
    for (const s of steps) {
      const inv = s?.invokeSubagent;
      if (!inv || typeof inv !== 'object') continue;
      register(inv.conversationId);
      if (Array.isArray(inv.results)) {
        for (const r of inv.results) register(r?.conversationId);
      }
    }
  }

  _resolveUsageCachePath() {
    if (typeof this._usageCacheFile === 'string' && this._usageCacheFile.trim()) {
      return path.resolve(this._usageCacheFile.trim());
    }
    return resolveUsageCachePath(this._usageCachePathOpt);
  }

  _loadUsageDiskCache() {
    if (this._usageDiskCache instanceof Map) return this._usageDiskCache;
    const scopesMap = new Map();
    const cacheFile = this._resolveUsageCachePath();
    const parseScopeEntries = (obj) => {
      const m = new Map();
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return m;
      for (const [k, v] of Object.entries(obj)) {
        if (m.size >= USAGE_CACHE_MAX_PER_SCOPE) break;
        if (GUID_RE.test(k) && v && v.record?.days && Number(v.stepCount) > 0 && Number(v.lastModifiedSec) > 0) {
          m.set(k.toLowerCase(), {
            stepCount: Number(v.stepCount),
            lastModifiedSec: Number(v.lastModifiedSec),
            record: v.record,
          });
        }
      }
      return m;
    };
    try {
      const dir = path.dirname(cacheFile);
      if (fs.existsSync(cacheFile)) {
        const dirStat = fs.lstatSync(dir);
        const lst = fs.lstatSync(cacheFile);
        if (
          !dirStat.isSymbolicLink() &&
          dirStat.isDirectory() &&
          !lst.isSymbolicLink() &&
          lst.isFile() &&
          lst.size > 0 &&
          lst.size <= USAGE_CACHE_MAX_BYTES
        ) {
          const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
          if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            if (raw.version === 2 && raw.scopes && typeof raw.scopes === 'object' && !Array.isArray(raw.scopes)) {
              for (const [rawScope, bucketObj] of Object.entries(raw.scopes)) {
                if (scopesMap.size >= USAGE_CACHE_MAX_SCOPES) break;
                const sc = normalizeUsageScopeKey(rawScope);
                if (!sc) continue;
                const parsedBucket = parseScopeEntries(bucketObj);
                if (parsedBucket.size > 0) scopesMap.set(sc, parsedBucket);
              }
            } else {
              // 向下兼容 v1 平铺格式：统一归入 local 分区
              const localBucket = parseScopeEntries(raw);
              if (localBucket.size > 0) scopesMap.set('local', localBucket);
            }
          }
        }
      }
    } catch {}
    this._usageDiskCache = scopesMap;
    return scopesMap;
  }

  _getUsageDiskCacheScope(scopeKey = 'local', create = false) {
    const safeScope = normalizeUsageScopeKey(scopeKey) || 'local';
    const scopesMap = this._loadUsageDiskCache();
    let bucket = scopesMap.get(safeScope);
    if (!bucket && create) {
      bucket = new Map();
      scopesMap.set(safeScope, bucket);
      while (scopesMap.size > USAGE_CACHE_MAX_SCOPES) {
        const oldestKey = scopesMap.keys().next().value;
        if (oldestKey === safeScope) break;
        scopesMap.delete(oldestKey);
      }
    }
    return bucket || new Map();
  }

  _putUsageDiskCache(id, stepCount, lastModifiedSec, record, scopeKey = 'local') {
    if (!id || !GUID_RE.test(id) || !record?.days) return;
    const sc = Math.max(0, Number(stepCount || record.stepCount || 0));
    const lm = Math.max(0, Number(lastModifiedSec || record.lastModifiedSec || 0));
    if (sc <= 0 || lm <= 0) return;
    const safeScope = normalizeUsageScopeKey(scopeKey) || 'local';
    const bucket = this._getUsageDiskCacheScope(safeScope, true);
    const key = id.toLowerCase();
    const existing = bucket.get(key);
    // 保护：绝不用空统计覆盖已有真实非空统计
    if (existing && hasRealUsageRecord(existing.record) && !hasRealUsageRecord(record)) {
      return;
    }
    bucket.set(key, { stepCount: sc, lastModifiedSec: lm, record });
    this._usageCacheDirty = true;
    if (!this._usageCacheTimer) {
      this._usageCacheTimer = setTimeout(() => {
        this._usageCacheTimer = null;
        this._flushUsageDiskCache();
      }, 1500);
      this._usageCacheTimer.unref?.();
    }
  }

  _flushUsageDiskCache() {
    if (this._usageCacheTimer) {
      clearTimeout(this._usageCacheTimer);
      this._usageCacheTimer = null;
    }
    if (!this._usageCacheDirty || !(this._usageDiskCache instanceof Map)) return;
    this._usageCacheDirty = false;
    try {
      const cacheFile = this._resolveUsageCachePath();
      const dir = path.dirname(cacheFile);
      assertNotSymlinkSync(cacheFile, 'usage cache file');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      assertNotSymlinkSync(dir, 'usage cache directory');

      // 1) 单 scope 限额 1200 条，按 lastModifiedSec 降序保留最新记录
      const normalizedScopes = [];
      let totalCount = 0;
      for (const [rawScope, bucket] of this._usageDiskCache.entries()) {
        const sc = normalizeUsageScopeKey(rawScope);
        if (!sc || !(bucket instanceof Map) || bucket.size === 0) continue;
        let entries = Array.from(bucket.entries());
        entries.sort((a, b) => (b[1].lastModifiedSec || 0) - (a[1].lastModifiedSec || 0));
        if (entries.length > USAGE_CACHE_MAX_PER_SCOPE) {
          entries = entries.slice(0, USAGE_CACHE_MAX_PER_SCOPE);
          this._usageDiskCache.set(sc, new Map(entries));
        }
        const newestSec = entries[0]?.[1]?.lastModifiedSec || 0;
        normalizedScopes.push({ scope: sc, entries, newestSec });
        totalCount += entries.length;
      }
      // 最多保留 USAGE_CACHE_MAX_SCOPES 个最活跃 scope
      normalizedScopes.sort((a, b) => b.newestSec - a.newestSec);
      if (normalizedScopes.length > USAGE_CACHE_MAX_SCOPES) {
        normalizedScopes.length = USAGE_CACHE_MAX_SCOPES;
      }

      // 2) 跨 scope 总条目限额控制
      if (totalCount > USAGE_CACHE_MAX_TOTAL_RECORDS) {
        const allItems = [];
        for (const s of normalizedScopes) {
          for (const [k, v] of s.entries) allItems.push({ scope: s.scope, key: k, val: v });
        }
        allItems.sort((a, b) => (b.val.lastModifiedSec || 0) - (a.val.lastModifiedSec || 0));
        const kept = allItems.slice(0, USAGE_CACHE_MAX_TOTAL_RECORDS);
        const byScope = new Map();
        for (const it of kept) {
          let arr = byScope.get(it.scope);
          if (!arr) {
            arr = [];
            byScope.set(it.scope, arr);
          }
          arr.push([it.key, it.val]);
        }
        normalizedScopes.length = 0;
        for (const [sc, entries] of byScope.entries()) {
          normalizedScopes.push({ scope: sc, entries, newestSec: entries[0]?.[1]?.lastModifiedSec || 0 });
        }
      }

      // 3) 序列化并严格保证 <= 4 MB 上限（超限时按最老条目逐步裁剪）
      normalizedScopes.sort((a, b) => (b.newestSec || 0) - (a.newestSec || 0));
      const buildPayload = () => {
        const scopesObj = Object.create(null);
        for (const s of normalizedScopes) {
          if (!s.entries.length) continue;
          const bucketObj = Object.create(null);
          for (const [k, v] of s.entries) bucketObj[k] = v;
          scopesObj[s.scope] = bucketObj;
        }
        return JSON.stringify({ version: 2, scopes: scopesObj });
      };
      let serialized = buildPayload();
      while (Buffer.byteLength(serialized, 'utf8') > USAGE_CACHE_MAX_BYTES) {
        let trimmed = false;
        for (const s of normalizedScopes) {
          if (s.entries.length > 1) {
            s.entries = s.entries.slice(0, Math.max(1, Math.floor(s.entries.length * 0.8)));
            trimmed = true;
          }
        }
        if (!trimmed) {
          // 各 scope 均仅剩 <=1 条仍超 4MB 时，从最老 scope 起弹出尾部记录，避免死锁放弃落盘
          for (let i = normalizedScopes.length - 1; i >= 0; i--) {
            if (normalizedScopes[i].entries.length > 0) {
              normalizedScopes[i].entries.pop();
              trimmed = true;
              break;
            }
          }
        }
        if (!trimmed) break;
        serialized = buildPayload();
      }
      if (Buffer.byteLength(serialized, 'utf8') <= USAGE_CACHE_MAX_BYTES) {
        writeFileAtomicSync(cacheFile, serialized, { mode: 0o600 });
      }
    } catch {}
  }

  async fetchUsageRollupBatch(rawItems, opts = {}) {
    const usageCore = require(path.join(this.rootDir, 'usage-core.js'));
    const entry = opts?.entry || null;
    const action = opts?.action || 'fetch-batch';
    const wantSummaries = action === 'list-summaries' || Boolean(opts?.includeSummaries);
    let scopeKey = resolveUsageScopeKey({
      explicitScopeKey: opts?.scopeKey || '',
      entry,
      items: Array.isArray(rawItems) ? rawItems : null,
    });
    const routeState = { daemon: this, preferredEntry: entry, scopeKey };

    return RPC_ROUTE_STORAGE.run(routeState, async () => {
      const hasEntrySession = Boolean(entry && entry.session && !entry.session.closed);
      const entryScopeVerified = Boolean(entry && entry._usageScopeVerified === true);
      let client =
        hasEntrySession && (scopeKey !== 'local' || !entryScopeVerified)
          ? this._createScopedRendererClient(entry, scopeKey, { strictEntry: !entryScopeVerified })
          : await this.ensureLsClient();

      const backendPack = await this._fetchBackendTrajectorySummaries(
        client,
        usageCore,
        action === 'list-summaries',
        { entry, scopeKey }
      );
      const resolvedScope = normalizeUsageScopeKey(backendPack?.scopeKey || '') || scopeKey;
      if (resolvedScope !== scopeKey) {
        scopeKey = resolvedScope;
        routeState.scopeKey = scopeKey;
        if (scopeKey !== 'local' && hasEntrySession && client?.server?.scopeKey !== scopeKey) {
          client = this._createScopedRendererClient(entry, scopeKey);
        }
      }
      const allowDiskCache = !(hasEntrySession && scopeKey === 'local' && entry?._usageScopeVerified !== true);
      const diskCache = allowDiskCache ? this._getUsageDiskCacheScope(scopeKey, false) : new Map();

      if (action === 'list-summaries') {
        const cachedRecords = [];
        for (const s of backendPack.list) {
          const sid = String(s?.id || '').trim();
          if (!sid) continue;
          const hit = diskCache.get(sid.toLowerCase());
          if (hit?.record?.days) {
            cachedRecords.push({ id: sid, mode: 'full', record: hit.record });
          }
        }
        return { ok: true, scopeKey, records: cachedRecords, summaries: backendPack.list };
      }

      const list = Array.isArray(rawItems) ? rawItems.slice(0, 16) : [];
      if (list.length === 0) {
        return wantSummaries
          ? { ok: true, scopeKey, records: [], summaries: backendPack.list }
          : { ok: true, scopeKey, records: [] };
      }

      const records = [];
      for (const item of list) {
        const id = String(item?.id || '');
        if (!GUID_RE.test(id)) continue;
        const backendSum = backendPack.byId.get(id.toLowerCase()) || null;
        const stepCount = Math.max(0, Number(item.stepCount || backendSum?.stepCount || 0));
        const lastModifiedSec = Math.max(0, Number(item.lastModifiedSec || backendSum?.lastModifiedSec || 0));
        const createdSec = Math.max(0, Number(item.createdSec || backendSum?.createdSec || lastModifiedSec || 0));
        const subagent = Boolean(item.subagent || backendSum?.subagent);
        const parentId = String(item.parentId || backendSum?.parentId || '').trim();
        const rootId = String(item.rootId || backendSum?.rootId || '').trim();
        const workspace = String(item.workspace || backendSum?.workspace || '');
        const workspaces = Array.isArray(item.workspaces) && item.workspaces.length
          ? item.workspaces
          : backendSum?.workspaces || [];
        const gmOffset = Math.max(0, Math.floor(Number(item.gmOffset || 0)));
        const diskHit = diskCache.get(id.toLowerCase()) || null;
        if (!opts?.force && stepCount > 0 && lastModifiedSec > 0) {
          if (diskHit && diskHit.stepCount === stepCount && diskHit.lastModifiedSec === lastModifiedSec && diskHit.record?.days) {
            records.push({
              id,
              mode: 'full',
              subagent: Boolean(diskHit.record.subagent || subagent),
              ...(parentId ? { parentId } : {}),
              ...(workspace ? { workspace } : {}),
              record: diskHit.record,
            });
            continue;
          }
        }
        const wsMeta = workspaces.map((uri) => ({ workspaceFolderAbsoluteUri: uri }));
        const summaryStub = {
          stepCount,
          lastModifiedTime: lastModifiedSec > 0 ? { seconds: lastModifiedSec } : undefined,
          createdTime: createdSec > 0 ? { seconds: createdSec } : undefined,
          ...(parentId ? { parentConversationId: parentId, parentId } : {}),
          ...(rootId ? { rootConversationId: rootId, rootId } : {}),
          ...(wsMeta.length ? { workspaces: wsMeta } : {}),
          trajectoryMetadata: {
            ...(subagent ? { nestingDepth: 1 } : {}),
            ...(parentId ? { parentConversationId: parentId } : {}),
            ...(rootId ? { rootConversationId: rootId } : {}),
            ...(wsMeta.length ? { workspaces: wsMeta } : {}),
          },
        };
        try {
          if (client?.server?.mode === 'renderer-proxy' && typeof client.trajectory === 'function') {
            const fullTraj = await client.trajectory(id, { force: Boolean(opts?.force), summary: summaryStub });
            this._recordDiscoveredSubagents(id, fullTraj, workspace, scopeKey);
            const allSteps = Array.isArray(fullTraj?.trajectory?.steps) ? fullTraj.trajectory.steps : [];
            const allGms = Array.isArray(fullTraj?.trajectory?.generatorMetadata) ? fullTraj.trajectory.generatorMetadata : [];
            const realStepCount = Math.max(stepCount, Number(fullTraj?.numTotalSteps || 0), allSteps.length);
            const totalGm = Math.max(Number(fullTraj?.numTotalGeneratorMetadata || 0), allGms.length);
            const firstStepTs = allSteps.find((s) => s?.metadata?.createdAt)?.metadata?.createdAt;
            const lastStepTs = [...allSteps].reverse().find((s) => s?.metadata?.completedAt || s?.metadata?.createdAt);
            const realLastModSec =
              lastModifiedSec ||
              (lastStepTs ? Math.floor((Date.parse(lastStepTs.metadata.completedAt || lastStepTs.metadata.createdAt) || 0) / 1000) : 0);
            const realCreatedSec =
              (firstStepTs ? Math.floor((Date.parse(firstStepTs) || 0) / 1000) : 0) || createdSec || realLastModSec;
            const enrichedStub = {
              ...summaryStub,
              stepCount: realStepCount,
              ...(realLastModSec > 0 ? { lastModifiedTime: { seconds: realLastModSec } } : {}),
              ...(realCreatedSec > 0 ? { createdTime: { seconds: realCreatedSec } } : {}),
            };
            if (gmOffset > 0 && totalGm >= gmOffset) {
              const deltaItems = allGms.slice(gmOffset);
              const deltaRec = usageCore.analyzeTrajectoryForUsage(
                {
                  numTotalSteps: realStepCount,
                  numTotalGeneratorMetadata: totalGm,
                  trajectory: { cascadeId: id, steps: allSteps, generatorMetadata: deltaItems },
                },
                enrichedStub,
                id
              );
              if (workspace && deltaRec && typeof deltaRec === 'object' && !deltaRec.workspace) deltaRec.workspace = workspace;
              if (parentId && deltaRec && typeof deltaRec === 'object' && !deltaRec.parentId) deltaRec.parentId = parentId;
              if (allowDiskCache && diskHit?.record?.days && typeof usageCore.mergeUsageRecordDelta === 'function') {
                const merged = usageCore.mergeUsageRecordDelta(diskHit.record, deltaRec, {
                  cascadeId: id,
                  stepCount: Number(item.stepCount || realStepCount),
                  lastModifiedSec: Number(item.lastModifiedSec || realLastModSec),
                  gmCount: totalGm,
                  subagent,
                  workspace,
                  parentId,
                });
                this._putUsageDiskCache(
                  id,
                  Number(item.stepCount || realStepCount),
                  Number(item.lastModifiedSec || realLastModSec),
                  merged,
                  scopeKey
                );
              }
              records.push({
                id,
                mode: 'delta',
                gmCount: totalGm,
                stepCount: realStepCount,
                lastModifiedSec: realLastModSec,
                subagent,
                ...(parentId ? { parentId } : {}),
                ...(workspace ? { workspace } : {}),
                delta: deltaRec,
              });
            } else {
              const fullRec = usageCore.analyzeTrajectoryForUsage(fullTraj, enrichedStub, id);
              if (workspace && fullRec && typeof fullRec === 'object' && !fullRec.workspace) fullRec.workspace = workspace;
              if (parentId && fullRec && typeof fullRec === 'object' && !fullRec.parentId) fullRec.parentId = parentId;
              if (allowDiskCache) {
                this._putUsageDiskCache(
                  id,
                  Number(item.stepCount || realStepCount),
                  Number(item.lastModifiedSec || realLastModSec),
                  fullRec,
                  scopeKey
                );
              }
              records.push({
                id,
                mode: 'full',
                subagent,
                ...(parentId ? { parentId } : {}),
                ...(workspace ? { workspace } : {}),
                record: fullRec,
              });
            }
          } else if (gmOffset > 0) {
            const deltaItems = [];
            let curOffset = gmOffset;
            let totalGm = null;
            while (true) {
              const page = await client.call('GetCascadeTrajectoryGeneratorMetadata', {
                cascadeId: id,
                generatorMetadataOffset: curOffset,
                includeMessages: false,
              });
              const chunk = page?.generatorMetadata || page?.generatorMetadatas || [];
              if (page?.numTotalGeneratorMetadata !== undefined && page?.numTotalGeneratorMetadata !== null) {
                totalGm = Number(page.numTotalGeneratorMetadata);
              }
              if (!chunk.length) break;
              deltaItems.push(...chunk);
              curOffset += chunk.length;
              if (totalGm !== null && curOffset >= totalGm) break;
            }
            if (totalGm !== null && totalGm < gmOffset) {
              // Rewound/reverted conversation: rebuild cleanly from offset 0
              const fullMeta = await this._fetchFullGeneratorMetadata(client, id);
              const fullRec = usageCore.analyzeTrajectoryForUsage(fullMeta, summaryStub, id);
              if (workspace && fullRec && typeof fullRec === 'object' && !fullRec.workspace) fullRec.workspace = workspace;
              if (parentId && fullRec && typeof fullRec === 'object' && !fullRec.parentId) fullRec.parentId = parentId;
              if (allowDiskCache) this._putUsageDiskCache(id, stepCount, lastModifiedSec, fullRec, scopeKey);
              records.push({
                id,
                mode: 'full',
                subagent,
                ...(parentId ? { parentId } : {}),
                ...(workspace ? { workspace } : {}),
                record: fullRec,
              });
            } else {
              const nextGmCount = totalGm !== null ? Math.max(gmOffset + deltaItems.length, totalGm) : gmOffset + deltaItems.length;
              const deltaSummary = {
                stepCount,
                lastModifiedTime: lastModifiedSec > 0 ? { seconds: lastModifiedSec } : { seconds: Math.floor(Date.now() / 1000) },
                createdTime: lastModifiedSec > 0 ? { seconds: lastModifiedSec } : undefined,
                ...(parentId ? { parentConversationId: parentId, parentId } : {}),
                ...(rootId ? { rootConversationId: rootId, rootId } : {}),
                ...(wsMeta.length ? { workspaces: wsMeta } : {}),
                trajectoryMetadata: {
                  ...(subagent ? { nestingDepth: 1 } : {}),
                  ...(parentId ? { parentConversationId: parentId } : {}),
                  ...(rootId ? { rootConversationId: rootId } : {}),
                  ...(wsMeta.length ? { workspaces: wsMeta } : {}),
                },
              };
              const deltaRec = usageCore.analyzeTrajectoryForUsage(
                { numTotalSteps: stepCount, numTotalGeneratorMetadata: nextGmCount, trajectory: { cascadeId: id, steps: [], generatorMetadata: deltaItems } },
                deltaSummary,
                id
              );
              if (workspace && deltaRec && typeof deltaRec === 'object' && !deltaRec.workspace) deltaRec.workspace = workspace;
              if (parentId && deltaRec && typeof deltaRec === 'object' && !deltaRec.parentId) deltaRec.parentId = parentId;
              if (allowDiskCache && diskHit?.record?.days && typeof usageCore.mergeUsageRecordDelta === 'function') {
                const merged = usageCore.mergeUsageRecordDelta(diskHit.record, deltaRec, {
                  cascadeId: id,
                  stepCount,
                  lastModifiedSec,
                  gmCount: nextGmCount,
                  subagent,
                  workspace,
                  parentId,
                });
                this._putUsageDiskCache(id, stepCount, lastModifiedSec, merged, scopeKey);
              }
              records.push({
                id,
                mode: 'delta',
                gmCount: nextGmCount,
                stepCount,
                lastModifiedSec,
                subagent,
                ...(parentId ? { parentId } : {}),
                ...(workspace ? { workspace } : {}),
                delta: deltaRec,
              });
            }
          } else {
            const fullMeta = await this._fetchFullGeneratorMetadata(client, id);
            const fullRec = usageCore.analyzeTrajectoryForUsage(fullMeta, summaryStub, id);
            if (workspace && fullRec && typeof fullRec === 'object' && !fullRec.workspace) fullRec.workspace = workspace;
            if (parentId && fullRec && typeof fullRec === 'object' && !fullRec.parentId) fullRec.parentId = parentId;
            if (allowDiskCache) this._putUsageDiskCache(id, stepCount, lastModifiedSec, fullRec, scopeKey);
            records.push({
              id,
              mode: 'full',
              subagent,
              ...(parentId ? { parentId } : {}),
              ...(workspace ? { workspace } : {}),
              record: fullRec,
            });
          }
        } catch (err) {
          records.push({ id, mode: 'error', error: sanitizeSecretText(err?.message || 'fetch failed') });
        }
      }
      return wantSummaries
        ? { ok: true, scopeKey, records, summaries: backendPack.list }
        : { ok: true, scopeKey, records };
    });
  }

  updateConfigBatch(entriesObj) {
    if (!entriesObj || typeof entriesObj !== 'object' || Array.isArray(entriesObj)) return false;
    const validPatch = {};
    let count = 0;
    for (const [k, v] of Object.entries(entriesObj)) {
      if (this.cdp.validateConfigEntry(k, v)) {
        validPatch[k] = v;
        count += 1;
      }
    }
    if (count === 0) return false;
    const cfgPath = path.join(this.rootDir, 'config.json');
    const current = this.cdp.readConfig();
    const expandedPatch =
      typeof this.cdp.reconcileConfigAliases === 'function' ? this.cdp.reconcileConfigAliases(validPatch) : validPatch;
    const next = { ...current, ...expandedPatch };
    this._selfConfigWriteUntil = Date.now() + 650;
    writeFileAtomicSync(cfgPath, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
    this.cdp?.invalidateConfigCache?.();
    this._configSeq += 1;
    return true;
  }

  updateConfigSetting(key, value) {
    return this.updateConfigBatch({ [key]: value });
  }

  _runEntryExclusive(entry, fn) {
    if (!entry) return Promise.resolve();
    const prev = entry._opChain || Promise.resolve();
    const next = prev.then(() => fn(), () => fn());
    entry._opChain = next.catch(() => {});
    return next;
  }

  _hasMainDefaultContext(entry) {
    if (!entry?.mainFrameId || !(entry.contextFrames instanceof Map)) return false;
    for (const meta of entry.contextFrames.values()) {
      if (
        meta &&
        meta.isDefault === true &&
        (!meta.type || meta.type === 'default') &&
        meta.frameId === entry.mainFrameId
      ) {
        return true;
      }
    }
    return false;
  }

  async _ensureMainFrameId(entry, timeoutMs = 4000, retries = 0) {
    if (!entry || entry.session?.closed) return null;
    if (typeof entry.mainFrameId === 'string' && entry.mainFrameId) return entry.mainFrameId;
    if (entry._mainFrameInFlight) return entry._mainFrameInFlight;
    const maxAttempts = Math.max(1, (Number(retries) | 0) + 1);
    const task = (async () => {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (entry.session?.closed) return null;
        if (typeof entry.mainFrameId === 'string' && entry.mainFrameId) return entry.mainFrameId;
        const ft = await entry.session.send('Page.getFrameTree', {}, timeoutMs).catch(() => null);
        const topFrameId = ft?.frameTree?.frame?.id;
        if (typeof topFrameId === 'string' && topFrameId) {
          entry.mainFrameId = topFrameId;
          entry.hasFrameTree = true;
          if (entry.sidebarHostVerified === true && entry.sidebarHostContextId == null) {
            entry.sidebarHostContextId = this._findCurrentMainDefaultContextId(entry);
          }
          return topFrameId;
        }
      }
      return typeof entry.mainFrameId === 'string' && entry.mainFrameId ? entry.mainFrameId : null;
    })();
    entry._mainFrameInFlight = task;
    try {
      return await task;
    } finally {
      if (entry._mainFrameInFlight === task) {
        entry._mainFrameInFlight = null;
      }
    }
  }

  _isTrustedMainFrameBindingCall(entry, executionContextId) {
    if (!entry) return false;
    const hasCtxId = typeof executionContextId === 'number';
    const contexts = entry.contextFrames instanceof Map ? entry.contextFrames : null;
    const meta = hasCtxId && contexts ? contexts.get(executionContextId) : null;

    if (meta) {
      if (meta.isDefault !== true) return false;
      if (meta.type && meta.type !== 'default') return false;
      if (!entry.mainFrameId || !meta.frameId || meta.frameId !== entry.mainFrameId) {
        return false;
      }
      return true;
    }

    // 真实帧树、已识别主帧、已登记上下文映射或带有未登记/已销毁 executionContextId 时一律 fail-closed
    if (entry.hasFrameTree || entry.mainFrameId) {
      return false;
    }
    if (contexts && contexts.size > 0) {
      return false;
    }
    if (hasCtxId) {
      return false;
    }
    // 非测试运行时未拿到帧树时 fail-closed；仅兼容无帧树且无上下文 ID 的极简单测 mock
    if (!isAutomatedTestRuntime()) {
      return false;
    }
    return true;
  }

  async broadcastConfigRefresh() {
    this._broadcastPending = true;
    if (this._broadcastRunning) {
      return new Promise((resolve) => {
        this._broadcastWaiters.push(resolve);
      });
    }

    this._broadcastRunning = true;
    try {
      while (this._broadcastPending) {
        this._broadcastPending = false;
        const snapSeq = this._configSeq;
        const activeItems = [...this.sessions.values()].filter((item) => item && !item.session.closed);
        const perEntryAck = new Map();
        for (const item of activeItems) {
          const entryAck = Number.isSafeInteger(item.pendingAckEpoch) && item.pendingAckEpoch > 0 ? item.pendingAckEpoch : 0;
          item.pendingAckEpoch = 0;
          perEntryAck.set(item, entryAck);
        }

        const restoreAllAcks = () => {
          for (const [item, ack] of perEntryAck.entries()) {
            if (ack > 0) {
              item.pendingAckEpoch = Math.max(Number(item.pendingAckEpoch || 0), ack);
            }
          }
        };

        const preCfg = typeof this.cdp.readConfig === 'function' ? this.cdp.readConfig() : {};
        const preOmniEnabled = this._isOmniEnabled(preCfg);
        if (preOmniEnabled) {
          await this.ensureOmniServer().catch(() => null);
          if (this._configSeq !== snapSeq) {
            restoreAllAcks();
            this._broadcastPending = true;
            continue;
          }
        } else if (this.omniServer) {
          const oldSrv = this.omniServer;
          this.omniServer = null;
          this.omniExpr = '';
          await oldSrv.stop?.().catch?.(() => {});
          if (this._configSeq !== snapSeq) {
            restoreAllAcks();
            this._broadcastPending = true;
            continue;
          }
        }
        const preSidebarEnabled = preCfg?.sidebarStudio === 'on';
        if (preSidebarEnabled) {
          await this.ensureSidebarService().catch(() => null);
          if (this._configSeq !== snapSeq) {
            restoreAllAcks();
            this._broadcastPending = true;
            continue;
          }
        }
        // Warm-cache rebuild updates `this.injectExpr` bootCfg in < 3ms without re-minifying modules!
        this.rebuildBundle({ deferDiskCacheWrite: true });
        const injectSnap = this.injectExpr;
        const omniSnap = this.omniExpr;
        const sidebarSnap = this.sidebarExpr;
        const hostI18nSnap = this.hostI18nExpr;
        let thoughtSnap = this.thoughtExpr;
        let inlineDiffSnap = this.inlineDiffExpr;
        let wallpaperSnap = this.wallpaperExpr;
        let catSanctuarySnap = this.catSanctuaryExpr;
        let effortSliderSnap = this.effortSliderExpr;
        let chatSceneSnap = this.chatSceneExpr;
        const currentCfg = typeof this.cdp.readConfig === 'function' ? this.cdp.readConfig() : {};
        this._syncPollIntervalFromConfig(currentCfg);
        if (currentCfg?.telemetryModule === 'off') {
          this._releaseIdleTelemetry(true);
        }
        const { channel: syncedUpdateChannel, changed: updateChannelChanged } = this._syncUpdateServiceChannel(currentCfg);
        if (updateChannelChanged && this.running) {
          void this.runUpdateCheck({ force: true, manual: false, allowAutoApply: false, channel: syncedUpdateChannel }).catch(() => {});
        }
        const omniEnabled = this._isOmniEnabled(currentCfg);
        const sidebarEnabled = currentCfg?.sidebarStudio === 'on';
        const hostI18nEnabled = this._isHostI18nEnabled(currentCfg);
        const hostI18nSig = hostI18nEnabled ? this._getHostI18nCfgSig(currentCfg) : '';
        const thoughtEnabled = this._isThoughtEnabled(currentCfg);
        if (thoughtEnabled && !thoughtSnap && typeof this.cdp.buildThoughtExpression === 'function') {
          thoughtSnap = this._buildThoughtExprForConfig(currentCfg);
        }
        const thoughtSig = thoughtEnabled ? this._getThoughtCfgSig(currentCfg, thoughtSnap) : '';
        if (!inlineDiffSnap && typeof this.cdp.buildInlineDiffInjectExpression === 'function') {
          inlineDiffSnap = this._buildInlineDiffExprForConfig(currentCfg);
        }
        const inlineDiffHash = inlineDiffSnap ? this._getInlineDiffExprHash(inlineDiffSnap) : '';
        if (!wallpaperSnap && typeof this.cdp.buildWallpaperExpression === 'function') {
          wallpaperSnap = this._buildWallpaperExprForConfig(currentCfg);
        }
        const wallpaperHash = wallpaperSnap ? this._getWallpaperExprHash(wallpaperSnap) : '';
        const catSanctuaryEnabled = this._isCatSanctuaryEnabled(currentCfg);
        if (catSanctuaryEnabled && !catSanctuarySnap && typeof this.cdp.buildCatSanctuaryExpression === 'function') {
          catSanctuarySnap = this._buildCatSanctuaryExprForConfig(currentCfg);
        }
        const catSanctuaryHash = catSanctuaryEnabled && catSanctuarySnap ? this._getCatSanctuaryExprHash(catSanctuarySnap) : '';
        const effortSliderEnabled = this._isEffortSliderEnabled(currentCfg);
        if (effortSliderEnabled && !effortSliderSnap && typeof this.cdp.buildEffortSliderExpression === 'function') {
          effortSliderSnap = this._buildEffortSliderExprForConfig(currentCfg);
        }
        const effortSliderHash = effortSliderEnabled && effortSliderSnap ? this._getEffortSliderExprHash(effortSliderSnap) : '';
        const chatSceneEnabled = this._isChatSceneEnabled(currentCfg);
        if (chatSceneEnabled && !chatSceneSnap && typeof this.cdp.buildChatSceneExpression === 'function') {
          chatSceneSnap = this._buildChatSceneExprForConfig(currentCfg);
        }
        const chatSceneSig = chatSceneEnabled && chatSceneSnap ? this._getChatSceneCfgSig(currentCfg, chatSceneSnap) : '';
        const canFastRefresh = typeof this.cdp.buildConfigRefreshExpression === 'function';
        const baseRefreshExpr = canFastRefresh ? this.cdp.buildConfigRefreshExpression() : null;
        if (activeItems.length === 0) continue;

        await Promise.allSettled(
          activeItems.map((entry) =>
            this._runEntryExclusive(entry, async () => {
              if (!entry || entry.session.closed) return;
              const entryAck = perEntryAck.get(entry) || 0;
              const abortIfStale = () => {
                if (this._configSeq !== snapSeq) {
                  if (entryAck > 0) {
                    entry.pendingAckEpoch = Math.max(Number(entry.pendingAckEpoch || 0), entryAck);
                  }
                  this._broadcastPending = true;
                  return true;
                }
                return entry.session.closed;
              };
              if (abortIfStale()) return;

              const refreshExpr =
                canFastRefresh && entryAck > 0
                  ? this.cdp.buildConfigRefreshExpression(null, { __ackEpoch: entryAck })
                  : baseRefreshExpr;
              // Fast live refresh first for immediate UI responsiveness
              let refreshedFast = false;
              let skippedStale = false;
              if (refreshExpr) {
                if (abortIfStale()) return;
                const fastRes = await entry.session.evaluate(refreshExpr).catch(() => null);
                if (fastRes && fastRes.refreshed) {
                  refreshedFast = true;
                  skippedStale = Boolean(fastRes.skippedStale);
                }
              }
              if (abortIfStale()) return;
              if (!refreshedFast && !entry.session.closed) {
                await entry.session.evaluate(injectSnap).catch(() => {});
              }
              if (abortIfStale()) return;
              const hadOmni = Boolean(entry.omniScriptId || entry.lastOmniExpr);
              const omniChanged = Boolean(omniEnabled && omniSnap && (entry.lastOmniExpr !== omniSnap || !entry.omniScriptId));
              if (omniEnabled && omniSnap) {
                if (!skippedStale && !entry.session.closed && (!refreshedFast || omniChanged)) {
                  await entry.session.send('Runtime.addBinding', { name: OMNI_BINDING }).catch(() => {});
                  await entry.session.evaluate(omniSnap).catch(() => {});
                }
              } else if (hadOmni && !skippedStale && !entry.session.closed) {
                await entry.session.evaluate(this._buildOmniCleanupExpression()).catch(() => {});
              }
              if (abortIfStale()) return;
              const hadSidebar = Boolean(entry.sidebarScriptId || entry.sidebarMounted || entry.sidebarBindingAdded);
              if (sidebarEnabled) {
                if (!skippedStale && !entry.session.closed) {
                  await this._ensureSidebarBinding(entry);
                  if (sidebarSnap && !entry.session.closed) {
                    await entry.session.evaluate(sidebarSnap).catch(() => {});
                    entry.sidebarMounted = true;
                  }
                }
              } else if (hadSidebar && !skippedStale && !entry.session.closed) {
                // on -> off 切换：移除绑定并仅下发轻量清理脚本，绝不下发完整 sidebar-client.js 载荷
                await this._removeSidebarBinding(entry);
                await entry.session.evaluate(this._buildSidebarCleanupExpression(true)).catch(() => {});
                entry.sidebarMounted = false;
              } else {
                await this._removeSidebarBinding(entry);
                entry.sidebarMounted = false;
              }
              if (abortIfStale()) return;
              const hadHostI18n = Boolean(entry.hostI18nScriptId || entry.hostI18nMounted);
              const hostI18nChanged = Boolean(
                hostI18nEnabled &&
                  hostI18nSnap &&
                  (entry.lastHostI18nSig !== hostI18nSig || !entry.hostI18nScriptId || !entry.hostI18nMounted)
              );
              if (hostI18nEnabled && hostI18nSnap) {
                if (!skippedStale && !entry.session.closed && (!refreshedFast || hostI18nChanged)) {
                  const evalRes = await entry.session.evaluate(hostI18nSnap).catch(() => null);
                  if (evalRes && evalRes.ok) {
                    entry.hostI18nMounted = true;
                    entry.lastHostI18nSig = hostI18nSig;
                  }
                }
              } else if (hadHostI18n && !skippedStale && !entry.session.closed) {
                await entry.session.evaluate(this._getHostI18nCleanupExpression()).catch(() => {});
                entry.hostI18nMounted = false;
                entry.lastHostI18nSig = '';
              }
              if (abortIfStale()) return;
              const hadThought = Boolean(entry.thoughtScriptId || entry.thoughtMounted);
              const thoughtChanged = Boolean(
                thoughtEnabled &&
                  thoughtSnap &&
                  (entry.lastThoughtSig !== thoughtSig || !entry.thoughtScriptId || !entry.thoughtMounted)
              );
              if (thoughtEnabled && thoughtSnap) {
                if (!skippedStale && !entry.session.closed && (!refreshedFast || thoughtChanged)) {
                  await entry.session.send('Runtime.addBinding', { name: THOUGHT_BINDING }).catch(() => {});
                  const evalRes = await entry.session.evaluate(thoughtSnap).catch(() => null);
                  if (evalRes && evalRes.ok) {
                    entry.thoughtMounted = true;
                    entry.lastThoughtSig = thoughtSig;
                  }
                }
              } else if (hadThought && !skippedStale && !entry.session.closed) {
                await entry.session.evaluate(this._getThoughtCleanupExpression()).catch(() => {});
                entry.thoughtMounted = false;
                entry.lastThoughtSig = '';
              }
              if (abortIfStale()) return;
              const hadInlineDiff = Boolean(entry.inlineDiffScriptId || entry.inlineDiffMounted);
              const inlineDiffChanged = Boolean(
                inlineDiffSnap &&
                  !entry.inlineDiffSkipped &&
                  (entry.lastInlineDiffHash !== inlineDiffHash || !entry.inlineDiffScriptId || !entry.inlineDiffMounted)
              );
              if (inlineDiffSnap) {
                if (!skippedStale && !entry.session.closed && !entry.inlineDiffSkipped && (!refreshedFast || inlineDiffChanged)) {
                  await this._ensureInlineDiffBinding(entry);
                  const evalRes = await entry.session.evaluate(inlineDiffSnap).catch(() => null);
                  await this._recordInlineDiffEvalOutcome(entry, evalRes, inlineDiffHash);
                }
              } else if (hadInlineDiff && !skippedStale && !entry.session.closed) {
                await entry.session.evaluate(this._getInlineDiffCleanupExpression()).catch(() => {});
                entry.inlineDiffMounted = false;
                entry.inlineDiffSkipped = false;
                entry.lastInlineDiffHash = '';
              }
              if (abortIfStale()) return;
              const hadWallpaper = Boolean(entry.wallpaperScriptId || entry.wallpaperMounted);
              const wallpaperChanged = Boolean(
                wallpaperSnap &&
                  !entry.wallpaperSkipped &&
                  (entry.lastWallpaperHash !== wallpaperHash || !entry.wallpaperScriptId || !entry.wallpaperMounted)
              );
              if (wallpaperSnap) {
                if (!skippedStale && !entry.session.closed && !entry.wallpaperSkipped && (!refreshedFast || wallpaperChanged)) {
                  await this._ensureWallpaperBinding(entry);
                  const evalRes = await entry.session.evaluate(wallpaperSnap).catch(() => null);
                  await this._recordWallpaperEvalOutcome(entry, evalRes, wallpaperHash);
                }
              } else if (hadWallpaper && !skippedStale && !entry.session.closed) {
                await this._removeWallpaperBinding(entry);
                await entry.session.evaluate(this._getWallpaperCleanupExpression()).catch(() => {});
                entry.wallpaperMounted = false;
                entry.wallpaperSkipped = false;
                entry.lastWallpaperHash = '';
              }
              if (abortIfStale()) return;
              const hadCatSanctuary = Boolean(entry.catSanctuaryScriptId || entry.catSanctuaryMounted);
              const catSanctuaryChanged = Boolean(
                catSanctuaryEnabled &&
                  catSanctuarySnap &&
                  !entry.catSanctuarySkipped &&
                  (entry.lastCatSanctuaryHash !== catSanctuaryHash || !entry.catSanctuaryScriptId || !entry.catSanctuaryMounted)
              );
              if (catSanctuaryEnabled && catSanctuarySnap) {
                if (!skippedStale && !entry.session.closed && !entry.catSanctuarySkipped && (!refreshedFast || catSanctuaryChanged)) {
                  const evalRes = await entry.session.evaluate(catSanctuarySnap).catch(() => null);
                  this._recordCatSanctuaryEvalOutcome(entry, evalRes, catSanctuaryHash);
                }
              } else if (hadCatSanctuary && !skippedStale && !entry.session.closed) {
                await entry.session.evaluate(this._getCatSanctuaryCleanupExpression()).catch(() => {});
                entry.catSanctuaryMounted = false;
                entry.catSanctuarySkipped = false;
                entry.lastCatSanctuaryHash = '';
              }
              if (abortIfStale()) return;
              const hadEffortSlider = Boolean(entry.effortSliderScriptId || entry.effortSliderMounted);
              const effortSliderChanged = Boolean(
                effortSliderEnabled &&
                  effortSliderSnap &&
                  !entry.effortSliderSkipped &&
                  (entry.lastEffortSliderHash !== effortSliderHash || !entry.effortSliderScriptId || !entry.effortSliderMounted)
              );
              if (effortSliderEnabled && effortSliderSnap) {
                if (!skippedStale && !entry.session.closed && !entry.effortSliderSkipped && (!refreshedFast || effortSliderChanged)) {
                  const evalRes = await entry.session.evaluate(effortSliderSnap).catch(() => null);
                  this._recordEffortSliderEvalOutcome(entry, evalRes, effortSliderHash);
                }
              } else if (hadEffortSlider && !skippedStale && !entry.session.closed) {
                await entry.session.evaluate(this._getEffortSliderCleanupExpression()).catch(() => {});
                entry.effortSliderMounted = false;
                entry.effortSliderSkipped = false;
                entry.lastEffortSliderHash = '';
              }
              if (abortIfStale()) return;
              const hadChatScene = Boolean(entry.chatSceneScriptId || entry.chatSceneMounted);
              const chatSceneChanged = Boolean(
                chatSceneEnabled &&
                  chatSceneSnap &&
                  !entry.chatSceneSkipped &&
                  (entry.lastChatSceneSig !== chatSceneSig || !entry.chatSceneScriptId || !entry.chatSceneMounted)
              );
              if (chatSceneEnabled && chatSceneSnap) {
                if (!skippedStale && !entry.session.closed && !entry.chatSceneSkipped && (!refreshedFast || chatSceneChanged)) {
                  const evalRes = await entry.session.evaluate(chatSceneSnap).catch(() => null);
                  this._recordChatSceneEvalOutcome(entry, evalRes, chatSceneSig);
                }
              } else if (hadChatScene && !skippedStale && !entry.session.closed) {
                await entry.session.evaluate(this._getChatSceneCleanupExpression()).catch(() => {});
                entry.chatSceneMounted = false;
                entry.chatSceneSkipped = false;
                entry.lastChatSceneSig = '';
              }

              // Coalesce persistent NewDocument script replacement if a newer mutation is already queued!
              if (this._broadcastPending || this._configSeq !== snapSeq || entry.session.closed) {
                return;
              }
              if (entry.scriptId) {
                await entry.session
                  .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId })
                  .catch(() => {});
                entry.scriptId = null;
              }
              const addRes = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: injectSnap })
                .catch(() => null);
              if (addRes && addRes.identifier) {
                entry.scriptId = addRes.identifier;
              }
              if (!omniSnap) {
                if (entry.omniScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId })
                    .catch(() => {});
                  entry.omniScriptId = null;
                }
                entry.lastOmniExpr = '';
              } else if (omniChanged && !entry.session.closed) {
                if (entry.omniScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId })
                    .catch(() => {});
                  entry.omniScriptId = null;
                }
                const omniAdd = await entry.session
                  .send('Page.addScriptToEvaluateOnNewDocument', { source: omniSnap })
                  .catch(() => null);
                if (omniAdd && omniAdd.identifier) {
                  entry.omniScriptId = omniAdd.identifier;
                  entry.lastOmniExpr = omniSnap;
                }
              }
              if (entry.sidebarScriptId) {
                await entry.session
                  .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId })
                  .catch(() => {});
                entry.sidebarScriptId = null;
              }
              if (sidebarSnap && sidebarEnabled && !entry.session.closed) {
                const sbAdd = await entry.session
                  .send('Page.addScriptToEvaluateOnNewDocument', { source: sidebarSnap })
                  .catch(() => null);
                if (sbAdd && sbAdd.identifier) {
                  entry.sidebarScriptId = sbAdd.identifier;
                }
              }
              if (!hostI18nEnabled || !hostI18nSnap) {
                if (entry.hostI18nScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId })
                    .catch(() => {});
                  entry.hostI18nScriptId = null;
                }
                entry.lastHostI18nScriptSig = '';
              } else if ((entry.lastHostI18nScriptSig !== hostI18nSig || !entry.hostI18nScriptId) && !entry.session.closed) {
                if (entry.hostI18nScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId })
                    .catch(() => {});
                  entry.hostI18nScriptId = null;
                }
                const hiAdd = await entry.session
                  .send('Page.addScriptToEvaluateOnNewDocument', { source: hostI18nSnap })
                  .catch(() => null);
                if (hiAdd && hiAdd.identifier) {
                  entry.hostI18nScriptId = hiAdd.identifier;
                  entry.lastHostI18nScriptSig = hostI18nSig;
                }
              }
              if (!thoughtEnabled || !thoughtSnap) {
                if (entry.thoughtScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.thoughtScriptId })
                    .catch(() => {});
                  entry.thoughtScriptId = null;
                }
                entry.lastThoughtScriptSig = '';
              } else if ((entry.lastThoughtScriptSig !== thoughtSig || !entry.thoughtScriptId) && !entry.session.closed) {
                if (entry.thoughtScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.thoughtScriptId })
                    .catch(() => {});
                  entry.thoughtScriptId = null;
                }
                const thoughtAdd = await entry.session
                  .send('Page.addScriptToEvaluateOnNewDocument', { source: thoughtSnap })
                  .catch(() => null);
                if (thoughtAdd && thoughtAdd.identifier) {
                  entry.thoughtScriptId = thoughtAdd.identifier;
                  entry.lastThoughtScriptSig = thoughtSig;
                }
              }
              if (!inlineDiffSnap) {
                if (entry.inlineDiffScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.inlineDiffScriptId })
                    .catch(() => {});
                  entry.inlineDiffScriptId = null;
                }
                entry.lastInlineDiffScriptHash = '';
              } else if ((entry.lastInlineDiffScriptHash !== inlineDiffHash || !entry.inlineDiffScriptId) && !entry.session.closed) {
                if (entry.inlineDiffScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.inlineDiffScriptId })
                    .catch(() => {});
                  entry.inlineDiffScriptId = null;
                }
                const inlineDiffAdd = await entry.session
                  .send('Page.addScriptToEvaluateOnNewDocument', { source: inlineDiffSnap })
                  .catch(() => null);
                if (inlineDiffAdd && inlineDiffAdd.identifier) {
                  entry.inlineDiffScriptId = inlineDiffAdd.identifier;
                  entry.lastInlineDiffScriptHash = inlineDiffHash;
                }
              }
              if (!wallpaperSnap) {
                if (entry.wallpaperScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.wallpaperScriptId })
                    .catch(() => {});
                  entry.wallpaperScriptId = null;
                }
                entry.lastWallpaperScriptHash = '';
              } else if ((entry.lastWallpaperScriptHash !== wallpaperHash || !entry.wallpaperScriptId) && !entry.session.closed) {
                if (entry.wallpaperScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.wallpaperScriptId })
                    .catch(() => {});
                  entry.wallpaperScriptId = null;
                }
                const wallpaperAdd = await entry.session
                  .send('Page.addScriptToEvaluateOnNewDocument', { source: wallpaperSnap })
                  .catch(() => null);
                if (wallpaperAdd && wallpaperAdd.identifier) {
                  entry.wallpaperScriptId = wallpaperAdd.identifier;
                  entry.lastWallpaperScriptHash = wallpaperHash;
                }
              }
              if (!catSanctuaryEnabled || !catSanctuarySnap) {
                if (entry.catSanctuaryScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.catSanctuaryScriptId })
                    .catch(() => {});
                  entry.catSanctuaryScriptId = null;
                }
                entry.lastCatSanctuaryScriptHash = '';
              } else if ((entry.lastCatSanctuaryScriptHash !== catSanctuaryHash || !entry.catSanctuaryScriptId) && !entry.session.closed) {
                if (entry.catSanctuaryScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.catSanctuaryScriptId })
                    .catch(() => {});
                  entry.catSanctuaryScriptId = null;
                }
                const catSanctuaryAdd = await entry.session
                  .send('Page.addScriptToEvaluateOnNewDocument', { source: catSanctuarySnap })
                  .catch(() => null);
                if (catSanctuaryAdd && catSanctuaryAdd.identifier) {
                  entry.catSanctuaryScriptId = catSanctuaryAdd.identifier;
                  entry.lastCatSanctuaryScriptHash = catSanctuaryHash;
                }
              }
              if (!effortSliderEnabled || !effortSliderSnap) {
                if (entry.effortSliderScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.effortSliderScriptId })
                    .catch(() => {});
                  entry.effortSliderScriptId = null;
                }
                entry.lastEffortSliderScriptHash = '';
              } else if ((entry.lastEffortSliderScriptHash !== effortSliderHash || !entry.effortSliderScriptId) && !entry.session.closed) {
                if (entry.effortSliderScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.effortSliderScriptId })
                    .catch(() => {});
                  entry.effortSliderScriptId = null;
                }
                const effortSliderAdd = await entry.session
                  .send('Page.addScriptToEvaluateOnNewDocument', { source: effortSliderSnap })
                  .catch(() => null);
                if (effortSliderAdd && effortSliderAdd.identifier) {
                  entry.effortSliderScriptId = effortSliderAdd.identifier;
                  entry.lastEffortSliderScriptHash = effortSliderHash;
                }
              }
              if (!chatSceneEnabled || !chatSceneSnap) {
                if (entry.chatSceneScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.chatSceneScriptId })
                    .catch(() => {});
                  entry.chatSceneScriptId = null;
                }
                entry.lastChatSceneScriptSig = '';
              } else if ((entry.lastChatSceneScriptSig !== chatSceneSig || !entry.chatSceneScriptId) && !entry.session.closed) {
                if (entry.chatSceneScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.chatSceneScriptId })
                    .catch(() => {});
                  entry.chatSceneScriptId = null;
                }
                const chatSceneAdd = await entry.session
                  .send('Page.addScriptToEvaluateOnNewDocument', { source: chatSceneSnap })
                  .catch(() => null);
                if (chatSceneAdd && chatSceneAdd.identifier) {
                  entry.chatSceneScriptId = chatSceneAdd.identifier;
                  entry.lastChatSceneScriptSig = chatSceneSig;
                }
              }
            })
          )
        );
      }
    } finally {
      this._broadcastRunning = false;
      const waiters = this._broadcastWaiters.splice(0);
      for (const resolve of waiters) {
        try {
          resolve();
        } catch {}
      }
    }
  }

  _targetKey(target) {
    if (!target || typeof target !== 'object') return '';
    return String(target.id || target.targetId || target.webSocketDebuggerUrl || '').trim();
  }

  _normalizeIgnoreUrl(rawUrl) {
    const s = String(rawUrl || '').trim();
    if (!s) return '';
    try {
      const u = new URL(s);
      return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${u.pathname}`;
    } catch {
      return s.split(/[?#]/)[0].toLowerCase();
    }
  }

  _markTargetIgnored(target, urlOverride = '') {
    const key = this._targetKey(target);
    if (!key) return;
    const normUrl = this._normalizeIgnoreUrl(urlOverride || target?.url || '');
    if (this.ignoredTargets.has(key)) {
      this.ignoredTargets.delete(key);
    } else if (this.ignoredTargets.size >= 256) {
      const oldest = this.ignoredTargets.keys().next().value;
      if (oldest !== undefined) this.ignoredTargets.delete(oldest);
    }
    this.ignoredTargets.set(key, normUrl);
  }

  isTargetIgnored(target) {
    const key = this._targetKey(target);
    if (!key || !this.ignoredTargets.has(key)) return false;
    const prevNorm = this.ignoredTargets.get(key);
    const curNorm = this._normalizeIgnoreUrl(target?.url || '');
    if (curNorm && prevNorm && curNorm !== prevNorm) {
      this.ignoredTargets.delete(key);
      return false;
    }
    return true;
  }

  _isEligibleDaemonTarget(target) {
    const checkFn = typeof this.cdp?.isEligibleTarget === 'function' ? this.cdp.isEligibleTarget : isEligibleTarget;
    if (!checkFn(target)) return false;
    return !this.isTargetIgnored(target);
  }

  async applyToEntry(entry) {
    return this._runEntryExclusive(entry, async () => {
      if (!entry || entry.session.closed) return null;
      const readCfg = () => (typeof this.cdp?.readConfig === 'function' ? this.cdp.readConfig() : null);
      let cfgSeq = this._configSeq;
      let cfg = readCfg();
      const getCurrentCfg = () => {
        if (this._configSeq !== cfgSeq) {
          cfgSeq = this._configSeq;
          cfg = readCfg();
        }
        return cfg;
      };
      const omniEnabledInit = this._isOmniEnabled(cfg);
      if (omniEnabledInit) {
        await this.ensureOmniServer().catch(() => null);
      }
      const sidebarEnabledInit = this._isSidebarStudioEnabled(cfg);
      if (sidebarEnabledInit) {
        await this.ensureSidebarService().catch(() => null);
      }
      if (!this.injectExpr) this.rebuildBundle();
      else {
        const curCfg = getCurrentCfg();
        const chOpts = this._getChannelCacheOpts(true);
        let usedChCache = false;
        if (!omniEnabledInit) {
          this.omniExpr = '';
        } else if (this.omniServer && !this.omniExpr && typeof this.cdp.buildOmniClientExpression === 'function') {
          this.omniExpr = chOpts
            ? this.cdp.buildOmniClientExpression(this.omniServer.getServerInfo(), null, chOpts)
            : this.cdp.buildOmniClientExpression(this.omniServer.getServerInfo());
          if (chOpts) usedChCache = true;
        }
        if (sidebarEnabledInit && !this.sidebarExpr && typeof this.cdp.buildSidebarStudioExpression === 'function') {
          this.sidebarExpr = this._buildSidebarExprForCurrentClient(chOpts);
          if (chOpts) usedChCache = true;
        }
        if (!this.hostI18nExpr && this._isHostI18nEnabled(curCfg) && typeof this.cdp.buildHostI18nExpression === 'function') {
          this.hostI18nExpr = chOpts
            ? this.cdp.buildHostI18nExpression(curCfg, null, chOpts)
            : this.cdp.buildHostI18nExpression(curCfg);
          if (chOpts) usedChCache = true;
        }
        if (!this.thoughtExpr && this._isThoughtEnabled(curCfg) && typeof this.cdp.buildThoughtExpression === 'function') {
          this._buildThoughtExprForConfig(curCfg, chOpts);
          if (chOpts) usedChCache = true;
        }
        if (!this.inlineDiffExpr && typeof this.cdp.buildInlineDiffInjectExpression === 'function') {
          this._buildInlineDiffExprForConfig(curCfg, chOpts);
          if (chOpts && this.inlineDiffExpr) usedChCache = true;
        }
        if (!this.wallpaperExpr && typeof this.cdp.buildWallpaperExpression === 'function') {
          this._buildWallpaperExprForConfig(curCfg, chOpts);
          if (chOpts && this.wallpaperExpr) usedChCache = true;
        }
        if (!this.catSanctuaryExpr && this._isCatSanctuaryEnabled(curCfg) && typeof this.cdp.buildCatSanctuaryExpression === 'function') {
          this._buildCatSanctuaryExprForConfig(curCfg, chOpts);
          if (chOpts && this.catSanctuaryExpr) usedChCache = true;
        }
        if (!this.effortSliderExpr && this._isEffortSliderEnabled(curCfg) && typeof this.cdp.buildEffortSliderExpression === 'function') {
          this._buildEffortSliderExprForConfig(curCfg, chOpts);
          if (chOpts && this.effortSliderExpr) usedChCache = true;
        }
        if (!this.chatSceneExpr && this._isChatSceneEnabled(curCfg) && typeof this.cdp.buildChatSceneExpression === 'function') {
          this._buildChatSceneExprForConfig(curCfg, chOpts);
          if (chOpts && this.chatSceneExpr) usedChCache = true;
        }
        if (usedChCache && this.running) {
          this._scheduleBundleCacheFlush();
        }
      }
      if (entry.scriptId) {
        await entry.session
          .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId })
          .catch(() => {});
        entry.scriptId = null;
      }
      const addRes = await entry.session.send('Page.addScriptToEvaluateOnNewDocument', {
        source: this.injectExpr,
      });
      if (addRes && addRes.identifier) {
        entry.scriptId = addRes.identifier;
      }
      const sidebarDocument = entry.sidebarDocument;
      const mainRes = await entry.session.evaluate(this.injectExpr);
      this._markSidebarHostVerified(entry, sidebarDocument, mainRes?.status === 'ok');

      if (mainRes && mainRes.status === 'skipped-non-host') {
        if (entry.scriptId) {
          await entry.session
            .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId })
            .catch(() => {});
          entry.scriptId = null;
        }
        if (entry.omniScriptId) {
          await entry.session
            .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId })
            .catch(() => {});
          entry.omniScriptId = null;
        }
        if (entry.sidebarScriptId) {
          await entry.session
            .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId })
            .catch(() => {});
          entry.sidebarScriptId = null;
        }
        if (entry.hostI18nScriptId) {
          await entry.session
            .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId })
            .catch(() => {});
          entry.hostI18nScriptId = null;
        }
        if (entry.thoughtScriptId) {
          await entry.session
            .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.thoughtScriptId })
            .catch(() => {});
          entry.thoughtScriptId = null;
        }
        if (entry.inlineDiffScriptId) {
          await entry.session
            .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.inlineDiffScriptId })
            .catch(() => {});
          entry.inlineDiffScriptId = null;
        }
        if (entry.wallpaperScriptId) {
          await entry.session
            .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.wallpaperScriptId })
            .catch(() => {});
          entry.wallpaperScriptId = null;
        }
        if (entry.catSanctuaryScriptId) {
          await entry.session
            .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.catSanctuaryScriptId })
            .catch(() => {});
          entry.catSanctuaryScriptId = null;
        }
        if (entry.effortSliderScriptId) {
          await entry.session
            .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.effortSliderScriptId })
            .catch(() => {});
          entry.effortSliderScriptId = null;
        }
        if (entry.chatSceneScriptId) {
          await entry.session
            .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.chatSceneScriptId })
            .catch(() => {});
          entry.chatSceneScriptId = null;
        }
        await this._removeSidebarBinding(entry);
        await this._removeInlineDiffBinding(entry);
        await this._removeWallpaperBinding(entry);
        entry.sidebarMounted = false;
        entry.hostI18nMounted = false;
        entry.lastHostI18nSig = '';
        entry.lastHostI18nScriptSig = '';
        entry.thoughtMounted = false;
        entry.lastThoughtSig = '';
        entry.lastThoughtScriptSig = '';
        entry.inlineDiffMounted = false;
        entry.inlineDiffSkipped = true;
        entry.lastInlineDiffHash = '';
        entry.lastInlineDiffScriptHash = '';
        entry.wallpaperMounted = false;
        entry.wallpaperSkipped = true;
        entry.lastWallpaperHash = '';
        entry.lastWallpaperScriptHash = '';
        entry.catSanctuaryMounted = false;
        entry.catSanctuarySkipped = true;
        entry.lastCatSanctuaryHash = '';
        entry.lastCatSanctuaryScriptHash = '';
        entry.effortSliderMounted = false;
        entry.effortSliderSkipped = true;
        entry.lastEffortSliderHash = '';
        entry.lastEffortSliderScriptHash = '';
        entry.chatSceneMounted = false;
        entry.chatSceneSkipped = true;
        entry.lastChatSceneSig = '';
        entry.lastChatSceneScriptSig = '';
        return mainRes;
      }

      const cfgNow = getCurrentCfg();
      const hadOmniBefore = Boolean(entry.omniScriptId || entry.lastOmniExpr);
      if (entry.omniScriptId) {
        await entry.session
          .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId })
          .catch(() => {});
        entry.omniScriptId = null;
      }
      const omniEnabledNow = this._isOmniEnabled(cfgNow);
      if (omniEnabledNow && this.omniExpr) {
        await entry.session.send('Runtime.addBinding', { name: OMNI_BINDING }).catch(() => {});
        const omniAdd = await entry.session
          .send('Page.addScriptToEvaluateOnNewDocument', { source: this.omniExpr })
          .catch(() => null);
        if (omniAdd && omniAdd.identifier) {
          entry.omniScriptId = omniAdd.identifier;
          entry.lastOmniExpr = this.omniExpr;
        }
        await entry.session.evaluate(this.omniExpr).catch(() => null);
      } else {
        if (hadOmniBefore) {
          await entry.session.evaluate(this._buildOmniCleanupExpression()).catch(() => null);
        }
        entry.lastOmniExpr = '';
      }
      const hadSidebarBefore = Boolean(entry.sidebarScriptId || entry.sidebarMounted);
      if (entry.sidebarScriptId) {
        await entry.session
          .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId })
          .catch(() => {});
        entry.sidebarScriptId = null;
      }
      const sidebarEnabledNow = this._isSidebarStudioEnabled(cfgNow);
      if (sidebarEnabledNow) {
        if (!this.sidebarService) {
          await this.ensureSidebarService().catch(() => null);
        }
        await this._ensureSidebarBinding(entry);
        if (!this.sidebarExpr && typeof this.cdp.buildSidebarStudioExpression === 'function') {
          this.sidebarExpr = this._buildSidebarExprForCurrentClient();
        }
        if (this.sidebarExpr) {
          const sbAdd = await entry.session
            .send('Page.addScriptToEvaluateOnNewDocument', { source: this.sidebarExpr })
            .catch(() => null);
          if (sbAdd && sbAdd.identifier) {
            entry.sidebarScriptId = sbAdd.identifier;
          }
          await entry.session.evaluate(this.sidebarExpr).catch(() => null);
          entry.sidebarMounted = true;
        }
      } else {
        await this._removeSidebarBinding(entry);
        // 关闭态免向新页面下发完整 sidebar-client.js 载荷；仅对已有残留或此前已挂载页面执行轻量清理
        await entry.session.evaluate(this._buildSidebarCleanupExpression(hadSidebarBefore)).catch(() => null);
        entry.sidebarMounted = false;
      }
      const hadHostI18nBefore = Boolean(entry.hostI18nScriptId || entry.hostI18nMounted);
      if (entry.hostI18nScriptId) {
        await entry.session
          .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId })
          .catch(() => {});
        entry.hostI18nScriptId = null;
      }
      const hostI18nEnabledNow = this._isHostI18nEnabled(cfgNow);
      if (hostI18nEnabledNow) {
        if (!this.hostI18nExpr && typeof this.cdp.buildHostI18nExpression === 'function') {
          const chOpts = this._getChannelCacheOpts(true);
          this.hostI18nExpr = chOpts
            ? this.cdp.buildHostI18nExpression(cfgNow, null, chOpts)
            : this.cdp.buildHostI18nExpression(cfgNow);
          if (chOpts && this.running) this._scheduleBundleCacheFlush();
        }
        if (this.hostI18nExpr) {
          const hiAdd = await entry.session
            .send('Page.addScriptToEvaluateOnNewDocument', { source: this.hostI18nExpr })
            .catch(() => null);
          if (hiAdd && hiAdd.identifier) {
            entry.hostI18nScriptId = hiAdd.identifier;
          }
          const evalRes = await entry.session.evaluate(this.hostI18nExpr).catch(() => null);
          const hiSig = this._getHostI18nCfgSig(cfgNow);
          if (evalRes && evalRes.ok) {
            entry.hostI18nMounted = true;
            entry.lastHostI18nSig = hiSig;
          }
          if (hiAdd && hiAdd.identifier) {
            entry.lastHostI18nScriptSig = hiSig;
          }
        }
      } else {
        if (hadHostI18nBefore) {
          await entry.session.evaluate(this._getHostI18nCleanupExpression()).catch(() => null);
        }
        entry.hostI18nMounted = false;
        entry.lastHostI18nSig = '';
        entry.lastHostI18nScriptSig = '';
      }
      const hadThoughtBefore = Boolean(entry.thoughtScriptId || entry.thoughtMounted);
      if (entry.thoughtScriptId) {
        await entry.session
          .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.thoughtScriptId })
          .catch(() => {});
        entry.thoughtScriptId = null;
      }
      const thoughtCfgNow = getCurrentCfg();
      const thoughtEnabledNow = this._isThoughtEnabled(thoughtCfgNow);
      if (thoughtEnabledNow) {
        if (!this.thoughtExpr && typeof this.cdp.buildThoughtExpression === 'function') {
          this._buildThoughtExprForConfig(thoughtCfgNow);
        }
        if (this.thoughtExpr) {
          await entry.session.send('Runtime.addBinding', { name: THOUGHT_BINDING }).catch(() => {});
          const thoughtAdd = await entry.session
            .send('Page.addScriptToEvaluateOnNewDocument', { source: this.thoughtExpr })
            .catch(() => null);
          if (thoughtAdd && thoughtAdd.identifier) {
            entry.thoughtScriptId = thoughtAdd.identifier;
          }
          const evalRes = await entry.session.evaluate(this.thoughtExpr).catch(() => null);
          const thoughtSig = this._getThoughtCfgSig(thoughtCfgNow);
          if (evalRes && evalRes.ok) {
            entry.thoughtMounted = true;
            entry.lastThoughtSig = thoughtSig;
          } else {
            entry.thoughtMounted = false;
            entry.lastThoughtSig = '';
          }
          if (thoughtAdd && thoughtAdd.identifier) {
            entry.lastThoughtScriptSig = thoughtSig;
          } else {
            entry.lastThoughtScriptSig = '';
          }
        }
      } else {
        if (hadThoughtBefore) {
          await entry.session.evaluate(this._getThoughtCleanupExpression()).catch(() => null);
        }
        entry.thoughtMounted = false;
        entry.lastThoughtSig = '';
        entry.lastThoughtScriptSig = '';
      }
      const hadInlineDiffBefore = Boolean(entry.inlineDiffScriptId || entry.inlineDiffMounted);
      if (entry.inlineDiffScriptId) {
        await entry.session
          .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.inlineDiffScriptId })
          .catch(() => {});
        entry.inlineDiffScriptId = null;
      }
      const inlineDiffCfgNow = getCurrentCfg();
      if (!this.inlineDiffExpr && typeof this.cdp.buildInlineDiffInjectExpression === 'function') {
        this._buildInlineDiffExprForConfig(inlineDiffCfgNow);
      }
      if (this.inlineDiffExpr) {
        await this._ensureInlineDiffBinding(entry);
        const inlineDiffAdd = await entry.session
          .send('Page.addScriptToEvaluateOnNewDocument', { source: this.inlineDiffExpr })
          .catch(() => null);
        if (inlineDiffAdd && inlineDiffAdd.identifier) {
          entry.inlineDiffScriptId = inlineDiffAdd.identifier;
        }
        const evalRes = await entry.session.evaluate(this.inlineDiffExpr).catch(() => null);
        const inlineDiffHash = this._getInlineDiffExprHash(this.inlineDiffExpr);
        await this._recordInlineDiffEvalOutcome(entry, evalRes, inlineDiffHash);
        if (inlineDiffAdd && inlineDiffAdd.identifier) {
          entry.lastInlineDiffScriptHash = inlineDiffHash;
        } else {
          entry.lastInlineDiffScriptHash = '';
        }
      } else {
        if (hadInlineDiffBefore) {
          await entry.session.evaluate(this._getInlineDiffCleanupExpression()).catch(() => null);
        }
        entry.inlineDiffMounted = false;
        entry.inlineDiffSkipped = false;
        entry.lastInlineDiffHash = '';
        entry.lastInlineDiffScriptHash = '';
      }
      const hadWallpaperBefore = Boolean(entry.wallpaperScriptId || entry.wallpaperMounted);
      if (entry.wallpaperScriptId) {
        await entry.session
          .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.wallpaperScriptId })
          .catch(() => {});
        entry.wallpaperScriptId = null;
      }
      const wallpaperCfgNow = getCurrentCfg();
      if (!this.wallpaperExpr && typeof this.cdp.buildWallpaperExpression === 'function') {
        this._buildWallpaperExprForConfig(wallpaperCfgNow);
      }
      if (this.wallpaperExpr) {
        await this._ensureWallpaperBinding(entry);
        const wallpaperAdd = await entry.session
          .send('Page.addScriptToEvaluateOnNewDocument', { source: this.wallpaperExpr })
          .catch(() => null);
        if (wallpaperAdd && wallpaperAdd.identifier) {
          entry.wallpaperScriptId = wallpaperAdd.identifier;
        }
        const evalRes = await entry.session.evaluate(this.wallpaperExpr).catch(() => null);
        const wallpaperHash = this._getWallpaperExprHash(this.wallpaperExpr);
        await this._recordWallpaperEvalOutcome(entry, evalRes, wallpaperHash);
        if (wallpaperAdd && wallpaperAdd.identifier) {
          entry.lastWallpaperScriptHash = wallpaperHash;
        } else {
          entry.lastWallpaperScriptHash = '';
        }
      } else {
        if (hadWallpaperBefore) {
          await this._removeWallpaperBinding(entry);
          await entry.session.evaluate(this._getWallpaperCleanupExpression()).catch(() => null);
        }
        entry.wallpaperMounted = false;
        entry.wallpaperSkipped = false;
        entry.lastWallpaperHash = '';
        entry.lastWallpaperScriptHash = '';
      }
      const hadCatSanctuaryBefore = Boolean(entry.catSanctuaryScriptId || entry.catSanctuaryMounted);
      if (entry.catSanctuaryScriptId) {
        await entry.session
          .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.catSanctuaryScriptId })
          .catch(() => {});
        entry.catSanctuaryScriptId = null;
      }
      const catSanctuaryCfgNow = getCurrentCfg();
      const catSanctuaryEnabledNow = this._isCatSanctuaryEnabled(catSanctuaryCfgNow);
      if (catSanctuaryEnabledNow) {
        if (!this.catSanctuaryExpr && typeof this.cdp.buildCatSanctuaryExpression === 'function') {
          this._buildCatSanctuaryExprForConfig(catSanctuaryCfgNow);
        }
        if (this.catSanctuaryExpr) {
          const catSanctuaryAdd = await entry.session
            .send('Page.addScriptToEvaluateOnNewDocument', { source: this.catSanctuaryExpr })
            .catch(() => null);
          if (catSanctuaryAdd && catSanctuaryAdd.identifier) {
            entry.catSanctuaryScriptId = catSanctuaryAdd.identifier;
          }
          const evalRes = await entry.session.evaluate(this.catSanctuaryExpr).catch(() => null);
          const catSanctuaryHash = this._getCatSanctuaryExprHash(this.catSanctuaryExpr);
          this._recordCatSanctuaryEvalOutcome(entry, evalRes, catSanctuaryHash);
          if (catSanctuaryAdd && catSanctuaryAdd.identifier) {
            entry.lastCatSanctuaryScriptHash = catSanctuaryHash;
          } else {
            entry.lastCatSanctuaryScriptHash = '';
          }
        }
      } else {
        if (hadCatSanctuaryBefore) {
          await entry.session.evaluate(this._getCatSanctuaryCleanupExpression()).catch(() => null);
        }
        entry.catSanctuaryMounted = false;
        entry.catSanctuarySkipped = false;
        entry.lastCatSanctuaryHash = '';
        entry.lastCatSanctuaryScriptHash = '';
      }
      const hadEffortSliderBefore = Boolean(entry.effortSliderScriptId || entry.effortSliderMounted);
      if (entry.effortSliderScriptId) {
        await entry.session
          .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.effortSliderScriptId })
          .catch(() => {});
        entry.effortSliderScriptId = null;
      }
      const effortSliderCfgNow = getCurrentCfg();
      const effortSliderEnabledNow = this._isEffortSliderEnabled(effortSliderCfgNow);
      if (effortSliderEnabledNow) {
        if (!this.effortSliderExpr && typeof this.cdp.buildEffortSliderExpression === 'function') {
          this._buildEffortSliderExprForConfig(effortSliderCfgNow);
        }
        if (this.effortSliderExpr) {
          const effortSliderAdd = await entry.session
            .send('Page.addScriptToEvaluateOnNewDocument', { source: this.effortSliderExpr })
            .catch(() => null);
          if (effortSliderAdd && effortSliderAdd.identifier) {
            entry.effortSliderScriptId = effortSliderAdd.identifier;
          }
          const evalRes = await entry.session.evaluate(this.effortSliderExpr).catch(() => null);
          const effortSliderHash = this._getEffortSliderExprHash(this.effortSliderExpr);
          this._recordEffortSliderEvalOutcome(entry, evalRes, effortSliderHash);
          if (effortSliderAdd && effortSliderAdd.identifier) {
            entry.lastEffortSliderScriptHash = effortSliderHash;
          } else {
            entry.lastEffortSliderScriptHash = '';
          }
        }
      } else {
        if (hadEffortSliderBefore) {
          await entry.session.evaluate(this._getEffortSliderCleanupExpression()).catch(() => null);
        }
        entry.effortSliderMounted = false;
        entry.effortSliderSkipped = false;
        entry.lastEffortSliderHash = '';
        entry.lastEffortSliderScriptHash = '';
      }
      const hadChatSceneBefore = Boolean(entry.chatSceneScriptId || entry.chatSceneMounted);
      if (entry.chatSceneScriptId) {
        await entry.session
          .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.chatSceneScriptId })
          .catch(() => {});
        entry.chatSceneScriptId = null;
      }
      const chatSceneCfgNow = getCurrentCfg();
      const chatSceneEnabledNow = this._isChatSceneEnabled(chatSceneCfgNow);
      if (chatSceneEnabledNow) {
        if (!this.chatSceneExpr && typeof this.cdp.buildChatSceneExpression === 'function') {
          this._buildChatSceneExprForConfig(chatSceneCfgNow);
        }
        if (this.chatSceneExpr) {
          const chatSceneAdd = await entry.session
            .send('Page.addScriptToEvaluateOnNewDocument', { source: this.chatSceneExpr })
            .catch(() => null);
          if (chatSceneAdd && chatSceneAdd.identifier) {
            entry.chatSceneScriptId = chatSceneAdd.identifier;
          }
          const evalRes = await entry.session.evaluate(this.chatSceneExpr).catch(() => null);
          const chatSceneSig = this._getChatSceneCfgSig(chatSceneCfgNow, this.chatSceneExpr);
          this._recordChatSceneEvalOutcome(entry, evalRes, chatSceneSig);
          if (chatSceneAdd && chatSceneAdd.identifier) {
            entry.lastChatSceneScriptSig = chatSceneSig;
          } else {
            entry.lastChatSceneScriptSig = '';
          }
        }
      } else {
        if (hadChatSceneBefore) {
          await entry.session.evaluate(this._getChatSceneCleanupExpression()).catch(() => null);
        }
        entry.chatSceneMounted = false;
        entry.chatSceneSkipped = false;
        entry.lastChatSceneSig = '';
        entry.lastChatSceneScriptSig = '';
      }
      entry.lastVerifyAt = Date.now();
      entry.healthyStreak = 1;
      entry.verifyDirty = false;
      entry.lastVerifiedCodeHash = this.codeHash || '';
      return mainRes;
    });
  }

  async handleBindingCall(entry, { name, payload, executionContextId }) {
    if (!this._isTrustedMainFrameBindingCall(entry, executionContextId)) {
      if (!entry || entry.mainFrameId || entry.session?.closed) return;
      const hasCtxId = typeof executionContextId === 'number';
      const meta = hasCtxId && entry.contextFrames instanceof Map ? entry.contextFrames.get(executionContextId) : null;
      if (meta && (meta.isDefault !== true || (meta.type && meta.type !== 'default'))) return;
      await this._ensureMainFrameId(entry, 3000, 0);
      if (!this._isTrustedMainFrameBindingCall(entry, executionContextId)) return;
    }
    if (name === this.cdp.SETTING_BINDING || name === this.cdp.LEGACY_SETTING_BINDING) {
      if (typeof payload !== 'string' || payload.length > 8192) return;
      try {
        const parsed = JSON.parse(payload);
        if (!parsed || typeof parsed !== 'object') return;
        const updated =
          parsed.action === 'patch-batch' && parsed.entries && typeof parsed.entries === 'object'
            ? this.updateConfigBatch(parsed.entries)
            : this.updateConfigSetting(parsed.key, parsed.value);
        if (updated) {
          if (entry && Number.isSafeInteger(parsed.clientEpoch) && parsed.clientEpoch > 0) {
            entry.pendingAckEpoch = parsed.clientEpoch;
          }
          await this.broadcastConfigRefresh();
        }
      } catch {}
      return;
    }

    if (name === REPO_BINDING) {
      if (typeof payload !== 'string' || payload.length > 4096) return;
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }
      const reqId = parsed && Number.isSafeInteger(parsed.id) ? parsed.id : null;
      const action =
        parsed?.action ||
        parsed?.type ||
        parsed?.input?.action ||
        parsed?.payload?.action ||
        'status';

      const inputPayload =
        parsed?.input && typeof parsed.input === 'object' && !Array.isArray(parsed.input)
          ? { ...parsed.input }
          : parsed?.payload && typeof parsed.payload === 'object' && !Array.isArray(parsed.payload)
            ? { ...parsed.payload }
            : {};
      delete inputPayload._testOverrides;
      if (inputPayload.confirm === undefined && parsed?.confirm !== undefined) inputPayload.confirm = parsed.confirm;
      if (inputPayload.purgeData === undefined && parsed?.purgeData !== undefined) inputPayload.purgeData = parsed.purgeData;
      if (inputPayload.force === undefined && parsed?.force !== undefined) inputPayload.force = parsed.force;
      if (inputPayload.manual === undefined && parsed?.manual !== undefined) inputPayload.manual = parsed.manual;
      if (inputPayload.channel === undefined && parsed?.channel !== undefined) inputPayload.channel = parsed.channel;
      if (inputPayload.updateChannel === undefined && parsed?.updateChannel !== undefined) inputPayload.updateChannel = parsed.updateChannel;
      if (inputPayload.version === undefined && parsed?.version !== undefined) inputPayload.version = parsed.version;
      if (inputPayload.version === undefined && typeof parsed?.input === 'string') inputPayload.version = parsed.input;

      const result = await this.executeRepoAction({ ...inputPayload, action });
      if (reqId !== null) {
        const safeId = Number(reqId) | 0;
        const jsonRes = serializeJsonForEval(result);
        const expr = `(() => {
          if (window.__agPrismRepoBridge && typeof window.__agPrismRepoBridge.resolve === 'function') {
            window.__agPrismRepoBridge.resolve(${safeId}, ${jsonRes});
          } else if (typeof window.__agPrismRepoResolve === 'function') {
            window.__agPrismRepoResolve(${safeId}, ${jsonRes});
          }
        })()`;
        const evalParams = { expression: expr, returnByValue: true };
        if (executionContextId) evalParams.contextId = executionContextId;
        await entry.session.send('Runtime.evaluate', evalParams).catch(() => {});
      }
      return;
    }

    if (name === METRICS_BINDING) {
      if (typeof payload !== 'string' || payload.length > 4096) return;
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }
      const reqId = parsed && Number.isSafeInteger(parsed.id) ? parsed.id : null;
      if (!reqId) return;

      let result;
      if (!this._customMetricsProvider && this._isTelemetryDisabled()) {
        this._releaseIdleTelemetry(true);
        result = {
          connection: 'disabled',
          speed: null,
          groups: [],
        };
      } else {
        this._telemetryInFlight = (this._telemetryInFlight || 0) + 1;
        this._lastTelemetryActivityAt = Date.now();
        try {
          const collector = await this.ensureMetricsCollector();
          result = await collector(parsed.input || {});
        } catch (err) {
          result = {
            connection: 'offline',
            error: err?.message || 'Metrics unavailable',
            speed: null,
            groups: [],
          };
        } finally {
          this._telemetryInFlight = Math.max(0, (this._telemetryInFlight || 1) - 1);
          this._lastTelemetryActivityAt = Date.now();
          if (!this._customMetricsProvider && this._isTelemetryDisabled() && this._telemetryInFlight === 0) {
            this._releaseIdleTelemetry(true);
          }
        }
      }
      const safeId = Number(reqId) | 0;
      const expr = `window.__agPrismMetricsResolve && window.__agPrismMetricsResolve(${safeId}, ${serializeJsonForEval(result)})`;
      const evalParams = { expression: expr, returnByValue: true };
      if (executionContextId) evalParams.contextId = executionContextId;
      await entry.session.send('Runtime.evaluate', evalParams).catch(() => {});
      return;
    }

    if (name === THOUGHT_BINDING) {
      if (typeof payload !== 'string' || payload.length > 131072) return;
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }
      const reqId = parsed && Number.isSafeInteger(parsed.id) ? parsed.id : null;
      if (reqId === null) return;
      const input = parsed?.input && typeof parsed.input === 'object' ? parsed.input : {};
      const action = parsed?.action || input.action || 'get-config';

      let result;
      try {
        const svc = await this.ensureThoughtService();
        if (action === 'get-config') {
          result = svc.getSanitizedConfig();
        } else if (action === 'save-config') {
          result = svc.saveConfig(input);
        } else if (action === 'get-cache') {
          if (typeof svc._ensureCacheLoadedAsync === 'function') {
            await svc._ensureCacheLoadedAsync();
          }
          result = svc.getWarmCacheSnapshot(
            Number(input.limit) > 0 ? Number(input.limit) : 40,
            Number(input.maxChars) > 0 ? Number(input.maxChars) : 80000
          );
        } else if (action === 'cache-stats') {
          if (typeof svc._ensureCacheLoadedAsync === 'function') {
            await svc._ensureCacheLoadedAsync();
          }
          result = svc.getCacheStats();
        } else if (action === 'clear-cache') {
          result = svc.clearCache();
        } else if (action === 'cancel-translate') {
          result = svc.cancelPending(
            input.requestId !== undefined || input.key !== undefined
              ? input
              : parsed?.requestId ?? parsed?.key ?? input
          );
        } else if (action === 'fetch-models') {
          result = await svc.fetchModels(input);
        } else if (action === 'test-connection') {
          result = await svc.testConnection(input);
        } else if (action === 'diagnose') {
          if (typeof svc.diagnose === 'function') {
            result = await svc.diagnose(input);
          } else {
            result = { ok: false, error: 'diagnose_not_supported' };
          }
        } else if (action === 'translate-stream') {
          let lastSent = '';
          let pendingPartial = null;
          let sendingPartial = false;
          const flushPartial = async () => {
            if (sendingPartial) return;
            sendingPartial = true;
            try {
              while (pendingPartial !== null) {
                if (!entry || entry.session.closed) {
                  pendingPartial = null;
                  break;
                }
                const target = pendingPartial;
                pendingPartial = null;
                if (target === lastSent) continue;
                const payload =
                  lastSent.length > 0 && target.startsWith(lastSent)
                    ? { a: target.slice(lastSent.length), o: lastSent.length }
                    : target;
                const safeId = Number(reqId) | 0;
                const chunkExpr = `window.__agPrismThoughtOnChunk && window.__agPrismThoughtOnChunk(${safeId}, ${serializeJsonForEval(payload)})`;
                const chunkParams = { expression: chunkExpr, returnByValue: true };
                if (executionContextId) chunkParams.contextId = executionContextId;
                try {
                  await entry.session.send('Runtime.evaluate', chunkParams);
                  lastSent = target;
                } catch {
                  // Delivery failed: reset cursor so the next chunk resyncs cleanly via full-string reset frame
                  lastSent = '';
                }
              }
            } finally {
              sendingPartial = false;
            }
          };
          result = await svc.translateThought({
            text: input.text || '',
            mode: input.mode || 'ai',
            priority: Number(input.priority || 0),
            requestId: input.requestId ? String(input.requestId) : '',
            force: Boolean(input.force),
            bypassCache: Boolean(input.bypassCache),
            targetLang: input.targetLang || input.lang || '',
            onPartial: (partialText) => {
              if (!entry || entry.session.closed) return;
              pendingPartial = String(partialText || '');
              void flushPartial();
            },
          });
        } else {
          result = { ok: false, error: `Unknown thought action: ${action}` };
        }
      } catch (err) {
        result = { ok: false, error: sanitizeSecretText(err?.message || err) };
      }

      if (!entry.session.closed) {
        const safeId = Number(reqId) | 0;
        const safeJson = serializeJsonForEval(result);
        const payloadExpr = safeJson.length > 4096 ? `JSON.parse(${serializeJsonForEval(safeJson)})` : safeJson;
        const resolveExpr = `window.__agPrismThoughtResolve && window.__agPrismThoughtResolve(${safeId}, ${payloadExpr})`;
        const evalParams = { expression: resolveExpr, returnByValue: true };
        if (executionContextId) evalParams.contextId = executionContextId;
        await entry.session.send('Runtime.evaluate', evalParams).catch(() => {});
      }
      return;
    }

    if (name === USAGE_BINDING) {
      if (typeof payload !== 'string' || payload.length > 65536) return;
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }
      const reqId = parsed && Number.isSafeInteger(parsed.id) ? parsed.id : null;
      if (reqId === null) return;
      this._telemetryInFlight = (this._telemetryInFlight || 0) + 1;
      this._lastTelemetryActivityAt = Date.now();
      let result;
      try {
        const reqScopeKey = typeof parsed.scopeKey === 'string' && parsed.scopeKey.trim() ? parsed.scopeKey.trim() : '';
        result = await this.fetchUsageRollupBatch(parsed.items, {
          action: parsed.action || 'fetch-batch',
          includeSummaries: Boolean(parsed.includeSummaries),
          entry,
          ...(reqScopeKey ? { scopeKey: reqScopeKey } : {}),
        });
      } catch (err) {
        result = { ok: false, error: sanitizeSecretText(err?.message || err), records: [] };
      } finally {
        this._telemetryInFlight = Math.max(0, (this._telemetryInFlight || 1) - 1);
        this._lastTelemetryActivityAt = Date.now();
      }
      if (!entry.session.closed) {
        const safeId = Number(reqId) | 0;
        const resolveExpr = `window.__agPrismUsageResolve && window.__agPrismUsageResolve(${safeId}, ${serializeJsonForEval(result)})`;
        const evalParams = { expression: resolveExpr, returnByValue: true };
        if (executionContextId) evalParams.contextId = executionContextId;
        await entry.session.send('Runtime.evaluate', evalParams).catch(() => {});
      }
      return;
    }

    if (name === INLINE_DIFF_BINDING) {
      const context = typeof executionContextId === 'number' ? entry.contextFrames?.get(executionContextId) : undefined;
      const expectedDocGen = typeof entry.sidebarDocument === 'number' ? entry.sidebarDocument : null;
      const isCurrentContext = () => {
        if (!entry || entry.session?.closed) return false;
        if (entry.sidebarHostVerified !== true) return false;
        if (!this._isTrustedMainFrameBindingCall(entry, executionContextId)) return false;
        if (typeof executionContextId !== 'number' || !context) return false;
        if (context.isDefault !== true || (context.type && context.type !== 'default')) return false;
        if (!entry.mainFrameId || context.frameId !== entry.mainFrameId) return false;
        if (!(entry.contextFrames instanceof Map) || entry.contextFrames.get(executionContextId) !== context) {
          return false;
        }
        if (typeof entry.sidebarDocument === 'number') {
          if (typeof entry.sidebarVerifiedDocument === 'number' && entry.sidebarVerifiedDocument !== entry.sidebarDocument) {
            return false;
          }
          if (expectedDocGen !== null && entry.sidebarDocument !== expectedDocGen) {
            return false;
          }
          if (typeof context.docGen === 'number' && context.docGen !== entry.sidebarDocument) {
            return false;
          }
        }
        if (typeof entry.sidebarHostContextId === 'number' && entry.sidebarHostContextId !== executionContextId) {
          return false;
        }
        return true;
      };
      if (!isCurrentContext()) return;
      if (typeof payload !== 'string') return;
      if (payload.length > INLINE_DIFF_MAX_PAYLOAD_BYTES) return;
      if (Buffer.byteLength(payload, 'utf8') > INLINE_DIFF_MAX_PAYLOAD_BYTES) return;
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      if (!Number.isSafeInteger(parsed.id) || parsed.id < 0) return;
      if (parsed.action !== 'readInlineDiff') return;
      if (typeof parsed.uri !== 'string' || parsed.uri.length > INLINE_DIFF_MAX_URI_LENGTH) return;

      const reqId = serializeJsonForEval(Math.trunc(Number(parsed.id)));
      const hints =
        parsed.hints && typeof parsed.hints === 'object' && !Array.isArray(parsed.hints)
          ? {
              additions: Number.isSafeInteger(parsed.hints.additions) && parsed.hints.additions >= 0 ? parsed.hints.additions : 0,
              deletions: Number.isSafeInteger(parsed.hints.deletions) && parsed.hints.deletions >= 0 ? parsed.hints.deletions : 0,
            }
          : undefined;
      let resp;
      try {
        resp = await readSafeInlineDiff(parsed.uri, hints ? { hints } : {});
      } catch {
        resp = { ok: false, error: 'internal_error' };
      }
      // 异步返回前再次复检文档代际 docGen 与执行上下文仍有效，严防跨导航回注
      if (isCurrentContext()) {
        const resolveExpr = `window.__agPrismInlineDiffResolve?.(${reqId}, ${serializeJsonForEval(resp)})`;
        await entry.session
          .send('Runtime.evaluate', {
            expression: resolveExpr,
            contextId: executionContextId,
            returnByValue: true,
          })
          .catch(() => {});
      }
      return resp;
    }

    if (name === OMNI_BINDING) {
      if (typeof payload !== 'string' || payload.length > 65536) return;
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }
      const reqId = parsed && Number.isSafeInteger(parsed.id) ? parsed.id : null;
      if (reqId === null) return;
      const action = typeof parsed.action === 'string' ? parsed.action : '';
      const mergedParams = {
        ...parsed,
        ...(parsed.params && typeof parsed.params === 'object' ? parsed.params : {}),
        ...(parsed.input && typeof parsed.input === 'object' ? parsed.input : {}),
        ...(parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : {}),
      };
      let result;
      if (!this._isOmniEnabled()) {
        result = { ok: false, error: 'omni_disabled' };
      } else {
        try {
          const srv = await this.ensureOmniServer();
          result = await srv.handleRpcAction(action, mergedParams);
        } catch (err) {
          result = { ok: false, error: sanitizeSecretText(err?.message || err) };
        }
      }
      if (!entry.session.closed) {
        const safeId = Number(reqId) | 0;
        const jsonRes = serializeJsonForEval(result);
        const resolveExpr = `(() => { const r = ${jsonRes}; const b = window.__agPrismOmniBridge; if (b && typeof b.resolve === 'function') b.resolve(${safeId}, r); if (typeof window.__agPrismOmniResolve === 'function' && (!b || window.__agPrismOmniResolve !== b.resolve)) window.__agPrismOmniResolve(${safeId}, r); })()`;
        const evalParams = { expression: resolveExpr, returnByValue: true };
        if (executionContextId) evalParams.contextId = executionContextId;
        await entry.session.send('Runtime.evaluate', evalParams).catch(() => {});
      }
      return;
    }

    if (name === SIDEBAR_BINDING) {
      const context = typeof executionContextId === 'number' ? entry.contextFrames?.get(executionContextId) : undefined;
      const isCurrentHost = () => {
        if (this._sidebarStopped || entry.session.closed || entry.sidebarHostVerified !== true) return false;
        if (!context || context.isDefault !== true || context.type !== 'default') return false;
        if (!entry.mainFrameId || context.frameId !== entry.mainFrameId) return false;
        if (entry.contextFrames.get(executionContextId) !== context) return false;
        if (typeof entry.sidebarDocument === 'number') {
          if (typeof entry.sidebarVerifiedDocument === 'number' && entry.sidebarVerifiedDocument !== entry.sidebarDocument) {
            return false;
          }
          if (typeof context.docGen === 'number' && context.docGen !== entry.sidebarDocument) {
            return false;
          }
        }
        if (typeof entry.sidebarHostContextId === 'number' && entry.sidebarHostContextId !== executionContextId) {
          return false;
        }
        return true;
      };
      if (!isCurrentHost()) return;
      // 关闭态在 JSON.parse 之前直接硬拦截，杜绝关闭态触发解析或拉起后台服务
      if (this.cdp?.readConfig?.()?.sidebarStudio !== 'on') {
        return { ok: false, error: 'Chat Beta is disabled' };
      }
      if (typeof payload !== 'string') return;
      const SIDEBAR_MAX_PAYLOAD_BYTES = 12 * 1024 * 1024;
      if (payload.length > SIDEBAR_MAX_PAYLOAD_BYTES) return;
      const payloadBytes = Buffer.byteLength(payload, 'utf8');
      if (payloadBytes > SIDEBAR_MAX_PAYLOAD_BYTES) return;
      let parsed;
      try { parsed = JSON.parse(payload); } catch { return; }
      if (!parsed || typeof parsed !== 'object' || !Number.isSafeInteger(parsed.id) || parsed.id < 1) return;
      if (parsed.action !== 'import-spark-file' && payloadBytes > 128 * 1024) return;
      const { id, input: _transportCopy, ...request } = parsed;
      const safeId = serializeJsonForEval(Math.trunc(Number(id)));
      const unavailable = { ok: false, error: {
        code: 'CAPABILITY_UNAVAILABLE', message: 'Sidebar Studio service unavailable', retryable: true,
      } };
      let result = unavailable;
      try {
        if (this.cdp?.readConfig?.()?.sidebarStudio === 'on') {
          const svc = await this.ensureSidebarService();
          if (!isCurrentHost()) return;
          if (typeof svc?.handleRpc === 'function') result = await svc.handleRpc(request);
        } else {
          result = { ok: false, error: 'Chat Beta is disabled' };
        }
      } catch {
        // 异常不把宿主栈、命令参数或本地路径回传到渲染进程。
      }
      if (isCurrentHost()) {
        const jsonRes = serializeJsonForEval(result);
        const resolveExpr = `(() => { const r = ${jsonRes}; const b = window.__agPrismSidebarBridge; if (b && typeof b.resolve === 'function') b.resolve(${safeId}, r); if (typeof window.__agPrismSidebarResolve === 'function' && (!b || window.__agPrismSidebarResolve !== b.resolve)) window.__agPrismSidebarResolve(${safeId}, r); })()`;
        const evalParams = { expression: resolveExpr, returnByValue: true };
        if (executionContextId) evalParams.contextId = executionContextId;
        await entry.session.send('Runtime.evaluate', evalParams).catch(() => {});
      }
      return result;
    }

    const activeWallpaperBinding = this.cdp?.WALLPAPER_BINDING || WALLPAPER_BINDING;
    if (name === WALLPAPER_BINDING || name === activeWallpaperBinding) {
      const context = typeof executionContextId === 'number' ? entry.contextFrames?.get(executionContextId) : undefined;
      const expectedDocGen = typeof entry.sidebarDocument === 'number' ? entry.sidebarDocument : null;
      const hasTrackedFrames = Boolean(
        entry.hasFrameTree || entry.mainFrameId || (entry.contextFrames instanceof Map && entry.contextFrames.size > 0)
      );
      const isCurrentContext = () => {
        if (this._wallpaperStopped || !entry || entry.session?.closed) return false;
        if (entry.sidebarHostVerified !== true) return false;
        if (!this._isTrustedMainFrameBindingCall(entry, executionContextId)) return false;
        if (hasTrackedFrames) {
          if (typeof executionContextId !== 'number' || !context) return false;
          if (context.isDefault !== true || (context.type && context.type !== 'default')) return false;
          if (!entry.mainFrameId || context.frameId !== entry.mainFrameId) return false;
          if (!(entry.contextFrames instanceof Map) || entry.contextFrames.get(executionContextId) !== context) {
            return false;
          }
          if (typeof entry.sidebarDocument === 'number') {
            if (typeof entry.sidebarVerifiedDocument === 'number' && entry.sidebarVerifiedDocument !== entry.sidebarDocument) {
              return false;
            }
            if (expectedDocGen !== null && entry.sidebarDocument !== expectedDocGen) {
              return false;
            }
            if (typeof context.docGen === 'number' && context.docGen !== entry.sidebarDocument) {
              return false;
            }
          }
          if (typeof entry.sidebarHostContextId === 'number' && entry.sidebarHostContextId !== executionContextId) {
            return false;
          }
        } else {
          if (!isAutomatedTestRuntime()) return false;
        }
        return true;
      };
      if (!isCurrentContext()) return;
      if (typeof payload !== 'string') return;
      if (payload.length > WALLPAPER_MAX_PAYLOAD_BYTES) return;
      if (Buffer.byteLength(payload, 'utf8') > WALLPAPER_MAX_PAYLOAD_BYTES) return;
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      const reqId = Number.isSafeInteger(parsed.id) && parsed.id >= 0 ? parsed.id : null;
      if (reqId === null) return;
      const action = typeof parsed.action === 'string' ? parsed.action.trim() : '';
      if (!WALLPAPER_ALLOWED_ACTIONS.has(action)) {
        const errRes = { ok: false, error: `Unknown wallpaper action: ${action || 'empty'}` };
        if (isCurrentContext()) {
          const safeId = Number(reqId) | 0;
          const resolveExpr = `(() => { const r = ${serializeJsonForEval(errRes)}; if (typeof window.__agPrismWallpaperResolve === 'function') window.__agPrismWallpaperResolve(${safeId}, r); else if (window.__agPrismWallpaperBridge && typeof window.__agPrismWallpaperBridge.resolve === 'function') window.__agPrismWallpaperBridge.resolve(${safeId}, r); })()`;
          const evalParams = { expression: resolveExpr, returnByValue: true };
          if (typeof executionContextId === 'number') evalParams.contextId = executionContextId;
          await entry.session.send('Runtime.evaluate', evalParams).catch(() => {});
        }
        return errRes;
      }
      const actionPayload =
        parsed.payload && typeof parsed.payload === 'object' && !Array.isArray(parsed.payload)
          ? parsed.payload
          : parsed.input && typeof parsed.input === 'object' && !Array.isArray(parsed.input)
          ? parsed.input
          : {};

      let result;
      let svc = null;
      try {
        svc = await this.ensureWallpaperService();
        if (!svc || typeof svc.handleAction !== 'function') {
          result = { ok: false, error: 'wallpaper_service_unavailable' };
        } else {
          result = await svc.handleAction(action, actionPayload);
        }
      } catch (err) {
        result = { ok: false, error: sanitizeSecretText(err?.message || err) };
      }

      if (isCurrentContext()) {
        const safeId = Number(reqId) | 0;
        const safeJson = serializeJsonForEval(result);
        const payloadExpr = safeJson.length > 4096 ? `JSON.parse(${serializeJsonForEval(safeJson)})` : safeJson;
        const resolveExpr = `(() => { const r = ${payloadExpr}; if (typeof window.__agPrismWallpaperResolve === 'function') window.__agPrismWallpaperResolve(${safeId}, r); else if (window.__agPrismWallpaperBridge && typeof window.__agPrismWallpaperBridge.resolve === 'function') window.__agPrismWallpaperBridge.resolve(${safeId}, r); })()`;
        const evalParams = { expression: resolveExpr, returnByValue: true };
        if (typeof executionContextId === 'number') evalParams.contextId = executionContextId;
        await entry.session.send('Runtime.evaluate', evalParams).catch(() => {});
      }

      // 多窗口同步：保存/选媒/清除壁纸后向其他合法主窗口广播最新安全配置
      if (
        result &&
        result.ok &&
        (action === 'save-config' || action === 'pick-media' || action === 'clear-media')
      ) {
        let latestCfg = result.config || null;
        if (!latestCfg && svc && typeof svc.getConfigSync === 'function') {
          try {
            latestCfg = svc.getConfigSync();
          } catch {}
        }
        if (latestCfg && typeof latestCfg === 'object') {
          const syncExpr = `window.__agPrismWallpaper?.applyConfig?.(${serializeJsonForEval(latestCfg)})`;
          for (const other of this.sessions.values()) {
            if (!other || other === entry || other.session?.closed || other.wallpaperSkipped) continue;
            if (other.sidebarHostVerified !== true) continue;
            if (typeof other.sidebarHostContextId !== 'number') continue;
            if (
              typeof other.sidebarDocument === 'number' &&
              typeof other.sidebarVerifiedDocument === 'number' &&
              other.sidebarVerifiedDocument !== other.sidebarDocument
            ) {
              continue;
            }
            const otherCtx = other.contextFrames instanceof Map ? other.contextFrames.get(other.sidebarHostContextId) : null;
            if (
              !otherCtx ||
              otherCtx.isDefault !== true ||
              (otherCtx.type && otherCtx.type !== 'default') ||
              !other.mainFrameId ||
              otherCtx.frameId !== other.mainFrameId
            ) {
              continue;
            }
            if (
              typeof other.sidebarDocument === 'number' &&
              typeof otherCtx.docGen === 'number' &&
              otherCtx.docGen !== other.sidebarDocument
            ) {
              continue;
            }
            void other.session
              .send(
                'Runtime.evaluate',
                {
                  expression: syncExpr,
                  contextId: other.sidebarHostContextId,
                  returnByValue: true,
                  awaitPromise: false,
                },
                2000
              )
              .catch(() => {});
          }
        }
      }
      return result;
    }
  }

  async attachTarget(target) {
    const wsUrl = target.webSocketDebuggerUrl;
    if (this.isTargetIgnored(target)) return null;
    if (this.sessions.has(wsUrl)) return this.sessions.get(wsUrl);

    const session = await this.cdp.CdpSession.connect(wsUrl, 3500);
    const entry = {
      wsUrl,
      pageId: target.id,
      url: String(target.url || ''),
      title: target.title || target.url || 'Antigravity',
      detectedScopeKey: '',
      _usageScopeVerified: false,
      session,
      scriptId: null,
      omniScriptId: null,
      sidebarScriptId: null,
      sidebarBindingAdded: false,
      sidebarMounted: false,
      hostI18nScriptId: null,
      hostI18nMounted: false,
      lastHostI18nSig: '',
      lastHostI18nScriptSig: '',
      thoughtScriptId: null,
      thoughtMounted: false,
      lastThoughtSig: '',
      lastThoughtScriptSig: '',
      inlineDiffScriptId: null,
      inlineDiffBindingAdded: false,
      inlineDiffMounted: false,
      inlineDiffSkipped: false,
      lastInlineDiffHash: '',
      lastInlineDiffScriptHash: '',
      wallpaperScriptId: null,
      wallpaperBindingAdded: false,
      wallpaperMounted: false,
      wallpaperSkipped: false,
      lastWallpaperHash: '',
      lastWallpaperScriptHash: '',
      catSanctuaryScriptId: null,
      catSanctuaryMounted: false,
      catSanctuarySkipped: false,
      lastCatSanctuaryHash: '',
      lastCatSanctuaryScriptHash: '',
      effortSliderScriptId: null,
      effortSliderMounted: false,
      effortSliderSkipped: false,
      lastEffortSliderHash: '',
      lastEffortSliderScriptHash: '',
      chatSceneScriptId: null,
      chatSceneMounted: false,
      chatSceneSkipped: false,
      lastChatSceneSig: '',
      lastChatSceneScriptSig: '',
      sidebarHostVerified: false,
      sidebarVerifiedDocument: -1,
      sidebarHostContextId: null,
      sidebarDocument: 0,
      lastOmniExpr: '',
      lastVerifyAt: 0,
      healthyStreak: 0,
      verifyDirty: true,
      lastVerifiedCodeHash: '',
      mainFrameId: null,
      hasFrameTree: false,
      contextFrames: new Map(),
      pendingAckEpoch: 0,
      _healTimer: null,
      _opChain: Promise.resolve(),
    };
    this.sessions.set(wsUrl, entry);

    session.onClose = () => {
      if (entry._healTimer) {
        clearTimeout(entry._healTimer);
        this._managedTimers?.delete(entry._healTimer);
        entry._healTimer = null;
      }
      if (this.sessions.get(wsUrl) === entry) {
        this.sessions.delete(wsUrl);
        if (this.sessions.size === 0 && this._prevAttachedCount > 0) {
          this._disconnectedAllSessions = true;
        }
      }
    };

    try {
      const revokeSidebarHost = () => {
        entry.sidebarHostVerified = false;
        entry.sidebarVerifiedDocument = -1;
        entry.sidebarHostContextId = null;
        entry.sidebarDocument += 1;
        entry.inlineDiffSkipped = false;
        entry.wallpaperSkipped = false;
        entry.catSanctuarySkipped = false;
        entry.effortSliderSkipped = false;
        entry.chatSceneSkipped = false;
      };
      session.on('Runtime.executionContextCreated', (params) => {
        const ctx = params?.context;
        if (!ctx || typeof ctx.id !== 'number') return;
        const aux = ctx.auxData && typeof ctx.auxData === 'object' ? ctx.auxData : {};
        const frameId = typeof aux.frameId === 'string' ? aux.frameId : '';
        const isDefault = aux.isDefault === true;
        const type = typeof aux.type === 'string' && aux.type ? aux.type : (isDefault ? 'default' : '');
        const isMainDefault = Boolean(entry.mainFrameId && frameId === entry.mainFrameId && isDefault && type === 'default');
        if (isMainDefault) {
          // 同帧新建默认上下文时撤销旧文档授权并递增文档代际，防止新上下文继承旧授权
          if (
            entry.sidebarHostVerified ||
            (typeof entry.sidebarHostContextId === 'number' && entry.sidebarHostContextId !== ctx.id)
          ) {
            revokeSidebarHost();
            entry.verifyDirty = true;
            entry.healthyStreak = 0;
          }
        }
        entry.contextFrames.set(ctx.id, {
          frameId,
          isDefault,
          type,
          docGen: entry.sidebarDocument,
        });
      });
      session.on('Runtime.executionContextDestroyed', (params) => {
        if (typeof params?.executionContextId === 'number') {
          const destroyedId = params.executionContextId;
          const destroyedMeta = entry.contextFrames.get(destroyedId);
          entry.contextFrames.delete(destroyedId);
          const wasMainDefault = Boolean(
            destroyedMeta &&
            destroyedMeta.isDefault === true &&
            destroyedMeta.type === 'default' &&
            entry.mainFrameId &&
            destroyedMeta.frameId === entry.mainFrameId
          );
          if (destroyedId === entry.sidebarHostContextId || wasMainDefault) {
            revokeSidebarHost();
            entry.verifyDirty = true;
            entry.healthyStreak = 0;
          }
        }
      });
      session.on('Runtime.executionContextsCleared', () => {
        entry.contextFrames.clear();
        revokeSidebarHost();
        entry.pendingAckEpoch = 0;
      });
      session.on('Page.frameNavigated', (params) => {
        const frame = params?.frame;
        if (frame && !frame.parentId && typeof frame.id === 'string' && frame.id) {
          entry.mainFrameId = frame.id;
          entry.hasFrameTree = true;
          revokeSidebarHost();
          entry.pendingAckEpoch = 0;
          entry.verifyDirty = true;
          entry.healthyStreak = 0;
          if (typeof frame.url === 'string' && frame.url) {
            entry.url = frame.url;
          }
        }
      });
      await session.send('Page.enable');
      await this._ensureMainFrameId(entry, 4500, 1);
      await session.send('Runtime.enable');
      session.on('Runtime.bindingCalled', (params) => {
        void this.handleBindingCall(entry, params || {});
      });
      await session.send('Runtime.addBinding', { name: this.cdp.SETTING_BINDING });
      await session.send('Runtime.addBinding', { name: this.cdp.LEGACY_SETTING_BINDING }).catch(() => {});
      await session.send('Runtime.addBinding', { name: METRICS_BINDING });
      await session.send('Runtime.addBinding', { name: REPO_BINDING });
      await session.send('Runtime.addBinding', { name: THOUGHT_BINDING });
      await session.send('Runtime.addBinding', { name: USAGE_BINDING });
      await session.send('Runtime.addBinding', { name: INLINE_DIFF_BINDING });
      entry.inlineDiffBindingAdded = true;
      if (this._isOmniEnabled()) {
        await session.send('Runtime.addBinding', { name: OMNI_BINDING });
      }
      if (this._isSidebarStudioEnabled()) {
        await session.send('Runtime.addBinding', { name: SIDEBAR_BINDING });
        entry.sidebarBindingAdded = true;
      }

      const healOnNav = () => {
        if (!this.running || entry.session.closed) return;
        entry.verifyDirty = true;
        entry.healthyStreak = 0;
        if (entry._healTimer) {
          clearTimeout(entry._healTimer);
          this._managedTimers?.delete(entry._healTimer);
          entry._healTimer = null;
        }
        const t = setTimeout(() => {
          entry._healTimer = null;
          this._managedTimers?.delete(t);
          if (!this.running || entry.session.closed) return;
          void this.verifyAndHealEntry(entry, true);
        }, 50);
        if (typeof t.unref === 'function') t.unref();
        entry._healTimer = t;
        this._managedTimers?.add(t);
      };
      session.on('Page.domContentLoadedEventFired', healOnNav);
      session.on('Page.loadEventFired', healOnNav);

      const res = await this.applyToEntry(entry);
      if (res && res.status === 'skipped-non-host') {
        this._markTargetIgnored(target, entry.url || target.url);
        session.close();
        this.sessions.delete(wsUrl);
        this.log(`[↷] Ignored non-host target: ${entry.title}`);
        return null;
      }
      this.log(`[✓] Attached & injected Obsidian Prism v${this.cdp.PLUGIN_VERSION}: ${entry.title} (${res?.status || 'ok'})`);
      return entry;
    } catch (err) {
      try {
        if (entry.scriptId) {
          await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId });
        }
        if (entry.omniScriptId) {
          await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId });
        }
        if (entry.sidebarScriptId) {
          await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId });
        }
        if (entry.hostI18nScriptId) {
          await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId });
        }
        if (entry.thoughtScriptId) {
          await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.thoughtScriptId });
          entry.thoughtScriptId = null;
        }
        entry.thoughtMounted = false;
        entry.lastThoughtSig = '';
        entry.lastThoughtScriptSig = '';
        if (entry.inlineDiffScriptId) {
          await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.inlineDiffScriptId });
          entry.inlineDiffScriptId = null;
        }
        entry.inlineDiffMounted = false;
        entry.lastInlineDiffHash = '';
        entry.lastInlineDiffScriptHash = '';
        if (entry.wallpaperScriptId) {
          await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.wallpaperScriptId });
          entry.wallpaperScriptId = null;
        }
        entry.wallpaperMounted = false;
        entry.lastWallpaperHash = '';
        entry.lastWallpaperScriptHash = '';
        if (entry.catSanctuaryScriptId) {
          await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.catSanctuaryScriptId });
          entry.catSanctuaryScriptId = null;
        }
        entry.catSanctuaryMounted = false;
        entry.lastCatSanctuaryHash = '';
        entry.lastCatSanctuaryScriptHash = '';
        if (entry.effortSliderScriptId) {
          await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.effortSliderScriptId });
          entry.effortSliderScriptId = null;
        }
        entry.effortSliderMounted = false;
        entry.lastEffortSliderHash = '';
        entry.lastEffortSliderScriptHash = '';
        if (entry.chatSceneScriptId) {
          await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.chatSceneScriptId });
          entry.chatSceneScriptId = null;
        }
        entry.chatSceneMounted = false;
        entry.lastChatSceneSig = '';
        entry.lastChatSceneScriptSig = '';
      } catch {}
      session.close();
      this.sessions.delete(wsUrl);
      throw err;
    }
  }

  async verifyAndHealEntry(entry, force = false) {
    if (!entry || entry.session.closed) return { alive: false, ready: false, isHostDom: false };
    return this._runEntryExclusive(entry, () => this._verifyAndHealEntryUnlocked(entry, force));
  }

  async _verifyAndHealEntryUnlocked(entry, force = false) {
    if (!entry || entry.session.closed) return { alive: false, ready: false, isHostDom: false };
    const cfg = typeof this.cdp?.readConfig === 'function' ? this.cdp.readConfig() : null;
    const thoughtEnabled = this._isThoughtEnabled(cfg);
    const hasCtxMap = entry.contextFrames instanceof Map;
    const needsBindingHeal = hasCtxMap && (!entry.mainFrameId || !this._hasMainDefaultContext(entry));
    const thoughtNeedsSync = thoughtEnabled
      ? !entry.thoughtScriptId || !entry.thoughtMounted
      : Boolean(entry.thoughtScriptId || entry.thoughtMounted);
    const inlineDiffAvailable = Boolean(this.inlineDiffExpr || this._hasInlineDiffClientFile());
    const inlineDiffNeedsSync = inlineDiffAvailable
      ? !entry.inlineDiffSkipped && (!entry.inlineDiffScriptId || !entry.inlineDiffMounted)
      : Boolean(entry.inlineDiffScriptId || entry.inlineDiffMounted);
    const wallpaperAvailable = Boolean(this.wallpaperExpr || this._hasWallpaperClientFile());
    const wallpaperNeedsSync = wallpaperAvailable
      ? !entry.wallpaperSkipped && (!entry.wallpaperScriptId || !entry.wallpaperMounted)
      : Boolean(entry.wallpaperScriptId || entry.wallpaperMounted);
    const catSanctuaryEnabled =
      this._isCatSanctuaryEnabled(cfg) && Boolean(this.catSanctuaryExpr || this._hasCatSanctuaryClientFile());
    const catSanctuaryNeedsSync = catSanctuaryEnabled
      ? !entry.catSanctuarySkipped && (!entry.catSanctuaryScriptId || !entry.catSanctuaryMounted)
      : Boolean(entry.catSanctuaryScriptId || entry.catSanctuaryMounted);
    const effortSliderEnabled =
      this._isEffortSliderEnabled(cfg) && Boolean(this.effortSliderExpr || this._hasEffortSliderClientFiles());
    const effortSliderNeedsSync = effortSliderEnabled
      ? !entry.effortSliderSkipped && (!entry.effortSliderScriptId || !entry.effortSliderMounted)
      : Boolean(entry.effortSliderScriptId || entry.effortSliderMounted);
    const chatSceneEnabled =
      this._isChatSceneEnabled(cfg) && Boolean(this.chatSceneExpr || this._hasChatSceneClientFile());
    const chatSceneNeedsSync = chatSceneEnabled
      ? !entry.chatSceneSkipped && (!entry.chatSceneScriptId || !entry.chatSceneMounted)
      : Boolean(entry.chatSceneScriptId || entry.chatSceneMounted);
    const now = Date.now();
    const hashMatches = !this.codeHash || entry.lastVerifiedCodeHash === this.codeHash;
    if (
      !force &&
      !needsBindingHeal &&
      !thoughtNeedsSync &&
      !inlineDiffNeedsSync &&
      !wallpaperNeedsSync &&
      !catSanctuaryNeedsSync &&
      !effortSliderNeedsSync &&
      !chatSceneNeedsSync &&
      !entry.verifyDirty &&
      hashMatches &&
      entry.lastVerifyAt > 0 &&
      entry.healthyStreak > 0
    ) {
      const browserLive = Boolean(this.browserSession && !this.browserSession.closed);
      const backoffMs = browserLive
        ? Math.min(45000, 3000 * Math.pow(2, Math.min(4, entry.healthyStreak - 1)))
        : 6000;
      if (now - entry.lastVerifyAt < backoffMs) {
        return { alive: true, ready: true, isHostDom: true, skipped: true };
      }
    }
    try {
      if (!entry.mainFrameId) {
        await this._ensureMainFrameId(entry, 3000, 0);
      }
      if (entry.mainFrameId && hasCtxMap && !this._hasMainDefaultContext(entry)) {
        const lastResyncAt = Number(entry._lastRuntimeResyncAt) || 0;
        if (force || now - lastResyncAt >= 5000) {
          entry._lastRuntimeResyncAt = Date.now();
          await entry.session.send('Runtime.disable', {}, 2000).catch(() => {});
          await entry.session.send('Runtime.enable', {}, 2600).catch(() => {});
          if (entry.sidebarHostVerified === true && entry.sidebarHostContextId == null) {
            entry.sidebarHostContextId = this._findCurrentMainDefaultContextId(entry);
          }
        }
      }
      const probe = await entry.session.evaluate(
        `(() => {
        const root = typeof document !== 'undefined' && document.documentElement;
        if (!root || document.readyState === 'loading') return { ready: false };
        const api = window.__agPrism;
        const isHostDom = Boolean(
          api ||
            (document.body &&
              document.body.classList &&
              (document.body.classList.contains('theme-standalone') || document.body.classList.contains('monaco-workbench'))) ||
            document.querySelector(
              '.agy-shell, .agy-home, [data-testid="aux-pane-split"], [data-testid="conversation-view"], [data-testid="agent-input-box"], [data-testid="model-selector-trigger"], .monaco-workbench'
            )
        );
        const st = api && typeof api.getState === 'function' ? api.getState() : null;
        const telMode = st?.cfg?.telemetryModule || 'auto';
        const omniMode = st?.cfg?.omniModule || 'on';
        const sidebarMode = st?.cfg?.sidebarStudio === 'on' ? 'on' : 'off';
        const needTelCheck = Boolean(api && telMode !== 'off');
        const hasPulseBar = needTelCheck && Boolean(
          (typeof document.getElementById === 'function' &&
            (document.getElementById('ag-prism-pulse-bar') || document.getElementById('ag-pulse-status-bar'))) ||
            document.querySelector('[data-ag-prism-pulse-bar="true"], [data-ag-pulse-bar="true"]')
        );
        const isHome = needTelCheck && !hasPulseBar && Boolean(document.querySelector('.agy-home, [data-testid="home-greeting"]'));
        const hasModelBtn = needTelCheck && !hasPulseBar && !isHome && Boolean(document.querySelector('[data-testid="model-selector-trigger"]'));
        return {
          ready: true,
          isHostDom,
          href: (typeof location !== 'undefined' && location && typeof location.href === 'string') ? location.href : '',
          title: typeof document.title === 'string' ? document.title.slice(0, 200) : '',
          scopeAttr: root.getAttribute('data-ag-prism-scope') || '',
          prismAttr: root.getAttribute('data-ag-prism') || '',
          hasPrism: Boolean(api),
          hasRepoBridge: Boolean(window.__agPrismRepoBridge),
          hasThoughtBridge: Boolean(window.__agPrismThoughtBridge && typeof window.__agPrismThoughtBridge.cacheStats === 'function'),
          hasUsageBridge: Boolean(window.__agPrismUsageBridge && typeof window.__agPrismUsageBridge.listSummaries === 'function'),
          hasOmniBridge: Boolean(window.__agPrismOmniBridge && typeof window.__agPrismOmniBridge.call === 'function'),
          hasOmniServerMeta: Boolean(window.__agPrismOmniServerMeta && window.__agPrismOmniServerMeta.baseUrl && window.__agPrismOmniServerMeta.token),
          hasOmni: Boolean(window.__agPrismOmni),
          omniMode,
          hasSidebarBridge: Boolean(window.__agPrismSidebarBridge && typeof window.__agPrismSidebarBridge.call === 'function'),
          hasSidebar: Boolean(window.__agPrismSidebar),
          sidebarMode,
          hasHostI18n: Boolean(window.__agPrismHostI18n),
          hasThought: Boolean(window.__agPrismThought),
          hasThoughtSettingsUi: Boolean(window.__agPrismThoughtSettingsUi),
          hasInlineDiff: Boolean(window.__agPrismInlineDiff && !window.__agPrismInlineDiff.getDebugState?.()?.destroyed),
          hasWallpaper: Boolean(window.__agPrismWallpaper && !window.__agPrismWallpaper.getDebugState?.()?.destroyed),
          hasWallpaperUi: Boolean(typeof window.__prismMountWallpaperUi === 'function'),
          hasCatSanctuaryFactory: Boolean(typeof (window.__agCatSanctuaryFactory || globalThis.__agCatSanctuaryFactory) === 'function'),
          hasEffortSlider: Boolean((window.__agPrismEffortSlider || globalThis.__agPrismEffortSlider) && typeof (window.__agPrismEffortSlider || globalThis.__agPrismEffortSlider).sync === 'function'),
          hasChatSceneController: Boolean((window.__agChatSceneController || globalThis.__agChatSceneController) && typeof (window.__agChatSceneController || globalThis.__agChatSceneController).sync === 'function'),
          codeHash: (api && api.codeHash) || '',
          hasLegacyCss: Boolean(document.getElementById('ag-claude-style-css')),
          needsDashboardSync: Boolean(api && telMode !== 'off' && !isHome && hasModelBtn && !hasPulseBar),
        };
      })()`,
        false,
        2600
      );
      if (!probe || !probe.ready) return { alive: true, ready: false, isHostDom: true };
      if (probe.href) entry.url = probe.href;
      if (probe.title) entry.title = probe.title;
      if (probe.scopeAttr) {
        const probedScope = normalizeUsageScopeKey(probe.scopeAttr);
        if (probedScope && probedScope !== 'local') entry.detectedScopeKey = probedScope;
      }
      const omniEnabled = this._isOmniEnabled(cfg) && probe.omniMode !== 'off';
      const hasClientOnDisk = omniEnabled && this._hasOmniClientFile();
      const needsOmniHeal =
        omniEnabled &&
        (!probe.hasOmniBridge ||
          !probe.hasOmniServerMeta ||
          (hasClientOnDisk && !probe.hasOmni));
      const needsOmniCleanup =
        !omniEnabled && Boolean(probe.hasOmni || entry.omniScriptId || entry.lastOmniExpr);
      const sidebarEnabled = this._isSidebarStudioEnabled(cfg);
      const hasSafeSidebarOnDisk = sidebarEnabled && this._hasSafeV2SidebarClientFile();
      const needsSidebarHeal =
        sidebarEnabled && (!probe.hasSidebarBridge || (hasSafeSidebarOnDisk && !probe.hasSidebar));
      const needsSidebarCleanup =
        !sidebarEnabled && Boolean(probe.hasSidebar || entry.sidebarScriptId || entry.sidebarMounted || entry.sidebarBindingAdded);
      const hostI18nEnabled = this._isHostI18nEnabled(cfg);
      const needsHostI18nHeal = hostI18nEnabled && (!probe.hasHostI18n || !entry.hostI18nScriptId);
      const needsHostI18nCleanup =
        !hostI18nEnabled && Boolean(probe.hasHostI18n || entry.hostI18nScriptId || entry.hostI18nMounted);
      const needsThoughtHeal =
        thoughtEnabled &&
        (!probe.hasThought || !probe.hasThoughtSettingsUi || !entry.thoughtScriptId || !entry.thoughtMounted);
      const needsThoughtCleanup =
        !thoughtEnabled &&
        Boolean(probe.hasThought || probe.hasThoughtSettingsUi || entry.thoughtScriptId || entry.thoughtMounted);
      const needsInlineDiffHeal =
        inlineDiffAvailable &&
        !entry.inlineDiffSkipped &&
        (!probe.hasInlineDiff || !entry.inlineDiffScriptId || !entry.inlineDiffMounted);
      const needsInlineDiffCleanup =
        !inlineDiffAvailable && Boolean(probe.hasInlineDiff || entry.inlineDiffScriptId || entry.inlineDiffMounted);
      const needsWallpaperHeal =
        wallpaperAvailable &&
        !entry.wallpaperSkipped &&
        (!probe.hasWallpaper || !probe.hasWallpaperUi || !entry.wallpaperScriptId || !entry.wallpaperMounted);
      const needsWallpaperCleanup =
        !wallpaperAvailable && Boolean(probe.hasWallpaper || probe.hasWallpaperUi || entry.wallpaperScriptId || entry.wallpaperMounted);
      const needsCatSanctuaryHeal =
        catSanctuaryEnabled &&
        !entry.catSanctuarySkipped &&
        (!probe.hasCatSanctuaryFactory || !entry.catSanctuaryScriptId || !entry.catSanctuaryMounted);
      const needsCatSanctuaryCleanup =
        !catSanctuaryEnabled && Boolean(probe.hasCatSanctuaryFactory || entry.catSanctuaryScriptId || entry.catSanctuaryMounted);
      const needsEffortSliderHeal =
        effortSliderEnabled &&
        !entry.effortSliderSkipped &&
        (!probe.hasEffortSlider || !entry.effortSliderScriptId || !entry.effortSliderMounted);
      const needsEffortSliderCleanup =
        !effortSliderEnabled && Boolean(probe.hasEffortSlider || entry.effortSliderScriptId || entry.effortSliderMounted);
      const needsChatSceneHeal =
        chatSceneEnabled &&
        !entry.chatSceneSkipped &&
        (!probe.hasChatSceneController || !entry.chatSceneScriptId || !entry.chatSceneMounted);
      const needsChatSceneCleanup =
        !chatSceneEnabled && Boolean(probe.hasChatSceneController || entry.chatSceneScriptId || entry.chatSceneMounted);
      let healed = false;
      if (
        (entry.sidebarHostVerified === false && probe.isHostDom) ||
        !probe.hasPrism ||
        !probe.hasRepoBridge ||
        !probe.hasThoughtBridge ||
        !probe.hasUsageBridge ||
        probe.prismAttr !== this.cdp.PLUGIN_VERSION ||
        probe.hasLegacyCss ||
        (this.codeHash && probe.codeHash && probe.codeHash !== this.codeHash)
      ) {
        healed = true;
        if (omniEnabled) {
          await this.ensureOmniServer().catch(() => null);
        }
        if (sidebarEnabled) {
          await this.ensureSidebarService().catch(() => null);
        }
        await entry.session.send('Runtime.addBinding', { name: this.cdp.SETTING_BINDING }, 2600).catch(() => {});
        await entry.session.send('Runtime.addBinding', { name: METRICS_BINDING }, 2600).catch(() => {});
        await entry.session.send('Runtime.addBinding', { name: REPO_BINDING }, 2600).catch(() => {});
        await entry.session.send('Runtime.addBinding', { name: THOUGHT_BINDING }, 2600).catch(() => {});
        await entry.session.send('Runtime.addBinding', { name: USAGE_BINDING }, 2600).catch(() => {});
        await this._ensureInlineDiffBinding(entry, 2600, true);
        if (omniEnabled) {
          await entry.session.send('Runtime.addBinding', { name: OMNI_BINDING }, 2600).catch(() => {});
        }
        if (sidebarEnabled) {
          await this._ensureSidebarBinding(entry, 2600, true);
        }
        const sidebarDocument = entry.sidebarDocument;
        const healRes = await entry.session.evaluate(this.injectExpr, false, 4500);
        this._markSidebarHostVerified(entry, sidebarDocument, healRes?.status === 'ok');
        if (healRes && healRes.status === 'skipped-non-host') {
          if (entry.scriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId }).catch(() => {});
            entry.scriptId = null;
          }
          if (entry.omniScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId }).catch(() => {});
            entry.omniScriptId = null;
          }
          if (entry.sidebarScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId }).catch(() => {});
            entry.sidebarScriptId = null;
          }
          if (entry.hostI18nScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId }).catch(() => {});
            entry.hostI18nScriptId = null;
          }
          if (entry.thoughtScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.thoughtScriptId }).catch(() => {});
            entry.thoughtScriptId = null;
          }
          if (entry.inlineDiffScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.inlineDiffScriptId }).catch(() => {});
            entry.inlineDiffScriptId = null;
          }
          if (entry.wallpaperScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.wallpaperScriptId }).catch(() => {});
            entry.wallpaperScriptId = null;
          }
          if (entry.catSanctuaryScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.catSanctuaryScriptId }).catch(() => {});
            entry.catSanctuaryScriptId = null;
          }
          if (entry.effortSliderScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.effortSliderScriptId }).catch(() => {});
            entry.effortSliderScriptId = null;
          }
          if (entry.chatSceneScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.chatSceneScriptId }).catch(() => {});
            entry.chatSceneScriptId = null;
          }
          await this._removeSidebarBinding(entry);
          await this._removeInlineDiffBinding(entry);
          await this._removeWallpaperBinding(entry);
          entry.sidebarMounted = false;
          entry.hostI18nMounted = false;
          entry.lastHostI18nSig = '';
          entry.lastHostI18nScriptSig = '';
          entry.thoughtMounted = false;
          entry.lastThoughtSig = '';
          entry.lastThoughtScriptSig = '';
          entry.inlineDiffMounted = false;
          entry.inlineDiffSkipped = true;
          entry.lastInlineDiffHash = '';
          entry.lastInlineDiffScriptHash = '';
          entry.wallpaperMounted = false;
          entry.wallpaperSkipped = true;
          entry.lastWallpaperHash = '';
          entry.lastWallpaperScriptHash = '';
          entry.catSanctuaryMounted = false;
          entry.catSanctuarySkipped = true;
          entry.lastCatSanctuaryHash = '';
          entry.lastCatSanctuaryScriptHash = '';
          entry.effortSliderMounted = false;
          entry.effortSliderSkipped = true;
          entry.lastEffortSliderHash = '';
          entry.lastEffortSliderScriptHash = '';
          entry.chatSceneMounted = false;
          entry.chatSceneSkipped = true;
          entry.lastChatSceneSig = '';
          entry.lastChatSceneScriptSig = '';
          this._markTargetIgnored({ id: entry.pageId, webSocketDebuggerUrl: entry.wsUrl }, probe.href || entry.url);
          entry.session.close();
          this.sessions.delete(entry.wsUrl);
          this.log(`[↷] Detached & ignored deferred non-host target: ${entry.title}`);
          return { alive: false, ready: true, isHostDom: false };
        }
        if (omniEnabled) {
          if (!this.omniExpr && this.omniServer && typeof this.cdp.buildOmniClientExpression === 'function') {
            const chOpts = this._getChannelCacheOpts(true);
            this.omniExpr = chOpts
              ? this.cdp.buildOmniClientExpression(this.omniServer.getServerInfo(), null, chOpts)
              : this.cdp.buildOmniClientExpression(this.omniServer.getServerInfo());
            if (chOpts && this.running) this._scheduleBundleCacheFlush();
          }
          if (this.omniExpr) {
            if (!entry.omniScriptId) {
              const omniAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.omniExpr })
                .catch(() => null);
              if (omniAdd && omniAdd.identifier) {
                entry.omniScriptId = omniAdd.identifier;
                entry.lastOmniExpr = this.omniExpr;
              }
            }
            await entry.session.evaluate(this.omniExpr, false, 3500).catch(() => {});
          }
        } else if (needsOmniCleanup) {
          if (entry.omniScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId }).catch(() => {});
            entry.omniScriptId = null;
          }
          entry.lastOmniExpr = '';
          await entry.session.evaluate(this._buildOmniCleanupExpression(), false, 3500).catch(() => {});
        }
        if (sidebarEnabled) {
          if (!this.sidebarExpr && typeof this.cdp.buildSidebarStudioExpression === 'function') {
            this.sidebarExpr = this._buildSidebarExprForCurrentClient();
          }
          if (this.sidebarExpr) {
            await entry.session.evaluate(this.sidebarExpr, false, 3500).catch(() => {});
            entry.sidebarMounted = true;
          }
        } else if (needsSidebarCleanup) {
          if (entry.sidebarScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId }).catch(() => {});
            entry.sidebarScriptId = null;
          }
          await this._removeSidebarBinding(entry);
          await entry.session.evaluate(this._buildSidebarCleanupExpression(true), false, 3500).catch(() => {});
          entry.sidebarMounted = false;
        }
        if (hostI18nEnabled) {
          if (!probe.hasHostI18n || !entry.hostI18nScriptId) {
            if (!this.hostI18nExpr && typeof this.cdp.buildHostI18nExpression === 'function') {
              const chOpts = this._getChannelCacheOpts(true);
              this.hostI18nExpr = chOpts
                ? this.cdp.buildHostI18nExpression(cfg, null, chOpts)
                : this.cdp.buildHostI18nExpression(cfg);
              if (chOpts && this.running) this._scheduleBundleCacheFlush();
            }
            if (this.hostI18nExpr) {
              const hiSig = this._getHostI18nCfgSig(cfg);
              if (!entry.hostI18nScriptId) {
                const hiAdd = await entry.session
                  .send('Page.addScriptToEvaluateOnNewDocument', { source: this.hostI18nExpr })
                  .catch(() => null);
                if (hiAdd && hiAdd.identifier) {
                  entry.hostI18nScriptId = hiAdd.identifier;
                  entry.lastHostI18nScriptSig = hiSig;
                }
              }
              if (!probe.hasHostI18n) {
                const evalRes = await entry.session.evaluate(this.hostI18nExpr, false, 4500).catch(() => null);
                if (evalRes && evalRes.ok) {
                  entry.hostI18nMounted = true;
                  entry.lastHostI18nSig = hiSig;
                }
              }
            }
          }
        } else if (needsHostI18nCleanup) {
          if (entry.hostI18nScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId }).catch(() => {});
            entry.hostI18nScriptId = null;
          }
          await entry.session.evaluate(this._getHostI18nCleanupExpression(), false, 3500).catch(() => {});
          entry.hostI18nMounted = false;
          entry.lastHostI18nSig = '';
          entry.lastHostI18nScriptSig = '';
        }
        if (thoughtEnabled) {
          if (!this.thoughtExpr && typeof this.cdp.buildThoughtExpression === 'function') {
            this._buildThoughtExprForConfig(cfg);
          }
          if (this.thoughtExpr) {
            const thoughtSig = this._getThoughtCfgSig(cfg);
            if (!entry.thoughtScriptId) {
              const thoughtAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.thoughtExpr })
                .catch(() => null);
              if (thoughtAdd && thoughtAdd.identifier) {
                entry.thoughtScriptId = thoughtAdd.identifier;
                entry.lastThoughtScriptSig = thoughtSig;
              }
            }
            const evalRes = await entry.session.evaluate(this.thoughtExpr, false, 4500).catch(() => null);
            if (evalRes && evalRes.ok) {
              entry.thoughtMounted = true;
              entry.lastThoughtSig = thoughtSig;
            } else {
              entry.thoughtMounted = false;
              entry.lastThoughtSig = '';
            }
          }
        } else if (needsThoughtCleanup) {
          if (entry.thoughtScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.thoughtScriptId }).catch(() => {});
            entry.thoughtScriptId = null;
          }
          await entry.session.evaluate(this._getThoughtCleanupExpression(), false, 3500).catch(() => {});
          entry.thoughtMounted = false;
          entry.lastThoughtSig = '';
          entry.lastThoughtScriptSig = '';
        }
        if (inlineDiffAvailable) {
          if (!this.inlineDiffExpr && typeof this.cdp.buildInlineDiffInjectExpression === 'function') {
            this._buildInlineDiffExprForConfig(cfg);
          }
          if (this.inlineDiffExpr) {
            const inlineDiffHash = this._getInlineDiffExprHash(this.inlineDiffExpr);
            if (!entry.inlineDiffScriptId) {
              const inlineDiffAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.inlineDiffExpr })
                .catch(() => null);
              if (inlineDiffAdd && inlineDiffAdd.identifier) {
                entry.inlineDiffScriptId = inlineDiffAdd.identifier;
                entry.lastInlineDiffScriptHash = inlineDiffHash;
              }
            }
            const evalRes = await entry.session.evaluate(this.inlineDiffExpr, false, 4500).catch(() => null);
            await this._recordInlineDiffEvalOutcome(entry, evalRes, inlineDiffHash);
          }
        } else if (needsInlineDiffCleanup) {
          if (entry.inlineDiffScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.inlineDiffScriptId }).catch(() => {});
            entry.inlineDiffScriptId = null;
          }
          await entry.session.evaluate(this._getInlineDiffCleanupExpression(), false, 3500).catch(() => {});
          entry.inlineDiffMounted = false;
          entry.inlineDiffSkipped = false;
          entry.lastInlineDiffHash = '';
          entry.lastInlineDiffScriptHash = '';
        }
        if (wallpaperAvailable) {
          await this._ensureWallpaperBinding(entry, 2600, true);
          if (!this.wallpaperExpr && typeof this.cdp.buildWallpaperExpression === 'function') {
            this._buildWallpaperExprForConfig(cfg);
          }
          if (this.wallpaperExpr) {
            const wallpaperHash = this._getWallpaperExprHash(this.wallpaperExpr);
            if (!entry.wallpaperScriptId) {
              const wallpaperAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.wallpaperExpr })
                .catch(() => null);
              if (wallpaperAdd && wallpaperAdd.identifier) {
                entry.wallpaperScriptId = wallpaperAdd.identifier;
                entry.lastWallpaperScriptHash = wallpaperHash;
              }
            }
            const evalRes = await entry.session.evaluate(this.wallpaperExpr, false, 4500).catch(() => null);
            await this._recordWallpaperEvalOutcome(entry, evalRes, wallpaperHash);
          }
        } else if (needsWallpaperCleanup) {
          if (entry.wallpaperScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.wallpaperScriptId }).catch(() => {});
            entry.wallpaperScriptId = null;
          }
          await this._removeWallpaperBinding(entry);
          await entry.session.evaluate(this._getWallpaperCleanupExpression(), false, 3500).catch(() => {});
          entry.wallpaperMounted = false;
          entry.wallpaperSkipped = false;
          entry.lastWallpaperHash = '';
          entry.lastWallpaperScriptHash = '';
        }
        if (catSanctuaryEnabled) {
          if (!this.catSanctuaryExpr && typeof this.cdp.buildCatSanctuaryExpression === 'function') {
            this._buildCatSanctuaryExprForConfig(cfg);
          }
          if (this.catSanctuaryExpr) {
            const catSanctuaryHash = this._getCatSanctuaryExprHash(this.catSanctuaryExpr);
            if (!entry.catSanctuaryScriptId) {
              const catSanctuaryAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.catSanctuaryExpr })
                .catch(() => null);
              if (catSanctuaryAdd && catSanctuaryAdd.identifier) {
                entry.catSanctuaryScriptId = catSanctuaryAdd.identifier;
                entry.lastCatSanctuaryScriptHash = catSanctuaryHash;
              }
            }
            const evalRes = await entry.session.evaluate(this.catSanctuaryExpr, false, 4500).catch(() => null);
            this._recordCatSanctuaryEvalOutcome(entry, evalRes, catSanctuaryHash);
          }
        } else if (needsCatSanctuaryCleanup) {
          if (entry.catSanctuaryScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.catSanctuaryScriptId }).catch(() => {});
            entry.catSanctuaryScriptId = null;
          }
          await entry.session.evaluate(this._getCatSanctuaryCleanupExpression(), false, 3500).catch(() => {});
          entry.catSanctuaryMounted = false;
          entry.catSanctuarySkipped = false;
          entry.lastCatSanctuaryHash = '';
          entry.lastCatSanctuaryScriptHash = '';
        }
        if (effortSliderEnabled) {
          if (!this.effortSliderExpr && typeof this.cdp.buildEffortSliderExpression === 'function') {
            this._buildEffortSliderExprForConfig(cfg);
          }
          if (this.effortSliderExpr) {
            const effortSliderHash = this._getEffortSliderExprHash(this.effortSliderExpr);
            if (!entry.effortSliderScriptId) {
              const effortSliderAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.effortSliderExpr })
                .catch(() => null);
              if (effortSliderAdd && effortSliderAdd.identifier) {
                entry.effortSliderScriptId = effortSliderAdd.identifier;
                entry.lastEffortSliderScriptHash = effortSliderHash;
              }
            }
            const evalRes = await entry.session.evaluate(this.effortSliderExpr, false, 4500).catch(() => null);
            this._recordEffortSliderEvalOutcome(entry, evalRes, effortSliderHash);
          }
        } else if (needsEffortSliderCleanup) {
          if (entry.effortSliderScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.effortSliderScriptId }).catch(() => {});
            entry.effortSliderScriptId = null;
          }
          await entry.session.evaluate(this._getEffortSliderCleanupExpression(), false, 3500).catch(() => {});
          entry.effortSliderMounted = false;
          entry.effortSliderSkipped = false;
          entry.lastEffortSliderHash = '';
          entry.lastEffortSliderScriptHash = '';
        }
        if (chatSceneEnabled) {
          if (!this.chatSceneExpr && typeof this.cdp.buildChatSceneExpression === 'function') {
            this._buildChatSceneExprForConfig(cfg);
          }
          if (this.chatSceneExpr) {
            const chatSceneSig = this._getChatSceneCfgSig(cfg, this.chatSceneExpr);
            if (!entry.chatSceneScriptId) {
              const chatSceneAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.chatSceneExpr })
                .catch(() => null);
              if (chatSceneAdd && chatSceneAdd.identifier) {
                entry.chatSceneScriptId = chatSceneAdd.identifier;
                entry.lastChatSceneScriptSig = chatSceneSig;
              }
            }
            const evalRes = await entry.session.evaluate(this.chatSceneExpr, false, 4500).catch(() => null);
            this._recordChatSceneEvalOutcome(entry, evalRes, chatSceneSig);
          }
        } else if (needsChatSceneCleanup) {
          if (entry.chatSceneScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.chatSceneScriptId }).catch(() => {});
            entry.chatSceneScriptId = null;
          }
          await entry.session.evaluate(this._getChatSceneCleanupExpression(), false, 3500).catch(() => {});
          entry.chatSceneMounted = false;
          entry.chatSceneSkipped = false;
          entry.lastChatSceneSig = '';
          entry.lastChatSceneScriptSig = '';
        }
        this.log(`[↻] Hot-healed window to Obsidian Prism v${this.cdp.PLUGIN_VERSION}: ${entry.title}`);
      } else {
        if (needsOmniHeal) {
          healed = true;
          await this.ensureOmniServer().catch(() => null);
          await entry.session.send('Runtime.addBinding', { name: OMNI_BINDING }, 2600).catch(() => {});
          if (!this.omniExpr && this.omniServer && typeof this.cdp.buildOmniClientExpression === 'function') {
            const chOpts = this._getChannelCacheOpts(true);
            this.omniExpr = chOpts
              ? this.cdp.buildOmniClientExpression(this.omniServer.getServerInfo(), null, chOpts)
              : this.cdp.buildOmniClientExpression(this.omniServer.getServerInfo());
            if (chOpts && this.running) this._scheduleBundleCacheFlush();
          }
          if (this.omniExpr) {
            if (!entry.omniScriptId) {
              const omniAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.omniExpr })
                .catch(() => null);
              if (omniAdd && omniAdd.identifier) {
                entry.omniScriptId = omniAdd.identifier;
                entry.lastOmniExpr = this.omniExpr;
              }
            }
            await entry.session.evaluate(this.omniExpr, false, 3500).catch(() => {});
          }
        } else if (needsOmniCleanup) {
          healed = true;
          if (entry.omniScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId }).catch(() => {});
            entry.omniScriptId = null;
          }
          entry.lastOmniExpr = '';
          await entry.session.evaluate(this._buildOmniCleanupExpression(), false, 3500).catch(() => {});
        }
        if (needsSidebarHeal) {
          healed = true;
          await this.ensureSidebarService().catch(() => null);
          await this._ensureSidebarBinding(entry, 2600, true);
          if (!this.sidebarExpr && typeof this.cdp.buildSidebarStudioExpression === 'function') {
            this.sidebarExpr = this._buildSidebarExprForCurrentClient();
          }
          if (this.sidebarExpr) {
            await entry.session.evaluate(this.sidebarExpr, false, 3500).catch(() => {});
            entry.sidebarMounted = true;
          }
        } else if (needsSidebarCleanup) {
          healed = true;
          if (entry.sidebarScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId }).catch(() => {});
            entry.sidebarScriptId = null;
          }
          await this._removeSidebarBinding(entry);
          await entry.session.evaluate(this._buildSidebarCleanupExpression(true), false, 3500).catch(() => {});
          entry.sidebarMounted = false;
        }
        if (needsHostI18nHeal) {
          healed = true;
          if (!this.hostI18nExpr && typeof this.cdp.buildHostI18nExpression === 'function') {
            const chOpts = this._getChannelCacheOpts(true);
            this.hostI18nExpr = chOpts
              ? this.cdp.buildHostI18nExpression(cfg, null, chOpts)
              : this.cdp.buildHostI18nExpression(cfg);
            if (chOpts && this.running) this._scheduleBundleCacheFlush();
          }
          if (this.hostI18nExpr) {
            const hiSig = this._getHostI18nCfgSig(cfg);
            if (!entry.hostI18nScriptId) {
              const hiAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.hostI18nExpr })
                .catch(() => null);
              if (hiAdd && hiAdd.identifier) {
                entry.hostI18nScriptId = hiAdd.identifier;
                entry.lastHostI18nScriptSig = hiSig;
              }
            }
            if (!probe.hasHostI18n) {
              const evalRes = await entry.session.evaluate(this.hostI18nExpr, false, 4500).catch(() => null);
              if (evalRes && evalRes.ok) {
                entry.hostI18nMounted = true;
                entry.lastHostI18nSig = hiSig;
              }
            }
          }
        } else if (needsHostI18nCleanup) {
          healed = true;
          if (entry.hostI18nScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId }).catch(() => {});
            entry.hostI18nScriptId = null;
          }
          await entry.session.evaluate(this._getHostI18nCleanupExpression(), false, 3500).catch(() => {});
          entry.hostI18nMounted = false;
          entry.lastHostI18nSig = '';
          entry.lastHostI18nScriptSig = '';
        }
        if (needsThoughtHeal) {
          healed = true;
          await entry.session.send('Runtime.addBinding', { name: THOUGHT_BINDING }, 2600).catch(() => {});
          if (!this.thoughtExpr && typeof this.cdp.buildThoughtExpression === 'function') {
            this._buildThoughtExprForConfig(cfg);
          }
          if (this.thoughtExpr) {
            const thoughtSig = this._getThoughtCfgSig(cfg);
            if (!entry.thoughtScriptId) {
              const thoughtAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.thoughtExpr })
                .catch(() => null);
              if (thoughtAdd && thoughtAdd.identifier) {
                entry.thoughtScriptId = thoughtAdd.identifier;
                entry.lastThoughtScriptSig = thoughtSig;
              }
            }
            if (!probe.hasThought || !probe.hasThoughtSettingsUi || !entry.thoughtMounted) {
              const evalRes = await entry.session.evaluate(this.thoughtExpr, false, 4500).catch(() => null);
              if (evalRes && evalRes.ok) {
                entry.thoughtMounted = true;
                entry.lastThoughtSig = thoughtSig;
              }
            }
          }
        } else if (needsThoughtCleanup) {
          healed = true;
          if (entry.thoughtScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.thoughtScriptId }).catch(() => {});
            entry.thoughtScriptId = null;
          }
          await entry.session.evaluate(this._getThoughtCleanupExpression(), false, 3500).catch(() => {});
          entry.thoughtMounted = false;
          entry.lastThoughtSig = '';
          entry.lastThoughtScriptSig = '';
        }
        if (needsInlineDiffHeal) {
          healed = true;
          await this._ensureInlineDiffBinding(entry, 2600, true);
          if (!this.inlineDiffExpr && typeof this.cdp.buildInlineDiffInjectExpression === 'function') {
            this._buildInlineDiffExprForConfig(cfg);
          }
          if (this.inlineDiffExpr) {
            const inlineDiffHash = this._getInlineDiffExprHash(this.inlineDiffExpr);
            if (!entry.inlineDiffScriptId) {
              const inlineDiffAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.inlineDiffExpr })
                .catch(() => null);
              if (inlineDiffAdd && inlineDiffAdd.identifier) {
                entry.inlineDiffScriptId = inlineDiffAdd.identifier;
                entry.lastInlineDiffScriptHash = inlineDiffHash;
              }
            }
            if (!probe.hasInlineDiff || !entry.inlineDiffMounted) {
              const evalRes = await entry.session.evaluate(this.inlineDiffExpr, false, 4500).catch(() => null);
              await this._recordInlineDiffEvalOutcome(entry, evalRes, inlineDiffHash);
            }
          }
        } else if (needsInlineDiffCleanup) {
          healed = true;
          if (entry.inlineDiffScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.inlineDiffScriptId }).catch(() => {});
            entry.inlineDiffScriptId = null;
          }
          await entry.session.evaluate(this._getInlineDiffCleanupExpression(), false, 3500).catch(() => {});
          entry.inlineDiffMounted = false;
          entry.inlineDiffSkipped = false;
          entry.lastInlineDiffHash = '';
          entry.lastInlineDiffScriptHash = '';
        }
        if (needsWallpaperHeal) {
          healed = true;
          await this._ensureWallpaperBinding(entry, 2600, true);
          if (!this.wallpaperExpr && typeof this.cdp.buildWallpaperExpression === 'function') {
            this._buildWallpaperExprForConfig(cfg);
          }
          if (this.wallpaperExpr) {
            const wallpaperHash = this._getWallpaperExprHash(this.wallpaperExpr);
            if (!entry.wallpaperScriptId) {
              const wallpaperAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.wallpaperExpr })
                .catch(() => null);
              if (wallpaperAdd && wallpaperAdd.identifier) {
                entry.wallpaperScriptId = wallpaperAdd.identifier;
                entry.lastWallpaperScriptHash = wallpaperHash;
              }
            }
            if (!probe.hasWallpaper || !probe.hasWallpaperUi || !entry.wallpaperMounted) {
              const evalRes = await entry.session.evaluate(this.wallpaperExpr, false, 4500).catch(() => null);
              await this._recordWallpaperEvalOutcome(entry, evalRes, wallpaperHash);
            }
          }
        } else if (needsWallpaperCleanup) {
          healed = true;
          if (entry.wallpaperScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.wallpaperScriptId }).catch(() => {});
            entry.wallpaperScriptId = null;
          }
          await this._removeWallpaperBinding(entry);
          await entry.session.evaluate(this._getWallpaperCleanupExpression(), false, 3500).catch(() => {});
          entry.wallpaperMounted = false;
          entry.wallpaperSkipped = false;
          entry.lastWallpaperHash = '';
          entry.lastWallpaperScriptHash = '';
        }
        if (needsCatSanctuaryHeal) {
          healed = true;
          if (!this.catSanctuaryExpr && typeof this.cdp.buildCatSanctuaryExpression === 'function') {
            this._buildCatSanctuaryExprForConfig(cfg);
          }
          if (this.catSanctuaryExpr) {
            const catSanctuaryHash = this._getCatSanctuaryExprHash(this.catSanctuaryExpr);
            if (!entry.catSanctuaryScriptId) {
              const catSanctuaryAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.catSanctuaryExpr })
                .catch(() => null);
              if (catSanctuaryAdd && catSanctuaryAdd.identifier) {
                entry.catSanctuaryScriptId = catSanctuaryAdd.identifier;
                entry.lastCatSanctuaryScriptHash = catSanctuaryHash;
              }
            }
            if (!probe.hasCatSanctuaryFactory || !entry.catSanctuaryMounted) {
              const evalRes = await entry.session.evaluate(this.catSanctuaryExpr, false, 4500).catch(() => null);
              this._recordCatSanctuaryEvalOutcome(entry, evalRes, catSanctuaryHash);
            }
          }
        } else if (needsCatSanctuaryCleanup) {
          healed = true;
          if (entry.catSanctuaryScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.catSanctuaryScriptId }).catch(() => {});
            entry.catSanctuaryScriptId = null;
          }
          await entry.session.evaluate(this._getCatSanctuaryCleanupExpression(), false, 3500).catch(() => {});
          entry.catSanctuaryMounted = false;
          entry.catSanctuarySkipped = false;
          entry.lastCatSanctuaryHash = '';
          entry.lastCatSanctuaryScriptHash = '';
        }
        if (needsEffortSliderHeal) {
          healed = true;
          if (!this.effortSliderExpr && typeof this.cdp.buildEffortSliderExpression === 'function') {
            this._buildEffortSliderExprForConfig(cfg);
          }
          if (this.effortSliderExpr) {
            const effortSliderHash = this._getEffortSliderExprHash(this.effortSliderExpr);
            if (!entry.effortSliderScriptId) {
              const effortSliderAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.effortSliderExpr })
                .catch(() => null);
              if (effortSliderAdd && effortSliderAdd.identifier) {
                entry.effortSliderScriptId = effortSliderAdd.identifier;
                entry.lastEffortSliderScriptHash = effortSliderHash;
              }
            }
            if (!probe.hasEffortSlider || !entry.effortSliderMounted) {
              const evalRes = await entry.session.evaluate(this.effortSliderExpr, false, 4500).catch(() => null);
              this._recordEffortSliderEvalOutcome(entry, evalRes, effortSliderHash);
            }
          }
        } else if (needsEffortSliderCleanup) {
          healed = true;
          if (entry.effortSliderScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.effortSliderScriptId }).catch(() => {});
            entry.effortSliderScriptId = null;
          }
          await entry.session.evaluate(this._getEffortSliderCleanupExpression(), false, 3500).catch(() => {});
          entry.effortSliderMounted = false;
          entry.effortSliderSkipped = false;
          entry.lastEffortSliderHash = '';
          entry.lastEffortSliderScriptHash = '';
        }
        if (needsChatSceneHeal) {
          healed = true;
          if (!this.chatSceneExpr && typeof this.cdp.buildChatSceneExpression === 'function') {
            this._buildChatSceneExprForConfig(cfg);
          }
          if (this.chatSceneExpr) {
            const chatSceneSig = this._getChatSceneCfgSig(cfg, this.chatSceneExpr);
            if (!entry.chatSceneScriptId) {
              const chatSceneAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.chatSceneExpr })
                .catch(() => null);
              if (chatSceneAdd && chatSceneAdd.identifier) {
                entry.chatSceneScriptId = chatSceneAdd.identifier;
                entry.lastChatSceneScriptSig = chatSceneSig;
              }
            }
            if (!probe.hasChatSceneController || !entry.chatSceneMounted) {
              const evalRes = await entry.session.evaluate(this.chatSceneExpr, false, 4500).catch(() => null);
              this._recordChatSceneEvalOutcome(entry, evalRes, chatSceneSig);
            }
          }
        } else if (needsChatSceneCleanup) {
          healed = true;
          if (entry.chatSceneScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.chatSceneScriptId }).catch(() => {});
            entry.chatSceneScriptId = null;
          }
          await entry.session.evaluate(this._getChatSceneCleanupExpression(), false, 3500).catch(() => {});
          entry.chatSceneMounted = false;
          entry.chatSceneSkipped = false;
          entry.lastChatSceneSig = '';
          entry.lastChatSceneScriptSig = '';
        }
        if (probe.needsDashboardSync) {
          healed = true;
          await entry.session
            .evaluate(
              `(() => {
                const cfg = window.__agPrism?.getState?.()?.cfg || {};
                window.__agPrismTelemetry?.sync?.(cfg);
                window.__agPrism?.sync?.();
                return true;
              })()`,
              false,
              2200
            )
            .catch(() => {});
        }
      }
      entry.lastVerifyAt = Date.now();
      entry.verifyDirty = false;
      entry.lastVerifiedCodeHash = this.codeHash || '';
      entry.healthyStreak = healed ? 0 : Math.min(8, (entry.healthyStreak || 0) + 1);
      return { alive: true, ready: true, isHostDom: Boolean(probe.isHostDom), href: probe.href || '' };
    } catch {
      entry.session.close();
      this.sessions.delete(entry.wsUrl);
      return { alive: false, ready: false, isHostDom: false };
    }
  }

  closeBrowserDiscovery() {
    this._browserDiscoverySubscribed = false;
    this._lastListPagesAt = 0;
    if (this._discoverTimer) {
      clearTimeout(this._discoverTimer);
      this._discoverTimer = null;
    }
    if (this.browserSession) {
      const bs = this.browserSession;
      this.browserSession = null;
      this.browserPort = null;
      try {
        bs.close();
      } catch {}
    }
  }

  scheduleImmediateTick(delayMs = 45) {
    if (!this.running) return;
    if (this.busy) {
      this._pendingTick = true;
      return;
    }
    if (this._discoverTimer) clearTimeout(this._discoverTimer);
    this._discoverTimer = setTimeout(() => {
      this._discoverTimer = null;
      if (this.running) void this.tick();
    }, delayMs);
    if (this._discoverTimer && typeof this._discoverTimer.unref === 'function') {
      this._discoverTimer.unref();
    }
  }

  async ensureBrowserDiscovery(port) {
    if (!this.running || !port || typeof this.cdp.getBrowserWsUrl !== 'function') return;
    if (this.browserSession && !this.browserSession.closed && this.browserPort === port) return;
    this.closeBrowserDiscovery();
    try {
      const browserWs = await this.cdp.getBrowserWsUrl(port);
      if (!browserWs || !this.running) return;
      const bSession = await this.cdp.CdpSession.connect(browserWs, 1800);
      if (!this.running) {
        bSession.close();
        return;
      }
      this.browserSession = bSession;
      this.browserPort = port;
      this._browserDiscoverySubscribed = false;
      bSession.onClose = () => {
        if (this.browserSession === bSession) {
          this.browserSession = null;
          this.browserPort = null;
          this._browserDiscoverySubscribed = false;
          this._lastListPagesAt = 0;
        }
      };
      const onTargetEvent = (params) => {
        const info = params?.targetInfo;
        if (!info || info.type !== 'page') return;
        const tid = info.targetId || info.id || '';
        // If this page is already attached and healthy, only mark it dirty on URL shift rather than waking all pages
        for (const existing of this.sessions.values()) {
          if (tid && existing.pageId === tid) {
            if (typeof info.title === 'string' && info.title && info.title !== existing.title) {
              existing.title = info.title;
              const titleScope = extractScopeKeyFromTitle(info.title);
              if (titleScope && titleScope !== existing.detectedScopeKey) {
                existing.detectedScopeKey = titleScope;
                existing._usageScopeVerified = false;
              }
            }
            if (typeof info.url === 'string' && info.url && info.url !== existing.url) {
              existing.url = info.url;
              existing.detectedScopeKey = '';
              existing._usageScopeVerified = false;
              existing.verifyDirty = true;
              existing.healthyStreak = 0;
              this.scheduleImmediateTick(45);
            }
            return;
          }
        }
        if (!this._isEligibleDaemonTarget({ ...info, id: tid, webSocketDebuggerUrl: 'ws://check' })) return;
        this._forceListPagesNextTick = true;
        this.scheduleImmediateTick(45);
      };
      bSession.on('Target.targetCreated', onTargetEvent);
      bSession.on('Target.targetInfoChanged', onTargetEvent);
      const subOk = await bSession
        .send('Target.setDiscoverTargets', { discover: true }, 1500)
        .then(() => true)
        .catch(() => false);
      if (this.browserSession === bSession && !bSession.closed && subOk) {
        this._browserDiscoverySubscribed = true;
      }
    } catch {}
  }

  async detachAll(cleanPageDom = false) {
    this.closeBrowserDiscovery();
    const entries = [...this.sessions.values()];
    await Promise.allSettled(
      entries.map(async (entry) => {
        try {
          if (entry.scriptId && !entry.session.closed) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId }).catch(() => {});
          }
          if (entry.omniScriptId && !entry.session.closed) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId }).catch(() => {});
          }
          if (entry.sidebarScriptId && !entry.session.closed) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId }).catch(() => {});
          }
          if (entry.hostI18nScriptId && !entry.session.closed) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId }).catch(() => {});
          }
          if (entry.thoughtScriptId && !entry.session.closed) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.thoughtScriptId }).catch(() => {});
          }
          entry.thoughtScriptId = null;
          entry.thoughtMounted = false;
          entry.lastThoughtSig = '';
          entry.lastThoughtScriptSig = '';
          if (entry.inlineDiffScriptId && !entry.session.closed) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.inlineDiffScriptId }).catch(() => {});
          }
          entry.inlineDiffScriptId = null;
          entry.inlineDiffMounted = false;
          entry.lastInlineDiffHash = '';
          entry.lastInlineDiffScriptHash = '';
          if (entry.wallpaperScriptId && !entry.session.closed) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.wallpaperScriptId }).catch(() => {});
          }
          await this._removeWallpaperBinding(entry);
          entry.wallpaperBindingAdded = false;
          entry.wallpaperScriptId = null;
          entry.wallpaperMounted = false;
          entry.lastWallpaperHash = '';
          entry.lastWallpaperScriptHash = '';
          if (entry.catSanctuaryScriptId && !entry.session.closed) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.catSanctuaryScriptId }).catch(() => {});
          }
          entry.catSanctuaryScriptId = null;
          entry.catSanctuaryMounted = false;
          entry.lastCatSanctuaryHash = '';
          entry.lastCatSanctuaryScriptHash = '';
          if (entry.effortSliderScriptId && !entry.session.closed) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.effortSliderScriptId }).catch(() => {});
          }
          entry.effortSliderScriptId = null;
          entry.effortSliderMounted = false;
          entry.lastEffortSliderHash = '';
          entry.lastEffortSliderScriptHash = '';
          if (entry.chatSceneScriptId && !entry.session.closed) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.chatSceneScriptId }).catch(() => {});
          }
          entry.chatSceneScriptId = null;
          entry.chatSceneMounted = false;
          entry.lastChatSceneSig = '';
          entry.lastChatSceneScriptSig = '';
          if (cleanPageDom && !entry.session.closed) {
            await entry.session.evaluate(this.cdp.REMOVE_EXPRESSION).catch(() => {});
          }
        } catch {}
        entry.session.close();
      })
    );
    this.sessions.clear();
  }

  _isRelaunchGuardAllowed() {
    if (this._relaunchHooks) return true;
    if (isAutomatedTestRuntime()) return false;
    if (process.env.PRISM_NO_RELAUNCH_PROMPT === '1') return false;
    if (this.overridePort) return false;
    return true;
  }

  _readDiskRawConfig() {
    try {
      const cfgPath = path.join(this.rootDir, 'config.json');
      if (!fs.existsSync(cfgPath)) return {};
      return JSON.parse(fs.readFileSync(cfgPath, 'utf8')) || {};
    } catch {
      return {};
    }
  }

  _resetShortcutBackoff(reason = '') {
    const hadBackoff = Boolean(this._shortcutAllClean || this._lastShortcutCheckAt > 0);
    this._shortcutAllClean = false;
    this._lastShortcutCheckAt = 0;
    if (reason && hadBackoff) {
      this.log(`[shortcut-guard] Reset shortcut backoff (${reason})`);
    }
  }

  _maybeSyncShortcuts(force = false, opts = null) {
    if (!this._isRelaunchGuardAllowed()) return null;
    if (process.env.PRISM_DISABLE_SHORTCUT_SYNC === '1' && !this._relaunchHooks?.syncShortcuts) return null;
    if (this._shortcutSyncInFlight) {
      if (force) this._shortcutForcePending = true;
      return null;
    }
    const now = Date.now();
    const hasActivePort =
      opts && typeof opts.hasActivePort === 'boolean' ? opts.hasActivePort : Boolean(this._hasActiveCdpPort);
    const effectiveIntervalMs =
      this._shortcutAllClean && hasActivePort
        ? this._shortcutBackoffIntervalMs
        : this.shortcutCheckIntervalMs;
    if (!force && this._lastShortcutCheckAt > 0 && now - this._lastShortcutCheckAt < effectiveIntervalMs) {
      return null;
    }
    const onDone = (res) => {
      if (res && !res.error) {
        this._lastShortcutCheckAt = Date.now();
        const patchedLen = Array.isArray(res.patched) ? res.patched.length : 0;
        const skippedLen = Array.isArray(res.skipped) ? res.skipped.length : 0;
        const alreadyLen = Array.isArray(res.alreadySet) ? res.alreadySet.length : 0;
        const matched = Number(res.matched || 0);
        // 全部快捷方式已确认 alreadySet 且无跳过/新修补且当前存在活跃 CDP 端口时，开启智能退避（30~60 分钟）
        this._shortcutAllClean =
          Boolean(hasActivePort) && patchedLen === 0 && skippedLen === 0 && (alreadyLen > 0 || matched === 0);
      } else {
        this._shortcutAllClean = false;
      }
      if (res && Array.isArray(res.patched) && res.patched.length > 0) {
        this.log(`[shortcut-guard] Ensured --remote-debugging-port=0 on ${res.patched.length} shortcut(s)`);
      }
      return res;
    };
    const onFinally = () => {
      this._shortcutSyncInFlight = false;
      if (this._shortcutForcePending && this.running) {
        this._shortcutForcePending = false;
        void this._maybeSyncShortcuts(true);
      }
    };
    try {
      if (typeof this._relaunchHooks?.syncShortcuts === 'function') {
        const res = this._relaunchHooks.syncShortcuts({ pluginDir: this.rootDir });
        if (res && typeof res.then === 'function') {
          this._shortcutSyncInFlight = true;
          return res.then(onDone).catch(() => null).finally(onFinally);
        }
        return onDone(res);
      }
      if (typeof this.cdp.ensureAntigravityShortcutsCdpFlagAsync === 'function') {
        this._shortcutSyncInFlight = true;
        return this.cdp
          .ensureAntigravityShortcutsCdpFlagAsync({ pluginDir: this.rootDir })
          .then(onDone)
          .catch(() => null)
          .finally(onFinally);
      }
      if (typeof this.cdp.ensureAntigravityShortcutsCdpFlag === 'function') {
        return onDone(this.cdp.ensureAntigravityShortcutsCdpFlag({ pluginDir: this.rootDir }));
      }
      return null;
    } catch {
      this._shortcutSyncInFlight = false;
      return null;
    }
  }

  async _handleMissingCdpPort() {
    this._hasActiveCdpPort = false;
    this._shortcutAllClean = false;
    if (!this.running || !this.timer || this._promptInFlight) return;
    if (!this._isRelaunchGuardAllowed()) return;

    const now = Date.now();
    if (this._noPortSinceMs <= 0) {
      this._noPortSinceMs = now;
    }
    this._maybeSyncShortcuts(false, { hasActivePort: false });

    if (now - this._noPortSinceMs < this.noPortRelaunchThresholdMs) {
      return;
    }

    const rawCfg = this._readDiskRawConfig();
    if (rawCfg.autoPromptCdpRelaunch === false) {
      return;
    }

    const detectFn =
      typeof this._relaunchHooks?.detectHost === 'function'
        ? this._relaunchHooks.detectHost
        : typeof this.cdp.detectRunningAntigravityHost === 'function'
        ? () => this.cdp.detectRunningAntigravityHost()
        : null;
    if (!detectFn) return;

    const host = await detectFn();
    if (!this.running) return;
    if (!host || !host.pid) {
      this._noPortSinceMs = Date.now();
      return;
    }

    if (host.pid !== this._lastObservedHostPid) {
      this._lastObservedHostPid = host.pid;
      this._shortcutAllClean = false;
      this._maybeSyncShortcuts(true);
    }

    if (host.hasDebugPortSwitch) {
      return;
    }

    const hostAgeMs = host.startMs > 0 ? Math.max(0, Date.now() - host.startMs) : now - this._noPortSinceMs;
    if (hostAgeMs < this.noPortRelaunchThresholdMs) {
      return;
    }

    const extraDirs = Array.isArray(this._relaunchHooks?.stateExtraDirs) ? this._relaunchHooks.stateExtraDirs : [];
    const alreadyPrompted =
      typeof this.cdp.hasRelaunchBeenPromptedForHost === 'function'
        ? this.cdp.hasRelaunchBeenPromptedForHost(this.rootDir, host.pid, host.startMs, extraDirs)
        : false;
    if (alreadyPrompted) {
      return;
    }

    this._promptInFlight = true;
    try {
      if (typeof this.cdp.recordRelaunchPromptState === 'function') {
        this.cdp.recordRelaunchPromptState(this.rootDir, host.pid, host.startMs, 'prompted', extraDirs);
      }
      this.log(`[relaunch-guard] Host pid=${host.pid} running without CDP port; prompting user once`);
      const lang = rawCfg.language || rawCfg.lang || 'zh-CN';
      const promptFn =
        typeof this._relaunchHooks?.promptUser === 'function'
          ? this._relaunchHooks.promptUser
          : typeof this.cdp.promptUserForHostRelaunch === 'function'
          ? (o) => this.cdp.promptUserForHostRelaunch(o)
          : async () => false;
      const confirmed = await promptFn({ lang, host });
      if (!this.running) return;
      if (!confirmed) {
        if (typeof this.cdp.recordRelaunchPromptState === 'function') {
          this.cdp.recordRelaunchPromptState(this.rootDir, host.pid, host.startMs, 'no', extraDirs);
        }
        this.log(`[relaunch-guard] User declined immediate relaunch for pid=${host.pid}; shortcuts ready for next launch`);
        return;
      }
      // 二次复核：若用户在等待点击期间已自行重开带参实例，则直接挂载不再重复重启
      const portNow = discoverActivePort(this.overridePort, this.portFile);
      if (portNow) {
        this._noPortSinceMs = 0;
        return;
      }
      if (typeof this.cdp.recordRelaunchPromptState === 'function') {
        this.cdp.recordRelaunchPromptState(this.rootDir, host.pid, host.startMs, 'yes', extraDirs);
      }
      const spawnFn =
        typeof this._relaunchHooks?.spawnRelaunch === 'function'
          ? this._relaunchHooks.spawnRelaunch
          : typeof this.cdp.spawnDetachedHostRelaunchHelper === 'function'
          ? (t) => this.cdp.spawnDetachedHostRelaunchHelper(t)
          : () => ({ spawned: false });
      const spawnRes = await spawnFn({
        hostPid: host.pid,
        exePath: host.exePath || '',
        pluginDir: this.rootDir,
      });
      this.log(
        `[relaunch-guard] Triggered detached relaunch helper for pid=${host.pid} (spawned=${Boolean(spawnRes?.spawned)}, method=${spawnRes?.method || 'custom'})`
      );
    } finally {
      this._promptInFlight = false;
    }
  }

  async tick() {
    if (!this.running) return { attached: this.sessions.size };
    if (this.busy) {
      this._pendingTick = true;
      return { attached: this.sessions.size };
    }
    this.busy = true;
    this._pendingTick = false;
    try {
      if (!this.isCurrentOwner()) {
        await this.stop(false);
        return { attached: 0, superseded: true };
      }

      if (!this.enabledCheck()) {
        this._noPortSinceMs = 0;
        this._hasActiveCdpPort = false;
        this._portState = 'unknown';
        if (this.sessions.size > 0 || this.browserSession) {
          await this.detachAll(true);
        }
        return { attached: 0, disabled: true };
      }

      const port = discoverActivePort(this.overridePort, this.portFile);
      if (!port) {
        const transitionedFromActive = this._hasActiveCdpPort || this._portState === 'active';
        this._hasActiveCdpPort = false;
        this._portState = 'missing';
        if (transitionedFromActive) {
          this._resetShortcutBackoff('no-port');
        }
        if (this.sessions.size === 0 && this._prevAttachedCount > 0) {
          this._disconnectedAllSessions = true;
          this._prevAttachedCount = 0;
        }
        await this._handleMissingCdpPort();
        return { attached: 0, port: null };
      }

      const now = Date.now();
      const canSkipListPoll =
        this.timer != null &&
        Boolean(this.browserSession && !this.browserSession.closed && this._browserDiscoverySubscribed) &&
        this.browserPort === port &&
        this.sessions.size > 0 &&
        !this._forceListPagesNextTick &&
        this._lastListPagesAt > 0 &&
        now - this._lastListPagesAt < this._listPagesFallbackIntervalMs;

      if (canSkipListPoll) {
        this._noPortSinceMs = 0;
        this._hasActiveCdpPort = true;
        this._portState = 'active';
        this._maybeSyncShortcuts(false, { hasActivePort: true });

        const liveEntries = [];
        for (const [wsUrl, entry] of this.sessions.entries()) {
          if (entry.session.closed) {
            this.sessions.delete(wsUrl);
            continue;
          }
          liveEntries.push(entry);
        }

        if (liveEntries.length > 0) {
          await Promise.allSettled(liveEntries.map((entry) => this.verifyAndHealEntry(entry)));
          if (this.sessions.size === 0 && this._prevAttachedCount > 0) {
            this._disconnectedAllSessions = true;
          }
          this._prevAttachedCount = this.sessions.size;
          if (this._isTelemetryDisabled()) {
            this._releaseIdleTelemetry(true);
          } else {
            this._releaseIdleTelemetry(false);
          }
          return {
            attached: this.sessions.size,
            port,
            pages: [...this.sessions.values()].map((e) => e.title || e.url),
            skippedListPoll: true,
          };
        }
        if (this._prevAttachedCount > 0) {
          this._disconnectedAllSessions = true;
          this._prevAttachedCount = 0;
        }
      }

      let rawPages = [];
      try {
        rawPages = await this.cdp.listPages(port);
        this._lastListPagesAt = Date.now();
        this._forceListPagesNextTick = false;
      } catch {
        const transitionedFromActive = this._hasActiveCdpPort || this._portState === 'active';
        this._hasActiveCdpPort = false;
        this._portState = 'unreachable';
        if (transitionedFromActive) {
          this._resetShortcutBackoff('port-unreachable');
        }
        this.closeBrowserDiscovery();
        if (this.sessions.size === 0) {
          if (this._prevAttachedCount > 0) {
            this._disconnectedAllSessions = true;
            this._prevAttachedCount = 0;
          }
          await this._handleMissingCdpPort();
        }
        return { attached: this.sessions.size, port, unreachable: true };
      }

      this._noPortSinceMs = 0;
      this._hasActiveCdpPort = true;
      this._portState = 'active';
      const prevActivePort = this._lastActiveCdpPort;
      const portChanged = prevActivePort !== null && prevActivePort !== port;
      this._lastActiveCdpPort = port;
      const prevSessionCount = this.sessions.size;
      const canRunShortcutSync = Boolean(this.timer || typeof this._relaunchHooks?.syncShortcuts === 'function');
      let forcedShortcutSyncThisTick = false;
      if (portChanged) {
        this._resetShortcutBackoff(`port-changed:${prevActivePort}->${port}`);
        if (canRunShortcutSync) {
          forcedShortcutSyncThisTick = true;
          this._maybeSyncShortcuts(true, { hasActivePort: true });
        }
      } else if (this.timer) {
        this._maybeSyncShortcuts(false, { hasActivePort: true });
      }

      // Subscribe to Browser-level Target.setDiscoverTargets when persistent daemon is running
      if (this.timer) {
        void this.ensureBrowserDiscovery(port);
      }

      const eligible = rawPages.filter((t) => this._isEligibleDaemonTarget(t));
      const activeUrls = new Set(eligible.map((t) => t.webSocketDebuggerUrl));

      for (const [wsUrl, entry] of this.sessions.entries()) {
        if (entry.session.closed) {
          this.sessions.delete(wsUrl);
          continue;
        }
        if (!activeUrls.has(wsUrl)) {
          // Guard live workbench sessions against transient SPA title shifts (e.g. Swarm "Full View" -> "Untitled Conversation"):
          // verify actual in-page DOM before ever issuing REMOVE_EXPRESSION!
          const check = await this.verifyAndHealEntry(entry, true);
          if (check && check.alive && (!check.ready || check.isHostDom)) {
            continue;
          }
          if (!entry.session.closed) {
            if (entry.scriptId) {
              await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId }).catch(() => {});
            }
            if (entry.omniScriptId) {
              await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId }).catch(() => {});
            }
            if (entry.sidebarScriptId) {
              await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId }).catch(() => {});
            }
            if (entry.hostI18nScriptId) {
              await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId }).catch(() => {});
            }
            if (entry.thoughtScriptId) {
              await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.thoughtScriptId }).catch(() => {});
              entry.thoughtScriptId = null;
            }
            entry.thoughtMounted = false;
            entry.lastThoughtSig = '';
            entry.lastThoughtScriptSig = '';
            if (entry.inlineDiffScriptId) {
              await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.inlineDiffScriptId }).catch(() => {});
              entry.inlineDiffScriptId = null;
            }
            entry.inlineDiffMounted = false;
            entry.lastInlineDiffHash = '';
            entry.lastInlineDiffScriptHash = '';
            if (entry.wallpaperScriptId) {
              await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.wallpaperScriptId }).catch(() => {});
              entry.wallpaperScriptId = null;
            }
            await this._removeWallpaperBinding(entry);
            entry.wallpaperBindingAdded = false;
            entry.wallpaperMounted = false;
            entry.lastWallpaperHash = '';
            entry.lastWallpaperScriptHash = '';
            if (entry.catSanctuaryScriptId) {
              await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.catSanctuaryScriptId }).catch(() => {});
              entry.catSanctuaryScriptId = null;
            }
            entry.catSanctuaryMounted = false;
            entry.lastCatSanctuaryHash = '';
            entry.lastCatSanctuaryScriptHash = '';
            if (entry.effortSliderScriptId) {
              await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.effortSliderScriptId }).catch(() => {});
              entry.effortSliderScriptId = null;
            }
            entry.effortSliderMounted = false;
            entry.lastEffortSliderHash = '';
            entry.lastEffortSliderScriptHash = '';
            if (entry.chatSceneScriptId) {
              await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.chatSceneScriptId }).catch(() => {});
              entry.chatSceneScriptId = null;
            }
            entry.chatSceneMounted = false;
            entry.lastChatSceneSig = '';
            entry.lastChatSceneScriptSig = '';
            await entry.session.evaluate(this.cdp.REMOVE_EXPRESSION).catch(() => {});
          }
          entry.session.close();
          this.sessions.delete(wsUrl);
        }
      }

      if (!this.injectExpr) this.rebuildBundle();

      await Promise.allSettled(
        eligible.map((target) => {
          if (!this.sessions.has(target.webSocketDebuggerUrl)) {
            return this.attachTarget(target);
          }
          return this.verifyAndHealEntry(this.sessions.get(target.webSocketDebuggerUrl));
        })
      );

      // 盲区 3：全部窗口断开后重连，或活跃窗口数从 0 恢复时，立即复位 45 分钟退避并补检快捷方式
      const nowAttachedCount = this.sessions.size;
      if (nowAttachedCount === 0) {
        if (this._prevAttachedCount > 0 || prevSessionCount > 0) {
          this._disconnectedAllSessions = true;
        }
      } else {
        const recoveredFromAllDisconnected = this._disconnectedAllSessions;
        const recoveredFromZero = prevSessionCount === 0 && this._lastShortcutCheckAt > 0;
        if (recoveredFromAllDisconnected) {
          this._disconnectedAllSessions = false;
        }
        if ((recoveredFromAllDisconnected || recoveredFromZero) && !forcedShortcutSyncThisTick) {
          this._resetShortcutBackoff(
            recoveredFromAllDisconnected ? 'all-windows-reconnected' : 'active-windows-recovered-from-zero'
          );
          if (canRunShortcutSync) {
            this._maybeSyncShortcuts(true, { hasActivePort: true });
          }
        }
      }
      this._prevAttachedCount = nowAttachedCount;

      if (this._isTelemetryDisabled()) {
        this._releaseIdleTelemetry(true);
      } else {
        this._releaseIdleTelemetry(false);
      }

      return { attached: this.sessions.size, port, pages: eligible.map((p) => p.title || p.url) };
    } finally {
      this.busy = false;
      if (this._pendingTick && this.running) {
        this._pendingTick = false;
        this.scheduleImmediateTick(40);
      }
    }
  }

  stopExistingDaemon({ verifyPid = null, inspectCommandLine = null, inspectProcess = null, killProcess = null } = {}) {
    try {
      if (!this.pidFile) return false;
      let pidStat;
      try {
        pidStat = fs.lstatSync(this.pidFile);
      } catch {
        return false;
      }
      if (pidStat.isSymbolicLink() || !pidStat.isFile()) return false;

      const prevPid =
        typeof this.cdp?.readPidFromLockFile === 'function'
          ? this.cdp.readPidFromLockFile(this.pidFile)
          : (() => {
              const raw = fs.readFileSync(this.pidFile, 'utf8').trim();
              if (/^\d+$/.test(raw)) return parseInt(raw, 10);
              return Number(JSON.parse(raw)?.pid);
            })();
      if (!Number.isInteger(prevPid) || prevPid <= 0 || prevPid === process.pid || !isPidAlive(prevPid)) {
        return false;
      }

      const customVerifier =
        typeof verifyPid === 'function'
          ? verifyPid
          : typeof this._daemonPidVerifier === 'function'
          ? this._daemonPidVerifier
          : null;

      let safeToKill = false;
      if (customVerifier) {
        safeToKill = Boolean(customVerifier(prevPid, this.pidFile));
      } else if (typeof this.cdp?.isExpectedDaemonProcess === 'function') {
        const isDefaultVerifier =
          this.cdp.isExpectedDaemonProcess === this._loadedCdpVerifier ||
          this.cdp.isExpectedDaemonProcess === defaultCdp.isExpectedDaemonProcess;
        if (!isDefaultVerifier) {
          // 兼容单测显式覆写 this.cdp.isExpectedDaemonProcess 注入校验钩子
          safeToKill = Boolean(this.cdp.isExpectedDaemonProcess(prevPid, this.pidFile));
        } else {
          // P2-5: 复用 cdp.js 单次进程探针，避免 Windows 启动抢锁连续拉起两次 powershell.exe
          const hasUnifiedProbe =
            typeof inspectProcess === 'function' || typeof this.cdp.inspectProcessSync === 'function';
          const procInfo =
            typeof inspectProcess === 'function'
              ? inspectProcess(prevPid)
              : typeof this.cdp.inspectProcessSync === 'function'
              ? this.cdp.inspectProcessSync(prevPid)
              : null;
          const cdpVerified = hasUnifiedProbe
            ? Boolean(this.cdp.isExpectedDaemonProcess(prevPid, { procInfo, lockFile: this.pidFile }))
            : Boolean(this.cdp.isExpectedDaemonProcess(prevPid, this.pidFile));
          if (!cdpVerified) {
            safeToKill = false;
          } else {
            // 标准 cdp.isExpectedDaemonProcess 对 node.exe 仅核对映像名，补充命令行身份复核防误杀无关 node 进程
            const cmd =
              typeof inspectCommandLine === 'function'
                ? inspectCommandLine(prevPid)
                : hasUnifiedProbe
                ? procInfo?.commandLine || ''
                : queryProcessCommandLineSync(prevPid);
            safeToKill = isObsidianPrismDaemonCommandLine(cmd);
          }
        }
      } else {
        // 无有效身份校验钩子时严格 fail-closed，绝不盲杀无关 PID
        safeToKill = false;
      }

      if (!safeToKill) return false;
      const killer = typeof killProcess === 'function' ? killProcess : (pid) => process.kill(pid);
      try {
        killer(prevPid);
        return true;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  claimOwnership() {
    const tookOver = Boolean(this.stopExistingDaemon());
    this._tookOverExistingDaemon = tookOver;
    this._ownerFileCache = null;
    try {
      try {
        const st = fs.lstatSync(this.pidFile);
        if (st.isSymbolicLink()) return tookOver;
      } catch (err) {
        if (err && err.code !== 'ENOENT') return tookOver;
      }
      writeFileAtomicSync(
        this.pidFile,
        JSON.stringify({ pid: process.pid, token: this.ownerToken, startedAt: Date.now() }),
        { mode: 0o600 }
      );
      this._ownerFileCache = null;
    } catch {}
    return tookOver;
  }

  isCurrentOwner() {
    try {
      let st;
      try {
        st = fs.statSync(this.pidFile);
      } catch {
        this._ownerFileCache = null;
        return true;
      }
      if (!st.isFile()) {
        this._ownerFileCache = null;
        return true;
      }
      const sig = `${st.mtimeMs}:${st.size}:${st.ctimeMs}`;
      if (this._ownerFileCache && this._ownerFileCache.path === this.pidFile && this._ownerFileCache.sig === sig) {
        return this._ownerFileCache.owned;
      }
      const cur = JSON.parse(fs.readFileSync(this.pidFile, 'utf8'));
      const owned = !cur || !cur.token || cur.token === this.ownerToken;
      this._ownerFileCache = { path: this.pidFile, sig, owned };
      return owned;
    } catch {
      this._ownerFileCache = null;
      return true;
    }
  }

  releaseOwnership() {
    this._ownerFileCache = null;
    try {
      let st;
      try {
        st = fs.lstatSync(this.pidFile);
      } catch {
        return;
      }
      if (st.isSymbolicLink() || !st.isFile()) return;
      const cur = JSON.parse(fs.readFileSync(this.pidFile, 'utf8'));
      if (cur && cur.token === this.ownerToken) {
        fs.unlinkSync(this.pidFile);
      }
    } catch {}
  }

  start({ claimPid = true, watchFiles = true } = {}) {
    if (this.running) return;
    this._sidebarStopped = false;
    this._wallpaperStopped = false;
    this._logBytes = -1;
    this._tookOverExistingDaemon = false;
    this.running = true;
    if (!this._hasExplicitPollInterval) {
      this.pollIntervalMs = this._resolveConfiguredPollIntervalMs();
    }
    const tookOver = claimPid ? Boolean(this.claimOwnership()) : false;
    const initialPort = discoverActivePort(this.overridePort, this.portFile);
    this.log(`[boot] PrismDaemon started (pid=${process.pid}, activePort=${initialPort || 'none'}, pollMs=${this.pollIntervalMs}, takeover=${tookOver}, root=${this.rootDir})`);
    this.rebuildBundle();

    if (watchFiles) {
      let pendingCodeChange = false;
      const devWatch = process.env.AG_PRISM_DEV_WATCH === '1';
      const configPath =
        typeof this.cdp?.CONFIG_PATH === 'string' && this.cdp.CONFIG_PATH
          ? path.resolve(this.cdp.CONFIG_PATH)
          : path.join(this.rootDir, 'config.json');
      const watchTargetDir = devWatch ? this.rootDir : path.dirname(configPath);
      const configBaseName = path.basename(configPath);
      let lastConfigMtimeMs = 0;
      try {
        lastConfigMtimeMs = fs.statSync(configPath).mtimeMs || 0;
      } catch {}
      try {
        this.fsw = fs.watch(watchTargetDir, devWatch ? { recursive: true } : { persistent: false }, (_, filename) => {
          if (!this.running) return;
          const base = filename ? path.basename(String(filename)) : '';
          if (!devWatch) {
            if (base && base.toLowerCase() !== configBaseName.toLowerCase()) return;
            if (!base) {
              let nextMtime = 0;
              try {
                nextMtime = fs.statSync(configPath).mtimeMs || 0;
              } catch {}
              if (nextMtime === lastConfigMtimeMs) return;
              lastConfigMtimeMs = nextMtime;
            } else {
              try {
                lastConfigMtimeMs = fs.statSync(configPath).mtimeMs || 0;
              } catch {}
            }
            if (Date.now() < this._selfConfigWriteUntil) return;
          } else {
            if (!base || base.startsWith('.') || !/\.(css|c?js|mjs|json)$/i.test(base)) return;
            if (base === 'daemon.log' || base === 'watch.log' || base === 'repo-meta.json') return;
            if (base.toLowerCase() === configBaseName.toLowerCase()) {
              if (Date.now() < this._selfConfigWriteUntil) return;
            } else {
              pendingCodeChange = true;
            }
          }
          if (this._reloadTimer) {
            clearTimeout(this._reloadTimer);
            this._reloadTimer = null;
          }
          const delayMs = pendingCodeChange ? 180 : 120;
          this._reloadTimer = setTimeout(async () => {
            this._reloadTimer = null;
            if (!this.running) return;
            const isCodeChange = pendingCodeChange;
            pendingCodeChange = false;
            try {
              if (!isCodeChange) {
                await this.broadcastConfigRefresh();
                return;
              }
              this.rebuildBundle();
              const activeItems = [...this.sessions.values()].filter((e) => e && !e.session.closed);
              await Promise.allSettled(activeItems.map((entry) => this.applyToEntry(entry)));
            } catch {}
          }, delayMs);
          if (this._reloadTimer && typeof this._reloadTimer.unref === 'function') {
            this._reloadTimer.unref();
          }
        });
        if (this.fsw && typeof this.fsw.unref === 'function') this.fsw.unref();
      } catch {}
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
    let startupDelayMs = 0;
    if (claimPid) {
      if (tookOver) {
        const jitter = this._startupJitterMs > 0 ? Math.floor(Math.random() * this._startupJitterMs) : 0;
        startupDelayMs = this._takeoverDebounceMs + jitter;
      } else if (!isAutomatedTestRuntime() && this._startupJitterMs > 0) {
        startupDelayMs = 25 + Math.floor(Math.random() * Math.min(60, this._startupJitterMs));
      }
    }
    if (startupDelayMs > 0) {
      this._startupTickTimer = setTimeout(() => {
        this._startupTickTimer = null;
        if (!this.running) return;
        if (!this.isCurrentOwner()) {
          void this.stop(false);
          return;
        }
        void this.tick();
      }, startupDelayMs);
      this._startupTickTimer?.unref?.();
    } else {
      void this.tick();
    }

    if (this._enableAutoUpdateTimer) {
      this._updateInitialTimer = setTimeout(() => {
        this._updateInitialTimer = null;
        if (this.running) {
          void this.runUpdateCheck({ force: false, manual: false, allowAutoApply: true }).catch(() => {});
        }
      }, this._updateCheckInitialDelayMs);
      this._updateInitialTimer?.unref?.();

      this._updateIntervalTimer = setInterval(() => {
        if (this.running) {
          void this.runUpdateCheck({ force: false, manual: false, allowAutoApply: true }).catch(() => {});
        }
      }, this._updateCheckIntervalMs);
      this._updateIntervalTimer?.unref?.();
    }
  }

  async stop(cleanPageDom = false) {
    this._flushUsageDiskCache();
    this._sidebarStopped = true;
    this._wallpaperStopped = true;
    this.running = false;
    if (this._updateInitialTimer) {
      clearTimeout(this._updateInitialTimer);
      this._updateInitialTimer = null;
    }
    if (this._updateIntervalTimer) {
      clearInterval(this._updateIntervalTimer);
      this._updateIntervalTimer = null;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this._startupTickTimer) {
      clearTimeout(this._startupTickTimer);
      this._startupTickTimer = null;
    }
    if (this._reloadTimer) {
      clearTimeout(this._reloadTimer);
      this._reloadTimer = null;
    }
    if (this._bundleCacheFlushTimer) {
      clearTimeout(this._bundleCacheFlushTimer);
      this._bundleCacheFlushTimer = null;
    }
    if (this._discoverTimer) {
      clearTimeout(this._discoverTimer);
      this._discoverTimer = null;
    }
    if (this._managedTimers) {
      for (const t of this._managedTimers) {
        clearTimeout(t);
      }
      this._managedTimers.clear();
    }
    if (this.sessions && typeof this.sessions.values === 'function') {
      for (const entry of this.sessions.values()) {
        if (entry && entry._healTimer) {
          clearTimeout(entry._healTimer);
          entry._healTimer = null;
        }
      }
    }
    if (this.fsw) {
      try { this.fsw.close(); } catch {}
      this.fsw = null;
    }
    await this.detachAll(cleanPageDom);
    const standaloneLsClient = this._lazyLsClient && this._lazyLsClient !== this._lazyStore?.client ? this._lazyLsClient : null;
    for (const svc of [this._lazyUsage, this._lazyStore, standaloneLsClient, this._lazyThoughtService]) {
      if (!svc) continue;
      try {
        if (typeof svc.dispose === 'function') await svc.dispose();
        else if (typeof svc.close === 'function') await svc.close();
        else if (typeof svc.stop === 'function') await svc.stop();
      } catch {}
    }
    this._lazyUsage = null;
    this._lazyStore = null;
    this._lazyLsClient = null;
    this._backendSummariesCache = null;
    this._backendSummariesAt = 0;
    this._usageDiskCache = null;
    this._lazyThoughtService = null;
    if (this.omniServer) {
      const srv = this.omniServer;
      this.omniServer = null;
      this._omniServerPromise = null;
      await srv.stop().catch(() => {});
    }
    await this._sidebarServicePromise?.catch(() => null);
    if (this.sidebarService) {
      const sb = this.sidebarService;
      this.sidebarService = null;
      try {
        if (typeof sb.dispose === 'function') await sb.dispose();
      } catch {}
    }
    await this._wallpaperServicePromise?.catch(() => null);
    if (this._lazyWallpaperService) {
      const wp = this._lazyWallpaperService;
      this._lazyWallpaperService = null;
      try {
        if (typeof wp.dispose === 'function') await wp.dispose();
      } catch {}
    }
    this.releaseOwnership();
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let once = false;
  let port = null;
  let rootDir = DEFAULT_ROOT_DIR;
  let gitRepoDir = null;
  let outFile = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--once') once = true;
    else if (a === '--port' && args[i + 1]) port = parseInt(args[++i], 10);
    else if (a === '--root' && args[i + 1]) rootDir = path.resolve(args[++i]);
    else if (a === '--repo' && args[i + 1]) gitRepoDir = path.resolve(args[++i]);
    else if (a === '--out' && args[i + 1]) outFile = path.resolve(args[++i]);
  }
  return { once, port, rootDir, gitRepoDir, outFile };
}

/**
 * 判断当前模块是否作为 CLI 主入口启动。
 * 复用本文件 canonicalRealpathSync() 解析符号链接与 Windows Junction（例如 ~/.gemini 迁至其他盘符），
 * 并在 Win32 下统一规范化盘符大小写与长路径前缀。
 */
export function isMainEntry(argv1, moduleFilename = __filename) {
  if (!argv1 || !moduleFilename) return false;
  let selfPath = String(moduleFilename);
  if (selfPath.startsWith('file://')) {
    try {
      selfPath = fileURLToPath(selfPath);
    } catch {
      return false;
    }
  }
  let resolvedArgv;
  let resolvedSelf;
  try {
    resolvedArgv = canonicalRealpathSync(argv1);
  } catch {
    resolvedArgv = path.resolve(argv1);
  }
  try {
    resolvedSelf = canonicalRealpathSync(selfPath);
  } catch {
    resolvedSelf = path.resolve(selfPath);
  }
  if (process.platform === 'win32') {
    return (
      resolvedArgv.replace(/^\\\\\?\\/, '').toLowerCase() ===
      resolvedSelf.replace(/^\\\\\?\\/, '').toLowerCase()
    );
  }
  return resolvedArgv === resolvedSelf;
}

if (isMainEntry(process.argv[1], __filename)) {
  const cli = parseArgs(process.argv);
  const daemon = new PrismDaemon({
    rootDir: cli.rootDir,
    gitRepoDir: cli.gitRepoDir,
    overridePort: cli.port,
  });

  if (cli.once) {
    daemon.running = true;
    daemon.rebuildBundle();
    daemon
      .tick()
      .then(async (res) => {
        if (cli.outFile) {
          fs.writeFileSync(cli.outFile, JSON.stringify({ ok: true, ...res }, null, 2), 'utf8');
        } else {
          console.log(JSON.stringify({ ok: true, ...res }, null, 2));
        }
        await daemon.stop(false);
        process.exit(0);
      })
      .catch(async (err) => {
        console.error('[obsidian-prism daemon] error:', err.message);
        await daemon.stop(false);
        process.exitCode = 1;
      });
  } else {
    daemon.start({ claimPid: true, watchFiles: true });
    const shutdown = async () => {
      await daemon.stop(false);
      process.exit(0);
    };
    for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
      process.on(sig, () => {
        void shutdown();
      });
    }
    process.on('uncaughtException', (err) => {
      daemon.log(`[!] uncaughtException: ${err?.stack || err}`);
    });
    process.on('unhandledRejection', (err) => {
      daemon.log(`[!] unhandledRejection: ${err?.stack || err}`);
    });
  }
}
