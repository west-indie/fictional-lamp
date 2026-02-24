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
  type = "square",
  endFreq = null,
  hpFreq = null,
  lpFreq = null,
  boxCutFreq = null,
  boxCutGainDb = 0
} = {}) {
  const c = getCtx();
  if (!c) return;
  if (c.state !== "running") return;

  // Ensure sfxGain exists
  ensureGraph();
  if (!sfxGain) return;

  const osc = c.createOscillator();
  const gain = c.createGain();
  const t = c.currentTime;

  const j = (Math.random() - 0.5) * jitter;
  const startFreq = Math.max(40, baseFreq + j);
  osc.frequency.setValueAtTime(startFreq, t);
  if (Number.isFinite(endFreq)) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, Number(endFreq)), t + duration);
  }
  osc.type = type;

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(gainPeak, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(gain);

  let out = gain;

  if (Number.isFinite(hpFreq) && Number(hpFreq) > 0) {
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(Math.max(20, Number(hpFreq)), t);
    hp.Q.value = 0.7;
    out.connect(hp);
    out = hp;
  }

  if (Number.isFinite(boxCutFreq) && Number(boxCutFreq) > 0 && Number(boxCutGainDb) < 0) {
    const cut = c.createBiquadFilter();
    cut.type = "peaking";
    cut.frequency.setValueAtTime(Math.max(40, Number(boxCutFreq)), t);
    cut.Q.value = 1.0;
    cut.gain.setValueAtTime(Number(boxCutGainDb), t);
    out.connect(cut);
    out = cut;
  }

  if (Number.isFinite(lpFreq) && Number(lpFreq) > 0) {
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.max(120, Number(lpFreq)), t);
    lp.Q.value = 0.6;
    out.connect(lp);
    out = lp;
  }

  out.connect(sfxGain);

  osc.start(t);
  osc.stop(t + duration + 0.01);
}

export function playUIMoveBlip(overrides = {}) {
  blip({
    baseFreq: 650,
    jitter: 70,
    duration: 0.045,
    gainPeak: 0.045,
    type: "square",
    ...overrides
  });
}

export function playUIConfirmBlip(overrides = {}) {
  blip({
    baseFreq: 900,
    jitter: 90,
    duration: 0.055,
    gainPeak: 0.06,
    type: "square",
    ...overrides
  });
}

export function playUIBackBlip(overrides = {}) {
  blip({
    baseFreq: 380,
    jitter: 10,
    duration: 0.065,
    gainPeak: 0.05,
    type: "square",
    ...overrides
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

// Boot/loading style tone used during short transition windows.
export function playUILoadingTone(durationMs = 800) {
  const c = getCtx();
  if (!c) return;
  if (c.state !== "running") return;

  ensureGraph();
  if (!sfxGain) return;

  const durSec = clamp((Number(durationMs) || 800) / 1000, 0.12, 2.5);
  const t = c.currentTime;

  const osc = c.createOscillator();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();

  // Subtle computer-ish hum: smoother core wave + light modulation.
  osc.type = "triangle";
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(185, t + durSec * 0.85);
  osc.frequency.exponentialRampToValueAtTime(175, t + durSec);

  lfo.type = "triangle";
  lfo.frequency.setValueAtTime(1.6, t);
  lfoGain.gain.setValueAtTime(2.2, t);
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(560, t);
  filter.frequency.linearRampToValueAtTime(760, t + durSec);
  filter.Q.value = 0.45;

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.0045, t + 0.05);
  gain.gain.setValueAtTime(0.0035, t + Math.max(0.05, durSec - 0.09));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + durSec);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);

  osc.start(t);
  lfo.start(t);
  const stopAt = t + durSec + 0.03;
  osc.stop(stopAt);
  lfo.stop(stopAt);
}

