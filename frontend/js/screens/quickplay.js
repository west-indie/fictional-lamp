// frontend/js/screens/quickplay.js

import { changeScreen, GameState } from "../game.js";
import { SCREEN, QUICKPLAY_LAYOUT, QUICKPLAY_SCREEN_LAYOUT as L } from "../layout.js";
import { Input } from "../ui.js";
import { movies } from "../data/movies.js";
import { playerArchetypes } from "../data/playerArchetypes.js";
import { playUIBackBlip, playUIMoveBlip } from "../sfx/uiSfx.js";

import { renderUnlockArcOverlay } from "./unlockArcOverlay.js";
import { ensureUnlockState, isArchetypeUnlocked } from "../systems/unlockSystem.js";
import { peekUnlockEvents, popNextUnlockEvent } from "../systems/unlockTriggers.js";

// ✅ Layered menu/nav music (Quickplay wants NAV mix: layer1+layer2)
import { MenuLayers, NAV_MIX } from "../systems/menuLayeredMusic.js";
import { syncOptionsAudioNow } from "../systems/optionsAudioSync.js";

// -------------------------
// Layout-driven constants
// -------------------------
// These are "preferred" sizes. We will auto-shrink them at render-time to make room
// for the new left/right icon buttons while keeping everything centered.
const BASE_PREVIEW_POSTER_W = Number(QUICKPLAY_LAYOUT?.previewPoster?.w ?? 80);
const BASE_PREVIEW_POSTER_H = Number(QUICKPLAY_LAYOUT?.previewPoster?.h ?? 120);
const PREVIEW_POSTER_GAP = Number(QUICKPLAY_LAYOUT?.previewPoster?.gap ?? 6);

// Icon button sizing (small square buttons)
const PREVIEW_BTN_SIZE = Number(QUICKPLAY_LAYOUT?.previewButtons?.size ?? 18);
const PREVIEW_BTN_GAP = Number(QUICKPLAY_LAYOUT?.previewButtons?.gap ?? 8);
const PREVIEW_SIDE_MARGIN = Number(QUICKPLAY_LAYOUT?.previewButtons?.sideMargin ?? 10);

// Archetype “top 10” pinned order
const DEFAULT_ARCHETYPE_ORDER = [
  "film_bro",
  "horror_buff",
  "oscar_bait",
  "scifi_purist",
  "blockbuster_fan",
  "romcom_apologist",
  "a24_enthusiast",
  "foreign_cinema_nerd",
  "anime_theater_regular",
  "film_school_professor",
  "test"
];

// -------------------------
// UI State
// -------------------------
let selectedRow = 0;
let selectedCol = 0;
let scrollRow = 0;

let uiMode = "select"; // "select" | "unlock"
let overlayPayload = null;

let confirmPending = false;
let confirmedIndex = null;

// Mouse hover affordance for preview icon buttons
let hoverPreviewLeft = false;
let hoverPreviewRight = false;

let unlockToastText = "";
let unlockToastFrames = 0;

// -------------------------
// ✅ Layered music state (autoplay-safe boot)
// -------------------------
let layeredReady = false;
let layeredLoading = false;

async function bootNavLayersFromGestureIfNeeded() {
  if (layeredReady) return true;
  if (layeredLoading) return false;

  layeredLoading = true;
  try {
    await MenuLayers.ensureStarted();
    layeredReady = true;

    // ✅ Apply saved music volume now that audio is started
    try { syncOptionsAudioNow(); } catch {}

    // ✅ Quickplay uses NAV mix (layer1 + layer2)
    try { MenuLayers.setMix(NAV_MIX, 0); } catch {}
    return true;
  } catch {
    return false;
  } finally {
    layeredLoading = false;
  }
}

// -------------------------
// Utilities
// -------------------------
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function resetQuickplayCursor() {
  selectedRow = 0;
  selectedCol = 0;
  scrollRow = 0;
}

function resetConfirm() {
  confirmPending = false;
  confirmedIndex = null;
}

function resetToast() {
  unlockToastText = "";
  unlockToastFrames = 0;
}

function resetQuickplayUIState() {
  uiMode = "select";
  overlayPayload = null;
  resetQuickplayCursor();
  resetConfirm();
  resetToast();
}

function getMovieById(id) {
  return (
    movies.find((m) => m.id === id) || {
      id,
      title: "Unknown",
      shortTitle: "Unknown",
      runtime: 120,
      imdb: 7.0
    }
  );
}

