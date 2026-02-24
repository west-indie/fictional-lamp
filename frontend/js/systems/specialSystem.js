// frontend/js/systems/specialSystem.js
//
// Step B â€” execution only:
// - Builds unified specials list (signature + genre)
// - Executes specials and returns structured results:
//     { used, effects, error, meta }
// - NO narration strings are constructed here.

import { imdbMultiplier } from "./imdbScaling.js";
import { PLAYER_ATK_MULT } from "./damageSystem.js";
import { genreSpecials } from "../data/genreSpecials.js";
import { getAllSignatureSpecials } from "../data/specials.js";

import { normalizeTargetTags as normalizeTags, getBaseTargetFromTags } from "./specialTags.js";

const DEFAULT_COOLDOWN_TURNS = 3;

// ----------------- basics -----------------

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function randFloat(a, b) {
  return a + Math.random() * (b - a);
}

function roundInt(n) {
  return Math.round(n);
}

function ensureStatuses(obj) {
  if (!obj.statuses) obj.statuses = {};
  return obj.statuses;
}

function ensureCooldownMap(actor) {
  if (!actor.specialCooldowns) actor.specialCooldowns = {};
  return actor.specialCooldowns;
}

// -------- kind normalization (local, behavior-preserving) --------
function normalizeKind(kind) {
  return String(kind || "").trim();
}

// -------- target tags / base target helpers --------

function normalizeTargetTags(target) {
  // canonical: supports string OR tag array
  return normalizeTags(target);
}

function getBaseTargetTag(special) {
  const tags = normalizeTargetTags(special?.target);

  const base = typeof getBaseTargetFromTags === "function" ? getBaseTargetFromTags(tags) : null;
  if (base) return base;

  if (typeof special?.target === "string" && special.target.trim()) {
    return special.target.trim().toLowerCase();
  }
  return "enemy";
}

// ----------------- dualEffect helpers -----------------

function getEffectsListFromSpecial(sp) {
  if (!sp) return [];
  if (Array.isArray(sp.effects)) return sp.effects;
  if (Array.isArray(sp.steps)) return sp.steps; // allow "steps" alias if you ever use it
  return [];
}

function normalizeStepTarget(t) {
  if (Array.isArray(t)) return t[0] || "enemy";
  if (typeof t === "string" && t.trim()) return t.trim().toLowerCase();
  return "enemy";
}

function deriveTargetTagsFromDualEffects(effectsList) {
  const set = new Set();
  for (const st of effectsList) {
    const bt = normalizeStepTarget(st?.target);
    if (bt === "self" || bt === "ally" || bt === "team" || bt === "enemy") set.add(bt);
  }
  // stable ordering (UI friendliness)
  const ordered = ["self", "ally", "team", "enemy"].filter((k) => set.has(k));
  return ordered.length ? ordered : ["enemy"];
}

function mergeEffects(base, add) {
  const out = base || {};
  const e = add || {};

  // sums
  const sumKeys = ["damageDealt", "healedHp", "shieldAdded", "teamDmg", "teamHeal"];
  for (const k of sumKeys) {
    if (typeof e[k] === "number") out[k] = Number(out[k] || 0) + Number(e[k] || 0);
  }

  // take max (pct + turns)
  const maxKeys = [
    "atkBuffPct",
    "defBuffPct",
    "enemyAtkDebuffPct",
    "enemyDefDebuffPct",
    "selfDefDebuffPct",
    "damageReductionPct",
    "nextHitVulnPct",

    "atkBuffTurns",
    "defBuffTurns",
    "enemyAtkDebuffTurns",
    "enemyDefDebuffTurns",
    "selfDefDebuffTurns",
    "damageReductionTurns",
    "nextHitVulnTurns",
    "shieldTurns",
    "statusTurns"
  ];
  for (const k of maxKeys) {
    if (typeof e[k] === "number") out[k] = Math.max(Number(out[k] || 0), Number(e[k] || 0));
  }

  // flags / misc
  if (e.revived) out.revived = true;
  if (e.teamRevive) out.teamRevive = true;
  if (typeof e.revivedCount === "number") out.revivedCount = Math.max(Number(out.revivedCount || 0), Number(e.revivedCount));

  // statuses
  if (e.statusApplied) {
    if (!out.statusApplied) out.statusApplied = e.statusApplied;
    if (!Array.isArray(out.statusAppliedList)) out.statusAppliedList = [];
    out.statusAppliedList.push(e.statusApplied);
  }

  return out;
}

// ----------------- status helpers -----------------

function getStatusPct(obj, pctKey) {
  const s = obj?.statuses;
  if (!s) return 0;

  const turnsKey = pctKey.replace("Pct", "Turns");
  const turns = s[turnsKey];

  if (typeof turns === "number" && turns <= 0) return 0;
  return Number(s[pctKey] ?? 0) || 0;
}

function getEnemyBaseDefense(enemy) {
  return Number(enemy?.defense ?? enemy?.def ?? enemy?.defenseStat ?? 0);
}

function getEnemyEffectiveDefense(enemy) {
  const base = getEnemyBaseDefense(enemy);
  const down = clamp(getStatusPct(enemy, "defDebuffPct"), 0, 0.9);
  const mult = Math.max(0.1, 1 - down);
  return Math.max(0, roundInt(base * mult));
}

function setPctBuff(target, statKey, pct, turns = 2) {
  const s = ensureStatuses(target);
  const k = `${statKey}BuffPct`;
  const tk = `${statKey}BuffTurns`;
  s[k] = Math.max(Number(s[k] || 0), Number(pct || 0));
  s[tk] = Math.max(Number(s[tk] || 0), Number(turns || 0));
}

function setPctDebuff(target, statKey, pct, turns = 2) {
  const s = ensureStatuses(target);
  const k = `${statKey}DebuffPct`;
  const tk = `${statKey}DebuffTurns`;
  s[k] = Math.max(Number(s[k] || 0), Number(pct || 0));
  s[tk] = Math.max(Number(s[tk] || 0), Number(turns || 0));
}

