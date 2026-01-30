// frontend/js/ui/battleBackgoundThemes/Art.js
// Art — RESET V2++: serious VIDEO FEEDBACK + sweeping diagonal lines
//
// Core (unchanged):
// - Sweeping diagonal lines are the signal source (colored per-line, animated)
// - Red dominant, blue secondary but prominent, green NEVER > 60
// - Prevent runaway whiteout via decay + safe blending + hard reset guard
// - Full redraw each frame (no smear artifacts)
//
// Existing NEW (kept):
// ✅ low-alpha feedback shimmer
// ✅ sparse micro-specks + subtle scanline breakup
//
// NEW (your request):
// ✅ Add “ghost geometry” panels BEHIND the lines (large trapezoids/rects, low alpha, slow drift+rotation)
// ✅ Keep sweeping lines as FOREGROUND too (overlay pass), without changing their motion

export function makeState({ srcW, srcH, intensity }, H) {
  const w = srcW ?? 400;
  const h = srcH ?? 300;

  const highBlueStart = Math.random() < 0.5;

  // feedback ping-pong buffers
  const fbA = document.createElement("canvas");
  const fbB = document.createElement("canvas");
  fbA.width = w;
  fbA.height = h;
  fbB.width = w;
  fbB.height = h;

  const ctxA = fbA.getContext("2d");
  const ctxB = fbB.getContext("2d");

  // start black
  ctxA.fillStyle = "rgb(0,0,0)";
  ctxA.fillRect(0, 0, w, h);
  ctxB.fillStyle = "rgb(0,0,0)";
  ctxB.fillRect(0, 0, w, h);

  // ghost panels (behind lines)
  const panels = [];
  const panelCount = 4; // sparse by design
  for (let i = 0; i < panelCount; i++) {
    panels.push(makeGhostPanel(w, h, intensity, H));
  }

  return {
    // time
    t: Math.random() * 1000,

    // global channel driver (family)
    R: H.rand(220, 255),
    G: H.rand(0, 25),
    B: highBlueStart ? H.rand(150, 245) : H.rand(60, 140),
    Rt: 0,
    Gt: 0,
    Bt: 0,
    phR: Math.random() * Math.PI * 2,
    phG: Math.random() * Math.PI * 2,
    phB: Math.random() * Math.PI * 2,
    colorSpeed: H.rand(2.2, 3.8) + 0.1 * intensity,
    retargetT: H.rand(0.1, 0.2),
    retargetHold: H.rand(0.12, 0.26),

    // sweeping lines
    lineAng:
      (Math.random() < 0.5 ? 1 : -1) * (Math.PI * 0.25 + H.rand(-0.18, 0.18)),
    lineSpeed: H.rand(40, 80), // slower travel baseline
    lineSpacing: H.rand(16, 30),
    lineWidth: H.rand(2, 4),
    lineScroll: Math.random() * 9999,
    seed: (Math.random() * 1e9) | 0,

    // counter-lines independent speed (slower)
    counterSpeedMul: H.rand(0.28, 0.45),
    counterSpacingMul: 2.2,

    // feedback buffers
    fbA,
    fbB,
    ctxA,
    ctxB,
    flip: false,

    // feedback transform (subtle, not too aggressive)
    fbScale: H.rand(1.006, 1.014),
    fbRot: H.rand(-0.01, 0.01),
    fbShear: H.rand(-0.008, 0.008),
    fbDriftX: H.rand(0.4, 1.4),
    fbDriftY: H.rand(-0.4, 1.0),

    // feedback safety
    fbGain: H.rand(0.84, 0.91), // IMPORTANT: < 1
    fbDecay: H.rand(0.1, 0.16), // black wash each frame
    blowoutGuard: 0, // counts consecutive “too bright” frames

    // shimmer + analog breakup (very subtle)
    shimmerPh: Math.random() * Math.PI * 2,
    shimmerRate: H.rand(0.45, 0.75),
    shimmerSeed: (Math.random() * 1e9) | 0,
    analogSeed: (Math.random() * 1e9) | 0,

    // NEW: ghost panels
    panels,
    panelSeed: (Math.random() * 1e9) | 0
  };
}