function getArchetypeById(id) {
  return playerArchetypes.find((a) => a?.id === id) || null;
}

function isUnlocked(archetypeId) {
  ensureUnlockState(GameState);
  return isArchetypeUnlocked(GameState, archetypeId);
}

// -------------------------
// Archetype list building
// -------------------------
function buildDefaultTen() {
  const out = [];
  for (const id of DEFAULT_ARCHETYPE_ORDER) {
    const a = getArchetypeById(id);
    if (a) out.push(a);
    else {
      out.push({
        id,
        name: `MISSING: ${id}`,
        quickName: `MISSING: ${id}`,
        movieIds: [],
        hidden: false
      });
    }
  }
  return out;
}

function buildUnlockedHiddenList() {
  ensureUnlockState(GameState);

  const order = Array.isArray(GameState?.unlocks?.archetypeOrder)
    ? GameState.unlocks.archetypeOrder.map(String).filter(Boolean)
    : [];

  const result = [];
  const seen = new Set();

  function addIfEligible(id) {
    if (!id) return;
    if (DEFAULT_ARCHETYPE_ORDER.includes(id)) return;

    const a = getArchetypeById(id);
    if (!a) return;

    if (a.hidden !== true) return;
    if (!isUnlocked(a.id)) return;

    if (seen.has(a.id)) return;
    seen.add(a.id);
    result.push(a);
  }

  if (order.length) {
    for (const id of order) addIfEligible(id);
  } else {
    for (const a of playerArchetypes) addIfEligible(a?.id);
  }

  return result;
}

function getQuickplayArchetypes() {
  const defaults = buildDefaultTen();
  const unlocked = buildUnlockedHiddenList();
  return [...defaults, ...unlocked];
}

// -------------------------
// Grid helpers (ROW-MAJOR)
// -------------------------
function getGridInfo(archetypes) {
  const n = archetypes.length || 0;
  const rows = Math.max(1, Math.ceil(n / 2));
  return { n, rows };
}

function getIndexFor(row, col) {
  return row * 2 + col;
}

function isValidIndex(archetypes, idx) {
  return idx >= 0 && idx < (archetypes?.length || 0) && !!archetypes[idx];
}

function getSelectedIndex(_archetypes) {
  return getIndexFor(selectedRow, selectedCol);
}

function ensureSelectionValid(archetypes) {
  const { n, rows } = getGridInfo(archetypes);

  selectedRow = clamp(selectedRow, 0, rows - 1);
  selectedCol = selectedCol ? 1 : 0;

  // Snap off an empty right cell on last row
  let idx = getSelectedIndex(archetypes);
  if (!isValidIndex(archetypes, idx)) {
    selectedCol = 0;
    idx = getSelectedIndex(archetypes);
    if (!isValidIndex(archetypes, idx)) {
      selectedRow = 0;
      selectedCol = 0;
    }
  }

  const visibleRows = Number(L?.list?.visibleRows ?? 5);

  if (rows <= visibleRows) {
    scrollRow = 0;
  } else {
    if (selectedRow < scrollRow) scrollRow = selectedRow;
    if (selectedRow >= scrollRow + visibleRows) scrollRow = selectedRow - (visibleRows - 1);
    scrollRow = clamp(scrollRow, 0, rows - visibleRows);
  }

  if (confirmPending) {
    const safeMax = Math.max(0, n - 1);
    const base = confirmedIndex == null ? idx : confirmedIndex;
    confirmedIndex = clamp(base, 0, safeMax);
    if (!isValidIndex(archetypes, confirmedIndex)) {
      confirmedIndex = clamp(idx, 0, safeMax);
    }
  }
}

// -------------------------
// Input helpers
// -------------------------
function consumeBackIfPressed() {
  if (!Input.pressed("Back")) return false;
  Input.consume("Back");
  return true;
}

function consumeConfirmIfPressed() {
  if (!Input.pressed("Confirm")) return false;
  Input.consume("Confirm");
  return true;
}

function consumeMove(dir) {
  if (!Input.pressed(dir)) return false;
  Input.consume(dir);
  return true;
}

// -------------------------
// Flow helpers
// -------------------------
function goHome() {
  GameState.runMode = null;
  GameState.enemyTemplate = null;
  GameState.enemy = null;
  GameState.currentLevel = 1;

  resetQuickplayUIState();

  // ✅ Leaving nav flow: stop layered stems
  try { MenuLayers.stop({ fadeMs: 180 }); } catch {}

  changeScreen("menu");
}

