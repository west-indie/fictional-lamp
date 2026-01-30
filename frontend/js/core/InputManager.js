// frontend/js/core/InputManager.js
//
// Action-based input layer (with full legacy compatibility).
//
// ✅ Actions:
//   - Up | Down | Left | Right
//   - Confirm
//   - Back
//   - Toggle (replaces old Space)
//
// ✅ Legacy compatibility:
//   - Input.pressed("ArrowUp") -> Up
//   - Input.pressed("Enter")   -> Confirm
//   - Input.pressed("Backspace"/"Escape") -> Back
//   - Input.pressed("Space") / " " -> Toggle
//
// ✅ NEW (for unlock codes):
//   - Typed character stream via popTypedChar() (uses e.key).
//   - Single-character queries work: Input.pressed("d") / "i" / "m" / "b".
//   - This avoids "KeyD" conflicts with Right.
//
// Uses KeyboardEvent.code for action bindings and KeyboardEvent.key for characters.

import { armAudio, playUIMoveBlip, playUIConfirmBlip, playUIBackBlip } from "../sfx/uiSfx.js";

// ---------------------------
// Action bindings (edit here)
// ---------------------------
const BINDINGS = {
  Up: ["ArrowUp", "KeyW"],
  Down: ["ArrowDown", "KeyS"],
  Left: ["ArrowLeft", "KeyA"],
  Right: ["ArrowRight", "KeyD"],

  Confirm: ["Enter"],
  Back: ["Backspace", "Escape"],

  Randomize: ["KeyR"],
  GenreRandomize: ["KeyG"],
  Clear: ["KeyB"],

  Toggle: ["Space"]
};

// Which actions should trigger UI blips on a *new* press?
const MOVE_ACTIONS = new Set(["Up", "Down", "Left", "Right"]);
const CONFIRM_ACTIONS = new Set(["Confirm"]);
const BACK_ACTIONS = new Set(["Back"]);

// Helpful for preventing browser behaviors
const PREVENT_DEFAULT_CODES = new Set(["Backspace", "Space"]);

// Legacy names -> action names (so old screens keep working)
const LEGACY_TO_ACTION = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Enter: "Confirm",
  Backspace: "Back",
  Escape: "Back",
  Space: "Toggle",
  " ": "Toggle"
};

function isActionName(name) {
  return Object.prototype.hasOwnProperty.call(BINDINGS, name);
}

function isSingleCharName(name) {
  return typeof name === "string" && name.length === 1;
}

function resolveNameToKind(name) {
  // If screen passes an action, keep it
  if (isActionName(name)) return { kind: "action", value: name };

  // If screen passes a legacy key label, translate to an action
  const mappedAction = LEGACY_TO_ACTION[name];
  if (mappedAction && isActionName(mappedAction)) return { kind: "action", value: mappedAction };

  // single-character requests (unlock codes like "i","m","d","b")
  if (isSingleCharName(name)) return { kind: "char", value: name.toLowerCase() };

  // Otherwise treat as a raw code fallback
  return { kind: "code", value: name };
}

// Build reverse lookup: code -> actions[]
const CODE_TO_ACTIONS = (() => {
  const map = new Map();
  for (const [action, codes] of Object.entries(BINDINGS)) {
    for (const code of codes) {
      if (!map.has(code)) map.set(code, []);
      map.get(code).push(action);
    }
  }
  return map;
})();

function isTypedChar(key) {
  // Only keep real printable single chars.
  // e.key is already "d" / "D" depending on Shift/Caps.
  return typeof key === "string" && key.length === 1;
}

export const Input = {
  // key states by code (physical keys)
  keys: {},

  // action states (derived from codes)
  actions: {},

  // character "down" states by e.key lowercased ("a","d","i", etc.)
  charKeys: {},

  // ✅ NEW: typed character FIFO queue (for unlockTriggers)
  _typedQueue: [],

  _initialized: false,

  init() {
    if (this._initialized) return;
    this._initialized = true;

    // Initialize action storage
    for (const action of Object.keys(BINDINGS)) {
      this.actions[action] = false;
    }

    window.addEventListener("keydown", (e) => {
      const code = e.code; // "KeyW", "ArrowUp", "Space", "Enter", ...
      const key = e.key;   // "d", "D", "i", etc. (or "Enter")

      if (PREVENT_DEFAULT_CODES.has(code)) e.preventDefault();

      const wasDown = !!this.keys[code];
      this.keys[code] = true;

      // Track characters (for unlock codes) using e.key
      if (isTypedChar(key)) {
        const ch = key.toLowerCase();
        this.charKeys[ch] = true;

        // Only queue on NEW PRESS of the physical key (prevents repeats while held)
        if (!wasDown) {
          this._typedQueue.push(ch);
          // keep it small so it can't grow forever
          if (this._typedQueue.length > 12) this._typedQueue.shift();
        }
      }

      // Update any actions that this code maps to
      const mappedActions = CODE_TO_ACTIONS.get(code) || [];
      for (const action of mappedActions) {
        this.actions[action] = true;
      }

      // Only on a "new press"
      if (!wasDown) {
        armAudio();

        // Priority: Back > Confirm > Move
        if (mappedActions.some((a) => BACK_ACTIONS.has(a))) {
          playUIBackBlip();
        } else if (mappedActions.some((a) => CONFIRM_ACTIONS.has(a))) {
          playUIConfirmBlip();
        } else if (mappedActions.some((a) => MOVE_ACTIONS.has(a))) {
          playUIMoveBlip();
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      const code = e.code;
      const key = e.key;

      this.keys[code] = false;

      // Release character state
      if (isTypedChar(key)) {
        this.charKeys[key.toLowerCase()] = false;
      }

      // Recompute mapped actions based on all bound codes for each action
      const mappedActions = CODE_TO_ACTIONS.get(code) || [];
      for (const action of mappedActions) {
        const codes = BINDINGS[action] || [];
        this.actions[action] = codes.some((c) => !!this.keys[c]);
      }
    });
  },

  // ---------------------------
  // Public API
  // ---------------------------

  // "Down" state: true as long as the action/key/char is held
  isDown(name) {
    const resolved = resolveNameToKind(name);

    if (resolved.kind === "action") return !!this.actions[resolved.value];
    if (resolved.kind === "char") return !!this.charKeys[resolved.value];
    return !!this.keys[resolved.value];
  },

  // Backwards-compatible naming: pressed() means "is down"
  pressed(name) {
    return this.isDown(name);
  },

  // ✅ NEW: typed character stream (used by unlockTriggers)
  popTypedChar() {
    return this._typedQueue.length ? this._typedQueue.shift() : null;
  },

  // Consume = force action/key/char state to "not down" until next keydown event
  consume(name) {
    const resolved = resolveNameToKind(name);

    if (resolved.kind === "action") {
      const action = resolved.value;
      this.actions[action] = false;

      // Clear all bound codes to prevent immediate re-trigger from held keys
      const codes = BINDINGS[action] || [];
      for (const c of codes) this.keys[c] = false;
      return;
    }

    if (resolved.kind === "char") {
      this.charKeys[resolved.value] = false;
      return;
    }

    // Raw code fallback
    this.keys[resolved.value] = false;
  },

  consumeIfPressed(name) {
    if (this.pressed(name)) {
      this.consume(name);
      return true;
    }
    return false;
  },

  getBindings() {
    return JSON.parse(JSON.stringify(BINDINGS));
  },

  clearAll() {
    this.keys = {};
    this.actions = {};
    this.charKeys = {};
    this._typedQueue = [];

    for (const action of Object.keys(BINDINGS)) {
      this.actions[action] = false;
    }
  }
};
