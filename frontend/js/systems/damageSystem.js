// frontend/js/systems/damageSystem.js
//
// Replacement: damage calculations that respect statuses applied by the new specials system.
//
// Supports:
// - attacker.statuses.atkBuffPct / atkBuffTurns
// - attacker.statuses.atkDebuffPct / atkDebuffTurns
// - target.statuses.defBuffPct / defBuffTurns
// - target.statuses.defDebuffPct / defDebuffTurns
// - target.statuses.damageReductionPct / damageReductionTurns
// - target.tempShield + target.statuses.shieldTurns
// - enemy.statuses.nextHitVulnActive / nextHitVulnPct / nextHitVulnTurns
//
// Keeps your existing return shapes, but adds absorbedShield for debugging.

export const PLAYER_ATK_MULT = 1.8;
const ENEMY_ATK_MULT = 1.2;
const ENEMY_DEF_MULT = 1;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getActivePct(obj, pctKey) {
  const s = obj?.statuses;
  if (!s) return 0;

  const turnsKey = pctKey.replace("Pct", "Turns");
  const turns = s[turnsKey];

  // If no turns key exists, treat as active (some effects are one-shot markers)
  if (typeof turns === "number" && turns <= 0) return 0;

  return Number(s[pctKey] ?? 0) || 0;
}

function getActiveTurns(obj, turnsKey) {
  const s = obj?.statuses;
  if (!s) return 0;
  const t = Number(s[turnsKey] ?? 0) || 0;
  return Math.max(0, Math.floor(t));
}

function getEffectiveAtk(attacker) {
  const base = Number(attacker?.atk ?? 0) || 0;
  const up = clamp(getActivePct(attacker, "atkBuffPct"), 0, 5);
  const down = clamp(getActivePct(attacker, "atkDebuffPct"), 0, 0.95);
  return Math.max(0, Math.round(base * (1 + up) * (1 - down)));
}

function getEffectiveCritChance(attacker) {
  const base = Math.max(0, Number(attacker?.critChance ?? 0) || 0);
  const up = Math.max(0, getActivePct(attacker, "critChanceBuffPct"));
  return clamp(base + up, 0, 0.95);
}

function getEffectiveCritDamageBonus(attacker) {
  const base = Math.max(0, Number(attacker?.critDamageBonus ?? 0) || 0);
  const up = Math.max(0, getActivePct(attacker, "critDamageBuffPct"));
  return Math.max(0, base + up);
}

function getEffectiveDef(target) {
  const base = Number(target?.def ?? 0) || 0;
  const up = clamp(getActivePct(target, "defBuffPct"), 0, 5);
  const down = clamp(getActivePct(target, "defDebuffPct"), 0, 0.95);
  return Math.max(0, Math.round(base * (1 + up) * (1 - down)));
}

function getEffectiveEnemyDefense(enemy) {
  const base = (Number(enemy?.defense ?? enemy?.def ?? enemy?.defenseStat ?? 0) || 0) * ENEMY_DEF_MULT;
  const up = clamp(getActivePct(enemy, "defBuffPct"), 0, 5);
  const down = clamp(getActivePct(enemy, "defDebuffPct"), 0, 0.95);
  return Math.max(0, Math.round(base * (1 + up) * (1 - down)));
}

function applyDamageReduction(target, dmg) {
  const dr = clamp(getActivePct(target, "damageReductionPct"), 0, 0.95);
  return Math.max(0, Math.round(dmg * (1 - dr)));
}

function applyShield(target, dmg) {
  const shield = Math.max(0, Math.round(Number(target?.tempShield ?? 0) || 0));
  if (shield <= 0 || dmg <= 0) return { remaining: dmg, absorbed: 0 };

  const absorbed = Math.min(shield, dmg);
  target.tempShield = shield - absorbed;

  return { remaining: dmg - absorbed, absorbed };
}