function beginBattleFromArchetype(archetype) {
  if (!archetype) return;

  GameState.party.movies = (archetype.movieIds || []).map(getMovieById);

  GameState.enemyTemplate = null;
  GameState.enemy = null;
  GameState.currentLevel = 1;

  GameState.campaign = {
    onefourShown: true,
    firstPickApplied: null,
    fourthPickApplied: null,
    effects: { first: null, fourth: null },
    _onefourAppliedThisBattle: false
  };

  GameState.runMode = "quickplay";
  resetConfirm();

  // ✅ Leaving nav flow: stop layered stems before enemy/battle music
  try { MenuLayers.stop({ fadeMs: 180 }); } catch {}

  changeScreen("enemyIntro");
}

// -------------------------
// Posters (local assets) + drawing
// -------------------------
const POSTER_BASE = "frontend/assets/posters/";
const posterCache = new Map(); // id -> { img, loaded, failed }

// ... (UNCHANGED BELOW THIS LINE except where noted) ...

function startPosterLoad(movieId) {
  if (!movieId) return null;
  if (posterCache.has(movieId)) return posterCache.get(movieId);

  const rec = { img: null, loaded: false, failed: false };
  posterCache.set(movieId, rec);

  const exts = ["png", "jpg", "jpeg", "webp"];
  let idx = 0;

  const img = new Image();
  rec.img = img;

  const tryNext = () => {
    if (idx >= exts.length) {
      rec.failed = true;
      rec.loaded = false;
      return;
    }
    const ext = exts[idx++];
    img.src = `${POSTER_BASE}${movieId}.${ext}`;
  };

  img.onload = () => {
    rec.loaded = true;
    rec.failed = false;
  };

  img.onerror = () => {
    tryNext();
  };

  tryNext();
  return rec;
}

function drawPosterCard(ctx, movie, x, y, w, h) {
  const id = movie?.id;
  const rec = startPosterLoad(id);

  ctx.strokeStyle = "#fff";
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = "#111";
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

  if (rec && rec.loaded && rec.img) {
    const iw = rec.img.naturalWidth || w;
    const ih = rec.img.naturalHeight || h;

    // Fit (letterbox) to preserve aspect
    const scale = Math.min(w / iw, h / ih);
    const dw = Math.floor(iw * scale);
    const dh = Math.floor(ih * scale);
    const dx = x + Math.floor((w - dw) / 2);
    const dy = y + Math.floor((h - dh) / 2);

    try {
      ctx.drawImage(rec.img, dx, dy, dw, dh);
    } catch {
      // ignore draw failures
    }
  } else {
    ctx.fillStyle = "#666";
    ctx.font = "9px monospace";
    ctx.fillText("loading...", x + 6, y + 14);
  }
}

// ONLY shortTitle, like Select’s nameplates (but WITHOUT a box)
function getShortTitleOnly(movie) {
  const s = String(movie?.title || "").trim();
  return s ? s : "";
}

// -------------------------
// ShortTitle wrapping (3 lines, word-safe)
// -------------------------
function wrapLinesByWords(ctx, text, maxWidth, maxLines) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return new Array(maxLines).fill("");

  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? current + " " + word : word;

    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word);
      current = "";
    }

    if (lines.length >= maxLines) return lines.slice(0, maxLines);
  }

  if (lines.length < maxLines && current) lines.push(current);
  while (lines.length < maxLines) lines.push("");
  return lines.slice(0, maxLines);
}

