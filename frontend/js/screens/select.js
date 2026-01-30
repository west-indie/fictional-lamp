// frontend/js/screens/select.js
//
// Native 400x300 Select (no legacy transforms).
// All UI numbers come from SELECT_LAYOUT in layout.js.
//
// ✅ SPECIAL SLOT options:
//   - BLANK (cannot start battle)
//   - RANDOM (resolves to a random movie ONLY when starting)
//   - 14x GENRE RANDOM slots (resolves to a random movie of that genre ONLY when starting)
//
// ✅ UI:
// - TOP arrow button is in a BOX ABOVE the poster (NOT covering it).
// - BOTTOM arrow button is in a BOX BELOW the nameplate.
// - Arrow boxes are the SAME WIDTH as the poster.
// - Posters are drawn WITHOUT cropping (no cover-crop).
//
// ✅ FIX (your request):
// - The entire “slot” (poster, poster slot, buttons, nameplate, card outline) is resized so its WIDTH
//   matches the *existing rendered poster width* you’re seeing.
// - Poster rect height is computed from aspect so poster height matches perfectly.
// - Removes the “gap bar” between poster and nameplate (no black strip under poster).

import { movies, getAvailableMovies } from "../data/movies.js";
import { playerArchetypes } from "../data/playerArchetypes.js";
import { GameState, changeScreen } from "../game.js";
import { SCREEN, SELECT_LAYOUT as L } from "../layout.js";
import { Input } from "../ui.js";

import { ensureStatsState, incRandomizeClicks } from "../systems/statsSystem.js";
import { ensureUnlockState, isArchetypeUnlocked, evaluateUnlockRules } from "../systems/unlockSystem.js";
import { playUIBackBlip, playUIConfirmBlip, playUIMoveBlip } from "../sfx/uiSfx.js";

// ✅ Layered menu/nav music (Select wants layer1+layer2)
import { MenuLayers, NAV_MIX } from "../systems/menuLayeredMusic.js";
import { syncOptionsAudioNow } from "../systems/optionsAudioSync.js";

// ✅ Ensure Select respects saved user music volume immediately (same as Menu/Battle)

import { ImageCache } from "../core/ImageCache.js";
import { movieMeta } from "../data/movieMeta.js";

import { renderUnlockArcOverlay } from "./unlockArcOverlay.js";
import { peekUnlockEvents, popNextUnlockEvent } from "../systems/unlockTriggers.js";

const SLOT_COUNT = 4;
const DEFAULT_START_IDS = ["shawshank", "godfather", "taxi_driver", "pulp_fiction"];

const LS_LAST_SCREEN = "rpg_last_screen";
const LS_SELECT_SLOT_IDS = "rpg_select_slot_ids_v1";
const LS_SELECT_UI = "rpg_select_ui_v1";

// Ratatouille trial constants
const RATATOUILLE_ARCHETYPE_ID = "ratatouille_only";
const LS_RATA_TRIAL = "rpg_ratatouille_trial_v1";

// -----------------------
// ✅ SPECIAL SLOTS
// -----------------------
const SLOT_TOKEN_BLANK = "__SLOT_BLANK__";
const SLOT_TOKEN_RANDOM = "__SLOT_RANDOM__";

const GENRE_RANDOM_SLOTS = [
  { token: "__SLOT_RAND_ACTION__", genre: "ACTION", label: "RANDOM: ACTION" },
  { token: "__SLOT_RAND_ADVENTURE__", genre: "ADVENTURE", label: "RANDOM: ADVENTURE" },
  { token: "__SLOT_RAND_DRAMA__", genre: "DRAMA", label: "RANDOM: DRAMA" },
  { token: "__SLOT_RAND_COMEDY__", genre: "COMEDY", label: "RANDOM: COMEDY" },
  { token: "__SLOT_RAND_HORROR__", genre: "HORROR", label: "RANDOM: HORROR" },
  { token: "__SLOT_RAND_THRILLER__", genre: "THRILLER", label: "RANDOM: THRILLER" },
  { token: "__SLOT_RAND_MYSTERY__", genre: "MYSTERY", label: "RANDOM: MYSTERY" },
  { token: "__SLOT_RAND_SCIFI__", genre: "SCIFI", label: "RANDOM: SCIFI" },
  { token: "__SLOT_RAND_FANTASY__", genre: "FANTASY", label: "RANDOM: FANTASY" },
  { token: "__SLOT_RAND_ANIMATION__", genre: "ANIMATION", label: "RANDOM: ANIMATION" },
  { token: "__SLOT_RAND_CRIME__", genre: "CRIME", label: "RANDOM: CRIME" },
  { token: "__SLOT_RAND_ROMANCE__", genre: "ROMANCE", label: "RANDOM: ROMANCE" },
  { token: "__SLOT_RAND_MUSICAL__", genre: "MUSICAL", label: "RANDOM: MUSICAL" }
];

const GENRE_TOKEN_TO_DEF = new Map(GENRE_RANDOM_SLOTS.map((g) => [g.token, g]));

// -----------------------
// localStorage safe utils
// -----------------------
function safeGetLS(key) {
  try {
    return window?.localStorage?.getItem(key);
  } catch {
    return null;
  }
}
function safeSetLS(key, value) {
  try {
    window?.localStorage?.setItem(key, value);
  } catch {}
}
function safeRemoveLS(key) {
  try {
    window?.localStorage?.removeItem(key);
  } catch {}
}

function setLastScreen(name) {
  safeSetLS(LS_LAST_SCREEN, String(name || ""));
}

