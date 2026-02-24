// frontend/js/ui/battleMenus.js
// Module D: render + shared layout helpers for battle command/item/special menus.
// Behavior is intended to match the original inline helpers in screens/battle.js.

import {
  BATTLE_MENU_LABELS,
  buildNoSpecialsMenuLine
} from "../battleText/engines/corePrompts.js";

// ===== shared geometry =====
const COMMAND_ASPECT_W = 11;
const COMMAND_ASPECT_H = 5;
const ROW_GAP = 5;

const MINI_GAP_Y = 4;
const MINI_H_MIN = 14;
const MINI_H_MAX = 18;

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function getRowMetrics({ SCREEN, BATTLE_LAYOUT, slotCount }) {
  const padX = BATTLE_LAYOUT.command.x;
  const usableW = SCREEN.W - padX * 2;
  const gaps = ROW_GAP * (slotCount - 1);

  const buttonW = Math.floor((usableW - gaps) / slotCount);
  const buttonH = clamp(Math.round(buttonW * (COMMAND_ASPECT_H / COMMAND_ASPECT_W)), 20, 26);

  return { padX, usableW, buttonW, buttonH };
}

export function getRowButtonX(BATTLE_LAYOUT, slotIndex, buttonW) {
  const padX = BATTLE_LAYOUT.command.x;
  return padX + slotIndex * (buttonW + ROW_GAP);
}

