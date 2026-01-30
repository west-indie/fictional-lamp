// frontend/js/ui/battleBackgoundThemes/Comfort.js
// Comfort (dark + fast + colorful: arcade/club dancefloor)
// NOTE: Stretch/elongation fix is in the shared warp (battleBackground.js)

export function makeState({ srcW, srcH, intensity }, H) {
  const tile = H.randInt(18, 28);
  const cols = Math.ceil(srcW / tile);
  const rows = Math.ceil(srcH / tile);

  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ph = Math.random() * Math.PI * 2;
      const sp = H.rand(0.8, 2.2) + 0.2 * intensity;

      const rotA = 0;
      const rotB = Math.random() < 0.35 ? Math.PI / 4 : 0;
      const roundA = H.rand(0.0, 0.25);
      const roundB = H.rand(0.0, 1.0);

      cells.push({
        x, y, ph, sp,

        rotA, rotB,
        roundA, roundB,
        morphT: Math.random(),
        morphSpeed: H.rand(0.10, 0.28),
        morphHold: H.rand(0.8, 2.6),
        morphTimer: H.rand(0.2, 2.0),

        colA: H.randInt(0, 2),
        colB: H.randInt(0, 2),
        colT: Math.random(),
        colSpeed: H.rand(0.10, 0.30),
        colHold: H.rand(0.8, 2.8),
        colTimer: H.rand(0.2, 2.4)
      });
    }
  }

  const dots = [];
  const dotCount = 28 + intensity * 10;
  for (let i = 0; i < dotCount; i++) {
    dots.push({
      x: Math.random() * srcW,
      y: Math.random() * srcH,
      vx: H.rand(-90, 90),
      vy: H.rand(-80, 80),
      r: H.rand(6, 22),
      ph: Math.random() * Math.PI * 2,
      w: H.rand(0.6, 1.8)
    });
  }

  return { tile, cols, rows, cells, dots };
}

export function tick(state, dt, intensity, _sizes, H) {
  for (const d of state.dots) {
    d.x = H.mod(d.x + d.vx * dt * (1.0 + 0.12 * intensity), 1e9);
    d.y = H.mod(d.y + d.vy * dt * (1.0 + 0.12 * intensity), 1e9);
  }

  for (const c of state.cells) {
    c.morphTimer -= dt;
    c.morphT = H.clamp(c.morphT + dt * c.morphSpeed, 0, 1);
    if (c.morphT >= 1 && c.morphTimer <= 0) {
      c.rotA = c.rotB;
      c.roundA = c.roundB;

      c.rotB = Math.random() < 0.40 ? Math.PI / 4 : 0;
      c.roundB = H.rand(0.0, 1.0);
      c.morphT = 0;
      c.morphSpeed = H.rand(0.10, 0.32) + 0.02 * intensity;
      c.morphTimer = c.morphHold + H.rand(0.4, 2.0);
    }

    c.colTimer -= dt;
    c.colT = H.clamp(c.colT + dt * c.colSpeed, 0, 1);
    if (c.colT >= 1 && c.colTimer <= 0) {
      c.colA = c.colB;
      c.colB = H.randInt(0, 2);
      c.colT = 0;
      c.colSpeed = H.rand(0.10, 0.30) + 0.02 * intensity;
      c.colTimer = c.colHold + H.rand(0.4, 2.0);
    }
  }
}

export function drawBase(ctx, w, h, pal, state, t, intensity, _meta, H) {
  // darker base
  H.fillFlat(ctx, w, h, "rgb(6,6,10)");
  H.fillSeededGradient(ctx, w, h, pal.c1, pal.c2, pal.c3, { ax: 0.10, ay: 0.10, bx: 0.90, by: 0.90 }, 0.35);

  // heavy darken
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  if (!state) return;

  const tile = state.tile;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // tiles
  for (const c of state.cells) {
    const x = c.x * tile;
    const y = c.y * tile;

    const p = 0.5 + 0.5 * Math.sin(t * c.sp + c.ph);

    const ca = c.colA === 0 ? pal.c1 : c.colA === 1 ? pal.c2 : pal.c3;
    const cb = c.colB === 0 ? pal.c1 : c.colB === 1 ? pal.c2 : pal.c3;
    const col = H.lerpColor(ca, cb, H.smooth01(c.colT));

    ctx.globalAlpha = 0.05 + 0.12 * p + 0.01 * (intensity - 1);

    const rot = H.lerp(c.rotA, c.rotB, H.smooth01(c.morphT));
    const round = H.lerp(c.roundA, c.roundB, H.smooth01(c.morphT));

    ctx.fillStyle = H.rgba(col, 1);
    drawMorphTile(ctx, x, y, tile - 1, rot, round, H);

    ctx.globalAlpha *= 0.55;
    ctx.strokeStyle = H.rgba(col, 1);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, tile - 1, tile - 1);
  }

  // floating dots
  for (let i = 0; i < state.dots.length; i++) {
    const d = state.dots[i];
    const px = H.mod(d.x + Math.sin(t * d.w + d.ph) * 40, w);
    const py = H.mod(d.y + Math.cos(t * d.w + d.ph) * 34, h);
    const rr = d.r * (0.8 + 0.2 * Math.sin(t * 1.3 + d.ph));

    const col = i % 3 === 0 ? pal.c2 : i % 3 === 1 ? pal.c3 : pal.c1;

    const g = ctx.createRadialGradient(px, py, 0, px, py, rr * 2.2);
    g.addColorStop(0.0, H.rgba(col, 0.35));
    g.addColorStop(0.5, H.rgba(col, 0.12));
    g.addColorStop(1.0, H.rgba(col, 0.0));

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, rr * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  H.addFineNoise(ctx, w, h, 0.016);
}

function drawMorphTile(ctx, x, y, size, rot, round01, H) {
  const cx = x + size * 0.5;
  const cy = y + size * 0.5;
  const r = H.clamp(round01, 0, 1) * (size * 0.5);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.translate(-size * 0.5, -size * 0.5);

  roundedRectPath(ctx, 0, 0, size, size, r);
  ctx.fill();

  ctx.restore();
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  if (rr <= 0.001) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
