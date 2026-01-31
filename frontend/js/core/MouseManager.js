// frontend/js/core/MouseManager.js
//
// Unified pointer manager for canvas UI (mouse + touch + pen).
//
// Produces a small "mouse" object compatible with existing screens:
//   - x, y (GAME-space: 0..SCREEN.W-1, 0..SCREEN.H-1)
//   - moved (true if pointer moved this frame)
//   - clicked (true on a tap/click release this frame)
//
// Extra helpers:
//   - down (pointer is currently held)
//   - pressed (true on pointerdown this frame)
//   - released (true on pointerup this frame)
//   - tapped (alias of clicked; useful for screens that check clicked||tapped)
//   - setCursor(style)
//   - endFrame() (resets one-frame flags)
//
// ✅ Minimal fixes:
// - Clamp to SCREEN.W-1 / SCREEN.H-1 (avoids edge-case "x===SCREEN.W").
// - Keep armAudio() on pointerdown / pointerup (gesture-valid).
// - ✅ NEW: Add window-level pointerup/pointercancel listeners as a fallback,
//          so taps/clicks always register even if pointer capture fails.
// - No other behavior changes.

import { SCREEN } from "../layout.js";
import { armAudio } from "../sfx/uiSfx.js";

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function eventToGameXY(canvas, e) {
  const rect = canvas.getBoundingClientRect();

  // client coords → normalized (0..1) → GAME coords (SCREEN.W/H)
  const nx = rect.width ? (e.clientX - rect.left) / rect.width : 0;
  const ny = rect.height ? (e.clientY - rect.top) / rect.height : 0;

  const x = clamp(nx, 0, 1) * SCREEN.W;
  const y = clamp(ny, 0, 1) * SCREEN.H;

  const maxX = Math.max(0, SCREEN.W - 1);
  const maxY = Math.max(0, SCREEN.H - 1);

  return {
    x: clamp(x, 0, maxX),
    y: clamp(y, 0, maxY)
  };
}

export function createMouse(canvas) {
  const mouse = {
    x: 0,
    y: 0,
    moved: false,

    down: false,
    pressed: false,
    released: false,
    clicked: false,
    tapped: false, // alias of clicked

    setCursor(style) {
      try {
        canvas.style.cursor = style || "default";
      } catch {}
    },

    endFrame() {
      this.moved = false;
      this.pressed = false;
      this.released = false;
      this.clicked = false;
      this.tapped = false;
      this.setCursor("default");
    }
  };

  // We treat a "click" as a pointerup that started on the canvas.
  let activePointerId = null;
  let downStartedOnCanvas = false;

  function onPointerUpLike(e) {
    if (activePointerId == null || e.pointerId !== activePointerId) return;

    const p = eventToGameXY(canvas, e);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.moved = true;

    mouse.down = false;
    mouse.released = true;

    // "Clicked" fires on release (matches existing screen expectations).
    if (downStartedOnCanvas) {
      mouse.clicked = true;
      mouse.tapped = true; // alias
    }

    downStartedOnCanvas = false;
    activePointerId = null;

    // ✅ Another gesture-valid place to attempt audio unlock.
    try { armAudio(); } catch {}

    try {
      e.preventDefault();
    } catch {}
  }

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      // Only track one active pointer (good for buttons/menus).
      if (activePointerId != null) return;

      activePointerId = e.pointerId;
      downStartedOnCanvas = true;

      const p = eventToGameXY(canvas, e);
      mouse.x = p.x;
      mouse.y = p.y;
      mouse.moved = true;

      mouse.down = true;
      mouse.pressed = true;

      // ✅ User gesture: attempt to unlock audio here.
      try { armAudio(); } catch {}

      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}

      try {
        e.preventDefault();
      } catch {}
    },
    { passive: false }
  );

  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (activePointerId != null && e.pointerId !== activePointerId) return;

      const p = eventToGameXY(canvas, e);
      mouse.x = p.x;
      mouse.y = p.y;
      mouse.moved = true;
    },
    { passive: true }
  );

  // Canvas-level up/cancel
  canvas.addEventListener("pointerup", onPointerUpLike, { passive: false });
  canvas.addEventListener("pointercancel", onPointerUpLike, { passive: false });

  // ✅ NEW: window-level fallback up/cancel
  // This ensures clicks/taps still register even if pointer capture fails.
  window.addEventListener("pointerup", onPointerUpLike, { passive: false });
  window.addEventListener("pointercancel", onPointerUpLike, { passive: false });

  // Mobile: stop browser panning/zooming on touch.
  try {
    canvas.style.touchAction = "none";
  } catch {}

  return mouse;
}
