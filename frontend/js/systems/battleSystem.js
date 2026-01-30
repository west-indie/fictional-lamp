// frontend/js/systems/battleSystem.js

import { calculateMovieStats } from "../combat/stats.js";
import { spawnEnemy } from "./enemySpawnSystem.js";

function makeActor(movie) {
  const stats = calculateMovieStats(movie);
  return {
    movie,
    atk: stats.atk,
    def: stats.def,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    critChance: stats.critChance,
    evasion: stats.evasion,
    tone: stats.tone || null,
    era: stats.era || null,
    isDefending: false
  };
}

/**
 * Build the party stats array from the selected movies in GameState.
 */
export function buildPartyFromMovies(movies) {
  const party = (movies || []).filter(Boolean).map(makeActor);

  if (party.length === 0) {
    party.push(
      makeActor({
        id: "dummy",
        title: "No Movies",
        runtime: 100,
        imdb: 5.0
      })
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