// ===== page dots =====
export function drawPageDots(ctx, { xCenter, y, pageIndex, pageCount, dotRadius = 2, gap = 7 }) {
  if (pageCount <= 1) return;

  const totalWidth = (pageCount - 1) * gap;
  const startX = xCenter - totalWidth / 2;

  for (let i = 0; i < pageCount; i++) {
    const cx = startX + i * gap;

    if (i === pageIndex) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx, y, dotRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// ===== mini buttons =====
function getCanonicalMiniMetrics({ SCREEN, BATTLE_LAYOUT, itemSlotsPerPage }) {
  const { buttonW, buttonH } = getRowMetrics({ SCREEN, BATTLE_LAYOUT, slotCount: itemSlotsPerPage });
  const miniW = Math.floor(buttonW / 2);
  const miniH = clamp(Math.round(buttonH * 0.65), MINI_H_MIN, MINI_H_MAX);
  return { miniW, miniH };
}

export function getTopMiniRects({ SCREEN, BATTLE_LAYOUT, uiBaseY, slotCount, buttonW, itemSlotsPerPage }) {
  const { miniW, miniH } = getCanonicalMiniMetrics({ SCREEN, BATTLE_LAYOUT, itemSlotsPerPage });

  const firstX = getRowButtonX(BATTLE_LAYOUT, 0, buttonW);
  const lastX = getRowButtonX(BATTLE_LAYOUT, slotCount - 1, buttonW);

  const y = uiBaseY - miniH - MINI_GAP_Y;

  const backRect = { x: firstX, y, w: miniW, h: miniH };

  // right edge aligned to last button's right edge
  const rightX = lastX + buttonW - miniW;
  const rightRect = { x: rightX, y, w: miniW, h: miniH };

  return { backRect, rightRect };
}

export function drawMiniButton(ctx, rect, label, isHot = false) {
  const { x, y, w, h } = rect;

  ctx.fillStyle = "#000";
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = isHot ? "#ff0" : "#fff";
  ctx.strokeRect(x, y, w, h);

  ctx.font = "7px monospace";
  ctx.fillStyle = isHot ? "#ff0" : "#fff";

  const tx = x + 4;
  const ty = y + Math.floor(h * 0.68);
  ctx.fillText(label, tx, ty);
}

export function drawTopMiniButtons(
  ctx,
  {
    SCREEN,
    BATTLE_LAYOUT,
    uiBaseY,
    slotCount,
    buttonW,
    itemSlotsPerPage,
    rightLabel,
    hotBack = false,
    hotRight = false
  }
) {
  const { backRect, rightRect } = getTopMiniRects({
    SCREEN,
    BATTLE_LAYOUT,
    uiBaseY,
    slotCount,
    buttonW,
    itemSlotsPerPage
  });

  drawMiniButton(ctx, backRect, BATTLE_MENU_LABELS.back, hotBack);
  drawMiniButton(ctx, rightRect, rightLabel, hotRight);

  return { backRect, rightRect };
}

export function drawDotsAboveRightMini(ctx, rightRect, { pageIndex, pageCount }) {
  if (pageCount <= 1) return;

  const xCenter = rightRect.x + Math.floor(rightRect.w * 0.75);
  const y = rightRect.y - 6;

  drawPageDots(ctx, { xCenter, y, pageIndex, pageCount });
}

// ===== text helpers =====
export function drawTwoLineButtonTextAdaptive(ctx, line1, line2, x, y, w, h) {
  const pad = 4;

  const l1 = (line1 || "").trim();
  const l2 = (line2 || "").trim();

  if (l2) {
    const y1 = y + Math.floor(h * 0.45);
    const y2 = y + Math.floor(h * 0.8);

    ctx.fillText(l1, x + pad, y1);
    ctx.fillText(l2, x + pad, y2);
  } else {
    const y1 = y + Math.floor(h * 0.65);
    ctx.fillText(l1, x + pad, y1);
  }
}

export function wrapToTwoLines(ctx, text, maxWidth) {
  const t = (text || "").trim();
  if (!t) return ["", ""];

  if (ctx.measureText(t).width <= maxWidth) return [t, ""];

  const words = t.split(/\s+/);
  if (words.length === 1) {
    for (let i = 1; i < t.length; i++) {
      const a = t.slice(0, i);
      if (ctx.measureText(a).width > maxWidth) {
        const a2 = t.slice(0, Math.max(1, i - 1));
        const b2 = t.slice(Math.max(1, i - 1));
        return [a2, b2];
      }
    }
    return [t.slice(0, Math.floor(t.length / 2)), t.slice(Math.floor(t.length / 2))];
  }

  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const wa = ctx.measureText(a).width;
    const wb = ctx.measureText(b).width;
    if (wa <= maxWidth && wb <= maxWidth) {
      const score = Math.abs(wa - wb);
      if (!best || score < best.score) best = { a, b, score };
    }
  }

  if (best) return [best.a, best.b];

  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

// ===== menu renderers =====
export function drawCommandMenu(ctx, { SCREEN, BATTLE_LAYOUT, uiBaseY, actions, state, hover }) {
  const confirming = state.uiMode === "confirm" && !!state.confirmAction;
  const { buttonW, buttonH } = getRowMetrics({ SCREEN, BATTLE_LAYOUT, slotCount: actions.length });

  actions.forEach((a, i) => {
    const bx = getRowButtonX(BATTLE_LAYOUT, i, buttonW);
    const by = uiBaseY;

    const isCursor = i === state.actionIndex && state.phase === "player";
    const isLocked = confirming && a === state.confirmAction;
    const isDisabled = confirming && a !== state.confirmAction;
    const isHover = hover?.kind === "action" && hover?.index === i;

    // ✅ Updated highlight style:
    // Selected/locked -> black bg, yellow border, yellow text
    if (isLocked) {
      ctx.fillStyle = "#000";
      ctx.fillRect(bx, by, buttonW, buttonH);
      ctx.strokeStyle = "#ff0";
    } else if (isDisabled) {
      ctx.fillStyle = "#111";
      ctx.fillRect(bx, by, buttonW, buttonH);
      ctx.strokeStyle = "#555";
    } else if (isCursor) {
      ctx.fillStyle = "#000";
      ctx.fillRect(bx, by, buttonW, buttonH);
      ctx.strokeStyle = "#ff0";
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(bx, by, buttonW, buttonH);
      ctx.strokeStyle = isHover ? "#ff0" : "#fff";
    }

    ctx.strokeRect(bx, by, buttonW, buttonH);

    ctx.font = "9px monospace";
    if (isDisabled) ctx.fillStyle = "#777";
    else if (isLocked || isCursor) ctx.fillStyle = "#ff0";
    else ctx.fillStyle = "#fff";

    ctx.fillText(a, bx + 4, by + Math.floor(buttonH * 0.65));
  });
}

export function drawConfirmMiniButtonsIfNeeded(ctx, { SCREEN, BATTLE_LAYOUT, uiBaseY, actions, itemSlotsPerPage, state, hover }) {
  if (state.uiMode !== "confirm") return;

  const a = state.confirmAction;
  if (a !== "ATTACK" && a !== "DEFEND" && a !== "RUN") return;

  const { buttonW } = getRowMetrics({ SCREEN, BATTLE_LAYOUT, slotCount: actions.length });
  drawTopMiniButtons(ctx, {
    SCREEN,
    BATTLE_LAYOUT,
    uiBaseY,
    slotCount: actions.length,
    buttonW,
    itemSlotsPerPage,
    rightLabel: BATTLE_MENU_LABELS.confirm,
    hotBack: hover?.kind === "miniBack",
    hotRight: hover?.kind === "miniRight"
  });
}

export function drawPauseMiniIfNeeded(ctx, { SCREEN, BATTLE_LAYOUT, uiBaseY, actions, itemSlotsPerPage, state, hover }) {
  if (state.uiMode !== "command") return;
  if (state.phase !== "player" && state.phase !== "enemy") return;

  const { buttonW } = getRowMetrics({ SCREEN, BATTLE_LAYOUT, slotCount: actions.length });
  const { backRect } = getTopMiniRects({
    SCREEN,
    BATTLE_LAYOUT,
    uiBaseY,
    slotCount: actions.length,
    buttonW,
    itemSlotsPerPage
  });

  const hot = hover?.kind === "pause";
  drawMiniButton(ctx, backRect, BATTLE_MENU_LABELS.pause, hot);
}

export function drawItemMenuLikeCommandRow(ctx, {
  SCREEN,
  BATTLE_LAYOUT,
  uiBaseY,
  itemSlotsPerPage,
  getItemPageCount,
  getItemPageStart,
  getInventoryItemDef,
  state,
  hover,
  itemsPageIndex
}) {
  const pageCount = getItemPageCount();
  const pageStart = getItemPageStart(itemsPageIndex);

  const { buttonW, buttonH } = getRowMetrics({ SCREEN, BATTLE_LAYOUT, slotCount: itemSlotsPerPage });

  const { rightRect } = drawTopMiniButtons(ctx, {
    SCREEN,
    BATTLE_LAYOUT,
    uiBaseY,
    slotCount: itemSlotsPerPage,
    buttonW,
    itemSlotsPerPage,
    rightLabel: BATTLE_MENU_LABELS.toggle,
    hotBack: hover?.kind === "miniBack",
    hotRight: hover?.kind === "miniRight"
  });

  if (pageCount > 1) {
    drawDotsAboveRightMini(ctx, rightRect, { pageIndex: itemsPageIndex, pageCount });
  }

  for (let slot = 0; slot < itemSlotsPerPage; slot++) {
    const bx = getRowButtonX(BATTLE_LAYOUT, slot, buttonW);
    const by = uiBaseY;

    const idx = pageStart + slot;
    const hasItem = idx < state.inventory.length;
    const isSelected = hasItem && idx === state.itemIndex && state.phase === "player";
    const isHover = hover?.kind === "itemSlot" && hover?.index === slot;

    if (isSelected) {
      // ✅ Updated highlight style: black bg + yellow border
      ctx.fillStyle = "#000";
      ctx.fillRect(bx, by, buttonW, buttonH);
      ctx.strokeStyle = "#ff0";
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(bx, by, buttonW, buttonH);
      if (isHover && hasItem) ctx.strokeStyle = "#ff0";
      else ctx.strokeStyle = hasItem ? "#fff" : "#555";
    }

    ctx.strokeRect(bx, by, buttonW, buttonH);
    if (!hasItem) continue;

    const entry = state.inventory[idx];
    const def = getInventoryItemDef(entry);
    const itemId = String(def?.id || entry?.id || "");
    const itemCd = Math.max(0, Math.floor(Number(state?.itemCooldowns?.[itemId] || 0)));
    const itemType = String(def?.type || "").trim().toLowerCase();
    const sharedWeaponCd = itemType === "reusableweapon"
      ? Math.max(0, Math.floor(Number(state?.itemCooldowns?.__weapon__ || 0)))
      : 0;
    const cooldownRemaining = Math.max(itemCd, sharedWeaponCd);
    const isOnCooldown = cooldownRemaining > 0;

    const label = def ? def.shortTitle || def.name : BATTLE_MENU_LABELS.unknown;
    const line1 = (label || BATTLE_MENU_LABELS.item).slice(0, 14);
    const line2 = isOnCooldown
      ? `Cooldown: ${cooldownRemaining}`
      : (itemType === "reusableweapon" ? "Active" : `x${entry.count}`);

    ctx.font = "8px monospace";
    if (isOnCooldown) {
      ctx.strokeStyle = "#555";
      ctx.strokeRect(bx, by, buttonW, buttonH);
      ctx.fillStyle = "#777";
    } else {
      // ✅ Selected item text becomes yellow; others remain white (old behavior)
      ctx.fillStyle = isSelected ? "#ff0" : "#fff";
    }
    drawTwoLineButtonTextAdaptive(ctx, line1, line2, bx, by, buttonW, buttonH);
  }
}

export function drawSpecialMenu(ctx, {
  SCREEN,
  BATTLE_LAYOUT,
  uiBaseY,
  itemSlotsPerPage,
  state,
  hover,
  canToggleSpecialPages,
  getSpecialPageCount,
  wrapToTwoLinesFn = wrapToTwoLines,
  getCurrentActor
}) {
  ctx.font = "8px monospace";

  if (!state.specialsList || state.specialsList.length === 0) {
    ctx.fillStyle = "#fff";
    ctx.fillText(buildNoSpecialsMenuLine(), BATTLE_LAYOUT.command.x, uiBaseY + 22);
    return;
  }

  const count = state.specialsList.length;
  const { buttonW, buttonH } = getRowMetrics({ SCREEN, BATTLE_LAYOUT, slotCount: count });

  const { rightRect } = drawTopMiniButtons(ctx, {
    SCREEN,
    BATTLE_LAYOUT,
    uiBaseY,
    slotCount: count,
    buttonW,
    itemSlotsPerPage,
    rightLabel: BATTLE_MENU_LABELS.toggle,
    hotBack: hover?.kind === "miniBack",
    hotRight: hover?.kind === "miniRight"
  });

  state.specialsList.forEach((sp, i) => {
    const bx = getRowButtonX(BATTLE_LAYOUT, i, buttonW);
    const by = uiBaseY;
    const isSelected = i === state.specialIndex;
    const isHover = hover?.kind === "specialSlot" && hover?.index === i;

    const ready = !!sp.ready;

    if (isSelected && state.phase === "player") {
      // ✅ Updated highlight style: black bg + yellow border (even if not ready)
      ctx.fillStyle = "#000";
      ctx.fillRect(bx, by, buttonW, buttonH);
      ctx.strokeStyle = "#ff0";
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(bx, by, buttonW, buttonH);
      if (isHover && ready) ctx.strokeStyle = "#ff0";
      else ctx.strokeStyle = ready ? "#fff" : "#555";
    }

    ctx.strokeRect(bx, by, buttonW, buttonH);

    ctx.font = "8px monospace";
    // ✅ Selected special text becomes yellow (matches command highlight)
    if (isSelected && state.phase === "player") ctx.fillStyle = "#ff0";
    else ctx.fillStyle = ready ? "#fff" : "#777";

    const maxTextW = buttonW - 8;
    const [l1, l2] = wrapToTwoLinesFn(ctx, sp.name || BATTLE_MENU_LABELS.special, maxTextW);
    drawTwoLineButtonTextAdaptive(ctx, l1, l2, bx, by, buttonW, buttonH);
  });

  const actor = getCurrentActor();
  if (canToggleSpecialPages(actor)) {
    const pageCount = getSpecialPageCount(actor.movie.id);
    if (pageCount > 1 && state.specialsList.length > 0) {
      drawDotsAboveRightMini(ctx, rightRect, {
        pageIndex: state.specialsPageIndex,
        pageCount
      });
    }
  }
}
