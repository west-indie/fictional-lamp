// frontend/js/screens/select/selectPersistence.js
//
// Select persistence + boot rules (localStorage).
// Pure-ish: touches only localStorage and a passed-in "state" object.

export const LS_LAST_SCREEN = "rpg_last_screen";
export const LS_SELECT_SLOT_IDS = "rpg_select_slot_ids_v1";
export const LS_SELECT_UI = "rpg_select_ui_v1";

export function safeGetLS(key) {
  try {
    return window?.localStorage?.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetLS(key, value) {
  try {
    window?.localStorage?.setItem(key, value);
  } catch {}
}

export function safeRemoveLS(key) {
  try {
    window?.localStorage?.removeItem(key);
  } catch {}
}

export function setLastScreen(name) {
  safeSetLS(LS_LAST_SCREEN, String(name || ""));
}

export function computeBootForceDefaults() {
  const last = String(safeGetLS(LS_LAST_SCREEN) || "");
  return last === "select" || last === "menu";
}

// Matches your prior behavior: if boot force defaults, clear these keys immediately.
export function applyBootForceDefaultsIfNeeded() {
  if (!computeBootForceDefaults()) return false;
  safeRemoveLS(LS_SELECT_SLOT_IDS);
  safeRemoveLS(LS_SELECT_UI);
  return true;
}

export function readPersistedSlotIds(SLOT_COUNT) {
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

export function readPersistedUI() {
  const raw = safeGetLS(LS_SELECT_UI);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

// Convert current state.slots (base indices or tokens) into persisted IDs/tokens.
export function getSlotIdsFromBase({ SLOT_COUNT, slots, baseVisible }) {
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

// Restore state.slots from IDs/tokens.
export function setSlotsFromIds({
  SLOT_COUNT,
  slotsOut,
  baseVisible,
  ids,
  isSpecialTokenFn
}) {
  const baseLen = Array.isArray(baseVisible) ? baseVisible.length : 0;
  if (baseLen <= 0) {
    for (let i = 0; i < SLOT_COUNT; i++) slotsOut[i] = 0;
    return;
  }

  const byId = new Map();
  for (let i = 0; i < baseLen; i++) byId.set(baseVisible[i]?.id, i);

  for (let i = 0; i < SLOT_COUNT; i++) {
    const id = ids?.[i];

    if (isSpecialTokenFn && isSpecialTokenFn(id)) {
      slotsOut[i] = id;
      continue;
    }

    slotsOut[i] = id && byId.has(id) ? byId.get(id) : 0;
  }
}

export function persistSelectStateByBase({
  SLOT_COUNT,
  state,
  baseVisible
}) {
  const ids = getSlotIdsFromBase({ SLOT_COUNT, slots: state.slots, baseVisible });
  safeSetLS(LS_SELECT_SLOT_IDS, JSON.stringify(ids));

  const ui = {
    activeSlot: state.activeSlot,
    focus: state.focus,
    archetypeIndex: state.archetypeIndex,
    archetypeConfirmed: state.archetypeConfirmed,
    confirmedArchetypeIndex: state.confirmedArchetypeIndex,
    searchQuery: state.searchQuery
  };
  safeSetLS(LS_SELECT_UI, JSON.stringify(ui));
}

export function restoreFromPersistIfPossible({
  SLOT_COUNT,
  state,
  baseVisible,
  clampIndex,
  isSpecialTokenFn
}) {
  const ids = readPersistedSlotIds(SLOT_COUNT);
  if (!ids) return false;

  const out = new Array(SLOT_COUNT).fill(0);
  setSlotsFromIds({
    SLOT_COUNT,
    slotsOut: out,
    baseVisible,
    ids,
    isSpecialTokenFn
  });
  state.slots = out;

  const ui = readPersistedUI();
  if (ui) {
    state.activeSlot =
      typeof ui.activeSlot === "number" && Number.isFinite(ui.activeSlot)
        ? clampIndex(ui.activeSlot, SLOT_COUNT)
        : 0;

    state.focus = ui.focus === "archetypes" || ui.focus === "search" ? ui.focus : "movies";

    state.archetypeIndex = typeof ui.archetypeIndex === "number" ? ui.archetypeIndex : 0;
    state.archetypeConfirmed = !!ui.archetypeConfirmed;
    state.confirmedArchetypeIndex =
      typeof ui.confirmedArchetypeIndex === "number" ? ui.confirmedArchetypeIndex : 0;

    state.searchQuery = typeof ui.searchQuery === "string" ? ui.searchQuery : "";

    // Transient
    state.confirmPending = false;
  }

  state.inputMode = "keyboard";
  state.uiMode = "select";
  state.overlayPayload = null;

  return true;
}
