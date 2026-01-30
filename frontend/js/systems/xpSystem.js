// frontend/js/systems/xpSystem.js

/**
 * Basic, extensible XP/leveling helpers.
 *
 * These do NOT assume anything about rendering or UI –
 * they just mutate the movie stats objects in the party array.
 */

/**
 * Compute a simple base XP reward for defeating an enemy.
 * Scales with enemy HP and attack.
 */
export function getEnemyBaseXp(enemy) {
  if (!enemy) return 0;
  const hpPart = (enemy.maxHP || enemy.hp || 0) / 5;
  const atkPart = (enemy.attack || 0) * 2;
  return Math.round(hpPart + atkPart);
}

/**
 * Add XP to a single movie stats object, handling level-ups.
 *
 * Assumes:
 *  - movieStats.maxHp, movieStats.hp, movieStats.atk, movieStats.def exist.
 *  - movieStats.level / xp are optional and will be initialized if missing.
 */
export function addXpToMovie(movieStats, amount) {
  if (!movieStats || amount <= 0) return movieStats;

  if (typeof movieStats.level !== "number") movieStats.level = 1;
  if (typeof movieStats.xp !== "number") movieStats.xp = 0;

  movieStats.xp += amount;

  // Very simple rule: every 100 XP → level up.
  while (movieStats.xp >= 100) {
    movieStats.xp -= 100;
    movieStats.level += 1;

    // Growth curve: modest but noticeable.
    movieStats.maxHp = Math.round(movieStats.maxHp * 1.05);
    movieStats.hp = movieStats.maxHp; // heal fully on level up
    movieStats.atk = Math.round(movieStats.atk * 1.05);
    movieStats.def = Math.round(movieStats.def * 1.03);
  }

  return movieStats;
}

/**
 * Distribute XP evenly to all living party members.
 */
export function awardXpToParty(party, enemy) {
  const baseXp = getEnemyBaseXp(enemy);
  if (baseXp <= 0) return;

  const alive = (party || []).filter(m => m && m.hp > 0);
  if (alive.length === 0) return;

  const share = Math.max(1, Math.round(baseXp / alive.length));

  alive.forEach(m => addXpToMovie(m, share));
}