function applyShield(actor, amount) {
  if (typeof beforeShieldTargetHook === "function") beforeShieldTargetHook(actor);
  if (!actor.tempShield) actor.tempShield = 0;
  const added = Math.max(0, roundInt(amount || 0));
  actor.tempShield += added;

  // âœ… Barrier rule:
  // - NO shieldTurns written
  // - Barrier persists until tempShield is absorbed
  return added;
}

let beforeHealTargetHook = null;
let beforeShieldTargetHook = null;

function applyHeal(target, amount) {
  if (typeof beforeHealTargetHook === "function") beforeHealTargetHook(target);
  const before = Number(target.hp || 0);
  const maxHp = Number(target.maxHp || 0);
  target.hp = clamp(before + Number(amount || 0), 0, maxHp);
  return Math.max(0, roundInt(target.hp - before));
}

function effectiveAtkWithTemporaryBoost(actor, boostPct) {
  const base = Number(actor.atk || 0);
  return base * (1 + Number(boostPct || 0));
}

function computeSimpleDamage(atkValue, enemy) {
  const def = getEnemyEffectiveDefense(enemy);
  const raw = roundInt(atkValue) - def;
  return Math.max(1, raw);
}

function applyDamageToEnemy(enemy, dmg) {
  enemy.hp = Math.max(0, Number(enemy.hp || 0) - Math.max(0, roundInt(dmg || 0)));
  return Math.max(0, roundInt(dmg || 0));
}

function sqrtWeightShares(atkList) {
  const weights = atkList.map((a) => Math.sqrt(Math.max(1, Number(a || 0))));
  const sum = weights.reduce((acc, w) => acc + w, 0) || 1;
  return weights.map((w) => w / sum);
}

// Helpers for "friendly" signature inputs
function normalizePct(v) {
  const n = Number(v ?? 0) || 0;
  return Math.max(0, Math.abs(n));
}

function normalizeTurns(v, fallback = 2) {
  const t = Math.floor(Number(v ?? fallback));
  return Math.max(1, t);
}

function rollChance(p) {
  const c = Number(p ?? 1);
  return Math.random() < clamp(c, 0, 1);
}

function applyGenericStatus(target, statusKey, turns) {
  const s = ensureStatuses(target);

  // âœ… Safety: always store canonical lowercase keys (stunTurns, dazedTurns, confusedTurns)
  const key = String(statusKey || "").trim().toLowerCase();
  if (!key) return;

  const tk = `${key}Turns`;
  s[tk] = Math.max(Number(s[tk] || 0), Number(turns || 1));
}

// ---------------- COOLDOWNS ----------------

export function getCooldownRemaining(actor, specialKey) {
  const map = ensureCooldownMap(actor);
  return Number(map[specialKey] ?? 0);
}

export function isSpecialReady(actor, specialKey) {
  return getCooldownRemaining(actor, specialKey) <= 0;
}

export function startSpecialCooldown(actor, specialKey, turns = DEFAULT_COOLDOWN_TURNS) {
  const map = ensureCooldownMap(actor);
  map[specialKey] = Math.max(0, Math.floor(Number(turns ?? DEFAULT_COOLDOWN_TURNS)));
}

export function tickCooldownsForActor(actor) {
  const map = ensureCooldownMap(actor);
  for (const k of Object.keys(map)) {
    map[k] = Math.max(0, Math.floor(Number(map[k] || 0) - 1));
  }
}

// ---------------- BUILD LISTS ----------------

function signatureToUnified(movieId, signature) {
  if (!signature) return null;

  const id = signature.id;
  const name = signature.name;
  const description = signature.description ?? signature.desc ?? "";
  const sigKind = signature.kind;

  const cooldownTurns = signature.cooldownTurns ?? signature.cooldown ?? DEFAULT_COOLDOWN_TURNS;
  const powerMultiplier = signature.powerMultiplier ?? signature.power ?? null;
  const amount = signature.amount ?? null;

    let target = signature.target || null;

  // âœ… dualEffect: allow the entry to omit target entirely;
  // we derive a sane UI/target prompt target-set from step targets.
  if (!target && String(sigKind || "").trim() === "dualEffect") {
    const list = getEffectsListFromSpecial(signature);
    target = deriveTargetTagsFromDualEffects(list);
  }

  if (!target) {
    if (
      sigKind === "damageEnemy" ||
      sigKind === "HIT" ||
      sigKind === "ENEMY_DEBUFF" ||
      sigKind === "debuffEnemy" ||
      sigKind === "STATUS" ||
      sigKind === "statusEnemy"
    ) {
      target = ["enemy"];
    } else if (sigKind === "healSelf" || sigKind === "healSelfMissingPct" || sigKind === "SELF_BUFF") {
      target = ["self"];
    } else if (sigKind === "healAlly" || sigKind === "healAllyMissingPct") {
      target = ["ally"];
    } else if (
      sigKind === "buffParty" ||
      sigKind === "healTeam" ||
      sigKind === "healTeamMissingPct" ||
      sigKind === "healTeamBuff"
    ) {
      target = ["team"];
    } else {
      target = ["enemy"];
    }
  }

  target = normalizeTargetTags(target);

  if (!target) {
    if (
      sigKind === "damageEnemy" ||
      sigKind === "HIT" ||
      sigKind === "ENEMY_DEBUFF" ||
      sigKind === "debuffEnemy" ||
      sigKind === "STATUS" ||
      sigKind === "statusEnemy"
    ) {
      target = ["enemy"];
    } else if (sigKind === "healSelf" || sigKind === "healSelfMissingPct" || sigKind === "SELF_BUFF") {
      target = ["self"];
    } else if (sigKind === "healAlly" || sigKind === "healAllyMissingPct") {
      target = ["ally"];
    } else if (
      sigKind === "buffParty" ||
      sigKind === "healTeam" ||
      sigKind === "healTeamMissingPct" ||
      sigKind === "healTeamBuff"
    ) {
      target = ["team"];
    } else {
      target = ["enemy"];
    }
  }

  target = normalizeTargetTags(target);

  const unified = {
    source: "signature",
    isSignature: true,
    key: `sig:${movieId}:${id}`,

    id,
    name,
    description,

    kind: sigKind,
    target,

    powerMultiplier,
    amount,
    cooldownTurns,

    atkPct: signature.atkPct ?? null,
    defPct: signature.defPct ?? null,
    turns: signature.turns ?? null,
    status: signature.status ?? null,
    chance: signature.chance ?? null,
    shield: signature.shield ?? null,
    shieldPct: signature.shieldPct ?? null,

    missingHealPct: signature.missingHealPct ?? null,
    revivePct: signature.revivePct ?? null,

    selfDefDebuffPct: signature.selfDefDebuffPct ?? null,
    selfDefDebuffTurns: signature.selfDefDebuffTurns ?? null,

    atkBuffPct: signature.atkBuffPct ?? null,
    atkBuffTurns: signature.atkBuffTurns ?? null,
    defBuffPct: signature.defBuffPct ?? null,
    defBuffTurns: signature.defBuffTurns ?? null,

    atkDebuffPct: signature.atkDebuffPct ?? null,
    atkDebuffTurns: signature.atkDebuffTurns ?? null,
    defDebuffPct: signature.defDebuffPct ?? null,
    defDebuffTurns: signature.defDebuffTurns ?? null,

    damageReductionPct: signature.damageReductionPct ?? null,
    damageReductionTurns: signature.damageReductionTurns ?? null,

    nextHitVulnActive: signature.nextHitVulnActive ?? null,
    nextHitVulnPct: signature.nextHitVulnPct ?? null,
    nextHitVulnTurns: signature.nextHitVulnTurns ?? null,

    sigKind
  };

  unified.text = signature.text ?? null;
  // âœ… carry dualEffect step-list through the unified special
  unified.effects = signature.effects ?? signature.steps ?? null;
  return unified;
}

