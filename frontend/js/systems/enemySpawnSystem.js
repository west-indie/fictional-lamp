// frontend/js/systems/enemySpawnSystem.js
//
// Single source of truth for creating enemies for battle.
// Everything (campaign, quickplay, random fights) should call spawnEnemy().

import { enemies } from "../data/enemies.js";

function levelMultiplier(level = 1) {
  const L = Math.max(1, Number(level) || 1);
  return 1 + (L - 1) * 0.35;
}

function roundStat(n) {
  return Math.max(1, Math.round(n));
}

function normalizeEnemyTemplate(template) {
  if (!template) return null;

  return {
    // Future-proof fields (won't break anything now)
    ai: "basic",
    moves: ["basic_attack"],
    actionsPerTurn: 2,
    ...template
  };
}

function findEnemyTemplateById(enemyId) {
  if (!enemyId) return null;
  return enemies.find((e) => e.id === enemyId) || null;
}

function pickRandomTemplateFromPool(poolIds) {
  const pool =
    Array.isArray(poolIds) && poolIds.length > 0
      ? poolIds.map(findEnemyTemplateById).filter(Boolean)
      : enemies;

  if (!pool || pool.length === 0) return null;

  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

/**
 * spawnEnemy options:
 * - level: number (defaults to 1)
 * - enemyId: string (optional)
 * - template: object (optional)
 * - poolIds: string[] (optional)
 * - overrides: object (optional; can override template fields or instance stats)
 */
export function spawnEnemy({
  level = 1,
  enemyId = null,
  template = null,
  poolIds = null,
  overrides = null
} = {}) {
  let chosen =
    template ||
    findEnemyTemplateById(enemyId) ||
    pickRandomTemplateFromPool(poolIds);

  chosen = normalizeEnemyTemplate(chosen);

  if (!chosen) {
    chosen = normalizeEnemyTemplate({
      id: "missing_enemy",
      name: "Missing Enemy",
      tagline: "You forgot to define an enemy.",
      maxHP: 30,
      attack: 6,
      defense: 4
    });
  }

  // Support either maxHP or maxHp in templates (avoids subtle bugs)
  const baseMaxHP =
    Number(chosen.maxHP ?? chosen.maxHp ?? chosen.hp ?? 30) || 30;

  const baseAttack = Number(chosen.attack ?? 6) || 6;
  const baseDefense = Number(chosen.defense ?? 4) || 4;

  const mult = levelMultiplier(level);

  const scaledMaxHP = roundStat(baseMaxHP * mult);
  const scaledAttack = roundStat(baseAttack * mult);
  const scaledDefense = roundStat(baseDefense * mult);

  // Build instance
  const instance = {
    // Base/template fields
    ...chosen,

    // Battle instance fields (scaled)
    maxHP: scaledMaxHP,
    hp: scaledMaxHP,
    attack: scaledAttack,
    defense: scaledDefense,

    // Defaults
    critChance: 0.06,
    evasion: 0
  };

  // ✅ Apply overrides last (so you can force anything for special encounters)
  if (overrides && typeof overrides === "object") {
    Object.assign(instance, overrides);

    // If user overrides maxHP, keep hp consistent unless they explicitly override hp too
    if (typeof overrides.maxHP === "number" && typeof overrides.hp !== "number") {
      instance.hp = overrides.maxHP;
    }
  }

  return instance;
}

// ✅ Dev/testing support: list every enemy template
export function getEnemyCatalog() {
  // Return minimal entries: { id, name }
  return (enemies || []).map((e) => ({
    id: e.id,
    name: e.name || e.id
  }));
}
