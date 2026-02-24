// frontend/js/battleText/combos/vampiricStrike.js
//
// Vampiric Strike — DMG + Heal (same mechanical shape as Lifesteal, but flavor differs)

import { hpMarker, pickAlt } from "../engines/format.js";

function nameHas(special, needle) {
  const n = String(needle || "").toLowerCase();
  const s = String(special?.name || "").toLowerCase();
  return n && s.includes(n);
}

export const combo = {
  id: "vampiric_strike",
  name: "Vampiric Strike",

  match(ctx) {
    const e = ctx?.effects || {};
    if (!(e.damageDealt > 0 && e.healedHp > 0)) return false;

    const tags = ctx?.tags || [];
    const hasTag = (t) => tags.includes(String(t).toLowerCase());

    if (hasTag("vampiric") || hasTag("vamp") || hasTag("blood") || hasTag("drain")) return true;
    if (nameHas(ctx?.special, "vamp")) return true;

    return false;
  },

  build(ctx) {
    const target = ctx?.targetName || "target";
    const enemy = ctx?.enemyName || "the enemy";
    const heal = Number(ctx?.effects?.healedHp || 0);

    const alts = [
      `${target} feeds on ${enemy} ${hpMarker(heal)}.`,
      `${enemy}'s essence restores ${target} ${hpMarker(heal)}.`
    ];

    return {
      replaceEffectLines: {
        healedHp: pickAlt(alts)
      }
    };
  }
};