function buildGenreSpecial(genreKey, tier /* "primary" | "secondary" */) {
  const def = genreSpecials[genreKey];
  if (!def) return null;

  const isPrimary = tier === "primary";
  const data = isPrimary ? def.primary : def.secondary;

  const intro =
    (def?.text && typeof def.text === "object"
      ? isPrimary
        ? def.text.introPrimary ?? def.text.primaryIntro
        : def.text.introSecondary ?? def.text.secondaryIntro
      : null) ?? null;

  return {
    source: "genre",
    kind: "genre",
    isGenre: true,

    key: `genre:${genreKey}:${tier}`,
    id: `genre_${genreKey.toLowerCase()}_${tier}`,
    genre: genreKey,
    tier,

    name: isPrimary ? def.primaryName : def.secondaryName,
    description: def.description || "",

    // IMPORTANT: can be string OR array; battleHelpPanel treats it as tags.
    target: def.target,

    data,
    cooldownTurns: DEFAULT_COOLDOWN_TURNS,

    text: null
  };
}

function getSignatureDefsForMovie(movieId, signatureMap) {
  const override = signatureMap?.[movieId];

  if (Array.isArray(override)) return override;
  if (override && typeof override === "object" && override.id) return [override];

  const fromHelper = typeof getAllSignatureSpecials === "function" ? getAllSignatureSpecials(movieId) : null;
  if (Array.isArray(fromHelper) && fromHelper.length) return fromHelper;

  return [];
}

export function getSpecialsForActor(actor, movieMetaMap, signatureMap) {
  const movieId = actor?.movie?.id;
  if (!movieId) return [];

  const meta = movieMetaMap?.[movieId] || null;
  const list = [];

  const sigDefs = getSignatureDefsForMovie(movieId, signatureMap);
  for (const sigDef of sigDefs) {
    const sig = signatureToUnified(movieId, sigDef);
    if (sig) list.push(sig);
  }

  const pg = meta?.primaryGenre || null;
  const sg = meta?.secondaryGenre || null;

  if (pg) {
    const g1 = buildGenreSpecial(pg, "primary");
    if (g1) list.push(g1);
  }
  if (sg) {
    const g2 = buildGenreSpecial(sg, "secondary");
    if (g2) list.push(g2);
  }

  return list;
}

export function getResolvedSpecialsForActor(actor, movieMetaMap, signatureMap) {
  const list = getSpecialsForActor(actor, movieMetaMap, signatureMap);
  return list.map((sp) => {
    const cd = getCooldownRemaining(actor, sp.key);
    return { ...sp, cooldownRemaining: cd, ready: cd <= 0 };
  });
}

// ---------------- EXECUTION ----------------

export function executeSpecial({
  actor,
  party,
  enemy,
  special,
  movieMetaMap, // kept for compatibility
  signatureMap, // kept for compatibility
  targetIndex = null,
  beforeHealTarget = null,
  beforeShieldTarget = null
}) {
  if (!actor) return { used: false, error: { code: "noActor" } };
  if (!special) return { used: false, error: { code: "noSpecial" } };

  if (!isSpecialReady(actor, special.key)) {
    const cd = getCooldownRemaining(actor, special.key);
    return { used: false, error: { code: "cooldown", cooldownTurns: cd } };
  }

  const imdb = Number(actor?.movie?.imdb ?? 7.0);
  const M = imdbMultiplier(imdb);

  const kindNorm = normalizeKind(special?.sigKind ?? special?.kind);

  let result;
  const prevBeforeHealTargetHook = beforeHealTargetHook;
  const prevBeforeShieldTargetHook = beforeShieldTargetHook;
  beforeHealTargetHook = typeof beforeHealTarget === "function" ? beforeHealTarget : null;
  beforeShieldTargetHook = typeof beforeShieldTarget === "function" ? beforeShieldTarget : null;

  // Special-case ally missing% (revive/heal) â€” execution only
  if (kindNorm === "healAllyMissingPct" && getBaseTargetTag(special) === "ally") {
    result = executeHealAllyMissingPct({ actor, party, special, targetIndex });
  } else if (special.source === "signature") {
    result = executeSignature({ actor, party, enemy, special, targetIndex, M });
  } else if (special.source === "genre") {
    result = executeGenre({ actor, party, enemy, special, M, targetIndex });
  } else {
    result = { used: false, error: { code: "noSpecial" } };
  }

  beforeHealTargetHook = prevBeforeHealTargetHook;
  beforeShieldTargetHook = prevBeforeShieldTargetHook;

  // Cooldown is still an execution concern
  if (result?.used) {
    startSpecialCooldown(actor, special.key, special.cooldownTurns ?? DEFAULT_COOLDOWN_TURNS);
  }

  // âœ… Step B: do NOT build result.lines here
  return result;
}

