// frontend/js/systems/unlockSystem.js
//
// Minimal unlock persistence for archetypes (and anything else later).
// - Stores unlock flags on GameState.unlocks
// - Persists to localStorage so unlocks survive refresh
//
// UPDATE (THIS REQUEST):
// ✅ All localStorage access is safe (try/catch).
// ✅ __loaded is never persisted to storage (runtime-only flag).
// ✅ Adds archetypeOrder[] to preserve unlock order.
// ✅ unlockArchetype() records unlock order on first unlock.
// ✅ lockArchetype() removes from order (testing convenience).
// ✅ resetAllUnlocks() fixed (previously wrote wrong shape).
//
// Usage:
//   import {
//     ensureUnlockState,
//     evaluateUnlockRules,
//     unlockArchetype,
//     isArchetypeUnlocked,
//     getUnlockedArchetypeOrder
//   } from "../systems/unlockSystem.js";

import { unlockRules } from "../data/unlockRules.js";

const STORAGE_KEY = "movie_rpg_unlocks_v1";

// -----------------------
// localStorage safe utils
// -----------------------
function safeGetItem(key) {
  try {
    return window?.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function safeSetItem(key, value) {
  try {
    window?.localStorage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function safeRemoveItem(key) {
  try {
    window?.localStorage?.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function defaultUnlocks() {
  return {
    archetypes: {},      // { [archetypeId]: true }
    archetypeOrder: []   // [archetypeId, archetypeId, ...] in first-unlock order
  };
}

function normalizeUnlocks(raw) {
  const base = defaultUnlocks();
  if (!raw || typeof raw !== "object") return base;

  const archetypes =
    raw.archetypes && typeof raw.archetypes === "object" ? raw.archetypes : {};

  const archetypeOrder =
    Array.isArray(raw.archetypeOrder) ? raw.archetypeOrder.filter(Boolean).map(String) : [];

  base.archetypes = { ...archetypes };
  base.archetypeOrder = [...archetypeOrder];

  return base;
}

// Strip runtime-only keys before saving
function toPersistedUnlocks(unlocks) {
  const cleaned = unlocks && typeof unlocks === "object" ? { ...unlocks } : {};
  delete cleaned.__loaded;
  return normalizeUnlocks(cleaned);
}

export function loadUnlocks() {
  const rawStr = safeGetItem(STORAGE_KEY);
  const rawObj = safeParse(rawStr);
  return normalizeUnlocks(rawObj);
}

export function saveUnlocks(unlocks) {
  const normalized = toPersistedUnlocks(unlocks);
  safeSetItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

/**
 * Ensures GameState.unlocks exists and is loaded from storage once.
 * Safe to call every time you enter a screen.
 */
export function ensureUnlockState(GameState) {
  if (!GameState) return;

  // If already initialized, do nothing
  if (GameState.unlocks && GameState.unlocks.__loaded) return;

  const loaded = loadUnlocks();

  // Mark internal flag so we don't reload repeatedly (runtime-only)
  loaded.__loaded = true;

  GameState.unlocks = loaded;
}

/**
 * Returns true if archetype is unlocked in GameState.
 */
export function isArchetypeUnlocked(GameState, archetypeId) {
  ensureUnlockState(GameState);
  if (!archetypeId) return false;
  return !!GameState.unlocks?.archetypes?.[archetypeId];
}

/**
 * Returns the unlock order array (copy) for Quickplay ordering.
 */
export function getUnlockedArchetypeOrder(GameState) {
  ensureUnlockState(GameState);
  const arr = GameState.unlocks?.archetypeOrder;
  return Array.isArray(arr) ? [...arr] : [];
}

/**
 * Unlock an archetype and persist.
 * Returns true if it was newly unlocked, false if it was already unlocked.
 */
export function unlockArchetype(GameState, archetypeId) {
  ensureUnlockState(GameState);
  const id = String(archetypeId || "").trim();
  if (!id) return false;

  const unlocks = GameState.unlocks || (GameState.unlocks = defaultUnlocks());
  const flags = unlocks.archetypes || (unlocks.archetypes = {});
  const was = !!flags[id];
  if (was) return false;

  flags[id] = true;

  // ✅ record unlock order once
  const order = Array.isArray(unlocks.archetypeOrder)
    ? unlocks.archetypeOrder
    : (unlocks.archetypeOrder = []);

  if (!order.includes(id)) order.push(id);

  // Persist WITHOUT __loaded
  const saved = saveUnlocks(unlocks);

  // Keep runtime flag
  saved.__loaded = true;
  GameState.unlocks = saved;

  return true;
}

/**
 * Optional helper: lock (for testing).
 */
export function lockArchetype(GameState, archetypeId) {
  ensureUnlockState(GameState);
  const id = String(archetypeId || "").trim();
  if (!id) return false;

  const unlocks = GameState.unlocks || (GameState.unlocks = defaultUnlocks());
  const flags = unlocks.archetypes || (unlocks.archetypes = {});
  const was = !!flags[id];
  if (!was) return false;

  delete flags[id];

  // ✅ also remove from order
  if (Array.isArray(unlocks.archetypeOrder)) {
    unlocks.archetypeOrder = unlocks.archetypeOrder.filter((x) => x !== id);
  }

  const saved = saveUnlocks(unlocks);
  saved.__loaded = true;
  GameState.unlocks = saved;

  return true;
}

/**
 * Evaluate declarative unlock rules (frontend/js/data/unlockRules.js).
 * Calls unlockArchetype() for any rule that returns true.
 *
 * Returns a list of archetypeIds that were newly unlocked.
 */
export function evaluateUnlockRules(GameState) {
  ensureUnlockState(GameState);

  const unlockedNow = [];
  const rules = Array.isArray(unlockRules) ? unlockRules : [];

  for (const rule of rules) {
    const archetypeId = rule?.archetypeId;
    const when = rule?.when;

    if (!archetypeId || typeof when !== "function") continue;

    let shouldUnlock = false;
    try {
      shouldUnlock = !!when(GameState);
    } catch {
      shouldUnlock = false;
    }

    if (!shouldUnlock) continue;

    const did = unlockArchetype(GameState, archetypeId);
    if (did) unlockedNow.push(archetypeId);
  }

  return unlockedNow;
}

/**
 * Optional helper: wipe everything (for dev/testing).
 */
export function resetAllUnlocks(GameState) {
  safeRemoveItem(STORAGE_KEY);

  if (GameState) {
    // ✅ correct shape
    GameState.unlocks = defaultUnlocks();
    GameState.unlocks.__loaded = true;
  }
}
