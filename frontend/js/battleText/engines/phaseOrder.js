// frontend/js/battleText/phaseOrder.js
//
// Step B — canonical narration sequencing (signature + genre)
//
// Your rule:
//   Pre-FX -> DMG -> HEAL -> buffs -> debuffs -> Post-FX
//
// Special rule:
//   "revive" is part of HEAL token family, BUT its TEXT belongs in Pre-FX.

export const PHASES = {
  PRE_FX: "preFx",
  DMG: "dmg",
  HEAL: "heal",
  BUFFS: "buffs",
  DEBUFFS: "debuffs",
  POST_FX: "postFx"
};

export const DEFAULT_PHASE_ORDER = [
  PHASES.PRE_FX,
  PHASES.DMG,
  PHASES.HEAL,
  PHASES.BUFFS,
  PHASES.DEBUFFS,
  PHASES.POST_FX
];

/**
 * Map a narration key ("revive", "onHit", etc.) to a phase.
 * You can override per-move via def.phase (see narration files).
 */
export function phaseForKey(k) {
  const key = String(k || "").trim();

  // Pre-FX: headline / setup effects
  if (key === "revive" || key === "teamRevive") return PHASES.PRE_FX;

  // DMG
  if (key === "onHit" || key === "teamStrike") return PHASES.DMG;

  // HEAL (non-revive)
  if (key === "heal" || key === "teamHeal" || key === "selfHeal" || key === "allyHeal") return PHASES.HEAL;

  // BUFFS / DEBUFFS
  if (key === "buffs" || key === "atkUp" || key === "defUp" || key === "teamAtkUp" || key === "teamDefUp") {
    return PHASES.BUFFS;
  }
  if (key === "debuffs" || key === "enemyAtkDown" || key === "enemyDefDown" || key === "selfDefDown") {
    return PHASES.DEBUFFS;
  }

  // FX-ish
  if (key === "shield" || key === "allyShield" || key === "status" || key === "expose" || key === "damageReduction") {
    // default these to PRE_FX (reads best most of the time)
    return PHASES.PRE_FX;
  }

  // fallback: Post-FX (safe “aftertaste”)
  return PHASES.POST_FX;
}
