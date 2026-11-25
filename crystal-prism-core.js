(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.__agCrystalPrismCore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const PROXIMITY_RADIUS_PX = 105;

  // 近场光强非对称指数平滑时间常数（秒）：靠近快速点亮、离开缓慢复归纯白水晶
  const PROXIMITY_ATTACK_SEC = 0.045;
  const PROXIMITY_RELEASE_SEC = 0.28;
  // 「光学唤醒」冷白扫光时长（秒）
  const WAKE_DURATION_SEC = 0.7;

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  function resolveCrystalAccentCode(raw) {
    const k = String(raw || 'default').trim().toLowerCase();
    if (k === 'rainbow') return 6;
    if (k === 'mono' || k === 'monochrome') return 5;
    if (k === 'amber') return 4;
    if (k === 'iris') return 3;
    if (k === 'cobalt') return 2;
    if (k === 'warm' || k === 'claude' || k === 'alabaster') return 1;
    return 0;
  }

  const FALLBACK_SPECTRA = {
    0: ['#4c8df6', '#9b72cb', '#d96570', '#f2b84b'],
    1: ['#c25934', '#d97757', '#e59377', '#f6bd60'],
    2: ['#1d4ed8', '#3186ff', '#5cc6fc', '#8ce0ff'],
    3: ['#6d28d9', '#8b5cf6', '#a58af8', '#ddd6fe'],
    4: ['#b45309', '#d97706', '#f2b84b', '#fde68a'],
    5: ['#94a3b8', '#cbd5e1', '#e2e8f0', '#f8fafc'],
    6: ['#fb7185', '#fbbf24', '#34d399', '#38bdf8'],
  };

  /**
   * 计算鼠标局部坐标 (localX, localY) 到圆角胶囊轨道 [0..width, 0..height] 的光学近场权重 (0..1)。
   * 感应半径显著小于输入框大棱镜边框 (220px)，仅在靠近约 105px 内激活色散反应。
   */
  function computeProximityFactor(localX, localY, width, height, radius = PROXIMITY_RADIUS_PX) {
    if (!Number.isFinite(localX) || !Number.isFinite(localY) || localX < -2000 || localY < -2000) {
      return 0;
    }
    const w = Math.max(2, Number(width) || 0);
    const h = Math.max(2, Number(height) || 0);
    const r = Math.max(1, Number(radius) || PROXIMITY_RADIUS_PX);
    const capR = Math.min(w, h) * 0.5;
    const cx = localX - w * 0.5;
    const cy = localY - h * 0.5;
    const halfInnerW = Math.max(0, w * 0.5 - capR);
    const dx = Math.max(0, Math.abs(cx) - halfInnerW);
    const dy = Math.abs(cy);
    const dist = Math.hypot(dx, dy) - capR;

    if (dist <= 0) return 1;
    if (dist >= r) return 0;
    const u = 1 - dist / r;
    // 平滑二次 S 曲线，外缘自然收敛
    return u * u * (3 - 2 * u);
  }

  /**
   * 4 路星芒锚点（u, v 为左上原点的归一化坐标，着色器与 2D 降级共用同一份数据源）。
   * 主频取黄金比 / 无理数系（e/10、(3-√5)/2、√5/10、π/10），两两不可公度，永不进入同步节拍；
   * 再叠加一层缓慢的相位抖动（wobFreq / wobAmp），打破机械等距的闪烁节奏。
   */
  const GLINT_ANCHORS = [
    { u: 0.17, v: 0.30, freq: 0.2718282, phase: 0.15, wobFreq: 0.0713, wobAmp: 0.55, wobPhase: 0.4, scale: 1.0 },
    { u: 0.41, v: 0.64, freq: 0.3819660, phase: 1.72, wobFreq: 0.0527, wobAmp: 0.62, wobPhase: 2.1, scale: 0.92 },
    { u: 0.63, v: 0.32, freq: 0.2236068, phase: 3.29, wobFreq: 0.0891, wobAmp: 0.48, wobPhase: 4.3, scale: 1.05 },
    { u: 0.83, v: 0.62, freq: 0.3141593, phase: 4.86, wobFreq: 0.0618, wobAmp: 0.58, wobPhase: 5.6, scale: 0.88 },
  ];
  const REDUCED_GLINT_INTENSITY = [0, 0.42, 0.24, 0];
  const TWO_PI = Math.PI * 2;

  // 单路星芒强度（纯函数、零分配）
  function glintIntensityAt(a, t) {
    const wob = a.wobAmp * Math.sin(t * TWO_PI * a.wobFreq + a.wobPhase);
    const wave = Math.sin(t * TWO_PI * a.freq + a.phase + wob);
    return wave > 0 ? Math.pow(wave, 16) : 0;
  }

  /**
   * 零分配版本：把 4 路星芒强度写入调用方提供的定长缓冲（渲染循环每帧复用）。
   */
  function fillGlintIntensities(timeSec, reduceMotion, out) {
    if (reduceMotion) {
      for (let i = 0; i < 4; i++) out[i] = REDUCED_GLINT_INTENSITY[i];
      return out;
    }
    const t = Math.max(0, Number(timeSec) || 0);
    for (let i = 0; i < 4; i++) out[i] = glintIntensityAt(GLINT_ANCHORS[i], t);
    return out;
  }

  /**
   * 评估 4 路异步晶体顶点星芒微闪（避免整条跑马灯式扫描）。
   * 对外导出版本每次返回全新数组（语义安全，便于测试 deepEqual 比较）；渲染循环使用 fillGlintIntensities。
   */
  function evaluateDeterministicGlints(timeSec, reduceMotion = false) {
    const t = Math.max(0, Number(timeSec) || 0);
    return GLINT_ANCHORS.map((a, idx) => ({
      u: a.u,
      v: a.v,
      scale: a.scale,
      intensity: reduceMotion ? REDUCED_GLINT_INTENSITY[idx] : glintIntensityAt(a, t),
    }));
  }

  function createShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(sh) || 'shader compile error';
      gl.deleteShader(sh);
      throw new Error(err);
    }
    return sh;
  }

  const VS_SRC = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  const FS_SRC = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 u_res;         // CSS 像素尺寸
uniform float u_dpr;        // 设备像素比（用于 ~0.9px 刀锋棱线的设备级抗锯齿）
uniform float u_time;
uniform float u_dark;
uniform vec2 u_pointer;     // 相对胶囊中心的 CSS 坐标（y 轴朝上），远距为 (-9999,-9999)
uniform float u_proximity;  // 0..1，已乘 prismStrength 并经过非对称平滑
uniform float u_reduce;
uniform vec4 u_glints;      // 4 路异步星芒强度
uniform vec4 u_glintU;      // 星芒锚点 u（左原点）
uniform vec4 u_glintV;      // 星芒锚点 v（上原点）
uniform vec2 u_wake;        // x: 扫光中心（u 空间），y: 扫光包络强度（0 表示未激活）
uniform float u_accent;     // 0:default 1:warm 2:cobalt 3:iris 4:amber 5:mono
uniform float u_ambient;    // 0..1 环境氛围光缩放

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 网格空间 Voronoi：返回所在切面 id、最近棱所属邻面 id、最近棱的网格空间法线与距离
void facetVoronoi(vec2 p, out vec2 cellId, out vec2 nbId, out vec2 edgeN, out float edgeD) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  vec2 mg = vec2(0.0);
  vec2 mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = 0.12 + 0.76 * hash22(n + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
  }
  cellId = n + mg;
  nbId = cellId;
  edgeN = vec2(1.0, 0.0);
  edgeD = 8.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 o = 0.12 + 0.76 * hash22(n + g);
      vec2 r = g + o - f;
      vec2 dr = r - mr;
      if (dot(dr, dr) > 0.00001) {
        vec2 nn = normalize(dr);
        float d = dot(0.5 * (mr + r), nn);
        if (d < edgeD) { edgeD = d; edgeN = nn; nbId = n + g; }
      }
    }
  }
}

