// frontend/js/data/genreSpecials.js
//
// Genre special registry.
// - Each entry defines primary+secondary names and effect baselines.
// - ATK boost values that should be IMDb-scaled are marked with imdbScale: true.
// - Cooldown is handled in specialSystem (default 3 turns), but data includes it for clarity.
//
// Notes based on your latest rules:
// - Self ATK-boost moves (ACTION, SCIFI) include an immediate hit with multiplier 1.5–2.0.
// - Team ATK-boost moves (ADVENTURE, MUSICAL) include TEAM STRIKE total multiplier 1.5–2.8,
//   split partially weighted by sqrt(finalATK).
// - COMEDY: enemy ATK debuff + team DEF buff (2 turns) + team heal (Primary 20%, Secondary 10%).
// - HORROR: pre-hit uses Action-style boost only (Primary 40%, Secondary 20%) and NO 1.5–2.0 roll,
//   then applies DEF debuff.
//
// Durations are in "turns" as your battle system defines them (typically actor turns / round ticks).

export const genreSpecials = {
  ACTION: {
    target: ["self", "enemy"],
    primaryName: "Full Throttle",
    secondaryName: "Adrenaline Surge",
    primary: {
      atkBuffPct: { value: 0.40, imdbScale: true, turns: 2 },
      immediateHit: { enabled: true, minMult: 1.5, maxMult: 2.0 }
    },
    secondary: {
      atkBuffPct: { value: 0.20, imdbScale: true, turns: 2 },
      immediateHit: { enabled: true, minMult: 1.5, maxMult: 2.0 }
    }
  },

  ADVENTURE: {
    target: ["team", "teamstrike"],
    primaryName: "Call to Adventure",
    secondaryName: "United Front",
    primary: {
      teamAtkBuffPct: { value: 0.20, imdbScale: true, turns: 2 },
      teamDefBuffPct: { value: 0.15, imdbScale: false, turns: 2 },
      teamStrike: { enabled: true, totalMinMult: 1.5, totalMaxMult: 2.8, split: "sqrt" }
    },
    secondary: {
      teamAtkBuffPct: { value: 0.10, imdbScale: true, turns: 2 },
      teamDefBuffPct: { value: 0.10, imdbScale: false, turns: 2 },
      teamStrike: { enabled: true, totalMinMult: 1.5, totalMaxMult: 2.8, split: "sqrt" }
    }
  },

  DRAMA: {
    target: "self",
    primaryName: "Character Arc",
    secondaryName: "Slow-Build Payoff",
    primary: {
      healSelfMaxHpPct: { value: 0.20, imdbScale: false },
      defBuffPct: { value: 0.20, imdbScale: false, turns: 2 }
    },
    secondary: {
      healSelfMaxHpPct: { value: 0.10, imdbScale: false },
      defBuffPct: { value: 0.10, imdbScale: false, turns: 2 }
    }
  },

  COMEDY: {
    target: "enemy",
    primaryName: "Comic Relief",
    secondaryName: "Punchline",
    primary: {
      enemyAtkDebuffPct: { value: 0.25, imdbScale: false, turns: 2 },
      teamDefBuffPct: { value: 0.15, imdbScale: false, turns: 2 },
      teamHealMaxHpPct: { value: 0.20, imdbScale: false }
    },
    secondary: {
      enemyAtkDebuffPct: { value: 0.125, imdbScale: false, turns: 2 },
      teamDefBuffPct: { value: 0.075, imdbScale: false, turns: 2 },
      teamHealMaxHpPct: { value: 0.10, imdbScale: false }
    }
  },

  HORROR: {
    target: "enemy",
    primaryName: "Nightmare",
    secondaryName: "Cheap Jumpscare",
    primary: {
      // Pre-hit boost for ONE hit only (no extra 1.5–2.0 roll).
      preHitAtkBuffPct: { value: 0.40, imdbScale: true },
      enemyDefDebuffPct: { value: 0.30, imdbScale: false, turns: 2 }
    },
    secondary: {
      preHitAtkBuffPct: { value: 0.20, imdbScale: true },
      enemyDefDebuffPct: { value: 0.15, imdbScale: false, turns: 2 }
    }
  },

  THRILLER: {
    target: "enemy",
    primaryName: "Rising Tension",
    secondaryName: "Vertigo Effect",
    primary: {
      nextHitVulnPct: { value: 0.35, imdbScale: false } // next hit only
    },
    secondary: {
      nextHitVulnPct: { value: 0.20, imdbScale: false }
    }
  },

  MYSTERY: {
    target: "enemy",
    primaryName: "Unmasked!",
    secondaryName: "Hidden Motive",
    primary: {
      enemyDefDebuffPct: { value: 0.25, imdbScale: false, turns: 2 },
      enemyAtkDebuffPct: { value: 0.15, imdbScale: false, turns: 2 }
    },
    secondary: {
      enemyDefDebuffPct: { value: 0.15, imdbScale: false, turns: 2 }
    }
  },

  SCIFI: {
    target: ["self", "enemy"],
    primaryName: "Synthetic Overdrive",
    secondaryName: "Hyperdrive Protocol",
    primary: {
      atkBuffPct: { value: 0.30, imdbScale: true, turns: 2 },
      defDebuffPct: { value: 0.10, imdbScale: false, turns: 2 },
      immediateHit: { enabled: true, minMult: 1.5, maxMult: 2.0 }
    },
    secondary: {
      atkBuffPct: { value: 0.15, imdbScale: true, turns: 2 },
      immediateHit: { enabled: true, minMult: 1.5, maxMult: 2.0 }
    }
  },

  FANTASY: {
    target: "ally",
    primaryName: "Light of the Realm",
    secondaryName: "Mystical Guard",
    primary: {
      shieldAllyMaxHpPct: { value: 0.25, imdbScale: false, turns: 2 }
    },
    secondary: {
      shieldAllyMaxHpPct: { value: 0.15, imdbScale: false, turns: 2 }
    }
  },

  ANIMATION: {
    target: ["team", "enemy"],
    primaryName: "Stylized Impact",
    secondaryName: "Animated Logic",
    primary: {
      teamDamageReductionPct: { value: 0.20, imdbScale: false, turns: 2 },
      immediateHit: { enabled: true, minMult: 1.25, maxMult: 2.5 }
    },
    secondary: {
      teamDamageReductionPct: { value: 0.10, imdbScale: false, turns: 2 }
    }
  },

  CRIME: {
    target: "enemy",
    primaryName: "Underworld Pressure",
    secondaryName: "Criminal Tactics",
    primary: {
      enemyAtkDebuffPct: { value: 0.25, imdbScale: false, turns: 2 },
      enemyDefDebuffPct: { value: 0.10, imdbScale: false, turns: 2 }
    },
    secondary: {
      enemyAtkDebuffPct: { value: 0.15, imdbScale: false, turns: 2 },
      immediateHit: { enabled: true, minMult: 1.25, maxMult: 1.75 }
    }
  },

  ROMANCE: {
    target: "ally",
    primaryName: "Emotional Support",
    secondaryName: "Tender Moment",
    primary: {
      healAllyMaxHpPct: { value: 0.60, imdbScale: false }
    },
    secondary: {
      healAllyMaxHpPct: { value: 0.30, imdbScale: false }
    }
  },

  MUSICAL: {
    target: ["team", "teamstrike"],
    primaryName: "Encore!",
    secondaryName: "Opening Musical Number",
    primary: {
      teamAtkBuffPct: { value: 0.20, imdbScale: true, turns: 1 },
      teamHealMaxHpPct: { value: 0.10, imdbScale: false },
      teamStrike: { enabled: true, totalMinMult: 1.5, totalMaxMult: 2.8, split: "sqrt" }
    },
    secondary: {
      teamAtkBuffPct: { value: 0.10, imdbScale: true, turns: 1 },
      teamHealMaxHpPct: { value: 0.05, imdbScale: false },
      teamStrike: { enabled: true, totalMinMult: 1.5, totalMaxMult: 2.8, split: "sqrt" }
    }
  },

  DOCUMENTARY: {
    target: "enemy",
    primaryName: "Historical Context",
    secondaryName: "Reality Check",
    primary: {
      enemyAtkDebuffPct: { value: 0.20, imdbScale: false, turns: 2 },
      enemyDefDebuffPct: { value: 0.20, imdbScale: false, turns: 2 }
    },
    secondary: {
      enemyAtkDebuffPct: { value: 0.10, imdbScale: false, turns: 2 },
      immediateHit: { enabled: true, minMult: 2.0, maxMult: 3.0 }
    }
  }
};
