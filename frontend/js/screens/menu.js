// frontend/js/screens/menu.js
//
// ✅ Menu screen (layer2 always silenced + M mutes menu music):
// - Does NOT try to start/resume AudioContext in enter() (autoplay-safe).
// - Boots layered stems ONLY from a user gesture inside update().
// - HARD-ENFORCES MENU_MIX while on Menu so layer2 can NEVER "stick".
// - Press M to toggle mute (menu-only for now).
//
// ✅ NEW:
// - Replaces RESET with OPTIONS
// - OPTIONS opens Options Overlay (Continue + Music slider + SFX slider + Reset)
// - Reset is ONLY inside Options Overlay (menu context)
//
// ✅ FIXES in this rewrite:
// - Audio boot is attempted ONLY on real gestures (keyboard / click/tap).
//   (Browsers won't allow mouse-move to start audio.)
// - Mouse hover does NOT "lock" keyboard selection just because cursor is parked.
// - Clicking/tapping on RIGHT half of screen acts as Confirm (run selection).
// - Clicking/tapping on LEFT half acts as Back ONLY if that makes sense (menu => no-op).
// - Hovering a new option plays the move blip (arrow ping).
// - Clicking an option plays confirm blip.
// - Options overlay and unlock overlay keep working.

import { GameState, changeScreen } from "../game.js";
import { SCREEN, MENU_LAYOUT } from "../layout.js";
import { Input } from "../ui.js";
import { resetAllProgress } from "../systems/resetSystem.js";

import { movies } from "../data/movies.js";
import { renderUnlockArcOverlay } from "./unlockArcOverlay.js";
import { peekUnlockEvents, popNextUnlockEvent } from "../systems/unlockTriggers.js";
import { playUIBackBlip, playUIConfirmBlip, playUIMoveBlip } from "../sfx/uiSfx.js";

import { MenuLayers, MENU_MIX, SILENT_MIX } from "../systems/menuLayeredMusic.js";

// ✅ Real volume controls (audioSystem affects playBgm; MenuLayers is handled separately below)
import { setBgmVolume, syncBgmVolumeFromSaved } from "../systems/audioSystem.js";
import { setSfxVolume, syncSfxVolumeFromSaved } from "../sfx/uiSfx.js";

// ✅ Options overlay
import { createOptionsOverlay } from "./optionsOverlay.js";

let index = 0;
const options = ["START", "QUICKPLAY", "OPTIONS"];

// Enter must be released once on this screen before it can trigger
let enterArmed = false;

// Overlay mode
let uiMode = "menu"; // "menu" | "unlock" | "options"
let overlayPayload = null;

// ✅ Secret dev code: 7-1-1 (menu only)
let devCodeStep = 0;
let devCodeTimerMs = 0;
const DEV_CODE_TIMEOUT_MS = 1200;

// ✅ Layered music flags
let layeredReady = false;
let layeredLoading = false;

// ✅ Menu mute toggle (M)
let menuMuted = false;
const MUTE_KEYS = ["Mute", "M", "m", "KeyM"];

// ✅ Options overlay instance
let optionsOverlay = null;

// Cursor affordance only.
// IMPORTANT: we keep ONE unified selection index (`index`).
// Mouse hover updates `index` directly so keyboard navigation continues from that point.
let hoverIndex = -1;

