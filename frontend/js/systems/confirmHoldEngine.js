// frontend/js/systems/confirmHoldEngine.js
//
// Tracks whether Confirm is physically held (independent of Input.consume()).
// Default binding is action name "Confirm" (mapped to Enter in InputManager).

import { Input } from "../core/InputManager.js";

export function createConfirmHoldEngine({ input = Input, action = "Confirm" } = {}) {
  let held = false;
  let holdStartedAtMs = 0;
  let holdMs = 0;
  let justPressed = false;
  let justReleased = false;
  let initialized = false;

  function resetState() {
    held = false;
    holdStartedAtMs = 0;
    holdMs = 0;
    justPressed = false;
    justReleased = false;
  }

  function init() {
    if (initialized) return;
    initialized = true;

    // If the tab loses focus, clear transient hold state.
    window.addEventListener("blur", resetState);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") resetState();
    });
  }

  function update(nowMs = performance.now()) {
    const isDown = !!input?.isPhysicallyDown?.(action);

    justPressed = false;
    justReleased = false;

    if (isDown) {
      if (!held) {
        held = true;
        holdStartedAtMs = nowMs;
        holdMs = 0;
        justPressed = true;
      } else {
        holdMs = Math.max(0, nowMs - holdStartedAtMs);
      }
      return;
    }

    if (held) {
      held = false;
      holdStartedAtMs = 0;
      holdMs = 0;
      justReleased = true;
    } else {
      holdMs = 0;
    }
  }

  return {
    init,
    update,
    isHeld: () => held,
    getHoldMs: () => holdMs,
    wasJustPressed: () => justPressed,
    wasJustReleased: () => justReleased
  };
}

export const ConfirmHold = createConfirmHoldEngine();
