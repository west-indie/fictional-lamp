// frontend/js/battleText/combos/wardrums.js
//
// Wardrums — Team buffs (ATK/DEF/etc.)
//
// Desired flow:
// 1) Headline
// 2) Wardrums narration (injected after headline)
// 3) Default effect lines (buffs etc.)

import { pickAlt } from "../engines/format.js";

export const combo = {
  id: "wardrums",
  name: "Wardrums",

  match(ctx) {
    const e = ctx?.effects || {};
    const tags = ctx?.tags || [];
    const hasTag = (t) => tags.includes(String(t).toLowerCase());

    // Requires team targeting OR explicit tag.
    const targetTags = ctx?.special?.target;
    const targetArr = Array.isArray(targetTags)
      ? targetTags.map((x) => String(x).toLowerCase())
      : [String(targetTags || "").toLowerCase()];

    const hitsTeam = targetArr.includes("team") || targetArr.includes("party");

    // "Team buff" shape (support future buff keys too; harmless if absent)
    const hasBuff =
      Number(e.atkBuffPct || 0) > 0 ||
      Number(e.defBuffPct || 0) > 0 ||
      Number(e.critBuffPct || 0) > 0 ||
      Number(e.evaBuffPct || 0) > 0 ||
      Number(e.accBuffPct || 0) > 0 ||
      Number(e.spdBuffPct || 0) > 0 ||
      Number(e.damageReductionPct || 0) > 0;

    if (!hasBuff) return false;

    // Prefer explicit identification when present; otherwise allow team-buff moves.
    if (hasTag("wardrums") || hasTag("war_drums") || hasTag("war-drums") || hasTag("drums")) return true;

    return hitsTeam;
  },

  build(ctx) {
    const a = ctx?.actor ? (ctx.actor.movie?.title || ctx.actor.name || "Someone") : "Someone";

    const alts = [
      `${a} sets the tempo. The team rallies together.`,
      `A thunderous rhythm surges through the team.`
    ];

    return {
      injectAfterHeadline: [pickAlt(alts)]
    };
  }
};
