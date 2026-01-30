// frontend/js/systems/sharedAudioState.js
//
// Single source of truth for saved Options audio levels.
// Matches optionsOverlay.js localStorage keys: 0..7

const LS_MUSIC_LVL = "LS_OPTIONS_MUSIC_LEVEL_0_7";
const LS_SFX_LVL = "LS_OPTIONS_SFX_LEVEL_0_7";

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function readLevel0to7(key, fallback) {
  let raw = null;
  try { raw = localStorage.getItem(key); } catch {}
  const n = Number(raw);
  if (!Number.isFinite(n)) return clamp(fallback, 0, 7);
  return clamp(Math.round(n), 0, 7);
}

export function getMusicLevel0to7() {
  // default should match your overlay defaults (music 4/7)
  return readLevel0to7(LS_MUSIC_LVL, 4);
}

export function getSfxLevel0to7() {
  return readLevel0to7(LS_SFX_LVL, 7);
}

export function getMusicGain01() {
  return getMusicLevel0to7() / 7;
}

export function getSfxGain01() {
  return getSfxLevel0to7() / 7;
}
