// frontend/js/battleText/inferMarkers.js
//
// Step B — marker inference for target labels (help panel).
//
// Goal:
// - Produce tokens like (DMG), (+HP +DEF), (-ATK), (FX) for BOTH:
//   - genre specials (special.data)
//   - signature specials (special.kind/sigKind + flat fields)
//
// Notes:
// - This file emits ONLY marker tokens (no narration lines).
// - Conservative: prefers stat-specific tokens when obvious, otherwise BUFF/DEBUFF.
// - Does not require tags to be perfect; tags can still help, but are not required.

import { normalizeMarkerToken } from "./format.js";

function asUpper(s) {
  return String(s || "").trim().toUpperCase();
}

function asLower(s) {
  return String(s || "").trim().toLowerCase();
}

function isNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

function orderMarkerTokens(tokens) {
  const uniq = [];
  for (const t of tokens) {
    const s = String(t || "").trim();
    if (!s) continue;
    if (!uniq.includes(s)) uniq.push(s);
  }

  const score = (t) => {
    const x = asUpper(t);
    if (x === "DMG") return 10;
    if (x === "+HP") return 20;
    if (x.startsWith("+")) return 30;
    if (x.startsWith("-") || x === "DEBUFF") return 40;
    if (x === "FX") return 50;
    return 60;
  };

  return uniq.sort((a, b) => score(a) - score(b));
}

function pushBuffTokens(tokens, { atk, def, crit } = {}) {
  if (atk) tokens.push("+ATK");
  if (def) tokens.push("+DEF");
  if (crit) tokens.push("+CRIT");
  if (!atk && !def && !crit) tokens.push("BUFF");
}

function pushDebuffTokens(tokens, { atk, def } = {}) {
  if (atk) tokens.push("-ATK");
  if (def) tokens.push("-DEF");
  if (!atk && !def) tokens.push("DEBUFF");
}

/**
 * Infer from special.data (genre specials).
 * Returns normalized marker tokens (already ordered).
 */
export function inferMarkersFromDataForBase({ base, special }) {
  const d = special?.data || {};
  const tokens = [];

  // Damage signals (genre)
  const hasImmediateHit = Boolean(d.immediateHit?.enabled);
  const hasTeamStrike = Boolean(d.teamStrike?.enabled);
  const hasPreHit = d.preHitAtkBuffPct != null; // HORROR does damage

  // Heal signals (genre)
  const hasTeamHeal = d.teamHealMaxHpPct != null || d.teamHealMissingPct != null || d.teamHealPct != null;
  const hasSelfHeal = d.healSelfMaxHpPct != null || d.healSelfMissingPct != null;
  const hasAllyHeal = d.healAllyMaxHpPct != null || d.healAllyMissingPct != null;

  // Buff signals (genre)
  const selfAtkUp = d.atkBuffPct != null;
  const selfDefUp = d.defBuffPct != null;

  const teamAtkUp = d.teamAtkBuffPct != null;
  const teamDefUp = d.teamDefBuffPct != null;
  const teamCritUp = d.teamCritBuffPct != null;

  // Debuff signals (genre)
  const enemyAtkDown = d.enemyAtkDebuffPct != null;
  const enemyDefDown = d.enemyDefDebuffPct != null;

  // Self debuff (genre) (e.g., SCIFI defDebuffPct)
  const selfDefDown = d.defDebuffPct != null;

  // FX signals (genre)
  const isExpose = d.nextHitVulnPct != null;
  const hasDamageReduction = d.teamDamageReductionPct != null;

  if (base === "enemy") {
    if (hasImmediateHit || hasTeamStrike || hasPreHit) tokens.push("DMG");
    if (enemyAtkDown || enemyDefDown) pushDebuffTokens(tokens, { atk: enemyAtkDown, def: enemyDefDown });
    if (isExpose) tokens.push("FX");
  }

  if (base === "self") {
    if (hasSelfHeal) tokens.push("+HP");
    if (selfAtkUp || selfDefUp) pushBuffTokens(tokens, { atk: selfAtkUp, def: selfDefUp });
    if (selfDefDown) pushDebuffTokens(tokens, { def: true });
  }

  if (base === "ally") {
    if (hasAllyHeal) tokens.push("+HP");
    // (ally shields are not shown as numbers; treat as BUFF-ish if you want a token later)
  }

  if (base === "team") {
    if (hasTeamHeal) tokens.push("+HP");
    if (teamAtkUp || teamDefUp || teamCritUp) pushBuffTokens(tokens, { atk: teamAtkUp, def: teamDefUp, crit: teamCritUp });
    if (hasDamageReduction) tokens.push("BUFF"); // conservative: it's a positive team effect
  }

  return orderMarkerTokens(tokens).map(normalizeMarkerToken);
}

/**
 * Infer from signature specials (flat fields + kind/sigKind).
 * Returns normalized marker tokens (already ordered).
 */
