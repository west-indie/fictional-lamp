// frontend/js/screens/unlockArcOverlay.js
//
// Render-only unlock overlay for hidden archetype unlock moment.
// ✅ Native 400x300 (no legacy translate/scale)
// ✅ Positions are editable in layout.js

import { SCREEN, QUICKPLAY_LAYOUT, UNLOCK_OVERLAY_LAYOUT as L } from "../layout.js";

function drawPosterPlaceholder(ctx, movie, x, y, w, h) {
  ctx.strokeStyle = "#fff";
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = "#111";
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

  ctx.fillStyle = "#fff";
  ctx.font = "7px monospace";

  const t = String(movie?.title || "");
  const line1 = t.slice(0, 14);
  const line2 = t.slice(14, 28);

  ctx.fillText(line1, x + 3, y + h - 16);
  if (line2.trim()) ctx.fillText(line2, x + 3, y + h - 8);
}

export function renderUnlockArcOverlay(
  ctx,
  { width = SCREEN.W, height = SCREEN.H, archetypeName = "Unknown", party = [], codeLabel = "I → M → D → B" } = {}
) {
  // Dim overlay
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, 0, width, height);

  // Panel
  const px = L.panel.x;
  const py = L.panel.y;
  const pw = L.panel.w;
  const ph = L.panel.h;

  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#000";
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeRect(px, py, pw, ph);

  // Title
  ctx.fillStyle = "#ff0";
  ctx.font = "11px monospace";
  ctx.fillText("Secret Unlocked!", L.title.x, L.title.y);

  // Unlocked line
  ctx.fillStyle = "#fff";
  ctx.font = "8px monospace";
  ctx.fillText(`Unlocked: ${archetypeName}`, L.unlocked.x, L.unlocked.y);

  // Code label
  ctx.fillStyle = "#aaa";
  ctx.fillText(`${codeLabel}`, L.code.x, L.code.y);

  // Posters
  const posterW = QUICKPLAY_LAYOUT.poster.w;
  const posterH = QUICKPLAY_LAYOUT.poster.h;
  const gap = QUICKPLAY_LAYOUT.poster.gap;

  const safeParty = (party || []).slice(0, 4);
  const totalW = posterW * 4 + gap * 3;
  const startX = Math.floor((width - totalW) / 2);
  const y = L.posters.y;

  for (let i = 0; i < 4; i++) {
    const m = safeParty[i];
    if (!m) continue;
    const x = startX + i * (posterW + gap);
    drawPosterPlaceholder(ctx, m, x, y, posterW, posterH);
  }

  // Instructions
  ctx.fillStyle = "#fff";
  ctx.font = "8px monospace";
  ctx.fillText("Enter: Continue", L.footer.leftX, L.footer.y);
  ctx.fillText("Backspace: Back", L.footer.rightX, L.footer.y);
}