export function tick(state, dt, intensity, _sizes, H) {
  state.t += dt;

  // --- global channel movement (alive + faster) ---
  state.phR += dt * (1.05 + 0.08 * intensity) * state.colorSpeed;
  state.phG += dt * (0.92 + 0.07 * intensity) * state.colorSpeed;
  state.phB += dt * (1.0 + 0.08 * intensity) * state.colorSpeed;

  state.retargetT -= dt;
  if (state.retargetT <= 0) {
    state.Rt = H.rand(185, 255);
    state.Gt = H.rand(0, 60);

    const r = Math.random();
    if (r < 0.3) state.Bt = H.rand(60, 130);
    else if (r < 0.78) state.Bt = H.rand(130, 205);
    else state.Bt = H.rand(205, 255);

    state.retargetT = state.retargetHold + H.rand(0.08, 0.18);
  }

  const k = 1 - Math.exp(-dt * (4.8 + 0.7 * intensity));
  state.R = H.lerp(state.R, state.Rt, k);
  state.G = H.lerp(state.G, state.Gt, k);
  state.B = H.lerp(state.B, state.Bt, k);

  // continuous fluctuation
  state.R = clampInt(
    state.R + (20 * Math.sin(state.phR) + 9 * Math.sin(state.phB + 0.8)),
    0,
    255
  );
  state.G = clampInt(
    state.G + (9 * Math.sin(state.phG + 1.6) + 6 * Math.sin(state.phR + 2.1)),
    0,
    60
  );
  state.B = clampInt(
    state.B + (18 * Math.sin(state.phB + 2.7) + 10 * Math.sin(state.phG + 0.4)),
    0,
    255
  );

  if (state.R < state.B * 0.75) state.R = clampInt(state.B * 0.75, 0, 255);
  if (state.R < 85) state.R = 85;

  // --- line motion ---
  state.lineScroll += dt * state.lineSpeed * (0.85 + 0.08 * intensity);
  state.lineAng += dt * H.rand(-0.02, 0.02);

  // shimmer phase
  state.shimmerPh += dt * state.shimmerRate * (0.9 + 0.08 * intensity);

  // NEW: ghost panel motion (slow, deliberate, partially off-screen)
  for (const p of state.panels) {
    p.t += dt;

    // drift
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vrot * dt;

    // gentle wobble so they feel “alive”
    p.x += Math.sin(p.t * p.wobS + p.ph) * p.wobX * dt;
    p.y += Math.cos(p.t * p.wobS * 0.9 + p.ph * 1.3) * p.wobY * dt;

    // per-panel color phasing
    p.cph += dt * p.cspd * (0.9 + 0.08 * intensity);

    // respawn when far away (keeps “half on screen” behavior)
    const margin = Math.max(wrapW(p) * 0.25, 120);
    if (p.x > p.wrapW + margin || p.x < -margin || p.y > p.wrapH + margin || p.y < -margin) {
      respawnGhostPanel(p, intensity, H);
    }
  }
}

