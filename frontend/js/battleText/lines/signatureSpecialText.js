// frontend/js/battleText/lines/signatureSpecialText.js
//
// Step B2 - centralized signature-special narration templates + ordering.
// DATA ONLY. No combat math.
//
// This file provides:
// - byKind: defaults per signature kind
// - byKey: per-move overrides (sig:<movieId>:<specialId>)
// - byMovie: per-movie fallback overrides (movie:<movieId>)
//
// NOTE:
// - Universal intro ("{actor} uses {move}!") is injected by signatureSpecialNarration.js
//   (unless includeIntro:false), so "intro" is NOT part of ordering here.
//
// Template vars (available if outcome/effects provides them):
// {actor} {move} {target} {enemy}
// {dmg} {heal} {teamHeal}
// {turnsPhrase}
// {buffList} {debuffList}
// {statusName}

const T_DAMAGE_ENEMY = {
  onHit: "It deals {dmg} damage.",
  selfRisk: "{actor} is left exposed for {turnsPhrase}.",
  order: ["onHit", "selfRisk"]
};

const T_HIT = {
  onHit: "It deals {dmg} damage.",
  order: ["onHit"]
};

const T_HEAL_SELF = {
  heal: "{actor} heals {heal} HP.",
  order: ["heal"]
};

const T_HEAL_SELF_MISSING = {
  revive: "{actor} returns to the fight!",
  heal: "{actor} heals {heal} HP.",
  order: ["revive", "heal"],
  phase: {
    revive: "preFx"
  }
};

const T_HEAL_ALLY = {
  heal: "{target} heals {heal} HP.",
  order: ["heal"]
};

const T_HEAL_ALLY_MISSING = {
  revive: "{target} returns to the fight!",
  heal: "{target} heals {heal} HP.",
  order: ["revive", "heal"],
  phase: {
    revive: "preFx"
  }
};

const T_HEAL_TEAM = {
  teamHeal: "The team heals {teamHeal} total HP.",
  order: ["teamHeal"]
};

const T_HEAL_TEAM_MISSING = {
  teamRevive: "Fallen allies return to the fight!",
  teamHeal: "The team heals {teamHeal} total HP.",
  order: ["teamRevive", "teamHeal"],
  phase: {
    teamRevive: "preFx"
  }
};

const T_SELF_BUFF = {
  buffs: "{actor} gains {buffList} for {turnsPhrase}.",
  shield: "{actor} raises a barrier.",
  order: ["buffs", "shield"],
  phase: {
    shield: "postFx"
  }
};

const T_BUFF_PARTY = {
  buffs: "The team gains {buffList} for {turnsPhrase}.",
  order: ["buffs"]
};

const T_ENEMY_DEBUFF = {
  debuffs: "The enemy suffers {debuffList} for {turnsPhrase}.",
  order: ["debuffs"]
};

const T_STATUS_ENEMY = {
  status: "{enemy} is afflicted with {statusName}.",
  stun: ["{enemy} is stunned!", "{enemy} can't act."],
  stunTimed: ["{enemy} is stunned!", "{enemy} can't act for {turnsPhrase}."],
  dazed: ["{enemy} is struggling to focus.", "{enemy} is dazed!"],
  dazedTimed: ["{enemy} is struggling to focus.", "{enemy} is dazed for {turnsPhrase}!"],
  confused: ["{enemy} becomes confused.", "{enemy} doesn't even know where their at."],
  order: ["stunTimed", "stun", "dazedTimed", "dazed", "confused", "status"],
  phase: {
    stun: "postFx",
    stunTimed: "postFx",
    dazed: "postFx",
    dazedTimed: "postFx",
    confused: "postFx",
    status: "postFx"
  }
};

export const SIGNATURE_SPECIAL_TEXT = {
  DEFAULT: {
    intro: "{actor} uses {move}!",
    order: []
  },

  byKind: {
    damageEnemy: T_DAMAGE_ENEMY,
    hit: T_HIT,
    healSelf: T_HEAL_SELF,
    healSelfMissingPct: T_HEAL_SELF_MISSING,
    healAlly: T_HEAL_ALLY,
    healAllyMissingPct: T_HEAL_ALLY_MISSING,
    healTeam: T_HEAL_TEAM,
    healTeamMissingPct: T_HEAL_TEAM_MISSING,
    selfBuff: T_SELF_BUFF,
    buffParty: T_BUFF_PARTY,
    enemyDebuff: T_ENEMY_DEBUFF,
    debuffEnemy: T_ENEMY_DEBUFF,
    statusEnemy: T_STATUS_ENEMY,
    HIT: T_HIT,
    SELF_BUFF: T_SELF_BUFF,
    ENEMY_DEBUFF: T_ENEMY_DEBUFF,
    STATUS: T_STATUS_ENEMY
  },

  byKey: {},
  byMovie: {}
};
