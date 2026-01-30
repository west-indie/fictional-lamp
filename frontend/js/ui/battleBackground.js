// frontend/js/ui/battleBackground.js
//
// Theme-based dynamic battle background (EarthBound/Mother-ish), letterbox friendly.
// - Renders ONLY the active region (battle should draw black bars separately).
// - Overscanned source sampled into a viewport-sized "frame" each render.
// - Scanline warp WITHOUT destination-Y offsets (prevents internal black gaps).
// - No trails: frame/post cleared each render; no accumulation.
//
// Themes via enemy.bgTheme: Internet / Snob / Cinephile / Art / Comfort
// - If missing/unknown OR "Disney" -> CLASSIC
//
// Modularization:
// - Theme logic lives in ./battleBackgoundThemes/*.js
// - This file is the shared engine: overscan, warp, palettes, helpers, and post feel.
//
// CHANGES (ONLY what you asked):
// ✅ Comfort: FIX the “elongation / stretch” when the image shifts (bottom shows).
// ✅ Snob: STARTS blue, THEN colors randomize gradually after that.
// ✅ Art: more morphing shapes, more opaque, LESS lines, lines more transparent,
//        and shapes are larger + longer (elongated) as they morph.
// (Everything else remains the same.)

import * as ClassicTheme from "./battleBackgoundThemes/Classic.js";
import * as InternetTheme from "./battleBackgoundThemes/Internet.js";
import * as SnobTheme from "./battleBackgoundThemes/Snob.js";
import * as CinephileTheme from "./battleBackgoundThemes/Cinephile.js";
import * as ArtTheme from "./battleBackgoundThemes/Art.js";
import * as ComfortTheme from "./battleBackgoundThemes/Comfort.js";

const THEMES = {
  CLASSIC: { key: "CLASSIC" },
  Internet: { key: "Internet" },
  Snob: { key: "Snob" },
  Comfort: { key: "Comfort" },
  Art: { key: "Art" },
  Cinephile: { key: "Cinephile" }
};

const THEME_IMPL = {
  CLASSIC: ClassicTheme,
  Internet: InternetTheme,
  Snob: SnobTheme,
  Comfort: ComfortTheme,
  Art: ArtTheme,
  Cinephile: CinephileTheme
};

