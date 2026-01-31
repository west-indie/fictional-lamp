// frontend/js/screens/select/selectTextInputBridge.js
//
// Mobile-friendly text input bridge for Select search.
// Creates a hidden <input> so mobile keyboards can type into a canvas UI.
//
// - No dependencies on GameState.
// - You control when to focus/blur from select.js.
// - Keeps value synced to state.searchQuery.
//
// Usage (select.js):
//   import { ensureSelectTextInput, syncSelectTextInput, focusSelectTextInput, blurSelectTextInput } from "./select/selectTextInputBridge.js";
//
//   // in update(): ensureSelectTextInput(); syncSelectTextInput({ state, SCREEN, L, searchRects });
//   // when search gets focus (click/tap): focusSelectTextInput(state);
//   // when leaving search/pick-slot mode/confirm pending: blurSelectTextInput();

let _input = null;
let _bound = false;

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function ensureInputEl() {
  if (_input) return _input;

  const el = document.createElement("input");
  el.type = "text";
  el.autocomplete = "off";
  el.autocapitalize = "off";
  el.spellcheck = false;
  el.inputMode = "search";
  el.enterKeyHint = "search";

  // visually hidden but focusable; we will position it over the search bar
  el.style.position = "fixed";
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  el.style.zIndex = "999999";
  el.style.border = "0";
  el.style.padding = "0";
  el.style.margin = "0";
  el.style.background = "transparent";
  el.style.color = "transparent";
  el.style.outline = "none";
  el.style.width = "10px";
  el.style.height = "10px";
  el.style.left = "0px";
  el.style.top = "0px";

  document.body.appendChild(el);
  _input = el;
  return el;
}

export function ensureSelectTextInput() {
  const el = ensureInputEl();
  if (_bound) return el;
  _bound = true;
  return el;
}

/**
 * Keep the hidden input positioned over the search bar (optional but helps iOS focus reliability),
 * and keep its value synced with state.searchQuery.
 *
 * Pass the same searchRects you already use for rendering/hit tests.
 */
export function syncSelectTextInput({ state, SCREEN, L, searchRects }) {
  const el = ensureSelectTextInput();
  if (!state) return;

  // Sync value (only if different, so we don't move cursor unnecessarily)
  const next = String(state.searchQuery || "");
  if (el.value !== next) el.value = next;

  // If we can't compute rects, keep it at 0,0 (still works in many browsers)
  if (typeof searchRects !== "function") return;

  const sr = searchRects({ SCREEN, L });
  const mid = sr?.mid;
  if (!mid) return;

  // Find the canvas on the page to map canvas coords -> viewport coords.
  // If multiple canvases exist, this targets the first one.
  const canvas = document.querySelector("canvas");
  if (!canvas) return;

  const cr = canvas.getBoundingClientRect();

  // Canvas is drawn scaled; convert canvas units to CSS pixels.
  const scaleX = cr.width / num(SCREEN?.W, 400);
  const scaleY = cr.height / num(SCREEN?.H, 300);

  const left = cr.left + mid.x * scaleX;
  const top = cr.top + mid.y * scaleY;
  const w = mid.w * scaleX;
  const h = mid.h * scaleY;

  el.style.left = `${Math.floor(left)}px`;
  el.style.top = `${Math.floor(top)}px`;
  el.style.width = `${Math.max(10, Math.floor(w))}px`;
  el.style.height = `${Math.max(10, Math.floor(h))}px`;
}

/**
 * Focuses the hidden input and wires live updates to state.searchQuery.
 * Call when user clicks/taps the search bar OR when focus becomes "search".
 */
export function focusSelectTextInput(state, { onChange } = {}) {
  const el = ensureSelectTextInput();
  if (!state) return;

  // Wire "input" handler once per focus call (idempotent per function instance)
  // We attach a fresh handler and remove it on blur for cleanliness.
  if (!el.__selectOnInput) {
    el.__selectOnInput = () => {};
  }

  // Replace handler
  const handler = () => {
    state.searchQuery = String(el.value || "");
    if (typeof onChange === "function") onChange(state.searchQuery);
  };

  // Remove previous
  try {
    el.removeEventListener("input", el.__selectOnInput);
  } catch {}

  el.__selectOnInput = handler;
  el.addEventListener("input", handler);

  // Focus + place cursor at end
  try {
    el.focus({ preventScroll: true });
  } catch {
    try { el.focus(); } catch {}
  }

  try {
    const v = el.value || "";
    el.setSelectionRange(v.length, v.length);
  } catch {}
}

/**
 * Blurs and unhooks the input listener.
 * Call when leaving search focus, entering confirmPending, or when picking is done.
 */
export function blurSelectTextInput() {
  const el = ensureSelectTextInput();

  try {
    if (el.__selectOnInput) el.removeEventListener("input", el.__selectOnInput);
  } catch {}

  try { el.blur(); } catch {}
}
