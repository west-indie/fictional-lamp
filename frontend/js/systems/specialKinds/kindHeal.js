// frontend/js/specialKinds/kindHeal.js
//
// "Heal" family classifier.

const HEAL_KINDS = new Set([
  "healSelf",
  "healSelfMissingPct",
  "healAlly",
  "healAllyMissingPct",
  "healTeam",
  "healTeamMissingPct",
  "healTeamBuff"
]);

function norm(s) {
  return String(s || "").trim();
}

export const kind = {
  id: "heal",
  name: "Heal",

  match(special) {
    const k = norm(special?.sigKind || special?.kind);
    if (HEAL_KINDS.has(k)) return true;

    // Some heals use amount/missingHealPct shapes.
    if (typeof special?.amount === "number" && special.amount > 0) {
      // If it's explicitly a damage kind, don't misclassify.
      const raw = norm(special?.sigKind || special?.kind);
      if (raw === "HIT" || raw === "damageEnemy") return false;
      // Otherwise allow — many heals are "amount"-based.
      return true;
    }

    if (typeof special?.missingHealPct === "number" && special.missingHealPct > 0) return true;

    return false;
  }
};
