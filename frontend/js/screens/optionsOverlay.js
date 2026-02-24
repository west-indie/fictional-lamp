// frontend/js/screens/optionsOverlay.js
//
// Options/Pause overlay (EarthBound-ish), styled like unlockArcOverlay.
//
// ✅ Two contexts:
//    - battle: Continue + Music slider + SFX slider (NO Reset)
//    - menu:   Continue + Music slider + SFX slider + Reset
//
// ✅ Center aligned group (x + y)
// ✅ Hover highlight turns yellow (text + full slider)
// ✅ Left/Right adjusts hovered slider
// ✅ NEW: 0..7 levels (0 = mute, 7 = max)
// ✅ Enter selects Continue/Reset
// ✅ Backspace/Escape closes
//
// NOTE:
// - Persists levels to localStorage.
// - Includes a migration path from old 1..7 saved values.
//
// Requested adjustments (render-only, minimal changes):
// ✅ "Options" title pinned to panel top-left at x:12, y:24, 15px monospace, WHITE
// ✅ Move "Music" / "SFX" labels ABOVE their sliders
// ✅ Center-align each slider to the Continue button (same center X)
// ✅ Reduce label<->slider gap (no overlap)
// ✅ Treat EACH slider as its own "option block":
//    spacing between blocks matches the normal option spacing (rowGap)
//    meaning: Continue -> Music block -> SFX block -> Reset
//    and within a slider block: label and slider are close, not separated by a full rowGap

import { SCREEN } from "../layout.js";
import { getGenreColor } from "../ui/genreStyle.js";

// LocalStorage keys (NEW — 0..7)
const LS_MUSIC_LVL = "LS_OPTIONS_MUSIC_LEVEL_0_7";
const LS_SFX_LVL = "LS_OPTIONS_SFX_LEVEL_0_7";

// Old keys (from previous version, 1..7)
const OLD_LS_MUSIC_LVL = "LS_OPTIONS_MUSIC_LEVEL_1_7";
const OLD_LS_SFX_LVL = "LS_OPTIONS_SFX_LEVEL_1_7";

const LEVEL_MIN = 0;
const LEVEL_MAX = 7;

// Clamp helper
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Map 0..7 -> 0..1
function levelToGain01(level0to7) {
  const l = clamp(level0to7 | 0, LEVEL_MIN, LEVEL_MAX);
  return l / LEVEL_MAX;
}

// Map 0..1 -> 0..7
function gain01ToLevel(g) {
  const gg = clamp(+g || 0, 0, 1);
  return clamp(Math.round(gg * LEVEL_MAX), LEVEL_MIN, LEVEL_MAX);
}

function safeGetLS(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLS(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {}
}

function loadLevel0to7(key0to7, fallbackLevel0to7) {
  const raw = safeGetLS(key0to7);
  const n = Number(raw);
  if (!Number.isFinite(n)) return clamp(fallbackLevel0to7, LEVEL_MIN, LEVEL_MAX);
  return clamp(Math.round(n), LEVEL_MIN, LEVEL_MAX);
}

function saveLevel0to7(key0to7, level0to7) {
  safeSetLS(key0to7, String(clamp(level0to7 | 0, LEVEL_MIN, LEVEL_MAX)));
}

// ✅ Migrate old 1..7 values -> 0..7 (simple: new = old - 1)
function migrateOldLevelIfNeeded(newKey, oldKey) {
  const already = safeGetLS(newKey);
  if (already != null) return; // already migrated / set

  const rawOld = safeGetLS(oldKey);
  const oldN = Number(rawOld);

  if (!Number.isFinite(oldN)) return;

  // old was 1..7; new is 0..7
  const migrated = clamp(Math.round(oldN) - 1, LEVEL_MIN, LEVEL_MAX);
  safeSetLS(newKey, String(migrated));
}

// ======================================================
// ✅ INPUT ADAPTER (matches your engine)
// ======================================================
function pressed(Input, key) {
  if (!Input) return false;

  if (typeof Input.pressed === "function") {
    try {
      return !!Input.pressed(key);
    } catch {
      return false;
    }
  }

  if (typeof Input.wasPressed === "function") return !!Input.wasPressed(key);
  if (typeof Input.isPressedOnce === "function") return !!Input.isPressedOnce(key);

  if (Input.justPressed && typeof Input.justPressed === "object") {
    if (key in Input.justPressed) return !!Input.justPressed[key];
  }

  if (Input.pressed && typeof Input.pressed === "object") {
    if (key in Input.pressed) return !!Input.pressed[key];
  }

  return false;
}

function consume(Input, key) {
  if (!Input) return;
  if (typeof Input.consume === "function") {
    try {
      Input.consume(key);
    } catch {}
  }
}

function pressedAny(Input, keys) {
  for (const k of keys) {
    if (pressed(Input, k)) {
      consume(Input, k);
      return true;
    }
  }
  return false;
}

// Aliases that match your existing screens
const UP_KEYS = ["Up", "ArrowUp"];
const DOWN_KEYS = ["Down", "ArrowDown"];
const LEFT_KEYS = ["Left", "ArrowLeft"];
const RIGHT_KEYS = ["Right", "ArrowRight"];
const CONFIRM_KEYS = ["Confirm", "Enter", "Space"];
const BACK_KEYS = ["Back", "Backspace", "Escape"];

// Minimal text measure helper
function measureText(ctx, text, font) {
  ctx.save();
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width);
  ctx.restore();
  return w;
}