// Helper: heals ally for a % of missing HP; revives to a % of max HP if down
function executeHealAllyMissingPct({ actor, party, special, targetIndex }) {
  if (!Array.isArray(party) || party.length === 0) return { used: false, error: { code: "noAllyTarget" } };
  if (typeof targetIndex !== "number" || targetIndex < 0 || targetIndex >= party.length) {
    return { used: false, error: { code: "invalidTarget" } };
  }

  const target = party[targetIndex];
  if (!target) return { used: false, error: { code: "invalidTarget" } };

  const maxHp = target.maxHp ?? target.hpMax ?? target?.stats?.hpMax ?? target?.stats?.maxHp;
  if (!maxHp || typeof maxHp !== "number") return { used: false, error: { code: "invalidTarget" } };
  if (typeof beforeHealTargetHook === "function") beforeHealTargetHook(target);

  const pct = typeof special.missingHealPct === "number" ? special.missingHealPct : 0.75;
  const revivePct = typeof special.revivePct === "number" ? special.revivePct : pct;

  // Revive case
  if (target.hp <= 0) {
    const revivedHp = roundInt(maxHp * revivePct);
    target.hp = clamp(revivedHp, 1, maxHp);

    return {
      used: true,
      effects: {
        healedHp: target.hp,
        revived: true,
        revivedHp: target.hp
      },
      meta: {
        targetIndex,
        targetName: target.name || target.movie?.title || "ally"
      }
    };
  }

  // Heal missing HP case
  const missing = Math.max(0, maxHp - target.hp);
  const healAmt = roundInt(missing * pct);
  if (healAmt <= 0) return { used: false, error: { code: "invalidTarget" } };

  target.hp = clamp(target.hp + healAmt, 0, maxHp);

  return {
    used: true,
    effects: {
      healedHp: healAmt
    },
    meta: {
      targetIndex,
      targetName: target.name || target.movie?.title || "ally"
    }
  };
}

function executeTeamStrike({ party, enemy, special, effectsOut }) {
  if (!Array.isArray(party) || party.length === 0) return;

  const alive = party.filter((m) => m && m.hp > 0);
  if (alive.length === 0) return;

  const min = Number(special.totalMinMult ?? 1.5);
  const max = Number(special.totalMaxMult ?? 2.8);
  const R = randFloat(min, max);

  const atks = alive.map((m) => Number(m.atk || 0));
  const shares = sqrtWeightShares(atks);

  let total = 0;
  for (let i = 0; i < alive.length; i++) {
    const portionMult = R * shares[i];
    const dmg = computeSimpleDamage(atks[i] * portionMult * PLAYER_ATK_MULT, enemy);
    total += applyDamageToEnemy(enemy, dmg);
  }

  effectsOut.teamDmg = (effectsOut.teamDmg || 0) + total;
  effectsOut.damageDealt = (effectsOut.damageDealt || 0) + total;
}

// ---------------- SIGNATURE EXECUTION ----------------