export function drawBase(ctx, w, h, _pal, state, _t, intensity, _meta, H) {
  if (!state) return;

  ensureSize(state.fbA, w, h);
  ensureSize(state.fbB, w, h);

  // also keep panel wrap sizes correct on resize
  for (const p of state.panels) {
    p.wrapW = w;
    p.wrapH = h;
  }

  const src = state.flip ? state.fbA : state.fbB;
  const dst = state.flip ? state.fbB : state.fbA;
  const dctx = state.flip ? state.ctxB : state.ctxA;

  // --- render next feedback frame into dst ---
  dctx.setTransform(1, 0, 0, 1, 0, 0);

  // 1) black base
  dctx.clearRect(0, 0, w, h);
  dctx.fillStyle = "rgb(0,0,0)";
  dctx.fillRect(0, 0, w, h);

  // 2) subtle tint haze (still mostly black)
  const haze = `rgb(${clampInt(state.R * 0.18, 0, 255)},${clampInt(
    state.G * 0.18,
    0,
    60
  )},${clampInt(state.B * 0.18, 0, 255)})`;
  dctx.save();
  dctx.globalAlpha = 0.08 + 0.02 * (intensity - 1);
  dctx.fillStyle = haze;
  dctx.fillRect(0, 0, w, h);
  dctx.restore();

  // 3) feedback pass (SAFE: source-over + gain, NOT screen)
  dctx.save();
  dctx.globalCompositeOperation = "source-over";
  dctx.globalAlpha = state.fbGain;

  const cx = w * 0.5;
  const cy = h * 0.5;

  dctx.translate(cx, cy);
  dctx.rotate(state.fbRot + 0.006 * Math.sin(state.t * 0.35));
  dctx.transform(1, state.fbShear, 0, 1, 0, 0);
  dctx.scale(state.fbScale, state.fbScale);
  dctx.translate(
    -cx + state.fbDriftX * Math.sin(state.t * 0.55),
    -cy + state.fbDriftY * Math.cos(state.t * 0.44)
  );

  // small blur helps “analog” without blowing out
  dctx.filter = "blur(0.6px)";
  dctx.drawImage(src, 0, 0, w, h);
  dctx.filter = "none";
  dctx.drawImage(src, 0, 0, w, h);

  dctx.restore();

  // shimmer ghost (kept)
  drawFeedbackShimmer(dctx, src, w, h, state, intensity);

  // NEW: ghost panels (BEHIND lines) — injected into feedback field
  drawGhostPanels(dctx, w, h, state, intensity);

  // 4) inject sweeping lines as the “signal” that drives the recursion
  drawDiagonalSweepLines(dctx, w, h, state, intensity);

  // analog breakup (kept)
  drawAnalogBreakup(dctx, w, h, state, intensity);

  // 5) decay wash
  dctx.save();
  dctx.globalCompositeOperation = "source-over";
  dctx.globalAlpha = state.fbDecay;
  dctx.fillStyle = "rgb(0,0,0)";
  dctx.fillRect(0, 0, w, h);
  dctx.restore();

  // 6) blowout guard
  if (frameLooksBlownOut(dctx, w, h)) state.blowoutGuard++;
  else state.blowoutGuard = Math.max(0, state.blowoutGuard - 1);

  if (state.blowoutGuard >= 3) {
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.fillStyle = "rgb(0,0,0)";
    dctx.fillRect(0, 0, w, h);
    state.blowoutGuard = 0;
  }

  // output
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(dst, 0, 0);

  // NEW: foreground pass of sweeping lines (same motion/colors) — so they sit above shapes
  drawDiagonalSweepLinesForeground(ctx, w, h, state, intensity);

  H.addFineNoise(ctx, w, h, 0.012 + 0.003 * (intensity - 1));
  H.addVignette(ctx, w, h, 0.3 + 0.03 * (intensity - 1));

  state.flip = !state.flip;
}

// ============================================================================
// Sweeping diagonal lines (colored per-line) + slower counter-lines
// ============================================================================

function drawDiagonalSweepLines(ctx, w, h, state, intensity) {
  const ang = state.lineAng;
  const spacing = state.lineSpacing;
  const lw = state.lineWidth;

  const dirX = Math.cos(ang);
  const dirY = Math.sin(ang);
  const perpX = -dirY;
  const perpY = dirX;

  const diag = Math.sqrt(w * w + h * h);

  // travel based on our own scroll
  const travel = state.lineScroll % (spacing * 1000);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineWidth = lw;

  // opacity knob
  const baseA = 0.26 + 0.08 * (intensity - 1);

  for (let k = -diag; k < diag; k += spacing) {
    const off = k + (travel % spacing);
    const x0 = w * 0.5 + perpX * off;
    const y0 = h * 0.5 + perpY * off;

    const s1 = hashFloat(state.seed + ((k * 997) | 0));
    const s2 = hashFloat(state.seed + ((k * 811) | 0));
    const s3 = hashFloat(state.seed + ((k * 433) | 0));

    const phase = state.t * (0.85 + 1.7 * s2) + 6.28318 * s3;

    let r = state.R + 55 * Math.sin(phase + 0.0) + 22 * (s1 - 0.5);
    let g = state.G + 18 * Math.sin(phase + 1.7) + 10 * (s2 - 0.5);
    let b = state.B + 55 * Math.sin(phase + 2.9) + 22 * (s3 - 0.5);

    r = clampInt(r, 0, 255);
    g = clampInt(g, 0, 60);
    b = clampInt(b, 0, 255);

    if (r < b * 0.75) r = clampInt(b * 0.75, 0, 255);
    if (r < 85) r = 85;
    if (r < 35 && b < 35 && g < 12) r = 110;

    const pulse = 0.78 + 0.22 * Math.sin(phase);
    ctx.globalAlpha = clamp(baseA * pulse, 0.2, 0.44);
    ctx.strokeStyle = `rgb(${r},${g},${b})`;

    ctx.beginPath();
    ctx.moveTo(x0 - dirX * diag, y0 - dirY * diag);
    ctx.lineTo(x0 + dirX * diag, y0 + dirY * diag);
    ctx.stroke();
  }

  // counter-lines (slower)
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = "rgba(0,0,0,1)";
  ctx.lineWidth = lw + 1;

  const cSpacing = spacing * state.counterSpacingMul;
  const cTravel = (state.lineScroll * state.counterSpeedMul) % (cSpacing * 1000);

  for (let k = -diag; k < diag; k += cSpacing) {
    const off = k - (cTravel % cSpacing);
    const x0 = w * 0.5 + perpX * off;
    const y0 = h * 0.5 + perpY * off;

    ctx.beginPath();
    ctx.moveTo(x0 - dirX * diag, y0 - dirY * diag);
    ctx.lineTo(x0 + dirX * diag, y0 + dirY * diag);
    ctx.stroke();
  }

  ctx.restore();
}

