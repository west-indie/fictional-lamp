// frontend/js/battleText/combos/sabotage.js
//
// Sabotage — DMG + Enemy Debuff (Tier 1)
//
// Preference notes from you:
// - Keep the debuff info visible
// - Show a small marker vibe like (-ATK) / (-DEF)

import { pickAlt } from "../engines/format.js";

function nameHas(special, needle) {
  const n = String(needle || "").toLowerCase();
  const s = String(special?.name || "").toLowerCase();
  return n && s.includes(n);
}

export const combo = {
  id: "sabotage",
  name: "Sabotage",

  match(ctx) {
    const e = ctx?.effects || {};
    const hasDmg = e.damageDealt > 0;
    const hasDebuff = e.enemyAtkDebuffPct > 0 || e.enemyDefDebuffPct > 0;
    if (!(hasDmg && hasDebuff)) return false;

    const tags = ctx?.tags || [];
    const hasTag = (t) => tags.includes(String(t).toLowerCase());

    if (hasTag("sabotage") || hasTag("cripple") || hasTag("weaken")) return true;
    if (nameHas(ctx?.special, "sabotage")) return true;

    return false;
  },

  build(ctx) {
    const enemy = ctx?.enemyName || "the enemy";

    const hasAtk = Number(ctx?.effects?.enemyAtkDebuffPct || 0) > 0;
    const hasDef = Number(ctx?.effects?.enemyDefDebuffPct || 0) > 0;

    const replace = {};

    if (hasAtk) {
      const pct = Math.round(Number(ctx.effects.enemyAtkDebuffPct || 0) * 100);
      const t = ctx.effects.enemyAtkDebuffTurns ? ` (${ctx.effects.enemyAtkDebuffTurns}T)` : "";
      const alts = [
        `${enemy} is sabotaged (-ATK) ${pct}%${t}.`,
        `${enemy}'s offense is disrupted (-ATK) ${pct}%${t}.`
      ];
      replace.enemyAtkDebuffPct = pickAlt(alts);
    }

    if (hasDef) {
      const pct = Math.round(Number(ctx.effects.enemyDefDebuffPct || 0) * 100);
      const t = ctx.effects.enemyDefDebuffTurns ? ` (${ctx.effects.enemyDefDebuffTurns}T)` : "";
      const alts = [
        `${enemy} is compromised (-DEF) ${pct}%${t}.`,
        `${enemy}'s guard is broken (-DEF) ${pct}%${t}.`
      ];
      replace.enemyDefDebuffPct = pickAlt(alts);
    }

    return { replaceEffectLines: replace };
  }
};