float sdCapsuleBox(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - (halfSize - vec2(radius));
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

float etchedLockMask(vec2 q, float halfStroke, float aa) {
  float dBody = abs(sdCapsuleBox(q - vec2(0.0, -2.65), vec2(3.6, 2.45), 1.2)) - halfStroke;
  vec2 qs = q - vec2(0.0, 1.5);
  float dShackle = (qs.y >= 0.0 ? abs(length(qs) - 2.25) : length(vec2(abs(qs.x) - 2.25, max(0.0, -0.2 - q.y)))) - halfStroke;
  float dKey = length(q - vec2(0.0, -2.55)) - 0.75;
  return 1.0 - smoothstep(-aa, aa, min(min(dBody, dShackle), dKey));
}

// 柯西四色光谱与强调色模式映射（0:四色 1:暖岩 2:钴蓝 3:鸢尾紫 4:琥珀金 5:纯银钛单色 6:彩虹渐变）
vec3 cauchySpectrum(float t, float accent) {
  float u = clamp(t, 0.0, 1.0);
  if (accent > 5.5) {
    float q = u * 4.0;
    vec3 r0 = vec3(0.984, 0.443, 0.522);
    vec3 r1 = vec3(0.984, 0.749, 0.141);
    vec3 r2 = vec3(0.204, 0.827, 0.600);
    vec3 r3 = vec3(0.220, 0.741, 0.973);
    vec3 r4 = vec3(0.659, 0.333, 0.969);
    if (q < 1.0) return mix(r0, r1, q);
    if (q < 2.0) return mix(r1, r2, q - 1.0);
    if (q < 3.0) return mix(r2, r3, q - 2.0);
    return mix(r3, r4, q - 3.0);
  }
  if (accent > 4.5) {
    return mix(vec3(0.760, 0.800, 0.865), vec3(0.975, 0.985, 1.010), u);
  }
  vec3 c0 = vec3(0.298, 0.553, 0.965);
  vec3 c1 = vec3(0.608, 0.447, 0.796);
  vec3 c2 = vec3(0.851, 0.396, 0.439);
  vec3 c3 = vec3(0.949, 0.722, 0.294);
  if (accent > 3.5) {
    c0 = vec3(0.706, 0.325, 0.035);
    c1 = vec3(0.851, 0.467, 0.024);
    c2 = vec3(0.949, 0.722, 0.294);
    c3 = vec3(0.992, 0.902, 0.541);
  } else if (accent > 2.5) {
    c0 = vec3(0.427, 0.157, 0.851);
    c1 = vec3(0.545, 0.361, 0.965);
    c2 = vec3(0.647, 0.541, 0.973);
    c3 = vec3(0.867, 0.839, 0.996);
  } else if (accent > 1.5) {
    c0 = vec3(0.114, 0.306, 0.847);
    c1 = vec3(0.192, 0.525, 1.000);
    c2 = vec3(0.361, 0.776, 0.988);
    c3 = vec3(0.549, 0.878, 1.000);
  } else if (accent > 0.5) {
    c0 = vec3(0.761, 0.349, 0.204);
    c1 = vec3(0.851, 0.467, 0.341);
    c2 = vec3(0.898, 0.576, 0.467);
    c3 = vec3(0.965, 0.741, 0.376);
  }
  float s = u * 3.0;
  if (s < 1.0) return mix(c0, c1, s);
  if (s < 2.0) return mix(c1, c2, s - 1.0);
  return mix(c2, c3, s - 2.0);
}

// 冰透明度梯度色带：TIR 暗渊 -> 冷钢灰 -> 冰透银白 -> 刀锋纯白
vec3 iceRamp(float l, float isDark) {
  vec3 abyss = isDark > 0.5 ? vec3(0.036, 0.036, 0.044) : vec3(0.25, 0.28, 0.34);
  vec3 steel = isDark > 0.5 ? vec3(0.38, 0.43, 0.53) : vec3(0.63, 0.69, 0.78);
  vec3 ice   = isDark > 0.5 ? vec3(0.84, 0.88, 0.95) : vec3(0.90, 0.93, 0.975);
  vec3 white = vec3(1.02, 1.03, 1.05);
  l = clamp(l, 0.0, 1.2);
  if (l < 0.42) return mix(abyss, steel, smoothstep(0.0, 0.42, l));
  if (l < 0.85) return mix(steel, ice, smoothstep(0.42, 0.85, l));
  return mix(ice, white, clamp((l - 0.85) / 0.35, 0.0, 1.0));
}

void main() {
  vec2 cssRes = max(u_res, vec2(4.0));
  vec2 px = (vUv - 0.5) * cssRes;           // 中心原点，y 轴朝上
  vec2 halfSize = cssRes * 0.5;
  float capR = min(halfSize.x, halfSize.y);
  float dpr = max(1.0, u_dpr);
  float isDark = u_dark;

  float sdf = sdCapsuleBox(px, halfSize, capR);
  float alphaMask = clamp(0.5 - sdf * dpr, 0.0, 1.0);
  if (alphaMask < 0.002) {
    fragColor = vec4(0.0);
    return;
  }
  float rimD = max(0.0, -sdf);              // 到胶囊外缘的 CSS 像素距离

  // ── 1. 各向异性 Voronoi 大切面（横向拉伸 ~2.25 倍，全条约 9~13 块长条切面） ──
  float ch = cssRes.y * 0.66;
  float cw = ch * 2.2;
  float sh = 0.38;                           // 轻微错切，避免切面与轴线对齐
  vec2 gp = vec2(px.x / cw + (px.y / ch) * sh, px.y / ch) + vec2(3.17, 1.41);
  vec2 cellId; vec2 nbId; vec2 edgeNg; float edgeDg;
  facetVoronoi(gp, cellId, nbId, edgeNg, edgeDg);
  // 网格空间 -> 像素空间：d_px = d_grid / |A^T n|
  vec2 edgeNpx = vec2(edgeNg.x / cw, edgeNg.x * sh / ch + edgeNg.y / ch);
  float edgeScale = max(length(edgeNpx), 1e-5);
  float pxD = edgeDg / edgeScale;
  vec2 nE = edgeNpx / edgeScale;             // 指向邻面的像素空间棱法线

  float h1 = hash21(cellId);
  float h2 = hash21(cellId + vec2(17.3, 9.1));
  float h3 = hash21(cellId + vec2(5.7, 31.4));

  // ── 2. 宏观主光：一整块切割水晶的明暗梯度（上冠面亮银带、中部清透、下亭部 TIR 暗渊） ──
  float yN = clamp(px.y / max(1.0, halfSize.y), -1.0, 1.0);
  float cylEnd = clamp((abs(px.x) - (halfSize.x - capR)) / max(1.0, capR), 0.0, 1.0);
  vec3 Nrod = vec3(sign(px.x) * cylEnd * 0.55, yN * 0.62, 1.0);
  vec2 tilt = vec2((h1 - 0.5) * 1.10, (h2 - 0.5) * 0.70);
  vec3 N = normalize(Nrod + vec3(tilt, 0.0));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 Lk = normalize(vec3(-0.38, 0.62, 0.68));   // 左上主光
  vec3 Hk = normalize(Lk + V);
  vec3 refrDir = refract(-V, N, 1.0 / 1.54);

  float crown = smoothstep(-0.20, 0.80, yN);
  float pav = smoothstep(-0.15, -0.95, yN);
  float facing = dot(N, Lk);
  float lit = clamp((facing - 0.62) * 2.6, -1.0, 1.0);

  // 透射内景：每块切面经斯涅尔折射看到同一片平滑内部光带的不同错位（连贯而非随机马赛克）
  float interior = sin((px.x + refrDir.x * 42.0) * 0.040 + (px.y + refrDir.y * 30.0) * 0.11 + 1.3);

  float lum = 0.48 + 0.34 * crown + 0.30 * lit + 0.09 * interior - 0.10 * pav;

  // 冠面上缘冷白反光带（棚拍顶灯在上弧面的长条映像）
  float crownBand = exp(-pow((yN - 0.58) / 0.20, 2.0));
  lum += crownBand * (0.20 + 0.12 * lit);

  // 下亭部全内反射暗渊：只落在少数朝向背光的下部切面上，面积克制
  float tirSel = smoothstep(0.50, 0.85, h3) * smoothstep(0.15, -0.35, lit + 0.2 * crown);
  float tir = clamp(pav * (0.30 + 0.75 * tirSel), 0.0, 1.0);
  lum = mix(lum, lum * 0.10, tir * (isDark > 0.5 ? 0.92 : 0.70));

  vec3 col = iceRamp(lum, isDark);
  // 中部清透区：随强调色自适应透射底韵（mono 为纯银灰透射，零彩色残留）
  float clearZone = (1.0 - crown) * (1.0 - pav) * smoothstep(0.30, 0.70, lum);
  vec3 clearTint = u_accent > 4.5
    ? vec3(0.84, 0.87, 0.92)
    : (u_accent > 0.5 ? mix(vec3(0.82, 0.85, 0.90), cauchySpectrum(0.55, u_accent), 0.55) : vec3(0.72, 0.82, 0.97));
  col = mix(col, clearTint * (0.55 + 0.5 * lum), clearZone * (isDark > 0.5 ? 0.22 : 0.16) * (0.35 + 0.65 * u_ambient));

  // 朝向棚灯的切面：整面冰白镜面反光
  float facetSpec = pow(max(dot(N, Hk), 0.0), 38.0);
  col += vec3(0.92, 0.95, 1.0) * facetSpec * (isDark > 0.5 ? 0.55 : 0.35);

  // ── 3. 仅 2~3 条内部斜棱带：约 15% 折光（随 u_accent & u_ambient 联动） ──
  if (u_ambient > 0.01) {
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float cx = (k == 0 ? 0.27 : (k == 1 ? 0.555 : 0.775)) - 0.5;
      float strength = (k == 0 ? 1.0 : (k == 1 ? 0.78 : 0.56)) * u_ambient;
      float d = (px.x + refrDir.x * 16.0) - cx * cssRes.x - px.y * (0.80 + 0.12 * fk);
      float band = exp(-d * d / 4.5);
      float vfade = 1.0 - smoothstep(0.55, 0.95, abs(yN));
      vec3 tint = u_accent > 4.5
        ? vec3(0.86, 0.89, 0.94)
        : (u_accent > 0.5
          ? cauchySpectrum(d < 0.0 ? 0.28 : 0.72, u_accent)
          : (d < 0.0 ? vec3(0.50, 0.68, 1.00) : vec3(0.68, 0.58, 0.98)));
      col = mix(col, tint * (0.62 + 0.40 * clamp(lum, 0.0, 1.0)), 0.15 * band * vfade * strength);
      // 斜棱带中心极细的冷白折光脊
      col += vec3(0.86, 0.90, 0.98) * exp(-d * d / 0.45) * vfade * strength * 0.10;
    }
  }

  // ── 4. 刀锋菲涅尔棱线：亮度由「棱面法线 · 主光」与边缘 Fresnel 调制，只有朝光的棱亮起 ──
  vec3 Nb = normalize(vec3(nE * 0.45, 0.89) + vec3(Nrod.xy * 0.12, 0.0));
  float ridgeSpec = pow(max(dot(Nb, Hk), 0.0), 12.0);
  float fresMacro = 0.55 + 0.45 * pow(abs(yN), 2.0);
  float edgeHash = hash21(cellId + nbId);   // 对称哈希：同一条棱两侧一致
  float edgeGain = mix(0.18, 1.0, step(0.32, edgeHash));
  float aaPx = 0.6 / dpr;
  float blade = 1.0 - smoothstep(0.9 - aaPx, 0.9 + aaPx, pxD);
  float hair = 1.0 - smoothstep(0.0, 0.55 + aaPx, pxD);
  col += vec3(0.96, 0.98, 1.0) * blade * ridgeSpec * edgeGain * fresMacro * (isDark > 0.5 ? 1.55 : 1.10);
  // 背光棱：几乎不可见的暗细缝
  col *= 1.0 - hair * (1.0 - ridgeSpec) * edgeGain * (isDark > 0.5 ? 0.20 : 0.12);

  // ── 5. 近场追光 + 柯西四色色散火彩（约 105px 半径） ──
  if (u_proximity > 0.004) {
    vec2 dp = px - u_pointer;
    float spotR = max(cssRes.y * 3.0, 84.0);
    float spot = pow(1.0 - smoothstep(0.0, spotR, length(dp * vec2(0.85, 1.2))), 1.5);
    float react = u_proximity * (0.22 + 0.78 * spot);
    vec3 Lp = normalize(vec3(-dp, capR * 2.6));
    vec3 Hp = normalize(Lp + V);

    // 追光：切面整体提亮成冰白
    float pSpec = pow(max(dot(N, Hp), 0.0), 26.0);
    col += vec3(0.94, 0.97, 1.0) * (pSpec * 0.42 + spot * 0.10) * react;

    // 切面火彩：随 u_accent 呈现对应色散（mono 下收敛为纯银白切面微光）
    float fireT = fract(h1 * 1.7 + dot(N.xy, Lp.xy) * 1.4 + 0.2);
    float fireMask = smoothstep(0.60, 0.95, dot(N, Lp)) * (0.30 + 0.70 * h2);
    vec3 fire = cauchySpectrum(fireT, u_accent);
    float fireAmt = u_accent > 4.5 ? 0.18 : 0.38;
    col = mix(col, col * mix(vec3(1.0), fire * 1.55, 0.40), fireMask * react * fireAmt);

    // 棱线分光：朝向指针光的棱在棱外侧展开极窄色散带（mono 下关闭彩色色散，仅留刀锋纯白亮棱）
    float eLit = pow(max(dot(Nb, Hp), 0.0), 9.0) * edgeGain;
    float fringeT = (pxD - 0.55) / 2.2;
    float fringeMask = smoothstep(0.0, 0.12, fringeT) * (1.0 - smoothstep(0.82, 1.0, fringeT));
    float dispScale = u_accent > 4.5 ? 0.25 : 1.0;
    col += cauchySpectrum(fringeT, u_accent) * fringeMask * eLit * react * dispScale * (0.6 + 0.8 * spot) * (isDark > 0.5 ? 1.70 : 1.25);
    col += vec3(1.0) * blade * eLit * react * 0.55;
  }

  // ── 6. 4 路异步冷白十字星芒（尖端 1px 级分光，受 u_ambient 调制） ──
  for (int i = 0; i < 4; i++) {
    float gi = u_glints[i] * u_ambient;
    if (gi > 0.01) {
      vec2 anchor = vec2((u_glintU[i] - 0.5) * cssRes.x, (0.5 - u_glintV[i]) * cssRes.y);
      vec2 g = px - anchor;
      float cs = 0.956, sn = 0.292;
      vec2 rg = vec2(g.x * cs - g.y * sn, g.x * sn + g.y * cs);
      float sx = abs(rg.x);
      float sy = abs(rg.y);
      float spikeX = exp(-rg.y * rg.y * 2.4) * exp(-sx * 0.24);
      float spikeY = exp(-rg.x * rg.x * 2.4) * exp(-sy * 0.40);
      float core = exp(-dot(g, g) * 0.42) + exp(-length(g) * 0.55) * 0.30;
      float tipMix = u_accent > 4.5 ? 0.0 : 0.70;
      vec3 tipX = mix(vec3(1.0), cauchySpectrum(fract(sx * 0.085 + float(i) * 0.23), u_accent) * 1.25, smoothstep(2.5, 7.0, sx) * tipMix);
      vec3 tipY = mix(vec3(1.0), cauchySpectrum(fract(sy * 0.120 + float(i) * 0.31), u_accent) * 1.25, smoothstep(2.0, 5.0, sy) * tipMix);
      vec3 star = vec3(0.96, 0.98, 1.0) * core * 1.20 + tipX * spikeX * 0.78 + tipY * spikeY * 0.62;
      col += star * gi * (isDark > 0.5 ? 1.15 : 0.80);
    }
  }

  // ── 7. 光学唤醒：一次从左到右的冷白斜向扫光 ──
  if (u_wake.y > 0.001) {
    float sxPos = (u_wake.x - 0.5) * cssRes.x;
    float d = px.x - sxPos - px.y * 0.55;
    float sweep = exp(-d * d / 60.0) * 0.55 + exp(-d * d / 1.6) * 0.80;
    col += vec3(0.90, 0.95, 1.0) * sweep * u_wake.y;
  }

  // ── 8. 胶囊外缘：厚玻璃侧壁暗化 + 朝光菲涅尔亮缘（Light 主题外加 0.8px 冷钛灰棱线） ──
  vec2 rimN = normalize(vec2(sign(px.x) * max(0.0, abs(px.x) - (halfSize.x - capR)), px.y) + vec2(0.0001));
  float rimLit = 0.20 + 0.80 * smoothstep(-0.3, 0.85, dot(rimN, normalize(Lk.xy)));
  float wallShade = 1.0 - smoothstep(0.0, 3.2, rimD);
  float rimLine = 1.0 - smoothstep(0.9, 1.9, rimD);
  if (isDark > 0.5) {
    col *= 1.0 - wallShade * 0.38;
    col += vec3(0.90, 0.94, 1.0) * rimLine * rimLit * 0.55;
  } else {
    col *= 1.0 - wallShade * 0.20;
    col += vec3(1.0) * (1.0 - smoothstep(1.0, 2.2, rimD)) * smoothstep(0.6, 1.1, rimD) * rimLit * 0.40;
    float tiLine = 1.0 - smoothstep(0.8 - aaPx, 0.8 + aaPx, rimD);
    col = mix(col, vec3(0.47, 0.52, 0.59), tiLine * 0.88);
  }

  // ── 9. 可调滑块模式：右侧凹陷「晶床原胚 + 轻液态母液」 × 左侧长出的高光泽切割水晶 ──
  if (u_reduce > 1.5) {
    float fillU = clamp(u_reduce > 3.5 ? (u_reduce - 4.0) : (u_reduce - 2.0), 0.0, 1.0);
    float actMask = 1.0 - smoothstep(fillU - 0.012, fillU + 0.012, vUv.x);
    vec3 specTint = u_accent > 4.5
      ? vec3(0.90, 0.95, 1.0)
      : cauchySpectrum(clamp(vUv.x * 0.82 + 0.08, 0.0, 1.0), u_accent);

    // 右侧未激活段：凹陷晶床原胚底槽（非纯黑）+ 轻微类液体待结晶母液流动
    float topShadow = smoothstep(0.14, 0.96, yN);
    float wallShadow = 1.0 - smoothstep(0.0, 5.2, rimD);
    float botBevel = exp(-pow((yN + 0.86) / 0.14, 2.0));
    float knobCast = exp(-pow(max(0.0, vUv.x - fillU) / 0.065, 2.0));
    float bedWire = (1.0 - smoothstep(0.0, 1.15 + aaPx, pxD)) * (0.30 + 0.50 * edgeGain);
    float tLiq = u_reduce > 3.5 ? 0.0 : u_time * 0.65;
    float w1 = sin(px.x * 0.056 - tLiq * 1.15 + sin(px.y * 0.16 + tLiq * 0.72) * 1.35);
    float w2 = sin(px.x * 0.094 + px.y * 0.13 + tLiq * 0.84 + h1 * 1.5);
    float liqFlow = 0.5 + 0.5 * (w1 * 0.58 + w2 * 0.42);
    float liqCaustic = pow(clamp(liqFlow, 0.0, 1.0), 2.8);
    float liqBand = exp(-pow((yN + 0.10 - 0.16 * sin(px.x * 0.044 - tLiq)) / 0.48, 2.0));
    float liqAmp = (0.32 + 0.68 * u_ambient);
    vec3 liqTint = mix(vec3(0.36, 0.52, 0.82), specTint, u_accent > 4.5 ? 0.15 : 0.42);
    vec3 grooveCol;
    if (isDark > 0.5) {
      // 深冷岩曜石凹槽（保留透气蓝灰基调，告别死黑）+ 晶床原胚斜切微刻痕
      grooveCol = mix(vec3(0.092, 0.108, 0.152), vec3(0.040, 0.048, 0.072), topShadow * 0.86);
      grooveCol += vec3(0.030, 0.036, 0.054) * (h1 - 0.5);
      grooveCol += vec3(0.28, 0.36, 0.52) * bedWire * (0.20 + 0.24 * liqFlow) * (1.0 - topShadow * 0.45);
      // 轻柔慢流的类液体待结晶母液光晕 + 凹槽下唇倒角微光
      grooveCol += liqTint * (liqCaustic * 0.22 + liqFlow * 0.07) * liqBand * liqAmp;
      grooveCol *= 1.0 - wallShadow * 0.48;
      grooveCol *= 1.0 - knobCast * 0.52;
      grooveCol += vec3(0.28, 0.35, 0.48) * botBevel * 0.24 * (1.0 - knobCast * 0.68);
    } else {
      grooveCol = mix(vec3(0.75, 0.79, 0.87), vec3(0.58, 0.64, 0.74), topShadow * 0.78);
      grooveCol += vec3(0.035) * (h1 - 0.5);
      grooveCol -= vec3(0.10, 0.12, 0.16) * bedWire * 0.24;
      grooveCol += mix(vec3(0.88, 0.94, 1.0), liqTint, 0.35) * liqCaustic * liqBand * 0.18 * liqAmp;
      grooveCol *= 1.0 - wallShadow * 0.20;
      grooveCol *= 1.0 - knobCast * 0.24;
      grooveCol += vec3(1.0) * botBevel * 0.28;
    }

    // 左侧已激活段：凸起长出的高光泽切割水晶（立体切面 + 锐利玻璃高光丝 + 充能光谱）
    float eBoost = 0.25 + 0.75 * fillU;
    float glossMul = isDark > 0.5 ? 1.0 : 0.72;
    vec3 actCol = pow(max(col, vec3(0.0)), vec3(1.06)) * (isDark > 0.5 ? 1.08 : 1.02);
    float topBroad = exp(-pow((yN - 0.52 - N.x * 0.14) / 0.14, 2.0));
    float topKnife = exp(-pow((yN - 0.65 - N.x * 0.07) / 0.036, 2.0));
    float botBounce = exp(-pow((yN + 0.72 - N.x * 0.06) / 0.085, 2.0));
    actCol += vec3(0.96, 0.985, 1.0) * (topBroad * 0.14 + topKnife * 0.38) * glossMul;
    actCol += mix(vec3(0.72, 0.86, 1.0), specTint, 0.50) * botBounce * 0.26 * eBoost * glossMul;
    actCol += vec3(0.98, 0.99, 1.0) * blade * ridgeSpec * edgeGain * (isDark > 0.5 ? 0.68 : 0.44);
    actCol += specTint * (0.10 + 0.16 * eBoost) * (0.40 + 0.60 * crown) * (0.35 + 0.65 * u_ambient) * glossMul;
    float seam = exp(-pow(max(0.0, fillU - vUv.x) / 0.07, 2.0)) * actMask;
    actCol += mix(vec3(0.90, 0.96, 1.0), specTint, 0.42) * seam * (isDark > 0.5 ? 0.26 : 0.16);

    col = mix(grooveCol, actCol, actMask);
  }

  // Reinhard 色调映射（压缩系数 0.12，保住高光峰值）
  col = max(col, vec3(0.0));
  col = col / (1.0 + col * 0.12);

  // Inner-wall laser-etched lock mark (zero-copy single WebGL2 pass, no 2D canvas blit)
  vec2 lockCenter = vec2(halfSize.x - 15.5, 0.0);
  if (u_reduce < 1.5 && abs(px.x - lockCenter.x) < 6.5 && abs(px.y) < 7.2) {
    float lockAa = max(0.35, 0.68 / dpr);
    float shMask = etchedLockMask(px - (lockCenter + vec2(0.6, -0.8)), 0.625, lockAa);
    vec3 shCol = isDark > 0.5 ? vec3(0.024, 0.031, 0.063) : vec3(0.094, 0.133, 0.227);
    col = mix(col, shCol, shMask * (isDark > 0.5 ? 0.56 : 0.20));
    float etMask = etchedLockMask(px - lockCenter, 0.525, lockAa);
    vec3 etCol = isDark > 0.5 ? vec3(0.933, 0.961, 1.0) : vec3(0.149, 0.188, 0.282);
    float etAlpha = isDark > 0.5 ? (0.54 + u_proximity * 0.28) : (0.50 + u_proximity * 0.224);
    col = mix(col, etCol, clamp(etMask * etAlpha, 0.0, 1.0));
  }

  // ±1/255 屏幕空间噪声 dither，防止平滑梯度色带
  col += (hash21(gl_FragCoord.xy + vec2(17.0, 59.0)) - 0.5) * (2.0 / 255.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * alphaMask, alphaMask);
}`;

  /**
   * 胶囊内壁激光微蚀刻锁印记（磨砂半透明，无任何背景圆球，直接镂刻于右侧晶体内）
   */
  function drawLaserEtchedLock(ctx, cssW, cssH, isDark, proximityFactor) {
    const cx = cssW - 15.5;
    const cy = cssH * 0.5;
    const boost = proximityFactor * 0.28;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawLockPath = (ox, oy) => {
      ctx.beginPath();
      // 锁环拱门
      ctx.arc(cx + ox, cy - 1.5 + oy, 2.25, Math.PI, 0, false);
      ctx.lineTo(cx + 2.25 + ox, cy + 0.2 + oy);
      ctx.moveTo(cx - 2.25 + ox, cy - 1.5 + oy);
      ctx.lineTo(cx - 2.25 + ox, cy + 0.2 + oy);
      // 锁体细框
      ctx.roundRect(cx - 3.6 + ox, cy + 0.2 + oy, 7.2, 4.9, 1.2);
      ctx.stroke();
      // 微缩锁芯刻痕
      ctx.beginPath();
      ctx.arc(cx + ox, cy + 2.55 + oy, 0.75, 0, Math.PI * 2);
      ctx.fill();
    };

    // 内壁微暗折射投影层
    ctx.strokeStyle = isDark ? 'rgba(6, 8, 16, 0.56)' : 'rgba(24, 34, 58, 0.20)';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 1.25;
    drawLockPath(0.6, 0.8);

    // 激光磨砂银白刻蚀主线
    ctx.strokeStyle = isDark
      ? `rgba(238, 245, 255, ${(0.54 + boost).toFixed(3)})`
      : `rgba(38, 48, 72, ${(0.50 + boost * 0.8).toFixed(3)})`;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 1.05;
    drawLockPath(0, 0);

    ctx.restore();
  }

  /**
   * 2D 降级切面绘制（无 WebGL2 时）：更少更大的斜切长切面 + 全局明暗梯度 + 仅朝光棱亮起。
   */
  function drawFallback2D(ctx, cssW, cssH, isDark, pointerLocal, proximityFactor, glintIntensities, wakeU, wakeAmp, accentCode = 0, ambientScale = 1, sliderFillRatio = -1) {
    const r = cssH * 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, cssW, cssH, r);
    ctx.clip();

    // 全局明暗梯度：上冠面亮银白 -> 中部清透 -> 下亭部 TIR 暗渊
    const baseGrad = ctx.createLinearGradient(0, 0, 0, cssH);
    if (isDark) {
      baseGrad.addColorStop(0, '#c4ccd8');
      baseGrad.addColorStop(0.22, '#dfe5ee');
      baseGrad.addColorStop(0.55, '#8d97a8');
      baseGrad.addColorStop(0.85, '#2a2e37');
      baseGrad.addColorStop(1, '#0b0b0e');
    } else {
      baseGrad.addColorStop(0, '#e9eef5');
      baseGrad.addColorStop(0.22, '#f7f9fc');
      baseGrad.addColorStop(0.55, '#c9d1dd');
      baseGrad.addColorStop(1, '#5d6778');
    }
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, cssW, cssH);

    // 确定性斜切长切面：每列一条斜分割线，约 10~12 块
    const cols = Math.max(4, Math.round(cssW / 52));
    const xs = [];
    for (let i = 0; i <= cols; i++) {
      const jitter = i === 0 || i === cols ? 0 : Math.sin(i * 4.7) * 0.18;
      xs.push(((i + jitter) / cols) * cssW);
    }
    const spectrum = FALLBACK_SPECTRA[accentCode] || FALLBACK_SPECTRA[0];
    const lightDirX = -0.53;
    const lightDirY = -0.85;
    const edges = [];

    const facetPoly = (pts, idx, lowerHalf) => {
      const shade = 0.5 + 0.5 * Math.sin(idx * 2.37 + 0.8);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
      ctx.closePath();
      if (shade > 0.55) {
        ctx.fillStyle = `rgba(255, 255, 255, ${((shade - 0.55) * (isDark ? 0.42 : 0.5)).toFixed(3)})`;
      } else {
        const a = (0.55 - shade) * (lowerHalf ? (isDark ? 0.9 : 0.42) : isDark ? 0.32 : 0.16);
        ctx.fillStyle = isDark ? `rgba(9, 9, 11, ${a.toFixed(3)})` : `rgba(40, 50, 70, ${a.toFixed(3)})`;
      }
      ctx.fill();

      if (pointerLocal.x > -2000 && proximityFactor > 0.02) {
        let cx = 0;
        let cy = 0;
        for (const p of pts) {
          cx += p[0];
          cy += p[1];
        }
        cx /= pts.length;
        cy /= pts.length;
        const spot = proximityFactor * Math.max(0, 1 - Math.hypot(cx - pointerLocal.x, cy - pointerLocal.y) / 95);
        if (spot > 0.05) {
          ctx.save();
          ctx.globalAlpha = spot * 0.22;
          ctx.fillStyle = spectrum[idx % spectrum.length];
          ctx.fill();
          ctx.restore();
        }
      }
    };

    let fIdx = 0;
    for (let i = 0; i < cols; i++) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      const midA = cssH * (0.38 + 0.24 * (0.5 + 0.5 * Math.sin(i * 3.1 + 1.2)));
      const midB = cssH * (0.38 + 0.24 * (0.5 + 0.5 * Math.sin((i + 1) * 3.1 + 1.2)));
      const slant = cssH * 0.35;
      facetPoly([[x0 + slant, 0], [x1 + slant, 0], [x1, midB], [x0, midA]], fIdx++, false);
      facetPoly([[x0, midA], [x1, midB], [x1 - slant, cssH], [x0 - slant, cssH]], fIdx++, true);
      edges.push([x0, midA, x1, midB]);
      edges.push([x0 + slant, 0, x0, midA]);
      edges.push([x0, midA, x0 - slant, cssH]);
    }

    // 棱线：仅朝向主光的棱亮出 ~0.9px 刀锋，其余为几乎不可见的暗细缝
    for (let e = 0; e < edges.length; e++) {
      const [ax, ay, bx, by] = edges[e];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / len;
      const ny = (bx - ax) / len;
      const facingLight = Math.abs(nx * lightDirX + ny * lightDirY);
      const sel = 0.5 + 0.5 * Math.sin(e * 5.13 + 0.7);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      if (facingLight * sel > 0.42) {
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = `rgba(250, 252, 255, ${(0.35 + 0.5 * facingLight * sel).toFixed(3)})`;
      } else {
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = isDark ? 'rgba(9, 9, 11, 0.16)' : 'rgba(60, 70, 90, 0.10)';
      }
      ctx.stroke();
    }

    // 2 条内部斜棱带（随 accentCode 与 ambientScale 联动）
    if (ambientScale > 0.01) {
      ctx.lineWidth = 1.6;
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = 0.14 * ambientScale;
      [0.27, 0.555].forEach((u, k) => {
        const x = u * cssW;
        ctx.strokeStyle = accentCode === 5 ? '#e2e8f0' : spectrum[k === 0 ? 0 : 1];
        ctx.beginPath();
        ctx.moveTo(x + cssH * 0.4, 2);
        ctx.lineTo(x - cssH * 0.4, cssH - 2);
        ctx.stroke();
      });
      ctx.globalAlpha = prevAlpha;
    }

    // 近场追光柔斑
    if (pointerLocal.x > -2000 && proximityFactor > 0.02) {
      const g = ctx.createRadialGradient(pointerLocal.x, pointerLocal.y, 0, pointerLocal.x, pointerLocal.y, 70);
      g.addColorStop(0, `rgba(240, 246, 255, ${(0.28 * proximityFactor).toFixed(3)})`);
      g.addColorStop(1, 'rgba(240, 246, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cssW, cssH);
    }

    // 唤醒扫光
    if (wakeAmp > 0.001) {
      const sx = wakeU * cssW;
      const g = ctx.createLinearGradient(sx - 16, 0, sx + 16, 0);
      g.addColorStop(0, 'rgba(235, 244, 255, 0)');
      g.addColorStop(0.5, `rgba(235, 244, 255, ${(0.55 * wakeAmp).toFixed(3)})`);
      g.addColorStop(1, 'rgba(235, 244, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cssW, cssH);
    }

    // 异步星芒（尖端微分光，受 ambientScale 调制）
    for (let i = 0; i < 4; i++) {
      const inten = glintIntensities[i] * ambientScale;
      if (inten <= 0.05) continue;
      const a = GLINT_ANCHORS[i];
      const gx = a.u * cssW;
      const gy = a.v * cssH;
      ctx.save();
      ctx.globalAlpha = inten * (isDark ? 0.9 : 0.75);
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(gx - 4.5, gy - 1.2);
      ctx.lineTo(gx + 4.5, gy + 1.2);
      ctx.moveTo(gx - 1.2, gy + 4.5);
      ctx.lineTo(gx + 1.2, gy - 4.5);
      ctx.stroke();
      if (accentCode !== 5) {
        ctx.globalAlpha = inten * 0.5;
        ctx.fillStyle = spectrum[0];
        ctx.fillRect(gx - 7, gy - 2.1, 1, 1);
        ctx.fillStyle = spectrum[3];
        ctx.fillRect(gx + 6, gy + 1.1, 1, 1);
      }
      ctx.restore();
    }

    // 2D 降级滑块分区：右侧凹陷暗色空槽 × 左侧顶部镜面高光水晶
    if (sliderFillRatio >= 0) {
      const splitX = clamp(sliderFillRatio, 0, 1) * cssW;
      if (splitX < cssW) {
        const gr = ctx.createLinearGradient(0, 0, 0, cssH);
        if (isDark) {
          gr.addColorStop(0, '#07090f');
          gr.addColorStop(0.45, '#10141f');
          gr.addColorStop(0.92, '#141a28');
          gr.addColorStop(1, '#263046');
        } else {
          gr.addColorStop(0, '#96a2b6');
          gr.addColorStop(0.55, '#bcc6d6');
          gr.addColorStop(1, '#e4eaf4');
        }
        ctx.fillStyle = gr;
        ctx.fillRect(splitX, 0, cssW - splitX, cssH);
      }
      if (splitX > 1) {
        const gloss = ctx.createLinearGradient(0, 0, 0, cssH);
        gloss.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
        gloss.addColorStop(0.22, isDark ? 'rgba(255, 255, 255, 0.42)' : 'rgba(255, 255, 255, 0.34)');
        gloss.addColorStop(0.42, 'rgba(255, 255, 255, 0.03)');
        gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gloss;
        ctx.fillRect(0, 0, splitX, cssH);
      }
    }

    // 外缘：暗色主题朝光亮缘，Light 主题 0.8px 冷钛灰棱线
    ctx.beginPath();
    ctx.roundRect(0.4, 0.4, cssW - 0.8, cssH - 0.8, r - 0.4);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = isDark ? 'rgba(225, 235, 250, 0.32)' : 'rgba(112, 122, 138, 0.88)';
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 挂载 Orchestrator 写实切割白水晶棱镜条。
   * 支持 WebGL2 实时光学着色与 2D 降级；尺寸由 ResizeObserver 缓存，支持 display:none -> visible 的懒尺寸自愈。
   */
  function mountCrystalPrismBar(canvas, options = {}) {
    if (!canvas || !canvas.getContext) return null;

    const getState = typeof options.getState === 'function' ? options.getState : () => ({ isDark: true, prismStrength: 1 });
    let reduceMotion = Boolean(options.reduceMotion);
    const force2D = Boolean(options.force2D);

    let pointerClientX = -9999;
    let pointerClientY = -9999;
    // 指针在画布左上原点坐标系下的局部位置（仅在指针事件 / 低频校准时读取 rect）
    let pointerLocalX = -9999;
    let pointerLocalY = -9999;
    let rectAge = 0;
    let currentProximity = 0;
    let targetProximity = 0;
    let elapsedTime = 0.25;
    let lastCssW = 0;
    let lastCssH = 0;
    let wakeT = -1;
    let hasDrawnFrame = false;
    let lastDrawW = -1;
    let lastDrawH = -1;
    let lastDrawDpr = -1;
    let lastDrawDark = null;
    let lastDrawStrength = -1;
    let lastDrawAccent = -1;
    let lastDrawAmbient = -1;
    let lastDrawReduce = null;
    let lastDrawHideLock = null;
    let lastDrawFillRatio = -1;
    let fillSettleSec = 0;
    let liquidAccumSec = 0;
    let wasLiquidFlow = false;
    let wasProximityActive = false;
    let wasGlintActive = false;
    let wasWaking = false;
    let glintAccumSec = 0;
    let drawCount = 0;
    let skippedCount = 0;
    const glintBuf = new Float32Array(4);
    const lastDrawnGlint = new Float32Array(4);

    // ── 尺寸缓存：ResizeObserver 推送，取消每帧 getBoundingClientRect ──
    let cachedW = 0;
    let cachedH = 0;
    let resizeObserver = null;
    const seedSizeFromRect = () => {
      const rect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
      cachedW = rect ? rect.width : canvas.width || 0;
      cachedH = rect ? rect.height : canvas.height || 0;
      return rect;
    };
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const box = entry.contentRect;
          cachedW = box.width;
          cachedH = box.height;
        }
        rectAge = 999; // 布局变化后下一帧校准指针局部坐标
      });
      try {
        resizeObserver.observe(canvas);
      } catch {}
    }
    seedSizeFromRect();

    let rendererMode = '2d';
    let glState = null;
    let ctx2d = null;

    const initWebGL2 = (gl) => {
      const vs = createShader(gl, gl.VERTEX_SHADER, VS_SRC);
      const fs = createShader(gl, gl.FRAGMENT_SHADER, FS_SRC);
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(prog) || 'program link error';
        gl.deleteProgram(prog);
        throw new Error(info);
      }
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      const uloc = (name) => gl.getUniformLocation(prog, name);
      return {
        gl,
        prog,
        buf,
        u: {
          res: uloc('u_res'),
          dpr: uloc('u_dpr'),
          time: uloc('u_time'),
          dark: uloc('u_dark'),
          pointer: uloc('u_pointer'),
          proximity: uloc('u_proximity'),
          reduce: uloc('u_reduce'),
          glints: uloc('u_glints'),
          glintU: uloc('u_glintU'),
          glintV: uloc('u_glintV'),
          wake: uloc('u_wake'),
          accent: uloc('u_accent'),
          ambient: uloc('u_ambient'),
        },
      };
    };

    if (!force2D) {
      try {
        const gl = canvas.getContext('webgl2', {
          alpha: true,
          antialias: true,
          premultipliedAlpha: true,
          powerPreference: 'high-performance',
        });
        if (gl) {
          glState = initWebGL2(gl);
          rendererMode = 'webgl2';
        }
      } catch {
        glState = null;
      }
    }

    if (!glState) {
      ctx2d = canvas.getContext('2d');
      if (!ctx2d) return null;
      rendererMode = '2d';
    }

    const onContextLost = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
    };
    const onContextRestored = () => {
      if (glState && glState.gl) {
        try {
          glState = initWebGL2(glState.gl);
          hasDrawnFrame = false;
        } catch {}
      }
    };
    if (rendererMode === 'webgl2' && typeof canvas.addEventListener === 'function') {
      canvas.addEventListener('webglcontextlost', onContextLost);
      canvas.addEventListener('webglcontextrestored', onContextRestored);
    }

    const readPrismStrength = (st) => clamp(Number(st.prismStrength ?? 1), 0, 1);

    // 指针事件时读取一次 rect，换算为局部坐标并顺带校准尺寸
    const syncPointerFromRect = () => {
      rectAge = 0;
      if (pointerClientX < -2000 || pointerClientY < -2000) {
        pointerLocalX = -9999;
        pointerLocalY = -9999;
        return;
      }
      const rect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
      if (!rect || rect.width < 10) {
        pointerLocalX = -9999;
        pointerLocalY = -9999;
        return;
      }
      if (!resizeObserver) {
        cachedW = rect.width;
        cachedH = rect.height;
      }
      pointerLocalX = pointerClientX - rect.left;
      pointerLocalY = pointerClientY - rect.top;
    };

    const step = (dtSec = 0.016) => {
      const dt = clamp(Number(dtSec) || 0.016, 0.001, 0.08);
      if (!reduceMotion) {
        elapsedTime += dt;
      }

      // 无 ResizeObserver 环境才逐帧读取 rect
      if (!resizeObserver) seedSizeFromRect();
      if (cachedW < 12 || cachedH < 10) {
        return false;
      }

      // 指针静止但页面滚动 / 重排时，低频（~2Hz）校准局部坐标
      if (pointerClientX > -2000) {
        rectAge += dt;
        if (rectAge > 0.5) syncPointerFromRect();
      }

      const st = getState() || {};
      if (st.reduceMotion !== undefined) {
        reduceMotion = Boolean(st.reduceMotion);
      }
      const isDark = st.isDark !== false;
      const hideLock = Boolean(st.hideLock);
      const fillRatio = hideLock ? clamp(Number(st.fillRatio ?? 1), 0, 1) : -1;
      const fillChanged = Math.abs(fillRatio - lastDrawFillRatio) > 0.0008;
      if (fillChanged && hasDrawnFrame) {
        fillSettleSec = 0.24;
      } else if (fillSettleSec > 0) {
        fillSettleSec = Math.max(0, fillSettleSec - dt);
      }
      const ambientVal = clamp(Number(st.ambientIntensity ?? 1), 0, 1);
      const prismStrengthVal = clamp(readPrismStrength(st) * ambientVal, 0, 1);
      const accentCode = resolveCrystalAccentCode(st.accentTone ?? st.spectrum ?? 'default');
      const cssW = Math.round(cachedW * 10) / 10;
      const cssH = Math.round(cachedH * 10) / 10;
      lastCssW = cssW;
      lastCssH = cssH;

      targetProximity =
        !reduceMotion && ambientVal > 0.001 && pointerLocalX > -2000
          ? computeProximityFactor(pointerLocalX, pointerLocalY, cssW, cssH, PROXIMITY_RADIUS_PX) * prismStrengthVal
          : 0;
      // 非对称指数平滑：attack ≈45ms / release ≈280ms（按真实 dt；禁动效或关闭氛围光时立即收敛）
      if (reduceMotion || ambientVal <= 0.001) {
        currentProximity = 0;
      } else {
        const tau = targetProximity > currentProximity ? PROXIMITY_ATTACK_SEC : PROXIMITY_RELEASE_SEC;
        currentProximity += (targetProximity - currentProximity) * (1 - Math.exp(-dt / tau));
        if (Math.abs(targetProximity - currentProximity) < 0.001) {
          currentProximity = targetProximity;
        }
      }

      const dpr = Math.min(2.5, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
      const targetW = Math.max(4, Math.round(cssW * dpr));
      const targetH = Math.max(4, Math.round(cssH * dpr));

      const glintMotionOff = reduceMotion || ambientVal <= 0.001;
      fillGlintIntensities(elapsedTime, glintMotionOff, glintBuf);
      if (ambientVal <= 0.001) {
        glintBuf[0] = 0;
        glintBuf[1] = 0;
        glintBuf[2] = 0;
        glintBuf[3] = 0;
      }

      // 光学唤醒：扫光位置（u 空间）与包络，星芒随扫光依次点亮
      let wakeU = 0;
      let wakeAmp = 0;
      if (wakeT >= 0) {
        if (glintMotionOff) {
          wakeT = -1;
        } else {
          wakeT += dt;
          const p = wakeT / WAKE_DURATION_SEC;
          if (p >= 1) {
            wakeT = -1;
          } else {
            const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            wakeU = -0.1 + 1.2 * eased;
            wakeAmp = Math.pow(Math.sin(Math.PI * p), 0.6) * ambientVal;
            for (let i = 0; i < 4; i++) {
              const d = wakeU - GLINT_ANCHORS[i].u;
              const boost = Math.exp(-(d * d) / 0.006) * 0.95;
              if (boost > glintBuf[i]) glintBuf[i] = boost;
            }
          }
        }
      }

      const maxGlint = Math.max(glintBuf[0], glintBuf[1], glintBuf[2], glintBuf[3]);
      let maxGlintDelta = 0;
      for (let i = 0; i < 4; i++) {
        const gd = Math.abs(glintBuf[i] - lastDrawnGlint[i]);
        if (gd > maxGlintDelta) maxGlintDelta = gd;
      }
      glintAccumSec += dt;
      liquidAccumSec += dt;
      const proximityActive = currentProximity > 0.001;
      const liquidFlowActive = hideLock && !reduceMotion && ambientVal > 0.001 && fillRatio >= 0 && fillRatio < 0.985;
      const liquidDirty = liquidFlowActive && liquidAccumSec >= 0.036;
      const glintVisible = !glintMotionOff && maxGlint > 0.015;
      const glintDirty =
        !glintMotionOff &&
        ((glintVisible && maxGlintDelta > 0.012 && glintAccumSec >= 0.030) || (!glintVisible && wasGlintActive));
      const wakingNow = wakeT >= 0 && wakeAmp > 0.001;
      const paramsChanged =
        !hasDrawnFrame ||
        canvas.width !== targetW ||
        canvas.height !== targetH ||
        cssW !== lastDrawW ||
        cssH !== lastDrawH ||
        dpr !== lastDrawDpr ||
        isDark !== lastDrawDark ||
        accentCode !== lastDrawAccent ||
        reduceMotion !== lastDrawReduce ||
        hideLock !== lastDrawHideLock ||
        fillChanged ||
        Math.abs(ambientVal - lastDrawAmbient) > 0.002 ||
        Math.abs(prismStrengthVal - lastDrawStrength) > 0.002;

      const needsRender =
        paramsChanged ||
        proximityActive ||
        wasProximityActive ||
        glintDirty ||
        liquidDirty ||
        wakingNow ||
        wasWaking;

      if (!needsRender) {
        skippedCount += 1;
        return false;
      }

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      if (glState) {
        const { gl, prog, u } = glState;
        gl.viewport(0, 0, targetW, targetH);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(prog);

        gl.uniform2f(u.res, cssW, cssH);
        gl.uniform1f(u.dpr, dpr);
        gl.uniform1f(u.time, elapsedTime);
        gl.uniform1f(u.dark, isDark ? 1.0 : 0.0);
        // 着色器坐标系 y 轴朝上，这里翻转指针 y
        if (pointerLocalX > -2000) {
          gl.uniform2f(u.pointer, pointerLocalX - cssW * 0.5, cssH * 0.5 - pointerLocalY);
        } else {
          gl.uniform2f(u.pointer, -9999, -9999);
        }
        gl.uniform1f(u.proximity, currentProximity);
        gl.uniform1f(u.reduce, hideLock ? (reduceMotion ? 4.0 : 2.0) + fillRatio : (reduceMotion ? 1.0 : 0.0));
        gl.uniform4f(u.glints, glintBuf[0], glintBuf[1], glintBuf[2], glintBuf[3]);
        gl.uniform4f(u.glintU, GLINT_ANCHORS[0].u, GLINT_ANCHORS[1].u, GLINT_ANCHORS[2].u, GLINT_ANCHORS[3].u);
        gl.uniform4f(u.glintV, GLINT_ANCHORS[0].v, GLINT_ANCHORS[1].v, GLINT_ANCHORS[2].v, GLINT_ANCHORS[3].v);
        gl.uniform2f(u.wake, wakeU, wakeAmp);
        gl.uniform1f(u.accent, accentCode);
        gl.uniform1f(u.ambient, ambientVal);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } else if (ctx2d) {
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx2d.clearRect(0, 0, cssW, cssH);
        const localCorner =
          pointerLocalX > -2000 ? { x: pointerLocalX, y: pointerLocalY } : { x: -9999, y: -9999 };
        drawFallback2D(ctx2d, cssW, cssH, isDark, localCorner, currentProximity, glintBuf, wakeU, wakeAmp, accentCode, ambientVal, fillRatio);
        if (!hideLock) drawLaserEtchedLock(ctx2d, cssW, cssH, isDark, currentProximity);
      }

      hasDrawnFrame = true;
      lastDrawW = cssW;
      lastDrawH = cssH;
      lastDrawDpr = dpr;
      lastDrawDark = isDark;
      lastDrawStrength = prismStrengthVal;
      lastDrawAccent = accentCode;
      lastDrawAmbient = ambientVal;
      lastDrawReduce = reduceMotion;
      lastDrawHideLock = hideLock;
      lastDrawFillRatio = fillRatio;
      wasProximityActive = proximityActive;
      wasGlintActive = glintVisible;
      wasLiquidFlow = liquidFlowActive;
      wasWaking = wakingNow;
      glintAccumSec = 0;
      liquidAccumSec = 0;
      for (let i = 0; i < 4; i++) lastDrawnGlint[i] = glintBuf[i];
      drawCount += 1;
      return true;
    };

    const isIdle = () => {
      if (!hasDrawnFrame || wakeT >= 0 || fillSettleSec > 0 || currentProximity > 0.001 || targetProximity > 0.001) return false;
      if (reduceMotion || lastDrawAmbient === 0) return true;
      if (wasLiquidFlow) return false;
      fillGlintIntensities(elapsedTime, false, glintBuf);
      return Math.max(glintBuf[0], glintBuf[1], glintBuf[2], glintBuf[3]) <= 0.015;
    };

    return {
      step,
      isIdle,
      setReduceMotion(flag) {
        const next = Boolean(flag);
        if (reduceMotion !== next) {
          reduceMotion = next;
          if (next) {
            wakeT = -1;
            currentProximity = 0;
            targetProximity = 0;
          }
          hasDrawnFrame = false;
        }
      },
      invalidate() {
        hasDrawnFrame = false;
      },
      setPointerClient(clientX, clientY) {
        pointerClientX = Number.isFinite(clientX) ? clientX : -9999;
        pointerClientY = Number.isFinite(clientY) ? clientY : -9999;
        // 仅更新目标位置；近场光强由 step 中的非对称指数平滑逼近，不再瞬时覆盖
        syncPointerFromRect();
      },
      /** 光学唤醒：播放一次约 700ms 自左向右的冷白扫光，星芒依次点亮；reduceMotion 时为空操作 */
      wake() {
        if (reduceMotion) return;
        wakeT = 0;
      },
      getDebugState() {
        fillGlintIntensities(elapsedTime, reduceMotion, glintBuf);
        let active = 0;
        for (let i = 0; i < 4; i++) if (glintBuf[i] > 0.05) active++;
        return {
          rendererMode,
          zeroCopy: rendererMode === 'webgl2',
          width: lastCssW,
          height: lastCssH,
          proximityFactor: Math.round(currentProximity * 1000) / 1000,
          dispersionActive: currentProximity > 0.05 && lastDrawAccent !== 5,
          accentCode: lastDrawAccent >= 0 ? lastDrawAccent : 0,
          ambientIntensity: lastDrawAmbient >= 0 ? lastDrawAmbient : 1,
          reduceMotion,
          activeGlints: active,
          waking: wakeT >= 0,
          idle: isIdle(),
          drawCount,
          skippedCount,
        };
      },
      dispose() {
        if (resizeObserver) {
          try {
            resizeObserver.disconnect();
          } catch {}
          resizeObserver = null;
        }
        if (typeof canvas.removeEventListener === 'function') {
          canvas.removeEventListener('webglcontextlost', onContextLost);
          canvas.removeEventListener('webglcontextrestored', onContextRestored);
        }
        if (glState) {
          const { gl, prog, buf } = glState;
          try {
            gl.deleteProgram(prog);
            gl.deleteBuffer(buf);
            const ext = gl.getExtension('WEBGL_lose_context');
            if (ext) ext.loseContext();
          } catch {}
          glState = null;
        }
        ctx2d = null;
      },
    };
  }

  return {
    PROXIMITY_RADIUS_PX,
    resolveCrystalAccentCode,
    computeProximityFactor,
    evaluateDeterministicGlints,
    mountCrystalPrismBar,
  };
});
