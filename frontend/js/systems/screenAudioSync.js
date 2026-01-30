// frontend/js/systems/screenAudioSync.js
//
// Safe, uniform audio sync hook for screen transitions.
//
// Goal:
// - Keep Options slider values as the single source of truth across ALL screens.
// - Avoid creating/resuming AudioContext from non-gesture code (autoplay-safe).
//
// This module ONLY applies saved gains if the underlying audio graphs already exist.

import { trySyncBgmVolumeFromSaved } from "./audioSystem.js";
import { trySyncSfxVolumeFromSaved } from "../sfx/uiSfx.js";

// Call this whenever you change screens (or whenever you suspect something
// might have re-initialized gains). It is safe to call every frame.
export function syncSavedAudioIfReady() {
  try {
    trySyncBgmVolumeFromSaved();
  } catch {}

  try {
    trySyncSfxVolumeFromSaved();
  } catch {}
}
