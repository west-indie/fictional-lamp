// frontend/js/systems/enemyTurnSystem.js
//
// Replacement: supports the NEW specials system status effects.
//
// Implements:
// - Enemy ATK debuffs (e.g., Comedy/Mystery/Crime/Documentary) via enemy.statuses.atkDebuffPct
// - Party DEF buffs/debuffs via target.statuses.defBuffPct / target.statuses.defDebuffPct
// - Team/actor damage reduction via target.statuses.damageReductionPct
// - Temporary shields via target.tempShield
// - NEW: generic STATUS support (e.g., stun) via enemy.statuses.stunTurns
//
// NOTE:
// This file does not decrement status durations. (You’ll tick turns elsewhere—typically at the
// start of each actor’s turn or at round boundaries.) This only *applies* the current modifiers.

import { enemyMoves } from "../data/enemyMoves.js";
import { computeEnemyAttack } from "./damageSystem.js";
import { getAliveParty } from "./turnSystem.js";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toIntOrNull(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.floor(v);
}

function getFallbackMove() {
  return (
    enemyMoves.basic_attack || {
      id: "basic_attack",
      name: "Attack",
      kind: "attack",
      powerMultiplier: 1.0,
      weight: 1
    }
  );
}

function pickWeightedMove(moveIds) {
  const defs = (moveIds || []).map((id) => enemyMoves[id]).filter(Boolean);
  if (defs.length === 0) return getFallbackMove();

  const total = defs.reduce((sum, m) => sum + (m.weight ?? 1), 0);
  let roll = Math.random() * total;

  for (const m of defs) {
    roll -= (m.weight ?? 1);
    if (roll <= 0) return m;
  }

  return defs[defs.length - 1] || getFallbackMove();
}

function getActionsPerTurn(enemy) {
  // Support enemies.js authoring where `moves: <number>` means action count.
  const statusLimit = toIntOrNull(enemy?.statuses?.actionLimit);
  const statusLimitTurns = toIntOrNull(enemy?.statuses?.actionLimitTurns);
  const hasStatusLimit = statusLimit != null && statusLimit > 0 && statusLimitTurns != null && statusLimitTurns > 0;

  const movesCount = toIntOrNull(enemy?.moves);
  if (movesCount != null) {
    const base = clamp(movesCount, 1, 12);
    return hasStatusLimit ? Math.max(1, Math.min(base, statusLimit)) : base;
  }

  const apt = enemy?.actionsPerTurn;
  const aptNum = toIntOrNull(apt);

  if (aptNum != null) {
    const base = clamp(aptNum, 1, 12);
    return hasStatusLimit ? Math.max(1, Math.min(base, statusLimit)) : base;
  }

  if (apt && typeof apt === "object") {
    const min = clamp(Math.floor(apt.min ?? 1), 1, 12);
    const max = clamp(Math.floor(apt.max ?? min), min, 12);
    const rolled = min + Math.floor(Math.random() * (max - min + 1));
    const base = clamp(rolled, 1, 12);
    return hasStatusLimit ? Math.max(1, Math.min(base, statusLimit)) : base;
  }

  const base = 1;
  return hasStatusLimit ? Math.max(1, Math.min(base, statusLimit)) : base;
}

function getMoveIds(enemy) {
  if (Array.isArray(enemy?.moves) && enemy.moves.length > 0) return enemy.moves;
  return ["basic_attack"];
}

function pickRandomAliveTarget(party) {
  const alive = getAliveParty(party);
  if (alive.length === 0) return null;
  return alive[Math.floor(Math.random() * alive.length)];
}

function getStatusPct(obj, key) {
  // status keys used by specialSystem.js:
  // - atkDebuffPct / atkDebuffTurns
  // - defBuffPct / defBuffTurns
  // - defDebuffPct / defDebuffTurns
  // - damageReductionPct / damageReductionTurns
  const s = obj?.statuses;
  if (!s) return 0;

  const turnsKey = key.replace("Pct", "Turns");
  const turns = s[turnsKey];

  // If turns exist and are 0 or less, treat as expired.
  if (typeof turns === "number" && turns <= 0) return 0;

  return Number(s[key] ?? 0) || 0;
}

function getStatusTurns(obj, turnsKey) {
  const s = obj?.statuses;
  if (!s) return 0;
  const t = Number(s[turnsKey] ?? 0) || 0;
  return Math.max(0, Math.floor(t));
}

