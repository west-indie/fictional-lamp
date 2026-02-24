// frontend/js/battleText/lines/helpPanelText.js
//
// Shared help-panel copy/templates so UI can consume centralized battle text.

export const ACTION_DESCRIPTIONS = {
  ATTACK: "Deal damage to the enemy based on this movie's ATK. Can crit.",
  DEFEND: "Brace for impact. Incoming damage is reduced until your next turn.",
  ITEM: "Use an item from your inventory. Some items target allies.",
  SPECIAL: "Open your special moves menu (signature + genre moves).",
  RUN: "Attempt to escape."
};

export const HELP_PANEL_TEXT = {
  chooseAction: "Choose an action.",
  unknownItem: "Unknown item.",
  noItemsAvailable: "No items available."
};

export const HELP_PANEL_RUNTIME_TEXT = {
  fallbackDescriptionQuoted: "\"...\"",
  specialComboSuffix: {
    teamTeamstrikeBuff: "Then a team strike takes place.",
    teamTeamstrike: "A team strike takes place.",
    allyHealRevive: "Revives if down, heals if alive.",
    allyRevive: "Revives a downed ally.",
    allyHeal: "Heals a chosen ally.",
    enemyFx: "Applies an effect.",
    teamBase: "Applies an effect to all living allies.",
    selfBase: "Applies an effect to self.",
    allyBase: "Choose an ally.",
    enemyBase: "Affects the enemy."
  },
  hints: {
    toggle: "Space: Toggle",
    back: "Backspace: Back"
  },
  titleTemplate: {
    confirm: "({actorName}): Confirm {action}?\nEnter: Confirm  |  Backspace: Back",
    command: "{actorName}: Choose an Action.",
    item: "({actorName}): Choose an Item.\n{hints}",
    itemTarget: "({actorName}): Choose a Target.\nBackspace: Back",
    special: "({actorName}): Special - {moveName}\n{hints}",
    specialTarget: "({actorName}): {moveName}\nBackspace: Back"
  },
  bodyTemplate: {
    specialSecondLine: "{targetSummary} | {cdText}",
    specialTargetArrow: "{moveName} -> {targetName}",
    itemHelpAlly: "{name}: choose an ally to use it on.",
    itemHelpSelf: "{name}: use on yourself.",
    itemHelpGeneric: "{name}: use it."
  },
  status: {
    ready: "Ready",
    cooldownTemplate: "CD: {cd}"
  },
  fallback: {
    itemName: "Item",
    targetName: "Target",
    actorName: "Actor",
    action: "ACTION",
    moveName: "Special"
  }
};