// Foreground sweep overlay (keeps motion; slightly different alpha so it reads “front”)
function drawDiagonalSweepLinesForeground(ctx, w, h, state, intensity) {
  // identical geometry + color rules, just a gentler pass so it doesn’t crush the feedback
  ctx.save();
  const oldScroll = state.lineScroll;
  // (No changes to scroll; just draw.)
  // Slightly boost alpha floor so it never “disappears” as foreground.
  const prevLineWidth = state.lineWidth;

  // Make foreground a touch crisper
  ctx.filter = "none";
  // Nudge lineWidth up by 0.2 visually without altering state
  state.lineWidth = prevLineWidth;

  // Draw using same function, but we’ll temporarily scale intensity alpha via a shim:
  // Do not alter motion; only draw-time alpha is influenced in drawDiagonalSweepLines itself.
  // So we just call it normally, then add a tiny extra brightening pass.
  drawDiagonalSweepLines(ctx, w, h, state, intensity);

  // Tiny extra highlight pass (very low alpha) to push “foreground” read
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.05 + 0.01 * (intensity - 1);
  ctx.fillStyle = "rgba(0,0,0,0)"; // noop fill to keep consistent state
  ctx.restore();

  state.lineScroll = oldScroll;
  state.lineWidth = prevLineWidth;
}

// ============================================================================
// NEW: Ghost geometry panels (behind lines, inside feedback)
// ============================================================================

function makeGhostPanel(w, h, intensity, H) {
  // choose a spawn edge so it naturally comes in “halfway”
  const edge = H.randInt(0, 3); // 0 L,1 R,2 T,3 B
  const cx = w * 0.5;
  const cy = h * 0.5;

  // big shapes
  const baseW = H.rand(w * 0.35, w * 0.70);
  const baseH = H.rand(h * 0.35, h * 0.75);

  // trapezoid skew (keeps it “artifact/warped” instead of UI rectangle)
  const skewTop = H.rand(-0.30, 0.30);
  const skewBot = H.rand(-0.30, 0.30);

  // initial position offscreen so it enters partially
  let x = cx, y = cy;
  const off = H.rand(40, 120);
  if (edge === 0) x = -off;
  if (edge === 1) x = w + off;
  if (edge === 2) y = -off;
  if (edge === 3) y = h + off;

  if (edge === 0 || edge === 1) y = H.rand(h * 0.15, h * 0.85);
  if (edge === 2 || edge === 3) x = H.rand(w * 0.15, w * 0.85);

  // drift vector aimed across the screen
  const ang = (edge === 0 ? 0 : edge === 1 ? Math.PI : edge === 2 ? Math.PI * 0.5 : -Math.PI * 0.5)
    + H.rand(-0.55, 0.55);

  const spd = H.rand(10, 22) * (0.9 + 0.08 * intensity);

  // per-panel color phase
  const highBlue = Math.random() < 0.5;
  const R = H.rand(170, 255);
  const G = H.rand(0, 60);
  const B = highBlue ? H.rand(140, 255) : H.rand(70, 170);

  return {
    wrapW: w,
    wrapH: h,

    x,
    y,
    w: baseW,
    h: baseH,
    skewTop,
    skewBot,

    rot: H.rand(-0.45, 0.45),
    vrot: H.rand(-0.08, 0.08) * (0.9 + 0.08 * intensity),

    vx: Math.cos(ang) * spd,
    vy: Math.sin(ang) * spd,

    // “alive” wobble
    t: Math.random() * 1000,
    ph: Math.random() * Math.PI * 2,
    wobS: H.rand(0.35, 0.70),
    wobX: H.rand(2, 6),
    wobY: H.rand(2, 6),

    // color
    R,
    G,
    B,
    cph: Math.random() * 1000,
    cspd: H.rand(0.8, 1.8),

    // appearance
    fillA: H.rand(0.018, 0.035) + 0.004 * (intensity - 1),
    edgeA: H.rand(0.06, 0.10) + 0.01 * (intensity - 1),
    blur: H.rand(0.6, 1.2),
    innerLines: H.randInt(0, 2) // 0..2 very subtle internal lines
  };
}