function fitTextWithEllipsis(ctx, text, maxW) {
  const raw = String(text || "");
  if (maxW <= 0) return "";
  if (ctx.measureText(raw).width <= maxW) return raw;
  const ellipsis = "...";
  const ellipsisW = ctx.measureText(ellipsis).width;
  if (ellipsisW >= maxW) return "";
  let out = raw;
  while (out.length > 0 && (ctx.measureText(out).width + ellipsisW) > maxW) {
    out = out.slice(0, -1);
  }
  return out + ellipsis;
}

function wrapTextLines(ctx, text, maxW, maxLines = 2) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const out = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const candidate = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(candidate).width <= maxW) {
      line = candidate;
      continue;
    }
    if (line) out.push(line);
    line = words[i];
    if (out.length >= maxLines - 1) break;
  }
  if (out.length < maxLines && line) out.push(line);
  if (out.length > maxLines) out.length = maxLines;
  if (out.length === maxLines) {
    const consumed = out.join(" ").split(/\s+/).filter(Boolean).length;
    if (consumed < words.length) {
      out[maxLines - 1] = fitTextWithEllipsis(ctx, out[maxLines - 1], maxW);
    }
  }
  return out;
}

function normalizeGenre(value) {
  const g = String(value || "").trim().toUpperCase();
  if (!g || g === "NONE" || g === "NULL" || g === "UNSET") return "";
  return g;
}

function isBattleInfoCard(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && "title" in value && "level" in value;
}

const BATTLE_INFO_CARD_H = 72;
const BATTLE_INFO_BLOCK_H = 94;
const BATTLE_INFO_TO_MENU_GAP = -16;

