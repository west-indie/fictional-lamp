// frontend/js/systems/optionsAudioSync.js
//
// One-liner helper to keep audio consistent across screens.
// Call this in each screen's enter() (and optionally right before starting music).
//
// - Reads saved 0..7 levels from localStorage (sharedAudioState)
// - Applies them to the actual audio engines (audioSystem + uiSfx)

import { getMusicGain01, getSfxGain01 } from "./sharedAudioState.js";
import { setBgmVolume } from "./audioSystem.js";
import { setSfxVolume } from "../sfx/uiSfx.js";

export function syncOptionsAudioNow() {
  try { setBgmVolume(getMusicGain01()); } catch {}
  try { setSfxVolume(getSfxGain01()); } catch {}
}
