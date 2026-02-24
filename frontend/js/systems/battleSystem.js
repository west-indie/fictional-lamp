// frontend/js/systems/battleSystem.js

import { calculateMovieStats } from "../combat/stats.js";
import { spawnEnemy } from "./enemySpawnSystem.js";

function toFiniteOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function makeActor(movie, progress = null, slotIndex = -1) {
  const stats = calculateMovieStats(movie);
  const hasProgress = !!(progress && typeof progress === "object");

  const maxHpBase = Math.max(1, Math.round(toFiniteOr(stats.maxHp, 1)));
  const atkBase = Math.max(1, Math.round(toFiniteOr(stats.atk, 1)));
  const defBase = Math.max(1, Math.round(toFiniteOr(stats.def, 1)));

  const maxHp = hasProgress ? Math.max(1, Math.round(toFiniteOr(progress.maxHp, maxHpBase))) : maxHpBase;
  const atk = hasProgress ? Math.max(1, Math.round(toFiniteOr(progress.atk, atkBase))) : atkBase;
  const def = hasProgress ? Math.max(1, Math.round(toFiniteOr(progress.def, defBase))) : defBase;
  const level = hasProgress ? Math.max(1, Math.floor(toFiniteOr(progress.level, 1))) : 1;
  const xp = hasProgress ? Math.max(0, Math.floor(toFiniteOr(progress.xp, 0))) : 0;
  const perks = hasProgress && progress.perks && typeof progress.perks === "object"
    ? {
        blockbusterPower: Math.max(0, Math.floor(toFiniteOr(progress.perks.blockbusterPower, 0))),
        cultClassic: Math.max(0, Math.floor(toFiniteOr(progress.perks.cultClassic, 0))),
        sleeperHit: Math.max(0, Math.floor(toFiniteOr(progress.perks.sleeperHit, 0)))
      }
    : { blockbusterPower: 0, cultClassic: 0, sleeperHit: 0 };

  // Slot identity bonuses.
  const slotCritBonus = slotIndex === 0 ? Math.min(0.15, level * 0.0125) : 0;
  const slotCritDamageBonus = slotIndex === 0 ? (level * 0.0125) : 0;
  const slotEvadeBonus = slotIndex === 3 ? Math.min(0.12, level * 0.009) : 0;

  const critChance = Math.max(0, Math.min(0.8, Number(stats.critChance || 0) + slotCritBonus + (perks.blockbusterPower * 0.015)));
  const evasion = Math.max(0, Math.min(0.6, Number(stats.evasion || 0) + slotEvadeBonus));

  const critDamageBonus = (perks.blockbusterPower * 0.08) + slotCritDamageBonus;
  const defendDamageMult = Math.max(0.32, 0.5 - (perks.cultClassic * 0.03));
  const healPower = 1 + (perks.sleeperHit * 0.08);
  const utilityPower = 1 + (perks.sleeperHit * 0.06);
  const supportEfficiency = perks.sleeperHit;

  return {
    movie,
    atk,
    def,
    hp: maxHp,
    maxHp,
    critChance,
    evasion,
    tone: stats.tone || null,
    era: stats.era || null,
    level,
    xp,
    perks,
    critDamageBonus,
    defendDamageMult,
    healPower,
    utilityPower,
    supportEfficiency,
    slotIndex,
    isDefending: false
  };
}

/**
 * Build the party stats array from the selected movies in GameState.
 */
export function buildPartyFromMovies(movies, progressMap = {}) {
  const party = (movies || [])
    .filter(Boolean)
    .map((movie, i) => makeActor(movie, progressMap?.[movie?.id] || null, i));

  if (party.length === 0) {
    party.push(
      makeActor({
        id: "dummy",
        title: "No Movies",
        runtime: 100,
        imdb: 5.0
      }, null)
    );
  }

  return party;
}

/**
 * Unified enemy creation entrypoint (optional convenience wrapper).
 */
export function createEnemyForBattle({ level, enemyTemplate, enemyId, poolIds } = {}) {
  return spawnEnemy({
    level,
    template: enemyTemplate || null,
    enemyId: enemyId || null,
    poolIds: poolIds || null
  });
}