function safeGetJSON(key) {
  const raw = safeGetLS(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function safeSetJSON(key, obj) {
  safeSetLS(key, JSON.stringify(obj));
}

// -----------------------
// Ratatouille trial state
// -----------------------
function getRatatouilleTrialState() {
  const st = safeGetJSON(LS_RATA_TRIAL);
  if (st && typeof st === "object") {
    return { started: !!st.started, completed: !!st.completed, forcedUsed: !!st.forcedUsed };
  }
  return { started: false, completed: false, forcedUsed: false };
}

function setRatatouilleTrialState(next) {
  const cur = getRatatouilleTrialState();
  const merged = { ...cur, ...(next || {}) };
  safeSetJSON(LS_RATA_TRIAL, merged);

  if (!GameState.flags) GameState.flags = {};
  if (!GameState.flags.secrets) GameState.flags.secrets = {};
  GameState.flags.secrets.ratatouilleTrial = merged;
}

function mirrorRatatouilleTrialToGameState() {
  const st = getRatatouilleTrialState();
  if (!GameState.flags) GameState.flags = {};
  if (!GameState.flags.secrets) GameState.flags.secrets = {};
  if (!GameState.flags.secrets.ratatouilleTrial) GameState.flags.secrets.ratatouilleTrial = st;
}

// -----------------------
// Boot-time defaults rule
// -----------------------
const BOOT_LAST_SCREEN = String(safeGetLS(LS_LAST_SCREEN) || "");
const BOOT_FORCE_DEFAULTS = BOOT_LAST_SCREEN === "select" || BOOT_LAST_SCREEN === "menu";
if (BOOT_FORCE_DEFAULTS) {
  safeRemoveLS(LS_SELECT_SLOT_IDS);
  safeRemoveLS(LS_SELECT_UI);
}

// -----------------------
// runtime state
// -----------------------
let slots = null; // number (movie base index) OR special token string
let activeSlot = 0;
let inputMode = "keyboard";
let focus = "movies";

let archetypeIndex = 0;
let archetypeConfirmed = false;
let confirmedArchetypeIndex = 0;

let searchQuery = "";
let confirmPending = false;

// unlock overlay state (Select can show overlays EXCEPT Ratatouille)
let uiMode = "select"; // "select" | "unlock"
let overlayPayload = null;

// -----------------------
// ✅ Layered music state (autoplay-safe boot)
// -----------------------
let layeredReady = false;
let layeredLoading = false;

async function bootNavLayersFromGestureIfNeeded() {
  if (layeredReady) return true;
  if (layeredLoading) return false;

  layeredLoading = true;
  try {
    // ensureStarted() resumes AudioContext and starts stems — MUST be gesture-driven.
    await MenuLayers.ensureStarted();
    layeredReady = true;

    // ✅ Apply saved music volume as soon as audio is actually started
    try { syncOptionsAudioNow(); } catch {}

    // After start, ensure Select/Nav mix (layer1 + layer2)
    MenuLayers.setMix(NAV_MIX, 140);
    return true;
  } catch {
    return false;
  } finally {
    layeredLoading = false;
  }
}

// -----------------------
// derived layout values
// -----------------------
const W = SCREEN.W;
const H = SCREEN.H;

function C() {
  return L?.colors || {};
}
function S() {
  return L?.slots || {};
}
function bottom() {
  return L?.bottom || {};
}

// -----------------------
// geometry (FIXED STACK)
// -----------------------

// Poster aspect is WIDTH/HEIGHT (2/3 = portrait)
function posterAspect() {
  const a = Number(S()?.poster?.aspect ?? (2 / 3));
  return a > 0 ? a : 2 / 3;
}

// posterHeight = width / (width/height)
function posterHForW(w) {
  return Math.floor(w / posterAspect());
}

/**
 * ✅ IMPORTANT:
 * You asked: “adjust all the slots width (poster + slot + buttons + nameplate) to match
 * the existing movie poster width.”
 *
 * In your current setup the “visible poster width” is smaller than S().w because
 * posterRect used padX/inset.
 *
 * So we compute the *existing* visible poster width and use that as the new slot width.
 */
function visualSlotW() {
  const baseW = Number(S()?.w ?? 80);
  const padX = Number(S()?.poster?.padX ?? 0);
  const inset = Number(S()?.poster?.inset ?? 0);

  // existing drawn poster width (what you SEE)
  const w = Math.floor(baseW - 2 * (padX + inset));
  return Math.max(24, w);
}

function slotX(i) {
  const sw = visualSlotW();
  const gap = Number(S()?.gap ?? 13);
  const totalW = SLOT_COUNT * sw + (SLOT_COUNT - 1) * gap;
  const startX = Math.floor((W - totalW) / 2);
  return startX + i * (sw + gap);
}

// Full slot “card” is computed from its parts to avoid overlap.
function slotCardRect(i) {
  const x = slotX(i);
  const y = Number(S()?.y ?? 96);
  const w = visualSlotW();

  const ah = Number(S()?.arrowHitH ?? 18);
  const np = S()?.nameplate || {};
  const nh = Number(np.h ?? 25);

  const pH = posterHForW(w);

  // ✅ remove the “bar” gap under posters
  const gapNP = 0;

  // [top arrow] + [poster] + gap + [nameplate] + [bottom arrow]
  const h = ah + pH + gapNP + nh + ah;

  return { x, y, w, h };
}

function topArrowRect(i) {
  const r = slotCardRect(i);
  const ah = Number(S()?.arrowHitH ?? 18);
  return { x: r.x, y: r.y, w: r.w, h: ah };
}

/**
 * ✅ Poster rect is EXACTLY the same width as the slot (visualSlotW),
 * and height is EXACTLY the aspect-derived height.
 * No pad/inset, no crop, no bars.
 */
function posterRect(i) {
  const r = slotCardRect(i);
  const ah = Number(S()?.arrowHitH ?? 18);

  // How much smaller (px) on each side. Try 1 first.
  const shrink = Number(S()?.poster?.shrink ?? 1);

  const fullW = r.w;
  const fullH = posterHForW(fullW);

  return {
    // keep same position, just move in slightly so it doesn't touch the stroke
    x: r.x + shrink,
    y: r.y + ah + shrink,
    w: Math.max(2, fullW - shrink * 2),
    h: Math.max(2, fullH - shrink * 2)
  };
}


function nameplateRect(i) {
  const r = slotCardRect(i);
  const ah = Number(S()?.arrowHitH ?? 18);
  const np = S()?.nameplate || {};
  const nh = Number(np.h ?? 25);

  const pH = posterHForW(r.w);
  const gapNP = 0;

  return { x: r.x, y: r.y + ah + pH + gapNP, w: r.w, h: nh };
}

function bottomArrowRect(i) {
  const r = slotCardRect(i);
  const npR = nameplateRect(i);
  const ah = Number(S()?.arrowHitH ?? 18);
  return { x: r.x, y: npR.y + npR.h, w: r.w, h: ah };
}

function slotBounds(i) {
  return slotCardRect(i);
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function clampIndex(i, len) {
  if (len <= 0) return 0;
  return ((i % len) + len) % len;
}

// -----------------------
// helpers
// -----------------------
function resetConfirm() {
  confirmPending = false;
}

function clearAllSlotsToBlank() {
  slots = new Array(SLOT_COUNT).fill(SLOT_TOKEN_BLANK);

  activeSlot = 0;
  inputMode = "keyboard";
  focus = "movies";

  archetypeIndex = 0;
  archetypeConfirmed = false;
  confirmedArchetypeIndex = 0;

  searchQuery = "";
  resetConfirm();

  uiMode = "select";
  overlayPayload = null;

  persistSelectStateByBase();
}

function closeOverlay() {
  uiMode = "select";
  overlayPayload = null;
}

function maybeOpenOverlayFromGlobalEvents() {
  if (uiMode !== "select") return;

  const events = peekUnlockEvents(GameState);
  if (!events || !events.length) return;

  const next = events.find(
    (e) =>
      e?.type === "ARCHETYPE_UNLOCKED" &&
      e?.showOverlay &&
      e?.archetypeId !== RATATOUILLE_ARCHETYPE_ID
  );
  if (!next) return;

  overlayPayload = popNextUnlockEvent(GameState);
  if (overlayPayload) {
    uiMode = "unlock";
    resetConfirm();
    persistSelectStateByBase();
  }
}

function getVisibleMoviesBase() {
  ensureUnlockState(GameState);
  const visible = getAvailableMovies(GameState.unlocks);
  return Array.isArray(visible) && visible.length > 0 ? visible : movies;
}

function getDisplayMovies() {
  const base = getVisibleMoviesBase();
  const q = String(searchQuery || "").trim().toLowerCase();
  if (!q) return { base, display: base, displayToBase: null };

  const display = [];
  const displayToBase = [];
  for (let i = 0; i < base.length; i++) {
    const t = String(base[i]?.title || "").toLowerCase();
    if (t.includes(q)) {
      display.push(base[i]);
      displayToBase.push(i);
    }
  }

  if (display.length === 0) return { base, display: base, displayToBase: null };
  return { base, display, displayToBase };
}

// allow special token strings to remain as-is
function normalizeSlotsToBaseLength(baseLen) {
  if (!Array.isArray(slots) || slots.length !== SLOT_COUNT) return;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const v = slots[i];
    if (typeof v === "string") continue;
    if (typeof v !== "number" || !Number.isFinite(v) || baseLen <= 0) slots[i] = 0;
    else slots[i] = ((v % baseLen) + baseLen) % baseLen;
  }
}

function getAllowedBaseIndices(baseLen, displayToBase) {
  if (baseLen <= 0) return [];
  if (Array.isArray(displayToBase) && displayToBase.length > 0) return displayToBase.slice();
  const out = new Array(baseLen);
  for (let i = 0; i < baseLen; i++) out[i] = i;
  return out;
}

// cycling rules (same as your current)
function cycleSlotWithOptionalFilter(slotIdx, dir, displayToBase, baseLen) {
  if (baseLen <= 0) return;

  const allowed = getAllowedBaseIndices(baseLen, displayToBase);
  if (!allowed.length) return;

  const cur = slots[slotIdx];

  const isMovie = typeof cur === "number" && Number.isFinite(cur);
  const isBlank = cur === SLOT_TOKEN_BLANK;
  const isRandom = cur === SLOT_TOKEN_RANDOM;
  const isGenre = typeof cur === "string" && GENRE_TOKEN_TO_DEF.has(cur);

  const genreTokens = GENRE_RANDOM_SLOTS.map((g) => g.token);
  const firstGenre = genreTokens[0];

  if (isBlank) {
    if (dir > 0) {
      slots[slotIdx] = allowed[0];
      return;
    }
    slots[slotIdx] = SLOT_TOKEN_RANDOM;
    return;
  }

  if (isRandom) {
    if (dir > 0) {
      slots[slotIdx] = firstGenre || SLOT_TOKEN_BLANK;
      return;
    }
    slots[slotIdx] = allowed[allowed.length - 1];
    return;
  }

  if (isGenre) {
    const gi = genreTokens.indexOf(cur);
    if (gi < 0) {
      slots[slotIdx] = SLOT_TOKEN_RANDOM;
      return;
    }

    if (dir < 0) {
      if (gi === 0) {
        slots[slotIdx] = SLOT_TOKEN_RANDOM;
        return;
      }
      slots[slotIdx] = genreTokens[gi - 1];
      return;
    }

    if (gi === genreTokens.length - 1) {
      slots[slotIdx] = SLOT_TOKEN_BLANK;
      return;
    }

    slots[slotIdx] = genreTokens[gi + 1];
    return;
  }

  let pos = allowed.indexOf(isMovie ? cur : allowed[0]);
  if (pos < 0) pos = 0;

  if (dir < 0 && pos === 0) {
    slots[slotIdx] = SLOT_TOKEN_BLANK;
    return;
  }

  if (dir > 0 && pos === allowed.length - 1) {
    slots[slotIdx] = SLOT_TOKEN_RANDOM;
    return;
  }

  pos = clampIndex(pos + dir, allowed.length);
  slots[slotIdx] = allowed[pos];
}

function pickDistinct(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a.slice(0, n);
}

function randomizeSlots(baseLen, displayToBase, playSfx = true) {
  const allowed = getAllowedBaseIndices(baseLen, displayToBase);
  if (allowed.length <= 0) return;

  const picks = allowed.length >= SLOT_COUNT ? pickDistinct(allowed, SLOT_COUNT) : null;

  const next = new Array(SLOT_COUNT);
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (picks) next[i] = picks[i];
    else next[i] = allowed[Math.floor(Math.random() * allowed.length)];
  }

  slots = next;
  resetConfirm();
  persistSelectStateByBase();
  if (playSfx) playUIMoveBlip();
}

function normalizeGenreName(g) {
  const s = String(g || "").trim();
  return s ? s.toUpperCase() : "";
}

function getMetaEntryForMovieId(id) {
  if (!id) return null;

  if (movieMeta && typeof movieMeta === "object" && !Array.isArray(movieMeta)) {
    if (movieMeta[id]) return movieMeta[id];
  }

  if (Array.isArray(movieMeta)) {
    return movieMeta.find((m) => m?.id === id || m?.movieId === id) || null;
  }

  return null;
}

function getGenresForMovie(movie) {
  const id = movie?.id ? String(movie.id) : "";
  if (!id) return [];

  const meta = getMetaEntryForMovieId(id);
  if (!meta) return [];

  const out = new Set();
  const list = [];

  if (Array.isArray(meta.genres)) list.push(...meta.genres);
  if (meta.primaryGenre) list.push(meta.primaryGenre);
  if (meta.secondaryGenre) list.push(meta.secondaryGenre);
  if (meta.genre) list.push(meta.genre);

  for (const g of list) {
    const ng = normalizeGenreName(g);
    if (ng) out.add(ng);
  }

  return Array.from(out);
}

function randomizeSlotsCommonGenre(baseVisible, displayToBase, playSfx = true) {
  const baseLen = Array.isArray(baseVisible) ? baseVisible.length : 0;
  const allowed = getAllowedBaseIndices(baseLen, displayToBase);
  if (allowed.length <= 0) return false;

  const genreToIndices = new Map();

  for (const idx of allowed) {
    const m = baseVisible[idx];
    const genres = getGenresForMovie(m);
    for (const g of genres) {
      if (!genreToIndices.has(g)) genreToIndices.set(g, []);
      genreToIndices.get(g).push(idx);
    }
  }

  const candidates = [];
  for (const [g, arr] of genreToIndices.entries()) {
    const uniq = Array.from(new Set(arr));
    if (uniq.length >= SLOT_COUNT) candidates.push({ genre: g, indices: uniq });
  }

  if (candidates.length === 0) return false;

  const weighted = [];
  for (const c of candidates) {
    const w = Math.max(1, Math.min(6, Math.floor(c.indices.length / 4)));
    for (let k = 0; k < w; k++) weighted.push(c);
  }
  const chosen = weighted[Math.floor(Math.random() * weighted.length)] || candidates[0];

  const picked = pickDistinct(chosen.indices, SLOT_COUNT);
  if (picked.length < SLOT_COUNT) return false;

  slots = picked;
  archetypeIndex = 0;
  archetypeConfirmed = false;

  resetConfirm();
  persistSelectStateByBase();
  if (playSfx) playUIMoveBlip();
  return true;
}

function getMovieById(id) {
  return (
    movies.find((m) => m.id === id) || {
      id,
      title: "Unknown",
      runtime: 120,
      imdb: 7.0
    }
  );
}

function getArchetypeById(id) {
  return playerArchetypes.find((a) => a?.id === id) || null;
}

function startLevelIntroWithArchetype(archetypeId, opts = {}) {
  const skipOneFour = !!opts.skipOneFour;
  const a = getArchetypeById(archetypeId);
  if (!a) return false;

  GameState.party.movies = (a.movieIds || []).slice(0, 4).map(getMovieById);

  GameState.runMode = null;
  GameState.currentLevel = 1;
  GameState.enemyTemplate = null;
  GameState.enemy = null;

  GameState.campaign = {
    onefourShown: skipOneFour ? true : false,
    firstPickApplied: null,
    fourthPickApplied: null,
    effects: { first: null, fourth: null },
    _onefourAppliedThisBattle: false,
    flavor: {},
    runtime: {}
  };

  setLastScreen("levelIntro");
  playUIConfirmBlip();

  // ✅ Leaving Select/Nav flow -> stop layered stems before run music
  try { MenuLayers.stop({ fadeMs: 180 }); } catch {}

  changeScreen("levelIntro");
  return true;
}


// -----------------------
// Consecutive-R logic
// -----------------------
function ensureRataStreak() {
  if (!GameState.flags) GameState.flags = {};
  if (!GameState.flags.secrets) GameState.flags.secrets = {};
  if (typeof GameState.flags.secrets.rataStreak !== "number") {
    GameState.flags.secrets.rataStreak = 0;
  }
}

function resetRandomizeStreak() {
  ensureRataStreak();
  GameState.flags.secrets.rataStreak = 0;
}

function onPressRandomizeMaybeStartTrial() {
  ensureStatsState(GameState);
  ensureUnlockState(GameState);
  mirrorRatatouilleTrialToGameState();
  ensureRataStreak();

  incRandomizeClicks(GameState, 1);
  GameState.flags.secrets.rataStreak += 1;

  const streak = GameState.flags.secrets.rataStreak;
  const trial = getRatatouilleTrialState();
  const alreadyUnlocked = isArchetypeUnlocked(GameState, RATATOUILLE_ARCHETYPE_ID);

  if (alreadyUnlocked || trial.forcedUsed) {
    evaluateUnlockRules(GameState);
    return;
  }

  if (streak === 30) {
    setRatatouilleTrialState({ started: true, completed: false, forcedUsed: true });

    const ok = startLevelIntroWithArchetype(RATATOUILLE_ARCHETYPE_ID, { skipOneFour: true });

    if (!ok) {
      setRatatouilleTrialState({ started: false, completed: false, forcedUsed: false });
      resetRandomizeStreak();
    }
    return;
  }

  evaluateUnlockRules(GameState);
}

// -----------------------
// archetypes list
// -----------------------
function getSelectableArchetypes() {
  ensureUnlockState(GameState);

  const list = [{ id: "custom", name: "Custom", movieIds: [] }];

  for (const a of playerArchetypes) {
    if (!a) continue;
    if (!a.hidden) list.push(a);
    else if (isArchetypeUnlocked(GameState, a.id)) list.push(a);
  }

  return list;
}

function setArchetypeByIndex(nextIndex) {
  const baseVisible = getVisibleMoviesBase();
  const archetypes = getSelectableArchetypes();

  archetypeIndex = clampIndex(nextIndex, archetypes.length);

  const chosen = archetypes[archetypeIndex];
  if (!chosen || chosen.id === "custom") return;

  const byId = new Map();
  for (let i = 0; i < baseVisible.length; i++) byId.set(baseVisible[i].id, i);

  const filled = new Array(SLOT_COUNT).fill(0);
  const ids = Array.isArray(chosen.movieIds) ? chosen.movieIds : [];

  for (let i = 0; i < SLOT_COUNT; i++) {
    const id = ids[i];
    filled[i] = id && byId.has(id) ? byId.get(id) : 0;
  }

  slots = filled;
  resetConfirm();
  persistSelectStateByBase();
}

// -----------------------
// special slot resolving
// -----------------------
function isSpecialSlotValue(v) {
  return typeof v === "string";
}

function isBlankSlotValue(v) {
  return v === SLOT_TOKEN_BLANK;
}

function hasBlankSlot() {
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (isBlankSlotValue(slots?.[i])) return true;
  }
  return false;
}

