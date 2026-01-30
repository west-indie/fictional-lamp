// frontend/js/systems/statusTickSystem.js
//
// Centralized status ticking for actors/enemies.
// Keeps battle.js lighter and makes status duration behavior consistent.
//
// This assumes the status schema you already use:
// - atkBuffPct / atkBuffTurns
// - atkDebuffPct / atkDebuffTurns
// - defBuffPct / defBuffTurns
// - defDebuffPct / defDebuffTurns
// - damageReductionPct / damageReductionTurns
// - tempShield + shieldTurns
// - enemy stunTurns
//
// Exports:
// - tickActorStatuses(actor)
// - tickEnemyStatuses(enemy)

function ensureStatuses(obj) {
  if (!obj) return {};
  if (!obj.statuses) obj.statuses = {};
  return obj.statuses;
}

function tickBuffOrDebuff(statuses, pctKey, turnsKey) {
  const turns = Number(statuses?.[turnsKey] ?? 0) || 0;
  if (turns <= 0) return;

  const next = Math.max(0, turns - 1);
  statuses[turnsKey] = next;

  if (next === 0) {
    statuses[pctKey] = 0;
  }
}

function tickShield(actor) {
  if (!actor) return;
  const s = ensureStatuses(actor);

  const turns = Number(s.shieldTurns ?? 0) || 0;
  if (turns <= 0) return;

  const next = Math.max(0, turns - 1);
  s.shieldTurns = next;

  if (next === 0) {
    actor.tempShield = 0;
  }
}

function tickDamageReduction(actor) {
  if (!actor) return;
  const s = ensureStatuses(actor);

  const turns = Number(s.damageReductionTurns ?? 0) || 0;
  if (turns <= 0) return;

  const next = Math.max(0, turns - 1);
  s.damageReductionTurns = next;

  if (next === 0) {
    s.damageReductionPct = 0;
  }
}

export function tickActorStatuses(actor) {
  if (!actor) return;
  const s = ensureStatuses(actor);

  tickBuffOrDebuff(s, "atkBuffPct", "atkBuffTurns");
  tickBuffOrDebuff(s, "atkDebuffPct", "atkDebuffTurns");
  tickBuffOrDebuff(s, "defBuffPct", "defBuffTurns");
  tickBuffOrDebuff(s, "defDebuffPct", "defDebuffTurns");

  tickShield(actor);
  tickDamageReduction(actor);
}

export function tickEnemyStatuses(enemy) {
  if (!enemy) return;
  const s = ensureStatuses(enemy);

  // Enemy currently only cares about these in your battle.js
  tickBuffOrDebuff(s, "atkDebuffPct", "atkDebuffTurns");
  tickBuffOrDebuff(s, "defDebuffPct", "defDebuffTurns");

  const stunTurns = Number(s.stunTurns ?? 0) || 0;
  if (stunTurns > 0) {
    s.stunTurns = Math.max(0, stunTurns - 1);
  }
}
