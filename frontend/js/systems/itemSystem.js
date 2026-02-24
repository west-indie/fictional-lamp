// frontend/js/systems/itemSystem.js

import { items } from "../data/items.js";
import { applyDamage, applyHeal } from "./damageSystem.js";

/**
 * Resolve an inventory entry to an item definition from data/items.js.
 */
function getInventoryItemDef(entry) {
  if (!entry) return null;
  return items[entry.id] || null;
}

function ensureStatuses(target) {
  if (!target) return null;
  if (!target.statuses) target.statuses = {};
  return target.statuses;
}

function applyPctStatus(statuses, pctKey, turnsKey, pct, turns) {
  if (!statuses) return false;
  const value = Number(pct || 0);
  const dur = Math.max(0, Math.floor(Number(turns || 0)));
  if (!(value > 0 && dur > 0)) return false;

  statuses[pctKey] = Math.max(Number(statuses[pctKey] || 0), value);
  statuses[turnsKey] = Math.max(Math.floor(Number(statuses[turnsKey] || 0)), dur);
  return true;
}

function applyEnemyActionLimit(statuses, limit, turns) {
  if (!statuses) return false;
  const capped = Math.max(1, Math.floor(Number(limit || 0)));
  const dur = Math.max(0, Math.floor(Number(turns || 0)));
  if (!(capped > 0 && dur > 0)) return false;

  statuses.actionLimit = capped;
  statuses.actionLimitTurns = Math.max(Math.floor(Number(statuses.actionLimitTurns || 0)), dur);
  return true;
}

function tryApplyDazed(statuses, turns, chance) {
  if (!statuses) return false;
  const dur = Math.max(0, Math.floor(Number(turns || 0)));
  if (dur <= 0) return false;
  const p = chance == null ? 1 : Math.max(0, Math.min(1, Number(chance)));
  if (!(Math.random() < p)) return false;

  statuses.dazedTurns = Math.max(Math.floor(Number(statuses.dazedTurns || 0)), dur);
  return true;
}

function tryApplyConfused(statuses, turns, chance, def) {
  if (!statuses) return false;
  const dur = Math.max(0, Math.floor(Number(turns || 0)));
  if (dur <= 0) return false;
  const p = chance == null ? 1 : Math.max(0, Math.min(1, Number(chance)));
  if (!(Math.random() < p)) return false;

  statuses.confusedTurns = Math.max(Math.floor(Number(statuses.confusedTurns || 0)), dur);
  // Hidden at apply-time; becomes visible only when confusion actually affects a move.
  statuses.confuseTriggered = false;

  const proc = Number(def?.confuseProcChance);
  const clear = Number(def?.confuseClearChance);
  const rampProc = Number(def?.confuseRampProc);
  const rampClear = Number(def?.confuseRampClear);
  if (Number.isFinite(proc)) statuses.confuseProcChance = proc;
  if (Number.isFinite(clear)) statuses.confuseClearChance = clear;
  if (Number.isFinite(rampProc)) statuses.confuseRampProc = rampProc;
  if (Number.isFinite(rampClear)) statuses.confuseRampClear = rampClear;
  return true;
}

function applyItemStatuses(target, def) {
  const statuses = ensureStatuses(target);
  if (!statuses || !def) return { appliedAny: false, effectFlags: {} };

  const effectFlags = {
    atkBuffApplied: false,
    defBuffApplied: false,
    critBuffApplied: false,
    dazedApplied: false,
    confusedApplied: false,
    enemyAtkDebuffApplied: false,
    enemyActionLimitApplied: false,
    extraHitApplied: false
  };

  effectFlags.atkBuffApplied = applyPctStatus(
    statuses,
    "atkBuffPct",
    "atkBuffTurns",
    def.atkBuffPct,
    def.atkBuffTurns
  );

  effectFlags.defBuffApplied = applyPctStatus(
    statuses,
    "defBuffPct",
    "defBuffTurns",
    def.defBuffPct,
    def.defBuffTurns
  );

  const critChanceApplied = applyPctStatus(
    statuses,
    "critChanceBuffPct",
    "critChanceBuffTurns",
    def.critChanceBuffPct,
    def.critChanceBuffTurns
  );
  const critDamageApplied = applyPctStatus(
    statuses,
    "critDamageBuffPct",
    "critDamageBuffTurns",
    def.critDamageBuffPct,
    def.critDamageBuffTurns
  );
  effectFlags.critBuffApplied = critChanceApplied || critDamageApplied;

  effectFlags.dazedApplied = tryApplyDazed(
    statuses,
    def.dazedTurns,
    def.dazedChance
  );

  effectFlags.confusedApplied = tryApplyConfused(
    statuses,
    def.confusedTurns,
    def.confusedChance,
    def
  );

  effectFlags.enemyAtkDebuffApplied = applyPctStatus(
    statuses,
    "atkDebuffPct",
    "atkDebuffTurns",
    def.enemyAtkDebuffPct,
    def.enemyAtkDebuffTurns
  );

  effectFlags.enemyActionLimitApplied = applyEnemyActionLimit(
    statuses,
    def.enemyActionsLimit,
    def.enemyActionsLimitTurns
  );

  const appliedAny = Object.values(effectFlags).some(Boolean);
  return { appliedAny, effectFlags };
}

