// frontend/js/battleText/lines/signatureEffectText.js
//
// Central registry for signature-special narration + effect line overrides.
// This keeps specials.js focused on mechanics and lets you author text in one place.
//
// Key scheme:
//   "sig:<movieId>:<specialId>"  (signature specials)
//
// Supported effect keys (from your effects object):
//   damageDealt, healedHp, shieldAdded, atkBuffPct, defBuffPct,
//   damageReductionPct, enemyAtkDebuffPct, enemyDefDebuffPct, statusApplied
//
// Templates receive variables like:
//   {actor}, {target}, {enemy}, {value}, {move}
//
// Notes:
// - `intro` / `outro` can be a string OR an array of strings.
// - `effectText` entries can be a string OR an array of strings.
// - `showEffects: false` suppresses auto-generated effect lines completely.

export const signatureEffectTextByKey = {
  "sig:office_space:office_space_monday_morning": {
    intro: [
      "The battlefield suddenly shifts into a bland office park...",
      "The flourescent lights flicker throughout.",
      "{target} stares blankly in angst..."
    ],
    showEffects: true,
    effectText: {
      statusApplied: "{target}'s enthusiasm is falling... and it starts to show.",
      nextHitVulnPct: "{target} is feeling very vulnerable right now..."
    },
    outro: [
      "Looks like someone has a case of the mondays!"
    ]
  },

  "sig:purple_rain:purple_rain_go_crazy": {
    intro: [
      "The Revolution plays 'Let's Go Crazy' for the audience!",
      "{target} wasn't really a fan..."
    ],
    showEffects: true,
    effectText: {
      damageDealt: "{target} loses ({value} HP)."
    }
  },

  "sig:purple_rain:purple_rain_darling_nikki": {
    intro: ["Prince plays a special song for {target}.", "{target} is left hurt and disoriented."],
    showEffects: true,
    effectText: {
      damageDealt: "{target} loses ({value} HP)."
    }
  },
  "sig:purple_rain:purple_rain_lake_minnetonka": {
    intro: ["{actor} purifies {target} in the waters of Lake Minnetonka."],
    showEffects: true,
    effectText: {
      healedHp: "{target} feels renewed (+{value} HP)."
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

  "sig:love_and_mercy:surfs_up": {
    intro: [
      "Brian Wilson plays a children's song on a lone piano in the dark.",
      "The song moves {target} and commences a spiritual awakening."
    ],
    showEffects: true,
    effectText: {
      healedHp: "({value} HP) is restored!"
    }
  },

  "sig:steve_jobs_2015:the_orchestra": {
    intro: [
      "Musicians play the Instruments.",
      "The conductor plays the Orchestra",
      "Steve Jobs unites the team together."
    ],
    showEffects: true,
    effectText: {
      atkBuffPct: "({value} HP) is restored!",
      damageDealt: "The party attacks for ({value} HP)!"
    }
  }
};

export const specialEffectTextByMovie = signatureEffectTextByKey;
export const SIGNATURE_EFFECT_TEXT = signatureEffectTextByKey;
