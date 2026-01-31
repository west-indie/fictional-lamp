// frontend/js/game.js
//
// Thin bootstrap layer that wires screens into the core state + renderer.
// Also: global unlock processing (NOT in Quickplay).

import { BootScreen } from "./screens/boot.js";
import { MenuScreen } from "./screens/menu.js";
import { SelectScreen } from "./screens/select.js";
import { BattleScreen } from "./screens/battle.js";
import { LevelIntroScreen } from "./screens/levelIntro.js";
import { FirstPickScreen } from "./screens/firstPick.js";
import { FourthPickScreen } from "./screens/fourthPick.js";
import { QuickplayScreen } from "./screens/quickplay.js";
import { EnemyIntroScreen } from "./screens/enemyIntro.js";

import { DevBattleSelectScreen } from "./screens/devBattleSelect.js";

import { GameState } from "./core/GameState.js";
import { updateCurrentScreen, renderCurrentScreen } from "./core/Renderer.js";

import { ensureUnlockState } from "./systems/unlockSystem.js";
import { runUnlockTriggers } from "./systems/unlockTriggers.js";
import { Input } from "./ui.js";

// ✅ Uniform audio sync on screen transitions (autoplay-safe)
import { syncSavedAudioIfReady } from "./systems/screenAudioSync.js";

export { GameState };

// ✅ One-time unlock init (loads localStorage into GameState.unlocks)
ensureUnlockState(GameState);

const screens = {
  boot: BootScreen,

  menu: MenuScreen,
  select: SelectScreen,
  levelIntro: LevelIntroScreen,
  firstPick: FirstPickScreen,
  fourthPick: FourthPickScreen,
  battle: BattleScreen,
  quickplay: QuickplayScreen,
  enemyIntro: EnemyIntroScreen,

  devBattleSelect: DevBattleSelectScreen
};

// ✅ Always start on BootScreen on page load (audio unlock gate).
// Only skip boot if you're explicitly starting in a dev-only screen.
if (GameState.currentScreen !== "devBattleSelect") {
  GameState.currentScreen = "boot";
}

// ✅ Screen-aware changeScreen:
// - sets GameState.currentScreen
// - calls the new screen's enter() hook every time you switch to it
export function changeScreen(name) {
  if (!name || !screens[name]) name = "menu";

  // Keep saved Options audio applied whenever we change screens.
  try { syncSavedAudioIfReady(); } catch {}

  GameState.currentScreen = name;

  const screen = screens[name];
  if (screen && typeof screen.enter === "function") {
    screen.enter();
  }
}

// ✅ Call enter() for the initial screen once at boot
{
  const initial = screens[GameState.currentScreen];
  if (initial && typeof initial.enter === "function") {
    try { syncSavedAudioIfReady(); } catch {}
    initial.enter();
  }
}

export function update(mouse) {
  // ✅ Global unlock checks first (so screens can react the same frame if they want)
  runUnlockTriggers(GameState, Input);

  updateCurrentScreen(screens, GameState, Input, mouse);
}

export function render(ctx) {
  renderCurrentScreen(ctx, screens, GameState);
}
