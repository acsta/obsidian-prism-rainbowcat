// Obsidian Prism — Zero-StyleRecalc 300Hz GPU Canvas Prism Rim & Orchestrator Rim Module (prism-rim-canvas.js)
// Extracted from ui-runtime.js: manages ResizeObserver geometry caching and 2D radial gradient rim rendering.

(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  const RIM_PALETTES = {
    default: {
      dark: [
        [0, 'rgba(255,255,255,0.96)'],
        [0.24, '#4285F4'],
        [0.50, '#9B72CB'],
        [0.74, '#EA4335'],
        [0.92, '#FBBC04'],
        [1, 'rgba(251,188,4,0)'],
      ],
      light: [
        [0, '#2563EB'],
        [0.32, '#7C3AED'],
        [0.64, '#EA4335'],
        [0.88, '#D97706'],
        [1, 'rgba(217,119,6,0)'],
      ],
    },
    warm: {
      dark: [
        [0, 'rgba(255,246,238,0.95)'],
        [0.26, '#F6BD60'],
        [0.54, '#F0A37E'],
        [0.82, '#D97757'],
        [1, 'rgba(217,119,87,0)'],
      ],
      light: [
        [0, '#9A3412'],
        [0.34, '#C25934'],
        [0.68, '#D97757'],
        [0.90, '#D97706'],
        [1, 'rgba(217,119,6,0)'],
      ],
    },
    cobalt: {
      dark: [
        [0, 'rgba(240,249,255,0.96)'],
        [0.26, '#7CE2FF'],
        [0.56, '#4285F4'],
        [0.86, '#1B49B2'],
        [1, 'rgba(27,73,178,0)'],
      ],
      light: [
        [0, '#1D4ED8'],
        [0.35, '#2563EB'],
        [0.70, '#0284C7'],
        [0.92, '#38BDF8'],
        [1, 'rgba(56,189,248,0)'],
      ],
    },
    iris: {
      dark: [
        [0, 'rgba(245,243,255,0.95)'],
        [0.26, '#DDD6FE'],
        [0.56, '#A58AF8'],
        [0.86, '#6D28D9'],
        [1, 'rgba(109,40,217,0)'],
      ],
      light: [
        [0, '#5B21B6'],
        [0.36, '#7C3AED'],
        [0.70, '#8B5CF6'],
        [0.92, '#A855F7'],
        [1, 'rgba(168,85,247,0)'],
      ],
    },
    amber: {
      dark: [
        [0, 'rgba(255,251,235,0.95)'],
        [0.26, '#FDE68A'],
        [0.56, '#F2B84B'],
        [0.86, '#D97706'],
        [1, 'rgba(217,119,6,0)'],
      ],
      light: [
        [0, '#92400E'],
        [0.36, '#B45309'],
        [0.70, '#D97706'],
        [0.92, '#F59E0B'],
        [1, 'rgba(245,158,11,0)'],
      ],
    },
    mono: {
      dark: [
        [0, 'rgba(248,250,252,0.92)'],
        [0.28, '#E2E8F0'],
        [0.60, '#94A3B8'],
        [0.88, '#64748B'],
        [1, 'rgba(100,116,139,0)'],
      ],
      light: [
        [0, '#1E293B'],
        [0.36, '#334155'],
        [0.70, '#64748B'],
        [0.92, '#94A3B8'],
        [1, 'rgba(148,163,184,0)'],
      ],
    },
    rainbow: {
      dark: [
        [0, 'rgba(255,255,255,0.96)'],
        [0.20, '#FB7185'],
        [0.40, '#FBBF24'],
        [0.60, '#34D399'],
        [0.80, '#38BDF8'],
        [0.94, '#A855F7'],
        [1, 'rgba(168,85,247,0)'],
      ],
      light: [
        [0, 'rgba(244,114,182,0.72)'],
        [0.25, 'rgba(251,146,60,0.68)'],
        [0.50, 'rgba(45,212,191,0.70)'],
        [0.75, 'rgba(56,189,248,0.74)'],
        [0.92, 'rgba(167,139,250,0.74)'],
        [1, 'rgba(167,139,250,0)'],
      ],
    },
  };

  const parseAmbientScale = (raw) =>
    G.__agPrismRipple?.parseAmbientScale
      ? G.__agPrismRipple.parseAmbientScale(raw)
      : raw === null || raw === undefined || raw === ''
      ? 1
      : Math.max(0, Math.min(1, Number(raw) > 1 ? Number(raw) / 100 : Number.isFinite(Number(raw)) ? Number(raw) : 1));

  function createPrismRimCanvasController({
    isDestroyed,
    isDarkTheme,
    motionReduced,
    getMinFrameGapMs,
    getAmbientIntensity,
    getAccentTone,
    canMountRealCanvas,
    setAttrIfChanged,
    runGuardedMut,
    getActiveCrystalTrack,
    setCrystalPointerClient,
    onPointerActivity,
    onComposerRimUpdate,
  }) {
    const lastPointerPos = { x: -9999, y: -9999 };
    let prismRaf = 0;
    let idleT = 0;
    let lastPrismDrawAt = 0;
    let prismBoxCacheDirty = true;
    let prismBoxCacheAt = 0;
    let lastPrismRectReadAt = 0;
    let cachedPrismBoxes = [];
    let cachedOrchEntry = null;
    let prismBoxRo = null;
    const observedPrismSet = new Set();
    let compRimSig = '0';

    const emitComposerRim = (v) => {
      if (typeof onComposerRimUpdate !== 'function') return;
      const on = Boolean(v && v.strength > 0.015);
      const sig = on ? `1|${Math.round(v.localX / 6)}|${Math.round(v.strength * 12)}|${v.toneKey}|${v.dark ? 1 : 0}` : '0';
      if (sig === compRimSig) return;
      compRimSig = sig;
      try {
        onComposerRimUpdate(on ? { active: true, localX: v.localX, strength: v.strength, toneKey: v.toneKey, dark: v.dark } : { active: false, localX: -9999, strength: 0, toneKey: 'default', dark: true });
      } catch {}
    };

    const getDoc = () => (typeof document !== 'undefined' ? document : null);
    function getRootHtml() {
      return getDoc()?.documentElement || null;
    }

    function readAmbientScale() {
      if (getAmbientIntensity) return parseAmbientScale(getAmbientIntensity());
      return parseAmbientScale(getRootHtml()?.getAttribute?.('data-ag-cs-ambient'));
    }

    function resolveRimToneKey(dark) {
      const html = getRootHtml();
      const rawTone = getAccentTone?.() || html?.getAttribute?.('data-ag-cs-accent') || 'follow';
      if (rawTone === 'mono' || rawTone === 'cobalt' || rawTone === 'iris' || rawTone === 'amber' || rawTone === 'rainbow') {
        return rawTone;
      }
      const pal = html?.getAttribute?.('data-ag-cs-palette') || 'obsidian';
      if (pal === 'warm' || pal === 'claude') return 'warm';
      if (!dark && pal === 'obsidian' && html?.getAttribute?.('data-ag-cs-light-preset') === 'alabaster') return 'warm';
      return 'default';
    }

    function isRimMotionDisabled() {
      if (motionReduced?.()) return true;
      const mv = getRootHtml()?.getAttribute?.('data-ag-cs-motion') || '';
      return mv === 'off' || mv === 'subtle';
    }

    const isH = () => Boolean(getDoc()?.hidden);
    const isWB = () => isH() || getRootHtml()?.getAttribute?.('data-ag-cs-win-blur') === '1';
    const isDragSuspended = () => {
      const h = getRootHtml();
      return h?.getAttribute?.('data-ag-cs-resizing') === '1' || h?.getAttribute?.('data-ag-cs-mascot-drag') === '1';
    };
    const clrIdle = () => { if (idleT) { typeof clearTimeout === 'function' && clearTimeout(idleT); idleT = 0; } };
    const zCv = (c) => { if (c && (c.width || c.height)) c.width = c.height = 0; };
    const zEnt = (e, all) => { if (e && (all || e.wasCleared)) { e._s = ''; e._g = null; e._gk = ''; e.wasCleared = true; zCv(e.cv); } };
    const shrinkRims = (all) => {
      clrIdle();
      if (!all && isDestroyed()) return;
      for (const e of cachedPrismBoxes) zEnt(e, all);
      zEnt(cachedOrchEntry, all);
      if (all) {
        emitComposerRim(null);
        for (const c of trackedRimCanvases) zCv(c);
        getDoc()?.querySelectorAll?.('.ag-cs-prism-rim-cv')?.forEach?.(zCv);
      }
    };
    const armIdle = () => {
      if (isDestroyed() || typeof setTimeout !== 'function') return;
      const ok = (e) => e?.wasCleared && e.cv && (e.cv.width > 0 || e.cv.height > 0);
      if (!ok(cachedOrchEntry) && !cachedPrismBoxes.some(ok)) return clrIdle();
      if (!idleT) idleT = setTimeout(() => shrinkRims(0), 1800);
    };

    function clearRimEntry(entry) {
      if (!entry) return;
      entry._s = '';
      if (entry.ctx && entry.cv && entry.cv.width > 0 && entry.cv.height > 0 && !entry.wasCleared) {
        try { entry.ctx.clearRect(0, 0, entry.cv.width, entry.cv.height); } catch {}
        entry.wasCleared = true;
      }
    }

    function clearAllRimCanvases(immediateShrink = false) {
      cachedPrismBoxes.forEach(clearRimEntry);
      clearRimEntry(cachedOrchEntry);
      emitComposerRim(null);
      getDoc()?.querySelectorAll?.('.ag-cs-prism-rim-cv')?.forEach?.((cv) => {
        try { const ctx = cv.getContext?.('2d'); if (ctx && cv.width > 0 && cv.height > 0) ctx.clearRect(0, 0, cv.width, cv.height); } catch {}
      });
      if (immediateShrink) shrinkRims(1);
      else armIdle();
    }

    const trackedRimCanvases = new Set();

    function removeSingleRimCanvas(cv) {
      if (!cv) return;
      trackedRimCanvases.delete(cv);
      const host = cv.parentElement;
      try {
        const ctx = cv.getContext?.('2d');
        if (ctx && cv.width > 0 && cv.height > 0) ctx.clearRect(0, 0, cv.width, cv.height);
      } catch {}
      cv.remove?.();
      if (host?.hasAttribute?.('data-ag-cs-prism-cv')) host.removeAttribute('data-ag-cs-prism-cv');
    }

    function pruneDetachedBoxes(activeTrack) {
      const keepBox = (b) => Boolean(b && b.isConnected !== false && b.getAttribute?.('data-ag-cs-prism-box') === '1');
      if (cachedPrismBoxes.length > 0) {
        let kept = null;
        for (let i = 0; i < cachedPrismBoxes.length; i++) {
          const e = cachedPrismBoxes[i];
          if (e && keepBox(e.box)) {
            if (kept) kept.push(e);
          } else {
            if (!kept) kept = cachedPrismBoxes.slice(0, i);
            if (e?.cv) removeSingleRimCanvas(e.cv);
            if (e?.box && observedPrismSet.has(e.box)) {
              try { prismBoxRo?.unobserve?.(e.box); } catch {}
              observedPrismSet.delete(e.box);
            }
          }
        }
        if (kept) cachedPrismBoxes = kept;
      }
      if (
        cachedOrchEntry &&
        (!cachedOrchEntry.box || cachedOrchEntry.box.isConnected === false || (activeTrack && cachedOrchEntry.box !== activeTrack))
      ) {
        if (cachedOrchEntry.cv) removeSingleRimCanvas(cachedOrchEntry.cv);
        if (cachedOrchEntry.box && observedPrismSet.has(cachedOrchEntry.box)) {
          try { prismBoxRo?.unobserve?.(cachedOrchEntry.box); } catch {}
          observedPrismSet.delete(cachedOrchEntry.box);
        }
        cachedOrchEntry = null;
      }
      if (observedPrismSet.size > 0) {
        for (const box of Array.from(observedPrismSet)) {
          if (!box || box.isConnected === false || (box.getAttribute?.('data-ag-cs-prism-box') !== '1' && box !== activeTrack)) {
            try { prismBoxRo?.unobserve?.(box); } catch {}
            observedPrismSet.delete(box);
          }
        }
      }
    }

    function pruneOrphanRimCanvases(fullScan = true) {
      const activeTrack = getActiveCrystalTrack?.() || null;
      pruneDetachedBoxes(activeTrack);
      const d = getDoc();
      if (!d || typeof d.querySelectorAll !== 'function') return;
      const keepHost = (h) => Boolean(h && h.isConnected !== false && (h.getAttribute?.('data-ag-cs-prism-box') === '1' || (activeTrack && h === activeTrack)));
      if (!fullScan) {
        for (const cv of Array.from(trackedRimCanvases)) {
          if (!cv || cv.isConnected === false || !keepHost(cv.parentElement)) removeSingleRimCanvas(cv);
        }
        return;
      }
      for (const cv of Array.from(trackedRimCanvases)) {
        if (!cv || cv.isConnected === false) trackedRimCanvases.delete(cv);
      }
      d.querySelectorAll('.ag-cs-prism-rim-cv').forEach((cv) => {
        if (!keepHost(cv.parentElement)) removeSingleRimCanvas(cv);
        else trackedRimCanvases.add(cv);
      });
      d.querySelectorAll('[data-ag-cs-prism-cv]').forEach((host) => {
        if (!keepHost(host) || !host.querySelector?.('.ag-cs-prism-rim-cv')) host.removeAttribute('data-ag-cs-prism-cv');
      });
    }

    function ensurePrismRimCanvas(hostEl) {
      if (!hostEl || !canMountRealCanvas(hostEl)) return null;
      let cv = null;
      for (let c = hostEl.firstElementChild; c; c = c.nextElementSibling) {
        if (c.classList?.contains('ag-cs-prism-rim-cv')) {
          cv = c;
          break;
        }
      }
      if (!cv) {
        cv = document.createElement('canvas');
        cv.className = 'ag-cs-prism-rim-cv';
        cv.width = 0;
        cv.height = 0;
        cv.setAttribute('aria-hidden', 'true');
        cv.setAttribute('data-ag-no-i18n', '');
        if (cv.style?.setProperty) {
          cv.style.setProperty('margin', '0', 'important');
          cv.style.setProperty('padding', '0', 'important');
          cv.style.setProperty('border', '0', 'important');
        }
        hostEl.appendChild(cv);
      }
      trackedRimCanvases.add(cv);
      const ctx = typeof cv.getContext === 'function' ? cv.getContext('2d') : null;
      if (!ctx || typeof ctx.createRadialGradient !== 'function') {
        cv.remove();
        return null;
      }
      setAttrIfChanged(hostEl, 'data-ag-cs-prism-cv', '1');
      return { cv, ctx };
    }

    function strokeRoundedRectPath(ctx, x, y, w, h, r) {
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, r);
        return;
      }
      const cr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
      ctx.moveTo(x + cr, y);
      ctx.arcTo(x + w, y, x + w, y + h, cr);
      ctx.arcTo(x + w, y + h, x, y + h, cr);
      ctx.arcTo(x, y + h, x, y, cr);
      ctx.arcTo(x, y, x + w, y, cr);
      ctx.closePath();
    }

    function traceCursorGhostPath(ctx, s) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 13.8 * s);
      ctx.lineTo(3.6 * s, 10.5 * s);
      ctx.lineTo(6.1 * s, 15.6 * s);
      ctx.lineTo(8.0 * s, 14.7 * s);
      ctx.lineTo(5.5 * s, 9.6 * s);
      ctx.lineTo(10.1 * s, 9.6 * s);
      ctx.closePath();
    }

    function drawMirrorCursorReflection(ctx, gx, gy, w, h, dpr, dark, effAlpha, rectW, rectH, localX, localY) {
      // 面积超过 120,000 px² 的大容器（如 overview-panel）跳过光标倒影以规避全画幅逐帧重绘开销
      if ((rectW || 0) * (rectH || 0) > 120000) return;
      const distX = localX < 0 ? -localX : localX > rectW ? localX - rectW : 0;
      const distY = localY < 0 ? -localY : localY > rectH ? localY - rectH : 0;
      const distOut = Math.hypot(distX, distY);
      if (distOut > 42) return;
      const prox = Math.max(0, 1 - distOut / 42);
      const reflAlpha = effAlpha * prox * (dark ? 1 : 0.65);
      if (reflAlpha <= 0.01) return;

      // Subtle glass-thickness refraction offset (+3.2px, +4.2px)
      const rx = gx + 3.2 * dpr;
      const ry = gy + 4.2 * dpr;

      // 1) Soft specular coating bloom around cursor tip
      const bloomR = 26 * dpr;
      const bg = ctx.createRadialGradient(rx + 2 * dpr, ry + 3 * dpr, 0, rx + 2 * dpr, ry + 3 * dpr, bloomR);
      if (dark) {
        bg.addColorStop(0, `rgba(248,252,255,${(0.135 * reflAlpha).toFixed(4)})`);
        bg.addColorStop(0.45, `rgba(216,232,252,${(0.05 * reflAlpha).toFixed(4)})`);
        bg.addColorStop(1, 'rgba(200,220,250,0)');
      } else {
        bg.addColorStop(0, `rgba(37,99,235,${(0.065 * reflAlpha).toFixed(4)})`);
        bg.addColorStop(1, 'rgba(37,99,235,0)');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 2) 双层低透明度软渐变模拟虚焦倒影（零 ctx.filter 离屏高斯表面分配）
      const sOuter = 1.18 * dpr;
      ctx.save();
      ctx.translate(rx - 0.55 * dpr, ry - 0.55 * dpr);
      traceCursorGhostPath(ctx, sOuter);
      const og = ctx.createLinearGradient(0, 0, 8 * sOuter, 16 * sOuter);
      if (dark) {
        og.addColorStop(0, `rgba(232,242,255,${(0.055 * reflAlpha).toFixed(4)})`);
        og.addColorStop(0.55, `rgba(204,224,248,${(0.024 * reflAlpha).toFixed(4)})`);
        og.addColorStop(1, 'rgba(180,205,238,0)');
      } else {
        og.addColorStop(0, `rgba(15,23,42,${(0.032 * reflAlpha).toFixed(4)})`);
        og.addColorStop(1, 'rgba(15,23,42,0)');
      }
      ctx.fillStyle = og;
      ctx.fill();
      ctx.restore();

      const s = 1.04 * dpr;
      ctx.save();
      ctx.translate(rx, ry);
      traceCursorGhostPath(ctx, s);
      const cg = ctx.createLinearGradient(0, 0, 7 * s, 15 * s);
      if (dark) {
        cg.addColorStop(0, `rgba(252,254,255,${(0.115 * reflAlpha).toFixed(4)})`);
        cg.addColorStop(0.45, `rgba(222,235,252,${(0.048 * reflAlpha).toFixed(4)})`);
        cg.addColorStop(1, `rgba(190,210,240,${(0.006 * reflAlpha).toFixed(4)})`);
      } else {
        cg.addColorStop(0, `rgba(15,23,42,${(0.06 * reflAlpha).toFixed(4)})`);
        cg.addColorStop(1, 'rgba(15,23,42,0.004)');
      }
      ctx.fillStyle = cg;
      ctx.fill();
      ctx.restore();
    }

    function paintPrismRimCanvas(entry, active, localX, localY, radius, dark, toneKey = 'default', ambientScale = 1) {
      if (isDragSuspended()) return true;
      if (!entry || !entry.ctx || !entry.cv || !entry.rect) return false;
      if (!active || ambientScale <= 0.001) {
        entry._s = '';
        if (!entry.wasCleared) {
          if (entry.cv.width > 0 && entry.cv.height > 0) entry.ctx.clearRect(0, 0, entry.cv.width, entry.cv.height);
          entry.wasCleared = true;
        }
        return true;
      }
      const isMirror = Boolean(entry.mirrorMode);
      const isReflectBottom = !isMirror && Boolean(entry.reflectBottomMode);
      const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 1.5);
      const w = Math.max(4, Math.round((entry.rect.width + (entry.insetPad || 0)) * dpr));
      const h = Math.max(4, Math.round((entry.rect.height + (entry.insetPad || 0)) * dpr));
      const cssRadius = entry.borderRadius > 0 ? entry.borderRadius : 10;
      const effAlpha = Math.max(0, Math.min(1, ambientScale * (!isMirror && toneKey === 'mono' ? 0.58 : 1)));
      const sig = `${w}|${h}|${radius}|${dark ? 1 : 0}|${isMirror ? 'mirror' : toneKey}|${isReflectBottom ? 'reflB' : ''}|${effAlpha.toFixed(3)}|${cssRadius}|${entry.insetPad || 0}`;
      const moveEps = 1.5;
      if (!entry.wasCleared && entry.cv.width === w && entry.cv.height === h && entry._s === sig && Math.abs(localX - entry._x) < moveEps && Math.abs(localY - entry._y) < moveEps) {
        return true;
      }
      if (entry.cv.width !== w || entry.cv.height !== h) { entry.cv.width = w; entry.cv.height = h; }
      entry.wasCleared = false;
      entry._s = sig; entry._x = localX; entry._y = localY;
      const ctx = entry.ctx;
      ctx.clearRect(0, 0, w, h);
      const padOffset = entry.insetPad ? entry.insetPad * 0.5 : 0;
      const gx = (localX + padOffset) * dpr;
      const gy = (localY + padOffset) * dpr;
      const gr = radius * dpr;
      const strokeInset = (entry.insetPad ? 1.0 : 0.75) * dpr;
      const rw = Math.max(2, w - strokeInset * 2);
      const rh = Math.max(2, h - strokeInset * 2);
      const rr = Math.min(rw * 0.5, rh * 0.5, cssRadius * dpr);
      const prevAlpha = ctx.globalAlpha;

      if (isMirror) {
        // Layer 1 & 2 (clipped inside rounded glass): soft surface specular wash + cursor reflection
        ctx.save();
        strokeRoundedRectPath(ctx, 0, 0, w, h, Math.min(w * 0.5, h * 0.5, cssRadius * dpr));
        ctx.clip();

        const surfR = 210 * dpr;
        const sg = ctx.createRadialGradient(gx, gy, 0, gx, gy, surfR);
        if (dark) {
          sg.addColorStop(0, `rgba(238,245,255,${(0.068 * effAlpha).toFixed(4)})`);
          sg.addColorStop(0.42, `rgba(206,224,250,${(0.026 * effAlpha).toFixed(4)})`);
          sg.addColorStop(0.8, `rgba(180,202,238,${(0.006 * effAlpha).toFixed(4)})`);
          sg.addColorStop(1, 'rgba(180,202,238,0)');
        } else {
          sg.addColorStop(0, `rgba(37,99,235,${(0.042 * effAlpha).toFixed(4)})`);
          sg.addColorStop(0.5, `rgba(37,99,235,${(0.014 * effAlpha).toFixed(4)})`);
          sg.addColorStop(1, 'rgba(37,99,235,0)');
        }
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, w, h);

        if (typeof ctx.translate === 'function' && typeof ctx.createLinearGradient === 'function') {
          drawMirrorCursorReflection(ctx, gx, gy, w, h, dpr, dark, effAlpha, entry.rect.width, entry.rect.height, localX, localY);
        }
        ctx.restore();

        // Layer 3: Crisp silver-specular rim highlight
        const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        if (dark) {
          rg.addColorStop(0, 'rgba(255,255,255,0.95)');
          rg.addColorStop(0.24, 'rgba(232,240,252,0.56)');
          rg.addColorStop(0.54, 'rgba(186,202,228,0.18)');
          rg.addColorStop(0.85, 'rgba(148,168,198,0.03)');
          rg.addColorStop(1, 'rgba(148,168,198,0)');
        } else {
          rg.addColorStop(0, 'rgba(30,64,175,0.52)');
          rg.addColorStop(0.42, 'rgba(59,130,246,0.2)');
          rg.addColorStop(1, 'rgba(59,130,246,0)');
        }
        ctx.globalAlpha = effAlpha;
        strokeRoundedRectPath(ctx, strokeInset, strokeInset, rw, rh, rr);
        ctx.lineWidth = 1.35 * dpr;
        ctx.strokeStyle = rg;
        ctx.stroke();
        ctx.globalAlpha = prevAlpha !== undefined ? prevAlpha : 1;
        return true;
      }

      if (isReflectBottom) {
        const gyR = h + 16 * dpr, grR = Math.max(radius * 1.15, 220) * dpr, ob = localY - entry.rect.height;
        const aR = effAlpha * 0.46 * (ob > 150 ? Math.max(0, 1 - (ob - 150) / 190) : localY < 0 ? Math.max(0, 1 + localY / 80) : 1);
        if (aR > 0.004) {
          const rg = ctx.createRadialGradient(gx, gyR, 0, gx, gyR, grR);
          const stops = (RIM_PALETTES[toneKey] || RIM_PALETTES.default)[dark ? 'dark' : 'light'];
          for (let i = 0; i < stops.length; i++) rg.addColorStop(stops[i][0], stops[i][1]);
          ctx.globalAlpha = aR;
          strokeRoundedRectPath(ctx, strokeInset, strokeInset, rw, rh, rr);
          ctx.lineWidth = 1.15 * dpr;
          ctx.strokeStyle = rg;
          ctx.stroke();
          if (typeof ctx.save === 'function' && typeof ctx.clip === 'function') {
            ctx.save();
            strokeRoundedRectPath(ctx, strokeInset, strokeInset, rw, rh, rr);
            ctx.clip();
            const wh = Math.min(rh, 14 * dpr), wg = ctx.createRadialGradient(gx, h + 2 * dpr, 0, gx, h + 2 * dpr, Math.max(grR * 0.72, 160 * dpr)), wc = dark ? '255,255,255' : '59,130,246';
            wg.addColorStop(0, `rgba(${wc},${(0.032 * aR).toFixed(4)})`);
            wg.addColorStop(1, `rgba(${wc},0)`);
            ctx.globalAlpha = 1;
            ctx.fillStyle = wg;
            ctx.fillRect(0, Math.max(0, h - wh), w, wh);
            ctx.restore();
          }
          if (typeof ctx.createLinearGradient === 'function' && typeof ctx.save === 'function') {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-in';
            const vg = ctx.createLinearGradient(0, h, 0, 0);
            vg.addColorStop(0, 'rgba(0,0,0,1)');
            vg.addColorStop(0.22, 'rgba(0,0,0,0.68)');
            vg.addColorStop(0.48, 'rgba(0,0,0,0)');
            vg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = vg;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
          }
        }
        ctx.globalAlpha = prevAlpha !== undefined ? prevAlpha : 1;
        return true;
      }

      const canXform = typeof ctx.save === 'function' && typeof ctx.translate === 'function' && typeof ctx.restore === 'function';
      if (canXform) {
        const gKey = `${gr}|${dark ? 1 : 0}|${toneKey}`;
        let grad = entry._gk === gKey ? entry._g : null;
        if (!grad) {
          grad = ctx.createRadialGradient(0, 0, 0, 0, 0, gr);
          const pal = RIM_PALETTES[toneKey] || RIM_PALETTES.default;
          const stops = dark ? pal.dark : pal.light;
          for (let i = 0; i < stops.length; i++) grad.addColorStop(stops[i][0], stops[i][1]);
          entry._g = grad;
          entry._gk = gKey;
        }
        ctx.save();
        ctx.globalAlpha = effAlpha;
        ctx.translate(gx, gy);
        strokeRoundedRectPath(ctx, strokeInset - gx, strokeInset - gy, rw, rh, rr);
        ctx.lineWidth = 1.45 * dpr;
        ctx.strokeStyle = grad;
        ctx.stroke();
        ctx.restore();
      } else {
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        const pal = RIM_PALETTES[toneKey] || RIM_PALETTES.default;
        const stops = dark ? pal.dark : pal.light;
        for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
        ctx.globalAlpha = effAlpha;
        strokeRoundedRectPath(ctx, strokeInset, strokeInset, rw, rh, rr);
        ctx.lineWidth = 1.45 * dpr;
        ctx.strokeStyle = g;
        ctx.stroke();
      }
      ctx.globalAlpha = prevAlpha !== undefined ? prevAlpha : 1;
      return true;
    }

    function ensurePrismBoxRo() {
      if (prismBoxRo || typeof ResizeObserver !== 'function') return prismBoxRo;
      prismBoxRo = new ResizeObserver(() => {
        prismBoxCacheDirty = true;
        if (
          !isDestroyed() &&
          !isWB() &&
          !isDragSuspended() &&
          !isRimMotionDisabled() &&
          readAmbientScale() > 0.001 &&
          lastPointerPos.x >= -1000 &&
          !prismRaf &&
          typeof requestAnimationFrame === 'function'
        ) {
          const hasVisibleGlow =
            cachedPrismBoxes.some((e) => !e.wasCleared) || Boolean(cachedOrchEntry && !cachedOrchEntry.wasCleared);
          if (hasVisibleGlow) {
            lastPrismDrawAt = 0;
            schedRaf();
          }
        }
      });
      return prismBoxRo;
    }

    function readBoxBorderRadius(el, fallbackPx) {
      if (!el || typeof getComputedStyle !== 'function') return fallbackPx;
      try {
        const v = parseFloat(getComputedStyle(el).borderTopLeftRadius || '');
        return Number.isFinite(v) && v >= 0 ? v : fallbackPx;
      } catch {
        return fallbackPx;
      }
    }

    function refreshPrismBoxRectCache(now, allowReadRect) {
      const boxes = document.querySelectorAll('[data-ag-cs-prism-box="1"]');
      const ro = ensurePrismBoxRo();
      const prevMap = new Map();
      for (let i = 0; i < cachedPrismBoxes.length; i++) {
        prevMap.set(cachedPrismBoxes[i].box, cachedPrismBoxes[i]);
      }
      const nextObserved = new Set();
      const next = [];
      const trackEl = getActiveCrystalTrack ? getActiveCrystalTrack() : null;
      let nextOrch = null;

      // Phase A: Batch all layout/style reads BEFORE DOM mutations to prevent forced write->read reflows!
      const boxList = Array.from(boxes || []);
      const preMeasured = boxList.map((box) => {
        const prev = prevMap.get(box);
        return {
          box,
          prev,
          borderRadius: prev && prev.borderRadius >= 0 ? prev.borderRadius : readBoxBorderRadius(box, 10),
          rect: allowReadRect && typeof box.getBoundingClientRect === 'function' ? box.getBoundingClientRect() : null,
        };
      });
      const orchRect =
        trackEl && allowReadRect && typeof trackEl.getBoundingClientRect === 'function'
          ? trackEl.getBoundingClientRect()
          : null;

      const mkEntry = (box, rect, prev, insetPad, borderRadius, mirrorMode = false, reflectBottomMode = false) => {
        nextObserved.add(box);
        if (ro && !observedPrismSet.has(box)) { try { ro.observe(box); observedPrismSet.add(box); } catch {} }
        const reusePrev = Boolean(prev?.cv?.isConnected);
        const rim = reusePrev ? prev : ensurePrismRimCanvas(box);
        return {
          box, rect, cv: rim ? rim.cv : null, ctx: rim ? rim.ctx : null, insetPad, mirrorMode, reflectBottomMode, borderRadius,
          wasCleared: prev ? prev.wasCleared : false,
          _s: prev?._s || '', _x: prev?._x ?? -9999, _y: prev?._y ?? -9999,
          _g: reusePrev ? (prev._g || null) : null, _gk: reusePrev ? (prev._gk || '') : '',
          pxStr: prev ? prev.pxStr : '', pyStr: prev ? prev.pyStr : '',
        };
      };

      // Phase B: Batch all DOM mutations (canvas mounts, ResizeObserver bindings, orphan prune) after reads!
      runGuardedMut(() => {
        for (let i = 0; i < preMeasured.length; i++) {
          const { box, prev, borderRadius, rect } = preMeasured[i];
          const mirrorMode = box.getAttribute?.('data-ag-cs-prism-mirror') === '1';
          const reflectBottomMode = !mirrorMode && box.getAttribute?.('data-ag-cs-prism-reflect') === 'bottom';
          next.push(mkEntry(box, rect, prev, mirrorMode ? 0 : 2, borderRadius, mirrorMode, reflectBottomMode));
        }
        if (trackEl) {
          const prevOrch = cachedOrchEntry?.box === trackEl ? cachedOrchEntry : null;
          nextOrch = mkEntry(trackEl, orchRect, prevOrch, 0, 999, false, false);
        }

        if (ro) {
          for (const oldEl of Array.from(observedPrismSet)) {
            if (!nextObserved.has(oldEl)) {
              try {
                ro.unobserve(oldEl);
              } catch {}
              observedPrismSet.delete(oldEl);
            }
          }
        }
        pruneOrphanRimCanvases();
      });

      cachedPrismBoxes = next;
      cachedOrchEntry = nextOrch;
      prismBoxCacheDirty = false;
      prismBoxCacheAt = now;
    }

    function flushPrismPointer(rafNow) {
      prismRaf = 0;
      if (isDestroyed()) return;
      if (isH()) return shrinkRims(1);
      if (isWB()) return;
      if (isDragSuspended()) {
        prismBoxCacheDirty = true;
        return;
      }
      const disabled = isRimMotionDisabled();
      const ambientScale = readAmbientScale();
      if (disabled || ambientScale <= 0.001) {
        runGuardedMut(() => { pruneOrphanRimCanvases(); clearAllRimCanvases(true); });
        return;
      }
      const now = typeof rafNow === 'number' && rafNow > 0 ? rafNow : performance.now();
      const minGap = Math.max(0, Number(getMinFrameGapMs?.() ?? 0) || 0);
      if (minGap > 0 && lastPrismDrawAt > 0 && now - lastPrismDrawAt < minGap) {
        schedRaf();
        return;
      }
      lastPrismDrawAt = now;
      const { x, y } = lastPointerPos;
      const allowReadRect = x >= -1000;

      const activeTrack = getActiveCrystalTrack ? getActiveCrystalTrack() : null;
      if (
        prismBoxCacheDirty ||
        cachedPrismBoxes.length === 0 ||
        (!prismBoxRo && now - prismBoxCacheAt > 2500) ||
        now - prismBoxCacheAt > 8000 ||
        activeTrack !== (cachedOrchEntry ? cachedOrchEntry.box : null) ||
        cachedPrismBoxes.some((e) => e.box.isConnected === false || e.borderRadius < 0 || (allowReadRect && !e.rect))
      ) {
        refreshPrismBoxRectCache(now, allowReadRect);
        lastPrismRectReadAt = now;
      } else if (allowReadRect && now - lastPrismRectReadAt >= (prismBoxRo ? 1500 : 250)) {
        lastPrismRectReadAt = now;
        for (let i = 0; i < cachedPrismBoxes.length; i++) {
          const b = cachedPrismBoxes[i].box;
          if (b && typeof b.getBoundingClientRect === 'function') cachedPrismBoxes[i].rect = b.getBoundingClientRect();
        }
        if (cachedOrchEntry && cachedOrchEntry.box && typeof cachedOrchEntry.box.getBoundingClientRect === 'function') {
          cachedOrchEntry.rect = cachedOrchEntry.box.getBoundingClientRect();
        }
      }

      const dark = isDarkTheme();
      const toneKey = resolveRimToneKey(dark);
      let compRim = null;
      const drawEntry = (entry, maxR, gradR, vx, vy, minW) => {
        const r = allowReadRect ? entry.rect : null;
        let inRange = false;
        let lx = -9999;
        let ly = -9999;
        if (r && r.width >= 4 && r.height >= 4 && (!minW || r.width >= minW)) {
          if (entry.reflectBottomMode) {
            if (x >= r.left - 240 && x <= r.right + 240 && y >= r.top - 80 && y <= r.bottom + 340) {
              inRange = true;
              lx = x - r.left;
              ly = y - r.top;
            }
          } else if (x >= r.left - maxR && x <= r.right + maxR && y >= r.top - maxR && y <= r.bottom + maxR) {
            inRange = true;
            lx = x - r.left;
            ly = y - r.top;
          }
        }
        if (!entry.mirrorMode && !entry.reflectBottomMode && entry.box?.classList?.contains?.('surface-composer-card')) {
          const st = inRange && Math.abs(ly) < 220 ? Math.min(1, ambientScale * (toneKey === 'mono' ? 0.62 : 1)) * (1 - Math.abs(ly) / 220) : 0;
          if (!compRim || st > compRim.strength) compRim = { localX: lx, strength: st, toneKey, dark };
        }
        if (entry.ctx && paintPrismRimCanvas(entry, inRange, lx, ly, gradR, dark, toneKey, ambientScale)) return;
        const nx = inRange ? `${lx.toFixed(1)}px` : '-9999px';
        const ny = inRange ? `${ly.toFixed(1)}px` : '-9999px';
        if (entry.pxStr !== nx) { entry.pxStr = nx; entry.box.style.setProperty(vx, nx); }
        if (entry.pyStr !== ny) { entry.pyStr = ny; entry.box.style.setProperty(vy, ny); }
      };
      runGuardedMut(() => {
        for (let i = 0; i < cachedPrismBoxes.length; i++) drawEntry(cachedPrismBoxes[i], 280, 240, '--ag-px', '--ag-py', 0);
        if (cachedOrchEntry) {
          drawEntry(cachedOrchEntry, 120, 96, '--orch-px', '--orch-py', 10);
          setCrystalPointerClient?.(x, y);
        }
      });
      emitComposerRim(compRim);
      armIdle();
    }

    function onPointerMove(ev) {
      if (isDestroyed() || isWB()) return;
      const x = Number(ev.clientX);
      const y = Number(ev.clientY);
      lastPointerPos.x = x;
      lastPointerPos.y = y;
      if (isDragSuspended()) {
        prismBoxCacheDirty = true;
        return;
      }
      const now = performance.now();
      if (!isRimMotionDisabled() && readAmbientScale() > 0.001 && !prismRaf && typeof requestAnimationFrame === 'function') {
        const far = (e, d) => {
          const r = e.rect;
          return (
            e.wasCleared &&
            r &&
            (r.width < 4 || r.height < 4 || x < r.left - d || x > r.right + d || y < r.top - d || y > r.bottom + d)
          );
        };
        const farIdle =
          !prismBoxCacheDirty &&
          cachedPrismBoxes.length > 0 &&
          now - prismBoxCacheAt <= 6000 &&
          now - lastPrismRectReadAt < 1500 &&
          cachedPrismBoxes.every((e) => far(e, 360)) &&
          (!cachedOrchEntry || far(cachedOrchEntry, 200));
        if (!farIdle) schedRaf();
      }
      onPointerActivity?.(now);
    }

    function cancelPendingRaf() {
      if (prismRaf) {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(prismRaf);
        prismRaf = 0;
      }
    }

    const schedRaf = () => {
      if (!prismRaf && typeof requestAnimationFrame === 'function') prismRaf = requestAnimationFrame(flushPrismPointer);
    };
    const onLeave = () => {
      if (isDestroyed() || isWB()) return;
      lastPointerPos.x = lastPointerPos.y = -9999;
      schedRaf();
    };
    const onVis = () => {
      if (isDestroyed()) return;
      if (isH()) { cancelPendingRaf(); shrinkRims(1); }
      else if (!isWB() && !isRimMotionDisabled() && readAmbientScale() > 0.001 && lastPointerPos.x >= -1000) {
        lastPrismDrawAt = 0;
        schedRaf();
      }
    };
    const onWinBlur = () => {
      if (isDestroyed()) return;
      cancelPendingRaf();
      clearAllRimCanvases();
    };
    const bindEv = (m) => {
      const d = getDoc();
      d?.[m]?.('visibilitychange', onVis);
      d?.documentElement?.[m]?.('pointerleave', onLeave);
      if (typeof window !== 'undefined') window?.[m]?.('blur', onWinBlur);
    };
    bindEv('addEventListener');

    function invalidateMetrics() {
      prismBoxCacheDirty = true;
      for (const e of cachedPrismBoxes) e.borderRadius = -1;
      if (isDestroyed()) return;
      runGuardedMut(() => {
        pruneOrphanRimCanvases();
        if (isH()) { cancelPendingRaf(); shrinkRims(1); }
        else if (isRimMotionDisabled() || readAmbientScale() <= 0.001) { cancelPendingRaf(); clearAllRimCanvases(true); }
        else if (!isWB() && !isDragSuspended() && lastPointerPos.x >= -1000) { lastPrismDrawAt = 0; schedRaf(); }
      });
    }

    function markDirty() {
      prismBoxCacheDirty = true;
      if (isDestroyed()) return;
      runGuardedMut(() => {
        pruneOrphanRimCanvases(false);
        if (isRimMotionDisabled() || readAmbientScale() <= 0.001) { cancelPendingRaf(); clearAllRimCanvases(true); }
      });
    }

    function teardownDynPointerRules() {
      cancelPendingRaf();
      emitComposerRim(null);
      bindEv('removeEventListener');
      shrinkRims(1);
      trackedRimCanvases.clear();
      if (prismBoxRo) { try { prismBoxRo.disconnect(); } catch {} prismBoxRo = null; }
      observedPrismSet.clear();
      const d = getDoc();
      if (d) {
        d.getElementById?.('ag-prism-dyn-vars')?.remove?.();
        d.querySelectorAll?.('.ag-cs-prism-rim-cv')?.forEach?.((n) => n.remove?.());
        d.querySelectorAll?.('[data-ag-cs-prism-cv]')?.forEach?.((el) => el.removeAttribute?.('data-ag-cs-prism-cv'));
      }
      cachedPrismBoxes = [];
      cachedOrchEntry = null;
    }

    return {
      onPointerMove,
      cancelPendingRaf,
      teardown: teardownDynPointerRules,
      markDirty,
      invalidateMetrics,
      getLastPointerPos: () => lastPointerPos,
    };
  }

  const api = { createPrismRimCanvasController };
  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__agPrismRimCanvas = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
