// frontend/js/ui/genreStyle.js
//
// Shared genre styling helpers (colors + drawing).
// Keep this UI-focused so multiple screens can share it.

const GENRE_COLORS = {
  ACTION: "#ffcc66",
  ADVENTURE: "#ffd966",
  DRAMA: "#b0c4de",
  COMEDY: "#fff176",
  HORROR: "#ff6b6b",
  THRILLER: "#ff9f80",
  MYSTERY: "#c3aed6",
  SCIFI: "#7ee7ff",
  FANTASY: "#c792ff",
  ANIMATION: "#7dffb2",
  CRIME: "#d0d0d0",
  ROMANCE: "#ff9ad5",
  MUSICAL: "#ffb86b",
  DOCUMENTARY: "#a8e6cf",
  UNKNOWN: "#bbbbbb"
};

export function getGenreColor(genre) {
  const g = String(genre || "").trim().toUpperCase();
  return GENRE_COLORS[g] || GENRE_COLORS.UNKNOWN;
}

// Centered, colored genre line.
// If secondary is missing, just draws primary centered.
// If both exist, draws "PRIMARY / SECONDARY" with primary+secondary colored and slash gray.
export function drawCenteredGenres(ctx, primary, secondary, cx, y, fontPx = 9) {
  const p = String(primary || "").trim().toUpperCase();
  const s = String(secondary || "").trim().toUpperCase();

  const bad = new Set(["", "NONE", "UNKNOWN", "NULL", "UNSET"]);

  ctx.font = `${fontPx}px monospace`;

  // Only one
  if (!bad.has(p) && (bad.has(s) || s === p)) {
    const textW = ctx.measureText(p).width;
    ctx.fillStyle = getGenreColor(p);
    ctx.fillText(p, Math.floor(cx - textW / 2), y);
    return;
  }

  // Secondary only (rare)
  if (bad.has(p) && !bad.has(s)) {
    const textW = ctx.measureText(s).width;
    ctx.fillStyle = getGenreColor(s);
    ctx.fillText(s, Math.floor(cx - textW / 2), y);
    return;
  }

  // Both
  const slash = " / ";
  const wP = ctx.measureText(p).width;
  const wS = ctx.measureText(s).width;
  const wSlash = ctx.measureText(slash).width;

  const total = wP + wSlash + wS;
  let x = Math.floor(cx - total / 2);

  ctx.fillStyle = getGenreColor(p);
  ctx.fillText(p, x, y);
  x += wP;

  ctx.fillStyle = "#999";
  ctx.fillText(slash, x, y);
  x += wSlash;

  ctx.fillStyle = getGenreColor(s);
  ctx.fillText(s, x, y);
}
