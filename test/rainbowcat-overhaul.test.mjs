import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const cdp = require(path.join(ROOT, 'cdp.js'));
const settingsPanel = require(path.join(ROOT, 'settings-panel.js'));
const bridgeMod = require(path.join(ROOT, 'pulse-vial-bridge.js'));
const dualMascotMod = require(path.join(ROOT, 'dual-mascot-rig.js'));
const rippleCore = require(path.join(ROOT, 'ripple-core.js'));

function makeMiniEl(tag, attrs = {}) {
  const map = new Map(Object.entries(attrs).map(([k, v]) => [k, String(v)]));
  const listeners = new Map();
  const children = [];
  const styleMap = new Map();
  const el = {
    nodeType: 1,
    tagName: String(tag || 'div').toUpperCase(),
    id: attrs.id || '',
    className: attrs.class || '',
    textContent: '',
    value: undefined,
    hidden: false,
    removed: false,
    isConnected: true,
    dataset: {},
    ownerDocument: null,
    parentElement: null,
    parentNode: null,
    children,
    childNodes: children,
    get firstChild() { return children[0] || null; },
    get firstElementChild() { return children[0] || null; },
    get nextSibling() {
      const p = this.parentElement?.children;
      if (!p) return null;
      const i = p.indexOf(this);
      return i >= 0 ? p[i + 1] || null : null;
    },
    style: {
      setProperty(k, v) { styleMap.set(k, String(v)); },
      getPropertyValue(k) { return styleMap.get(k) || ''; },
      removeProperty(k) { styleMap.delete(k); },
    },
    classList: {
      contains(c) { return String(el.className || '').split(/\s+/).includes(c); },
      add(c) { if (!this.contains(c)) el.className = `${el.className} ${c}`.trim(); },
      remove(c) { el.className = String(el.className || '').split(/\s+/).filter((x) => x && x !== c).join(' '); },
    },
    setAttribute(k, v) {
      map.set(k, String(v));
      if (k === 'id') el.id = String(v);
      if (k === 'class') el.className = String(v);
      if (k === 'hidden') el.hidden = true;
    },
    getAttribute(k) { return map.has(k) ? map.get(k) : null; },
    hasAttribute(k) { return map.has(k); },
    removeAttribute(k) { map.delete(k); if (k === 'hidden') el.hidden = false; },
    appendChild(child) {
      if (!child) return child;
      child.parentElement = el;
      child.parentNode = el;
      child.isConnected = true;
      children.push(child);
      return child;
    },
    insertBefore(child, ref) {
      if (!child) return child;
      child.parentElement = el;
      child.parentNode = el;
      const idx = ref ? children.indexOf(ref) : -1;
      if (idx >= 0) children.splice(idx, 0, child);
      else children.push(child);
      return child;
    },
    removeChild(child) {
      const idx = children.indexOf(child);
      if (idx >= 0) {
        children.splice(idx, 1);
        child.parentElement = null;
        child.parentNode = null;
        child.isConnected = false;
      }
      return child;
    },
    remove() {
      el.removed = true;
      el.isConnected = false;
      const p = el.parentElement?.children;
      if (p) {
        const idx = p.indexOf(el);
        if (idx >= 0) p.splice(idx, 1);
      }
      el.parentElement = null;
      el.parentNode = null;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type);
      if (!list) return;
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    },
    dispatchEvent(ev) {
      const list = listeners.get(ev?.type) || [];
      const e = { preventDefault() {}, stopPropagation() {}, target: el, ...ev };
      for (const fn of list.slice()) fn(e);
      return true;
    },
    focus() {},
    closest(sel) {
      for (let cur = el; cur; cur = cur.parentElement) if (matchesSimple(cur, sel)) return cur;
      return null;
    },
    matches(sel) { return matchesSimple(el, sel); },
    getBoundingClientRect() { return { left: 20, top: 40, width: 320, height: 32, right: 340, bottom: 72 }; },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => {
        for (const ch of n.children || []) {
          if (matchesSimple(ch, sel)) out.push(ch);
          walk(ch);
        }
      };
      walk(el);
      return out;
    },
    getElementById(id) {
      return this.querySelectorAll(`#${id}`)[0] || null;
    },
  };
  return el;
}

