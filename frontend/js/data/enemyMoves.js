// frontend/js/data/enemyMoves.js
//
// Registry of enemy moves.
// Each move is a small definition with an effect key + some numbers.
// Keep moves data-driven so enemies can share them.

export const enemyMoves = {
  basic_attack: {
    id: "basic_attack",
    name: "Attack",
    kind: "attack",
    powerMultiplier: 1.0,
    weight: 70
  },

  heavy_attack: {
    id: "heavy_attack",
    name: "Heavy Attack",
    kind: "attack",
    powerMultiplier: 1.35,
    weight: 25
  },

  wild_swing: {
    id: "wild_swing",
    name: "Wild Swing",
    kind: "attack",
    powerMultiplier: 0.85,
    weight: 35
  }
};
