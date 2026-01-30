// frontend/js/ui/battleBackgoundThemes/Classic.js
// Classic fallback (kept identical behavior, just moved out)

export function makeState(_sizes, _H) {
  return {};
}

export function tick(_state, _dt, _intensity, _sizes, _H) {
  // Classic has no persistent actors
}

export function drawBase(ctx, w, h, pal, _state, t, _intensity, meta, H) {
  const gp = meta?.gradParams ?? { ax: 0.18, ay: 0.22, bx: 0.82, by: 0.74 };
  H.fillSeededGradient(ctx, w, h, pal.c1, pal.c2, pal.c3, gp, 1.0);

  // soft diagonal bands (less defined)
  const layer = document.createElement("canvas");
  layer.width = w;
  layer.height = h;
  const l = layer.getContext("2d");
  l.clearRect(0, 0, w, h);
  l.globalAlpha = 0.08;
  const bandW = 52;
  const ang = 0.25 + 0.10 * Math.sin(t * 0.18);
  for (let x = -h; x < w + h; x += bandW) {
    l.fillStyle = "rgba(0,0,0,1)";
    l.save();
    l.translate(x, 0);
    l.rotate(ang);
    l.fillRect(0, 0, bandW * 0.55, h * 2);
    l.restore();
  }
  ctx.save();
  ctx.filter = "blur(2px)";
  ctx.drawImage(layer, 0, 0);
  ctx.restore();

  // blobs
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 190; i++) {
    const r = 10 + ((i * 37) % 61);
    const px = ((i * 97) % 997) / 997 * w;
    const py = ((i * 193) % 991) / 991 * h;
    const col =
      i % 3 === 0 ? "rgba(120,255,255,1)" :
      i % 3 === 1 ? "rgba(255,120,255,1)" :
      "rgba(255,255,120,1)";

    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  H.addFineNoise(ctx, w, h, 0.018);
  H.addVignette(ctx, w, h, 0.26);
}