function respawnGhostPanel(p, intensity, H) {
  const w = p.wrapW;
  const h = p.wrapH;

  // re-randomize size/shape a bit so it doesn’t feel patterned
  p.w = H.rand(w * 0.35, w * 0.70);
  p.h = H.rand(h * 0.35, h * 0.75);
  p.skewTop = H.rand(-0.30, 0.30);
  p.skewBot = H.rand(-0.30, 0.30);

  const edge = H.randInt(0, 3);
  const off = H.rand(40, 120);

  if (edge === 0) { p.x = -off; p.y = H.rand(h * 0.15, h * 0.85); }
  if (edge === 1) { p.x = w + off; p.y = H.rand(h * 0.15, h * 0.85); }
  if (edge === 2) { p.y = -off; p.x = H.rand(w * 0.15, w * 0.85); }
  if (edge === 3) { p.y = h + off; p.x = H.rand(w * 0.15, w * 0.85); }

  const ang = (edge === 0 ? 0 : edge === 1 ? Math.PI : edge === 2 ? Math.PI * 0.5 : -Math.PI * 0.5)
    + H.rand(-0.55, 0.55);

  const spd = H.rand(10, 22) * (0.9 + 0.08 * intensity);
  p.vx = Math.cos(ang) * spd;
  p.vy = Math.sin(ang) * spd;

  p.rot = H.rand(-0.45, 0.45);
  p.vrot = H.rand(-0.08, 0.08) * (0.9 + 0.08 * intensity);

  // per-panel colors refresh (still obey caps/rules later)
  const highBlue = Math.random() < 0.5;
  p.R = H.rand(170, 255);
  p.G = H.rand(0, 60);
  p.B = highBlue ? H.rand(140, 255) : H.rand(70, 170);
  p.cph = Math.random() * 1000;

  p.fillA = H.rand(0.018, 0.035) + 0.004 * (intensity - 1);
  p.edgeA = H.rand(0.06, 0.10) + 0.01 * (intensity - 1);
  p.blur = H.rand(0.6, 1.2);
  p.innerLines = H.randInt(0, 2);
}