function matchesSimple(el, rawSel) {
  if (!el || !rawSel) return false;
  return String(rawSel)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .some((part) => {
      const seg = part.split(/\s+/).pop();
      if (seg.startsWith('#')) return el.id === seg.slice(1);
      if (seg.startsWith('.')) return el.classList.contains(seg.slice(1));
      const am = seg.match(/^([a-z0-9_-]*)\[([^\]=]+)(?:="([^"]*)")?\]$/i);
      if (am) {
        const [, tag, attr, val] = am;
        if (tag && el.tagName !== tag.toUpperCase()) return false;
        if (!el.hasAttribute(attr)) return false;
        return val === undefined ? true : el.getAttribute(attr) === val;
      }
      return el.tagName === seg.toUpperCase();
    });
}

test('1. SCENE_PRESETS.ultra preserves mascot, cozyEco keeps cat mascot, and 5 rainbow/cat schema keys match config.example.json', () => {
  const { SCENE_PRESETS, PRISM_SETTINGS_SCHEMA } = settingsPanel;
  assert.equal('mascot' in SCENE_PRESETS.ultra, false, 'ultra preset must NOT force mascot="crab"');
  assert.equal(SCENE_PRESETS.ultra.motionLevel, 'ultra');
  assert.equal(SCENE_PRESETS.ultra.targetFps, '180');

  assert.ok(SCENE_PRESETS.cozyEco, 'cozyEco scene preset must exist');
  assert.equal(SCENE_PRESETS.cozyEco.mascot, 'cat');
  assert.equal(SCENE_PRESETS.cozyEco.motionLevel, 'standard');
  assert.equal(SCENE_PRESETS.cozyEco.targetFps, '60');
  assert.equal(SCENE_PRESETS.cozyEco.ambientIntensity, '35');
  assert.equal(SCENE_PRESETS.cozyEco.homeRipple, false);
  assert.equal(SCENE_PRESETS.cozyEco.catQuietMode, 'auto');

  const exampleCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.example.json'), 'utf8'));
  for (const [k, def] of [
    ['rainbowStyle', 'aurora'],
    ['rainbowPixelSize', '6'],
    ['catCount', '4'],
    ['catProps', 'on'],
    ['catQuietMode', 'auto'],
  ]) {
    assert.ok(PRISM_SETTINGS_SCHEMA[k], `PRISM_SETTINGS_SCHEMA must include ${k}`);
    assert.equal(PRISM_SETTINGS_SCHEMA[k].default, def);
    assert.equal(exampleCfg[k], def);
  }
});

