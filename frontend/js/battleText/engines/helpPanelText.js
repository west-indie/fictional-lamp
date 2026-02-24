// frontend/js/battleText/engines/helpPanelText.js
//
// Help-panel text helpers that format line data for UI use.

import { ACTION_DESCRIPTIONS, HELP_PANEL_RUNTIME_TEXT, HELP_PANEL_TEXT } from "../lines/helpPanelText.js";

export { ACTION_DESCRIPTIONS, HELP_PANEL_TEXT, HELP_PANEL_RUNTIME_TEXT };

function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function buildItemHelpText(entry, getInventoryItemDef) {
  const def = getInventoryItemDef ? getInventoryItemDef(entry) : null;
  if (!def) return HELP_PANEL_TEXT.unknownItem;
  if (def.description) return def.description;

  const name = def.name || HELP_PANEL_RUNTIME_TEXT.fallback.itemName;
  const tgt = def.target || "self";
  if (tgt === "ally") return renderTemplate(HELP_PANEL_RUNTIME_TEXT.bodyTemplate.itemHelpAlly, { name });
  if (tgt === "self") return renderTemplate(HELP_PANEL_RUNTIME_TEXT.bodyTemplate.itemHelpSelf, { name });
  return renderTemplate(HELP_PANEL_RUNTIME_TEXT.bodyTemplate.itemHelpGeneric, { name });
}

export function buildItemTargetBody({ itemDef, targetName }) {
  const itemName = itemDef?.name || HELP_PANEL_RUNTIME_TEXT.fallback.itemName;
  return renderTemplate(HELP_PANEL_RUNTIME_TEXT.bodyTemplate.specialTargetArrow, {
    moveName: itemName,
    targetName: targetName || HELP_PANEL_RUNTIME_TEXT.fallback.targetName
  });
}
