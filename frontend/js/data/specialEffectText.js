// frontend/js/data/specialEffectText.js
//
// Central registry for special narration + effect line overrides.
// This keeps specials.js focused on mechanics and lets you author text in one place.
//
// Key scheme suggestion:
//   "sig:<movieId>:<specialId>"  (signature specials)

  // Supported keys (from your effects object):
  // damageDealt, healedHp, shieldAdded, atkBuffPct, defBuffPct,
  // damageReductionPct, enemyAtkDebuffPct, enemyDefDebuffPct, statusApplied
  //
  // Templates get variables like:
  // {actor}, {target}, {enemy}, {value}, {turns}, {move}

export const specialEffectTextByMovie = {
  "sig:purple_rain:purple_rain_lake_minnetonka": {
    intro: [
      "{actor} purifies {target} in the waters of Lake Minnetonka."
    ],
    showEffects: true,
    // Supported keys (from your effects object):
    // damageDealt, healedHp, shieldAdded, atkBuffPct, defBuffPct,
    // damageReductionPct, enemyAtkDebuffPct, enemyDefDebuffPct, statusApplied
    //
    // Templates get variables like:
    // {actor}, {target}, {enemy}, {value}, {turns}, {move}
    effectText: {
      healedHp: "{target} feels renewed (+{value} HP)."
    }
  },
  "sig:purple_rain:purple_rain_go_crazy": {
    intro: [
      "The Revelution plays 'Let's Go Crazy' for the audience!",
      "{target} wasn't really a fan..."
    ],
    showEffects: true,
    effectText: {
      healedHp: "{target} loses ({value} HP)."
    }
  },
  "sig:purple_rain:purple_rain_purple_rain": {
    intro: [
      "Prince plays 'Purple Rain' for his band!",
      "An immense weight has been lifted and the band rejoices!"
    ],
    showEffects: true,
    effectText: {
      healedHp: "The Team gains (+{value} HP)."
    }
  },
  "sig:purple_rain:purple_rain_darling_nikki": {
    intro: [
      "Prince plays a special song for {target}.",
      "{target} is left hurt and disoriented."
    ],
    showEffects: true,
    effectText: {
      healedHp: "{target} loses ({value} HP)."
    }
  }

};
