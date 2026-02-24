// frontend/js/battleText/combos/supportAssault.js
//
// Support Assault — Team Buff + Enemy Debuff (Tier 1)
//
// Your desired order:
// 1) Headline
// 2) Combo narration
// 3) Buff line(s)
// 4) Debuff line(s)

import { pickAlt } from "../engines/format.js";

function nameHas(special, needle) {
  const n = String(needle || "").toLowerCase();
  const s = String(special?.name || "").toLowerCase();
  return n && s.includes(n);
}

export const combo = {
  id: "support_assault",
  name: "Support Assault",

  match(ctx) {
    const e = ctx?.effects || {};
    const hasTeamBuff = e.atkBuffPct > 0 || e.defBuffPct > 0 || e.damageReductionPct > 0;
    const hasEnemyDebuff = e.enemyAtkDebuffPct > 0 || e.enemyDefDebuffPct > 0 || Boolean(e.statusApplied);
    if (!(hasTeamBuff && hasEnemyDebuff)) return false;

    const tags = ctx?.tags || [];
    const hasTag = (t) => tags.includes(String(t).toLowerCase());

    if (hasTag("support") && (hasTag("assault") || hasTag("strike"))) return true;
    if (nameHas(ctx?.special, "support assault")) return true;

    return false;
  },

  build() {
    const alts = [
      "Allies are empowered as the enemy falters.",
      "Support rises—pressure mounts on the enemy."
    ];

    return {
      injectAfterHeadline: [pickAlt(alts)]
      // No replacement necessary: default ordering already does buffs before debuffs.
    };
  }
};
