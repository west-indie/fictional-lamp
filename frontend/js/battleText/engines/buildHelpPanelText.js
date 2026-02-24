// frontend/js/battleText/buildHelpPanelText.js
//
// Centralized battle help-panel text builder.

import { buildTargetLabel } from "./targets.js";
import {
  ACTION_DESCRIPTIONS as BT_ACTION_DESCRIPTIONS,
  buildItemHelpText,
  buildItemTargetBody,
  HELP_PANEL_TEXT,
  HELP_PANEL_RUNTIME_TEXT
} from "./helpPanelText.js";
import { buildNoSpecialSelectedLine, buildNoSpecialsAvailableLine } from "./corePrompts.js";
import { normalizeTargetTags as normalizeTags } from "../../systems/specialTags.js";

export const ACTION_DESCRIPTIONS = BT_ACTION_DESCRIPTIONS;

function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

// ---------------- SPECIAL HELP (TAGS + COMBO RULES) ----------------

function normalizeTargetTags(target) {
  const tags = normalizeTags(target);
  return tags.map((t) => (t === "team_strike" ? "teamstrike" : t));
}

function hasAll(tags, required) {
  for (const r of required) if (!tags.includes(r)) return false;
  return true;
}

function getSpecialKind(sp) {
  return String(sp?.sigKind ?? sp?.kind ?? "").trim();
}

function matchesComboRule(sp, tags, rule) {
  if (rule.requires && !hasAll(tags, rule.requires)) return false;

  if (rule.requiresAny && Array.isArray(rule.requiresAny) && rule.requiresAny.length) {
    const ok = rule.requiresAny.some((t) => tags.includes(t));
    if (!ok) return false;
  }

  if (rule.requiresKind) {
    const kinds = Array.isArray(rule.requiresKind) ? rule.requiresKind : [rule.requiresKind];
    const k = getSpecialKind(sp);
    if (!kinds.includes(k)) return false;
  }

  return true;
}

const SPECIAL_HELP_COMBOS = [
  {
    id: "team_teamstrike_buff",
    requires: ["team", "teamstrike", "buff"],
    build() {
      return { bodySuffix: HELP_PANEL_RUNTIME_TEXT.specialComboSuffix.teamTeamstrikeBuff };
    }
  },
  {
    id: "team_teamstrike",
    requires: ["team", "teamstrike"],
    build() {
      return { bodySuffix: HELP_PANEL_RUNTIME_TEXT.specialComboSuffix.teamTeamstrike };
    }
  },
  {
    id: "ally_heal_revive",
    requires: ["ally", "heal", "revive"],
    build() {
      return { bodySuffix: HELP_PANEL_RUNTIME_TEXT.specialComboSuffix.allyHealRevive };
    }
  },
  {
    id: "ally_revive",
    requires: ["ally", "revive"],
    build: () => ({ bodySuffix: HELP_PANEL_RUNTIME_TEXT.specialComboSuffix.allyRevive })
  },
  { id: "ally_heal", requires: ["ally", "heal"], build: () => ({ bodySuffix: HELP_PANEL_RUNTIME_TEXT.specialComboSuffix.allyHeal }) },
  {
    id: "enemy_fx",
    requires: ["enemy"],
    requiresAny: ["fx", "atkdown", "defdown", "critdown", "vuln", "status", "debuff"],
    build: () => ({ bodySuffix: HELP_PANEL_RUNTIME_TEXT.specialComboSuffix.enemyFx })
  },
  { id: "team_base", requires: ["team"], build: () => ({ bodySuffix: HELP_PANEL_RUNTIME_TEXT.specialComboSuffix.teamBase }) },
  { id: "self_base", requires: ["self"], build: () => ({ bodySuffix: HELP_PANEL_RUNTIME_TEXT.specialComboSuffix.selfBase }) },
  { id: "ally_base", requires: ["ally"], build: () => ({ bodySuffix: HELP_PANEL_RUNTIME_TEXT.specialComboSuffix.allyBase }) },
  { id: "enemy_base", requires: ["enemy"], build: () => ({ bodySuffix: HELP_PANEL_RUNTIME_TEXT.specialComboSuffix.enemyBase }) }
];

function buildComboSuffix(sp) {
  const tags = normalizeTargetTags(sp?.target);
  for (const rule of SPECIAL_HELP_COMBOS) {
    if (matchesComboRule(sp, tags, rule)) {
      const built = rule.build(sp, tags);
      return String(built?.bodySuffix || "").trim();
    }
  }
  return "";
}

function buildQuotedDescriptionLine(sp) {
  const desc = String(sp?.description || "").trim();
  const suffix = buildComboSuffix(sp);
  const parts = [];
  if (desc) parts.push(`"${desc}"`);
  if (suffix) parts.push(suffix);
  if (!parts.length) return HELP_PANEL_RUNTIME_TEXT.fallbackDescriptionQuoted;
  return parts.join(" ");
}

