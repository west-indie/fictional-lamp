// frontend/js/ui/battleBackgoundThemes/Snob.js
// Snob — Uniform diamond SHAPES that morph in sync (Mother 3-ish, dark/blue start -> then randomize)
//
// ✅ Underlay: cloudy dot field (p5-ish) behind diamonds
// ✅ Underlay moves ONLY to the RIGHT, continuously, forever (independent of diamonds)
// ✅ No smear: underlay is redrawn every frame
// ✅ Removes hard “square/grid lines” by jittering dot positions + using soft radial dots
// ✅ DO NOT TOUCH DIAMONDS (movement/morph/placement/colors) — ONLY opacity changes per request

export function makeState(sizes, H) {
  const w = sizes.srcW ?? sizes.w ?? 400;
  const h = sizes.srcH ?? sizes.h ?? 300;

  // -------------------------
  // DIAMONDS (UNCHANGED except opacity later)
  // -------------------------
  const cell = H.rand(34, 48);
  const size = cell * H.rand(0.34, 0.44);

  const cols = Math.ceil(w / cell) + 2;
  const rows = Math.ceil(h / cell) + 2;

  const diamonds = [];
  const ox = (w - (cols - 1) * cell) * 0.5;
  const oy = (h - (rows - 1) * cell) * 0.5;

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      diamonds.push({
        x: ox + i * cell,
        y: oy + j * cell,
        r: size * H.rand(0.92, 1.08)
      });
    }
  }

  // cached layer for diamonds
  const diamondLayer = document.createElement("canvas");
  diamondLayer.width = w;
  diamondLayer.height = h;

  // -------------------------
  // UNDERLAY: cloudy dot field (p5-ish)
  // -------------------------
  const bgLayer = document.createElement("canvas");
  bgLayer.width = w;
  bgLayer.height = h;

  const step = 10;
  const dotR = 5;            // radius ~5 baseline
  const noiseScale = 0.010;

  // ✅ rightward motion speed (px/sec)
  const rightSpeed = H.rand(18, 32);

  // Stable per battle
  const seedX = Math.random() * 1000;
  const seedY = Math.random() * 1000;

  // Precompute dot positions ONCE with jitter
  const bgPoints = [];
  const jitter = step * 0.34;
  for (let y = 0; y <= h + step; y += step) {
    for (let x = 0; x <= w + step; x += step) {
      bgPoints.push({
        x: x + (Math.random() * 2 - 1) * jitter,
        y: y + (Math.random() * 2 - 1) * jitter
      });
    }
  }

  return {
    // diamonds
    diamonds,
    cell,
    baseR: size,
    driftX: H.rand(8, 18),
    driftY: H.rand(6, 14),
    driftPh: Math.random() * Math.PI * 2,
    chaos: 0,
    morphT: Math.random() * Math.PI * 2,
    morphSpeed: H.rand(1.2, 1.8),

    // layers
    layer: diamondLayer,
    lctx: diamondLayer.getContext("2d"),

    bgLayer,
    bgctx: bgLayer.getContext("2d"),

    // underlay params/state
    step,
    dotR,
    noiseScale,
    rightSpeed,
    scrollX: 0,
    seedX,
    seedY,
    bgT: Math.random() * 1000,
    bgPoints
  };
}

export function tick(state, dt, intensity, _sizes, H) {
  // ✅ Faster chaos ramp (helps palette logic pick up faster)
  // (Still: true palette crossfade speed is in battleBackground.js)
  state.chaos = H.clamp(state.chaos + dt * 0.30, 0, 1); // was 0.16

  // ✅ Diamonds (movement unchanged)
  state.morphT += dt * state.morphSpeed * (0.95 + 0.08 * intensity);
  state.driftPh += dt * (0.18 + 0.03 * intensity);

  // ✅ Underlay: continuous right movement ONLY (positive X forever)
  state.scrollX += dt * state.rightSpeed;

  // ✅ Underlay evolution faster so it *visibly* changes color/intensity sooner
  state.bgT += dt * (0.95 + 0.12 * intensity); // was 0.35 + 0.05*i
}