export function inferMarkersFromSpecialForBase({ base, tags = [], special }) {
  const set = new Set((Array.isArray(tags) ? tags : []).map(asLower));
  const tokens = [];

  const kind = asLower(special?.sigKind ?? special?.kind);

  // ---------- helpers ----------
  const isDamageKind = kind === "damageenemy" || kind === "hit";
  const isStatusKind = kind === "status" || kind === "statusenemy";
  const isEnemyDebuffKind = kind === "enemy_debuff" || kind === "debuffenemy";
  const isSelfBuffKind = kind === "self_buff";
  const isPartyBuffKind = kind === "buffparty";

  const isHealSelfKind = kind === "healself" || kind === "healselfmissingpct";
  const isHealAllyKind = kind === "healally" || kind === "healallymissingpct";
  const isHealTeamKind = kind === "healteam" || kind === "healteammissingpct" || kind === "healteambuff";

  // Signals from tags (optional, still supported)
  const tagHasDmg = set.has("dmg") || set.has("damage") || set.has("hit") || set.has("strike") || set.has("teamstrike");
  const tagHasHeal = set.has("heal") || set.has("healing") || set.has("revive") || set.has("lifesteal") || set.has("drain");
  const tagHasBuff = set.has("buff");
  const tagHasDebuff = set.has("debuff");
  const tagHasFx =
    set.has("fx") ||
    set.has("status") ||
    set.has("stun") ||
    set.has("sleep") ||
    set.has("poison") ||
    set.has("burn") ||
    set.has("freeze") ||
    set.has("vuln");

  // Flat-field signals
  const hasAmount = isNum(special?.amount) && special.amount !== 0;
  const hasShield = special?.shield != null || special?.shieldPct != null;

  // Stat fields (signature)
  const atkUp = (isNum(special?.atkPct) && special.atkPct > 0) || (isNum(special?.atkBuffPct) && special.atkBuffPct > 0);
  const defUp = (isNum(special?.defPct) && special.defPct > 0) || (isNum(special?.defBuffPct) && special.defBuffPct > 0);

  const enemyAtkDown =
    (isNum(special?.atkPct) && special.atkPct > 0 && isEnemyDebuffKind) ||
    (isNum(special?.atkDebuffPct) && special.atkDebuffPct > 0);

  const enemyDefDown =
    (isNum(special?.defPct) && special.defPct > 0 && isEnemyDebuffKind) ||
    (isNum(special?.defDebuffPct) && special.defDebuffPct > 0);

  // Self vulnerability / self debuff keys you added (damageEnemy variants)
  const selfDefDown = isNum(special?.selfDefDebuffPct) && special.selfDefDebuffPct > 0;

  // ---------- per base ----------
  if (base === "enemy") {
    if (isDamageKind || tagHasDmg) tokens.push("DMG");

    if (isEnemyDebuffKind || tagHasDebuff) {
      // Prefer stat-specific if we can see them
      pushDebuffTokens(tokens, { atk: enemyAtkDown, def: enemyDefDown });
    }

    if (isStatusKind || tagHasFx) tokens.push("FX");
  }

  if (base === "self") {
    // heals
    if (isHealSelfKind || (tagHasHeal && base === "self") || (kind === "healself" && hasAmount)) tokens.push("HEAL");
    // buffs
    if (isSelfBuffKind || tagHasBuff) {
      if (atkUp || defUp) pushBuffTokens(tokens, { atk: atkUp, def: defUp });
      else if (tagHasBuff) tokens.push("BUFF");

      if (hasShield) tokens.push("SHIELD");

    }
    // self debuff
    if (selfDefDown) pushDebuffTokens(tokens, { def: true });
    // status FX on self
    if (tagHasFx && !tokens.includes("FX")) tokens.push("FX");
  }

  if (base === "ally") {
    if (isHealAllyKind || (tagHasHeal && base === "ally") || (kind === "healally" && hasAmount)) tokens.push("HEAL");
    if (hasShield) tokens.push("SHIELD");
    if (tagHasFx) tokens.push("FX");
  }

  if (base === "team") {
    if (isHealTeamKind || tagHasHeal) tokens.push("+HP");

    if (isPartyBuffKind || tagHasBuff) {
      if (atkUp || defUp) pushBuffTokens(tokens, { atk: atkUp, def: defUp });
      else tokens.push("BUFF");
    }

    if (tagHasFx) tokens.push("FX");
  }

  return orderMarkerTokens(tokens).map(normalizeMarkerToken);
}

/**
 * Convenience: merges data-based + signature-based inference (deduped), ordered.
 * If you only want one source, call the individual fns above.
 */
export function inferMarkersMergedForBase({ base, tags = [], special }) {
  const a = inferMarkersFromDataForBase({ base, special });
  const b = inferMarkersFromSpecialForBase({ base, tags, special });

  const out = [];
  for (const t of [...a, ...b]) {
    const s = String(t || "").trim();
    if (!s) continue;
    if (!out.includes(s)) out.push(s);
  }

  return orderMarkerTokens(out).map(normalizeMarkerToken);
}