test('2. pulse-vial-bridge.js stays < 31,000 B, reveals /compact at >=0.65, marks caution at >=0.75, and preserves drafts on Shift+click', async () => {
  const raw = fs.readFileSync(path.join(ROOT, 'pulse-vial-bridge.js'), 'utf8');
  const byteSize = Buffer.byteLength(raw, 'utf8');
  assert.ok(byteSize < 31000, `pulse-vial-bridge.js must remain < 31,000 B, got ${byteSize}`);

  const html = makeMiniEl('html', { 'data-ag-cs-lang': 'zh-CN', 'data-ag-cs-theme': 'light', 'data-ag-cs-motion': 'standard' });
  const body = makeMiniEl('body');
  html.appendChild(body);

  const composer = makeMiniEl('textarea');
  body.appendChild(composer);

  const host = makeMiniEl('div', { id: 'ag-pulse-status-bar', 'data-ag-pulse-bar': 'true', 'data-scope': 'main' });
  const sr = makeMiniEl('div');
  const ctxChip = makeMiniEl('button', { 'data-card': 'context' });
  const ctxRing = makeMiniEl('span', { id: 'context-ring' });
  ctxChip.appendChild(ctxRing);
  const ctxCard = makeMiniEl('section', { id: 'context-card' });
  ctxCard.hidden = false;
  const heading = makeMiniEl('div', { class: 'heading' });
  ctxCard.appendChild(heading);
  sr.appendChild(ctxChip);
  sr.appendChild(ctxCard);
  host.shadowRoot = sr;
  body.appendChild(host);

  const doc = {
    documentElement: html,
    body,
    hidden: false,
    createElement: (t) => makeMiniEl(t),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
    getElementById: (id) => html.getElementById(id),
    addEventListener() {},
    removeEventListener() {},
  };

  let frac = 0.68;
  const win = {
    document: doc,
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
    agPulseHost: {
      getMetrics: async () => ({
        connection: 'live',
        speed: {
          tps: 60,
          latestTps: 60,
          ttftSeconds: 0.5,
          rounds: 2,
          context: { usedTokens: Math.round(512000 * frac), maxTokens: 512000, usedFraction: frac, model: 'Gemini 4', sampledAt: new Date().toISOString() },
        },
      }),
    },
  };

  const bridge = bridgeMod.mountPulseVialBridge({ win, doc, storage: null, autoPoll: false, allowMultiple: true, defaultMode: 'bar' });
  try {
    await bridge.sync();
    const cmpBtn = sr.querySelector('[data-ag-pulse-compact="1"]');
    assert.ok(cmpBtn, '/compact button must be mounted');
    assert.equal(cmpBtn.hidden, false, '/compact button must reveal at >= 0.65 (tested at 0.68)');
    assert.equal(host.hasAttribute('data-pv-warn'), false, 'data-pv-warn must stay off below 0.80');
    assert.equal(ctxChip.hasAttribute('data-caution'), false, 'data-caution must stay off below 0.75');

    // >= 0.75 sets gentle data-caution="1" without triggering >=0.80 data-pv-warn
    frac = 0.76;
    await bridge.sync();
    assert.equal(ctxChip.getAttribute('data-caution'), '1', 'context chip must receive data-caution="1" at >= 0.75');
    assert.equal(host.hasAttribute('data-pv-warn'), false, 'data-pv-warn must still stay off at 0.76');

    // Draft-safe Shift+click must NOT overwrite existing unsent user draft
    composer.value = 'keep my draft';
    cmpBtn.dispatchEvent({ type: 'click', shiftKey: true });
    assert.equal(composer.value, 'keep my draft', 'Shift+click /compact must not mangle existing user draft');

    // Empty composer Shift+click inserts /compact cleanly
    composer.value = '';
    cmpBtn.dispatchEvent({ type: 'click', shiftKey: true });
    assert.equal(composer.value, '/compact');

    // Below 0.65 hides /compact button and clears caution
    frac = 0.60;
    await bridge.sync();
    assert.equal(cmpBtn.hidden, true, '/compact button must hide below 0.65');
    assert.equal(ctxChip.hasAttribute('data-caution'), false);
  } finally {
    bridge.destroy();
  }
});