function optionRect(i) {
  const x = MENU_LAYOUT.options.x - 10;
  const y = MENU_LAYOUT.options.y + i * MENU_LAYOUT.options.dy - 16;
  return { x, y, w: 160, h: 26 };
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function resetDevCode() {
  devCodeStep = 0;
  devCodeTimerMs = 0;
}

function updateDevCode(dtMs = 16.67) {
  if (uiMode !== "menu") {
    resetDevCode();
    return false;
  }

  if (devCodeStep > 0) {
    devCodeTimerMs += dtMs;
    if (devCodeTimerMs > DEV_CODE_TIMEOUT_MS) resetDevCode();
  }

  if (Input.pressed("7")) {
    Input.consume("7");
    devCodeStep = 1;
    devCodeTimerMs = 0;
    return false;
  }

  if (Input.pressed("1")) {
    Input.consume("1");

    if (devCodeStep === 1) {
      devCodeStep = 2;
      devCodeTimerMs = 0;
      return false;
    }

    if (devCodeStep === 2) {
      resetDevCode();
      changeScreen("devBattleSelect");
      return true;
    }

    resetDevCode();
  }

  return false;
}

function getMovieById(id) {
  return (
    movies.find((m) => m.id === id) || {
      id,
      title: "Unknown",
      runtime: 120,
      imdb: 7.0
    }
  );
}

function closeOverlay() {
  uiMode = "menu";
  overlayPayload = null;
  enterArmed = false;
}

function openOverlayIfAny() {
  if (uiMode !== "menu") return;

  const events = peekUnlockEvents(GameState);
  if (!events || !events.length) return;

  const next = events.find((e) => e?.type === "ARCHETYPE_UNLOCKED" && e?.showOverlay);
  if (!next) return;

  overlayPayload = popNextUnlockEvent(GameState);
  if (overlayPayload) {
    uiMode = "unlock";
    enterArmed = false;
  }
}

function startEnemyIntroFromPayload(payload) {
  const ids = Array.isArray(payload?.movieIds) ? payload.movieIds : [];
  const party = ids.slice(0, 4).map(getMovieById);

  GameState.party.movies = party;

  GameState.runMode = "campaign";
  GameState.enemyTemplate = null;
  GameState.enemy = null;
  GameState.currentLevel = 1;

  GameState.campaign = {
    onefourShown: true,
    firstPickApplied: null,
    fourthPickApplied: null,
    effects: { first: null, fourth: null },
    _onefourAppliedThisBattle: false
  };

  changeScreen("enemyIntro");
}

function runSelectedOption(i) {
  const opt = options[i];

  if (opt === "START") return changeScreen("select");
  if (opt === "QUICKPLAY") return changeScreen("quickplay");

  if (opt === "OPTIONS") {
    ensureOptionsOverlay();
    uiMode = "options";
    enterArmed = false;
    optionsOverlay.open({ context: "menu" }); // ✅ includes Reset
    playUIConfirmBlip();
    return;
  }

  changeScreen("select");
}

function isAnyPressed(keys) {
  for (const k of keys) {
    try {
      if (Input.pressed(k)) return k;
    } catch {}
  }
  return null;
}

function consumeAny(keys) {
  const k = isAnyPressed(keys);
  if (!k) return false;
  try {
    Input.consume(k);
  } catch {}
  return true;
}

function applyMenuMixNow(fadeMs = 0) {
  try {
    if (menuMuted) {
      MenuLayers.setMix(SILENT_MIX, fadeMs);
      return;
    }
    MenuLayers.setMix(MENU_MIX, fadeMs);
  } catch {}
}

async function bootLayeredFromGestureIfNeeded() {
  try {
    if (layeredReady && !MenuLayers.started) layeredReady = false;
  } catch {}

  if (layeredReady) return true;
  if (layeredLoading) return false;

  layeredLoading = true;
  try {
    await MenuLayers.ensureStarted();
    layeredReady = true;

    // After starting, enforce mix immediately
    applyMenuMixNow(0);
    return true;
  } catch {
    return false;
  } finally {
    layeredLoading = false;
  }
}

function doFullResetFlow() {
  let ok = false;
  try {
    ok = window.confirm(
      "Reset all unlock progress?\n\nThis will reset stats (wins/losses/randomize/winsByGenre/winsByFranchise) and lock archetypes again."
    );
  } catch {
    ok = false;
  }
  if (!ok) return;

  resetAllProgress(GameState);

  if (GameState?.flags?.secrets) GameState.flags.secrets = {};

  index = 0;
  enterArmed = false;
  uiMode = "menu";
  overlayPayload = null;
  resetDevCode();
}

function ensureOptionsOverlay() {
  if (optionsOverlay) return;

  optionsOverlay = createOptionsOverlay({
    width: SCREEN.W,
    height: SCREEN.H,

    onClose: () => {
      uiMode = "menu";
      enterArmed = false;
      applyMenuMixNow(0);
    },

    onReset: () => {
      doFullResetFlow();
    },

    onSetMusicGain: (g01) => {
      try { setBgmVolume(g01); } catch {}
      applyMenuMixNow(0);
    },

    onSetSfxGain: (g01) => {
      try { setSfxVolume(g01); } catch {}
    }
  });
}

function hasGestureThisFrame(mouse) {
  // ✅ Browsers allow audio start ONLY on keydown / pointerdown / pointerup.
  // We treat mouse.pressed/clicked as gesture-valid.
  if (
    Input.pressed("Confirm") ||
    Input.pressed("Up") ||
    Input.pressed("Down") ||
    Input.pressed("Back") ||
    Input.pressed("Left") ||
    Input.pressed("Right") ||
    Input.pressed("7") ||
    Input.pressed("1") ||
    isAnyPressed(MUTE_KEYS)
  ) {
    return true;
  }
  if (mouse?.pressed || mouse?.clicked) return true;
  return false;
}

export const MenuScreen = {
  enter() {
    enterArmed = false;
    uiMode = "menu";
    overlayPayload = null;
    resetDevCode();

    ensureOptionsOverlay();

    try {
      if (!MenuLayers.started) layeredReady = false;
    } catch {}

    // ✅ Sync master buses to saved Options levels (no gesture required; just sets nodes if they exist)
    try { syncBgmVolumeFromSaved(); } catch {}
    try { syncSfxVolumeFromSaved(); } catch {}

    // Force menu mix immediately (even if not started yet)
    applyMenuMixNow(0);
  },

  update(mouse) {
    openOverlayIfAny();

    if (consumeAny(MUTE_KEYS)) {
      menuMuted = !menuMuted;
      applyMenuMixNow(0);
    }

    // HARD ENFORCE: menu mix always wins while on menu (prevents layer2 sticking)
    applyMenuMixNow(0);

    // ✅ Boot layered stems only from gesture-valid input
    if (hasGestureThisFrame(mouse)) {
      bootLayeredFromGestureIfNeeded(); // fire-and-forget
    }

    // Use a stable frame time for dev-code timeout
    if (updateDevCode(16.67)) return;

    // -------- UNLOCK OVERLAY --------
    if (uiMode === "unlock") {
      // Allow left/right tap behavior here too:
      if (mouse?.clicked) {
        if (mouse.x < SCREEN.W / 2) {
          playUIBackBlip();
          closeOverlay();
          return;
        }
        playUIConfirmBlip();
        const payload = overlayPayload || {};
        const to = payload.confirmToScreen;
        closeOverlay();
        if (to === "enemyIntro") startEnemyIntroFromPayload(payload);
        return;
      }

      if (Input.pressed("Back")) {
        Input.consume("Back");
        playUIBackBlip();
        closeOverlay();
        return;
      }

      if (!Input.isDown("Confirm")) enterArmed = true;

      if (enterArmed && Input.pressed("Confirm")) {
        Input.consume("Confirm");
        playUIConfirmBlip();

        const payload = overlayPayload || {};
        const to = payload.confirmToScreen;

        closeOverlay();
        if (to === "enemyIntro") startEnemyIntroFromPayload(payload);
        return;
      }

      return;
    }

    // -------- OPTIONS OVERLAY --------
    if (uiMode === "options") {
      ensureOptionsOverlay();
      optionsOverlay.update(1 / 60, Input, mouse);

      // Optional: allow tap-left = back/close, tap-right = confirm (no-op here)
      if (mouse?.clicked) {
        if (mouse.x < SCREEN.W / 2) {
          playUIBackBlip();
          optionsOverlay.close?.();
          // onClose handler will restore uiMode/menu mix
        }
      }

      return;
    }

    // -------- MOUSE HOVER + CLICK --------
    hoverIndex = -1;
    let hoveringAny = false;

    // Mouse takes over selection only when it actively moved/pressed this frame.
    const mouseActiveThisFrame = !!(mouse && (mouse.moved || mouse.pressed));

    if (mouseActiveThisFrame && typeof mouse.x === "number" && typeof mouse.y === "number") {
      for (let i = 0; i < options.length; i++) {
        if (pointInRect(mouse.x, mouse.y, optionRect(i))) {
          hoverIndex = i;
          hoveringAny = true;

          if (index !== i) {
            index = i;
            playUIMoveBlip();
          }
          break;
        }
      }
    }

    if (mouse && typeof mouse.setCursor === "function") {
      mouse.setCursor(hoveringAny ? "pointer" : "default");
    }

    // Click directly on option
    if (mouse?.clicked && hoveringAny) {
      playUIConfirmBlip();
      runSelectedOption(index);
      return;
    }

    // Tap anywhere rule (menu mode):
    // - Left half = Back (menu has no back, so no-op)
    // - Right half = Confirm (run current selection)
    if (mouse?.clicked && !hoveringAny) {
      if (mouse.x >= SCREEN.W / 2) {
        playUIConfirmBlip();
        runSelectedOption(index);
        return;
      }
      // left half: no-op (or uncomment for feedback)
      // playUIBackBlip();
      return;
    }

    // -------- KEYBOARD NAV --------
    if (!Input.isDown("Confirm")) enterArmed = true;

    if (Input.pressed("Up")) {
      Input.consume("Up");
      index = (index - 1 + options.length) % options.length;
    }

    if (Input.pressed("Down")) {
      Input.consume("Down");
      index = (index + 1) % options.length;
    }

    if (enterArmed && Input.pressed("Confirm")) {
      Input.consume("Confirm");
      enterArmed = false;
      runSelectedOption(index);
    }
  },

  render(ctx) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SCREEN.W, SCREEN.H);

    ctx.fillStyle = "#eee";
    ctx.font = "25px monospace";
    ctx.fillText("MOVIE RPG", MENU_LAYOUT.title.x, MENU_LAYOUT.title.y);

    ctx.font = "12.5px monospace";
    ctx.fillText("THE CINEMATIC BATTLE SYSTEM", MENU_LAYOUT.subtitle.x, MENU_LAYOUT.subtitle.y);

    ctx.font = "17.5px monospace";
    options.forEach((opt, i) => {
      ctx.fillStyle = i === index ? "#ff0" : "#fff";
      ctx.fillText(opt, MENU_LAYOUT.options.x, MENU_LAYOUT.options.y + i * MENU_LAYOUT.options.dy);
    });

    ctx.fillStyle = "#777";
    ctx.font = "10px monospace";
    ctx.fillText(
      "↑/↓: select  |  Enter: confirm  |  Bksp/Esc: back",
      MENU_LAYOUT.footer.x,
      MENU_LAYOUT.footer.y
    );

    ctx.fillStyle = "#555";
    ctx.font = "9px monospace";
    ctx.fillText(menuMuted ? "M: unmute" : "M: mute", MENU_LAYOUT.footer.x, MENU_LAYOUT.footer.y + 14);

    if (uiMode === "unlock") {
      const payload = overlayPayload || {};
      const party = (payload.movieIds || []).slice(0, 4).map(getMovieById);

      renderUnlockArcOverlay(ctx, {
        width: SCREEN.W,
        height: SCREEN.H,
        archetypeName: payload.archetypeName || "Unknown",
        party,
        codeLabel: payload.codeLabel || ""
      });
      return;
    }

    if (uiMode === "options") {
      ensureOptionsOverlay();
      optionsOverlay.render(ctx);
      return;
    }
  }
};
