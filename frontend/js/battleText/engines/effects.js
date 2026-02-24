// frontend/js/battleText/effects.js
//
// V2 effect-line generation + ranking (defaults).
// This file ONLY produces fallback effect text.
// Authored overrides (signatureEffectText) bypass this entirely.

import { joinNonEmpty, toInt } from "./format.js";
import {
  EFFECT_DAMAGE_TEMPLATE,
  EFFECT_DEFAULT_ENEMY_NAME,
  EFFECT_DR_TEMPLATE,
  EFFECT_EXPOSE_TEMPLATE,
  EFFECT_HEAL_TEMPLATE,
  EFFECT_REVIVE_TEMPLATE,
  EFFECT_SELF_DEF_FALL_TEMPLATE,
  EFFECT_SHIELD_TEMPLATE,
  EFFECT_STAT_FALL_TEMPLATE,
  EFFECT_STAT_RISE_TEMPLATE,
  EFFECT_STATUS_CONFUSED_TEMPLATE,
  EFFECT_STATUS_DAZED_TEMPLATE,
  EFFECT_STATUS_GENERIC_TEMPLATE,
  EFFECT_STATUS_STUN_TEMPLATE,
  EFFECT_TEAM_HEAL_TEMPLATE,
  EFFECT_UNKNOWN_NUMERIC_TEMPLATE,
  EFFECT_UNKNOWN_VALUE_TEMPLATE
} from "../lines/effectsText.js";

function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

/**
 * Default effect order (fallback only).
 * Narration files may reorder by phase later.
 */
export const EFFECT_PRIORITY = [
  // Damage / healing
  "damageDealt",
  "healedHp",
  "teamHeal",
  "revived",
  "revivedHp",

  // Mitigation
  "shieldAdded",
  "damageReductionPct",

  // Buffs
  "atkBuffPct",
  "defBuffPct",
  "critBuffPct",
  "evaBuffPct",
  "spdBuffPct",
  "accBuffPct",

  // Debuffs
  "enemyAtkDebuffPct",
  "enemyDefDebuffPct",
  "enemyCritDebuffPct",
  "enemyEvaDebuffPct",
  "enemySpdDebuffPct",
  "enemyAccDebuffPct",
  "selfDefDebuffPct",

  // FX / status
  "nextHitVulnPct",
  "statusApplied"
];

// Phase 3: keys observed in execution that should NEVER be narrated
const META_EFFECT_KEYS = new Set([
  // Turn counters
  "atkBuffTurns",
  "defBuffTurns",
  "buffTurns",
  "debuffTurns",
  "drTurns",
  "shieldTurns",
  "enemyAtkDebuffTurns",
  "enemyDefDebuffTurns",
  "selfDefDebuffTurns",
  "statusTurns",

  // “Applied” flags / meta markers (should never print)
  "anyDebuff",
  "atkBuffApplied",
  "defBuffApplied",
  "teamAtkBuffApplied",
  "teamDefBuffApplied",
  "enemyAtkDebuffApplied",
  "enemyDefDebuffApplied",
  "selfDefDebuffApplied",
  "shieldApplied",
  "damageReductionApplied",
  "nextHitVulnApplied",

  // Status container (we narrate statusApplied instead)
  "statusAppliedList"
]);

// Phase 3: alias keys observed in execution -> canonical narration keys
function normalizeEffects(effects) {
  if (!effects || typeof effects !== "object") return {};

  const e = { ...effects };

  // Strip meta counters
  for (const k of Object.keys(e)) {
    if (META_EFFECT_KEYS.has(k)) delete e[k];
  }

  // Aliases to canonical (based on your audit list)
  if (e.dmg != null && e.damageDealt == null) e.damageDealt = e.dmg;
  if (e.heal != null && e.healedHp == null) e.healedHp = e.heal;
  if (e.shield != null && e.shieldAdded == null) e.shieldAdded = e.shield;

  // teamDmg: treat as damageDealt for fallback narration
  if (e.teamDmg != null && e.damageDealt == null) e.damageDealt = e.teamDmg;

  // If only statusAppliedList exists, convert first entry into statusApplied
  if (e.statusApplied == null && Array.isArray(e.statusAppliedList) && e.statusAppliedList.length > 0) {
    e.statusApplied = e.statusAppliedList[0];
  }

  // Remove aliases so they can't fall through to default
  delete e.dmg;
  delete e.heal;
  delete e.shield;
  delete e.teamDmg;

  return e;
}

/**
 * Determine which effect keys are actually present.
 */
export function rankEffectKeys(effects) {
  if (!effects || typeof effects !== "object") return [];

  const present = new Set(
    Object.keys(effects).filter((k) => {
      const v = effects[k];

      // boolean-ish keys
      if (k === "nextHitVulnPct" || k === "statusApplied") return Boolean(v);

      // numeric keys
      return typeof v === "number" && v !== 0;
    })
  );

  const ordered = [];
  for (const k of EFFECT_PRIORITY) {
    if (present.has(k)) ordered.push(k);
  }

  // Any unknown keys come after, stable-ish
  for (const k of Object.keys(effects)) {
    if (!ordered.includes(k) && present.has(k)) ordered.push(k);
  }

  return ordered;
}

