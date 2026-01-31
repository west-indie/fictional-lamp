// frontend/js/screens/boot.js
//
// Vice City–style boot screen (fixed):
// ✅ "PRESS PLAY ON TAPE" flashes
// ✅ Any input triggers a short transition delay before switching to menu
//    - prevents the same click/press from instantly activating menu buttons
// ✅ "SEARCHING" + splash text are HIDDEN until input happens
//    - then they appear ONLY during the delay window
// ✅ Removed "DO ANYTHING TO CONTINUE" text
//
// ✅ Stop the flashing the moment any input is made (freeze the blink state)
// ✅ When flashing stops, keep it ON (regular/bright), not dim
// ✅ Randomized splash text
// ✅ Wrap splash text if it's too long to fit the panel width
//
// NEW CHANGE (requested):
// ✅ Ignore function keys (F1–F24) on this screen

import { changeScreen } from "../game.js";
import { SCREEN } from "../layout.js";
import { GameState } from "../core/GameState.js";
import { resetAllConfirmPending } from "../systems/transientUiReset.js";


import { syncSavedAudioIfReady } from "../systems/screenAudioSync.js";
import { BOOT_SPLASH_TEXT } from "../data/bootSplashText.js";

const TRANSITION_DELAY_MS = 800; // tweak 200–350 if needed

let tSec = 0;
let splashLine = "";

// phase control
let phase = "idle"; // "idle" | "delay"
let delayMsLeft = 0;

// dt fallback
let lastNow = 0;

// DOM listeners so "ANY key" truly means any key
let bound = false;
let onAnyKeyDown = null;
let onAnyPointerDown = null;

// ✅ Blink freeze state (stops flashing after input)
let tapeBlinkFrozen = false;
let tapeBlinkState = true;

function cleanupListeners() {
  if (!bound) return;
  bound = false;

  try {
    window.removeEventListener("keydown", onAnyKeyDown, true);
    window.removeEventListener("pointerdown", onAnyPointerDown, true);
  } catch {}

  onAnyKeyDown = null;
  onAnyPointerDown = null;
}

function swallowEvent(e) {
  // Best-effort to prevent this gesture from leaking into the next screen.
  try { e.preventDefault?.(); } catch {}
  try { e.stopPropagation?.(); } catch {}
  try { e.stopImmediatePropagation?.(); } catch {}
}

function beginTransition() {
  if (phase !== "idle") return;

  // ✅ Freeze blink ON (regular/bright) once any input is made
  tapeBlinkState = true;
  tapeBlinkFrozen = true;

  // ✅ Unlock/resume audio + keep saved Options audio applied (gesture-safe)
  // Do NOT start menu music here — MenuScreen will do that on enter().
  try { syncSavedAudioIfReady(); } catch {}

  // show SEARCHING/splash only during delay
  phase = "delay";
  delayMsLeft = TRANSITION_DELAY_MS;

  // stop listening so we don't re-trigger
  cleanupListeners();
}

function normalizeDtToMs(dt) {
  const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

  if (!Number.isFinite(dt) || dt <= 0) {
    const fallback = lastNow ? (now - lastNow) : 16;
    lastNow = now;
    return fallback;
  }

  if (dt <= 2) {
    lastNow = now;
    return dt * 1000;
  }

  lastNow = now;
  return dt;
}

