// frontend/js/ui/battleHelpPanel.js
//
// Pure helper that generates the battle help panel content (title/body)
// based on the current UI mode + selection.
//
// ✅ Combo-tag targets:
// - `special.target` can be a string OR an array of tags.
// - We derive one or more BASE target labels for UI text:
//   SELF | TARGET ALLY | TARGET ENEMY | AFFECTS TEAM
// - Extra tags ("teamStrike", "buff", "heal", "revive", "debuff", etc.)
//   can drive combo descriptions.
//
// Your requested formatting (special menu):
// (Actor): <Move Name>
// Space: Toggle | Backspace: Back
// "<Move description> <combo text>"
// TARGET ENEMY + AFFECTS TEAM | Ready
//
// Notes:
// - "Target: Team" is removed entirely.
// - The old combo header line (e.g. "AFFECTS TEAM") is moved into the final status line.
// - The body is intentionally 2 lines: quote line + final status line.

export const ACTION_DESCRIPTIONS = {
  ATTACK: "Deal damage to the enemy based on this movie's ATK. Can crit.",
  DEFEND: "Brace for impact. Incoming damage is reduced until your next turn.",
  ITEM: "Use an item from your inventory. Some items target allies.",
  SPECIAL: "Open your special moves menu (signature + genre moves).",
  RUN: "Attempt to escape. (Prototype note: escaping isn't supported yet.)"
};

function defaultGetItemHelpText(entry, getInventoryItemDef) {
  const def = getInventoryItemDef ? getInventoryItemDef(entry) : null;
  if (!def) return "Unknown item.";
  if (def.description) return def.description;

  const name = def.name || "Item";
  const tgt = def.target || "self";
  if (tgt === "ally") return `${name}: choose an ally to use it on.`;
  if (tgt === "self") return `${name}: use on yourself.`;
  return `${name}: use it.`;
}

// ---------------- SPECIAL HELP (TAG + COMBO SYSTEM) ----------------

function normalizeTargetTags(target) {
  if (Array.isArray(target)) return target.filter(Boolean).map(String);
  if (typeof target === "string" && target.trim()) return [target.trim()];
  return [];
}

function hasAll(tags, required) {
  for (const r of required) if (!tags.includes(r)) return false;
  return true;
}

function getBaseTargetsFromTags(tags) {
  // Return a SET of base target tags present.
  // Supports specials that may include both "enemy" and "team".
  const bases = new Set();

  if (tags.includes("self")) bases.add("self");
  if (tags.includes("ally")) bases.add("ally");
  if (tags.includes("enemy")) bases.add("enemy");

  if (tags.includes("team") || tags.includes("party")) bases.add("team");

  // If none specified, default to enemy (matches your older behavior)
  if (bases.size === 0) bases.add("enemy");

  return bases;
}

function labelForBaseTarget(base) {
  if (base === "self") return "FOR SELF";
  if (base === "ally") return "TARGET ALLY";
  if (base === "team") return "AFFECTS TEAM";
  return "TARGET ENEMY";
}

function buildTargetSummary(tags) {
  const bases = getBaseTargetsFromTags(tags);

  // Order matters: user example wants ENEMY first, then TEAM.
  const order = ["enemy", "team", "ally", "self"];
  const parts = [];

  for (const k of order) {
    if (bases.has(k)) parts.push(labelForBaseTarget(k));
  }

  return parts.join(" + ");
}

function matchesComboRule(sp, tags, rule) {
  if (rule.requires && !hasAll(tags, rule.requires)) return false;

  if (rule.requiresKind) {
    const kinds = Array.isArray(rule.requiresKind) ? rule.requiresKind : [rule.requiresKind];
    if (!kinds.includes(sp?.kind)) return false;
  }

  return true;
}

/**
 * Combo rules only return a SHORT suffix that gets appended to the move description
 * in the quoted body line.
 *
 * Keep these short on purpose (the help box is small).
 * Most specific first.
 */