function indicesForGenre(baseVisible, genre) {
  const g = normalizeGenreName(genre);
  const out = [];
  for (let i = 0; i < baseVisible.length; i++) {
    const m = baseVisible[i];
    const gs = getGenresForMovie(m);
    if (gs.includes(g)) out.push(i);
  }
  return out;
}

function resolvePartyFromSlots(baseVisible) {
  const baseLen = Array.isArray(baseVisible) ? baseVisible.length : 0;
  if (baseLen <= 0) return new Array(SLOT_COUNT).fill(getMovieById("unknown"));

  const used = new Set();
  for (let i = 0; i < SLOT_COUNT; i++) {
    const v = slots[i];
    if (typeof v === "number" && v >= 0) used.add(v);
  }

  function pickFromPool(pool) {
    if (!Array.isArray(pool) || pool.length === 0) return null;
    const unused = pool.filter((x) => !used.has(x));
    const src = unused.length ? unused : pool;
    const idx = src[Math.floor(Math.random() * src.length)];
    if (typeof idx === "number") used.add(idx);
    return idx;
  }

  const party = new Array(SLOT_COUNT);

  for (let i = 0; i < SLOT_COUNT; i++) {
    const v = slots[i];

    if (typeof v === "number" && v >= 0) {
      party[i] = baseVisible[v] || baseVisible[0];
      continue;
    }

    if (v === SLOT_TOKEN_RANDOM) {
      const all = [];
      for (let k = 0; k < baseLen; k++) all.push(k);
      const pick = pickFromPool(all);
      party[i] = baseVisible[pick ?? 0] || baseVisible[0];
      continue;
    }

    const def = GENRE_TOKEN_TO_DEF.get(v);
    if (def) {
      const pool = indicesForGenre(baseVisible, def.genre);
      const pick = pickFromPool(pool);

      if (pick == null) {
        const all = [];
        for (let k = 0; k < baseLen; k++) all.push(k);
        const anyPick = pickFromPool(all);
        party[i] = baseVisible[anyPick ?? 0] || baseVisible[0];
      } else {
        party[i] = baseVisible[pick] || baseVisible[0];
      }
      continue;
    }

    party[i] = baseVisible[0];
  }

  return party;
}

