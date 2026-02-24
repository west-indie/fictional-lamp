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
//
// Phase 5 Step 1:
// - Tick functions now return structured events (no narration strings).
// - Existing behavior is preserved if callers ignore return values.

function ensureStatuses(obj) {
  if (!obj) return {};
  if (!obj.statuses) obj.statuses = {};
  return obj.statuses;
}

function pushStatusExpired(events, { side, statusKey, turnsKey }) {
  if (!Array.isArray(events)) return;
  events.push({
    type: "statusExpired",
    side: side || "unknown",
    statusKey: String(statusKey || ""),
    turnsKey: String(turnsKey || "")
  });
}

function tickBuffOrDebuff(statuses, pctKey, turnsKey, events, side) {
  const turns = Number(statuses?.[turnsKey] ?? 0) || 0;
  if (turns <= 0) return;

  const next = Math.max(0, turns - 1);
  statuses[turnsKey] = next;

  if (next === 0) {
    statuses[pctKey] = 0;
    pushStatusExpired(events, { side, statusKey: pctKey, turnsKey });
  }
}

function tickShield(actor) {
  if (!actor) return;
  const s = ensureStatuses(actor);

  // ✅ Barrier rule: shields do NOT expire by turns.
  // They persist until tempShield is fully absorbed.
  // We keep shieldTurns around (if anything sets it) but do not decrement it here.
  // If you want, you can also force it to 0 to avoid “timed shield” narration:
  // s.shieldTurns = 0;
}

function tickDamageReduction(actor, events, side) {
  if (!actor) return;
  const s = ensureStatuses(actor);

  const turns = Number(s.damageReductionTurns ?? 0) || 0;
  if (turns <= 0) return;

  const next = Math.max(0, turns - 1);
  s.damageReductionTurns = next;

  if (next === 0) {
    s.damageReductionPct = 0;
    pushStatusExpired(events, {
      side,
      statusKey: "damageReductionPct",
      turnsKey: "damageReductionTurns"
    });
  }
}

export function tickActorStatuses(actor) {
  const events = [];
  if (!actor) return events;
  const s = ensureStatuses(actor);

  tickBuffOrDebuff(s, "atkBuffPct", "atkBuffTurns", events, "actor");
  tickBuffOrDebuff(s, "atkDebuffPct", "atkDebuffTurns", events, "actor");
  tickBuffOrDebuff(s, "defBuffPct", "defBuffTurns", events, "actor");
  tickBuffOrDebuff(s, "defDebuffPct", "defDebuffTurns", events, "actor");
  tickBuffOrDebuff(s, "critChanceBuffPct", "critChanceBuffTurns", events, "actor");
  tickBuffOrDebuff(s, "critDamageBuffPct", "critDamageBuffTurns", events, "actor");

  tickShield(actor);
  tickDamageReduction(actor, events, "actor");

  return events;
}

export function tickEnemyStatuses(enemy) {
  const events = [];
  if (!enemy) return events;
  const s = ensureStatuses(enemy);

  // Enemy currently only cares about these in your battle.js
  tickBuffOrDebuff(s, "atkDebuffPct", "atkDebuffTurns", events, "enemy");
  tickBuffOrDebuff(s, "defDebuffPct", "defDebuffTurns", events, "enemy");

  // ---- STUN ----
  const stunTurns = Number(s.stunTurns ?? 0) || 0;
  if (stunTurns > 0) {
    const next = Math.max(0, stunTurns - 1);
    s.stunTurns = next;

    // Clean expiry
    if (next === 0) {
      delete s.stunTurns;
      pushStatusExpired(events, {
        side: "enemy",
        statusKey: "stun",
        turnsKey: "stunTurns"
      });
    }
  }

  // ---- DAZED ----
  const dazedTurns = Number(s.dazedTurns ?? 0) || 0;
  if (dazedTurns > 0) {
    const next = Math.max(0, dazedTurns - 1);
    s.dazedTurns = next;

    // Clean expiry
    if (next === 0) {
      delete s.dazedTurns;
      pushStatusExpired(events, {
        side: "enemy",
        statusKey: "dazed",
        turnsKey: "dazedTurns"
      });
    }
  }

  // ---- CONFUSED ----
  // Confusion duration is not turn-based.
  // It persists until enemyTurnSystem clears it via confusion clear-roll logic.

  // ---- ACTION LIMIT ----
  const actionLimitTurns = Number(s.actionLimitTurns ?? 0) || 0;
  if (actionLimitTurns > 0) {
    const next = Math.max(0, actionLimitTurns - 1);
    s.actionLimitTurns = next;

    if (next === 0) {
      delete s.actionLimitTurns;
      delete s.actionLimit;
      pushStatusExpired(events, {
        side: "enemy",
        statusKey: "actionLimit",
        turnsKey: "actionLimitTurns"
      });
    }
  }

  return events;
}
