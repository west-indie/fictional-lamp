// frontend/js/battleText/combos/chargeStrike.js
//
// Charge Strike — DMG + Self Buff (usually ATK↑)
//
// Desired flow:
// 1) Headline
// 2) Enemy damage line (default)
// 3) Self-buff line (default) OR replaced by a short charge narration (optional)
//
// For V2 Tier-1: we keep it tasteful and just inject 1 line after headline.
// (No replacements unless you want them later.)

import { pickAlt } from "../engines/format.js";

export const combo = {
  id: "chargestrike",
  name: "Charge Strike",

  match(ctx) {
    const e = ctx?.effects || {};
    const tags = ctx?.tags || [];
    const hasTag = (t) => tags.includes(String(t).toLowerCase());

    // Core shape: damage + some self buff (ATK↑ most common)
    const dmg = Number(e.damageDealt || 0) > 0;

    const selfBuff =
      Number(e.atkBuffPct || 0) > 0 ||
      Number(e.critBuffPct || 0) > 0 ||
      Number(e.accBuffPct || 0) > 0 ||
      Number(e.spdBuffPct || 0) > 0;

    if (!(dmg && selfBuff)) return false;

    // Prefer explicit tag if present; otherwise allow the shape.
    if (hasTag("charge") || hasTag("charge_strike") || hasTag("charge-strike")) return true;

    return true;
  },

  build(ctx) {
    const alts = [
      `Momentum builds as the strike lands.`,
      `The hit fuels a charging rhythm.`,
      `Power surges through the follow-through.`
    ];

    return {
      injectAfterHeadline: [pickAlt(alts)]
    };
  }
};