function specialSlotLabel(v) {
  if (v === SLOT_TOKEN_BLANK) return "BLANK";
  if (v === SLOT_TOKEN_RANDOM) return "RANDOM";
  const def = GENRE_TOKEN_TO_DEF.get(v);
  if (def) return def.label || `RAND: ${def.genre}`;
  return "SPECIAL";
}

// -----------------------
// Persistence
// -----------------------
function getSlotIdsFromBase(baseVisible) {
  const ids = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const v = slots?.[i];
    if (typeof v === "string") {
      ids.push(v);
      continue;
    }
    const movie = baseVisible?.[v ?? 0];
    ids.push(movie?.id || null);
  }
  return ids;
}

function setSlotsFromIds(baseVisible, ids) {
  const baseLen = Array.isArray(baseVisible) ? baseVisible.length : 0;
  if (baseLen <= 0) {
    slots = new Array(SLOT_COUNT).fill(0);
    return;
  }

  const byId = new Map();
  for (let i = 0; i < baseLen; i++) byId.set(baseVisible[i]?.id, i);

  const out = new Array(SLOT_COUNT).fill(0);
  for (let i = 0; i < SLOT_COUNT; i++) {
    const id = ids?.[i];

    if (id === SLOT_TOKEN_BLANK || id === SLOT_TOKEN_RANDOM || GENRE_TOKEN_TO_DEF.has(id)) {
      out[i] = id;
      continue;
    }

    out[i] = id && byId.has(id) ? byId.get(id) : 0;
  }
  slots = out;
}

function computeDefaultIds() {
  return DEFAULT_START_IDS.slice(0, SLOT_COUNT);
}

function applyDefaults(baseVisible) {
  setSlotsFromIds(baseVisible, computeDefaultIds());

  activeSlot = 0;
  inputMode = "keyboard";
  focus = "movies";

  archetypeIndex = 0;
  archetypeConfirmed = false;
  confirmedArchetypeIndex = 0;

  searchQuery = "";
  resetConfirm();

  uiMode = "select";
  overlayPayload = null;

  resetRandomizeStreak();
  persistSelectStateByBase();
}

function readPersistedSlotIds() {
  const raw = safeGetLS(LS_SELECT_SLOT_IDS);
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    return arr.slice(0, SLOT_COUNT);
  } catch {
    return null;
  }
}