function consumeNextHitVulnIfAny(enemy, dmg) {
  const s = enemy?.statuses;
  if (!s) return dmg;

  const active = !!s.nextHitVulnActive;
  const turns = Number(s.nextHitVulnTurns ?? 0);

  if (!active) return dmg;
  if (typeof s.nextHitVulnTurns === "number" && turns <= 0) {
    s.nextHitVulnActive = false;
    s.nextHitVulnPct = 0;
    return dmg;
  }

  const pct = Math.max(0, Number(s.nextHitVulnPct ?? 0) || 0);
  const out = Math.max(0, Math.round(dmg * (1 + pct)));

  // One-hit consume
  s.nextHitVulnActive = false;
  s.nextHitVulnPct = 0;
  s.nextHitVulnTurns = 0;

  return out;
}

/**
 * Player â†’ Enemy basic attack.
 */
export function computePlayerAttack(attacker, enemy) {
  let attackPower = Math.round(getEffectiveAtk(attacker) * PLAYER_ATK_MULT);
  let isCrit = false;

  if (Math.random() < getEffectiveCritChance(attacker)) {
    const critMult = 1.5 + getEffectiveCritDamageBonus(attacker);
    attackPower = Math.round(attackPower * critMult);
    isCrit = true;
  }

  const baseDamage = attackPower - getEffectiveEnemyDefense(enemy);
  let damage = Math.max(1, baseDamage);

  // Apply next-hit vulnerability (Thriller)
  damage = consumeNextHitVulnIfAny(enemy, damage);

  const beforeHp = enemy.hp;
  const afterHp = clamp(beforeHp - damage, 0, enemy.maxHP ?? beforeHp);
  const killed = afterHp <= 0;

  return {
    damage,
    isCrit,
    killed,
    newHp: afterHp
  };
}

/**
 * Enemy â†’ Player basic attack.
 */
export function computeEnemyAttack(enemy, target) {
  const enemyAtk = Math.round((Number(enemy?.attack ?? 0) || 0) * ENEMY_ATK_MULT);
  const targetDef = getEffectiveDef(target);

  let baseDamage = enemyAtk - targetDef;
  let isCrit = false;

  // Defend halves incoming damage (your existing behavior)
  if (target.isDefending) {
    const defendMult = Math.max(0.2, Math.min(0.9, Number(target.defendDamageMult || 0.5)));
    baseDamage = Math.floor(baseDamage * defendMult);
  }

  if (Math.random() < (enemy.critChance || 0)) {
    baseDamage = Math.round(baseDamage * 1.5);
    isCrit = true;
  }

  // Prevent extreme DEF stacking from reducing enemy hits to perpetual chip.
  const minDamageFloor = Math.max(1, Math.ceil(enemyAtk * 0.15));
  let damage = Math.max(minDamageFloor, baseDamage);

  // âœ… DAZED: softer control â€” reduced hit (miss chance is handled in enemyTurnSystem)
  const dazedTurns = getActiveTurns(enemy, "dazedTurns");
  if (dazedTurns > 0) {
    damage = Math.max(1, Math.round(damage * 0.75)); // tuneable: 0.75 = 25% weaker hit
  }

  // Team damage reduction (Animation, etc.)
  damage = applyDamageReduction(target, damage);

  // Shield absorbs before HP
  const shieldResult = applyShield(target, damage);
  const toHp = shieldResult.remaining;
  const absorbedShield = shieldResult.absorbed;

  const beforeHp = target.hp;
  const afterHp = clamp(beforeHp - toHp, 0, target.maxHp ?? beforeHp);
  const killed = afterHp <= 0;

  return {
    damage: beforeHp - afterHp, // report actual HP loss (shield absorption excluded)
    absorbedShield,
    isCrit,
    killed,
    newHp: afterHp
  };
}

export function applyDamage(target, amount) {
  const before = target.hp;
  const after = clamp(before - amount, 0, target.maxHp ?? before);
  target.hp = after;
  return before - after;
}

export function applyHeal(target, amount) {
  const before = target.hp;
  const after = clamp(before + amount, 0, target.maxHp ?? before);
  target.hp = after;
  return after - before;
}