test('3. CAT_SANCTUARY_REMOVE_EXPRESSION removes .ag-v2-cat-sanctuary and only strips data-cat-sanctuary attr from host stage', () => {
  const html = makeMiniEl('html', { 'data-ag-cat-peek': '1' });
  const body = makeMiniEl('body');
  html.appendChild(body);
  const hostStage = makeMiniEl('div', { class: 'ag-cs-crab ag-cs-dual-stage', 'data-cat-sanctuary': '1' });
  const sanctuaryWrap = makeMiniEl('div', { class: 'ag-v2-cat-sanctuary' });
  hostStage.appendChild(sanctuaryWrap);
  body.appendChild(hostStage);

  let disposed = 0;
  const sandbox = {
    window: {},
    globalThis: {},
    document: {
      documentElement: html,
      querySelectorAll: (sel) => html.querySelectorAll(sel),
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.__agCatSanctuaryFactory = () => ({});
  sandbox.__agCatSanctuaryBridge = { dispose() { disposed += 1; } };

  vm.runInNewContext(cdp.CAT_SANCTUARY_REMOVE_EXPRESSION, sandbox);

  assert.equal(disposed, 1, 'CAT_SANCTUARY_REMOVE_EXPRESSION must invoke bridge.dispose()');
  assert.equal(sandbox.__agCatSanctuaryFactory, undefined, 'must delete __agCatSanctuaryFactory');
  assert.equal(sanctuaryWrap.removed, true, 'must remove .ag-v2-cat-sanctuary node');
  assert.equal(hostStage.removed, false, 'must NEVER delete .ag-cs-crab.ag-cs-dual-stage host stage');
  assert.equal(hostStage.hasAttribute('data-cat-sanctuary'), false, 'must strip data-cat-sanctuary attribute');
  assert.equal(html.hasAttribute('data-ag-cat-peek'), false, 'must strip data-ag-cat-peek attribute');
});

test('4. Channel 8 (catSanctuary) & Channel 9 (effortSlider) fail-closed when disabled and compile cleanly when enabled', () => {
  assert.equal(cdp.shouldEnableCatSanctuary({ mascot: 'crab' }), false);
  assert.equal(cdp.shouldEnableCatSanctuary({ mascot: 'off' }), false);
  assert.equal(cdp.buildCatSanctuaryExpression({ mascot: 'crab' }), '');

  assert.equal(cdp.shouldEnableCatSanctuary({ mascot: 'cat' }), true);
  const ch8 = cdp.buildCatSanctuaryExpression({ mascot: 'cat', catCount: '4', catProps: 'on', catQuietMode: 'auto' }, { useCache: false });
  assert.ok(ch8.length > 1000, 'Channel 8 compiled payload must be non-empty when mascot="cat"');
  assert.doesNotThrow(() => new vm.Script(ch8), 'Channel 8 compiled expression must be valid JS');

  assert.equal(typeof cdp.shouldEnableEffortSlider, 'function', 'cdp.js must export shouldEnableEffortSlider');
  assert.equal(typeof cdp.buildEffortSliderExpression, 'function', 'cdp.js must export buildEffortSliderExpression');
  assert.equal(typeof cdp.EFFORT_SLIDER_REMOVE_EXPRESSION, 'string', 'cdp.js must export EFFORT_SLIDER_REMOVE_EXPRESSION');
  assert.equal(cdp.shouldEnableEffortSlider({ effortSliderModule: 'off' }), false);
  assert.equal(cdp.buildEffortSliderExpression({ effortSliderModule: 'off' }), '');
  assert.equal(cdp.shouldEnableEffortSlider({ effortSliderModule: 'auto' }), true);
  const ch9 = cdp.buildEffortSliderExpression({ effortSliderModule: 'auto' }, { useCache: false });
  assert.ok(ch9.length > 500, 'Channel 9 effortSlider payload must be non-empty when enabled');
  assert.doesNotThrow(() => new vm.Script(ch9), 'Channel 9 compiled expression must be valid JS');
  assert.doesNotThrow(() => new vm.Script(cdp.EFFORT_SLIDER_REMOVE_EXPRESSION), 'Channel 9 remove expression must be valid JS');
});

test('5. dual-mascot-rig.js catOnly disables legacy setInterval heartbeat and returns before drawing legacy canvases', () => {
  const html = makeMiniEl('html', { 'data-ag-cs-theme': 'light', 'data-ag-cs-motion': 'ultra' });
  const hostEl = makeMiniEl('div', { class: 'ag-cs-crab ag-cs-dual-stage' });
  hostEl.clientWidth = 520;
  html.appendChild(hostEl);

  let legacyCanvasDraws = 0;
  let intervalCount = 0;
  const doc = {
    documentElement: html,
    body: html,
    hidden: false,
    defaultView: null,
    createElement(t) {
      const el = makeMiniEl(t);
      el.ownerDocument = doc;
      if (String(t).toLowerCase() === 'canvas') {
        el.width = 0;
        el.height = 0;
        el.getContext = () => ({
          setTransform() {},
          clearRect() { legacyCanvasDraws += 1; },
          fillRect() { legacyCanvasDraws += 1; },
          imageSmoothingEnabled: false,
          fillStyle: '',
        });
      }
      return el;
    },
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
    addEventListener() {},
    removeEventListener() {},
  };
  const win = {
    document: doc,
    devicePixelRatio: 2,
    addEventListener() {},
    removeEventListener() {},
    setInterval() { intervalCount += 1; return intervalCount; },
    clearInterval() {},
    setTimeout,
    clearTimeout,
  };
  doc.defaultView = win;
  html.ownerDocument = doc;
  hostEl.ownerDocument = doc;

  const prevSetInterval = globalThis.setInterval;
  let globalIntervalCount = 0;
  globalThis.setInterval = (...args) => { globalIntervalCount += 1; return prevSetInterval(...args); };

  let rig;
  try {
    rig = dualMascotMod.mountDualMascotStage(hostEl, { catOnly: true, motionLevel: 'ultra' });
    const drawsAfterMount = legacyCanvasDraws;
    rig.setState({ streaming: true });
    rig.setState({ camp: 'claude' });
    assert.equal(intervalCount, 0, 'catOnly mode must not spawn window setInterval legacy heartbeat');
    assert.equal(globalIntervalCount, 0, 'catOnly mode must not spawn global setInterval legacy heartbeat');
    assert.equal(legacyCanvasDraws, 0, 'catOnly renderAllFrames must return before drawing legacy canvases even on mount');
    assert.equal(legacyCanvasDraws, drawsAfterMount, 'catOnly renderAllFrames must not draw legacy canvases on state updates');
  } finally {
    globalThis.setInterval = prevSetInterval;
    rig?.dispose?.();
    rig?.destroy?.();
  }
});

test('6. ripple-core.js Bayer 4x4 pixel rainbow (WebGL2 shader + 2D renderer) and home-ripple-host.js reach <= 0.30', () => {
  const rippleSrc = fs.readFileSync(path.join(ROOT, 'ripple-core.js'), 'utf8');
  assert.ok(rippleSrc.includes('float bayer4(vec2 c)'), 'WebGL2 fragment shader must include bayer4 ordered dithering');
  assert.ok(rippleSrc.includes('uniform float uPixelSize;'), 'WebGL2 fragment shader must expose uPixelSize uniform');

  // Verify 2D Bayer rainbow renderer produces quantized 6x6 blocks with non-zero alpha
  const w = 96, h = 48;
  let lastImg = null;
  const mockCanvas = {
    width: w,
    height: h,
    ownerDocument: {
      hidden: false,
      documentElement: {
        getAttribute(k) {
          if (k === 'data-ag-rainbow-style') return 'pixel';
          if (k === 'data-ag-rainbow-px') return '6';
          return null;
        },
      },
    },
    getContext(kind) {
      if (kind !== '2d') return null;
      return {
        createImageData: (cw, ch) => ({ width: cw, height: ch, data: new Uint8ClampedArray(cw * ch * 4) }),
        putImageData(img) { lastImg = img; },
        clearRect() {},
      };
    },
  };

  const horizon = rippleCore.mountBrandHorizonGlow(mockCanvas, { force2D: true });
  try {
    horizon.resize(w, h, 1);
    const drew = horizon.draw(1200, { dark: false, still: false, spectrum: 'rainbow', rainbowStyle: 'pixel', rainbowPixelSize: 6, ambientIntensity: 1, reach: 0.26 });
    assert.equal(drew, true, '2D Bayer rainbow draw() must execute');
    assert.ok(lastImg && lastImg.data.length === w * h * 4, '2D Bayer rainbow must render ImageData');

    // Find at least one painted 6x6 block and verify all 36 pixels share identical RGBA
    let paintedBlocks = 0;
    for (let by = 0; by < h; by += 6) {
      for (let bx = 0; bx < w; bx += 6) {
        const baseIdx = (by * w + bx) * 4;
        const r0 = lastImg.data[baseIdx], g0 = lastImg.data[baseIdx + 1], b0 = lastImg.data[baseIdx + 2], a0 = lastImg.data[baseIdx + 3];
        if (a0 > 0) paintedBlocks += 1;
        for (let dy = 0; dy < 6; dy++) {
          for (let dx = 0; dx < 6; dx++) {
            const idx = ((by + dy) * w + (bx + dx)) * 4;
            assert.equal(lastImg.data[idx], r0);
            assert.equal(lastImg.data[idx + 1], g0);
            assert.equal(lastImg.data[idx + 2], b0);
            assert.equal(lastImg.data[idx + 3], a0);
          }
        }
      }
    }
    assert.ok(paintedBlocks >= 4, `2D Bayer rainbow must paint visible quantized 6x6 blocks (got ${paintedBlocks})`);
  } finally {
    horizon.dispose();
  }

  // Verify home-ripple-host.js converged home reach <= 0.30
  const homeHostSrc = fs.readFileSync(path.join(ROOT, 'home-ripple-host.js'), 'utf8');
  const reachMatch = homeHostSrc.match(/aura:\s*\{\s*reach:\s*([0-9.]+)/);
  assert.ok(reachMatch, 'home-ripple-host.js must define initial aura.reach');
  assert.ok(Number(reachMatch[1]) <= 0.30, `home aura.reach must be <= 0.30, got ${reachMatch[1]}`);
});

test('7. PrismDaemon edge-triggered no-port backoff eliminates 3s repeated daemon.log spam', async () => {
  const { PrismDaemon } = await import(path.join(ROOT, 'sidecars', 'daemon', 'main.mjs'));
  const logs = [];
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-overhaul-test-'));
  const missingPortFile = path.join(tmpDir, 'nonexistent-DevToolsActivePort');
  try {
    const daemon = new PrismDaemon({
      rootDir: ROOT,
      portFile: missingPortFile,
      overridePort: null,
      pollIntervalMs: 3000,
      silent: true,
      enabledCheck: () => true,
      relaunchHooks: {
        syncShortcuts: () => ({ patched: [], skipped: [], alreadySet: ['ok'], matched: 1 }),
        detectHost: async () => null,
      },
    });
    daemon.log = (msg) => logs.push(String(msg));
    daemon.running = true;
    daemon.timer = {}; // mimic persistent daemon mode without starting real setInterval
    daemon.isCurrentOwner = () => true;

    // 4 consecutive missing-port ticks starting from unknown -> 0 reset logs
    for (let i = 0; i < 4; i++) await daemon.tick();
    const initialResets = logs.filter((l) => l.includes('Reset shortcut backoff (no-port)'));
    assert.equal(initialResets.length, 0, 'Cold missing-port ticks must emit 0 backoff-reset logs');

    // Simulate active -> missing edge transition, then 4 consecutive missing ticks -> exactly 1 reset log
    daemon._portState = 'active';
    daemon._hasActiveCdpPort = true;
    daemon._lastShortcutCheckAt = Date.now();
    for (let i = 0; i < 4; i++) await daemon.tick();
    const edgeResets = logs.filter((l) => l.includes('Reset shortcut backoff (no-port)'));
    assert.equal(edgeResets.length, 1, `active->missing edge must log backoff reset exactly once, got ${edgeResets.length}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
