// frontend/js/battleText/lines/enemyTurnText.js
//
// Enemy-turn narration templates.

export const PARTY_FALLEN = "Your party has fallen...";
export const PARTY_FALLEN_PROMPT = "Your party has fallen... Press Enter to return to menu.";
export const ENEMY_STRIKES_FALLBACK = "The enemy strikes.";
export const ENEMY_ACTS_FALLBACK = "The enemy acts.";
export const ENEMY_TURN_DEFAULT_ENEMY_NAME = "The enemy";
export const ENEMY_TURN_DEFAULT_TARGET_NAME = "A party member";
export const ENEMY_TURN_DEFAULT_MOVE_NAME = "Attack";
export const ENEMY_TURN_GENERIC_TARGET_NAME = "target";

export const ENEMY_TURN_DISRUPTED_FUNNY = "The enemy is thrown off by your party's comedy! Their turn fails.";
export const ENEMY_STUNNED_SKIP_TEMPLATE = "{enemyName} is stunned and can't act!";
export const ENEMY_MOVE_UNKNOWN_TEMPLATE = "{enemyName} tries something strange...";
export const ENEMY_MISS_DAZED_TEMPLATE = "{enemyName} uses {moveName}... but they look dazed and miss!";
export const ENEMY_CONFUSED_MISFIRE_TEMPLATE = "{enemyName} tries {moveName}... but confusion causes a misfire!";
export const ENEMY_CONFUSED_SELF_HEAL_TEMPLATE = "{enemyName} acts unpredictably and restores {healed} HP!";
export const ENEMY_CONFUSED_WILD_MISS_TEMPLATE = "{enemyName} tries {moveName}... but confusion ruins their aim!";
export const ENEMY_CONFUSED_LOW_ACC_HIT_TEMPLATE = "{enemyName} lashes out through confusion with shaky accuracy!";
export const ENEMY_CONFUSION_CLEARED_TEMPLATE = "{enemyName} shakes off the confusion.";
export const ENEMY_ATTACK_MORTAL_TEMPLATE = "{enemyName} uses {moveName} on {targetName}! {targetName} is taking mortal damage!";
export const ENEMY_ATTACK_CRIT_TEMPLATE = "{enemyName} uses {moveName}! CRITICAL on {targetName} for {totalDmg}!";
export const ENEMY_ATTACK_NORMAL_TEMPLATE = "{enemyName} uses {moveName} on {targetName} for {totalDmg}.";
export const ENEMY_ATTACK_SPLIT_SHIELD_HP_TEMPLATE = " ({shieldDmg} shield, {hpDmg} HP)";
export const ENEMY_ATTACK_SHIELD_ONLY_TEMPLATE = " ({shieldDmg} shield)";
export const ENEMY_ATTACK_GUARDED_SUFFIX_TEMPLATE = " {targetName} guarded the blow.";
export const TARGET_KNOCKED_OUT_TEMPLATE = "{targetName} is knocked out!";
