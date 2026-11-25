// Obsidian Prism — Channel 8 Multi-Cat Sanctuary Client Runtime
// Extracted from dual-mascot-rig.js to keep Channel 1 well below bundle budget.
// - Unified px: 1.5 Retina-aligned pixel grid (0 mixels, 3x3 device px @ 2x DPR)
// - Dark-theme crisp 1px outer cool-lavender silhouette halo (0 blur)
// - Timer-driven (~32ms active / 160ms calm / 900ms nap / 0Hz blurred, hidden, or peek)
// - Full VRAM 0x0 reclamation across all cat, prop, cushion-rim, and yarn canvases
// - Proportional prop layout, responsive width tiers, collision avoidance & cushion tuck-in
// - 13-signal semantic awareness + window.__agPrismCatRimState top-edge shimmer bridge

(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
  if (!G) return;

  const PX = 1.5;
  const GRID_COLS = 22;
  const PAD_X = 1; // 1-cell horizontal padding per side for crisp dark-theme outer halo
  const HEADROOM_ROWS = 8; // 8 rows above 16-row sprite for floating symbols
  const TOTAL_COLS = GRID_COLS + PAD_X * 2; // 24
  const TOTAL_ROWS = 16 + HEADROOM_ROWS; // 24 -> 36x36 CSS px at px=1.5
  const IDLE_NAP_AFTER_MS = 30000;
  const DARK_HALO_COLOR = 'rgba(216, 212, 248, 0.44)';

  const CHIBI_CAT_POSES = Object.fromEntries(
    Object.entries({
      standA: '3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O6.3O..|.O3#s#s3#O4.O#s#O.|.O##o##o##o#O3.O3#O.|O##p##o#o##p4O.O#sO.|O11#s#s#O##O..|O11#s#s#O#sO..|O15#O##O..|O16#OO3.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w##w3#w##w#O5.|..OwOOw5OwOOwO5.|..OO..OO3.OO..OO5.',
      standB: '3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O11.|.O3#s#s3#O5.3O..|.O##o##o##o#O3.O#s#O.|O##p##o#o##p5O3#O.|O11#s#s#O#sO..|O11#s#s#O##O..|O16#sO3.|O16#O4.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w##w3#w##w#O5.|..OwOOw5OwOOwO5.|..OO..OO3.OO..OO5.',
      blink: '3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O6.3O..|.O3#s#s3#O4.O#s#O.|.O#oo##o##ooO3.O3#O.|O##p##o#o##p4O.O#sO.|O11#s#s#O##O..|O11#s#s#O#sO..|O15#O##O..|O16#OO3.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w##w3#w##w#O5.|..OwOOw5OwOOwO5.|..OO..OO3.OO..OO5.',
      earL: '9.O12.|..OO4.O#O11.|.O##5Os#O5.3O..|.O3#s#s3#O4.O#s#O.|.O##o##o##o#O3.O3#O.|O##p##o#o##p4O.O#sO.|O11#s#s#O##O..|O11#s#s#O#sO..|O15#O##O..|O16#OO3.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w##w3#w##w#O5.|..OwOOw5OwOOwO5.|..OO..OO3.OO..OO5.',
      happy: '3.O5.O12.|..O#O3.O#O6.3O..|..O#s3Os#O5.O#s#O.|.O3#s#s3#O4.O3#O.|.O##o5#o#O3.O#sO..|O##o#o3#o#o5O##O..|O#p4#o4#ps#sO#sO..|O5#o#o3#s#s#O##O..|O16#OO3.|O16#O4.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w##w3#w##w#O5.|..OwOOw5OwOOwO5.|..OO..OO3.OO..OO5.',
      sitA: '4.O5.O11.|3.O#O3.O#O10.|3.O#s3Os#O10.|..O3#s#s3#O9.|..O##o##o##o#O8.|.O##p##o#o##p#O7.|.O13#O..3O.|O12#s#O.O#s#O|O4#7b##sO.O3#O|O3#9b##O.O#sO.|O3#9b##OO##O..|O3#9b3#O#sO..|O3#bbw3#wbb4#OO3.|.O##O#w3Ow#O4#O4.|.O##O#w3Ow#O4#O4.|..15O5.',
      sitB: '4.O5.O11.|3.O#O3.O#O10.|3.O#s3Os#O10.|..O3#s#s3#O9.|..O##o##o##o#O8.|.O##p##o#o##p#O7.|.O13#O6.|O12#s#O..3O.|O4#7b##sO.O#s#O|O3#9b##O.O3#O|O3#9b##O.O#sO.|O3#9b3#OO#O..|O3#bbw3#wbb4#OO3.|.O##O#w3Ow#O4#O4.|.O##O#w3Ow#O4#O4.|..15O5.',
      wave1: '4.O5.O11.|3.O#O3.O#O10.|3.O#s3Os#O10.|..O3#s#s3#O9.|..O##o##o##o#O8.|.O##p##o#o##p#O7.|.O13#O..3O.|.O11#s#O.O#s#O|.OO##7b##sO.O3#O|Oww##8b##O.O#sO.|OwwO#8b##OO##O..|.OO.#8b3#O#sO..|.O3#bb3#wbb4#OO3.|..O5#OOw#O4#O4.|..O6#Ow#O4#O4.|3.14O5.',
      wave2: '4.O5.O11.|3.O#O3.O#O10.|3.O#s3Os#O10.|..O3#s#s3#O9.|..O##o##o##o#O8.|.O##p##o#o##p#O7.|.O13#O6.|OO11#s#O..3O.|Oww##7b##sO.O#s#O|OwwO#8b##O.O3#O|.OO.#8b##O.O#sO.|O3#9b3#OO#O..|.O3#bb3#wbb4#OO3.|..O5#OOw#O4#O4.|..O6#Ow#O4#O4.|3.14O5.',
      groom1: '4.O5.O11.|3.O#O3.O#O10.|3.O#s3Os#O10.|..O3#s#s3#O9.|..O#oo##o##ooO8.|.O##p##o#o##p#O7.|.O13#O6.|.OO10#s#O..3O.|OwwO#7b##sO.O#s#O|Oww##8b##O.O3#O|.OO##8b##O.O#sO.|O3#9b3#OO#O..|.O3#bb3#wbb4#OO3.|..O5#OOw#O4#O4.|..O6#Ow#O4#O4.|3.14O5.',
      groom2: '4.O5.O11.|3.O#O3.O#O10.|3.O#s3Os#O10.|..O3#s#s3#O9.|..O#oo##o##ooO8.|.O##p##o#o##p#O7.|.OO12#O..3O.|OwwO9#s#O.O#s#O|Oww##7b##sO.O3#O|.OO##8b##O.O#sO.|O3#9b##OO##O..|O3#9b3#O#sO..|.O3#bb3#wbb4#OO3.|..O5#OOw#O4#O4.|..O6#Ow#O4#O4.|3.14O5.',
      walk1: '22.|3.O5.O12.|..O#O3.O#O6.3O..|..O#s3Os#O5.O#s#O.|.O3#s#s3#O4.O3#O.|.O##o##o##o#O3.O#sO..|O##p##o#o##p5O##O..|O11#s#s#O#sO..|O11#s#s#O##O..|O16#OO3.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w##w3#w##w#O5.|.OwO.Ow5OwO.OwO4.|.OO..OO4.OO..OO5.',
      walk2: '3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O6.3O..|.O3#s#s3#O4.O#s#O.|.O##o##o##o#O3.O3#O.|O##p##o#o##p4O.O#sO.|O11#s#s#O##O..|O11#s#s#O#sO..|O15#O##O..|O16#OO3.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|.OwO#w6#w#OwO5.|.OO.Ow6OwO.OO5.|4.OO6.OO8.',
      walk3: '22.|3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O7.3O.|.O3#s#s3#O5.O#s#O|.O##o##o##o#O4.O3#O|O##p##o#o##p4O.O#sO.|O11#s#s#O##O..|O11#s#s#O#sO..|O16#OO3.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w##w3#w##w#O5.|3.OwOOw4OwOOwO5.|3.OO..OO..OO..OO5.',
      walk4: '3.O5.O12.|..O#O3.O#O6.3O..|..O#s3Os#O5.O#s#O.|.O3#s#s3#O4.O3#O.|.O##o##o##o#O3.O#sO..|O##p##o#o##p5O##O..|O11#s#s#O#sO..|O11#s#s#O##O..|O15#O##O..|O16#OO3.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w#OwO#OwO#w#O5.|..OwOO.OO.OO.OwO6.|..OO9.OO7.',
      eat1: '22.|22.|16.3O3.|15.O#s#O..|15.O3#O..|4.O4.O4.O##sO3.|3.O#O..O#5O3#O3.|..O##sOOs##s#s3#O4.|.O9#s#s3#O4.|.O#oo##o9#O4.|O##p##o#o#6b#O4.|O8#7b#O4.|.O6#8b#O4.|..O#w##w3#w##w#O5.|..OwOOw5OwOOwO5.|..OO..OO3.OO..OO5.',
      eat2: '22.|22.|17.3O..|16.O#s#O.|16.O3#O.|15.O##sO..|4.O4.O4.O3#O3.|3.O#O..O#4O3#O4.|..O##sOOs##s#s3#O4.|.O9#s#s3#O4.|.O#oo##o9#O4.|O##p##o#o#6b#O4.|.O6#8b#O4.|..O#w##w3#w##w#O5.|..OwOOw5OwOOwO5.|..OO..OO3.OO..OO5.',
      sleep1: '22.|22.|22.|22.|22.|3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O11.|.O3#s#s3#4O7.|.O#oo##o##oo#s#OO5.|O##p##o#o##p#s3#O4.|O16#O.OO.|O3#12b#OO#sO|O3#12b#O##O.|.O##12b#OO3.|..16O4.',
      sleep2: '22.|22.|22.|22.|22.|3.O5.O12.|..O#O3.O#O11.|..O#s3Os#4O8.|.O3#s#s5#s#OO5.|.O#oo##o##oo##s##O4.|O##p##o#o##p5#O4.|O16#O.OO.|O3#12b#OO#sO|O3#12b#O##O.|.O##12b#OO3.|..16O4.',
      stretch: '22.|16.3O3.|15.O#s#O..|15.O3#O..|14.O##sO3.|13.O3#O4.|3.O5.O..O##s#O4.|..O#O3.O#OO3#s#O4.|..O#s3Os#O6#O4.|.O3#s#s9#O4.|.O##o##o##o6#O4.|O##p##o#o##p5#O4.|.O3#8b4#O4.|.OO##6b##OO##O4.|O3wO6#OO..OwO4.|5O..4O4.OO5.',
      pounce: '3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O6.3O..|.O3#s#s3#O4.O#s#O.|.O##o##o##o#O..O3#O..|O##p##o#o##p4O#sO3.|O11#s#s3#O3.|O11#s#s##O4.|.O##8b4#O5.|.OO#8b3#O6.|OwwO8#O#O7.|.OO..7O.OwO6.|14.OO6.|22.|22.|22.',
      dangle: '3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O11.|.O3#s#s3#O10.|.O#oo##o##ooO9.|O##p##o#o##p#O8.|O12#O8.|.O#O#4b#O#O9.|.OwO#4b#OwO9.|..O##4b##O..3O5.|..O##4b##OO#s#O5.|..O8#O3#O6.|3.O#O..O#OO#sO7.|3.OwO..OwO.OO8.|3.OO3.OO12.|22.',
    }).map(([k, v]) => [k, v.replace(/(\d+)(.)/g, (_, n, ch) => ch.repeat(+n)).split('|')])
  );

  // Ordered so catCount 1->[pusheen], 2->[pusheen,ginger], 3->[pusheen,ginger,calico], 4->all
  // Initial xPct slots sit cleanly between proportional prop anchors (bowl 0.04, plant 0.21, cushion 0.72, post 0.94)
  const CAT_PRESETS = [
    { id: 'pusheen', px: PX, xPct: 0.54, hue: 0.72, speed: 0.34, mood: 'cozy', coat: 'tabby', pal: { O: '#2D2936', '#': '#A4A6B0', s: '#6E707D', b: '#BCBEC8', o: '#1E1B24', p: '#F9A8C9', w: '#D6D8E2' } },
    { id: 'ginger', px: PX, xPct: 0.12, hue: 0.09, speed: 0.54, mood: 'playful', coat: 'tabby', pal: { O: '#3D2A1F', '#': '#F7B977', s: '#D67D38', b: '#FFF3E4', o: '#2A1C14', p: '#FF96B0', w: '#FFF9F0' } },
    { id: 'calico', px: PX, xPct: 0.36, hue: 0.94, speed: 0.44, mood: 'sweet', coat: 'calico', pal: { O: '#3A2E32', '#': '#FFF8F0', s: '#F3A261', b: '#FFF8F0', o: '#282024', p: '#FF9EBB', w: '#FFFDF9', c2: '#7A6368' } },
    { id: 'ragdoll', px: PX, xPct: 0.85, hue: 0.56, speed: 0.38, mood: 'calm', coat: 'ragdoll', pal: { O: '#2C3144', '#': '#F5F6FA', s: '#68738C', b: '#EAEFF7', o: '#1F2333', p: '#F9A8C9', w: '#FFFFFF' } },
  ];

  const SANCTUARY_SYMS = {
    heart: ['.p.p.', 'ppppp', '.ppp.', '..p..'],
    hearts2: ['.p.p...p.', 'pppp..ppp', '.pp....p.'],
    z1: ['ooo', '.o.', 'ooo'],
    z2: ['oooo', '..o.', '.o..', 'oooo'],
    spark: ['..y..', '..y..', 'yywyy', '..y..', '..y..'],
    note: ['..bb', '..b.', 'bbb.', 'bb..'],
    think: ['i..i..i'],
    q: ['.ii.', 'i..i', '..i.', '....', '..i.'],
    alert: ['.r.', '.r.', '.r.', '...', '.r.'],
    sweat: ['.b.', 'bwb', 'bbb', '.b.'],
  };

  const YARN_SPRITE = [
    '..OOO..',
    '.OrrrO.',
    'OrprprO',
    'OrrprrO',
    'OprrrpO',
    '.OrrrO.',
    '..OOO..',
  ];

  // Unified px: 1.5 proportional props (cushion widened to 30 cols = 45px with front-rim tuck layer)
  const SHELF_PROPS = [
    {
      id: 'bowl',
      pct: 0.04,
      compactVisible: true,
      px: PX,
      pal: { O: '#2D3040', b: '#7DD3FC', d: '#38BDF8', w: '#F8FAFC', k: '#E8A860', f: '#C9853E' },
      rows: [
        '...OOOOOOOO...',
        '..OkfkkffkkO..',
        '.OOOOOOOOOOOO.',
        'ObbbbwwbbbbbbO',
        '.OddddddddddO.',
        '..OOOOOOOOOO..',
      ],
    },
    {
      id: 'plant',
      pct: 0.21,
      compactVisible: false,
      px: PX,
      pal: { O: '#352A26', g: '#34D399', l: '#6EE7B7', p: '#F9A8C9', c: '#E5926E', s: '#C67350' },
      rows: [
        '....OO.....',
        '...OppO..O.',
        '.O..OO..OlO',
        'OlO.OgO.OgO',
        '.OgOOgOOgO.',
        '..OglglgO..',
        '.OOOOOOOOO.',
        '.OccccccccO',
        '..OcsssssO.',
        '...OOOOOO..',
      ],
    },
    {
      id: 'cushion',
      pct: 0.72,
      compactVisible: false,
      px: PX,
      pal: { O: '#352E45', c: '#DDD6FE', l: '#EDE9FE', s: '#C4B5FD' },
      rows: [
        '..OOOO..................OOOO..',
        '.OllllOOOOOOOOOOOOOOOOOOllllO.',
        'OllccccccccccccccccccccccccllO',
        'OlcccsccccccssccccccsscccccllO',
        'OlcccccccccccccccccccccccccssO',
        'OcccssccccccssccccccssccccccsO',
        '.OssssssssssssssssssssssssssO.',
        '..OOOOOOOOOOOOOOOOOOOOOOOOOO..',
      ],
      frontRows: [
        'Oll........................llO',
        'OlccssccccccssccccccsscccccssO',
        '.OssssssssssssssssssssssssssO.',
        '..OOOOOOOOOOOOOOOOOOOOOOOOOO..',
      ],
    },
    {
      id: 'post',
      pct: 0.94,
      compactVisible: true,
      px: PX,
      pal: { O: '#362C25', w: '#E9C89B', s: '#CFA674', d: '#B48858', p: '#F9A8C9', h: '#FBCFE8' },
      rows: [
        '..OOOOOOOOO..',
        '.OwwwwwwwwwO.',
        '..OOOOOOOOO..',
        '....OwwwO.O..',
        '....OsssO.O..',
        '....OwwwOOphO',
        '....OsssOOppO',
        '....OwwwO.OO.',
        '....OsssO....',
        '....OwwwO....',
        '....OsssO....',
        '..OOOOOOOOO..',
        '.OdddddddddO.',
        '..OOOOOOOOO..',
      ],
    },
  ];

  function createCatSanctuary(ctx) {
    if (!ctx || !ctx.hostEl) return null;
    const {
      hostEl,
      doc = hostEl.ownerDocument,
      win = (doc && doc.defaultView) || (typeof window !== 'undefined' ? window : G),
      markNoTrOwned = (el) => el,
      readStageWidth = () => hostEl.clientWidth || 720,
      readDpr = () => Math.min((win && win.devicePixelRatio) || 1, 2),
      isVramSleepState = () => false,
      isWindowBlurred = () => Boolean(doc && doc.hidden),
      getReducedMotion = () => false,
      getStreaming = () => false,
      getIsThinking = () => false,
      getHasError = () => false,
      getPeekHidden = () => false,
      getConfig = () => ({}),
      onDragStateChange = () => {},
      registerDragRelease = () => () => {},
    } = ctx;

    const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    const wrap = markNoTrOwned(doc.createElement('div'));
    wrap.className = 'ag-v2-cat-sanctuary';
    hostEl.appendChild(wrap);

    let disposed = false;
    let running = false;
    let pausedPower = false;
    let peekHidden = Boolean(getPeekHidden());
    let streaming = Boolean(getStreaming());
    let thinking = Boolean(getIsThinking());
    let hasError = Boolean(getHasError());
    let focusNap = false;
    let vramReclaimed = false;

    const readCfg = () => {
      const c = getConfig() || {};
      return {
        catCount: c.catCount === '1' || c.catCount === '2' ? c.catCount : '4',
        catProps: c.catProps === 'off' ? 'off' : 'on',
        catQuietMode: c.catQuietMode === 'nap' ? 'nap' : 'auto',
      };
    };
    let sCfg = readCfg();

    const isDarkThemeNow = () => {
      const rootEl = doc && doc.documentElement;
      const attr = rootEl && typeof rootEl.getAttribute === 'function' ? rootEl.getAttribute('data-ag-cs-theme') : '';
      if (attr === 'light') return false;
      if (attr === 'dark') return true;
      const bodyCl = doc && doc.body && doc.body.classList;
      if (bodyCl && (bodyCl.contains('theme-light') || bodyCl.contains('light-theme') || bodyCl.contains('light'))) return false;
      return true;
    };

    const drawCrispGrid = (c2, rows, p, curDpr, xOffGrid, yOffGrid, colorOf, flipX, cwPhys, darkHalo) => {
      const step = p * curDpr;
      const rCount = rows.length;
      const cCount = rCount > 0 ? rows[0].length : 0;

      if (darkHalo) {
        c2.fillStyle = darkHalo;
        const hasPx = (gx, gy) => {
          if (gy < 0 || gy >= rCount || gx < 0 || gx >= cCount) return false;
          const ch = rows[gy][gx];
          return Boolean(ch && ch !== '.' && colorOf(ch, gx, gy));
        };
        for (let gy = -1; gy <= rCount; gy++) {
          const y0 = Math.round((yOffGrid + gy) * step);
          const y1 = Math.round((yOffGrid + gy + 1) * step);
          const rh = y1 - y0;
          if (rh <= 0) continue;
          for (let gx = -1; gx <= cCount; gx++) {
            if (hasPx(gx, gy)) continue;
            if (!hasPx(gx - 1, gy) && !hasPx(gx + 1, gy) && !hasPx(gx, gy - 1) && !hasPx(gx, gy + 1)) continue;
            const lx0 = Math.round((xOffGrid + gx) * step);
            const lx1 = Math.round((xOffGrid + gx + 1) * step);
            const rw = lx1 - lx0;
            if (rw <= 0) continue;
            c2.fillRect(flipX ? cwPhys - lx1 : lx0, y0, rw, rh);
          }
        }
      }

      for (let gy = 0; gy < rCount; gy++) {
        const r = rows[gy];
        const y0 = Math.round((yOffGrid + gy) * step);
        const y1 = Math.round((yOffGrid + gy + 1) * step);
        const rh = y1 - y0;
        if (rh <= 0) continue;
        for (let gx = 0; gx < r.length; gx++) {
          const col = colorOf(r[gx], gx, gy);
          if (!col) continue;
          const lx0 = Math.round((xOffGrid + gx) * step);
          const lx1 = Math.round((xOffGrid + gx + 1) * step);
          const rw = lx1 - lx0;
          if (rw <= 0) continue;
          c2.fillStyle = col;
          c2.fillRect(flipX ? cwPhys - lx1 : lx0, y0, rw, rh);
        }
      }
    };

    const publishRimState = (activeNow, sw, now) => {
      if (!win) return;
      if (!activeNow) {
        if (win.__agPrismCatRimState && win.__agPrismCatRimState.active) {
          win.__agPrismCatRimState = { active: false, ts: now || nowMs(), cats: [] };
          if (typeof win.__agPrismNotifyCatRim === 'function') {
            try { win.__agPrismNotifyCatRim(); } catch (_) {}
          }
        }
        return;
      }
      const list = [];
      const w = Math.max(220, sw || 720);
      for (let i = 0; i < cats.length; i++) {
        const c = cats[i];
        if (!c.visible) continue;
        list.push({
          nx: Math.max(0.02, Math.min(0.98, (c.x + c.cw * 0.5) / w)),
          hue: c.hue,
          moving: c.state === 'walk' || c.dragging || c.vy !== 0,
        });
      }
      win.__agPrismCatRimState = { active: list.length > 0, ts: now || nowMs(), cats: list };
      if (typeof win.__agPrismNotifyCatRim === 'function') {
        try { win.__agPrismNotifyCatRim(); } catch (_) {}
      }
    };

    let lastInteractionAt = nowMs();
    let lastPlantClickAt = 0;
    const markUserInteraction = (now) => {
      lastInteractionAt = typeof now === 'number' ? now : nowMs();
    };

    const propById = {};
    const propNodes = SHELF_PROPS.map((sp) => {
      const cv = markNoTrOwned(doc.createElement('canvas'));
      cv.className = 'ag-v2-cat-pet';
      cv.setAttribute('data-shelf-prop', sp.id);
      cv.setAttribute('aria-hidden', 'true');
      const cols = sp.rows[0].length;
      const rowsLen = sp.rows.length;
      const cw = Math.round((cols + 2) * sp.px);
      const ch = Math.round((rowsLen + 1) * sp.px);
      cv.style.width = `${cw}px`;
      cv.style.height = `${ch}px`;
      cv.style.zIndex = '1';
      cv.style.cursor = 'pointer';
      wrap.appendChild(cv);

      let frontCv = null;
      let frontCtx = null;
      let frontCh = 0;
      if (sp.frontRows) {
        frontCv = markNoTrOwned(doc.createElement('canvas'));
        frontCv.className = 'ag-v2-cat-pet';
        frontCv.setAttribute('data-shelf-prop', sp.id + '-front');
        frontCv.setAttribute('aria-hidden', 'true');
        frontCh = Math.round((sp.frontRows.length + 1) * sp.px);
        frontCv.style.width = `${cw}px`;
        frontCv.style.height = `${frontCh}px`;
        frontCv.style.zIndex = '3';
        frontCv.style.pointerEvents = 'none';
        wrap.appendChild(frontCv);
        frontCtx = typeof frontCv.getContext === 'function' ? frontCv.getContext('2d') : null;
      }

      const node = {
        ...sp,
        cv,
        ctx: typeof cv.getContext === 'function' ? cv.getContext('2d') : null,
        frontCv,
        frontCtx,
        frontCh,
        cw,
        ch,
        x: 24,
        visible: true,
        drawnKey: '',
      };
      propById[sp.id] = node;

      const onPropClick = (ev) => {
        if (peekHidden || disposed || !node.visible) return;
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        const now = nowMs();
        markUserInteraction(now);
        if (sp.id === 'post') {
          focusNap = false;
          spawnYarn(node.x, now);
          return;
        }
        if (sp.id === 'plant') {
          if (now - lastPlantClickAt < 420) {
            lastPlantClickAt = 0;
            focusNap = !focusNap;
            applyFocusNapState(now);
            return;
          }
          lastPlantClickAt = now;
        }
        focusNap = false;
        let best = null;
        let bestD = Infinity;
        for (const c of cats) {
          if (!c.visible || c.dragging) continue;
          const d = Math.abs(c.x + c.cw * 0.5 - (node.x + node.cw * 0.5));
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        if (best) {
          sendCatToProp(best, sp.id, now, true);
          paintCat(best, now);
          scheduleNext(true);
        }
      };
      cv.addEventListener('pointerdown', onPropClick);
      node.cleanup = () => cv.removeEventListener('pointerdown', onPropClick);
      return node;
    });

    let lastPropsSw = 0;
    let lastPropsKey = '';
    const computePropX = (pr, sw) => {
      const minX = 18;
      const maxX = Math.max(minX + 4, sw - minX - pr.cw);
      if (pr.id === 'bowl') return Math.min(maxX, Math.max(minX, Math.round(sw * pr.pct)));
      if (pr.id === 'post') return Math.max(minX, Math.min(maxX, Math.round(sw * pr.pct - pr.cw * 0.5)));
      return Math.max(minX, Math.min(maxX, Math.round(sw * pr.pct - pr.cw * 0.5)));
    };

    const drawProps = (sw, force = false) => {
      const curDpr = Math.max(1, Math.min(2, readDpr() || 1));
      const dark = isDarkThemeNow();
      const propsKey = `${sw}:${curDpr}:${dark ? 1 : 0}:${sCfg.catProps}:${sw < 420 ? 1 : 0}`;
      if (!force && sw === lastPropsSw && propsKey === lastPropsKey) return;
      lastPropsSw = sw;
      lastPropsKey = propsKey;

      const propsEnabled = sCfg.catProps !== 'off';
      const compact = sw < 420;
      const halo = dark ? DARK_HALO_COLOR : null;

      for (const pr of propNodes) {
        const show = propsEnabled && (!compact || pr.compactVisible);
        pr.visible = show;
        pr.cv.style.display = show ? '' : 'none';
        if (pr.frontCv) pr.frontCv.style.display = show ? '' : 'none';
        if (!show) continue;

        pr.x = computePropX(pr, sw);
        const tx = `translate3d(${Math.round(pr.x)}px,0px,0)`;
        if (pr.cv.style.transform !== tx) pr.cv.style.transform = tx;
        if (pr.frontCv && pr.frontCv.style.transform !== tx) pr.frontCv.style.transform = tx;

        const dKey = `${curDpr}:${dark ? 1 : 0}`;
        if (pr.ctx && (force || pr.drawnKey !== dKey || pr.cv.width === 0)) {
          pr.drawnKey = dKey;
          const pw = Math.round((pr.rows[0].length + 2) * pr.px * curDpr);
          const ph = Math.round((pr.rows.length + 1) * pr.px * curDpr);
          pr.cv.width = pw;
          pr.cv.height = ph;
          pr.ctx.setTransform(1, 0, 0, 1, 0, 0);
          pr.ctx.clearRect(0, 0, pw, ph);
          pr.ctx.imageSmoothingEnabled = false;
          drawCrispGrid(pr.ctx, pr.rows, pr.px, curDpr, 1, 1, (ch) => (ch === '.' ? null : pr.pal[ch]), false, pw, halo);

          if (pr.frontCv && pr.frontCtx && pr.frontRows) {
            const fph = Math.round((pr.frontRows.length + 1) * pr.px * curDpr);
            pr.frontCv.width = pw;
            pr.frontCv.height = fph;
            pr.frontCtx.setTransform(1, 0, 0, 1, 0, 0);
            pr.frontCtx.clearRect(0, 0, pw, fph);
            pr.frontCtx.imageSmoothingEnabled = false;
            drawCrispGrid(pr.frontCtx, pr.frontRows, pr.px, curDpr, 1, 1, (ch) => (ch === '.' ? null : pr.pal[ch]), false, pw, null);
          }
        }
      }
    };

    // Shared interactive pixel yarn ball (unified px: 1.5 -> 7*1.5 = 11px + 1-cell halo = 14px)
    const yarnCv = markNoTrOwned(doc.createElement('canvas'));
    yarnCv.className = 'ag-v2-cat-pet';
    yarnCv.setAttribute('aria-hidden', 'true');
    const yarnSize = Math.round((YARN_SPRITE[0].length + 2) * PX); // 14px
    yarnCv.style.width = `${yarnSize}px`;
    yarnCv.style.height = `${yarnSize}px`;
    yarnCv.style.zIndex = '5';
    yarnCv.style.display = 'none';
    yarnCv.style.pointerEvents = 'none';
    wrap.appendChild(yarnCv);
    const yarn = {
      cv: yarnCv,
      ctx: typeof yarnCv.getContext === 'function' ? yarnCv.getContext('2d') : null,
      active: false,
      x: 120,
      y: 0,
      vx: 0,
      vy: 0,
      until: 0,
      drawnKey: '',
    };
    const drawYarn = () => {
      if (!yarn.ctx) return;
      const curDpr = Math.max(1, Math.min(2, readDpr() || 1));
      const dark = isDarkThemeNow();
      const dKey = `${curDpr}:${dark ? 1 : 0}`;
      const pw = Math.round(yarnSize * curDpr);
      if (yarn.cv.width !== pw || yarn.drawnKey !== dKey) {
        yarn.drawnKey = dKey;
        yarn.cv.width = pw;
        yarn.cv.height = pw;
        yarn.ctx.setTransform(1, 0, 0, 1, 0, 0);
        yarn.ctx.clearRect(0, 0, pw, pw);
        yarn.ctx.imageSmoothingEnabled = false;
        drawCrispGrid(
          yarn.ctx,
          YARN_SPRITE,
          PX,
          curDpr,
          1,
          1,
          (ch) => (ch === '.' ? null : ch === 'O' ? '#2D1D28' : ch === 'p' ? '#FBCFE8' : '#F472B6'),
          false,
          pw,
          dark ? DARK_HALO_COLOR : null
        );
      }
      yarn.cv.style.transform = `translate3d(${Math.round(yarn.x)}px,${Math.round(yarn.y)}px,0)`;
    };
    const spawnYarn = (originX, now) => {
      const sw = Math.max(220, readStageWidth());
      yarn.active = true;
      yarn.x = Math.max(24, Math.min(sw - 38, originX));
      yarn.y = -8;
      yarn.vx = (originX > sw * 0.5 ? -1 : 1) * (3.4 + Math.random() * 1.6);
      yarn.vy = -3.8;
      yarn.until = now + 8000;
      yarn.cv.style.display = '';
      drawYarn();
      scheduleNext(true);
    };

    const ptr = { active: false, clientX: 0, clientY: 0, lastAt: 0 };
    let cachedStageRect = null;
    let stageRectAt = 0;
    const onGlobalMove = (ev) => {
      ptr.active = true;
      ptr.clientX = ev.clientX || 0;
      ptr.clientY = ev.clientY || 0;
      ptr.lastAt = nowMs();
    };
    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('pointermove', onGlobalMove, { passive: true });
    }

    const setSym = (c, sym, now, dur) => {
      c.sym = sym;
      c.symBornAt = now;
      c.symUntil = now + dur;
    };

    const notifyDragState = () => {
      let any = false;
      for (const c of cats) {
        if (c.dragging) {
          any = true;
          break;
        }
      }
      try { onDragStateChange(any); } catch (_) {}
    };

    const cats = CAT_PRESETS.map((pr, idx) => {
      const cv = markNoTrOwned(doc.createElement('canvas'));
      cv.className = 'ag-v2-cat-pet';
      cv.setAttribute('data-cat-id', pr.id);
      cv.setAttribute('aria-hidden', 'true'); // Never place tabindex="0" inside aria-hidden parent
      const cw = Math.round(TOTAL_COLS * pr.px); // 36px
      const ch = Math.round(TOTAL_ROWS * pr.px); // 36px
      cv.style.width = `${cw}px`;
      cv.style.height = `${ch}px`;
      cv.style.zIndex = '4';
      wrap.appendChild(cv);
      const now0 = nowMs();
      const c = {
        ...pr,
        idx,
        cv,
        ctx: typeof cv.getContext === 'function' ? cv.getContext('2d') : null,
        cw,
        ch,
        x: 40 + idx * 96,
        y: 0,
        vy: 0,
        dir: idx % 2 === 0 ? -1 : 1,
        state: idx === 0 ? 'stand' : idx === 1 ? 'sit' : idx === 2 ? 'groom' : 'sit',
        until: now0 + 2600 + idx * 1100,
        targetX: null,
        targetProp: null,
        atProp: null,
        blinkUntil: 0,
        nextBlink: now0 + 1400 + idx * 700,
        twitchUntil: 0,
        nextTwitch: now0 + 3000 + idx * 1200,
        sym: null,
        symBornAt: 0,
        symUntil: 0,
        petCount: 0,
        lastPetAt: 0,
        gazeDx: 0,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragMoved: false,
        cancelDrag: null,
        visible: true,
        lastSig: '',
        lastTx: '',
        lastZ: '4',
        placed: false,
      };

      const readLocalY = (ev) => {
        if (ev && typeof ev.offsetY === 'number' && Number.isFinite(ev.offsetY)) return ev.offsetY;
        if (ev && typeof ev.clientY === 'number' && typeof cv.getBoundingClientRect === 'function') {
          const r = cv.getBoundingClientRect();
          if (r && r.height > 0) return ev.clientY - r.top;
        }
        return HEADROOM_ROWS * c.px;
      };

      const onHoverMove = (ev) => {
        if (peekHidden || c.dragging) return;
        const hitBody = readLocalY(ev) >= HEADROOM_ROWS * c.px;
        const nextCur = hitBody ? 'grab' : 'default';
        if (cv.style.cursor !== nextCur) cv.style.cursor = nextCur;
      };

      const onPd = (ev) => {
        if (peekHidden || disposed || !c.visible) return;
        if (ev && ev.button !== undefined && ev.button !== 0) return;
        // Ignore transparent bubble headroom above cat ears (offsetY < 8 * px)
        if (readLocalY(ev) < HEADROOM_ROWS * c.px) return;
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();

        const nowDown = nowMs();
        markUserInteraction(nowDown);
        if (c.cancelDrag) c.cancelDrag();

        c.dragging = true;
        c.dragMoved = false;
        c.targetX = null;
        c.targetProp = null;
        c.atProp = null;
        c.dragStartX = (ev && ev.clientX) || 0;
        c.dragStartY = (ev && ev.clientY) || 0;
        const x0 = c.x;
        const y0 = c.y;

        const unbind = () => {
          if (win && typeof win.removeEventListener === 'function') {
            win.removeEventListener('pointermove', onPm);
            win.removeEventListener('pointerup', onPu);
            win.removeEventListener('pointercancel', onPu);
          }
          c.cancelDrag = null;
        };

        const onPm = (mv) => {
          if (!c.dragging || disposed || peekHidden) return;
          const dx = ((mv && mv.clientX) || 0) - c.dragStartX;
          const dy = ((mv && mv.clientY) || 0) - c.dragStartY;
          if (!c.dragMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
            c.dragMoved = true;
            notifyDragState();
          }
          if (c.dragMoved) {
            const sw = Math.max(220, readStageWidth());
            c.x = Math.max(18, Math.min(sw - 18 - c.cw, x0 + dx));
            c.y = Math.min(0, Math.max(-42, y0 + dy));
            c.state = 'dangle';
            c.until = nowMs() + 900;
            paintCat(c, nowMs());
          }
        };

        const onPu = () => {
          unbind();
          const wasDragging = c.dragging;
          c.dragging = false;
          notifyDragState();
          if (!wasDragging || disposed || peekHidden) return;
          const now = nowMs();
          markUserInteraction(now);
          if (!c.dragMoved) {
            focusNap = false;
            const quickTap = now - c.lastPetAt < 480;
            c.petCount = now - c.lastPetAt < 2200 ? c.petCount + 1 : 1;
            c.lastPetAt = now;
            if (quickTap) {
              spawnYarn(c.x + c.cw * 0.5, now);
              c.state = 'wave';
              c.until = now + 900;
              setSym(c, 'spark', now, 900);
            } else {
              c.state = 'happy';
              c.until = now + 1500;
              setSym(c, c.petCount >= 3 ? 'hearts2' : 'heart', now, 1400);
              c.vy = c.petCount >= 3 ? -5.0 : -4.0;
              c.y = -1;
            }
          } else {
            c.state = 'happy';
            c.until = now + 1000;
            c.vy = 0;
            setSym(c, 'heart', now, 900);
          }
          paintCat(c, now);
          scheduleNext(true);
        };

        c.cancelDrag = () => {
          unbind();
          if (c.dragging) {
            c.dragging = false;
            c.dragMoved = false;
            c.y = 0;
            c.vy = 0;
            if (c.state === 'dangle') c.state = 'sit';
            notifyDragState();
          }
        };

        if (win && typeof win.addEventListener === 'function') {
          win.addEventListener('pointermove', onPm);
          win.addEventListener('pointerup', onPu);
          win.addEventListener('pointercancel', onPu);
        }
      };

      cv.addEventListener('pointerdown', onPd);
      cv.addEventListener('pointermove', onHoverMove, { passive: true });
      c.cleanup = () => {
        if (c.cancelDrag) c.cancelDrag();
        cv.removeEventListener('pointerdown', onPd);
        cv.removeEventListener('pointermove', onHoverMove);
      };
      return c;
    });

    const cancelAllDrags = () => {
      for (const c of cats) {
        if (c.cancelDrag) c.cancelDrag();
        else if (c.dragging) {
          c.dragging = false;
          c.y = 0;
          c.vy = 0;
        }
      }
      notifyDragState();
    };
    const unregisterDragRelease = registerDragRelease(cancelAllDrags);

    const syncActiveCatTiers = (sw) => {
      const cfgMax = sCfg.catCount === '1' ? 1 : sCfg.catCount === '2' ? 2 : 4;
      const widthMax = sw < 300 ? 2 : sw < 420 ? 3 : 4;
      const limit = Math.min(cfgMax, widthMax);
      for (let i = 0; i < cats.length; i++) {
        const c = cats[i];
        const show = i < limit;
        if (c.visible !== show) {
          c.visible = show;
          c.cv.style.display = show ? '' : 'none';
          if (!show && c.cancelDrag) c.cancelDrag();
        }
      }
    };

    const isPropBusy = (propId, excludeCat) =>
      cats.some((o) => o.visible && o !== excludeCat && (o.atProp === propId || o.targetProp === propId));

    const propAnchorX = (c, propId, sw) => {
      const pr = propById[propId];
      if (!pr || !pr.visible) return c.x;
      const minX = 18;
      const maxX = Math.max(minX + 8, sw - 18 - c.cw);
      let tx = pr.x + pr.cw * 0.5 - c.cw * 0.5;
      if (propId === 'bowl') tx = pr.x + pr.cw - 4;
      else if (propId === 'post') tx = pr.x - c.cw + 5;
      else if (propId === 'plant') tx = pr.x + pr.cw - 2;
      return Math.max(minX, Math.min(maxX, Math.round(tx)));
    };

    const arriveAtProp = (c, propId, now) => {
      c.targetX = null;
      c.targetProp = null;
      c.atProp = propId;
      if (propId === 'cushion') {
        c.state = 'sleep';
        c.y = -2;
        c.vy = 0;
        c.until = now + 6800 + Math.random() * 5200;
        c.sym = null;
      } else if (propId === 'bowl') {
        c.dir = -1;
        c.state = 'eat';
        c.until = now + 3400 + Math.random() * 2200;
        setSym(c, 'heart', now, 1200);
      } else if (propId === 'post') {
        c.dir = 1;
        c.state = 'wave';
        c.until = now + 2000 + Math.random() * 1400;
        setSym(c, 'spark', now, 1100);
      } else {
        c.dir = -1;
        c.state = 'happy';
        c.until = now + 1800;
        setSym(c, 'note', now, 1300);
      }
    };

    const sendCatToProp = (c, propId, now, fromClick) => {
      const pr = propById[propId];
      if (!pr || !pr.visible) return;
      const sw = Math.max(220, readStageWidth());
      drawProps(sw);
      const tx = propAnchorX(c, propId, sw);
      c.atProp = null;
      if (c.y < 0 && c.vy === 0) c.y = 0;
      if (Math.abs(tx - c.x) <= 6) {
        c.x = tx;
        arriveAtProp(c, propId, now);
      } else {
        c.targetX = tx;
        c.targetProp = propId;
        c.state = 'walk';
        c.dir = tx > c.x ? 1 : -1;
        c.until = now + 7000;
        if (fromClick) setSym(c, 'spark', now, 750);
      }
    };

    const overlapsAnyProp = (cx, cw) => {
      const a0 = cx + 2;
      const a1 = cx + cw - 2;
      for (const pr of propNodes) {
        if (!pr.visible) continue;
        if (a1 > pr.x - 4 && a0 < pr.x + pr.cw + 4) return pr;
      }
      return null;
    };

    const hasCrowdNear = (c, cx) => {
      for (const o of cats) {
        if (!o.visible || o === c || o.dragging) continue;
        const minSep = (c.cw + o.cw) * 0.58;
        if (Math.abs(cx + c.cw * 0.5 - (o.x + o.cw * 0.5)) < minSep) return o;
      }
      return null;
    };

    const pickClearSpot = (c, sw) => {
      const minX = 22;
      const maxX = Math.max(minX + 16, sw - 22 - c.cw);
      let bestX = c.x;
      let bestScore = -1e9;
      for (let tries = 0; tries < 14; tries++) {
        const cand = Math.round(minX + Math.random() * (maxX - minX));
        let nearestCat = Infinity;
        for (const o of cats) {
          if (!o.visible || o === c) continue;
          nearestCat = Math.min(nearestCat, Math.abs(cand + c.cw * 0.5 - (o.x + o.cw * 0.5)));
        }
        let propPenalty = 0;
        for (const pr of propNodes) {
          if (!pr.visible) continue;
          const overlap = Math.min(cand + c.cw, pr.x + pr.cw + 4) - Math.max(cand, pr.x - 4);
          if (overlap > 0) propPenalty += 120 + overlap * 2;
        }
        const score = Math.min(nearestCat, 140) - propPenalty;
        if (score > bestScore) {
          bestScore = score;
          bestX = cand;
        }
      }
      return bestX;
    };

    const resolveCatColor = (c, ch, gx, gy, pose) => {
      if (c.coat === 'calico') {
        if (ch === '#') {
          if (gy <= 3 && gx >= 2 && gx <= 6) return c.pal.s;
          if (gy >= 5 && gy <= 9 && gx >= 11 && gx <= 15) return c.pal.c2;
          if (gx >= 16) return gy % 2 === 0 ? c.pal.s : c.pal.c2;
        }
        if (ch === 's') return gx >= 12 ? c.pal.c2 : c.pal.s;
      } else if (c.coat === 'ragdoll') {
        if (ch === '#') {
          if (gy <= 2 && (gx <= 5 || (gx >= 8 && gx <= 12))) return c.pal.s;
          if (gx >= 16) return c.pal.s;
          if (pose.startsWith('stand') && gy >= 6 && gy <= 8 && gx >= 10 && gx <= 15) return '#8B95AC';
        }
      }
      return c.pal[ch];
    };

    const paintCat = (c, now) => {
      if (!c.visible) return;
      const ctx2 = c.ctx;
      if (!ctx2) return;
      const curDpr = Math.max(1, Math.min(2, readDpr() || 1));
      const dark = isDarkThemeNow();
      const pw = Math.round(TOTAL_COLS * c.px * curDpr);
      const ph = Math.round(TOTAL_ROWS * c.px * curDpr);
      if (c.cv.width !== pw || c.cv.height !== ph) {
        c.cv.width = pw;
        c.cv.height = ph;
        c.lastSig = '';
      }
      const nextZ = c.dragging ? '6' : c.atProp === 'cushion' ? '2' : '4';
      if (c.lastZ !== nextZ) {
        c.lastZ = nextZ;
        c.cv.style.zIndex = nextZ;
      }
      const tx = `translate3d(${Math.round(c.x)}px,${Math.round(c.y)}px,0)`;
      if (c.lastTx !== tx) {
        c.lastTx = tx;
        c.cv.style.transform = tx;
      }

      const walkStep = Math.floor(now / 135) % 4;
      const slowStep = Math.floor(now / 440) % 2;
      let poseKey = 'standA';
      if (c.dragging || c.state === 'dangle') poseKey = 'dangle';
      else if (c.state === 'pounce' || c.y < -5) poseKey = 'pounce';
      else if (c.state === 'walk') poseKey = ['walk1', 'walk2', 'walk3', 'walk4'][walkStep];
      else if (c.state === 'eat') poseKey = Math.floor(now / 260) % 2 === 0 ? 'eat1' : 'eat2';
      else if (c.state === 'sleep') poseKey = Math.floor(now / 900) % 2 === 0 ? 'sleep1' : 'sleep2';
      else if (c.state === 'sit') poseKey = slowStep === 0 ? 'sitA' : 'sitB';
      else if (c.state === 'groom') poseKey = Math.floor(now / 250) % 2 === 0 ? 'groom1' : 'groom2';
      else if (c.state === 'stretch') poseKey = 'stretch';
      else if (c.state === 'wave') poseKey = Math.floor(now / 210) % 2 === 0 ? 'wave1' : 'wave2';
      else if (c.state === 'happy') poseKey = 'happy';
      else if (now < c.twitchUntil) poseKey = 'earL';
      else if (now < c.blinkUntil) poseKey = 'blink';
      else poseKey = slowStep === 0 ? 'standA' : 'standB';

      let activeSym = null;
      let symPhase = 0;
      if (c.sym && now < c.symUntil) {
        activeSym = c.sym;
        const dur = Math.max(400, c.symUntil - c.symBornAt);
        symPhase = Math.min(5, Math.floor(((now - c.symBornAt) / dur) * 6));
      } else if (c.state === 'sleep') {
        const zCycle = (now % 1800) / 1800;
        activeSym = zCycle < 0.5 ? 'z1' : 'z2';
        symPhase = Math.min(5, Math.floor(zCycle * 6));
      } else if (thinking && c.idx <= 1 && !focusNap && c.state === 'sit') {
        const tCycle = (now % 2200) / 2200;
        activeSym = c.idx === 0 ? 'think' : 'q';
        symPhase = Math.min(5, Math.floor(tCycle * 6));
      } else if ((c.state === 'groom' || c.state === 'eat') && Math.floor(now / 1100) % 2 === 0) {
        activeSym = 'note';
        symPhase = Math.floor((now % 1100) / 220);
      }

      const isGazePose = poseKey === 'standA' || poseKey === 'standB' || poseKey === 'sitA' || poseKey === 'sitB';
      const eyeShift = isGazePose ? c.gazeDx : 0;
      const sitBlink = (poseKey === 'sitA' || poseKey === 'sitB') && now < c.blinkUntil ? 1 : 0;
      const sig = `${poseKey}:${c.dir}:${eyeShift}:${sitBlink}:${activeSym || ''}:${symPhase}:${curDpr}:${dark ? 1 : 0}`;
      if (c.lastSig === sig) return;
      c.lastSig = sig;

      ctx2.setTransform(1, 0, 0, 1, 0, 0);
      ctx2.clearRect(0, 0, pw, ph);
      ctx2.imageSmoothingEnabled = false;
      const rows = CHIBI_CAT_POSES[poseKey] || CHIBI_CAT_POSES.standA;
      const isSit = poseKey === 'sitA' || poseKey === 'sitB';
      const eyeColA = isSit ? 5 : 4;
      const eyeColB = isSit ? 11 : 10;
      const eDx = c.dir > 0 ? -eyeShift : eyeShift;

      drawCrispGrid(
        ctx2,
        rows,
        c.px,
        curDpr,
        PAD_X,
        HEADROOM_ROWS,
        (rawCh, gx, gy) => {
          let ch = rawCh;
          if (ch === '.') return null;
          if (gy === 4) {
            if (sitBlink) {
              if (gx === eyeColA - 1 || gx === eyeColB + 1) ch = 'o';
            } else if (eyeShift !== 0) {
              if ((gx === eyeColA || gx === eyeColB) && ch === 'o') ch = '#';
              else if (gx === eyeColA + eDx || gx === eyeColB + eDx) ch = 'o';
            }
          }
          return resolveCatColor(c, ch, gx, gy, poseKey);
        },
        c.dir > 0,
        pw,
        dark ? DARK_HALO_COLOR : null
      );

      if (activeSym && SANCTUARY_SYMS[activeSym]) {
        const sRows = SANCTUARY_SYMS[activeSym];
        const sp = Math.max(1.25, c.px * 0.85);
        const sStep = sp * curDpr;
        const rise = symPhase * 0.45 * c.px * curDpr;
        const driftX = activeSym.startsWith('z') ? symPhase * 0.32 * c.px * curDpr : 0;
        const sx0 = Math.round(pw * 0.34 + driftX);
        const sy0 = Math.round((poseKey.startsWith('sleep') ? 5.0 : 2.2) * c.px * curDpr - rise);
        ctx2.save();
        ctx2.globalAlpha = symPhase >= 5 ? 0.25 : symPhase >= 4 ? 0.55 : 0.95;
        for (let sy = 0; sy < sRows.length; sy++) {
          const sr = sRows[sy];
          const y0 = Math.round(sy0 + sy * sStep);
          const y1 = Math.round(sy0 + (sy + 1) * sStep);
          for (let sx = 0; sx < sr.length; sx++) {
            const sc = sr[sx];
            if (sc === '.') continue;
            const x0 = Math.round(sx0 + sx * sStep);
            const x1 = Math.round(sx0 + (sx + 1) * sStep);
            ctx2.fillStyle =
              sc === 'p' ? '#F472B6' :
              sc === 'y' ? '#F59E0B' :
              sc === 'w' ? '#FFFBEB' :
              sc === 'b' ? '#38BDF8' :
              sc === 'r' ? '#EF4444' :
              sc === 'i' ? (dark ? '#A5B4FC' : '#6366F1') :
              (dark ? '#CBD5E1' : '#94A3B8');
            ctx2.fillRect(x0, y0, x1 - x0, y1 - y0);
          }
        }
        ctx2.restore();
      }
    };

    const isQuietNapActive = (now) => {
      if (focusNap || sCfg.catQuietMode === 'nap') return true;
      if (streaming || thinking || yarn.active) return false;
      return now - lastInteractionAt >= IDLE_NAP_AFTER_MS;
    };

    const applyFocusNapState = (now) => {
      for (const c of cats) {
        if (!c.visible || c.dragging) continue;
        c.targetX = null;
        c.targetProp = null;
        if (focusNap) {
          c.state = 'sleep';
          c.until = now + 15000;
          setSym(c, 'z1', now, 1200);
        } else {
          c.state = c.idx % 2 === 0 ? 'sit' : 'stand';
          c.until = now + 2600 + c.idx * 500;
          setSym(c, 'spark', now, 800);
        }
        paintCat(c, now);
      }
      scheduleNext(true);
    };

    const pickNextBehavior = (c, now, sw) => {
      c.targetX = null;
      c.targetProp = null;
      if (c.atProp === 'cushion' && c.y < 0) c.y = 0;
      c.atProp = null;

      // Focus nap, config nap, or 30s idle nap -> curl up calmly
      if (isQuietNapActive(now)) {
        c.state = 'sleep';
        c.until = now + 8000 + Math.random() * 5000;
        return;
      }

      // Thinking state -> 1-2 lead cats sit calmly facing composer, zero walking/jumping
      if (thinking) {
        c.state = c.idx <= 1 ? 'sit' : 'sleep';
        c.until = now + 3400 + Math.random() * 2000;
        return;
      }

      // Streaming state -> ZERO random walking or jumping (zero reading distraction!)
      if (streaming) {
        c.state = c.idx % 2 === 0 ? 'sit' : 'stand';
        c.until = now + 3200 + Math.random() * 2200;
        return;
      }

      // If overlapping another cat or standing on a prop unintentionally, stroll to a clear spot
      if (hasCrowdNear(c, c.x) || overlapsAnyProp(c.x, c.cw)) {
        const tx = pickClearSpot(c, sw);
        c.targetX = tx;
        c.state = 'walk';
        c.dir = tx >= c.x ? 1 : -1;
        c.until = now + 4500;
        return;
      }

      const r = Math.random();
      const cozyBoost = c.mood === 'cozy' ? 0.08 : 0;
      const playBoost = c.mood === 'playful' ? 0.08 : 0;
      const propsOn = sCfg.catProps !== 'off';
      if (propsOn && propById.cushion?.visible && r < 0.14 && !isPropBusy('cushion', c)) {
        sendCatToProp(c, 'cushion', now, false);
      } else if (propsOn && propById.bowl?.visible && r < 0.24 && !isPropBusy('bowl', c)) {
        sendCatToProp(c, 'bowl', now, false);
      } else if (propsOn && propById.post?.visible && r < 0.31 + playBoost && !isPropBusy('post', c)) {
        sendCatToProp(c, 'post', now, false);
      } else if (r < 0.46 + playBoost) {
        const tx = pickClearSpot(c, sw);
        c.targetX = tx;
        c.state = 'walk';
        c.dir = tx >= c.x ? 1 : -1;
        c.until = now + 2400 + Math.random() * 2600;
      } else if (r < 0.62) {
        c.state = 'stand';
        c.until = now + 3200 + Math.random() * 2800;
      } else if (r < 0.74 + cozyBoost) {
        c.state = 'sleep';
        c.until = now + 5200 + Math.random() * 4800;
      } else if (r < 0.85) {
        c.state = 'sit';
        c.until = now + 3200 + Math.random() * 3200;
      } else if (r < 0.92) {
        c.state = 'groom';
        c.until = now + 2600 + Math.random() * 2200;
      } else if (r < 0.97) {
        c.state = 'stretch';
        c.until = now + 1900 + Math.random() * 1200;
      } else {
        c.state = 'pounce';
        c.vy = -4.2;
        c.y = -1;
        setSym(c, 'spark', now, 850);
        c.until = now + 900;
      }
    };

    const enforceCatSeparation = (minX, sw) => {
      const active = cats.filter((c) => c.visible && !c.dragging && !c.atProp);
      if (active.length < 2) return;
      active.sort((a, b) => a.x - b.x);
      for (let i = 0; i < active.length - 1; i++) {
        const a = active[i];
        const b = active[i + 1];
        if (a.state !== 'walk' && b.state !== 'walk') continue;
        const minGap = (a.cw + b.cw) * 0.42;
        const curGap = b.x - a.x;
        if (curGap < minGap) {
          const push = (minGap - curGap) * 0.5;
          const aMax = Math.max(minX + 8, sw - 18 - a.cw);
          const bMax = Math.max(minX + 8, sw - 18 - b.cw);
          a.x = Math.max(minX, Math.min(aMax, a.x - push));
          b.x = Math.max(minX, Math.min(bMax, b.x + push));
        }
      }
    };

    let stepTimer = null;
    let lastStepAt = 0;
    let lastNuzzleAt = 0;

    const cancelSched = () => {
      if (stepTimer !== null) {
        clearTimeout(stepTimer);
        stepTimer = null;
      }
    };

    const shouldSuspend = () =>
      Boolean(disposed || !running || pausedPower || peekHidden || isVramSleepState() || isWindowBlurred());

    const computeNextDelayMs = (now) => {
      if (getReducedMotion()) return 0;
      if (yarn.active) return 32;
      let anyFast = false;
      let allSleeping = true;
      for (const c of cats) {
        if (!c.visible) continue;
        if (c.dragging || c.state === 'walk' || c.vy !== 0 || (c.y < 0 && c.atProp !== 'cushion')) {
          anyFast = true;
          allSleeping = false;
          break;
        }
        if (c.state !== 'sleep' || (c.sym && now < c.symUntil)) {
          allSleeping = false;
        }
      }
      if (anyFast) return 32;
      if (allSleeping && isQuietNapActive(now)) return 900;
      return 160;
    };

    const scheduleNext = (immediateReset = false) => {
      if (shouldSuspend()) {
        cancelSched();
        return;
      }
      if (immediateReset) cancelSched();
      if (stepTimer !== null) return;
      const delay = computeNextDelayMs(nowMs());
      if (delay <= 0) return;
      stepTimer = setTimeout(() => {
        stepTimer = null;
        if (shouldSuspend()) return;
        step(nowMs());
        scheduleNext(false);
      }, delay);
      if (stepTimer && typeof stepTimer.unref === 'function') stepTimer.unref();
    };

    const step = (nowArg) => {
      if (shouldSuspend()) {
        cancelSched();
        publishRimState(false, 0, nowMs());
        return;
      }
      const now = typeof nowArg === 'number' ? nowArg : nowMs();
      const dt = lastStepAt ? Math.min(80, Math.max(12, now - lastStepAt)) : 32;
      const dtScale = dt / 55;
      lastStepAt = now;
      vramReclaimed = false;

      const reduced = Boolean(getReducedMotion());
      const sw = Math.max(220, readStageWidth());
      const minX = 18;
      syncActiveCatTiers(sw);
      drawProps(sw);

      let stageRect = null;
      if (ptr.active && now - ptr.lastAt < 1800 && typeof hostEl.getBoundingClientRect === 'function') {
        if (!cachedStageRect || now - stageRectAt > 400) {
          cachedStageRect = hostEl.getBoundingClientRect();
          stageRectAt = now;
        }
        stageRect = cachedStageRect;
      }

      if (yarn.active) {
        if (now >= yarn.until) {
          yarn.active = false;
          yarn.cv.style.display = 'none';
        } else {
          yarn.x += yarn.vx * dtScale;
          yarn.vx *= Math.pow(0.965, dtScale);
          if (yarn.x <= minX) {
            yarn.x = minX;
            yarn.vx = Math.abs(yarn.vx) * 0.85;
          } else if (yarn.x >= sw - 32) {
            yarn.x = sw - 32;
            yarn.vx = -Math.abs(yarn.vx) * 0.85;
          }
          if (yarn.y < 0 || yarn.vy !== 0) {
            yarn.y += yarn.vy * dtScale;
            yarn.vy += 0.95 * dtScale;
            if (yarn.y >= 0) {
              yarn.y = 0;
              yarn.vy = Math.abs(yarn.vy) > 1.5 ? -yarn.vy * 0.5 : 0;
            }
          }
          drawYarn();
        }
      }

      const quietNapNow = isQuietNapActive(now);

      for (const c of cats) {
        if (!c.visible) continue;
        const maxX = Math.max(minX + 8, sw - 18 - c.cw);
        if (!c.placed) {
          c.x = Math.max(minX, Math.min(maxX, Math.round(minX + (maxX - minX) * c.xPct)));
          c.placed = true;
        } else if (!c.dragging && c.x > maxX) {
          c.x = maxX;
        }
        if (c.dragging) {
          paintCat(c, now);
          continue;
        }
        if ((c.y < 0 && c.atProp !== 'cushion') || c.vy !== 0) {
          c.y += c.vy * dtScale;
          c.vy += 1.45 * dtScale;
          if (c.y >= 0) {
            c.y = 0;
            c.vy = 0;
            if (c.state === 'pounce') {
              c.state = 'happy';
              c.until = now + 700;
            }
          }
        }
        if (stageRect && !streaming && !thinking && !quietNapNow) {
          const relX = ptr.clientX - stageRect.left;
          const relY = ptr.clientY - stageRect.top;
          const dx = relX - (c.x + c.cw * 0.5);
          if (Math.abs(dx) < 150 && relY > -80 && relY < 130) {
            c.gazeDx = dx < -18 ? -1 : dx > 18 ? 1 : 0;
          } else {
            c.gazeDx = 0;
          }
        } else {
          c.gazeDx = 0;
        }

        if (!reduced && now >= c.nextBlink) {
          c.blinkUntil = now + 170;
          c.nextBlink = now + 2600 + Math.random() * 3400;
        }
        if (!reduced && now >= c.nextTwitch) {
          c.twitchUntil = now + 220;
          c.nextTwitch = now + 4200 + Math.random() * 4800;
        }

        if (!reduced && yarn.active && c.state !== 'sleep' && !focusNap) {
          c.targetX = null;
          c.targetProp = null;
          c.atProp = null;
          const cx = c.x + c.cw * 0.5;
          const dist = yarn.x + 7 - cx;
          if (Math.abs(dist) < c.cw * 0.55) {
            yarn.vx = (dist >= 0 ? 1 : -1) * (4.2 + Math.random() * 1.8);
            yarn.vy = -3.4;
            c.state = 'wave';
            c.until = now + 650;
            setSym(c, 'spark', now, 750);
          } else if (c.mood === 'playful' || Math.abs(dist) < 200) {
            c.state = 'walk';
            c.dir = dist < 0 ? -1 : 1;
            c.until = now + 700;
          }
        } else if (!reduced && now >= c.until) {
          pickNextBehavior(c, now, sw);
        }

        if (!reduced && c.state === 'walk') {
          const boost = yarn.active ? 1.35 : 1;
          const stepPx = c.speed * 2.2 * boost * dtScale;
          if (c.targetX !== null) {
            const rem = c.targetX - c.x;
            if (Math.abs(rem) <= stepPx + 1.5) {
              c.x = c.targetX;
              if (c.targetProp) {
                arriveAtProp(c, c.targetProp, now);
              } else {
                c.targetX = null;
                c.state = Math.random() < 0.5 ? 'stand' : 'sit';
                c.until = now + 2600 + Math.random() * 2600;
              }
            } else {
              c.dir = rem > 0 ? 1 : -1;
              c.x += c.dir * stepPx;
            }
          } else {
            c.x += c.dir * stepPx;
            if (c.x <= minX) {
              c.x = minX;
              c.dir = 1;
            } else if (c.x >= maxX) {
              c.x = maxX;
              c.dir = -1;
            }
          }
        }
      }

      enforceCatSeparation(minX, sw);

      for (const c of cats) {
        if (c.visible) paintCat(c, now);
      }

      // Friendly cat-to-cat nuzzle encounter (idle only)
      if (!reduced && !yarn.active && !streaming && !thinking && !quietNapNow && now - lastNuzzleAt > 9500) {
        for (let i = 0; i < cats.length; i++) {
          for (let j = i + 1; j < cats.length; j++) {
            const a = cats[i];
            const b = cats[j];
            if (!a.visible || !b.visible || a.dragging || b.dragging || a.atProp || b.atProp || (a.state !== 'walk' && b.state !== 'walk')) continue;
            const dist = Math.abs(a.x + a.cw * 0.5 - (b.x + b.cw * 0.5));
            const noseDist = (a.cw + b.cw) * 0.56;
            if (dist < noseDist && dist > noseDist * 0.42) {
              lastNuzzleAt = now;
              a.targetX = b.targetX = null;
              a.targetProp = b.targetProp = null;
              const aLeft = a.x <= b.x;
              a.dir = aLeft ? 1 : -1;
              b.dir = -a.dir;
              a.state = 'happy';
              b.state = 'happy';
              a.until = b.until = now + 1300;
              setSym(a, 'heart', now, 1300);
              if (Math.random() < 0.5) {
                b.vy = -3.4;
                b.y = -1;
              }
              paintCat(a, now);
              paintCat(b, now);
              break;
            }
          }
        }
      }

      publishRimState(true, sw, now);
    };

    const triggerErrorAlert = (now) => {
      let alerted = 0;
      for (const c of cats) {
        if (!c.visible || c.dragging || alerted >= 2) continue;
        c.targetX = null;
        c.targetProp = null;
        if (c.atProp === 'cushion' && c.y < 0) c.y = 0;
        c.atProp = null;
        c.state = 'stand';
        c.twitchUntil = now + 650;
        c.until = now + 2400;
        setSym(c, alerted === 0 ? 'alert' : 'sweat', now, 2200);
        paintCat(c, now);
        alerted += 1;
      }
      scheduleNext(true);
    };

    const onSemanticEvent = (type, payload = {}) => {
      if (disposed) return;
      const now = nowMs();
      const pl = payload && typeof payload === 'object' ? payload : {};
      const activeCats = cats.filter((c) => c.visible && !c.dragging);
      const lead = activeCats[0] || null;
      const rightmost = activeCats.length ? activeCats.reduce((best, cur) => (cur.x > best.x ? cur : best), activeCats[0]) : null;

      if (type === 'activity') {
        markUserInteraction(now);
        if (!focusNap && sCfg.catQuietMode !== 'nap' && !shouldSuspend()) {
          scheduleNext(false);
        }
        return;
      }

      if (type === 'streaming') {
        const nextStream = Boolean(pl.on);
        if (nextStream === streaming) return;
        streaming = nextStream;
        if (streaming && !focusNap && sCfg.catQuietMode !== 'nap') {
          for (const c of activeCats) {
            // Stop walking & jumping immediately; sit calmly to avoid reading distraction
            c.targetX = null;
            c.targetProp = null;
            if (c.state === 'walk' || c.state === 'pounce') {
              c.state = c.idx % 2 === 0 ? 'sit' : 'stand';
              c.until = now + 3200 + c.idx * 400;
            } else if (c.state === 'sleep' && c.idx === 0) {
              if (c.atProp === 'cushion' && c.y < 0) c.y = 0;
              c.atProp = null;
              c.state = 'sit';
              c.until = now + 3400;
            }
            paintCat(c, now);
          }
          scheduleNext(true);
        }
        return;
      }

      if (type === 'isThinking') {
        const nextThink = Boolean(pl.on);
        if (nextThink === thinking) return;
        thinking = nextThink;
        if (thinking && !focusNap) {
          for (let i = 0; i < Math.min(2, activeCats.length); i++) {
            const c = activeCats[i];
            c.targetX = null;
            c.targetProp = null;
            if (c.atProp === 'cushion' && c.y < 0) c.y = 0;
            c.atProp = null;
            c.state = 'sit';
            c.until = now + 3800;
            setSym(c, i === 0 ? 'think' : 'q', now, 1800);
            paintCat(c, now);
          }
          scheduleNext(true);
        }
        return;
      }

      if (type === 'hasError') {
        const nextErr = Boolean(pl.on);
        const rising = nextErr && !hasError;
        hasError = nextErr;
        if (rising) triggerErrorAlert(now);
        return;
      }

      if (type === 'awaitingDecision') {
        return;
      }

      if (type === 'streamDone') {
        if (pl.error) {
          triggerErrorAlert(now);
          return;
        }
        const dur = Number(pl.durationMs) || 0;
        if (dur >= 6000) {
          // Synchronized 1.2s heart celebration for long completed task
          const reduced = Boolean(getReducedMotion());
          for (const c of activeCats) {
            c.targetX = null;
            c.targetProp = null;
            if (c.atProp === 'cushion' && c.y < 0) c.y = 0;
            c.atProp = null;
            c.state = 'happy';
            c.until = now + 1200;
            setSym(c, 'heart', now, 1200);
            if (!reduced) {
              c.vy = -3.6;
              c.y = -1;
            }
            paintCat(c, now);
          }
          scheduleNext(true);
        }
        return;
      }

      if (type === 'vial-high') {
        if (rightmost) {
          rightmost.targetX = null;
          rightmost.targetProp = null;
          if (propById.post && propById.post.visible && !focusNap) {
            sendCatToProp(rightmost, 'post', now, false);
          } else {
            rightmost.state = 'wave';
            rightmost.until = now + 1800;
          }
          setSym(rightmost, 'sweat', now, 1800);
          paintCat(rightmost, now);
          scheduleNext(true);
        }
        return;
      }

      // Non-critical ambient reactions respect Focus Nap / nap mode
      if (focusNap || sCfg.catQuietMode === 'nap') return;

      if (type === 'send') {
        markUserInteraction(now);
        if (lead) {
          lead.state = 'wave';
          lead.until = now + 850;
          setSym(lead, 'spark', now, 850);
          paintCat(lead, now);
          scheduleNext(true);
        }
      } else if (type === 'slash-cmd') {
        markUserInteraction(now);
        const cmd = String(pl.cmd || '').toLowerCase();
        if (lead) {
          if (cmd === 'plan' || cmd === 'grill-me') {
            lead.state = 'sit';
            setSym(lead, 'q', now, 1500);
          } else if (cmd === 'compact') {
            lead.state = 'stretch';
            setSym(lead, 'spark', now, 1400);
          } else {
            lead.state = 'wave';
            setSym(lead, 'spark', now, 1200);
          }
          lead.until = now + 1500;
          paintCat(lead, now);
          scheduleNext(true);
        }
      } else if (type === 'files-changed') {
        if (lead) {
          lead.twitchUntil = now + 320;
          setSym(lead, 'spark', now, 750);
          paintCat(lead, now);
          scheduleNext(false);
        }
      } else if (type === 'code-copied') {
        if (lead) {
          setSym(lead, 'note', now, 800);
          paintCat(lead, now);
          scheduleNext(false);
        }
      } else if (type === 'effort-tier' || type === 'model-shift' || type === 'orchestrator' || type === 'vial-opened' || type === 'aura-complete') {
        markUserInteraction(now);
        if (lead) {
          setSym(lead, type === 'aura-complete' ? 'heart' : 'spark', now, 950);
          if (type === 'orchestrator' && pl.on && activeCats[1]) {
            setSym(activeCats[1], 'spark', now, 950);
            paintCat(activeCats[1], now);
          }
          paintCat(lead, now);
          scheduleNext(false);
        }
      } else if (type === 'ripple') {
        markUserInteraction(now);
        const rx = Number(pl.x);
        if (Number.isFinite(rx)) {
          for (const c of activeCats) {
            if (Math.abs(rx - (c.x + c.cw * 0.5)) < 160) {
              c.gazeDx = rx < c.x + c.cw * 0.5 ? -1 : 1;
              c.twitchUntil = now + 260;
              paintCat(c, now);
            }
          }
        }
      }
    };

    const onResize = (prevW, newW) => {
      if (disposed) return;
      const pw = Math.max(220, Number(prevW) || 720);
      const nw = Math.max(220, Number(newW) || readStageWidth());
      cachedStageRect = null;
      const minX = 18;
      syncActiveCatTiers(nw);
      drawProps(nw, true);
      for (const c of cats) {
        if (c.dragging || !c.placed) continue;
        const prevSpan = Math.max(8, pw - 36 - c.cw);
        const nextSpan = Math.max(8, nw - 36 - c.cw);
        const ratio = Math.max(0, Math.min(1, (c.x - minX) / prevSpan));
        c.x = Math.round(minX + ratio * nextSpan);
        if (c.targetProp && propById[c.targetProp]?.visible) {
          c.targetX = propAnchorX(c, c.targetProp, nw);
        } else if (c.atProp && propById[c.atProp]?.visible) {
          c.x = propAnchorX(c, c.atProp, nw);
        }
        if (c.visible && !shouldSuspend()) paintCat(c, nowMs());
      }
      if (!shouldSuspend()) publishRimState(true, nw, nowMs());
    };

    const onThemeChange = () => {
      if (disposed || shouldSuspend()) return;
      const sw = Math.max(220, readStageWidth());
      drawProps(sw, true);
      if (yarn.active) drawYarn();
      const now = nowMs();
      for (const c of cats) {
        c.lastSig = '';
        if (c.visible) paintCat(c, now);
      }
    };

    const updateConfig = (nextCfg = {}) => {
      if (disposed) return;
      const merged = { ...sCfg };
      if (nextCfg.catCount !== undefined) merged.catCount = nextCfg.catCount === '1' || nextCfg.catCount === '2' ? nextCfg.catCount : '4';
      if (nextCfg.catProps !== undefined) merged.catProps = nextCfg.catProps === 'off' ? 'off' : 'on';
      if (nextCfg.catQuietMode !== undefined) merged.catQuietMode = nextCfg.catQuietMode === 'nap' ? 'nap' : 'auto';
      const changed = merged.catCount !== sCfg.catCount || merged.catProps !== sCfg.catProps || merged.catQuietMode !== sCfg.catQuietMode;
      sCfg = merged;
      if (!changed) return;
      const now = nowMs();
      const sw = Math.max(220, readStageWidth());
      syncActiveCatTiers(sw);
      drawProps(sw, true);
      if (sCfg.catQuietMode === 'nap') {
        for (const c of cats) {
          if (!c.visible || c.dragging) continue;
          c.targetX = null;
          c.targetProp = null;
          c.state = 'sleep';
          c.until = now + 10000;
        }
      }
      if (!shouldSuspend()) {
        for (const c of cats) if (c.visible) paintCat(c, now);
        publishRimState(true, sw, now);
        scheduleNext(true);
      }
    };

    const reclaimVram = () => {
      cancelSched();
      vramReclaimed = true;
      lastPropsSw = 0;
      lastPropsKey = '';
      publishRimState(false, 0, nowMs());
      yarn.cv.width = 0;
      yarn.cv.height = 0;
      yarn.drawnKey = '';
      for (const pr of propNodes) {
        pr.cv.width = 0;
        pr.cv.height = 0;
        pr.drawnKey = '';
        if (pr.frontCv) {
          pr.frontCv.width = 0;
          pr.frontCv.height = 0;
        }
      }
      for (const c of cats) {
        c.cv.width = 0;
        c.cv.height = 0;
        c.lastSig = '';
      }
    };

    const syncPowerState = (paused) => {
      if (disposed) return;
      const nextPaused = Boolean(paused || isVramSleepState() || isWindowBlurred());
      pausedPower = nextPaused;
      if (pausedPower) {
        cancelAllDrags();
        cancelSched();
        publishRimState(false, 0, nowMs());
      } else if (running && !peekHidden) {
        lastStepAt = 0;
        if (vramReclaimed) {
          lastPropsSw = 0;
          lastPropsKey = '';
        }
        step(nowMs());
        scheduleNext(true);
      }
    };

    const setPeek = (hidden) => {
      const next = Boolean(hidden);
      if (peekHidden === next) return;
      peekHidden = next;
      if (peekHidden) {
        cancelAllDrags();
        cancelSched();
        publishRimState(false, 0, nowMs());
      } else if (running && !pausedPower && !disposed) {
        lastStepAt = 0;
        step(nowMs());
        scheduleNext(true);
      }
    };

    const start = () => {
      if (disposed) return;
      const wasRunning = running;
      running = true;
      wrap.style.display = '';
      pausedPower = Boolean(isVramSleepState() || isWindowBlurred());
      peekHidden = Boolean(getPeekHidden());
      if (shouldSuspend()) {
        cancelSched();
        publishRimState(false, 0, nowMs());
        return;
      }
      if (!wasRunning || vramReclaimed || stepTimer === null) {
        lastStepAt = 0;
        step(nowMs());
        scheduleNext(true);
      }
    };

    const stop = () => {
      running = false;
      cancelAllDrags();
      cancelSched();
      wrap.style.display = 'none';
      publishRimState(false, 0, nowMs());
    };

    const dispose = () => {
      if (disposed) return;
      disposed = true;
      stop();
      try { unregisterDragRelease(); } catch (_) {}
      if (win && typeof win.removeEventListener === 'function') {
        win.removeEventListener('pointermove', onGlobalMove);
      }
      reclaimVram();
      for (const pr of propNodes) {
        try { pr.cleanup(); } catch (_) {}
      }
      for (const c of cats) {
        try { c.cleanup(); } catch (_) {}
      }
      if (typeof wrap.remove === 'function') wrap.remove();
      else if (wrap.parentNode && typeof wrap.parentNode.removeChild === 'function') wrap.parentNode.removeChild(wrap);
    };

    return {
      start,
      stop,
      step,
      setPeek,
      syncPowerState,
      reclaimVram,
      onResize,
      onThemeChange,
      updateConfig,
      onSemanticEvent,
      onStreamingChange: (on) => onSemanticEvent('streaming', { on }),
      isDragging: () => cats.some((c) => c.dragging),
      dispose,
    };
  }

  G.__agCatSanctuaryFactory = createCatSanctuary;
  if (typeof window !== 'undefined' && window !== G) {
    window.__agCatSanctuaryFactory = createCatSanctuary;
  }
  try {
    const bridge = G.__agCatSanctuaryBridge || (typeof window !== 'undefined' ? window.__agCatSanctuaryBridge : null);
    if (bridge && typeof bridge.onFactoryReady === 'function') {
      bridge.onFactoryReady(createCatSanctuary);
    }
  } catch (_) {}

  if (typeof module === 'object' && module.exports) {
    module.exports = { createCatSanctuary, PX, CAT_PRESETS, SHELF_PROPS, SANCTUARY_SYMS };
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