function executeSignature({ actor, party, enemy, special, targetIndex, M }) {
  const kind = normalizeKind(special.sigKind ?? special.kind);

  // âœ… Step B: execution-only result object
  const effects = {};
  const meta = {};

  // Determine ally target if needed (meta only; narration layer will decide how to use it)
  if (getBaseTargetTag(special) === "ally" && Array.isArray(party)) {
    const tgt = party?.[targetIndex];
    meta.targetIndex = targetIndex;
    meta.targetName = tgt ? (tgt.movie?.title || tgt.name || "ally") : "ally";
  }

  // ---- KINDS (keep your existing behavior; only change returns) ----

    // âœ… dualEffect: execute an ordered list of step-effects (each step is a normal "signature-like" effect)
  if (kind === "dualEffect") {
    const list = getEffectsListFromSpecial(special);
    if (!Array.isArray(list) || list.length === 0) {
      return { used: false, error: { code: "noEffect" } };
    }

    const merged = {};
    const mergedMeta = { ...(meta || {}) };

    // âœ… NEW: keep ordered step outputs for narration
    const stepResults = [];

    for (const step of list) {
      if (!step || typeof step !== "object") continue;

      // We execute each step using the SAME logic as a normal signature,
      // by treating the step as a mini-special.
      const stepSpecial = {
        ...step,
        kind: step.kind ?? step.sigKind ?? "",
        sigKind: step.sigKind ?? step.kind ?? ""
      };

      const stepResult = executeSignature({
        actor,
        party,
        enemy,
        special: stepSpecial,
        targetIndex,
        M
      });

      // If a step fails, bubble it up (same UX as normal).
      if (!stepResult?.used) return stepResult;

      // âœ… preserve per-step outputs
      stepResults.push({
        kind: normalizeKind(stepSpecial.sigKind ?? stepSpecial.kind),
        target: stepSpecial.target ?? null,
        effects: stepResult.effects || {},
        meta: stepResult.meta || {}
      });

      mergeEffects(merged, stepResult.effects);
      if (stepResult?.meta) Object.assign(mergedMeta, stepResult.meta);
    }

    // âœ… expose the step list to the narration layer
    mergedMeta.stepResults = stepResults;

    // Never-silent fallback stays consistent with your normal signature behavior
    const didAnything =
      !!merged.damageDealt ||
      !!merged.healedHp ||
      !!merged.shieldAdded ||
      !!merged.statusApplied ||
      !!merged.atkBuffPct ||
      !!merged.defBuffPct ||
      !!merged.enemyAtkDebuffPct ||
      !!merged.enemyDefDebuffPct ||
      !!merged.nextHitVulnPct ||
      !!merged.damageReductionPct ||
      !!merged.selfDefDebuffPct ||
      !!merged.teamRevive ||
      !!merged.teamDmg ||
      !!merged.teamHeal;

    if (!didAnything) {
      const dmg = computeSimpleDamage(Number(actor.atk || 0) * PLAYER_ATK_MULT, enemy);
      applyDamageToEnemy(enemy, dmg);
      merged.damageDealt = dmg;
    }

    return { used: true, effects: merged, meta: mergedMeta };
  }

  if (kind === "damageEnemy") {
    const mult = Number(special.powerMultiplier ?? 1.5);
    const atk = Number(actor.atk || 0);
    const dmg = computeSimpleDamage(atk * mult * PLAYER_ATK_MULT, enemy);
    applyDamageToEnemy(enemy, dmg);

    effects.damageDealt = dmg;

    if (typeof special.selfDefDebuffPct === "number" && special.selfDefDebuffPct > 0) {
      const turns = normalizeTurns(special.selfDefDebuffTurns ?? 2, 2);

      ensureStatuses(actor);

      const currentPct = Number(actor.statuses.defDebuffPct ?? 0);
      actor.statuses.defDebuffPct = Math.max(currentPct, Number(special.selfDefDebuffPct));
      actor.statuses.defDebuffTurns = turns;

      effects.selfDefDebuffPct = actor.statuses.defDebuffPct;
      effects.selfDefDebuffTurns = turns;
    }
  }

  // HIT (alias)
  if (kind === "HIT") {
    const mult = Number(special.powerMultiplier ?? 1.5);
    const atk = Number(actor.atk || 0);
    const dmg = computeSimpleDamage(atk * mult * PLAYER_ATK_MULT, enemy);
    applyDamageToEnemy(enemy, dmg);
    effects.damageDealt = (effects.damageDealt || 0) + dmg;
  }

  // teamStrike (signature step kind used by dualEffect)
  if (kind === "teamStrike") {
    if (!enemy) return { used: false, error: { code: "noEnemy" } };
    executeTeamStrike({ party, enemy, special, effectsOut: effects });
  }

  // healSelf flat
  if (kind === "healSelf") {
    const amt = Number(special.amount ?? 30);
    effects.healedHp = applyHeal(actor, amt);
  }

  // healSelfMissingPct (revive-friendly)
  if (kind === "healSelfMissingPct") {
    const maxHp = Number(actor.maxHp ?? actor.hpMax ?? actor?.stats?.maxHp ?? 0);
    if (maxHp > 0) {
      const pct = typeof special.missingHealPct === "number" ? special.missingHealPct : 0.5;
      const revivePct = typeof special.revivePct === "number" ? special.revivePct : pct;

      if (Number(actor.hp || 0) <= 0) {
        const revivedHp = clamp(roundInt(maxHp * revivePct), 1, maxHp);
        actor.hp = revivedHp;
        effects.revived = true;
        effects.revivedHp = revivedHp;
        effects.healedHp = revivedHp;
      } else {
        const missing = Math.max(0, maxHp - Number(actor.hp || 0));
        const healAmt = roundInt(missing * pct);
        effects.healedHp = applyHeal(actor, healAmt);
      }
    }
  }

  // healAlly flat
  if (kind === "healAlly") {
    if (!Array.isArray(party) || targetIndex == null || targetIndex < 0 || targetIndex >= party.length) {
      return { used: false, error: { code: "noAllyTarget" } };
    }
    const target = party[targetIndex];
    const amt = Number(special.amount ?? 30);
    effects.healedHp = applyHeal(target, amt);
  }

  // healTeam flat (living only)
  if (kind === "healTeam") {
    if (!Array.isArray(party) || party.length === 0) return { used: false, error: { code: "noParty" } };

    const amt = Number(special.amount ?? 30);
    let total = 0;
    for (const m of party) {
      if (!m || m.hp <= 0) continue;
      total += applyHeal(m, amt);
    }
    effects.healedHp = total;
  }

  // healTeamMissingPct (heals + revives) â€” keep your behavior, but return structured effects
  if (kind === "healTeamMissingPct") {
    if (!Array.isArray(party) || party.length === 0) return { used: false, error: { code: "noParty" } };

    const pct = typeof special.missingHealPct === "number" ? special.missingHealPct : 0.5;
    const revivePct = typeof special.revivePct === "number" ? special.revivePct : pct;

    let totalHealed = 0;
    let revivedCount = 0;

    for (const m of party) {
      if (!m) continue;

      const maxHp = Number(m.maxHp ?? 0);
      if (maxHp <= 0) continue;

      if (Number(m.hp || 0) <= 0) {
        const revivedHp = clamp(roundInt(maxHp * revivePct), 1, maxHp);
        m.hp = revivedHp;
        totalHealed += revivedHp;
        revivedCount += 1;
        continue;
      }

      const missing = Math.max(0, maxHp - Number(m.hp || 0));
      const healAmt = roundInt(missing * pct);
      if (healAmt <= 0) continue;
      totalHealed += applyHeal(m, healAmt);
    }

    if (totalHealed <= 0 && revivedCount <= 0) {
      return { used: false, error: { code: "noEffect" } };
    }

    effects.healedHp = totalHealed;
    if (revivedCount > 0) {
      effects.teamRevive = true;
      effects.revivedCount = revivedCount;
    }
  }

  // healTeamBuff (heal missing% + team buffs)
  if (kind === "healTeamBuff") {
    if (!Array.isArray(party) || party.length === 0) return { used: false, error: { code: "noParty" } };

    const turns = normalizeTurns(special.turns ?? 2, 2);
    const atkUp = normalizePct(special.atkPct ?? 0);
    const defUp = normalizePct(special.defPct ?? 0);
    const pct = typeof special.missingHealPct === "number" ? special.missingHealPct : 0.5;

    let totalHealed = 0;

    for (const m of party) {
      if (!m || m.hp <= 0) continue;

      const maxHp = Number(m.maxHp ?? 0);
      if (maxHp > 0) {
        const missing = Math.max(0, maxHp - Number(m.hp || 0));
        const healAmt = roundInt(missing * pct);
        if (healAmt > 0) totalHealed += applyHeal(m, healAmt);
      }

      if (atkUp > 0) setPctBuff(m, "atk", atkUp, turns);
      if (defUp > 0) setPctBuff(m, "def", defUp, turns);
    }

    effects.healedHp = totalHealed;

    if (atkUp > 0) {
      effects.atkBuffPct = atkUp;
      effects.atkBuffTurns = turns;
    }
    if (defUp > 0) {
      effects.defBuffPct = defUp;
      effects.defBuffTurns = turns;
    }
  }

  // ENEMY debuff + alias debuffEnemy
  if (kind === "ENEMY_DEBUFF" || kind === "debuffEnemy") {
    if (!enemy) return { used: false, error: { code: "noEnemy" } };

    const turns = normalizeTurns(
      special.turns ?? special.defDebuffTurns ?? special.atkDebuffTurns ?? 2,
      2
    );

    const atkDown = normalizePct(special.atkPct ?? special.atkDebuffPct);
    const defDown = normalizePct(special.defPct ?? special.defDebuffPct);

    if (atkDown > 0) setPctDebuff(enemy, "atk", atkDown, turns);
    if (defDown > 0) setPctDebuff(enemy, "def", defDown, turns);

    if (atkDown > 0) {
      effects.enemyAtkDebuffPct = atkDown;
      effects.enemyAtkDebuffTurns = turns;
    }
    if (defDown > 0) {
      effects.enemyDefDebuffPct = defDown;
      effects.enemyDefDebuffTurns = turns;
    }
  }

  // SELF_BUFF (atk/def + optional shield)
  if (kind === "SELF_BUFF") {
    const turns = normalizeTurns(special.turns ?? 2, 2);

    const atkUp = normalizePct(special.atkPct);
    const defUp = normalizePct(special.defPct);

    if (atkUp > 0) {
      setPctBuff(actor, "atk", atkUp, turns);
      effects.atkBuffPct = atkUp;
      effects.atkBuffTurns = turns;
    }
    if (defUp > 0) {
      setPctBuff(actor, "def", defUp, turns);
      effects.defBuffPct = defUp;
      effects.defBuffTurns = turns;
    }

    if (special.shield != null) {
      const shieldAmt = Math.max(0, roundInt(Number(special.shield || 0)));
      if (shieldAmt > 0) {
        const added = applyShield(actor, shieldAmt);
        effects.shieldAdded = added;

        // âœ… Barrier rule: no duration
        // effects.shieldTurns intentionally omitted
      }
    } else if (special.shieldPct != null) {
      const pct = clamp(Number(special.shieldPct || 0), 0, 1);
      const shieldAmt = roundInt(Number(actor.maxHp || 0) * pct);
      if (shieldAmt > 0) {
        const added = applyShield(actor, shieldAmt);
        effects.shieldAdded = added;

        // âœ… Barrier rule: no duration
        // effects.shieldTurns intentionally omitted
      }
    }
  }

  // buffParty (team buffs)
  if (kind === "buffParty") {
    if (!Array.isArray(party) || party.length === 0) return { used: false, error: { code: "noParty" } };

    const turns = normalizeTurns(special.turns ?? special.atkBuffTurns ?? special.defBuffTurns ?? 2, 2);
    const atkUp = normalizePct(special.atkPct ?? special.atkBuffPct);
    const defUp = normalizePct(special.defPct ?? special.defBuffPct);

    for (const m of party) {
      if (!m || m.hp <= 0) continue;
      if (atkUp > 0) setPctBuff(m, "atk", atkUp, turns);
      if (defUp > 0) setPctBuff(m, "def", defUp, turns);
    }

    if (atkUp > 0) {
      effects.atkBuffPct = atkUp;
      effects.atkBuffTurns = turns;
    }
    if (defUp > 0) {
      effects.defBuffPct = defUp;
      effects.defBuffTurns = turns;
    }
  }

  // STATUS + alias statusEnemy
  if (kind === "STATUS" || kind === "statusEnemy") {
    const statusName = String(special.status || "").trim();
    if (statusName) {
      const chance = special.chance == null ? 1 : clamp(Number(special.chance || 0), 0, 1);

      let tgtObj = enemy;
      const baseTarget = getBaseTargetTag(special);

      if (baseTarget === "self") tgtObj = actor;
      else if (baseTarget === "ally") {
        if (!Array.isArray(party) || targetIndex == null || targetIndex < 0 || targetIndex >= party.length) {
          return { used: false, error: { code: "noAllyTarget" } };
        }
        tgtObj = party[targetIndex];
      } else {
        tgtObj = enemy;
      }

      // âœ… NEW: stun/dazed duration comes from target's prone tag (enemy entries)
      const sLower = statusName.toLowerCase();

      // Canonical storage keys (so enemyTurnSystem/statusTickSystem can reliably read them)
      let statusKey = statusName;
      if (sLower.includes("stun")) statusKey = "stun";
      else if (sLower.includes("dazed")) statusKey = "dazed";
      else if (sLower.includes("confus")) statusKey = "confused";

      const proneTurnsRaw = Number(tgtObj?.prone ?? 0);

      const turns =
        (statusKey === "stun" || statusKey === "dazed") && proneTurnsRaw > 0
          ? Math.max(1, Math.floor(proneTurnsRaw))
          : normalizeTurns(special.turns ?? 1, 1);

      if (tgtObj && rollChance(chance)) {
        // Store canonical turns key (stunTurns / dazedTurns / confusedTurns)
        applyGenericStatus(tgtObj, statusKey, turns);

        // Keep original wording for narration
        effects.statusApplied = statusName;
        effects.statusTurns = turns;
      }

      // Optional status-linked vuln payload (used by some signature moves).
      if (tgtObj && (special.nextHitVulnActive || Number(special.nextHitVulnPct || 0) > 0)) {
        const vulnPct = normalizePct(special.nextHitVulnPct);
        const vulnTurns = normalizeTurns(special.nextHitVulnTurns ?? 1, 1);

        if (vulnPct > 0) {
          const s = ensureStatuses(tgtObj);
          s.nextHitVulnActive = true;
          s.nextHitVulnPct = Math.max(Number(s.nextHitVulnPct || 0), vulnPct);
          s.nextHitVulnTurns = Math.max(Number(s.nextHitVulnTurns || 0), vulnTurns);

          effects.nextHitVulnPct = s.nextHitVulnPct;
          effects.nextHitVulnTurns = s.nextHitVulnTurns;
        }
      }
    }
  }

  // If nothing happened, keep your â€œnever silentâ€ behavior via a small hit
  const didAnything =
    !!effects.damageDealt ||
    !!effects.healedHp ||
    !!effects.shieldAdded ||
    !!effects.statusApplied ||
    !!effects.atkBuffPct ||
    !!effects.defBuffPct ||
    !!effects.enemyAtkDebuffPct ||
    !!effects.enemyDefDebuffPct ||
    !!effects.nextHitVulnPct ||
    !!effects.damageReductionPct ||
    !!effects.selfDefDebuffPct ||
    !!effects.teamRevive;

  if (!didAnything) {
    const dmg = computeSimpleDamage(Number(actor.atk || 0) * PLAYER_ATK_MULT, enemy);
    applyDamageToEnemy(enemy, dmg);
    effects.damageDealt = dmg;
  }

  return { used: true, effects, meta };
}

