// frontend/js/specialKinds/kindShield.js
//
// "Shield" family classifier.
// Covers explicit shields and shieldPct patterns.

function norm(s) {
  return String(s || "").trim();
}

export const kind = {
  id: "shield",
  name: "Shield",

  match(special) {
    // Explicit shield fields (common in SELF_BUFF style signatures)
    if (typeof special?.shield === "number" && special.shield > 0) return true;
    if (typeof special?.shieldPct === "number" && special.shieldPct > 0) return true;

    // Sometimes shield is implied via kind name (rare).
    const k = norm(special?.sigKind || special?.kind).toLowerCase();
    if (k.includes("shield")) return true;

    return false;
  }
};
