// frontend/js/battleText/combos/seven.js
//
// Seven — pure debuff signature (Tier 1)
//
// Your note: keep it at three lines:
// 1) Headline
// 2) One narration line
// 3) The specific debuff line (default or slightly flavored)

import { pickAlt } from "../engines/format.js";

function isSevenName(special) {
  const s = String(special?.name || "").trim().toLowerCase();
  return s === "7" || s === "seven";
}

export const combo = {
  id: "seven",
  name: "Seven",

  match(ctx) {
    if (!isSevenName(ctx?.special)) return false;

    const e = ctx?.effects || {};
    const hasDebuff = e.enemyAtkDebuffPct > 0 || e.enemyDefDebuffPct > 0 || Boolean(e.statusApplied);
    if (!hasDebuff) return false;

    return true;
  },

  build(ctx) {
    const enemy = ctx?.enemyName || "the enemy";

    const alts = [
      `${enemy} is thrown off-balance.`,
      `${enemy} loses their footing.`,
      `${enemy} can't find their rhythm.`
    ];

    return {
      injectAfterHeadline: [pickAlt(alts)]
    };
  }
};