const SPECIAL_HELP_COMBOS = [
  // Enemy + Team + TeamStrike + Buff: keep wording light (your request)
  {
    id: "enemy_team_teamStrike_buff",
    requires: ["enemy", "team", "teamStrike", "buff"],
    build() {
      return { bodySuffix: "Affects the enemy." };
    }
  },

  // Team buff + team strike (no explicit enemy tag): keep wording light
  {
    id: "team_teamStrike_buff",
    requires: ["team", "teamStrike", "buff"],
    build() {
      return { bodySuffix: "Then a team strike takes place." };
    }
  },

  // Team strike (generic)
  {
    id: "team_teamStrike",
    requires: ["team", "teamStrike"],
    build() {
      return { bodySuffix: "A team strike takes place." };
    }
  },

  // Ally heal/revive combo
  {
    id: "ally_heal_revive",
    requires: ["ally", "heal", "revive"],
    build() {
      return { bodySuffix: "Revives if down, heals if alive." };
    }
  },

  // Ally revive
  { id: "ally_revive", requires: ["ally", "revive"], build: () => ({ bodySuffix: "Revives a downed ally." }) },

  // Ally heal
  { id: "ally_heal", requires: ["ally", "heal"], build: () => ({ bodySuffix: "Heals a chosen ally." }) },

  // Enemy debuff
  { id: "enemy_debuff", requires: ["enemy", "debuff"], build: () => ({ bodySuffix: "Weakens the enemy for a limited time." }) },

  // Base fallbacks
  { id: "team_base", requires: ["team"], build: () => ({ bodySuffix: "Applies an effect to all living allies." }) },
  { id: "self_base", requires: ["self"], build: () => ({ bodySuffix: "Applies an effect to self." }) },
  { id: "ally_base", requires: ["ally"], build: () => ({ bodySuffix: "Choose an ally." }) },
  { id: "enemy_base", requires: ["enemy"], build: () => ({ bodySuffix: "Affects the enemy." }) }
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

  // Quotes ONLY around the authored description
  if (desc) {
    parts.push(`"${desc}"`);
  }

  // System-generated explanation stays OUTSIDE quotes
  if (suffix) {
    parts.push(suffix);
  }

  if (!parts.length) return `"…"`;

  return parts.join(" ");
}

function defaultGetSpecialHelpText(sp) {
  if (!sp) return "No special selected.";

  const tags = normalizeTargetTags(sp?.target);
  const targetSummary = buildTargetSummary(tags);

  const cd = Number(sp.cooldownRemaining || 0);
  const cdText = cd > 0 ? `CD: ${cd}` : "Ready";

  const line1 = buildQuotedDescriptionLine(sp);
  const line2 = `${targetSummary} | ${cdText}`;

  // Two lines max (your box is small)
  return `${line1}\n${line2}`;
}

function joinHints(hints = []) {
  return hints.length ? hints.join("  |  ") : "";
}

// ---------------- MAIN EXPORT ----------------

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

  const actorName = actor?.movie?.title ? actor.movie.title : "Actor";

  if (uiMode === "confirm") {
    const a = confirmAction || "ACTION";
    return {
      title: `(${actorName}): Confirm ${a}?\nEnter: Confirm  |  Backspace: Back`,
      body: ""
    };
  }

  if (uiMode === "command") {
    const action = actions[actionIndex] || "ACTION";
    return {
      title: `${actorName}: Choose an Action.`,
      body: actionDescriptions[action] || "Choose an action."
    };
  }

  if (uiMode === "item") {
    const entry = inventory[itemIndex];

    const hints = [];
    if (ctx.itemPageCount && ctx.itemPageCount > 1) hints.push("Space: Toggle");
    hints.push("Backspace: Back");

    return {
      title: `(${actorName}): Choose an Item.\n${joinHints(hints)}`,
      body: entry ? defaultGetItemHelpText(entry, getInventoryItemDef) : "No items available."
    };
  }

  if (uiMode === "itemTarget") {
    const entry = pendingItemIndex >= 0 ? inventory[pendingItemIndex] : null;
    const def = entry && getInventoryItemDef ? getInventoryItemDef(entry) : null;
    const itemName = def?.name || "Item";
    const target = party[targetIndex];
    const targetName = target?.movie?.title || "Target";
    return {
      title: `(${actorName}): Choose a Target.\nBackspace: Back`,
      body: `${itemName} → ${targetName}`
    };
  }

  if (uiMode === "special") {
    const sp = specialsList[specialIndex];

    const hints = [];
    if (actor && typeof canToggleSpecialPages === "function" && canToggleSpecialPages(actor)) {
      const movieId = actor?.movie?.id;
      const count = typeof getSpecialPageCount === "function" ? getSpecialPageCount(movieId) : 0;
      if (count > 1) hints.push("Space: Toggle");
    }
    hints.push("Backspace: Back");

    // ✅ Your request: replace "Choose a Special" with the move name
    const moveName = sp?.name ? sp.name : "Special";

    return {
      title: `(${actorName}): Special — ${moveName}\n${joinHints(hints)}`,
      body: sp ? defaultGetSpecialHelpText(sp) : "No specials available."
    };
  }

  if (uiMode === "specialTarget") {
    const sp = pendingSpecial;
    const moveName = sp?.name ? sp.name : "Special";

    // keep the target picker hinting intact (you didn't ask to change this)
    const target = party[targetIndex];
    const targetName = target?.movie?.title || "Target";

    return {
      title: `(${actorName}): ${moveName}\nBackspace: Back`,
      body: `${moveName} → ${targetName}`
    };
  }

  return {
    title: `(${actorName}): Choose an Action.`,
    body: "Choose an action."
  };
}