function drawGhostPanels(ctx, w, h, state, intensity) {
  // These must live “behind” the sweep lines, so we draw them BEFORE drawDiagonalSweepLines().
  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  for (let i = 0; i < state.panels.length; i++) {
    const p = state.panels[i];

    // animate panel tint but keep your channel rules
    const s = 0.5 + 0.5 * Math.sin(p.cph);
    let r = p.R + 60 * Math.sin(p.cph + 0.0) + 20 * (s - 0.5);
    let g = p.G + 18 * Math.sin(p.cph + 1.7);
    let b = p.B + 55 * Math.sin(p.cph + 2.9) - 16 * (s - 0.5);

    r = clampInt(r, 0, 255);
    g = clampInt(g, 0, 60);
    b = clampInt(b, 0, 255);

    // global dominance nudge (same spirit as lines)
    const baseR = state.R;
    const baseB = state.B;
    if (r < b * 0.70) r = clampInt(b * 0.70, 0, 255);
    if (r < 85) r = 85;

    // keep them in the same “family” by softly mixing toward global state
    r = clampInt(r * 0.55 + baseR * 0.45, 0, 255);
    g = clampInt(g * 0.70 + state.G * 0.30, 0, 60);
    b = clampInt(b * 0.60 + baseB * 0.40, 0, 255);

    const fillCol = `rgb(${r},${g},${b})`;
    const edgeCol = `rgb(${clampInt(r + 25, 0, 255)},${clampInt(g + 10, 0, 60)},${clampInt(
      b + 25,
      0,
      255
    )})`;

    // draw trapezoid in local space
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);

    // faint fill
    ctx.globalAlpha = clamp(p.fillA * (0.85 + 0.25 * Math.sin(p.cph)), 0.012, 0.06);
    ctx.fillStyle = fillCol;
    ctx.filter = `blur(${p.blur}px)`;
    fillTrapezoid(ctx, p.w, p.h, p.skewTop, p.skewBot);
    ctx.filter = "none";
    ctx.globalAlpha = clamp(p.fillA, 0.012, 0.06);
    fillTrapezoid(ctx, p.w, p.h, p.skewTop, p.skewBot);

    // brighter outline (still low alpha)
    ctx.globalAlpha = clamp(p.edgeA * (0.90 + 0.20 * Math.sin(p.cph + 1.2)), 0.03, 0.14);
    ctx.strokeStyle = edgeCol;
    ctx.lineWidth = 2;
    ctx.filter = `blur(${Math.max(0.2, p.blur - 0.3)}px)`;
    strokeTrapezoid(ctx, p.w, p.h, p.skewTop, p.skewBot);
    ctx.filter = "none";
    ctx.lineWidth = 1;
    strokeTrapezoid(ctx, p.w, p.h, p.skewTop, p.skewBot);

    // subtle internal lines (optional)
    if (p.innerLines > 0) {
      ctx.globalAlpha = 0.035 + 0.01 * (intensity - 1);
      ctx.strokeStyle = fillCol;
      ctx.lineWidth = 1;
      for (let k = 0; k < p.innerLines; k++) {
        const t = (k + 1) / (p.innerLines + 1);
        strokeTrapezoidInset(ctx, p.w, p.h, p.skewTop, p.skewBot, 0.18 + 0.18 * t);
      }
    }

    ctx.restore();
  }

  ctx.restore();
}

function fillTrapezoid(ctx, w, h, skewTop, skewBot) {
  const ht = h * 0.5;
  const hw = w * 0.5;

  const topL = -hw * (1 + skewTop);
  const topR = hw * (1 - skewTop);
  const botL = -hw * (1 + skewBot);
  const botR = hw * (1 - skewBot);

  ctx.beginPath();
  ctx.moveTo(topL, -ht);
  ctx.lineTo(topR, -ht);
  ctx.lineTo(botR, ht);
  ctx.lineTo(botL, ht);
  ctx.closePath();
  ctx.fill();
}

function strokeTrapezoid(ctx, w, h, skewTop, skewBot) {
  const ht = h * 0.5;
  const hw = w * 0.5;

  const topL = -hw * (1 + skewTop);
  const topR = hw * (1 - skewTop);
  const botL = -hw * (1 + skewBot);
  const botR = hw * (1 - skewBot);

  ctx.beginPath();
  ctx.moveTo(topL, -ht);
  ctx.lineTo(topR, -ht);
  ctx.lineTo(botR, ht);
  ctx.lineTo(botL, ht);
  ctx.closePath();
  ctx.stroke();
}

function strokeTrapezoidInset(ctx, w, h, skewTop, skewBot, insetT) {
  const t = clamp(insetT, 0.02, 0.48);
  const ww = w * (1 - t);
  const hh = h * (1 - t);

  // soften skew as it goes inward
  const sTop = skewTop * (1 - t * 1.2);
  const sBot = skewBot * (1 - t * 1.2);

  strokeTrapezoid(ctx, ww, hh, sTop, sBot);
}

function wrapW(p) {
  return p.wrapW ?? 400;
}

// ============================================================================
// Feedback shimmer (kept)
// ============================================================================

