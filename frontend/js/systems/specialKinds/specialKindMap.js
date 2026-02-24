// frontend/js/specialKinds/specialKindMap.js
//
// Step A — registry + helpers.
// This file does NOT touch gameplay. It only classifies specials.
//
// Why:
// - Phase 3 needs a single place to interpret "what a move does"
// - Later: build unified target labels, FX tokens, and BattleText routing.
//
// Notes:
// - "kind" can be inconsistent (sigKind vs kind), so we normalize.
// - Some moves are multi-effect (heal+buff, damage+FX, etc.).
// - We return a LIST of kind ids (ordered by importance), not just one.

import { kind as kindDamage } from "./kindDamage.js";
import { kind as kindHeal } from "./kindHeal.js";
import { kind as kindShield } from "./kindShield.js";
import { kind as kindBuff } from "./kindBuff.js";
import { kind as kindDebuff } from "./kindDebuff.js";
import { kind as kindFx } from "./kindFx.js";

// Keep this order stable — it becomes your "label priority" later.
export const KIND_RULES_ORDERED = [
  kindDamage,
  kindHeal,
  kindShield,
  kindBuff,
  kindDebuff,
  kindFx
];

// Quick lookup by id
export const KIND_RULES_BY_ID = Object.fromEntries(
  KIND_RULES_ORDERED.map((k) => [k.id, k])
);

/**
 * Normalize the raw kind string from any special shape.
 * - signature specials often have both kind + sigKind
 * - genre specials often have kind:"genre"
 */
export function getRawKindString(special) {
  if (!special) return "";
  return String(special.sigKind || special.kind || "").trim();
}

/**
 * Returns an ORDERED list of kind ids that match this special.
 * Example: healTeamBuff -> ["heal","buff"] (and possibly "fx" later)
 */
export function getKindIdsForSpecial(special) {
  const ids = [];
  for (const rule of KIND_RULES_ORDERED) {
    try {
      if (rule.match(special)) ids.push(rule.id);
    } catch {
      // Rule errors should never break battle flow.
      // Keep silent and continue.
    }
  }
  return ids;
}

/**
 * Returns the "primary" kind id, if any.
 * This is useful for simple UI decisions, but Phase 3 often needs all ids.
 */
export function getPrimaryKindId(special) {
  const all = getKindIdsForSpecial(special);
  return all.length ? all[0] : null;
}

/**
 * Convenience: returns the rule objects (ordered) for this special.
 */
export function getKindRulesForSpecial(special) {
  return getKindIdsForSpecial(special).map((id) => KIND_RULES_BY_ID[id]).filter(Boolean);
}

/**
 * FX is special: we usually want FX to be "additive" (status/vuln/etc).
 * This helper intentionally does NOT decide how to label FX — it only detects it.
 *
 * Later in Phase 3 you’ll swap STATUS/VULN label tokens to (FX) without changing gameplay.
 */
export function hasFxLikeBehavior(special) {
  return kindFx.match(special);
}
