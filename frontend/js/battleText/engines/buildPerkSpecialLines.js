// frontend/js/battleText/buildPerkSpecialLines.js
//
// Centralized narration for perk special execution in battle.js.

import {
  PERK_BLOCKBUSTER_LINE_1,
  PERK_BLOCKBUSTER_LINE_2,
  PERK_CRIT_SUFFIX,
  PERK_CULT_LINE_1,
  PERK_CULT_LINE_2,
  PERK_INVALID_TARGET,
  PERK_NO_ALLY_TARGET,
  PERK_NO_CONTEXT,
  PERK_NO_EFFECT,
  PERK_NO_TARGET,
  PERK_SLEEPER_LINE_1,
  PERK_SLEEPER_LINE_2
} from "../lines/perkSpecialText.js";

function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function buildPerkSpecialNoContextLines() {
  return [PERK_NO_CONTEXT];
}

export function buildPerkSpecialNoTargetLines() {
  return [PERK_NO_TARGET];
}

export function buildPerkSpecialNoAllyTargetLines() {
  return [PERK_NO_ALLY_TARGET];
}

export function buildPerkSpecialInvalidTargetLines() {
  return [PERK_INVALID_TARGET];
}

export function buildPerkSpecialNoEffectLines() {
  return [PERK_NO_EFFECT];
}

export function buildPerkBlockbusterLines({ actorName, specialName, damageDealt, crit }) {
  const actor = String(actorName || "Actor");
  const special = String(specialName || "Special");
  const dmg = Math.max(0, Math.round(Number(damageDealt || 0)));
  return [
    renderTemplate(PERK_BLOCKBUSTER_LINE_1, { actor, special }),
    renderTemplate(PERK_BLOCKBUSTER_LINE_2, { dmg, critSuffix: crit ? PERK_CRIT_SUFFIX : "" })
  ];
}

export function buildPerkCultClassicLines({ actorName, specialName, targetName, shieldAdded }) {
  const actor = String(actorName || "Actor");
  const special = String(specialName || "Special");
  const target = String(targetName || "Target");
  const shield = Math.max(0, Math.round(Number(shieldAdded || 0)));
  return [
    renderTemplate(PERK_CULT_LINE_1, { actor, special, target }),
    renderTemplate(PERK_CULT_LINE_2, { target, shield })
  ];
}

export function buildPerkSleeperHitLines({ actorName, specialName, targetName, healedHp }) {
  const actor = String(actorName || "Actor");
  const special = String(specialName || "Special");
  const target = String(targetName || "Target");
  const heal = Math.max(0, Math.round(Number(healedHp || 0)));
  return [
    renderTemplate(PERK_SLEEPER_LINE_1, { actor, special, target }),
    renderTemplate(PERK_SLEEPER_LINE_2, { target, heal })
  ];
}
