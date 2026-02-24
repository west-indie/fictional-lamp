// frontend/js/battleText/combos/cripplingBlow.js
//
// Crippling Blow — DMG + Enemy Debuff (ATK↓ and/or DEF↓)
//
// Desired flow:
// 1) Headline
// 2) Enemy damage line (default)
// 3) Combo narration REPLACES the debuff line(s) and includes (-ATK)/(-DEF)

import { pickAlt } from "../engines/format.js";

function debuffMarker(effects) {
  const atk = Number(effects?.enemyAtkDebuffPct || 0) > 0;
  const def = Number(effects?.enemyDefDebuffPct || 0) > 0;

  if (atk && def) return "(-ATK/-DEF)";
  if (atk) return "(-ATK)";
  if (def) return "(-DEF)";
  return "(FX)";
}

export const combo = {
  id: "cripplingblow",
  name: "Crippling Blow",

  match(ctx) {
    const e = ctx?.effects || {};
    const tags = ctx?.tags || [];
    const hasTag = (t) => tags.includes(String(t).toLowerCase());

    const dmg = Number(e.damageDealt || 0) > 0;
    const debuff = Number(e.enemyAtkDebuffPct || 0) > 0 || Number(e.enemyDefDebuffPct || 0) > 0;

    if (!(dmg && debuff)) return false;

    // Prefer explicit tag if present; otherwise allow shape.
    if (hasTag("cripple") || hasTag("crippling") || hasTag("crippling_blow") || hasTag("crippling-blow")) return true;

    return true;
  },

  build(ctx) {
    const target = ctx?.enemyName || "the enemy";
    const mark = debuffMarker(ctx?.effects);

    const alts = [
      `${target} is left reeling ${mark}.`,
      `${target} falters from the impact ${mark}.`,
      `A weak point is struck—${target} staggers ${mark}.`
    ];

    const line = pickAlt(alts);

    // Replace BOTH possible enemy debuff entries, if present.
    // (If only one exists, only that one will be replaced — harmless.)
    return {
      replaceEffectLines: {
        enemyAtkDebuffPct: line,
        enemyDefDebuffPct: line
      }
    };
  }
};
