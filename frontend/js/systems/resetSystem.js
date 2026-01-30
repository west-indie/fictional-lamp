// frontend/js/systems/resetSystem.js
//
// Single place to fully wipe progress + any secret/trial persistence.
// Call resetAllProgress(GameState, { keepSelectState: true }) to preserve Select picks/UI.

import { resetAllStats } from "./statsSystem.js";
import { resetAllUnlocks } from "./unlockSystem.js";

const LS_RATA_TRIAL = "rpg_ratatouille_trial_v1";
const LS_SELECT_SLOT_IDS = "rpg_select_slot_ids_v1";
const LS_SELECT_UI = "rpg_select_ui_v1";
const LS_LAST_SCREEN = "rpg_last_screen";

function safeRemoveLS(key) {
  try {
    window?.localStorage?.removeItem(key);
  } catch {}
}

export function resetAllProgress(GameState, options = {}) {
  const keepSelectState = !!options.keepSelectState;

  // 1) stats + unlocks
  resetAllStats(GameState);
  resetAllUnlocks(GameState);

  // 2) wipe secrets/trials in memory
  if (!GameState.flags) GameState.flags = {};
  if (!GameState.flags.secrets) GameState.flags.secrets = {};
  GameState.flags.secrets = {};

  // 3) clear any queued unlock overlays/events (prevents "ghost overlays")
  if (GameState.ui && Array.isArray(GameState.ui.events)) {
    GameState.ui.events.length = 0;
  }

  // 4) clear Ratatouille trial persistence (this is the big one)
  safeRemoveLS(LS_RATA_TRIAL);

  // 5) clear Select persistence only if we are NOT keeping it
  if (!keepSelectState) {
    safeRemoveLS(LS_SELECT_SLOT_IDS);
    safeRemoveLS(LS_SELECT_UI);
  }

  // 6) clear last screen (optional, but helps avoid weird boot behavior)
  safeRemoveLS(LS_LAST_SCREEN);

  // 7) explicitly clear streak (in case your stats reset doesn't include it)
  if (!GameState.stats) GameState.stats = {};
  GameState.stats.randomizeStreak = 0;
}