export function createBattleBackground({ width, height }) {
  // -----------------------
  // Overscan / drift safety
  // -----------------------
  const MAX_WOBBLE_X = 26;
  const MAX_WOBBLE_Y = 10;

  const DRIFT_AMP_X = 90;
  const DRIFT_AMP_Y = 70;

  const OVERSCAN_X = MAX_WOBBLE_X + DRIFT_AMP_X + 32;
  const OVERSCAN_Y = MAX_WOBBLE_Y + DRIFT_AMP_Y + 32;

  const srcW = width + OVERSCAN_X * 2;
  const srcH = height + OVERSCAN_Y * 2;

  const base = document.createElement("canvas");
  base.width = srcW;
  base.height = srcH;

  const frame = document.createElement("canvas");
  frame.width = width;
  frame.height = height;

  const post = document.createElement("canvas");
  post.width = width;
  post.height = height;

  const bctx = base.getContext("2d");
  const fctx = frame.getContext("2d");
  const pctx = post.getContext("2d");

  // -----------------------
  // Helpers object passed to themes
  // -----------------------
  const H = {
    // math
    rand, randInt, lerp, clamp, clampInt, mod, smooth01,
    // colors
    parseRgb, lerpColor, rgba, mixRgb,
    // drawing helpers
    fillFlat, fillSeededGradient, addVignette, addFineNoise, drawSoftHaze,
    // data helpers
    shuffle3
  };

  // -----------------------
  // Global state
  // -----------------------
  let t = 0;

  let activeThemeKey = "CLASSIC";
  let level = 1;
  let intensity = 1; // 1..5

  // Bounded drift (oscillatory => no seams)
  let driftPhaseX = 0;
  let driftPhaseY = 0;
  let driftRateX = 0.45;
  let driftRateY = 0.36;
  let driftX = 0;
  let driftY = 0;

  // Warp tunables
  let warpAmpX = 16;
  let warpAmpY = 6;
  let warpSpeedMul = 1.0;
  let warpPulseStrength = 0.06;

  // Palette crossfade (smooth transitions, no hard jumps)
  let paletteA = null;
  let paletteB = null;
  let paletteT = 0;        // 0..1
  let paletteSpeed = 0.06; // per second

  // Gentle post tint pulse (keeps cohesion)
  let tintPulseT = 0;
  let tintPulseSpeed = 0.9;

  // Seeded gradient endpoints (stable within a battle)
  let gradParams = { ax: 0.18, ay: 0.22, bx: 0.82, by: 0.74 };

  // Per-theme state bundle (created by theme module)
  let themeState = null;

  // Init
  randomize();

  function configure({ theme, level: lvl } = {}) {
    const resolved = resolveTheme(theme);
    activeThemeKey = resolved.key;

    if (typeof lvl === "number" && isFinite(lvl)) level = Math.max(1, Math.floor(lvl));
    intensity = intensityForLevel(level);

    applyThemeTunables();
  }

  function tick(dt) {
    if (typeof dt !== "number" || !isFinite(dt)) dt = 1 / 60;
    if (dt > 0.1) dt = 0.1;

    t += dt;

    // theme motion
    const impl = THEME_IMPL[activeThemeKey] || THEME_IMPL.CLASSIC;
    if (impl && impl.tick && themeState) {
      impl.tick(themeState, dt, intensity, { width, height, srcW, srcH }, H);
    }

    // palette crossfade
    paletteT += dt * paletteSpeed;
    if (paletteT >= 1) {
      paletteT -= 1;
      paletteA = paletteB;

      // Snob palette uses chaos that ramps over time
      paletteB = makeThemePalette(activeThemeKey, {
        snobChaos: activeThemeKey === "Snob" && themeState ? (themeState.chaos ?? 0) : 0
      });
    }

    // bounded drift
    driftPhaseX += dt * driftRateX;
    driftPhaseY += dt * driftRateY;
    driftX = Math.sin(driftPhaseX) * DRIFT_AMP_X;
    driftY = Math.cos(driftPhaseY) * DRIFT_AMP_Y;

    // subtle unifier pulse
    tintPulseT += dt * tintPulseSpeed;
  }

  function render(ctx, { x = 0, y = 0 } = {}) {
    // current palette
    const pal = lerpPalette(paletteA, paletteB, smooth01(paletteT));

    // 1) draw theme base to overscanned source each frame
    bctx.clearRect(0, 0, srcW, srcH);
    drawThemeBase(bctx, srcW, srcH, pal);

    // 2) warp -> frame (no dest-y offset => no internal black gaps)
    drawWarpedScanlines(fctx, bctx, {
      viewW: width,
      viewH: height,
      srcW,
      srcH,
      t,
      driftX,
      driftY,
      overscanX: OVERSCAN_X,
      overscanY: OVERSCAN_Y,
      ampX: warpAmpX,
      ampY: warpAmpY,
      speedMul: warpSpeedMul,
      themeKey: activeThemeKey,
      pulseStrength: warpPulseStrength
    });

    // 3) post-process (clear => no trails)
    pctx.clearRect(0, 0, width, height);
    pctx.drawImage(frame, 0, 0);

    // theme-specific “feel” layer (subtle; keeps readability)
    applyPostFeel(pctx, width, height);

    // final blit
    ctx.drawImage(post, x, y);
  }

  function randomize() {
    intensity = intensityForLevel(level);
    applyThemeTunables();

    // drift seeds
    driftPhaseX = Math.random() * Math.PI * 2;
    driftPhaseY = Math.random() * Math.PI * 2;

    // drift rates per theme (movement character)
    if (activeThemeKey === "Comfort") {
      driftRateX = rand(0.70, 1.05);
      driftRateY = rand(0.62, 0.98);
    } else if (activeThemeKey === "Internet") {
      driftRateX = rand(0.42, 0.70);
      driftRateY = rand(0.36, 0.62);
    } else if (activeThemeKey === "Snob") {
      driftRateX = rand(0.30, 0.52);
      driftRateY = rand(0.26, 0.46);
    } else if (activeThemeKey === "Art") {
      driftRateX = rand(0.55, 0.92);
      driftRateY = rand(0.45, 0.85);
    } else if (activeThemeKey === "Cinephile") {
      driftRateX = rand(0.48, 0.76);
      driftRateY = rand(0.40, 0.70);
    } else {
      driftRateX = rand(0.40, 0.78);
      driftRateY = rand(0.34, 0.66);
    }

    // seeded gradient endpoints (stable during battle)
    gradParams = {
      ax: rand(0.10, 0.34),
      ay: rand(0.10, 0.34),
      bx: rand(0.66, 0.92),
      by: rand(0.66, 0.92)
    };

    // theme state rebuild (do BEFORE palettes so Snob starts chaos=0)
    const impl = THEME_IMPL[activeThemeKey] || THEME_IMPL.CLASSIC;
    themeState = impl && impl.makeState
      ? impl.makeState({ width, height, srcW, srcH, intensity }, H)
      : null;

    // palettes (crossfading)
    paletteA = makeThemePalette(activeThemeKey, {
      snobChaos: activeThemeKey === "Snob" && themeState ? (themeState.chaos ?? 0) : 0
    });
    paletteB = makeThemePalette(activeThemeKey, {
      snobChaos: activeThemeKey === "Snob" && themeState ? (themeState.chaos ?? 0) : 0
    });
    paletteT = 0;
    paletteSpeed = themePaletteSpeed(activeThemeKey, intensity);

    // pulse speed
    tintPulseT = Math.random() * Math.PI * 2;
    tintPulseSpeed = 0.7 + 0.12 * intensity;
  }

  function applyThemeTunables() {
    const i = clamp(intensity, 1, 5);

    // default warp
    warpAmpX = 14 + i * 4;       // 18..34
    warpAmpY = 5 + i * 1.1;      // ~6..10
    warpSpeedMul = 1.0 + 0.10 * (i - 1);
    warpPulseStrength = 0.05 + 0.02 * (i - 1);

    if (activeThemeKey === "Internet") {
      warpAmpX *= 0.75;
      warpAmpY *= 0.85;
      warpSpeedMul *= 0.95;
      warpPulseStrength *= 0.55;
    } else if (activeThemeKey === "Snob") {
      warpAmpX *= 0.55;
      warpAmpY *= 0.50;
      warpSpeedMul *= 0.85;
      warpPulseStrength *= 0.55;
    } else if (activeThemeKey === "Cinephile") {
      warpAmpX *= 0.65;
      warpAmpY *= 0.65;
      warpSpeedMul *= 0.92;
      warpPulseStrength *= 0.50;
    } else if (activeThemeKey === "Art") {
      warpAmpX *= 0.95;
      warpAmpY *= 1.10;
      warpSpeedMul *= 1.00;
      warpPulseStrength *= 0.70;
    } else if (activeThemeKey === "Comfort") {
      warpAmpX *= 0.85;
      warpAmpY *= 0.95;
      warpSpeedMul *= 1.25;
      warpPulseStrength *= 0.65;
    }
  }

  // -----------------------
  // Base draw per theme
  // -----------------------
  function drawThemeBase(ctx, w, h, pal) {
    const impl = THEME_IMPL[activeThemeKey] || THEME_IMPL.CLASSIC;
    if (impl && impl.drawBase) {
      impl.drawBase(
        ctx,
        w,
        h,
        pal,
        themeState,
        t,
        intensity,
        { gradParams, themeKey: activeThemeKey },
        H
      );
      return;
    }

    // fallback
    ClassicTheme.drawBase(ctx, w, h, pal, themeState, t, intensity, { gradParams, themeKey: "CLASSIC" }, H);
  }

  function applyPostFeel(ctx, w, h) {
    const i = clamp(intensity, 1, 5);
    const mix = 0.5 + 0.5 * Math.sin(tintPulseT);

    if (activeThemeKey === "Internet") {
      // slight warm/cool shimmer like glass
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.06 + 0.01 * (i - 1);
      ctx.fillStyle = mix < 0.5 ? "rgba(255,160,120,1)" : "rgba(120,180,255,1)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // very small bloom (makes lava “glow”)
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.filter = "blur(1.6px)";
      ctx.drawImage(post, 0, 0);
      ctx.restore();
      return;
    }

    if (activeThemeKey === "Snob") {
      // keep it darker, minimal
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      return;
    }

    if (activeThemeKey === "Cinephile") {
      // gold/silver fluctuation
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.05 + 0.01 * (i - 1);
      ctx.fillStyle = mix < 0.5 ? "rgba(255,220,140,1)" : "rgba(210,225,240,1)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // subtle bloom for “metal”
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.filter = "blur(1.2px)";
      ctx.drawImage(post, 0, 0);
      ctx.restore();
      return;
    }

    if (activeThemeKey === "Art") {
      // harsher contrast pulse
      ctx.save();
      ctx.globalAlpha = 0.06 + 0.02 * (i - 1);
      ctx.fillStyle = mix < 0.5 ? "rgba(20,40,120,1)" : "rgba(10,10,10,1)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      return;
    }

    if (activeThemeKey === "Comfort") {
      // club glow
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.08 + 0.02 * (i - 1);
      ctx.fillStyle = mix < 0.5 ? "rgba(255,0,160,1)" : "rgba(0,220,255,1)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.18 + 0.03 * (i - 1);
      ctx.filter = "blur(1.8px)";
      ctx.drawImage(post, 0, 0);
      ctx.restore();
      return;
    }

    // Classic: tiny unify tint
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = mix < 0.5 ? "rgba(255,255,255,1)" : "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  return { tick, render, randomize, configure };
}

// ============================================================================
// Warp (shared) + Palettes + Helpers
// ============================================================================

function drawWarpedScanlines(dstCtx, srcCtx, opts) {
  const {
    viewW,
    viewH,
    srcW,
    srcH,
    t,
    driftX,
    driftY,
    overscanX,
    overscanY,
    ampX,
    ampY,
    speedMul,
    themeKey,
    pulseStrength
  } = opts;

  dstCtx.clearRect(0, 0, viewW, viewH);

  // theme frequency feel
  let freqA = 0.020;
  let freqB = 0.010;
  let freqY = 0.012;

  if (themeKey === "Internet") {
    freqA = 0.016;
    freqB = 0.008;
    freqY = 0.010;
  } else if (themeKey === "Snob") {
    freqA = 0.018;
    freqB = 0.007;
    freqY = 0.009;
  } else if (themeKey === "Comfort") {
    freqA = 0.022;
    freqB = 0.010;
    freqY = 0.014;
  } else if (themeKey === "Art") {
    freqA = 0.024;
    freqB = 0.012;
    freqY = 0.016;
  } else if (themeKey === "Cinephile") {
    freqA = 0.020;
    freqB = 0.010;
    freqY = 0.012;
  }

  const phase = t * (24 * (speedMul ?? 1.0));
  const ax = ampX ?? 18;
  const ay = ampY ?? 6;

  const maxSX = srcW - viewW;
  const maxSYWindow = srcH - viewH;

  let baseSX = overscanX + driftX;
  let baseSY = overscanY + driftY;

  // keep base sampling away from edges so wobble never clamps
  const safePadX = Math.ceil((ax * 1.6)) + 2;
  const safePadY = Math.ceil((ay * 0.4)) + 2;

  // clamp base to a valid window (must allow baseSY+viewH <= srcH)
  if (maxSYWindow > 0) {
    baseSY = clamp(baseSY, safePadY, Math.max(safePadY, maxSYWindow - safePadY));
  } else {
    baseSY = 0;
  }
  baseSX = clamp(baseSX, safePadX, Math.max(safePadX, maxSX - safePadX));

  // Comfort: reduce vertical sampling wobble
  const comfortYMul = themeKey === "Comfort" ? 0.08 : 0.35;

  // ✅ FIX (stretch/elongation): clamp sy to srcH-1 when sampling one row.
  const maxSYRow = srcH - 1;

  for (let y = 0; y < viewH; y++) {
    const wobbleX =
      Math.sin((y + phase) * freqA) * ax +
      Math.sin((y + phase * 0.72) * freqB) * (ax * 0.55);

    const wobbleY = Math.sin((y + phase) * freqY) * ay;

    // IMPORTANT: wobble affects SOURCE sampling; destination row is y (no gaps)
    let sx = Math.floor(baseSX + wobbleX);
    let sy = Math.floor(baseSY + y + wobbleY * comfortYMul);

    sx = clamp(sx, 0, maxSX);
    sy = clamp(sy, 0, maxSYRow);

    dstCtx.drawImage(srcCtx.canvas, sx, sy, viewW, 1, 0, y, viewW, 1);
  }

  // subtle depth pulse
  const basePulse =
    themeKey === "Snob" ? 0.06 :
    themeKey === "Internet" ? 0.04 :
    themeKey === "Comfort" ? 0.05 :
    themeKey === "Art" ? 0.06 :
    themeKey === "Cinephile" ? 0.05 :
    0.06;

  const pulse = basePulse + (0.03 * (pulseStrength ?? 0.10)) * Math.sin(t * 1.8);

  dstCtx.globalAlpha = clamp(pulse, 0, 0.10);
  dstCtx.fillStyle = "#000";
  dstCtx.fillRect(0, 0, viewW, viewH);
  dstCtx.globalAlpha = 1;
}

// ============================================================================
// Palettes (ONLY updated where needed: Snob chaos palette is actually varied)
// ============================================================================

function makeThemePalette(themeKey, opts = {}) {
  if (themeKey === "Internet") {
    // Lava lamp: 2 harmonious vivid + 1 deliberately low/dark “base”
    const vivid1 = randomVividRgb();
    const vivid2 = randomVividRgbClose(vivid1, 35, 85);
    const low = randomLowRgb();
    const arr = shuffle3([vivid1, vivid2, low]);
    return { c1: arr[0], c2: arr[1], c3: arr[2] };
  }

  if (themeKey === "Snob") {
    const chaos = clamp(opts.snobChaos ?? 0, 0, 1);

    // blue-primary start palette
    const b1 = randInt(90, 150);
    const b2 = randInt(150, 220);
    const b3 = randInt(180, 255);
    const cStart1 = `rgb(${randInt(0, 45)},${randInt(10, 80)},${b1})`;
    const cStart2 = `rgb(${randInt(0, 55)},${randInt(20, 95)},${b2})`;
    const cStart3 = `rgb(${randInt(15, 85)},${randInt(40, 120)},${b3})`;

    if (chaos <= 0.0001) return { c1: cStart1, c2: cStart2, c3: cStart3 };

    // “after that”: wider random colors (still darkish so it fits the Snob mood)
    const chaosColor = () => {
      const r = randInt(10, 190);
      const g = randInt(10, 190);
      const b = randInt(10, 190);
      const m = rand(0.55, 0.85);
      return `rgb(${clampInt(r * m, 0, 255)},${clampInt(g * m, 0, 255)},${clampInt(b * m, 0, 255)})`;
    };

    const cChaos1 = chaosColor();
    const cChaos2 = chaosColor();
    const cChaos3 = chaosColor();

    return {
      c1: lerpColor(cStart1, cChaos1, chaos),
      c2: lerpColor(cStart2, cChaos2, chaos),
      c3: lerpColor(cStart3, cChaos3, chaos)
    };
  }

  if (themeKey === "Cinephile") {
    const dark1 = "rgb(6,6,8)";
    const dark2 = "rgb(14,12,10)";
    const metal = Math.random() < 0.5 ? "rgb(255,220,140)" : "rgb(210,225,240)";
    return { c1: dark1, c2: dark2, c3: metal };
  }

  if (themeKey === "Art") {
    // red-forward palette (blue introduced in draw via random-walk)
    const c1 = `rgb(${randInt(120, 220)},${randInt(0, 45)},${randInt(0, 65)})`;
    const c2 = `rgb(${randInt(70, 160)},${randInt(0, 35)},${randInt(0, 55)})`;
    const c3 = `rgb(${randInt(20, 80)},${randInt(0, 25)},${randInt(0, 40)})`;
    return { c1, c2, c3 };
  }

  if (themeKey === "Comfort") {
    const base = `rgb(${randInt(6, 25)},${randInt(6, 20)},${randInt(18, 40)})`;
    const neon1 = Math.random() < 0.5 ? "rgb(255,0,160)" : "rgb(0,220,255)";
    const neon2 = Math.random() < 0.5 ? "rgb(180,0,255)" : "rgb(0,255,160)";
    return { c1: base, c2: neon1, c3: neon2 };
  }

  // CLASSIC fallback
  return {
    c1: randomRgbWithZeroChannel(),
    c2: randomRgbWithZeroChannel(),
    c3: randomRgbWithZeroChannel()
  };
}

function themePaletteSpeed(themeKey, intensity) {
  const i = clamp(intensity, 1, 5);
  if (themeKey === "Internet") return 0.05 + 0.01 * (i - 1);
  if (themeKey === "Snob") return 0.06 + 0.05 * (i - 1);
  if (themeKey === "Cinephile") return 0.030 + 0.006 * (i - 1);
  if (themeKey === "Art") return 0.028 + 0.1 * (i - 1);
  if (themeKey === "Comfort") return 0.040 + 0.012 * (i - 1);
  return 0.030;
}

// ============================================================================
// Shared helpers
// ============================================================================

function resolveTheme(theme) {
  const t = String(theme || "").trim();
  if (!t) return THEMES.CLASSIC;
  if (t.toLowerCase() === "disney") return THEMES.CLASSIC;
  return THEMES[t] || THEMES.CLASSIC;
}

function intensityForLevel(level) {
  const L = Math.max(1, Math.floor(level || 1));
  if (L <= 3) return 1;
  if (L <= 6) return 2;
  if (L <= 9) return 3;
  if (L <= 12) return 4;
  return 5;
}

function fillFlat(ctx, w, h, color) {
  ctx.fillStyle = color || "rgb(0,0,0)";
  ctx.fillRect(0, 0, w, h);
}

function fillSeededGradient(ctx, w, h, c1, c2, c3, gp, alpha = 1) {
  const ax = (gp?.ax ?? 0.15) * w;
  const ay = (gp?.ay ?? 0.20) * h;
  const bx = (gp?.bx ?? 0.85) * w;
  const by = (gp?.by ?? 0.75) * h;

  const g = ctx.createLinearGradient(ax, ay, bx, by);
  g.addColorStop(0.0, c1);
  g.addColorStop(0.5, c2);
  g.addColorStop(1.0, c3);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function addVignette(ctx, w, h, strength) {
  const s = clamp(strength ?? 0.28, 0, 0.70);
  const vg = ctx.createRadialGradient(
    w * 0.5,
    h * 0.5,
    10,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.78
  );
  vg.addColorStop(0.0, "rgba(0,0,0,0)");
  vg.addColorStop(1.0, `rgba(0,0,0,${s})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function addFineNoise(ctx, w, h, alpha) {
  const a = clamp(alpha ?? 0.02, 0, 0.07);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(0,0,0,1)";
  const n = Math.floor(w * h * 0.00035);
  for (let i = 0; i < n; i++) {
    const x = (i * 97) % w;
    const y = (i * 193) % h;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

function drawSoftHaze(ctx, w, h, strength) {
  const s = clamp(strength ?? 0.12, 0, 0.35);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = s;

  const g1 = ctx.createRadialGradient(w * 0.35, h * 0.35, 0, w * 0.35, h * 0.35, Math.max(w, h) * 0.90);
  g1.addColorStop(0.0, "rgba(255,255,255,0.35)");
  g1.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = s * 0.8;
  const g2 = ctx.createRadialGradient(w * 0.70, h * 0.65, 0, w * 0.70, h * 0.65, Math.max(w, h) * 1.00);
  g2.addColorStop(0.0, "rgba(210,235,255,0.30)");
  g2.addColorStop(1.0, "rgba(210,235,255,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

function lerpPalette(pA, pB, t) {
  const a = pA || { c1: "rgb(0,0,0)", c2: "rgb(0,0,0)", c3: "rgb(0,0,0)" };
  const b = pB || a;
  return {
    c1: lerpColor(a.c1, b.c1, t),
    c2: lerpColor(a.c2, b.c2, t),
    c3: lerpColor(a.c3, b.c3, t)
  };
}

function randomRgbWithZeroChannel() {
  const zeroIdx = Math.floor(Math.random() * 3);
  const r = zeroIdx === 0 ? 0 : randInt(40, 255);
  const g = zeroIdx === 1 ? 0 : randInt(40, 255);
  const b = zeroIdx === 2 ? 0 : randInt(40, 255);
  return `rgb(${r},${g},${b})`;
}

function randomVividRgb() {
  const r = randInt(80, 255);
  const g = randInt(60, 255);
  const b = randInt(60, 255);
  return `rgb(${r},${g},${b})`;
}

function randomVividRgbClose(rgb, minShift, maxShift) {
  const c = parseRgb(rgb);
  const shift = () => randInt(minShift, maxShift) * (Math.random() < 0.5 ? -1 : 1);
  const r = clampInt(c.r + shift(), 50, 255);
  const g = clampInt(c.g + shift(), 40, 255);
  const b = clampInt(c.b + shift(), 40, 255);
  return `rgb(${r},${g},${b})`;
}

function randomLowRgb() {
  const base = randInt(0, 50);
  const r = clampInt(base + randInt(0, 40), 0, 80);
  const g = clampInt(base + randInt(0, 40), 0, 80);
  const b = clampInt(base + randInt(0, 40), 0, 90);
  return `rgb(${r},${g},${b})`;
}

function shuffle3(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function mixRgb(a, b, t) {
  return lerpColor(a, b, clamp(t, 0, 1));
}

function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function clampInt(v, a, b) { return Math.max(a, Math.min(b, Math.floor(v))); }
function mod(x, m) { const r = x % m; return r < 0 ? r + m : r; }
function smooth01(x) { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); }

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

function rgba(rgb, a) {
  const c = parseRgb(rgb);
  return `rgba(${c.r},${c.g},${c.b},${clamp(a, 0, 1)})`;
}
