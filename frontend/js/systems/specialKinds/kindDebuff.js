// frontend/js/specialKinds/kindDebuff.js
//
// "Debuff" family classifier.
// Debuffs are negative changes on enemy OR self (self-expose etc).

const DEBUFF_KINDS = new Set([
  "ENEMY_DEBUFF",
  "debuffEnemy"
]);

function norm(s) {
  return String(s || "").trim();
}

export const kind = {
  id: "debuff",
  name: "Debuff",

  match(special) {
    const k = norm(special?.sigKind || special?.kind);
    if (DEBUFF_KINDS.has(k)) return true;

    // Shape-based: enemy debuff fields
    const atkDown = special?.atkDebuffPct ?? special?.atkPct;
    const defDown = special?.defDebuffPct ?? special?.defPct;

    // NOTE: We can't know if atkPct/defPct is intended as down or up without kind;
    // so only treat these as debuff if the kind is already debuff-ish.
    if (typeof special?.atkDebuffPct === "number" && special.atkDebuffPct > 0) return true;
    if (typeof special?.defDebuffPct === "number" && special.defDebuffPct > 0) return true;

    // Self debuff (like "Exposed" / self vulnerability)
    if (typeof special?.selfDefDebuffPct === "number" && special.selfDefDebuffPct > 0) return true;

    // If the kind name literally contains "debuff" we can accept it.
    if (k && String(k).toLowerCase().includes("debuff")) return true;

    // Otherwise, do NOT assume atkPct/defPct are debuffs.
    void atkDown;
    void defDown;
    return false;
  }
};
