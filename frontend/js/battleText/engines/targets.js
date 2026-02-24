// frontend/js/battleText/targets.js
//
// V2 target label builder (help panel).
//
// Framework (exact style):
// - TARGET ENEMY (...) + TARGET ALLY (...)
// - AFFECTS TEAM (...) + TARGET ENEMY (...)
// - FOR SELF (...) + TARGET ENEMY (...)
//
// Marker order inside parentheses:
// DMG → HEAL → buffs (+ATK/+DEF/...) → debuffs (-ATK/-DEF/...) → FX
//
// ✅ Updated:
// - Marker tokens now infer from:
//   (1) target tags (legacy / author intent)
//   (2) genre special data (special.data.*)
//   (3) signature fields (top-level special.*)
//   (4) ✅ NEW: dualEffect sub-effects (special.effects[])
//
// So ALL genre + signature specials show accurate markers even if tags are missing.

import { combineMarkers, normalizeMarkerToken } from "./format.js";
import { normalizeTargetTags as normalizeTags } from "../../systems/specialTags.js";
import { TARGET_LABELS } from "../lines/targetsText.js";

// If you created Step B inferMarkers.js, we’ll use it.
// If not present in your build yet, you can remove this import AND the call below.
import { inferMarkersFromDataForBase } from "./inferMarkers.js";

const BASE_TARGETS = ["self", "ally", "team", "enemy"];

export function normalizeTargetTags(target) {
  return normalizeTags(target);
}

export function getBaseTargetsFromTags(tags) {
  const set = new Set(tags);
  const bases = [];

  for (const b of BASE_TARGETS) if (set.has(b)) bases.push(b);
  if (set.has("party") && !set.has("team")) bases.push("team");

  if (bases.length === 0) bases.push("enemy");
  return bases;
}

export function deriveMarkersFromEffects(effects) {
  const markers = new Set();

  if (!effects || typeof effects !== "object") return [];

  // Damage
  if (effects.damageDealt > 0 || effects.teamDmg > 0) {
    markers.add("DMG");
  }

  // Healing
  if (
    effects.healedHp > 0 ||
    effects.teamHeal > 0 ||
    effects.revived ||
    effects.teamRevive
  ) {
    markers.add("HEAL");
  }

  // Shields
  if (effects.shieldAdded > 0 || effects.shieldApplied) {
    markers.add("SHIELD");
  }

  // Buffs
  if (effects.atkBuffPct > 0 || effects.teamAtkBuffApplied) {
    markers.add("+ATK");
  }
  if (effects.defBuffPct > 0 || effects.teamDefBuffApplied) {
    markers.add("+DEF");
  }

  // Debuffs
  if (effects.enemyAtkDebuffPct > 0) {
    markers.add("-ATK");
  }
  if (effects.enemyDefDebuffPct > 0) {
    markers.add("-DEF");
  }

  // Status / FX
  if (
    effects.statusApplied ||
    effects.nextHitVulnApplied ||
    effects.damageReductionApplied ||
    effects.selfDefDebuffPct
  ) {
    markers.add("FX");
  }

  return Array.from(markers);
}

function labelForBase(base) {
  if (base === "self") return TARGET_LABELS.self;
  if (base === "ally") return TARGET_LABELS.ally;
  if (base === "enemy") return TARGET_LABELS.enemy;
  if (base === "team") return TARGET_LABELS.team;
  return TARGET_LABELS.fallback;
}

function orderMarkerTokens(tokens) {
  const uniq = [];
  for (const t of tokens) {
    const s = String(t || "").trim();
    if (!s) continue;
    if (!uniq.includes(s)) uniq.push(s);
  }

  const score = (t) => {
    const x = String(t).toUpperCase();

    // Marker ordering (matches header comment):
    // DMG → HEAL → buffs → debuffs → FX/utility
    if (x === "DMG") return 10;
    if (x === "HEAL") return 20;
    if (x === "SHIELD") return 30;
    if (x.startsWith("+")) return 40;
    if (x.startsWith("-") || x === "DEBUFF") return 50;
    if (x === "FX") return 60;
    if (x === "UTILITY") return 70;
    return 80;
  };

  return uniq.sort((a, b) => score(a) - score(b));
}

function hasNumber(x) {
  return typeof x === "number" && Number.isFinite(x) && x !== 0;
}
function hasObjectValue(o) {
  // genreSpecials data objects are often { value, imdbScale, turns }
  return o && typeof o === "object" && hasNumber(o.value);
}
function truthy(x) {
  return Boolean(x);
}