// ---------------- GENRE EXECUTION ----------------
function executeGenre({ actor, party, enemy, special, M, targetIndex }) {
  const data = special.data || {};
  const genre = special.genre;

  const scaledPct = (obj) => {
    if (!obj) return 0;
    const base = Number(obj.value || 0);
    return obj.imdbScale ? base * M : base;
  };

  // Narration-facing summary (Track A): numbers + applied flags + turns.
  const outcome = {
    dmg: 0,
    teamDmg: 0,
    teamHeal: 0,
    heal: 0,
    shield: 0,
    anyDebuff: 0,

    buffTurns: 0,
    debuffTurns: 0,
    shieldTurns: 0,
    drTurns: 0,

    teamAtkBuffApplied: false,
    teamDefBuffApplied: false,

    atkBuffApplied: false,
    defBuffApplied: false,
    selfDefDebuffApplied: false,
    enemyAtkDebuffApplied: false,
    enemyDefDebuffApplied: false,

    shieldApplied: false,
    nextHitVulnApplied: false,
    damageReductionApplied: false
  };

  // ---------------- ACTION / SCIFI ----------------
  if (genre === "ACTION" || genre === "SCIFI") {
    const atkBuff = scaledPct(data.atkBuffPct);
    const turns = data.atkBuffPct?.turns ?? 2;

    if (atkBuff > 0) {
      setPctBuff(actor, "atk", atkBuff, turns);
      outcome.atkBuffApplied = true;
      outcome.buffTurns = Math.max(outcome.buffTurns, turns);
    }

    if (data.defDebuffPct) {
      const defDown = scaledPct(data.defDebuffPct);
      const dt = data.defDebuffPct?.turns ?? 2;

      if (defDown > 0) {
        setPctDebuff(actor, "def", defDown, dt);
        outcome.selfDefDebuffApplied = true;
        outcome.debuffTurns = Math.max(outcome.debuffTurns, dt);
        outcome.anyDebuff = 1;
      }
    }

    const ih = data.immediateHit;
    if (ih?.enabled) {
      const atkForHit = effectiveAtkWithTemporaryBoost(actor, atkBuff);
      const mult = randFloat(ih.minMult ?? 1.5, ih.maxMult ?? 2.0);
      outcome.dmg = computeSimpleDamage(atkForHit * mult * PLAYER_ATK_MULT, enemy);
      applyDamageToEnemy(enemy, outcome.dmg);
    }

    return { used: true, effects: outcome };
  }

  // ------------- ADVENTURE / MUSICAL --------------
  if (genre === "ADVENTURE" || genre === "MUSICAL") {
    const teamAtkBuff = scaledPct(data.teamAtkBuffPct);
    const teamAtkTurns = data.teamAtkBuffPct?.turns ?? (genre === "MUSICAL" ? 1 : 2);

    if (teamAtkBuff > 0) {
      for (const m of party) {
        if (!m || m.hp <= 0) continue;
        setPctBuff(m, "atk", teamAtkBuff, teamAtkTurns);
      }
      outcome.teamAtkBuffApplied = true;
      outcome.buffTurns = Math.max(outcome.buffTurns, teamAtkTurns);
    }

    if (data.teamDefBuffPct) {
      const teamDefBuff = scaledPct(data.teamDefBuffPct);
      const teamDefTurns = data.teamDefBuffPct?.turns ?? 2;

      if (teamDefBuff > 0) {
        for (const m of party) {
          if (!m || m.hp <= 0) continue;
          setPctBuff(m, "def", teamDefBuff, teamDefTurns);
        }
        outcome.teamDefBuffApplied = true;
        outcome.buffTurns = Math.max(outcome.buffTurns, teamDefTurns);
      }
    }

    if (data.teamHealMaxHpPct) {
      const healPct = scaledPct(data.teamHealMaxHpPct);
      if (healPct > 0) {
        for (const m of party) {
          if (!m || m.hp <= 0) continue;
          outcome.teamHeal += applyHeal(m, roundInt(Number(m.maxHp || 0) * healPct));
        }
      }
    }

    if (data.teamStrike?.enabled) {
      const alive = party.filter((m) => m && m.hp > 0);
      if (alive.length > 0) {
        const R = randFloat(
          data.teamStrike.totalMinMult ?? 1.5,
          data.teamStrike.totalMaxMult ?? 2.8
        );

        const finalATKs = alive.map((m) => Number(m.atk || 0) * (1 + teamAtkBuff));
        const shares = sqrtWeightShares(finalATKs);

        for (let i = 0; i < alive.length; i++) {
          const portionMult = R * shares[i];
          const dmg = computeSimpleDamage(finalATKs[i] * portionMult * PLAYER_ATK_MULT, enemy);
          outcome.teamDmg += applyDamageToEnemy(enemy, dmg);
        }
      }
    }

    return { used: true, effects: outcome };
  }

  // ------------------- DRAMA ----------------------
  if (genre === "DRAMA") {
    const healPct = scaledPct(data.healSelfMaxHpPct);
    const maxHp = Number(actor.maxHp ?? actor.hpMax ?? actor?.stats?.maxHp ?? 0);

    if (healPct > 0 && maxHp > 0) {
      outcome.heal = applyHeal(actor, roundInt(maxHp * healPct));
    }

    const defUp = scaledPct(data.defBuffPct);
    const turns = data.defBuffPct?.turns ?? 2;

    if (defUp > 0) {
      setPctBuff(actor, "def", defUp, turns);
      outcome.defBuffApplied = true;
      outcome.buffTurns = Math.max(outcome.buffTurns, turns);
    }

    return { used: true, effects: outcome };
  }

  // ------------------ COMEDY ----------------------
  if (genre === "COMEDY") {
    const enemyAtkDown = scaledPct(data.enemyAtkDebuffPct);
    const turns = data.enemyAtkDebuffPct?.turns ?? 2;

    if (enemyAtkDown > 0) {
      setPctDebuff(enemy, "atk", enemyAtkDown, turns);
      outcome.enemyAtkDebuffApplied = true;
      outcome.debuffTurns = Math.max(outcome.debuffTurns, turns);
      outcome.anyDebuff = 1;
    }

    const teamDefUp = scaledPct(data.teamDefBuffPct);
    const defTurns = data.teamDefBuffPct?.turns ?? 2;

    if (teamDefUp > 0) {
      for (const m of party) {
        if (!m || m.hp <= 0) continue;
        setPctBuff(m, "def", teamDefUp, defTurns);
      }
      outcome.teamDefBuffApplied = true;
      outcome.buffTurns = Math.max(outcome.buffTurns, defTurns);
    }

    const healPct = scaledPct(data.teamHealMaxHpPct);
    if (healPct > 0) {
      for (const m of party) {
        if (!m || m.hp <= 0) continue;
        outcome.teamHeal += applyHeal(m, roundInt(Number(m.maxHp || 0) * healPct));
      }
    }

    return { used: true, effects: outcome };
  }

  // ------------------ HORROR ----------------------
  if (genre === "HORROR") {
    const boostPct = scaledPct(data.preHitAtkBuffPct);
    const atkForHit = effectiveAtkWithTemporaryBoost(actor, boostPct);

    outcome.dmg = computeSimpleDamage(atkForHit * PLAYER_ATK_MULT, enemy);
    applyDamageToEnemy(enemy, outcome.dmg);

    const defDown = scaledPct(data.enemyDefDebuffPct);
    const turns = data.enemyDefDebuffPct?.turns ?? 2;

    if (defDown > 0) {
      setPctDebuff(enemy, "def", defDown, turns);
      outcome.enemyDefDebuffApplied = true;
      outcome.debuffTurns = Math.max(outcome.debuffTurns, turns);
      outcome.anyDebuff = 1;
    }

    return { used: true, effects: outcome };
  }

  // ----------------- THRILLER ---------------------
  if (genre === "THRILLER") {
    const vuln = scaledPct(data.nextHitVulnPct);
    const turns = data.nextHitVulnPct?.turns ?? 1;

    const s = ensureStatuses(enemy);
    s.nextHitVulnPct = Math.max(Number(s.nextHitVulnPct || 0), Number(vuln || 0));
    s.nextHitVulnTurns = Math.max(Number(s.nextHitVulnTurns || 0), Number(turns || 0));
    s.nextHitVulnActive = true;

    if (vuln > 0) {
      outcome.nextHitVulnApplied = true;
      outcome.debuffTurns = Math.max(outcome.debuffTurns, turns);
    }

    return { used: true, effects: outcome };
  }

  // -------- MYSTERY / CRIME / DOCUMENTARY ---------
  if (genre === "MYSTERY" || genre === "CRIME" || genre === "DOCUMENTARY") {
    let applied = 0;

    if (data.enemyDefDebuffPct) {
      const defDown = scaledPct(data.enemyDefDebuffPct);
      const turns = data.enemyDefDebuffPct?.turns ?? 2;

      if (defDown > 0) {
        setPctDebuff(enemy, "def", defDown, turns);
        outcome.enemyDefDebuffApplied = true;
        outcome.debuffTurns = Math.max(outcome.debuffTurns, turns);
        applied = 1;
      }
    }

    if (data.enemyAtkDebuffPct) {
      const atkDown = scaledPct(data.enemyAtkDebuffPct);
      const turns = data.enemyAtkDebuffPct?.turns ?? 2;

      if (atkDown > 0) {
        setPctDebuff(enemy, "atk", atkDown, turns);
        outcome.enemyAtkDebuffApplied = true;
        outcome.debuffTurns = Math.max(outcome.debuffTurns, turns);
        applied = 1;
      }
    }

    outcome.anyDebuff = applied ? 1 : 0;

    return { used: true, effects: outcome };
  }

  // ------------------ ROMANCE ---------------------
  if (genre === "ROMANCE") {
    if (!Array.isArray(party) || targetIndex == null || targetIndex < 0 || targetIndex >= party.length) {
      return { used: false, error: { code: "noAllyTarget" } };
    }

    const target = party[targetIndex];
    const healPct = scaledPct(data.healAllyMaxHpPct);
    outcome.heal = applyHeal(target, roundInt(Number(target.maxHp || 0) * healPct));

    return { used: true, effects: outcome, meta: { targetIndex } };
  }

  // ------------------ FANTASY ---------------------
  if (genre === "FANTASY") {
    if (!Array.isArray(party) || targetIndex == null || targetIndex < 0 || targetIndex >= party.length) {
      return { used: false, error: { code: "noAllyTarget" } };
    }

    const target = party[targetIndex];
        const shieldPct = scaledPct(data.shieldAllyMaxHpPct);

    outcome.shield = roundInt(Number(target.maxHp || 0) * shieldPct);
    applyShield(target, outcome.shield);

    if (outcome.shield > 0) {
      outcome.shieldApplied = true;

      // âœ… Barrier rule: no duration
      // outcome.shieldTurns intentionally omitted
    }

    return { used: true, effects: outcome, meta: { targetIndex } };
  }

  // ---------------- ANIMATION ---------------------
  if (genre === "ANIMATION") {
    const dr = scaledPct(data.teamDamageReductionPct);
    const turns = data.teamDamageReductionPct?.turns ?? 2;

    for (const m of party) {
      if (!m || m.hp <= 0) continue;
      const s = ensureStatuses(m);
      s.damageReductionPct = Math.max(Number(s.damageReductionPct || 0), Number(dr || 0));
      s.damageReductionTurns = Math.max(Number(s.damageReductionTurns || 0), Number(turns || 0));
    }

    if (dr > 0) {
      outcome.damageReductionApplied = true;
      outcome.drTurns = turns;
    }

    return { used: true, effects: outcome };
  }

  // ------------------ FALLBACK --------------------
  return { used: true, effects: outcome };
}




