// frontend/js/battleText/buildAttackLines.js
//
// Phase 4A: centralized player basic-attack narration.

import { toInt } from "./format.js";
import {
  PLAYER_ATTACK_CRIT_TEMPLATE,
  PLAYER_ATTACK_NORMAL_TEMPLATE
} from "../lines/attackLinesText.js";

function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function buildPlayerAttackLines({ actor, result }) {
  const attacker = String(actor?.movie?.title || actor?.title || actor?.name || "Actor");
  const dmg = toInt(result?.damage, 0);
  const isCrit = Boolean(result?.isCrit);

  if (isCrit) return [renderTemplate(PLAYER_ATTACK_CRIT_TEMPLATE, { attacker, dmg })];
  return [renderTemplate(PLAYER_ATTACK_NORMAL_TEMPLATE, { attacker, dmg })];
}
