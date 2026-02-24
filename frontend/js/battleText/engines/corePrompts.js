// frontend/js/battleText/corePrompts.js
//
// Shared non-special battle prompts for message box and battle UI fallbacks.

import {
  BATTLE_ACTION_LABELS,
  BATTLE_MENU_LABELS,
  CORE_DEFAULT_ENEMY_NAME,
  CANT_USE_RIGHT_NOW_TEMPLATE,
  ENEMY_BACKED_DOWN_TEMPLATE,
  ENEMY_DEFEATED_TEMPLATE,
  INVALID_TARGET,
  NO_ITEMS_MENU,
  NO_SPECIAL_SELECTED,
  NO_SPECIALS_AVAILABLE,
  NO_SPECIALS_MENU,
  NO_VALID_ACTOR,
  NO_VALID_ALLY_TARGETS,
  NOTHING_HAPPENS,
  PRESS_ENTER_CONTINUE,
  PRESS_ENTER_CONTINUE_BANG,
  PRESS_ENTER_CONTINUE_PHASE,
  QUIRKY_EXTRA_TURN,
  RUN_UNAVAILABLE_LINES,
  SPECIAL_COOLDOWN_TEMPLATE,
  SPECIAL_USED_FALLBACK,
  SPECIAL_WRONG_TARGET
} from "../lines/corePromptsText.js";

function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export { BATTLE_ACTION_LABELS, BATTLE_MENU_LABELS };

export function buildRunUnavailableLines() {
  return [...RUN_UNAVAILABLE_LINES];
}

export function buildEnemyBackedDownLine(enemyName) {
  return renderTemplate(ENEMY_BACKED_DOWN_TEMPLATE, { enemyName: enemyName || CORE_DEFAULT_ENEMY_NAME });
}

export function buildEnemyDefeatedLine(enemyName) {
  return renderTemplate(ENEMY_DEFEATED_TEMPLATE, { enemyName: enemyName || CORE_DEFAULT_ENEMY_NAME });
}

export function buildPressEnterContinueLine() {
  return PRESS_ENTER_CONTINUE;
}

export function buildPressEnterContinueBangLine() {
  return PRESS_ENTER_CONTINUE_BANG;
}

export function buildPressEnterToContinuePhaseLine() {
  return PRESS_ENTER_CONTINUE_PHASE;
}

export function buildQuirkyExtraTurnLine() {
  return QUIRKY_EXTRA_TURN;
}

export function buildNoSpecialsAvailableLine() {
  return NO_SPECIALS_AVAILABLE;
}

export function buildNothingHappensLine() {
  return NOTHING_HAPPENS;
}

export function buildNoValidActorLine() {
  return NO_VALID_ACTOR;
}

export function buildNoSpecialSelectedLine() {
  return NO_SPECIAL_SELECTED;
}

export function buildCantUseRightNowLine(actorName) {
  return renderTemplate(CANT_USE_RIGHT_NOW_TEMPLATE, { actorName: actorName || "Actor" });
}

export function buildSpecialCooldownLine(sp) {
  const name = sp?.name || "Special";
  const n = Number(sp?.cooldownRemaining || 0);
  return renderTemplate(SPECIAL_COOLDOWN_TEMPLATE, {
    name,
    n,
    plural: n === 1 ? "" : "s"
  });
}

export function buildNoValidAllyTargetsLine() {
  return NO_VALID_ALLY_TARGETS;
}

export function buildSpecialWrongTargetLine() {
  return SPECIAL_WRONG_TARGET;
}

export function buildInvalidTargetLine() {
  return INVALID_TARGET;
}

export function buildSpecialUsedFallbackLine() {
  return SPECIAL_USED_FALLBACK;
}

export function buildNoItemsMenuLine() {
  return NO_ITEMS_MENU;
}

export function buildNoSpecialsMenuLine() {
  return NO_SPECIALS_MENU;
}