/**
 * Infer tokens from GENRE special data shape (special.data.*).
 * This covers what your genreSpecials.js actually defines.
 */
function inferTokensFromGenreDataForBase(base, special) {
  const d = special?.data;
  if (!d || typeof d !== "object") return [];

  const tokens = [];

  // --- Damage inference (genre) ---
  if (base === "enemy") {
    if (truthy(d.teamStrike?.enabled)) tokens.push("DMG");
    if (truthy(d.immediateHit?.enabled)) tokens.push("DMG");
    if (hasObjectValue(d.preHitAtkBuffPct)) tokens.push("DMG");
  }

  // --- Healing inference (genre) ---
  if (base === "self") {
    if (hasObjectValue(d.healSelfMaxHpPct)) tokens.push("+HP");
  }

  if (base === "team") {
    if (hasObjectValue(d.teamHealMaxHpPct)) tokens.push("+HP");
    if (hasObjectValue(d.teamHealMissingPct)) tokens.push("+HP");
  }

  if (base === "ally") {
    if (hasObjectValue(d.healAllyMaxHpPct)) tokens.push("+HP");
    if (hasObjectValue(d.healAllyMissingPct)) tokens.push("+HP");
    if (hasObjectValue(d.shieldAllyMaxHpPct)) tokens.push("SHIELD");
  }

  // --- Buff inference (genre) ---
  if (base === "self") {
    if (hasObjectValue(d.atkBuffPct)) tokens.push("+ATK");
    if (hasObjectValue(d.defBuffPct)) tokens.push("+DEF");
  }

  if (base === "team") {
    if (hasObjectValue(d.teamAtkBuffPct)) tokens.push("+ATK");
    if (hasObjectValue(d.teamDefBuffPct)) tokens.push("+DEF");
    if (hasObjectValue(d.teamCritBuffPct)) tokens.push("+CRIT");
    if (hasObjectValue(d.teamDamageReductionPct)) tokens.push("FX");
  }

  // --- Debuff inference (genre) ---
  if (base === "enemy") {
    if (hasObjectValue(d.enemyAtkDebuffPct)) tokens.push("-ATK");
    if (hasObjectValue(d.enemyDefDebuffPct)) tokens.push("-DEF");
    if (hasObjectValue(d.nextHitVulnPct)) tokens.push("FX");
  }

  return tokens;
}

/**
 * Infer tokens from SIGNATURE fields (top-level special.*).
 * This covers unified signature specials built in specialSystem.js.
 */
function inferTokensFromSignatureFieldsForBase(base, special) {
  if (!special || typeof special !== "object") return [];
  const tokens = [];

  const kind = String(special.sigKind ?? special.kind ?? "").toLowerCase();

  // DMG
  if (base === "enemy") {
    if (kind === "damageenemy" || kind === "hit") tokens.push("DMG");
    // ✅ NEW: teamStrike sub-effect (used inside dualEffect) implies enemy damage.
    if (kind === "teamstrike") tokens.push("DMG");
  }

  // Healing
  if (base === "self") {
    if (hasNumber(special.amount) && kind === "healself") tokens.push("+HP");
    if (truthy(special.missingHealPct) && kind === "healselfmissingpct") tokens.push("+HP");
  }

  if (base === "ally") {
    if (kind === "healally" || kind === "healallymissingpct") tokens.push("+HP");
  }

  if (base === "team") {
    if (kind === "healteam" || kind === "healteammissingpct" || kind === "healteambuff") tokens.push("+HP");
  }

  // Buffs
  if (base === "self" || base === "ally" || base === "team") {
    if (hasNumber(special.atkPct) || hasNumber(special.atkBuffPct)) tokens.push("+ATK");
    if (hasNumber(special.defPct) || hasNumber(special.defBuffPct)) tokens.push("+DEF");
    if (hasNumber(special.damageReductionPct)) tokens.push("FX");
    if (truthy(special.shield) || truthy(special.shieldPct)) tokens.push("SHIELD");
  }

  // Debuffs
  if (base === "enemy") {
    if (hasNumber(special.atkDebuffPct) || hasNumber(special.enemyAtkDebuffPct) || hasNumber(special.atkPct)) {
      if (
        kind === "enemy_debuff" ||
        kind === "debuffenemy" ||
        hasNumber(special.atkDebuffPct) ||
        hasNumber(special.enemyAtkDebuffPct)
      ) {
        tokens.push("-ATK");
      }
    }

    if (hasNumber(special.defDebuffPct) || hasNumber(special.enemyDefDebuffPct) || hasNumber(special.defPct)) {
      if (
        kind === "enemy_debuff" ||
        kind === "debuffenemy" ||
        hasNumber(special.defDebuffPct) ||
        hasNumber(special.enemyDefDebuffPct)
      ) {
        tokens.push("-DEF");
      }
    }

    if (truthy(special.status) || truthy(special.nextHitVulnActive) || hasNumber(special.nextHitVulnPct)) tokens.push("FX");
  }

  // Status on self/ally/team
  if ((base === "self" || base === "ally" || base === "team") && truthy(special.status)) tokens.push("FX");

  return tokens;
}

