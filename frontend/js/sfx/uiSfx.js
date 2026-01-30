// frontend/js/sfx/uiSfx.js
//
// Shared UI + text SFX (no assets).
// Single AudioContext for UI SFX.
//
// - armAudio(): call on any user gesture (keydown/click) to unlock audio
// - playUIMoveBlip(): arrow keys / cursor movement
// - playUIConfirmBlip(): enter / confirm actions
// - playUIBackBlip(): back/cancel/home (Escape/Backspace)
// - playTextBlip(): typewriter blip
//
// ✅ NEW:
// - setSfxVolume(v01): sets global UI SFX volume (0..1)
// - getSfxVolume(): returns current UI SFX volume
// - Blips now route through a master SFX gain node

import { getSfxGain01 } from "../systems/sharedAudioState.js";

let ctx = null;

// ✅ NEW: master gain for all UI SFX
let sfxGain = null;

// Default SFX volume (seeded from saved Options value when graph is created)
let currentSfxVolume = 0.8;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function ensureGraph() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;

  if (!ctx) {
    ctx = new Ctx();
  }

  if (!sfxGain) {
    // ✅ Pull saved default at graph creation so first SFX obeys Options.
    currentSfxVolume = clamp(getSfxGain01(), 0, 1);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = currentSfxVolume;
    sfxGain.connect(ctx.destination);
  }

  return ctx;
}

function getCtx() {
  return ensureGraph();
}

export function armAudio() {
  const c = getCtx();
  if (!c) return;

  if (c.state === "suspended") {
    // Don’t await; just attempt.
    c.resume();
  }
}

export function getAudioContext() {
  return getCtx();
}

// ✅ NEW
export function setSfxVolume(v01) {
  currentSfxVolume = clamp(+v01 || 0, 0, 1);
  const c = getCtx();
  if (!c || !sfxGain) return;

  const t = c.currentTime;
  try { sfxGain.gain.cancelScheduledValues(t); } catch {}
  sfxGain.gain.setValueAtTime(currentSfxVolume, t);
}

// ✅ NEW
export function getSfxVolume() {
  return currentSfxVolume;
}

// ✅ Convenience: apply current saved Options level to the live SFX bus.
export function syncSfxVolumeFromSaved() {
  setSfxVolume(getSfxGain01());
}

// Safe version: only sync if the SFX graph already exists.
// (Does NOT create/resume AudioContext.)
export function trySyncSfxVolumeFromSaved() {
  if (!ctx || !sfxGain) return false;
  try {
    const v01 = clamp(getSfxGain01(), 0, 1);
    const t = ctx.currentTime;
    try { sfxGain.gain.cancelScheduledValues(t); } catch {}
    sfxGain.gain.setValueAtTime(v01, t);
    currentSfxVolume = v01;
    return true;
  } catch {
    return false;
  }
}

function blip({
  baseFreq = 700,
  jitter = 60,
  duration = 0.05,
  gainPeak = 0.06,
  type = "square"
} = {}) {
  const c = getCtx();
  if (!c) return;
  if (c.state !== "running") return;

  // Ensure sfxGain exists
  ensureGraph();
  if (!sfxGain) return;

  const osc = c.createOscillator();
  const gain = c.createGain();

  const j = (Math.random() - 0.5) * jitter;
  osc.frequency.value = baseFreq + j;
  osc.type = type;

  const t = c.currentTime;

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(gainPeak, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(gain);
  // ✅ route through sfx master gain
  gain.connect(sfxGain);

  osc.start(t);
  osc.stop(t + duration + 0.01);
}

export function playUIMoveBlip() {
  blip({
    baseFreq: 650,
    jitter: 70,
    duration: 0.045,
    gainPeak: 0.045,
    type: "square"
  });
}

export function playUIConfirmBlip() {
  blip({
    baseFreq: 900,
    jitter: 90,
    duration: 0.055,
    gainPeak: 0.06,
    type: "square"
  });
}

export function playUIBackBlip() {
  blip({
    baseFreq: 380,
    jitter: 10,
    duration: 0.065,
    gainPeak: 0.05,
    type: "square"
  });
}

export function playTextBlip() {
  blip({
    baseFreq: 600,
    jitter: 80,
    duration: 0.05,
    gainPeak: 0.06,
    type: "square"
  });
}
