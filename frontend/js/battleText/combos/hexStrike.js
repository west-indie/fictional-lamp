// frontend/js/battleText/combos/hexStrike.js
//
// Hex Strike — DMG + Status/FX (Tier 1)
//
// Your note: don't show "(FX)" here — prefer "ENEMY is STUNNED" style.

export const combo = {
  id: "hex_strike",
  name: "Hex Strike",

  match(ctx) {
    const e = ctx?.effects || {};
    if (!(e.damageDealt > 0 && e.statusApplied)) return false;

    const tags = ctx?.tags || [];
    const hasTag = (t) => tags.includes(String(t).toLowerCase());

    const sName = String(ctx?.special?.name || "").toLowerCase();
    if (hasTag("hex") || hasTag("curse")) return true;
    if (sName.includes("hex")) return true;

    return false;
  },

  build(ctx) {
    const enemy = ctx?.enemyName || "the enemy";
    const st = String(ctx?.effects?.statusApplied || "").trim();
    const turns = Number(ctx?.effects?.statusTurns || 0);

    const label = st ? st.toUpperCase() : "A STATUS";
    const t = turns > 0 ? ` (${turns}T)` : "";

    return {
      replaceEffectLines: {
        statusApplied: `${enemy} is ${label}!${t}`
      }
    };
  }
};