function cloneCombatantForSim(c) {
  if (!c) return c;
  return {
    ...c,
    statuses: c.statuses ? { ...c.statuses } : undefined,
    movie: c.movie ? { ...c.movie } : c.movie
  };
}

function getConfusionSettings(enemy) {
  const s = enemy?.statuses || {};
  const procChanceRaw = Number(s.confuseProcChance);
  const clearChanceRaw = Number(s.confuseClearChance);
  const rampProcRaw = Number(s.confuseRampProc);
  const rampClearRaw = Number(s.confuseRampClear);
  return {
    procChance: clamp(Number.isFinite(procChanceRaw) ? procChanceRaw : 0.35, 0, 1),
    clearChance: clamp(Number.isFinite(clearChanceRaw) ? clearChanceRaw : 0.25, 0, 1),
    rampProc: clamp(Number.isFinite(rampProcRaw) ? rampProcRaw : 0.1, 0, 1),
    rampClear: clamp(Number.isFinite(rampClearRaw) ? rampClearRaw : 0.1, 0, 1),
    triggered: !!s.confuseTriggered
  };
}

function setConfusionState(enemy, { procChance, clearChance, triggered }) {
  if (!enemy) return;
  if (!enemy.statuses) enemy.statuses = {};
  enemy.statuses.confuseProcChance = clamp(Number(procChance || 0), 0, 1);
  enemy.statuses.confuseClearChance = clamp(Number(clearChance || 0), 0, 1);
  enemy.statuses.confuseTriggered = !!triggered;
}

function clearConfusionState(enemy) {
  if (!enemy?.statuses) return;
  delete enemy.statuses.confusedTurns;
  delete enemy.statuses.confuseTriggered;
  delete enemy.statuses.confuseProcChance;
  delete enemy.statuses.confuseClearChance;
  delete enemy.statuses.confuseRampProc;
  delete enemy.statuses.confuseRampClear;
}

function applyPlannedHitEvent(evt, party) {
  if (!evt || evt.type !== "enemyAttackHit") return;
  if (!Array.isArray(party)) return;

  const idx = Number(evt.targetIndex);
  if (!Number.isFinite(idx) || idx < 0 || idx >= party.length) return;

  const target = party[idx];
  if (!target) return;

  target.hp = Number(evt.newHp ?? target.hp ?? 0);
  if (typeof evt.newTempShield === "number") {
    target.tempShield = Math.max(0, Math.round(evt.newTempShield));
  }
  if (evt.consumeDefend) target.isDefending = false;
}

