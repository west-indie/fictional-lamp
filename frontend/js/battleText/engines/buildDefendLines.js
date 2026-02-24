// frontend/js/battleText/buildDefendLines.js
//
// Phase 4A: centralized player defend narration.

import { PLAYER_DEFEND_TEMPLATE } from "../lines/defendLinesText.js";

function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function buildPlayerDefendLines({ actor }) {
  const defender = String(actor?.movie?.title || actor?.title || actor?.name || "Actor");
  return [renderTemplate(PLAYER_DEFEND_TEMPLATE, { defender })];
}
