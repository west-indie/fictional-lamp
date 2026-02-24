// frontend/js/battleText/buildEnemyMetaLines.js
//
// Centralized enemy-authored meta lines used by battle flow.
// Supports authored fields as either:
// - string: "one line"
// - string[]: ["line 1", "line 2"]

function toLines(value) {
  if (Array.isArray(value)) {
    return value
      .map((line) => String(line ?? "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const line = value.trim();
    return line ? [line] : [];
  }

  return [];
}

export function buildEnemyIntroLines(enemy) {
  const authored = toLines(enemy?.intro);
  if (authored.length > 0) return authored;
  return toLines(enemy?.description);
}

export function buildEnemyTauntLines(enemy) {
  return toLines(enemy?.taunt);
}

export function buildEnemyDefeatLines(enemy) {
  return toLines(enemy?.defeat);
}
