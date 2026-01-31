// frontend/js/screens/select/selectLayout.js
//
// Select screen geometry + hitboxes (pure functions).
// Goal: keep select.js readable by moving layout math out.
//
// - NO GameState
// - NO movies/archetypes
// - NO Input
// - NO canvas rendering
//
// Everything here is computed from:
//   - SCREEN (W/H)
//   - SELECT_LAYOUT (aka L)
//
// NOTE: This module intentionally mirrors the math currently inside select.js
// so we can swap it in later with minimal risk.

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function getSelectAccessors(L) {
  // Keep these as functions to match your current select.js style.
  function C() {
    return (L && L.colors) || {};
  }
  function S() {
    return (L && L.slots) || {};
  }
  function bottom() {
    return (L && L.bottom) || {};
  }
  return { C, S, bottom };
}

// Poster aspect is WIDTH/HEIGHT (portrait: 2/3)
export function posterAspect(L) {
  const { S } = getSelectAccessors(L);
  const a = num(S()?.poster?.aspect, 2 / 3);
  return a > 0 ? a : 2 / 3;
}

// posterHeight = width / (width/height)
export function posterHForW(L, w) {
  const a = posterAspect(L);
  return Math.floor(num(w, 0) / a);
}

/**
 * visualSlotW():
 * Your select.js computes the slot width from the *visible poster width*,
 * not from slots.w, because older padding/inset existed.
 *
 * This function preserves that behavior exactly, using:
 *   w - 2*(padX + inset)
 *
 * If you later fully remove pad/inset from layout forever, this still works.
 */
export function visualSlotW(L) {
  const { S } = getSelectAccessors(L);

  const baseW = num(S()?.w, 80);
  const padX = num(S()?.poster?.padX, 0);
  const inset = num(S()?.poster?.inset, 0);

  const w = Math.floor(baseW - 2 * (padX + inset));
  return Math.max(24, w);
}

export function slotX({ i, SLOT_COUNT, SCREEN, L }) {
  const W = num(SCREEN?.W, 400);
  const { S } = getSelectAccessors(L);

  const sw = visualSlotW(L);
  const gap = num(S()?.gap, 13);

  const totalW = SLOT_COUNT * sw + (SLOT_COUNT - 1) * gap;
  const startX = Math.floor((W - totalW) / 2);

  return startX + i * (sw + gap);
}

// Full slot “card” is computed from its parts to avoid overlap.
export function slotCardRect({ i, SLOT_COUNT, SCREEN, L }) {
  const { S } = getSelectAccessors(L);

  const x = slotX({ i, SLOT_COUNT, SCREEN, L });
  const y = num(S()?.y, 96);
  const w = visualSlotW(L);

  const ah = num(S()?.arrowHitH, 18);
  const np = S()?.nameplate || {};
  const nh = num(np.h, 25);

  const pH = posterHForW(L, w);

  // remove the “bar” gap under posters (matches your current select.js)
  const gapNP = 0;

  // [top arrow] + [poster] + gap + [nameplate] + [bottom arrow]
  const h = ah + pH + gapNP + nh + ah;

  return { x, y, w, h };
}

export function topArrowRect({ i, SLOT_COUNT, SCREEN, L }) {
  const r = slotCardRect({ i, SLOT_COUNT, SCREEN, L });
  const { S } = getSelectAccessors(L);
  const ah = num(S()?.arrowHitH, 18);
  return { x: r.x, y: r.y, w: r.w, h: ah };
}

/**
 * Poster rect:
 * - uses full slot width
 * - height derived from aspect
 * - optional shrink inset (px on each side)
 */
export function posterRect({ i, SLOT_COUNT, SCREEN, L }) {
  const { S } = getSelectAccessors(L);

  const r = slotCardRect({ i, SLOT_COUNT, SCREEN, L });
  const ah = num(S()?.arrowHitH, 18);

  const shrink = num(S()?.poster?.shrink, 1);

  const fullW = r.w;
  const fullH = posterHForW(L, fullW);

  return {
    x: r.x + shrink,
    y: r.y + ah + shrink,
    w: Math.max(2, fullW - shrink * 2),
    h: Math.max(2, fullH - shrink * 2)
  };
}