/**
 * Build default effect entries (key + line).
 * Caller decides ordering, grouping, and overrides.
 */
export function buildDefaultEffectEntries(ctx) {
  const effects = normalizeEffects(ctx?.effects || {});
  const keys = rankEffectKeys(effects);

  const target = ctx?.targetName || "target";
  const enemy = ctx?.enemyName || EFFECT_DEFAULT_ENEMY_NAME;

  const out = [];

  for (const k of keys) {
    const v = effects[k];

    switch (k) {
      // ---------------- DAMAGE ----------------
      case "damageDealt": {
        const dmg = toInt(v, 0);
        if (dmg > 0) {
          out.push({ key: k, line: renderTemplate(EFFECT_DAMAGE_TEMPLATE, { enemy, dmg }) });
        }
        break;
      }

      // ---------------- HEALING ----------------
      case "healedHp": {
        const heal = toInt(v, 0);
        if (heal > 0) {
          out.push({ key: k, line: renderTemplate(EFFECT_HEAL_TEMPLATE, { target, heal }) });
        }
        break;
      }

      case "teamHeal": {
        const heal = toInt(v, 0);
        if (heal > 0) {
          out.push({ key: k, line: renderTemplate(EFFECT_TEAM_HEAL_TEMPLATE, { heal }) });
        }
        break;
      }

      case "revived": {
        if (v) {
          out.push({ key: k, line: renderTemplate(EFFECT_REVIVE_TEMPLATE, { target }) });
        }
        break;
      }

      // ---------------- MITIGATION ----------------
      case "shieldAdded": {
        const amt = toInt(v, 0);
        if (amt > 0) {
          out.push({ key: k, line: renderTemplate(EFFECT_SHIELD_TEMPLATE, { target, amt }) });
        }
        break;
      }

      case "damageReductionPct": {
        const pct = Number(v || 0);
        if (pct > 0) {
          out.push({ key: k, line: renderTemplate(EFFECT_DR_TEMPLATE, { target, pct }) });
        }
        break;
      }

      // ---------------- BUFFS ----------------
      case "atkBuffPct":
      case "defBuffPct":
      case "critBuffPct":
      case "evaBuffPct":
      case "spdBuffPct":
      case "accBuffPct": {
        const pct = Number(v || 0);
        if (pct > 0) {
          const stat = k.replace("BuffPct", "").toUpperCase();
          out.push({ key: k, line: renderTemplate(EFFECT_STAT_RISE_TEMPLATE, { target, stat }) });
        }
        break;
      }

      // ---------------- DEBUFFS ----------------
      case "enemyAtkDebuffPct":
      case "enemyDefDebuffPct":
      case "enemyCritDebuffPct":
      case "enemyEvaDebuffPct":
      case "enemySpdDebuffPct":
      case "enemyAccDebuffPct": {
        const pct = Number(v || 0);
        if (pct > 0) {
          const stat = k
            .replace("enemy", "")
            .replace("DebuffPct", "")
            .toUpperCase();
          out.push({ key: k, line: renderTemplate(EFFECT_STAT_FALL_TEMPLATE, { enemy, stat }) });
        }
        break;
      }

      case "selfDefDebuffPct": {
        const pct = Number(v || 0);
        if (pct > 0) {
          out.push({ key: k, line: renderTemplate(EFFECT_SELF_DEF_FALL_TEMPLATE, { target, pct }) });
        }
        break;
      }


      // ---------------- FX / STATUS ----------------
      case "nextHitVulnPct": {
        if (Number(v || 0) > 0) {
          out.push({ key: k, line: renderTemplate(EFFECT_EXPOSE_TEMPLATE, { enemy }) });
        }
        break;
      }

      case "statusApplied": {
        if (v) {
          const s = String(v).toLowerCase();

          if (s.includes("confus")) {
            out.push({ key: k, line: renderTemplate(EFFECT_STATUS_CONFUSED_TEMPLATE, { enemy }) });
          } else if (s.includes("dazed")) {
            out.push({ key: k, line: renderTemplate(EFFECT_STATUS_DAZED_TEMPLATE, { enemy }) });
          } else if (s.includes("stun")) {
            out.push({ key: k, line: renderTemplate(EFFECT_STATUS_STUN_TEMPLATE, { enemy }) });
          } else {
            out.push({ key: k, line: renderTemplate(EFFECT_STATUS_GENERIC_TEMPLATE, { enemy, status: String(v) }) });
          }
        }
        break;
      }

      // ---------------- FALLBACK ----------------
      default: {
        if (typeof v === "number") {
          out.push({ key: k, line: renderTemplate(EFFECT_UNKNOWN_NUMERIC_TEMPLATE, { key: k, value: toInt(v, 0) }) });
        } else if (v) {
          out.push({ key: k, line: renderTemplate(EFFECT_UNKNOWN_VALUE_TEMPLATE, { key: k, value: String(v) }) });
        }
      }
    }
  }

  return out;
}

/**
 * Convenience: return lines only.
 */
export function buildDefaultEffectLines(ctx) {
  return joinNonEmpty(buildDefaultEffectEntries(ctx).map((e) => e.line));
}