export function drawBase(ctx, w, h, pal, state, t, intensity, _meta, H) {
  if (!state) return;

  // keep cache size correct
  if (state.layer.width !== w || state.layer.height !== h) {
    state.layer.width = w;
    state.layer.height = h;
  }
  if (state.bgLayer.width !== w || state.bgLayer.height !== h) {
    state.bgLayer.width = w;
    state.bgLayer.height = h;
  }

  const l = state.lctx;
  const bg = state.bgctx;

  // -------------------------
  // Base dark field (unchanged)
  // -------------------------
  H.fillFlat(ctx, w, h, pal.c1);
  H.fillSeededGradient(
    ctx,
    w,
    h,
    pal.c1,
    pal.c2,
    pal.c3,
    { ax: 0.12, ay: 0.10, bx: 0.88, by: 0.92 },
    0.45
  );

  ctx.save();
  ctx.globalAlpha = 0.38;
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // -------------------------
  // Underlay: cloudy dot field moving RIGHT
  // -------------------------
  bg.clearRect(0, 0, w, h);
  drawCloudDots(bg, w, h, pal, state, intensity, H);

  // ✅ Make underlay MORE opaque per request
  ctx.save();
  ctx.globalAlpha = 0.88;      // was 0.72
  ctx.filter = "blur(0.45px)"; // tiny cohesion; still no smear
  ctx.drawImage(state.bgLayer, 0, 0);
  ctx.restore();

  // -------------------------
  // DIAMONDS (unchanged movement; opacity increased per request)
  // -------------------------
  l.clearRect(0, 0, w, h);

  const m = 0.5 + 0.5 * Math.sin(state.morphT);

  const dx = Math.sin(state.driftPh) * state.driftX;
  const dy = Math.cos(state.driftPh * 0.9) * state.driftY;

  l.save();
  l.globalCompositeOperation = "screen";

  // ✅ Diamonds MORE opaque (only change)
  l.globalAlpha = 0.55 + 0.06 * (intensity - 1); // was 0.38 + 0.05*(i-1)

  const cols = Math.max(1, Math.round(w / state.cell));
  for (let idx = 0; idx < state.diamonds.length; idx++) {
    const d = state.diamonds[idx];

    const ii = idx % cols;
    const jj = (idx / cols) | 0;

    const col =
      (ii + jj) % 3 === 0 ? pal.c2 :
      (ii + jj) % 3 === 1 ? pal.c3 :
      pal.c1;

    l.fillStyle = H.rgba(col, 0.92);

    const r = d.r * (0.92 + 0.08 * (0.5 + 0.5 * Math.sin(state.morphT)));

    drawMorphDiamond(l, d.x + dx, d.y + dy, r, m);
  }

  l.restore();

  ctx.save();
  ctx.globalAlpha = 0.98;
  ctx.filter = "blur(1.3px)";
  ctx.drawImage(state.layer, 0, 0);
  ctx.restore();

  // faint ribs (unchanged)
  ctx.save();
  ctx.globalAlpha = 0.06 + 0.01 * (intensity - 1);
  ctx.strokeStyle = "rgba(0,0,0,1)";
  ctx.lineWidth = 2;
  for (let y = 0; y < h; y += 22) {
    const wob = 6 * Math.sin(t * 0.55 + y * 0.06);
    ctx.beginPath();
    ctx.moveTo(0, y + wob);
    ctx.lineTo(w, y - wob * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================================
// Underlay: noise dots + palette-driven + RIGHT scroll (no smear)
// ============================================================================

function drawCloudDots(ctx, w, h, pal, state, intensity, H) {
  const r0 = state.dotR;
  const s = state.noiseScale;

  const scroll = state.scrollX;
  const tt = state.bgT;

  // ✅ Underlay MORE opaque per request
  const baseAlpha = 0.82; // was 0.62

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  for (let i = 0; i < state.bgPoints.length; i++) {
    const p = state.bgPoints[i];

    // position scroll right + wrap
    const x = mod(p.x + scroll, w);
    const y = p.y;

    // noise domain (evolving)
    const nx = s * (p.x + scroll) + tt + state.seedX;
    const ny = s * p.y + tt + state.seedY;

    const n = valueNoise2D(nx, ny);
    const nn = smoothstep(0.12, 0.90, n);

    // palette-driven color (still snob scheme)
    const col = paletteRampSnobUnderlay(pal, nn);

    // ✅ Larger/stronger dots for readability
    const rr = r0 * (0.95 + 0.75 * nn);

    // ✅ More opacity (this is the big one)
    const a = baseAlpha * (0.35 + 0.95 * nn);

    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0.0, H.rgba(col, a));
    g.addColorStop(0.70, H.rgba(col, a * 0.38));
    g.addColorStop(1.0, H.rgba(col, 0.0));

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // keep snob mood, but slightly lighter wash so the underlay doesn't disappear
  ctx.save();
  ctx.globalAlpha = 0.14 + 0.02 * (intensity - 1); // was heavier
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Dark-biased palette mapping (keeps diamonds readable).
 * If you want MORE contrast between underlay and diamonds:
 * - reduce how much we ever reach pal.c3 (brightest)
 */
function paletteRampSnobUnderlay(pal, t) {
  const tt = clamp(t, 0, 1);

  // less compressed than before so it can “breathe” with palette changes
  const d = tt * 0.72; // was 0.60

  if (d < 0.52) {
    return lerpColor(pal.c1, pal.c2, d / 0.52);
  }
  return lerpColor(pal.c2, pal.c3, (d - 0.52) / 0.20);
}

// ============================================================================
// Noise: lightweight value noise (no external libs)
// ============================================================================

function valueNoise2D(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const sx = fade(x - x0);
  const sy = fade(y - y0);

  const n00 = hash2(x0, y0);
  const n10 = hash2(x1, y0);
  const n01 = hash2(x0, y1);
  const n11 = hash2(x1, y1);

  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);
  return lerp(ix0, ix1, sy);
}

function hash2(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  return ((n >>> 0) % 1000000) / 1000000;
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// ============================================================================
// DIAMONDS (movement/morph unchanged; ONLY opacity was adjusted above)
// ============================================================================

function drawMorphDiamond(ctx, cx, cy, r, m) {
  const cornerPull = lerp(1.0, 0.62, m);
  const edgeBulge = lerp(0.0, 0.38, m);
  const roundness = lerp(0.0, 0.55, m);

  const top = { x: cx, y: cy - r * cornerPull };
  const right = { x: cx + r * cornerPull, y: cy };
  const bottom = { x: cx, y: cy + r * cornerPull };
  const left = { x: cx - r * cornerPull, y: cy };

  const midTR = { x: cx + r * edgeBulge, y: cy - r * edgeBulge };
  const midRB = { x: cx + r * edgeBulge, y: cy + r * edgeBulge };
  const midBL = { x: cx - r * edgeBulge, y: cy + r * edgeBulge };
  const midLT = { x: cx - r * edgeBulge, y: cy - r * edgeBulge };

  const cr = r * roundness;

  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.quadraticCurveTo(midTR.x + cr, midTR.y, right.x, right.y);
  ctx.quadraticCurveTo(midRB.x, midRB.y + cr, bottom.x, bottom.y);
  ctx.quadraticCurveTo(midBL.x - cr, midBL.y, left.x, left.y);
  ctx.quadraticCurveTo(midLT.x, midLT.y - cr, top.x, top.y);
  ctx.closePath();
  ctx.fill();
}

// ============================================================================
// Small utils (local; avoids depending on H having lerpColor)
// ============================================================================

function mod(x, m) {
  const r = x % m;
  return r < 0 ? r + m : r;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function parseRgb(s) {
  const m = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(String(s));
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) };
}

function lerpColor(rgbA, rgbB, t) {
  const a = parseRgb(rgbA);
  const b = parseRgb(rgbB);
  const r = Math.round(lerp(a.r, b.r, t));
  const g = Math.round(lerp(a.g, b.g, t));
  const bb = Math.round(lerp(a.b, b.b, t));
  return `rgb(${r},${g},${bb})`;
}