// -------------------------
// Preview row layout (posters + new side buttons)
// -------------------------
function getPreviewRowLayout(screenW) {
  const btnTotal = PREVIEW_BTN_SIZE * 2 + PREVIEW_BTN_GAP * 2; // each side: (gap + btn)
  const maxRowW = Math.max(0, screenW - PREVIEW_SIDE_MARGIN * 2);

  // Available for posters block after reserving both side button lanes:
  // [btn][gap] [posters...] [gap][btn]
  const availableForPosters = Math.max(0, maxRowW - (PREVIEW_BTN_SIZE * 2 + PREVIEW_BTN_GAP * 2));

  // Solve posterW so that 4 posters + 3 gaps fits into availableForPosters
  // posterW = (available - 3*gap)/4
  const fittedPosterW = Math.floor((availableForPosters - PREVIEW_POSTER_GAP * 3) / 4);

  // Clamp poster size (never bigger than your base, never too tiny)
  const posterW = clamp(fittedPosterW, 60, BASE_PREVIEW_POSTER_W);
  const posterH = Math.floor((BASE_PREVIEW_POSTER_H / BASE_PREVIEW_POSTER_W) * posterW);

  const postersBlockW = posterW * 4 + PREVIEW_POSTER_GAP * 3;
  const rowW = postersBlockW + PREVIEW_BTN_SIZE * 2 + PREVIEW_BTN_GAP * 2;

  const startX = Math.floor((screenW - rowW) / 2);
  const leftBtnX = startX;
  const postersX = startX + PREVIEW_BTN_SIZE + PREVIEW_BTN_GAP;
  const rightBtnX = postersX + postersBlockW + PREVIEW_BTN_GAP;

  return {
    posterW,
    posterH,
    postersBlockW,
    rowW,
    leftBtnX,
    postersX,
    rightBtnX
  };
}

function drawIconButton(ctx, x, y, size, kind, isHot = false) {
  // Button box
  ctx.fillStyle = "#000";
  ctx.fillRect(x, y, size, size);

  ctx.strokeStyle = isHot ? "#ff0" : "#fff";
  ctx.strokeRect(x, y, size, size);

  // Icon
  ctx.lineWidth = 2;
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.strokeStyle = isHot ? "#ff0" : "#fff";

  const pad = Math.floor(size * 0.22);
  const x0 = x + pad;
  const y0 = y + pad;
  const x1 = x + size - pad;
  const y1 = y + size - pad;
  const cx = Math.floor((x0 + x1) / 2);

  ctx.beginPath();

  if (kind === "home") {
    // Roof
    ctx.moveTo(x0, y0 + 4);
    ctx.lineTo(cx, y0);
    ctx.lineTo(x1, y0 + 4);
    // House body
    ctx.moveTo(x0 + 2, y0 + 4);
    ctx.lineTo(x0 + 2, y1);
    ctx.lineTo(x1 - 2, y1);
    ctx.lineTo(x1 - 2, y0 + 4);
  } else if (kind === "back") {
    // Left arrow
    const midY = Math.floor((y0 + y1) / 2);
    ctx.moveTo(x0, midY);
    ctx.lineTo(x1, midY);
    ctx.moveTo(x0, midY);
    ctx.lineTo(x0 + 6, midY - 6);
    ctx.moveTo(x0, midY);
    ctx.lineTo(x0 + 6, midY + 6);
  } else if (kind === "confirm") {
    // Checkmark
    const aX = x0 + 2;
    const aY = y0 + Math.floor((y1 - y0) * 0.55);
    const bX = x0 + Math.floor((x1 - x0) * 0.42);
    const bY = y1 - 2;
    const cX = x1;
    const cY = y0 + 2;
    ctx.moveTo(aX, aY);
    ctx.lineTo(bX, bY);
    ctx.lineTo(cX, cY);
  }

  ctx.stroke();
  ctx.lineWidth = 1;
}

// -------------------------
// Unlock events
// -------------------------
function handleUnlockEvents() {
  const events = peekUnlockEvents(GameState);
  if (!events.length) return;

  const next = events.find((e) => e?.type === "ARCHETYPE_UNLOCKED");
  if (!next) return;

  const payload = popNextUnlockEvent(GameState);
  if (!payload) return;

  const name = payload.archetypeName || "New Archetype";
  unlockToastText = `UNLOCKED: ${name}`;
  unlockToastFrames = 240;

  if (payload.showOverlay) {
    overlayPayload = payload;
    uiMode = "unlock";
    resetConfirm();
  }
}

