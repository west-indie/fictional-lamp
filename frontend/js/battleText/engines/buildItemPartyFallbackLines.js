// frontend/js/battleText/buildItemPartyFallbackLines.js
//
// Centralized party-item fallback lines used by battle/actions.js.

import {
  PARTY_ITEM_HEAL_TEMPLATE,
  PARTY_ITEM_NO_EFFECT_TEMPLATE,
  UNKNOWN_ITEM_LABEL
} from "../lines/itemPartyFallbackText.js";

function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function buildUnknownItemLabel() {
  return UNKNOWN_ITEM_LABEL;
}

export function buildPartyItemHealFallbackLine(itemName, healedHp) {
  const name = String(itemName || buildUnknownItemLabel());
  const heal = Math.max(0, Math.round(Number(healedHp || 0)));
  return renderTemplate(PARTY_ITEM_HEAL_TEMPLATE, { name, heal });
}

export function buildPartyItemNoEffectFallbackLine(itemName) {
  const name = String(itemName || buildUnknownItemLabel());
  return renderTemplate(PARTY_ITEM_NO_EFFECT_TEMPLATE, { name });
}