// ✅ Word-wrapping helper for splash text
function wrapTextLines(ctx, text, maxWidthPx) {
  const s = String(text || "").trim();
  if (!s) return [];

  const words = s.split(/\s+/g);
  const lines = [];
  let line = "";

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const test = line ? (line + " " + w) : w;

    if (ctx.measureText(test).width <= maxWidthPx) {
      line = test;
      continue;
    }

    if (line) lines.push(line);

    if (ctx.measureText(w).width > maxWidthPx) {
      let chunk = "";
      for (let j = 0; j < w.length; j++) {
        const testChunk = chunk + w[j];
        if (ctx.measureText(testChunk).width <= maxWidthPx) {
          chunk = testChunk;
        } else {
          if (chunk) lines.push(chunk);
          chunk = w[j];
        }
      }
      line = chunk;
    } else {
      line = w;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function isFunctionKey(k) {
  // Matches "F1".."F24" (covers all common function keys)
  return typeof k === "string" && /^F([1-9]|1[0-9]|2[0-4])$/.test(k);
}

export const BootScreen = {
  enter() {
    tSec = 0;
    splashLine = "";
    phase = "idle";
    delayMsLeft = 0;

    // ✅ Hard reset transient UI so refresh never leaves you "confirm pending"
    try { resetAllConfirmPending(GameState); } catch {}


    // ✅ Pick a random splash once per boot
    try {
      const arr = BOOT_SPLASH_TEXT;
      splashLine = (Array.isArray(arr) && arr.length)
        ? arr[(Math.random() * arr.length) | 0]
        : "";
    } catch {
      splashLine = "";
    }

    // ✅ Reset blink freeze state on entry
    tapeBlinkFrozen = false;
    tapeBlinkState = true;

    lastNow = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

    if (!bound) {
      bound = true;

      onAnyKeyDown = (e) => {
        if (e?.repeat) return;

        const k = e?.key;

        // ✅ Ignore function keys on this screen
        if (isFunctionKey(k)) return;

        swallowEvent(e);
        beginTransition();
      };

      onAnyPointerDown = (e) => {
        swallowEvent(e);
        beginTransition();
      };

      window.addEventListener("keydown", onAnyKeyDown, true);
      window.addEventListener("pointerdown", onAnyPointerDown, true);
    }
  },

  update(dt, mouse) {
    const dtMs = normalizeDtToMs(dt);
    tSec += dtMs / 1000;

    if (phase === "idle") {
      if (mouse?.clicked || mouse?.down) beginTransition();
      return;
    }

    delayMsLeft -= dtMs;

    if (delayMsLeft <= 0) {
      delayMsLeft = 0;
      changeScreen("menu");
    }
  },

  render(ctx) {
    const OUTER_BG = "#8c83ff";
    const PANEL_BG = "#1a22b8";
    const TEXT = "#cfd0ff";
    const TEXT_DIM = "#a9abff";
    const ACCENT = "#d9d8ff";

    const W = SCREEN.W;
    const H = SCREEN.H;

    ctx.save();

    ctx.fillStyle = OUTER_BG;
    ctx.fillRect(0, 0, W, H);

    const padX = Math.round(W * 0.10);
    const padY = Math.round(H * 0.12);

    const panelX = padX;
    const panelY = padY;
    const panelW = W - padX * 2;
    const panelH = H - padY * 2;

    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(panelX, panelY, panelW, panelH);

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "12px monospace";

    const left = panelX + 18;
    const maxTextW = panelW - 18 - 18;
    let y = panelY + 14;
    const lineH = 14;

    function line(s, color = TEXT) {
      ctx.fillStyle = color;
      ctx.fillText(s, left, y);
      y += lineH;
    }

    line("****  LOFI GALAXY  ****", ACCENT);
    line("$10000 WORTH OF RAM FREE. ALMOST 3 WHOLE GIGS", TEXT_DIM);
    line("SYSTEM DATE  OCTOBER XX 19XX", TEXT_DIM);
    y += lineH * 0.6;

    line("READY.", TEXT);
    y += lineH * 0.2;
    line('LOAD "PIRATED_MOVIE_V71"', TEXT);

    const tapeBlinkOn = tapeBlinkFrozen
      ? tapeBlinkState
      : (Math.floor(tSec / 0.45) % 2) === 0;

    line("PRESS PLAY ON TAPE", tapeBlinkOn ? ACCENT : TEXT_DIM);

    y += lineH * 0.6;

    if (phase === "delay") {
      line("SEARCHING", TEXT);

      const toWrap = splashLine || "connected to discourse.";
      const wrapped = wrapTextLines(ctx, toWrap, maxTextW);

      for (const ln of wrapped) {
        line(ln, TEXT_DIM);
      }
    }

    ctx.restore();
  }
};
