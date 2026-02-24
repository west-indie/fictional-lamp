// frontend/js/systems/xpSystem.js

import { items } from "../data/items.js";

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

const ACTION_XP_MULTIPLIER = 3.2;
const CONFIRM_HOLD_XP_MULTIPLIER = 0.8;
const DOWNED_XP_MULTIPLIER = 0.5;
const PLAYER_LEVEL_HP_GROWTH = 0.31;
const PLAYER_LEVEL_ATK_GROWTH = 0.22;
const PLAYER_LEVEL_DEF_GROWTH = 0.25;
const BONUS_XP_DAMAGE_50 = 10;
const BONUS_XP_HEAL_50 = 10;
const BONUS_XP_TEAM_HEAL_200 = 25;
const BONUS_XP_SPECIAL_DAMAGE_75 = 15;
const HIGH_IMPACT_ITEM_DAMAGE_THRESHOLD = 50;
const HIGH_IMPACT_ITEM_BACK_TO_BACK_MULT = 0.7;
const HIGH_IMPACT_ITEM_THIRD_PLUS_MULT = 0.5;

function actorKey(actor, fallback = "unknown") {
  return actor?.movie?.id || actor?.name || fallback;
}

function ensureMetric(metricsByActor, actor) {
  const key = actorKey(actor);
  if (!metricsByActor[key]) {
    metricsByActor[key] = {
      key,
      actorRef: actor || null,
      damage: 0,
      heal: 0,
      mitigation: 0,
      utility: 0,
      actions: 0,
      lowImpactActions: 0,
      highImpactActions: 0
    };
  } else if (!metricsByActor[key].actorRef && actor) {
    metricsByActor[key].actorRef = actor;
  }
  return metricsByActor[key];
}