/**
 * ✅ NEW: If a move is dualEffect, infer markers from sub-effects that
 * actually target the requested base (enemy/team/ally/self).
 */
function inferTokensFromDualEffectsForBase(base, special) {
  const effects = special?.effects;
  if (!Array.isArray(effects) || effects.length === 0) return [];

  const tokens = [];

  for (const sub of effects) {
    if (!sub || typeof sub !== "object") continue;

    // Determine which bases THIS sub-effect hits.
    const subTags = normalizeTargetTags(sub.target);
    const subBases = getBaseTargetsFromTags(subTags);

    if (!subBases.includes(base)) continue;

    // Sub-effects can be signature-like or genre-like; we reuse the same inference.
    tokens.push(...inferTokensFromSignatureFieldsForBase(base, sub));
    tokens.push(...inferTokensFromGenreDataForBase(base, sub));

    // Also honor any legacy tags embedded on the sub effect (rare, but safe).
    const subTagSet = new Set(subTags);
    if (base === "enemy" && (subTagSet.has("status") || subTagSet.has("fx"))) tokens.push("FX");
    if ((base === "team" || base === "ally" || base === "self") && subTagSet.has("shield")) tokens.push("SHIELD");
  }

  return tokens;
}

/**
 * Marker inference from:
 * - tags (legacy / intent)
 * - special.data (genre)
 * - special fields (signature)
 * - dualEffect sub-effects (effects[])
 * - optional: inferMarkersFromDataForBase()
 */
export function inferMarkersForBase({ base, tags, special }) {
  const set = new Set(tags);
  const tokens = [];

  // Tag-based inference (legacy)
  const hasDmg = set.has("dmg") || set.has("damage") || set.has("hit") || set.has("strike") || set.has("teamstrike");
  const hasHeal = set.has("heal") || set.has("healing") || set.has("revive") || set.has("lifesteal") || set.has("drain");
  const hasFx =
    set.has("fx") ||
    set.has("status") ||
    set.has("stun") ||
    set.has("sleep") ||
    set.has("poison") ||
    set.has("burn") ||
    set.has("freeze");

  const hasBuff = set.has("buff");
  const hasDebuff = set.has("debuff");

  if (base === "enemy") {
    if (hasDmg) tokens.push("DMG");
    if (hasDebuff) tokens.push("DEBUFF");
    if (hasFx) tokens.push("FX");
  }

  if (base === "ally" || base === "self" || base === "team") {
    if (hasHeal) tokens.push("+HP");
    if (hasBuff) tokens.push("BUFF");
    if (hasFx) tokens.push("FX");
  }

  // ✅ Genre inference from special.data
  tokens.push(...inferTokensFromGenreDataForBase(base, special));

  // ✅ Signature inference from top-level special fields
  tokens.push(...inferTokensFromSignatureFieldsForBase(base, special));

  // ✅ NEW: dualEffect sub-effects inference
  tokens.push(...inferTokensFromDualEffectsForBase(base, special));

  // ✅ Optional: centralized inferMarkers.js (if present)
  try {
    const extra = typeof inferMarkersFromDataForBase === "function" ? inferMarkersFromDataForBase({ base, special }) : null;
    if (Array.isArray(extra)) tokens.push(...extra);
  } catch (_) {
    // no-op
  }

  // Replace generic BUFF/DEBUFF with concrete tokens when we have them.
  const hasConcreteBuff = tokens.includes("+ATK") || tokens.includes("+DEF") || tokens.includes("+CRIT");
  const hasConcreteDebuff = tokens.includes("-ATK") || tokens.includes("-DEF");

  if (hasConcreteBuff) {
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (String(tokens[i]).toUpperCase() === "BUFF") tokens.splice(i, 1);
    }
  }
  if (hasConcreteDebuff) {
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (String(tokens[i]).toUpperCase() === "DEBUFF") tokens.splice(i, 1);
    }
  }

  // Normalize (+HP -> HEAL) and order + dedupe
  const normalized = tokens.map(normalizeMarkerToken);
  return orderMarkerTokens(normalized);
}