export function runEnemyTurn(enemy, party, { funnyDisrupt = false, deferApply = false } = {}) {
  const ENEMY_ACTION_BUFF_MULT = 1.1;
  const aliveNow = getAliveParty(party);
  if (aliveNow.length === 0) {
    return { events: [], partyDefeated: true };
  }

  // Funny tone disrupts enemy turn (your existing mechanic)
  if (funnyDisrupt) {
    return {
      events: [{ type: "turnDisruptedFunny" }],
      partyDefeated: false
    };
  }

  // ✅ NEW: Stun support (status system writes enemy.statuses.stunTurns)
  // This system does NOT decrement durations; it only checks them.
  const stunTurns = getStatusTurns(enemy, "stunTurns");
  if (stunTurns > 0) {
    return {
      events: [{ type: "enemyStunnedSkip", enemyName: enemy?.name || "The enemy" }],
      partyDefeated: false
    };
  }

  // ✅ NEW: Dazed support (enemy can act, but is less accurate + hits softer)
  // - Miss chance is handled here
  // - Reduced hit is applied by scaling enemy's effective ATK before computeEnemyAttack()
  const dazedTurns = getStatusTurns(enemy, "dazedTurns");
  const isDazed = dazedTurns > 0;

  // Tunables (keep here for Phase 3; can move to constants later)
  const DAZED_MISS_CHANCE = 0.35; // 35% chance to miss while dazed
  const DAZED_DAMAGE_MULT = 0.75; // 25% reduced hit while dazed
  const confusedTurns = getStatusTurns(enemy, "confusedTurns");
  const isConfused = confusedTurns > 0;
  let confusion = getConfusionSettings(enemy);

  const actions = getActionsPerTurn(enemy);
  const moveIds = getMoveIds(enemy);
  const events = [];
  const realEnemy = enemy;
  const simEnemy = cloneCombatantForSim(enemy);
  const simParty = (party || []).map((m, i) => {
    const sim = cloneCombatantForSim(m);
    if (sim) sim.__realIndex = i;
    return sim;
  });

  for (let i = 0; i < actions; i++) {
    const alive = getAliveParty(simParty);
    if (alive.length === 0) return { events, partyDefeated: true };

    const targetSim = pickRandomAliveTarget(simParty);
    if (!targetSim) return { events, partyDefeated: true };
    const targetIndex = Number(targetSim.__realIndex);

    const move = pickWeightedMove(moveIds);

    if (move.kind !== "attack") {
      events.push({ type: "enemyMoveUnknown", enemyName: enemy?.name || "The enemy" });
      continue;
    }

    // Confusion remains hidden until it first affects an action.
    if (isConfused) {
      const procRoll = Math.random();
      if (procRoll < confusion.procChance) {
        confusion.triggered = true;
        const behaviorRoll = Math.random();

        if (behaviorRoll < 0.34) {
          events.push({
            type: "enemyConfusedMisfire",
            enemyName: enemy?.name || "The enemy",
            moveName: move?.name || "Attack"
          });
          confusion.procChance = clamp(confusion.procChance + confusion.rampProc, 0, 0.98);
          confusion.clearChance = clamp(confusion.clearChance + confusion.rampClear, 0, 0.98);
          if (Math.random() < confusion.clearChance) {
            clearConfusionState(simEnemy);
            events.push({
              type: "enemyConfusionCleared",
              enemyName: enemy?.name || "The enemy"
            });
            confusion = getConfusionSettings(simEnemy);
          } else {
            setConfusionState(simEnemy, confusion);
          }
          continue;
        }

        if (behaviorRoll < 0.67) {
          const beforeHp = Math.max(0, Number(simEnemy.hp ?? enemy?.hp ?? 0));
          const baseMaxHp = simEnemy.maxHP ?? simEnemy.maxHp ?? enemy?.maxHP ?? enemy?.maxHp ?? beforeHp;
          const maxHp = Math.max(1, Number(baseMaxHp || 1));
          const healAmt = Math.max(1, Math.round(maxHp * 0.1));
          const afterHp = Math.min(maxHp, beforeHp + healAmt);
          simEnemy.hp = afterHp;
          events.push({
            type: "enemyConfusedSelfHeal",
            enemyName: enemy?.name || "The enemy",
            healed: Math.max(0, afterHp - beforeHp)
          });
          confusion.procChance = clamp(confusion.procChance + confusion.rampProc, 0, 0.98);
          confusion.clearChance = clamp(confusion.clearChance + confusion.rampClear, 0, 0.98);
          if (Math.random() < confusion.clearChance) {
            clearConfusionState(simEnemy);
            events.push({
              type: "enemyConfusionCleared",
              enemyName: enemy?.name || "The enemy"
            });
            confusion = getConfusionSettings(simEnemy);
          } else {
            setConfusionState(simEnemy, confusion);
          }
          continue;
        }

        // Low-accuracy mode: the move can still happen, but is much more likely to miss.
        const LOW_ACC_MISS_CHANCE = 0.65;
        if (Math.random() < LOW_ACC_MISS_CHANCE) {
          events.push({
            type: "enemyConfusedWildMiss",
            enemyName: enemy?.name || "The enemy",
            moveName: move?.name || "Attack"
          });
          confusion.procChance = clamp(confusion.procChance + confusion.rampProc, 0, 0.98);
          confusion.clearChance = clamp(confusion.clearChance + confusion.rampClear, 0, 0.98);
          if (Math.random() < confusion.clearChance) {
            clearConfusionState(simEnemy);
            events.push({
              type: "enemyConfusionCleared",
              enemyName: enemy?.name || "The enemy"
            });
            confusion = getConfusionSettings(simEnemy);
          } else {
            setConfusionState(simEnemy, confusion);
          }
          continue;
        }

        events.push({
          type: "enemyConfusedLowAccuracyHit",
          enemyName: enemy?.name || "The enemy",
          moveName: move?.name || "Attack"
        });
        confusion.procChance = clamp(confusion.procChance + confusion.rampProc, 0, 0.98);
        confusion.clearChance = clamp(confusion.clearChance + confusion.rampClear, 0, 0.98);
        if (Math.random() < confusion.clearChance) {
          clearConfusionState(simEnemy);
          events.push({
            type: "enemyConfusionCleared",
            enemyName: enemy?.name || "The enemy"
          });
          confusion = getConfusionSettings(simEnemy);
        } else {
          setConfusionState(simEnemy, confusion);
        }
      }
    }

    // ✅ If dazed, enemy may miss entirely
    if (isDazed && Math.random() < DAZED_MISS_CHANCE) {
      events.push({
        type: "enemyMissDazed",
        enemyName: enemy?.name || "The enemy",
        moveName: move?.name || "Attack"
      });
      continue;
    }

    // ---- Apply NEW SPECIAL SYSTEM MODIFIERS (temporarily) ----
    const originalEnemyAtk = Number(simEnemy.attack ?? 1) || 1;
    const originalTargetDef = Number(targetSim.def ?? 0) || 0;

    // Apply move multiplier first
    const mult = Number(move.powerMultiplier ?? 1.0) || 1.0;
    let effectiveEnemyAtk = Math.max(1, Math.round(originalEnemyAtk * mult * ENEMY_ACTION_BUFF_MULT));

    // Enemy ATK debuff from statuses (Comedy/Mystery/etc.)
    const enemyAtkDebuffPct = clamp(getStatusPct(simEnemy, "atkDebuffPct"), 0, 0.9);
    if (enemyAtkDebuffPct > 0) {
      effectiveEnemyAtk = Math.max(1, Math.round(effectiveEnemyAtk * (1 - enemyAtkDebuffPct)));
    }

    // ✅ Dazed reduces the hit (softer control than stun)
    if (isDazed) {
      effectiveEnemyAtk = Math.max(1, Math.round(effectiveEnemyAtk * DAZED_DAMAGE_MULT));
    }

    // Target DEF buffs/debuffs from statuses (Comedy/Adventure, Sci-Fi penalty, etc.)
    const defBuffPct = clamp(getStatusPct(targetSim, "defBuffPct"), 0, 2.0);
    const defDebuffPct = clamp(getStatusPct(targetSim, "defDebuffPct"), 0, 0.9);
    const defMultiplier = Math.max(0.1, 1 + defBuffPct - defDebuffPct);
    const effectiveTargetDef = Math.max(0, Math.round(originalTargetDef * defMultiplier));

    // Set temporarily for computeEnemyAttack to read
    simEnemy.attack = effectiveEnemyAtk;
    targetSim.def = effectiveTargetDef;

    // ---- Compute attack (includes DR + shield absorption in damageSystem) ----
    const result = computeEnemyAttack(simEnemy, targetSim);

    // Restore base stats immediately
    simEnemy.attack = originalEnemyAtk;
    targetSim.def = originalTargetDef;

    // Accept result in simulation state
    targetSim.hp = result.newHp;

    const finalDamage = Number(result.damage ?? 0) || 0;
    const absorbedShield = Number(result.absorbedShield ?? 0) || 0;
    const who =
      (targetSim?.movie?.title || targetSim?.movie?.shortTitle || targetSim?.name || "target");
    const guarded = Boolean(targetSim.isDefending);
    const newTempShield = Math.max(0, Math.round(Number(targetSim.tempShield ?? 0) || 0));
    const consumeDefend = guarded;

    const hitEvent = {
      type: "enemyAttackHit",
      enemyName: enemy?.name || "The enemy",
      moveName: move?.name || "Attack",
      targetName: who,
      damage: finalDamage,
      absorbedShield,
      isMortal: Boolean(result.killed),
      isCrit: Boolean(result.isCrit),
      guarded,
      targetIndex,
      newHp: Number(result.newHp ?? 0),
      newTempShield,
      consumeDefend
    };
    events.push(hitEvent);

    if (!deferApply) {
      applyPlannedHitEvent(hitEvent, party);
    }

    // Defend message + clear flag in simulation
    if (targetSim.isDefending) {
      targetSim.isDefending = false;
    }

    // KO is now represented by the rolling counter reaching 0; do not emit immediate KO event here.
  }

  // Restore enemy object if anything changed it outside simulation.
  if (realEnemy && simEnemy) {
    realEnemy.attack = Number(realEnemy.attack ?? simEnemy.attack ?? 0);
    if (Number.isFinite(Number(simEnemy.hp))) realEnemy.hp = Number(simEnemy.hp);
    if (simEnemy.statuses) realEnemy.statuses = { ...simEnemy.statuses };
  }

  return {
    events,
    partyDefeated: getAliveParty(simParty).length === 0
  };
}

