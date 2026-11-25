// Inject Obsidian Prism (obsidian-prism) into every open Antigravity window over CDP.
//
//   node inject.js           one-shot: inject now and exit
//   node inject.js --watch   daemon mode: auto-inject into new/reloaded windows
//                            and hot-reload style.css / *.js / config.json
const fs = require('fs');
const path = require('path');
const {
  PORT_FILE,
  PID_FILE,
  CONFIG_FILE,
  SETTING_BINDING,
  LEGACY_SETTING_BINDING,
  OMNI_BINDING,
  SIDEBAR_BINDING,
  INLINE_DIFF_BINDING,
  validateConfigEntry,
  reconcileConfigAliases,
  isEligibleTarget,
  readConfig,
  writeConfig,
  readPidFromLockFile,
  isExpectedDaemonProcess,
  readPort,
  listPages,
  CdpSession,
  buildInjectExpression,
  buildConfigRefreshExpression,
  buildOmniClientExpression,
  buildSidebarStudioExpression,
  shouldEnableHostI18n,
  buildHostI18nExpression,
  HOST_I18N_REMOVE_EXPRESSION,
  shouldEnableThought,
  buildThoughtExpression,
  THOUGHT_REMOVE_EXPRESSION,
  buildInlineDiffInjectExpression,
  INLINE_DIFF_REMOVE_EXPRESSION,
  shouldEnableCatSanctuary,
  buildCatSanctuaryExpression,
  buildCatSanctuaryCleanupExpression,
  CAT_SANCTUARY_REMOVE_EXPRESSION,
  shouldEnableEffortSlider,
  buildEffortSliderExpression,
  buildEffortSliderCleanupExpression,
  EFFORT_SLIDER_REMOVE_EXPRESSION,
  shouldEnableChatScene,
  buildChatSceneExpression,
  buildChatSceneCleanupExpression,
  CHAT_SCENE_REMOVE_EXPRESSION,
} = require('./cdp');

const FALLBACK_THOUGHT_REMOVE_EXPRESSION =
  "(() => { try { window.__agPrismThought?.destroy?.(); } catch {} try { document.querySelectorAll('[data-testid=\"prism-thought-ai-config\"],[data-testid=\"prism-thought-general-config\"]').forEach((n) => n.remove()); } catch {} try { delete window.__agPrismThought; } catch {} try { delete globalThis.__agPrismThought; } catch {} try { delete window.__agPrismThoughtSettingsUi; } catch {} try { delete globalThis.__agPrismThoughtSettingsUi; } catch {} return { ok: true, status: 'off' }; })()";
const FALLBACK_INLINE_DIFF_REMOVE_EXPRESSION =
  "(() => { try { window.__agPrismInlineDiff?.destroy?.(); } catch {} try { document.getElementById('ag-prism-inline-diff-css')?.remove(); } catch {} try { document.querySelectorAll('.ag-cs-inline-diff-box, .ag-cs-diff-ctx-menu').forEach((n) => n.remove()); } catch {} try { delete window.__agPrismInlineDiff; } catch {} try { delete globalThis.__agPrismInlineDiff; } catch {} try { delete window.__agPrismInlineDiffFactory; } catch {} try { delete globalThis.__agPrismInlineDiffFactory; } catch {} try { delete window.__agPrismInlineDiffResolve; } catch {} return { ok: true, status: 'off' }; })()";
const FALLBACK_CAT_SANCTUARY_REMOVE_EXPRESSION =
  "(() => { try { (window.__agCatSanctuaryBridge || globalThis.__agCatSanctuaryBridge)?.dispose?.(); } catch {} try { document.querySelectorAll?.('.ag-v2-cat-sanctuary')?.forEach?.((el) => el.remove()); } catch {} try { document.querySelectorAll?.('[data-cat-sanctuary=\"1\"]')?.forEach?.((el) => el.removeAttribute('data-cat-sanctuary')); } catch {} try { document.documentElement?.removeAttribute?.('data-ag-cat-peek'); } catch {} try { delete window.__agCatSanctuaryFactory; } catch {} try { delete globalThis.__agCatSanctuaryFactory; } catch {} try { delete window.__agPrismCatRimState; } catch {} try { delete globalThis.__agPrismCatRimState; } catch {} return { ok: true, status: 'off' }; })()";
const FALLBACK_EFFORT_SLIDER_REMOVE_EXPRESSION =
  "(() => { try { (window.__agPrismEffortSlider || globalThis.__agPrismEffortSlider)?.destroy?.(); } catch {} try { document.querySelector?.('#ag-codex-effort-slider-styles[data-ag-prism-slider=\"1\"]')?.remove?.(); } catch {} try { document.getElementById?.('ag-prism-effort-slider-hide')?.remove?.(); } catch {} try { delete window.__agPrismEffortSlider; } catch {} try { delete globalThis.__agPrismEffortSlider; } catch {} try { delete window.AntigravityCodexEffortSlider; } catch {} try { delete globalThis.AntigravityCodexEffortSlider; } catch {} return { ok: true, status: 'off' }; })()";
const FALLBACK_CHAT_SCENE_REMOVE_EXPRESSION =
  "(() => { try { (window.__agChatSceneController || globalThis.__agChatSceneController)?.dispose?.(); } catch {} try { document.getElementById?.('ag-prism-chat-scene-root')?.remove?.(); } catch {} try { document.getElementById?.('ag-prism-chat-scene-css')?.remove?.(); } catch {} try { document.documentElement?.removeAttribute?.('data-ag-chat-scene'); } catch {} try { delete window.__agChatSceneController; } catch {} try { delete globalThis.__agChatSceneController; } catch {} return { ok: true, status: 'off' }; })()";
const INLINE_DIFF_MAX_PAYLOAD_BYTES = 16384;
const INLINE_DIFF_MAX_URI_LENGTH = 2048;

function isCatSanctuaryEnabledForConfig(cfg, checker = shouldEnableCatSanctuary) {
  try {
    if (typeof checker === 'function') return Boolean(checker(cfg));
    return cfg?.mascot === 'cat';
  } catch {
    return false;
  }
}

function isEffortSliderEnabledForConfig(cfg, checker = shouldEnableEffortSlider) {
  try {
    if (typeof checker === 'function') return Boolean(checker(cfg));
    return cfg?.effortSliderModule !== 'off' && cfg?.effortSliderModule !== false;
  } catch {
    return true;
  }
}

function isChatSceneEnabledForConfig(cfg, checker = shouldEnableChatScene) {
  try {
    if (typeof checker === 'function') return Boolean(checker(cfg));
    return cfg?.chatScene === 'sky' || cfg?.chatScene === 'stationery';
  } catch {
    return false;
  }
}

function isThoughtEnabledForConfig(cfg, checker = shouldEnableThought) {
  try {
    if (typeof checker === 'function') return Boolean(checker(cfg));
    const mode = typeof cfg?.thoughtTranslate === 'string' ? cfg.thoughtTranslate.trim().toLowerCase() : 'off';
    return Boolean(mode && mode !== 'off');
  } catch {
    return false;
  }
}

const WATCH = process.argv.includes('--watch');
const LOG_FILE = path.join(__dirname, 'watch.log');