/**
 * ✅ Base ordering rules to match your preferred multi-target examples:
 * - If TEAM+ENEMY exist → TEAM first, ENEMY second
 * - Else if SELF+ENEMY exist → SELF first, ENEMY second
 * - Else if ALLY+ENEMY exist → ENEMY first, ALLY second
 * - Else default: ENEMY, TEAM, ALLY, SELF (only those present)
 */
function orderBasesForFramework(bases) {
  const set = new Set(bases);

  const hasTeam = set.has("team");
  const hasEnemy = set.has("enemy");
  const hasSelf = set.has("self");
  const hasAlly = set.has("ally");

  if (hasTeam && hasEnemy) {
    const out = ["team", "enemy"];
    if (hasAlly) out.push("ally");
    if (hasSelf) out.push("self");
    return out.filter((b) => set.has(b));
  }

  if (hasSelf && hasEnemy) {
    const out = ["self", "enemy"];
    if (hasAlly) out.push("ally");
    if (hasTeam) out.push("team");
    return out.filter((b) => set.has(b));
  }

  if (hasAlly && hasEnemy) {
    const out = ["enemy", "ally"];
    if (hasTeam) out.push("team");
    if (hasSelf) out.push("self");
    return out.filter((b) => set.has(b));
  }

  const order = ["enemy", "team", "ally", "self"];
  return order.filter((b) => set.has(b));
}

export function buildTargetLabel(special) {
  const tags = normalizeTargetTags(special?.target);

  // For dualEffect, bases often live only in sub-effects, so don’t rely solely on top-level tags.
  let bases = getBaseTargetsFromTags(tags);

  // ✅ If dualEffect: bases should be union of sub-effect bases
  if (special?.kind === "dualEffect" && Array.isArray(special.effects)) {
    const baseSet = new Set(bases);

    for (const sub of special.effects) {
      const subTags = normalizeTargetTags(sub?.target);
      for (const b of getBaseTargetsFromTags(subTags)) baseSet.add(b);
    }

    bases = Array.from(baseSet);
  }

  // If teamstrike exists, treat it as implying TEAM+ENEMY involvement (your genre pattern)
  const set = new Set(tags);
  if (set.has("teamstrike")) {
    if (!bases.includes("enemy")) bases.push("enemy");
    if (!bases.includes("team")) bases.push("team");
  }

  const orderedBases = orderBasesForFramework(bases);

  // ✅ NEW: marker inference for dualEffect should come from sub-effects, not the wrapper.
  const isDual = special?.kind === "dualEffect" && Array.isArray(special.effects) && special.effects.length > 0;

  const markersForDualBase = (base) => {
    const tok = [];

    for (const sub of special.effects) {
      if (!sub || typeof sub !== "object") continue;

      const subTags = normalizeTargetTags(sub?.target);
      const subBases = getBaseTargetsFromTags(subTags);
      if (!subBases.includes(base)) continue;

      // Reuse your existing inference logic (no new rules)
      tok.push(...inferTokensFromGenreDataForBase(base, sub));
      tok.push(...inferTokensFromSignatureFieldsForBase(base, sub));
      tok.push(...inferTokensFromDualEffectsForBase(base, sub)); // safe even if nested later

      // Optional helper inference
      try {
        const extra =
          typeof inferMarkersFromDataForBase === "function"
            ? inferMarkersFromDataForBase({ base, special: sub })
            : null;
        if (Array.isArray(extra)) tok.push(...extra);
      } catch (_) {}
    }

    const normalized = tok.map(normalizeMarkerToken);
    return orderMarkerTokens(normalized);
  };

  const segments = orderedBases.map((base) => {
    const markers = isDual ? markersForDualBase(base) : inferMarkersForBase({ base, tags, special });
    const markerBlock = markers.length ? combineMarkers(markers) : "";
    return markerBlock ? `${labelForBase(base)} ${markerBlock}` : `${labelForBase(base)}`;
  });

  return segments.join(" + ");
}