export function createOptionsOverlay({
  width = SCREEN.W,
  height = SCREEN.H,

  // callbacks
  onClose = null,
  onReset = null,
  onSetMusicGain = null, // 0..1
  onSetSfxGain = null, // 0..1
  getBattleInfoLines = null,

  // initial gains (optional)
  initialMusicGain01 = null,
  initialSfxGain01 = null
} = {}) {
  migrateOldLevelIfNeeded(LS_MUSIC_LVL, OLD_LS_MUSIC_LVL);
  migrateOldLevelIfNeeded(LS_SFX_LVL, OLD_LS_SFX_LVL);

  function getPanelDims() {
    return state.context === "battle"
      ? { w: 340, h: 290 }
      : { w: 270, h: 165 };
  }

  const FONT_TITLE_PINNED = "15px monospace";
  const FONT_ITEM = "10px monospace";
  const FONT_HINT = "8px monospace";

  const INNER = {
    rowGap: 8,
    sliderW: 140,
    sliderH: 10
  };

  const state = {
    isOpen: false,
    context: "menu",
    index: 0,
    musicLevel: 7,
    sfxLevel: 7
  };

  const DEFAULT_MUSIC_LEVEL = 4;
  const DEFAULT_SFX_LEVEL = 7;

  if (initialMusicGain01 != null) {
    state.musicLevel = gain01ToLevel(initialMusicGain01);
    saveLevel0to7(LS_MUSIC_LVL, state.musicLevel);
  } else {
    state.musicLevel = loadLevel0to7(LS_MUSIC_LVL, DEFAULT_MUSIC_LEVEL);
  }

  if (initialSfxGain01 != null) {
    state.sfxLevel = gain01ToLevel(initialSfxGain01);
    saveLevel0to7(LS_SFX_LVL, state.sfxLevel);
  } else {
    state.sfxLevel = loadLevel0to7(LS_SFX_LVL, DEFAULT_SFX_LEVEL);
  }

  function syncAudio() {
    const m = levelToGain01(state.musicLevel);
    const s = levelToGain01(state.sfxLevel);
    if (typeof onSetMusicGain === "function") onSetMusicGain(m);
    if (typeof onSetSfxGain === "function") onSetSfxGain(s);
  }
  syncAudio();

  // For layout: treat sliders as "blocks" so spacing is consistent.
  function getItems() {
    const base = [
      { type: "action", id: "continue", label: "Continue" },
      { type: "slider", id: "music", label: "Music" },
      { type: "slider", id: "sfx", label: "SFX" }
    ];
    if (state.context === "menu") base.push({ type: "action", id: "reset", label: "Reset" });
    return base;
  }

  function open({ context = "menu" } = {}) {
    state.isOpen = true;
    state.context = context === "battle" ? "battle" : "menu";
    state.index = 0;

    // ✅ IMPORTANT:
    // Overlays can be opened from different screens that each keep their own instance.
    // Always refresh from localStorage on open so UI + audio reflect the latest user choice.
    migrateOldLevelIfNeeded(LS_MUSIC_LVL, OLD_LS_MUSIC_LVL);
    migrateOldLevelIfNeeded(LS_SFX_LVL, OLD_LS_SFX_LVL);

    state.musicLevel = loadLevel0to7(LS_MUSIC_LVL, DEFAULT_MUSIC_LEVEL);
    state.sfxLevel = loadLevel0to7(LS_SFX_LVL, DEFAULT_SFX_LEVEL);

    syncAudio();
  }

  function close() {
    if (!state.isOpen) return;
    state.isOpen = false;
    if (typeof onClose === "function") onClose();
  }

  function computeItemHitLayout(ctx, items) {
    const PANEL = getPanelDims();
    const INNER = { rowGap: 8, sliderW: 140, sliderH: 10 };

    const rowH = 12;
    const sliderLabelGap = 4;
    const sliderBlockH = rowH + sliderLabelGap + INNER.sliderH;

    const px = Math.floor((width - PANEL.w) / 2);
    const py = Math.floor((height - PANEL.h) / 2);

    const blocks = items.map((it) => (it.type === "slider" ? sliderBlockH : rowH));
    const totalH = blocks.reduce((a, b) => a + b, 0) + (items.length - 1) * INNER.rowGap;
    const infoLines = state.context === "battle" && typeof getBattleInfoLines === "function"
      ? (getBattleInfoLines() || [])
      : [];
    const hasCards = Array.isArray(infoLines) && infoLines.some(isBattleInfoCard);
    const infoCount = Array.isArray(infoLines) ? Math.min(infoLines.length, 6) : 0;
    const infoBlockH = state.context === "battle"
      ? (hasCards ? BATTLE_INFO_BLOCK_H : (8 + infoCount * 10 + 6))
      : 0;
    const startY = state.context === "battle"
      ? (py + 34 + infoBlockH + BATTLE_INFO_TO_MENU_GAP)
      : (py + Math.floor((PANEL.h - totalH) / 2) + 4);

    const centerX = px + Math.floor(PANEL.w / 2);
    const sliderX = centerX - Math.floor(INNER.sliderW / 2);

    let cy = startY;
    const rects = [];

    // Use a safe ctx for measurement only; caller may pass a real ctx or null.
    const measureCtx = ctx;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const isLast = i === items.length - 1;

      if (it.type === "action") {
        // Hitbox: full row across the panel interior
        rects.push({
          i,
          type: "action",
          id: it.id,
          block: { x: px + 10, y: cy, w: PANEL.w - 20, h: rowH },
          slider: null
        });
        cy += rowH;
        if (!isLast) cy += INNER.rowGap;
        continue;
      }

      if (it.type === "slider") {
        const sliderY = cy + rowH + sliderLabelGap;
        rects.push({
          i,
          type: "slider",
          id: it.id,
          block: { x: px + 10, y: cy, w: PANEL.w - 20, h: sliderBlockH },
          slider: { x: sliderX, y: sliderY, w: INNER.sliderW, h: INNER.sliderH }
        });
        cy += sliderBlockH;
        if (!isLast) cy += INNER.rowGap;
      }
    }

    return { px, py, panel: { x: px, y: py, w: PANEL.w, h: PANEL.h }, rects };
  }

  function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  function levelFromSliderX(sliderRect, mx) {
    const t = clamp((mx - sliderRect.x) / sliderRect.w, 0, 1);
    // segments are 1..7 visually; level0to7 can be 0..7 (0 = mute)
    return clamp(Math.round(t * LEVEL_MAX), LEVEL_MIN, LEVEL_MAX);
  }

  function update(_dt, Input, mouse) {
    if (!state.isOpen) return;

    const items = getItems();

    if (pressedAny(Input, BACK_KEYS)) {
      close();
      return;
    }

    if (pressedAny(Input, UP_KEYS)) {
      state.index = (state.index - 1 + items.length) % items.length;
    }
    if (pressedAny(Input, DOWN_KEYS)) {
      state.index = (state.index + 1) % items.length;
    }

    const hovered = items[state.index];

    // ✅ Mouse hover + click (bonus affordance)
    let hoverAny = false;
    let hoveredHit = null;
    if (mouse && typeof mouse.x === "number" && typeof mouse.y === "number") {
      const layout = computeItemHitLayout(null, items);
      // Only allow hover inside panel
      if (pointInRect(mouse.x, mouse.y, layout.panel)) {
        for (const h of layout.rects) {
          if (pointInRect(mouse.x, mouse.y, h.block)) {
            state.index = h.i;
            hoveredHit = h;
            hoverAny = true;
            break;
          }
        }
      }
    }

    if (mouse && typeof mouse.setCursor === "function") {
      mouse.setCursor(hoverAny ? "pointer" : "default");
    }

    // Slider: click/drag adjusts directly
    if (mouse && hoveredHit && hoveredHit.type === "slider" && hoveredHit.slider) {
      if (mouse.pressed || mouse.down) {
        // If the pointer is on the slider bar (or we're dragging within the block), update
        const onBar = pointInRect(mouse.x, mouse.y, hoveredHit.slider);
        const inBlock = pointInRect(mouse.x, mouse.y, hoveredHit.block);
        if (onBar || (mouse.down && inBlock)) {
          const newLevel = levelFromSliderX(hoveredHit.slider, mouse.x);
          if (hoveredHit.id === "music") {
            state.musicLevel = newLevel;
            saveLevel0to7(LS_MUSIC_LVL, state.musicLevel);
            if (typeof onSetMusicGain === "function") onSetMusicGain(levelToGain01(state.musicLevel));
          }
          if (hoveredHit.id === "sfx") {
            state.sfxLevel = newLevel;
            saveLevel0to7(LS_SFX_LVL, state.sfxLevel);
            if (typeof onSetSfxGain === "function") onSetSfxGain(levelToGain01(state.sfxLevel));
          }
        }
      }
    }

    // Action: click activates
    if (mouse && mouse.clicked && hoveredHit && hoveredHit.type === "action") {
      if (hoveredHit.id === "continue") {
        close();
        return;
      }
      if (hoveredHit.id === "reset") {
        if (state.context === "menu" && typeof onReset === "function") onReset();
        close();
        return;
      }
    }

    const left = pressedAny(Input, LEFT_KEYS);
    const right = pressedAny(Input, RIGHT_KEYS);

    if (hovered?.type === "slider" && (left || right)) {
      const delta = left ? -1 : +1;

      if (hovered.id === "music") {
        state.musicLevel = clamp(state.musicLevel + delta, LEVEL_MIN, LEVEL_MAX);
        saveLevel0to7(LS_MUSIC_LVL, state.musicLevel);
        if (typeof onSetMusicGain === "function") onSetMusicGain(levelToGain01(state.musicLevel));
      }

      if (hovered.id === "sfx") {
        state.sfxLevel = clamp(state.sfxLevel + delta, LEVEL_MIN, LEVEL_MAX);
        saveLevel0to7(LS_SFX_LVL, state.sfxLevel);
        if (typeof onSetSfxGain === "function") onSetSfxGain(levelToGain01(state.sfxLevel));
      }
    }

    if (pressedAny(Input, CONFIRM_KEYS)) {
      if (!hovered) return;

      if (hovered.type === "action") {
        if (hovered.id === "continue") {
          close();
          return;
        }
        if (hovered.id === "reset") {
          if (state.context === "menu" && typeof onReset === "function") onReset();
          close();
          return;
        }
      }
    }
  }

  function renderSlider(ctx, x, y, w, h, level0to7, isHot) {
    ctx.strokeStyle = isHot ? "#ff0" : "#fff";
    ctx.strokeRect(x, y, w, h);

    const segCount = 7;
    const filledCount = clamp(level0to7, 0, 7);

    const segGap = 2;
    const segW = Math.floor((w - segGap * (segCount - 1) - 4) / segCount);
    const segH = h - 4;
    const baseX = x + 2;
    const baseY = y + 2;

    for (let i = 1; i <= segCount; i++) {
      const sx = baseX + (i - 1) * (segW + segGap);
      const filled = i <= filledCount;

      ctx.fillStyle = filled ? (isHot ? "#ff0" : "#fff") : "#222";
      ctx.fillRect(sx, baseY, segW, segH);
    }

    ctx.fillStyle = isHot ? "#ff0" : "#aaa";
    ctx.font = "8px monospace";
    ctx.fillText(`${filledCount}/7`, x + w + 10, y + h - 2);
  }

  function render(ctx) {
    if (!state.isOpen) return;

    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, width, height);

    const PANEL = getPanelDims();
    const px = Math.floor((width - PANEL.w) / 2);
    const py = Math.floor((height - PANEL.h) / 2);

    ctx.fillStyle = "#000";
    ctx.fillRect(px, py, PANEL.w, PANEL.h);
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(px, py, PANEL.w, PANEL.h);

    // Title pinned
    ctx.fillStyle = "#fff";
    ctx.font = FONT_TITLE_PINNED;
    ctx.fillText("Options", px + 12, py + 24);

    const items = getItems();

    // ------------------------------------------------------
    // Layout: treat each item as a "block"
    // ------------------------------------------------------
    const rowH = 12;
    const sliderLabelGap = 4;
    const sliderBlockH = rowH + sliderLabelGap + INNER.sliderH;

    const blocks = items.map((it) => (it.type === "slider" ? sliderBlockH : rowH));
    const totalH =
      blocks.reduce((a, b) => a + b, 0) + (items.length - 1) * INNER.rowGap;
    const infoLines = state.context === "battle" && typeof getBattleInfoLines === "function"
      ? (getBattleInfoLines() || [])
      : [];
    const hasCards = Array.isArray(infoLines) && infoLines.some(isBattleInfoCard);
    const infoCount = Array.isArray(infoLines) ? Math.min(infoLines.length, 6) : 0;
    const infoBlockH = state.context === "battle"
      ? (hasCards ? BATTLE_INFO_BLOCK_H : (8 + infoCount * 10 + 6))
      : 0;
    const startY = state.context === "battle"
      ? (py + 34 + infoBlockH + BATTLE_INFO_TO_MENU_GAP)
      : (py + Math.floor((PANEL.h - totalH) / 2) + 4);

    // Anchor X
    const centerX = px + Math.floor(PANEL.w / 2);
    const sliderX = centerX - Math.floor(INNER.sliderW / 2);

    let cy = startY;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const hot = i === state.index;
      const isLast = i === items.length - 1;

      if (it.type === "action") {
        ctx.font = FONT_ITEM;
        ctx.fillStyle = hot ? "#ff0" : "#fff";

        const textW = measureText(ctx, it.label, FONT_ITEM);
        const x = px + Math.floor((PANEL.w - textW) / 2);
        ctx.fillText(it.label, x, cy + rowH);

        cy += rowH;
        if (!isLast) cy += INNER.rowGap;
        continue;
      }

      if (it.type === "slider") {
        ctx.font = FONT_ITEM;
        ctx.fillStyle = hot ? "#ff0" : "#fff";
        ctx.fillText(it.label, sliderX, cy + rowH);

        const sliderY = cy + rowH + sliderLabelGap;
        const level = it.id === "music" ? state.musicLevel : state.sfxLevel;
        renderSlider(ctx, sliderX, sliderY, INNER.sliderW, INNER.sliderH, level, hot);

        cy += sliderBlockH;
        if (!isLast) cy += INNER.rowGap;
        continue;
      }
    }

    // Battle-only progression block (above Continue).
    if (state.context === "battle" && Array.isArray(infoLines) && infoLines.length > 0) {
      const cards = infoLines.filter(isBattleInfoCard).slice(0, 4);
      if (cards.length > 0) {
        const infoX = px + 12;
        const infoY = py + 34;
        const infoW = PANEL.w - 24;
        const gap = 4;
        const cardW = Math.floor((infoW - (gap * 3)) / 4);
        const cardH = BATTLE_INFO_CARD_H;

        for (let i = 0; i < cards.length; i++) {
          const c = cards[i] || {};
          const x = infoX + (i * (cardW + gap));
          const y = infoY;
          const title = String(c.title || `Slot ${i + 1}`);
          const primary = normalizeGenre(c.primaryGenre || "UNKNOWN") || "UNKNOWN";
          const secondary = normalizeGenre(c.secondaryGenre || "");
          const level = Math.max(1, Math.floor(Number(c.level || 1)));
          const xp = Math.max(0, Math.floor(Number(c.xp || 0)));
          const nextNeed = Math.max(0, Math.floor(Number(c.nextNeed || 0)));

          ctx.strokeStyle = "#3a3a3a";
          ctx.strokeRect(x, y, cardW, cardH);

          const cx = x + Math.floor(cardW / 2);
          const maxLineW = cardW - 8;

          ctx.font = "8px monospace";
          ctx.fillStyle = "#fff";
          const titleLines = wrapTextLines(ctx, title, maxLineW, 2);
          ctx.fillText(titleLines[0] || "", cx - (ctx.measureText(titleLines[0] || "").width / 2), y + 12);
          ctx.fillText(titleLines[1] || "", cx - (ctx.measureText(titleLines[1] || "").width / 2), y + 22);

          ctx.font = "8px monospace";
          const genreLine1Y = y + 31;
          const genreLine2Y = y + 39;
          if (secondary) {
            const pLine = fitTextWithEllipsis(ctx, primary, maxLineW);
            const sLine = fitTextWithEllipsis(ctx, secondary, maxLineW);
            ctx.fillStyle = getGenreColor(primary);
            ctx.fillText(pLine, cx - (ctx.measureText(pLine).width / 2), genreLine1Y);
            ctx.fillStyle = getGenreColor(secondary);
            ctx.fillText(sLine, cx - (ctx.measureText(sLine).width / 2), genreLine2Y);
          } else {
            const pLine = fitTextWithEllipsis(ctx, primary, maxLineW);
            const singleGenreY = Math.round((genreLine1Y + genreLine2Y) / 2);
            ctx.fillStyle = getGenreColor(primary);
            ctx.fillText(pLine, cx - (ctx.measureText(pLine).width / 2), singleGenreY);
          }

          ctx.font = "8px monospace";
          ctx.fillStyle = "#fff";
          const levelLine = `Level ${level} | XP: ${xp}`;
          ctx.fillText(levelLine, cx - (ctx.measureText(levelLine).width / 2), y + 49);

          ctx.font = "8px monospace";
          const needLines = wrapTextLines(ctx, `${nextNeed} XP needed for next level`, maxLineW, 3);
          ctx.fillText(needLines[0] || "", cx - (ctx.measureText(needLines[0] || "").width / 2), y + 58);
          ctx.fillText(needLines[1] || "", cx - (ctx.measureText(needLines[1] || "").width / 2), y + 66);
          ctx.fillText(needLines[2] || "", cx - (ctx.measureText(needLines[2] || "").width / 2), y + 74);
        }
      } else {
        const infoX = px + 12;
        const infoW = PANEL.w - 24;
        const infoTop = py + 34;
        const lineH = 10;
        const drawLines = infoLines.slice(0, 6);

        ctx.strokeStyle = "#3a3a3a";
        ctx.strokeRect(infoX - 2, infoTop - 4, infoW + 4, 10 + drawLines.length * lineH);

        ctx.font = FONT_HINT;
        ctx.fillStyle = "#d5d5d5";
        for (let i = 0; i < drawLines.length; i++) {
          ctx.fillText(String(drawLines[i]), infoX, infoTop + (i * lineH));
        }
      }
    }

    // Footer hints
    ctx.font = FONT_HINT;
    ctx.fillStyle = "#fff";
    const leftHint = "Enter: Select";
    const rightHint = "Backspace: Back";
    const rightW = measureText(ctx, rightHint, FONT_HINT);

    const footerY = py + PANEL.h - 10;
    ctx.fillText(leftHint, px + 10, footerY);
    ctx.fillText(rightHint, px + PANEL.w - 10 - rightW, footerY);
  }

  return {
    get isOpen() {
      return state.isOpen;
    },
    open,
    close,
    update,
    render,

    getMusicLevel: () => state.musicLevel,
    getSfxLevel: () => state.sfxLevel,
    getMusicGain01: () => levelToGain01(state.musicLevel),
    getSfxGain01: () => levelToGain01(state.sfxLevel)
  };
}
