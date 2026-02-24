// frontend/js/battleText/lines/statusTickText.js
//
// Status tick/expiration templates.

export const STATUS_TICK_DEFAULT_ACTOR_NAME = "Actor";
export const STATUS_TICK_DEFAULT_ENEMY_NAME = "The enemy";

export const ACTOR_STATUS_EXPIRED_TEMPLATES = {
  atkBuffPct: "{who}'s ATK boost wore off.",
  atkDebuffPct: "{who}'s ATK penalty wore off.",
  defBuffPct: "{who}'s DEF boost wore off.",
  defDebuffPct: "{who}'s DEF penalty wore off.",
  damageReductionPct: "{who}'s damage reduction faded.",
  critChanceBuffPct: "{who}'s crit chance boost wore off.",
  critDamageBuffPct: "{who}'s crit damage boost wore off."
};

export const ENEMY_STATUS_EXPIRED_TEMPLATES = {
  atkDebuffPct: "{who}'s ATK recovers.",
  defDebuffPct: "{who}'s DEF recovers.",
  stun: "{who} is no longer stunned.",
  dazed: "{who} regains focus.",
  confused: "{who} is no longer confused.",
  actionLimit: "{who} can act freely again."
};

export const STATUS_EXPIRED_FALLBACK_TEMPLATE = "{who}'s status faded.";
