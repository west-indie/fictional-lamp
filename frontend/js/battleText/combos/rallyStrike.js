// frontend/js/battleText/combos/rallyStrike.js
//
// Rally Strike — DMG + Ally/Team Buff (Tier 1)
// We keep the mechanical buff line(s), but add tasteful narration.

import { pickAlt } from "../engines/format.js";

function nameHas(special, needle) {
  const n = String(needle || "").toLowerCase();
  const s = String(special?.name || "").toLowerCase();
  return n && s.includes(n);
}

export const combo = {
  id: "rally_strike",
  name: "Rally Strike",

  match(ctx) {
    const e = ctx?.effects || {};
    const hasDmg = e.damageDealt > 0;
    const hasBuff = e.atkBuffPct > 0 || e.defBuffPct > 0;
    if (!(hasDmg && hasBuff)) return false;

    const tags = ctx?.tags || [];
    const hasTag = (t) => tags.includes(String(t).toLowerCase());

    if (hasTag("rally") || hasTag("inspire") || hasTag("motivate")) return true;
    if (nameHas(ctx?.special, "rally")) return true;

    return false;
  },

  build(ctx) {
    const enemy = ctx?.enemyName || "the enemy";

    const alts = [
      `Momentum builds as ${enemy} staggers.`,
      `The crowd roars—confidence surges.`,
      `A surge of energy ripples through the team.`
    ];

    return {
      injectAfterHeadline: [pickAlt(alts)]
    };
  }
};
