// frontend/js/battleText/buildProgressionLines.js
//
// Centralized progression/level-up narration helpers.

import {
  LEVEL_UP_ATK_DEF,
  LEVEL_UP_CRIT_DAMAGE_BONUS,
  LEVEL_UP_EVASION_BONUS,
  LEVEL_UP_HEADLINE_TEMPLATE,
  LEVEL_UP_MAX_HP_TEMPLATE
} from "../lines/progressionText.js";

function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function buildLevelUpHeadlineLine(name, level) {
  const who = String(name || "Actor");
  const lvl = Math.max(1, Math.floor(Number(level || 1)));
  return renderTemplate(LEVEL_UP_HEADLINE_TEMPLATE, { who, lvl });
}

export function buildLevelUpAtkDefLine() {
  return LEVEL_UP_ATK_DEF;
}

export function buildLevelUpMaxHpLine(hpGain) {
  const gain = Math.max(0, Math.floor(Number(hpGain || 0)));
  return renderTemplate(LEVEL_UP_MAX_HP_TEMPLATE, { gain });
}

export function buildLevelUpCritDamageBonusLine() {
  return LEVEL_UP_CRIT_DAMAGE_BONUS;
}

export function buildLevelUpEvasionBonusLine() {
  return LEVEL_UP_EVASION_BONUS;
}