function defaultGetSpecialHelpText(sp) {
  if (!sp) return buildNoSpecialSelectedLine();

  const targetSummary = buildTargetLabel(sp);
  const cd = Number(sp.cooldownRemaining || 0);
  const cdText = cd > 0
    ? renderTemplate(HELP_PANEL_RUNTIME_TEXT.status.cooldownTemplate, { cd })
    : HELP_PANEL_RUNTIME_TEXT.status.ready;

  const line1 = buildQuotedDescriptionLine(sp);
  const line2 = renderTemplate(HELP_PANEL_RUNTIME_TEXT.bodyTemplate.specialSecondLine, { targetSummary, cdText });
  return `${line1}\n${line2}`;
}

function joinHints(hints = []) {
  return hints.length ? hints.join("  |  ") : "";
}

export function getBattleHelpPanelText(ctx = {}) {
  const {
    phase,
    uiMode,
    actor,
    isMessageBusy,
    actions = [],
    actionIndex = 0,
    actionDescriptions = ACTION_DESCRIPTIONS,
    confirmAction,
    inventory = [],
    itemIndex = 0,
    getInventoryItemDef,
    pendingItemIndex = -1,
    targetIndex = 0,
    party = [],
    specialsList = [],
    specialIndex = 0,
    pendingSpecial,
    canToggleSpecialPages,
    getSpecialPageCount
  } = ctx;

  if (phase !== "player") return null;
  if (typeof isMessageBusy === "function" && isMessageBusy()) return null;

  const actorName = actor?.movie?.title ? actor.movie.title : actor?.name || HELP_PANEL_RUNTIME_TEXT.fallback.actorName;

  if (uiMode === "confirm") {
    const a = confirmAction || HELP_PANEL_RUNTIME_TEXT.fallback.action;
    return {
      title: renderTemplate(HELP_PANEL_RUNTIME_TEXT.titleTemplate.confirm, { actorName, action: a }),
      body: ""
    };
  }

  if (uiMode === "command") {
    const action = actions[actionIndex] || HELP_PANEL_RUNTIME_TEXT.fallback.action;
    return {
      title: renderTemplate(HELP_PANEL_RUNTIME_TEXT.titleTemplate.command, { actorName }),
      body: actionDescriptions[action] || HELP_PANEL_TEXT.chooseAction
    };
  }

  if (uiMode === "item") {
    const entry = inventory[itemIndex];
    const hints = [];
    if (ctx.itemPageCount && ctx.itemPageCount > 1) hints.push(HELP_PANEL_RUNTIME_TEXT.hints.toggle);
    hints.push(HELP_PANEL_RUNTIME_TEXT.hints.back);

    return {
      title: renderTemplate(HELP_PANEL_RUNTIME_TEXT.titleTemplate.item, { actorName, hints: joinHints(hints) }),
      body: entry ? buildItemHelpText(entry, getInventoryItemDef) : HELP_PANEL_TEXT.noItemsAvailable
    };
  }

  if (uiMode === "itemTarget") {
    const entry = pendingItemIndex >= 0 ? inventory[pendingItemIndex] : null;
    const def = entry && getInventoryItemDef ? getInventoryItemDef(entry) : null;
    const target = party[targetIndex];
    const targetName = target?.movie?.title || target?.name || HELP_PANEL_RUNTIME_TEXT.fallback.targetName;
    return {
      title: renderTemplate(HELP_PANEL_RUNTIME_TEXT.titleTemplate.itemTarget, { actorName }),
      body: buildItemTargetBody({ itemDef: def, targetName })
    };
  }

  if (uiMode === "special") {
    const sp = specialsList[specialIndex];
    const hints = [];
    if (actor && typeof canToggleSpecialPages === "function" && canToggleSpecialPages(actor)) {
      const movieId = actor?.movie?.id;
      const count = typeof getSpecialPageCount === "function" ? getSpecialPageCount(movieId) : 0;
      if (count > 1) hints.push(HELP_PANEL_RUNTIME_TEXT.hints.toggle);
    }
    hints.push(HELP_PANEL_RUNTIME_TEXT.hints.back);

    const moveName = sp?.name ? sp.name : HELP_PANEL_RUNTIME_TEXT.fallback.moveName;
    return {
      title: renderTemplate(HELP_PANEL_RUNTIME_TEXT.titleTemplate.special, {
        actorName,
        moveName,
        hints: joinHints(hints)
      }),
      body: sp ? defaultGetSpecialHelpText(sp) : buildNoSpecialsAvailableLine()
    };
  }

  if (uiMode === "specialTarget") {
    const sp = pendingSpecial;
    const moveName = sp?.name ? sp.name : HELP_PANEL_RUNTIME_TEXT.fallback.moveName;
    const target = party[targetIndex];
    const targetName = target?.movie?.title || target?.name || HELP_PANEL_RUNTIME_TEXT.fallback.targetName;
    return {
      title: renderTemplate(HELP_PANEL_RUNTIME_TEXT.titleTemplate.specialTarget, { actorName, moveName }),
      body: renderTemplate(HELP_PANEL_RUNTIME_TEXT.bodyTemplate.specialTargetArrow, { moveName, targetName })
    };
  }

  return {
    title: renderTemplate(HELP_PANEL_RUNTIME_TEXT.titleTemplate.command, { actorName }),
    body: HELP_PANEL_TEXT.chooseAction
  };
}