// -------------------------
// Screen
// -------------------------
export const QuickplayScreen = {
  enter() {
    resetQuickplayUIState();

    // ✅ Apply saved volumes immediately (safe even if buses not ready yet)
    try { syncOptionsAudioNow(); } catch {}

    // ✅ Quickplay wants NAV mix; do NOT start/resume here (autoplay-safe)
    try { MenuLayers.setMix(NAV_MIX, 0); } catch {}
  },

  update(mouse) {
    ensureUnlockState(GameState);

    // ✅ Gesture-gated boot: start stems from any real interaction
    if (
      Input.pressed("Confirm") ||
      Input.pressed("Back") ||
      Input.pressed("Up") ||
      Input.pressed("Down") ||
      Input.pressed("Left") ||
      Input.pressed("Right") ||
      mouse?.pressed ||
      mouse?.clicked ||
      mouse?.tapped
    ) {
      bootNavLayersFromGestureIfNeeded(); // fire-and-forget
    }

    // ✅ Keep enforcing NAV mix while on Quickplay (safe even before started)
    try { MenuLayers.setMix(NAV_MIX, 0); } catch {}

    // ✅ Keep volume synced
    try { syncOptionsAudioNow(); } catch {}

    if (unlockToastFrames > 0) {
      unlockToastFrames -= 1;
      if (unlockToastFrames <= 0) resetToast();
    }

    handleUnlockEvents();

    const archetypes = getQuickplayArchetypes();
    ensureSelectionValid(archetypes);

    // --- UNLOCK MODE ---
    if (uiMode === "unlock") {
      if (consumeBackIfPressed()) {
        playUIBackBlip();
        uiMode = "select";
        overlayPayload = null;
        return;
      }

      if (consumeConfirmIfPressed()) {
        GameState.enemyTemplate = null;
        GameState.enemy = null;
        GameState.currentLevel = 1;

        GameState.campaign = {
          onefourShown: true,
          firstPickApplied: null,
          fourthPickApplied: null,
          effects: { first: null, fourth: null },
          _onefourAppliedThisBattle: false
        };

        resetConfirm();

        // ✅ Leaving nav flow: stop layered stems before battle music
        try { MenuLayers.stop({ fadeMs: 180 }); } catch {}

        changeScreen("battle");
      }
      return;
    }

    // --- SELECT MODE ---
    if (consumeBackIfPressed()) {
      playUIBackBlip();
      if (confirmPending) resetConfirm();
      else goHome();
      return;
    }

    if (confirmPending) {
      if (consumeConfirmIfPressed()) {
        const idx = confirmedIndex == null ? getSelectedIndex(archetypes) : confirmedIndex;
        const chosen = archetypes[idx] || archetypes[0];
        beginBattleFromArchetype(chosen);
      }
      return;
    }

    const { rows } = getGridInfo(archetypes);

    // ✅ Mouse hover + click (optional)
    if (mouse && (mouse.moved || mouse.clicked || mouse.tapped || mouse.down || mouse.pressed)) {
      let cursor = "default";

      // 1) List hover/click
      const fontPx = (() => {
        const m = String(L?.list?.font || "12px").match(/(\d+(?:\.\d+)?)px/);
        return m ? Number(m[1]) : 12;
      })();
      const baselineTop = L.list.startY - Math.floor(fontPx * 0.9);
      const listTop = baselineTop - 4;
      const listBottom = baselineTop + L.list.visibleRows * L.list.rowH + 8;

      if (mouse.y >= listTop && mouse.y <= listBottom) {
        const r = Math.floor((mouse.y - baselineTop) / L.list.rowH);
        if (r >= 0 && r < L.list.visibleRows) {
          const col = mouse.x < SCREEN.W / 2 ? 0 : 1;
          const idx = getIndexFor(scrollRow + r, col);
          if (isValidIndex(archetypes, idx)) {
            cursor = "pointer";
            const prevIdx = getSelectedIndex(archetypes);

            selectedRow = scrollRow + r;
            selectedCol = col;
            ensureSelectionValid(archetypes);

            const nextIdx = getSelectedIndex(archetypes);
            if (mouse.moved && prevIdx !== nextIdx) {
              try { playUIMoveBlip(); } catch {}
            }

            if (mouse.clicked || mouse.tapped) {
              if (!confirmPending) {
                confirmPending = true;
                confirmedIndex = getSelectedIndex(archetypes);
              } else {
                const chosen = archetypes[confirmedIndex] || archetypes[0];
                beginBattleFromArchetype(chosen);
              }
              return;
            }
          }
        }
      }

      // 2) Preview icon buttons (Home/Back, Confirm)
      {
        hoverPreviewLeft = false;
        hoverPreviewRight = false;
        const idx = getSelectedIndex(archetypes);
        const selected = archetypes[idx];
        if (selected) {
          const postersY = Number(L?.preview?.postersY ?? 175);
          const row = getPreviewRowLayout(SCREEN.W);
          const btnY = postersY + Math.floor((row.posterH - PREVIEW_BTN_SIZE) / 2);
          const leftRect = { x: row.leftBtnX, y: btnY, w: PREVIEW_BTN_SIZE, h: PREVIEW_BTN_SIZE };
          const rightRect = { x: row.rightBtnX, y: btnY, w: PREVIEW_BTN_SIZE, h: PREVIEW_BTN_SIZE };

          const didTap = !!(mouse.clicked || mouse.tapped);

          if (
            mouse.x >= leftRect.x &&
            mouse.x <= leftRect.x + leftRect.w &&
            mouse.y >= leftRect.y &&
            mouse.y <= leftRect.y + leftRect.h
          ) {
            hoverPreviewLeft = true;
            cursor = "pointer";
            if (didTap) {
              if (confirmPending) resetConfirm();
              else goHome();
              return;
            }
          } else if (
            mouse.x >= rightRect.x &&
            mouse.x <= rightRect.x + rightRect.w &&
            mouse.y >= rightRect.y &&
            mouse.y <= rightRect.y + rightRect.h
          ) {
            hoverPreviewRight = true;
            cursor = "pointer";
            if (didTap) {
              if (!confirmPending) {
                confirmPending = true;
                confirmedIndex = getSelectedIndex(archetypes);
              } else {
                const chosen = archetypes[confirmedIndex] || archetypes[0];
                beginBattleFromArchetype(chosen);
              }
              return;
            }
          }
        }
      }

      if (typeof mouse.setCursor === "function") mouse.setCursor(cursor);
    }

    if (consumeMove("Up")) {
      selectedRow = (selectedRow - 1 + rows) % rows;
      ensureSelectionValid(archetypes);
    }
    if (consumeMove("Down")) {
      selectedRow = (selectedRow + 1) % rows;
      ensureSelectionValid(archetypes);
    }
    if (consumeMove("Left")) {
      selectedCol = 0;
      ensureSelectionValid(archetypes);
    }
    if (consumeMove("Right")) {
      selectedCol = 1;
      const idx = getSelectedIndex(archetypes);
      if (!isValidIndex(archetypes, idx)) selectedCol = 0;
      ensureSelectionValid(archetypes);
    }

    if (consumeConfirmIfPressed()) {
      confirmPending = true;
      confirmedIndex = getSelectedIndex(archetypes);
    }
  },

  render(ctx) {
    // (UNCHANGED render)
    const width = SCREEN.W;
    const height = SCREEN.H;

    ctx.fillStyle = "#001";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = L?.title?.color || "#fff";
    ctx.font = L?.title?.font || "14px monospace";
    ctx.fillText("Quickplay: Pick Archetype", L.title.x, L.title.y);

    // Subtitle
    ctx.fillStyle = L?.subtitle?.color || "#fff";
    ctx.font = L?.subtitle?.font || "10px monospace";
    if (uiMode === "select" && confirmPending) {
      ctx.fillText("Confirm Start   Back Cancel", L.subtitle.x, L.subtitle.y);
    } else {
      ctx.fillText(
        "Move: Arrows/WASD   Confirm: Enter   Back: Esc/Backspace",
        L.subtitle.x,
        L.subtitle.y
      );
    }

    const archetypes = getQuickplayArchetypes();
    const { rows } = getGridInfo(archetypes);

    const cursorIndex = getSelectedIndex(archetypes);
    const highlightIndex = confirmPending ? confirmedIndex : cursorIndex;

    const startRow = scrollRow;
    const visibleRows = Number(L?.list?.visibleRows ?? 5);
    const endRow = Math.min(rows, startRow + visibleRows);

    // List
    ctx.font = L?.list?.font || "12px monospace";

    for (let r = startRow; r < endRow; r++) {
      const i = r - startRow;
      const y = L.list.startY + i * L.list.rowH;

      const leftIdx = getIndexFor(r, 0);
      const rightIdx = getIndexFor(r, 1);

      const left = archetypes[leftIdx];
      const right = archetypes[rightIdx];

      if (left) {
        const isSelected = uiMode === "select" && highlightIndex === leftIdx;
        ctx.fillStyle = isSelected ? (L?.list?.selectedColor || "#ff0") : (L?.list?.color || "#fff");
        ctx.fillText(left.quickName || left.name, L.list.leftX, y);
      }

      if (right) {
        const isSelected = uiMode === "select" && highlightIndex === rightIdx;
        ctx.fillStyle = isSelected ? (L?.list?.selectedColor || "#ff0") : (L?.list?.color || "#fff");
        ctx.fillText(right.quickName || right.name, L.list.rightX, y);
      }
    }

    // Preview posters + shortTitle labels (NO label box)
    if (uiMode === "select") {
      const idx = highlightIndex == null ? cursorIndex : highlightIndex;
      const selected = archetypes[idx];

      if (selected) {
        const objs = (selected.movieIds || []).slice(0, 4).map(getMovieById);

        const postersY = Number(L?.preview?.postersY ?? 175);
        const labelDy = Number(L?.preview?.posterLabelDy ?? 12);

        const row = getPreviewRowLayout(width);
        const posterW = row.posterW;
        const posterH = row.posterH;

        const btnY = postersY + Math.floor((posterH - PREVIEW_BTN_SIZE) / 2);

        const leftKind = confirmPending ? "back" : "home";
        const rightKind = "confirm";

        drawIconButton(ctx, row.leftBtnX, btnY, PREVIEW_BTN_SIZE, leftKind, hoverPreviewLeft);
        drawIconButton(ctx, row.rightBtnX, btnY, PREVIEW_BTN_SIZE, rightKind, hoverPreviewRight);

        for (let i = 0; i < 4; i++) {
          const m = objs[i];
          if (!m) continue;
          const x = row.postersX + i * (posterW + PREVIEW_POSTER_GAP);
          drawPosterCard(ctx, m, x, postersY, posterW, posterH);
        }

        ctx.fillStyle = "#fff";
        ctx.font = "8px monospace";

        const labelLineH = 10;
        const maxLines = 3;
        const maxW = posterW;

        const labelY = postersY + posterH + labelDy;

        for (let i = 0; i < 4; i++) {
          const m = objs[i];
          if (!m) continue;

          const label = getShortTitleOnly(m);
          if (!label) continue;

          const x = row.postersX + i * (posterW + PREVIEW_POSTER_GAP);

          const lines = wrapLinesByWords(ctx, label, maxW, maxLines);

          for (let li = 0; li < maxLines; li++) {
            const line = lines[li];
            if (!line) continue;
            const wLine = ctx.measureText(line).width;
            const tx = x + Math.floor((posterW - wLine) / 2);
            const ty = labelY + li * labelLineH;
            ctx.fillText(line, tx, ty);
          }
        }

        if (confirmPending) {
          const boxW = L.preview.confirmBoxW;
          const boxH = L.preview.confirmBoxH;
          const bx = Math.floor((width - boxW) / 2);
          const by = L.preview.confirmBoxY;

          ctx.fillStyle = "#000";
          ctx.fillRect(bx, by, boxW, boxH);

          ctx.strokeStyle = "#fff";
          ctx.strokeRect(bx, by, boxW, boxH);

          ctx.fillStyle = L?.preview?.color || "#ff0";
          ctx.font = L?.preview?.font || "10px monospace";

          const padX = Number(L?.preview?.padX ?? 10);
          const textY = Number(L?.preview?.textY ?? 16);

          const shownName = selected.quickName || selected.name;
          const msg = `Confirmed: ${shownName}  |  Confirm Start  |  Back Cancel`;
          ctx.fillText(msg.slice(0, 64), bx + padX, by + textY);
        }
      }
    }

    if (uiMode === "select" && unlockToastFrames > 0 && unlockToastText) {
      const bx = L.toast.x;
      const by = L.toast.y;
      const boxW = L.toast.w;
      const boxH = L.toast.h;

      ctx.fillStyle = "#000";
      ctx.fillRect(bx, by, boxW, boxH);

      ctx.strokeStyle = "#fff";
      ctx.strokeRect(bx, by, boxW, boxH);

      ctx.fillStyle = L?.toast?.color || "#ff0";
      ctx.font = L?.toast?.font || "10px monospace";

      const padX = Number(L?.toast?.padX ?? 10);
      const textY = Number(L?.toast?.textY ?? 11);

      ctx.fillText(unlockToastText.slice(0, 44), bx + padX, by + textY);
    }

    if (uiMode === "unlock") {
      const payload = overlayPayload || {};
      const party = (payload.movieIds || []).slice(0, 4).map(getMovieById);

      renderUnlockArcOverlay(ctx, {
        width,
        height,
        archetypeName: payload.archetypeName || "Unknown",
        party,
        codeLabel: payload.codeLabel || ""
      });
    }
  }
};
