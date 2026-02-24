// frontend/js/specialKinds/kindDamage.js
//
// "Damage" family classifier.
//
// IMPORTANT:
// - This is only classification, not execution.
// - We intentionally keep this conservative to avoid mislabeling.

const DAMAGE_KINDS = new Set([
  "HIT",
  "damageEnemy",
  "damage",
  "teamStrike",
  "teamstrike"
]);

function norm(s) {
  return String(s || "").trim();
}

export const kind = {
  id: "damage",
  name: "Damage",

  match(special) {
    const k = norm(special?.sigKind || special?.kind);
    if (DAMAGE_KINDS.has(k)) return true;

    // Some signatures may encode damage via powerMultiplier/amount shape.
    // Keep this VERY light to avoid false positives.
    if (typeof special?.powerMultiplier === "number" && special.powerMultiplier > 0) return true;

    return false;
  }
};
