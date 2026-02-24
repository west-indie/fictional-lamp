// frontend/js/battleText/lines/genreSpecialText.js
//
// Step B - centralized genre-special narration templates + ordering.
// DATA ONLY. No combat math.
//
// Template vars:
// {actor} {move} {target}
// {dmg} {teamDmg} {teamHeal} {heal}
//
// Duration phrase vars (already include "for X turn(s)"):
// {buffTurnsPhrase} {debuffTurnsPhrase} {shieldTurnsPhrase} {drTurnsPhrase}

export const GENRE_SPECIAL_TEXT = {
  DEFAULT: {
    fallback: "[DEV] Missing genreSpecialText entry for this genre.",
    order: ["fallback"],
    phase: { fallback: "postFx" }
  },

  ACTION: {
    atkUp: "{actor}'s ATTACK rises {buffTurnsPhrase}.",
    onHit: "{actor} attacks for {dmg} damage.",
    order: ["atkUp", "onHit"]
  },

  ADVENTURE: {
    teamAtkUp: "The team's ATTACK rises {buffTurnsPhrase}.",
    teamDefUp: "The team's DEFENSE rises {buffTurnsPhrase}.",
    teamStrike: "{actor} calls the team together to hit for {teamDmg} total damage!",
    order: ["teamAtkUp", "teamDefUp", "teamStrike"]
  },

  DRAMA: {
    defUp: "{actor}'s DEFENSE rises {buffTurnsPhrase}.",
    selfHeal: "{actor} also heals {heal} HP.",
    order: ["defUp", "selfHeal"]
  },

  COMEDY: {
    enemyAtkDown: "Enemy ATTACK falls {debuffTurnsPhrase}.",
    teamDefUp: "The team's DEFENSE rises {buffTurnsPhrase}.",
    teamHeal: "The team also heals {teamHeal} total HP.",
    order: ["enemyAtkDown", "teamDefUp", "teamHeal"]
  },

  HORROR: {
    onHit: "It hits for {dmg} damage.",
    enemyDefDown: "Enemy DEFENSE falls {debuffTurnsPhrase}.",
    order: ["onHit", "enemyDefDown"]
  },

  THRILLER: {
    expose: "The enemy is exposed until the next hit.",
    order: ["expose"]
  },

  MYSTERY: {
    enemyDefDown: "Enemy DEFENSE falls {debuffTurnsPhrase}.",
    enemyAtkDown: "Enemy ATTACK falls {debuffTurnsPhrase}.",
    order: ["enemyDefDown", "enemyAtkDown"]
  },

  SCIFI: {
    atkUp: "{actor}'s ATTACK rises {buffTurnsPhrase}.",
    selfDefDown: "{actor}'s DEFENSE falls {debuffTurnsPhrase}.",
    onHit: "{actor} attacks for {dmg} damage.",
    order: ["atkUp", "selfDefDown", "onHit"]
  },

  FANTASY: {
    allyShield: "{target} is shielded {shieldTurnsPhrase}.",
    order: ["allyShield"]
  },

  ANIMATION: {
    onHit: "{actor} uses this new freedom to hit for {dmg} damage.",
    damageReduction: "The team also takes less damage {drTurnsPhrase}.",
    order: ["onHit", "damageReduction"]
  },

  CRIME: {
    enemyAtkDown: "Enemy ATTACK falls {debuffTurnsPhrase}.",
    enemyDefDown: "Enemy DEFENSE falls {debuffTurnsPhrase}.",
    onHit: "{actor} breaks {target}'s legs.",
    order: ["enemyAtkDown", "enemyDefDown", "onHit"]
  },

  ROMANCE: {
    allyHeal: "{target} heals {heal} HP.",
    order: ["allyHeal"]
  },

  MUSICAL: {
    teamHeal: "The team heals {teamHeal} total HP.",
    teamAtkUp: "The team's ATTACK rises {buffTurnsPhrase}.",
    teamStrike: "The team bands together to hit for {teamDmg} total damage!",
    order: ["teamHeal", "teamAtkUp", "teamStrike"]
  },

  DOCUMENTARY: {
    onHit: "It hits for {dmg} damage.",
    enemyAtkDown: "Enemy ATTACK falls {debuffTurnsPhrase}.",
    enemyDefDown: "Enemy DEFENSE falls {debuffTurnsPhrase}.",
    order: ["onHit", "enemyAtkDown", "enemyDefDown"]
  }
};
