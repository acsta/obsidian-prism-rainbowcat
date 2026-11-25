// Obsidian Prism — Channel 10 Selectable Chat Scene Overlay Runtime
// Optional decorative chat-pane ambient themes (default: 'off', zero impact on Channel 1):
//   - 'sky'        : Sky Sanctuary (rainbow arch, drifting marshmallow clouds, moon-cat watermark, interactive star-moon-cat chime)
//   - 'stationery' : Pastel Stationery (margin-only micro dot-grid, watercolor wash, rising pixel sparkles, prism-cat stamp, milk + interactive yarn ball)
// Security & Hygiene: pure DOM/SVG construction (no HTML string injection), pure ASCII CSS, zero parent-selector rules, 5+1 anti-translation attrs,
// 0Hz pause on blur/hidden/motion=off/reduced-motion, Home (.agy-home) & browser-hole auto-hide, narrow-width margin clearance.

(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
  if (!G) return;

  const CONTROLLER_KEY = '__agChatSceneController';
  const ROOT_ID = 'ag-prism-chat-scene-root';
  const STYLE_ID = 'ag-prism-chat-scene-css';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const NARROW_WIDTH_PX = 1040;
  const READING_COL_PX = 760;
  const MAX_SPARKLES = 8;

  const VALID_MODES = Object.freeze({
    off: 'off',
    sky: 'sky',
    stationery: 'stationery',
  });

  const NO_TR_ATTRS = Object.freeze([
    ['translate', 'no'],
    ['data-no-translate', 'true'],
    ['data-ag-localization-skip', 'true'],
    ['data-agy-no-translate', 'true'],
    ['data-antigravity-zh-skip', '1'],
    ['data-ag-no-i18n', ''],
    ['data-ag-owned', '1'],
  ]);

  const SUBAGENT_SEL = '[data-testid="subagent-tab-conversation"]';
  const RUNNING_SEL =
    '[data-testid="input-cancel-button"], [data-testid="stop-button"], [data-testid="cancel-button"], [data-testid="agent-loading"], [data-testid="thinking-collapsible-trigger"][data-op-thought-state="streaming"]';

  // Dispose any prior instance cleanly on re-injection
  try {
    if (G[CONTROLLER_KEY] && typeof G[CONTROLLER_KEY].dispose === 'function') {
      G[CONTROLLER_KEY].dispose();
    }
  } catch {}

  function normalizeMode(input) {
    let raw = input;
    if (raw && typeof raw === 'object') {
      raw = raw.chatScene;
    }
    if (typeof raw !== 'string') return 'off';
    const key = raw.trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(VALID_MODES, key) ? VALID_MODES[key] : 'off';
  }

  function applyNoTr(el) {
    if (!el || typeof el.setAttribute !== 'function') return el;
    for (let i = 0; i < NO_TR_ATTRS.length; i++) {
      el.setAttribute(NO_TR_ATTRS[i][0], NO_TR_ATTRS[i][1]);
    }
    return el;
  }

  function setAttrIfChanged(el, name, val) {
    if (!el || typeof el.getAttribute !== 'function') return;
    if (val === null || val === undefined || val === false) {
      if (typeof el.hasAttribute === 'function' ? el.hasAttribute(name) : el.getAttribute(name) !== null) {
        el.removeAttribute(name);
      }
      return;
    }
    const str = String(val);
    if (el.getAttribute(name) !== str) {
      el.setAttribute(name, str);
    }
  }

  function isNodeVisible(el) {
    if (!el || el.hidden === true || el.isConnected === false) return false;
    const st = el.style;
    if (st && (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0')) return false;
    if (typeof el.closest === 'function' && el.closest('[hidden], .hidden')) return false;
    if (typeof el.checkVisibility === 'function') {
      try {
        if (!el.checkVisibility()) return false;
      } catch {}
    }
    return true;
  }

  function createHtmlEl(doc, tag, attrs, children) {
    const el = doc.createElement(tag);
    if (attrs) {
      const keys = Object.keys(attrs);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = String(v);
        else if (k === 'text') el.textContent = String(v);
        else el.setAttribute(k, String(v));
      }
    }
    if (Array.isArray(children)) {
      for (let i = 0; i < children.length; i++) {
        if (children[i]) el.appendChild(children[i]);
      }
    }
    return el;
  }

  function createSvgEl(doc, tag, attrs, children) {
    const el =
      typeof doc.createElementNS === 'function'
        ? doc.createElementNS(SVG_NS, tag)
        : doc.createElement(tag);
    if (attrs) {
      const keys = Object.keys(attrs);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        el.setAttribute(k, String(v));
      }
    }
    if (Array.isArray(children)) {
      for (let i = 0; i < children.length; i++) {
        if (children[i]) el.appendChild(children[i]);
      }
    }
    return el;
  }

  // Pure ASCII CSS, zero parent-selector rules, strictly scoped under #ag-prism-chat-scene-root
  const SCENE_CSS = [
    '#ag-prism-chat-scene-root {',
    '  position: absolute;',
    '  inset: 0;',
    '  pointer-events: none;',
    '  overflow: hidden;',
    '  z-index: auto;',
    '  user-select: none;',
    '  -webkit-user-select: none;',
    '  --ag-scene-side-margin: 180px;',
    '  --ag-scene-col-half: 380px;',
    '  --ag-sky-cloud-top: rgba(255, 255, 255, 0.96);',
    '  --ag-sky-cloud-mid: rgba(245, 234, 255, 0.93);',
    '  --ag-sky-cloud-bot: rgba(232, 216, 253, 0.90);',
    '  --ag-sky-cloud-rim: rgba(196, 174, 244, 0.78);',
    '  --ag-sky-cloud-back-top: rgba(254, 234, 246, 0.88);',
    '  --ag-sky-cloud-back-mid: rgba(246, 228, 254, 0.82);',
    '  --ag-sky-cloud-back-bot: rgba(228, 210, 253, 0.76);',
    '  --ag-sky-cloud-back-rim: rgba(226, 194, 240, 0.56);',
    '  --ag-sky-cloud-shadow: rgba(182, 160, 234, 0.24);',
    '  --ag-sky-rainbow-opacity: 0.62;',
    '  --ag-sky-mooncat-stroke: #8c78bf;',
    '  --ag-sky-mooncat-fill: rgba(216, 200, 252, 0.24);',
    '  --ag-sky-mooncat-opacity: 0.19;',
    '  --ag-sky-chime-chain: rgba(164, 150, 206, 0.72);',
    '  --ag-sky-chime-stroke: #9480c8;',
    '  --ag-sky-chime-glow: rgba(221, 202, 255, 0.65);',
    '  --ag-st-dot-color: rgba(126, 110, 174, 0.13);',
    '  --ag-st-wash-opacity: 0.62;',
    '  --ag-st-stamp-opacity: 0.56;',
    '  --ag-st-line: #8776b8;',
    '  --ag-st-paper: rgba(255, 254, 255, 0.92);',
    '  --ag-st-milk-cap: #dcd2fb;',
    '  --ag-st-milk-stripe: #e9d8fd;',
    '  --ag-st-yarn-main: #f3c6e8;',
    '  --ag-st-yarn-deep: #d4b8f8;',
    '  --ag-st-yarn-hi: #fff3fb;',
    '  --ag-st-paw: rgba(168, 144, 224, 0.52);',
    '  --ag-st-vignette-opacity: 0.88;',
    '}',
    '#ag-prism-chat-scene-root[data-theme="dark"] {',
    '  --ag-sky-cloud-top: rgba(62, 54, 98, 0.86);',
    '  --ag-sky-cloud-mid: rgba(44, 39, 74, 0.82);',
    '  --ag-sky-cloud-bot: rgba(30, 26, 54, 0.84);',
    '  --ag-sky-cloud-rim: rgba(196, 181, 253, 0.42);',
    '  --ag-sky-cloud-back-top: rgba(76, 58, 114, 0.58);',
    '  --ag-sky-cloud-back-mid: rgba(54, 44, 88, 0.52);',
    '  --ag-sky-cloud-back-bot: rgba(36, 30, 64, 0.48);',
    '  --ag-sky-cloud-back-rim: rgba(196, 181, 253, 0.24);',
    '  --ag-sky-cloud-shadow: rgba(12, 10, 28, 0.42);',
    '  --ag-sky-rainbow-opacity: 0.36;',
    '  --ag-sky-mooncat-stroke: #c4b5fd;',
    '  --ag-sky-mooncat-fill: rgba(196, 181, 253, 0.14);',
    '  --ag-sky-mooncat-opacity: 0.22;',
    '  --ag-sky-chime-chain: rgba(196, 181, 253, 0.56);',
    '  --ag-sky-chime-stroke: #c4b5fd;',
    '  --ag-sky-chime-glow: rgba(167, 139, 250, 0.45);',
    '  --ag-st-dot-color: rgba(196, 181, 253, 0.13);',
    '  --ag-st-wash-opacity: 0.28;',
    '  --ag-st-stamp-opacity: 0.46;',
    '  --ag-st-line: #c4b5fd;',
    '  --ag-st-paper: rgba(36, 33, 56, 0.88);',
    '  --ag-st-milk-cap: #5b4d8a;',
    '  --ag-st-milk-stripe: #4b3f74;',
    '  --ag-st-yarn-main: #c084b8;',
    '  --ag-st-yarn-deep: #8b74c9;',
    '  --ag-st-yarn-hi: #f5d0fe;',
    '  --ag-st-paw: rgba(196, 181, 253, 0.42);',
    '  --ag-st-vignette-opacity: 0.82;',
    '}',
    '#ag-prism-chat-scene-root[data-hole="1"],',
    '#ag-prism-chat-scene-root[data-home="1"] {',
    '  display: none !important;',
    '}',
    '#ag-prism-chat-scene-root .ag-cs-scene-bg {',
    '  position: absolute;',
    '  inset: 0;',
    '  z-index: 0;',
    '  pointer-events: none;',
    '  overflow: hidden;',
    '}',
    '#ag-prism-chat-scene-root .ag-cs-scene-charm {',
    '  position: absolute;',
    '  z-index: 4;',
    '  pointer-events: auto;',
    '  cursor: pointer;',
    '  background: transparent;',
    '  border: 0;',
    '  padding: 0;',
    '  margin: 0;',
    '  outline: none;',
    '  -webkit-tap-highlight-color: transparent;',
    '}',
    '#ag-prism-chat-scene-root .ag-cs-scene-charm:focus-visible {',
    '  outline: 1.5px dashed var(--ag-sky-chime-stroke);',
    '  outline-offset: 3px;',
    '  border-radius: 12px;',
    '}',
    /* --- Sky Sanctuary (Concept B) --- */
    '#ag-prism-chat-scene-root .ag-scene-sky-rainbow {',
    '  position: absolute;',
    '  left: -4%;',
    '  right: -4%;',
    '  bottom: -10px;',
    '  height: 390px;',
    '  --ag-scene-breathe-op: var(--ag-sky-rainbow-opacity);',
    '  opacity: var(--ag-scene-breathe-op);',
    '  animation: ag-scene-breathe 14s ease-in-out infinite;',
    '  will-change: opacity;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-sky-rainbow svg {',
    '  width: 100%;',
    '  height: 100%;',
    '  display: block;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-cloud-bank {',
    '  position: absolute;',
    '  pointer-events: none;',
    '  will-change: transform;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-cloud-bank svg {',
    '  width: 100%;',
    '  height: 100%;',
    '  display: block;',
    '  overflow: visible;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-cloud-back-l {',
    '  left: -34px;',
    '  bottom: 18px;',
    '  width: 396px;',
    '  height: 188px;',
    '  animation: ag-scene-drift-a 24s ease-in-out infinite;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-cloud-back-r {',
    '  right: -34px;',
    '  bottom: 22px;',
    '  width: 406px;',
    '  height: 192px;',
    '  animation: ag-scene-drift-b 26s ease-in-out infinite;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-cloud-mid-l {',
    '  left: -26px;',
    '  bottom: -12px;',
    '  width: 344px;',
    '  height: 160px;',
    '  filter: drop-shadow(0 -2px 8px var(--ag-sky-cloud-shadow));',
    '  animation: ag-scene-drift-c 19s ease-in-out infinite;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-cloud-mid-r {',
    '  right: -24px;',
    '  bottom: -10px;',
    '  width: 354px;',
    '  height: 164px;',
    '  filter: drop-shadow(0 -2px 8px var(--ag-sky-cloud-shadow));',
    '  animation: ag-scene-drift-d 21s ease-in-out infinite;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-cloud-front-l {',
    '  left: -18px;',
    '  bottom: -24px;',
    '  width: 248px;',
    '  height: 112px;',
    '  filter: drop-shadow(0 -2px 6px var(--ag-sky-cloud-shadow));',
    '  animation: ag-scene-drift-e 16s ease-in-out infinite;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-cloud-front-r {',
    '  right: -18px;',
    '  bottom: -24px;',
    '  width: 256px;',
    '  height: 114px;',
    '  filter: drop-shadow(0 -2px 6px var(--ag-sky-cloud-shadow));',
    '  animation: ag-scene-drift-f 17s ease-in-out infinite;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-cloud-top-l {',
    '  left: 16px;',
    '  top: 26px;',
    '  width: 148px;',
    '  height: 58px;',
    '  opacity: 0.42;',
    '  animation: ag-scene-drift-a 25s ease-in-out infinite;',
    '  transition: opacity 240ms ease;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-sky-mooncat {',
    '  position: absolute;',
    '  top: 41%;',
    '  right: 22px;',
    '  width: 138px;',
    '  height: 138px;',
    '  opacity: var(--ag-sky-mooncat-opacity);',
    '  transition: opacity 240ms ease;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-sky-mooncat svg {',
    '  width: 100%;',
    '  height: 100%;',
    '  display: block;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-twinkle-1 {',
    '  animation: ag-scene-twinkle 4.4s ease-in-out infinite;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-twinkle-2 {',
    '  animation: ag-scene-twinkle 5.6s ease-in-out 1.4s infinite;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-twinkle-3 {',
    '  animation: ag-scene-twinkle 6.2s ease-in-out 2.6s infinite;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-sky-chime {',
    '  top: 0;',
    '  right: 22px;',
    '  width: 112px;',
    '  height: 228px;',
    '  transform-origin: 56px 0;',
    '  animation: ag-scene-chime-sway 7.8s ease-in-out infinite;',
    '  transition: filter 220ms ease, opacity 240ms ease;',
    '  will-change: transform;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-sky-chime:hover {',
    '  filter: drop-shadow(0 0 8px var(--ag-sky-chime-glow));',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-sky-chime.is-ringing {',
    '  animation: ag-scene-chime-ring 1.45s cubic-bezier(0.22, 0.61, 0.36, 1) 1;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-sky-chime svg {',
    '  width: 100%;',
    '  height: 100%;',
    '  display: block;',
    '  overflow: visible;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-chime-burst,',
    '#ag-prism-chat-scene-root .ag-scene-yarn-burst {',
    '  position: absolute;',
    '  inset: 0;',
    '  pointer-events: none;',
    '  overflow: visible;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-burst-star {',
    '  position: absolute;',
    '  pointer-events: none;',
    '  animation: ag-scene-burst-pop 1050ms cubic-bezier(0.16, 0.84, 0.34, 1) forwards;',
    '  will-change: transform, opacity;',
    '}',
    /* --- Pastel Stationery (Concept C) --- */
    '#ag-prism-chat-scene-root .ag-scene-st-dotgrid {',
    '  position: absolute;',
    '  inset: 0;',
    '  background-image: radial-gradient(circle, var(--ag-st-dot-color) 1.15px, transparent 1.25px);',
    '  background-size: 18px 18px;',
    '  background-position: 0 0;',
    '  -webkit-mask-image: linear-gradient(to right, rgba(0, 0, 0, 0.94) 0%, rgba(0, 0, 0, 0.88) calc(50% - var(--ag-scene-col-half, 380px) - 24px), transparent calc(50% - var(--ag-scene-col-half, 380px) + 18px), transparent calc(50% + var(--ag-scene-col-half, 380px) - 18px), rgba(0, 0, 0, 0.88) calc(50% + var(--ag-scene-col-half, 380px) + 24px), rgba(0, 0, 0, 0.94) 100%);',
    '  mask-image: linear-gradient(to right, rgba(0, 0, 0, 0.94) 0%, rgba(0, 0, 0, 0.88) calc(50% - var(--ag-scene-col-half, 380px) - 24px), transparent calc(50% - var(--ag-scene-col-half, 380px) + 18px), transparent calc(50% + var(--ag-scene-col-half, 380px) - 18px), rgba(0, 0, 0, 0.88) calc(50% + var(--ag-scene-col-half, 380px) + 24px), rgba(0, 0, 0, 0.94) 100%);',
    '  transition: opacity 240ms ease;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-st-watercolor {',
    '  position: absolute;',
    '  left: -4%;',
    '  right: -4%;',
    '  bottom: -10px;',
    '  height: 230px;',
    '  --ag-scene-breathe-op: var(--ag-st-wash-opacity);',
    '  opacity: var(--ag-scene-breathe-op);',
    '  animation: ag-scene-breathe 16s ease-in-out infinite;',
    '  will-change: opacity;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-st-watercolor svg {',
    '  width: 100%;',
    '  height: 100%;',
    '  display: block;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-st-stamp {',
    '  position: absolute;',
    '  top: 26px;',
    '  right: 26px;',
    '  width: 118px;',
    '  height: 110px;',
    '  opacity: var(--ag-st-stamp-opacity);',
    '  transition: opacity 240ms ease;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-st-stamp svg {',
    '  width: 100%;',
    '  height: 100%;',
    '  display: block;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-st-vignette-art {',
    '  position: absolute;',
    '  right: 20px;',
    '  bottom: 18px;',
    '  width: 156px;',
    '  height: 118px;',
    '  opacity: var(--ag-st-vignette-opacity);',
    '  transition: opacity 240ms ease;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-st-vignette-art svg {',
    '  width: 100%;',
    '  height: 100%;',
    '  display: block;',
    '  overflow: visible;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-st-yarn-btn {',
    '  right: 22px;',
    '  bottom: 22px;',
    '  width: 58px;',
    '  height: 54px;',
    '  transform-origin: 50% 82%;',
    '  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), filter 200ms ease, opacity 240ms ease;',
    '  will-change: transform;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-st-yarn-btn:hover {',
    '  transform: translate3d(0, -2px, 0) scale(1.07) rotate(-4deg);',
    '  filter: drop-shadow(0 3px 8px rgba(212, 174, 244, 0.55));',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-st-yarn-btn.is-bouncing {',
    '  animation: ag-scene-yarn-squish 660ms cubic-bezier(0.24, 0.86, 0.32, 1) 1;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-st-yarn-btn svg {',
    '  width: 100%;',
    '  height: 100%;',
    '  display: block;',
    '  overflow: visible;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-st-flank {',
    '  position: absolute;',
    '  bottom: 24px;',
    '  height: 250px;',
    '  width: 118px;',
    '  pointer-events: none;',
    '  overflow: visible;',
    '  transition: opacity 240ms ease;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-st-flank-l {',
    '  left: 10px;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-st-flank-r {',
    '  right: 14px;',
    '  bottom: 110px;',
    '}',
    '#ag-prism-chat-scene-root .ag-scene-px-sparkle {',
    '  position: absolute;',
    '  bottom: 0;',
    '  pointer-events: none;',
    '  image-rendering: pixelated;',
    '  animation-name: ag-scene-px-rise;',
    '  animation-timing-function: ease-out;',
    '  animation-fill-mode: forwards;',
    '  will-change: transform, opacity;',
    '}',
    /* --- Responsive Narrow Viewport (<1040px): Hide All Side-Margin Art & Charms --- */
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-sky-mooncat,',
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-sky-chime,',
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-cloud-top-l,',
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-st-dotgrid,',
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-st-stamp,',
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-st-vignette-art,',
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-st-yarn-btn,',
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-st-flank {',
    '  opacity: 0 !important;',
    '  visibility: hidden !important;',
    '  pointer-events: none !important;',
    '}',
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-cloud-back-l,',
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-cloud-back-r {',
    '  width: 240px;',
    '  height: 118px;',
    '}',
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-cloud-mid-l,',
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-cloud-mid-r {',
    '  width: 210px;',
    '  height: 102px;',
    '}',
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-cloud-front-l,',
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-cloud-front-r {',
    '  width: 158px;',
    '  height: 76px;',
    '}',
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-sky-rainbow {',
    '  height: 255px;',
    '}',
    '#ag-prism-chat-scene-root[data-narrow="1"] .ag-scene-st-watercolor {',
    '  height: 160px;',
    '}',
    /* --- Streaming Calm Mode (stationery sparkles) --- */
    '#ag-prism-chat-scene-root[data-streaming="1"] .ag-scene-px-sparkle {',
    '  animation-play-state: paused !important;',
    '}',
    /* --- 0Hz Pause (blur, hidden, motion=off, prefers-reduced-motion) --- */
    '#ag-prism-chat-scene-root[data-paused="1"] *,',
    '#ag-prism-chat-scene-root[data-paused="1"] *::before,',
    '#ag-prism-chat-scene-root[data-paused="1"] *::after {',
    '  animation-play-state: paused !important;',
    '  transition: none !important;',
    '}',
    /* --- Keyframes (100% GPU transform/opacity) --- */
    '@keyframes ag-scene-breathe {',
    '  0%, 100% { opacity: var(--ag-scene-breathe-op, 0.65); }',
    '  50% { opacity: calc(var(--ag-scene-breathe-op, 0.65) * 0.86); }',
    '}',
    '@keyframes ag-scene-drift-a {',
    '  0%, 100% { transform: translate3d(0px, 0px, 0); }',
    '  50% { transform: translate3d(14px, -4px, 0); }',
    '}',
    '@keyframes ag-scene-drift-b {',
    '  0%, 100% { transform: translate3d(0px, 0px, 0); }',
    '  50% { transform: translate3d(-15px, -3px, 0); }',
    '}',
    '@keyframes ag-scene-drift-c {',
    '  0%, 100% { transform: translate3d(0px, 0px, 0); }',
    '  50% { transform: translate3d(10px, -3px, 0); }',
    '}',
    '@keyframes ag-scene-drift-d {',
    '  0%, 100% { transform: translate3d(0px, 0px, 0); }',
    '  50% { transform: translate3d(-11px, -3px, 0); }',
    '}',
    '@keyframes ag-scene-drift-e {',
    '  0%, 100% { transform: translate3d(0px, 0px, 0); }',
    '  50% { transform: translate3d(7px, -2px, 0); }',
    '}',
    '@keyframes ag-scene-drift-f {',
    '  0%, 100% { transform: translate3d(0px, 0px, 0); }',
    '  50% { transform: translate3d(-7px, -2px, 0); }',
    '}',
    '@keyframes ag-scene-twinkle {',
    '  0%, 100% { opacity: 0.45; transform: scale(0.92); }',
    '  50% { opacity: 1; transform: scale(1.12); }',
    '}',
    '@keyframes ag-scene-chime-sway {',
    '  0%, 100% { transform: rotate(-2.1deg); }',
    '  50% { transform: rotate(2.1deg); }',
    '}',
    '@keyframes ag-scene-chime-ring {',
    '  0% { transform: rotate(0deg); }',
    '  14% { transform: rotate(10.5deg); }',
    '  32% { transform: rotate(-7.8deg); }',
    '  50% { transform: rotate(4.8deg); }',
    '  68% { transform: rotate(-2.6deg); }',
    '  84% { transform: rotate(1.1deg); }',
    '  100% { transform: rotate(0deg); }',
    '}',
    '@keyframes ag-scene-burst-pop {',
    '  0% { opacity: 0; transform: translate3d(0px, 0px, 0) scale(0.45); }',
    '  20% { opacity: 1; }',
    '  100% { opacity: 0; transform: translate3d(var(--ag-bx, 0px), var(--ag-by, -28px), 0) scale(1.15); }',
    '}',
    '@keyframes ag-scene-yarn-squish {',
    '  0% { transform: translate3d(0, 0, 0) scale(1, 1) rotate(0deg); }',
    '  18% { transform: translate3d(0, 3px, 0) scale(1.18, 0.82) rotate(-6deg); }',
    '  44% { transform: translate3d(-4px, -11px, 0) scale(0.9, 1.14) rotate(9deg); }',
    '  72% { transform: translate3d(1px, 1px, 0) scale(1.06, 0.94) rotate(-3deg); }',
    '  100% { transform: translate3d(0, 0, 0) scale(1, 1) rotate(0deg); }',
    '}',
    '@keyframes ag-scene-px-rise {',
    '  0% { opacity: 0; transform: translate3d(0px, 0px, 0) scale(0.85); }',
    '  16% { opacity: 0.78; }',
    '  76% { opacity: 0.62; }',
    '  100% { opacity: 0; transform: translate3d(var(--ag-sx, 6px), var(--ag-sy, -72px), 0) scale(1); }',
    '}',
  ].join('\n');

  // ── Shared Pixel Sparkle SVG Factory (crispEdges, pure SVG DOM) ──
  const PIXEL_GLYPHS = Object.freeze([
    {
      // Pixel + sparkle (7x7)
      w: 7,
      h: 7,
      color: '#c4b5fd',
      rects: [
        [3, 0, 1, 2],
        [3, 5, 1, 2],
        [0, 3, 2, 1],
        [5, 3, 2, 1],
        [3, 3, 1, 1],
      ],
    },
    {
      // Pixel 4-point diamond star (7x7)
      w: 7,
      h: 7,
      color: '#f9a8d4',
      rects: [
        [3, 0, 1, 1],
        [2, 1, 3, 1],
        [1, 2, 5, 1],
        [0, 3, 7, 1],
        [1, 4, 5, 1],
        [2, 5, 3, 1],
        [3, 6, 1, 1],
      ],
    },
    {
      // Pixel heart (7x6)
      w: 7,
      h: 6,
      color: '#fda4af',
      rects: [
        [1, 0, 2, 1],
        [4, 0, 2, 1],
        [0, 1, 7, 2],
        [1, 3, 5, 1],
        [2, 4, 3, 1],
        [3, 5, 1, 1],
      ],
    },
    {
      // Pixel eighth note (7x8)
      w: 7,
      h: 8,
      color: '#7dd3fc',
      rects: [
        [3, 0, 3, 1],
        [3, 1, 1, 5],
        [5, 1, 2, 1],
        [1, 5, 3, 2],
        [2, 7, 1, 1],
      ],
    },
    {
      // Warm butter pixel cross (5x5)
      w: 5,
      h: 5,
      color: '#fcd34d',
      rects: [
        [2, 0, 1, 5],
        [0, 2, 5, 1],
      ],
    },
  ]);

  function buildPixelGlyphSvg(doc, glyphIdx, pxSize, colorOverride) {
    const g = PIXEL_GLYPHS[glyphIdx % PIXEL_GLYPHS.length];
    const children = [];
    const fill = colorOverride || g.color;
    for (let i = 0; i < g.rects.length; i++) {
      const r = g.rects[i];
      children.push(
        createSvgEl(doc, 'rect', {
          x: r[0],
          y: r[1],
          width: r[2],
          height: r[3],
          fill,
        })
      );
    }
    return createSvgEl(
      doc,
      'svg',
      {
        viewBox: '0 0 ' + g.w + ' ' + g.h,
        width: Math.round(g.w * pxSize),
        height: Math.round(g.h * pxSize),
        'shape-rendering': 'crispEdges',
        'aria-hidden': 'true',
      },
      children
    );
  }

  // ── Mode 1: Sky Sanctuary (Concept B) Builders ──

  function buildSkyRainbow(doc) {
    const defs = createSvgEl(doc, 'defs', null, [
      createSvgEl(doc, 'linearGradient', { id: 'ag-scene-sky-arch-fade', x1: '0', y1: '1', x2: '0', y2: '0' }, [
        createSvgEl(doc, 'stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '0.96' }),
        createSvgEl(doc, 'stop', { offset: '76%', 'stop-color': '#ffffff', 'stop-opacity': '0.92' }),
        createSvgEl(doc, 'stop', { offset: '94%', 'stop-color': '#ffffff', 'stop-opacity': '0.72' }),
        createSvgEl(doc, 'stop', { offset: '100%', 'stop-color': '#ffffff', 'stop-opacity': '0' }),
      ]),
      createSvgEl(doc, 'linearGradient', { id: 'ag-scene-sky-arch-side', x1: '0', y1: '0', x2: '1', y2: '0' }, [
        createSvgEl(doc, 'stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '0.06' }),
        createSvgEl(doc, 'stop', { offset: '10%', 'stop-color': '#ffffff', 'stop-opacity': '0.94' }),
        createSvgEl(doc, 'stop', { offset: '50%', 'stop-color': '#ffffff', 'stop-opacity': '0.88' }),
        createSvgEl(doc, 'stop', { offset: '90%', 'stop-color': '#ffffff', 'stop-opacity': '0.94' }),
        createSvgEl(doc, 'stop', { offset: '100%', 'stop-color': '#ffffff', 'stop-opacity': '0.06' }),
      ]),
      createSvgEl(doc, 'filter', { id: 'ag-scene-sky-arch-blur', x: '-8%', y: '-14%', width: '116%', height: '128%' }, [
        createSvgEl(doc, 'feGaussianBlur', { stdDeviation: '5.5' }),
      ]),
      createSvgEl(doc, 'mask', { id: 'ag-scene-sky-arch-mask' }, [
        createSvgEl(doc, 'rect', { x: '0', y: '0', width: '1200', height: '390', fill: 'url(#ag-scene-sky-arch-fade)' }),
      ]),
      createSvgEl(doc, 'mask', { id: 'ag-scene-sky-arch-hmask' }, [
        createSvgEl(doc, 'rect', { x: '0', y: '0', width: '1200', height: '390', fill: 'url(#ag-scene-sky-arch-side)' }),
      ]),
    ]);

    const bands = [
      { d: 'M 16 404 Q 600 -232 1184 404', stroke: '#f792c6', width: '24', opacity: '0.64' },
      { d: 'M 42 406 Q 600 -198 1158 406', stroke: '#fdba74', width: '24', opacity: '0.62' },
      { d: 'M 68 408 Q 600 -164 1132 408', stroke: '#fde047', width: '23', opacity: '0.58' },
      { d: 'M 94 410 Q 600 -130 1106 410', stroke: '#86efac', width: '23', opacity: '0.60' },
      { d: 'M 120 412 Q 600 -96 1080 412', stroke: '#7dd3fc', width: '24', opacity: '0.64' },
      { d: 'M 146 414 Q 600 -62 1054 414', stroke: '#c4b5fd', width: '25', opacity: '0.66' },
    ];

    const arcNodes = [];
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      arcNodes.push(
        createSvgEl(doc, 'path', {
          d: b.d,
          fill: 'none',
          stroke: b.stroke,
          'stroke-width': b.width,
          'stroke-linecap': 'round',
          opacity: b.opacity,
        })
      );
    }

    const svg = createSvgEl(
      doc,
      'svg',
      {
        viewBox: '0 0 1200 390',
        preserveAspectRatio: 'none',
        'aria-hidden': 'true',
      },
      [
        defs,
        createSvgEl(doc, 'g', { mask: 'url(#ag-scene-sky-arch-hmask)' }, [
          createSvgEl(
            doc,
            'g',
            {
              mask: 'url(#ag-scene-sky-arch-mask)',
              filter: 'url(#ag-scene-sky-arch-blur)',
            },
            arcNodes
          ),
        ]),
      ]
    );

    return createHtmlEl(doc, 'div', { class: 'ag-scene-sky-rainbow', 'aria-hidden': 'true' }, [svg]);
  }

  function buildCloudBank(doc, variant, className) {
    const gradId = 'ag-scene-sky-cgrad-' + variant;
    const isBack = variant.indexOf('back') === 0;
    const isRight = variant.slice(-1) === 'r';

    const gradStops = isBack
      ? [
          createSvgEl(doc, 'stop', { offset: '0%', 'stop-color': 'var(--ag-sky-cloud-back-top)' }),
          createSvgEl(doc, 'stop', { offset: '56%', 'stop-color': 'var(--ag-sky-cloud-back-mid)' }),
          createSvgEl(doc, 'stop', { offset: '100%', 'stop-color': 'var(--ag-sky-cloud-back-bot)' }),
        ]
      : [
          createSvgEl(doc, 'stop', { offset: '0%', 'stop-color': 'var(--ag-sky-cloud-top)' }),
          createSvgEl(doc, 'stop', { offset: '54%', 'stop-color': 'var(--ag-sky-cloud-mid)' }),
          createSvgEl(doc, 'stop', { offset: '100%', 'stop-color': 'var(--ag-sky-cloud-bot)' }),
        ];

    const defs = createSvgEl(doc, 'defs', null, [
      createSvgEl(doc, 'linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' }, gradStops),
    ]);

    let cloudPath = '';
    let innerHighlight = '';
    if (variant === 'top-l') {
      cloudPath =
        'M 12 46 C 12 31 25 22 40 24 C 47 10 68 6 82 16 C 94 12 112 18 117 30 C 130 30 138 38 138 46 Z';
      innerHighlight = 'M 42 25 C 51 15 67 13 78 20';
    } else if (isBack) {
      cloudPath =
        'M 0 185 L 0 92 C 18 68 52 56 84 68 C 102 32 152 18 190 42 C 216 26 258 34 274 62 C 304 54 342 74 352 106 C 374 110 392 132 396 185 Z';
      innerHighlight = 'M 106 46 C 128 28 164 28 184 44';
    } else if (variant.indexOf('mid') === 0) {
      cloudPath =
        'M 0 162 L 0 80 C 20 56 54 48 84 62 C 104 28 152 22 184 50 C 210 38 248 48 262 76 C 292 72 324 94 334 126 C 344 134 348 148 348 162 Z';
      innerHighlight =
        'M 22 72 C 40 54 68 54 84 65 M 108 44 C 130 28 160 30 179 48 M 206 54 C 226 45 248 53 258 72';
    } else {
      cloudPath =
        'M 0 114 L 0 58 C 18 38 50 32 76 46 C 96 20 138 18 164 42 C 188 34 218 46 230 70 C 244 76 254 92 256 114 Z';
      innerHighlight = 'M 98 34 C 118 22 144 24 160 40';
    }

    const vb =
      variant === 'top-l'
        ? '0 0 148 56'
        : isBack
        ? '0 0 400 185'
        : variant.indexOf('mid') === 0
        ? '0 0 350 162'
        : '0 0 256 114';

    const gAttrs = isRight
      ? { transform: 'translate(' + vb.split(' ')[2] + ' 0) scale(-1 1)' }
      : null;

    const shapes = [
      createSvgEl(doc, 'path', {
        d: cloudPath,
        fill: 'url(#' + gradId + ')',
        stroke: isBack ? 'var(--ag-sky-cloud-back-rim)' : 'var(--ag-sky-cloud-rim)',
        'stroke-width': isBack ? '1.15' : '1.45',
        'stroke-linejoin': 'round',
      }),
    ];
    if (innerHighlight) {
      shapes.push(
        createSvgEl(doc, 'path', {
          d: innerHighlight,
          fill: 'none',
          stroke: 'rgba(255, 255, 255, 0.52)',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
        })
      );
    }

    const svg = createSvgEl(
      doc,
      'svg',
      { viewBox: vb, preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      [defs, createSvgEl(doc, 'g', gAttrs, shapes)]
    );

    return createHtmlEl(doc, 'div', { class: 'ag-scene-cloud-bank ' + className, 'aria-hidden': 'true' }, [svg]);
  }

  function buildSkyMoonCatWatermark(doc) {
    const stroke = 'var(--ag-sky-mooncat-stroke)';
    const softFill = 'var(--ag-sky-mooncat-fill)';

    const svg = createSvgEl(
      doc,
      'svg',
      { viewBox: '0 0 144 144', fill: 'none', 'aria-hidden': 'true' },
      [
        // Constellation dashed hairlines
        createSvgEl(doc, 'path', {
          d: 'M 22 40 Q 48 16 86 24 M 108 32 Q 126 56 118 86 M 30 106 Q 60 128 100 116',
          stroke,
          'stroke-width': '0.9',
          'stroke-dasharray': '2.5 4.5',
          'stroke-linecap': 'round',
          opacity: '0.55',
        }),
        // Delicate crescent moon cradle
        createSvgEl(doc, 'path', {
          d: 'M 88 26 C 56 24 32 48 34 80 C 36 108 62 126 92 122 C 106 120 117 112 124 101 C 107 109 86 106 72 93 C 58 80 56 58 67 42 C 72 34 80 29 88 26 Z',
          fill: softFill,
          stroke,
          'stroke-width': '1.5',
          'stroke-linejoin': 'round',
        }),
        // Cozy curled sleeping kitten resting inside crescent
        // Head + pointed ears
        createSvgEl(doc, 'path', {
          d: 'M 58 76 C 54 67 56 59 61 54 L 63 45 L 70 51 C 74 50 78 50 82 52 L 88 46 L 90 55 C 95 60 95 69 90 76',
          stroke,
          'stroke-width': '1.55',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
        // Curled plump sleeping body & tucked paws
        createSvgEl(doc, 'path', {
          d: 'M 58 76 C 54 88 64 98 80 98 C 94 98 103 88 99 77 C 96 72 92 71 90 76',
          stroke,
          'stroke-width': '1.55',
          'stroke-linecap': 'round',
        }),
        // Curled fluffy tail draping over lower crescent horn
        createSvgEl(doc, 'path', {
          d: 'M 94 93 C 106 95 113 103 108 112 C 104 118 96 116 95 111',
          stroke,
          'stroke-width': '1.5',
          'stroke-linecap': 'round',
        }),
        // Peaceful closed happy sleeping eyes + tiny nose + whiskers
        createSvgEl(doc, 'path', {
          d: 'M 65 65 Q 68 68 71 65 M 78 65 Q 81 68 84 65',
          stroke,
          'stroke-width': '1.35',
          'stroke-linecap': 'round',
        }),
        createSvgEl(doc, 'circle', { cx: '74.5', cy: '69', r: '1.1', fill: stroke }),
        createSvgEl(doc, 'path', {
          d: 'M 55 66 L 61 67 M 54 70 L 61 70 M 88 67 L 94 66 M 88 70 L 95 70',
          stroke,
          'stroke-width': '1',
          'stroke-linecap': 'round',
          opacity: '0.75',
        }),
        // Three twinkling constellation 4-point stars
        createSvgEl(doc, 'path', {
          class: 'ag-scene-twinkle-1',
          d: 'M 26 36 L 28 42 L 34 44 L 28 46 L 26 52 L 24 46 L 18 44 L 24 42 Z',
          fill: stroke,
        }),
        createSvgEl(doc, 'path', {
          class: 'ag-scene-twinkle-2',
          d: 'M 110 24 L 111.5 28.5 L 116 30 L 111.5 31.5 L 110 36 L 108.5 31.5 L 104 30 L 108.5 28.5 Z',
          fill: stroke,
        }),
        createSvgEl(doc, 'path', {
          class: 'ag-scene-twinkle-3',
          d: 'M 118 76 L 119.3 79.7 L 123 81 L 119.3 82.3 L 118 86 L 116.7 82.3 L 113 81 L 116.7 79.7 Z',
          fill: stroke,
        }),
        createSvgEl(doc, 'circle', { cx: '38', cy: '24', r: '1.4', fill: stroke, opacity: '0.7' }),
        createSvgEl(doc, 'circle', { cx: '124', cy: '54', r: '1.2', fill: stroke, opacity: '0.65' }),
      ]
    );

    return createHtmlEl(doc, 'div', { class: 'ag-scene-sky-mooncat', 'aria-hidden': 'true' }, [svg]);
  }

  function buildSkyChimeCharm(doc, onChimeClick) {
    const defs = createSvgEl(doc, 'defs', null, [
      createSvgEl(doc, 'linearGradient', { id: 'ag-scene-sky-star-rb', x1: '0', y1: '0', x2: '1', y2: '1' }, [
        createSvgEl(doc, 'stop', { offset: '0%', 'stop-color': '#fbcfe8' }),
        createSvgEl(doc, 'stop', { offset: '34%', 'stop-color': '#fde68a' }),
        createSvgEl(doc, 'stop', { offset: '68%', 'stop-color': '#a7f3d0' }),
        createSvgEl(doc, 'stop', { offset: '100%', 'stop-color': '#c4b5fd' }),
      ]),
      createSvgEl(doc, 'linearGradient', { id: 'ag-scene-sky-cat-charm', x1: '0', y1: '0', x2: '1', y2: '1' }, [
        createSvgEl(doc, 'stop', { offset: '0%', 'stop-color': '#f5d0fe' }),
        createSvgEl(doc, 'stop', { offset: '100%', 'stop-color': '#c4b5fd' }),
      ]),
      createSvgEl(doc, 'linearGradient', { id: 'ag-scene-sky-moon-charm', x1: '0', y1: '0', x2: '1', y2: '1' }, [
        createSvgEl(doc, 'stop', { offset: '0%', 'stop-color': '#fef3c7' }),
        createSvgEl(doc, 'stop', { offset: '100%', 'stop-color': '#fed7aa' }),
      ]),
      createSvgEl(doc, 'radialGradient', { id: 'ag-scene-sky-star-glow', cx: '50%', cy: '50%', r: '50%' }, [
        createSvgEl(doc, 'stop', { offset: '0%', 'stop-color': '#f5d0fe', 'stop-opacity': '0.58' }),
        createSvgEl(doc, 'stop', { offset: '100%', 'stop-color': '#c4b5fd', 'stop-opacity': '0' }),
      ]),
    ]);

    const chain = 'var(--ag-sky-chime-chain)';
    const stroke = 'var(--ag-sky-chime-stroke)';

    const svg = createSvgEl(doc, 'svg', { viewBox: '0 0 112 228', fill: 'none', 'aria-hidden': 'true' }, [
      defs,
      // Top anchor arch & horizontal silver-lavender bar
      createSvgEl(doc, 'path', {
        d: 'M 20 8 Q 56 14 92 8',
        stroke: chain,
        'stroke-width': '1.4',
        'stroke-linecap': 'round',
      }),
      createSvgEl(doc, 'circle', { cx: '56', cy: '4', r: '2.5', fill: '#ddd6fe', stroke, 'stroke-width': '1' }),

      // Left strand (x=22): chain + beads + lavender star + pearl drop
      createSvgEl(doc, 'line', { x1: '22', y1: '9', x2: '22', y2: '72', stroke: chain, 'stroke-width': '1.1', 'stroke-dasharray': '2.2 2.4' }),
      createSvgEl(doc, 'circle', { cx: '22', cy: '36', r: '1.8', fill: '#e9d5ff' }),
      createSvgEl(doc, 'circle', { cx: '22', cy: '56', r: '1.5', fill: '#fbcfe8' }),
      createSvgEl(doc, 'path', {
        d: 'M 22 70 L 25.2 77.2 L 33 78.2 L 27.2 83.4 L 28.8 91 L 22 87.2 L 15.2 91 L 16.8 83.4 L 11 78.2 L 18.8 77.2 Z',
        fill: '#ddd6fe',
        stroke,
        'stroke-width': '1.15',
        'stroke-linejoin': 'round',
      }),
      createSvgEl(doc, 'line', { x1: '22', y1: '90', x2: '22', y2: '104', stroke: chain, 'stroke-width': '1' }),
      createSvgEl(doc, 'circle', { cx: '22', cy: '107', r: '2.6', fill: '#fff1f2', stroke, 'stroke-width': '1' }),

      // Center strand (x=56): longest, glowing rainbow star + sitting cat charm + rose teardrop
      createSvgEl(doc, 'line', { x1: '56', y1: '6', x2: '56', y2: '86', stroke: chain, 'stroke-width': '1.2', 'stroke-dasharray': '2.4 2.4' }),
      createSvgEl(doc, 'circle', { cx: '56', cy: '32', r: '2', fill: '#fde68a' }),
      createSvgEl(doc, 'circle', { cx: '56', cy: '60', r: '1.7', fill: '#bae6fd' }),
      // Soft halo behind center rainbow star
      createSvgEl(doc, 'circle', { cx: '56', cy: '103', r: '24', fill: 'url(#ag-scene-sky-star-glow)' }),
      // Center pastel rainbow 5-point star
      createSvgEl(doc, 'path', {
        d: 'M 56 85 L 61.1 95.8 L 73 97.3 L 64.2 105.6 L 66.5 117.4 L 56 111.6 L 45.5 117.4 L 47.8 105.6 L 39 97.3 L 50.9 95.8 Z',
        fill: 'url(#ag-scene-sky-star-rb)',
        stroke,
        'stroke-width': '1.25',
        'stroke-linejoin': 'round',
      }),
      // Tiny white sheen inside star
      createSvgEl(doc, 'circle', { cx: '53', cy: '99', r: '1.8', fill: '#ffffff', opacity: '0.78' }),
      // Connector chain to cute sitting cat charm
      createSvgEl(doc, 'line', { x1: '56', y1: '115', x2: '56', y2: '140', stroke: chain, 'stroke-width': '1.1', 'stroke-dasharray': '2 2.2' }),
      createSvgEl(doc, 'circle', { cx: '56', cy: '128', r: '1.7', fill: '#fbcfe8' }),
      // Sitting kawaii cat silhouette charm
      createSvgEl(doc, 'path', {
        d: 'M 47 148 L 48 139 L 53 144 C 55 143.4 57 143.4 59 144 L 64 139 L 65 148 C 68.5 151.5 68 158 64 161.5 C 67 166.5 66.5 174 61 177.5 L 51 177.5 C 45.5 174 45 166.5 48 161.5 C 44 158 43.5 151.5 47 148 Z',
        fill: 'url(#ag-scene-sky-cat-charm)',
        stroke,
        'stroke-width': '1.2',
        'stroke-linejoin': 'round',
      }),
      // Curled cat tail
      createSvgEl(doc, 'path', {
        d: 'M 63 174 C 71 174 74 167 70 163',
        stroke,
        'stroke-width': '1.6',
        'stroke-linecap': 'round',
      }),
      // Cute closed eyes & rosy cheeks on cat charm
      createSvgEl(doc, 'path', {
        d: 'M 51 153 Q 52.8 154.8 54.6 153 M 57.4 153 Q 59.2 154.8 61 153',
        stroke,
        'stroke-width': '1.1',
        'stroke-linecap': 'round',
      }),
      createSvgEl(doc, 'circle', { cx: '49.5', cy: '155.5', r: '1.3', fill: '#f9a8d4', opacity: '0.85' }),
      createSvgEl(doc, 'circle', { cx: '62.5', cy: '155.5', r: '1.3', fill: '#f9a8d4', opacity: '0.85' }),
      // Bottom pastel crystal drop
      createSvgEl(doc, 'line', { x1: '56', y1: '178', x2: '56', y2: '193', stroke: chain, 'stroke-width': '1' }),
      createSvgEl(doc, 'path', {
        d: 'M 56 193 C 59.5 198 60.5 202.5 56 206 C 51.5 202.5 52.5 198 56 193 Z',
        fill: '#fbcfe8',
        stroke,
        'stroke-width': '1.05',
      }),

      // Right strand (x=88): chain + beads + cream-peach crescent moon + diamond drops
      createSvgEl(doc, 'line', { x1: '88', y1: '9', x2: '88', y2: '94', stroke: chain, 'stroke-width': '1.1', 'stroke-dasharray': '2.2 2.4' }),
      createSvgEl(doc, 'circle', { cx: '88', cy: '44', r: '1.7', fill: '#a7f3d0' }),
      createSvgEl(doc, 'circle', { cx: '88', cy: '72', r: '1.6', fill: '#fde68a' }),
      createSvgEl(doc, 'path', {
        d: 'M 91 92 C 80 94 75 106 81 116 C 86 124 97 125 103 118 C 95 120 88 114 88 106 C 88 100 90 95 91 92 Z',
        fill: 'url(#ag-scene-sky-moon-charm)',
        stroke,
        'stroke-width': '1.15',
        'stroke-linejoin': 'round',
      }),
      createSvgEl(doc, 'line', { x1: '88', y1: '122', x2: '88', y2: '138', stroke: chain, 'stroke-width': '1' }),
      createSvgEl(doc, 'path', {
        d: 'M 88 137 L 91.5 142 L 88 147 L 84.5 142 Z',
        fill: '#bae6fd',
        stroke,
        'stroke-width': '1',
      }),
    ]);

    const burstLayer = createHtmlEl(doc, 'span', { class: 'ag-scene-chime-burst', 'aria-hidden': 'true' });
    const btn = applyNoTr(
      createHtmlEl(
        doc,
        'button',
        {
          type: 'button',
          class: 'ag-cs-scene-charm ag-scene-sky-chime',
          'aria-label': 'Star-moon cat wind chime',
          title: 'Star-moon cat wind chime',
        },
        [svg, burstLayer]
      )
    );
    btn.addEventListener('click', (ev) => {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
      onChimeClick(btn, burstLayer);
    });
    return { btn, burstLayer };
  }

  // ── Mode 2: Pastel Stationery (Concept C) Builders ──

  function buildStationeryWatercolor(doc) {
    const defs = createSvgEl(doc, 'defs', null, [
      createSvgEl(doc, 'radialGradient', { id: 'ag-scene-st-w-pink', cx: '50%', cy: '50%', r: '50%' }, [
        createSvgEl(doc, 'stop', { offset: '0%', 'stop-color': '#fbcfe8', 'stop-opacity': '0.68' }),
        createSvgEl(doc, 'stop', { offset: '55%', 'stop-color': '#fed7aa', 'stop-opacity': '0.32' }),
        createSvgEl(doc, 'stop', { offset: '100%', 'stop-color': '#fed7aa', 'stop-opacity': '0' }),
      ]),
      createSvgEl(doc, 'radialGradient', { id: 'ag-scene-st-w-mint', cx: '50%', cy: '50%', r: '50%' }, [
        createSvgEl(doc, 'stop', { offset: '0%', 'stop-color': '#bbf7d0', 'stop-opacity': '0.46' }),
        createSvgEl(doc, 'stop', { offset: '56%', 'stop-color': '#bae6fd', 'stop-opacity': '0.26' }),
        createSvgEl(doc, 'stop', { offset: '100%', 'stop-color': '#bae6fd', 'stop-opacity': '0' }),
      ]),
      createSvgEl(doc, 'radialGradient', { id: 'ag-scene-st-w-lav', cx: '50%', cy: '50%', r: '50%' }, [
        createSvgEl(doc, 'stop', { offset: '0%', 'stop-color': '#ddd6fe', 'stop-opacity': '0.68' }),
        createSvgEl(doc, 'stop', { offset: '54%', 'stop-color': '#f5d0fe', 'stop-opacity': '0.34' }),
        createSvgEl(doc, 'stop', { offset: '100%', 'stop-color': '#f5d0fe', 'stop-opacity': '0' }),
      ]),
    ]);

    const svg = createSvgEl(
      doc,
      'svg',
      { viewBox: '0 0 1200 240', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      [
        defs,
        createSvgEl(doc, 'ellipse', { cx: '210', cy: '210', rx: '340', ry: '148', fill: 'url(#ag-scene-st-w-pink)' }),
        createSvgEl(doc, 'ellipse', { cx: '600', cy: '234', rx: '360', ry: '112', fill: 'url(#ag-scene-st-w-mint)' }),
        createSvgEl(doc, 'ellipse', { cx: '995', cy: '205', rx: '350', ry: '152', fill: 'url(#ag-scene-st-w-lav)' }),
      ]
    );

    return createHtmlEl(doc, 'div', { class: 'ag-scene-st-watercolor', 'aria-hidden': 'true' }, [svg]);
  }

  function buildStationeryPrismCatStamp(doc) {
    const line = 'var(--ag-st-line)';
    const paper = 'var(--ag-st-paper)';

    const defs = createSvgEl(doc, 'defs', null, [
      createSvgEl(doc, 'linearGradient', { id: 'ag-scene-st-prism-fill', x1: '0', y1: '0', x2: '1', y2: '1' }, [
        createSvgEl(doc, 'stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '0.92' }),
        createSvgEl(doc, 'stop', { offset: '50%', 'stop-color': '#e0f2fe', 'stop-opacity': '0.78' }),
        createSvgEl(doc, 'stop', { offset: '100%', 'stop-color': '#f3e8ff', 'stop-opacity': '0.86' }),
      ]),
    ]);

    const svg = createSvgEl(doc, 'svg', { viewBox: '0 0 120 112', fill: 'none', 'aria-hidden': 'true' }, [
      defs,
      // Delicate dashed pastel postage halo
      createSvgEl(doc, 'circle', {
        cx: '60',
        cy: '56',
        r: '44',
        stroke: line,
        'stroke-width': '1',
        'stroke-dasharray': '3 4',
        opacity: '0.45',
      }),
      // Soft rainbow ribbon emerging from prism
      createSvgEl(doc, 'path', { d: 'M 42 54 Q 72 44 106 58', stroke: '#f9a8d4', 'stroke-width': '3.4', 'stroke-linecap': 'round', opacity: '0.72' }),
      createSvgEl(doc, 'path', { d: 'M 43 58 Q 72 50 105 63', stroke: '#fdba74', 'stroke-width': '3.2', 'stroke-linecap': 'round', opacity: '0.70' }),
      createSvgEl(doc, 'path', { d: 'M 44 62 Q 72 56 103 68', stroke: '#fde68a', 'stroke-width': '3.2', 'stroke-linecap': 'round', opacity: '0.70' }),
      createSvgEl(doc, 'path', { d: 'M 45 66 Q 72 62 100 73', stroke: '#a7f3d0', 'stroke-width': '3.2', 'stroke-linecap': 'round', opacity: '0.72' }),
      createSvgEl(doc, 'path', { d: 'M 46 70 Q 72 68 96 78', stroke: '#bae6fd', 'stroke-width': '3.2', 'stroke-linecap': 'round', opacity: '0.74' }),
      // Minimal crystal prism triangle on left
      createSvgEl(doc, 'path', {
        d: 'M 36 32 L 54 68 L 18 68 Z',
        fill: 'url(#ag-scene-st-prism-fill)',
        stroke: line,
        'stroke-width': '1.45',
        'stroke-linejoin': 'round',
      }),
      createSvgEl(doc, 'path', {
        d: 'M 36 32 L 39 68',
        stroke: line,
        'stroke-width': '0.95',
        opacity: '0.48',
      }),
      // Minimalist kawaii cat-head stationery stamp perched upper-right
      createSvgEl(doc, 'path', {
        d: 'M 63 32 L 65 20 L 74 26 C 78 24.8 83 24.8 87 26 L 96 20 L 98 32 C 102 37 101 46 95 50 C 89 54 72 54 66 50 C 60 46 59 37 63 32 Z',
        fill: paper,
        stroke: line,
        'stroke-width': '1.45',
        'stroke-linejoin': 'round',
      }),
      // Inner pastel ears
      createSvgEl(doc, 'path', { d: 'M 66 29 L 67 24 L 71 27 Z', fill: '#fbcfe8', opacity: '0.85' }),
      createSvgEl(doc, 'path', { d: 'M 95 29 L 94 24 L 90 27 Z', fill: '#fbcfe8', opacity: '0.85' }),
      // Cute kawaii cat face
      createSvgEl(doc, 'circle', { cx: '74.5', cy: '38.5', r: '1.5', fill: line }),
      createSvgEl(doc, 'circle', { cx: '86.5', cy: '38.5', r: '1.5', fill: line }),
      createSvgEl(doc, 'path', {
        d: 'M 78 41.2 Q 79.4 43 80.5 41.4 Q 81.6 43 83 41.2',
        stroke: line,
        'stroke-width': '1.25',
        'stroke-linecap': 'round',
      }),
      createSvgEl(doc, 'circle', { cx: '71', cy: '41.5', r: '1.7', fill: '#f9a8d4', opacity: '0.72' }),
      createSvgEl(doc, 'circle', { cx: '90', cy: '41.5', r: '1.7', fill: '#f9a8d4', opacity: '0.72' }),
      // Two tiny crisp sparkle stars
      createSvgEl(doc, 'path', {
        d: 'M 22 24 L 23.4 27.6 L 27 29 L 23.4 30.4 L 22 34 L 20.6 30.4 L 17 29 L 20.6 27.6 Z',
        fill: '#c4b5fd',
      }),
      createSvgEl(doc, 'path', {
        d: 'M 96 84 L 97 87 L 100 88 L 97 89 L 96 92 L 95 89 L 92 88 L 95 87 Z',
        fill: '#f9a8d4',
      }),
    ]);

    return createHtmlEl(doc, 'div', { class: 'ag-scene-st-stamp', 'aria-hidden': 'true' }, [svg]);
  }

  function buildPawGroup(doc, x, y, scale, rotateDeg, opacity) {
    const paw = 'var(--ag-st-paw)';
    return createSvgEl(
      doc,
      'g',
      {
        transform: 'translate(' + x + ' ' + y + ') rotate(' + rotateDeg + ') scale(' + scale + ')',
        opacity: String(opacity),
      },
      [
        // Main pad
        createSvgEl(doc, 'ellipse', { cx: '0', cy: '3', rx: '4.4', ry: '3.4', fill: paw }),
        // Three tiny toe beans
        createSvgEl(doc, 'circle', { cx: '-4.2', cy: '-2.2', r: '1.75', fill: paw }),
        createSvgEl(doc, 'circle', { cx: '0', cy: '-3.6', r: '1.85', fill: paw }),
        createSvgEl(doc, 'circle', { cx: '4.2', cy: '-2.2', r: '1.75', fill: paw }),
      ]
    );
  }

  function buildStationeryCornerArt(doc) {
    const line = 'var(--ag-st-line)';
    const paper = 'var(--ag-st-paper)';
    const milkCap = 'var(--ag-st-milk-cap)';
    const milkStripe = 'var(--ag-st-milk-stripe)';

    const svg = createSvgEl(doc, 'svg', { viewBox: '0 0 156 118', fill: 'none', 'aria-hidden': 'true' }, [
      // 3 ascending pastel cat paw prints stepping diagonally toward composer
      buildPawGroup(doc, 18, 92, 0.88, -32, 0.62),
      buildPawGroup(doc, 38, 74, 0.96, -24, 0.78),
      buildPawGroup(doc, 54, 54, 0.84, -36, 0.56),

      // Trailing pastel yarn thread curving gently from behind milk carton toward yarn ball
      createSvgEl(doc, 'path', {
        d: 'M 78 106 C 64 109 56 101 66 96 C 75 92 88 102 104 98',
        stroke: '#e8b4e3',
        'stroke-width': '2',
        'stroke-linecap': 'round',
      }),

      // Cute tilted pastel lavender-and-white milk carton with tiny cat-face emblem
      createSvgEl(doc, 'g', { transform: 'translate(76 26) rotate(-7)' }, [
        // Subtle ground shadow
        createSvgEl(doc, 'ellipse', { cx: '20', cy: '68', rx: '19', ry: '4.2', fill: 'rgba(155, 138, 206, 0.16)' }),
        // Front carton body
        createSvgEl(doc, 'path', {
          d: 'M 4 22 L 26 22 L 26 65 L 4 65 Z',
          fill: paper,
          stroke: line,
          'stroke-width': '1.45',
          'stroke-linejoin': 'round',
        }),
        // Side carton wall
        createSvgEl(doc, 'path', {
          d: 'M 26 22 L 38 18 L 38 61 L 26 65 Z',
          fill: milkStripe,
          stroke: line,
          'stroke-width': '1.45',
          'stroke-linejoin': 'round',
        }),
        // Front roof slope
        createSvgEl(doc, 'path', {
          d: 'M 4 22 L 10 9 L 32 9 L 26 22 Z',
          fill: milkCap,
          stroke: line,
          'stroke-width': '1.45',
          'stroke-linejoin': 'round',
        }),
        // Side roof triangle
        createSvgEl(doc, 'path', {
          d: 'M 26 22 L 32 9 L 38 18 Z',
          fill: milkStripe,
          stroke: line,
          'stroke-width': '1.45',
          'stroke-linejoin': 'round',
        }),
        // Top crimped seal tab
        createSvgEl(doc, 'rect', {
          x: '10',
          y: '4',
          width: '22',
          height: '5',
          rx: '1.5',
          fill: paper,
          stroke: line,
          'stroke-width': '1.35',
        }),
        // Pastel lavender bottom band on milk label
        createSvgEl(doc, 'rect', {
          x: '5',
          y: '54',
          width: '20',
          height: '10',
          fill: milkStripe,
          opacity: '0.78',
        }),
        // Tiny kawaii cat-face emblem on carton front
        createSvgEl(doc, 'path', {
          d: 'M 9.5 34 L 10.5 29 L 13.4 31.8 C 14.5 31.4 15.8 31.4 16.9 31.8 L 19.8 29 L 20.8 34 C 22 36.4 21.4 40 19.2 41.6 C 17 43 13.3 43 11.1 41.6 C 8.9 40 8.3 36.4 9.5 34 Z',
          fill: '#fce7f3',
          stroke: line,
          'stroke-width': '1.1',
          'stroke-linejoin': 'round',
        }),
        createSvgEl(doc, 'circle', { cx: '13.2', cy: '36.6', r: '0.9', fill: line }),
        createSvgEl(doc, 'circle', { cx: '17.1', cy: '36.6', r: '0.9', fill: line }),
        createSvgEl(doc, 'path', {
          d: 'M 14.1 38.4 Q 15.1 39.4 16.2 38.4',
          stroke: line,
          'stroke-width': '0.95',
          'stroke-linecap': 'round',
        }),
      ]),
    ]);

    return createHtmlEl(doc, 'div', { class: 'ag-scene-st-vignette-art', 'aria-hidden': 'true' }, [svg]);
  }

  function buildStationeryYarnCharm(doc, onYarnClick) {
    const line = 'var(--ag-st-line)';
    const defs = createSvgEl(doc, 'defs', null, [
      createSvgEl(doc, 'radialGradient', { id: 'ag-scene-st-yarn-grad', cx: '36%', cy: '32%', r: '66%' }, [
        createSvgEl(doc, 'stop', { offset: '0%', 'stop-color': 'var(--ag-st-yarn-hi)' }),
        createSvgEl(doc, 'stop', { offset: '54%', 'stop-color': 'var(--ag-st-yarn-main)' }),
        createSvgEl(doc, 'stop', { offset: '100%', 'stop-color': 'var(--ag-st-yarn-deep)' }),
      ]),
    ]);

    const svg = createSvgEl(doc, 'svg', { viewBox: '0 0 58 54', fill: 'none', 'aria-hidden': 'true' }, [
      defs,
      // Ground shadow
      createSvgEl(doc, 'ellipse', { cx: '30', cy: '48', rx: '17', ry: '3.6', fill: 'rgba(155, 138, 206, 0.22)' }),
      // Trailing wavy tail on right
      createSvgEl(doc, 'path', {
        d: 'M 43 40 C 51 41 53 47 47 49 C 43 50 40 48 39 46',
        stroke: line,
        'stroke-width': '1.6',
        'stroke-linecap': 'round',
      }),
      // Main plump yarn sphere
      createSvgEl(doc, 'circle', {
        cx: '29',
        cy: '28',
        r: '18.5',
        fill: 'url(#ag-scene-st-yarn-grad)',
        stroke: line,
        'stroke-width': '1.55',
      }),
      // Layered curved criss-cross yarn stripes
      createSvgEl(doc, 'path', {
        d: 'M 14 20 C 22 15 36 16 44 24',
        stroke: line,
        'stroke-width': '1.25',
        'stroke-linecap': 'round',
        opacity: '0.78',
      }),
      createSvgEl(doc, 'path', {
        d: 'M 11.5 27 C 21 21 37 22 46.5 31',
        stroke: line,
        'stroke-width': '1.25',
        'stroke-linecap': 'round',
        opacity: '0.82',
      }),
      createSvgEl(doc, 'path', {
        d: 'M 13 35 C 22 29 35 30 44.5 37',
        stroke: line,
        'stroke-width': '1.2',
        'stroke-linecap': 'round',
        opacity: '0.74',
      }),
      createSvgEl(doc, 'path', {
        d: 'M 22 11 C 18 21 20 34 27 45',
        stroke: line,
        'stroke-width': '1.25',
        'stroke-linecap': 'round',
        opacity: '0.76',
      }),
      createSvgEl(doc, 'path', {
        d: 'M 32 10.5 C 27 20 28 34 35 45',
        stroke: line,
        'stroke-width': '1.2',
        'stroke-linecap': 'round',
        opacity: '0.72',
      }),
      // Cute pastel glossy highlight arc
      createSvgEl(doc, 'path', {
        d: 'M 19 17.5 C 21.5 14.5 25.5 13.5 29 14',
        stroke: '#ffffff',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        opacity: '0.72',
      }),
    ]);

    const burstLayer = createHtmlEl(doc, 'span', { class: 'ag-scene-yarn-burst', 'aria-hidden': 'true' });
    const btn = applyNoTr(
      createHtmlEl(
        doc,
        'button',
        {
          type: 'button',
          class: 'ag-cs-scene-charm ag-scene-st-yarn-btn',
          'aria-label': 'Toss yarn ball to cats',
          title: 'Toss yarn ball to cats',
        },
        [svg, burstLayer]
      )
    );
    btn.addEventListener('click', (ev) => {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
      onYarnClick(btn, burstLayer);
    });
    return { btn, burstLayer };
  }

  // ── Controller Factory ──

  function createChatSceneController() {
    const win = typeof window !== 'undefined' ? window : G;
    const doc = (win && win.document) || (typeof document !== 'undefined' ? document : null);
    if (!doc) {
      return {
        sync() {},
        dispose() {},
        getState() {
          return { mode: 'off', mounted: false, paused: true, narrow: false, dark: false, streaming: false };
        },
      };
    }

    let mode = 'off';
    let renderedMode = 'off';
    let mounted = false;
    let styleEl = null;
    let rootEl = null;
    let seatParent = null;
    let flankLeft = null;
    let flankRight = null;
    let seatWidth = 0;
    let narrow = false;
    let dark = false;
    let streaming = false;
    let hiddenByHome = false;
    let hiddenByHole = false;
    let winBlurred = false;
    let prefersReducedMotion = false;
    let paused = false;
    let sparkleCount = 0;

    let domObserver = null;
    let htmlObserver = null;
    let bodyObserver = null;
    let resizeObserver = null;
    let mqlMotion = null;
    let mqlDark = null;

    let reconcileRaf = 0;
    let reconcileTimer = 0;
    let sparkleTimer = 0;
    let chimeTimer = 0;
    let yarnTimer = 0;
    let listenersAttached = false;
    const activeTimers = new Set();

    try {
      if (typeof doc.hasFocus === 'function' && doc.hasFocus() === false) {
        winBlurred = true;
      }
    } catch {}

    function trackTimeout(fn, ms) {
      const id = setTimeout(() => {
        activeTimers.delete(id);
        fn();
      }, ms);
      activeTimers.add(id);
      return id;
    }

    function clearTrackedTimers() {
      for (const id of activeTimers) {
        try {
          clearTimeout(id);
        } catch {}
      }
      activeTimers.clear();
      if (reconcileTimer) {
        clearTimeout(reconcileTimer);
        reconcileTimer = 0;
      }
      if (sparkleTimer) {
        clearTimeout(sparkleTimer);
        sparkleTimer = 0;
      }
      if (chimeTimer) {
        clearTimeout(chimeTimer);
        chimeTimer = 0;
      }
      if (yarnTimer) {
        clearTimeout(yarnTimer);
        yarnTimer = 0;
      }
      if (reconcileRaf && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(reconcileRaf);
        reconcileRaf = 0;
      }
    }

    function readDarkTheme() {
      const html = doc.documentElement;
      const attr = html && typeof html.getAttribute === 'function' ? html.getAttribute('data-ag-cs-theme') : null;
      if (attr === 'dark') return true;
      if (attr === 'light') return false;
      if (html && html.classList && html.classList.contains('dark')) return true;
      if (mqlDark && typeof mqlDark.matches === 'boolean') return mqlDark.matches;
      return false;
    }

    function readMotionOff() {
      const html = doc.documentElement;
      const attr = html && typeof html.getAttribute === 'function' ? html.getAttribute('data-ag-cs-motion') : null;
      return attr === 'off' || prefersReducedMotion;
    }

    function readWinBlurAttr() {
      const html = doc.documentElement;
      return Boolean(html && typeof html.getAttribute === 'function' && html.getAttribute('data-ag-cs-win-blur') === '1');
    }

    function readHomeVisible() {
      if (typeof doc.querySelector !== 'function') return false;
      const home = doc.querySelector('.agy-home');
      return Boolean(home && isNodeVisible(home));
    }

    function readBrowserHole(seat) {
      if (doc.body && typeof doc.body.getAttribute === 'function' && doc.body.getAttribute('data-has-browser-hole') === 'true') {
        return true;
      }
      if (seat && typeof seat.getAttribute === 'function' && seat.getAttribute('data-has-browser-hole') === 'true') {
        return true;
      }
      return false;
    }

    function readStreamingState() {
      if (mode !== 'stationery') return false;
      if (typeof doc.querySelectorAll !== 'function') return false;
      const nodes = doc.querySelectorAll(RUNNING_SEL);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (typeof n.closest === 'function' && n.closest(SUBAGENT_SEL)) continue;
        if (isNodeVisible(n)) return true;
      }
      return false;
    }

    function findActiveSeatParent() {
      if (readHomeVisible()) {
        hiddenByHome = true;
        return null;
      }
      hiddenByHome = false;
      if (typeof doc.querySelectorAll !== 'function') return null;
      const views = doc.querySelectorAll('[data-testid="conversation-view"]');
      for (let i = 0; i < views.length; i++) {
        const cv = views[i];
        if (typeof cv.closest === 'function') {
          if (cv.closest(SUBAGENT_SEL) || cv.closest('.agy-home')) continue;
        }
        if (!isNodeVisible(cv)) continue;
        return cv.parentElement || cv;
      }
      return null;
    }

    function ensureStyle() {
      if (styleEl && styleEl.isConnected !== false) return styleEl;
      const existing = typeof doc.getElementById === 'function' ? doc.getElementById(STYLE_ID) : null;
      if (existing) {
        styleEl = existing;
        styleEl.textContent = SCENE_CSS;
        applyNoTr(styleEl);
        return styleEl;
      }
      styleEl = applyNoTr(createHtmlEl(doc, 'style', { id: STYLE_ID, text: SCENE_CSS }));
      const host = doc.head || doc.documentElement || doc.body;
      if (host && typeof host.appendChild === 'function') {
        host.appendChild(styleEl);
      }
      return styleEl;
    }

    function spawnBurst(container, specs, pxSize) {
      if (!container || paused) return;
      for (let i = 0; i < specs.length; i++) {
        const sp = specs[i];
        const star = createHtmlEl(doc, 'span', { class: 'ag-scene-burst-star', 'aria-hidden': 'true' }, [
          buildPixelGlyphSvg(doc, sp.g, pxSize || 1.5, sp.color),
        ]);
        star.style.left = sp.x + 'px';
        star.style.top = sp.y + 'px';
        if (typeof star.style.setProperty === 'function') {
          star.style.setProperty('--ag-bx', sp.dx + 'px');
          star.style.setProperty('--ag-by', sp.dy + 'px');
        }
        container.appendChild(star);
        trackTimeout(() => {
          try {
            star.remove();
          } catch {}
        }, 1100);
      }
    }

    function handleChimeClick(btn, burstLayer) {
      if (!btn || paused) return;
      if (btn.classList) {
        btn.classList.remove('is-ringing');
        // Force animation restart cleanly without throwing in headless mock DOMs
        try {
          void btn.offsetWidth;
        } catch {}
        btn.classList.add('is-ringing');
      }
      if (chimeTimer) clearTimeout(chimeTimer);
      chimeTimer = setTimeout(() => {
        chimeTimer = 0;
        if (btn && btn.classList) btn.classList.remove('is-ringing');
      }, 1480);

      spawnBurst(
        burstLayer,
        [
          { g: 1, x: 48, y: 96, dx: -26, dy: -22, color: '#fbcfe8' },
          { g: 0, x: 64, y: 100, dx: 24, dy: -18, color: '#fde68a' },
          { g: 1, x: 52, y: 148, dx: -22, dy: 16, color: '#a7f3d0' },
          { g: 4, x: 66, y: 152, dx: 26, dy: 12, color: '#c4b5fd' },
          { g: 2, x: 56, y: 120, dx: 4, dy: -30, color: '#f9a8d4' },
        ],
        1.45
      );
    }

    function handleYarnClick(btn, burstLayer) {
      if (!btn) return;
      if (!paused && btn.classList) {
        btn.classList.remove('is-bouncing');
        try {
          void btn.offsetWidth;
        } catch {}
        btn.classList.add('is-bouncing');
        if (yarnTimer) clearTimeout(yarnTimer);
        yarnTimer = setTimeout(() => {
          yarnTimer = 0;
          if (btn && btn.classList) btn.classList.remove('is-bouncing');
        }, 680);

        spawnBurst(
          burstLayer,
          [
            { g: 2, x: 24, y: 18, dx: -24, dy: -28, color: '#f9a8d4' },
            { g: 1, x: 30, y: 14, dx: 2, dy: -36, color: '#c4b5fd' },
            { g: 0, x: 36, y: 20, dx: 24, dy: -24, color: '#fde68a' },
            { g: 3, x: 18, y: 26, dx: -30, dy: -10, color: '#7dd3fc' },
            { g: 4, x: 38, y: 28, dx: 26, dy: -8, color: '#a7f3d0' },
          ],
          1.4
        );
      }

      // Broadcast toss-yarn event so Cat Sanctuary's 4 pixel cats chase a live yarn ball
      try {
        let rect = null;
        if (typeof btn.getBoundingClientRect === 'function') {
          rect = btn.getBoundingClientRect();
        }
        const detail = {
          source: 'chat-scene-stationery',
          x: rect ? Math.round(rect.left + rect.width * 0.5) : 0,
          y: rect ? Math.round(rect.top + rect.height * 0.5) : 0,
        };
        const EvCtor = typeof win.CustomEvent === 'function' ? win.CustomEvent : typeof CustomEvent === 'function' ? CustomEvent : null;
        if (EvCtor && typeof win.dispatchEvent === 'function') {
          win.dispatchEvent(new EvCtor('ag-prism-toss-yarn', { detail }));
        }
      } catch {}
    }

    function clearRootChildren(el) {
      if (!el) return;
      while (el.firstChild) {
        if (typeof el.removeChild === 'function') el.removeChild(el.firstChild);
        else el.firstChild.remove();
      }
      flankLeft = null;
      flankRight = null;
      sparkleCount = 0;
    }

    function populateScene(targetMode) {
      if (!rootEl) return;
      clearRootChildren(rootEl);
      renderedMode = targetMode;
      setAttrIfChanged(rootEl, 'data-scene', targetMode);

      const bgLayer = createHtmlEl(doc, 'div', { class: 'ag-cs-scene-bg', 'aria-hidden': 'true' });

      if (targetMode === 'sky') {
        bgLayer.appendChild(buildSkyRainbow(doc));
        bgLayer.appendChild(buildCloudBank(doc, 'back-l', 'ag-scene-cloud-back-l'));
        bgLayer.appendChild(buildCloudBank(doc, 'back-r', 'ag-scene-cloud-back-r'));
        bgLayer.appendChild(buildCloudBank(doc, 'mid-l', 'ag-scene-cloud-mid-l'));
        bgLayer.appendChild(buildCloudBank(doc, 'mid-r', 'ag-scene-cloud-mid-r'));
        bgLayer.appendChild(buildCloudBank(doc, 'front-l', 'ag-scene-cloud-front-l'));
        bgLayer.appendChild(buildCloudBank(doc, 'front-r', 'ag-scene-cloud-front-r'));
        bgLayer.appendChild(buildCloudBank(doc, 'top-l', 'ag-scene-cloud-top-l'));
        bgLayer.appendChild(buildSkyMoonCatWatermark(doc));
        rootEl.appendChild(bgLayer);

        const chime = buildSkyChimeCharm(doc, handleChimeClick);
        rootEl.appendChild(chime.btn);
      } else if (targetMode === 'stationery') {
        bgLayer.appendChild(createHtmlEl(doc, 'div', { class: 'ag-scene-st-dotgrid', 'aria-hidden': 'true' }));
        bgLayer.appendChild(buildStationeryWatercolor(doc));
        flankLeft = createHtmlEl(doc, 'div', { class: 'ag-scene-st-flank ag-scene-st-flank-l', 'aria-hidden': 'true' });
        flankRight = createHtmlEl(doc, 'div', { class: 'ag-scene-st-flank ag-scene-st-flank-r', 'aria-hidden': 'true' });
        bgLayer.appendChild(flankLeft);
        bgLayer.appendChild(flankRight);
        bgLayer.appendChild(buildStationeryPrismCatStamp(doc));
        bgLayer.appendChild(buildStationeryCornerArt(doc));
        rootEl.appendChild(bgLayer);

        const yarn = buildStationeryYarnCharm(doc, handleYarnClick);
        rootEl.appendChild(yarn.btn);
      }
    }

    function stopSparkleLoop() {
      if (sparkleTimer) {
        clearTimeout(sparkleTimer);
        sparkleTimer = 0;
      }
    }

    function spawnOneStationerySparkle() {
      if (mode !== 'stationery' || !mounted || paused || narrow || streaming || hiddenByHome || hiddenByHole) {
        return;
      }
      if (!flankLeft || !flankRight || sparkleCount >= MAX_SPARKLES) return;

      const useRight = Math.random() > 0.5;
      const host = useRight ? flankRight : flankLeft;
      const glyphIdx = Math.floor(Math.random() * PIXEL_GLYPHS.length);
      const pxScale = 1.2 + Math.random() * 0.55;
      const leftPx = Math.round(10 + Math.random() * 76);
      const driftX = Math.round((Math.random() - 0.5) * 18);
      const riseY = -Math.round(54 + Math.random() * 44);
      const durMs = Math.round(5600 + Math.random() * 2600);

      const node = createHtmlEl(doc, 'span', { class: 'ag-scene-px-sparkle', 'aria-hidden': 'true' }, [
        buildPixelGlyphSvg(doc, glyphIdx, pxScale),
      ]);
      node.style.left = leftPx + 'px';
      node.style.animationDuration = durMs + 'ms';
      if (typeof node.style.setProperty === 'function') {
        node.style.setProperty('--ag-sx', driftX + 'px');
        node.style.setProperty('--ag-sy', riseY + 'px');
      }

      sparkleCount++;
      host.appendChild(node);
      trackTimeout(() => {
        sparkleCount = Math.max(0, sparkleCount - 1);
        try {
          node.remove();
        } catch {}
      }, durMs + 120);
    }

    function syncSparkleLoop() {
      const shouldRun =
        mode === 'stationery' && mounted && !paused && !narrow && !streaming && !hiddenByHome && !hiddenByHole;
      if (!shouldRun) {
        stopSparkleLoop();
        return;
      }
      if (sparkleTimer) return;
      const nextMs = sparkleCount === 0 ? 480 : Math.round(1350 + Math.random() * 950);
      sparkleTimer = setTimeout(() => {
        sparkleTimer = 0;
        spawnOneStationerySparkle();
        syncSparkleLoop();
      }, nextMs);
    }

    function updateMetrics() {
      if (!seatParent || !rootEl) return;
      let w = seatParent.clientWidth || 0;
      if (!w && typeof seatParent.getBoundingClientRect === 'function') {
        try {
          w = Math.round(seatParent.getBoundingClientRect().width || 0);
        } catch {}
      }
      if (!w && typeof win.innerWidth === 'number') {
        w = win.innerWidth;
      }
      seatWidth = w;
      narrow = w > 0 && w < NARROW_WIDTH_PX;
      const sideMargin = Math.max(0, Math.round((w - READING_COL_PX) / 2));
      if (rootEl.style && typeof rootEl.style.setProperty === 'function') {
        rootEl.style.setProperty('--ag-scene-side-margin', sideMargin + 'px');
        rootEl.style.setProperty('--ag-scene-col-half', Math.round(READING_COL_PX / 2) + 'px');
      }
      setAttrIfChanged(rootEl, 'data-narrow', narrow ? '1' : null);
    }

    function updateRuntimeAttrs() {
      dark = readDarkTheme();
      hiddenByHole = readBrowserHole(seatParent);
      streaming = readStreamingState();
      paused =
        mode === 'off' ||
        !mounted ||
        hiddenByHome ||
        hiddenByHole ||
        doc.hidden === true ||
        winBlurred ||
        readWinBlurAttr() ||
        readMotionOff();

      if (rootEl) {
        setAttrIfChanged(rootEl, 'data-theme', dark ? 'dark' : 'light');
        setAttrIfChanged(rootEl, 'data-paused', paused ? '1' : null);
        setAttrIfChanged(rootEl, 'data-hole', hiddenByHole ? '1' : null);
        setAttrIfChanged(rootEl, 'data-home', hiddenByHome ? '1' : null);
        setAttrIfChanged(rootEl, 'data-streaming', streaming ? '1' : null);
      }
      syncSparkleLoop();
    }

    function attachResizeObserver(target) {
      if (resizeObserver) {
        try {
          resizeObserver.disconnect();
        } catch {}
        resizeObserver = null;
      }
      if (!target || typeof win.ResizeObserver !== 'function') return;
      try {
        resizeObserver = new win.ResizeObserver(() => {
          updateMetrics();
          syncSparkleLoop();
        });
        resizeObserver.observe(target);
      } catch {
        resizeObserver = null;
      }
    }

    function unmountRootOnly() {
      stopSparkleLoop();
      if (resizeObserver) {
        try {
          resizeObserver.disconnect();
        } catch {}
        resizeObserver = null;
      }
      if (rootEl) {
        try {
          rootEl.remove();
        } catch {}
      }
      const stray = typeof doc.getElementById === 'function' ? doc.getElementById(ROOT_ID) : null;
      if (stray && stray !== rootEl) {
        try {
          stray.remove();
        } catch {}
      }
      rootEl = null;
      seatParent = null;
      flankLeft = null;
      flankRight = null;
      renderedMode = 'off';
      mounted = false;
      sparkleCount = 0;
    }

    function reconcileNow() {
      if (mode === 'off') {
        unmountRootOnly();
        return;
      }

      ensureStyle();
      const targetSeat = findActiveSeatParent();
      if (!targetSeat) {
        unmountRootOnly();
        updateRuntimeAttrs();
        return;
      }

      if (!rootEl) {
        const existing = typeof doc.getElementById === 'function' ? doc.getElementById(ROOT_ID) : null;
        rootEl = existing || applyNoTr(createHtmlEl(doc, 'div', { id: ROOT_ID, 'aria-hidden': 'true' }));
      }

      if (seatParent !== targetSeat || rootEl.parentElement !== targetSeat) {
        seatParent = targetSeat;
        const auraHost =
          typeof targetSeat.querySelector === 'function' ? targetSeat.querySelector('.ag-cs-conv-aura-host') : null;
        if (auraHost && auraHost.parentElement === targetSeat && typeof targetSeat.insertBefore === 'function') {
          targetSeat.insertBefore(rootEl, auraHost.nextSibling || null);
        } else if (targetSeat.firstChild && typeof targetSeat.insertBefore === 'function') {
          targetSeat.insertBefore(rootEl, targetSeat.firstChild);
        } else if (typeof targetSeat.appendChild === 'function') {
          targetSeat.appendChild(rootEl);
        }
        attachResizeObserver(targetSeat);
      }

      mounted = true;
      if (renderedMode !== mode) {
        populateScene(mode);
      }
      updateMetrics();
      updateRuntimeAttrs();
    }

    function scheduleReconcile() {
      if (mode === 'off') return;
      if (reconcileRaf || reconcileTimer) return;
      if (typeof win.requestAnimationFrame === 'function') {
        reconcileRaf = win.requestAnimationFrame(() => {
          reconcileRaf = 0;
          reconcileNow();
        });
      } else {
        reconcileTimer = setTimeout(() => {
          reconcileTimer = 0;
          reconcileNow();
        }, 16);
      }
    }

    function onWindowBlur() {
      winBlurred = true;
      updateRuntimeAttrs();
    }

    function onWindowFocus() {
      winBlurred = false;
      updateRuntimeAttrs();
    }

    function onVisibilityChange() {
      updateRuntimeAttrs();
    }

    function onWindowResize() {
      if (mode === 'off' || !mounted) return;
      updateMetrics();
      syncSparkleLoop();
    }

    function onMotionMediaChange(ev) {
      prefersReducedMotion = Boolean(ev && ev.matches);
      updateRuntimeAttrs();
    }

    function onDarkMediaChange() {
      updateRuntimeAttrs();
    }

    function attachListeners() {
      if (listenersAttached) return;
      listenersAttached = true;

      if (typeof win.addEventListener === 'function') {
        win.addEventListener('blur', onWindowBlur, false);
        win.addEventListener('focus', onWindowFocus, false);
        win.addEventListener('resize', onWindowResize, { passive: true });
      }
      if (typeof doc.addEventListener === 'function') {
        doc.addEventListener('visibilitychange', onVisibilityChange, false);
      }

      if (typeof win.matchMedia === 'function') {
        try {
          mqlMotion = win.matchMedia('(prefers-reduced-motion: reduce)');
          prefersReducedMotion = Boolean(mqlMotion && mqlMotion.matches);
          if (mqlMotion && typeof mqlMotion.addEventListener === 'function') {
            mqlMotion.addEventListener('change', onMotionMediaChange);
          } else if (mqlMotion && typeof mqlMotion.addListener === 'function') {
            mqlMotion.addListener(onMotionMediaChange);
          }
        } catch {}
        try {
          mqlDark = win.matchMedia('(prefers-color-scheme: dark)');
          if (mqlDark && typeof mqlDark.addEventListener === 'function') {
            mqlDark.addEventListener('change', onDarkMediaChange);
          } else if (mqlDark && typeof mqlDark.addListener === 'function') {
            mqlDark.addListener(onDarkMediaChange);
          }
        } catch {}
      }

      const MO = typeof win.MutationObserver === 'function' ? win.MutationObserver : typeof MutationObserver === 'function' ? MutationObserver : null;
      if (MO) {
        if (doc.documentElement) {
          try {
            htmlObserver = new MO((records) => {
              let attrSceneChanged = false;
              for (let i = 0; i < records.length; i++) {
                if (records[i] && records[i].attributeName === 'data-ag-chat-scene') {
                  attrSceneChanged = true;
                  break;
                }
              }
              if (attrSceneChanged) {
                const next = normalizeMode(doc.documentElement.getAttribute('data-ag-chat-scene'));
                if (next !== mode) {
                  sync({ chatScene: next });
                  return;
                }
              }
              updateRuntimeAttrs();
            });
            htmlObserver.observe(doc.documentElement, {
              attributes: true,
              attributeFilter: ['data-ag-cs-theme', 'data-ag-cs-motion', 'data-ag-cs-win-blur', 'data-ag-chat-scene', 'class'],
            });
          } catch {}
        }

        if (doc.body) {
          try {
            bodyObserver = new MO(() => {
              updateRuntimeAttrs();
            });
            bodyObserver.observe(doc.body, {
              attributes: true,
              attributeFilter: ['data-has-browser-hole'],
            });
          } catch {}

          try {
            domObserver = new MO((records) => {
              // Ignore mutations inside our own root to prevent feedback loops
              let relevant = false;
              for (let i = 0; i < records.length; i++) {
                const r = records[i];
                if (!r || !r.target) continue;
                if (rootEl && (r.target === rootEl || (typeof rootEl.contains === 'function' && rootEl.contains(r.target)))) {
                  continue;
                }
                relevant = true;
                break;
              }
              if (relevant) scheduleReconcile();
            });
            domObserver.observe(doc.body, { childList: true, subtree: true });
          } catch {}
        }
      }
    }

    function detachListeners() {
      if (!listenersAttached) return;
      listenersAttached = false;

      if (typeof win.removeEventListener === 'function') {
        win.removeEventListener('blur', onWindowBlur, false);
        win.removeEventListener('focus', onWindowFocus, false);
        win.removeEventListener('resize', onWindowResize, false);
      }
      if (typeof doc.removeEventListener === 'function') {
        doc.removeEventListener('visibilitychange', onVisibilityChange, false);
      }

      if (mqlMotion) {
        try {
          if (typeof mqlMotion.removeEventListener === 'function') mqlMotion.removeEventListener('change', onMotionMediaChange);
          else if (typeof mqlMotion.removeListener === 'function') mqlMotion.removeListener(onMotionMediaChange);
        } catch {}
        mqlMotion = null;
      }
      if (mqlDark) {
        try {
          if (typeof mqlDark.removeEventListener === 'function') mqlDark.removeEventListener('change', onDarkMediaChange);
          else if (typeof mqlDark.removeListener === 'function') mqlDark.removeListener(onDarkMediaChange);
        } catch {}
        mqlDark = null;
      }

      if (domObserver) {
        try {
          domObserver.disconnect();
        } catch {}
        domObserver = null;
      }
      if (htmlObserver) {
        try {
          htmlObserver.disconnect();
        } catch {}
        htmlObserver = null;
      }
      if (bodyObserver) {
        try {
          bodyObserver.disconnect();
        } catch {}
        bodyObserver = null;
      }
      if (resizeObserver) {
        try {
          resizeObserver.disconnect();
        } catch {}
        resizeObserver = null;
      }
    }

    function dispose() {
      mode = 'off';
      clearTrackedTimers();
      detachListeners();
      unmountRootOnly();
      if (styleEl) {
        try {
          styleEl.remove();
        } catch {}
        styleEl = null;
      }
      const strayStyle = typeof doc.getElementById === 'function' ? doc.getElementById(STYLE_ID) : null;
      if (strayStyle) {
        try {
          strayStyle.remove();
        } catch {}
      }
      paused = true;
      streaming = false;
      narrow = false;
      hiddenByHome = false;
      hiddenByHole = false;
    }

    function sync(cfg) {
      const nextMode = normalizeMode(cfg);
      if (nextMode === 'off') {
        dispose();
        return getState();
      }
      mode = nextMode;
      attachListeners();
      reconcileNow();
      return getState();
    }

    function getState() {
      return {
        mode,
        mounted,
        paused,
        narrow,
        dark,
        streaming,
        hiddenByHome,
        hiddenByHole,
        sparkleCount,
        seatWidth,
      };
    }

    return { sync, dispose, getState };
  }

  const controller = createChatSceneController();
  try {
    G[CONTROLLER_KEY] = controller;
  } catch {}

  // Auto-init from window.__agPrism?.getState?.()?.cfg or html[data-ag-chat-scene]
  try {
    const prismCfg =
      G.__agPrism && typeof G.__agPrism.getState === 'function' ? G.__agPrism.getState()?.cfg : null;
    const htmlAttr =
      typeof document !== 'undefined' &&
      document.documentElement &&
      typeof document.documentElement.getAttribute === 'function'
        ? document.documentElement.getAttribute('data-ag-chat-scene')
        : null;
    const initialMode = normalizeMode(prismCfg && prismCfg.chatScene !== undefined ? prismCfg.chatScene : htmlAttr);
    if (initialMode !== 'off') {
      controller.sync({ chatScene: initialMode });
    } else {
      controller.dispose();
    }
  } catch {}
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
