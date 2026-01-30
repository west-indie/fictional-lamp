// frontend/js/ui/battleCharacterSlots.js
//
// PARTY + ENEMY renderer with posters next to stats.
// Updates:
// ✅ DEF moved to its own line (below ATK)
// ✅ Title wraps based on available width (reduces overlap)
// ✅ Text block vertically centered to poster (works for 4 or 5 lines)
// ✅ Arrow at top, centered within the slot (uses BATTLE_LAYOUT.party.dx)
//
// Assumes local posters live in: assets/posters/<movieId>.png (fallback .jpg)

const _posterCache = new Map();

function _getPosterImage(movieId) {
  if (!movieId) return null;

  let rec = _posterCache.get(movieId);
  if (rec) return rec;

  const img = new Image();
  rec = { img, ready: false, triedJpg: false };
  _posterCache.set(movieId, rec);

  img.onload = () => {
    rec.ready = true;
  };

  img.onerror = () => {
    if (!rec.triedJpg) {
      rec.triedJpg = true;
      img.src = `frontend/assets/posters/${movieId}.jpg`;
      return;
    }
  };

  img.src = `frontend/assets/posters/${movieId}.png`;
  return rec;
}

function _splitTitleTwoLines(title, maxCharsPerLine) {
  const t = (title || "").trim();
  if (!t) return ["", ""];

  const words = t.split(/\s+/);

  // --- Special case: first word is too long ---
  if (words[0].length > maxCharsPerLine) {
    const line1 = words[0].slice(0, maxCharsPerLine);
    const restOfFirst = words[0].slice(maxCharsPerLine);

    let line2 = restOfFirst;
    if (words.length > 1) {
      line2 += " " + words.slice(1).join(" ");
    }

    // Clamp line2 without cutting words (except the first-word remainder)
    if (line2.length > maxCharsPerLine) {
      const cut = line2.slice(0, maxCharsPerLine);
      const lastSpace = cut.lastIndexOf(" ");
      line2 = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
    }

    return [line1, line2];
  }

  // --- Normal word wrapping ---
  let line1 = "";
  let line2 = "";

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const candidate = line1 ? `${line1} ${w}` : w;

    if (candidate.length <= maxCharsPerLine) {
      line1 = candidate;
    } else {
      line2 = words.slice(i).join(" ");
      break;
    }
  }

  if (line2.length > maxCharsPerLine) {
    const cut = line2.slice(0, maxCharsPerLine);
    const lastSpace = cut.lastIndexOf(" ");
    line2 = lastSpace > 0 ? cut.slice(0, lastSpace) : "";
  }

  return [line1, line2];
}

export function renderBattleCharacterSlots(ctx, opts) {
  const { state, BATTLE_LAYOUT, indicatorIndex } = opts;

  ctx.font = "10px monospace";
  ctx.imageSmoothingEnabled = false;

  // Layout
  const GAP = 4;

  // Poster height is fixed (so text can be centered whether 4 or 5 lines)
  // Tune this if you want a taller/shorter overall slot.
  const POSTER_TOP_OFFSET = -2;
  const POSTER_H = 56; // tall enough for up to 5 lines comfortably
  const POSTER_W = Math.max(18, Math.round((POSTER_H * 2) / 3)); // ~2:3

  const LINE_H = 12;

  // Rough monospace width at 10px
  const CHAR_W = 6;

  state.party.forEach((member, i) => {
    if (!member) return;

    const x = BATTLE_LAYOUT.party.x + i * BATTLE_LAYOUT.party.dx;
    const y = BATTLE_LAYOUT.party.y;

    // Available slot width is dx (spacing between slots)
    const slotW = BATTLE_LAYOUT.party.dx;

    const posterX = x;
    const posterY = y + POSTER_TOP_OFFSET;

    const textX = posterX + POSTER_W + GAP;

    // ✅ Make text area narrower (prevents overlap) by using the real available space
    // Leave a tiny right pad so letters don't touch the next slot.
    const textW = Math.max(36, slotW - (POSTER_W + GAP) - 6);

    // Wrap titles based on width (fewer chars per line = less collision)
    const maxCharsPerLine = Math.max(10, Math.floor(textW / CHAR_W));

    const title = member.movie?.shortTitle || member.movie?.title || "Unknown";
    const [t1, t2] = _splitTitleTwoLines(title, maxCharsPerLine);

    // Build lines (4 or 5+ depending on title/status)
    const lines = [];
    lines.push(t1);
    if (t2) lines.push(t2); // only adds line 2 if it exists

    lines.push(`HP:${member.hp}`);
    lines.push(`ATK:${member.atk}`);
    lines.push(`DEF:${member.def}`);

    // If you still want SHD/DEFEND, it becomes a 6th line.
    // If you truly want max 5 lines always, delete this block.
    if (member.tempShield > 0) lines.push(`SHD: ${member.tempShield}`);
    else if (member.isDefending) lines.push("DEFEND");

    // ✅ Center the text block vertically relative to the poster
    const textBlockH = lines.length * LINE_H;
    const textStartY = posterY + Math.floor((POSTER_H - textBlockH) / 2) + (LINE_H - 2);

    // ✅ Arrow at TOP center of slot (poster + text together)
    const isHighlighted = i === indicatorIndex && state.phase === "player";
    if (isHighlighted) {
      ctx.fillStyle = "#ff0";
      ctx.fillText("▼", x + Math.floor(slotW / 2) - 3, posterY - 2);
    }

    // Poster box
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(posterX, posterY, POSTER_W, POSTER_H);

    // Poster (no border)
    const movieId = member.movie?.id;
    const rec = _getPosterImage(movieId);

    if (rec && rec.ready) {
    ctx.drawImage(rec.img, posterX, posterY, POSTER_W, POSTER_H);
    } else {
    ctx.fillStyle = "#111";
    ctx.fillRect(posterX, posterY, POSTER_W, POSTER_H);
    }


    // Draw text lines
    ctx.fillStyle = "#fff";
    for (let li = 0; li < lines.length; li++) {
      ctx.fillText(lines[li], textX, textStartY + li * LINE_H);
    }
  });

  // ENEMY (unchanged)
  if (state.enemy) {
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(
      BATTLE_LAYOUT.enemy.x,
      BATTLE_LAYOUT.enemy.y,
      BATTLE_LAYOUT.enemy.w,
      BATTLE_LAYOUT.enemy.h
    );

    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    ctx.fillText(state.enemy.name, BATTLE_LAYOUT.enemy.x + 10, BATTLE_LAYOUT.enemy.y + 15);

    ctx.font = "10px monospace";
    ctx.fillText(
      `HP: ${state.enemy.hp}/${state.enemy.maxHP}`,
      BATTLE_LAYOUT.enemy.x + 10,
      BATTLE_LAYOUT.enemy.y + 30
    );
  }
}
