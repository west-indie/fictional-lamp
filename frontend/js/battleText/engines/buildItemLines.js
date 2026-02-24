// frontend/js/battleText/buildItemLines.js
//
// Phase 4A: centralized item-action narration (player flow + effect text).

import { toInt } from "./format.js";
import { buildInvalidTargetLine } from "./corePrompts.js";
import { itemDialogue } from "../lines/itemDialogueText.js";
import {
  ITEM_COOLDOWN_TEMPLATE,
  ITEM_DEFAULT_NAME,
  ITEM_FLAG_ATK_BUFF,
  ITEM_FLAG_CRIT_BUFF,
  ITEM_FLAG_DAZED,
  ITEM_FLAG_DEF_BUFF,
  ITEM_FLAG_ENEMY_ACTION_LIMIT,
  ITEM_FLAG_ENEMY_ATK_DOWN,
  ITEM_FLAG_EXTRA_HIT,
  ITEM_NO_EFFECT,
  ITEM_NO_ITEMS,
  ITEM_NONE_SELECTED,
  ITEM_NO_VALID_TARGETS,
  ITEM_RESULT_DAMAGE_TEMPLATE,
  ITEM_RESULT_HEAL_TEMPLATE,
  ITEM_RESULT_NO_EFFECT_TEMPLATE,
  ITEM_RESULT_NOTHING_HAPPENS,
  ITEM_UNAVAILABLE
} from "../lines/itemEngineText.js";

function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function buildNoItemsLine() {
  return ITEM_NO_ITEMS;
}

export function buildItemUnavailableLine() {
  return ITEM_UNAVAILABLE;
}

export function buildItemCooldownLine(itemName, turnsLeft) {
  const name = String(itemName || ITEM_DEFAULT_NAME);
  const turns = Math.max(1, Math.floor(Number(turnsLeft || 1)));
  const suffix = turns === 1 ? "turn" : "turns";
  return renderTemplate(ITEM_COOLDOWN_TEMPLATE, { name, turns, suffix });
}

export function buildItemNoEffectLine() {
  return ITEM_NO_EFFECT;
}

export function buildNoValidItemTargetsLine() {
  return ITEM_NO_VALID_TARGETS;
}

export function buildNoItemSelectedLine() {
  return ITEM_NONE_SELECTED;
}

export function buildInvalidItemTargetLine() {
  return buildInvalidTargetLine();
}

function buildDefaultItemResultLine({ result, target }) {
  const itemName = String(result?.item?.name || "Item");
  const flags = result?.effects || {};
  const who = String(target?.movie?.title || target?.title || target?.name || "Target");

  if (result?.outcome === "heal") {
    const healed = toInt(result?.healedHp, 0);
    let line = renderTemplate(ITEM_RESULT_HEAL_TEMPLATE, { who, healed, itemName });
    if (flags.atkBuffApplied) line += ITEM_FLAG_ATK_BUFF;
    if (flags.defBuffApplied) line += ITEM_FLAG_DEF_BUFF;
    if (flags.critBuffApplied) line += ITEM_FLAG_CRIT_BUFF;
    return line;
  }

  if (result?.outcome === "damage") {
    const dmg = toInt(result?.damageDealt, 0);
    let line = renderTemplate(ITEM_RESULT_DAMAGE_TEMPLATE, { itemName, who, dmg });
    if (flags.extraHitApplied) line += ITEM_FLAG_EXTRA_HIT;
    if (flags.dazedApplied) line += ITEM_FLAG_DAZED;
    if (flags.enemyAtkDebuffApplied) line += ITEM_FLAG_ENEMY_ATK_DOWN;
    if (flags.enemyActionLimitApplied) line += ITEM_FLAG_ENEMY_ACTION_LIMIT;
    return line;
  }

  if (result?.outcome === "noEffect") {
    return renderTemplate(ITEM_RESULT_NO_EFFECT_TEMPLATE, { itemName });
  }

  return ITEM_RESULT_NOTHING_HAPPENS;
}

function resolveCustomItemLines(itemId, outcome) {
  const spec = itemDialogue?.[String(itemId || "")];
  if (!spec) return [];

  if (Array.isArray(spec)) {
    return spec.filter((line) => typeof line === "string" && line.trim());
  }

  if (typeof spec !== "object") return [];

  const outcomeKey = String(outcome || "").trim();
  const fromOutcome = spec?.[outcomeKey];
  if (Array.isArray(fromOutcome)) {
    return fromOutcome.filter((line) => typeof line === "string" && line.trim());
  }

  const fromDefault = spec?.default;
  if (Array.isArray(fromDefault)) {
    return fromDefault.filter((line) => typeof line === "string" && line.trim());
  }

  return [];
}

function applyItemLineTokens(line, { result, target, actor }) {
  const itemName = String(result?.item?.name || "Item");
  const targetName = String(target?.movie?.title || target?.title || target?.name || "Target");
  const actorName = String(actor?.movie?.title || actor?.title || actor?.name || "Actor");
  const healed = toInt(result?.healedHp, 0);
  const damage = toInt(result?.damageDealt, 0);

  return String(line)
    .replaceAll("{item}", itemName)
    .replaceAll("{target}", targetName)
    .replaceAll("{actor}", actorName)
    .replaceAll("{healed}", String(healed))
    .replaceAll("{damage}", String(damage));
}

export function buildItemResultLines({ result, target, actor }) {
  const itemId = result?.item?.id;
  const outcome = result?.outcome;
  const custom = resolveCustomItemLines(itemId, outcome);
  if (custom.length > 0) {
    return custom.map((line) => applyItemLineTokens(line, { result, target, actor }));
  }
  return [buildDefaultItemResultLine({ result, target })];
}

export function buildItemResultLine({ result, target, actor }) {
  return buildItemResultLines({ result, target, actor })[0] || ITEM_RESULT_NOTHING_HAPPENS;
}
