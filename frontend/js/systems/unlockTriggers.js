// frontend/js/systems/unlockTriggers.js
//
// Simplified unlock trigger runner.
// Call ONCE per frame (recommended from game.js update()).
//
// Responsibilities:
// - Evaluate predicate unlockRules (rules.when(GameState)).
// - Track key-sequence combos (unlockKeyCombos) using Input (single-char).
// - When an unlock happens: persist via unlockSystem + emit UI event into GameState.ui.events.
//
// Notes:
// - Designed for your InputManager that supports char keys (Input.pressed("i"), etc).
// - Supports combo.screens restriction and combo.confirmToScreen for overlay routing.
//

import { unlockRules } from "../data/unlockRules.js";
import { unlockKeyCombos } from "../data/unlockKeyCombos.js";
import { playerArchetypes } from "../data/playerArchetypes.js";
import { ensureUnlockState, unlockArchetype, isArchetypeUnlocked } from "./unlockSystem.js";

// ---------------------------
// UI event queue helpers
// ---------------------------
function ensureUIEventQueue(GameState) {
  if (!GameState) return;
  if (!GameState.ui || typeof GameState.ui !== "object") GameState.ui = {};
  if (!Array.isArray(GameState.ui.events)) GameState.ui.events = [];
}

export function popNextUnlockEvent(GameState) {
  if (!GameState?.ui?.events?.length) return null;
  return GameState.ui.events.shift() || null;
}

export function peekUnlockEvents(GameState) {
  return Array.isArray(GameState?.ui?.events) ? GameState.ui.events : [];
}

// ---------------------------
// Archetype lookup
// ---------------------------
function findArchetypeById(id) {
  return playerArchetypes.find((a) => a?.id === id) || null;
}

// ---------------------------
// Unlock event emitter
// ---------------------------
function emitUnlockEvent(GameState, payload) {
  ensureUIEventQueue(GameState);
  GameState.ui.events.push({
    type: "ARCHETYPE_UNLOCKED",
    ...payload
  });
}

// ---------------------------
// Unlock attempt (single place)
// ---------------------------
function tryUnlockArchetype(GameState, archetypeId, meta = {}) {
  ensureUnlockState(GameState);
  const id = String(archetypeId || "").trim();
  if (!id) return false;

  // already unlocked? don't re-fire overlays
  if (isArchetypeUnlocked(GameState, id)) return false;

  const did = unlockArchetype(GameState, id); // ✅ now also records unlock order
  if (!did) return false;

  const archetype = findArchetypeById(id);

  emitUnlockEvent(GameState, {
    ruleId: meta.ruleId ?? null,
    comboId: meta.comboId ?? null,

    archetypeId: id,
    archetypeName: archetype?.name || id,
    movieIds: archetype?.movieIds || [],

    showOverlay: meta.showOverlay !== false, // default true
    codeLabel: meta.codeLabel ?? null,

    // Menu can route based on this (IMDB -> enemyIntro, others -> close-only)
    confirmToScreen: meta.confirmToScreen ?? null
  });

  return true;
}

// ---------------------------
// Predicate rules
// ---------------------------
function runPredicateRules(GameState) {
  for (const rule of unlockRules || []) {
    if (!rule || typeof rule.when !== "function") continue;

    const archetypeId = rule.archetypeId;
    if (!archetypeId) continue;

    let shouldUnlock = false;
    try {
      shouldUnlock = !!rule.when(GameState);
    } catch {
      shouldUnlock = false;
    }

    if (!shouldUnlock) continue;

    tryUnlockArchetype(GameState, archetypeId, {
      ruleId: rule.id || null,
      showOverlay: rule.showOverlay !== false,
      codeLabel: rule.codeLabel || null,
      confirmToScreen: rule.confirmToScreen || null
    });
  }
}

// ---------------------------
// Key combos (compiled once)
// ---------------------------
function normalizeLetter(x) {
  return String(x || "").trim().toLowerCase();
}

function buildCodeLabel(seq) {
  return seq.map((c) => String(c).toUpperCase()).join(" → ");
}

function isActiveForScreen(screenSet, currentScreen) {
  if (!screenSet || screenSet.size === 0) return true;
  return screenSet.has(currentScreen);
}

function compileCombos() {
  const compiled = [];

  for (const c of unlockKeyCombos || []) {
    if (!c || !c.archetypeId) continue;

    const seq = (c.sequence || []).map(normalizeLetter).filter(Boolean);
    if (!seq.length) continue;

    const letterSet = new Set(seq);
    const screenSet = Array.isArray(c.screens) && c.screens.length ? new Set(c.screens) : new Set();

    compiled.push({
      id: c.id || c.archetypeId,
      archetypeId: c.archetypeId,

      seq,
      letterSet,
      screenSet,

      showOverlay: c.showOverlay !== false,
      codeLabel: c.codeLabel || buildCodeLabel(seq),

      confirmToScreen: c.confirmToScreen || null
    });
  }

  return compiled;
}

const COMBOS = compileCombos();

// Per-session progress state:
// comboId -> progress index
const comboProgress = Object.create(null);

// advance behavior:
// - correct next letter: progress++
// - if pressed first letter: restart at 1
// - else: reset to 0
function advanceProgress(seq, progress, pressedLetter) {
  const expected = seq[progress];

  if (pressedLetter === expected) {
    const next = progress + 1;
    const complete = next >= seq.length;
    return { progress: complete ? 0 : next, complete };
  }

  if (pressedLetter === seq[0]) {
    return { progress: 1, complete: false };
  }

  return { progress: 0, complete: false };
}

// Choose ONE pressed letter per frame per combo.
// We only react to letters in the combo.
function getPressedLetterForCombo(Input, letterSet) {
  for (const letter of letterSet) {
    if (Input.pressed(letter)) return letter;
  }
  return null;
}

function runKeyCombos(GameState, Input) {
  const currentScreen = GameState.currentScreen || "menu";

  for (const combo of COMBOS) {
    if (!isActiveForScreen(combo.screenSet, currentScreen)) continue;

    // already unlocked? stop tracking and stop consuming keys
    if (isArchetypeUnlocked(GameState, combo.archetypeId)) continue;

    const pressedLetter = getPressedLetterForCombo(Input, combo.letterSet);
    if (!pressedLetter) continue;

    // Consume so it doesn't leak into screens
    Input.consume(pressedLetter);

    const id = combo.id;
    const cur = Number.isFinite(comboProgress[id]) ? comboProgress[id] : 0;

    const { progress, complete } = advanceProgress(combo.seq, cur, pressedLetter);
    comboProgress[id] = progress;

    if (complete) {
      tryUnlockArchetype(GameState, combo.archetypeId, {
        comboId: combo.id,
        showOverlay: combo.showOverlay,
        codeLabel: combo.codeLabel,
        confirmToScreen: combo.confirmToScreen
      });
    }
  }
}

// ---------------------------
// Public runner
// ---------------------------
export function runUnlockTriggers(GameState, Input) {
  if (!GameState) return;

  ensureUnlockState(GameState);
  ensureUIEventQueue(GameState);

  // 1) Predicate rules (GameState-only)
  runPredicateRules(GameState);

  // 2) Key combos (needs Input)
  if (Input) runKeyCombos(GameState, Input);
}