function log(...args) {
  const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log(line);
  if (WATCH) {
    try {
      fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`);
    } catch {}
  }
}

function shortTitle(page) {
  const t = page.title || page.url;
  return t.length > 60 ? t.slice(0, 57) + '...' : t;
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

function updateConfigBatch(entriesObj) {
  if (!entriesObj || typeof entriesObj !== 'object' || Array.isArray(entriesObj)) return false;
  const patch = {};
  let count = 0;
  for (const [k, v] of Object.entries(entriesObj)) {
    if (validateConfigEntry(k, v)) {
      patch[k] = v;
      count += 1;
    }
  }
  if (count === 0) return false;
  const reconciledPatch = typeof reconcileConfigAliases === 'function' ? reconcileConfigAliases(patch) : patch;
  const next = { ...readConfig(), ...reconciledPatch };
  writeConfig(next);
  return true;
}

function updateConfigSetting(key, value) {
  return updateConfigBatch({ [key]: value });
}

function createFastConfigRefreshBroadcaster({
  attached,
  readConfig: readCfg = readConfig,
  buildInjectExpression: buildInj = buildInjectExpression,
  buildConfigRefreshExpression: buildRefresh = buildConfigRefreshExpression,
  buildOmniClientExpression: buildOmni = buildOmniClientExpression,
  buildSidebarStudioExpression: buildSidebar = buildSidebarStudioExpression,
  shouldEnableHostI18n: shouldHostI18n = shouldEnableHostI18n,
  buildHostI18nExpression: buildHostI18n = buildHostI18nExpression,
  hostI18nRemoveExpression = HOST_I18N_REMOVE_EXPRESSION,
  getThoughtHooks = () => ({
    shouldEnable: shouldEnableThought,
    buildExpression: buildThoughtExpression,
    removeExpression: THOUGHT_REMOVE_EXPRESSION || FALLBACK_THOUGHT_REMOVE_EXPRESSION,
  }),
  getInlineDiffHooks = () => ({
    buildExpression: buildInlineDiffInjectExpression,
    removeExpression: INLINE_DIFF_REMOVE_EXPRESSION || FALLBACK_INLINE_DIFF_REMOVE_EXPRESSION,
  }),
  getCatSanctuaryHooks = () => ({
    shouldEnable: shouldEnableCatSanctuary,
    buildExpression: buildCatSanctuaryExpression,
    removeExpression:
      (typeof buildCatSanctuaryCleanupExpression === 'function' ? buildCatSanctuaryCleanupExpression() : '') ||
      CAT_SANCTUARY_REMOVE_EXPRESSION ||
      FALLBACK_CAT_SANCTUARY_REMOVE_EXPRESSION,
  }),
  getEffortSliderHooks = null,
  getChatSceneHooks = null,
  getOmniServerInfo = () => null,
  getSidebarServiceReady = () => false,
  sidebarBinding = SIDEBAR_BINDING,
  ensureSidebarBinding = async () => false,
  onExpressionsUpdated = null,
} = {}) {
  return async function broadcastFastConfigRefresh() {
    const perEntryAck = new Map();
    for (const entry of attached.values()) {
      if (!entry || entry.session.closed) continue;
      const ack = Number.isSafeInteger(entry.pendingAckEpoch) && entry.pendingAckEpoch > 0 ? entry.pendingAckEpoch : 0;
      entry.pendingAckEpoch = 0;
      perEntryAck.set(entry, ack);
    }
    const cfgNow = typeof readCfg === 'function' ? readCfg() : {};
    const omniEnabled = cfgNow?.omniModule !== 'off';
    const sidebarEnabled = cfgNow?.sidebarStudio === 'on';
    const expr = buildInj();
    const omniExpr =
      omniEnabled && typeof buildOmni === 'function'
        ? buildOmni(getOmniServerInfo())
        : '';
    const sidebarExpr =
      sidebarEnabled && typeof buildSidebar === 'function'
        ? buildSidebar({ binding: sidebarBinding, serviceReady: Boolean(getSidebarServiceReady()) })
        : '';
    const hostI18nEnabled = typeof shouldHostI18n === 'function' ? shouldHostI18n(cfgNow) : false;
    const hostI18nExpr =
      hostI18nEnabled && typeof buildHostI18n === 'function'
        ? buildHostI18n(cfgNow)
        : '';
    const thoughtHooks = getThoughtHooks() || {};
    const thoughtEnabled = isThoughtEnabledForConfig(cfgNow, thoughtHooks.shouldEnable);
    const thoughtExpr =
      thoughtEnabled && typeof thoughtHooks.buildExpression === 'function'
        ? thoughtHooks.buildExpression(cfgNow)
        : '';
    const thoughtRemoveExpr = thoughtHooks.removeExpression || FALLBACK_THOUGHT_REMOVE_EXPRESSION;
    const inlineDiffHooks = getInlineDiffHooks() || {};
    const inlineDiffExpr =
      typeof inlineDiffHooks.buildExpression === 'function'
        ? inlineDiffHooks.buildExpression(cfgNow)
        : '';
    const inlineDiffHashMatch = inlineDiffExpr ? /const targetHash = "([^"]+)"/.exec(inlineDiffExpr) : null;
    const inlineDiffHash = inlineDiffHashMatch ? inlineDiffHashMatch[1] : inlineDiffExpr;
    const inlineDiffRemoveExpr = inlineDiffHooks.removeExpression || FALLBACK_INLINE_DIFF_REMOVE_EXPRESSION;
    const catSanctuaryHooks = getCatSanctuaryHooks() || {};
    const catSanctuaryEnabled = isCatSanctuaryEnabledForConfig(cfgNow, catSanctuaryHooks.shouldEnable);
    const catSanctuaryExpr =
      catSanctuaryEnabled && typeof catSanctuaryHooks.buildExpression === 'function'
        ? catSanctuaryHooks.buildExpression(cfgNow)
        : '';
    const catSanctuaryHashMatch = catSanctuaryExpr ? /const targetHash = "([^"]+)"/.exec(catSanctuaryExpr) : null;
    const catSanctuaryHash = catSanctuaryHashMatch ? catSanctuaryHashMatch[1] : catSanctuaryExpr;
    const catSanctuaryRemoveExpr = catSanctuaryHooks.removeExpression || FALLBACK_CAT_SANCTUARY_REMOVE_EXPRESSION;
    const effortSliderHooks =
      typeof getEffortSliderHooks === 'function'
        ? getEffortSliderHooks() || {}
        : buildInj === buildInjectExpression
        ? {
            shouldEnable: shouldEnableEffortSlider,
            buildExpression: buildEffortSliderExpression,
            removeExpression:
              (typeof buildEffortSliderCleanupExpression === 'function' ? buildEffortSliderCleanupExpression() : '') ||
              EFFORT_SLIDER_REMOVE_EXPRESSION ||
              FALLBACK_EFFORT_SLIDER_REMOVE_EXPRESSION,
          }
        : { shouldEnable: () => false, buildExpression: () => '', removeExpression: '' };
    const effortSliderEnabled = isEffortSliderEnabledForConfig(cfgNow, effortSliderHooks.shouldEnable);
    const effortSliderExpr =
      effortSliderEnabled && typeof effortSliderHooks.buildExpression === 'function'
        ? effortSliderHooks.buildExpression(cfgNow)
        : '';
    const effortSliderHashMatch = effortSliderExpr ? /const targetHash = "([^"]+)"/.exec(effortSliderExpr) : null;
    const effortSliderHash = effortSliderHashMatch ? effortSliderHashMatch[1] : effortSliderExpr;
    const effortSliderRemoveExpr = effortSliderHooks.removeExpression || FALLBACK_EFFORT_SLIDER_REMOVE_EXPRESSION;
    const chatSceneHooks =
      typeof getChatSceneHooks === 'function'
        ? getChatSceneHooks() || {}
        : buildInj === buildInjectExpression
        ? {
            shouldEnable: shouldEnableChatScene,
            buildExpression: buildChatSceneExpression,
            removeExpression:
              (typeof buildChatSceneCleanupExpression === 'function' ? buildChatSceneCleanupExpression() : '') ||
              CHAT_SCENE_REMOVE_EXPRESSION ||
              FALLBACK_CHAT_SCENE_REMOVE_EXPRESSION,
          }
        : { shouldEnable: () => false, buildExpression: () => '', removeExpression: '' };
    const chatSceneEnabled = isChatSceneEnabledForConfig(cfgNow, chatSceneHooks.shouldEnable);
    const chatSceneExpr =
      chatSceneEnabled && typeof chatSceneHooks.buildExpression === 'function'
        ? chatSceneHooks.buildExpression(cfgNow)
        : '';
    const chatSceneHashMatch = chatSceneExpr ? /const targetHash = "([^"]+)"/.exec(chatSceneExpr) : null;
    const chatSceneHash = chatSceneHashMatch ? chatSceneHashMatch[1] : chatSceneExpr;
    const chatSceneSig = chatSceneEnabled && chatSceneExpr ? `${cfgNow?.chatScene || ''}:${chatSceneHash}` : '';
    const chatSceneRemoveExpr = chatSceneHooks.removeExpression || FALLBACK_CHAT_SCENE_REMOVE_EXPRESSION;
    if (typeof onExpressionsUpdated === 'function') {
      onExpressionsUpdated({ expr, omniExpr, sidebarExpr, hostI18nExpr, thoughtExpr, inlineDiffExpr, catSanctuaryExpr, effortSliderExpr, chatSceneExpr });
    }
    const canFastRefresh = typeof buildRefresh === 'function';
    const baseRefreshExpr = canFastRefresh ? buildRefresh() : null;
    for (const entry of attached.values()) {
      if (!entry || entry.session.closed) continue;
      try {
        await ensureSidebarBinding(entry.session, entry, cfgNow);
        const entryAck = perEntryAck.get(entry) || 0;
        const refreshExpr =
          canFastRefresh && entryAck > 0
            ? buildRefresh(null, { __ackEpoch: entryAck })
            : baseRefreshExpr;
        if (refreshExpr) {
          const fast = await entry.session.evaluate(refreshExpr).catch(() => null);
          if (fast && fast.refreshed) {
            if (omniEnabled && omniExpr && !fast.skippedStale) await entry.session.evaluate(omniExpr).catch(() => {});
            if (sidebarEnabled && sidebarExpr && !fast.skippedStale) await entry.session.evaluate(sidebarExpr).catch(() => {});
            if (!fast.skippedStale) {
              if (hostI18nExpr && hostI18nEnabled) await entry.session.evaluate(hostI18nExpr).catch(() => {});
              else if (hostI18nRemoveExpression) await entry.session.evaluate(hostI18nRemoveExpression).catch(() => {});
              if (thoughtExpr && thoughtEnabled) {
                const thRes = await entry.session.evaluate(thoughtExpr).catch(() => null);
                if (thRes && thRes.ok) entry.thoughtMounted = true;
              } else if (entry.thoughtScriptId || entry.thoughtMounted) {
                if (thoughtRemoveExpr) await entry.session.evaluate(thoughtRemoveExpr).catch(() => {});
                entry.thoughtMounted = false;
              }
              if (inlineDiffExpr) {
                if (!entry.inlineDiffSkipped && (!entry.inlineDiffMounted || !entry.inlineDiffScriptId || entry.lastInlineDiffHash !== inlineDiffHash)) {
                  const idRes = await entry.session.evaluate(inlineDiffExpr).catch(() => null);
                  const idSkipped = Boolean(idRes && typeof idRes.status === 'string' && idRes.status.startsWith('skipped-'));
                  if (idRes && idRes.ok) {
                    entry.inlineDiffMounted = true;
                    entry.inlineDiffSkipped = false;
                    entry.lastInlineDiffHash = inlineDiffHash;
                  } else if (idSkipped) {
                    entry.inlineDiffMounted = false;
                    entry.inlineDiffSkipped = true;
                    entry.lastInlineDiffHash = inlineDiffHash;
                    if (idRes.status === 'skipped-non-host' && INLINE_DIFF_BINDING) {
                      await entry.session.send('Runtime.removeBinding', { name: INLINE_DIFF_BINDING }).catch(() => {});
                      entry.inlineDiffBindingAdded = false;
                    }
                  }
                }
              } else if (entry.inlineDiffScriptId || entry.inlineDiffMounted) {
                if (inlineDiffRemoveExpr) await entry.session.evaluate(inlineDiffRemoveExpr).catch(() => {});
                entry.inlineDiffMounted = false;
                entry.inlineDiffSkipped = false;
                entry.lastInlineDiffHash = '';
              }
              if (catSanctuaryExpr && catSanctuaryEnabled) {
                if (!entry.catSanctuarySkipped && (!entry.catSanctuaryMounted || !entry.catSanctuaryScriptId || entry.lastCatSanctuaryHash !== catSanctuaryHash)) {
                  const csRes = await entry.session.evaluate(catSanctuaryExpr).catch(() => null);
                  const csSkipped = Boolean(csRes && typeof csRes.status === 'string' && csRes.status.startsWith('skipped-'));
                  if (csRes && csRes.ok) {
                    entry.catSanctuaryMounted = true;
                    entry.catSanctuarySkipped = false;
                    entry.lastCatSanctuaryHash = catSanctuaryHash;
                  } else if (csSkipped) {
                    entry.catSanctuaryMounted = false;
                    entry.catSanctuarySkipped = true;
                    entry.lastCatSanctuaryHash = catSanctuaryHash;
                  }
                }
              } else if (entry.catSanctuaryScriptId || entry.catSanctuaryMounted) {
                if (catSanctuaryRemoveExpr) await entry.session.evaluate(catSanctuaryRemoveExpr).catch(() => {});
                entry.catSanctuaryMounted = false;
                entry.catSanctuarySkipped = false;
                entry.lastCatSanctuaryHash = '';
              }
              if (effortSliderExpr && effortSliderEnabled) {
                if (!entry.effortSliderSkipped && (!entry.effortSliderMounted || !entry.effortSliderScriptId || entry.lastEffortSliderHash !== effortSliderHash)) {
                  const esRes = await entry.session.evaluate(effortSliderExpr).catch(() => null);
                  const esSkipped = Boolean(esRes && typeof esRes.status === 'string' && esRes.status.startsWith('skipped-'));
                  if (esRes && esRes.ok) {
                    entry.effortSliderMounted = true;
                    entry.effortSliderSkipped = false;
                    entry.lastEffortSliderHash = effortSliderHash;
                  } else if (esSkipped) {
                    entry.effortSliderMounted = false;
                    entry.effortSliderSkipped = true;
                    entry.lastEffortSliderHash = effortSliderHash;
                  }
                }
              } else if (entry.effortSliderScriptId || entry.effortSliderMounted) {
                if (effortSliderRemoveExpr) await entry.session.evaluate(effortSliderRemoveExpr).catch(() => {});
                entry.effortSliderMounted = false;
                entry.effortSliderSkipped = false;
                entry.lastEffortSliderHash = '';
              }
              if (chatSceneExpr && chatSceneEnabled) {
                if (!entry.chatSceneSkipped && (!entry.chatSceneMounted || !entry.chatSceneScriptId || entry.lastChatSceneSig !== chatSceneSig)) {
                  const scRes = await entry.session.evaluate(chatSceneExpr).catch(() => null);
                  const scSkipped = Boolean(scRes && typeof scRes.status === 'string' && scRes.status.startsWith('skipped-'));
                  if (scRes && scRes.ok) {
                    entry.chatSceneMounted = true;
                    entry.chatSceneSkipped = false;
                    entry.lastChatSceneSig = chatSceneSig;
                  } else if (scSkipped) {
                    entry.chatSceneMounted = false;
                    entry.chatSceneSkipped = true;
                    entry.lastChatSceneSig = chatSceneSig;
                  }
                }
              } else if (entry.chatSceneScriptId || entry.chatSceneMounted) {
                if (chatSceneRemoveExpr) await entry.session.evaluate(chatSceneRemoveExpr).catch(() => {});
                entry.chatSceneMounted = false;
                entry.chatSceneSkipped = false;
                entry.lastChatSceneSig = '';
              }
            }
          } else {
            const reRes = await entry.session.evaluate(expr).catch(() => null);
            entry.sidebarHostVerified = Boolean(reRes && reRes.status === 'ok');
            if (reRes && reRes.status === 'skipped-non-host') {
              if (entry.sidebarBindingAdded && sidebarBinding) {
                await entry.session.send('Runtime.removeBinding', { name: sidebarBinding }).catch(() => {});
                entry.sidebarBindingAdded = false;
              }
              if (INLINE_DIFF_BINDING) {
                await entry.session.send('Runtime.removeBinding', { name: INLINE_DIFF_BINDING }).catch(() => {});
                entry.inlineDiffBindingAdded = false;
              }
              entry.inlineDiffMounted = false;
              entry.inlineDiffSkipped = true;
              entry.catSanctuaryMounted = false;
              entry.catSanctuarySkipped = true;
              entry.effortSliderMounted = false;
              entry.effortSliderSkipped = true;
              entry.chatSceneMounted = false;
              entry.chatSceneSkipped = true;
              continue;
            }
            if (omniEnabled && omniExpr) await entry.session.evaluate(omniExpr).catch(() => {});
            if (sidebarEnabled && sidebarExpr) await entry.session.evaluate(sidebarExpr).catch(() => {});
            if (hostI18nExpr && hostI18nEnabled) await entry.session.evaluate(hostI18nExpr).catch(() => {});
            else if (hostI18nRemoveExpression) await entry.session.evaluate(hostI18nRemoveExpression).catch(() => {});
            if (thoughtExpr && thoughtEnabled) {
              const thRes = await entry.session.evaluate(thoughtExpr).catch(() => null);
              if (thRes && thRes.ok) entry.thoughtMounted = true;
            } else if (entry.thoughtScriptId || entry.thoughtMounted) {
              if (thoughtRemoveExpr) await entry.session.evaluate(thoughtRemoveExpr).catch(() => {});
              entry.thoughtMounted = false;
            }
            if (inlineDiffExpr) {
              const idRes = await entry.session.evaluate(inlineDiffExpr).catch(() => null);
              const idSkipped = Boolean(idRes && typeof idRes.status === 'string' && idRes.status.startsWith('skipped-'));
              if (idRes && idRes.ok) {
                entry.inlineDiffMounted = true;
                entry.inlineDiffSkipped = false;
                entry.lastInlineDiffHash = inlineDiffHash;
              } else if (idSkipped) {
                entry.inlineDiffMounted = false;
                entry.inlineDiffSkipped = true;
                entry.lastInlineDiffHash = inlineDiffHash;
                if (idRes.status === 'skipped-non-host' && INLINE_DIFF_BINDING) {
                  await entry.session.send('Runtime.removeBinding', { name: INLINE_DIFF_BINDING }).catch(() => {});
                  entry.inlineDiffBindingAdded = false;
                }
              }
            } else if (entry.inlineDiffScriptId || entry.inlineDiffMounted) {
              if (inlineDiffRemoveExpr) await entry.session.evaluate(inlineDiffRemoveExpr).catch(() => {});
              entry.inlineDiffMounted = false;
              entry.inlineDiffSkipped = false;
              entry.lastInlineDiffHash = '';
            }
            if (catSanctuaryExpr && catSanctuaryEnabled) {
              const csRes = await entry.session.evaluate(catSanctuaryExpr).catch(() => null);
              const csSkipped = Boolean(csRes && typeof csRes.status === 'string' && csRes.status.startsWith('skipped-'));
              if (csRes && csRes.ok) {
                entry.catSanctuaryMounted = true;
                entry.catSanctuarySkipped = false;
                entry.lastCatSanctuaryHash = catSanctuaryHash;
              } else if (csSkipped) {
                entry.catSanctuaryMounted = false;
                entry.catSanctuarySkipped = true;
                entry.lastCatSanctuaryHash = catSanctuaryHash;
              }
            } else if (entry.catSanctuaryScriptId || entry.catSanctuaryMounted) {
              if (catSanctuaryRemoveExpr) await entry.session.evaluate(catSanctuaryRemoveExpr).catch(() => {});
              entry.catSanctuaryMounted = false;
              entry.catSanctuarySkipped = false;
              entry.lastCatSanctuaryHash = '';
            }
            if (effortSliderExpr && effortSliderEnabled) {
              const esRes = await entry.session.evaluate(effortSliderExpr).catch(() => null);
              const esSkipped = Boolean(esRes && typeof esRes.status === 'string' && esRes.status.startsWith('skipped-'));
              if (esRes && esRes.ok) {
                entry.effortSliderMounted = true;
                entry.effortSliderSkipped = false;
                entry.lastEffortSliderHash = effortSliderHash;
              } else if (esSkipped) {
                entry.effortSliderMounted = false;
                entry.effortSliderSkipped = true;
                entry.lastEffortSliderHash = effortSliderHash;
              }
            } else if (entry.effortSliderScriptId || entry.effortSliderMounted) {
              if (effortSliderRemoveExpr) await entry.session.evaluate(effortSliderRemoveExpr).catch(() => {});
              entry.effortSliderMounted = false;
              entry.effortSliderSkipped = false;
              entry.lastEffortSliderHash = '';
            }
            if (chatSceneExpr && chatSceneEnabled) {
              const scRes = await entry.session.evaluate(chatSceneExpr).catch(() => null);
              const scSkipped = Boolean(scRes && typeof scRes.status === 'string' && scRes.status.startsWith('skipped-'));
              if (scRes && scRes.ok) {
                entry.chatSceneMounted = true;
                entry.chatSceneSkipped = false;
                entry.lastChatSceneSig = chatSceneSig;
              } else if (scSkipped) {
                entry.chatSceneMounted = false;
                entry.chatSceneSkipped = true;
                entry.lastChatSceneSig = chatSceneSig;
              }
            } else if (entry.chatSceneScriptId || entry.chatSceneMounted) {
              if (chatSceneRemoveExpr) await entry.session.evaluate(chatSceneRemoveExpr).catch(() => {});
              entry.chatSceneMounted = false;
              entry.chatSceneSkipped = false;
              entry.lastChatSceneSig = '';
            }
          }
        }
        if (entry.scriptId) {
          await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId }).catch(() => {});
        }
        const addRes = await entry.session.send('Page.addScriptToEvaluateOnNewDocument', { source: expr }).catch(() => null);
        entry.scriptId = addRes && addRes.identifier ? addRes.identifier : null;
        if (entry.omniScriptId) {
          await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId }).catch(() => {});
          entry.omniScriptId = null;
        }
        if (omniEnabled && omniExpr) {
          const omniAdd = await entry.session.send('Page.addScriptToEvaluateOnNewDocument', { source: omniExpr }).catch(() => null);
          entry.omniScriptId = omniAdd && omniAdd.identifier ? omniAdd.identifier : null;
        }
        if (entry.sidebarScriptId) {
          await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId }).catch(() => {});
          entry.sidebarScriptId = null;
        }
        if (sidebarEnabled && sidebarExpr) {
          const sbAdd = await entry.session.send('Page.addScriptToEvaluateOnNewDocument', { source: sidebarExpr }).catch(() => null);
          entry.sidebarScriptId = sbAdd && sbAdd.identifier ? sbAdd.identifier : null;
        }
        if (entry.hostI18nScriptId) {
          await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId }).catch(() => {});
          entry.hostI18nScriptId = null;
        }
        if (hostI18nExpr && hostI18nEnabled) {
          const hiAdd = await entry.session.send('Page.addScriptToEvaluateOnNewDocument', { source: hostI18nExpr }).catch(() => null);
          entry.hostI18nScriptId = hiAdd && hiAdd.identifier ? hiAdd.identifier : null;
        }
        if (entry.thoughtScriptId) {
          await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.thoughtScriptId }).catch(() => {});
          entry.thoughtScriptId = null;
        }
        if (thoughtExpr && thoughtEnabled) {
          const thAdd = await entry.session.send('Page.addScriptToEvaluateOnNewDocument', { source: thoughtExpr }).catch(() => null);
          entry.thoughtScriptId = thAdd && thAdd.identifier ? thAdd.identifier : null;
        }
        if (entry.inlineDiffScriptId) {
          await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.inlineDiffScriptId }).catch(() => {});
          entry.inlineDiffScriptId = null;
        }
        if (inlineDiffExpr) {
          const idAdd = await entry.session.send('Page.addScriptToEvaluateOnNewDocument', { source: inlineDiffExpr }).catch(() => null);
          entry.inlineDiffScriptId = idAdd && idAdd.identifier ? idAdd.identifier : null;
          if (entry.inlineDiffScriptId) entry.lastInlineDiffHash = inlineDiffHash;
        }
        if (entry.catSanctuaryScriptId) {
          await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.catSanctuaryScriptId }).catch(() => {});
          entry.catSanctuaryScriptId = null;
        }
        if (catSanctuaryExpr && catSanctuaryEnabled) {
          const csAdd = await entry.session.send('Page.addScriptToEvaluateOnNewDocument', { source: catSanctuaryExpr }).catch(() => null);
          entry.catSanctuaryScriptId = csAdd && csAdd.identifier ? csAdd.identifier : null;
          if (entry.catSanctuaryScriptId) entry.lastCatSanctuaryHash = catSanctuaryHash;
        }
        if (entry.effortSliderScriptId) {
          await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.effortSliderScriptId }).catch(() => {});
          entry.effortSliderScriptId = null;
        }
        if (effortSliderExpr && effortSliderEnabled) {
          const esAdd = await entry.session.send('Page.addScriptToEvaluateOnNewDocument', { source: effortSliderExpr }).catch(() => null);
          entry.effortSliderScriptId = esAdd && esAdd.identifier ? esAdd.identifier : null;
          if (entry.effortSliderScriptId) entry.lastEffortSliderHash = effortSliderHash;
        }
        if (entry.chatSceneScriptId) {
          await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.chatSceneScriptId }).catch(() => {});
          entry.chatSceneScriptId = null;
        }
        if (chatSceneExpr && chatSceneEnabled) {
          const scAdd = await entry.session.send('Page.addScriptToEvaluateOnNewDocument', { source: chatSceneExpr }).catch(() => null);
          entry.chatSceneScriptId = scAdd && scAdd.identifier ? scAdd.identifier : null;
          if (entry.chatSceneScriptId) entry.lastChatSceneSig = chatSceneSig;
        }
      } catch {}
    }
  };
}

async function injectOnce() {
  const port = readPort();
  if (!port) {
    throw new Error(`未找到调试端口文件，Antigravity 可能未运行: ${PORT_FILE}`);
  }
  let pages;
  try {
    pages = await listPages(port);
  } catch {
    throw new Error(`端口 ${port} 无响应：请确认 Antigravity 正在运行`);
  }
  const targets = pages.filter(isEligibleTarget);
  if (targets.length === 0) throw new Error('未找到 Antigravity 窗口页面');

  log(`[+] 调试端口 ${port}，发现 ${targets.length} 个窗口`);
  const cfgNow = typeof readConfig === 'function' ? readConfig() : {};
  const omniEnabled = cfgNow?.omniModule !== 'off';
  const sidebarEnabled = cfgNow?.sidebarStudio === 'on';
  const expr = buildInjectExpression();
  const omniExpr = omniEnabled && typeof buildOmniClientExpression === 'function' ? buildOmniClientExpression(null) : '';
  const sidebarExpr =
    sidebarEnabled && typeof buildSidebarStudioExpression === 'function'
      ? buildSidebarStudioExpression({ binding: SIDEBAR_BINDING })
      : '';
  const hostI18nExpr =
    typeof buildHostI18nExpression === 'function'
      ? buildHostI18nExpression()
      : '';
  const thoughtExpr =
    isThoughtEnabledForConfig(cfgNow) && typeof buildThoughtExpression === 'function'
      ? buildThoughtExpression(cfgNow)
      : '';
  const inlineDiffExpr =
    typeof buildInlineDiffInjectExpression === 'function'
      ? buildInlineDiffInjectExpression(cfgNow)
      : '';
  const catSanctuaryExpr =
    isCatSanctuaryEnabledForConfig(cfgNow) && typeof buildCatSanctuaryExpression === 'function'
      ? buildCatSanctuaryExpression(cfgNow)
      : '';
  const catSanctuaryRemoveExpr =
    (typeof buildCatSanctuaryCleanupExpression === 'function' ? buildCatSanctuaryCleanupExpression() : '') ||
    CAT_SANCTUARY_REMOVE_EXPRESSION ||
    FALLBACK_CAT_SANCTUARY_REMOVE_EXPRESSION;
  const effortSliderExpr =
    isEffortSliderEnabledForConfig(cfgNow) && typeof buildEffortSliderExpression === 'function'
      ? buildEffortSliderExpression(cfgNow)
      : '';
  const effortSliderRemoveExpr =
    (typeof buildEffortSliderCleanupExpression === 'function' ? buildEffortSliderCleanupExpression() : '') ||
    EFFORT_SLIDER_REMOVE_EXPRESSION ||
    FALLBACK_EFFORT_SLIDER_REMOVE_EXPRESSION;
  const chatSceneExpr =
    isChatSceneEnabledForConfig(cfgNow) && typeof buildChatSceneExpression === 'function'
      ? buildChatSceneExpression(cfgNow)
      : '';
  const chatSceneRemoveExpr =
    (typeof buildChatSceneCleanupExpression === 'function' ? buildChatSceneCleanupExpression() : '') ||
    CHAT_SCENE_REMOVE_EXPRESSION ||
    FALLBACK_CHAT_SCENE_REMOVE_EXPRESSION;
  for (const page of targets) {
    let session = null;
    try {
      session = await CdpSession.connect(page.webSocketDebuggerUrl);
      const res = await session.evaluate(expr);
      if (omniExpr) {
        await session.evaluate(omniExpr).catch(() => {});
      }
      if (sidebarExpr) {
        await session.evaluate(sidebarExpr).catch(() => {});
      }
      if (hostI18nExpr) {
        await session.evaluate(hostI18nExpr).catch(() => {});
      } else if (HOST_I18N_REMOVE_EXPRESSION) {
        await session.evaluate(HOST_I18N_REMOVE_EXPRESSION).catch(() => {});
      }
      if (thoughtExpr) {
        await session.evaluate(thoughtExpr).catch(() => {});
      } else if (THOUGHT_REMOVE_EXPRESSION) {
        await session.evaluate(THOUGHT_REMOVE_EXPRESSION).catch(() => {});
      }
      if (inlineDiffExpr) {
        await session.evaluate(inlineDiffExpr).catch(() => {});
      }
      if (catSanctuaryExpr) {
        await session.evaluate(catSanctuaryExpr).catch(() => {});
      } else if (catSanctuaryRemoveExpr) {
        await session.evaluate(catSanctuaryRemoveExpr).catch(() => {});
      }
      if (effortSliderExpr) {
        await session.evaluate(effortSliderExpr).catch(() => {});
      } else if (effortSliderRemoveExpr) {
        await session.evaluate(effortSliderRemoveExpr).catch(() => {});
      }
      if (chatSceneExpr) {
        await session.evaluate(chatSceneExpr).catch(() => {});
      } else if (chatSceneRemoveExpr) {
        await session.evaluate(chatSceneRemoveExpr).catch(() => {});
      }
      log(`[✓] ${shortTitle(page)} (obsidian-prism ${res.version} · 状态: ${res.status})`);
    } catch (err) {
      log(`[!] 跳过异常窗口 ${shortTitle(page)}: ${err.message}`);
    } finally {
      if (session) session.close();
    }
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  try {
    const pid =
      typeof readPidFromLockFile === 'function'
        ? readPidFromLockFile(PID_FILE)
        : parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10);
    if (pid && pid !== process.pid && isAlive(pid)) {
      const isDaemon = typeof isExpectedDaemonProcess === 'function' ? isExpectedDaemonProcess(pid) : true;
      if (isDaemon) {
        console.error(`[!] 守护进程已在运行 (PID ${pid})。如需重启请先运行 remove.js`);
        process.exit(1);
      }
    }
  } catch {}
  fs.writeFileSync(PID_FILE, String(process.pid));
  const release = () => {
    try {
      if (readPidFromLockFile(PID_FILE) === process.pid) {
        fs.unlinkSync(PID_FILE);
      }
    } catch {}
  };
  process.on('exit', release);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
    process.on(sig, () => process.exit(0));
  }
}

async function watch() {
  acquireLock();
  try {
    fs.writeFileSync(LOG_FILE, '');
  } catch {}
  log(`[*] Obsidian Prism 守护模式启动 (PID ${process.pid})，每 2 秒检查一次窗口`);

  const attached = new Map();
  let omniServer = null;
  try {
    const omniMod = await import('./vendor/omni-viewer/omni-server.mjs');
    if (omniMod && typeof omniMod.OmniServer === 'function') {
      omniServer = new omniMod.OmniServer({ rootDir: __dirname });
      await omniServer.start();
      process.on('exit', () => {
        try {
          void omniServer.stop();
        } catch {}
      });
    }
  } catch (err) {
    log(`[!] Omni 流式网关启动跳过: ${err.message}`);
  }

  let sidebarService = null;
  try {
    const sidebarMod = await import('./vendor/sidebar-studio/sidebar-service.mjs');
    const Ctor = sidebarMod && (sidebarMod.SidebarStudioService || sidebarMod.default);
    if (typeof Ctor === 'function') {
      let hostAdapter = null;
      try {
        const adapterMod = await import('./vendor/sidebar-studio/live-host-adapter.mjs');
        if (typeof adapterMod?.createLiveHostAdapter === 'function') {
          hostAdapter = adapterMod.createLiveHostAdapter({
            logger: (m) => log(m),
            evaluateInHost: async (evalExpr, timeoutMs = 4500) => {
              for (const ent of attached.values()) {
                if (ent && ent.session && !ent.session.closed && ent.sidebarHostVerified === true) {
                  return ent.session.evaluate(evalExpr, true, timeoutMs);
                }
              }
              return { ok: false, error: 'no-verified-host-window' };
            },
          });
        }
      } catch {}
      sidebarService = new Ctor({ logger: (m) => log(m), hostAdapter });
      process.on('exit', () => {
        try {
          if (typeof sidebarService.dispose === 'function') sidebarService.dispose();
        } catch {}
      });
    }
  } catch (err) {
    log(`[!] Sidebar Studio 后端服务启动跳过: ${err.message}`);
  }

  const initCfg = readConfig();
  let expr = buildInjectExpression();
  let omniExpr =
    initCfg?.omniModule !== 'off' && typeof buildOmniClientExpression === 'function'
      ? buildOmniClientExpression(omniServer ? omniServer.getServerInfo() : null)
      : '';
  let sidebarExpr =
    initCfg?.sidebarStudio === 'on' && typeof buildSidebarStudioExpression === 'function'
      ? buildSidebarStudioExpression({ binding: SIDEBAR_BINDING, serviceReady: Boolean(sidebarService) })
      : '';
  let hostI18nExpr =
    typeof buildHostI18nExpression === 'function'
      ? buildHostI18nExpression()
      : '';
  let activeShouldEnableThought = shouldEnableThought;
  let activeBuildThoughtExpression = buildThoughtExpression;
  let activeThoughtRemoveExpression = THOUGHT_REMOVE_EXPRESSION || FALLBACK_THOUGHT_REMOVE_EXPRESSION;
  let thoughtExpr = (() => {
    const cfg = readConfig();
    return isThoughtEnabledForConfig(cfg, activeShouldEnableThought) && typeof activeBuildThoughtExpression === 'function'
      ? activeBuildThoughtExpression(cfg)
      : '';
  })();
  let activeBuildInlineDiffExpression = buildInlineDiffInjectExpression;
  let activeInlineDiffRemoveExpression = INLINE_DIFF_REMOVE_EXPRESSION || FALLBACK_INLINE_DIFF_REMOVE_EXPRESSION;
  let inlineDiffExpr =
    typeof activeBuildInlineDiffExpression === 'function'
      ? activeBuildInlineDiffExpression(initCfg)
      : '';
  let activeShouldEnableCatSanctuary = shouldEnableCatSanctuary;
  let activeBuildCatSanctuaryExpression = buildCatSanctuaryExpression;
  let activeCatSanctuaryRemoveExpression =
    (typeof buildCatSanctuaryCleanupExpression === 'function' ? buildCatSanctuaryCleanupExpression() : '') ||
    CAT_SANCTUARY_REMOVE_EXPRESSION ||
    FALLBACK_CAT_SANCTUARY_REMOVE_EXPRESSION;
  let catSanctuaryExpr =
    isCatSanctuaryEnabledForConfig(initCfg, activeShouldEnableCatSanctuary) && typeof activeBuildCatSanctuaryExpression === 'function'
      ? activeBuildCatSanctuaryExpression(initCfg)
      : '';
  let activeShouldEnableEffortSlider = shouldEnableEffortSlider;
  let activeBuildEffortSliderExpression = buildEffortSliderExpression;
  let activeEffortSliderRemoveExpression =
    (typeof buildEffortSliderCleanupExpression === 'function' ? buildEffortSliderCleanupExpression() : '') ||
    EFFORT_SLIDER_REMOVE_EXPRESSION ||
    FALLBACK_EFFORT_SLIDER_REMOVE_EXPRESSION;
  let effortSliderExpr =
    isEffortSliderEnabledForConfig(initCfg, activeShouldEnableEffortSlider) && typeof activeBuildEffortSliderExpression === 'function'
      ? activeBuildEffortSliderExpression(initCfg)
      : '';
  let activeShouldEnableChatScene = shouldEnableChatScene;
  let activeBuildChatSceneExpression = buildChatSceneExpression;
  let activeChatSceneRemoveExpression =
    (typeof buildChatSceneCleanupExpression === 'function' ? buildChatSceneCleanupExpression() : '') ||
    CHAT_SCENE_REMOVE_EXPRESSION ||
    FALLBACK_CHAT_SCENE_REMOVE_EXPRESSION;
  let chatSceneExpr =
    isChatSceneEnabledForConfig(initCfg, activeShouldEnableChatScene) && typeof activeBuildChatSceneExpression === 'function'
      ? activeBuildChatSceneExpression(initCfg)
      : '';
  let _lazyReadSafeInlineDiff = null;
  async function loadReadSafeInlineDiff() {
    if (typeof _lazyReadSafeInlineDiff === 'function') return _lazyReadSafeInlineDiff;
    try {
      const daemonMod = await import('./sidecars/daemon/main.mjs');
      if (typeof daemonMod?.readSafeInlineDiff === 'function') {
        _lazyReadSafeInlineDiff = daemonMod.readSafeInlineDiff;
        return _lazyReadSafeInlineDiff;
      }
    } catch {}
    return null;
  }

  let selfConfigWriteUntil = 0;

  function isTrustedMainFrameContext(entry, executionContextId) {
    if (!entry || typeof executionContextId !== 'number') return false;
    if (!entry.hasFrameTree || !entry.mainFrameId || !entry.contextFrames || !entry.contextFrames.has(executionContextId)) {
      return false;
    }
    const meta = entry.contextFrames.get(executionContextId);
    if (!meta || !meta.isDefault || (meta.type && meta.type !== 'default')) return false;
    if (!meta.frameId || meta.frameId !== entry.mainFrameId) return false;
    return true;
  }

  async function ensureSidebarBinding(session, entry, cfg = readConfig()) {
    if (!SIDEBAR_BINDING || !session || session.closed || !entry) return false;
    if (cfg?.sidebarStudio !== 'on') return false;
    if (entry.sidebarBindingAdded) return true;
    if (entry.sidebarBindingPending) return entry.sidebarBindingPending;
    const pending = session
      .send('Runtime.addBinding', { name: SIDEBAR_BINDING })
      .then(() => {
        entry.sidebarBindingAdded = true;
        return true;
      })
      .catch(() => false)
      .finally(() => {
        if (entry.sidebarBindingPending === pending) entry.sidebarBindingPending = null;
      });
    entry.sidebarBindingPending = pending;
    return pending;
  }

  const broadcastFastConfigRefresh = createFastConfigRefreshBroadcaster({
    attached,
    readConfig,
    buildInjectExpression,
    buildConfigRefreshExpression,
    buildOmniClientExpression,
    buildSidebarStudioExpression,
    shouldEnableHostI18n,
    buildHostI18nExpression,
    hostI18nRemoveExpression: HOST_I18N_REMOVE_EXPRESSION,
    getThoughtHooks: () => ({
      shouldEnable: activeShouldEnableThought,
      buildExpression: activeBuildThoughtExpression,
      removeExpression: activeThoughtRemoveExpression,
    }),
    getInlineDiffHooks: () => ({
      buildExpression: activeBuildInlineDiffExpression,
      removeExpression: activeInlineDiffRemoveExpression,
    }),
    getCatSanctuaryHooks: () => ({
      shouldEnable: activeShouldEnableCatSanctuary,
      buildExpression: activeBuildCatSanctuaryExpression,
      removeExpression: activeCatSanctuaryRemoveExpression,
    }),
    getEffortSliderHooks: () => ({
      shouldEnable: activeShouldEnableEffortSlider,
      buildExpression: activeBuildEffortSliderExpression,
      removeExpression: activeEffortSliderRemoveExpression,
    }),
    getChatSceneHooks: () => ({
      shouldEnable: activeShouldEnableChatScene,
      buildExpression: activeBuildChatSceneExpression,
      removeExpression: activeChatSceneRemoveExpression,
    }),
    getOmniServerInfo: () => (omniServer ? omniServer.getServerInfo() : null),
    getSidebarServiceReady: () => Boolean(sidebarService),
    sidebarBinding: SIDEBAR_BINDING,
    ensureSidebarBinding,
    onExpressionsUpdated: (next) => {
      expr = next.expr;
      omniExpr = next.omniExpr;
      sidebarExpr = next.sidebarExpr;
      hostI18nExpr = next.hostI18nExpr;
      thoughtExpr = next.thoughtExpr;
      inlineDiffExpr = next.inlineDiffExpr;
      catSanctuaryExpr = next.catSanctuaryExpr;
      effortSliderExpr = next.effortSliderExpr;
      chatSceneExpr = next.chatSceneExpr;
    },
  });

  async function apply(entry) {
    if (entry.scriptId) {
      await entry.session
        .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId })
        .catch(() => {});
      entry.scriptId = null;
    }
    const { identifier } = await entry.session.send('Page.addScriptToEvaluateOnNewDocument', {
      source: expr,
    });
    entry.scriptId = identifier;
    const res = await entry.session.evaluate(expr);
    entry.sidebarHostVerified = Boolean(res && res.status === 'ok');
    if (res && res.status === 'skipped-non-host') {
      for (const key of ['scriptId', 'omniScriptId', 'sidebarScriptId', 'hostI18nScriptId', 'thoughtScriptId', 'inlineDiffScriptId', 'catSanctuaryScriptId', 'effortSliderScriptId', 'chatSceneScriptId']) {
        if (entry[key]) {
          await entry.session
            .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry[key] })
            .catch(() => {});
          entry[key] = null;
        }
      }
      if (entry.sidebarBindingAdded && SIDEBAR_BINDING) {
        await entry.session.send('Runtime.removeBinding', { name: SIDEBAR_BINDING }).catch(() => {});
        entry.sidebarBindingAdded = false;
      }
      if (INLINE_DIFF_BINDING) {
        await entry.session.send('Runtime.removeBinding', { name: INLINE_DIFF_BINDING }).catch(() => {});
        entry.inlineDiffBindingAdded = false;
      }
      entry.thoughtMounted = false;
      entry.inlineDiffMounted = false;
      entry.inlineDiffSkipped = true;
      entry.lastInlineDiffHash = '';
      entry.catSanctuaryMounted = false;
      entry.catSanctuarySkipped = true;
      entry.lastCatSanctuaryHash = '';
      entry.effortSliderMounted = false;
      entry.effortSliderSkipped = true;
      entry.lastEffortSliderHash = '';
      entry.chatSceneMounted = false;
      entry.chatSceneSkipped = true;
      entry.lastChatSceneSig = '';
      return res;
    }

    const cfgNow = readConfig();
    const omniEnabled = cfgNow?.omniModule !== 'off';
    const sidebarEnabled = cfgNow?.sidebarStudio === 'on';
    if (entry.omniScriptId) {
      await entry.session
        .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId })
        .catch(() => {});
      entry.omniScriptId = null;
    }
    if (omniEnabled && omniExpr) {
      const omniAdd = await entry.session
        .send('Page.addScriptToEvaluateOnNewDocument', { source: omniExpr })
        .catch(() => null);
      if (omniAdd && omniAdd.identifier) entry.omniScriptId = omniAdd.identifier;
      await entry.session.evaluate(omniExpr).catch(() => {});
    }

    if (entry.sidebarScriptId) {
      await entry.session
        .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId })
        .catch(() => {});
      entry.sidebarScriptId = null;
    }
    await ensureSidebarBinding(entry.session, entry, cfgNow);
    if (sidebarEnabled && sidebarExpr) {
      const sbAdd = await entry.session
        .send('Page.addScriptToEvaluateOnNewDocument', { source: sidebarExpr })
        .catch(() => null);
      if (sbAdd && sbAdd.identifier) entry.sidebarScriptId = sbAdd.identifier;
      await entry.session.evaluate(sidebarExpr).catch(() => {});
    }
    if (entry.hostI18nScriptId) {
      await entry.session
        .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId })
        .catch(() => {});
      entry.hostI18nScriptId = null;
    }
    if (hostI18nExpr) {
      const hiAdd = await entry.session
        .send('Page.addScriptToEvaluateOnNewDocument', { source: hostI18nExpr })
        .catch(() => null);
      if (hiAdd && hiAdd.identifier) entry.hostI18nScriptId = hiAdd.identifier;
      await entry.session.evaluate(hostI18nExpr).catch(() => {});
    } else if (HOST_I18N_REMOVE_EXPRESSION) {
      await entry.session.evaluate(HOST_I18N_REMOVE_EXPRESSION).catch(() => {});
    }
    const hadThought = Boolean(entry.thoughtScriptId || entry.thoughtMounted);
    if (entry.thoughtScriptId) {
      await entry.session
        .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.thoughtScriptId })
        .catch(() => {});
      entry.thoughtScriptId = null;
    }
    const thoughtEnabledNow = isThoughtEnabledForConfig(readConfig(), activeShouldEnableThought);
    if (thoughtExpr && thoughtEnabledNow) {
      const thAdd = await entry.session
        .send('Page.addScriptToEvaluateOnNewDocument', { source: thoughtExpr })
        .catch(() => null);
      if (thAdd && thAdd.identifier) entry.thoughtScriptId = thAdd.identifier;
      const thRes = await entry.session.evaluate(thoughtExpr).catch(() => null);
      entry.thoughtMounted = Boolean(thRes && thRes.ok);
    } else {
      if (hadThought && activeThoughtRemoveExpression) {
        await entry.session.evaluate(activeThoughtRemoveExpression).catch(() => {});
      }
      entry.thoughtMounted = false;
    }
    const hadInlineDiff = Boolean(entry.inlineDiffScriptId || entry.inlineDiffMounted);
    if (entry.inlineDiffScriptId) {
      await entry.session
        .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.inlineDiffScriptId })
        .catch(() => {});
      entry.inlineDiffScriptId = null;
    }
    if (inlineDiffExpr) {
      if (INLINE_DIFF_BINDING) {
        await entry.session.send('Runtime.addBinding', { name: INLINE_DIFF_BINDING }).catch(() => {});
        entry.inlineDiffBindingAdded = true;
      }
      const idAdd = await entry.session
        .send('Page.addScriptToEvaluateOnNewDocument', { source: inlineDiffExpr })
        .catch(() => null);
      if (idAdd && idAdd.identifier) entry.inlineDiffScriptId = idAdd.identifier;
      const idRes = await entry.session.evaluate(inlineDiffExpr).catch(() => null);
      const idHashMatch = /const targetHash = "([^"]+)"/.exec(inlineDiffExpr);
      const idSkipped = Boolean(idRes && typeof idRes.status === 'string' && idRes.status.startsWith('skipped-'));
      if (idRes && idRes.ok) {
        entry.inlineDiffMounted = true;
        entry.inlineDiffSkipped = false;
        entry.lastInlineDiffHash = idHashMatch ? idHashMatch[1] : inlineDiffExpr;
      } else if (idSkipped) {
        entry.inlineDiffMounted = false;
        entry.inlineDiffSkipped = true;
        entry.lastInlineDiffHash = idHashMatch ? idHashMatch[1] : inlineDiffExpr;
        if (idRes.status === 'skipped-non-host' && INLINE_DIFF_BINDING) {
          await entry.session.send('Runtime.removeBinding', { name: INLINE_DIFF_BINDING }).catch(() => {});
          entry.inlineDiffBindingAdded = false;
        }
      } else {
        entry.inlineDiffMounted = false;
        entry.inlineDiffSkipped = false;
        entry.lastInlineDiffHash = '';
      }
    } else {
      if (hadInlineDiff && activeInlineDiffRemoveExpression) {
        await entry.session.evaluate(activeInlineDiffRemoveExpression).catch(() => {});
      }
      entry.inlineDiffMounted = false;
      entry.inlineDiffSkipped = false;
      entry.lastInlineDiffHash = '';
    }
    const hadCatSanctuary = Boolean(entry.catSanctuaryScriptId || entry.catSanctuaryMounted);
    if (entry.catSanctuaryScriptId) {
      await entry.session
        .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.catSanctuaryScriptId })
        .catch(() => {});
      entry.catSanctuaryScriptId = null;
    }
    const catSanctuaryEnabledNow = isCatSanctuaryEnabledForConfig(readConfig(), activeShouldEnableCatSanctuary);
    if (catSanctuaryExpr && catSanctuaryEnabledNow) {
      const csAdd = await entry.session
        .send('Page.addScriptToEvaluateOnNewDocument', { source: catSanctuaryExpr })
        .catch(() => null);
      if (csAdd && csAdd.identifier) entry.catSanctuaryScriptId = csAdd.identifier;
      const csRes = await entry.session.evaluate(catSanctuaryExpr).catch(() => null);
      const csHashMatch = /const targetHash = "([^"]+)"/.exec(catSanctuaryExpr);
      const csSkipped = Boolean(csRes && typeof csRes.status === 'string' && csRes.status.startsWith('skipped-'));
      if (csRes && csRes.ok) {
        entry.catSanctuaryMounted = true;
        entry.catSanctuarySkipped = false;
        entry.lastCatSanctuaryHash = csHashMatch ? csHashMatch[1] : catSanctuaryExpr;
      } else if (csSkipped) {
        entry.catSanctuaryMounted = false;
        entry.catSanctuarySkipped = true;
        entry.lastCatSanctuaryHash = csHashMatch ? csHashMatch[1] : catSanctuaryExpr;
      } else {
        entry.catSanctuaryMounted = false;
        entry.catSanctuarySkipped = false;
        entry.lastCatSanctuaryHash = '';
      }
    } else {
      if (hadCatSanctuary && activeCatSanctuaryRemoveExpression) {
        await entry.session.evaluate(activeCatSanctuaryRemoveExpression).catch(() => {});
      }
      entry.catSanctuaryMounted = false;
      entry.catSanctuarySkipped = false;
      entry.lastCatSanctuaryHash = '';
    }
    const hadEffortSlider = Boolean(entry.effortSliderScriptId || entry.effortSliderMounted);
    if (entry.effortSliderScriptId) {
      await entry.session
        .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.effortSliderScriptId })
        .catch(() => {});
      entry.effortSliderScriptId = null;
    }
    const effortSliderEnabledNow = isEffortSliderEnabledForConfig(readConfig(), activeShouldEnableEffortSlider);
    if (effortSliderExpr && effortSliderEnabledNow) {
      const esAdd = await entry.session
        .send('Page.addScriptToEvaluateOnNewDocument', { source: effortSliderExpr })
        .catch(() => null);
      if (esAdd && esAdd.identifier) entry.effortSliderScriptId = esAdd.identifier;
      const esRes = await entry.session.evaluate(effortSliderExpr).catch(() => null);
      const esHashMatch = /const targetHash = "([^"]+)"/.exec(effortSliderExpr);
      const esSkipped = Boolean(esRes && typeof esRes.status === 'string' && esRes.status.startsWith('skipped-'));
      if (esRes && esRes.ok) {
        entry.effortSliderMounted = true;
        entry.effortSliderSkipped = false;
        entry.lastEffortSliderHash = esHashMatch ? esHashMatch[1] : effortSliderExpr;
      } else if (esSkipped) {
        entry.effortSliderMounted = false;
        entry.effortSliderSkipped = true;
        entry.lastEffortSliderHash = esHashMatch ? esHashMatch[1] : effortSliderExpr;
      } else {
        entry.effortSliderMounted = false;
        entry.effortSliderSkipped = false;
        entry.lastEffortSliderHash = '';
      }
    } else {
      if (hadEffortSlider && activeEffortSliderRemoveExpression) {
        await entry.session.evaluate(activeEffortSliderRemoveExpression).catch(() => {});
      }
      entry.effortSliderMounted = false;
      entry.effortSliderSkipped = false;
      entry.lastEffortSliderHash = '';
    }
    const hadChatScene = Boolean(entry.chatSceneScriptId || entry.chatSceneMounted);
    if (entry.chatSceneScriptId) {
      await entry.session
        .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.chatSceneScriptId })
        .catch(() => {});
      entry.chatSceneScriptId = null;
    }
    const chatSceneCfgNow = readConfig();
    const chatSceneEnabledNow = isChatSceneEnabledForConfig(chatSceneCfgNow, activeShouldEnableChatScene);
    if (chatSceneExpr && chatSceneEnabledNow) {
      const scAdd = await entry.session
        .send('Page.addScriptToEvaluateOnNewDocument', { source: chatSceneExpr })
        .catch(() => null);
      if (scAdd && scAdd.identifier) entry.chatSceneScriptId = scAdd.identifier;
      const scRes = await entry.session.evaluate(chatSceneExpr).catch(() => null);
      const scHashMatch = /const targetHash = "([^"]+)"/.exec(chatSceneExpr);
      const scSig = `${chatSceneCfgNow?.chatScene || ''}:${scHashMatch ? scHashMatch[1] : chatSceneExpr}`;
      const scSkipped = Boolean(scRes && typeof scRes.status === 'string' && scRes.status.startsWith('skipped-'));
      if (scRes && scRes.ok) {
        entry.chatSceneMounted = true;
        entry.chatSceneSkipped = false;
        entry.lastChatSceneSig = scSig;
      } else if (scSkipped) {
        entry.chatSceneMounted = false;
        entry.chatSceneSkipped = true;
        entry.lastChatSceneSig = scSig;
      } else {
        entry.chatSceneMounted = false;
        entry.chatSceneSkipped = false;
        entry.lastChatSceneSig = '';
      }
    } else {
      if (hadChatScene && activeChatSceneRemoveExpression) {
        await entry.session.evaluate(activeChatSceneRemoveExpression).catch(() => {});
      }
      entry.chatSceneMounted = false;
      entry.chatSceneSkipped = false;
      entry.lastChatSceneSig = '';
    }
    return res;
  }

  async function attach(page) {
    if (!isEligibleTarget(page)) return;
    attached.set(page.id, null);
    try {
      const session = await CdpSession.connect(page.webSocketDebuggerUrl);
      const entry = {
        session,
        scriptId: null,
        omniScriptId: null,
        sidebarScriptId: null,
        sidebarBindingAdded: false,
        sidebarBindingPending: null,
        hostI18nScriptId: null,
        thoughtScriptId: null,
        thoughtMounted: false,
        inlineDiffScriptId: null,
        inlineDiffBindingAdded: false,
        inlineDiffMounted: false,
        inlineDiffSkipped: false,
        lastInlineDiffHash: '',
        catSanctuaryScriptId: null,
        catSanctuaryMounted: false,
        catSanctuarySkipped: false,
        lastCatSanctuaryHash: '',
        effortSliderScriptId: null,
        effortSliderMounted: false,
        effortSliderSkipped: false,
        lastEffortSliderHash: '',
        chatSceneScriptId: null,
        chatSceneMounted: false,
        chatSceneSkipped: false,
        lastChatSceneSig: '',
        docGen: 0,
        mainFrameId: null,
        hasFrameTree: false,
        sidebarHostVerified: false,
        contextFrames: new Map(),
        pendingAckEpoch: 0,
      };
      attached.set(page.id, entry);
      session.onClose = () => {
        attached.delete(page.id);
        log(`[-] 窗口已关闭: ${shortTitle(page)}`);
      };
      session.on('Runtime.executionContextCreated', (params) => {
        const ctx = params?.context;
        if (!ctx || typeof ctx.id !== 'number') return;
        const aux = ctx.auxData && typeof ctx.auxData === 'object' ? ctx.auxData : {};
        entry.contextFrames.set(ctx.id, {
          frameId: typeof aux.frameId === 'string' ? aux.frameId : '',
          isDefault: aux.isDefault === true,
          type: typeof aux.type === 'string' ? aux.type : 'default',
          docGen: entry.docGen,
        });
      });
      session.on('Runtime.executionContextDestroyed', (params) => {
        if (typeof params?.executionContextId === 'number') entry.contextFrames.delete(params.executionContextId);
      });
      session.on('Runtime.executionContextsCleared', () => {
        entry.contextFrames.clear();
        entry.docGen += 1;
        entry.pendingAckEpoch = 0;
        entry.sidebarHostVerified = false;
        entry.inlineDiffSkipped = false;
        entry.catSanctuarySkipped = false;
        entry.effortSliderSkipped = false;
        entry.chatSceneSkipped = false;
      });
      session.on('Page.frameNavigated', (params) => {
        const frame = params?.frame;
        if (frame && !frame.parentId && typeof frame.id === 'string' && frame.id) {
          entry.mainFrameId = frame.id;
          entry.hasFrameTree = true;
          entry.docGen += 1;
          entry.pendingAckEpoch = 0;
          entry.sidebarHostVerified = false;
          entry.inlineDiffSkipped = false;
          entry.catSanctuarySkipped = false;
          entry.effortSliderSkipped = false;
          entry.chatSceneSkipped = false;
        }
      });
      await session.send('Page.enable');
      const ft = await session.send('Page.getFrameTree', {}, 2000).catch(() => null);
      const topFrameId = ft?.frameTree?.frame?.id;
      if (typeof topFrameId === 'string' && topFrameId) {
        entry.mainFrameId = topFrameId;
        entry.hasFrameTree = true;
      }
      session.on('Runtime.bindingCalled', async ({ name, payload, executionContextId }) => {
        if (!isTrustedMainFrameContext(entry, executionContextId)) return;
        if (name === OMNI_BINDING && omniServer) {
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
          try {
            result = await omniServer.handleRpcAction(action, mergedParams);
          } catch (err) {
            result = { ok: false, error: sanitizeSecretText(err && err.message ? err.message : err) };
          }
          if (!session.closed) {
            const safeId = Number(reqId) | 0;
            const jsonRes = serializeJsonForEval(result);
            const resolveExpr = `(() => { const r = ${jsonRes}; const b = window.__agPrismOmniBridge; if (b && typeof b.resolve === 'function') b.resolve(${safeId}, r); if (typeof window.__agPrismOmniResolve === 'function' && (!b || window.__agPrismOmniResolve !== b.resolve)) window.__agPrismOmniResolve(${safeId}, r); })()`;
            const evalParams = { expression: resolveExpr, returnByValue: true };
            if (executionContextId) evalParams.contextId = executionContextId;
            await session.send('Runtime.evaluate', evalParams).catch(() => {});
          }
          return;
        }
        if (name === SIDEBAR_BINDING) {
          const context = entry.contextFrames?.get(executionContextId);
          const isCurrentHost = () =>
            !session.closed &&
            entry.sidebarHostVerified === true &&
            context?.isDefault === true &&
            context.type === 'default' &&
            Boolean(entry.mainFrameId) &&
            context.frameId === entry.mainFrameId &&
            entry.contextFrames.get(executionContextId) === context;
          const MAX_RPC_BYTES = 131072;
          const MAX_SPARK_IMPORT_BYTES = 12 * 1024 * 1024;
          const payloadBytes = typeof payload === 'string' ? Buffer.byteLength(payload, 'utf8') : Infinity;
          if (!isCurrentHost() || typeof payload !== 'string' || payloadBytes > MAX_SPARK_IMPORT_BYTES) return;
          let parsed;
          try {
            parsed = JSON.parse(payload);
          } catch {
            return;
          }
          const reqId = parsed && Number.isSafeInteger(parsed.id) && parsed.id >= 1 ? parsed.id : null;
          if (reqId === null) return;
          if (parsed.action !== 'import-spark-file' && payloadBytes > MAX_RPC_BYTES) return;
          const { id: _transportId, input: _transportCopy, ...request } = parsed;
          let result;
          if (readConfig()?.sidebarStudio !== 'on') {
            result = { ok: false, error: 'Chat Beta is disabled' };
          } else {
            try {
              if (!sidebarService) {
                result = { ok: false, error: { code: 'CAPABILITY_UNAVAILABLE', message: 'SidebarStudioService unavailable', retryable: true } };
              } else if (typeof sidebarService.handleRpc === 'function') {
                result = await sidebarService.handleRpc(request);
              } else {
                result = { ok: false, error: { code: 'CAPABILITY_UNAVAILABLE', message: 'SidebarStudioService missing v2 handleRpc' } };
              }
            } catch {
              result = { ok: false, error: { code: 'CAPABILITY_UNAVAILABLE', message: 'Sidebar Studio service unavailable', retryable: true } };
            }
          }
          if (isCurrentHost()) {
            const jsonRes = serializeJsonForEval(result);
            const resolveExpr = `(() => { const r = ${jsonRes}; const b = window.__agPrismSidebarBridge; if (b && typeof b.resolve === 'function') b.resolve(${reqId}, r); if (typeof window.__agPrismSidebarResolve === 'function' && (!b || window.__agPrismSidebarResolve !== b.resolve)) window.__agPrismSidebarResolve(${reqId}, r); })()`;
            const evalParams = { expression: resolveExpr, returnByValue: true };
            if (executionContextId) evalParams.contextId = executionContextId;
            await session.send('Runtime.evaluate', evalParams).catch(() => {});
          }
          return;
        }
        if (name === INLINE_DIFF_BINDING) {
          const context = typeof executionContextId === 'number' ? entry.contextFrames?.get(executionContextId) : undefined;
          const expectedDocGen = entry.docGen;
          const isCurrentContext = () =>
            !session.closed &&
            entry.sidebarHostVerified === true &&
            isTrustedMainFrameContext(entry, executionContextId) &&
            Boolean(context) &&
            entry.contextFrames.get(executionContextId) === context &&
            entry.docGen === expectedDocGen &&
            context.docGen === entry.docGen;
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
            const reader = await loadReadSafeInlineDiff();
            resp = reader ? await reader(parsed.uri, hints ? { hints } : {}) : { ok: false, error: 'unavailable' };
          } catch {
            resp = { ok: false, error: 'internal_error' };
          }
          if (isCurrentContext()) {
            const resolveExpr = `window.__agPrismInlineDiffResolve?.(${reqId}, ${serializeJsonForEval(resp)})`;
            await session
              .send('Runtime.evaluate', {
                expression: resolveExpr,
                contextId: executionContextId,
                returnByValue: true,
              })
              .catch(() => {});
          }
          return;
        }
        if (name !== SETTING_BINDING && name !== LEGACY_SETTING_BINDING) return;
        try {
          const parsed = JSON.parse(payload);
          let changed = false;
          if (parsed && parsed.action === 'patch-batch' && parsed.entries && typeof parsed.entries === 'object') {
            selfConfigWriteUntil = Date.now() + 650;
            if (updateConfigBatch(parsed.entries)) {
              changed = true;
              log(`[⚙] 批量设置已保存: ${Object.keys(parsed.entries).join(', ')}`);
            }
          } else if (parsed) {
            selfConfigWriteUntil = Date.now() + 650;
            if (updateConfigSetting(parsed.key, parsed.value)) {
              changed = true;
              log(`[⚙] 设置已保存: ${parsed.key} = ${JSON.stringify(parsed.value)}`);
            }
          }
          if (changed) {
            if (parsed && Number.isSafeInteger(parsed.clientEpoch) && parsed.clientEpoch > 0) {
              entry.pendingAckEpoch = parsed.clientEpoch;
            }
            await broadcastFastConfigRefresh();
          }
        } catch {}
      });
      await session.send('Runtime.enable');
      await session.send('Runtime.addBinding', { name: SETTING_BINDING });
      await session.send('Runtime.addBinding', { name: LEGACY_SETTING_BINDING }).catch(() => {});
      if (OMNI_BINDING) {
        await session.send('Runtime.addBinding', { name: OMNI_BINDING }).catch(() => {});
      }
      if (INLINE_DIFF_BINDING) {
        await session.send('Runtime.addBinding', { name: INLINE_DIFF_BINDING }).catch(() => {});
        entry.inlineDiffBindingAdded = true;
      }
      await ensureSidebarBinding(session, entry, readConfig());
      const res = await apply(entry);
      log(`[✓] 已注入 obsidian-prism: ${shortTitle(page)} (${res.status})`);
    } catch (err) {
      const entry = attached.get(page.id);
      if (entry) {
        try {
          if (entry.scriptId) await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId });
          if (entry.omniScriptId) await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId });
          if (entry.sidebarScriptId) await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId });
          if (entry.hostI18nScriptId) await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId });
          if (entry.thoughtScriptId) await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.thoughtScriptId });
          if (entry.inlineDiffScriptId) await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.inlineDiffScriptId });
          if (entry.catSanctuaryScriptId) await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.catSanctuaryScriptId });
          if (entry.effortSliderScriptId) await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.effortSliderScriptId });
          if (entry.chatSceneScriptId) await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.chatSceneScriptId });
        } catch {}
        entry.session.close();
      }
      attached.delete(page.id);
      log(`[!] 注入失败，稍后重试: ${shortTitle(page)} — ${err.message}`);
    }
  }

  let busy = false;
  let lastPort = null;
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const port = readPort();
      if (!port) return;
      let pages;
      try {
        pages = await listPages(port);
      } catch {
        return;
      }
      if (port !== lastPort) {
        log(`[+] 连接到调试端口 ${port}`);
        lastPort = port;
      }
      await Promise.all(pages.filter((p) => !attached.has(p.id)).map(attach));
    } finally {
      busy = false;
    }
  }

  let reloadTimer = null;
  fs.watch(__dirname, { recursive: true }, (_, filename) => {
    const base = filename ? path.basename(filename) : '';
    if (!base || !/\.(css|c?js|mjs|json)$/i.test(base) || base.startsWith('.')) return;
    if (base === 'watch.log' || base === 'daemon.log') return;
    if (base === 'config.json' && Date.now() < selfConfigWriteUntil) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(async () => {
      try {
        delete require.cache[require.resolve('./cdp')];
        const freshCdp = require('./cdp');
        const freshCfg = typeof freshCdp.readConfig === 'function' ? freshCdp.readConfig() : readConfig();
        expr = freshCdp.buildInjectExpression();
        omniExpr =
          freshCfg?.omniModule !== 'off' && typeof freshCdp.buildOmniClientExpression === 'function'
            ? freshCdp.buildOmniClientExpression(omniServer ? omniServer.getServerInfo() : null)
            : '';
        sidebarExpr =
          freshCfg?.sidebarStudio === 'on' && typeof freshCdp.buildSidebarStudioExpression === 'function'
            ? freshCdp.buildSidebarStudioExpression({ binding: SIDEBAR_BINDING, serviceReady: Boolean(sidebarService) })
            : '';
        hostI18nExpr =
          typeof freshCdp.buildHostI18nExpression === 'function'
            ? freshCdp.buildHostI18nExpression()
            : '';
        activeShouldEnableThought = freshCdp.shouldEnableThought;
        activeBuildThoughtExpression = freshCdp.buildThoughtExpression;
        activeThoughtRemoveExpression = freshCdp.THOUGHT_REMOVE_EXPRESSION || FALLBACK_THOUGHT_REMOVE_EXPRESSION;
        thoughtExpr =
          isThoughtEnabledForConfig(freshCfg, activeShouldEnableThought) && typeof activeBuildThoughtExpression === 'function'
            ? activeBuildThoughtExpression(freshCfg)
            : '';
        activeBuildInlineDiffExpression = freshCdp.buildInlineDiffInjectExpression;
        activeInlineDiffRemoveExpression = freshCdp.INLINE_DIFF_REMOVE_EXPRESSION || FALLBACK_INLINE_DIFF_REMOVE_EXPRESSION;
        inlineDiffExpr =
          typeof activeBuildInlineDiffExpression === 'function'
            ? activeBuildInlineDiffExpression(freshCfg)
            : '';
        activeShouldEnableCatSanctuary = freshCdp.shouldEnableCatSanctuary;
        activeBuildCatSanctuaryExpression = freshCdp.buildCatSanctuaryExpression;
        activeCatSanctuaryRemoveExpression =
          (typeof freshCdp.buildCatSanctuaryCleanupExpression === 'function' ? freshCdp.buildCatSanctuaryCleanupExpression() : '') ||
          freshCdp.CAT_SANCTUARY_REMOVE_EXPRESSION ||
          FALLBACK_CAT_SANCTUARY_REMOVE_EXPRESSION;
        catSanctuaryExpr =
          isCatSanctuaryEnabledForConfig(freshCfg, activeShouldEnableCatSanctuary) && typeof activeBuildCatSanctuaryExpression === 'function'
            ? activeBuildCatSanctuaryExpression(freshCfg)
            : '';
        activeShouldEnableEffortSlider = freshCdp.shouldEnableEffortSlider;
        activeBuildEffortSliderExpression = freshCdp.buildEffortSliderExpression;
        activeEffortSliderRemoveExpression =
          (typeof freshCdp.buildEffortSliderCleanupExpression === 'function' ? freshCdp.buildEffortSliderCleanupExpression() : '') ||
          freshCdp.EFFORT_SLIDER_REMOVE_EXPRESSION ||
          FALLBACK_EFFORT_SLIDER_REMOVE_EXPRESSION;
        effortSliderExpr =
          isEffortSliderEnabledForConfig(freshCfg, activeShouldEnableEffortSlider) && typeof activeBuildEffortSliderExpression === 'function'
            ? activeBuildEffortSliderExpression(freshCfg)
            : '';
        activeShouldEnableChatScene = freshCdp.shouldEnableChatScene;
        activeBuildChatSceneExpression = freshCdp.buildChatSceneExpression;
        activeChatSceneRemoveExpression =
          (typeof freshCdp.buildChatSceneCleanupExpression === 'function' ? freshCdp.buildChatSceneCleanupExpression() : '') ||
          freshCdp.CHAT_SCENE_REMOVE_EXPRESSION ||
          FALLBACK_CHAT_SCENE_REMOVE_EXPRESSION;
        chatSceneExpr =
          isChatSceneEnabledForConfig(freshCfg, activeShouldEnableChatScene) && typeof activeBuildChatSceneExpression === 'function'
            ? activeBuildChatSceneExpression(freshCfg)
            : '';
      } catch (err) {
        log(`[!] 读取文件失败: ${err.message}`);
        return;
      }
      let n = 0;
      for (const entry of attached.values()) {
        if (!entry) continue;
        try {
          await apply(entry);
          n++;
        } catch {}
      }
      log(`[↻] ${filename} 已变更，已热更新 ${n} 个窗口`);
    }, 180);
  });

  if (WATCH) {
    process.on('uncaughtException', (err) => {
      log(`[!] 未捕获异常: ${err && err.stack ? err.stack : err}`);
    });
    process.on('unhandledRejection', (err) => {
      log(`[!] 未处理 Promise 拒绝: ${err && err.stack ? err.stack : err}`);
    });
  }

  await tick();
  setInterval(tick, 2000);
}

module.exports = {
  injectOnce,
  watch,
  updateConfigBatch,
  updateConfigSetting,
  _createFastConfigRefreshBroadcaster: createFastConfigRefreshBroadcaster,
};

if (require.main === module) {
  (WATCH ? watch() : injectOnce()).catch((err) => {
    console.error(`[✗] ${err.message}`);
    process.exit(1);
  });
}