export function nameplateRect({ i, SLOT_COUNT, SCREEN, L }) {
  const { S } = getSelectAccessors(L);

  const r = slotCardRect({ i, SLOT_COUNT, SCREEN, L });
  const ah = num(S()?.arrowHitH, 18);

  const np = S()?.nameplate || {};
  const nh = num(np.h, 25);

  const pH = posterHForW(L, r.w);
  const gapNP = 0;

  return { x: r.x, y: r.y + ah + pH + gapNP, w: r.w, h: nh };
}

export function bottomArrowRect({ i, SLOT_COUNT, SCREEN, L }) {
  const { S } = getSelectAccessors(L);

  const r = slotCardRect({ i, SLOT_COUNT, SCREEN, L });
  const npR = nameplateRect({ i, SLOT_COUNT, SCREEN, L });
  const ah = num(S()?.arrowHitH, 18);

  return { x: r.x, y: npR.y + npR.h, w: r.w, h: ah };
}

export function slotBounds({ i, SLOT_COUNT, SCREEN, L }) {
  return slotCardRect({ i, SLOT_COUNT, SCREEN, L });
}

export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

// -----------------------
// UI rect helpers
// -----------------------
export function searchRects({ SCREEN, L }) {
  const W = num(SCREEN?.W, 400);

  const sh = num(L?.search?.h, 20);
  const sw = num(L?.search?.w, 213);
  const btn = num(L?.search?.btn, 20);
  const gap = num(L?.search?.gap, 8);
  const y = num(L?.search?.y, 56);

  const x = Math.floor((W - sw) / 2);

  return {
    left: { x: x - btn - gap, y, w: btn, h: sh },
    mid: { x, y, w: sw, h: sh },
    right: { x: x + sw + gap, y, w: btn, h: sh }
  };
}

export function homeCornerRect({ SCREEN, L }) {
  const { bottom } = getSelectAccessors(L);

  const y = num(bottom()?.y, 272);
  const btn = num(bottom()?.cornerBtn, 23);
  const x = num(bottom()?.homeX, 10);

  // W currently unused but kept symmetrical with battleCornerRect
  return { x, y, w: btn, h: btn };
}

export function battleCornerRect({ SCREEN, L }) {
  const W = num(SCREEN?.W, 400);
  const { bottom } = getSelectAccessors(L);

  const y = num(bottom()?.y, 272);
  const btn = num(bottom()?.cornerBtn, 23);
  const homeX = num(bottom()?.homeX, 10);

  const x = W - homeX - btn;
  return { x, y, w: btn, h: btn };
}

export function archetypeBarRects({ SCREEN, L }) {
  const W = num(SCREEN?.W, 400);
  const { bottom } = getSelectAccessors(L);

  const by = num(bottom()?.archetype?.y, 272);
  const bh = num(bottom()?.archetype?.h, 23);
  const arrowW = num(bottom()?.archetype?.arrowW, 23);
  const sidePad = num(bottom()?.archetype?.sidePad, 13);
  const centerPad = num(bottom()?.archetype?.centerPad, 8);

  const home = homeCornerRect({ SCREEN, L });
  const barX = home.x + home.w + sidePad;
  const barW = W - barX * 2;

  const left = { x: barX, y: by, w: arrowW, h: bh };
  const right = { x: barX + barW - arrowW, y: by, w: arrowW, h: bh };
  const center = {
    x: barX + arrowW + centerPad,
    y: by,
    w: barW - (arrowW + centerPad) * 2,
    h: bh
  };

  return { bar: { x: barX, y: by, w: barW, h: bh }, left, right, center };
}

export function confirmBoxRect({ L }) {
  const helpY = num(L?.help?.y, 40);
  const r = (L && L.confirm && L.confirm.box) || {};
  return {
    x: num(r.x, 40),
    y: num(r.y, helpY + 6),
    w: num(r.w, 320),
    h: num(r.h, 18)
  };
}
