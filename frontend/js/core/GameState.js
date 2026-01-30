// frontend/js/core/GameState.js
//
// Single source of truth for global game state.
// ✅ Extended minimally for unlocks + trigger flags + stats used by rules.

export const GameState = {
  currentScreen: "menu",

  party: {
    movies: [null, null, null, null],
    progress: {}
  },

  enemy: null,

  // Campaign level system
  currentLevel: 1,
  maxLevel: 9,

  campaign: {
    onefourShown: false,
    effects: { first: null, fourth: null },
    _onefourAppliedThisBattle: false,
    flavor: {},
    runtime: {}
  },


  // Enemy chosen for the current level (template from data/enemies.js)
  enemyTemplate: null,

  // ✅ Unlock persistence state (loaded from localStorage by ensureUnlockState)
  // (game.js already calls ensureUnlockState(GameState) once)
  unlocks: null,

  // ✅ Global flags (secrets, applied rule bookkeeping)
  flags: {
    secrets: {
      // Example:
      // imdbSequenceCompleted: false
    },
    unlocks: {
      appliedRules: {}
    }
  },

  // ✅ Global stats for unlock rules (increment from battle/campaign code)
  stats: {
    wins: 0,
    losses: 0,
    campaignCleared: false,

    // optional placeholders used by example rules
    mealsCooked: 0,
    artHouseWins: 0
  }
};