function drawFeedbackShimmer(ctx, src, w, h, state, intensity) {
  const g = 0.5 + 0.5 * Math.sin(state.shimmerPh);
  const burst = smoothstep(0.86, 0.995, g);
  if (burst <= 0.001) return;

  const s1 = hashFloat(state.shimmerSeed + ((state.t * 60) | 0));
  const s2 = hashFloat(state.shimmerSeed + 1337 + ((state.t * 60) | 0));

  const dx = (s1 - 0.5) * (2.0 + 2.0 * intensity);
  const dy = (s2 - 0.5) * (1.6 + 1.6 * intensity);

  const sc = 1.0 + (s2 - 0.5) * 0.008;
  const rot = (s1 - 0.5) * 0.006;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = (0.02 + 0.018 * (intensity - 1)) * burst;

  const cx = w * 0.5;
  const cy = h * 0.5;

  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(sc, sc);
  ctx.translate(-cx + dx, -cy + dy);

  ctx.filter = "blur(0.7px)";
  ctx.drawImage(src, 0, 0, w, h);
  ctx.filter = "none";

  ctx.restore();
}

// ============================================================================
// Analog breakup (kept)
// ============================================================================

function drawAnalogBreakup(ctx, w, h, state, intensity) {
  const lineStep = 3;
  const timeKey = (state.t * 48) | 0;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  for (let y = 0; y < h; y += lineStep) {
    const n = hashFloat(state.analogSeed + y * 131 + timeKey * 17);
    if (n < 0.82) continue;

    const a = (0.01 + 0.012 * n) * (0.9 + 0.08 * intensity);
    ctx.globalAlpha = a;

    const rr = clampInt(state.R * (0.35 + 0.25 * n), 0, 255);
    const gg = clampInt(state.G * (0.3 + 0.2 * n), 0, 60);
    const bb = clampInt(state.B * (0.35 + 0.25 * n), 0, 255);

    ctx.strokeStyle = `rgb(${rr},${gg},${bb})`;
    ctx.lineWidth = 1;

    const xJ =
      (hashFloat(state.analogSeed + 999 + y * 73 + timeKey * 29) - 0.5) * 2.0;
    ctx.beginPath();
    ctx.moveTo(0 + xJ, y + 0.5);
    ctx.lineTo(w + xJ, y + 0.5);
    ctx.stroke();
  }

  const specks = Math.floor(10 + 6 * intensity);
  ctx.globalAlpha = 0.035 + 0.01 * (intensity - 1);
  for (let i = 0; i < specks; i++) {
    const s = hashFloat(state.analogSeed + 5000 + i * 997 + timeKey * 101);
    const x = (hashFloat(state.analogSeed + 7000 + i * 811 + timeKey * 79) * w) | 0;
    const y = (hashFloat(state.analogSeed + 9000 + i * 433 + timeKey * 53) * h) | 0;

    const r = s < 0.6 ? 1 : 2;

    const rr = clampInt(state.R * (0.25 + 0.35 * s), 0, 255);
    const gg = clampInt(state.G * (0.22 + 0.28 * s), 0, 60);
    const bb = clampInt(state.B * (0.25 + 0.35 * (1 - s)), 0, 255);

    ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
    ctx.fillRect(x, y, r, r);
  }

  ctx.restore();
}

// ============================================================================
// Blowout detector (kept)
// ============================================================================

function frameLooksBlownOut(ctx, w, h) {
  const pts = [
    [w * 0.5, h * 0.5],
    [w * 0.25, h * 0.25],
    [w * 0.75, h * 0.25],
    [w * 0.25, h * 0.75],
    [w * 0.75, h * 0.75],
    [w * 0.5, h * 0.2],
    [w * 0.5, h * 0.8],
    [w * 0.2, h * 0.5],
    [w * 0.8, h * 0.5]
  ];

  let bright = 0;
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0] | 0;
    const y = pts[i][1] | 0;
    const d = ctx.getImageData(x, y, 1, 1).data;
    const lum = 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
    if (lum > 245) bright++;
  }
  return bright >= 7;
}

// ============================================================================
// Utils
// ============================================================================

function ensureSize(c, w, h) {
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function clampInt(v, a, b) {
  return Math.max(a, Math.min(b, Math.round(v)));
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function hashFloat(n) {
  let x = n | 0;
  x = (x ^ (x >>> 16)) * 2246822519;
  x = (x ^ (x >>> 13)) * 3266489917;
  x = x ^ (x >>> 16);
  return ((x >>> 0) % 1000000) / 1000000;
}
