(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.__agDualMascotRig = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  /**
   * 双宠像素骨架与物理引擎（Aligned to Official Claude Clawd Pixel Grammar）
   * - 主宠栅格 PX = 3 (每格 3 CSS px), 离散动画节拍 TICK = 100ms
   * - 主体与腿爪耳尾零黑描边、零眼高光噪点、纯方块几何、暗部色 's'、1x2 竖瞳 'o'
   * - 动作道具采用同色系柔和中间调渲染
   */
  const PX = 3;
  const TICK = 100;

  const OFFICIAL_OPEN_REF = [
    '..############..',
    '..############..',
    '..##o######o##..',
    '..##o######o##..',
    '..############..',
    '################',
    '################',
    '..############..',
    '...#.#....#.#...',
    '...#.#....#.#...',
  ];

  const SHARED_PROP_PALETTE = {
    k: '#9c958c',
    w: '#fbf8f1',
    c: '#ecdfc6',
    g: '#a8a194',
    B: '#5b8fb9',
    b: '#cfe3ee',
    r: '#cc4f45',
    y: '#e8b64a',
    h: 'rgba(20, 20, 19, 0.20)',
    d: '#9a8e80',
    D: '#6f8ca6',
    p: '#ef9aa6',
    n: '#8b5e3c',
    l: '#6a6158',
    e: '#78716a',
    F: '#9e3324',
    f: '#c9642a',
    Y: '#e0a23c',
    V: '#fff1dc',
    m: 'rgba(120, 112, 104, 0.55)',
    G: '#7dff9b',
    t: 'rgba(125, 255, 155, 0.38)',
    N: '#ff6bd6',
    u: 'rgba(255, 107, 214, 0.38)',
    W: '#effff3',
    Z: '#232120',
    z: '#756f69',
    A: '#3d8bff',
    E: '#d6e8ff',
    C: '#2753a8',
    i: 'rgba(80, 150, 255, 0.78)',
    I: 'rgba(80, 150, 255, 0.32)',
    L: '#ff3b30',
    H: '#ffd6d2',
    x: '#b3312a',
    j: 'rgba(255, 80, 60, 0.78)',
    J: 'rgba(255, 80, 60, 0.32)',
    P: '#d87e64',
    M: '#ded6cc',
    R: '#ff3b4f',
    // 编排器冰晶：冰白受光面 / 冷灰背光面（纯平两色，无描边）
    a: '#c6d9f7',
    v: '#788eac',
  };

  const PALETTES = {
    clawd: {
      ...SHARED_PROP_PALETTE,
      '#': '#d97757',
      s: '#bf684c',
      o: '#141413',
      O: '#d97757',
      q: '#e8a88e',
      Q: '#f1cbbb',
    },
    cat: {
      ...SHARED_PROP_PALETTE,
      '#': '#947fd6',
      s: '#735eb5',
      o: '#141413',
      k: '#a89fc4',
      B: '#6a8fd6',
      O: '#947fd6',
      q: '#b6a7e6',
      Q: '#d9cff6',
    },
    cowboy: {
      '#': '#d97757',
      s: '#bf684c',
      o: '#141413',
      H: '#8b5e3c',
      R: '#a6744e',
      h: 'rgba(20, 20, 19, 0.18)',
    },
    shades: {
      '#': '#e0896b',
      s: '#c16f53',
      o: '#141413',
      G: '#141413',
      g: '#6d778a',
      w: '#ffffff',
      h: 'rgba(20, 20, 19, 0.18)',
    },
    wizard: {
      '#': '#8a74cf',
      s: '#6a56aa',
      o: '#141413',
      M: '#5c4b9e',
      y: '#e8b64a',
      b: '#cfe3ee',
      h: 'rgba(20, 20, 19, 0.18)',
    },
  };

  // 棱镜边环境反光调色表（6色调：[darkCore,darkWash,lightCore,lightWash]）
  const RIM_PALS = {
    default: ['164,208,255', '155,114,203', '37,99,235', '124,58,237'],
    warm: ['255,220,176', '240,163,126', '194,89,52', '217,119,6'],
    cobalt: ['148,228,255', '66,133,244', '29,78,216', '2,132,199'],
    iris: ['221,214,254', '165,138,248', '91,33,182', '139,92,246'],
    amber: ['253,230,138', '242,184,75', '180,83,9', '245,158,11'],
    mono: ['236,242,248', '148,163,184', '51,65,85', '100,116,139'],
    rainbow: ['244,114,182', '56,189,248', '225,29,72', '124,58,237'],
  };

  const F = (rows, ox = 0, oy = 0, extra = null) =>
    extra ? { rows, ox, oy, ...extra } : { rows, ox, oy };
  const rep = (s, n) => Array(n).fill(s);

  function mirrorFrame(fr, partW) {
    const w = Math.max(...fr.rows.map((r) => r.length));
    const rows = fr.rows.map((r) => r.padEnd(w, '.').split('').reverse().join(''));
    return F(rows, partW - (fr.ox + w), fr.oy, fr.grounded ? { grounded: true } : null);
  }

  function recolorFrame(fr, map) {
    return {
      ...fr,
      rows: fr.rows.map((r) => r.replace(/./g, (ch) => map[ch] || ch)),
    };
  }

  // ── 紧凑 RLE 图集（去重派生 + 自动进入 cdp.js 共享 LZ 压缩池，纯函数解码还原同构对象）──
  const SPRITE_ATLAS_RAW =
    'c.shadow!w12=2,10,g:12h;w14=1,10,g:14h;w10=3,10,g:10h|c.body!stand=2,0:12#*8;tall=2,-1:12#*9;squash=1,2:.12s./14#*6;squash2=1,4:.12s./14#*4;flat=2,7:12s/12#*2;turnL=2,0:11#s*8;turnR=2,0:s11#*8;leanR=2,0:.12#*4/12#.*4;leanL=1,0:12#.*4/.12#*4;peek=2,2:12#*6|c.eyes!open=4,2:o6.o*2;openL=3,2:o6.o*2;openR=5,2:o6.o*2;half=4,3:o6.o;shut=3,3:oo6.oo;happy=3,2:.o6.o./o.o4.o.o;squint=4,2:o6.o/.o4.o./o6.o;wide=3,2:oo6.oo*2;peekOpen=4,4:o6.o*2;peekHalf=4,5:o6.o;flatEyes=4,8:oo4.oo;blink=3,3:ss6.ss;upL=3,1:o6.o*2;up=4,1:o6.o*2;upR=5,1:o6.o*2|c.mouth!small=6,5:.ss.;yawn=6,5:4s/.ss.|c.legs!stand=2,8:.#.#4.#.#.*2;crouch=2,9:.#.#4.#.#.;tuck=2,8:..#.#..#.#..*2;walkA=2,8:.#.s4.#.s./.#6.#3.;walkB=2,8:.s.#4.s.#./3.#6.#.;dangle=2,8:.#.#4.#.#./.#.#8.*2;dangle2=2,8:.#.#4.#.#./8.#.#.*2;flailA=2,8:#3.#..#3.#/#10.#;flailB=2,8:..#.#..#.#../4.#..#4.;flailC=2,8:#..#4.#..#/3.#4.#..#|c.clawL!stub=0,5:##*2;front=0,5:ss*2;up=0,-2:##*2/#.;peekGrip=1,7:ss;flatLeft=0,8:ss;open=0,4:##/.#/##|c.clawR!stub=14,5:##*2;front=14,5:ss*2;up=14,-2:##*2/.#;low=14,8:3#*2;reach1=14,4:3.##/5#;write1=13,6:ss*2;write2=14,5:ss*2;peekGrip=13,7:ss;flatRight=14,8:ss;open=14,4:##/#./##;waveOut=14,-1:.##*2/#..|k.ears!stand=2,-1:#10.#/##8.##;nod=2,0:#10.#/##8.##;loaf=2,2:#10.#/##8.##;airplane=0,0:##12.##/3#10.3#;peek=2,1:#10.#/##8.##;flat=1,6:#12.#;twitchL=2,-1:11.#/##8.##;twitchR=2,-1:#11./##8.##|k.body!stand=2,1:12#*7;loaf=1,4:.12s./14#*5;stretch=2,0:s11#/12#*2/.11#*2/..10#/12#*2;turnL=2,1:11#s*7;turnR=2,1:s11#*7;leanR=2,1:.12#*4/12#.*3;leanL=1,1:12#.*4/.12#*3|k.eyes!loafShut=3,6:oo6.oo;loafHalf=4,6:o6.o|k.paws!none=0,0:;groom1=12,4:ss*2;groom2=12,3:ss*2;cheer=0,2:#14.#*2;up=0,-1:##12.##*2;peekGrip=1,7:ss10.ss;write1=13,5:ss*2;write2=14,6:ss*2;upR=14,0:##*2|k.tail!up=14,3:.s/.#*2/##;sway=14,3:.#*2/s#/#.;curl=14,4:##/.#/s#;loaf=14,6:.#*2/s#;puff=14,2:.#/##*2/s#/#.|p!quill1=15,3:..B/.B./k..;sheet=12,8:6c/ckk3c/6g;mug=13,4:..4D/3DbwD/D.DbbD/3DbbD/..4D;cloth1=13,2:cw../w3c/.cwc/..c.;cloth2=14,3:..cw/3cw/.cwc/..c.;bowl=12,7:5w/DBwBD/.3D.;bowlEmpty=12,8:D3gD/.3D.;chop1=12,4:3.n/..n./.n../n3.;chop2=12,3:3.n/..n./.n../w3.;fishDish=11,7:.PPsPP./7D/.5D.;fishBone=11,7:.M.M.M./7D/.5D.;envS=12,5:6d/ddwwdd/dwddwd/d4wd/6d;envSOpen=12,4:..dd../.dwwd./6d/d4wd*2/6d;letter=14,1:7d/d5cd/d3gccd/d5cd/d4gcd/d5cd/dggccrd/7d;seed=15,8,g:On/nO;p1=16,7,g:O/l*2;p2=16,6,g:O/l*3;p3=14,5,g:..O../..l../O.l.O/.3l./..l..;p4=14,3,g:..O../O.l.O/.3l./O.l.O/.3l./..l..*2;d1=13,0,g:3.O3./O5.O/.O3.O./7./O5.O/7.*2/3.O3.;d2=13,-2,g:.q3.q./3.q3./q5.q/7./.q3.q./7./3.q3.;wilt1=14,3,g:..q../q.l.q/.3l./q.l.q/.3l./..l..*2;wilt2=14,4,g:q4./.q.q./..ll./.q.l./..ll./..l..;wilt3=15,6,g:Q.Q/.l./Ql./.l.;bfUp=13,-4:B3.B/BB.BB/.BkB./..k..;bfDn=13,-4:5.*2/BBkBB/.BkB.;bfRest=7,-3:..B../.BB../..k..;stickUp=14,-9:WW/GG*6;stickLT=9,-9:5.tt/WG3.tt/.GG..tt/..GG.tt/3.GGtt/4.GGt/5.GG;stickRT=14,-9:tt5./tt3.GW/tt..GG./tt.GG../ttGG3./tGG4./GG5.;sirenDim=5,-4:..LL../.4x.*2/6l;sirenL=5,-4:..Lx../.HLxx./.LLxx./6l;sirenF=5,-4:..HH../.LHHL./.4L./6l;sirenR=5,-4:..xL../.xxLH./.xxLL./6l;beamL=-1,-7:J5./.j4./..j3./6./J3j../6./.Jjj..;beamF=4,-7:J..JJ..J/.j.jj.j.;micStand=1,4,g:6.ZZ6./6.Zz6./6.ZZ6./6.Z7.*2/5.4Z5.;micSink1=1,6,g:6.ZZ6./6.Zz6./6.ZZ6./5.4Z5.;micSink2=1,8,g:6.ZZ6./5.4Z5.;smoke=6,-4:.m./mm./.mm/.m.;iceCrystal=5,-6:..av../.aavv./3a3v/.aavv./..av..;laser0=16,7,g:.p./pRp/.p.;laser1=18,8,g:.R./RpR;laser2=15,8,g:pRp/.R.;blueprint=12,2:7B/B4EBB/BE3BEB/B4EBB/BE3BEB/7B;headband=1,1:.12L.L/..10H..L;goalFlame0=4,-7,g:3.Y3./..fYf../.FfYfF./FfYVYfF;goalFlame1=4,-7,g:..Y4./.fYf..Y/FfYVYf./.FfYfF.;goggles=3,0:gAAg..gAAg/gEAg..gEAg;iceCrystalSpin=6,-7:.av./aavv*2/.av.;flag0=14,-6:l4A./lAAyA./l4A./l5.*4;flag1=14,-6:l..3A/lAAyAA/l3A../l5.*4;shadesProp=3,2:4Z..4Z/ZEZZ..ZEZZ;surfboard=1,8,g:..10A../.A10EA.;waveSplash0=-3,6,g:..E./E.A./.AA.;waveSplash1=-3,6,g:E3./.EA./AA..;cloudBig=12,2:..3w../.w3Ew./5wbw/.5b.;cloudMid=13,3:.3w./wEEbw/.3b.;cubeGlow=13,3:.y.y./A3EA/AEyEA/5A;hourglass0=13,1:5n/.byb./..y../.b.b./5n;hourglass1=13,1:5n/.b.b./..y../.byb./5n;pocketWatch=12,4:..y../.ywy./ywnwy/.3y.;micHand=13,2:.ZZ./ZwZZ/.gg./..g.*2;spotlight=5,-9:..VV../.VyyV./V.yy.V;book0=12,4:5B/B3wB/BwgwB/B3wB/5B;book1=12,4:BB.BB/BwBwB/BwgwB/BwBwB/BB.BB;bulbOff=5,-8:..gg../.g..g.*2/..cc..;bulbOn=5,-9:y.yy.y/.yVVy./y4Vy/..yy../..cc..;hotCup0=12,3:.m..m./m..m../5D./D3nDD/D3nD./.3D..;hotCup1=12,3:m..m../.m..m./5D./D3nDD/D3nD./.3D..;donut0=12,4:.3p./pywpp/pp.pn/5n/.3n.;donut1=12,4:.pp../pyw../pp.pn/5n/.3n.;habCactus=0,0,g:3.P3./..lGl../l.lGl../lGlGl.l/..lGlGl/.5n./..3n..;habLamp=0,0,g:..3l../.l3Vl./.l3Yl./..3l../3.z3.*4/..3z..;habHourglass=0,0,g:.5n./..byb../3.y3./..byb../.5n.|s!heart=5,-7:.r.r./5r/.3r./..r..;spark=5,-8:..y..*2/5y/..y..*2;z1=10,-6:4k/..k./.k../4k;z2=12,-9:3k/.k./3k;vein=5,-7:.r.r./rr.rr/5./rr.rr/.r.r.;bang=6,-8:.r.*3/3./.r.;q=5,-9:.3k./k3.k/3.k./..k../5./..k..;note=5,-8:..kk./..k.k/..k../3k../kk3.;sweat=13,-4:.B./BbB*2/.B.;tilde=5,-7:.k3./k.k.k/3.k.;dozeZ0=12,-3:3k/.k./3k;dozeZ1=13,-7:4k/..k./.k../4k;dozeZ2=14,-12:5k/3.k./..k../.k3./5k;fireSpark0=5,-8:..Y../f3.V/..f..;fireSpark1=5,-9:.V..f/..Y../f4.;fireSpark2=5,-8:f..Y./4.V/.f3.;sleepBubble0=12,4:.b./bEb/.b.;sleepBubble1=12,3:.bb./bEwb/bEEb/.bb.|m!cowboy=0,-2:5.6H5./3.10H3./..12R../..12#../..##o6#o##../16#/..12#../3.#.#4.#.#3.;shades=0,0:..12#../..4Gg##g4G../..12G../16#/..12#../3.#.#4.#.#3.;wizard=0,-3:7.MM7./6.MyMM6./5.6M5./..12M../..12#../..##o6#o##../16#/..12#../3.#.#4.#.#3.|ma.cowboy!trick=0,-2:4.6H6./..10H4./.12R3./..12#../..##o6#o##../16#/..12#../..#..#4.#..#..|ma.shades!trick=0,0:..12#../..GwGGw##GwGGw../..12G../16#/..12#../3.#.#4.#.#3.|ma.wizard!trick=0,-3:5.y10./4.yMyMM7./5.6M5./..12M../..12#../..##o6#o##../16#/..12#y./3.#.#4.#.#.y.';

  function decodeSpriteAtlas(raw) {
    const out = { c: {}, k: {}, p: {}, s: {}, m: {}, ma: {} };
    for (const sec of raw.split('|')) {
      const bi = sec.indexOf('!');
      const pk = sec.slice(0, bi).split('.');
      const grp = {};
      for (const item of sec.slice(bi + 1).split(';')) {
        const eq = item.indexOf('=');
        const co = item.indexOf(':', eq + 1);
        const [ox, oy, fl] = item.slice(eq + 1, co).split(',');
        const body = item.slice(co + 1);
        const rows = [];
        if (body) {
          for (const seg of body.split('/')) {
            const st = seg.indexOf('*');
            const rRaw = st >= 0 ? seg.slice(0, st) : seg;
            const n = st >= 0 ? +seg.slice(st + 1) : 1;
            const row = rRaw.replace(/(\d+)(.)/g, (_, cnt, ch) => ch.repeat(+cnt));
            for (let i = 0; i < n; i++) rows.push(row);
          }
        }
        grp[item.slice(0, eq)] = fl === 'g' ? { ox: +ox, oy: +oy, grounded: true, rows } : { ox: +ox, oy: +oy, rows };
      }
      if (pk.length === 1) out[pk[0]] = grp;
      else out[pk[0]][pk[1]] = grp;
    }
    return out;
  }

  const _A = decodeSpriteAtlas(SPRITE_ATLAS_RAW);
  const CLAWD_PARTS = _A.c;
  const CAT_PARTS = { shadow: CLAWD_PARTS.shadow, ..._A.k, mouth: CLAWD_PARTS.mouth, legs: CLAWD_PARTS.legs };
  CAT_PARTS.body.squash = CLAWD_PARTS.body.squash;
  CAT_PARTS.body.flat = CLAWD_PARTS.body.flat;
  CAT_PARTS.body.peek = CLAWD_PARTS.body.peek;
  for (const [ek, ef] of Object.entries(CLAWD_PARTS.eyes)) {
    if (ek === 'peekHalf') continue;
    CAT_PARTS.eyes[ek] = ek === 'peekOpen' || ek === 'flatEyes' ? ef : { ...ef, oy: ef.oy + 1 };
  }
  const PROPS = _A.p;
  PROPS.quill2 = { ...PROPS.quill1, ox: PROPS.quill1.ox + 1, oy: PROPS.quill1.oy + 1 };
  PROPS.bfLeftUp = { ...PROPS.bfUp, ox: PROPS.bfUp.ox - 12, oy: PROPS.bfUp.oy - 1 };
  PROPS.bfLeftDn = { ...PROPS.bfDn, ox: PROPS.bfDn.ox - 12, oy: PROPS.bfDn.oy - 1 };
  PROPS.iceCrystalHi = { ...PROPS.iceCrystal, oy: PROPS.iceCrystal.oy - 1 };
  const SYMS = _A.s;
  const MINI_SPRITES = _A.m;
  const MINI_ANIM_FRAMES = _A.ma;
  for (const id of ['cowboy', 'shades', 'wizard']) {
    const b = MINI_SPRITES[id];
    MINI_ANIM_FRAMES[id].walkB = { ox: b.ox, oy: b.oy, rows: [...b.rows.slice(0, -1), '..s#.#....#.#s..'] };
  }

  ['stickUp', 'stickLT', 'stickRT'].forEach((k) => {
    PROPS[k + 'M'] = recolorFrame(mirrorFrame(PROPS[k], 16), { G: 'N', t: 'u' });
  });
  PROPS.beamR = mirrorFrame(PROPS.beamL, 16);
  ['sirenDim', 'sirenL', 'sirenF', 'sirenR', 'beamL', 'beamR', 'beamF'].forEach((k) => {
    PROPS[k + 'B'] = recolorFrame(PROPS[k], { L: 'A', H: 'E', x: 'C', j: 'i', J: 'I' });
  });

  // 背后火海算法生成（保留轮廓白光 'V'）
  (() => {
    const sil = new Set();
    for (let y = 0; y <= 7; y++) for (let x = 2; x <= 13; x++) sil.add(`${x},${y}`);
    for (let y = 5; y <= 6; y++) [0, 1, 14, 15].forEach((x) => sil.add(`${x},${y}`));
    for (let y = 8; y <= 9; y++) [3, 5, 10, 12].forEach((x) => sil.add(`${x},${y}`));
    const glow = (x, y) =>
      y <= 9 && !sil.has(`${x},${y}`) && [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => sil.has(`${x + dx},${y + dy}`)));
    const X0 = -3;
    const W = 22;
    const TONGUES = [
      [[-1, 15, 3, 3, 1], [3, 2, 3, 3, 0], [7, 10, 2, 3, -1.5], [11, 4, 3, 3, 0], [16, 14, 3, 3, -0.5]],
      [[-1, 14, 3, 3, 1.5], [3, 3, 3, 3, 0], [7, 11, 3, 2, -2], [11, 3, 3, 3, 0], [16, 15, 3, 3, -1]],
    ];
    const base = (x) => (x >= 2 && x <= 13 ? 0 : x >= 0 && x <= 15 ? 5 : 8);
    const mk = (k, f) => {
      const tips = TONGUES[f % 2].map(([cx, h, sl, sr, lean], i) => {
        const by = base(cx);
        return { cx, by, ty: by - Math.round(h * k), sl, sr, h, sw: lean + 2.4 * Math.sin((f * Math.PI) / 2 + i * 1.3) };
      });
      const heat = (x, y) =>
        Math.max(-1, ...tips.map(({ cx, by, ty, sl, sr, sw }) => {
          const rel = Math.max(0, Math.min(1, (by - y) / Math.max(1, by - ty)));
          const c = cx + sw * rel * rel;
          return y - ty - (x < c ? sl : sr) * Math.abs(x - c);
        }));
      const embers = new Set();
      tips.forEach(({ cx, ty, h, sw }, i) => {
        if (i % 3 === f % 3 && h * k >= 4) embers.add(`${Math.round(cx + sw + (i % 2 ? 1 : -1))},${ty - 2}`);
      });
      let y0 = 0;
      for (let y = -16; y <= 9; y++) for (let i = 0; i < W; i++) if (heat(X0 + i, y) >= 0 || embers.has(`${X0 + i},${y}`)) y0 = Math.min(y0, y);
      const cells = [];
      for (let y = y0 - 1; y <= 9; y++) {
        cells.push(Array.from({ length: W }, (_, i) => {
          const x = X0 + i;
          if (sil.has(`${x},${y}`)) return '.';
          if (glow(x, y)) return 'V';
          if (embers.has(`${x},${y}`)) return 'f';
          const e = heat(x, y);
          return e < 0 ? '.' : e < 1 ? 'F' : e < 4 ? 'f' : 'Y';
        }).join(''));
      }
      return F(cells, X0, y0 - 1, { grounded: true });
    };
    [[1, 0.35], [2, 0.7], [3, 1.05]].forEach(([lv, k]) => {
      for (let f = 0; f < 4; f++) PROPS['fire' + lv + f] = mk(k, f);
    });
  })();

  // ── 刚体层与符号层登记（符号层水平镜像时仅翻转锚点，字符正向绘制）────────
  const RIGID_LAYERS = new WeakSet();
  const SYM_LAYERS = new WeakSet();
  Object.values(PROPS).forEach((l) => RIGID_LAYERS.add(l));
  Object.values(SYMS).forEach((l) => {
    RIGID_LAYERS.add(l);
    SYM_LAYERS.add(l);
  });

  // 整格平移帧（带缓存，传递刚体与符号标记）
  const SHIFT_CACHE = new WeakMap();
  function shiftFrame(fr, dx, dy) {
    if (!fr || (!dx && !dy)) return fr;
    let bucket = SHIFT_CACHE.get(fr);
    if (!bucket) {
      bucket = new Map();
      SHIFT_CACHE.set(fr, bucket);
    }
    const key = dx + ',' + dy;
    let out = bucket.get(key);
    if (!out) {
      out = { ...fr, ox: fr.ox + dx, oy: fr.oy + dy };
      bucket.set(key, out);
      if (RIGID_LAYERS.has(fr)) RIGID_LAYERS.add(out);
      if (SYM_LAYERS.has(fr)) SYM_LAYERS.add(out);
    }
    return out;
  }

  function resolveClawdStandGrid() {
    const grid = Array.from({ length: 10 }, () => Array(16).fill('.'));
    const paint = (part) => {
      part.rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx];
          if (ch !== '.' && ch !== ' ') {
            const x = part.ox + rx;
            const y = part.oy + ry;
            if (y >= 0 && y < 10 && x >= 0 && x < 16) grid[y][x] = ch;
          }
        }
      });
    };
    paint(CLAWD_PARTS.legs.stand);
    paint(CLAWD_PARTS.body.stand);
    paint(CLAWD_PARTS.eyes.open);
    paint(CLAWD_PARTS.clawL.stub);
    paint(CLAWD_PARTS.clawR.stub);
    return grid.map((r) => r.join(''));
  }

  function drawLayerSet(ctx, oxGrid, oyGrid, pxSize, palette, layers, colorResolver = null) {
    let lf = '';
    for (const part of layers) {
      if (!part || !part.rows || !part.rows.length) continue;
      for (let ry = 0; ry < part.rows.length; ry++) {
        const row = part.rows[ry], py = (oyGrid + part.oy + ry) * pxSize, gy = part.oy + ry;
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx];
          if (ch === '.' || ch === ' ') continue;
          const gx = part.ox + rx;
          const color = colorResolver ? colorResolver(ch, gx, gy, palette) : palette[ch];
          if (!color) continue;
          let r = 1;
          while (rx + r < row.length) {
            const nc = row[rx + r];
            if (nc === '.' || nc === ' ') break;
            if ((colorResolver ? colorResolver(nc, gx + r, gy, palette) : palette[nc]) !== color) break;
            r++;
          }
          if (color !== lf) ctx.fillStyle = lf = color;
          ctx.fillRect((oxGrid + gx) * pxSize, py, pxSize * r, pxSize);
          rx += r - 1;
        }
      }
    }
  }

  // ── 整数格挤压（替代 ctx.scale 浮点缩放）─────────────────────────────────
  // 思路：把弹性身体部件合成为一张字符点阵，再按「中心接缝最近邻」在整格层面
  // 增删行/列（优先选纯色体块行列、靠近中心、保护眼睛 o 与暗面 s 特征和着地腿），
  // 水平中心与底边锚定。这样每个方块永远是精确 PX×PX，边缘锐利不糊。
  function compositeGrid(layers) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const part of layers) {
      if (!part || !part.rows) continue;
      part.rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx];
          if (ch === '.' || ch === ' ') continue;
          const x = part.ox + rx;
          const y = part.oy + ry;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      });
    }
    if (minX === Infinity) return null;
    const W = maxX - minX + 1;
    const H = maxY - minY + 1;
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    for (const part of layers) {
      if (!part || !part.rows) continue;
      part.rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx];
          if (ch === '.' || ch === ' ') continue;
          g[part.oy + ry - minY][part.ox + rx - minX] = ch;
        }
      });
    }
    return { g, minX, minY, W, H };
  }

  // 选择要删除/复制的接缝线（行或列）；lines 为字符串数组
  function pickSeams(lines, count, remove, protectTail) {
    const n = lines.length;
    if (!count || n < 3) return new Set();
    const center = (n - 1) / 2;
    const cand = [];
    for (let i = 0; i < n; i++) {
      const line = lines[i];
      const blank = !/[^.]/.test(line);
      const pure = !blank && /^[#.]+$/.test(line);
      const same = (i > 0 && lines[i - 1] === line) || (i < n - 1 && lines[i + 1] === line);
      let score = Math.abs(i - center) + (pure ? 0 : same ? 2 : 20);
      if (blank) score += 40;
      if (protectTail && i >= n - protectTail) score += 30;
      if (i === 0 || i === n - 1) score += 8;
      cand.push({ i, score, pure });
    }
    cand.sort((a, b) => a.score - b.score || a.i - b.i);
    const chosen = new Set();
    const limit = Math.min(count, n - 2);
    // 第一轮：删除非纯色线时必须保留一条未被删除的同形邻线，防止特征整体消失
    for (const c of cand) {
      if (chosen.size >= limit) break;
      if (remove && !c.pure) {
        const ok = (j) => j >= 0 && j < n && !chosen.has(j) && lines[j] === lines[c.i];
        if (!ok(c.i - 1) && !ok(c.i + 1)) continue;
      }
      chosen.add(c.i);
    }
    for (const c of cand) {
      if (chosen.size >= limit) break;
      chosen.add(c.i);
    }
    return chosen;
  }

  function buildSeamMap(n, removeSet, dupSet) {
    const map = [];
    for (let i = 0; i < n; i++) {
      if (removeSet.has(i)) continue;
      map.push(i);
      if (dupSet.has(i)) map.push(i);
    }
    return map;
  }

  /**
   * 对弹性部件做整数格挤压，返回 { layer, shiftX(x), shiftY(y) }。
   * sqW / sqH 为整数格增量（正=拉宽/拉高，负=压窄/压扁）。
   */
  function squashLayersToGrid(layers, sqW, sqH) {
    const comp = compositeGrid(layers);
    if (!comp) return null;
    const { g, minX, minY, W, H } = comp;
    const rowsStr = g.map((r) => r.join(''));
    const colsStr = Array.from({ length: W }, (_, x) => g.map((r) => r[x]).join(''));
    const dw = Math.max(-(W - 2), Math.round(sqW || 0));
    const dh = Math.max(-(H - 2), Math.round(sqH || 0));
    const colPick = pickSeams(colsStr, Math.abs(dw), dw < 0, 0);
    const rowPick = pickSeams(rowsStr, Math.abs(dh), dh < 0, 2);
    const colMap = buildSeamMap(W, dw < 0 ? colPick : new Set(), dw > 0 ? colPick : new Set());
    const rowMap = buildSeamMap(H, dh < 0 ? rowPick : new Set(), dh > 0 ? rowPick : new Set());
    const newW = colMap.length;
    const newH = rowMap.length;
    const left = minX + Math.round((W - newW) / 2); // 水平中心锚定
    const top = minY + (H - newH); // 底边锚定
    const rows = rowMap.map((ry) => colMap.map((cx) => g[ry][cx]).join(''));
    // 源行/列 → 目标位置（被删除的线映射到其下方/右方最近保留线）
    const targetOf = (map, src, n) => {
      for (let s = src; s < n; s++) {
        const t = map.indexOf(s);
        if (t >= 0) return t;
      }
      return map.length;
    };
    const shiftY = (y) => {
      if (y > minY + H - 1) return 0;
      const src = Math.max(0, y - minY);
      return top + targetOf(rowMap, src, H) - (minY + src);
    };
    const shiftX = (x) => {
      const src = Math.max(0, Math.min(W - 1, x - minX));
      return left + targetOf(colMap, src, W) - (minX + src);
    };
    return { layer: { rows, ox: left, oy: top }, shiftX, shiftY };
  }

  const DOZE_TICK = 400;
  const LAYER_SIG_MAP = new WeakMap();

  function computeLayersFrameIdx(layers) {
    let key = '';
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      if (!l) continue;
      let sig = LAYER_SIG_MAP.get(l);
      if (sig === undefined) {
        sig = Array.isArray(l.rows)
          ? `${l.ox || 0},${l.oy || 0},${l.grounded ? 1 : 0}:${l.rows.join('/')}`
          : String(i);
        LAYER_SIG_MAP.set(l, sig);
      }
      key += (key ? '|' : '') + sig;
    }
    return key;
  }

  function renderPixelLayers(canvas, dpr, oxGrid, oyGrid, pxSize, palette, layers, options = {}) {
    const ctx = options.ctx || canvas._ctx || (canvas._ctx = canvas.getContext('2d'));
    if (!ctx) return;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.imageSmoothingEnabled = false;

    const mirror = Boolean(options.mirror);
    // 垂直位移吸附到整格，保证方块网格不出现亚格错位
    const tyPx = Math.round(Number(options.tyPx || 0) / pxSize) * pxSize;
    const rotDeg = Number(options.rotDeg || 0);
    const clipBottomY = options.clipBottomY;
    // 兼容旧入参 sxScale/syScale：换算为 16×10 画框上的整数格增量
    const sqW =
      options.sqW !== undefined ? Math.round(options.sqW) : Math.round(16 * (Number(options.sxScale || 1) - 1));
    const sqH =
      options.sqH !== undefined ? Math.round(options.sqH) : Math.round(10 * (Number(options.syScale || 1) - 1));

    const anchorX = (oxGrid + 8) * pxSize;
    const anchorY = (oyGrid + 10) * pxSize;

    const groundedLayers = [];
    const bodyLayers = [];
    const rigidLayers = [];
    for (const layer of layers) {
      if (!layer) continue;
      if (layer.grounded) groundedLayers.push(layer);
      else if (RIGID_LAYERS.has(layer)) rigidLayers.push(layer);
      else bodyLayers.push(layer);
    }

    // 弹性层最终列表：挤压时身体合成为一张整格点阵，道具/符号整格平移随行
    let elasticLayers;
    if ((sqW || sqH) && bodyLayers.length) {
      const sq = squashLayersToGrid(bodyLayers, sqW, sqH);
      if (sq) {
        elasticLayers = [sq.layer];
        for (const r of rigidLayers) {
          const w = Math.max(1, ...r.rows.map((row) => row.length));
          // 左右边缘平移量取均值：加宽时居中符号保持居中，偏侧道具随该侧移动
          const dx = Math.round((sq.shiftX(r.ox) + sq.shiftX(r.ox + w - 1)) / 2);
          const dy = sq.shiftY(r.oy + r.rows.length - 1);
          elasticLayers.push(shiftFrame(r, dx, dy));
        }
      }
    }
    if (!elasticLayers) elasticLayers = [...bodyLayers, ...rigidLayers];
    // 保持原有绘制顺序：身体部件 → 道具 → 符号（rigid 本就位于末尾）

    ctx.save();
    if (typeof clipBottomY === 'number' && typeof ctx.clip === 'function') {
      ctx.beginPath();
      if (typeof ctx.rect === 'function') {
        ctx.rect(0, 0, cssW, clipBottomY);
      } else {
        ctx.moveTo(0, 0);
        ctx.lineTo(cssW, 0);
        ctx.lineTo(cssW, clipBottomY);
        ctx.lineTo(0, clipBottomY);
        ctx.closePath();
      }
      ctx.clip();
    }

    // 地面/背景独立层（影子、火海衬底、生长节点、地面激光、立麦架）不随挤压或歪头旋转
    if (groundedLayers.length) {
      ctx.save();
      if (mirror) {
        ctx.translate(anchorX, 0);
        ctx.scale(-1, 1);
        ctx.translate(-anchorX, 0);
      }
      drawLayerSet(ctx, oxGrid, oyGrid, pxSize, palette, groundedLayers);
      ctx.restore();
    }

    const paintElastic = (c2) => {
      c2.save();
      c2.translate(0, tyPx);
      if (mirror) {
        const flipSet = [];
        const symSet = [];
        for (const l of elasticLayers) {
          if (SYM_LAYERS.has(l)) symSet.push(l);
          else flipSet.push(l);
        }
        c2.save();
        c2.translate(anchorX, 0);
        c2.scale(-1, 1);
        c2.translate(-anchorX, 0);
        drawLayerSet(c2, oxGrid, oyGrid, pxSize, palette, flipSet, options.colorResolver || null);
        if (typeof options.overlayPainter === 'function') {
          options.overlayPainter(c2, oxGrid, oyGrid, pxSize);
        }
        c2.restore();
        if (symSet.length) {
          const placed = symSet.map((s) => {
            const w = Math.max(1, ...s.rows.map((r) => r.length));
            return { ...s, ox: 16 - (s.ox + w) };
          });
          drawLayerSet(c2, oxGrid, oyGrid, pxSize, palette, placed, options.colorResolver || null);
        }
      } else {
        drawLayerSet(c2, oxGrid, oyGrid, pxSize, palette, elasticLayers, options.colorResolver || null);
        if (typeof options.overlayPainter === 'function') {
          options.overlayPainter(c2, oxGrid, oyGrid, pxSize);
        }
      }
      if (typeof options.rimPainter === 'function') options.rimPainter(c2, cssW, oxGrid, oyGrid, pxSize);
      c2.restore();
    };

    if (!rotDeg) {
      paintElastic(ctx);
    } else {
      // 拖拽摆角：先在离屏画布上按整格绘制，再整体旋转贴图（关闭平滑，避免逐块缝隙与模糊）
      let off = canvas.__agRotOff;
      const docRef = canvas.ownerDocument;
      if (!off && docRef && typeof docRef.createElement === 'function') {
        off = docRef.createElement('canvas');
        canvas.__agRotOff = off;
      }
      const offCtx = off ? off._ctx || (off._ctx = off.getContext('2d')) : null;
      if (!offCtx) {
        ctx.translate(anchorX, anchorY);
        ctx.rotate((rotDeg * Math.PI) / 180);
        ctx.translate(-anchorX, -anchorY);
        paintElastic(ctx);
      } else {
        if (off.width !== canvas.width || off.height !== canvas.height) {
          off.width = canvas.width;
          off.height = canvas.height;
        }
        offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        offCtx.clearRect(0, 0, cssW, cssH);
        offCtx.imageSmoothingEnabled = false;
        paintElastic(offCtx);
        ctx.imageSmoothingEnabled = false;
        ctx.translate(anchorX, anchorY);
        ctx.rotate((rotDeg * Math.PI) / 180);
        ctx.translate(-anchorX, -anchorY);
        ctx.drawImage(off, 0, 0, cssW, cssH);
      }
    }
    ctx.restore();
  }

  // 可被随机眨眼覆盖眼部的姿态；小紫猫慢摆尾的姿态
  const BLINKABLE_POSES = new Set(['idle', 'walk', 'lookNod', 'readAlong', 'gaze']);
  const SLOW_TAIL_POSES = new Set(['idle', 'lookNod', 'readAlong', 'gaze']);
  // 冰晶让位：头顶已有道具的姿态不挂冰晶；居中符号出现时冰晶暂隐，仅侧边汗滴与打盹 z 可共存
  const CRYSTAL_HIDE_POSES = new Set([
    'siren', 'onFire', 'cheerSticks', 'peek', 'flat', 'rickroll', 'carry',
    'slashGoal', 'slashBoost', 'slashSchedule', 'slashGrill', 'slashLearnBulb',
  ]);
  const CRYSTAL_OK_SYMS = new Set([SYMS.sweat, SYMS.z1, SYMS.z2, SYMS.dozeZ0, SYMS.dozeZ1, SYMS.dozeZ2, SYMS.sleepBubble0, SYMS.sleepBubble1]);
  // 哈欠接伸懒腰：前 10 拍打哈欠，之后伸懒腰
  const YAWN_STRETCH_SPLIT = 10;

  // ── 紧凑数据驱动姿态配方引擎（24 个常规姿态走极简字符串表进入 LZ 池，复杂时间轴保留短函数）──
  const PLANT_STAGES_C = [[5, 'seed'], [9, 'p1'], [13, 'p2'], [17, 'p3'], [23, 'p4'], [27, 'wilt1'], [31, 'wilt2']];
  const PLANT_STAGES_K = [[5, 'seed'], [9, 'p1'], [13, 'p2'], [17, 'p3'], [23, 'p4']];
  const pickStage = (t, v, fb) => { for (const [lim, k] of t) if (v < lim) return k; return fb; };

  // DSL 字段码: sh=shadow b=body e=eyes l=legs L=clawL R=clawR a=ears w=paws t=tail 1=prop1 2=prop2 y=extraSym(无sym时) z=sink
  // 值后缀: ~f (frameMod?A:B), ~c (clipMod?A:B), ~4 (phase4 4选1), ~3 (tickIdx%3 3选1); ~ 表示 null; 前缀 C:/K: 仅限爪/猫
  const POSE_DSL_RAW =
    'flat:sh=w14,b=flat,e=flatEyes,l=~,C:L=flatLeft,C:R=flatRight,K:a=flat,K:t=curl|' +
    'dangle:sh=~,e=wide,l=dangle/flailA/dangle2/flailB~4,C:b=turnL/turnR~f,C:L=up,C:R=up,K:a=airplane,K:t=puff|' +
    'write:l=crouch,z=1,1=sheet,2=quill1/quill2~f,C:b=stand/turnR~f,C:R=write1/write2~f,K:a=stand/nod~f,K:w=write1/write2~f,K:t=sway/curl~f|' +
    'happy:e=happy,C:b=squash/stand~f,C:l=crouch/stand~f,C:L=up,C:R=up,K:a=nod/stand~f,K:w=cheer,K:t=up/puff~f|' +
    'pet:e=happy,C:b=squash/stand~f,C:l=crouch/stand~f,C:L=up,C:R=up,K:a=nod/stand~f,K:w=cheer,K:t=up/puff~f|' +
    'jiggle:l=flailA/flailB/flailC~3,e=happy,C:L=up,C:R=up,K:a=stand,K:t=puff|' +
    'peek:sh=~,b=peek,l=~,C:L=peekGrip,C:R=peekGrip,K:a=peek,K:e=peekOpen,K:w=peekGrip,K:t=loaf|' +
    'angry:b=squash/stand~f,l=walkA/walkB~f,C:e=squint,K:a=airplane,K:e=wide,K:t=puff|' +
    'groom:K:a=nod,K:e=shut,K:w=groom1/groom2~f|' +
    'tilt:b=turnL,e=half,K:a=nod,K:t=curl|' +
    'wow:e=wide,C:b=tall,C:L=up,C:R=up,K:a=stand,K:w=up,K:t=puff|' +
    'sulk:b=turnL,e=squint/shut~c,l=tuck,y=vein,C:L=front,C:R=front,K:a=airplane,K:t=curl|' +
    'polish:b=turnR,1=mug,2=cloth1/cloth2~c,C:R=front,K:a=stand|' +
    'chaseDot:K:a=airplane,K:b=squash/stretch~c,K:e=wide,K:l=walkA/stand~c,K:t=puff,K:y=spark|' +
    'stretch:e=shut,y=tilde,C:b=tall,C:l=stand,C:L=up,C:R=up,K:a=stand,K:b=stretch,K:t=puff|' +
    'spinHop:b=turnR/stand/turnL/squash~4,e=open/open/open/happy~4,l=tuck/tuck/tuck/crouch~4,K:t=puff|' +
    'cheerSticks:b=squash/stand~f,l=crouch/stand~f,e=happy,1=stickLT/stickUp/stickRT/stickUp~4,2=stickRTM/stickUpM/stickLTM/stickUpM~4,y=note,C:L=up,C:R=up,K:a=stand/nod~c,K:w=up,K:t=puff|' +
    'chatGreet:b=stand/squash~c,e=happy,y=heart/note~c,C:L=up/stub~c,K:a=nod,K:t=up/puff~c|' +
    'balance:e=wide,C:L=open,C:R=open,K:a=airplane,K:w=cheer,K:t=puff|' +
    'worry:e=half/squint~c,l=tuck,y=sweat,C:L=front,C:R=front,K:a=airplane,K:t=curl|' +
    'salute:e=happy,y=spark,C:R=up,K:a=stand,K:w=upR,K:t=up|' +
    'carry:C:e=up,C:L=open,C:R=open|' +
    'slashTeam:e=happy,1=flag0/flag1~c,y=spark,C:R=up,K:a=stand,K:w=upR,K:t=puff|' +
    'slashBrowser:b=leanR/turnR~c,1=shadesProp,2=surfboard,y=spark,K:a=airplane,K:t=puff|' +
    'slashGrill:e=squint,1=spotlight,2=micHand,y=q,C:R=front,K:a=nod,K:w=write1,K:t=curl|' +
    'slashLearnBook:e=half/open~c,1=book0/book1~c,y=note,C:R=front,K:a=nod,K:w=write1,K:t=sway|' +
    'nightSip:e=half/happy~c,1=hotCup0/hotCup1~c,y=tilde,C:R=front,K:a=nod,K:t=curl|' +
    'feedCoffee:e=happy,1=hotCup0/hotCup1~c,y=heart,C:R=front,K:a=nod/stand~f,K:t=up/puff~f';

  const DSL_KEY_MAP = { sh: 'shadow', b: 'body', e: 'eyes', l: 'legs', L: 'clawL', R: 'clawR', a: 'ears', w: 'paws', t: 'tail', 1: 'prop1', 2: 'prop2', y: 'extraSym', z: 'sink' };
  const POSE_DSL = Object.create(null);
  for (const seg of POSE_DSL_RAW.split('|')) {
    const idx = seg.indexOf(':');
    POSE_DSL[seg.slice(0, idx)] = seg.slice(idx + 1).split(',').map((kv) => {
      let scope = 0;
      let rest = kv;
      if (rest[1] === ':') { scope = rest[0] === 'K' ? 2 : 1; rest = rest.slice(2); }
      const eq = rest.indexOf('=');
      const prop = DSL_KEY_MAP[rest.slice(0, eq)];
      const rawV = rest.slice(eq + 1);
      const tIdx = rawV.indexOf('~');
      if (rawV === '~') return [scope, prop, 0, null];
      if (tIdx >= 0) return [scope, prop, rawV.slice(tIdx + 1), rawV.slice(0, tIdx).split('/')];
      return [scope, prop, 0, prop === 'sink' ? +rawV : rawV];
    });
  }

  function applyDslPose(s, rules, c) {
    for (const [sc, prop, mode, val] of rules) {
      if ((sc === 1 && c.isCat) || (sc === 2 && !c.isCat)) continue;
      let v = val;
      if (mode === 'f') v = val[c.frameMod ? 0 : 1];
      else if (mode === 'c') v = val[c.clipMod ? 0 : 1];
      else if (mode === '4') v = val[c.phase4];
      else if (mode === '3') v = val[c.tickIdx % 3];
      if (prop === 'extraSym') { if (!c.sym) s.extraSym = v; }
      else s[prop] = v;
    }
  }

  const POSE_RECIPES = {
    idle: null,
    squash(s, { isCat, p }) {
      s.shadow = 'w14'; s.body = 'squash'; s.legs = 'crouch';
      if (isCat) { s.ears = 'nod'; s.eyes = 'half'; } else s.eyes = shiftFrame(p.eyes.squint, 0, 1);
    },
    loaf(s, { isCat, poseKey, phase4, tickIdx }) {
      if (!isCat) return;
      s.shadow = 'w14'; s.ears = 'loaf'; s.body = 'loaf'; s.legs = null;
      s.eyes = poseKey === 'sleep' || phase4 === 3 ? 'loafShut' : 'loafHalf';
      s.tail = poseKey === 'sleep' ? 'loaf' : Math.floor(tickIdx / 4) % 2 ? 'loaf' : 'curl';
    },
    sleep(s, c) { if (c.isCat) POSE_RECIPES.loaf(s, c); else { s.body = 'squash'; s.eyes = 'shut'; s.legs = 'tuck'; } },
    walk(s, { isCat, tickIdx, opts }) {
      const b = Math.floor(tickIdx / 2) % 4;
      s.legs = ['walkA', 'stand', 'walkB', 'stand'][b];
      if (b % 2 === 0) s.sink = 1;
      if (isCat) s.tail = b < 2 ? 'up' : 'sway'; else s.body = opts.dir === 'left' ? 'turnL' : 'turnR';
    },
    peek(s, c) { applyDslPose(s, POSE_DSL.peek, c); if (!c.isCat) s.eyes = c.phase4 === 3 ? 'peekHalf' : 'peekOpen'; },
    polish(s, c) { applyDslPose(s, POSE_DSL.polish, c); s.eyes = c.phase4 === 2 ? 'happy' : 'open'; },
    chaseDot(s, c) { if (!c.isCat) return; applyDslPose(s, POSE_DSL.chaseDot, c); s.prop1 = 'laser' + (c.lt % 3); },
    eat(s, { isCat, lt, clipMod, sym }) {
      const d = lt > (isCat ? 20 : 22), em = lt > (isCat ? 18 : 20);
      s.body = d ? 'stand' : 'squash'; s.legs = d ? 'stand' : 'crouch';
      s.eyes = d ? 'happy' : isCat ? 'half' : clipMod ? 'half' : 'open';
      s.prop1 = em ? 'bowlEmpty' : 'bowl'; s.prop2 = em ? null : clipMod ? 'chop2' : 'chop1';
      s.extraSym = d ? SYMS.heart : sym; if (isCat) s.ears = 'nod';
    },
    eatFish(s, { isCat, lt, clipMod, sym }) {
      const d = lt > 20;
      s.body = d ? 'stand' : 'squash'; s.legs = d ? 'stand' : 'crouch';
      s.eyes = d ? 'happy' : isCat ? (clipMod ? 'half' : 'open') : 'half';
      s.prop1 = lt > 18 ? 'fishBone' : 'fishDish'; s.extraSym = d ? SYMS.heart : sym;
      if (isCat) { s.ears = d ? 'stand' : 'nod'; s.tail = clipMod ? 'sway' : 'up'; }
    },
    catStretch(s, { isCat, lt }) {
      if (!isCat) return;
      if (lt >= 18) { s.ears = 'loaf'; s.body = 'loaf'; s.eyes = 'loafHalf'; s.legs = null; s.tail = 'loaf'; s.extraSym = SYMS.z1; }
      else { s.ears = 'nod'; s.body = 'stretch'; s.eyes = 'shut'; s.tail = 'up'; s.extraSym = SYMS.tilde; }
    },
    letter(s, { isCat, lt, sym }) {
      s.body = 'turnR'; s.eyes = lt >= 10 && lt <= 18 ? 'half' : lt > 18 ? 'happy' : 'open';
      s.prop1 = lt < 6 ? 'envS' : lt < 11 ? 'envSOpen' : 'letter'; s.extraSym = lt > 18 ? SYMS.heart : sym;
      if (isCat) s.ears = 'nod';
    },
    plant(s, { isCat, lt, sym, p }) {
      s.legs = lt < 8 ? 'crouch' : 'stand';
      if (isCat) {
        s.ears = 'nod'; s.body = lt < 8 ? 'squash' : 'stand'; s.eyes = lt >= 16 && lt <= 24 ? 'happy' : 'open';
        s.prop1 = pickStage(PLANT_STAGES_K, lt, 'wilt2'); s.prop2 = lt >= 17 && lt < 21 ? 'd1' : null;
      } else {
        s.body = lt < 8 ? 'squash2' : 'stand'; s.clawR = lt < 8 ? 'low' : 'stub';
        s.eyes = lt < 8 ? shiftFrame(p.eyes.open, 0, 3) : lt >= 16 && lt <= 24 ? 'happy' : lt > 24 ? 'half' : 'open';
        s.prop1 = pickStage(PLANT_STAGES_C, lt, 'wilt3');
        s.prop2 = lt >= 17 && lt < 21 ? 'd1' : lt >= 21 && lt < 23 ? 'd2' : null;
        s.extraSym = lt > 28 ? SYMS.sweat : sym;
      }
    },
    butterfly(s, { isCat, lt, clipMod, sym }) {
      const lp = lt % 16 >= 8, r = lt >= 24 && lt <= 30;
      s.eyes = r ? 'happy' : lp ? 'openL' : 'openR';
      s.prop1 = r ? 'bfRest' : lp ? (clipMod ? 'bfLeftUp' : 'bfLeftDn') : clipMod ? 'bfUp' : 'bfDn';
      s.extraSym = r ? SYMS.spark : sym;
      if (isCat) { s.ears = r ? 'nod' : 'stand'; s.tail = clipMod ? 'sway' : 'puff'; } else s.clawR = lt % 10 < 5 ? 'reach1' : 'stub';
    },
    onFire(s, { lt }) {
      const cool = lt >= 30;
      s.backProp = cool ? null : 'fire' + (lt < 5 ? 1 : lt < 10 ? 2 : 3) + (lt % 4);
      s.prop1 = 'mug'; s.eyes = 'open'; s.extraSym = cool ? PROPS.smoke : SYMS['fireSpark' + (lt % 3)];
    },
    rickroll(s, { isCat, lt, clipMod, phase4, sym }) {
      s.body = ['leanR', 'squash', 'leanL', 'stand'][phase4]; s.eyes = clipMod ? 'happy' : 'open';
      s.prop1 = lt > 33 ? 'micSink2' : lt > 30 ? 'micSink1' : 'micStand'; s.extraSym = sym || SYMS.note;
      if (isCat) { s.ears = clipMod ? 'stand' : 'nod'; s.paws = 'cheer'; }
      else { s.clawL = clipMod ? 'up' : 'stub'; s.clawR = clipMod ? 'stub' : 'up'; }
    },
    siren(s, { isCat, lt, clipMod }) {
      const x = Math.floor(lt / 6) % 2 ? 'B' : '', i = lt % 4, bn = ['beamL', 'beamF', 'beamR', null][i];
      s.body = clipMod ? 'squash' : 'stand'; s.eyes = 'wide';
      s.prop1 = ['sirenL', 'sirenF', 'sirenR', 'sirenDim'][i] + x; s.prop2 = bn ? bn + x : null;
      s.extraSym = clipMod ? SYMS.bang : SYMS.sweat; if (isCat) s.ears = 'airplane';
    },
    lookNod(s, { isCat, lt, opts, sym }) {
      const fL = opts.dir === 'left', at = Number(opts.clipParam ?? (isCat ? 9 : 5)), nod = lt >= at && lt < at + 2;
      s.body = fL ? 'turnL' : 'turnR'; s.eyes = nod ? 'happy' : fL ? 'openL' : 'openR';
      if (nod) { s.sink = 1; s.legs = 'crouch'; }
      s.extraSym = sym || (lt >= at + 2 && lt < at + 8 ? (isCat ? SYMS.heart : SYMS.note) : null);
    },
    readAlong(s, { isCat, lt, sym }) {
      const on = lt >= 2 && lt < 14 && (lt - 2) % 4 < 2;
      s.eyes = on ? 'half' : 'open'; if (on) { s.sink = 1; s.legs = 'crouch'; }
      s.extraSym = sym || (isCat ? null : SYMS.note);
    },
    yawn(s, { isCat, lt, sym }) {
      if (lt < 2) { if (isCat) s.ears = 'nod'; s.eyes = 'half'; s.mouth = 'small'; }
      else if (lt < 9) {
        s.eyes = 'shut'; s.mouth = 'yawn'; s.extraSym = sym || (lt >= 4 ? SYMS.tilde : null);
        if (isCat) { s.ears = 'nod'; s.tail = 'puff'; } else { s.body = 'tall'; s.clawL = 'up'; s.clawR = 'up'; }
      } else { s.eyes = 'half'; if (isCat) s.tail = 'curl'; }
    },
    wave(s, { isCat, lt, sym }) {
      const w = lt < 12, b = Math.floor(lt / 2) % 2; s.eyes = 'happy';
      if (isCat) { s.ears = 'nod'; s.paws = w && !b ? 'upR' : 'none'; s.extraSym = sym || SYMS.note; }
      else { s.clawR = w ? (b ? 'waveOut' : 'up') : 'stub'; s.extraSym = sym || (w ? SYMS.note : SYMS.heart); }
    },
    gaze(s, { isCat, opts }) {
      const fL = opts.dir === 'left', up = opts.clipParam === 1;
      s.body = fL ? 'turnL' : 'turnR'; s.eyes = up ? (fL ? 'upL' : 'upR') : fL ? 'openL' : 'openR';
      if (isCat && (opts.earTwitch === 'L' || opts.earTwitch === 'R')) s.ears = opts.earTwitch === 'L' ? 'twitchL' : 'twitchR';
    },
    slashPlan(s, { isCat, lt, sym }) {
      s.body = 'turnR'; s.prop1 = 'blueprint';
      s.eyes = lt >= 14 ? 'happy' : 'open';
      if (lt >= 8 && lt < 11) { s.sink = 1; s.legs = 'crouch'; }
      s.extraSym = sym || (lt >= 14 ? SYMS.spark : SYMS.note);
      if (isCat) { s.ears = 'nod'; s.paws = 'write1'; s.tail = 'sway'; } else s.clawR = 'front';
    },
    slashGoal(s, { isCat, lt, clipMod, sym }) {
      const charge = lt < 8;
      s.backProp = clipMod ? 'goalFlame1' : 'goalFlame0';
      s.body = charge ? 'squash' : 'stand'; s.legs = charge ? 'crouch' : 'stand';
      s.eyes = lt >= 14 ? 'happy' : 'squint'; s.prop1 = 'headband';
      s.extraSym = sym || SYMS.spark;
      if (isCat) { s.ears = charge ? 'nod' : 'stand'; s.paws = charge ? 'cheer' : 'up'; s.tail = 'puff'; }
      else { s.clawL = charge ? 'front' : 'up'; s.clawR = charge ? 'front' : 'up'; }
    },
    slashBoost(s, { isCat, phase4, sym }) {
      s.eyes = 'wide'; s.prop1 = 'goggles';
      s.prop2 = ['iceCrystal', 'iceCrystalSpin', 'iceCrystalHi', 'iceCrystalSpin'][phase4];
      s.extraSym = sym || SYMS.spark;
      if (isCat) { s.ears = 'stand'; s.paws = 'up'; s.tail = 'puff'; } else { s.clawL = 'up'; s.clawR = 'up'; }
    },
    slashBrowser(s, c) {
      applyDslPose(s, POSE_DSL.slashBrowser, c);
      s.backProp = c.clipMod ? 'waveSplash1' : 'waveSplash0';
    },
    slashCompact(s, { isCat, lt, clipMod, sym }) {
      const done = lt >= 16;
      s.body = done ? 'stand' : clipMod ? 'squash' : 'leanR';
      s.legs = done ? 'stand' : clipMod ? 'crouch' : 'stand';
      s.eyes = done ? 'happy' : 'squint';
      s.prop1 = lt < 9 ? 'cloudBig' : lt < 16 ? 'cloudMid' : 'cubeGlow';
      s.extraSym = sym || (done ? SYMS.spark : null);
      if (isCat) { s.ears = done ? 'stand' : 'nod'; s.paws = done ? 'up' : 'cheer'; s.tail = done ? 'puff' : 'sway'; }
      else { s.clawL = done ? 'up' : 'front'; s.clawR = done ? 'up' : 'front'; }
    },
    slashSchedule(s, { isCat, lt, clipMod, sym }) {
      const nod = lt >= 10 && lt < 14;
      s.prop1 = clipMod ? 'hourglass1' : 'hourglass0';
      s.prop2 = 'pocketWatch';
      s.eyes = nod ? 'happy' : clipMod ? 'half' : 'open';
      if (nod) { s.sink = 1; s.legs = 'crouch'; }
      s.extraSym = sym || SYMS.note;
      if (isCat) { s.ears = 'nod'; s.tail = 'sway'; } else s.clawR = 'front';
    },
    slashLearnBulb(s, { isCat, lt, sym }) {
      const lit = lt >= 9;
      s.prop1 = lit ? 'bulbOn' : 'bulbOff';
      s.eyes = lit ? 'happy' : 'half';
      s.extraSym = sym || (lit ? SYMS.spark : SYMS.q);
      if (isCat) { s.ears = lit ? 'stand' : 'nod'; s.tail = lit ? 'puff' : 'curl'; }
      else if (lit) s.clawR = 'up';
    },
    feedDonut(s, { isCat, lt, clipMod, sym }) {
      s.body = clipMod ? 'squash' : 'stand'; s.legs = clipMod ? 'crouch' : 'stand';
      s.eyes = 'happy'; s.prop1 = lt < 10 ? 'donut0' : 'donut1';
      s.extraSym = sym || SYMS.heart;
      if (isCat) { s.ears = clipMod ? 'nod' : 'stand'; s.tail = clipMod ? 'up' : 'puff'; } else s.clawR = 'front';
    },
  };

  const ALL_POSE_KEYS = Array.from(new Set([...Object.keys(POSE_DSL), ...Object.keys(POSE_RECIPES), 'yawnStretch']));

  function resolvePart(dict, val) {
    return typeof val === 'string' ? dict[val] || null : val || null;
  }

  function buildClipLayers(kind, poseKey, tickIdx, opts = {}) {
    if (poseKey === 'yawnStretch') {
      const lt = Number(opts.clipTick ?? tickIdx);
      const first = lt < YAWN_STRETCH_SPLIT;
      return buildClipLayers(kind, first ? 'yawn' : 'stretch', tickIdx, {
        ...opts,
        clipTick: first ? lt : lt - YAWN_STRETCH_SPLIT,
      });
    }
    const isCat = kind === 'cat';
    const p = isCat ? CAT_PARTS : CLAWD_PARTS;
    const frameMod = tickIdx % 2;
    const phase4 = tickIdx % 4;
    const sym = opts.sym ? SYMS[opts.sym] : null;
    const lt = Number(opts.clipTick ?? tickIdx);
    const clipMod = lt % 2;
    const blinkStage = opts.blinkStage || (opts.blink ? 'closed' : null);

    const s = {
      backProp: null,
      shadow: opts.noShadow ? null : 'w12',
      body: 'stand',
      eyes: opts.eyeScan === -1 ? 'openL' : opts.eyeScan === 1 ? 'openR' : 'open',
      legs: 'stand',
      mouth: null,
      prop1: null,
      prop2: null,
      extraSym: sym,
      sink: 0,
      clawL: isCat ? null : 'stub',
      clawR: isCat ? null : 'stub',
      ears: isCat ? 'stand' : null,
      paws: isCat ? 'none' : null,
      tail: isCat ? ['up', 'sway', 'curl', 'up'][phase4] : null,
    };

    const ctx = { isCat, p, poseKey, tickIdx, lt, frameMod, clipMod, phase4, opts, sym };
    if (Object.prototype.hasOwnProperty.call(POSE_RECIPES, poseKey)) {
      if (POSE_RECIPES[poseKey]) POSE_RECIPES[poseKey](s, ctx);
    } else if (POSE_DSL[poseKey]) {
      applyDslPose(s, POSE_DSL[poseKey], ctx);
    }

    if (isCat && s.body === 'squash' && s.ears === 'stand') s.ears = 'nod';
    if (isCat && SLOW_TAIL_POSES.has(poseKey)) {
      s.tail = opts.reduced ? 'up' : Math.floor(tickIdx / 3) % 2 ? 'sway' : 'up';
    }
    if (poseKey === 'idle') {
      if (isCat) {
        if (opts.earTwitch === 'L') s.ears = 'twitchL';
        else if (opts.earTwitch === 'R') s.ears = 'twitchR';
      } else {
        if (opts.clawSnap === 'L') s.clawL = 'open';
        else if (opts.clawSnap === 'R') s.clawR = 'open';
      }
      if (opts.breath) {
        s.sink = 1;
        s.legs = 'crouch';
        if (s.shadow) s.shadow = 'w14';
      }
    }

    let backProp = resolvePart(PROPS, s.backProp);
    let shadow = resolvePart(p.shadow, s.shadow);
    let legs = resolvePart(p.legs, s.legs);
    let body = resolvePart(p.body, s.body);
    let mouth = resolvePart(p.mouth, s.mouth);
    let eyes = resolvePart(p.eyes, s.eyes);
    let prop1 = resolvePart(PROPS, s.prop1);
    let prop2 = resolvePart(PROPS, s.prop2);
    let extraSym = resolvePart(SYMS, s.extraSym) || (typeof s.extraSym === 'object' ? s.extraSym : null);

    if (blinkStage && BLINKABLE_POSES.has(poseKey)) {
      const eyeDx = eyes === p.eyes.open ? 0 : eyes === p.eyes.openL ? -1 : eyes === p.eyes.openR ? 1 : null;
      if (eyeDx !== null) eyes = shiftFrame(blinkStage === 'half' ? p.eyes.half : p.eyes.blink, eyeDx, 0);
    }

    if (!isCat) {
      let clawL = resolvePart(p.clawL, s.clawL);
      let clawR = resolvePart(p.clawR, s.clawR);
      if (s.body === 'squash') {
        if (clawL === p.clawL.up) clawL = shiftFrame(clawL, 0, 2);
        if (clawR === p.clawR.up) clawR = shiftFrame(clawR, 0, 2);
      }
      if (s.sink) {
        body = shiftFrame(body, 0, s.sink);
        eyes = shiftFrame(eyes, 0, s.sink);
        clawL = shiftFrame(clawL, 0, s.sink);
        clawR = shiftFrame(clawR, 0, s.sink);
        mouth = shiftFrame(mouth, 0, s.sink);
      }
      let crystal = null;
      if (opts.crystal && !CRYSTAL_HIDE_POSES.has(poseKey) && !(extraSym && !CRYSTAL_OK_SYMS.has(extraSym))) {
        crystal = opts.crystalBob ? PROPS.iceCrystalHi : PROPS.iceCrystal;
      }
      return [backProp, shadow, legs, body, mouth, eyes, clawL, clawR, prop1, prop2, crystal, extraSym].filter(Boolean);
    }

    let ears = resolvePart(p.ears, s.ears);
    let paws = resolvePart(p.paws, s.paws);
    let tail = resolvePart(p.tail, s.tail);
    if (s.sink) {
      body = shiftFrame(body, 0, s.sink);
      ears = shiftFrame(ears, 0, s.sink);
      eyes = shiftFrame(eyes, 0, s.sink);
      paws = shiftFrame(paws, 0, s.sink);
      tail = shiftFrame(tail, 0, s.sink);
      mouth = shiftFrame(mouth, 0, s.sink);
    }
    return [backProp, shadow, tail, legs, body, mouth, ears, eyes, paws, prop1, prop2, extraSym].filter(Boolean);
  }

  // 随机眨眼过渡：1×2 竖瞳 → 1×1 → 闭（s 暗面横线）→ 1×1 → 1×2
  const BLINK_SINGLE = ['half', 'closed', 'half'];
  const BLINK_DOUBLE = ['half', 'closed', 'half', 'closed', 'half'];
  // 迷你蟹眨眼帧缓存：把竖瞳 o 替换为暗面色 s
  const MINI_BLINK_CACHE = new WeakMap();
  function miniBlinkFrame(fr) {
    let out = MINI_BLINK_CACHE.get(fr);
    if (!out) {
      out = recolorFrame(fr, { o: 's' });
      MINI_BLINK_CACHE.set(fr, out);
    }
    return out;
  }

  // ── 纯几何碰撞与擦肩经过判定（供主宠自主散步 / 拖拽 / 单元契约共测） ──
  const CRAB_ENCOUNTER_SEQ = new WeakMap();

  function classifyPairEncounter(opts = {}) {
    const {
      xA = 0,
      yA = 0,
      walkingA = false,
      dirA = 1,
      xB = 0,
      yB = 0,
      walkingB = false,
      dirB = -1,
      contactDist = 42,
      verticalTol = 22,
    } = opts;
    if (Math.abs(yA - yB) > verticalTol) return null;
    const dx = xB - xA;
    if (Math.abs(dx) >= contactDist) return null;
    if (!walkingA && !walkingB) return null;
    const sign = dx >= 0 ? 1 : -1;
    const dA = dirA >= 0 ? 1 : -1;
    const dB = dirB >= 0 ? 1 : -1;

    // 1. 双向相向逼近 → 迎面轻撞 (bump)
    if (walkingA && walkingB && dA * sign > 0 && dB * sign < 0) {
      return { kind: 'bump', sign };
    }
    // 2. 单方朝静止伙伴靠近且尚未完全跨过 → 擦肩经过 (passBy)
    if (walkingA && !walkingB && dA * sign > 0 && Math.abs(dx) >= 10) {
      return { kind: 'passBy', mover: 'A', stationary: 'B', dir: dA };
    }
    if (walkingB && !walkingA && dB * sign < 0 && Math.abs(dx) >= 10) {
      return { kind: 'passBy', mover: 'B', stationary: 'A', dir: dB };
    }
    // 3. 同向行走且后方追上前车 → 超车擦肩经过 (passBy)
    if (walkingA && walkingB && dA === dB && Math.abs(dx) >= 8) {
      const rearIsA = dA > 0 ? xA < xB : xA > xB;
      return {
        kind: 'passBy',
        mover: rearIsA ? 'A' : 'B',
        stationary: rearIsA ? 'B' : 'A',
        dir: dA,
      };
    }
    return null;
  }

  // ── 迷你三蟹舞台走廊漫步与碰钳/翻越经过逻辑 ─────────────────────────────
  function stepMiniCrabCorridor(crabs, opts = {}) {
    const minX = Number.isFinite(opts.minX) ? opts.minX : 2;
    const maxX = Math.max(minX + 16, Number.isFinite(opts.maxX) ? opts.maxX : 220);
    const contactDist = Number.isFinite(opts.contactDist) ? opts.contactDist : 26;
    const nowTick = Number.isFinite(opts.nowTick) ? opts.nowTick : 0;
    const events = [];
    if (!Array.isArray(crabs) || crabs.length === 0) return events;

    let pairCounts = CRAB_ENCOUNTER_SEQ.get(crabs);
    if (!pairCounts) {
      pairCounts = new Map();
      CRAB_ENCOUNTER_SEQ.set(crabs, pairCounts);
    }

    // 1. 自由状态下的迷你蟹匀速漫步 + 走廊边界折返
    for (const mc of crabs) {
      if (!mc || mc.act) continue;
      if (!Number.isFinite(mc.px)) mc.px = Number.isFinite(mc.x) ? mc.x : minX;
      if ((mc.bumpUntilTick || -1) > nowTick) {
        mc.px = Math.max(minX, Math.min(maxX, mc.px));
        continue;
      }
      const spd = Number.isFinite(mc.speed) ? mc.speed : 1.0;
      mc.dir = mc.dir >= 0 ? 1 : -1;
      let next = mc.px + mc.dir * spd;
      if (next <= minX) {
        next = minX;
        mc.dir = 1;
      } else if (next >= maxX) {
        next = maxX;
        mc.dir = -1;
      }
      mc.px = next;
    }

    // 2. 两两检测接触：迎面交替触发 crabBump / crabPass；同向追及触发 crabPass
    for (let i = 0; i < crabs.length; i++) {
      const a = crabs[i];
      if (!a || a.act || (a.cooldownTick || -99) > nowTick) continue;
      for (let j = i + 1; j < crabs.length; j++) {
        const b = crabs[j];
        if (!b || b.act || (b.cooldownTick || -99) > nowTick) continue;
        const dx = b.px - a.px;
        if (Math.abs(dx) >= contactDist) continue;
        const sign = dx >= 0 ? 1 : -1;
        const dA = a.dir >= 0 ? 1 : -1;
        const dB = b.dir >= 0 ? 1 : -1;
        const headOn = dA * sign > 0 && dB * sign < 0;
        const sameDirChase = dA === dB && Math.abs(dx) >= 4;
        if (!headOn && !sameDirChase) continue;

        if (headOn) {
          const pairKey = [a.id, b.id].sort().join('-');
          const count = pairCounts.get(pairKey) || 0;
          pairCounts.set(pairKey, count + 1);
          if (count % 2 === 0) {
            a.px = Math.max(minX, Math.min(maxX, a.px - sign * 3));
            b.px = Math.max(minX, Math.min(maxX, b.px + sign * 3));
            a.dir = -sign;
            b.dir = sign;
            a.bumpUntilTick = nowTick + 3;
            b.bumpUntilTick = nowTick + 3;
            a.cooldownTick = nowTick + 8;
            b.cooldownTick = nowTick + 8;
            events.push({ type: 'crabBump', pair: `${a.id}-${b.id}` });
          } else {
            const vaulter = a;
            const yielded = b;
            vaulter.px = Math.max(minX, Math.min(maxX, vaulter.px + vaulter.dir * 8));
            vaulter.passHopUntilTick = nowTick + 4;
            yielded.blinkAt = nowTick;
            a.cooldownTick = nowTick + 9;
            b.cooldownTick = nowTick + 9;
            events.push({ type: 'crabPass', pair: `${vaulter.id}-${yielded.id}` });
          }
        } else {
          const rearIsA = dA > 0 ? a.px < b.px : a.px > b.px;
          const vaulter = rearIsA ? a : b;
          const yielded = rearIsA ? b : a;
          vaulter.px = Math.max(minX, Math.min(maxX, vaulter.px + vaulter.dir * 8));
          vaulter.passHopUntilTick = nowTick + 4;
          yielded.blinkAt = nowTick;
          a.cooldownTick = nowTick + 9;
          b.cooldownTick = nowTick + 9;
          events.push({ type: 'crabPass', pair: `${vaulter.id}-${yielded.id}` });
        }
        break;
      }
    }
    return events;
  }

  // ── Google 四色全息棱镜虹彩光谱插值 & 5 宠一维刚体防重叠 & 遇障决策纯函数 ──────
  const CHROMA_STOPS = [
    [0x42, 0x85, 0xf4], // #4285F4 Cobalt Blue
    [0x9b, 0x72, 0xcb], // #9B72CB Amethyst Iris
    [0xea, 0x43, 0x35], // #EA4335 Coral Red
    [0xfb, 0xbc, 0x04], // #FBBC04 Warm Amber
    [0x5c, 0xc6, 0xfc], // #5CC6FC Sky Cyan
  ];
  const CHROMA_HEX = ['#4285F4', '#9B72CB', '#EA4335', '#FBBC04', '#5CC6FC'];

  const CHROMA_CACHE = Object.create(null);

  function evalChromaColorAt(gx, gy, phase = 0, isShadow = false) {
    const sum = gx + gy;
    const pNorm = ((phase % 1) + 1) % 1;
    const pStep = Math.round(pNorm * 12);
    const cacheable = Number.isInteger(sum) && sum >= -64 && sum <= 128 && Math.abs(pNorm * 12 - pStep) < 1e-5;
    let cKey = 0;
    if (cacheable) {
      cKey = ((pStep % 12) << 9) | ((sum + 64) << 1) | (isShadow ? 1 : 0);
      const hit = CHROMA_CACHE[cKey];
      if (hit) return hit;
    }
    const raw = (sum * 0.068 - (cacheable ? (pStep % 12) / 12 : phase)) % 1;
    const u = (raw < 0 ? raw + 1 : raw) * CHROMA_STOPS.length;
    const i0 = Math.floor(u) % CHROMA_STOPS.length;
    const i1 = (i0 + 1) % CHROMA_STOPS.length;
    const t = u - Math.floor(u);
    const s = t * t * (3 - 2 * t);
    const c0 = CHROMA_STOPS[i0];
    const c1 = CHROMA_STOPS[i1];
    let r = c0[0] + (c1[0] - c0[0]) * s;
    let g = c0[1] + (c1[1] - c0[1]) * s;
    let b = c0[2] + (c1[2] - c0[2]) * s;
    if (isShadow) {
      r = r * 0.68 + 18 * 0.14;
      g = g * 0.68 + 22 * 0.14;
      b = b * 0.72 + 40 * 0.14;
    }
    const hex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    const out = `#${hex(r)}${hex(g)}${hex(b)}`;
    if (cacheable) CHROMA_CACHE[cKey] = out;
    return out;
  }

  /**
   * 一维地面刚体防重叠与向空旷侧推挤分离求解器
   * 输入 bodies: Array<{ id: string, cx: number, halfW: number, locked?: boolean }>
   * 原地更新每个非 locked 角色的 cx，保证净间距 >= minGap（默认 6px）
   */
  function resolveGroundSeparation(bodies, stageMinX = 12, stageMaxX = 708, minGap = 6) {
    if (!Array.isArray(bodies) || bodies.length < 2) {
      if (Array.isArray(bodies) && bodies.length === 1 && !bodies[0].locked) {
        const b = bodies[0];
        b.cx = Math.max(stageMinX + b.halfW, Math.min(stageMaxX - b.halfW, b.cx));
      }
      return bodies;
    }
    const span = Math.max(40, stageMaxX - stageMinX);
    const totalHalfW = bodies.reduce((s, b) => s + b.halfW * 2, 0);
    const maxFeasibleGap = bodies.length > 1 ? Math.max(0, (span - totalHalfW) / (bodies.length - 1)) : minGap;
    const effGap = Math.min(minGap, maxFeasibleGap);

    const ordered = bodies
      .map((b, idx) => ({ b, idx }))
      .sort((a, z) => (Math.abs(a.b.cx - z.b.cx) > 0.01 ? a.b.cx - z.b.cx : a.idx - z.idx))
      .map((x) => x.b);

    for (const b of ordered) {
      if (!b.locked) {
        b.cx = Math.max(stageMinX + b.halfW, Math.min(stageMaxX - b.halfW, b.cx));
      }
    }

    for (let iter = 0; iter < 6; iter++) {
      let moved = false;
      for (let i = 0; i < ordered.length - 1; i++) {
        const left = ordered[i];
        const right = ordered[i + 1];
        const req = left.halfW + right.halfW + effGap;
        const dist = right.cx - left.cx;
        if (dist >= req - 0.01) continue;
        const overlap = req - dist;
        moved = true;
        if (left.locked && right.locked) continue;
        if (left.locked) {
          right.cx += overlap;
        } else if (right.locked) {
          left.cx -= overlap;
        } else {
          const leftRoom = Math.max(0, left.cx - left.halfW - stageMinX);
          const rightRoom = Math.max(0, stageMaxX - (right.cx + right.halfW));
          const sumRoom = leftRoom + rightRoom;
          const wRight = sumRoom > 1 ? rightRoom / sumRoom : 0.5;
          left.cx -= overlap * (1 - wRight);
          right.cx += overlap * wRight;
        }
        if (!left.locked) left.cx = Math.max(stageMinX + left.halfW, Math.min(stageMaxX - left.halfW, left.cx));
        if (!right.locked) right.cx = Math.max(stageMinX + right.halfW, Math.min(stageMaxX - right.halfW, right.cx));
      }
      // 二次单向扫掠消除靠墙挤压残余
      for (let i = 0; i < ordered.length - 1; i++) {
        const l = ordered[i];
        const r = ordered[i + 1];
        const req = l.halfW + r.halfW + effGap;
        if (r.cx - l.cx < req && !r.locked) {
          r.cx = Math.min(stageMaxX - r.halfW, l.cx + req);
        }
      }
      for (let i = ordered.length - 1; i > 0; i--) {
        const l = ordered[i - 1];
        const r = ordered[i];
        const req = l.halfW + r.halfW + effGap;
        if (r.cx - l.cx < req && !l.locked) {
          l.cx = Math.max(stageMinX + l.halfW, r.cx - req);
        }
      }
      if (!moved) break;
    }
    return bodies;
  }

  /**
   * 散步遇障三种灵动越障决策器：
   * - 'leapfrog': 抛物线撑跳越过对方头顶（峰值 ~26px）落到另一侧继续走
   * - 'autoPerch': 顺势轻跳坐上对方（或塔顶）头顶搭便车
   * - 'greetTurn': 驻足眨眼/拉墨镜偷瞄/挥魔杖闪星后礼貌转身
   */
  function chooseObstacleAction(opts = {}) {
    const canLeap = opts.canLeap !== false;
    const canPerch = Boolean(opts.canPerch);
    const roll = Number.isFinite(opts.roll) ? opts.roll : Math.random();
    if (canLeap && canPerch) {
      if (roll < 0.42) return 'leapfrog';
      if (roll < 0.74) return 'autoPerch';
      return 'greetTurn';
    }
    if (canLeap) return roll < 0.58 ? 'leapfrog' : 'greetTurn';
    if (canPerch) return roll < 0.52 ? 'autoPerch' : 'greetTurn';
    return 'greetTurn';
  }

  function mountDualMascotStage(hostEl, options = {}) {
    if (!hostEl) return null;
    const doc = hostEl.ownerDocument;
    const win = (doc && doc.defaultView) || (typeof window !== 'undefined' ? window : null);
    let hostSleep = false;
    let inspectState = null;
    let wb = false;
    const WB = 'data-ag-cs-win-blur';
    const PM = 'data-ag-prism-mode';
    const isDocHidden = () => Boolean(doc && doc.hidden);
    const isAttrB = () => {
      const root = doc && doc.documentElement;
      if (!root) return false;
      const val = typeof root.getAttribute === 'function' ? root.getAttribute(WB) : null;
      if (val === '1') return true;
      if (val === '0') return false;
      return Boolean(typeof root.hasAttribute === 'function' && root.hasAttribute(WB));
    };
    const isWindowBlurred = () => Boolean(isDocHidden() || isAttrB() || wb);
    const isHostSleeping = () => {
      if (hostSleep) return true;
      const root = doc && doc.documentElement;
      if (!root) return false;
      return typeof root.getAttribute === 'function' && root.getAttribute(PM) === 'chat';
    };
    const readDpr = () => Math.min((win && win.devicePixelRatio) || 1, 2);
    let dpr = readDpr();
    const rand = (a, b) => a + Math.random() * (b - a);
    const ticksIn = (minMs, maxMs) => Math.max(1, Math.round(rand(minMs, maxMs) / TICK));

    let tickIdx = 0;
    let disposed = false;
    let parked = false;
    let vramReclaimed = false;
    const isHostDetached = () => Boolean(hostEl && hostEl.isConnected === false);
    const isVramSleepState = () => Boolean(disposed || parked || isDocHidden() || isHostSleeping() || isHostDetached());
    const NO_TR_ATTRS = [
      ['translate', 'no'],
      ['data-no-translate', 'true'],
      ['data-ag-localization-skip', 'true'],
      ['data-agy-no-translate', 'true'],
      ['data-antigravity-zh-skip', '1'],
      ['data-ag-no-i18n', ''],
    ];
    const markNoTrOwned = (el) => {
      if (el && typeof el.setAttribute === 'function') {
        for (let i = 0; i < NO_TR_ATTRS.length; i++) el.setAttribute(NO_TR_ATTRS[i][0], NO_TR_ATTRS[i][1]);
        el.setAttribute('data-ag-owned', '1');
      }
      return el;
    };

    // ── prefers-reduced-motion：无 window / matchMedia 时安全降级为 false ──
    let reducedMotion = false;
    let reducedMq = null;
    const onReducedChange = (e) => {
      reducedMotion = Boolean(e && e.matches);
      if (reducedMotion) freezeMotion();
      else lastActivityAt = performance.now();
      syncHeartbeat();
    };
    try {
      if (win && typeof win.matchMedia === 'function') {
        reducedMq = win.matchMedia('(prefers-reduced-motion: reduce)');
        reducedMotion = Boolean(reducedMq && reducedMq.matches);
        if (reducedMq && typeof reducedMq.addEventListener === 'function') {
          reducedMq.addEventListener('change', onReducedChange);
        } else if (reducedMq && typeof reducedMq.addListener === 'function') {
          reducedMq.addListener(onReducedChange);
        }
      }
    } catch (_) {
      reducedMotion = false;
      reducedMq = null;
    }
    if (options.reducedMotion !== undefined) reducedMotion = Boolean(options.reducedMotion);

    // 统一托管的延时器（剧目分镜 / 起跳预备），dispose 时全部清理
    const pendingTimers = new Set();
    const later = (ms, fn) => {
      const id = setTimeout(() => {
        pendingTimers.delete(id);
        if (!disposed) fn();
      }, ms);
      pendingTimers.add(id);
      return id;
    };

    const createActorState = (id, kind, label, phaseTicks) => ({
      id,
      kind,
      label,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rot: 0,
      sqx: 1,
      sqy: 1,
      pose: 'idle',
      overridePose: null,
      overrideUntil: 0,
      overrideRot: 0,
      clipStartTick: 0,
      sym: null,
      symUntil: 0,
      dragging: false,
      ballisticActive: false,
      flying: 0,
      stackedOn: null,
      throws: 0,
      lastThrowAt: 0,
      pokeCount: 0,
      lastPokeAt: 0,
      nodY: 0,
      nodUntil: 0,
      eyeScan: 0,
      patrolDir: 1,
      el: null,
      canvas: null,
      mirror: false,
      // 节拍序列（落地四相衰减 / 叠落挤压 / 起跳预备）
      seq: null,
      seqStartTick: 0,
      seqThen: null,
      // 待机微动作计时（各宠物独立随机，相位错开）
      blinkTick: -99,
      blinkDouble: false,
      nextBlinkTick: phaseTicks + ticksIn(2400, 6000),
      breathTick: -99,
      nextBreathTick: phaseTicks + ticksIn(2800, 4200),
      twitchTick: -99,
      twitchLen: 1,
      twitchSide: 'R',
      nextTwitchTick: phaseTicks + ticksIn(6000, 10000),
      snapTick: -99,
      snapSide: 'R',
      nextSnapTick: phaseTicks + ticksIn(8000, 12000),
      glanceDir: 0,
      glanceUntil: 0,
      glanceSecond: false,
      nextGlanceAt: performance.now() + phaseTicks * TICK + rand(3000, 7000),
      faceDir: null,
      clipParam: null,
      balRot: 0,
      prevX: null,
      lastFx: null,
      lastSq: null,
      // 生态联动：外部事件触发的强制耳尖抖动（ripple 点击方向）与经过加速窗口
      forceTwitchStart: -99,
      forceTwitchSide: 'R',
      passBoostUntil: 0,
      walkStepTick: -1,
      // 静止帧与 DOM 位移缓存（像素帧与坐标不变时 0 clearRect、0 style.transform 写入）
      lastDomX: null,
      lastDomY: null,
      lastDomZ: null,
      lastDomRot: 0,
      lastRender: {
        poseKey: null,
        frameIdx: null,
        flip: null,
        tintState: null,
        tyPx: null,
        sqW: null,
        sqH: null,
        lastRot: null,
        clipBottomY: null,
        cw: 0,
        ch: 0,
      },
    });

    const actors = {
      clawd: createActorState('clawd', 'clawd', 'Claude Clawd', 0),
      cat: createActorState('cat', 'cat', 'Gemini Cat', 14),
    };

    const miniCrabs = [
      { id: 'cowboy', x: 16, dir: 1 },
      { id: 'shades', x: 76, dir: -1 },
      { id: 'wizard', x: 136, dir: 1 },
    ];
    miniCrabs.forEach((mc, idx) => {
      mc.kind = 'mini';
      mc.blinkAt = -99;
      mc.nextBlink = ticksIn(1500, 6000);
      mc.lastX = mc.x;
      mc.px = mc.x;
      mc.y = 0;
      mc.vx = 0;
      mc.vy = 0;
      mc.rot = 0;
      mc.balRot = 0;
      mc.dragging = false;
      mc.ballisticActive = false;
      mc.stackedOn = null;
      mc.flying = 0;
      mc.leap = null;
      mc.perchUntil = 0;
      mc.speed = [1.05, 0.86, 1.18][idx] || 1.0;
      mc.bumpUntilTick = -1;
      mc.passHopUntilTick = -1;
      mc.cooldownTick = -1;
      mc.act = null;
      mc.mirror = false;
      mc.lastDomX = null;
      mc.lastDomY = null;
      mc.lastDomZ = null;
      mc.lastDomRot = 0;
      mc.lastFrameKey = null;
    });

    const rAF =
      (win && typeof win.requestAnimationFrame === 'function' && win.requestAnimationFrame.bind(win)) ||
      (typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (fn) => later(16, () => fn(performance.now())));

    const CHROMA_STORE_KEY = '__op_chroma_v1';
    const getStorage = () => {
      try {
        return options.storage || (win && win.localStorage) || (typeof localStorage !== 'undefined' ? localStorage : null);
      } catch (_) {
        return null;
      }
    };
    const readChromaSaved = () => {
      try {
        const st = getStorage();
        return Boolean(st && st.getItem(CHROMA_STORE_KEY) === '1');
      } catch (_) {
        return false;
      }
    };
    const writeChromaSaved = (on) => {
      try {
        const st = getStorage();
        if (!st) return;
        if (on) st.setItem(CHROMA_STORE_KEY, '1');
        else if (typeof st.removeItem === 'function') st.removeItem(CHROMA_STORE_KEY);
        else st.setItem(CHROMA_STORE_KEY, '0');
      } catch (_) {
        /* 忽略存储受限环境 */
      }
    };

    let camp = options.camp === 'claude' ? 'claude' : 'gemini';
    let streaming = Boolean(options.streaming);
    let streamTier = Number(options.streamTier || 2);
    let hasError = Boolean(options.hasError);
    let yieldMode = options.yieldMode || 'none';
    let leapOffsetY = Number(options.leapOffsetY || 0);
    let popoverRightWidth = Number(options.popoverRightWidth || 0);
    let miniPileEnabled = Boolean(options.miniPileEnabled);
    let catOnly = Boolean(options.catOnly);
    let orchestrator = Boolean(options.orchestrator);
    let prismaticCoat = readChromaSaved();
    const sharedSessionGates =
      !options.storage && hostEl && typeof hostEl === 'object'
        ? (hostEl.__opChromaGates || (hostEl.__opChromaGates = { tuned: false, forged: false }))
        : { tuned: false, forged: false };
    const chromaGates = sharedSessionGates;
    const chromaTapTimes = [];
    let chromaPhase = 0;
    const chromaSparks = [];
    let fxCanvasCleared = true;

    // 打盹生态：45s（深夜 30s）无用户操作 → 哈欠 → 打盹；任何操作唤醒
    const DOZE_AFTER_MS = 45000;
    const DOZE_AFTER_NIGHT_MS = 30000;
    let dozing = false;
    let lastActivityAt = performance.now();
    let lastHandoffAt = 0;
    let duetUntil = 0;
    let lastCrabStepTick = -1;
    const pairCooldowns = new Map();
    const canTriggerPair = (key, now, cdMs) => {
      const until = pairCooldowns.get(key) || 0;
      if (now < until) return false;
      pairCooldowns.set(key, now + cdMs);
      return true;
    };
    let lastInteraction = { type: null, pair: null, at: 0, tick: -1 };
    const recordInteraction = (type, pair, now = performance.now()) => {
      lastInteraction = { type, pair, at: now, tick: tickIdx };
    };
    let pauseTimer = 0;
    let theaterTimer = 0;
    let theaterCursor = 0;
    let tickTimer = null;
    let currentTickMs = 0;
    let lastMiniDisplay = null;
    const rim = { on: false, x: -9999, s: 0, t: 'default', d: true };
    let rimSig = '0';
    const perfStats = {
      canvasDraws: 0,
      canvasSkips: 0,
      domTransformWrites: 0,
      domTransformSkips: 0,
    };

    // 扩大至 96x84px (32x28 格, PX=3), OX=8, OY=17 -> y=10 脚底在 81px, 头顶留满 51px 放火舌/立麦/节点花!
    const CANVAS_W = 96;
    const CANVAS_H = 84;
    const OX = 8;
    const OY = 17;

    if (typeof hostEl.removeChild === 'function') {
      while (hostEl.firstChild) hostEl.removeChild(hostEl.firstChild);
    } else {
      hostEl.innerHTML = '';
    }

    const miniGroupEl = markNoTrOwned(doc.createElement('div'));
    miniGroupEl.className = 'ag-v2-mini-pile';
    if (miniGroupEl.style) miniGroupEl.style.zIndex = 'auto';
    miniCrabs.forEach((mc) => {
      const cv = markNoTrOwned(doc.createElement('canvas'));
      cv.className = 'ag-v2-mini-crab-canvas';
      cv.width = Math.round(40 * dpr);
      cv.height = Math.round(32 * dpr);
      cv.dataset.miniCrab = mc.id;
      if (cv.style) {
        cv.style.pointerEvents = 'auto';
        cv.style.cursor = 'grab';
        cv.style.touchAction = 'none';
        cv.style.transformOrigin = '20px 26px';
      }
      miniGroupEl.appendChild(cv);
      mc.canvas = cv;
      mc._ctx = typeof cv.getContext === 'function' ? (cv._ctx = cv.getContext('2d')) : null;
      mc.el = cv;
    });
    hostEl.appendChild(miniGroupEl);

    const createActorDom = (actor) => {
      const btn = markNoTrOwned(doc.createElement('div'));
      btn.className = 'ag-v2-mascot-actor';
      btn.setAttribute('data-mascot-id', actor.id);
      btn.setAttribute('data-no-press-spring', '1');
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-label', actor.label);
      const cv = markNoTrOwned(doc.createElement('canvas'));
      cv.className = 'ag-v2-mascot-canvas';
      cv.width = Math.round(CANVAS_W * dpr);
      cv.height = Math.round(CANVAS_H * dpr);
      if (cv.style) {
        cv.style.transformOrigin = `${(OX + 8) * PX}px ${(OY + 10) * PX}px`;
      }
      btn.appendChild(cv);
      actor.el = btn;
      actor.canvas = cv;
      actor._ctx = typeof cv.getContext === 'function' ? (cv._ctx = cv.getContext('2d')) : null;
      hostEl.appendChild(btn);
    };

    createActorDom(actors.cat);
    createActorDom(actors.clawd);

    const fxCanvas = markNoTrOwned(doc.createElement('canvas'));
    fxCanvas.className = 'ag-v2-chroma-fx';
    const releaseFxCanvas = () => {
      fxCanvas.width = fxCanvas.height = 0;
      if (fxCanvas.style) { fxCanvas.style.width = fxCanvas.style.height = '0px'; fxCanvas.style.display = 'none'; }
      fxCanvasCleared = true;
    };
    if (fxCanvas.style) {
      fxCanvas.style.position = 'absolute';
      fxCanvas.style.left = fxCanvas.style.bottom = '0';
      fxCanvas.style.pointerEvents = 'none';
      fxCanvas.style.zIndex = '42';
      fxCanvas.style.imageRendering = 'pixelated';
    }
    releaseFxCanvas();
    hostEl.appendChild(fxCanvas);

    // ── 右侧角落微缩像素栖息地摆件（图层 z-index:14 在双宠背后，仅状态切换绘制 1 帧，日常 0fps）──
    const habitatCanvas = markNoTrOwned(doc.createElement('canvas'));
    habitatCanvas.className = 'ag-v2-habitat-prop';
    habitatCanvas.setAttribute('aria-hidden', 'true');
    if (habitatCanvas.style) {
      habitatCanvas.style.position = 'absolute';
      habitatCanvas.style.right = '10px';
      habitatCanvas.style.bottom = '2px';
      habitatCanvas.style.width = '24px';
      habitatCanvas.style.height = '30px';
      habitatCanvas.style.pointerEvents = 'none';
      habitatCanvas.style.zIndex = '14';
      habitatCanvas.style.imageRendering = 'pixelated';
    }
    hostEl.appendChild(habitatCanvas);

    // ── Pusheen-Style Multi-Cat Sanctuary + Cozy Playground Props (active when catOnly=true) ──
    const CHIBI_CAT_POSES = Object.fromEntries(Object.entries({
      standA:'3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O6.3O..|.O3#s#s3#O4.O#s#O.|.O##o##o##o#O3.O3#O.|O##p##o#o##p4O.O#sO.|O11#s#s#O##O..|O11#s#s#O#sO..|O15#O##O..|O16#OO3.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w##w3#w##w#O5.|..OwOOw5OwOOwO5.|..OO..OO3.OO..OO5.',
      standB:'3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O11.|.O3#s#s3#O5.3O..|.O##o##o##o#O3.O#s#O.|O##p##o#o##p5O3#O.|O11#s#s#O#sO..|O11#s#s#O##O..|O16#sO3.|O16#O4.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w##w3#w##w#O5.|..OwOOw5OwOOwO5.|..OO..OO3.OO..OO5.',
      blink:'3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O6.3O..|.O3#s#s3#O4.O#s#O.|.O#oo##o##ooO3.O3#O.|O##p##o#o##p4O.O#sO.|O11#s#s#O##O..|O11#s#s#O#sO..|O15#O##O..|O16#OO3.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w##w3#w##w#O5.|..OwOOw5OwOOwO5.|..OO..OO3.OO..OO5.',
      earL:'9.O12.|..OO4.O#O11.|.O##5Os#O5.3O..|.O3#s#s3#O4.O#s#O.|.O##o##o##o#O3.O3#O.|O##p##o#o##p4O.O#sO.|O11#s#s#O##O..|O11#s#s#O#sO..|O15#O##O..|O16#OO3.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w##w3#w##w#O5.|..OwOOw5OwOOwO5.|..OO..OO3.OO..OO5.',
      happy:'3.O5.O12.|..O#O3.O#O6.3O..|..O#s3Os#O5.O#s#O.|.O3#s#s3#O4.O3#O.|.O##o5#o#O3.O#sO..|O##o#o3#o#o5O##O..|O#p4#o4#ps#sO#sO..|O5#o#o3#s#s#O##O..|O16#OO3.|O16#O4.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w##w3#w##w#O5.|..OwOOw5OwOOwO5.|..OO..OO3.OO..OO5.',
      sitA:'4.O5.O11.|3.O#O3.O#O10.|3.O#s3Os#O10.|..O3#s#s3#O9.|..O##o##o##o#O8.|.O##p##o#o##p#O7.|.O13#O..3O.|O12#s#O.O#s#O|O4#7b##sO.O3#O|O3#9b##O.O#sO.|O3#9b##OO##O..|O3#9b3#O#sO..|O3#bbw3#wbb4#OO3.|.O##O#w3Ow#O4#O4.|.O##O#w3Ow#O4#O4.|..15O5.',
      sitB:'4.O5.O11.|3.O#O3.O#O10.|3.O#s3Os#O10.|..O3#s#s3#O9.|..O##o##o##o#O8.|.O##p##o#o##p#O7.|.O13#O6.|O12#s#O..3O.|O4#7b##sO.O#s#O|O3#9b##O.O3#O|O3#9b##O.O#sO.|O3#9b3#OO#O..|O3#bbw3#wbb4#OO3.|.O##O#w3Ow#O4#O4.|.O##O#w3Ow#O4#O4.|..15O5.',
      wave1:'4.O5.O11.|3.O#O3.O#O10.|3.O#s3Os#O10.|..O3#s#s3#O9.|..O##o##o##o#O8.|.O##p##o#o##p#O7.|.O13#O..3O.|.O11#s#O.O#s#O|.OO##7b##sO.O3#O|Oww##8b##O.O#sO.|OwwO#8b##OO##O..|.OO.#8b3#O#sO..|.O3#bb3#wbb4#OO3.|..O5#OOw#O4#O4.|..O6#Ow#O4#O4.|3.14O5.',
      wave2:'4.O5.O11.|3.O#O3.O#O10.|3.O#s3Os#O10.|..O3#s#s3#O9.|..O##o##o##o#O8.|.O##p##o#o##p#O7.|.O13#O6.|OO11#s#O..3O.|Oww##7b##sO.O#s#O|OwwO#8b##O.O3#O|.OO.#8b##O.O#sO.|O3#9b3#OO#O..|.O3#bb3#wbb4#OO3.|..O5#OOw#O4#O4.|..O6#Ow#O4#O4.|3.14O5.',
      groom1:'4.O5.O11.|3.O#O3.O#O10.|3.O#s3Os#O10.|..O3#s#s3#O9.|..O#oo##o##ooO8.|.O##p##o#o##p#O7.|.O13#O6.|.OO10#s#O..3O.|OwwO#7b##sO.O#s#O|Oww##8b##O.O3#O|.OO##8b##O.O#sO.|O3#9b3#OO#O..|.O3#bb3#wbb4#OO3.|..O5#OOw#O4#O4.|..O6#Ow#O4#O4.|3.14O5.',
      groom2:'4.O5.O11.|3.O#O3.O#O10.|3.O#s3Os#O10.|..O3#s#s3#O9.|..O#oo##o##ooO8.|.O##p##o#o##p#O7.|.OO12#O..3O.|OwwO9#s#O.O#s#O|Oww##7b##sO.O3#O|.OO##8b##O.O#sO.|O3#9b##OO##O..|O3#9b3#O#sO..|.O3#bb3#wbb4#OO3.|..O5#OOw#O4#O4.|..O6#Ow#O4#O4.|3.14O5.',
      walk1:'22.|3.O5.O12.|..O#O3.O#O6.3O..|..O#s3Os#O5.O#s#O.|.O3#s#s3#O4.O3#O.|.O##o##o##o#O3.O#sO..|O##p##o#o##p5O##O..|O11#s#s#O#sO..|O11#s#s#O##O..|O16#OO3.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w##w3#w##w#O5.|.OwO.Ow5OwO.OwO4.|.OO..OO4.OO..OO5.',
      walk2:'3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O6.3O..|.O3#s#s3#O4.O#s#O.|.O##o##o##o#O3.O3#O.|O##p##o#o##p4O.O#sO.|O11#s#s#O##O..|O11#s#s#O#sO..|O15#O##O..|O16#OO3.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|.OwO#w6#w#OwO5.|.OO.Ow6OwO.OO5.|4.OO6.OO8.',
      walk3:'22.|3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O7.3O.|.O3#s#s3#O5.O#s#O|.O##o##o##o#O4.O3#O|O##p##o#o##p4O.O#sO.|O11#s#s#O##O..|O11#s#s#O#sO..|O16#OO3.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w##w3#w##w#O5.|3.OwOOw4OwOOwO5.|3.OO..OO..OO..OO5.',
      walk4:'3.O5.O12.|..O#O3.O#O6.3O..|..O#s3Os#O5.O#s#O.|.O3#s#s3#O4.O3#O.|.O##o##o##o#O3.O#sO..|O##p##o#o##p5O##O..|O11#s#s#O#sO..|O11#s#s#O##O..|O15#O##O..|O16#OO3.|O#14b#O4.|O#14b#O4.|.O#12b#O5.|..O#w#OwO#OwO#w#O5.|..OwOO.OO.OO.OwO6.|..OO9.OO7.',
      eat1:'22.|22.|16.3O3.|15.O#s#O..|15.O3#O..|4.O4.O4.O##sO3.|3.O#O..O#5O3#O3.|..O##sOOs##s#s3#O4.|.O9#s#s3#O4.|.O#oo##o9#O4.|O##p##o#o#6b#O4.|O8#7b#O4.|.O6#8b#O4.|..O#w##w3#w##w#O5.|..OwOOw5OwOOwO5.|..OO..OO3.OO..OO5.',
      eat2:'22.|22.|17.3O..|16.O#s#O.|16.O3#O.|15.O##sO..|4.O4.O4.O3#O3.|3.O#O..O#4O3#O4.|..O##sOOs##s#s3#O4.|.O9#s#s3#O4.|.O#oo##o9#O4.|O##p##o#o#6b#O4.|.O6#8b#O4.|..O#w##w3#w##w#O5.|..OwOOw5OwOOwO5.|..OO..OO3.OO..OO5.',
      sleep1:'22.|22.|22.|22.|22.|3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O11.|.O3#s#s3#4O7.|.O#oo##o##oo#s#OO5.|O##p##o#o##p#s3#O4.|O16#O.OO.|O3#12b#OO#sO|O3#12b#O##O.|.O##12b#OO3.|..16O4.',
      sleep2:'22.|22.|22.|22.|22.|3.O5.O12.|..O#O3.O#O11.|..O#s3Os#4O8.|.O3#s#s5#s#OO5.|.O#oo##o##oo##s##O4.|O##p##o#o##p5#O4.|O16#O.OO.|O3#12b#OO#sO|O3#12b#O##O.|.O##12b#OO3.|..16O4.',
      stretch:'22.|16.3O3.|15.O#s#O..|15.O3#O..|14.O##sO3.|13.O3#O4.|3.O5.O..O##s#O4.|..O#O3.O#OO3#s#O4.|..O#s3Os#O6#O4.|.O3#s#s9#O4.|.O##o##o##o6#O4.|O##p##o#o##p5#O4.|.O3#8b4#O4.|.OO##6b##OO##O4.|O3wO6#OO..OwO4.|5O..4O4.OO5.',
      pounce:'3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O6.3O..|.O3#s#s3#O4.O#s#O.|.O##o##o##o#O..O3#O..|O##p##o#o##p4O#sO3.|O11#s#s3#O3.|O11#s#s##O4.|.O##8b4#O5.|.OO#8b3#O6.|OwwO8#O#O7.|.OO..7O.OwO6.|14.OO6.|22.|22.|22.',
      dangle:'3.O5.O12.|..O#O3.O#O11.|..O#s3Os#O11.|.O3#s#s3#O10.|.O#oo##o##ooO9.|O##p##o#o##p#O8.|O12#O8.|.O#O#4b#O#O9.|.OwO#4b#OwO9.|..O##4b##O..3O5.|..O##4b##OO#s#O5.|..O8#O3#O6.|3.O#O..O#OO#sO7.|3.OwO..OwO.OO8.|3.OO3.OO12.|22.',
    }).map(([k, v]) => [k, v.replace(/(\d+)(.)/g, (_, n, ch) => ch.repeat(+n)).split('|')]));
    const CAT_PRESETS = [
      { id: 'pusheen', px: 2.0, xPct: 0.62, speed: 0.34, mood: 'cozy', coat: 'tabby', pal: { O: '#2D2936', '#': '#A4A6B0', s: '#6E707D', b: '#BCBEC8', o: '#1E1B24', p: '#F9A8C9', w: '#D6D8E2' } },
      { id: 'calico', px: 1.5, xPct: 0.38, speed: 0.44, mood: 'sweet', coat: 'calico', pal: { O: '#3A2E32', '#': '#FFF8F0', s: '#F3A261', b: '#FFF8F0', o: '#282024', p: '#FF9EBB', w: '#FFFDF9', c2: '#7A6368' } },
      { id: 'ginger', px: 1.5, xPct: 0.18, speed: 0.56, mood: 'playful', coat: 'tabby', pal: { O: '#3D2A1F', '#': '#F7B977', s: '#D67D38', b: '#FFF3E4', o: '#2A1C14', p: '#FF96B0', w: '#FFF9F0' } },
      { id: 'ragdoll', px: 2.0, xPct: 0.80, speed: 0.38, mood: 'calm', coat: 'ragdoll', pal: { O: '#2C3144', '#': '#F5F6FA', s: '#68738C', b: '#EAEFF7', o: '#1F2333', p: '#F9A8C9', w: '#FFFFFF' } },
    ];
    const SANCTUARY_SYMS = {
      heart: ['.p.p.', 'ppppp', '.ppp.', '..p..'],
      hearts2: ['.p.p...p.', 'pppp..ppp', '.pp....p.'],
      z1: ['ooo', '.o.', 'ooo'],
      z2: ['oooo', '..o.', '.o..', 'oooo'],
      spark: ['..y..', '..y..', 'yywyy', '..y..', '..y..'],
      note: ['..bb', '..b.', 'bbb.', 'bb..'],
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
    // Cozy grounded shelf decorations (px: 1.5 => exact 3x3 device px on Retina, inset from rounded corners)
    const SHELF_PROPS = [
      {
        id: 'bowl',
        align: 'left',
        offset: 34,
        px: 1.5,
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
        align: 'left',
        offset: 118,
        px: 1.5,
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
        align: 'right',
        offset: 128,
        px: 1.5,
        pal: { O: '#352E45', c: '#DDD6FE', l: '#EDE9FE', s: '#C4B5FD' },
        rows: [
          '.OOOO..........OOOO.',
          'OllllOOOOOOOOOOllllO',
          'OlccccccccccccccccsO',
          'OcccsccccssccccsccsO',
          '.OssssssssssssssssO.',
          '..OOOOOOOOOOOOOOOO..',
        ],
      },
      {
        id: 'post',
        align: 'right',
        offset: 30,
        px: 1.5,
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

    let sanctuary = null;
    const mountCatSanctuary = () => {
      if (sanctuary) return sanctuary;
      const wrap = markNoTrOwned(doc.createElement('div'));
      wrap.className = 'ag-v2-cat-sanctuary';
      hostEl.appendChild(wrap);

      const drawCrispGrid = (ctx, rows, p, curDpr, yOffGrid, colorOf, flipX, cwPhys) => {
        const step = p * curDpr;
        for (let gy = 0; gy < rows.length; gy++) {
          const r = rows[gy];
          const y0 = Math.round((yOffGrid + gy) * step);
          const y1 = Math.round((yOffGrid + gy + 1) * step);
          const rh = y1 - y0;
          if (rh <= 0) continue;
          for (let gx = 0; gx < r.length; gx++) {
            const col = colorOf(r[gx], gx, gy);
            if (!col) continue;
            const lx0 = Math.round(gx * step);
            const lx1 = Math.round((gx + 1) * step);
            const rw = lx1 - lx0;
            if (rw <= 0) continue;
            ctx.fillStyle = col;
            ctx.fillRect(flipX ? cwPhys - lx1 : lx0, y0, rw, rh);
          }
        }
      };

      // Mount grounded cozy shelf decorations behind the cats (z-index: 1)
      const propById = {};
      const propNodes = SHELF_PROPS.map((sp) => {
        const cv = markNoTrOwned(doc.createElement('canvas'));
        cv.className = 'ag-v2-cat-pet';
        cv.setAttribute('data-shelf-prop', sp.id);
        cv.setAttribute('aria-hidden', 'true');
        const cw = Math.round(sp.rows[0].length * sp.px);
        const ch = Math.round(sp.rows.length * sp.px);
        cv.style.width = `${cw}px`;
        cv.style.height = `${ch}px`;
        cv.style.zIndex = '1';
        cv.style.cursor = 'pointer';
        wrap.appendChild(cv);
        const node = {
          ...sp,
          cv,
          ctx: typeof cv.getContext === 'function' ? cv.getContext('2d') : null,
          cw,
          ch,
          x: sp.offset,
          drawnDpr: 0,
        };
        propById[sp.id] = node;
        const onPropClick = () => {
          const now = performance.now();
          if (sp.id === 'post') {
            spawnYarn(node.x, now);
          } else {
            let best = null;
            let bestD = Infinity;
            for (const c of cats) {
              if (c.dragging) continue;
              const d = Math.abs((c.x + c.cw * 0.5) - (node.x + node.cw * 0.5));
              if (d < bestD) { bestD = d; best = c; }
            }
            if (best) {
              sendCatToProp(best, sp.id, now, true);
              paintCat(best, now);
              wakeLoop();
            }
          }
        };
        cv.addEventListener('pointerdown', onPropClick);
        node.cleanup = () => cv.removeEventListener('pointerdown', onPropClick);
        return node;
      });

      let lastPropsSw = 0;
      let lastPropsDpr = 0;
      const drawProps = (sw) => {
        const curDpr = Math.max(1, Math.min(2, dpr || 1));
        if (sw === lastPropsSw && curDpr === lastPropsDpr) return;
        lastPropsSw = sw;
        lastPropsDpr = curDpr;
        for (const pr of propNodes) {
          pr.x = pr.align === 'right' ? Math.max(24, sw - pr.offset - pr.cw) : pr.offset;
          const tx = `translate3d(${Math.round(pr.x)}px,0px,0)`;
          if (pr.cv.style.transform !== tx) pr.cv.style.transform = tx;
          if (pr.ctx && pr.drawnDpr !== curDpr) {
            pr.drawnDpr = curDpr;
            const pw = Math.round(pr.rows[0].length * pr.px * curDpr);
            const ph = Math.round(pr.rows.length * pr.px * curDpr);
            pr.cv.width = pw;
            pr.cv.height = ph;
            pr.ctx.setTransform(1, 0, 0, 1, 0, 0);
            pr.ctx.clearRect(0, 0, pw, ph);
            pr.ctx.imageSmoothingEnabled = false;
            drawCrispGrid(pr.ctx, pr.rows, pr.px, curDpr, 0, (ch) => (ch === '.' ? null : pr.pal[ch]), false, pw);
          }
        }
      };

      // Shared interactive pixel yarn ball
      const yarnCv = markNoTrOwned(doc.createElement('canvas'));
      yarnCv.className = 'ag-v2-cat-pet';
      yarnCv.setAttribute('aria-hidden', 'true');
      yarnCv.style.width = '14px';
      yarnCv.style.height = '14px';
      yarnCv.style.zIndex = '4';
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
        drawnDpr: 0,
      };
      const drawYarn = () => {
        if (!yarn.ctx) return;
        const curDpr = Math.max(1, Math.min(2, dpr || 1));
        const pw = Math.round(14 * curDpr);
        if (yarn.cv.width !== pw || yarn.drawnDpr !== curDpr) {
          yarn.drawnDpr = curDpr;
          yarn.cv.width = pw;
          yarn.cv.height = pw;
          yarn.ctx.setTransform(1, 0, 0, 1, 0, 0);
          yarn.ctx.clearRect(0, 0, pw, pw);
          yarn.ctx.imageSmoothingEnabled = false;
          drawCrispGrid(yarn.ctx, YARN_SPRITE, 2, curDpr, 0, (ch) => (ch === '.' ? null : ch === 'O' ? '#2D1D28' : ch === 'p' ? '#FBCFE8' : '#F472B6'), false, pw);
        }
        yarn.cv.style.transform = `translate3d(${Math.round(yarn.x)}px,${Math.round(yarn.y)}px,0)`;
      };
      const spawnYarn = (originX, now) => {
        const sw = Math.max(220, readStageWidth());
        yarn.active = true;
        yarn.x = Math.max(28, Math.min(sw - 42, originX));
        yarn.y = -10;
        yarn.vx = (originX > sw * 0.5 ? -1 : 1) * (3.6 + Math.random() * 1.8);
        yarn.vy = -4.2;
        yarn.until = now + 8500;
        yarn.cv.style.display = '';
        drawYarn();
        wakeLoop();
      };

      const ptr = { active: false, clientX: 0, clientY: 0, lastAt: 0 };
      let cachedStageRect = null;
      let stageRectAt = 0;
      const onGlobalMove = (ev) => {
        ptr.active = true;
        ptr.clientX = ev.clientX || 0;
        ptr.clientY = ev.clientY || 0;
        ptr.lastAt = performance.now();
      };
      win.addEventListener('pointermove', onGlobalMove, { passive: true });

      const setSym = (c, sym, now, dur) => {
        c.sym = sym;
        c.symBornAt = now;
        c.symUntil = now + dur;
      };

      const cats = CAT_PRESETS.map((pr, idx) => {
        const cv = markNoTrOwned(doc.createElement('canvas'));
        cv.className = 'ag-v2-cat-pet';
        cv.setAttribute('data-cat-id', pr.id);
        cv.setAttribute('role', 'button');
        cv.setAttribute('tabindex', '0');
        cv.setAttribute('aria-label', pr.id);
        const cw = Math.round(22 * pr.px);
        const ch = Math.round(24 * pr.px); // 16 rows sprite + 8 rows headroom for hearts/zZ/sparkles
        cv.style.width = `${cw}px`;
        cv.style.height = `${ch}px`;
        cv.style.zIndex = String(2 + (idx % 2));
        wrap.appendChild(cv);
        const now0 = performance.now();
        const c = {
          ...pr,
          idx,
          cv,
          ctx: typeof cv.getContext === 'function' ? cv.getContext('2d') : null,
          cw,
          ch,
          x: 40 + idx * 104,
          y: 0,
          vy: 0,
          dir: idx % 2 === 0 ? -1 : 1,
          state: idx === 0 ? 'stand' : idx === 1 ? 'sit' : idx === 2 ? 'walk' : 'groom',
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
          lastSig: '',
          lastTx: '',
          placed: false,
        };
        const onPd = (ev) => {
          if (ev.button !== undefined && ev.button !== 0) return;
          c.dragging = true;
          c.dragMoved = false;
          c.targetX = null;
          c.targetProp = null;
          c.atProp = null;
          c.dragStartX = ev.clientX || 0;
          c.dragStartY = ev.clientY || 0;
          const x0 = c.x;
          const y0 = c.y;
          const onPm = (mv) => {
            if (!c.dragging) return;
            const dx = (mv.clientX || 0) - c.dragStartX;
            const dy = (mv.clientY || 0) - c.dragStartY;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) c.dragMoved = true;
            if (c.dragMoved) {
              const sw = Math.max(220, readStageWidth());
              c.x = Math.max(18, Math.min(sw - 18 - c.cw, x0 + dx));
              c.y = Math.min(0, Math.max(-46, y0 + dy));
              c.state = 'dangle';
              c.until = performance.now() + 900;
              paintCat(c, performance.now());
            }
          };
          const onPu = () => {
            win.removeEventListener('pointermove', onPm);
            win.removeEventListener('pointerup', onPu);
            win.removeEventListener('pointercancel', onPu);
            const now = performance.now();
            c.dragging = false;
            if (!c.dragMoved) {
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
                c.until = now + 1600;
                setSym(c, c.petCount >= 3 ? 'hearts2' : 'heart', now, 1500);
                c.vy = c.petCount >= 3 ? -6.0 : -4.6;
                c.y = -1;
              }
            } else {
              c.state = 'happy';
              c.until = now + 1100;
              c.vy = 0;
              setSym(c, 'heart', now, 950);
            }
            paintCat(c, now);
            wakeLoop();
          };
          win.addEventListener('pointermove', onPm);
          win.addEventListener('pointerup', onPu);
          win.addEventListener('pointercancel', onPu);
        };
        cv.addEventListener('pointerdown', onPd);
        c.cleanup = () => cv.removeEventListener('pointerdown', onPd);
        return c;
      });

      const isPropBusy = (propId, excludeCat) => cats.some((o) => o !== excludeCat && (o.atProp === propId || o.targetProp === propId));

      const propAnchorX = (c, propId, sw) => {
        const pr = propById[propId];
        if (!pr) return c.x;
        const minX = 18;
        const maxX = Math.max(minX + 8, sw - 18 - c.cw);
        let tx = pr.x + pr.cw * 0.5 - c.cw * 0.5;
        if (propId === 'bowl') tx = pr.x + pr.cw - 3; // stand just to the right of bowl, facing left to eat
        else if (propId === 'post') tx = pr.x - c.cw + 4; // stand just left of scratching post, facing right
        return Math.max(minX, Math.min(maxX, Math.round(tx)));
      };

      const arriveAtProp = (c, propId, now) => {
        c.targetX = null;
        c.targetProp = null;
        c.atProp = propId;
        if (propId === 'cushion') {
          c.state = 'sleep';
          c.y = -2; // softly nestled inside the tufted cushion dip
          c.vy = 0;
          c.until = now + 6200 + Math.random() * 4800;
          c.sym = null;
        } else if (propId === 'bowl') {
          c.dir = -1;
          c.state = 'eat';
          c.until = now + 3400 + Math.random() * 2200;
          setSym(c, 'heart', now, 1200);
        } else if (propId === 'post') {
          c.dir = 1;
          c.state = 'wave';
          c.until = now + 2200 + Math.random() * 1400;
          setSym(c, 'spark', now, 1100);
        } else {
          c.dir = -1;
          c.state = 'happy';
          c.until = now + 1800;
          setSym(c, 'note', now, 1300);
        }
      };

      const sendCatToProp = (c, propId, now, fromClick) => {
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

      const hasCrowdNear = (c, cx) => {
        for (const o of cats) {
          if (o === c || o.dragging) continue;
          const minSep = (c.cw + o.cw) * 0.62;
          if (Math.abs((cx + c.cw * 0.5) - (o.x + o.cw * 0.5)) < minSep) return o;
        }
        return null;
      };

      const pickClearSpot = (c, sw) => {
        const minX = 24;
        const maxX = Math.max(minX + 16, sw - 24 - c.cw);
        let bestX = c.x;
        let bestScore = -1;
        for (let tries = 0; tries < 7; tries++) {
          const cand = Math.round(minX + Math.random() * (maxX - minX));
          let nearest = Infinity;
          for (const o of cats) {
            if (o === c) continue;
            nearest = Math.min(nearest, Math.abs((cand + c.cw * 0.5) - (o.x + o.cw * 0.5)));
          }
          if (nearest > bestScore) { bestScore = nearest; bestX = cand; }
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
        const ctx = c.ctx;
        if (!ctx) return;
        const curDpr = Math.max(1, Math.min(2, dpr || 1));
        const pw = Math.round(22 * c.px * curDpr);
        const ph = Math.round(24 * c.px * curDpr);
        if (c.cv.width !== pw || c.cv.height !== ph) {
          c.cv.width = pw;
          c.cv.height = ph;
          c.lastSig = '';
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
        else if (now < c.blinkUntil) poseKey = 'blink';
        else if (now < c.twitchUntil) poseKey = 'earL';
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
        } else if ((c.state === 'groom' || c.state === 'eat') && Math.floor(now / 1100) % 2 === 0) {
          activeSym = 'note';
          symPhase = Math.floor((now % 1100) / 220);
        }

        const isGazePose = poseKey === 'standA' || poseKey === 'standB' || poseKey === 'sitA' || poseKey === 'sitB';
        const eyeShift = isGazePose ? c.gazeDx : 0;
        const sitBlink = (poseKey === 'sitA' || poseKey === 'sitB') && now < c.blinkUntil ? 1 : 0;
        const sig = `${poseKey}:${c.dir}:${eyeShift}:${sitBlink}:${activeSym || ''}:${symPhase}:${curDpr}`;
        if (c.lastSig === sig) return;
        c.lastSig = sig;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, pw, ph);
        ctx.imageSmoothingEnabled = false;
        const rows = CHIBI_CAT_POSES[poseKey] || CHIBI_CAT_POSES.standA;
        const isSit = poseKey === 'sitA' || poseKey === 'sitB';
        const eyeColA = isSit ? 5 : 4;
        const eyeColB = isSit ? 11 : 10;
        const eDx = c.dir > 0 ? -eyeShift : eyeShift;

        drawCrispGrid(ctx, rows, c.px, curDpr, 8, (rawCh, gx, gy) => {
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
        }, c.dir > 0, pw);

        if (activeSym && SANCTUARY_SYMS[activeSym]) {
          const sRows = SANCTUARY_SYMS[activeSym];
          const sp = Math.max(1.5, c.px * 0.85);
          const sStep = sp * curDpr;
          const rise = symPhase * 0.55 * c.px * curDpr;
          const driftX = activeSym.startsWith('z') ? symPhase * 0.35 * c.px * curDpr : 0;
          const sx0 = Math.round(pw * 0.34 + driftX);
          const sy0 = Math.round((poseKey.startsWith('sleep') ? 4.8 : 2.0) * c.px * curDpr - rise);
          ctx.save();
          ctx.globalAlpha = symPhase >= 5 ? 0.25 : symPhase >= 4 ? 0.55 : 0.95;
          for (let sy = 0; sy < sRows.length; sy++) {
            const sr = sRows[sy];
            const y0 = Math.round(sy0 + sy * sStep);
            const y1 = Math.round(sy0 + (sy + 1) * sStep);
            for (let sx = 0; sx < sr.length; sx++) {
              const sc = sr[sx];
              if (sc === '.') continue;
              const x0 = Math.round(sx0 + sx * sStep);
              const x1 = Math.round(sx0 + (sx + 1) * sStep);
              ctx.fillStyle = sc === 'p' ? '#F472B6' : sc === 'y' ? '#F59E0B' : sc === 'w' ? '#FFFBEB' : sc === 'b' ? '#60A5FA' : '#94A3B8';
              ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
            }
          }
          ctx.restore();
        }
      };

      const pickNextBehavior = (c, now, sw) => {
        c.targetX = null;
        c.targetProp = null;
        if (c.atProp === 'cushion' && c.y < 0) c.y = 0;
        c.atProp = null;

        if (streaming) {
          const r = Math.random();
          if (r < 0.32) { c.state = 'wave'; setSym(c, 'spark', now, 1100); c.until = now + 2200 + Math.random() * 1600; }
          else if (r < 0.62) { c.state = 'sit'; c.until = now + 2400 + Math.random() * 1800; }
          else if (r < 0.84) { c.state = 'stand'; c.until = now + 2000 + Math.random() * 1600; }
          else { c.state = 'happy'; c.vy = -4.2; c.y = -1; setSym(c, 'spark', now, 1000); c.until = now + 1300; }
          return;
        }

        // If overlapping another cat, walk away to a clear open spot first!
        if (hasCrowdNear(c, c.x)) {
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
        if (r < 0.14 && !isPropBusy('cushion', c)) {
          sendCatToProp(c, 'cushion', now, false);
        } else if (r < 0.24 && !isPropBusy('bowl', c)) {
          sendCatToProp(c, 'bowl', now, false);
        } else if (r < 0.31 + playBoost && !isPropBusy('post', c)) {
          sendCatToProp(c, 'post', now, false);
        } else if (r < 0.48 + playBoost) {
          const tx = pickClearSpot(c, sw);
          c.targetX = tx;
          c.state = 'walk';
          c.dir = tx >= c.x ? 1 : -1;
          c.until = now + 2400 + Math.random() * 2800;
        } else if (r < 0.63) {
          c.state = 'stand';
          c.until = now + 2800 + Math.random() * 2800;
        } else if (r < 0.74 + cozyBoost) {
          c.state = 'sleep';
          c.until = now + 4800 + Math.random() * 4800;
        } else if (r < 0.84) {
          c.state = 'sit';
          c.until = now + 3000 + Math.random() * 3200;
        } else if (r < 0.91) {
          c.state = 'groom';
          c.until = now + 2500 + Math.random() * 2200;
        } else if (r < 0.96) {
          c.state = 'stretch';
          c.until = now + 1900 + Math.random() * 1200;
        } else {
          c.state = 'pounce';
          c.vy = -5.0;
          c.y = -1;
          setSym(c, 'spark', now, 900);
          c.until = now + 950;
        }
      };

      const onStreamingChange = (isStreaming) => {
        if (!catOnly || disposed) return;
        const now = performance.now();
        if (isStreaming) {
          for (const c of cats) {
            if (c.dragging) continue;
            if (c.state === 'sleep' || c.state === 'eat') {
              if (c.atProp === 'cushion' && c.y < 0) c.y = 0;
              c.atProp = null;
              c.targetX = null;
              c.targetProp = null;
              c.state = c.idx % 2 === 0 ? 'sit' : 'stand';
              c.twitchUntil = now + 280;
              c.until = now + 2200 + c.idx * 500;
              setSym(c, 'spark', now, 950);
              paintCat(c, now);
            }
          }
          wakeLoop();
        }
      };

      let sRaf = 0;
      let sIdleTimer = null;
      let running = false;
      let peekHidden = yieldMode === 'peek';
      let lastStepAt = 0;
      let lastNuzzleAt = 0;

      const cancelSched = () => {
        if (sRaf && typeof win.cancelAnimationFrame === 'function') {
          win.cancelAnimationFrame(sRaf);
          sRaf = 0;
        }
        if (sIdleTimer) {
          clearTimeout(sIdleTimer);
          sIdleTimer = null;
        }
      };

      const needsFastLoop = () => {
        if (reducedMotion || peekHidden) return false;
        if (yarn.active) return true;
        for (const c of cats) {
          if (c.dragging || c.state === 'walk' || c.vy !== 0 || (c.y < 0 && c.atProp !== 'cushion')) return true;
        }
        return false;
      };

      const scheduleNext = () => {
        if (!running || disposed || !catOnly || peekHidden) return;
        cancelSched();
        if (needsFastLoop() && typeof win.requestAnimationFrame === 'function') {
          sRaf = win.requestAnimationFrame(onFrame);
        } else {
          sIdleTimer = setTimeout(() => {
            sIdleTimer = null;
            step(performance.now());
            scheduleNext();
          }, 130);
        }
      };

      const wakeLoop = () => {
        if (!running || disposed || !catOnly || peekHidden) return;
        if (needsFastLoop() && !sRaf) scheduleNext();
      };

      const onFrame = (ts) => {
        sRaf = 0;
        if (!running || disposed || !catOnly || peekHidden) return;
        const now = ts || performance.now();
        if (now - lastStepAt >= 28) {
          step(now);
        }
        scheduleNext();
      };

      const step = (nowArg) => {
        if (disposed || !catOnly || peekHidden) return;
        if (isVramSleepState() || isWindowBlurred()) return;
        const now = typeof nowArg === 'number' ? nowArg : performance.now();
        const dt = lastStepAt ? Math.min(80, Math.max(12, now - lastStepAt)) : 32;
        const dtScale = dt / 55;
        lastStepAt = now;

        const sw = Math.max(220, readStageWidth());
        const minX = 18;
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
            if (yarn.x <= minX) { yarn.x = minX; yarn.vx = Math.abs(yarn.vx) * 0.85; }
            else if (yarn.x >= sw - 32) { yarn.x = sw - 32; yarn.vx = -Math.abs(yarn.vx) * 0.85; }
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

        for (const c of cats) {
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
          if (stageRect) {
            const relX = ptr.clientX - stageRect.left;
            const relY = ptr.clientY - stageRect.top;
            const dx = relX - (c.x + c.cw * 0.5);
            if (Math.abs(dx) < 160 && relY > -90 && relY < 140) {
              c.gazeDx = dx < -18 ? -1 : dx > 18 ? 1 : 0;
            } else {
              c.gazeDx = 0;
            }
          } else {
            c.gazeDx = 0;
          }

          if (!reducedMotion && now >= c.nextBlink) {
            c.blinkUntil = now + 170;
            c.nextBlink = now + 2400 + Math.random() * 3400;
          }
          if (!reducedMotion && now >= c.nextTwitch) {
            c.twitchUntil = now + 220;
            c.nextTwitch = now + 4000 + Math.random() * 4800;
          }

          if (!reducedMotion && yarn.active && c.state !== 'sleep') {
            c.targetX = null;
            c.targetProp = null;
            c.atProp = null;
            const cx = c.x + c.cw * 0.5;
            const dist = (yarn.x + 7) - cx;
            if (Math.abs(dist) < c.cw * 0.55) {
              yarn.vx = (dist >= 0 ? 1 : -1) * (4.4 + Math.random() * 2.0);
              yarn.vy = -3.8;
              c.state = 'wave';
              c.until = now + 650;
              setSym(c, 'spark', now, 750);
            } else if (c.mood === 'playful' || Math.abs(dist) < 220) {
              c.state = 'walk';
              c.dir = dist < 0 ? -1 : 1;
              c.until = now + 700;
            }
          } else if (!reducedMotion && now >= c.until) {
            pickNextBehavior(c, now, sw);
          }

          if (!reducedMotion && c.state === 'walk') {
            const boost = yarn.active ? 1.38 : 1;
            const stepPx = c.speed * 2.4 * boost * dtScale;
            if (c.targetX !== null) {
              const rem = c.targetX - c.x;
              if (Math.abs(rem) <= stepPx + 1.5) {
                c.x = c.targetX;
                if (c.targetProp) {
                  arriveAtProp(c, c.targetProp, now);
                } else {
                  c.targetX = null;
                  c.state = Math.random() < 0.5 ? 'stand' : 'sit';
                  c.until = now + 2400 + Math.random() * 2600;
                }
              } else {
                c.dir = rem > 0 ? 1 : -1;
                c.x += c.dir * stepPx;
              }
            } else {
              c.x += c.dir * stepPx;
              if (c.x <= minX) { c.x = minX; c.dir = 1; }
              else if (c.x >= maxX) { c.x = maxX; c.dir = -1; }
            }
          }
          paintCat(c, now);
        }

        // Friendly cat-to-cat nuzzle encounter (stops cleanly nose-to-nose without overlapping!)
        if (!reducedMotion && !yarn.active && now - lastNuzzleAt > 9500) {
          for (let i = 0; i < cats.length; i++) {
            for (let j = i + 1; j < cats.length; j++) {
              const a = cats[i];
              const b = cats[j];
              if (a.dragging || b.dragging || a.atProp || b.atProp || (a.state !== 'walk' && b.state !== 'walk')) continue;
              const dist = Math.abs((a.x + a.cw * 0.5) - (b.x + b.cw * 0.5));
              const noseDist = (a.cw + b.cw) * 0.54;
              if (dist < noseDist && dist > noseDist * 0.45) {
                lastNuzzleAt = now;
                a.targetX = b.targetX = null;
                a.targetProp = b.targetProp = null;
                const aLeft = a.x <= b.x;
                a.dir = aLeft ? 1 : -1;
                b.dir = -a.dir;
                a.state = 'happy';
                b.state = 'happy';
                a.until = b.until = now + 1400;
                setSym(a, 'heart', now, 1400);
                if (Math.random() < 0.5) { b.vy = -4.0; b.y = -1; }
                paintCat(a, now);
                paintCat(b, now);
                break;
              }
            }
          }
        }
      };

      const start = () => {
        running = true;
        wrap.style.display = '';
        lastStepAt = 0;
        step(performance.now());
        scheduleNext();
      };
      const stop = () => {
        running = false;
        wrap.style.display = 'none';
        cancelSched();
      };
      const setPeek = (hidden) => {
        const next = Boolean(hidden);
        if (peekHidden === next) return;
        peekHidden = next;
        if (peekHidden) {
          cancelSched();
          for (const c of cats) {
            if (c.dragging) { c.dragging = false; c.y = 0; c.vy = 0; }
          }
        } else if (running && catOnly && !disposed) {
          lastStepAt = 0;
          step(performance.now());
          scheduleNext();
        }
      };
      const dispose = () => {
        stop();
        win.removeEventListener('pointermove', onGlobalMove);
        yarn.cv.width = 0;
        yarn.cv.height = 0;
        for (const pr of propNodes) {
          pr.cleanup();
          pr.cv.width = 0;
          pr.cv.height = 0;
        }
        for (const c of cats) {
          c.cleanup();
          c.cv.width = 0;
          c.cv.height = 0;
        }
        wrap.remove();
      };
      sanctuary = { start, stop, step, onStreamingChange, setPeek, dispose };
      return sanctuary;
    };
    const syncSanctuaryMode = () => {
      if (catOnly) {
        if (typeof hostEl.setAttribute === 'function') hostEl.setAttribute('data-cat-sanctuary', '1');
        if (actors.cat.el?.style) actors.cat.el.style.display = 'none';
        if (actors.clawd.el?.style) actors.clawd.el.style.display = 'none';
        if (habitatCanvas?.style) habitatCanvas.style.display = 'none';
        if (miniGroupEl?.style) miniGroupEl.style.display = 'none';
        mountCatSanctuary().start();
      } else {
        if (typeof hostEl.removeAttribute === 'function') hostEl.removeAttribute('data-cat-sanctuary');
        if (actors.cat.el?.style) actors.cat.el.style.display = '';
        if (actors.clawd.el?.style) actors.clawd.el.style.display = '';
        if (habitatCanvas?.style) habitatCanvas.style.display = '';
        if (sanctuary) sanctuary.stop();
      }
    };
    let habitatPreview = 'auto';
    let scheduleWatchUntil = 0;
    let lastHabitatKey = '';
    const resolveHabitatMode = () => {
      if (habitatPreview !== 'auto') return habitatPreview;
      if (Date.now() < scheduleWatchUntil) return 'hourglass';
      const h = new Date().getHours();
      return h >= 23 || h < 5 ? 'lamp' : 'cactus';
    };
    const renderHabitatProp = (force = false) => {
      if (isVramSleepState()) return;
      const mode = resolveHabitatMode();
      const key = `${mode}:${dpr}`;
      if (!force && key === lastHabitatKey && habitatCanvas.width > 0 && habitatCanvas.height > 0) return;
      lastHabitatKey = key;
      const cssW = 24;
      const cssH = 30;
      habitatCanvas.width = Math.round(cssW * dpr);
      habitatCanvas.height = Math.round(cssH * dpr);
      const ctx = habitatCanvas._ctx || (habitatCanvas._ctx = habitatCanvas.getContext('2d'));
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.imageSmoothingEnabled = false;
      const propKey = mode === 'lamp' ? 'habLamp' : mode === 'hourglass' ? 'habHourglass' : 'habCactus';
      const spr = PROPS[propKey];
      if (!spr) return;
      const cell = 3;
      const hCells = spr.rows.length;
      const oy = Math.max(0, Math.floor(cssH / cell) - hCells);
      drawLayerSet(ctx, 0, oy, cell, PALETTES.clawd, [spr]);
      habitatCanvas.setAttribute('data-habitat-mode', mode);
    };
    renderHabitatProp(true);

    // ── A1 VRAM 0x0 回收与唤醒恢复（document.hidden / park / hostSleep / detached） ──
    const reclaimStageVram = () => {
      if (vramReclaimed) return;
      vramReclaimed = true;
      releaseFxCanvas();
      if (habitatCanvas) {
        habitatCanvas.width = 0;
        habitatCanvas.height = 0;
        lastHabitatKey = '';
      }
      for (const id of ['cat', 'clawd']) {
        const a = actors[id];
        if (a?.canvas) {
          a.canvas.width = 0;
          a.canvas.height = 0;
        }
        if (a?.lastRender) {
          a.lastRender.poseKey = null;
          a.lastRender.cw = 0;
          a.lastRender.ch = 0;
        }
      }
      miniCrabs.forEach((mc) => {
        if (mc.canvas) {
          mc.canvas.width = 0;
          mc.canvas.height = 0;
        }
        mc.lastFrameKey = null;
      });
    };

    const restoreStageVram = () => {
      if (!vramReclaimed && actors.cat.canvas?.width > 0 && actors.clawd.canvas?.width > 0) return false;
      dpr = readDpr();
      vramReclaimed = false;
      for (const id of ['cat', 'clawd']) {
        const a = actors[id];
        if (a?.canvas) {
          a.canvas.width = Math.round(CANVAS_W * dpr);
          a.canvas.height = Math.round(CANVAS_H * dpr);
        }
        if (a?.lastRender) a.lastRender.poseKey = null;
      }
      miniCrabs.forEach((mc) => {
        if (mc.canvas) {
          mc.canvas.width = Math.round(40 * dpr);
          mc.canvas.height = Math.round(32 * dpr);
        }
        mc.lastFrameKey = null;
      });
      lastHabitatKey = '';
      return true;
    };

    // ── 5 宠统一图腾塔拓扑、抽底重力补位与地面刚体防重叠核心 ─────────────────
    const miniById = new Map(miniCrabs.map((m) => [m.id, m]));
    const getEnt = (id) => (id === 'cat' || id === 'clawd' ? actors[id] : miniById.get(id) || null);
    const isMiniEnt = (ent) => Boolean(ent && ent.kind === 'mini');
    const entHalfW = (ent) => (isMiniEnt(ent) ? 13 : 22);
    const mountStepH = (holderId) => (holderId === 'cat' || holderId === 'clawd' ? 26 : 16);
    const allActiveEnts = () => (catOnly ? [actors.cat] : miniPileEnabled ? [actors.cat, actors.clawd, ...miniCrabs] : [actors.cat, actors.clawd]);
    const maxTowerDepthAllowed = () => (catOnly ? 1 : miniPileEnabled ? 5 : 2);

    const syncStageDpr = () => {
      const nextDpr = readDpr();
      if (nextDpr === dpr) return false;
      dpr = nextDpr;
      for (const id of ['cat', 'clawd']) {
        const a = actors[id];
        if (a.canvas) {
          a.canvas.width = Math.round(CANVAS_W * dpr);
          a.canvas.height = Math.round(CANVAS_H * dpr);
        }
        a.lastRender.poseKey = null;
      }
      miniCrabs.forEach((mc) => {
        if (mc.canvas) {
          mc.canvas.width = Math.round(40 * dpr);
          mc.canvas.height = Math.round(32 * dpr);
        }
        mc.lastFrameKey = null;
      });
      return true;
    };

    const cleanups = [];
    const MASCOT_DRAG_ATTR = 'data-ag-cs-mascot-drag';
    const RESIZE_ATTR = 'data-ag-cs-resizing';
    let rootMascotDragAttr = false;
    const syncMascotDragRootAttr = () => {
      const anyDragging =
        !disposed &&
        (Boolean(actors.cat.dragging) ||
          Boolean(actors.clawd.dragging) ||
          miniCrabs.some((mc) => Boolean(mc.dragging)));
      if (rootMascotDragAttr === anyDragging) return;
      rootMascotDragAttr = anyDragging;
      const htmlEl = doc && doc.documentElement;
      if (!htmlEl) return;
      try {
        if (anyDragging) htmlEl.setAttribute?.(MASCOT_DRAG_ATTR, '1');
        else htmlEl.removeAttribute?.(MASCOT_DRAG_ATTR);
      } catch (_) {}
    };
    const initHostW = hostEl.clientWidth;
    let hasMeasuredHostWidth = typeof initHostW === 'number' && initHostW > 0;
    let cachedHostWidth = hasMeasuredHostWidth ? initHostW : 0;
    const isMockHostWidth = Object.prototype.hasOwnProperty.call(hostEl, 'clientWidth');
    let pdOn = false, reboundTm = null, resizeRaf = 0, pendPrevW = 0, pendNextW = 0;
    const isStageResizing = () =>
      Boolean(pdOn || (doc && doc.documentElement && doc.documentElement.getAttribute?.(RESIZE_ATTR) === '1'));
    const snapRot = (deg) => {
      const v = Number(deg) || 0;
      return Math.abs(v) < 0.05 ? 0 : Math.round(v * 100) / 100;
    };
    const applyMiniTransform = (mc, tx, ty, tz, rot = 0) => {
      const dom = mc.canvas || mc.el;
      if (!dom || !dom.style) return;
      const nextRot = snapRot(rot);
      if (mc.lastDomX !== tx || mc.lastDomY !== ty || mc.lastDomRot !== nextRot) {
        mc.lastDomX = tx;
        mc.lastDomY = ty;
        mc.lastDomRot = nextRot;
        dom.style.transform = nextRot
          ? `translate3d(${tx}px, ${ty}px, 0) rotate(${nextRot}deg)`
          : `translate3d(${tx}px, ${ty}px, 0)`;
        perfStats.domTransformWrites += 1;
      } else {
        perfStats.domTransformSkips += 1;
      }
      if (tz != null && mc.lastDomZ !== tz) {
        mc.lastDomZ = tz;
        dom.style.zIndex = tz;
      }
    };
    if (win && typeof win.addEventListener === 'function') {
      const onPd = () => { pdOn = true; }, onPu = () => { pdOn = false; }, pOpt = { capture: true, passive: true };
      win.addEventListener('pointerdown', onPd, pOpt);
      win.addEventListener('pointerup', onPu, pOpt);
      win.addEventListener('pointercancel', onPu, pOpt);
      win.addEventListener('blur', onPu);
      cleanups.push(() => {
        if (reboundTm) { clearTimeout(reboundTm); pendingTimers.delete(reboundTm); reboundTm = null; }
        if (resizeRaf) { try { win.cancelAnimationFrame?.(resizeRaf); } catch {} resizeRaf = 0; }
        win.removeEventListener('pointerdown', onPd, pOpt);
        win.removeEventListener('pointerup', onPu, pOpt);
        win.removeEventListener('pointercancel', onPu, pOpt);
        win.removeEventListener('blur', onPu);
      });
    }
    const maxXFor = (w) => Math.max(catOnly ? 16 : 8, Math.max(96, w - (catOnly ? 22 : 14) - (popoverRightWidth > 0 ? Math.min(w - 150, popoverRightWidth + 16) : 0)) - 80);
    const syncTower = (a, now = performance.now()) => {
      if (isMiniEnt(a)) {
        const dom = a.canvas || a.el;
        if (dom) {
          const direct = syncDirectMotionDomAttr(a, dom);
          const tx = snapCoord(Number.isFinite(a.px) ? a.px : a.x, direct);
          const ty = snapCoord(a.y || 0, direct);
          const depth = a.stackedOn ? getStackDepth(a.id) : 0;
          const tz = a.dragging ? '39' : depth > 0 ? String(25 + depth * 2) : '25';
          applyMiniTransform(a, tx, ty, tz, a.dragging || a.ballisticActive ? a.rot : 0);
        }
      } else {
        applyActorTransform(a, now);
      }
      for (const cid of getTowerMembers(a.id)) {
        if (cid === a.id) continue;
        const r = getEnt(cid);
        if (!r) continue;
        if (isMiniEnt(r)) {
          const dom = r.canvas || r.el;
          if (!dom) continue;
          const direct = syncDirectMotionDomAttr(r, dom);
          const tx = snapCoord(getEntWorldCx(a) - 32, direct);
          const ty = snapCoord(computeWorldFootY(r), direct);
          const depth = r.stackedOn ? getStackDepth(r.id) : 0;
          const tz = r.dragging ? '39' : depth > 0 ? String(25 + depth * 2) : '25';
          r.px = tx;
          r.lastX = Math.round(tx);
          applyMiniTransform(r, tx, ty, tz, 0);
        } else {
          applyActorTransform(r, now);
        }
      }
    };
    const freeMain = (a) => Boolean(a && a.el && !a.dragging && !a.stackedOn);
    const applyReboundGlide = (a) => {
      if (reducedMotion) return;
      const now = performance.now();
      for (const cid of getTowerMembers(a.id)) {
        const ent = getEnt(cid);
        if (ent?.el?.style) {
          const seq = (ent.glideSeq = (ent.glideSeq || 0) + 1);
          ent.glideUntil = now + 320;
          ent.el.style.transition = 'transform 320ms cubic-bezier(.22,1,.36,1)';
          later(340, () => {
            if (!disposed && ent.glideSeq === seq && ent.el?.style && !ent.lastDomDirect && ent.el.style.transition.includes('320ms')) {
              ent.el.style.transition = '';
              ent.glideUntil = 0;
            }
          });
        }
      }
    };
    const launchRebound = (a, targetCapX) => {
      if (disposed || !freeMain(a) || !a.sideEdgeSnap || a.sidePushOriginX == null) return;
      const ox = a.sidePushOriginX;
      const fm = maxXFor(Math.max(readStageWidth(), cachedHostWidth));
      const tx = Math.max(8, Math.min(ox, targetCapX, fm));
      const dist = tx - a.x;
      a.sideEdgeSnap = false; a.sidePushOriginX = null; a.sideEdgeOffset = 0; a.sideEdgeDirectUntil = 0;
      if (dist >= 28 && !reducedMotion && !findDirectRider(a.id)) {
        const vy0 = -Math.max(4.6, Math.min(8.2, 4.4 + dist / 220));
        let svy = vy0, sy = 0, sb = 0, sGain = 0, sMul = 1;
        for (let t = 0; t < 160; t++) {
          svy += 0.44;
          sMul *= 0.988;
          svy *= 0.988;
          sy += svy;
          sGain += sMul;
          if (sy >= 0) {
            sy = 0;
            if (Math.abs(svy) > 2.4 && sb < 2) {
              svy = -svy * 0.36;
              sMul *= 0.82;
              sb += 1;
            } else break;
          }
        }
        const vx0 = dist / Math.max(1, sGain);
        startBallistic(a, vx0, vy0, { noSnap: true, reboundTargetX: tx, reboundNoBump: true });
        renderAllFrames(performance.now());
      } else if (tx > a.x + 1) {
        a.x = tx;
        syncTower(a);
        applyReboundGlide(a);
      } else {
        syncTower(a);
      }
    };
    const scheduleRebound = () => {
      if (reboundTm) { clearTimeout(reboundTm); pendingTimers.delete(reboundTm); reboundTm = null; }
      reboundTm = later(120, () => {
        reboundTm = null;
        if (isStageResizing()) return;
        const fm = maxXFor(Math.max(readStageWidth(), cachedHostWidth));
        const mains = [actors.cat, actors.clawd];
        const list = mains
          .filter((a) => freeMain(a) && a.sideEdgeSnap && a.sidePushOriginX != null)
          .sort((u, v) => v.sidePushOriginX - u.sidePushOriginX);
        let capX = fm;
        const targets = list.map((a) => {
          const tx = Math.max(8, Math.min(a.sidePushOriginX, capX));
          capX = Math.max(8, tx - 56);
          return { a, tx };
        });
        targets.forEach(({ a, tx }, idx) => (idx ? later(55 * idx, () => launchRebound(a, tx)) : launchRebound(a, tx)));
      });
    };
    const onStageResizeReleased = () => {
      if (disposed || isStageResizing()) return;
      const mains = [actors.cat, actors.clawd];
      const snapped = mains
        .filter((a) => freeMain(a) && a.sideEdgeSnap && a.sidePushOriginX != null)
        .sort((u, v) => v.sidePushOriginX - u.sidePushOriginX);
      if (!snapped.length) return;
      let capX = maxXFor(Math.max(readStageWidth(), cachedHostWidth));
      let needReb = false;
      for (const a of snapped) {
        const tx = Math.max(8, Math.min(a.sidePushOriginX, capX));
        capX = Math.max(8, tx - 56);
        if (tx > a.x + 2) needReb = true;
      }
      if (needReb) {
        scheduleRebound();
      } else {
        for (const a of snapped) {
          a.sideEdgeDirectUntil = 0;
          syncDirectMotionDomAttr(a, a.el);
        }
      }
    };
    const handleStageWidthResize = (prevW, nw) => {
      if (disposed || !Number.isFinite(nw) || nw <= 0 || nw === prevW) return;
      const now = performance.now(), nextMaxX = maxXFor(nw), mains = [actors.cat, actors.clawd], resizingNow = isStageResizing();
      if (nw < prevW) {
        if (reboundTm) { clearTimeout(reboundTm); pendingTimers.delete(reboundTm); reboundTm = null; }
        // 快路径：两只主角均远离右边界时 0 计算早退
        if (!mains.some((a) => freeMain(a) && a.x >= nextMaxX - 96)) return;
        const beforeX = mains.map((a) => (a ? a.x : 0));
        const order = [0, 1].sort((i, j) => beforeX[j] - beforeX[i]);
        let capX = nextMaxX;
        for (const i of order) {
          const a = mains[i];
          if (!freeMain(a)) continue;
          if (a.x > capX) { a.x = capX; capX = Math.max(8, capX - 1); }
          else capX = Math.min(capX, Math.max(8, a.x - 1));
        }
        enforceGroundSeparation();
        for (let i = 0; i < 2; i++) {
          const a = mains[i];
          if (!freeMain(a)) continue;
          if (a.x < beforeX[i] - 0.5 || a.x >= nextMaxX - 4) {
            if (a.sidePushOriginX == null) a.sidePushOriginX = beforeX[i];
            a.sideEdgeSnap = true;
            a.sideEdgeOffset = Math.max(0, nextMaxX - a.x);
            a.sideEdgeDirectUntil = now + (resizingNow ? 220 : 180);
            syncTower(a, now);
          }
        }
        return;
      }
      if (!mains.some((a) => freeMain(a) && a.sideEdgeSnap && a.sidePushOriginX != null)) return;
      let needReb = false;
      const prevMaxX = maxXFor(prevW);
      for (const a of mains) {
        if (!freeMain(a) || !a.sideEdgeSnap || a.sidePushOriginX == null) continue;
        const off = a.sideEdgeOffset || 0;
        if (!reboundTm && a.x < prevMaxX - off - 64) { a.sideEdgeSnap = false; a.sidePushOriginX = null; continue; }
        const tx = Math.min(a.sidePushOriginX, Math.max(8, nextMaxX - off));
        if (resizingNow) {
          if (reboundTm) { clearTimeout(reboundTm); pendingTimers.delete(reboundTm); reboundTm = null; }
          a.sideEdgeDirectUntil = now + 220;
          a.x = tx;
          syncTower(a, now);
          if (tx >= a.sidePushOriginX - 1) { a.sideEdgeSnap = false; a.sidePushOriginX = null; a.sideEdgeOffset = 0; }
        } else {
          needReb = true;
        }
      }
      if (needReb) {
        scheduleRebound();
      }
    };
    const schedStageResize = (prevW, nw) => {
      if (!pendPrevW) pendPrevW = prevW;
      pendNextW = nw;
      if (resizeRaf) return;
      const flush = () => {
        if (disposed) return;
        resizeRaf = 0;
        const p = pendPrevW, n = pendNextW;
        pendPrevW = pendNextW = 0;
        handleStageWidthResize(p, n);
      };
      if (win && typeof win.requestAnimationFrame === 'function') resizeRaf = win.requestAnimationFrame(flush);
      else flush();
    };
    if (!isMockHostWidth && typeof ResizeObserver === 'function' && hostEl && hostEl.nodeType === 1) {
      try {
        const hostRo = new ResizeObserver((entries) => {
          if (disposed) return;
          const lastEntry = entries && entries.length ? entries[entries.length - 1] : null;
          const cr = lastEntry && lastEntry.contentRect;
          // 仅读取 contentRect.width，杜绝折叠/空帧回退读 hostEl.clientWidth 触发同步回流
          const nw = cr && typeof cr.width === 'number' ? Math.round(cr.width) : 0;
          const dprChanged = syncStageDpr();
          if (nw > 0) {
            const prevW = cachedHostWidth || 720;
            hasMeasuredHostWidth = true;
            cachedHostWidth = nw;
            if (nw !== prevW) schedStageResize(prevW, nw);
          }
          if (dprChanged) renderAllFrames(performance.now());
        });
        hostRo.observe(hostEl);
        cleanups.push(() => hostRo.disconnect());
      } catch (_) {}
    }
    const readStageWidth = () => {
      if (isMockHostWidth) return hostEl.clientWidth || 720;
      if (!hasMeasuredHostWidth) {
        const w = hostEl.clientWidth;
        if (typeof w === 'number' && w > 0) {
          cachedHostWidth = w;
          hasMeasuredHostWidth = true;
        }
      }
      return cachedHostWidth || 720;
    };

    const stageBoundsX = () => {
      const w = readStageWidth();
      const rightReserve = popoverRightWidth > 0 ? Math.min(w - 150, popoverRightWidth + 16) : 0;
      return {
        minX: 14,
        maxX: Math.max(96, w - 14 - rightReserve),
      };
    };

    const clampActorX = (x) => {
      const w = readStageWidth();
      const rightReserve = popoverRightWidth > 0 ? Math.min(w - 150, popoverRightWidth + 16) : 0;
      const maxX = Math.max(24, w - 88 - rightReserve);
      return Math.max(8, Math.min(maxX, x));
    };

    const getEntWorldCx = (ent) => (isMiniEnt(ent) ? 12 + (Number.isFinite(ent.px) ? ent.px : ent.x) + 20 : ent.x + 48);
    const setEntWorldCx = (ent, cx) => {
      const { minX, maxX } = stageBoundsX();
      const hw = entHalfW(ent);
      const clamped = Math.max(minX + hw, Math.min(maxX - hw, cx));
      if (isMiniEnt(ent)) {
        const px = Math.max(2, clamped - 32);
        ent.px = px;
        ent.lastX = Math.round(px);
      } else {
        ent.x = clampActorX(clamped - 48);
      }
    };

    const findDirectRider = (holderId) => {
      for (const e of [actors.cat, actors.clawd, ...miniCrabs]) {
        if (e.stackedOn === holderId) return e;
      }
      return null;
    };

    const getStackDepth = (id) => {
      let d = 0;
      let cur = getEnt(id);
      const seen = new Set();
      while (cur && cur.stackedOn && !seen.has(cur.id)) {
        seen.add(cur.id);
        const base = getEnt(cur.stackedOn);
        if (!base) break;
        d += 1;
        cur = base;
      }
      return d;
    };

    const getTowerRoot = (id) => {
      let cur = getEnt(id);
      const seen = new Set();
      while (cur && cur.stackedOn && !seen.has(cur.id)) {
        seen.add(cur.id);
        const base = getEnt(cur.stackedOn);
        if (!base) break;
        cur = base;
      }
      return cur;
    };

    const getTowerMembers = (anyId) => {
      const root = getTowerRoot(anyId);
      if (!root) return [];
      const chain = [root.id];
      const seen = new Set(chain);
      let curId = root.id;
      while (true) {
        const next = findDirectRider(curId);
        if (!next || seen.has(next.id)) break;
        seen.add(next.id);
        chain.push(next.id);
        curId = next.id;
      }
      return chain;
    };

    const getStackTop = (anyId) => {
      const chain = getTowerMembers(anyId);
      return chain.length ? getEnt(chain[chain.length - 1]) : getEnt(anyId);
    };

    const listAllTowers = () => {
      const out = [];
      const visited = new Set();
      for (const e of allActiveEnts()) {
        if (visited.has(e.id)) continue;
        const chain = getTowerMembers(e.id);
        chain.forEach((cid) => visited.add(cid));
        if (chain.length >= 2) out.push(chain);
      }
      return out;
    };

    const computeWorldFootY = (ent) => {
      if (!ent) return 0;
      if (ent.stackedOn) {
        const seen = new Set([ent.id]);
        let cur = ent;
        let yAcc = 0;
        while (cur && cur.stackedOn && !seen.has(cur.stackedOn)) {
          seen.add(cur.stackedOn);
          const base = getEnt(cur.stackedOn);
          if (!base) break;
          yAcc -= mountStepH(base.id);
          cur = base;
        }
        return (cur ? cur.y || 0 : 0) + yAcc;
      }
      return ent.y || 0;
    };

    const syncAllStackedFollowers = () => {
      for (const root of allActiveEnts()) {
        if (root.stackedOn) continue;
        const chain = getTowerMembers(root.id);
        if (chain.length < 2) continue;
        const rootCx = getEntWorldCx(root);
        let yCursor = root.y || 0;
        for (let i = 1; i < chain.length; i++) {
          const prev = getEnt(chain[i - 1]);
          const rider = getEnt(chain[i]);
          if (!rider || rider.dragging) break;
          yCursor -= mountStepH(prev.id);
          setEntWorldCx(rider, rootCx);
          rider.y = yCursor;
        }
      }
    };

    const enforceGroundSeparation = (lockedId = null) => {
      const { minX, maxX } = stageBoundsX();
      const groundList = [];
      for (const e of allActiveEnts()) {
        if (e.stackedOn || e.dragging || e.ballisticActive) continue;
        if ((e.y || 0) < -3 || e.leap) continue;
        if (isMiniEnt(e) && e.act && (e.act.type === 'ride' || e.act.type === 'leap')) continue;
        groundList.push({
          id: e.id,
          ent: e,
          cx: getEntWorldCx(e),
          halfW: entHalfW(e),
          locked: e.id === lockedId,
        });
      }
      if (groundList.length >= 2) {
        resolveGroundSeparation(groundList, minX, maxX, 6);
        for (const item of groundList) {
          if (!item.locked) setEntWorldCx(item.ent, item.cx);
        }
      }
      syncAllStackedFollowers();
    };

    const spawnChromaBurst = (cx, cy, count = 12, gentle = false) => {
      for (let i = 0; i < count; i++) {
        if (chromaSparks.length >= 48) chromaSparks.shift();
        const ang = gentle
          ? -Math.PI * (0.25 + Math.random() * 0.5)
          : (i / Math.max(1, count)) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
        const spd = gentle ? 0.6 + Math.random() * 0.9 : 2.2 + (i % 2) * 1.15 + Math.random() * 0.6;
        chromaSparks.push({
          x: cx + (gentle ? (Math.random() - 0.5) * 14 : 0),
          y: cy + (gentle ? -4 - Math.random() * 8 : 0),
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - (gentle ? 0.8 : 1.1),
          life: 0,
          maxLife: gentle ? 6 : 11,
          color: CHROMA_HEX[i % CHROMA_HEX.length],
          size: gentle ? 3 : i % 3 === 0 ? 4 : 3,
        });
      }
    };

    const getRestPositions = () => {
      const w = readStageWidth();
      const safeRight = popoverRightWidth > 0 ? Math.max(185, w - popoverRightWidth - 18) : w - 12;
      const leaderX = clampActorX(safeRight - 82);
      const partnerX = clampActorX(leaderX - 66);
      return camp === 'claude' ? { clawd: leaderX, cat: partnerX } : { cat: leaderX, clawd: partnerX };
    };

    const resetHomePositions = (animateWalk = false) => {
      const pos = getRestPositions();
      for (const id of ['cat', 'clawd']) {
        const a = actors[id];
        if (a.dragging || a.stackedOn) continue;
        a.sideEdgeSnap = false;
        a.sidePushOriginX = null;
        a.sideEdgeOffset = 0;
        a.sideEdgeDirectUntil = 0;
        const target = pos[id];
        if (animateWalk && !reducedMotion && Math.abs(a.x - target) > 6 && a.y === 0) {
          a.overridePose = 'walk';
          a.overrideUntil = performance.now() + 380;
          a.overrideRot = 0;
        }
        a.x = target;
        if (a.y > 0) a.y = 0;
      }
      enforceGroundSeparation();
    };

    resetHomePositions(false);

    // ── 节拍序列：steps = [pose, ticks, sqW, sqH, lift] ───────────────────────
    const playSeq = (actor, steps, then) => {
      actor.seq = steps.map(([pose, ticks, sqW = 0, sqH = 0, lift = 0]) => ({ pose, ticks, sqW, sqH, lift }));
      actor.seqStartTick = tickIdx + 1;
      actor.seqThen = then || null;
    };
    const seqStep = (actor) => {
      if (!actor.seq) return null;
      let k = Math.max(0, tickIdx - actor.seqStartTick);
      for (const st of actor.seq) {
        if (k < st.ticks) return st;
        k -= st.ticks;
      }
      actor.seq = null;
      const then = actor.seqThen;
      actor.seqThen = null;
      if (then) then();
      return null;
    };
    const seqTotalMs = (steps) => steps.reduce((s, st) => s + st[1] * TICK, 0) + TICK;

    const landingSteps = (flatTicks) => [
      ['flat', flatTicks, 2, 0],
      ['idle', 1, -2, 1],
      ['idle', 1, 2, -1],
    ];

    const hopSteps = (airPose) => [
      ['squash', 1, 2, -1, 0],
      [airPose, 1, -1, 1, -2],
      [airPose, 1, 0, 0, -4],
      [airPose, 1, 0, 0, -4],
      [airPose, 1, 0, 0, -2],
      ['idle', 1, 2, -1, 0],
    ];

    const resolvePoseFor = (actor, now) => {
      if (actor.dragging) return 'dangle';
      const st = seqStep(actor);
      if (st) return st.pose;
      if (actor.overridePose && now < actor.overrideUntil) return actor.overridePose;
      if (actor.overridePose && now >= actor.overrideUntil) {
        actor.overridePose = null;
        actor.overrideRot = 0;
        actor.mirror = false;
        actor.faceDir = null;
        actor.clipParam = null;
      }
      if (yieldMode === 'peek') return 'peek';
      const isLeader = (camp === 'claude' && actor.id === 'clawd') || (camp !== 'claude' && actor.id === 'cat');
      if (hasError && isLeader) return 'angry';
      if (streaming) {
        return isLeader ? 'write' : actor.id === 'cat' ? 'loaf' : 'sleep';
      }
      if (dozing) return 'sleep';
      if (!isLeader && actor.id === 'cat' && Math.floor(now / 9000) % 2 === 1) return 'loaf';
      return actor.pose || 'idle';
    };

    const effectiveRot = (a, now) => {
      if (a.stackedOn && a.balRot && !a.dragging) return a.balRot;
      return now < a.overrideUntil && a.overrideRot ? a.overrideRot : a.rot;
    };

    const isEntDirectMotion = (ent) => {
      if (!ent) return false;
      const now = performance.now();
      const resizingNow = isStageResizing();
      if (
        ent.dragging ||
        ent.ballisticActive ||
        ent.leap ||
        (ent.sideEdgeSnap && resizingNow) ||
        (ent.sideEdgeDirectUntil > 0 && now < ent.sideEdgeDirectUntil) ||
        (!ent.stackedOn && (ent.y || 0) < -0.4)
      ) {
        return true;
      }
      if (ent.stackedOn) {
        const root = getTowerRoot(ent.id);
        if (
          root &&
          root !== ent &&
          (root.dragging ||
            root.ballisticActive ||
            root.leap ||
            (root.sideEdgeSnap && resizingNow) ||
            (root.sideEdgeDirectUntil > 0 && now < root.sideEdgeDirectUntil) ||
            (root.y || 0) < -0.4)
        ) {
          return true;
        }
      }
      return false;
    };

    const syncDirectMotionDomAttr = (ent, domEl) => {
      if (!domEl || !domEl.style) return false;
      const direct = isEntDirectMotion(ent);
      const dragNow = Boolean(ent && ent.dragging);
      if (ent.lastDomDirect !== direct) {
        ent.lastDomDirect = direct;
        if (direct) {
          domEl.setAttribute?.('data-direct', '1');
          domEl.style.transition = 'none';
        } else {
          domEl.removeAttribute?.('data-direct');
          domEl.style.transition = '';
        }
      }
      if (ent.lastDomDrag !== dragNow) {
        ent.lastDomDrag = dragNow;
        if (dragNow) {
          domEl.setAttribute?.('data-dragging', '1');
          domEl.style.cursor = 'grabbing';
        } else {
          domEl.removeAttribute?.('data-dragging');
          domEl.style.cursor = 'grab';
        }
      }
      syncMascotDragRootAttr();
      return direct;
    };

    const snapCoord = (v, direct) => (direct ? Math.round(v * 100) / 100 : Math.round(v));

    const applyActorTransform = (actor, now = performance.now()) => {
      if (!actor.el) return;
      let yPx = actor.y;
      if (actor.stackedOn) {
        const root = getTowerRoot(actor.id);
        const worldCx = getEntWorldCx(root || actor);
        actor.x = clampActorX(worldCx - 48);
        yPx = computeWorldFootY(actor) + (yieldMode === 'leap' ? -leapOffsetY : 0);
      } else if (yieldMode === 'leap' && !actor.dragging && actor.y === 0) {
        yPx -= leapOffsetY;
      } else if (yieldMode === 'peek' && !actor.dragging) {
        yPx += 1;
      }
      const direct = syncDirectMotionDomAttr(actor, actor.el);
      const depth = actor.stackedOn ? getStackDepth(actor.id) : 0;
      const tx = snapCoord(actor.x, direct);
      const ty = snapCoord(yPx, direct);
      const tz = yieldMode === 'peek' ? '8' : actor.dragging ? '38' : depth > 0 ? String(24 + depth * 2) : '24';
      if (actor.lastDomX !== tx || actor.lastDomY !== ty) {
        actor.lastDomX = tx;
        actor.lastDomY = ty;
        actor.el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
        perfStats.domTransformWrites += 1;
      } else {
        perfStats.domTransformSkips += 1;
      }
      // 60fps GPU 倾角同步到内层 canvas（外层 actor.el 维持纯 translate3d 兼容），静止 rot=0 清回 ''
      const nextRot = snapRot(inspectState ? 0 : effectiveRot(actor, now));
      if (actor.lastDomRot !== nextRot) {
        actor.lastDomRot = nextRot;
        actor.lastRender.lastRot = nextRot;
        if (actor.canvas && actor.canvas.style) {
          actor.canvas.style.transform = nextRot ? `rotate(${nextRot}deg)` : '';
        }
        perfStats.domTransformWrites += 1;
      }
      if (actor.lastDomZ !== tz) {
        actor.lastDomZ = tz;
        actor.el.style.zIndex = tz;
      }
    };

    // ── 待机微动作：随机眨眼 / 呼吸下沉 / 耳尖抖动 / 单钳开合 / 左顾右盼 ──
    const updateIdleFx = (a, pose, now) => {
      // 眨眼计时在任何姿态下推进，仅在可眨眼姿态生效；减少动态时依旧保留
      if (tickIdx >= a.nextBlinkTick) {
        a.blinkTick = tickIdx;
        a.blinkDouble = Math.random() < 0.15;
        a.nextBlinkTick = tickIdx + ticksIn(2400, 6000) + (a.blinkDouble ? 5 : 3);
      }
      const bk = tickIdx - a.blinkTick;
      const blinkSeq = a.blinkDouble ? BLINK_DOUBLE : BLINK_SINGLE;
      const fx = {
        blinkStage: bk >= 0 && bk < blinkSeq.length ? blinkSeq[bk] : null,
        breath: false,
        earTwitch: null,
        clawSnap: null,
        glance: 0,
      };
      const idleNow = pose === 'idle' && !a.seq && !a.dragging;
      if (reducedMotion || !idleNow) {
        // 非待机期间把到期的微动作顺延，避免回到待机瞬间扎堆触发
        if (tickIdx >= a.nextBreathTick) a.nextBreathTick = tickIdx + ticksIn(800, 1800);
        if (tickIdx >= a.nextTwitchTick) a.nextTwitchTick = tickIdx + ticksIn(1500, 4000);
        if (tickIdx >= a.nextSnapTick) a.nextSnapTick = tickIdx + ticksIn(1500, 4000);
        a.glanceDir = 0;
        if (now >= a.nextGlanceAt) a.nextGlanceAt = now + rand(1500, 4000);
        return fx;
      }
      // 呼吸：每 2.8~4.2s 下沉 1 格持续 2 拍
      if (tickIdx >= a.nextBreathTick) {
        a.breathTick = tickIdx;
        a.nextBreathTick = tickIdx + ticksIn(2800, 4200);
      }
      const brk = tickIdx - a.breathTick;
      fx.breath = brk >= 0 && brk < 2;
      if (a.kind === 'cat') {
        // 耳尖抖动：6~10s 一次，1~2 拍
        if (tickIdx >= a.nextTwitchTick) {
          a.twitchTick = tickIdx;
          a.twitchLen = Math.random() < 0.5 ? 1 : 2;
          a.twitchSide = Math.random() < 0.5 ? 'L' : 'R';
          a.nextTwitchTick = tickIdx + ticksIn(6000, 10000);
        }
        const tk = tickIdx - a.twitchTick;
        if (tk >= 0 && tk < a.twitchLen) fx.earTwitch = a.twitchSide;
      } else {
        // 单钳开合：8~12s 一次，开-合-开-合 共 4 拍
        if (tickIdx >= a.nextSnapTick) {
          a.snapTick = tickIdx;
          a.snapSide = Math.random() < 0.5 ? 'L' : 'R';
          a.nextSnapTick = tickIdx + ticksIn(8000, 12000);
        }
        const sk = tickIdx - a.snapTick;
        if (sk >= 0 && sk < 4 && sk % 2 === 0) fx.clawSnap = a.snapSide;
      }
      // 左顾右盼：随机方向 + 随机驻留，30% 概率回看另一侧
      if (!a.glanceDir && now >= a.nextGlanceAt) {
        a.glanceDir = Math.random() < 0.5 ? -1 : 1;
        a.glanceUntil = now + rand(600, 1800);
        a.glanceSecond = Math.random() < 0.3;
      }
      if (a.glanceDir && now >= a.glanceUntil) {
        if (a.glanceSecond) {
          a.glanceDir = -a.glanceDir;
          a.glanceUntil = now + rand(500, 1400);
          a.glanceSecond = false;
        } else {
          a.glanceDir = 0;
          a.nextGlanceAt = now + rand(4000, 9000);
        }
      }
      fx.glance = a.glanceDir;
      return fx;
    };

    // ── 叠叠乐平衡：下方角色（含迷你蟹）每拍位移 → 上方角色反向摆角（±8°）──
    const updateBalance = () => {
      for (const id of ['cat', 'clawd']) {
        const top = actors[id];
        const base = top.stackedOn ? getEnt(top.stackedOn) : null;
        let target = 0;
        if (base && !reducedMotion && base.prevCx != null) {
          target = Math.max(-8, Math.min(8, -(getEntWorldCx(base) - base.prevCx) * 4));
        }
        top.balRot = Math.abs(target) >= Math.abs(top.balRot) ? target : top.balRot * 0.55 + target * 0.45;
        if (Math.abs(top.balRot) < 0.4) top.balRot = 0;
      }
      for (const e of allActiveEnts()) e.prevCx = getEntWorldCx(e);
    };

    // ── 生态联动辅助：打盹 z / 迷你蟹互动路径 ─────────────────────────────
    // 打盹符号：日间打盹冒 z（小→中→大），深夜（23:00~05:00）吹轻柔睡眠小鼻泡
    const dozeSymFor = (a) => {
      if (isLateNight()) {
        if (reducedMotion) return 'sleepBubble0';
        const ph = (tickIdx + (a.id === 'cat' ? 4 : 0)) % 12;
        return ph < 6 ? 'sleepBubble0' : 'sleepBubble1';
      }
      if (reducedMotion) return 'dozeZ1';
      const ph = (tickIdx + (a.id === 'cat' ? 9 : 0)) % 18;
      return ph < 4 ? 'dozeZ0' : ph < 8 ? 'dozeZ1' : ph < 12 ? 'dozeZ2' : null;
    };
    const crabRiding = () =>
      miniPileEnabled && miniCrabs.some((mc) => mc.act && mc.act.type === 'ride' && tickIdx >= mc.act.start);

    // 迷你蟹分段路径求值：返回 { x, y, sprite, mirror, hopPx }；未激活或结束返回 null
    const miniActPose = (mc, baseSprite, anim) => {
      const act = mc.act;
      if (!act) return null;
      const t = tickIdx - act.start;
      if (t < 0) return null;
      let k0 = t;
      let segIdx = -1;
      for (let i = 0; i < act.segs.length; i++) {
        if (k0 < act.segs[i].ticks) {
          segIdx = i;
          break;
        }
        k0 -= act.segs[i].ticks;
      }
      if (segIdx < 0 || (act.abort && act.abort(segIdx))) {
        mc.act = null;
        if (segIdx >= 0 && act.onAbort) act.onAbort();
        return null;
      }
      const seg = act.segs[segIdx];
      const k = (k0 + 1) / seg.ticks;
      const x = seg.x0 + (seg.x1 - seg.x0) * k;
      const y = seg.y0 + (seg.y1 - seg.y0) * k - (seg.arc || 0) * Math.sin(Math.PI * k);
      if (seg.x1 !== seg.x0) mc.mirror = seg.x1 < seg.x0;
      else if (seg.face) mc.mirror = seg.face < 0;
      const still = MINI_SPRITES[mc.id];
      const blinking = tickIdx - mc.blinkAt >= 0 && tickIdx - mc.blinkAt < 2;
      let sprite;
      if (seg.sprite === 'walk') sprite = tickIdx % 2 ? anim.walkB : still;
      else if (seg.sprite === 'trick') sprite = anim.trick;
      else if (seg.sprite === 'wave') sprite = reducedMotion || k0 % 4 < 2 ? anim.trick : still;
      else if (seg.sprite === 'sit') sprite = k0 >= 8 && k0 < 14 && k0 % 4 < 2 ? anim.trick : blinking ? miniBlinkFrame(still) : still;
      else sprite = blinking ? miniBlinkFrame(still) : still;
      return {
        x: Math.round(x),
        y: Math.round(y / 2) * 2,
        sprite: sprite || baseSprite,
        mirror: mc.mirror,
        hopPx: seg.hop && !reducedMotion && k0 % 4 < 2 ? -2 : 0,
      };
    };

    // 迷你蟹坐标：translateX 相对迷你堆左缘（宿主 left 12px），精灵中心在画布 20px 处
    const crabHostCenter = (mc) => 12 + mc.lastX + 20;
    const crabSafeX = (x) => Math.min(clampActorX(9999) - 132, Math.max(2, Math.round(x)));
    const crabMaxX = () => Math.max(40, readStageWidth() - 52);
    const nearestFreeCrab = (hx) =>
      miniCrabs
        .filter((mc) => !mc.act || tickIdx - mc.act.start < 0)
        .sort((m1, m2) => Math.abs(crabHostCenter(m1) - hx) - Math.abs(crabHostCenter(m2) - hx))[0] || null;
    const actorFree = (a, now) =>
      !a.dragging && !a.ballisticActive && !a.stackedOn && !a.seq && a.y === 0 && !(a.overridePose === 'dangle' && now < a.overrideUntil);

    // 迎宾：三蟹集体挥手（复用 trick 帧，错峰 2 拍起手）
    const crabsWave = () => {
      if (!miniPileEnabled) return;
      miniCrabs.forEach((mc, idx) => {
        if (mc.act && mc.act.type === 'ride') return;
        const x = crabSafeX(mc.lastX);
        mc.act = {
          type: 'wave',
          start: tickIdx + 1 + idx * 2,
          segs: [{ ticks: 14, x0: x, x1: x, y0: 0, y1: 0, sprite: 'wave', hop: true }],
        };
      });
    };

    // 抛掷落地砸在蟹附近：受惊跳开 → 定住 → 慢慢走回原位
    const scatterCrabsNear = (hx) => {
      if (!miniPileEnabled || reducedMotion) return;
      miniCrabs.forEach((mc, idx) => {
        if (mc.act && mc.act.type === 'ride') return;
        const d = crabHostCenter(mc) - hx;
        if (Math.abs(d) >= 64) return;
        const dir = d >= 0 ? 1 : -1;
        const x0 = crabSafeX(mc.lastX);
        const far = Math.max(0, Math.min(crabMaxX(), x0 + dir * 26));
        mc.act = {
          type: 'scatter',
          start: tickIdx + (idx % 2),
          segs: [
            { ticks: 5, x0, x1: far, y0: 0, y1: 0, arc: 6, sprite: 'walk' },
            { ticks: 4, x0: far, x1: far, y0: 0, y1: 0, sprite: 'still', face: -dir },
            { ticks: 9, x0: far, x1: x0, y0: 0, y1: 0, sprite: 'walk' },
          ],
        };
      });
    };

    let crabSerial = 0;
    // 小猫追蟹：一只迷你蟹跑到猫跟前挑衅 → 猫惊觉追几步 → 蟹逃回原位 → 猫歪头
    const runCrabChase = (force) => {
      const now = performance.now();
      const cat = actors.cat;
      if (!miniPileEnabled || reducedMotion || dozing || !actorFree(cat, now)) return false;
      if (!force && stageBusy()) return false;
      const mc = nearestFreeCrab(cat.x + 48);
      if (!mc) return false;
      const x0 = crabSafeX(mc.lastX);
      const crabLeft = x0 + 20 + 12 < cat.x + 48;
      const tx = Math.max(0, Math.min(crabMaxX(), crabLeft ? cat.x - 26 : cat.x + 58));
      const catDir = crabLeft ? -1 : 1;
      const dist = Math.abs(tx - x0);
      const approach = Math.max(3, Math.min(36, Math.round(dist / 7)));
      const flee = Math.max(4, Math.min(28, Math.round(dist / 10)));
      const act = {
        type: 'chase',
        start: tickIdx + 1,
        segs: [
          { ticks: approach, x0, x1: tx, y0: 0, y1: 0, sprite: 'walk' },
          { ticks: 6, x0: tx, x1: tx, y0: 0, y1: 0, sprite: 'wave', face: -catDir },
          { ticks: flee, x0: tx, x1: x0, y0: 0, y1: 0, sprite: 'walk', hop: true },
        ],
      };
      mc.act = act;
      const serial = (crabSerial += 1);
      const alive = () => serial === crabSerial && !disposed && !reducedMotion && !cat.dragging && !cat.stackedOn && !dozing;
      const t0 = (approach + 1) * TICK;
      later(t0, () => {
        if (!alive()) return;
        startClip(cat, 'wow', 500, { sym: 'bang' });
        renderAllFrames(performance.now());
      });
      later(t0 + 500, () => {
        if (!alive()) return;
        startClip(cat, 'walk', 1200, { patrolDir: catDir, mirror: catDir > 0, sym: 'spark', symDurationMs: 600 });
      });
      later(t0 + 1750, () => {
        if (!alive()) return;
        startClip(cat, 'tilt', 900, { rot: -9, sym: 'q' });
        renderAllFrames(performance.now());
      });
      later(t0 + 2750, () => {
        if (alive() && !stageBusy()) resetHomePositions(true);
      });
      return true;
    };

    // 迷你蟹骑头：走到 Clawd 脚边 → 整格弧线跳上头顶坐一会儿（中途挥手）→ 跳下走回
    const runCrabRide = (force) => {
      const now = performance.now();
      const clawd = actors.clawd;
      if (!miniPileEnabled || reducedMotion || dozing || yieldMode !== 'none') return false;
      if (!actorFree(clawd, now) || actors.cat.stackedOn === 'clawd') return false;
      if (!force && stageBusy()) return false;
      const mc = nearestFreeCrab(clawd.x + 48);
      if (!mc) return false;
      const x0 = crabSafeX(mc.lastX);
      const clawdX0 = clawd.x;
      // Clawd 头顶（y=0 行顶边）距宿主底 33px，迷你蟹脚底距宿主底 11px → 上移 22px；水平居中对齐 48px / 20px
      const headX = Math.round(clawd.x + 16);
      const headY = -22;
      const side = x0 + 32 < clawd.x + 48 ? -1 : 1;
      const sideX = Math.max(0, Math.min(crabMaxX(), headX + side * 36));
      const approach = Math.max(1, Math.min(36, Math.round(Math.abs(sideX - x0) / 7)));
      const SIT = 22;
      const act = {
        type: 'ride',
        start: tickIdx + 1,
        segs: [
          { ticks: approach, x0, x1: sideX, y0: 0, y1: 0, sprite: 'walk' },
          { ticks: 4, x0: sideX, x1: headX, y0: 0, y1: headY, arc: 10, sprite: 'trick' },
          { ticks: SIT, x0: headX, x1: headX, y0: headY, y1: headY, sprite: 'sit', face: -side },
          { ticks: 4, x0: headX, x1: sideX, y0: headY, y1: 0, arc: 8, sprite: 'trick' },
          { ticks: Math.max(2, approach), x0: sideX, x1: x0, y0: 0, y1: 0, sprite: 'walk' },
        ],
        // Clawd 被拖走 / 起飞 / 位移 / 叠叠乐时，蟹立即放弃骑头回到原位
        abort: (segIdx) =>
          segIdx >= 1 &&
          segIdx <= 3 &&
          (clawd.dragging ||
            clawd.stackedOn ||
            actors.cat.stackedOn === 'clawd' ||
            clawd.y !== 0 ||
            Math.abs(clawd.x - clawdX0) > 2 ||
            yieldMode !== 'none' ||
            dozing),
        onAbort: () => {
          if (clawd.overridePose === 'carry') clawd.overrideUntil = 0;
        },
      };
      mc.act = act;
      const tLand = (1 + approach + 4) * TICK;
      later(tLand, () => {
        if (mc.act !== act) return;
        startClip(clawd, 'carry', SIT * TICK + 60);
        renderAllFrames(performance.now());
      });
      later(tLand + (SIT + 4) * TICK, () => {
        if (mc.act !== act) return;
        startClip(clawd, 'happy', 700, { sym: 'spark' });
        renderAllFrames(performance.now());
      });
      return true;
    };

    // 舞台棱镜像素星屑渲染器（无粒子时自动缩回 0×0 释放 GPU 显存纹理，0 常驻开销）
    const stepAndPaintChromaFx = () => {
      if (!chromaSparks.length) {
        if (!fxCanvasCleared || fxCanvas.width || fxCanvas.height) releaseFxCanvas();
        return;
      }
      fxCanvasCleared = false;
      const wCss = Math.max(240, readStageWidth());
      const hCss = 160;
      const tw = Math.round(wCss * dpr);
      const th = Math.round(hCss * dpr);
      if (fxCanvas.style?.display === 'none') fxCanvas.style.display = '';
      if (fxCanvas.width !== tw || fxCanvas.height !== th) {
        fxCanvas.width = tw;
        fxCanvas.height = th;
        if (fxCanvas.style) { fxCanvas.style.width = `${wCss}px`; fxCanvas.style.height = `${hCss}px`; }
      }
      const ctx = fxCanvas._ctx || (fxCanvas._ctx = fxCanvas.getContext('2d'));
      if (!ctx) { chromaSparks.length = 0; releaseFxCanvas(); return; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, wCss, hCss);
      ctx.imageSmoothingEnabled = false;
      for (let i = chromaSparks.length - 1; i >= 0; i--) {
        const sp = chromaSparks[i];
        sp.life += 1;
        if (sp.life > sp.maxLife) { chromaSparks.splice(i, 1); continue; }
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vy += 0.28;
        ctx.fillStyle = sp.life % 3 === 1 ? '#FFFFFF' : sp.color;
        ctx.fillRect(Math.round(sp.x / PX) * PX, Math.round((hCss - 8 + sp.y) / PX) * PX, sp.size, sp.size);
      }
      if (!chromaSparks.length) releaseFxCanvas();
    };

    let lastChromaStepTick = -1;
    const renderAllFrames = (now) => {
      if (isVramSleepState()) {
        reclaimStageVram();
        return;
      }
      restoreStageVram();
      syncStageDpr();
      renderHabitatProp(false);
      if (prismaticCoat && !reducedMotion && !dozing && lastChromaStepTick !== tickIdx) {
        lastChromaStepTick = tickIdx;
        if (tickIdx % 3 === 0) {
          chromaPhase = (chromaPhase + 1 / 12) % 1;
        }
      }
      syncAllStackedFollowers();

      for (const id of ['cat', 'clawd']) {
        const a = actors[id];
        let pose = resolvePoseFor(a, now);
        const st = seqStep(a);

        // 待机巡逻位移（每拍定步推进，底下散步时稳稳驮着头顶整串伙伴同步移动）
        if (pose === 'walk' && !a.dragging && !a.stackedOn && !a.leap && now < a.overrideUntil && !reducedMotion && a.walkStepTick !== tickIdx) {
          a.walkStepTick = tickIdx;
          const stepPx = now < a.passBoostUntil ? 1.4 * 1.55 : 1.4;
          a.x = clampActorX(a.x + a.patrolDir * stepPx);
          if (a.x <= 12 || a.x >= clampActorX(9999) - 2) a.patrolDir *= -1;
          syncAllStackedFollowers();
        }

        // 自动搭便车超时后轻巧侧跳落地
        if (a.stackedOn && a.perchUntil > 0 && now >= a.perchUntil && !a.dragging) {
          a.perchUntil = 0;
          const prevY = computeWorldFootY(a);
          const jumpDir = a.id === 'cat' ? 1 : -1;
          a.stackedOn = null;
          resetActorTransient(a, { keepFly: true });
          a.y = prevY;
          startBallistic(a, jumpDir * 2.8, -3.6, { noSnap: true });
        }

        // 主动抛物线撑跳越过 / 搭便车跃上（Leapfrog / AutoPerch，峰值 ~26px）
        if (a.leap && !a.dragging) {
          const lp = a.leap;
          const k = Math.min(1, (tickIdx - lp.startTick + 1) / Math.max(1, lp.ticks));
          const cx = lp.cx0 + (lp.cx1 - lp.cx0) * k;
          setEntWorldCx(a, cx);
          a.y = -Math.round(lp.peak * Math.sin(Math.PI * k));
          pose = k < 1 ? 'spinHop' : 'idle';
          if (k >= 1) {
            a.leap = null;
            a.y = 0;
            if (lp.landOnto) {
              const holder = getEnt(lp.landOnto);
              if (holder && !holder.dragging && getTowerMembers(holder.id).length < maxTowerDepthAllowed()) {
                a.stackedOn = holder.id;
                a.perchUntil = now + 7600;
                a.sym = 'heart';
                a.symUntil = now + 1000;
                playSeq(a, [['happy', 1, 2, -1, 0]]);
                syncAllStackedFollowers();
              } else {
                playSeq(a, [['idle', 1, 2, -1, 0]]);
                enforceGroundSeparation();
              }
            } else {
              playSeq(a, [['idle', 1, 2, -1, 0]]);
              enforceGroundSeparation();
            }
          }
          syncAllStackedFollowers();
        }

        // 叠叠乐上层失衡：张钳/张爪
        if (a.stackedOn && pose === 'idle' && Math.abs(a.balRot) > 1.5) pose = 'balance';

        const sym =
          inspectState
            ? inspectState.sym || null
            : a.sym && now < a.symUntil
              ? a.sym
              : dozing && pose === 'sleep'
                ? dozeSymFor(a)
                : pose === 'sleep' || pose === 'loaf'
                  ? tickIdx % 8 < 4
                    ? 'z1'
                    : 'z2'
                  : pose === 'angry'
                    ? 'vein'
                    : null;
        const localTick = inspectState
          ? inspectState.tick
          : pose === 'write'
            ? streamTier >= 3
              ? tickIdx
              : Math.floor(tickIdx / 2)
            : tickIdx;
        const fx = updateIdleFx(a, pose, now);
        a.lastFx = fx;
        const hasRider = Boolean(findDirectRider(id));
        const effectivePose = inspectState ? inspectState.pose : hasRider && pose === 'idle' ? 'squash' : pose;
        const sulkJitter = effectivePose === 'sulk' && !reducedMotion && !inspectState ? (tickIdx % 4 < 2 ? 0 : -PX) : 0;
        const liftPx = st && st.lift && !reducedMotion ? st.lift * PX : 0;
        const nodOffset = (now < a.nodUntil ? a.nodY : 0) + sulkJitter + liftPx;
        let sqW = inspectState ? inspectState.sqW : st ? st.sqW : 0;
        let sqH = inspectState ? inspectState.sqH : st ? st.sqH : 0;
        if (!inspectState && !st && hasRider && pose !== 'idle') sqH = -1;
        a.lastSq = { w: sqW, h: sqH };
        const clipBottomY = yieldMode === 'peek' && !a.dragging && !inspectState ? (OY + 8) * PX : undefined;
        const ftk = tickIdx - a.forceTwitchStart;
        const forcedTwitch = ftk >= 0 && ftk < 4 && ftk !== 2 ? a.forceTwitchSide : null;

        const crystalActive = id === 'clawd' && orchestrator && !hasRider && !crabRiding();
        const layers = buildClipLayers(a.kind, effectivePose, localTick, {
          clipTick: inspectState ? inspectState.tick : Math.max(0, tickIdx - a.clipStartTick),
          sym,
          blinkStage: inspectState ? null : fx.blinkStage,
          breath: inspectState ? false : fx.breath,
          earTwitch: inspectState ? null : forcedTwitch || fx.earTwitch,
          clawSnap: inspectState ? null : fx.clawSnap,
          clipParam: a.clipParam,
          reduced: reducedMotion,
          crystal: crystalActive,
          crystalBob: !reducedMotion && Math.floor(tickIdx / 6) % 2 === 1,
          eyeScan: inspectState ? 0 : a.eyeScan || fx.glance,
          noShadow: a.dragging || a.y < -2 || Boolean(a.stackedOn) || yieldMode === 'peek',
          dir: a.faceDir || (a.vx < 0 || a.patrolDir < 0 ? 'left' : 'right'),
        });

        const isChromaCat = id === 'cat' && prismaticCoat;
        const phaseBucket = isChromaCat ? Math.round(chromaPhase * 12) : 0;
        const earSparkPhase = isChromaCat ? Math.floor(tickIdx / 2) % 10 : -1;
        if (
          isChromaCat &&
          !reducedMotion &&
          (a.dragging || a.leap || a.y < -3 || (st && st.lift) || (effectivePose === 'walk' && now < a.overrideUntil))
        ) {
          spawnChromaBurst(getEntWorldCx(a), computeWorldFootY(a) - 6, 1, true);
        }

        const flip = inspectState ? inspectState.mirror : Boolean(a.mirror);
        const rulerOn = Boolean(inspectState && inspectState.ruler);
        let bLv = 0;
        let bDir = 0;
        if (!inspectState && rim.on) {
          const dx = getEntWorldCx(a) - rim.x;
          const fy = a.stackedOn ? computeWorldFootY(a) : (a.y || 0);
          bLv = Math.round(rim.s * Math.max(0, 1 - Math.abs(dx) / 240) * Math.max(0, 1 - Math.abs(fy) / 48) * 12);
          if (bLv > 0) bDir = Math.max(-2, Math.min(2, Math.round(-dx / 55)));
        }
        const isCuteCat = id === 'cat' && catOnly && !isChromaCat;
        const tintState = `${a.kind}:${catOnly ? 1 : 0}:${crystalActive ? 1 : 0}:${rulerOn ? 1 : 0}:${isChromaCat ? `p${phaseBucket}_${earSparkPhase}` : '0'}${bLv ? `:r${bLv}_${bDir}_${rim.t}_${rim.d ? 1 : 0}` : ''}`;
        const snappedTy = Math.round(Number(nodOffset || 0) / PX) * PX;
        const frameIdx = computeLayersFrameIdx(layers);
        const rc = a.lastRender;
        // 像素层仅在精灵帧/朝向/表情/挤压/尺寸等真实像素内容变化时重绘，物理位移与倾角 rot 由 GPU transform 实时驱动
        if (
          rc.poseKey === effectivePose &&
          rc.frameIdx === frameIdx &&
          rc.flip === flip &&
          rc.tintState === tintState &&
          rc.tyPx === snappedTy &&
          rc.sqW === sqW &&
          rc.sqH === sqH &&
          rc.clipBottomY === clipBottomY &&
          rc.cw === a.canvas.width &&
          rc.ch === a.canvas.height
        ) {
          perfStats.canvasSkips += 1;
        } else {
          rc.poseKey = effectivePose;
          rc.frameIdx = frameIdx;
          rc.flip = flip;
          rc.tintState = tintState;
          rc.tyPx = snappedTy;
          rc.sqW = sqW;
          rc.sqH = sqH;
          rc.clipBottomY = clipBottomY;
          rc.cw = a.canvas.width;
          rc.ch = a.canvas.height;
          const colorResolver = isChromaCat
            ? (ch, gx, gy, pal) =>
                ch === '#'
                  ? evalChromaColorAt(gx, gy, chromaPhase, false)
                  : ch === 's'
                    ? evalChromaColorAt(gx, gy, chromaPhase, true)
                    : pal[ch]
            : isCuteCat
              ? (ch, gx, gy, pal) => {
                  if (ch === '#') {
                    if (gy === 9) return '#FFF9F3';
                    if (gy === 0 && (gx === 3 || gx === 12)) return '#F9A8C9';
                    if (gy === 1 && (gx === 7 || gx === 8)) return '#D9935B';
                    if ((gy === 7 && gx >= 5 && gx <= 10) || (gy === 6 && gx >= 6 && gx <= 9)) return '#FFF5EA';
                    if (gx >= 14 && gy === 3) return '#FFF9F3';
                    return '#F6B882';
                  }
                  if (ch === 's') return '#D9935B';
                  if (ch === 'o') return '#261E22';
                  return pal[ch];
                }
              : null;
          const cuteFaceOn = isCuteCat && effectivePose !== 'flat' && effectivePose !== 'peek';
          const cuteEyesOpen =
            cuteFaceOn &&
            !fx.blinkStage &&
            effectivePose !== 'sleep' &&
            effectivePose !== 'loaf' &&
            effectivePose !== 'happy' &&
            effectivePose !== 'sulk' &&
            effectivePose !== 'pet';
          const cuteDy = effectivePose === 'loaf' ? 3 : effectivePose === 'squash' ? 1 : 0;
          const cuteEyeDx = inspectState ? 0 : a.eyeScan || fx.glance || 0;
          const overlayPainter =
            rulerOn || cuteFaceOn || (isChromaCat && (earSparkPhase < 3 || (earSparkPhase >= 5 && earSparkPhase < 8)))
              ? (c2, oxG, oyG, pxS) => {
                  if (cuteFaceOn) {
                    c2.fillStyle = 'rgba(255,142,174,0.85)';
                    c2.fillRect((oxG + 3) * pxS, (oyG + 5 + cuteDy) * pxS, pxS, pxS);
                    c2.fillRect((oxG + 12) * pxS, (oyG + 5 + cuteDy) * pxS, pxS, pxS);
                    c2.fillStyle = '#E8799B';
                    c2.fillRect((oxG + 7.5) * pxS, (oyG + 5 + cuteDy) * pxS, pxS, Math.max(1, pxS * 0.65));
                    if (cuteEyesOpen) {
                      const sp = Math.max(1, pxS * 0.45);
                      c2.fillStyle = '#FFFFFF';
                      c2.fillRect((oxG + 4 + cuteEyeDx) * pxS, (oyG + 3 + cuteDy) * pxS, sp, sp);
                      c2.fillRect((oxG + 11 + cuteEyeDx) * pxS, (oyG + 3 + cuteDy) * pxS, sp, sp);
                    }
                  }
                  if (isChromaCat && (earSparkPhase < 3 || (earSparkPhase >= 5 && earSparkPhase < 8))) {
                    const leftEar = earSparkPhase < 3;
                    const sx = (oxG + (leftEar ? 2 : 13)) * pxS;
                    const sy = (oyG - 3) * pxS;
                    c2.fillStyle = '#FFFFFF';
                    c2.fillRect(sx, sy, pxS, pxS);
                    if (earSparkPhase === 1 || earSparkPhase === 6) {
                      c2.fillRect(sx - pxS, sy, pxS, pxS);
                      c2.fillRect(sx + pxS, sy, pxS, pxS);
                      c2.fillRect(sx, sy - pxS, pxS, pxS);
                      c2.fillRect(sx, sy + pxS, pxS, pxS);
                    }
                  }
                  if (rulerOn) {
                    const y9 = (oyG + 10) * pxS - 1;
                    c2.fillStyle = 'rgba(234,67,53,0.92)';
                    c2.fillRect(0, y9, (oxG + 20) * pxS, 1);
                  }
                }
              : null;
          const rimPainter =
            bLv > 0
              ? (c2, cw, oxG, oyG, pxS) => {
                  if (typeof c2.createRadialGradient !== 'function') return;
                  const p = RIM_PALS[rim.t] || RIM_PALS.default;
                  const o = rim.d ? 0 : 2;
                  const lv = (bLv / 12) * (rim.d ? 1 : 0.65);
                  const by = (oyG + (yieldMode === 'peek' && !a.dragging ? 8 : 10)) * pxS;
                  const gx = (oxG + 8) * pxS + bDir * 9;
                  const paint = (yy, r, h, s0, s1) => {
                    const g = c2.createRadialGradient(gx, yy, 0, gx, yy, r);
                    g.addColorStop(0, s0);
                    if (s1) g.addColorStop(0.5, s1);
                    g.addColorStop(1, `rgba(${p[o + (s1 ? 1 : 0)]},0)`);
                    c2.fillStyle = g;
                    c2.fillRect(0, Math.max(0, by - h), cw, h);
                  };
                  c2.save();
                  c2.globalCompositeOperation = 'source-atop';
                  paint(by + 2, 34, 30, `rgba(${p[o]},${(0.36 * lv).toFixed(3)})`, `rgba(${p[o + 1]},${(0.16 * lv).toFixed(3)})`);
                  paint(by, 26, pxS, `rgba(${p[o]},${(0.3 * lv).toFixed(3)})`, '');
                  c2.restore();
                }
              : null;
          renderPixelLayers(a.canvas, dpr, OX, OY, PX, PALETTES[a.kind], layers, {
            ctx: a._ctx,
            mirror: flip,
            tyPx: snappedTy,
            sqW,
            sqH,
            rotDeg: 0,
            clipBottomY,
            colorResolver,
            overlayPainter,
            rimPainter,
          });
          perfStats.canvasDraws += 1;
        }
      }

      if (catOnly) {
        syncSanctuaryMode();
        return;
      }
      if (sanctuary) syncSanctuaryMode();
      const nextMiniDisplay = miniPileEnabled ? 'flex' : 'none';
      if (lastMiniDisplay !== nextMiniDisplay) {
        lastMiniDisplay = nextMiniDisplay;
        miniGroupEl.style.display = nextMiniDisplay;
      }
      if (miniPileEnabled) {
        const safeRight = Math.max(48, (stageBoundsX().maxX || 680) - 48);
        if (!reducedMotion && !dozing && lastCrabStepTick !== tickIdx) {
          lastCrabStepTick = tickIdx;
          const freeCorridorCrabs = miniCrabs.filter((mc) => !mc.dragging && !mc.ballisticActive && !mc.stackedOn && !mc.leap && mc.y === 0);
          const crabEvs = stepMiniCrabCorridor(freeCorridorCrabs, {
            minX: 2,
            maxX: safeRight,
            contactDist: 26,
            nowTick: tickIdx,
          });
          if (crabEvs.length) {
            recordInteraction(crabEvs[0].type, crabEvs[0].pair, now);
          }
        }
        syncAllStackedFollowers();
        miniCrabs.forEach((mc, idx) => {
          const anim = MINI_ANIM_FRAMES[mc.id];
          const moving = !reducedMotion && !dozing;

          // 自动搭便车超时后轻巧侧跳落地
          if (mc.stackedOn && mc.perchUntil > 0 && now >= mc.perchUntil && !mc.dragging) {
            mc.perchUntil = 0;
            const prevY = computeWorldFootY(mc);
            const jumpDir = idx % 2 === 0 ? -1 : 1;
            mc.stackedOn = null;
            mc.y = prevY;
            startMiniBallistic(mc, jumpDir * 2.8, -3.6, { noSnap: true });
          }

          // 抛物线撑跳越过推进
          if (mc.leap && !mc.dragging) {
            const lp = mc.leap;
            const k = Math.min(1, (tickIdx - lp.startTick + 1) / Math.max(1, lp.ticks));
            const cx = lp.cx0 + (lp.cx1 - lp.cx0) * k;
            setEntWorldCx(mc, cx);
            mc.y = -Math.round(lp.peak * Math.sin(Math.PI * k));
            if (k >= 1) {
              mc.leap = null;
              mc.y = 0;
              if (lp.landOnto) {
                const holder = getEnt(lp.landOnto);
                if (holder && !holder.dragging && getTowerMembers(holder.id).length < maxTowerDepthAllowed()) {
                  mc.stackedOn = holder.id;
                  mc.perchUntil = now + 7200;
                  syncAllStackedFollowers();
                } else {
                  enforceGroundSeparation();
                }
              } else {
                enforceGroundSeparation();
              }
            }
          }

          const cycle = (tickIdx + idx * 7) % 24;
          const isTrick = moving && !mc.stackedOn && cycle >= 18;
          const inBump = moving && tickIdx < mc.bumpUntilTick;
          const inPassHop = moving && tickIdx < mc.passHopUntilTick;
          let sprite = mc.dragging
            ? tickIdx % 2 === 0
              ? anim.walkB
              : MINI_SPRITES[mc.id]
            : mc.leap
              ? anim.trick
              : mc.stackedOn
                ? cycle >= 20
                  ? anim.trick
                  : MINI_SPRITES[mc.id]
                : inBump
                  ? anim.trick
                  : isTrick && !inPassHop
                    ? anim.trick
                    : moving && tickIdx % 4 >= 2
                      ? anim.walkB
                      : MINI_SPRITES[mc.id];
          if (tickIdx >= mc.nextBlink) {
            mc.blinkAt = tickIdx;
            mc.nextBlink = tickIdx + ticksIn(2600, 6500);
          }
          if (!mc.dragging && tickIdx - mc.blinkAt >= 0 && tickIdx - mc.blinkAt < 2 && !isTrick && !inBump) {
            sprite = miniBlinkFrame(sprite);
          }
          const tc = cycle - 18;
          let hopPx = 0;
          if (!mc.dragging && !mc.stackedOn && !mc.leap) {
            if (inPassHop) {
              const rem = mc.passHopUntilTick - tickIdx;
              hopPx = rem === 2 || rem === 3 ? -4 : -2;
            } else if (inBump) {
              hopPx = -2;
            } else if (moving) {
              const hopCells = isTrick
                ? tc === 1 || tc === 2
                  ? -1
                  : 0
                : (tickIdx + idx * 3) % 14 === 0
                  ? -1
                  : 0;
              hopPx = hopCells * 2;
            }
          }

          const actPos = !mc.dragging && !mc.stackedOn && !mc.leap ? miniActPose(mc, sprite, anim) : null;
          const targetSprite = actPos ? actPos.sprite : sprite;
          const targetMirror = actPos ? Boolean(actPos.mirror) : Boolean(moving && mc.dir < 0);
          const targetTy = actPos ? actPos.hopPx : hopPx;
          const mcDirect = syncDirectMotionDomAttr(mc, mc.canvas);
          let targetX;
          let targetY;
          if (mc.stackedOn && !mc.dragging) {
            const root = getTowerRoot(mc.id);
            const wCx = getEntWorldCx(root || mc);
            targetX = snapCoord(wCx - 32, mcDirect);
            targetY = snapCoord(computeWorldFootY(mc), mcDirect);
            mc.px = targetX;
            mc.lastX = Math.round(targetX);
          } else if (actPos) {
            targetX = actPos.x;
            targetY = actPos.y;
            if (actPos.y === 0) {
              mc.lastX = Math.min(safeRight, Math.max(2, actPos.x));
              mc.px = mc.lastX;
            }
          } else {
            const rawX = mc.dragging
              ? mc.px
              : moving
                ? Math.min(safeRight, Math.max(2, mc.px))
                : Math.min(safeRight, Math.max(2, mc.px ?? mc.x));
            targetX = snapCoord(rawX, mcDirect);
            targetY = snapCoord(mc.y || 0, mcDirect);
            mc.lastX = Math.round(targetX);
          }

          const depth = mc.stackedOn ? getStackDepth(mc.id) : 0;
          const mz = mc.dragging ? '39' : depth > 0 ? String(25 + depth * 2) : '25';
          const mKey = `${computeLayersFrameIdx([targetSprite])}|${targetMirror ? 1 : 0}|${targetTy}|${mc.canvas.width}`;
          if (mc.lastFrameKey !== mKey) {
            mc.lastFrameKey = mKey;
            renderPixelLayers(mc.canvas, dpr, 2, 5, 2, PALETTES[mc.id], [targetSprite], {
              ctx: mc._ctx,
              mirror: targetMirror,
              tyPx: targetTy,
            });
          }
          applyMiniTransform(mc, targetX, targetY, mz, mc.dragging || mc.ballisticActive ? mc.rot : 0);
        });
      } else {
        miniCrabs.forEach((mc) => {
          mc.act = null;
          mc.stackedOn = null;
          mc.dragging = false;
          mc.ballisticActive = false;
          mc.rot = 0;
          mc.y = 0;
        });
        syncMascotDragRootAttr();
      }

      enforceGroundSeparation(
        actors.cat.dragging
          ? 'cat'
          : actors.clawd.dragging
            ? 'clawd'
            : (miniCrabs.find((m) => m.dragging) || {}).id || null
      );
      // 二次刷新被防重叠微调后的 DOM transform（若未变则自动命中缓存 0 写入）
      applyActorTransform(actors.cat, now);
      applyActorTransform(actors.clawd, now);
      if (miniPileEnabled) {
        for (const mc of miniCrabs) {
          if (!mc.dragging && !mc.ballisticActive && !mc.stackedOn && !mc.act && !mc.leap && mc.y === 0) {
            syncDirectMotionDomAttr(mc, mc.canvas);
            const tx = Math.round(mc.px);
            applyMiniTransform(mc, tx, 0, null, 0);
          }
        }
      }
      stepAndPaintChromaFx();
    };

    const startClip = (actor, pose, durationMs, opts = {}) => {
      const now = performance.now();
      actor.overridePose = pose;
      actor.overrideUntil = now + durationMs;
      actor.overrideRot = opts.rot || 0;
      actor.mirror = Boolean(opts.mirror);
      actor.faceDir = opts.face || null;
      actor.clipParam = opts.param ?? null;
      actor.clipStartTick = tickIdx;
      if (opts.sym) {
        actor.sym = opts.sym;
        actor.symUntil = now + (opts.symDurationMs || durationMs);
      }
      if (opts.patrolDir) actor.patrolDir = opts.patrolDir;
    };

    // 统一清理角色瞬态姿态/物理状态，根治交叉打断导致的残余旋转/镜像/序列卡死
    const resetActorTransient = (ent, opts = {}) => {
      if (!ent) return;
      if (!opts.keepFly) ent.flying += 1;
      if (!opts.keepBallistic) ent.ballisticActive = false;
      ent.leap = null;
      if (!opts.keepVel) {
        ent.vx = 0;
        ent.vy = 0;
      }
      ent.rot = 0;
      if (isMiniEnt(ent)) {
        if (!opts.keepAct) ent.act = null;
        return;
      }
      if (!opts.keepPose) {
        ent.overridePose = null;
        ent.overrideUntil = 0;
      }
      ent.overrideRot = 0;
      ent.balRot = 0;
      if (!opts.keepMirror) ent.mirror = false;
      ent.faceDir = null;
      ent.clipParam = null;
      if (!opts.keepSeq) {
        ent.seq = null;
        ent.seqThen = null;
      }
    };

    // 减少动态开启：中止抛掷/巡逻/序列与星屑，回到静态待机
    function freezeMotion() {
      chromaSparks.length = 0;
      releaseFxCanvas();
      for (const id of ['cat', 'clawd']) {
        const a = actors[id];
        const keepPose = a.overridePose && a.overridePose !== 'walk' && a.overridePose !== 'dangle';
        resetActorTransient(a, { keepPose });
        a.passBoostUntil = 0;
        if (!a.stackedOn) a.y = 0;
      }
      miniCrabs.forEach((mc) => {
        resetActorTransient(mc, { keepAct: Boolean(mc.act && mc.act.type === 'wave') });
        mc.bumpUntilTick = -1;
        mc.passHopUntilTick = -1;
        mc.cooldownTick = -1;
        if (!mc.stackedOn) {
          mc.y = 0;
          mc.px = mc.x;
          mc.lastX = mc.x;
        }
      });
      if (actors.clawd.overridePose === 'carry') actors.clawd.overrideUntil = 0;
      resetHomePositions(false);
    }

    const toggleChromaResonance = (now) => {
      prismaticCoat = !prismaticCoat;
      writeChromaSaved(prismaticCoat);
      resetActorTransient(actors.cat);
      const catCx = getEntWorldCx(actors.cat);
      const catFootY = computeWorldFootY(actors.cat);
      if (prismaticCoat) {
        spawnChromaBurst(catCx, catFootY - 18, 12, false);
        playSeq(actors.cat, hopSteps('spinHop'));
        actors.cat.sym = 'spark';
        actors.cat.symUntil = now + 1500;
        recordInteraction('chromaAwaken', 'cat', now);
      } else {
        spawnChromaBurst(catCx, catFootY - 16, 6, true);
        startClip(actors.cat, 'groom', 800, { sym: 'note' });
        recordInteraction('chromaRest', 'cat', now);
      }
    };

    // ── 五段递进戳戳气鼓鼓 + 叠塔连击四下切换隐藏棱彩形态 ────────────────────
    const triggerPoke = (actor, fromPointer) => {
      const now = performance.now();
      markActivity();

      if (actor.id === 'cat') {
        const towerLen = getTowerMembers('cat').length;
        if (towerLen >= 2 && (prismaticCoat || (chromaGates.tuned && chromaGates.forged))) {
          while (chromaTapTimes.length && now - chromaTapTimes[0] > 2600) chromaTapTimes.shift();
          chromaTapTimes.push(now);
          if (chromaTapTimes.length >= 4) {
            chromaTapTimes.length = 0;
            actor.pokeCount = 0;
            toggleChromaResonance(now);
            renderAllFrames(now);
            return;
          }
          startClip(actor, 'happy', 550, { sym: 'spark' });
          renderAllFrames(now);
          return;
        }
      }

      if (now - actor.lastPokeAt > 4500) actor.pokeCount = 0;
      actor.pokeCount += 1;
      actor.lastPokeAt = now;
      const inTower = getTowerMembers(actor.id).length >= 2;

      if (actor.pokeCount === 1) {
        startClip(actor, actor.id === 'cat' && Math.random() < 0.45 ? 'groom' : 'happy', 750, { sym: 'spark' });
        if (fromPointer && !inTower) startBallistic(actor, 0, -4.4, { anticipate: true });
      } else if (actor.pokeCount === 2) {
        // 作废第 1 击可能挂起的 200ms 延迟弹射，防止 jiggle 被滞后弹飞打断
        actor.flying += 1;
        actor.seq = null;
        startClip(actor, 'jiggle', 950, { sym: 'note' });
      } else if (actor.pokeCount === 3) {
        actor.flying += 1;
        startClip(actor, 'tilt', 1100, { rot: -9, sym: 'q' });
      } else if (actor.pokeCount === 4) {
        startClip(actor, 'wow', 950, { sym: 'bang' });
        if (fromPointer && !inTower) startBallistic(actor, 0, -3.2, { anticipate: true });
      } else {
        actor.flying += 1;
        actor.pokeCount = 0;
        startClip(actor, 'sulk', 3200, { mirror: true, sym: 'vein' });
      }
      renderAllFrames(now);
    };

    // ── 紧凑时间轴剧本表驱动：日常剧场 + 彩蛋 + 合演（Batch 2 Slash 剧场复用此执行器）──
    const DAILY_CLAWD = ['polish', 'eat', 'letter', 'plant', 'butterfly', 'walk', 'stretch', 'spinHop', 'wave', 'yawn'];
    const DAILY_CAT = ['groom', 'eatFish', 'chaseDot', 'catStretch', 'butterfly', 'letter', 'walk', 'plant', 'yawnStretch'];
    const DAILY_WEIGHTS = { wave: 1.3, yawn: 0.6, yawnStretch: 1.1 };
    const NIGHT_BOOST = new Set(['yawn', 'yawnStretch', 'stretch', 'catStretch']);
    const CLIP_MS = { wave: 1500, yawn: 1300, yawnStretch: 2200 };
    const isLateNight = () => {
      const h = new Date().getHours();
      return h >= 23 || h < 5;
    };
    const pickDaily = (pool) => {
      const night = isLateNight();
      const ws = pool.map((k) => (DAILY_WEIGHTS[k] ?? 1) * (night && NIGHT_BOOST.has(k) ? 3 : 1));
      let r = Math.random() * ws.reduce((s, w) => s + w, 0);
      for (let i = 0; i < pool.length; i++) {
        r -= ws[i];
        if (r < 0) return pool[i];
      }
      return pool[pool.length - 1];
    };
    const EGGS = ['onFire', 'cheerSticks', 'rickroll', 'siren'];
    const DUETS = [['chatGreet', 0.4], ['lookNod', 0.25], ['catRub', 0.2], ['readAlong', 0.15]];
    const pickDuet = () => {
      let r = Math.random();
      for (const [k, w] of DUETS) if ((r -= w) < 0) return k;
      return 'chatGreet';
    };

    const stageBusy = () =>
      streaming ||
      hasError ||
      yieldMode !== 'none' ||
      actors.clawd.dragging ||
      actors.cat.dragging ||
      miniCrabs.some((m) => m.dragging) ||
      actors.clawd.stackedOn ||
      actors.cat.stackedOn ||
      miniCrabs.some((m) => m.stackedOn);

    let duetSerial = 0;
    const THEATER_SCRIPTS = {
      lookNod: (ctx) => {
        const cf = ctx.cat.x >= ctx.clawd.x ? 'right' : 'left';
        const kf = cf === 'right' ? 'left' : 'right';
        return {
          dur: 2500,
          steps: [
            [0, 'clawd', 'lookNod', 2000, { face: cf, param: 5 }],
            [0, 'cat', 'lookNod', 2000, { face: kf, param: 9 }],
          ],
        };
      },
      readAlong: () => ({
        dur: 2500,
        steps: [
          [0, 'clawd', 'readAlong', 1600, { sym: 'note' }],
          [0, 'cat', 'readAlong', 1600],
        ],
      }),
      chatGreet: () => ({
        dur: 2500,
        steps: [
          [0, 'clawd', 'chatGreet', 2400, { sym: 'heart' }],
          [0, 'cat', 'chatGreet', 2400, { mirror: true, sym: 'note' }],
          [0, 'crabsWave'],
        ],
      }),
      catRub: (ctx) => {
        const dir = ctx.clawd.x < ctx.cat.x ? -1 : 1;
        const wt = Math.min(16, Math.round(Math.max(0, Math.abs(ctx.clawd.x - ctx.cat.x) - 46) / 1.4));
        const wm = wt * TICK;
        const steps = [];
        if (wt >= 2) steps.push([0, 'cat', 'walk', wm, { patrolDir: dir }]);
        steps.push([wm, 'cat', 'groom', 1600, { mirror: dir < 0 }]);
        steps.push([wm + 400, 'clawd', 'pet', 1300, { sym: 'heart' }]);
        if (wt >= 2) steps.push([wm + 1700, 'cat', 'walk', wm, { patrolDir: -dir }]);
        steps.push([wm * 2 + 1800, 'resetHome']);
        return { dur: wm * 2 + 2000, steps };
      },
    };

    const runDuet = (name) => {
      const now = performance.now();
      const specFn = THEATER_SCRIPTS[name] || THEATER_SCRIPTS.chatGreet;
      const spec = specFn({ clawd: actors.clawd, cat: actors.cat, now });
      const serial = (duetSerial += 1);
      duetUntil = now + (spec.dur || 2500);
      const alive = () => serial === duetSerial && !disposed && !stageBusy() && !reducedMotion && !isHostSleeping() && !isWindowBlurred();
      const exec = (step) => {
        const [, who, pose, dur, opts] = step;
        if (who === 'crabsWave') crabsWave();
        else if (who === 'resetHome') resetHomePositions(false);
        else if (typeof who === 'function') who();
        else if (actors[who]) startClip(actors[who], pose, dur, opts || {});
      };
      for (const st of spec.steps) {
        if (!st[0]) exec(st);
        else later(st[0], () => { if (alive()) { exec(st); renderAllFrames(performance.now()); } });
      }
      renderAllFrames(now);
    };

    const pickNextTheater = () => {
      if (disposed || isHostDetached() || parked) {
        theaterTimer = 0;
        return;
      }
      if (!stageBusy() && !reducedMotion && !dozing && !isHostSleeping() && !isWindowBlurred()) {
        const now = performance.now();
        const cIdle = !actors.clawd.overridePose || now >= actors.clawd.overrideUntil;
        const kIdle = !actors.cat.overridePose || now >= actors.cat.overrideUntil;
        const crabBusy = miniCrabs.some((mc) => mc.act);

        if (miniPileEnabled && cIdle && kIdle && !crabBusy && Math.random() < 0.18) {
          const r = Math.random();
          if (r < 0.4 ? runCrabChase(false) : r < 0.8 ? runCrabRide(false) : (crabsWave(), true)) renderAllFrames(now);
        } else if (cIdle && kIdle && Math.random() < 0.3) {
          runDuet(pickDuet());
        } else {
          const target = theaterCursor % 2 === 0 ? actors.cat : actors.clawd;
          theaterCursor += 1;
          if (!target.overridePose || now >= target.overrideUntil) {
            if (Math.random() < 0.06) {
              startClip(target, EGGS[Math.floor(Math.random() * EGGS.length)], 3800);
            } else {
              const clip = pickDaily(target.id === 'cat' ? DAILY_CAT : DAILY_CLAWD);
              startClip(target, clip, CLIP_MS[clip] || 3600, { patrolDir: Math.random() < 0.5 ? -1 : 1 });
              if (clip === 'walk') {
                const walker = target;
                const backOk = () => !stageBusy() && !reducedMotion && !walker.seq && walker.y === 0 && !isHostSleeping();
                later(3700, () => { if (backOk()) startClip(walker, 'walk', 3600, { patrolDir: -walker.patrolDir }); });
                later(7400, () => { if (backOk()) resetHomePositions(true); });
              }
            }
            renderAllFrames(now);
          }
        }
      }
      if (!disposed && !dozing && !parked && !isHostDetached() && !isDocHidden() && !isHostSleeping() && !isWindowBlurred()) {
        theaterTimer = setTimeout(pickNextTheater, 4600 + Math.round(Math.random() * 2600));
      } else {
        theaterTimer = 0;
      }
    };
    const scheduleTheater = (delayMs) => {
      clearTimeout(theaterTimer);
      theaterTimer = 0;
      if (disposed || dozing || parked || isHostDetached() || isDocHidden() || isHostSleeping() || isWindowBlurred()) return;
      theaterTimer = setTimeout(pickNextTheater, delayMs ?? 4600 + Math.round(Math.random() * 2600));
    };
    scheduleTheater(3800);

    // ── 多层图腾塔吸附、抽底重力顺滑补位、剧烈动作侧跳下塔与统一弹道引擎 ──────
    const trySnapOntoTower = (mover, now = performance.now()) => {
      if (!mover || mover.dragging) return false;
      const moverChain = getTowerMembers(mover.id);
      const maxDepth = maxTowerDepthAllowed();
      const moverCx = getEntWorldCx(mover);
      const moverFootY = mover.y || 0;
      const seenRoots = new Set(moverChain);

      for (const cand of allActiveEnts()) {
        const root = getTowerRoot(cand.id);
        if (!root || seenRoots.has(root.id)) continue;
        seenRoots.add(root.id);
        if (root.dragging || root.ballisticActive || root.leap || (root.y || 0) < -4) continue;
        if (!isMiniEnt(root) && now < root.overrideUntil && ['onFire', 'siren', 'spinHop'].includes(root.overridePose)) continue;
        const baseChain = getTowerMembers(root.id);
        if (baseChain.length + moverChain.length > maxDepth) continue;
        const top = getEnt(baseChain[baseChain.length - 1]);
        if (!top || top.dragging || top.ballisticActive || top.leap || ((top.y || 0) < -2 && !top.stackedOn)) continue;

        const perchY = computeWorldFootY(top) - mountStepH(top.id);
        if (Math.abs(moverCx - getEntWorldCx(top)) <= 28 && moverFootY >= perchY - 24 && moverFootY <= perchY + 20) {
          resetActorTransient(mover, { keepFly: true });
          mover.stackedOn = top.id;
          mover.y = 0;
          mover.perchUntil = 0;
          if (!isMiniEnt(mover)) {
            mover.overridePose = 'happy';
            mover.overrideUntil = now + 950;
            mover.sym = 'heart';
            mover.symUntil = now + 1100;
            playSeq(mover, [['happy', 1, 2, -1]]);
          }
          syncAllStackedFollowers();
          renderAllFrames(now);
          return true;
        }
      }
      return false;
    };

    const startGravitySettle = (subRoot, targetHolderId) => {
      if (!subRoot) return;
      const subLen = getTowerMembers(subRoot.id).length;
      if (reducedMotion) {
        subRoot.flying += 1;
        subRoot.ballisticActive = false;
        const holder = targetHolderId ? getEnt(targetHolderId) : null;
        if (holder && !holder.dragging && getTowerMembers(holder.id).length + subLen <= maxTowerDepthAllowed()) {
          subRoot.stackedOn = holder.id;
          subRoot.y = 0;
          syncAllStackedFollowers();
        } else {
          subRoot.stackedOn = null;
          subRoot.y = 0;
          enforceGroundSeparation();
        }
        subRoot.vx = 0;
        subRoot.vy = 0;
        subRoot.rot = 0;
        renderAllFrames(performance.now());
        return;
      }

      const settleId = (subRoot.flying += 1);
      subRoot.ballisticActive = true;
      syncDirectMotionDomAttr(subRoot, isMiniEnt(subRoot) ? subRoot.canvas : subRoot.el);
      let vy = 0.65;
      let prev = performance.now();
      const step = (now) => {
        if (disposed || settleId !== subRoot.flying || subRoot.dragging) {
          if (disposed || subRoot.dragging) subRoot.ballisticActive = false;
          return;
        }
        const k = Math.max(0.5, Math.min(2.5, (now - prev) / 16.6667));
        prev = now;
        let holder = targetHolderId ? getEnt(targetHolderId) : null;
        if (holder && (holder.dragging || getTowerMembers(holder.id).includes(subRoot.id) || getTowerMembers(holder.id).length + subLen > maxTowerDepthAllowed())) {
          holder = null;
        }
        const goalY = holder ? computeWorldFootY(holder) - mountStepH(holder.id) : 0;
        if (isDocHidden() || isHostSleeping() || parked) {
          subRoot.ballisticActive = false;
          subRoot.vx = 0;
          subRoot.vy = 0;
          subRoot.rot = 0;
          if (holder) {
            subRoot.stackedOn = holder.id;
            subRoot.y = 0;
            syncAllStackedFollowers();
          } else {
            subRoot.stackedOn = null;
            subRoot.y = 0;
            enforceGroundSeparation();
          }
          syncTower(subRoot, now);
          reclaimStageVram();
          return;
        }
        if (holder) {
          const curCx = getEntWorldCx(subRoot);
          setEntWorldCx(subRoot, curCx + (getEntWorldCx(holder) - curCx) * Math.min(1, 0.35 * k));
        }
        vy = Math.min(14, vy + 0.54 * k);
        subRoot.y += vy * k;
        subRoot.vy = vy;
        if (subRoot.y >= goalY) {
          subRoot.ballisticActive = false;
          subRoot.vx = 0;
          subRoot.vy = 0;
          subRoot.rot = 0;
          if (holder) {
            subRoot.stackedOn = holder.id;
            subRoot.y = 0;
            if (!isMiniEnt(subRoot)) playSeq(subRoot, [['idle', 1, 2, -1]]);
            syncAllStackedFollowers();
          } else {
            subRoot.stackedOn = null;
            subRoot.y = 0;
            if (!isMiniEnt(subRoot)) playSeq(subRoot, landingSteps(1));
            enforceGroundSeparation();
          }
          syncTower(subRoot, now);
          renderAllFrames(now);
          return;
        }
        syncAllStackedFollowers();
        syncTower(subRoot, now);
        rAF(step);
      };
      rAF(step);
    };

    const detachWithGravitySettle = (pulledId) => {
      const pulled = getEnt(pulledId);
      if (!pulled) return;
      const lowerHolderId = pulled.stackedOn || null;
      const upperRider = findDirectRider(pulledId);
      if (upperRider) {
        const riderStartFootY = computeWorldFootY(upperRider);
        const riderStartCx = getEntWorldCx(upperRider);
        upperRider.stackedOn = null;
        upperRider.perchUntil = 0;
        resetActorTransient(upperRider, { keepFly: true });
        setEntWorldCx(upperRider, riderStartCx);
        upperRider.y = riderStartFootY;
      }
      pulled.stackedOn = null;
      pulled.perchUntil = 0;
      if (upperRider) startGravitySettle(upperRider, lowerHolderId);
    };

    const dismountRidersSideHop = (baseId) => {
      const chain = getTowerMembers(baseId);
      const idx = chain.indexOf(baseId);
      if (idx < 0 || idx >= chain.length - 1) return false;
      const snapshots = chain
        .slice(idx + 1)
        .map((id) => getEnt(id))
        .filter(Boolean)
        .map((r) => ({ r, footY: computeWorldFootY(r), cx: getEntWorldCx(r) }));
      for (const s of snapshots) {
        s.r.stackedOn = null;
        s.r.perchUntil = 0;
        resetActorTransient(s.r, { keepFly: true });
        s.r.y = s.footY;
        setEntWorldCx(s.r, s.cx);
      }
      snapshots.forEach((s, i) => {
        const dir = i % 2 === 0 ? -1 : 1;
        if (reducedMotion) {
          setEntWorldCx(s.r, s.cx + dir * (28 + i * 18));
          s.r.y = 0;
        } else {
          const isM = isMiniEnt(s.r);
          startEntityBallistic(s.r, dir * ((isM ? 2.6 : 2.8) + i * 0.6), (isM ? -3.5 : -3.8) - i * 0.4, { noSnap: true });
        }
      });
      if (reducedMotion) {
        enforceGroundSeparation();
        renderAllFrames(performance.now());
      }
      return true;
    };

    const triggerObstacleEncounter = (moverId, obstacleId, forcedAction = null) => {
      const mover = getEnt(moverId);
      const obs = getEnt(obstacleId);
      if (!mover || !obs || mover.id === obs.id) return null;
      const now = performance.now();
      const obsRoot = getTowerRoot(obs.id) || obs;
      if (obsRoot.id === mover.id) return null;

      const moverCx = getEntWorldCx(mover);
      const obsCx = getEntWorldCx(obsRoot);
      const dir = moverCx <= obsCx ? 1 : -1;
      const landCx = obsCx + dir * (entHalfW(obsRoot) + entHalfW(mover) + 12);
      const { minX, maxX } = stageBoundsX();
      const mHw = entHalfW(mover);
      const canLeap = landCx >= minX + mHw + 2 && landCx <= maxX - mHw - 2;
      const obsTowerLen = getTowerMembers(obsRoot.id).length;
      const canPerch = getTowerMembers(mover.id).length === 1 && obsTowerLen < maxTowerDepthAllowed();

      let action = forcedAction || chooseObstacleAction({ canLeap, canPerch });
      if (action === 'autoPerch' && !canPerch) action = canLeap ? 'leapfrog' : 'greetTurn';
      if (action === 'leapfrog' && !canLeap) action = canPerch ? 'autoPerch' : 'greetTurn';

      if (action === 'leapfrog') {
        const peak = Math.min(62, 26 + Math.max(0, obsTowerLen - 1) * 14);
        resetActorTransient(mover, { keepFly: true });
        if (reducedMotion) {
          setEntWorldCx(mover, landCx);
          mover.y = 0;
          enforceGroundSeparation();
        } else {
          mover.leap = { cx0: moverCx, cx1: landCx, peak, startTick: tickIdx, ticks: 6, landOnto: null };
          if (!isMiniEnt(mover)) {
            mover.faceDir = dir > 0 ? 'right' : 'left';
            mover.sym = 'spark';
            mover.symUntil = now + 750;
          }
        }
      } else if (action === 'autoPerch') {
        const top = getStackTop(obsRoot.id);
        resetActorTransient(mover, { keepFly: true });
        if (reducedMotion) {
          mover.stackedOn = top.id;
          mover.y = 0;
          mover.perchUntil = now + 7200;
          syncAllStackedFollowers();
        } else {
          const peak = Math.max(26, Math.abs(computeWorldFootY(top) - mountStepH(top.id)) + 10);
          mover.leap = { cx0: moverCx, cx1: getEntWorldCx(top), peak, startTick: tickIdx, ticks: 5, landOnto: top.id };
          if (!isMiniEnt(obsRoot) && !obsRoot.dragging && !obsRoot.stackedOn) {
            startClip(obsRoot, 'walk', 2800, { patrolDir: dir });
          }
        }
      } else {
        action = 'greetTurn';
        if (isMiniEnt(mover)) {
          mover.act = null;
          mover.bumpUntilTick = tickIdx + 6;
          mover.blinkAt = tickIdx;
          mover.dir = -dir;
          setEntWorldCx(mover, moverCx - dir * 4);
        } else {
          mover.nextBlinkTick = tickIdx;
          mover.patrolDir = -dir;
          startClip(mover, mover.id === 'clawd' ? 'wave' : 'tilt', 560, {
            face: dir > 0 ? 'right' : 'left',
            sym: 'note',
            rot: mover.id === 'cat' ? -8 : 0,
          });
          later(520, () => {
            if (!disposed && !stageBusy() && !reducedMotion && !dozing && !mover.dragging && !mover.stackedOn) {
              startClip(mover, 'walk', 2000, { patrolDir: -dir });
            }
          });
        }
        if (isMiniEnt(obsRoot)) {
          obsRoot.bumpUntilTick = tickIdx + 5;
          obsRoot.blinkAt = tickIdx;
        } else {
          obsRoot.nextBlinkTick = tickIdx;
          obsRoot.nodY = PX;
          obsRoot.nodUntil = now + 180;
        }
      }

      recordInteraction(action, `${mover.id}->${obsRoot.id}`, now);
      renderAllFrames(now);
      return action;
    };

    // 统一主宠 + 迷你蟹弹道物理循环
    const launchEntity = (ent, vx0, vy0, bopts = {}) => {
      const mini = isMiniEnt(ent);
      const flightId = (ent.flying += 1);
      const hasReboundTarget = !mini && typeof bopts.reboundTargetX === 'number' && Number.isFinite(bopts.reboundTargetX);
      const vLim = mini ? 14 : 18;
      const maxVx = hasReboundTarget ? 64 : vLim;
      let vx = Math.max(-maxVx, Math.min(maxVx, vx0));
      let vy = Math.max(-vLim, Math.min(vLim, vy0));
      let bounces = 0;
      let scattered = false;
      resetActorTransient(ent, { keepFly: true, keepVel: true, keepBallistic: true });
      ent.ballisticActive = true;
      if (!mini) {
        ent.reboundNoBump = Boolean(bopts.reboundNoBump);
        ent.overridePose = 'dangle';
        ent.overrideUntil = performance.now() + 3000;
      }
      // 起跳瞬间立刻锁死 data-direct="1" 与 transition: none，防止首帧落入 220ms CSS transition
      syncDirectMotionDomAttr(ent, mini ? ent.canvas : ent.el);

      let prev = performance.now();
      const step = (now) => {
        if (disposed || flightId !== ent.flying || ent.dragging) {
          if (disposed || ent.dragging) ent.ballisticActive = false;
          return;
        }
        if (isDocHidden() || isHostSleeping() || parked) {
          if (hasReboundTarget) {
            ent.x = Math.max(8, Math.min(maxXFor(readStageWidth()), bopts.reboundTargetX));
          }
          if (!mini) ent.reboundNoBump = false;
          resetActorTransient(ent, { keepFly: true });
          ent.y = 0;
          enforceGroundSeparation();
          if (!mini) applyActorTransform(ent, now);
          else syncTower(ent, now);
          reclaimStageVram();
          return;
        }
        const k = Math.max(0.5, Math.min(2.5, (now - prev) / 16.6667));
        prev = now;
        vy += (mini ? 0.46 : 0.44) * k;
        const drag = Math.pow(mini ? 0.985 : 0.988, k);
        vx *= drag;
        vy *= drag;

        let mainMinX = 8;
        let mainMaxX = 40;
        if (mini) {
          const { minX, maxX } = stageBoundsX();
          const hw = entHalfW(ent);
          let cx = getEntWorldCx(ent) + vx * k;
          if (cx < minX + hw) { cx = minX + hw; vx = -0.45 * vx; }
          else if (cx > maxX - hw) { cx = maxX - hw; vx = -0.45 * vx; }
          setEntWorldCx(ent, cx);
          ent.y = Math.max(-180, (ent.y || 0) + vy * k);
        } else {
          ent.x += vx * k;
          ent.y += vy * k;
          mainMinX = 8;
          mainMaxX = maxXFor(readStageWidth());
          if (hasReboundTarget) {
            const targetX = Math.max(mainMinX, Math.min(mainMaxX, bopts.reboundTargetX));
            if ((vx >= 0 && ent.x > targetX) || (vx < 0 && ent.x < targetX)) {
              ent.x = targetX;
              vx = 0;
            }
          }
          if (ent.x < mainMinX) { ent.x = mainMinX; vx = -0.45 * vx; }
          else if (ent.x > mainMaxX) { ent.x = mainMaxX; vx = -0.45 * vx; }
          if (ent.y < -180) { ent.y = -180; vy = -0.45 * vy; }
        }
        ent.vx = vx;
        ent.vy = vy;

        if (!bopts.noSnap && vy >= 0 && trySnapOntoTower(ent, now)) return;

        if (!mini) {
          const other = ent.id === 'cat' ? actors.clawd : actors.cat;
          if (
            !bopts.reboundNoBump &&
            !other.reboundNoBump &&
            !other.dragging && !other.stackedOn && !ent.stackedOn &&
            Math.abs(ent.x - other.x) < 42 && Math.abs(ent.y - other.y) < 22 &&
            ((ent.x < other.x && vx > 0.35) || (ent.x >= other.x && vx < -0.35)) &&
            canTriggerPair('ballistic', now, 650)
          ) {
            const sign = ent.x < other.x ? -1 : 1;
            ent.x = clampActorX(other.x + sign * 42);
            const incomingVx = vx;
            vx = -incomingVx * 0.46;
            if (Math.abs(vx) < 1.6) vx = sign * 1.8;
            ent.sym = 'sweat';
            ent.symUntil = now + 750;
            startClip(other, 'wow', 800, { sym: 'bang', face: sign < 0 ? 'left' : 'right' });
            startEntityBallistic(other, Math.max(-7.2, Math.min(7.2, incomingVx * 0.62 || -sign * 2.6)), -2.7);
            recordInteraction('ballisticBump', `${ent.id}->${other.id}`, now);
            renderAllFrames(now);
          }
        }

        if (ent.y >= 0) {
          ent.y = 0;
          if (!mini && !scattered) { scattered = true; scatterCrabsNear(ent.x + 48); }
          const maxB = mini ? 1 : 2;
          const minVy = mini ? 2.6 : 2.4;
          if (Math.abs(vy) > minVy && bounces < maxB) {
            vy = -vy * (mini ? 0.32 : 0.36);
            vx *= mini ? 0.78 : 0.82;
            bounces += 1;
            // 中途弹跳：ballisticActive 保持 true 锁死 data-direct
            if (!mini) playSeq(ent, [['flat', 1, 2, 0]]);
          } else {
            const impact = Math.abs(vy);
            if (hasReboundTarget) {
              ent.x = Math.max(mainMinX, Math.min(mainMaxX, bopts.reboundTargetX));
            }
            if (!mini) ent.reboundNoBump = false;
            resetActorTransient(ent, { keepFly: true });
            if (!mini) {
              const steps = landingSteps(impact > 1.2 || bounces > 0 ? 2 : 1);
              playSeq(ent, steps);
              if (ent.throws >= 3) {
                ent.throws = 0;
                startClip(ent, 'angry', 1400 + seqTotalMs(steps), { sym: 'vein' });
              }
            }
            enforceGroundSeparation();
            if (!mini) applyActorTransform(ent, now);
            else syncTower(ent, now);
            renderAllFrames(now);
            return;
          }
        }
        ent.rot = Math.max(-14, Math.min(14, -vx * 0.65));
        ent.vx = vx;
        ent.vy = vy;
        syncAllStackedFollowers();
        if (mini) {
          syncTower(ent, now);
        } else {
          applyActorTransform(ent, now);
          // 仅在姿态真正切变（如起跳进 dangle 或触地切 flat）时重绘精灵，避免 60fps 软件重绘
          if (resolvePoseFor(ent, now) !== ent.lastRender.poseKey) {
            renderAllFrames(now);
          }
        }
        rAF(step);
      };
      rAF(step);
    };

    const startEntityBallistic = (ent, vx0, vy0, bopts = {}) => {
      if (!ent) return;
      const mini = isMiniEnt(ent);
      if (!mini && Math.hypot(vx0, vy0) > 2.2) dismountRidersSideHop(ent.id);
      if (reducedMotion) {
        resetActorTransient(ent, { keepPose: !mini && ent.overridePose !== 'dangle' });
        if (!mini && typeof bopts.reboundTargetX === 'number' && Number.isFinite(bopts.reboundTargetX)) {
          ent.x = clampActorX(bopts.reboundTargetX);
        }
        if (bopts.noSnap || !trySnapOntoTower(ent, performance.now())) {
          ent.y = 0;
          enforceGroundSeparation();
          if (!mini) applyActorTransform(ent);
          else syncTower(ent);
          renderAllFrames(performance.now());
        }
        return;
      }
      if (!mini && bopts.anticipate && ent.y === 0 && !ent.stackedOn) {
        const prepId = (ent.flying += 1);
        ent.ballisticActive = false;
        playSeq(ent, [['squash', 2, 2, -1]]);
        later(TICK * 2, () => {
          if (ent.flying === prepId && !ent.dragging) launchEntity(ent, vx0, vy0, bopts);
        });
        return;
      }
      launchEntity(ent, vx0, vy0, bopts);
    };
    const startBallistic = startEntityBallistic;
    const startMiniBallistic = startEntityBallistic;

    const dragReleaseHooks = [];
    let dragRafPending = false;
    let dragRafId = 0;
    const cAF =
      (win && typeof win.cancelAnimationFrame === 'function' && win.cancelAnimationFrame.bind(win)) ||
      (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null);
    const scheduleDragRender = () => {
      if (dragRafPending || disposed) return;
      dragRafPending = true;
      dragRafId = rAF((frameNow) => {
        dragRafId = 0;
        dragRafPending = false;
        if (!disposed) renderAllFrames(frameNow);
      });
    };

    // ── 投喂彩蛋（右键=甜甜圈 / Alt+左键=热咖啡）：立即消气清 pokeCount 并解除 sulk ──
    const feedActor = (actor, item = 'donut') => {
      if (!actor || isMiniEnt(actor) || disposed) return false;
      const now = performance.now();
      markActivity();
      actor.pokeCount = 0;
      actor.lastPokeAt = 0;
      if (actor.overridePose === 'sulk' || actor.overridePose === 'angry') {
        resetActorTransient(actor);
      }
      const pose = item === 'coffee' ? 'feedCoffee' : 'feedDonut';
      startClip(actor, pose, 2200, { sym: 'heart' });
      recordInteraction(pose, actor.id, now);
      renderAllFrames(now);
      return true;
    };

    // 统一主宠 + 迷你蟹指针拖拽绑定（主宠附带右键甜甜圈 & Alt+左键热咖啡投喂）
    const bindEntityPointer = (ent) => {
      const mini = isMiniEnt(ent);
      const domNode = mini ? ent.canvas : ent.el;
      const dragThreshold = mini ? 2.5 : 7;
      let downX = 0;
      let downY = 0;
      let startX = 0;
      let startY = 0;
      let cachedA = 720;
      let cachedB = 680;
      let lastMoveX = 0;
      let lastMoveY = 0;
      let lastMoveT = 0;
      let moved = false;
      let petTimer = 0;
      let petTriggered = false;

      const onDown = (evt) => {
        if (yieldMode === 'peek' || evt.button !== 0 || (mini && !miniPileEnabled)) return;
        evt.preventDefault();
        evt.stopPropagation();
        if (!mini && evt.altKey) {
          feedActor(ent, 'coffee');
          return;
        }
        try { ent.el.setPointerCapture?.(evt.pointerId); } catch (_) {}
        const downNow = performance.now();
        if (ent.glideUntil && downNow < ent.glideUntil) {
          ent.glideSeq = (ent.glideSeq || 0) + 1;
          ent.glideUntil = 0;
          try {
            const er = ent.el?.getBoundingClientRect?.();
            const hr = hostEl?.getBoundingClientRect?.();
            const hasRect =
              er &&
              hr &&
              Number.isFinite(er.left) &&
              Number.isFinite(hr.left) &&
              ((Number.isFinite(er.width) && er.width > 0) || (Number.isFinite(er.right) && er.right > er.left));
            if (hasRect) {
              if (mini) setEntWorldCx(ent, er.left - hr.left + 20);
              else ent.x = clampActorX(er.left - hr.left);
            }
          } catch (_) {}
          if (mini) {
            if (ent.el?.style) ent.el.style.transition = '';
          } else {
            for (const cid of getTowerMembers(ent.id)) {
              const member = getEnt(cid);
              if (!member) continue;
              member.glideSeq = (member.glideSeq || 0) + 1;
              member.glideUntil = 0;
              if (member.el?.style) member.el.style.transition = '';
            }
            syncTower(ent);
          }
        }
        if (!mini) ent.reboundNoBump = false;
        if (mini) {
          const { minX, maxX } = stageBoundsX();
          const hw = entHalfW(ent);
          cachedA = minX + hw;
          cachedB = maxX - hw;
          startX = getEntWorldCx(ent);
        } else {
          cachedA = readStageWidth();
          startX = ent.x;
        }
        downX = evt.clientX;
        downY = evt.clientY;
        startY = ent.stackedOn ? computeWorldFootY(ent) : ent.y || 0;
        lastMoveX = evt.clientX;
        lastMoveY = evt.clientY;
        lastMoveT = downNow;
        moved = false;
        petTriggered = false;
        markActivity();
        resetActorTransient(ent);

        if (!mini) {
          clearTimeout(petTimer);
          petTimer = setTimeout(() => {
            if (!moved && !disposed) {
              petTriggered = true;
              startClip(ent, 'pet', 1100, { sym: 'heart' });
              renderAllFrames(performance.now());
            }
          }, 360);
        }
      };

      const onMove = (evt) => {
        if (lastMoveT === 0) return;
        const dxTotal = evt.clientX - downX;
        const dyTotal = evt.clientY - downY;
        let justStarted = false;
        if (!moved && Math.hypot(dxTotal, dyTotal) > dragThreshold) {
          moved = true;
          justStarted = true;
          clearTimeout(petTimer);
          detachWithGravitySettle(ent.id);
          if (!mini) {
            ent.sideEdgeSnap = false;
            ent.sidePushOriginX = null;
            ent.sideEdgeDirectUntil = 0;
          }
          ent.ballisticActive = false;
          ent.dragging = true;
          syncDirectMotionDomAttr(ent, domNode);
          syncMascotDragRootAttr();
        }
        if (!moved) return;
        evt.stopPropagation?.();
        const now = performance.now();
        const dt = Math.max(4, now - lastMoveT);
        ent.vx = ent.vx * 0.4 + (((evt.clientX - lastMoveX) / dt) * 16) * 0.6;
        ent.vy = ent.vy * 0.4 + (((evt.clientY - lastMoveY) / dt) * 16) * 0.6;
        ent.rot = Math.max(-14, Math.min(14, -ent.vx * 0.7));
        lastMoveX = evt.clientX;
        lastMoveY = evt.clientY;
        lastMoveT = now;

        const nextY = Math.max(-180, Math.min(0, startY + dyTotal));
        if (mini) {
          const clampedCx = Math.max(cachedA, Math.min(cachedB, startX + dxTotal));
          const nextPx = Math.max(2, clampedCx - 32);
          ent.px = nextPx;
          ent.lastX = Math.round(nextPx);
          ent.y = nextY;
          const tx = snapCoord(nextPx, true);
          const ty = snapCoord(nextY, true);
          applyMiniTransform(ent, tx, ty, '39', ent.rot);
        } else {
          const rightReserve = popoverRightWidth > 0 ? Math.min(cachedA - 150, popoverRightWidth + 16) : 0;
          ent.x = Math.max(4, Math.min(Math.max(24, cachedA - 88 - rightReserve), startX + dxTotal));
          ent.y = nextY;
          applyActorTransform(ent, now);
        }

        if (justStarted) renderAllFrames(now);
        else scheduleDragRender();

        if (!mini && !reducedMotion && ent.dragging && ent.y > -22) {
          const other = ent.id === 'cat' ? actors.clawd : actors.cat;
          if (!other.dragging && !other.stackedOn && other.y === 0 && Math.abs(ent.x - other.x) < 38) {
            if (Math.abs(ent.vx) >= 2.0 && canTriggerPair('dragBump', now, 750)) {
              const pushDir = ent.vx >= 0 ? 1 : -1;
              startClip(other, 'wow', 750, { sym: 'bang', face: pushDir > 0 ? 'left' : 'right' });
              startEntityBallistic(other, pushDir * Math.min(5.2, Math.abs(ent.vx) * 0.58), -2.5);
              recordInteraction('dragBump', `${ent.id}->${other.id}`, now);
              scheduleDragRender();
            } else if (Math.abs(ent.vx) < 2.0 && canTriggerPair('dragPass', now, 1400)) {
              gaze(other, ent.x < other.x ? 'left' : 'right', 750, false, 'note');
              hop(other, 'wave');
              recordInteraction('dragPass', `${ent.id}->${other.id}`, now);
              scheduleDragRender();
            }
          }
          if (miniPileEnabled && ent.y > -16 && Math.abs(ent.vx) > 1.4 && canTriggerPair('dragCrab', now, 800)) {
            if (miniCrabs.some((mc) => !mc.act && !mc.stackedOn && Math.abs(crabHostCenter(mc) - (ent.x + 48)) < 32)) {
              scatterCrabsNear(ent.x + 48);
              recordInteraction('crabScatter', ent.id, now);
              scheduleDragRender();
            }
          }
        }
      };

      const onUp = (evt) => {
        if (lastMoveT === 0) return;
        clearTimeout(petTimer);
        ent.el.releasePointerCapture?.(evt.pointerId);
        const prevMoveT = lastMoveT;
        lastMoveT = 0;

        if (moved) {
          ent.dragging = false;
          syncMascotDragRootAttr();
          const pNow = performance.now();
          if (pNow - prevMoveT > 35) { ent.vx = 0; ent.vy = 0; }
          if (Math.hypot(ent.vx, ent.vy) < 4.5 && trySnapOntoTower(ent, pNow)) {
            syncDirectMotionDomAttr(ent, domNode);
            moved = false;
            return;
          }
          if (!mini) {
            const wallNow = Date.now();
            if (wallNow - ent.lastThrowAt > 8000) ent.throws = 0;
            ent.throws += 1;
            ent.lastThrowAt = wallNow;
          }
          const mul = mini ? 0.78 : 0.85;
          startEntityBallistic(ent, ent.vx * mul, ent.vy * mul);
          moved = false;
          return;
        }

        if (mini) {
          ent.bumpUntilTick = tickIdx + 6;
          ent.passHopUntilTick = tickIdx + 4;
          renderAllFrames(performance.now());
        } else if (!petTriggered) {
          triggerPoke(ent, true);
        }
      };

      const cancelDragOnBlur = () => {
        if (lastMoveT === 0 && !ent.dragging) return;
        clearTimeout(petTimer);
        lastMoveT = 0;
        if (moved || ent.dragging) {
          moved = false;
          ent.dragging = false;
          ent.ballisticActive = false;
          ent.vx = 0;
          ent.vy = 0;
          ent.rot = 0;
          syncMascotDragRootAttr();
          syncDirectMotionDomAttr(ent, domNode);
          if (!disposed) startEntityBallistic(ent, 0, 0, { noSnap: true });
        }
      };
      dragReleaseHooks.push(cancelDragOnBlur);

      const onContextMenu = (evt) => {
        if (mini || yieldMode === 'peek') return;
        evt.preventDefault();
        evt.stopPropagation();
        feedActor(ent, 'donut');
      };

      ent.el.addEventListener('pointerdown', onDown);
      ent.el.addEventListener('pointermove', onMove);
      ent.el.addEventListener('pointerup', onUp);
      ent.el.addEventListener('pointercancel', onUp);
      if (!mini) ent.el.addEventListener('contextmenu', onContextMenu);
      cleanups.push(() => {
        clearTimeout(petTimer);
        ent.el.removeEventListener('pointerdown', onDown);
        ent.el.removeEventListener('pointermove', onMove);
        ent.el.removeEventListener('pointerup', onUp);
        ent.el.removeEventListener('pointercancel', onUp);
        if (!mini) ent.el.removeEventListener('contextmenu', onContextMenu);
      });
    };

    bindEntityPointer(actors.cat);
    bindEntityPointer(actors.clawd);
    miniCrabs.forEach(bindEntityPointer);

    const hasDozeTransition = (now) =>
      (actors.cat.overridePose && now < actors.cat.overrideUntil) ||
      (actors.clawd.overridePose && now < actors.clawd.overrideUntil);
    const inTrans = () =>
      [actors.cat, actors.clawd, ...miniCrabs].some(
        (e) => e.dragging || e.ballisticActive || e.leap || e.y < -0.4 || Math.abs(e.vy) > 0.01
      ) || Boolean(reboundTm);
    const syncPwr = () => {
      if (disposed) return;
      if (isHostDetached() || parked) {
        syncHeartbeat();
        reclaimStageVram();
        return;
      }
      if (isDocHidden() || isHostSleeping()) {
        syncHeartbeat();
        reclaimStageVram();
        return;
      }
      if (!isAttrB()) {
        wb = false;
        if (dozing && !isDocHidden() && !isHostSleeping()) { wakeUp(); return; }
      }
      syncHeartbeat();
      if (!theaterTimer && currentTickMs > 0 && !dozing && !reducedMotion) scheduleTheater();
      if (!isWindowBlurred() && !isHostSleeping()) renderAllFrames(performance.now());
    };
    const onWBlur = () => {
      if (disposed) return;
      wb = true;
      for (let i = 0; i < dragReleaseHooks.length; i++) dragReleaseHooks[i]();
      syncHeartbeat();
    };
    const onWFocus = () => { wb = false; syncPwr(); };
    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('blur', onWBlur);
      win.addEventListener('focus', onWFocus);
      cleanups.push(() => { win.removeEventListener?.('blur', onWBlur); win.removeEventListener?.('focus', onWFocus); });
    }
    const MO0 = win?.MutationObserver || (typeof MutationObserver === 'function' ? MutationObserver : null);
    if (MO0 && doc?.documentElement) {
      try {
        let wasResizingAttr = Boolean(doc.documentElement.getAttribute?.(RESIZE_ATTR) === '1');
        const mo = new MO0((records) => {
          if (disposed) return;
          const nowResizingAttr = Boolean(doc.documentElement.getAttribute?.(RESIZE_ATTR) === '1');
          const resizeEnded = wasResizingAttr && !nowResizingAttr;
          wasResizingAttr = nowResizingAttr;
          if (resizeEnded) onStageResizeReleased();
          const hasPowerMut =
            !Array.isArray(records) ||
            records.some((r) => !r || !r.attributeName || r.attributeName === WB || r.attributeName === PM);
          if (hasPowerMut) syncPwr();
        });
        mo.observe(doc.documentElement, { attributes: true, attributeFilter: [WB, PM, RESIZE_ATTR] });
        cleanups.push(() => mo.disconnect());
      } catch (_) {}
    }

    // ── 生态联动：活动唤醒 / 打盹 / 领衔交接 / 外部事件 notify ───────────────
    const leaderActor = () => (camp === 'claude' ? actors.clawd : actors.cat);
    const partnerActor = () => (camp === 'claude' ? actors.cat : actors.clawd);
    const faceToward = (from, to) => (to.x >= from.x ? 'right' : 'left');

    const onHeartbeat = () => {
      if (disposed) return;
      const now = performance.now();
      if (
        isHostDetached() ||
        parked ||
        isDocHidden() ||
        isHostSleeping() ||
        (isWindowBlurred() && (dozing || !inTrans())) ||
        (reducedMotion && !inTrans())
      ) {
        syncHeartbeat(now);
        if (isVramSleepState()) reclaimStageVram();
        return;
      }
      tickIdx += 1;
      updateBalance();
      ecoTick(now);
      renderAllFrames(now);
      syncHeartbeat(now);
    };

    function syncHeartbeat(now = performance.now()) {
      let targetMs = TICK;
      if (
        disposed ||
        isHostDetached() ||
        parked ||
        isDocHidden() ||
        isHostSleeping() ||
        (isWindowBlurred() && (dozing || !inTrans())) ||
        (reducedMotion && !inTrans())
      ) {
        targetMs = 0;
      } else if (dozing && !stageBusy() && !hasDozeTransition(now)) {
        targetMs = DOZE_TICK;
      }
      if (targetMs === 0 || dozing || reducedMotion) {
        clearTimeout(theaterTimer);
        theaterTimer = 0;
      } else if (!theaterTimer) {
        scheduleTheater();
      }
      if (isVramSleepState()) reclaimStageVram();
      if (targetMs === currentTickMs) return;
      if (tickTimer !== null) {
        clearInterval(tickTimer);
        tickTimer = null;
      }
      currentTickMs = targetMs;
      if (targetMs > 0) {
        tickTimer = setInterval(onHeartbeat, targetMs);
        if (tickTimer && typeof tickTimer.unref === 'function') tickTimer.unref();
      }
    }

    function wakeUp() {
      if (!dozing) return;
      dozing = false;
      lastActivityAt = performance.now();
      syncHeartbeat();
      // 伸懒腰醒来（复用 stretch 姿态，小紫猫错峰 2 拍）
      startClip(actors.clawd, 'stretch', 1100);
      later(TICK * 2, () => {
        if (!dozing) startClip(actors.cat, 'stretch', 1100);
      });
      renderAllFrames(performance.now());
    }

    function markActivity() {
      if (!isAttrB()) wb = false;
      lastActivityAt = performance.now();
      if (dozing && !isHostSleeping() && !isWindowBlurred()) wakeUp();
      else syncHeartbeat();
    }

    // 进入打盹：先打哈欠（小紫猫先、Clawd 错峰 0.4s），哈欠结束后由 resolvePoseFor 接管为 sleep 并拉宽至 400ms
    function startDoze(skipYawn) {
      if (dozing) return;
      dozing = true;
      for (const id of ['cat', 'clawd']) {
        const a = actors[id];
        if (a.overridePose && a.overridePose !== 'dangle') a.overrideUntil = 0;
        a.eyeScan = 0;
      }
      if (!skipYawn) {
        const prePose = isLateNight() ? 'nightSip' : 'yawn';
        const preMs = isLateNight() ? 1800 : 1200;
        startClip(actors.cat, prePose, preMs);
        later(400, () => {
          if (dozing) startClip(actors.clawd, prePose, preMs);
        });
      }
      const now = performance.now();
      renderAllFrames(now);
      syncHeartbeat(now);
    }

    // 每拍生态检查：忙碌视为活动；空闲超时则打盹；检测自主散步遇障（撑跳越过 / 搭便车 / 礼貌转身）与双宠碰撞
    const ecoTick = (now) => {
      if (stageBusy()) {
        lastActivityAt = now;
        if (dozing) wakeUp();
        return;
      }
      const limit = isLateNight() ? DOZE_AFTER_NIGHT_MS : DOZE_AFTER_MS;
      if (!dozing && now - lastActivityAt > limit) {
        startDoze(false);
        return;
      }
      if (reducedMotion || dozing || now < duetUntil) return;

      const clawd = actors.clawd;
      const cat = actors.cat;
      if (
        !clawd.dragging &&
        !cat.dragging &&
        !clawd.ballisticActive &&
        !cat.ballisticActive &&
        !clawd.stackedOn &&
        !cat.stackedOn &&
        !clawd.leap &&
        !cat.leap &&
        clawd.y === 0 &&
        cat.y === 0
      ) {
        const cPose = resolvePoseFor(clawd, now);
        const kPose = resolvePoseFor(cat, now);
        const cWalking = cPose === 'walk' && now < clawd.overrideUntil;
        const kWalking = kPose === 'walk' && now < cat.overrideUntil;
        const enc = classifyPairEncounter({
          xA: clawd.x,
          yA: clawd.y,
          walkingA: cWalking,
          dirA: clawd.patrolDir,
          xB: cat.x,
          yB: cat.y,
          walkingB: kWalking,
          dirB: cat.patrolDir,
          contactDist: 46,
          verticalTol: 22,
        });
        if (enc && enc.kind === 'bump' && canTriggerPair('mainWalk', now, 1200)) {
          clawd.x = clampActorX(clawd.x - enc.sign * 5);
          cat.x = clampActorX(cat.x + enc.sign * 5);
          clawd.faceDir = enc.sign > 0 ? 'right' : 'left';
          cat.faceDir = enc.sign > 0 ? 'left' : 'right';
          clawd.sym = 'bang';
          clawd.symUntil = now + 850;
          cat.sym = 'spark';
          cat.symUntil = now + 850;
          clawd.overridePose = 'idle';
          clawd.overrideUntil = now + 440;
          cat.overridePose = 'idle';
          cat.overrideUntil = now + 440;
          playSeq(clawd, [
            ['squash', 1, 2, -1, 0],
            ['wow', 2, -1, 1, -2],
            ['idle', 1, 1, -1, 0],
          ]);
          playSeq(cat, [
            ['squash', 1, 2, -1, 0],
            ['tilt', 2, -1, 1, -2],
            ['idle', 1, 1, -1, 0],
          ]);
          later(420, () => {
            if (disposed || stageBusy() || reducedMotion || dozing) return;
            startClip(clawd, 'walk', 2200, { patrolDir: -enc.sign });
            startClip(cat, 'walk', 2200, { patrolDir: enc.sign });
          });
          recordInteraction('bump', 'clawd-cat', now);
          return;
        }
        if (enc && enc.kind === 'passBy' && canTriggerPair('mainPass', now, 1500)) {
          const walker = enc.mover === 'A' ? clawd : cat;
          const stationary = enc.mover === 'A' ? cat : clawd;
          triggerObstacleEncounter(walker.id, stationary.id);
          return;
        }
      }

      // 场景 4 · 5 宠散步遇障（主宠与自由迷你蟹相遇时触发撑跳越过 / 自动搭便车 / 驻足眨眼转身）
      if (miniPileEnabled) {
        for (const a of [clawd, cat]) {
          if (a.dragging || a.ballisticActive || a.stackedOn || a.leap || a.y !== 0) continue;
          const aWalk = resolvePoseFor(a, now) === 'walk' && now < a.overrideUntil;
          for (const mc of miniCrabs) {
            if (mc.dragging || mc.ballisticActive || mc.stackedOn || mc.leap || mc.act || mc.y !== 0) continue;
            const d = getEntWorldCx(mc) - getEntWorldCx(a);
            if (Math.abs(d) < 40 && canTriggerPair(`obs:${a.id}:${mc.id}`, now, 1600)) {
              if (aWalk && d * a.patrolDir > 0) {
                triggerObstacleEncounter(a.id, mc.id);
                return;
              }
              if (d * mc.dir < 0) {
                triggerObstacleEncounter(mc.id, a.id);
                return;
              }
            }
          }
        }
      }
    };

    // 原地整格小跳（减少动态 / 拖拽 / 叠叠乐 / 腾空时跳过，直接回调）
    const hop = (a, airPose, then) => {
      const now = performance.now();
      const partnerOnTop = Boolean(findDirectRider(a.id));
      if (reducedMotion || !actorFree(a, now) || partnerOnTop) {
        if (then) then();
        return;
      }
      playSeq(a, hopSteps(airPose), then);
    };

    // 扫视：转身 + 竖瞳偏向；up=true 时抬头
    const gaze = (a, dir, ms, up = false, sym = null) => {
      const now = performance.now();
      if (a.dragging || (a.overridePose === 'dangle' && now < a.overrideUntil)) return;
      startClip(a, 'gaze', ms, { face: dir === 'left' ? 'left' : 'right', param: up ? 1 : 0, sym: sym || undefined });
    };

    // 领衔位交接：两宠下蹲小跳，腾空瞬间交换站位；落地后新领衔冒 spark、旧领衔点头，三蟹迎宾挥手
    const campHandoff = () => {
      const now = performance.now();
      if (now - lastHandoffAt < 700) return;
      lastHandoffAt = now;
      duetUntil = now + 1200;
      const leader = leaderActor();
      const old = partnerActor();
      const finish = () => {
        if (disposed) return;
        startClip(leader, 'happy', 900, { sym: 'spark' });
        startClip(old, 'lookNod', 1300, { face: faceToward(old, leader), param: 2 });
        crabsWave();
        renderAllFrames(performance.now());
      };
      if (reducedMotion) {
        resetHomePositions(false);
        finish();
        return;
      }
      let pending = 2;
      const done = () => {
        pending -= 1;
        if (pending === 0) finish();
      };
      hop(leader, 'jiggle', done);
      hop(old, 'jiggle', done);
      later(TICK * 2, () => resetHomePositions(false));
    };

    const celebrateDone = () => {
      const leader = leaderActor();
      const partner = partnerActor();
      const now = performance.now();
      leader.sym = 'heart';
      leader.symUntil = now + 1500;
      if (reducedMotion) {
        startClip(leader, 'happy', 900, { sym: 'heart' });
        startClip(partner, 'happy', 900);
        return;
      }
      hop(leader, 'jiggle');
      hop(partner, 'jiggle');
    };

    // ── 9 大 Slash 指令专属微剧场（2.4~2.8s，演完归零 0fps）──────────────────
    let lastVialWarnAt = 0;
    const runSlashTheater = (rawCmd) => {
      const cmd = String(rawCmd || '').replace(/^\/+/, '').trim().toLowerCase();
      if (!cmd || disposed) return false;
      const now = performance.now();
      const leader = leaderActor();
      const partner = partnerActor();
      const norm = cmd === 'swarm' ? 'teamwork' : cmd;
      duetUntil = now + 2900;

      if (norm === 'plan') {
        startClip(leader, 'slashPlan', 2600);
        startClip(partner, 'tilt', 1300, { rot: -8, sym: 'q', face: faceToward(partner, leader) });
        later(1350, () => { if (!disposed) startClip(partner, 'lookNod', 1200, { face: faceToward(partner, leader), param: 2 }); });
      } else if (norm === 'goal') {
        startClip(leader, 'slashGoal', 2600);
        startClip(partner, 'salute', 2400, { sym: 'spark' });
      } else if (norm === 'boost') {
        startClip(leader, 'slashBoost', 2600);
        if (!reducedMotion) {
          spawnChromaBurst(getEntWorldCx(leader), computeWorldFootY(leader) - 18, 12, false);
          hop(leader, 'slashBoost');
        }
        startClip(partner, 'wow', 2200, { sym: 'spark' });
      } else if (norm === 'teamwork') {
        startClip(leader, 'slashTeam', 2800);
        startClip(partner, 'salute', 2600, { sym: 'spark' });
        if (miniPileEnabled) {
          const mid = Math.round(readStageWidth() * 0.45);
          miniCrabs.forEach((mc, idx) => {
            if (mc.act && mc.act.type === 'ride') return;
            const x0 = crabSafeX(mc.lastX);
            const tx = crabSafeX(mid + (idx - 1) * 28);
            mc.act = {
              type: 'wave',
              start: tickIdx + 1,
              segs: [
                { ticks: 6, x0, x1: tx, y0: 0, y1: 0, sprite: 'walk' },
                { ticks: 14, x0: tx, x1: tx, y0: 0, y1: 0, sprite: 'wave', hop: true },
                { ticks: 6, x0: tx, x1: x0, y0: 0, y1: 0, sprite: 'walk' },
              ],
            };
          });
        }
      } else if (norm === 'browser') {
        const startX = leader.x;
        const dir = startX > readStageWidth() * 0.5 ? -1 : 1;
        startClip(leader, 'slashBrowser', 2600, { mirror: dir < 0 });
        startClip(partner, 'wow', 2200, { sym: 'spark' });
        if (!reducedMotion && !leader.stackedOn && !leader.dragging) {
          leader.x = clampActorX(startX + dir * 28);
          later(2200, () => { if (!disposed && !leader.dragging && !leader.stackedOn) resetHomePositions(true); });
        }
      } else if (norm === 'compact') {
        startClip(actors.clawd, 'slashCompact', 2800);
        startClip(actors.cat, 'slashCompact', 2800, { mirror: true });
      } else if (norm === 'schedule') {
        scheduleWatchUntil = Date.now() + 30 * 60 * 1000;
        renderHabitatProp(true);
        startClip(leader, 'slashSchedule', 2600);
        startClip(partner, 'lookNod', 2200, { face: faceToward(partner, leader), param: 3 });
      } else if (norm === 'grill-me') {
        startClip(leader, 'slashGrill', 2600);
        startClip(partner, 'lookNod', 2400, { face: faceToward(partner, leader), param: 4 });
      } else if (norm === 'learn') {
        startClip(actors.cat, 'slashLearnBook', 2600);
        startClip(actors.clawd, 'slashLearnBulb', 2600);
      } else {
        return false;
      }
      recordInteraction('slash:' + norm, leader.id, now);
      return true;
    };

    // 外部事件处理表（未知事件静默忽略）
    const NOTIFY = {
      activity() {},
      'slash-cmd'(p) {
        if (!runSlashTheater(p && p.cmd)) NOTIFY.send();
      },
      'effort-tier'(p) {
        const tier = String(p?.tier || '').toLowerCase();
        if (tier === 'high' || tier === 'xhigh') {
          const leader = leaderActor();
          startClip(leader, 'slashBoost', 2200, { sym: 'spark' });
          if (!reducedMotion) spawnChromaBurst(getEntWorldCx(leader), computeWorldFootY(leader) - 16, 6, true);
          recordInteraction('effort-tier:' + tier, leader.id, performance.now());
        }
      },
      'vial-high'() {
        const wallNow = Date.now();
        if (wallNow - lastVialWarnAt < 600000) return;
        lastVialWarnAt = wallNow;
        const leftPet = actors.clawd.x <= actors.cat.x ? actors.clawd : actors.cat;
        if (leftPet.dragging || leftPet.stackedOn) return;
        const origX = leftPet.x;
        if (!reducedMotion) leftPet.x = clampActorX(16);
        startClip(leftPet, 'worry', 2200, { face: 'left', mirror: true, sym: 'sweat' });
        recordInteraction('vial-high', leftPet.id, performance.now());
        later(2300, () => {
          if (!disposed && !leftPet.dragging && !leftPet.stackedOn) {
            leftPet.x = clampActorX(origX);
            resetHomePositions(true);
            renderAllFrames(performance.now());
          }
        });
      },
      'aura-complete'() {
        const now = performance.now();
        const clawd = actors.clawd;
        const cat = actors.cat;
        duetUntil = now + 2200;
        startClip(clawd, 'happy', 2000, { face: faceToward(clawd, cat), sym: 'heart' });
        startClip(cat, 'happy', 2000, { face: faceToward(cat, clawd), sym: 'spark' });
        if (!reducedMotion) {
          hop(clawd, 'happy');
          hop(cat, 'happy');
        }
        recordInteraction('aura-complete', 'clawd-cat', now);
      },
      campSwitch() {
        // 与 setState 自动触发 700ms 内去重，避免主代理双路调用时重复交接
        campHandoff();
      },
      'model-shift'() {
        chromaGates.tuned = true;
        gaze(leaderActor(), 'left', 800, true, 'spark');
      },
      'vial-opened'() {
        chromaGates.tuned = true;
        gaze(actors.clawd, 'left', 820, false, 'spark');
        gaze(actors.cat, 'left', 820, false, 'spark');
      },
      'code-copied'() {
        chromaGates.forged = true;
        const leader = leaderActor();
        leader.nodY = PX;
        leader.nodUntil = performance.now() + 180;
        leader.sym = 'note';
        leader.symUntil = performance.now() + 850;
      },
      'files-changed'() {
        chromaGates.forged = true;
        startClip(leaderActor(), 'salute', 780, { sym: 'spark' });
      },
      complete() {
        chromaGates.forged = true;
        celebrateDone();
      },
      orchestrator(p) {
        orchestrator = Boolean(p.on);
        if (orchestrator) {
          gaze(actors.clawd, 'left', 900, true, 'spark');
          gaze(actors.cat, 'left', 900, true, 'spark');
        }
      },
      streamDone(p) {
        const leader = leaderActor();
        const partner = partnerActor();
        if (p.error) {
          startClip(leader, 'worry', 1500, { sym: 'sweat' });
          startClip(partner, 'worry', 1500, { sym: 'sweat' });
          return;
        }
        chromaGates.forged = true;
        celebrateDone();
      },
      ripple(p) {
        const x = Number(p.x);
        if (!Number.isFinite(x)) return;
        for (const a of [actors.clawd, actors.cat]) {
          const dir = x < a.x + 48 ? 'left' : 'right';
          gaze(a, dir, 700);
          if (a.kind === 'cat') {
            a.forceTwitchStart = tickIdx;
            a.forceTwitchSide = dir === 'left' ? 'L' : 'R';
          }
        }
      },
      send() {
        const leader = leaderActor();
        const partner = partnerActor();
        startClip(leader, 'salute', 900, { sym: 'spark' });
        startClip(partner, 'lookNod', 1200, { face: faceToward(partner, leader), param: 2 });
      },
      'host-sleep'(p) {
        hostSleep = Boolean(p && p.sleep);
        syncHeartbeat();
        if (hostSleep || isVramSleepState()) {
          reclaimStageVram();
        } else if (!isWindowBlurred()) {
          renderAllFrames(performance.now());
        }
      },
    };
    const handleNotify = (event, payload) => {
      if (disposed) return;
      const fn = Object.prototype.hasOwnProperty.call(NOTIFY, event) ? NOTIFY[event] : null;
      if (!fn) return;
      const pl = payload && typeof payload === 'object' ? payload : {};
      if (event === 'host-sleep') {
        fn(pl);
        return;
      }
      const wasDozing = dozing;
      markActivity();
      if (event === 'activity') {
        if (wasDozing) renderAllFrames(performance.now());
        return;
      }
      fn(pl);
      renderAllFrames(performance.now());
    };

    // 鼠标靠近舞台或切回可见标签页时，0ms 恢复 100ms 灵敏心跳
    const onApproach = () => {
      markActivity();
    };
    if (typeof hostEl.addEventListener === 'function') {
      hostEl.addEventListener('pointerenter', onApproach, { passive: true });
      hostEl.addEventListener('pointermove', onApproach, { passive: true });
      cleanups.push(() => {
        hostEl.removeEventListener('pointerenter', onApproach);
        hostEl.removeEventListener('pointermove', onApproach);
      });
    }
    const onVisibilityChange = () => {
      if (disposed) return;
      syncHeartbeat();
      if (isVramSleepState()) {
        reclaimStageVram();
      } else if (!isWindowBlurred()) {
        renderAllFrames(performance.now());
      }
    };
    if (doc && typeof doc.addEventListener === 'function') {
      doc.addEventListener('visibilitychange', onVisibilityChange);
      cleanups.push(() => {
        doc.removeEventListener('visibilitychange', onVisibilityChange);
      });
    }

    const mountOntoStack = (riderId, holderId) => {
      const rider = getEnt(riderId);
      const holder = getEnt(holderId);
      if (!rider || !holder || rider.id === holder.id) return false;
      if (!miniPileEnabled && (isMiniEnt(rider) || isMiniEnt(holder))) return false;
      const top = getStackTop(holder.id);
      if (!top || getTowerMembers(top.id).includes(rider.id)) return false;
      const riderSubLen = getTowerMembers(rider.id).length;
      const baseLen = getTowerMembers(top.id).length;
      if (baseLen + riderSubLen > maxTowerDepthAllowed()) return false;
      if (rider.stackedOn) {
        detachWithGravitySettle(rider.id);
      }
      rider.flying += 1;
      rider.ballisticActive = false;
      rider.leap = null;
      if (isMiniEnt(rider)) rider.act = null;
      rider.stackedOn = top.id;
      rider.y = 0;
      rider.vx = 0;
      rider.vy = 0;
      rider.rot = 0;
      rider.perchUntil = 0;
      if (!isMiniEnt(rider)) {
        rider.seq = null;
        startClip(rider, 'happy', 900, { sym: 'heart' });
      }
      syncAllStackedFollowers();
      renderAllFrames(performance.now());
      return true;
    };

    const syncPeekInteractivity = () => {
      const isPeek = yieldMode === 'peek';
      if (hostEl) {
        if (isPeek) hostEl.setAttribute?.('data-ag-mascot-peek', '1');
        else hostEl.removeAttribute?.('data-ag-mascot-peek');
      }
      if (isPeek) {
        dragReleaseHooks.forEach((fn) => { try { fn(); } catch (_) {} });
      }
      for (const a of [actors.cat, actors.clawd]) {
        if (!a?.el) continue;
        a.el.setAttribute?.('tabindex', isPeek ? '-1' : '0');
        if (isPeek) a.el.setAttribute?.('aria-hidden', 'true');
        else a.el.removeAttribute?.('aria-hidden');
        if (a.el.style) a.el.style.pointerEvents = isPeek ? 'none' : '';
        applyActorTransform(a, performance.now());
      }
      if (miniGroupEl?.style) miniGroupEl.style.pointerEvents = isPeek ? 'none' : '';
      for (const mc of miniCrabs) {
        if (mc?.el?.style) mc.el.style.pointerEvents = isPeek ? 'none' : 'auto';
      }
      if (sanctuary) sanctuary.setPeek(isPeek);
    };

    syncPeekInteractivity();
    renderAllFrames(performance.now());
    syncHeartbeat();

    return {
      setState(next = {}) {
        const prevRight = popoverRightWidth;
        const prevCamp = camp;
        const prevStreaming = streaming;
        const prevStreamTier = streamTier;
        const prevHasError = hasError;
        const prevYield = yieldMode;
        const prevLeapOffset = leapOffsetY;
        const prevMiniPile = miniPileEnabled;
        const prevCatOnly = catOnly;
        const prevOrch = orchestrator;
        const prevReduced = reducedMotion;

        if (next.camp !== undefined) camp = next.camp === 'claude' ? 'claude' : 'gemini';
        if (next.streaming !== undefined) streaming = Boolean(next.streaming);
        if (next.streamTier !== undefined) streamTier = Number(next.streamTier || 2);
        if (next.hasError !== undefined) hasError = Boolean(next.hasError);
        if (next.yieldMode !== undefined) yieldMode = next.yieldMode || 'none';
        if (next.leapOffsetY !== undefined) leapOffsetY = Number(next.leapOffsetY || 0);
        if (next.popoverRightWidth !== undefined) popoverRightWidth = Number(next.popoverRightWidth || 0);
        if (next.miniPileEnabled !== undefined) miniPileEnabled = Boolean(next.miniPileEnabled);
        if (next.catOnly !== undefined) catOnly = Boolean(next.catOnly);
        if (next.orchestrator !== undefined) orchestrator = Boolean(next.orchestrator);
        if (next.reducedMotion !== undefined) {
          reducedMotion = Boolean(next.reducedMotion);
          if (reducedMotion && !prevReduced) freezeMotion();
          else if (!reducedMotion && prevReduced) lastActivityAt = performance.now();
        }

        const changed =
          camp !== prevCamp ||
          streaming !== prevStreaming ||
          streamTier !== prevStreamTier ||
          hasError !== prevHasError ||
          yieldMode !== prevYield ||
          leapOffsetY !== prevLeapOffset ||
          popoverRightWidth !== prevRight ||
          miniPileEnabled !== prevMiniPile ||
          catOnly !== prevCatOnly ||
          orchestrator !== prevOrch ||
          reducedMotion !== prevReduced;

        if (!changed) return;

        if (camp !== prevCamp) {
          // 挂载后阵营实际变化：自动播放领衔交接（站位交换在其内部完成）
          markActivity();
          campHandoff();
          if (performance.now() - lastHandoffAt > 50) resetHomePositions(popoverRightWidth !== prevRight);
        } else if (popoverRightWidth !== prevRight || miniPileEnabled !== prevMiniPile || catOnly !== prevCatOnly) {
          resetHomePositions(popoverRightWidth !== prevRight);
        }
        if (yieldMode !== prevYield || leapOffsetY !== prevLeapOffset) {
          syncPeekInteractivity();
        }
        if (reducedMotion !== prevReduced || streaming !== prevStreaming) {
          syncHeartbeat();
          if (streaming !== prevStreaming && sanctuary) sanctuary.onStreamingChange(streaming);
        }
        renderAllFrames(performance.now());
      },
      notify(event, payload = {}) {
        handleNotify(event, payload);
      },
      stackOnto(riderId, holderId) {
        return mountOntoStack(riderId, holderId);
      },
      pullFromStack(id, mode = 'settle') {
        const ent = getEnt(id);
        if (!ent) return false;
        if (mode === 'sideHop') {
          return dismountRidersSideHop(ent.id);
        }
        const origCx = getEntWorldCx(ent);
        detachWithGravitySettle(ent.id);
        resetActorTransient(ent);
        ent.y = 0;
        setEntWorldCx(ent, origCx - 64);
        enforceGroundSeparation();
        renderAllFrames(performance.now());
        return true;
      },
      triggerObstacle(moverId, obstacleId, forcedAction = null) {
        return triggerObstacleEncounter(moverId, obstacleId, forcedAction);
      },
      triggerDemo(kind) {
        const now = performance.now();
        inspectState = null;
        const leader = camp === 'claude' ? actors.clawd : actors.cat;
        const partner = camp === 'claude' ? actors.cat : actors.clawd;
        const stageObstacle = (mode) => {
          partner.stackedOn = null;
          leader.stackedOn = null;
          partner.y = 0;
          leader.y = 0;
          const mid = Math.round((clampActorX(9999) + 16) * 0.48);
          partner.x = clampActorX(mid);
          leader.x = clampActorX(mid - 50);
          triggerObstacleEncounter(leader.id, partner.id, mode);
        };
        if (kind === 'doze') {
          startDoze(true);
        } else if (kind === 'wake') {
          markActivity();
        } else if (kind === 'theater') {
          markActivity();
          runDuet(pickDuet());
        } else if (kind === 'campSwitch') {
          markActivity();
          camp = camp === 'claude' ? 'gemini' : 'claude';
          lastHandoffAt = 0;
          campHandoff();
        } else if (kind === 'streamDone') {
          markActivity();
          NOTIFY.streamDone({ error: false });
        } else if (kind === 'crabRide') {
          markActivity();
          miniPileEnabled = true;
          resetHomePositions(false);
          runCrabRide(true);
        } else if (kind === 'bump') {
          markActivity();
          const mid = Math.round((clampActorX(9999) + 16) * 0.46);
          actors.clawd.stackedOn = null;
          actors.cat.stackedOn = null;
          actors.clawd.y = 0;
          actors.cat.y = 0;
          actors.clawd.x = clampActorX(mid - 20);
          actors.cat.x = clampActorX(mid + 20);
          actors.clawd.sym = 'bang';
          actors.clawd.symUntil = now + 900;
          actors.cat.sym = 'spark';
          actors.cat.symUntil = now + 900;
          playSeq(actors.clawd, [['squash', 1, 2, -1, 0], ['wow', 2, -1, 1, -2], ['idle', 1, 1, -1, 0]]);
          playSeq(actors.cat, [['squash', 1, 2, -1, 0], ['tilt', 2, -1, 1, -2], ['idle', 1, 1, -1, 0]]);
          recordInteraction('bump', 'clawd-cat', now);
        } else if (kind === 'passBy') {
          markActivity();
          stageObstacle('leapfrog');
        } else if (kind === 'leapfrog' || kind === 'autoPerch' || kind === 'greetTurn') {
          stageObstacle(kind);
        } else if (kind === 'stack') {
          mountOntoStack(partner.id, leader.id);
        } else if (kind === 'unstack') {
          allActiveEnts().forEach((e) => {
            e.stackedOn = null;
            e.perchUntil = 0;
            resetActorTransient(e);
            e.y = 0;
          });
          resetHomePositions(true);
        } else if (kind === 'toss') {
          dismountRidersSideHop(leader.id);
          if (leader.stackedOn) detachWithGravitySettle(leader.id);
          leader.y = -48;
          startBallistic(leader, -3.5, -7.8);
        } else if (kind === 'poke') {
          triggerPoke(leader, false);
        } else if (typeof kind === 'string' && (kind.startsWith('slash:') || kind.startsWith('/'))) {
          markActivity();
          runSlashTheater(kind.replace(/^(?:slash:|\/)/, ''));
        } else if (kind === 'feedDonut' || kind === 'feedCoffee') {
          feedActor(leader, kind === 'feedCoffee' ? 'coffee' : 'donut');
        } else if (kind === 'vialHigh') {
          lastVialWarnAt = 0;
          NOTIFY['vial-high']({});
        } else if (kind === 'auraComplete') {
          NOTIFY['aura-complete']({});
        } else if (kind === 'effortHigh') {
          NOTIFY['effort-tier']({ tier: 'xhigh' });
        } else {
          const clipMap = { fire: 'onFire', cheer: 'cheerSticks', rickroll: 'rickroll', siren: 'siren' };
          const mapped = clipMap[kind] || kind;
          if (['onFire', 'siren', 'spinHop'].includes(mapped)) dismountRidersSideHop(leader.id);
          startClip(leader, mapped, 3800);
          if (['onFire', 'cheerSticks', 'rickroll', 'siren'].includes(mapped)) {
            startClip(partner, mapped === 'cheerSticks' ? 'cheerSticks' : 'wow', 3600, { sym: mapped === 'siren' ? 'sweat' : 'spark' });
          }
        }
        renderAllFrames(now);
      },
      inspectPose(opts = null) {
        if (!opts || opts.active === false) {
          inspectState = null;
          syncHeartbeat();
          renderAllFrames(performance.now());
          return null;
        }
        inspectState = {
          pose: opts.pose || 'idle',
          tick: Number.isFinite(opts.tick) ? Math.max(0, Math.floor(opts.tick)) : tickIdx,
          mirror: Boolean(opts.mirror),
          sqW: Math.round(Number(opts.sqW || 0)),
          sqH: Math.round(Number(opts.sqH || 0)),
          ruler: Boolean(opts.ruler),
          sym: opts.sym || null,
        };
        tickIdx = inspectState.tick;
        renderAllFrames(performance.now());
        return { ...inspectState };
      },
      stepTick(delta = 1) {
        const d = Math.round(Number(delta || 1));
        tickIdx = Math.max(0, tickIdx + d);
        if (inspectState) inspectState.tick = tickIdx;
        renderAllFrames(performance.now());
        return tickIdx;
      },
      listPoses() {
        return ALL_POSE_KEYS.slice();
      },
      poke(id = 'cat') {
        const target = actors[id] || actors.cat;
        triggerPoke(target, false);
      },
      feed(id = 'cat', item = 'donut') {
        const target = actors[id] || actors.cat;
        return feedActor(target, item);
      },
      setHabitatPreview(mode = 'auto') {
        habitatPreview = ['auto', 'cactus', 'lamp', 'hourglass'].includes(mode) ? mode : 'auto';
        renderHabitatProp(true);
        return resolveHabitatMode();
      },
      onUserType(text = '') {
        const now = performance.now();
        markActivity();
        const leader = camp === 'claude' ? actors.clawd : actors.cat;
        const trimmed = String(text || '').replace(/\s+$/, '');
        if (/[?？]$/.test(trimmed)) {
          startClip(leader, 'tilt', 750, { rot: -9, sym: 'q' });
        } else if (/[!！]$/.test(trimmed)) {
          startClip(leader, 'wow', 700, { sym: 'bang' });
        } else {
          leader.nodY = PX; // 打字点头：整格下沉 1 格
          leader.nodUntil = now + 140;
          leader.eyeScan = 0;
          clearTimeout(pauseTimer);
          pauseTimer = setTimeout(() => {
            if (disposed) return;
            leader.eyeScan = tickIdx % 2 ? -1 : 1;
            renderAllFrames(performance.now());
            later(500, () => {
              leader.eyeScan = 0;
            });
          }, 450);
        }
        renderAllFrames(now);
      },
      setRimLight(n = null) {
        if (disposed) return;
        const on = Boolean(n && n.active && Number(n.strength) > 0.015);
        const x = on ? Number(n.localX) || 0 : -9999;
        const s = on ? Math.max(0, Math.min(1, Number(n.strength) || 0)) : 0;
        const t = on && RIM_PALS[n.toneKey] ? n.toneKey : 'default';
        const d = on ? n.dark !== false : true;
        const sig = on ? `1|${Math.round(x / 6)}|${Math.round(s * 12)}|${t}|${d ? 1 : 0}` : '0';
        if (sig === rimSig) return;
        rimSig = sig;
        rim.on = on;
        rim.x = x;
        rim.s = s;
        rim.t = t;
        rim.d = d;
        if (!isVramSleepState() && !isWindowBlurred()) renderAllFrames(performance.now());
      },
      getLayoutSnapshot() {
        const now = performance.now();
        return {
          camp,
          miniPileEnabled,
          reducedMotion,
          // 生态联动与按需渲染遥测只读诊断
          dozing,
          orchestrator,
          rimLight: { active: rim.on, strength: Math.round(rim.s * 100) / 100, toneKey: rim.t },
          habitat: {
            mode: resolveHabitatMode(),
            scheduleActive: Date.now() < scheduleWatchUntil,
          },
          towers: listAllTowers(),
          chromaResonance: {
            active: prismaticCoat,
            tuned: chromaGates.tuned,
            forged: chromaGates.forged,
            sparkCount: chromaSparks.length,
          },
          perf: {
            timerIntervalMs: currentTickMs,
            timerPaused: isHostDetached() || parked || isWindowBlurred() || isHostSleeping() || currentTickMs === 0,
            vramReclaimed,
            canvasDraws: perfStats.canvasDraws,
            canvasSkips: perfStats.canvasSkips,
            domTransformWrites: perfStats.domTransformWrites,
            domTransformSkips: perfStats.domTransformSkips,
          },
          lastInteraction: { ...lastInteraction },
          minis: miniCrabs.map((mc) => ({
            id: mc.id,
            act: mc.act && tickIdx >= mc.act.start ? mc.act.type : null,
            x: Math.round(mc.lastX),
            y: Math.round(mc.stackedOn ? computeWorldFootY(mc) : mc.y || 0),
            worldCx: Math.round(getEntWorldCx(mc)),
            dir: mc.dir,
            stackedOn: mc.stackedOn,
            leap: Boolean(mc.leap),
          })),
          actors: ['cat', 'clawd'].map((id) => {
            const a = actors[id];
            const rect = a.el ? a.el.getBoundingClientRect() : null;
            const fx = a.lastFx || {};
            return {
              id,
              x: a.x,
              y: a.y,
              footY: Math.round(computeWorldFootY(a)),
              worldCx: Math.round(getEntWorldCx(a)),
              pose: resolvePoseFor(a, now),
              sym: a.sym && now < a.symUntil ? a.sym : null,
              rot: effectiveRot(a, now),
              pokeCount: a.pokeCount,
              stackedOn: a.stackedOn,
              leap: Boolean(a.leap),
              rect: rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null,
              // 附加诊断字段（只读）：整数格挤压量、待机微动作与静止帧缓存快照
              squash: a.lastSq ? { ...a.lastSq } : { w: 0, h: 0 },
              blinkStage: fx.blinkStage || null,
              breath: Boolean(fx.breath),
              earTwitch: fx.earTwitch || null,
              clawSnap: fx.clawSnap || null,
              glance: fx.glance || 0,
              tick: tickIdx,
              renderCache: {
                poseKey: a.lastRender.poseKey,
                frameIdx: a.lastRender.frameIdx,
                flip: a.lastRender.flip,
                tintState: a.lastRender.tintState,
                lastX: a.lastDomX,
                lastY: a.lastDomY,
                lastRot: a.lastRender.lastRot,
              },
            };
          }),
        };
      },
      park(on = true) {
        if (disposed) return;
        parked = Boolean(on);
        syncHeartbeat();
        if (parked) {
          reclaimStageVram();
        } else if (!isVramSleepState() && !isWindowBlurred()) {
          renderAllFrames(performance.now());
        }
      },
      resume() {
        if (disposed) return;
        parked = false;
        syncHeartbeat();
        if (!isVramSleepState() && !isWindowBlurred()) renderAllFrames(performance.now());
      },
      syncPowerState: syncPwr,
      dispose() {
        disposed = true;
        rim.on = false;
        rim.s = 0;
        rimSig = '0';
        for (const a of [actors.cat, actors.clawd]) {
          if (a) {
            a.dragging = false;
            a.ballisticActive = false;
            a.rot = 0;
          }
        }
        miniCrabs.forEach((mc) => {
          mc.dragging = false;
          mc.ballisticActive = false;
          mc.rot = 0;
        });
        syncMascotDragRootAttr();
        if (tickTimer !== null) {
          clearInterval(tickTimer);
          tickTimer = null;
        }
        currentTickMs = 0;
        if (dragRafId && cAF) {
          try { cAF(dragRafId); } catch (_) {}
          dragRafId = 0;
        }
        dragRafPending = false;
        if (resizeRaf && cAF) {
          try { cAF(resizeRaf); } catch (_) {}
          resizeRaf = 0;
        }
        clearTimeout(pauseTimer);
        clearTimeout(theaterTimer);
        pendingTimers.forEach((t) => clearTimeout(t));
        pendingTimers.clear();
        try {
          if (reducedMq && typeof reducedMq.removeEventListener === 'function') {
            reducedMq.removeEventListener('change', onReducedChange);
          } else if (reducedMq && typeof reducedMq.removeListener === 'function') {
            reducedMq.removeListener(onReducedChange);
          }
        } catch (_) {
          /* 忽略 */
        }
        pairCooldowns.clear();
        if (sanctuary) {
          try { sanctuary.dispose(); } catch (_) {}
          sanctuary = null;
        }
        try {
          reclaimStageVram();
          if (fxCanvas) { fxCanvas.width = 0; fxCanvas.height = 0; fxCanvas._ctx = null; }
          if (habitatCanvas) { habitatCanvas.width = 0; habitatCanvas.height = 0; habitatCanvas._ctx = null; }
          for (const a of [actors.cat, actors.clawd]) {
            if (a) a._ctx = null;
            if (a?.canvas) { a.canvas.width = 0; a.canvas.height = 0; a.canvas._ctx = null; }
            if (a?.canvas?.__agRotOff) { a.canvas.__agRotOff.width = 0; a.canvas.__agRotOff.height = 0; a.canvas.__agRotOff._ctx = null; a.canvas.__agRotOff = null; }
          }
          miniCrabs.forEach((mc) => { mc._ctx = null; if (mc.canvas) { mc.canvas.width = 0; mc.canvas.height = 0; mc.canvas._ctx = null; } });
        } catch (_) {}
        cleanups.forEach((fn) => fn());
        for (const node of [miniGroupEl, actors.cat.el, actors.clawd.el, fxCanvas, habitatCanvas]) {
          if (node) {
            if (typeof node.remove === 'function') node.remove();
            else if (node.parentNode && typeof node.parentNode.removeChild === 'function') {
              node.parentNode.removeChild(node);
            } else if (hostEl && typeof hostEl.removeChild === 'function') {
              try { hostEl.removeChild(node); } catch (_) {}
            }
          }
        }
      },
    };
  }

  return {
    PX,
    TICK,
    DOZE_TICK,
    OFFICIAL_OPEN_REF,
    PALETTES,
    CLAWD_PARTS,
    CAT_PARTS,
    MINI_SPRITES,
    MINI_ANIM_FRAMES,
    PROPS,
    SYMS,
    resolveClawdStandGrid,
    drawLayerSet,
    renderPixelLayers,
    buildClipLayers,
    classifyPairEncounter,
    stepMiniCrabCorridor,
    evalChromaColorAt,
    resolveGroundSeparation,
    chooseObstacleAction,
    mountDualMascotStage,
  };
});