function rollItemDamage(def) {
  const minRaw = Number(def?.damageMin);
  const maxRaw = Number(def?.damageMax);
  const hasRange = Number.isFinite(minRaw) || Number.isFinite(maxRaw);
  if (!hasRange) return Math.max(0, Number(def?.damage || 0));

  const min = Math.max(0, Math.floor(Number.isFinite(minRaw) ? minRaw : maxRaw));
  const max = Math.max(min, Math.floor(Number.isFinite(maxRaw) ? maxRaw : minRaw));
  if (max === min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Apply an item's effect to an actor.
 *
 * entry: { id, count }
 * actor: { hp, maxHp, movie }
 *
 * Returns:
 * {
 *   used: boolean,        // true if the item was actually consumed
 *   consume: boolean,     // true if inventory count should be decremented
 *   outcome: string,      // "heal" | "damage" | "noEffect" | "none"
 *   healedHp?: number,    // present for heal outcomes
 *   damageDealt?: number, // present for damage outcomes
 *   extraHitDamage?: number, // present when bonus hit occurs
 *   effects?: {...},      // status effect flags for narration/xp hooks
 *   item?: {...}          // the item definition
 * }
 */
export function applyItemToActor(entry, actor, opts = {}) {
  const { beforeHealTarget } = opts;
  const def = getInventoryItemDef(entry);
  if (!def) {
    return {
      used: false,
      consume: false,
      outcome: "none",
      effects: {},
      item: null
    };
  }

  const type = String(def.type || "").trim();
  const healAmount = Math.max(0, Number(def.heal || 0));
  const damageAmount = rollItemDamage(def);
  const isConsumable = def.consumable !== false;

  // Health items (food)
  if ((type === "health" && healAmount > 0) || (!type && healAmount > 0)) {
    if (typeof beforeHealTarget === "function") {
      beforeHealTarget(actor);
    }
    const healed = applyHeal(actor, healAmount);
    const status = applyItemStatuses(actor, def);
    const used = healed > 0 || status.appliedAny;
    return {
      used,
      consume: used && isConsumable,
      outcome: "heal",
      healedHp: healed,
      effects: status.effectFlags,
      item: def
    };
  }

  // Explosives and reusable weapons
  if (
    ((type === "explosive" || type === "reusableWeapon") && damageAmount > 0) ||
    (!type && damageAmount > 0)
  ) {
    const dealt = applyDamage(actor, damageAmount);
    let extraHitDamage = 0;
    const extraHitChance = Math.max(0, Math.min(1, Number(def.extraHitChance || 0)));
    const extraHitMinPct = Math.max(0, Number(def.extraHitMinPct || 0));
    const extraHitMaxPct = Math.max(extraHitMinPct, Number(def.extraHitMaxPct || extraHitMinPct));
    const canExtraHit =
      dealt > 0 &&
      extraHitChance > 0 &&
      extraHitMaxPct > 0 &&
      Math.random() < extraHitChance;
    if (canExtraHit) {
      const rollPct = extraHitMinPct + (Math.random() * (extraHitMaxPct - extraHitMinPct));
      const bonusRaw = Math.max(1, Math.round(dealt * rollPct));
      extraHitDamage = applyDamage(actor, bonusRaw);
    }

    const status = applyItemStatuses(actor, def);
    if (extraHitDamage > 0) status.effectFlags.extraHitApplied = true;
    const totalDamage = dealt + extraHitDamage;
    const used = totalDamage > 0 || status.appliedAny;
    return {
      used,
      consume: used && isConsumable,
      outcome: "damage",
      damageDealt: totalDamage,
      extraHitDamage,
      effects: status.effectFlags,
      item: def
    };
  }

  // Non-healing items can be expanded later
  return {
    used: false,
    consume: false,
    outcome: "noEffect",
    effects: {},
    item: def
  };
}
