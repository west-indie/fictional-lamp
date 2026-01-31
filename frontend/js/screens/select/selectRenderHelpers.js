// frontend/js/screens/select/selectRenderHelpers.js
//
// Canvas-only helpers for select screen.

export function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || "").trim().split(/\s+/);
  let line = "";
  let lineCount = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line ? line + " " + words[n] : words[n];
    const w = ctx.measureText(testLine).width;

    if (w > maxWidth && line) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = words[n];
      lineCount++;
      if (lineCount >= 2) return;
    } else {
      line = testLine;
    }
  }

  if (line) ctx.fillText(line, x, y + lineCount * lineHeight);
}

export function fitTextByShrinking(ctx, text, maxWidth, startPx = 11, minPx = 8) {
  const s = String(text || "");
  for (let px = startPx; px >= minPx; px--) {
    ctx.font = `${px}px monospace`;
    if (ctx.measureText(s).width <= maxWidth) return { text: s, px };
  }

  ctx.font = `${minPx}px monospace`;
  const ell = "…";
  if (ctx.measureText(s).width <= maxWidth) return { text: s, px: minPx };

  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = s.slice(0, mid) + ell;
    if (ctx.measureText(candidate).width <= maxWidth) lo = mid + 1;
    else hi = mid;
  }
  const cut = Math.max(0, lo - 1);
  return { text: s.slice(0, cut) + ell, px: minPx };
}

export function getNameplateTitle(movie) {
  if (!movie) return "Unknown";
  const s = String(movie.shortTitle || "").trim();
  if (s) return s;
  return String(movie.title || "Unknown");
}

export function getLocalPosterPath(movie) {
  const id = movie?.id ? String(movie.id) : "";
  if (!id) return null;
  return `frontend/assets/posters/${id}.jpg`;
}

// Special poster art (tokens passed in; genre map passed in)
export function drawSpecialPoster(ctx, pr, v, { C, SLOT_TOKEN_BLANK, SLOT_TOKEN_RANDOM, GENRE_TOKEN_TO_DEF }) {
  ctx.save();
  try {
    if (v === SLOT_TOKEN_BLANK) return;

    const isRandom = v === SLOT_TOKEN_RANDOM;
    const def = GENRE_TOKEN_TO_DEF.get(v);

    const qx = pr.x + Math.floor(pr.w / 2);
    const qy = pr.y + Math.floor(pr.h * 0.42);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = C().textDim || "#aaa";
    ctx.font = "46px monospace";
    ctx.fillText("?", qx, qy);

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C().posterLoading || "#666";

    if (isRandom) {
      ctx.font = "12px monospace";
      ctx.fillText("Random", qx, qy + 28);
      return;
    }

    if (def) {
      ctx.font = "11px monospace";
      ctx.fillText("Random:", qx, qy + 24);
      ctx.fillText(String(def.genre || "").toUpperCase(), qx, qy + 38);
      return;
    }
  } finally {
    ctx.restore();
  }
}
