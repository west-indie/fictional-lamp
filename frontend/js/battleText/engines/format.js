// frontend/js/battleText/format.js
//
// V2 BattleText helpers (NO narration logic here).
// Keep this file small + boring: formatting, markers, tiny utilities.

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function toInt(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x) : fallback;
}

export function isNonEmptyString(s) {
  return typeof s === "string" && s.trim().length > 0;
}

export function joinNonEmpty(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .filter((x) => x != null)
    .map((x) => String(x).trim())
    .filter(Boolean);
}

/**
 * Pick a tasteful alt line.
 * - If only 1 option, returns it.
 * - If multiple, picks one uniformly.
 * - If empty, returns "".
 */
export function pickAlt(options) {
  const list = Array.isArray(options) ? options.filter(isNonEmptyString) : [];
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Short title helper for actors/movies/enemies.
 * Mirrors your existing shortTitle in specialSystem, but reusable.
 */
export function shortName(actorOrThing, max = 30) {
  void max;
  const t =
    actorOrThing?.movie?.title ||
    actorOrThing?.title ||
    actorOrThing?.name ||
    "Actor";
  return String(t);
}

// ---------------- markers ----------------

export function hpMarker(amount) {
  const v = toInt(amount, 0);
  if (v === 0) return "(+0HP)";
  const sign = v > 0 ? "+" : "-";
  return `(${sign}${Math.abs(v)}HP)`;
}

// Stat ids we expect to show as markers
const STAT_MARKERS = new Set(["ATK", "DEF", "CRIT", "EVA", "SPD", "ACC"]);

export function statMarker(statId, deltaSign /* "+" or "-" */) {
  const s = String(statId || "").toUpperCase();
  const sign = deltaSign === "-" ? "-" : "+";
  if (!STAT_MARKERS.has(s)) return sign === "+" ? "(BUFF)" : "(DEBUFF)";
  return `(${sign}${s})`;
}

export function dmgMarker() {
  return "(DMG)";
}

export function fxMarker() {
  return "(FX)";
}

/**
 * Combine markers into a single "(...)" block if you want,
 * OR keep as multiple markers. For target labels, we keep one parens block.
 */
export function combineMarkers(tokens) {
  const list = Array.isArray(tokens) ? tokens.filter(isNonEmptyString) : [];
  if (list.length === 0) return "";
  // tokens should already be like "DMG", "+ATK", "-DEF", "FX", "+HP"
  return `(${list.join(", ")})`;
}

/**
 * Convert marker tag tokens into the exact label tokens used in target labels.
 * Examples:
 * - "DMG" stays "DMG"
 * - "+HP" stays "+HP"
 * - "+ATK" stays "+ATK"
 * - "FX" stays "FX"
 */
export function normalizeMarkerToken(tok) {
  const t = String(tok || "").trim();
  if (!t) return "";
  const up = t.toUpperCase();

  // normalize legacy
  if (up === "+HP") return "HEAL";

  return up;
}