function readPersistedUI() {
  const raw = safeGetLS(LS_SELECT_UI);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

function persistSelectStateByBase() {
  const baseVisible = getVisibleMoviesBase();
  const ids = getSlotIdsFromBase(baseVisible);
  safeSetLS(LS_SELECT_SLOT_IDS, JSON.stringify(ids));

  const ui = {
    activeSlot,
    focus,
    archetypeIndex,
    archetypeConfirmed,
    confirmedArchetypeIndex,
    searchQuery,
    confirmPending
  };
  safeSetLS(LS_SELECT_UI, JSON.stringify(ui));
}

function restoreFromPersistIfPossible(baseVisible) {
  const ids = readPersistedSlotIds();
  if (!ids) return false;

  setSlotsFromIds(baseVisible, ids);

  const ui = readPersistedUI();
  if (ui) {
    activeSlot =
      typeof ui.activeSlot === "number" && Number.isFinite(ui.activeSlot)
        ? clampIndex(ui.activeSlot, SLOT_COUNT)
        : 0;

    focus = ui.focus === "archetypes" || ui.focus === "search" ? ui.focus : "movies";

    archetypeIndex = typeof ui.archetypeIndex === "number" ? ui.archetypeIndex : 0;
    archetypeConfirmed = !!ui.archetypeConfirmed;
    confirmedArchetypeIndex =
      typeof ui.confirmedArchetypeIndex === "number" ? ui.confirmedArchetypeIndex : 0;

    searchQuery = typeof ui.searchQuery === "string" ? ui.searchQuery : "";
    confirmPending = !!ui.confirmPending;
  }

  inputMode = "keyboard";
  uiMode = "select";
  overlayPayload = null;

  resetRandomizeStreak();
  return true;
}

function ensureInitialized() {
  const baseVisible = getVisibleMoviesBase();
  ensureStatsState(GameState);
  mirrorRatatouilleTrialToGameState();
  ensureRataStreak();

  if (Array.isArray(slots) && slots.length === SLOT_COUNT) {
    normalizeSlotsToBaseLength(baseVisible.length);

    const archetypes = getSelectableArchetypes();
    archetypeIndex = clampIndex(archetypeIndex, archetypes.length);
    confirmedArchetypeIndex = clampIndex(confirmedArchetypeIndex, archetypes.length);
    return;
  }

  if (BOOT_FORCE_DEFAULTS) applyDefaults(baseVisible);
  else {
    const restored = restoreFromPersistIfPossible(baseVisible);
    if (!restored) applyDefaults(baseVisible);
  }

  const archetypes = getSelectableArchetypes();
  archetypeIndex = clampIndex(archetypeIndex, archetypes.length);
  confirmedArchetypeIndex = clampIndex(confirmedArchetypeIndex, archetypes.length);
}

function goHome() {
  resetRandomizeStreak();

  persistSelectStateByBase();
  setLastScreen("menu");

  playUIBackBlip();
  changeScreen("menu");
}

function confirmPicks(baseVisible) {
  resetRandomizeStreak();

  if (hasBlankSlot()) {
    playUIBackBlip();
    confirmPending = false;
    persistSelectStateByBase();
    return;
  }

  GameState.party.movies = resolvePartyFromSlots(baseVisible);

  persistSelectStateByBase();
  setLastScreen("levelIntro");

  GameState.currentLevel = 1;
  GameState.enemyTemplate = null;
  GameState.enemy = null;
  GameState.campaign = {
    onefourShown: false,
    effects: { first: null, fourth: null },
    _onefourAppliedThisBattle: false,
    flavor: {},
    runtime: {}
  };

  playUIConfirmBlip();

  // ✅ Leaving Select/Nav flow -> stop layered stems before run music
  try { MenuLayers.stop({ fadeMs: 180 }); } catch {}

  changeScreen("levelIntro");
}

// -----------------------
// UI rect helpers
// -----------------------
function searchRects() {
  const sh = Number(L?.search?.h ?? 20);
  const sw = Number(L?.search?.w ?? 213);
  const btn = Number(L?.search?.btn ?? 20);
  const gap = Number(L?.search?.gap ?? 8);
  const y = Number(L?.search?.y ?? 56);

  const x = Math.floor((W - sw) / 2);

  return {
    left: { x: x - btn - gap, y, w: btn, h: sh },
    mid: { x, y, w: sw, h: sh },
    right: { x: x + sw + gap, y, w: btn, h: sh }
  };
}

function homeCornerRect() {
  const y = Number(bottom()?.y ?? 272);
  const btn = Number(bottom()?.cornerBtn ?? 23);
  const x = Number(bottom()?.homeX ?? 10);
  return { x, y, w: btn, h: btn };
}

function battleCornerRect() {
  const y = Number(bottom()?.y ?? 272);
  const btn = Number(bottom()?.cornerBtn ?? 23);
  const homeX = Number(bottom()?.homeX ?? 10);
  const x = W - homeX - btn;
  return { x, y, w: btn, h: btn };
}

function archetypeBarRects() {
  const by = Number(bottom()?.archetype?.y ?? 272);
  const bh = Number(bottom()?.archetype?.h ?? 23);
  const arrowW = Number(bottom()?.archetype?.arrowW ?? 23);
  const sidePad = Number(bottom()?.archetype?.sidePad ?? 13);
  const centerPad = Number(bottom()?.archetype?.centerPad ?? 8);

  const home = homeCornerRect();
  const barX = home.x + home.w + sidePad;
  const barW = W - barX * 2;

  const left = { x: barX, y: by, w: arrowW, h: bh };
  const right = { x: barX + barW - arrowW, y: by, w: arrowW, h: bh };
  const center = { x: barX + arrowW + centerPad, y: by, w: barW - (arrowW + centerPad) * 2, h: bh };

  return { bar: { x: barX, y: by, w: barW, h: bh }, left, right, center };
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
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

function fitTextByShrinking(ctx, text, maxWidth, startPx = 11, minPx = 8) {
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

function getNameplateTitle(movie) {
  if (!movie) return "Unknown";
  const s = String(movie.shortTitle || "").trim();
  if (s) return s;
  return String(movie.title || "Unknown");
}

function getLocalPosterPath(movie) {
  const id = movie?.id ? String(movie.id) : "";
  if (!id) return null;
  return `assets/posters/${id}.jpg`;
}

function detectKeyboardInput(mouse) {
  if (
    Input.pressed("Left") ||
    Input.pressed("Right") ||
    Input.pressed("Up") ||
    Input.pressed("Down") ||
    Input.pressed("Confirm") ||
    Input.pressed("Back") ||
    Input.pressed("Toggle") ||
    Input.pressed("Randomize") ||
    Input.pressed("GenreRandomize") ||
    Input.pressed("Clear")
  ) {
    return "keyboard";
  }
  // ✅ A click/tap can happen without any pointermove first (mobile/trackpad).
  // Treat pressed/clicked/tapped as mouse input so hitboxes always work.
  if (mouse?.moved || mouse?.pressed || mouse?.clicked || mouse?.tapped) return "mouse";
  return inputMode;
}

function confirmBoxRect() {
  const helpY = Number(L?.help?.y ?? 40);
  const r = L?.confirm?.box || {};
  return { x: Number(r.x ?? 40), y: helpY + 6, w: Number(r.w ?? 320), h: Number(r.h ?? 18) };
}

function shouldResetStreakThisFrame(mouse, inConfirmPending) {
  if (inConfirmPending) return true;
  if (Input.pressed("GenreRandomize")) return true;
  if (Input.pressed("Toggle")) return true;
  if (Input.pressed("Confirm")) return true;
  if (Input.pressed("Back")) return true;
  if (Input.pressed("Clear")) return true;
  if (Input.pressed("Left") || Input.pressed("Right") || Input.pressed("Up") || Input.pressed("Down")) return true;
  if (mouse?.clicked) return true;
  return false;
}

// Special poster art
function drawSpecialPoster(ctx, pr, v) {
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

// -----------------------
// Screen
// -----------------------
export const SelectScreen = {
  enter() {
    // ✅ Apply saved volumes immediately when entering Select.
    // (Safe even before audio is started; if buses don't exist yet, sync is a no-op.)
    try { syncOptionsAudioNow(); } catch {}
    

    // ✅ Select wants NAV mix (layer1 + layer2).
    // Do NOT start/resume here (autoplay-safe). Just set the desired mix.
    try { MenuLayers.setMix(NAV_MIX, 0); } catch {}
  },


  update(mouse) {
    // ✅ Gesture-gated boot: if any meaningful input happened this frame, try starting stems.
    if (
      Input.pressed("Confirm") ||
      Input.pressed("Left") ||
      Input.pressed("Right") ||
      Input.pressed("Up") ||
      Input.pressed("Down") ||
      Input.pressed("Back") ||
      Input.pressed("Toggle") ||
      Input.pressed("Randomize") ||
      Input.pressed("GenreRandomize") ||
      Input.pressed("Clear")
    ) {
      // fire-and-forget; don't block input
      bootNavLayersFromGestureIfNeeded();
    }

    // Also keep forcing NAV mix while we're on Select (safe even if not started yet)
    try {
      MenuLayers.setMix(NAV_MIX, 0);
    } catch {}

    // ✅ Keep master bus synced to saved Options level
    try { syncOptionsAudioNow(); } catch {}

    maybeOpenOverlayFromGlobalEvents();

    if (uiMode === "unlock") {
      if (Input.pressed("Clear")) {
        Input.consume("Clear");
        closeOverlay();
        ensureInitialized();
        clearAllSlotsToBlank();
        playUIConfirmBlip();
        return;
      }

      if (Input.pressed("Back")) {
        Input.consume("Back");
        playUIBackBlip();
        closeOverlay();
        return;
      }

      if (Input.pressed("Confirm")) {
        Input.consume("Confirm");
        playUIConfirmBlip();
        closeOverlay();
        return;
      }

      return;
    }

    setLastScreen("select");
    ensureInitialized();

    const { base: baseVisible, displayToBase } = getDisplayMovies();
    const archetypes = getSelectableArchetypes();

    inputMode = detectKeyboardInput(mouse);

    if (!Input.pressed("Randomize") && shouldResetStreakThisFrame(mouse, confirmPending)) {
      resetRandomizeStreak();
    }

    if (Input.pressed("Clear")) {
      Input.consume("Clear");
      clearAllSlotsToBlank();
      playUIConfirmBlip();
      return;
    }

    if (Input.pressed("Back")) {
      Input.consume("Back");
      playUIBackBlip();

      if (confirmPending) {
        resetConfirm();
        persistSelectStateByBase();
        return;
      }

      goHome();
      return;
    }

    if (confirmPending) {
      // ✅ Confirm-pending: keyboard Confirm commits; mouse/tap uses corner buttons.
      if (inputMode === "keyboard" && Input.pressed("Confirm")) {
        Input.consume("Confirm");
        confirmPicks(baseVisible);
        resetConfirm();
        return;
      }

      // Mouse/touch while confirm-pending:
      // - Left corner button = Back (cancel)
      // - Right corner button = Confirm (start)
      // - Anywhere else = Back (cancel)
      if (mouse?.clicked) {
        const mx = mouse.x;
        const my = mouse.y;

        if (pointInRect(mx, my, homeCornerRect())) {
          playUIBackBlip();
          resetConfirm();
          persistSelectStateByBase();
          return;
        }

        if (pointInRect(mx, my, battleCornerRect())) {
          playUIConfirmBlip();
          confirmPicks(baseVisible);
          resetConfirm();
          return;
        }

        playUIBackBlip();
        resetConfirm();
        persistSelectStateByBase();
        return;
      }

      return;
    }

    if (Input.pressed("Toggle")) {
      Input.consume("Toggle");
      resetConfirm();

      if (focus === "search") focus = "movies";
      else focus = focus === "movies" ? "archetypes" : "movies";

      persistSelectStateByBase();
      playUIMoveBlip();
      return;
    }

    if (Input.pressed("Randomize")) {
      Input.consume("Randomize");
      archetypeIndex = 0;
      archetypeConfirmed = false;

      randomizeSlots(baseVisible.length, displayToBase, true);
      onPressRandomizeMaybeStartTrial();

      if (GameState.currentScreen !== "select") return;
      return;
    }

    if (Input.pressed("GenreRandomize")) {
      Input.consume("GenreRandomize");
      archetypeIndex = 0;
      archetypeConfirmed = false;

      const ok = randomizeSlotsCommonGenre(baseVisible, displayToBase, true);
      if (!ok) randomizeSlots(baseVisible.length, displayToBase, true);
      return;
    }

    if (inputMode === "keyboard" && Input.pressed("Confirm")) {
      Input.consume("Confirm");

      if (focus === "search") {
        try {
          const next = window.prompt("Search movies by title:", searchQuery || "");
          if (next !== null) {
            searchQuery = String(next || "").trim();
            resetConfirm();
            persistSelectStateByBase();
            playUIConfirmBlip();
          } else {
            playUIBackBlip();
          }
        } catch {
          playUIBackBlip();
        }
        return;
      }

      if (focus === "archetypes") {
        if (!archetypeConfirmed) {
          archetypeConfirmed = true;
          confirmedArchetypeIndex = clampIndex(archetypeIndex, archetypes.length);
          setArchetypeByIndex(confirmedArchetypeIndex);
          resetConfirm();
          persistSelectStateByBase();
          playUIConfirmBlip();
          return;
        }

        confirmPending = true;
        persistSelectStateByBase();
        playUIConfirmBlip();
        return;
      }

      confirmPending = true;
      persistSelectStateByBase();
      playUIConfirmBlip();
      return;
    }

    // Keyboard navigation
    if (inputMode === "keyboard") {
      if (focus === "movies") {
        if (Input.pressed("Left")) {
          Input.consume("Left");
          activeSlot = (activeSlot - 1 + SLOT_COUNT) % SLOT_COUNT;
          resetConfirm();
          persistSelectStateByBase();
          playUIMoveBlip();
        }
        if (Input.pressed("Right")) {
          Input.consume("Right");
          activeSlot = (activeSlot + 1) % SLOT_COUNT;
          resetConfirm();
          persistSelectStateByBase();
          playUIMoveBlip();
        }
        if (Input.pressed("Up")) {
          Input.consume("Up");
          if (archetypeIndex !== 0) archetypeIndex = 0;
          archetypeConfirmed = false;
          cycleSlotWithOptionalFilter(activeSlot, -1, displayToBase, baseVisible.length);
          resetConfirm();
          persistSelectStateByBase();
          playUIMoveBlip();
        }
        if (Input.pressed("Down")) {
          Input.consume("Down");
          if (archetypeIndex !== 0) archetypeIndex = 0;
          archetypeConfirmed = false;
          cycleSlotWithOptionalFilter(activeSlot, +1, displayToBase, baseVisible.length);
          resetConfirm();
          persistSelectStateByBase();
          playUIMoveBlip();
        }
      } else if (focus === "archetypes") {
        if (Input.pressed("Left")) {
          Input.consume("Left");
          if (!archetypeConfirmed) {
            archetypeIndex = clampIndex(archetypeIndex - 1, archetypes.length);
            setArchetypeByIndex(archetypeIndex);
            resetConfirm();
            persistSelectStateByBase();
          }
          playUIMoveBlip();
        }
        if (Input.pressed("Right")) {
          Input.consume("Right");
          if (!archetypeConfirmed) {
            archetypeIndex = clampIndex(archetypeIndex + 1, archetypes.length);
            setArchetypeByIndex(archetypeIndex);
            resetConfirm();
            persistSelectStateByBase();
          }
          playUIMoveBlip();
        }
      }
    }

    // Mouse interactions
    if (inputMode === "mouse" && mouse?.clicked) {
      const mx = mouse.x;
      const my = mouse.y;

      if (pointInRect(mx, my, homeCornerRect())) {
        // ✅ In confirm-pending, left corner = BACK (cancel pending) rather than Home.
        if (confirmPending) {
          playUIBackBlip();
          resetConfirm();
          persistSelectStateByBase();
          return;
        }
        goHome();
        return;
      }

      if (confirmPending) {
        if (pointInRect(mx, my, battleCornerRect())) {
          playUIConfirmBlip();
          confirmPicks(baseVisible);
          resetConfirm();
          return;
        }
        playUIBackBlip();
        resetConfirm();
        persistSelectStateByBase();
        return;
      }

      if (pointInRect(mx, my, battleCornerRect())) {
        confirmPending = true;
        persistSelectStateByBase();
        playUIConfirmBlip();
        return;
      }

      const sr = searchRects();
      if (pointInRect(mx, my, sr.mid)) {
        focus = "search";
        resetConfirm();
        persistSelectStateByBase();
        playUIMoveBlip();
        return;
      }

      // ✅ Arrow hitboxes MUST be checked before slotBounds,
      // because slotBounds includes the arrow areas.
      for (let i = 0; i < SLOT_COUNT; i++) {
        if (pointInRect(mx, my, topArrowRect(i))) {
          focus = "movies";
          activeSlot = i;
          archetypeIndex = 0;
          archetypeConfirmed = false;
          cycleSlotWithOptionalFilter(i, -1, displayToBase, baseVisible.length);
          resetConfirm();
          persistSelectStateByBase();
          playUIMoveBlip();
          return;
        }
        if (pointInRect(mx, my, bottomArrowRect(i))) {
          focus = "movies";
          activeSlot = i;
          archetypeIndex = 0;
          archetypeConfirmed = false;
          cycleSlotWithOptionalFilter(i, +1, displayToBase, baseVisible.length);
          resetConfirm();
          persistSelectStateByBase();
          playUIMoveBlip();
          return;
        }
      }

      for (let i = 0; i < SLOT_COUNT; i++) {
        if (pointInRect(mx, my, slotBounds(i))) {
          activeSlot = i;
          focus = "movies";
          resetConfirm();
          persistSelectStateByBase();
          playUIMoveBlip();
          return;
        }
      }

      const { left, right, center } = archetypeBarRects();

      if (pointInRect(mx, my, left)) {
        focus = "archetypes";
        if (!archetypeConfirmed) {
          archetypeIndex = clampIndex(archetypeIndex - 1, archetypes.length);
          setArchetypeByIndex(archetypeIndex);
          resetConfirm();
          persistSelectStateByBase();
        }
        playUIMoveBlip();
        return;
      }
      if (pointInRect(mx, my, right)) {
        focus = "archetypes";
        if (!archetypeConfirmed) {
          archetypeIndex = clampIndex(archetypeIndex + 1, archetypes.length);
          setArchetypeByIndex(archetypeIndex);
          resetConfirm();
          persistSelectStateByBase();
        }
        playUIMoveBlip();
        return;
      }
      if (pointInRect(mx, my, center)) {
        focus = focus === "movies" ? "archetypes" : "movies";
        resetConfirm();
        persistSelectStateByBase();
        playUIMoveBlip();
        return;
      }
    }
  },

  render(ctx) {
    setLastScreen("select");
    ensureInitialized();

    const { base: baseVisible } = getDisplayMovies();
    const archetypes = getSelectableArchetypes();

    const chosenIndex = archetypeConfirmed
      ? clampIndex(confirmedArchetypeIndex, archetypes.length)
      : clampIndex(archetypeIndex, archetypes.length);

    const chosenArchetype = archetypes[chosenIndex] || archetypes[0];

    // BG
    ctx.fillStyle = C().bg || "#000";
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = L?.title?.color || "#fff";
    ctx.font = L?.title?.font || "15px monospace";
    ctx.fillText(L?.title?.text || "Pick Your Movies", Number(L?.title?.x ?? 12), Number(L?.title?.y ?? 24));

    // Help
    ctx.fillStyle = L?.help?.color || "#777";
    ctx.font = L?.help?.font || "9px monospace";
    const helpX = Number(L?.help?.x ?? 12);
    const helpY = Number(L?.help?.y ?? 40);

    if (confirmPending) {
      ctx.fillText("Press Enter to Start Battle  Press Esc/Bksp to cancel.", helpX, helpY);
    } else {
      const toggleHint = focus === "archetypes" ? "Toggle: Cycle Movies" : "Toggle: Cycle Archetypes";
      ctx.fillText(`Enter: start  Esc/Bksp: back  R: Random  B: Clear  ${toggleHint}`, helpX, helpY);
    }

    // Search row
    const sr = searchRects();
    const s = L?.search || {};

    ctx.fillStyle = C().panel || "#111";
    ctx.fillRect(sr.left.x, sr.left.y, sr.left.w, sr.left.h);
    ctx.strokeStyle = focus === "search" ? (C().highlight || "#ff0") : (C().stroke || "#555");
    ctx.strokeRect(sr.left.x, sr.left.y, sr.left.w, sr.left.h);
    ctx.fillStyle = C().text || "#fff";
    ctx.font = s.iconFont || "13px monospace";
    ctx.fillText("✕", sr.left.x + 5, sr.left.y + 15);

    ctx.fillStyle = C().panel || "#111";
    ctx.fillRect(sr.mid.x, sr.mid.y, sr.mid.w, sr.mid.h);
    ctx.strokeStyle = focus === "search" ? (C().highlight || "#ff0") : (C().stroke || "#555");
    ctx.strokeRect(sr.mid.x, sr.mid.y, sr.mid.w, sr.mid.h);
    ctx.fillStyle = C().textDim || "#aaa";
    ctx.font = s.font || "11px monospace";
    ctx.fillText(searchQuery ? searchQuery : (s.placeholder || "search"), sr.mid.x + 10, sr.mid.y + 15);

    ctx.fillStyle = C().panel || "#111";
    ctx.fillRect(sr.right.x, sr.right.y, sr.right.w, sr.right.h);
    ctx.strokeStyle = focus === "search" ? (C().highlight || "#ff0") : (C().stroke || "#555");
    ctx.strokeRect(sr.right.x, sr.right.y, sr.right.w, sr.right.h);
    ctx.fillStyle = C().text || "#fff";
    ctx.font = s.iconFont || "13px monospace";
    ctx.fillText("⌕", sr.right.x + 5, sr.right.y + 15);

    // Slots
    const arrowFont = S()?.arrowFont || "13px monospace";
    const upChar = S()?.arrowUpChar || "▲";
    const downChar = S()?.arrowDownChar || "▼";
    const np = S()?.nameplate || {};

    for (let i = 0; i < SLOT_COUNT; i++) {
      const v = slots[i];
      const isSpecial = isSpecialSlotValue(v);
      const movie = !isSpecial ? baseVisible[v] : null;

      const isActiveMovieSlot = focus === "movies" && i === activeSlot;

      const card = slotCardRect(i);
      const upR = topArrowRect(i);
      const pr = posterRect(i);
      const nameR = nameplateRect(i);
      const downR = bottomArrowRect(i);

      // Card highlight outline
      ctx.strokeStyle = isActiveMovieSlot ? (C().highlight || "#ff0") : (C().stroke || "#555");
      ctx.strokeRect(card.x, card.y, card.w, card.h);

      // Top arrow box
      ctx.fillStyle = C().panel || "#111";
      ctx.fillRect(upR.x, upR.y, upR.w, upR.h);
      ctx.strokeStyle = isActiveMovieSlot ? (C().highlight || "#ff0") : (C().stroke || "#555");
      ctx.strokeRect(upR.x, upR.y, upR.w, upR.h);

      ctx.fillStyle = C().text || "#fff";
      ctx.font = arrowFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(upChar, upR.x + upR.w / 2, upR.y + upR.h / 2);

      // Poster background
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = C().panel || "#111";
      ctx.fillRect(pr.x, pr.y, pr.w, pr.h);

      // Poster image / special art
      if (isSpecial) {
        drawSpecialPoster(ctx, pr, v);
      } else {
        const posterPath = getLocalPosterPath(movie);
        if (posterPath) {
          ImageCache.load(posterPath);
          const img = ImageCache.get(posterPath);

          if (img && img.width && img.height) {
            try {
              ctx.drawImage(img, pr.x, pr.y, pr.w, pr.h);
            } catch {}
          } else {
            ctx.fillStyle = C().posterLoading || "#666";
            ctx.font = "9px monospace";
            ctx.fillText("loading...", pr.x + 6, pr.y + 14);
          }
        } else {
          ctx.fillStyle = C().posterLoading || "#666";
          ctx.font = "9px monospace";
          ctx.fillText("no poster", pr.x + 6, pr.y + 14);
        }
      }

      // Nameplate
      ctx.fillStyle = np.bg || (C().panel || "#111");
      ctx.fillRect(nameR.x, nameR.y, nameR.w, nameR.h);
      ctx.strokeStyle = isActiveMovieSlot ? (C().highlight || "#ff0") : (C().stroke || "#555");
      ctx.strokeRect(nameR.x, nameR.y, nameR.w, nameR.h);

      ctx.fillStyle = "#ddd";
      ctx.font = np.font || "10px monospace";

      const padX = Number(np.padX ?? 4);
      const lineH = Number(np.lineH ?? 10);
      const nameText = isSpecial ? specialSlotLabel(v) : getNameplateTitle(movie);
      wrapText(ctx, nameText, nameR.x + padX, nameR.y + 10, nameR.w - padX * 2, lineH);

      // Bottom arrow box
      ctx.fillStyle = C().panel || "#111";
      ctx.fillRect(downR.x, downR.y, downR.w, downR.h);
      ctx.strokeStyle = isActiveMovieSlot ? (C().highlight || "#ff0") : (C().stroke || "#555");
      ctx.strokeRect(downR.x, downR.y, downR.w, downR.h);

      ctx.fillStyle = C().text || "#fff";
      ctx.font = arrowFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(downChar, downR.x + downR.w / 2, downR.y + downR.h / 2);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    // corner buttons
    const home = homeCornerRect();
    const battle = battleCornerRect();

    ctx.fillStyle = C().panel || "#111";
    ctx.fillRect(home.x, home.y, home.w, home.h);
    ctx.strokeStyle = confirmPending ? (C().highlight || "#ff0") : (C().stroke || "#555");
    ctx.strokeRect(home.x, home.y, home.w, home.h);
    ctx.fillStyle = C().text || "#fff";
    ctx.font = "15px monospace";
    ctx.fillText("↩", home.x + 4, home.y + 17);

    ctx.fillStyle = C().panel || "#111";
    ctx.fillRect(battle.x, battle.y, battle.w, battle.h);
    ctx.strokeStyle = confirmPending ? (C().highlight || "#ff0") : (C().stroke || "#555");
    ctx.strokeRect(battle.x, battle.y, battle.w, battle.h);
    ctx.fillStyle = C().text || "#fff";
    ctx.font = "15px monospace";
    ctx.fillText("⚔", battle.x + 4, battle.y + 17);

    // archetype bar
    const A = archetypeBarRects();
    ctx.strokeStyle = focus === "archetypes" ? (C().highlight || "#ff0") : (C().stroke || "#555");
    ctx.strokeRect(A.bar.x, A.bar.y, A.bar.w, A.bar.h);

    const ac = bottom()?.archetype || {};

    ctx.fillStyle = C().panel || "#111";
    ctx.fillRect(A.left.x, A.left.y, A.left.w, A.left.h);
    ctx.strokeStyle = focus === "archetypes" ? (C().highlight || "#ff0") : (C().stroke || "#555");
    ctx.strokeRect(A.left.x, A.left.y, A.left.w, A.left.h);
    ctx.fillStyle = C().text || "#fff";
    ctx.font = ac.iconFont || "15px monospace";
    ctx.fillText(ac.leftChar || "◀", A.left.x + 4, A.left.y + 17);

    ctx.fillStyle = C().panel || "#111";
    ctx.fillRect(A.right.x, A.right.y, A.right.w, A.right.h);
    ctx.strokeStyle = focus === "archetypes" ? (C().highlight || "#ff0") : (C().stroke || "#555");
    ctx.strokeRect(A.right.x, A.right.y, A.right.w, A.right.h);
    ctx.fillStyle = C().text || "#fff";
    ctx.font = ac.iconFont || "15px monospace";
    ctx.fillText(ac.rightChar || "▶", A.right.x + 4, A.right.y + 17);

    ctx.fillStyle = C().panel || "#111";
    ctx.fillRect(A.center.x, A.center.y, A.center.w, A.center.h);
    ctx.strokeStyle = focus === "archetypes" ? (C().highlight || "#ff0") : (C().stroke || "#555");
    ctx.strokeRect(A.center.x, A.center.y, A.center.w, A.center.h);

    const lockTag = archetypeConfirmed && chosenArchetype?.id !== "custom" ? " ✓" : "";
    const label = `${chosenArchetype?.name || "Custom"}${lockTag}`;

    const fitted = fitTextByShrinking(
      ctx,
      label,
      A.center.w - 12,
      Number(ac.fontStart ?? 11),
      Number(ac.fontMin ?? 8)
    );

    ctx.fillStyle = C().text || "#fff";
    ctx.font = `${fitted.px}px monospace`;
    ctx.fillText(fitted.text, A.center.x + 8, A.center.y + 16);

    // confirm banner
    if (confirmPending) {
      const r = confirmBoxRect();
      ctx.fillStyle = "#000";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      if (hasBlankSlot()) {
        ctx.fillStyle = "#f66";
        ctx.font = L?.confirm?.font || "9px monospace";
        ctx.fillText("BLANK slot selected — cannot start.", r.x + 8, r.y + 13);
      } else {
        ctx.fillStyle = L?.confirm?.color || "#ff0";
        ctx.font = L?.confirm?.font || "9px monospace";
        ctx.fillText(L?.confirm?.text || "Ready to start battle.", r.x + 8, r.y + 13);
      }
    }

    // Unlock overlay
    if (uiMode === "unlock") {
      const payload = overlayPayload || {};
      const party = (payload.movieIds || []).slice(0, 4).map(getMovieById);

      renderUnlockArcOverlay(ctx, {
        width: 400,
        height: 300,
        archetypeName: payload.archetypeName || "Unknown",
        party,
        codeLabel: payload.codeLabel || ""
      });
    }
  }
};