// Obsidian Prism — Studio Home Telemetry Dashboard & Rollup Cache Module (home-studio-panel.js)
(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  const STUDIO_STYLE_ID = 'ag-prism-studio-v101-css';
  const isFn = (v) => typeof v === 'function';
  const isFin = (v) => typeof v === 'number' && Number.isFinite(v);
  const toNum = (v) => { const n = typeof v === 'number' || typeof v === 'bigint' || typeof v === 'string' ? Number(v) : 0; return Number.isFinite(n) ? n : 0; };
  function markNoTr(e) {
    if (e?.setAttribute) for (const s of 'translate=no,data-no-translate=true,data-ag-localization-skip=true,data-agy-no-translate=true,data-antigravity-zh-skip=1'.split(',')) { const p = s.split('='); e.setAttribute(p[0], p[1]); }
    return e;
  }

  const STUDIO_HEAD_CSS = '.ag-cs-home-panel-head{flex-wrap:wrap;row-gap:8px}';
  const STUDIO_EXTRA_CSS = STUDIO_HEAD_CSS + '.agy-home{--_a:var(--ag-cs-accent,var(--primary,#2563eb));--_m:var(--muted-foreground);--_b:var(--ag-cs-border-1,rgba(148,163,184,.2));--_p:var(--ag-cs-pill-bg,rgba(128,138,158,.08))}.ag-cs-home-tab,.ag-cs-home-range{white-space:nowrap}.ag-cs-home-head-left,.ag-cs-home-head-right{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}.ag-cs-home-head-left{min-width:0}.ag-cs-home-scope-badge,.ag-cs-home-stat-sub{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ag-cs-home-scope-badge,.ag-cs-quota-pace,.ag-cs-quota-bar,.ag-cs-qbar-solid{border-radius:999px}.ag-cs-home-ws-select,.ag-cs-quota-refresh,.ag-cs-quota-card{border:1px solid var(--_b);background:var(--_p)}.ag-cs-home-ws-select,.ag-cs-quota-refresh{border-radius:var(--ag-cs-r-sm,6px);cursor:pointer}.ag-cs-home-ws-select,.ag-cs-quota-toolbar,.ag-cs-quota-refresh,.ag-cs-quota-win-row,.ag-cs-quota-win-val{font-size:11px}.ag-cs-home-ws-select,.ag-cs-quota-refresh,.ag-cs-quota-name,.ag-cs-quota-win-val{color:var(--foreground)}.ag-cs-home-scope-badge,.ag-cs-quota-name,.ag-cs-quota-pace,.ag-cs-quota-win-val{font-weight:600}.ag-cs-quota-wrap,.ag-cs-quota-card,.ag-cs-quota-win{display:flex;flex-direction:column}.ag-cs-home-stat-sub,.ag-cs-quota-card,.ag-cs-quota-win-val{font-variant-numeric:tabular-nums}.ag-cs-home-stat-sub,.ag-cs-quota-foot{font-size:10px;color:var(--_m);opacity:.82}.ag-cs-home-scope-badge{display:inline-flex;align-items:center;height:20px;max-width:168px;padding:0 7px;font-size:10.5px;color:var(--_a);border:1px solid color-mix(in srgb,currentColor 32%,transparent);background:color-mix(in srgb,currentColor 11%,transparent)}.ag-cs-home-ws-select{height:24px;max-width:168px;padding:0 22px 0 10px;border-radius:999px;border-color:var(--_td,var(--_b));background:color-mix(in srgb,var(--foreground) 3%,transparent);color-scheme:inherit;font-weight:450;outline:none;text-overflow:ellipsis;transition:background-color 120ms ease,border-color 120ms ease}.ag-cs-home-ws-select:hover{background:var(--_p);border-color:var(--ag-cs-border-2,var(--_b))}.ag-cs-home-ws-select option{background:var(--card,#141418);color:var(--foreground,#F2F2F5);}.ag-cs-home-stat-sub{display:block;margin-top:2px;line-height:1.25}.ag-cs-quota-wrap{gap:10px;margin-top:4px;position:relative;z-index:1}.ag-cs-quota-toolbar,.ag-cs-quota-card-head,.ag-cs-quota-win-row{display:flex;align-items:center;justify-content:space-between;gap:6px}.ag-cs-quota-toolbar{color:var(--_m)}.ag-cs-quota-refresh{height:23px;padding:0 9px}.ag-cs-quota-refresh:hover{background:rgba(128,138,158,.16)}.ag-cs-quota-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.ag-cs-quota-card{padding:11px 12px;border-radius:var(--ag-cs-r-md,10px);gap:8px}.ag-cs-quota-name{font-size:12px}.ag-cs-quota-pace{padding:1.5px 6.5px;font-size:10px;border:1px solid rgba(148,163,184,.24);color:var(--_m)}.ag-cs-quota-pace[data-pace="ok"]{color:var(--_a);border-color:color-mix(in srgb,currentColor 30%,transparent);background:color-mix(in srgb,currentColor 10%,transparent)}.ag-cs-quota-pace[data-pace="tight"]{color:#d97706;border-color:rgba(245,158,11,.35);background:rgba(245,158,11,.12)}.dark .ag-cs-quota-pace[data-pace="tight"]{color:#fbbf24}.ag-cs-quota-pace[data-pace="low"]{color:#dc2626;border-color:rgba(239,68,68,.38);background:rgba(239,68,68,.12)}.dark .ag-cs-quota-pace[data-pace="low"]{color:#f87171}.ag-cs-quota-win{gap:4px}.ag-cs-quota-win-row{align-items:baseline}.ag-cs-quota-win-lbl{color:var(--_m);font-size:10.5px}.ag-cs-quota-bar{position:relative;height:6px;background:rgba(148,163,184,.18);overflow:hidden}.ag-cs-qbar-solid{position:absolute;inset:0 auto 0 0;color:var(--_a);background:linear-gradient(90deg,currentColor,color-mix(in srgb,currentColor 68%,#fff))}.ag-cs-quota-win[data-warn="1"] .ag-cs-qbar-solid{background:linear-gradient(90deg,#d97706,#fbbf24)}.ag-cs-quota-win[data-warn="2"] .ag-cs-qbar-solid{background:linear-gradient(90deg,#dc2626,#f87171)}';

  const REMOTE_TITLE_RE = /\[(SSH|WSL|Dev Container|Codespaces|Tunnel|Remote):\s*([^\]]+)\]/i;
  const decUri = (v) => { const s = String(v || '').trim(); if (!s) return ''; try { return decodeURIComponent(s); } catch { return s; } };
  const packScope = (pfx, v) => {
    const c = decUri(v).toLowerCase().replace(/[^a-z0-9._:@-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
    return !c || /^(?:__proto__|constructor|prototype)$/.test(c) ? '' : `${pfx}:${c}`;
  };
  const extractScopeFromUri = (u) => {
    const s = decUri(u);
    const m = s && (s.match(/[?&#]remoteAuthority=([^&#\s]+)/i)?.[1] || s).match(/(?:^|vscode-remote:\/\/)([a-z0-9_-]+)\+([^/&#?\s]+)/i);
    return !m ? '' : m[1].toLowerCase() === 'ssh-remote' ? packScope('ssh', m[2]) : packScope('remote', `${m[1]}-${m[2]}`);
  };
  const normalizeScopeKey = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (/^local$/i.test(s)) return 'local';
    const pm = s.match(/^(ssh|remote):(.+)$/i);
    if (pm) return packScope(pm[1].toLowerCase(), pm[2]);
    const tm = s.match(REMOTE_TITLE_RE);
    if (tm) return tm[1].toLowerCase() === 'ssh' ? packScope('ssh', tm[2]) : packScope('remote', `${tm[1]}-${tm[2]}`);
    return extractScopeFromUri(s);
  };
  const formatScopeBadge = (sc) => (!sc || sc === 'local' ? '' : sc.startsWith('ssh:') ? 'SSH · ' + sc.slice(4) : sc.startsWith('remote:') ? 'Remote' + (sc.slice(7) ? ' · ' + sc.slice(7) : '') : '');
  const hasRealUsage = (r) => !!(r?.days && (toNum(r.calls) > 0 || Object.values(r.days).some((d) => d && (toNum(d.total || d.tokens) > 0 || toNum(d.calls) > 0))));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const getDoc = () => (typeof document !== 'undefined' ? document : null);
  const getWin = () => (typeof window !== 'undefined' ? window : G);

  function createHomeStudioPanelController({
    usageCore,
    storageUsageCacheKey = 'ag-prism:trajRollup.v1',
    scopeKey: scOpt = '',
    waitTickMs = 120,
    isDestroyed,
    getHomeLayout,
    getLang,
    uiText,
    getDisplayName,
    ensureHooks,
    canMountRealCanvas,
    setAttrIfChanged,
    runGuardedMut,
  }) {
    const usageRecords = new Map();
    const replacedGreetings = new Map();
    let usageLoading = false;
    let quotaLoading = false;
    let usageHasData = false;
    let modelsExpanded = false;
    let wasHero = false;
    let localSaveBlocked = false;
    let lastUsageFetchAt = 0;
    let lastQuotaFetchAt = 0;
    let lastQuotaFailAt = 0;
    let lastQuotaTabTriggerAt = 0;
    let lastManualRefreshAt = 0;
    let lastOfflineWaitAt = 0;
    let quotaEpoch = 0;
    let quotaBindingSeq = 0;
    let usageDataEpoch = 0;
    let deferredUsageTimer = 0;
    let saveUsageTimer = 0;
    let saveUsageIdle = 0;
    let heatTipRaf = 0;
    let liveQuotaSnap = null;
    let quotaPending = null;
    let cachedAggData = null;
    let panelSeat = null;
    let panelEl = null;
    let heatTipEl = null;
    let shownHeatCell = null;
    let pendingHeatCell = null;
    let pendingHeatGrid = null;
    let bookPick = 0.07;
    let activeTab = 'overview';
    let activeRange = 'all';
    let activeWorkspace = 'all';
    let detectedCurrentWorkspace = '';
    let lastPanelRenderKey = '';
    let cachedAggKey = '';
    let curScope = 'local';
    const modelColours = usageCore?.createHomeModelColours ? usageCore.createHomeModelColours() : () => ({});
    const mk = (tag, cls, txt, attrs) => {
      if (txt && typeof txt === 'object') { attrs = txt; txt = null; }
      const e = getDoc().createElement(tag);
      if (cls) e.className = cls;
      if (txt != null) e.textContent = txt;
      if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      return e;
    };
    const sp = (c, t, a) => mk('span', c, t, a);
    const dv = (c, t, a) => mk('div', c, t, a);
    const bt = (c, t, fn, a) => { const e = mk('button', c, t, a); e.type = 'button'; e.addEventListener('click', fn); return e; };
    const ap = (p, ...cs) => { for (const c of cs) if (c) p.appendChild(c); return p; };
    const scopeStorageKey = (sc) => (sc && sc !== 'local' ? `${storageUsageCacheKey}:${sc}` : storageUsageCacheKey);
    const clearSaveTimers = () => {
      if (saveUsageTimer) { clearTimeout(saveUsageTimer); saveUsageTimer = 0; }
      if (saveUsageIdle) { try { if (isFn(G.cancelIdleCallback)) G.cancelIdleCallback(saveUsageIdle); } catch {} saveUsageIdle = 0; }
    };
    const wsUrisOf = (s) => {
      const o = [];
      const tm = s?.trajectoryMetadata;
      for (const w of [...(s?.workspaces || tm?.workspaces || []), s?.workspaceUri, s?.workspacePath, tm?.workspaceUri]) {
        const u = String(typeof w === 'string' ? w : w?.workspaceFolderAbsoluteUri || w?.gitRootAbsoluteUri || w?.uri || w?.path || '').trim();
        if (u && !o.includes(u) && o.length < 4) o.push(u);
      }
      return o;
    };
    const detectScope = (entries, st, bScope) => {
      const w = getWin();
      const d = getDoc() || w?.document || null;
      const bn = normalizeScopeKey(bScope);
      for (const c of [scOpt, w?.__agPrismScopeKey, bn, w?.location?.href, d?.title, st?.remoteAuthority, st?.workspace?.uri, st?.workspaceUri]) {
        const sc = normalizeScopeKey(c);
        if (sc && sc !== 'local') return sc;
      }
      if (bn === 'local') return 'local';
      let rem = '';
      let rc = 0;
      let lc = 0;
      for (const [, sum] of entries || []) {
        let rh = '';
        let lh = false;
        for (const u of wsUrisOf(sum)) {
          const sc = extractScopeFromUri(u);
          if (sc) { rh = sc; break; }
          if (/^(?:file:\/\/|[a-z]:[\\/])/i.test(u)) lh = true;
        }
        if (rh) { if (!rem) rem = rh; rc++; } else if (lh) lc++;
      }
      return rem && rc > 0 && rc >= lc ? rem : 'local';
    };
    try { const st = ensureHooks?.()?.store?.getState?.(); curScope = detectScope(st?.trajectorySummaries?.summaries ? Object.entries(st.trajectorySummaries.summaries) : null, st, ''); } catch { curScope = detectScope(null, null, ''); }
    const syncScopeAttr = (sc) => {
      try {
        const de = getDoc()?.documentElement;
        if (!de) return;
        if (sc && sc !== 'local') setAttrIfChanged?.(de, 'data-ag-prism-scope', sc);
        else de.removeAttribute?.('data-ag-prism-scope');
      } catch {}
    };
    syncScopeAttr(curScope);

    const getLs = () => (typeof localStorage !== 'undefined' && localStorage) || null;
    const loadScopeCache = (sc) => {
      usageRecords.clear(); usageHasData = false;
      try {
        const ls = getLs();
        const raw = ls && JSON.parse(ls.getItem(scopeStorageKey(sc)) || '{}');
        if (raw && typeof raw === 'object') {
          for (const [id, rec] of Object.entries(raw)) if (rec?.days) usageRecords.set(id, rec);
          if (usageRecords.size > 0) { usageHasData = true; usageDataEpoch += 1; }
        }
      } catch {}
    };
    loadScopeCache(curScope);

    const switchScope = (next) => {
      const norm = normalizeScopeKey(next) || 'local';
      if (norm === curScope) return false;
      clearSaveTimers();
      curScope = norm; localSaveBlocked = false; syncScopeAttr(curScope);
      activeWorkspace = 'all'; detectedCurrentWorkspace = cachedAggKey = lastPanelRenderKey = ''; lastUsageFetchAt = 0; cachedAggData = null; usageDataEpoch += 1;
      loadScopeCache(curScope);
      return true;
    };

    const flushUsageCacheNow = () => {
      clearSaveTimers();
      if ((curScope === 'local' && localSaveBlocked) || (!usageRecords.size && !lastUsageFetchAt)) return;
      try {
        const ls = getLs();
        if (!ls) return;
        let entries = [...usageRecords];
        if (entries.length > 1200) {
          entries.sort((a, b) => toNum(b[1]?.lastModifiedSec) - toNum(a[1]?.lastModifiedSec));
          entries = entries.slice(0, 1200);
        }
        const obj = {};
        for (const [id, rec] of entries) obj[id] = rec;
        ls.setItem(scopeStorageKey(curScope), JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));
      } catch {}
    };
    const saveUsageCache = () => {
      if (curScope === 'local' && localSaveBlocked) return;
      if (isDestroyed() || !isFn(setTimeout)) { flushUsageCacheNow(); return; }
      clearSaveTimers();
      saveUsageTimer = setTimeout(() => {
        saveUsageTimer = 0;
        if (isDestroyed()) return;
        if (isFn(G.requestIdleCallback)) saveUsageIdle = G.requestIdleCallback(() => { saveUsageIdle = 0; if (!isDestroyed()) flushUsageCacheNow(); }, { timeout: 2500 });
        else flushUsageCacheNow();
      }, 1200);
    };

    const toSec = (n, o, iso) => { const s = toNum(n || o?.seconds); if (s) return s; const t = typeof o === 'string' ? o : iso; return typeof t === 'string' ? Math.floor((Date.parse(t) || 0) / 1000) : 0; };
    const extractMeta = (sum) => {
      const tm = sum?.trajectoryMetadata;
      const workspace = usageCore?.extractWorkspaceId ? usageCore.extractWorkspaceId(sum) : String(sum?.workspace || '');
      const parentId = String(tm?.parentConversationId || sum?.parentConversationId || sum?.parentId || sum?.rootConversationId || sum?.rootId || '').trim();
      return { workspace, u: wsUrisOf(sum), parentId, subagent: !!(sum?.subagent || parentId || usageCore?.isSubagentSummary?.(sum)), lastModifiedSec: toSec(sum?.lastModifiedSec, sum?.lastModifiedTime, sum?.modifiedAt), createdSec: toSec(sum?.createdSec, sum?.createdTime, sum?.createdAt), stepCount: toNum(sum?.stepCount ?? sum?.steps ?? 0) };
    };

    const advanceCachedCursor = (prev, id, sum, defer) => {
      const m = extractMeta(sum);
      const tail = defer ? { _do: 1 } : null;
      if (prev?.days) {
        return { ...prev, stepCount: m.stepCount, lastModifiedSec: m.lastModifiedSec, subagent: prev.subagent || m.subagent, workspace: m.workspace || prev.workspace || '', parentId: m.parentId || prev.parentId || '', ...tail };
      }
      const sec = m.lastModifiedSec || m.createdSec || 0;
      const days = {};
      if (sec > 0 && usageCore?.homeDayKey) {
        const d = new Date(sec * 1000);
        const hours = new Array(24).fill(0);
        hours[d.getHours()] = 1;
        days[usageCore.homeDayKey(d)] = { calls: 1, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, hours, models: {} };
      }
      return { cascadeId: String(id || ''), stepCount: m.stepCount, lastModifiedSec: m.lastModifiedSec, gmCount: 0, subagent: m.subagent, workspace: m.workspace, parentId: m.parentId, calls: 0, days, ...tail };
    };

    const detectCurrentWorkspaceName = (entries) => {
      try {
        const t = getDoc()?.title;
        if (t) {
          const cand = String(t).replace(REMOTE_TITLE_RE, ' ').split(/\s+[-—|]\s+/).map((s) => s.trim()).find((p) => p && !/antigravity/i.test(p) && p.length <= 64);
          if (cand && /^[a-zA-Z0-9._\-\u4e00-\u9fa5]+$/.test(cand)) return cand;
        }
      } catch {}
      let latestSec = 0;
      let latestWs = '';
      for (const [, sum] of entries || []) {
        const m = extractMeta(sum);
        if (!m.subagent && m.workspace && m.lastModifiedSec >= latestSec) { latestSec = m.lastModifiedSec; latestWs = m.workspace; }
      }
      return latestWs;
    };

    const inCooldown = (at, ms, now) => at > 0 && now >= at && now - at < ms;
    const hasUsableQuotas = (snap) => Array.isArray(snap?.groups) && snap.groups.length > 0 && snap.groups.some((g) => g && (!usageCore?.quotaWindows || usageCore.quotaWindows(g).length > 0));
    const withTimeout = (fn, ms, onTimeout) => new Promise((resolve) => {
      let settled = false;
      const done = (val) => { if (settled) return; settled = true; clearTimeout(timer); resolve(val); };
      const timer = setTimeout(() => { try { onTimeout?.(); } catch {} done(null); }, ms);
      Promise.resolve().then(fn).then((v) => done(v || null), () => done(null));
    });
    const callPrismMetricsBinding = (win, input) => {
      const resName = '__agPrismMetricsResolve';
      const reqId = 800000000 + (++quotaBindingSeq);
      const prev = win[resName];
      let cb = null;
      let restored = false;
      const restore = () => {
        if (restored) return;
        restored = true;
        if (win[resName] === cb) { if (prev !== undefined) win[resName] = prev; else delete win[resName]; }
      };
      return withTimeout(() => new Promise((resolve) => {
        cb = (id, payload) => {
          if (id === reqId) { restore(); resolve(payload && typeof payload === 'object' ? payload : null); }
          else if (isFn(prev)) prev(id, payload);
        };
        win[resName] = cb;
        try { win.__agPrismMetricsCall(JSON.stringify({ id: reqId, input })); } catch { restore(); resolve(null); }
      }), 10500, restore);
    };

    const refreshLiveTelemetrySnapshot = async (force = false, opts = null) => {
      if (isDestroyed()) return liveQuotaSnap;
      if (quotaLoading && quotaPending) return quotaPending;
      const now = Date.now();
      if (!force) {
        if (hasUsableQuotas(liveQuotaSnap) && inCooldown(lastQuotaFetchAt, 45000, now)) return liveQuotaSnap;
        if (!opts?.ignoreFailCooldown && inCooldown(lastQuotaFailAt, 15000, now)) return liveQuotaSnap;
      }
      const win = getWin();
      if (!win) return null;
      const doc = getDoc() || win.document || null;
      const telemetryOff = doc?.documentElement?.getAttribute?.('data-ag-cs-telemetry') === 'off';
      quotaLoading = true;
      if (activeTab === 'quotas') renderHomePanel();
      const pending = (async () => {
        try {
          const ff = !!force;
          const req = { conversationId: null, force: ff, quotaRefresh: !!(opts?.quotaRefresh ?? ff), selectLatest: false };
          const host = win.agPulseHost;
          const isPrismHost = !!host?.__prismFallback;
          const hm = host?.getMetrics;
          const bridge = win.__agPrismMetricsBridge;
          const tel = win.__agPrismTelemetry;
          let snap = null;
          const pick = (v) => { if (hasUsableQuotas(v)) snap = v; };
          const tryPick = async (fn, ms) => pick(await withTimeout(fn, ms));

          if (isFn(hm) && !isPrismHost) await tryPick(() => hm.call(host, req), 3000);
          if (!hasUsableQuotas(snap) && !telemetryOff) {
            if (isPrismHost && isFn(hm)) await tryPick(() => hm.call(host, req), 10500);
            else if (isFn(bridge?.getMetrics)) await tryPick(() => bridge.getMetrics(req), 10500);
            else if (isFn(win.__agPrismMetricsCall)) pick(await callPrismMetricsBinding(win, req));
            else if (!hm && isFn(tel?.refresh)) await tryPick(() => tel.refresh(), 4500);
            if (!hasUsableQuotas(snap)) pick(tel?.getLatestSnapshot?.());
          }
          if (hasUsableQuotas(snap)) { liveQuotaSnap = snap; lastQuotaFetchAt = Date.now(); lastQuotaFailAt = 0; quotaEpoch += 1; }
          else lastQuotaFailAt = Date.now();
          return liveQuotaSnap;
        } catch {
          lastQuotaFailAt = Date.now();
          return liveQuotaSnap;
        } finally {
          quotaLoading = false; quotaPending = null;
          if (!isDestroyed() && activeTab === 'quotas') renderHomePanel();
        }
      })();
      return (quotaPending = pending);
    };

    const scheduleUsageRollupRefresh = (delayMs = 1800) => {
      if (isDestroyed() || usageLoading || getHomeLayout() !== 'studio') return;
      if (!usageHasData && !canMountRealCanvas(getDoc()?.body)) { void refreshUsageRollup(false); return; }
      if (deferredUsageTimer) return;
      const onHome = () => !isDestroyed() && getDoc()?.querySelector('.agy-home') && getHomeLayout() === 'studio';
      deferredUsageTimer = setTimeout(() => {
        deferredUsageTimer = 0;
        if (!onHome()) return;
        const run = () => { if (onHome()) void refreshUsageRollup(false); };
        if (usageHasData && isFn(G.requestIdleCallback)) G.requestIdleCallback(run, { timeout: 2200 });
        else run();
      }, usageHasData ? Math.max(400, delayMs) : 80);
    };

    const refreshUsageRollup = async (force = false) => {
      if (isDestroyed() || usageLoading || !usageCore) return;
      const liveSnapProm = refreshLiveTelemetrySnapshot(force);
      const h = ensureHooks();
      if (!h) { if (!usageHasData) { usageHasData = true; renderHomePanel(); } return; }
      const now = Date.now();
      const st = h.store?.getState?.() || {};
      const reduxSums = st.trajectorySummaries?.summaries || {};
      const preScope = detectScope(Object.entries(reduxSums), st, '');
      if (preScope !== curScope) switchScope(preScope);
      if (!force && usageHasData && now - lastUsageFetchAt < 60000) return;

      const win = getWin();
      const usageBridge = win?.__agPrismUsageBridge || null;
      if (!usageHasData && canMountRealCanvas(getDoc()?.body) && usageBridge && !usageBridge.isOnline?.() && !inCooldown(lastOfflineWaitAt, 15000, now)) {
        const wTick = Math.max(5, toNum(waitTickMs) || 120);
        usageLoading = true; renderHomePanel();
        for (let w = 0; w < 10 && !isDestroyed() && !usageBridge.isOnline?.(); w++) await sleep(wTick);
        usageLoading = false;
        if (isDestroyed()) return;
        if (usageBridge.isOnline?.()) { if (!hasUsableQuotas(liveQuotaSnap)) void refreshLiveTelemetrySnapshot(true, { ignoreFailCooldown: true }); }
        else lastOfflineWaitAt = Date.now();
      }

      const sumsMap = new Map();
      for (const [id, s] of Object.entries(reduxSums)) if (s) sumsMap.set(id, s);
      let seededCache = false;
      let bridgeScopeKey = '';
      let bridgeRecs = null;
      const bridgeOnline = !!usageBridge?.isOnline?.();
      if (bridgeOnline && isFn(usageBridge.listSummaries)) {
        try {
          const sumRes = await usageBridge.listSummaries(8000);
          if (typeof sumRes?.scopeKey === 'string' && sumRes.scopeKey) bridgeScopeKey = normalizeScopeKey(sumRes.scopeKey);
          const bs = sumRes?.summaries;
          const bList = Array.isArray(bs) ? bs : bs && typeof bs === 'object' ? Object.entries(bs).map(([k, v]) => ({ id: k, ...v })) : [];
          for (const item of bList) {
            const sid = String(item?.id || item?.cascadeId || '').trim();
            if (!sid) continue;
            if (!sumsMap.has(sid)) sumsMap.set(sid, item);
            else {
              const cur = sumsMap.get(sid);
              const im = extractMeta(item);
              const cm = extractMeta(cur);
              if (item.workspace && !cur.workspace && !cur.workspaces) cur.workspace = item.workspace;
              if (im.u.length && !cur.workspaces) cur.workspaces = im.u;
              if (im.parentId && !cm.parentId) cur.parentId = im.parentId;
            }
          }
          bridgeRecs = Array.isArray(sumRes?.records) ? sumRes.records : null;
        } catch {}
      } else if (!liveQuotaSnap) { try { await liveSnapProm; } catch {} }

      const resolvedScope = detectScope([...sumsMap], st, bridgeScopeKey);
      if (resolvedScope !== curScope) switchScope(resolvedScope);
      for (const hit of Array.isArray(bridgeRecs) ? bridgeRecs : []) {
        if (!hit?.id || !hit.record?.days) continue;
        const cur = usageRecords.get(hit.id);
        if (!cur || ((cur._do || !hasRealUsage(cur)) && hasRealUsage(hit.record))) { usageRecords.set(hit.id, hit.record); seededCache = true; }
      }

      if (curScope === 'local' && Array.isArray(liveQuotaSnap?.conversations)) {
        for (const c of liveQuotaSnap.conversations) if (c?.id && !sumsMap.has(c.id)) sumsMap.set(c.id, { stepCount: toNum(c.steps), subagent: !!c.subagent, parentConversationId: c.parentConversationId || '', rootConversationId: c.rootConversationId || '', workspace: c.workspace || '', modifiedAt: c.modifiedAt || '' });
      }
      const entries = [...sumsMap];
      const canPrune = bridgeOnline;
      const rawTitle = String((getDoc() || win?.document)?.title || '').trim();
      localSaveBlocked = curScope === 'local' && !!(usageBridge && !bridgeOnline) && (!rawTitle || /^antigravity$/i.test(rawTitle)) && !normalizeScopeKey(scOpt) && !normalizeScopeKey(win?.__agPrismScopeKey) && !bridgeScopeKey && !entries.some(([, s]) => wsUrisOf(s).some((u) => /^(?:file:\/\/|[a-z]:[\\/])/i.test(u)));
      detectedCurrentWorkspace = detectCurrentWorkspaceName(entries) || detectedCurrentWorkspace;
      if (entries.length === 0) { usageHasData = true; if (canPrune) lastUsageFetchAt = now; renderHomePanel(); return; }

      const staleIds = [];
      const presentIds = new Set();
      let patchedMeta = seededCache;
      for (const [id, sum] of entries) {
        presentIds.add(id);
        const m = extractMeta(sum);
        const cached = usageRecords.get(id);
        if (!cached || (bridgeOnline && cached._do) || toNum(cached.stepCount) !== m.stepCount || toNum(cached.lastModifiedSec) !== m.lastModifiedSec) staleIds.push([id, sum]);
        else if ((m.workspace && !cached.workspace) || (m.parentId && !cached.parentId)) { cached.workspace ||= m.workspace; cached.parentId ||= m.parentId; patchedMeta = true; }
      }
      if (patchedMeta) usageDataEpoch += 1;
      staleIds.sort((a, b) => extractMeta(b[1]).lastModifiedSec - extractMeta(a[1]).lastModifiedSec);

      let deletedAny = false;
      if (canPrune) {
        for (const oldId of [...usageRecords.keys()]) {
          if (!presentIds.has(oldId)) {
            const oldRec = usageRecords.get(oldId);
            if (oldRec?.subagent && oldRec?.parentId && presentIds.has(oldRec.parentId)) continue;
            usageRecords.delete(oldId); deletedAny = true;
          }
        }
      }
      if (deletedAny) usageDataEpoch += 1;
      if (staleIds.length === 0) { usageHasData = true; if (canPrune) lastUsageFetchAt = now; if (patchedMeta) saveUsageCache(); renderHomePanel(); return; }

      usageLoading = true;
      if (!usageHasData) renderHomePanel();
      const applyRecord = (id, sum, prev, rec, m) => {
        if (hasRealUsage(prev) && !hasRealUsage(rec)) usageRecords.set(id, advanceCachedCursor(prev, id, sum, true));
        else { const n = { ...rec, subagent: !!(rec.subagent || m.subagent), workspace: rec.workspace || m.workspace || '', parentId: rec.parentId || m.parentId || '' }; delete n._do; usageRecords.set(id, n); }
      };
      try {
        if (usageBridge && isFn(usageBridge.fetchBatch) && bridgeOnline) {
          for (let i = 0; i < staleIds.length && !isDestroyed(); i += 6) {
            const slice = staleIds.slice(i, i + 6);
            const reqItems = slice.map(([id, sum]) => {
              const c = usageRecords.get(id);
              const m = extractMeta(sum);
              const gm = toNum(c?.gmCount);
              return { id, stepCount: m.stepCount, lastModifiedSec: m.lastModifiedSec, createdSec: m.createdSec, subagent: m.subagent, workspace: m.workspace, ...(m.u.length ? { workspaces: m.u } : {}), parentId: m.parentId, gmOffset: c && !c._do && Number.isInteger(gm) && gm > 0 ? gm : 0 };
            });
            const res = await usageBridge.fetchBatch(reqItems, 18000);
            const byId = res?.ok && Array.isArray(res.records) ? new Map(res.records.map((r) => [r.id, r])) : null;
            for (const [id, sum] of slice) {
              const prev = usageRecords.get(id);
              const hit = byId?.get(id);
              const m = extractMeta(sum);
              if (hit?.mode === 'full' && hit.record) applyRecord(id, sum, prev, hit.record, m);
              else if (hit?.mode === 'delta' && hit.delta && usageCore.mergeUsageRecordDelta) {
                const nr = usageCore.mergeUsageRecordDelta(prev, hit.delta, { cascadeId: id, stepCount: m.stepCount, lastModifiedSec: m.lastModifiedSec, gmCount: toNum(hit.gmCount), subagent: m.subagent, workspace: m.workspace, parentId: m.parentId });
                if (nr && typeof nr === 'object') delete nr._do;
                usageRecords.set(id, nr);
              } else usageRecords.set(id, advanceCachedCursor(prev, id, sum, true));
            }
            if (i + 6 < staleIds.length && !isDestroyed()) await sleep(40);
          }
        } else {
          const CONC = usageHasData ? 1 : 2;
          const canDirect = isFn(h.svc?.getCascadeTrajectory);
          for (let i = 0; i < staleIds.length && !isDestroyed(); i += CONC) {
            await Promise.all(staleIds.slice(i, i + CONC).map(async ([id, sum]) => {
              const prev = usageRecords.get(id);
              const m = extractMeta(sum);
              if (!canDirect || m.stepCount > 240) { usageRecords.set(id, advanceCachedCursor(prev, id, sum, true)); return; }
              try {
                let tId = null;
                const toP = new Promise((_, rej) => { tId = setTimeout(() => rej(new Error('timeout')), 2800); });
                const res = await Promise.race([h.svc.getCascadeTrajectory({ cascadeId: id }), toP]).finally(() => { if (tId !== null) clearTimeout(tId); });
                applyRecord(id, sum, prev, usageCore.analyzeTrajectoryForUsage(res, sum, id), m);
              } catch { usageRecords.set(id, advanceCachedCursor(prev, id, sum, true)); }
            }));
            if (i + CONC < staleIds.length && !isDestroyed()) await sleep(usageHasData ? 120 : 24);
          }
        }
        if (!isDestroyed()) { usageHasData = true; usageDataEpoch += 1; if (canPrune) lastUsageFetchAt = Date.now(); saveUsageCache(); }
      } catch {
        if (!isDestroyed()) usageHasData = true;
      } finally {
        usageLoading = false;
        if (!isDestroyed()) renderHomePanel();
      }
    };

    const syncGreeting = (inHero) => {
      if (inHero && !wasHero) {
        if (!usageHasData) bookPick = Math.random();
        if (getHomeLayout() === 'studio') scheduleUsageRollupRefresh(1800);
      } else if (!inHero && deferredUsageTimer) { clearTimeout(deferredUsageTimer); deferredUsageTimer = 0; }
      wasHero = !!inHero;

      const h1 = getDoc()?.querySelector('[data-testid="home-greeting"] h1');
      if (!h1) return;
      if (getHomeLayout() !== 'studio') {
        h1.removeAttribute('data-ag-no-i18n');
        const orig = replacedGreetings.get(h1);
        if (orig !== undefined) { if (h1.textContent !== orig.host) h1.textContent = orig.host; replacedGreetings.delete(h1); }
        return;
      }
      const lang = getLang();
      const name = getDisplayName();
      const gMap = { 'zh-CN': '接下来做什么', 'zh-TW': '接下來做什麼', yue: '跟住想做啲咩', ja: '次は何をしますか' };
      const target = gMap[lang] ? gMap[lang] + (name ? (lang === 'ja' ? '、' : '，') + name : '') + '？' : "What's up next" + (name ? ', ' + name : '') + '?';
      setAttrIfChanged(h1, 'data-ag-no-i18n', '');
      if (h1.textContent !== target) {
        const prev = replacedGreetings.get(h1);
        const hostText = prev && h1.textContent === prev.written ? prev.host : h1.textContent || '';
        h1.textContent = target;
        replacedGreetings.set(h1, { host: hostText, written: target });
      }
    };

    const restoreGreetings = () => {
      for (const [el, rec] of replacedGreetings) {
        el.removeAttribute('data-ag-no-i18n');
        if (el.isConnected && el.textContent === rec.written) el.textContent = rec.host;
      }
      replacedGreetings.clear();
    };

    const hideHeatTip = () => {
      shownHeatCell = pendingHeatCell = null;
      if (heatTipRaf && isFn(G.cancelAnimationFrame)) { G.cancelAnimationFrame(heatTipRaf); heatTipRaf = 0; }
      if (heatTipEl) heatTipEl.removeAttribute('data-shown');
    };

    const flushHeatTip = () => {
      heatTipRaf = 0;
      const cell = pendingHeatCell;
      const grid = pendingHeatGrid;
      if (!cell || !grid || !heatTipEl || cell.isConnected === false) return;
      const tipText = cell.getAttribute('data-tip');
      if (!tipText) return;
      shownHeatCell = cell;
      const gW = grid.clientWidth || 480;
      const gH = grid.clientHeight || 96;
      const cL = cell.offsetLeft || 0;
      const cT = cell.offsetTop || 0;
      const cW = cell.offsetWidth || 10;
      const cH = cell.offsetHeight || 10;
      const estW = Math.max(88, Math.min(240, tipText.length * 6.8 + 18));
      const left = Math.min(Math.max(cL + cW * 0.5 - estW * 0.5, 0), Math.max(0, gW - estW));
      const top = gH - cT - cH > cT && gH - cT - cH >= 30 ? cT + cH + 6 : cT - 30;
      runGuardedMut(() => {
        if (heatTipEl.textContent !== tipText) heatTipEl.textContent = tipText;
        heatTipEl.style.transform = `translate3d(${Math.round(left)}px,${Math.round(top)}px,0)`;
        setAttrIfChanged(heatTipEl, 'data-shown', 'true');
      });
    };

    const showHeatTip = (cell, grid) => {
      if (!cell || !heatTipEl || cell === shownHeatCell) return;
      pendingHeatCell = cell; pendingHeatGrid = grid;
      if (isFn(G.requestAnimationFrame)) { if (!heatTipRaf) heatTipRaf = G.requestAnimationFrame(flushHeatTip); }
      else flushHeatTip();
    };

    const parkPanelSeat = () => {
      hideHeatTip();
      if (panelSeat?.parentElement) panelSeat.parentElement.removeChild(panelSeat);
    };

    const unmountPanelSeat = () => {
      if (deferredUsageTimer) { clearTimeout(deferredUsageTimer); deferredUsageTimer = 0; }
      parkPanelSeat();
      panelSeat = panelEl = heatTipEl = null;
      lastPanelRenderKey = '';
    };

    const ensurePanelSeat = () => {
      if (getHomeLayout() !== 'studio') { unmountPanelSeat(); return null; }
      const d = getDoc();
      const st = d?.head && d.getElementById(STUDIO_STYLE_ID);
      if (d?.head && (!st || st.textContent !== STUDIO_EXTRA_CSS)) {
        runGuardedMut(() => {
          if (st) st.textContent = STUDIO_EXTRA_CSS;
          else { const s = mk('style', '', STUDIO_EXTRA_CSS, { 'data-ag-owned': '1' }); s.id = STUDIO_STYLE_ID; ap(d.head, s); }
        });
      }
      const home = d?.querySelector('.agy-home');
      if (!home) { parkPanelSeat(); return null; }
      const greeting = home.querySelector('[data-testid="home-greeting"]');
      if (!greeting?.parentElement) return null;
      if (!panelSeat || !panelEl) {
        panelSeat = markNoTr(dv('ag-cs-home-panel-seat', { 'data-ag-no-i18n': '', 'data-ag-owned': '1' }));
        panelEl = mk('section', 'ag-cs-home-panel');
        ap(panelSeat, panelEl);
      }
      if (!panelSeat.isConnected || panelSeat.parentElement !== greeting.parentElement || panelSeat.previousSibling !== greeting) {
        greeting.parentElement.insertBefore(panelSeat, greeting.nextSibling);
      }
      return panelEl;
    };

    const renderQuotasView = (panel, lang, ui) => {
      const fmtTok = usageCore.formatCompactTokens;
      const qWin = usageCore.quotaWindows;
      const wrap = dv('ag-cs-quota-wrap');
      const refreshBtn = bt('ag-cs-quota-refresh', quotaLoading ? ui.thinkingEllipsis || 'Loading…' : ui.refreshBtnTitle || 'Refresh', () => {
        const now = Date.now();
        if (quotaLoading || inCooldown(lastManualRefreshAt, 5000, now)) return;
        lastManualRefreshAt = lastQuotaTabTriggerAt = now;
        void refreshLiveTelemetrySnapshot(true);
      });
      refreshBtn.disabled = quotaLoading;
      ap(wrap, ap(dv('ag-cs-quota-toolbar'), sp('', ui.quotaPoolsTitle || 'Model Quota Pools Remaining'), refreshBtn));

      const groups = Array.isArray(liveQuotaSnap?.groups) ? liveQuotaSnap.groups.filter((g) => g && (!qWin || qWin(g).length > 0)) : [];
      if (groups.length === 0) { ap(panel, ap(wrap, dv('ag-cs-home-models-empty', quotaLoading ? ui.quotaLoading || 'Loading…' : ui.quotaEmptyHint || 'Waiting for live quota snapshot…'))); return; }

      const grid = dv('ag-cs-quota-grid');
      const quotaWinUsage = liveQuotaSnap?.usage?.quotaWindows || null;
      const healthBadgeFor = (r) => (!(r >= 0 && r <= 1) ? { s: 'idle', l: '—' }
        : r <= 0.15 ? { s: 'low', l: lang === 'en' ? 'Low Quota' : lang === 'ja' ? '残枠少' : lang === 'zh-TW' || lang === 'yue' ? '額度偏低' : '额度偏低' }
        : r <= 0.35 ? { s: 'tight', l: lang === 'en' ? 'Running Low' : lang === 'ja' ? '残り少なめ' : lang === 'zh-TW' ? '餘量偏緊' : lang === 'yue' ? '餘額偏緊' : '余量偏紧' }
        : { s: 'ok', l: lang === 'en' ? 'Healthy' : lang === 'ja' ? '余裕あり' : '充裕' });
      for (const grp of groups) {
        const card = dv('ag-cs-quota-card', { 'data-quota-kind': usageCore.quotaGroupKind ? usageCore.quotaGroupKind(grp) : 'other' });
        const winEntries = [];
        let minRem = 2;
        for (const [wk, bucket] of qWin ? qWin(grp) : []) {
          const fc = usageCore.quotaForecast?.(bucket, wk);
          if (!fc) continue;
          const rem = isFin(fc.remaining) ? Math.max(0, Math.min(1, fc.remaining)) : 0;
          if (rem < minRem) minRem = rem;
          winEntries.push([wk, fc, rem]);
        }
        const bi = healthBadgeFor(minRem <= 1 ? minRem : -1);
        ap(card, ap(dv('ag-cs-quota-card-head'), sp('ag-cs-quota-name', usageCore.quotaGroupLabel ? usageCore.quotaGroupLabel(grp, lang) : grp.name || grp.id), sp('ag-cs-quota-pace', bi.l, { 'data-pace': bi.s })));

        for (const [wk, fc, rem] of winEntries) {
          const winBox = dv('ag-cs-quota-win', rem <= 0.15 ? { 'data-warn': '2' } : rem <= 0.35 ? { 'data-warn': '1' } : null);
          const eta = fc.resetInMs > 0 && usageCore.shortEta ? ` · ${usageCore.shortEta(fc.resetInMs, lang)}` : '';
          const solid = mk('i', 'ag-cs-qbar-solid');
          solid.style.width = `${(rem * 100).toFixed(1)}%`;
          ap(card, ap(winBox, ap(dv('ag-cs-quota-win-row'), sp('ag-cs-quota-win-lbl', wk === 'weekly' ? ui.weeklyLabel || 'Weekly' : ui.fiveHourLabel || '5h'), sp('ag-cs-quota-win-val', `${Math.round(rem * 100)}%${eta}`)), ap(dv('ag-cs-quota-bar'), solid)));
        }
        const footText = quotaWinUsage?.[grp.id]?.totalTokens > 0 ? `${fmtTok(quotaWinUsage[grp.id].totalTokens)} tok` : '';
        if (footText) ap(card, dv('ag-cs-quota-foot', footText));
        ap(grid, card);
      }
      ap(panel, ap(wrap, grid));
    };

    const renderHomePanel = (force = false) => {
      if (!usageCore) return;
      const panel = ensurePanelSeat();
      if (!panel) return;
      const fmtTok = usageCore.formatCompactTokens;
      const fmtCnt = usageCore.formatHomeCount;
      const lang = getLang();
      const ui = uiText(lang);
      const skeleton = !usageHasData;
      const aggKey = `${usageDataEpoch}|${usageRecords.size}|${activeRange}|${activeWorkspace}|${lang}|${bookPick}`;
      let data = cachedAggData;
      if (!data || cachedAggKey !== aggKey) {
        data = usageCore.aggregateUsageRollup([...usageRecords.values()], activeRange, bookPick, lang, undefined, { workspace: activeWorkspace });
        cachedAggKey = aggKey; cachedAggData = data;
      }
      const wsList = Array.isArray(data.workspaces) ? data.workspaces : [];
      if (activeWorkspace !== 'all' && wsList.length > 0 && !wsList.some((w) => w.id === activeWorkspace)) {
        activeWorkspace = 'all';
        return renderHomePanel(true);
      }
      const isQuotasTab = activeTab === 'quotas';
      const renderKey = [curScope, lang, activeTab, activeRange, activeWorkspace, +modelsExpanded, +skeleton, isQuotasTab ? +quotaLoading : 0, isQuotasTab ? quotaEpoch : 0, usageRecords.size, data.sessions, data.calls, data.tokens, data.subagentTokens || 0, data.cacheHitRate != null ? data.cacheHitRate.toFixed(3) : '-', data.activeDays, data.model || ''].join('|');
      if (!force && renderKey === lastPanelRenderKey && panel.childElementCount > 0) return;
      lastPanelRenderKey = renderKey;

      runGuardedMut(() => {
        panel.innerHTML = '';

        const headLeft = dv('ag-cs-home-head-left');
        const tabs = dv('ag-cs-home-tabs');
        for (const [id, label] of [['overview', ui.tabOverview || 'Overview'], ['models', ui.tabModels || 'Models'], ['quotas', ui.tabQuotas || 'Quotas']]) {
          ap(tabs, bt('ag-cs-home-tab', label, () => {
            activeTab = id;
            if (id === 'quotas' && !hasUsableQuotas(liveQuotaSnap)) {
              const now = Date.now();
              if (!inCooldown(lastQuotaTabTriggerAt, 20000, now)) { lastQuotaTabTriggerAt = now; void refreshLiveTelemetrySnapshot(false, { quotaRefresh: true, ignoreFailCooldown: true }); }
            }
            renderHomePanel();
          }, activeTab === id ? { 'data-tab': id, 'data-active': '' } : { 'data-tab': id }));
        }
        ap(headLeft, tabs);
        const scopeLabel = formatScopeBadge(curScope);
        if (scopeLabel) {
          const badge = markNoTr(sp('ag-cs-home-scope-badge', scopeLabel, { 'data-ag-no-i18n': '', 'data-scope': curScope, 'data-scope-kind': curScope.startsWith('ssh:') ? 'ssh' : 'remote' }));
          badge.title = scopeLabel;
          ap(headLeft, badge);
        }

        const headRight = dv('ag-cs-home-head-right');
        if (!isQuotasTab) {
          if (wsList.length > 0) {
            const sel = mk('select', 'ag-cs-home-ws-select', { 'data-ag-cs-ws-filter': '1', 'aria-label': ui.workspaceFilterAria || 'Workspace filter' });
            const addOpt = (v, t) => { const o = mk('option', '', t); o.value = v; ap(sel, o); };
            addOpt('all', ui.workspaceAll || 'All Projects');
            for (const ws of wsList) addOpt(ws.id, `${detectedCurrentWorkspace && ws.id === detectedCurrentWorkspace ? '● ' : ''}${ws.id} (${fmtTok(ws.tokens)})`);
            sel.value = activeWorkspace;
            sel.addEventListener('change', () => { activeWorkspace = sel.value || 'all'; renderHomePanel(); });
            ap(headRight, sel);
          }
          const ranges = dv('ag-cs-home-ranges');
          for (const r of usageCore.HOME_RANGES) {
            ap(ranges, bt('ag-cs-home-range', usageCore.homeRangeLabel ? usageCore.homeRangeLabel(r, lang) : r.labelEn, () => { activeRange = r.id; renderHomePanel(); }, activeRange === r.id ? { 'data-range': r.id, 'data-active': '' } : { 'data-range': r.id }));
          }
          ap(headRight, ranges);
        }
        ap(panel, ap(dv('ag-cs-home-panel-head'), headLeft, headRight));

        if (isQuotasTab) { renderQuotasView(panel, lang, ui); return; }

        if (activeTab === 'overview') {
          const stats = dv('ag-cs-home-stats');
          const cacheVal = isFin(data.cacheHitRate) ? usageCore.fmtPct(data.cacheHitRate * 100, 1) : '—';
          const cacheTitle = typeof data.cacheHitRate === 'number' ? `${ui.cacheRead || 'Cache'}: ${fmtTok(data.cacheReadTokens || 0)} / ${fmtTok(data.totalInput || 0)}${data.peakHour ? ` · ${data.peakHour}` : ''}` : data.peakHour || '—';
          const subTok = toNum(data.subagentTokens);
          const subSes = toNum(data.subagentSessions);
          const subPct = data.tokens > 0 && subTok > 0 ? Math.round((subTok / data.tokens) * 100) : 0;
          const swarmSub = subTok > 0 ? (isFn(ui.swarmSplitSub) ? ui.swarmSplitSub(100 - subPct, subPct) : `Main ${100 - subPct}% · Swarm ${subPct}%`) : '';

          for (const [k, lb, vt, tt, stx] of [
            ['sessions', ui.kpiSessions || 'Sessions', fmtCnt(data.sessions), subSes > 0 ? `${data.sessions} + ${subSes} subagents` : String(data.sessions)],
            ['calls', ui.kpiCalls || 'Messages', fmtCnt(data.calls), String(data.calls)],
            ['tokens', ui.kpiTokens || 'Total tokens', fmtTok(data.tokens), `${fmtCnt(data.tokens)} tokens${swarmSub ? ` (${swarmSub})` : ''}`, swarmSub],
            ['days', ui.kpiDays || 'Active days', fmtCnt(data.activeDays), String(data.activeDays)],
            ['cache', ui.kpiCacheHit || 'Cache Hit Rate', cacheVal, cacheTitle],
            ['model', ui.kpiFavModel || 'Favorite model', data.model || '—', data.model || '—'],
          ]) {
            const cell = dv('ag-cs-home-stat', skeleton ? { 'data-stat': k, 'data-skeleton': '' } : { 'data-stat': k });
            const val = sp('ag-cs-home-stat-value', skeleton ? '' : vt);
            if (!skeleton) val.title = tt;
            let sEl = null;
            if (!skeleton && stx) { sEl = sp('ag-cs-home-stat-sub', stx); sEl.title = tt; }
            ap(stats, ap(cell, sp('ag-cs-home-stat-label', lb), val, sEl));
          }
          ap(panel, stats);

          const heat = dv('ag-cs-home-heat', skeleton ? { 'data-skeleton': '' } : null);
          const fmt = usageCore.homeShortDateFormat(lang);
          const d = getDoc();
          const heatFrag = isFn(d?.createDocumentFragment) ? d.createDocumentFragment() : heat;
          for (const c of data.grid.cells) {
            const lv = String(c.level);
            const tip = skeleton ? '' : `${usageCore.homeShortDate(fmt, c.date)} — ${fmtTok(c.tokens)} ${ui.tokenUnit || 'tokens'}`;
            ap(heatFrag, sp('ag-cs-home-heat-cell', skeleton ? { 'data-level': lv } : { 'data-level': lv, 'data-tip': tip, 'aria-label': tip }));
          }
          if (heatFrag !== heat) ap(heat, heatFrag);
          heatTipEl = sp('ag-cs-home-heat-hint', { 'aria-hidden': 'true' });
          ap(heat, heatTipEl);
          heat.addEventListener('mouseover', (ev) => { const t = ev.target?.closest?.('.ag-cs-home-heat-cell'); if (t) showHeatTip(t, heat); });
          heat.addEventListener('mouseleave', hideHeatTip);
          ap(panel, heat, data.funBook ? sp('ag-cs-home-fun', data.funBook) : null);
        } else {
          const models = data.models || [];
          if (models.length === 0) { ap(panel, dv('ag-cs-home-models-empty', ui.noModelUsage || 'No model usage data yet')); return; }
          const ids = models.map((m) => m.id);
          const columns = data.modelDays || [];
          const fmt = usageCore.homeShortDateFormat(lang);
          for (const col of columns) for (const id of Object.keys(col.models || {})) ids.push(id);
          const colours = modelColours(ids);

          if (columns.length > 0) {
            let peak = 0;
            for (const col of columns) { let sum = 0; for (const t of Object.values(col.models)) sum += t; if (sum > peak) peak = sum; }
            const top = usageCore.axisMax(peak);
            const plot = dv('ag-cs-home-chart-plot');
            const bars = dv('ag-cs-home-chart-bars');
            for (const at of [1, 0.75, 0.5, 0.25, 0]) {
              const tick = sp('ag-cs-home-chart-tick', top > 0 ? fmtTok(top * at) : '');
              tick.style.bottom = `${at * 100}%`;
              ap(plot, tick);
            }
            for (const col of columns) {
              let dayTotal = 0;
              const stack = [];
              for (const [mId, tok] of Object.entries(col.models)) { dayTotal += tok; stack.push({ id: mId, tokens: tok }); }
              stack.sort((a, b) => b.tokens - a.tokens || a.id.localeCompare(b.id));
              const colEl = sp('ag-cs-home-chart-col');
              colEl.title = `${usageCore.homeShortDate(fmt, col.date)} · ${fmtTok(dayTotal)}`;
              colEl.style.height = `${top > 0 ? (dayTotal / top) * 100 : 0}%`;
              for (const slice of stack) {
                const seg = sp('ag-cs-home-chart-seg', { 'data-color': String(colours[slice.id] ?? 0) });
                seg.style.height = `${dayTotal > 0 ? (slice.tokens / dayTotal) * 100 : 0}%`;
                ap(colEl, seg);
              }
              ap(bars, colEl);
            }
            const axis = dv('ag-cs-home-chart-axis');
            ap(panel, ap(dv('ag-cs-home-chart'), ap(plot, bars), axis));
            G.requestAnimationFrame?.(() => {
              if (!axis.isConnected) return;
              const labels = columns.map((c) => usageCore.homeShortDate(fmt, c.date));
              const ticks = usageCore.homeChartTicks(labels.map((l) => Math.max(32, l.length * 6.5)), plot.clientWidth || 420);
              runGuardedMut(() => {
                axis.innerHTML = '';
                for (const tk of ticks) { const lb = sp('ag-cs-home-chart-label', labels[tk.index]); lb.style.left = `${tk.left}px`; ap(axis, lb); }
              });
            });
          }

          let totalAll = 0;
          for (const m of models) totalAll += m.tokens;
          const rowCap = usageCore.HOME_MODEL_ROWS;
          const shown = modelsExpanded ? models : models.slice(0, rowCap);
          const listEl = dv('ag-cs-home-models');
          for (const m of shown) {
            const row = dv('ag-cs-home-model');
            const subShare = m.tokens > 0 && m.subagentTokens > 0 ? ` · Swarm ${Math.round((m.subagentTokens / m.tokens) * 100)}%` : '';
            row.title = `${m.id} · ${m.sessions} ${ui.sessionsUnit || 'sessions'}${subShare}`;
            const inp = (m.input || 0) + (m.cacheRead || 0) + (m.cacheWrite || 0);
            const cacheTag = isFin(m.cacheHitRate) ? ` · ${Math.round(m.cacheHitRate * 100)}% ${ui.cacheShort || 'Cache'}` : '';
            ap(listEl, ap(row, sp('ag-cs-home-model-swatch', { 'data-color': String(colours[m.id] ?? 0) }), sp('ag-cs-home-model-name', m.id), sp('ag-cs-home-model-split', `${fmtTok(inp)} in · ${fmtTok(m.output || 0)} out${cacheTag}`), sp('ag-cs-home-model-share', totalAll > 0 ? (Math.round((m.tokens / totalAll) * 1000) / 10).toFixed(1) + '%' : '—')));
          }
          if (models.length > rowCap) {
            const hc = models.length - shown.length;
            ap(listEl, bt('ag-cs-home-models-more', modelsExpanded ? ui.showLess || 'Show less' : isFn(ui.showMoreN) ? ui.showMoreN(hc) : `Show ${hc} more`, () => { modelsExpanded = !modelsExpanded; renderHomePanel(); }));
          }
          ap(panel, listEl);
        }
      });
    };

    return {
      scheduleUsageRollupRefresh,
      refreshUsageRollup,
      refreshLiveTelemetrySnapshot,
      syncGreeting,
      restoreGreetings,
      parkPanelSeat,
      unmountPanelSeat,
      renderHomePanel,
      flushUsageCacheNow,
      wasHero: () => wasHero,
      getScopeKey: () => curScope,
      getUsageRecordsCount: () => usageRecords.size,
      hasConnectedPanel: () => Boolean(panelEl && panelEl.isConnected),
    };
  }

  const api = { createHomeStudioPanelController };
  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__agPrismHomeStudioPanel = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
