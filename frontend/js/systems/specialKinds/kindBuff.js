// frontend/js/specialKinds/kindBuff.js
//
// "Buff" family classifier.
// Buffs are positive changes to allies/self (atk/def up, DR up, etc).

const BUFF_KINDS = new Set([
  "SELF_BUFF",
  "buffParty",
  "buffTeam",
  "buffPartyHeal",
  "healTeamBuff" // multi: heal + buff (heal rule also matches)
]);

function norm(s) {
  return String(s || "").trim();
}

export const kind = {
  id: "buff",
  name: "Buff",

  match(special) {
    const k = norm(special?.sigKind || special?.kind);
    if (BUFF_KINDS.has(k)) return true;

    // Shape-based: atkPct/defPct used as "up" fields in your signatures
    // (You also sometimes use atkBuffPct/defBuffPct).
    const atk = special?.atkPct ?? special?.atkBuffPct;
    const def = special?.defPct ?? special?.defBuffPct;
    if (typeof atk === "number" && atk > 0) return true;
    if (typeof def === "number" && def > 0) return true;

    // Damage Reduction is a buff-like effect (we keep it under Buff for now).
    if (typeof special?.damageReductionPct === "number" && special.damageReductionPct > 0) return true;

    return false;
  }
};
