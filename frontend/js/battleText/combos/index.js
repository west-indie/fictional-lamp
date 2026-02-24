// frontend/js/battleText/combos/index.js
//
// V2 combo narration (Tier 1).
// Each combo lives in its own file for easy expansion.
//
// A combo can:
// - replace one or more default effect lines (by effect key)
// - inject extra lines after the headline
//
// NOTE: These combos only run when the special DOES NOT have explicit custom text
// (intro/outro authored via signatureEffectText / registry, or inline `special.text`).

import { pickAlt, hpMarker, shortName, joinNonEmpty } from "../engines/format.js";
import { buildDefaultEffectEntries } from "../engines/effects.js";
import { normalizeTargetTags } from "../engines/targets.js";

// Individual combos (one file each)
import { combo as lifesteal } from "./lifesteal.js";
import { combo as vampiricStrike } from "./vampiricStrike.js";
import { combo as rallyStrike } from "./rallyStrike.js";
import { combo as sabotage } from "./sabotage.js";
import { combo as hexStrike } from "./hexStrike.js";
import { combo as supportAssault } from "./supportAssault.js";
import { combo as seven } from "./seven.js";

// ✅ New Tier-1 combos (added)
import { combo as wardrums } from "./wardrums.js";
import { combo as chargeStrike } from "./chargeStrike.js";
import { combo as cripplingBlow } from "./cripplingBlow.js";

const COMBOS = [
  lifesteal,
  vampiricStrike,
  rallyStrike,
  sabotage,
  hexStrike,
  supportAssault,
  seven,
  wardrums,
  chargeStrike,
  cripplingBlow
];

function countNumericEffects(effects) {
  if (!effects || typeof effects !== "object") return 0;
  let n = 0;
  for (const [k, v] of Object.entries(effects)) {
    if (k === "statusApplied") {
      if (v) n += 1;
    } else if (typeof v === "number" && v !== 0) {
      n += 1;
    }
  }
  return n;
}

export function buildHeadline({ actor, special, targetName }) {
  const a = shortName(actor, 10);
  const move = special?.name || "Special";
  // If a direct ally target exists, include it (keeps your old feel).
  if (targetName && targetName !== "the team" && targetName !== "the enemy" && targetName !== a) {
    return `${a} uses ${move} on ${targetName}!`;
  }
  return `${a} uses ${move}!`;
}

/**
 * Build V2 lines for a special:
 * - headline
 * - (optional) combo narration / replacements
 * - remaining default effect lines in ranked order
 *
 * Returns { lines, appliedComboId }.
 */
export function buildV2SpecialLines({ actor, party, enemy, special, targetName, enemyName, effects }) {
  const headline = buildHeadline({ actor, special, targetName });

  // If there's 0-1 effects, don't force combos; keep it clean.
  const effectCount = countNumericEffects(effects);

  const baseEntries = buildDefaultEffectEntries({
    actorName: shortName(actor, 10),
    targetName: targetName || "target",
    enemyName: enemyName || "the enemy",
    effects
  });

  const tags = normalizeTargetTags(special?.target);

  const ctx = {
    actor,
    party,
    enemy,
    special,
    tags,
    targetName: targetName || "",
    enemyName: enemyName || "the enemy",
    effects,
    hpMarker,
    pickAlt
  };

  let applied = null;
  let entries = baseEntries.slice();
  let injected = [];

  if (effectCount >= 2) {
    for (const c of COMBOS) {
      if (c && typeof c.match === "function" && c.match(ctx)) {
        applied = c.id || "combo";
        const built = c.build(ctx) || {};
        injected = Array.isArray(built.injectAfterHeadline) ? built.injectAfterHeadline : [];

        const replace = built.replaceEffectLines || {};
        if (replace && typeof replace === "object") {
          entries = entries
            .map((e) => {
              if (!e || !e.key) return e;
              const rep = replace[e.key];
              if (!rep) return e;
              const repLines = Array.isArray(rep) ? rep : [rep];
              // Replace a single entry with N entries of the same key (so ordering is preserved).
              return repLines.map((line) => ({ key: e.key, line }));
            })
            .flat();
        }

        const drop = new Set(Array.isArray(built.dropEffectKeys) ? built.dropEffectKeys : []);
        if (drop.size) entries = entries.filter((e) => !drop.has(e.key));

        break; // first match wins
      }
    }
  }

  const lines = joinNonEmpty([headline, ...injected, ...entries.map((e) => e.line)]);
  return { lines, appliedComboId: applied };
}

export function listCombos() {
  return COMBOS.map((c) => ({ id: c.id, name: c.name || c.id }));
}
