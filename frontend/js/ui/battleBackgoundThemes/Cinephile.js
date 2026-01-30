// frontend/js/ui/battleBackgoundThemes/Cinephile.js
// Cinephile (moving gold/silver bokeh, more circles + one much brighter)

export function makeState({ width, height, intensity }, H) {
  const count = 26 + intensity * 6;
  const circles = [];
  for (let i = 0; i < count; i++) {
    circles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: H.rand(-12, 12),
      vy: H.rand(-10, 10),
      r: H.rand(10, 54),
      r2: H.rand(8, 46),
      ph: Math.random() * Math.PI * 2,
      w: H.rand(0.10, 0.30)
    });
  }
  return {
    circles,
    brightIndex: H.randInt(0, Math.max(0, circles.length - 1)),
    metalT: Math.random() * Math.PI * 2,
    metalSpeed: H.rand(0.55, 1.15),
    sweepAng: H.rand(0, Math.PI * 2),
    sweepSpeed: H.rand(14, 28)
  };
}

export function tick(state, dt, intensity, sizes, H) {
  state.metalT += dt * state.metalSpeed;

  for (const c of state.circles) {
    c.x = H.mod(c.x + c.vx * dt * (1.0 + 0.10 * intensity), sizes.width);
    c.y = H.mod(c.y + c.vy * dt * (1.0 + 0.10 * intensity), sizes.height);
  }
}

export function drawBase(ctx, w, h, _pal, state, t, intensity, _meta, H) {
  // Dark base with subtle movement via sweeping light
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0.0, "rgb(6,6,8)");
  g.addColorStop(0.5, "rgb(14,12,10)");
  g.addColorStop(1.0, "rgb(6,6,10)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Moving “light sweep”
  const sweep = document.createElement("canvas");
  sweep.width = w;
  sweep.height = h;
  const sctx = sweep.getContext("2d");

  sctx.clearRect(0, 0, w, h);
  const ang = state ? state.sweepAng : 0.0;
  const spd = state ? state.sweepSpeed : 18;
  const off = (t * spd) % (w + h);

  sctx.save();
  sctx.translate(w * 0.5, h * 0.5);
  sctx.rotate(ang);
  sctx.translate(-w * 0.5, -h * 0.5);

  const sg = sctx.createLinearGradient(-w, off - h, w * 2, off + h);
  sg.addColorStop(0.0, "rgba(255,255,255,0)");
  sg.addColorStop(0.45, "rgba(255,255,255,0.08)");
  sg.addColorStop(0.55, "rgba(255,255,255,0.08)");
  sg.addColorStop(1.0, "rgba(255,255,255,0)");
  sctx.fillStyle = sg;
  sctx.fillRect(-w, -h, w * 3, h * 3);
  sctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.55;
  ctx.drawImage(sweep, 0, 0);
  ctx.restore();

  if (!state) return;

  // Circles: gold + silver mix that fluctuates
  const metalMix = 0.5 + 0.5 * Math.sin(state.metalT);
  const gold = { r: 255, g: 220, b: 140 };
  const silver = { r: 210, g: 225, b: 240 };
  const metal = {
    r: Math.round(H.lerp(gold.r, silver.r, metalMix)),
    g: Math.round(H.lerp(gold.g, silver.g, metalMix)),
    b: Math.round(H.lerp(gold.b, silver.b, metalMix))
  };

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.70 + 0.04 * (intensity - 1);

  for (let i = 0; i < state.circles.length; i++) {
    const c = state.circles[i];
    const rr0 = H.lerp(c.r, c.r2, H.smooth01(0.5 + 0.5 * Math.sin(t * c.w + c.ph)));

    const isBright = i === state.brightIndex;
    const rr = isBright ? rr0 * 1.45 : rr0;

    const px = c.x;
    const py = c.y;

    const grd = ctx.createRadialGradient(px, py, 0, px, py, rr);
    if (isBright) {
      grd.addColorStop(0.0, `rgba(${metal.r},${metal.g},${metal.b},0.55)`);
      grd.addColorStop(0.35, `rgba(${metal.r},${metal.g},${metal.b},0.20)`);
      grd.addColorStop(1.0, `rgba(${metal.r},${metal.g},${metal.b},0.0)`);
    } else {
      grd.addColorStop(0.0, `rgba(${metal.r},${metal.g},${metal.b},0.22)`);
      grd.addColorStop(0.55, `rgba(${metal.r},${metal.g},${metal.b},0.10)`);
      grd.addColorStop(1.0, `rgba(${metal.r},${metal.g},${metal.b},0.0)`);
    }

    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(px, py, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  H.addFineNoise(ctx, w, h, 0.016);
}