function safeNumber(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function hasAnyMeaningfulEffect(effects) {
  if (!effects || typeof effects !== "object") return false;
  return (
    safeNumber(effects.damageDealt) > 0 ||
    safeNumber(effects.teamDmg) > 0 ||
    safeNumber(effects.healedHp) > 0 ||
    safeNumber(effects.teamHeal) > 0 ||
    safeNumber(effects.shieldAdded) > 0 ||
    safeNumber(effects.shield) > 0 ||
    !!effects.revived ||
    safeNumber(effects.revivedCount) > 0 ||
    !!effects.teamRevive ||
    !!effects.statusApplied ||
    !!effects.anyDebuff ||
    !!effects.atkBuffApplied ||
    !!effects.defBuffApplied ||
    !!effects.teamAtkBuffApplied ||
    !!effects.teamDefBuffApplied ||
    !!effects.damageReductionApplied ||
    !!effects.nextHitVulnApplied ||
    safeNumber(effects.atkBuffPct) > 0 ||
    safeNumber(effects.defBuffPct) > 0 ||
    safeNumber(effects.enemyAtkDebuffPct) > 0 ||
    safeNumber(effects.enemyDefDebuffPct) > 0
  );
}

function lowImpactSpecialRepeatMultiplier(repeatCount) {
  // Slow diminishing returns for repeated low-impact identical specials.
  return Math.max(0.7, 1 - (repeatCount * 0.035));
}

function applyStallPattern(tracker, pattern) {
  if (!tracker) return;
  if (tracker.lastLowImpactPattern === pattern) {
    tracker.stallChain += 1;
  } else {
    tracker.stallChain = 1;
    tracker.lastLowImpactPattern = pattern;
  }
  // Repeated low-impact chains apply a gradually stronger stall penalty.
  tracker.stallPenaltyUnits += Math.min(0.03, 0.008 + tracker.stallChain * 0.002);
}

function getThreatScore(enemySnapshot, enemyLive) {
  const maxHp = safeNumber(enemySnapshot?.maxHp || enemyLive?.maxHP || enemyLive?.hp || 0);
  const atk = safeNumber(enemySnapshot?.attack || enemyLive?.attack || 0);
  const level = safeNumber(enemySnapshot?.level || enemyLive?.level || 1);
  return Math.max(10, 20 + (maxHp * 0.25) + (atk * 3) + (level * 8));
}

function xpToNextLevel(level) {
  const L = Math.max(1, Math.floor(safeNumber(level) || 1));
  return 60 + (18 * L) + (8 * L * L);
}

export function getXpToNextLevel(level) {
  return xpToNextLevel(level);
}

function normalizedMetricShare(metrics, key) {
  const total = metrics.reduce((acc, m) => acc + Math.max(0, safeNumber(m[key])), 0);
  if (total <= 0) {
    const equal = metrics.length > 0 ? (1 / metrics.length) : 0;
    return metrics.map(() => equal);
  }
  return metrics.map((m) => Math.max(0, safeNumber(m[key])) / total);
}

function getItemTypeById(itemId) {
  if (!itemId) return "";
  const def = items?.[String(itemId)] || null;
  return String(def?.type || "").toLowerCase();
}

function isHighImpactDamageItemEvent(event = {}) {
  const dmg = Math.max(0, safeNumber(event.damageDealt));
  const itemType = getItemTypeById(event.itemId);
  const isDamageItem = itemType === "explosive" || itemType === "reusableweapon";
  return isDamageItem && dmg >= HIGH_IMPACT_ITEM_DAMAGE_THRESHOLD;
}

export function createBattleXpTracker({ party = [], enemy = null } = {}) {
  const enemyMaxHp = safeNumber(enemy?.maxHP || enemy?.hp || 0);
  const enemyAtk = safeNumber(enemy?.attack || 0);
  const enemyLevel = safeNumber(enemy?.level || 1);

  const metricsByActor = {};
  for (const actor of party) ensureMetric(metricsByActor, actor);

  return {
    startedAtMs: Date.now(),
    enemySnapshot: {
      maxHp: enemyMaxHp,
      attack: enemyAtk,
      level: enemyLevel
    },
    metricsByActor,
    enemyPhases: 0,
    incomingDamage: 0,
    absorbedShield: 0,
    lowHpMoments: 0,
    allyDownMoments: 0,
    totalPlayerActions: 0,
    lowImpactActions: 0,
    highImpactActions: 0,
    stallChain: 0,
    stallPenaltyUnits: 0,
    lastLowImpactPattern: null,
    specialLowImpactRepeats: {},
    actionXpByActor: {},
    actionXpBudget: 0,
    highImpactItemCountInPlayerTurn: 0,
    lastActionWasHighImpactItem: false
  };
}

export function recordBattleXpEvent(tracker, event = {}) {
  if (!tracker || !event || typeof event !== "object") return null;

  const type = String(event.type || "");

  if (type === "enemyPhaseStart") {
    tracker.enemyPhases += 1;
    tracker.highImpactItemCountInPlayerTurn = 0;
    tracker.lastActionWasHighImpactItem = false;
    return null;
  }

  if (type === "enemyHit") {
    tracker.incomingDamage += Math.max(0, safeNumber(event.damage));
    tracker.absorbedShield += Math.max(0, safeNumber(event.absorbedShield));
    if (event.lowHpMoment) tracker.lowHpMoments += 1;
    if (event.allyDowned) tracker.allyDownMoments += 1;
    if (event.guardedCrit) {
      const m = ensureMetric(tracker.metricsByActor, event.actor);
      m.mitigation += 8;
      m.utility += 3;
    }
    return null;
  }

  const actor = event.actor;
  if (!actor) return null;
  const isConfirmHeld = !!event.confirmHeld;
  const holdXpMultiplier = isConfirmHeld ? CONFIRM_HOLD_XP_MULTIPLIER : 1;
  const m = ensureMetric(tracker.metricsByActor, actor);
  let deltaDamage = 0;
  let deltaHeal = 0;
  let deltaMitigation = 0;
  let deltaUtility = 0;

  if (type === "attack") {
    const effectiveDamage = Math.max(0, safeNumber(event.effectiveDamage));
    m.damage += effectiveDamage;
    deltaDamage = effectiveDamage;
    m.actions += 1;
    tracker.totalPlayerActions += 1;

    if (!isConfirmHeld) {
      if (effectiveDamage > 0) {
        m.highImpactActions += 1;
        tracker.highImpactActions += 1;
        tracker.stallChain = Math.max(0, tracker.stallChain - 1);
        tracker.lastLowImpactPattern = null;
      } else {
        m.lowImpactActions += 1;
        tracker.lowImpactActions += 1;
        applyStallPattern(tracker, "attack:0");
      }
    }
    const thresholdBonus = effectiveDamage >= 50 ? BONUS_XP_DAMAGE_50 : 0;
    const base = (deltaDamage * 0.30) + thresholdBonus;
    const scaled = base * ACTION_XP_MULTIPLIER * holdXpMultiplier;
    tracker.lastActionWasHighImpactItem = false;
    tracker.actionXpByActor[actorKey(actor)] = safeNumber(tracker.actionXpByActor[actorKey(actor)]) + scaled;
    tracker.actionXpBudget += scaled;
    return {
      actorKey: actorKey(actor),
      debugXp: Number(scaled.toFixed(1))
    };
  }

  if (type === "defend") {
    m.mitigation += 5;
    m.utility += 2;
    deltaMitigation = 5;
    deltaUtility = 2;
    m.actions += 1;
    tracker.totalPlayerActions += 1;
    if (!isConfirmHeld) {
      m.lowImpactActions += 1;
      tracker.lowImpactActions += 1;
      applyStallPattern(tracker, "defend");
    }
    const base = (deltaMitigation * 0.20 + deltaUtility * 0.30);
    const scaled = base * ACTION_XP_MULTIPLIER * holdXpMultiplier;
    tracker.lastActionWasHighImpactItem = false;
    tracker.actionXpByActor[actorKey(actor)] = safeNumber(tracker.actionXpByActor[actorKey(actor)]) + scaled;
    tracker.actionXpBudget += scaled;
    return {
      actorKey: actorKey(actor),
      debugXp: Number(scaled.toFixed(1))
    };
  }

  if (type === "item") {
    const damage = Math.max(0, safeNumber(event.damageDealt));
    const healed = Math.max(0, safeNumber(event.healedHp));
    m.damage += damage;
    m.heal += healed;
    deltaDamage = damage;
    deltaHeal = healed;
    const util = healed > 0 ? Math.min(8, healed * 0.08) : 0;
    m.utility += util;
    deltaUtility = util;
    m.actions += 1;
    tracker.totalPlayerActions += 1;

    if (!isConfirmHeld) {
      if (healed > 0 || damage > 0) {
        m.highImpactActions += 1;
        tracker.highImpactActions += 1;
        tracker.stallChain = Math.max(0, tracker.stallChain - 1);
        tracker.lastLowImpactPattern = null;
      } else {
        m.lowImpactActions += 1;
        tracker.lowImpactActions += 1;
        applyStallPattern(tracker, `item:${String(event.itemName || "unknown").toLowerCase()}`);
      }
    }
    const thresholdDamageBonus = damage >= 50 ? BONUS_XP_DAMAGE_50 : 0;
    const thresholdHealBonus = healed >= 50 ? BONUS_XP_HEAL_50 : 0;
    const thresholdTeamHealBonus = healed >= 200 ? BONUS_XP_TEAM_HEAL_200 : 0;
    const thresholdBonus = thresholdDamageBonus + thresholdHealBonus + thresholdTeamHealBonus;

    const isHighImpactItem = isHighImpactDamageItemEvent(event);
    const nextCount = isHighImpactItem
      ? (Math.max(0, Math.floor(Number(tracker.highImpactItemCountInPlayerTurn || 0))) + 1)
      : Math.max(0, Math.floor(Number(tracker.highImpactItemCountInPlayerTurn || 0)));
    const backToBackTrigger = isHighImpactItem && !!tracker.lastActionWasHighImpactItem;
    const thirdPlusTrigger = isHighImpactItem && nextCount >= 3;
    let itemChainMult = 1;
    if (thirdPlusTrigger) itemChainMult = HIGH_IMPACT_ITEM_THIRD_PLUS_MULT;
    else if (backToBackTrigger) itemChainMult = HIGH_IMPACT_ITEM_BACK_TO_BACK_MULT;

    const base = (deltaDamage * 0.30 + deltaHeal * 0.20 + deltaUtility * 0.30 + thresholdBonus);
    const scaled = base * ACTION_XP_MULTIPLIER * holdXpMultiplier * itemChainMult;
    if (isHighImpactItem) tracker.highImpactItemCountInPlayerTurn = nextCount;
    tracker.lastActionWasHighImpactItem = isHighImpactItem;
    tracker.actionXpByActor[actorKey(actor)] = safeNumber(tracker.actionXpByActor[actorKey(actor)]) + scaled;
    tracker.actionXpBudget += scaled;
    return {
      actorKey: actorKey(actor),
      debugXp: Number(scaled.toFixed(1))
    };
  }

  if (type === "special") {
    const sp = event.special || {};
    const effects = event.effects || {};

    const damage = Math.max(0, safeNumber(effects.damageDealt) + safeNumber(effects.teamDmg) + safeNumber(effects.dmg));
    const healed = Math.max(0, safeNumber(effects.healedHp) + safeNumber(effects.teamHeal) + safeNumber(effects.heal));
    const shield = Math.max(0, safeNumber(effects.shieldAdded) + safeNumber(effects.shield));
    const utilityMult = Math.max(0.5, safeNumber(actor?.utilityPower || 1));
    const utilityFromFlags =
      (effects.revived ? 16 : 0) +
      (effects.teamRevive ? 12 : 0) +
      (safeNumber(effects.revivedCount) * 8) +
      (effects.statusApplied ? 5 : 0) +
      (effects.anyDebuff ? 4 : 0) +
      (effects.atkBuffApplied || effects.defBuffApplied ? 3 : 0) +
      (effects.teamAtkBuffApplied || effects.teamDefBuffApplied ? 5 : 0) +
      (effects.damageReductionApplied ? 5 : 0) +
      (effects.nextHitVulnApplied ? 4 : 0);

    let utilityValue = (utilityFromFlags + (shield * 0.12)) * utilityMult;
    m.damage += damage;
    m.heal += healed;
    m.mitigation += shield * 0.2;
    deltaDamage = damage;
    deltaHeal = healed;
    deltaMitigation = shield * 0.2;

    const meaningful = hasAnyMeaningfulEffect(effects);
    const specialLabel = String(sp?.name || sp?.label || sp?.id || "special").toLowerCase();
    const pattern = `special:${specialLabel}`;
    const impactScore = damage + healed + utilityValue + (meaningful ? 1 : 0);

    if (!isConfirmHeld) {
      if (impactScore < 4) {
        const cur = safeNumber(tracker.specialLowImpactRepeats[pattern]);
        const mult = lowImpactSpecialRepeatMultiplier(cur);
        utilityValue *= mult;
        tracker.specialLowImpactRepeats[pattern] = cur + 1;
        applyStallPattern(tracker, pattern);
        m.lowImpactActions += 1;
        tracker.lowImpactActions += 1;
      } else {
        tracker.specialLowImpactRepeats[pattern] = 0;
        tracker.stallChain = Math.max(0, tracker.stallChain - 2);
        tracker.lastLowImpactPattern = null;
        m.highImpactActions += 1;
        tracker.highImpactActions += 1;
      }
    }

    m.utility += utilityValue;
    deltaUtility = utilityValue;
    m.actions += 1;
    tracker.totalPlayerActions += 1;
    const thresholdDamageBonus = damage >= 75 ? BONUS_XP_SPECIAL_DAMAGE_75 : 0;
    const thresholdHealBonus = healed >= 50 ? BONUS_XP_HEAL_50 : 0;
    const thresholdTeamHealBonus = healed >= 200 ? BONUS_XP_TEAM_HEAL_200 : 0;
    const thresholdBonus = thresholdDamageBonus + thresholdHealBonus + thresholdTeamHealBonus;
    const base = (deltaDamage * 0.30 + deltaHeal * 0.20 + deltaMitigation * 0.20 + deltaUtility * 0.30 + thresholdBonus);
    const scaled = base * ACTION_XP_MULTIPLIER * holdXpMultiplier;
    tracker.lastActionWasHighImpactItem = false;
    tracker.actionXpByActor[actorKey(actor)] = safeNumber(tracker.actionXpByActor[actorKey(actor)]) + scaled;
    tracker.actionXpBudget += scaled;
    return {
      actorKey: actorKey(actor),
      debugXp: Number(scaled.toFixed(1))
    };
  }

  return null;
}

export function addXpToMovie(movieStats, amount) {
  if (!movieStats || amount <= 0) return movieStats;

  if (typeof movieStats.level !== "number") movieStats.level = 1;
  if (typeof movieStats.xp !== "number") movieStats.xp = 0;

  movieStats.xp += amount;

  let guard = 0;
  while (guard < 100) {
    guard += 1;
    const needed = xpToNextLevel(movieStats.level);
    if (movieStats.xp < needed) break;

    movieStats.xp -= needed;
    movieStats.level += 1;

    const prevMaxHp = Math.max(1, Math.round(Number(movieStats.maxHp || 1)));
    const hpGain = Math.max(1, Math.round(prevMaxHp * PLAYER_LEVEL_HP_GROWTH));
    movieStats.maxHp = Math.max(1, prevMaxHp + hpGain);
    const prevAtk = Math.max(1, Math.round(Number(movieStats.atk || 1)));
    const prevDef = Math.max(1, Math.round(Number(movieStats.def || 1)));
    movieStats.atk = Math.max(1, Math.max(prevAtk + 1, Math.round(prevAtk * (1 + PLAYER_LEVEL_ATK_GROWTH))));
    movieStats.def = Math.max(1, Math.max(prevDef + 1, Math.round(prevDef * (1 + PLAYER_LEVEL_DEF_GROWTH))));
    if (Number(movieStats.slotIndex) === 0) {
      movieStats.critChance = Math.min(0.8, Math.max(0, Number(movieStats.critChance || 0) + 0.0125));
      movieStats.critDamageBonus = Math.max(0, Number(movieStats.critDamageBonus || 0) + 0.0125);
    }
    if (Number(movieStats.slotIndex) === 3) {
      movieStats.evasion = Math.min(0.6, Math.max(0, Number(movieStats.evasion || 0) + 0.009));
    }

    // Downed actors remain downed; otherwise roll up to new max HP.
    const wasDowned = Number(movieStats.hp || 0) <= 0;
    movieStats.hp = wasDowned ? 0 : movieStats.maxHp;
  }

  return movieStats;
}

export function awardXpToParty(party, enemy, tracker = null) {
  const participants = (party || []).filter((m) => !!m);
  if (participants.length === 0) {
    return { pool: 0, awards: [], breakdown: null };
  }

  const threat = getThreatScore(tracker?.enemySnapshot, enemy);
  const actualEnemyPhases = Math.max(1, Math.round(safeNumber(tracker?.enemyPhases || 1)));
  const targetEnemyPhases = Math.max(
    2,
    Math.round(
      3 +
      (safeNumber(tracker?.enemySnapshot?.level || enemy?.level || 1) * 0.6) +
      (safeNumber(tracker?.enemySnapshot?.maxHp || enemy?.maxHP || 0) / 120)
    )
  );

  const pacingBonus = clamp(targetEnemyPhases / actualEnemyPhases, 0.9, 1.12);

  const maxPressure = Math.max(1, participants.reduce((acc, a) => acc + safeNumber(a.maxHp), 0));
  const incomingPressure = clamp(safeNumber(tracker?.incomingDamage) / maxPressure, 0, 1);
  const adversity = clamp(
    (safeNumber(tracker?.lowHpMoments) * 0.02) +
    (safeNumber(tracker?.allyDownMoments) * 0.05) +
    (incomingPressure * 0.12),
    0,
    0.16
  );
  const endurance = clamp((actualEnemyPhases - targetEnemyPhases) / Math.max(1, targetEnemyPhases), 0, 0.12);

  const overLowImpact =
    Math.max(
      0,
      safeNumber(tracker?.lowImpactActions) - (safeNumber(tracker?.highImpactActions) * 0.8)
    ) * 0.01;
  const stallPenalty = clamp(safeNumber(tracker?.stallPenaltyUnits) + overLowImpact, 0, 0.22);

  const survivalBonus = 1 + clamp(adversity + endurance - stallPenalty, 0, 0.25);
  const actionBudget = Math.max(0, safeNumber(tracker?.actionXpBudget));
  const pool = Math.max(1, Math.round((threat * pacingBonus * survivalBonus) + actionBudget));

  const basePool = pool * 0.4;
  const contribPool = pool * 0.6;
  const baseShare = basePool / participants.length;
  const floorShare = baseShare * 0.15;

  const trackerMetrics = tracker?.metricsByActor || {};
  const liveMetrics = participants.map((actor) => ensureMetric(trackerMetrics, actor));
  const damageShares = normalizedMetricShare(liveMetrics, "damage");
  const healShares = normalizedMetricShare(liveMetrics, "heal");
  const mitigationShares = normalizedMetricShare(liveMetrics, "mitigation");
  const utilityShares = normalizedMetricShare(liveMetrics, "utility");

  const weighted = liveMetrics.map((_, i) => {
    return (
      (damageShares[i] * 0.30) +
      (healShares[i] * 0.20) +
      (mitigationShares[i] * 0.20) +
      (utilityShares[i] * 0.30)
    );
  });

  const weightedTotal = weighted.reduce((acc, v) => acc + v, 0);
  const fallbackWeighted = weightedTotal > 0 ? weighted : liveMetrics.map(() => (1 / liveMetrics.length));

  const awards = [];
  for (let i = 0; i < participants.length; i++) {
    const actor = participants[i];
    const pendingDownHp = actor?.pendingDownHp;
    const hasPendingDown =
      typeof pendingDownHp === "number" &&
      Number.isFinite(pendingDownHp) &&
      pendingDownHp <= 0;
    const wasDowned = actor?.isDowned === true && !hasPendingDown;
    const levelBefore = Math.max(1, Math.floor(safeNumber(actor.level) || 1));
    const xpBefore = Math.max(0, Math.floor(safeNumber(actor.xp) || 0));
    const hpBefore = Math.max(0, Math.floor(safeNumber(actor.hp) || 0));
    const maxHpBefore = Math.max(1, Math.floor(safeNumber(actor.maxHp) || 1));
    const atkBefore = Math.max(1, Math.floor(safeNumber(actor.atk) || 1));
    const defBefore = Math.max(1, Math.floor(safeNumber(actor.def) || 1));
    const critDamageBonusBefore = Math.max(0, safeNumber(actor.critDamageBonus));
    const evasionBefore = Math.max(0, safeNumber(actor.evasion));
    const slotIndex = Number.isFinite(Number(actor.slotIndex)) ? Number(actor.slotIndex) : -1;
    const contribShare = contribPool * fallbackWeighted[i];
    const key = actorKey(actor);
    const actionBonus = Math.max(0, Math.round(safeNumber(tracker?.actionXpByActor?.[key] || 0)));
    const fullAwardXp = Math.max(1, Math.round(Math.max(floorShare, baseShare + contribShare)));
    const totalXp = Math.max(1, Math.round(fullAwardXp * (wasDowned ? DOWNED_XP_MULTIPLIER : 1)));
    addXpToMovie(actor, totalXp);
    const levelAfter = Math.max(1, Math.floor(safeNumber(actor.level) || 1));
    const xpAfter = Math.max(0, Math.floor(safeNumber(actor.xp) || 0));
    const hpAfter = Math.max(0, Math.floor(safeNumber(actor.hp) || 0));
    const maxHpAfter = Math.max(1, Math.floor(safeNumber(actor.maxHp) || 1));
    const atkAfter = Math.max(1, Math.floor(safeNumber(actor.atk) || 1));
    const defAfter = Math.max(1, Math.floor(safeNumber(actor.def) || 1));
    const critDamageBonusAfter = Math.max(0, safeNumber(actor.critDamageBonus));
    const evasionAfter = Math.max(0, safeNumber(actor.evasion));

    awards.push({
      actorKey: actorKey(actor),
      actorName: actor?.movie?.title || actor?.movie?.shortTitle || actor?.name || "Actor",
      levelBefore,
      levelAfter,
      xpBefore,
      xpAfter,
      xpGained: totalXp,
      fullAwardXp,
      wasDowned,
      downedMultiplier: wasDowned ? DOWNED_XP_MULTIPLIER : 1,
      actionXpBonus: actionBonus,
      hpBefore,
      hpAfter,
      maxHpBefore,
      maxHpAfter,
      atkBefore,
      atkAfter,
      defBefore,
      defAfter,
      slotIndex,
      critDamageBonusBefore,
      critDamageBonusAfter,
      evasionBefore,
      evasionAfter,
      xpNeededForNext: Math.max(0, xpToNextLevel(levelAfter) - xpAfter),
      perkChoices: Math.max(0, Math.floor(levelAfter / 3) - Math.floor(levelBefore / 3)),
      metrics: {
        damage: Math.round(safeNumber(liveMetrics[i]?.damage || 0)),
        heal: Math.round(safeNumber(liveMetrics[i]?.heal || 0)),
        mitigation: Math.round(safeNumber(liveMetrics[i]?.mitigation || 0)),
        utility: Math.round(safeNumber(liveMetrics[i]?.utility || 0))
      }
    });
  }

  return {
    pool,
    awards,
    breakdown: {
      threat,
      pacingBonus,
      survivalBonus,
      adversity,
      endurance,
      stallPenalty,
      basePool: Math.round(basePool),
      contributionPool: Math.round(contribPool)
    }
  };
}
