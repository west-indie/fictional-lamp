// frontend/js/ui/battleBackgroundThemes/Internet.js
// Internet (Lava Lamp)

export function makeState({ srcW, srcH, intensity }, H) {
  return {
    blobs: makeLavaBlobs(18 + intensity * 3, srcW, srcH, H)
  };
}

export function tick(state, dt, intensity, sizes, H) {
  tickLavaBlobs(state.blobs, dt, 0.85 + 0.10 * intensity, sizes.srcW, sizes.srcH, H);
}

export function drawBase(ctx, w, h, pal, state, t, intensity, meta, H) {
  H.fillSeededGradient(ctx, w, h, pal.c1, pal.c2, pal.c3, meta.gradParams, 1.0);

  ctx.save();
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  drawLavaLamp(ctx, w, h, state.blobs, pal, t, intensity, H);

  H.drawSoftHaze(ctx, w, h, 0.12);
  H.addVignette(ctx, w, h, 0.22 + 0.03 * (intensity - 1));
  H.addFineNoise(ctx, w, h, 0.018);
}

// ---------------------------
// Internal (same logic as before)
// ---------------------------

function makeLavaBlobs(count, w, h, H) {
  const blobs = [];
  for (let i = 0; i < count; i++) {
    const big = Math.random() < 0.35;
    const r = big ? H.rand(60, 160) : H.rand(22, 70);
    const r2 = r * H.rand(0.82, 1.22);

    blobs.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: H.rand(-1, 1) * H.rand(10, 28),
      vy: H.rand(-1, 1) * H.rand(8, 22),
      r,
      r2,
      ph: Math.random() * Math.PI * 2,
      ph2: Math.random() * Math.PI * 2,
      w1: H.rand(0.12, 0.40),
      w2: H.rand(0.10, 0.34),

      jag: H.rand(0.04, 0.12),
      rot: H.rand(0, Math.PI * 2),
      wrot: H.rand(-0.22, 0.22),

      ax: H.rand(0.92, 1.08),
      ay: H.rand(0.92, 1.08),
      axT: H.rand(0.80, 1.25),
      ayT: H.rand(0.80, 1.25),
      aspectTimer: H.rand(0.6, 2.4),
      aspectHold: H.rand(1.0, 3.8),

      buoy: H.rand(-0.55, -0.15) * H.rand(10, 22)
    });
  }
  return blobs;
}

function tickLavaBlobs(blobs, dt, speedMul, w, h, H) {
  for (const b of blobs) {
    b.x += b.vx * dt * speedMul;
    b.y += (b.vy + b.buoy) * dt * speedMul;

    b.x = H.mod(b.x, w);
    b.y = H.mod(b.y, h);

    b.aspectTimer -= dt;
    if (b.aspectTimer <= 0) {
      b.axT = H.rand(0.80, 1.25);
      b.ayT = H.rand(0.80, 1.25);

      if (Math.random() < 0.22) {
        if (Math.random() < 0.5) b.axT *= H.rand(1.10, 1.35);
        else b.ayT *= H.rand(1.10, 1.35);
      }

      b.aspectTimer = b.aspectHold + H.rand(0.4, 2.2);
    }

    b.ax = H.lerp(b.ax, b.axT, 1 - Math.exp(-dt * 0.7));
    b.ay = H.lerp(b.ay, b.ayT, 1 - Math.exp(-dt * 0.7));
  }
}

function drawLavaLamp(ctx, w, h, blobs, pal, t, intensity, H) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  ctx.globalAlpha = 0.65 + 0.05 * (intensity - 1);
  for (let i = 0; i < blobs.length; i++) {
    const b = blobs[i];
    const col = i % 3 === 0 ? pal.c1 : i % 3 === 1 ? pal.c2 : pal.c3;

    const cx = b.x + Math.sin(t * b.w1 + b.ph) * 26;
    const cy = b.y + Math.cos(t * b.w2 + b.ph2) * 20;

    const rb = H.lerp(b.r, b.r2, H.smooth01(0.5 + 0.5 * Math.sin(t * 0.18 + b.ph)));
    const R = rb * 1.25;

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0.0, H.rgba(col, 0.75));
    g.addColorStop(0.55, H.rgba(col, 0.22));
    g.addColorStop(1.0, H.rgba(col, 0.0));

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.38 + 0.04 * (intensity - 1);
  for (let i = 0; i < blobs.length; i++) {
    const b = blobs[i];
    const col = i % 3 === 0 ? pal.c1 : i % 3 === 1 ? pal.c2 : pal.c3;

    const cx = b.x + Math.sin(t * b.w1 + b.ph) * 22;
    const cy = b.y + Math.cos(t * b.w2 + b.ph2) * 16;

    const rb = H.lerp(b.r, b.r2, H.smooth01(0.5 + 0.5 * Math.sin(t * 0.16 + b.ph2)));
    const rot = b.rot + t * b.wrot;

    ctx.fillStyle = H.rgba(col, 0.85);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(b.ax, b.ay);
    drawMutatingBlobShape(ctx, 0, 0, rb, t, b.jag, H);
    ctx.restore();
  }

  ctx.restore();
}

function drawMutatingBlobShape(ctx, cx, cy, r, t, jag, H) {
  const steps = 34;
  const j = H.clamp(jag, 0.03, 0.22);

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const n1 = Math.sin(a * 2.0 + t * 0.75) * j;
    const n2 = Math.sin(a * 3.0 - t * 0.55) * (j * 0.65);
    const n3 = Math.sin(a * 5.0 + t * 0.28) * (j * 0.35);
    const rr = r * (1 + n1 + n2 + n3);

    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
