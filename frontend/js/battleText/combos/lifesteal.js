// frontend/js/battleText/combos/lifesteal.js
//
// Lifesteal — DMG + Heal (usually enemy dmg + self/ally heal)
//
// Desired flow (example):
// 1) Headline
// 2) Enemy damage line (default)
// 3) Combo narration replaces the heal line: "... (+19HP)"

import { hpMarker, pickAlt } from "../engines/format.js";

function nameHas(special, needle) {
  const n = String(needle || "").toLowerCase();
  const s = String(special?.name || "").toLowerCase();
  return n && s.includes(n);
}

export const combo = {
  id: "lifesteal",
  name: "Lifesteal",

  match(ctx) {
    const e = ctx?.effects || {};
    if (!(e.damageDealt > 0 && e.healedHp > 0)) return false;

    // Prefer explicit tags / naming when present
    const tags = ctx?.tags || [];
    const hasTag = (t) => tags.includes(String(t).toLowerCase());

    if (hasTag("lifesteal") || hasTag("life_steal") || hasTag("drain") || hasTag("siphon")) return true;
    if (nameHas(ctx?.special, "lifesteal")) return true;

    return false;
  },

  build(ctx) {
    const target = ctx?.targetName || "target";
    const enemy = ctx?.enemyName || "the enemy";
    const heal = Number(ctx?.effects?.healedHp || 0);

    const alts = [
      `${target} siphons vitality from ${enemy} ${hpMarker(heal)}.`,
      `${enemy}'s life force flows into ${target} ${hpMarker(heal)}.`,
      `${target} drains strength from ${enemy} ${hpMarker(heal)}.`
    ];

    return {
      replaceEffectLines: {
        healedHp: pickAlt(alts)
      }
    };
  }
};
