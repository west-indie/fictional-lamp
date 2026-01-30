// frontend/js/systems/statsSystem.js
//
// Minimal stats persistence + helpers.
// - Stores stats on GameState.stats
// - Persists to localStorage so stats survive refresh
//
// Designed to fit your current GameState shape:
// GameState.stats = {
//   wins, losses, campaignCleared, randomizeClicks,
//   mealsCooked, artHouseWins,
//   winsByGenre, winsByFranchise
// }
//
// Usage (recommended):
//   import {
//     ensureStatsState,
//     incWins, incLosses, incRandomizeClicks,
//     recordWinForPartyMovies
//   } from "../systems/statsSystem.js";
//
// Notes:
// - This only handles stats persistence (NOT unlock evaluation).
// - Keep calling evaluateUnlockRules(GameState) wherever you update stats.

import { movieMeta } from "../data/movieMeta.js";

const STORAGE_KEY = "movie_rpg_stats_v1";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function safeGetItem(key) {
  try {
    return window?.localStorage?.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    window?.localStorage?.setItem(key, value);
  } catch {
    // ignore
  }
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function toFiniteNumber(v, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function toCountMap(raw) {
  // { [key]: number }
  const out = {};
  if (!isPlainObject(raw)) return out;

  for (const [k, v] of Object.entries(raw)) {
    const key = String(k || "").trim();
    if (!key) continue;
    const n = toFiniteNumber(v, 0);
    // keep integers-ish, but don’t force rounding (you can if you want)
    out[key] = n;
  }
  return out;
}

// Defaults should match your GameState.stats fields (plus new maps).
function defaultStats() {
  return {
    wins: 0,
    losses: 0,
    campaignCleared: false,

    randomizeClicks: 0,

    // placeholders you already had in GameState:
    mealsCooked: 0,
    artHouseWins: 0,

    // ✅ NEW: bucketed win counts
    winsByGenre: {}, // { [GENRE]: number }
    winsByFranchise: {} // { [FRANCHISE]: number }
  };
}

// Normalize unknown or partial data from storage.
function normalizeStats(raw) {
  const base = defaultStats();
  if (!raw || typeof raw !== "object") return base;

  // Copy numeric stats safely
  const numericKeys = ["wins", "losses", "randomizeClicks", "mealsCooked", "artHouseWins"];
  for (const k of numericKeys) {
    base[k] = toFiniteNumber(raw[k], base[k]);
  }

  // Copy booleans safely
  base.campaignCleared = !!raw.campaignCleared;

  // ✅ Copy bucket maps safely
  base.winsByGenre = toCountMap(raw.winsByGenre);
  base.winsByFranchise = toCountMap(raw.winsByFranchise);

  return base;
}

export function loadStats() {
  const raw = safeParse(safeGetItem(STORAGE_KEY));
  return normalizeStats(raw);
}

export function saveStats(stats) {
  const normalized = normalizeStats(stats);
  safeSetItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

/**
 * Ensures GameState.stats exists and is loaded from storage once.
 * Safe to call every time you enter a screen.
 */
export function ensureStatsState(GameState) {
  if (!GameState) return;

  // If already initialized, do nothing
  if (GameState.stats && GameState.stats.__loaded) return;

  const loaded = loadStats();
  loaded.__loaded = true;
  GameState.stats = loaded;
}

/**
 * Replace the whole stats blob (rarely needed) and persist.
 */
export function setStats(GameState, nextStats) {
  if (!GameState) return null;
  ensureStatsState(GameState);

  const { __loaded } = GameState.stats || { __loaded: true };
  const saved = saveStats({ ...(nextStats || {}), __loaded });
  saved.__loaded = true;

  GameState.stats = saved;
  return saved;
}

/**
 * Persist current GameState.stats (internal helper).
 */
function persist(GameState) {
  if (!GameState) return null;
  ensureStatsState(GameState);

  const { __loaded } = GameState.stats;
  GameState.stats = saveStats({ ...GameState.stats, __loaded });
  GameState.stats.__loaded = true;

  return GameState.stats;
}

/**
 * Generic increment helper (numbers only).
 */
export function incStat(GameState, key, amount = 1) {
  if (!GameState || !key) return 0;

  ensureStatsState(GameState);

  const k = String(key);
  const a = typeof amount === "number" && Number.isFinite(amount) ? amount : 1;

  const curNum = toFiniteNumber(GameState.stats[k], 0);
  GameState.stats[k] = curNum + a;

  persist(GameState);
  return GameState.stats[k];
}

/**
 * Generic set helper (supports booleans and numbers).
 */
export function setStat(GameState, key, value) {
  if (!GameState || !key) return null;

  ensureStatsState(GameState);

  const k = String(key);

  if (typeof value === "number") {
    GameState.stats[k] = Number.isFinite(value) ? value : 0;
  } else if (typeof value === "boolean") {
    GameState.stats[k] = !!value;
  } else {
    // ignore unsupported types (keep system minimal)
    return GameState.stats[k];
  }

  persist(GameState);
  return GameState.stats[k];
}

// Convenience helpers (match your current needs)
export function incWins(GameState, amount = 1) {
  return incStat(GameState, "wins", amount);
}

export function incLosses(GameState, amount = 1) {
  return incStat(GameState, "losses", amount);
}

export function incRandomizeClicks(GameState, amount = 1) {
  return incStat(GameState, "randomizeClicks", amount);
}

// ------------------------------------------------------------
// ✅ NEW: bucket helpers for genre/franchise win-based unlocks
// ------------------------------------------------------------
export function incWinsByGenre(GameState, genre, amount = 1) {
  if (!GameState || !genre) return 0;
  ensureStatsState(GameState);

  const g = String(genre || "").trim().toUpperCase();
  if (!g) return 0;

  if (!isPlainObject(GameState.stats.winsByGenre)) GameState.stats.winsByGenre = {};
  const cur = toFiniteNumber(GameState.stats.winsByGenre[g], 0);
  GameState.stats.winsByGenre[g] = cur + (Number.isFinite(amount) ? amount : 1);

  persist(GameState);
  return GameState.stats.winsByGenre[g];
}

export function incWinsByFranchise(GameState, franchise, amount = 1) {
  if (!GameState || !franchise) return 0;
  ensureStatsState(GameState);

  const f = String(franchise || "").trim();
  if (!f) return 0;

  if (!isPlainObject(GameState.stats.winsByFranchise)) GameState.stats.winsByFranchise = {};
  const cur = toFiniteNumber(GameState.stats.winsByFranchise[f], 0);
  GameState.stats.winsByFranchise[f] = cur + (Number.isFinite(amount) ? amount : 1);

  persist(GameState);
  return GameState.stats.winsByFranchise[f];
}

function normalizeFranchises(franchiseField) {
  // supports: null | "Batman" | ["Batman","DC"]
  if (Array.isArray(franchiseField)) {
    return franchiseField.map((x) => String(x || "").trim()).filter(Boolean);
  }
  if (typeof franchiseField === "string" && franchiseField.trim()) {
    return [franchiseField.trim()];
  }
  return [];
}

function getGenresForMovieId(movieId) {
  const meta = movieMeta?.[movieId];
  if (!meta) return [];

  const out = [];
  if (meta.primaryGenre) out.push(String(meta.primaryGenre).toUpperCase());
  if (meta.secondaryGenre) out.push(String(meta.secondaryGenre).toUpperCase());

  // de-dupe
  return Array.from(new Set(out.filter(Boolean)));
}

function getFranchisesForMovieId(movieId) {
  const meta = movieMeta?.[movieId];
  if (!meta) return [];
  return Array.from(new Set(normalizeFranchises(meta.franchise)));
}

/**
 * Record a WIN for the party's movies into:
 * - winsByGenre (counts primary+secondary genre for each alive/selected party movie)
 * - winsByFranchise (supports array OR legacy string)
 *
 * You’ll call this on VICTORY (after incWins).
 *
 * movies can be:
 * - GameState.party.movies entries (movie objects with id)
 * - battle party actors (actor.movie.id)
 */
export function recordWinForPartyMovies(GameState, partyMoviesOrActors) {
  if (!GameState || !Array.isArray(partyMoviesOrActors)) return;

  ensureStatsState(GameState);

  const genresThisBattle = new Set();
  const franchisesThisBattle = new Set();

  for (const entry of partyMoviesOrActors) {
    const movieId =
      entry?.movie?.id ? String(entry.movie.id) :
      entry?.id ? String(entry.id) :
      "";

    if (!movieId) continue;

    // Collect genres
    const genres = getGenresForMovieId(movieId);
    for (const g of genres) genresThisBattle.add(g);

    // Collect franchises
    const franchises = getFranchisesForMovieId(movieId);
    for (const f of franchises) franchisesThisBattle.add(f);
  }

  // ✅ Increment ONCE per genre per battle
  for (const g of genresThisBattle) {
    incWinsByGenre(GameState, g, 1);
  }

  // ✅ Increment ONCE per franchise per battle
  for (const f of franchisesThisBattle) {
    incWinsByFranchise(GameState, f, 1);
  }
}

/**
 * Optional helper: wipe everything (for dev/testing).
 */
export function resetAllStats(GameState) {
  try {
    window?.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }

  if (GameState) {
    GameState.stats = defaultStats();
    GameState.stats.__loaded = true;
  }
}
