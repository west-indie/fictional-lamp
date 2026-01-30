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
  const apt = enemy?.actionsPerTurn;

  if (typeof apt === "number") {
    return clamp(Math.floor(apt), 1, 4);
  }

  if (apt && typeof apt === "object") {
    const min = clamp(Math.floor(apt.min ?? 1), 1, 4);
    const max = clamp(Math.floor(apt.max ?? min), min, 4);
    const rolled = min + Math.floor(Math.random() * (max - min + 1));
    return clamp(rolled, 1, 4);
  }

  return 1;
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

function applyPostMitigation(target, rawDamage) {
  let dmg = Math.max(1, Math.round(rawDamage));

  // 1) Damage reduction (e.g. ANIMATION team buff)
  const dr = clamp(getStatusPct(target, "damageReductionPct"), 0, 0.95);
  if (dr > 0) {
    dmg = Math.max(1, Math.round(dmg * (1 - dr)));
  }

  // 2) Shield absorbs damage first (Fantasy, etc.)
  if (target.tempShield && target.tempShield > 0) {
    const absorbed = Math.min(target.tempShield, dmg);
    target.tempShield -= absorbed;
    dmg -= absorbed;

    // If fully absorbed, still return at least 0 damage to HP
    if (dmg <= 0) return 0;
  }

  return dmg;
}

export function runEnemyTurn(enemy, party, { funnyDisrupt = false } = {}) {
  const aliveNow = getAliveParty(party);
  if (aliveNow.length === 0) {
    return { lines: ["Your party has fallen..."], partyDefeated: true };
  }

  // Funny tone disrupts enemy turn (your existing mechanic)
  if (funnyDisrupt) {
    return {
      lines: ["The enemy is thrown off by your party's comedy! Their turn fails."],
      partyDefeated: false
    };
  }

  // ✅ NEW: Stun support (status system writes enemy.statuses.stunTurns)
  // This system does NOT decrement durations; it only checks them.
  const stunTurns = getStatusTurns(enemy, "stunTurns");
  if (stunTurns > 0) {
    return {
      lines: [`${enemy.name} is stunned and can't act!`],
      partyDefeated: false
    };
  }

  const actions = getActionsPerTurn(enemy);
  const moveIds = enemy?.moves || ["basic_attack"];
  const lines = [];

  for (let i = 0; i < actions; i++) {
    const alive = getAliveParty(party);
    if (alive.length === 0) return { lines, partyDefeated: true };

    const target = pickRandomAliveTarget(party);
    if (!target) return { lines, partyDefeated: true };

    const move = pickWeightedMove(moveIds);

    if (move.kind !== "attack") {
      lines.push(`${enemy.name} tries something strange...`);
      continue;
    }

    // ---- Apply NEW SPECIAL SYSTEM MODIFIERS (temporarily) ----
    const originalEnemyAtk = Number(enemy.attack ?? 1) || 1;
    const originalTargetDef = Number(target.def ?? 0) || 0;

    // Apply move multiplier first
    const mult = Number(move.powerMultiplier ?? 1.0) || 1.0;
    let effectiveEnemyAtk = Math.max(1, Math.round(originalEnemyAtk * mult));

    // Enemy ATK debuff from statuses (Comedy/Mystery/etc.)
    const enemyAtkDebuffPct = clamp(getStatusPct(enemy, "atkDebuffPct"), 0, 0.9);
    if (enemyAtkDebuffPct > 0) {
      effectiveEnemyAtk = Math.max(1, Math.round(effectiveEnemyAtk * (1 - enemyAtkDebuffPct)));
    }

    // Target DEF buffs/debuffs from statuses (Comedy/Adventure, Sci-Fi penalty, etc.)
    const defBuffPct = clamp(getStatusPct(target, "defBuffPct"), 0, 2.0);
    const defDebuffPct = clamp(getStatusPct(target, "defDebuffPct"), 0, 0.9);
    const defMultiplier = Math.max(0.1, 1 + defBuffPct - defDebuffPct);
    const effectiveTargetDef = Math.max(0, Math.round(originalTargetDef * defMultiplier));

    // Set temporarily for computeEnemyAttack to read
    enemy.attack = effectiveEnemyAtk;
    target.def = effectiveTargetDef;

    // ---- Compute raw attack ----
    const result = computeEnemyAttack(enemy, target);

    // Restore base stats immediately
    enemy.attack = originalEnemyAtk;
    target.def = originalTargetDef;

    // ---- Post-mitigation: damage reduction + shields ----
    const preHp = target.hp;
    const rawDamage = Number(result.damage ?? 0) || 0;

    const finalDamage = applyPostMitigation(target, rawDamage);

    // Compute final HP ourselves (don’t trust result.newHp after post-mitigation)
    target.hp = Math.max(0, preHp - finalDamage);

    const who = target.movie.title.slice(0, 10);

    if (result.isCrit) {
      lines.push(`${enemy.name} uses ${move.name}! CRITICAL on ${who} for ${finalDamage}!`);
    } else {
      lines.push(`${enemy.name} uses ${move.name} on ${who} for ${finalDamage}.`);
    }

    // Defend message + clear flag
    if (target.isDefending) {
      lines[lines.length - 1] += ` ${who} guarded the blow.`;
      target.isDefending = false;
    }

    if (target.hp <= 0) {
      lines.push(`${who} is knocked out!`);
    }
  }

  return {
    lines,
    partyDefeated: getAliveParty(party).length === 0
  };
}
