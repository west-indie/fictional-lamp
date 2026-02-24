// frontend/js/battleText/lines/corePromptsText.js
//
// Shared message-box prompt lines and templates.

export const BATTLE_ACTION_LABELS = ["ATTACK", "DEFEND", "ITEM", "SPECIAL", "RUN"];

export const BATTLE_MENU_LABELS = {
  back: "Back",
  toggle: "Toggle",
  confirm: "Confirm",
  pause: "Pause",
  unknown: "Unknown",
  item: "Item",
  special: "Special"
};

export const RUN_UNAVAILABLE_LINES = [
  "You try to run away...",
  "but this prototype doesn't support escaping yet.",
  "Press Enter to return to menu."
];

export const CORE_DEFAULT_ENEMY_NAME = "The enemy";
export const ENEMY_BACKED_DOWN_TEMPLATE = "{enemyName} has backed down!";
export const ENEMY_DEFEATED_TEMPLATE = "{enemyName} is defeated!";
export const PRESS_ENTER_CONTINUE = "Press Enter to continue.";
export const PRESS_ENTER_CONTINUE_BANG = "Press Enter to continue!";
export const PRESS_ENTER_CONTINUE_PHASE = "Press Enter to Continue.";
export const QUIRKY_EXTRA_TURN = "Quirky energy! They get another action!";
export const NO_SPECIALS_AVAILABLE = "No specials available.";
export const NOTHING_HAPPENS = "Nothing happens.";
export const NO_VALID_ACTOR = "No valid actor.";
export const NO_SPECIAL_SELECTED = "No special selected.";
export const CANT_USE_RIGHT_NOW_TEMPLATE = "{actorName} can't use that right now.";
export const SPECIAL_COOLDOWN_TEMPLATE = "{name} is on cooldown ({n} turn{plural}).";
export const NO_VALID_ALLY_TARGETS = "No valid ally targets.";
export const SPECIAL_WRONG_TARGET = "That special doesn't target an ally.";
export const INVALID_TARGET = "Invalid target.";
export const SPECIAL_USED_FALLBACK = "Special used.";
export const NO_ITEMS_MENU = "No items!";
export const NO_SPECIALS_MENU = "No specials!";
