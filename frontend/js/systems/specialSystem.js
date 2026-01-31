// frontend/js/systems/specialSystem.js
//
// ✅ Update (combo-tag targets):
// - `special.target` can be a string OR an array of tags.
//   Examples:
//     target: "enemy"
//     target: ["team","teamStrike"]
//     target: ["ally","heal","revive"]
// - "Base target" (self/ally/enemy/team) is used ONLY for:
//   - picking targets in UI / narration {target}
// - Extra tags (teamStrike, revive, heal, debuff, buff, etc.) are available
//   for your UI combo text rules (in battleHelpPanel.js) and for future branching.
// - Existing logic remains compatible with legacy string targets.
//
// Notes:
// - This file applies buffs/debuffs as actor/enemy `statuses` with `*Pct` + `*Turns` keys.
// - It supports temp shields via `actor.tempShield`.
// - It does NOT globally tick status durations; keep that separate.
//
// ✅ Added support for "missing kinds" found in specials.js / your pages:
// - debuffEnemy (alias of ENEMY_DEBUFF; supports both schemas)
// - buffParty (team ATK/DEF buffs; supports both schemas)
// - statusEnemy (alias of STATUS; enemy-default)
//
// ✅ HealTeamMissingPct now heals OR revives:
// - living allies: heals a % of missing HP
// - downed allies: revives to revivePct * maxHp (fallback: missingHealPct)

import { imdbMultiplier } from "./imdbScaling.js";
import { genreSpecials } from "../data/genreSpecials.js";
import { getAllSignatureSpecials } from "../data/specials.js";
import { specialEffectTextByMovie } from "../data/specialEffectText.js";

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

// -------- target tags / base target helpers --------

function normalizeTargetTags(target) {
  if (Array.isArray(target)) return target.filter(Boolean).map(String);
  if (typeof target === "string" && target.trim()) return [target.trim()];
  return [];
}

function targetHas(special, tag) {
  return normalizeTargetTags(special?.target).includes(tag);
}

function getBaseTargetTag(special) {
  // Base target determines selection / narration target name.
  const tags = normalizeTargetTags(special?.target);

  if (tags.includes("self")) return "self";
  if (tags.includes("ally")) return "ally";
  if (tags.includes("enemy")) return "enemy";
  if (tags.includes("team")) return "team";
  if (tags.includes("party")) return "team"; // legacy support

  // Legacy: if target was a string but not one of the above
  if (typeof special?.target === "string" && special.target.trim()) return special.target.trim();

  return "enemy";
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

function applyShield(actor, amount, turns = 2) {
  if (!actor.tempShield) actor.tempShield = 0;
  actor.tempShield += Math.max(0, roundInt(amount || 0));

  const s = ensureStatuses(actor);
  s.shieldTurns = Math.max(Number(s.shieldTurns || 0), Number(turns || 0));
}

function applyHeal(target, amount) {
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
  const tk = `${statusKey}Turns`;
  s[tk] = Math.max(Number(s[tk] || 0), Number(turns || 1));
}

// ---------------- TEXT / EFFECT SUMMARY HELPERS ----------------

function shortTitle(actorOrMember) {
  const t = actorOrMember?.movie?.title || actorOrMember?.name || "Actor";
  return String(t).slice(0, 30);
}

function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => {
    return vars[k] != null ? String(vars[k]) : `{${k}}`;
  });
}

function asTemplateList(v) {
  if (typeof v === "string" && v.trim()) return [v.trim()];
  if (Array.isArray(v)) return v.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
  return [];
}

function renderEffectTemplateLines(templates, vars) {
  return asTemplateList(templates).map((tpl) => renderTemplate(tpl, vars));
}

/**
 * Default effect-summary generator + optional per-effect override templates.
 */
function buildEffectLines(effects, targetPrefix = "", enemyName = "", effectTextOverride = null, contextVars = null) {
  if (!effects) return [];

  const prefix = targetPrefix ? `${String(targetPrefix).trim()} ` : "";
  const enemyLabel = enemyName || "the enemy";
  const lines = [];

  const baseVars = {
    target: String(targetPrefix).trim(),
    enemy: enemyLabel,
    actor: contextVars?.actor || "",
    move: contextVars?.move || "",
    value: ""
  };

  const add = (effectKey, defaultLineFn, valueForTemplate) => {
    const override = effectTextOverride?.[effectKey];
    if (override) {
      lines.push(...renderEffectTemplateLines(override, { ...baseVars, value: valueForTemplate }));
      return;
    }
    const fallback = defaultLineFn();
    if (fallback) lines.push(fallback);
  };

  if (effects.damageDealt > 0) {
    add("damageDealt", () => `${enemyLabel} takes ${effects.damageDealt} damage.`, effects.damageDealt);
  }

  if (effects.healedHp > 0) {
    add("healedHp", () => `${prefix}heals ${effects.healedHp} HP.`, effects.healedHp);
  }

  if (effects.shieldAdded > 0) {
    const t = effects.shieldTurns ? ` (${effects.shieldTurns}T)` : "";
    add("shieldAdded", () => `${prefix}gains a shield of ${effects.shieldAdded}${t}.`, effects.shieldAdded);
  }

  if (effects.atkBuffPct > 0) {
    const t = effects.atkBuffTurns ? ` (${effects.atkBuffTurns}T)` : "";
    add(
      "atkBuffPct",
      () => `${prefix}ATK↑ ${(effects.atkBuffPct * 100).toFixed(0)}%${t}.`,
      (effects.atkBuffPct * 100).toFixed(0)
    );
  }

  if (effects.defBuffPct > 0) {
    const t = effects.defBuffTurns ? ` (${effects.defBuffTurns}T)` : "";
    add(
      "defBuffPct",
      () => `${prefix}DEF↑ ${(effects.defBuffPct * 100).toFixed(0)}%${t}.`,
      (effects.defBuffPct * 100).toFixed(0)
    );
  }

  if (effects.damageReductionPct > 0) {
    const t = effects.damageReductionTurns ? ` (${effects.damageReductionTurns}T)` : "";
    add(
      "damageReductionPct",
      () => `${prefix}takes ${(effects.damageReductionPct * 100).toFixed(0)}% less damage${t}.`,
      (effects.damageReductionPct * 100).toFixed(0)
    );
  }

  if (effects.enemyAtkDebuffPct > 0) {
    const t = effects.enemyAtkDebuffTurns ? ` (${effects.enemyAtkDebuffTurns}T)` : "";
    add(
      "enemyAtkDebuffPct",
      () => `${enemyLabel} ATK↓ ${(effects.enemyAtkDebuffPct * 100).toFixed(0)}%${t}.`,
      (effects.enemyAtkDebuffPct * 100).toFixed(0)
    );
  }

  if (effects.enemyDefDebuffPct > 0) {
    const t = effects.enemyDefDebuffTurns ? ` (${effects.enemyDefDebuffTurns}T)` : "";
    add(
      "enemyDefDebuffPct",
      () => `${enemyLabel} DEF↓ ${(effects.enemyDefDebuffPct * 100).toFixed(0)}%${t}.`,
      (effects.enemyDefDebuffPct * 100).toFixed(0)
    );
  }

  // (Optional) you can add more keys later (self debuffs, etc.) without touching targeting.
  if (effects.statusApplied) {
    const t = effects.statusTurns ? ` (${effects.statusTurns}T)` : "";
    add("statusApplied", () => `${enemyLabel} suffers ${effects.statusApplied}${t}.`, effects.statusApplied);
  }

  return lines;
}

function computeTargetsForText({ actor, party, enemy, special, targetIndex }) {
  const actorName = shortTitle(actor);
  const baseTarget = getBaseTargetTag(special);

  let targetName = "target";
  if (baseTarget === "ally") {
    const tgt = party?.[targetIndex];
    targetName = tgt ? shortTitle(tgt) : "ally";
  } else if (baseTarget === "self") {
    targetName = actorName;
  } else if (baseTarget === "enemy") {
    targetName = enemy?.name || enemy?.title || "the enemy";
  } else if (baseTarget === "team") {
    targetName = "the team";
  }

  return { actorName, targetName };
}

function getTextTemplates(block, key) {
  if (!block || typeof block !== "object") return [];
  return asTemplateList(block[key]);
}

function applyCustomNarrationIfPresent({ actor, party, enemy, special, targetIndex, result }) {
  if (!result?.used) return result;

  const textBlock = special?.text;
  if (!textBlock || typeof textBlock !== "object") return result;

  const introTemplates = getTextTemplates(textBlock, "intro");
  const outroTemplates = getTextTemplates(textBlock, "outro");
  if (introTemplates.length === 0 && outroTemplates.length === 0) return result;

  const { actorName, targetName } = computeTargetsForText({ actor, party, enemy, special, targetIndex });

  const introLines = introTemplates.map((tpl) =>
    renderTemplate(tpl, { actor: actorName, target: targetName, move: special?.name || "Special" })
  );
  const outroLines = outroTemplates.map((tpl) =>
    renderTemplate(tpl, { actor: actorName, target: targetName, move: special?.name || "Special" })
  );

  const showEffects = textBlock.showEffects !== false;

  // Only prefix self/ally. Enemy/team effects read better without prefixing a name.
  let effectTargetLabel = "";
  const baseTarget = getBaseTargetTag(special);
  if (baseTarget === "ally") effectTargetLabel = targetName;
  else if (baseTarget === "self") effectTargetLabel = actorName;

  const enemyName = enemy?.name || enemy?.title || enemy?.movie?.title || "the enemy";
  const effectTextOverride = textBlock.effectText || null;

  const effectLines = showEffects
    ? buildEffectLines(result.effects, effectTargetLabel, enemyName, effectTextOverride, {
        actor: actorName,
        move: special?.name || "Special"
      })
    : [];

  result.lines = [...introLines, ...effectLines, ...outroLines];
  return result;
}

/**
 * Central narration lookup.
 * Supports:
 * - exact: registry["sig:movieId:specialId"]
 * - per-movie default: registry["movie:movieId"]
 */
function getSpecialTextForUnifiedSpecial(unifiedSpecial) {
  if (!unifiedSpecial) return null;

  // Inline always wins
  if (unifiedSpecial.text) return unifiedSpecial.text;

  const registry = specialEffectTextByMovie;
  if (!registry) return null;

  const key = unifiedSpecial.key;
  if (key && registry[key]) return registry[key];

  // signature-only movie fallback: sig:<movieId>:<id>
  let movieId = null;
  if (typeof key === "string" && key.startsWith("sig:")) {
    const parts = key.split(":");
    movieId = parts[1] || null;
  }
  if (movieId) {
    const fallback = registry[`movie:${movieId}`];
    if (fallback) return fallback;
  }

  return null;
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

  // --- target inference (only if not explicitly authored) ---
  // NOTE: now returns BASE tags (array) so you can add modifiers later per move.
  let target = signature.target || null;

  if (!target) {
    if (
      sigKind === "damageEnemy" ||
      sigKind === "HIT" ||
      sigKind === "ENEMY_DEBUFF" ||
      sigKind === "debuffEnemy" || // ✅ alias used in your specials
      sigKind === "STATUS" ||
      sigKind === "statusEnemy" // ✅ alias used in your specials
    ) {
      target = ["enemy"];
    } else if (
        sigKind === "healSelf" ||
        sigKind === "healSelfMissingPct" ||
        sigKind === "SELF_BUFF") {
      target = ["self"];
    } else if (sigKind === "healAlly" || sigKind === "healAllyMissingPct") {
      // default base tag only; author can add ["heal","revive"] etc. in specials.js
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

    // passthrough fields (core)
    atkPct: signature.atkPct ?? null,
    defPct: signature.defPct ?? null,
    turns: signature.turns ?? null,
    status: signature.status ?? null,
    chance: signature.chance ?? null,
    shield: signature.shield ?? null,
    shieldPct: signature.shieldPct ?? null,

    // custom behavior params (heals)
    missingHealPct: signature.missingHealPct ?? null,
    revivePct: signature.revivePct ?? null,

    // ✅ additional passthrough fields used by your specials.js variants
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

  unified.text = signature.text ?? getSpecialTextForUnifiedSpecial(unified);
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

    // IMPORTANT: can be string OR array; battleHelpPanel will treat it as tags.
    target: def.target,

    data,
    cooldownTurns: DEFAULT_COOLDOWNTURNS_SAFE()
      ? DEFAULT_COOLDOWN_TURNS
      : DEFAULT_COOLDOWN_TURNS, // defensive; keep constant

    text: intro ? { intro } : null
  };
}

// tiny no-op guard to prevent accidental rename mistakes during edits
function DEFAULT_COOLDOWNTURNS_SAFE() {
  return true;
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
  targetIndex = null
}) {
  if (!actor || actor.hp <= 0) return { lines: ["No valid actor."], used: false };
  if (!special) return { lines: ["No special selected."], used: false };

  if (!isSpecialReady(actor, special.key)) {
    const cd = getCooldownRemaining(actor, special.key);
    return {
      lines: [`${special.name} is on cooldown (${cd} turn${cd === 1 ? "" : "s"}).`],
      used: false
    };
  }

  const imdb = Number(actor?.movie?.imdb ?? 7.0);
  const M = imdbMultiplier(imdb);

  // Heal/revive missing%: require base target ally (works whether target is string or tags array)
  if (special.kind === "healAllyMissingPct" && getBaseTargetTag(special) === "ally") {
    const result = executeHealAllyMissingPct({ actor, party, special, targetIndex });

    const narrated = applyCustomNarrationIfPresent({
      actor,
      party,
      enemy,
      special,
      targetIndex,
      result
    });

    if (narrated?.used) {
      startSpecialCooldown(actor, special.key, special.cooldownTurns ?? DEFAULT_COOLDOWN_TURNS);
    }
    return narrated;
  }

  let result;
  if (special.source === "signature") {
    result = executeSignature({ actor, party, enemy, special, targetIndex, M });
  } else if (special.source === "genre") {
    result = executeGenre({ actor, party, enemy, special, M, targetIndex });
  } else {
    result = { lines: ["Unknown special type."], used: false };
  }

  result = applyCustomNarrationIfPresent({ actor, party, enemy, special, targetIndex, result });

  if (result?.used) {
    startSpecialCooldown(actor, special.key, special.cooldownTurns ?? DEFAULT_COOLDOWN_TURNS);
  }

  return result;
}

// Helper: heals ally for a % of missing HP; revives to a % of max HP if down
function executeHealAllyMissingPct({ actor, party, special, targetIndex }) {
  if (!Array.isArray(party) || party.length === 0) return { lines: ["No party to heal."], used: false };
  if (typeof targetIndex !== "number" || targetIndex < 0 || targetIndex >= party.length) {
    return { lines: ["No valid target selected."], used: false };
  }

  const target = party[targetIndex];
  if (!target) return { lines: ["No valid target selected."], used: false };

  const maxHp = target.maxHp ?? target.hpMax ?? target?.stats?.hpMax ?? target?.stats?.maxHp;

  if (!maxHp || typeof maxHp !== "number") {
    return { lines: [`${special.name} fizzles — ${target.name}'s max HP is unknown.`], used: false };
  }

  const pct = typeof special.missingHealPct === "number" ? special.missingHealPct : 0.75;
  const revivePct = typeof special.revivePct === "number" ? special.revivePct : pct;

  // Revive case
  if (target.hp <= 0) {
    const revivedHp = roundInt(maxHp * revivePct);
    target.hp = clamp(revivedHp, 1, maxHp);
    return {
      used: true,
      lines: [
        `${actor.name} uses ${special.name} on ${target.name}!`,
        special.description || `${target.name} returns to the fight!`
      ],
      effects: { healedHp: target.hp } // optional (you may later change to revive-specific key)
    };
  }

  // Heal missing HP case
  const missing = Math.max(0, maxHp - target.hp);
  const healAmt = roundInt(missing * pct);
  if (healAmt <= 0) return { lines: [`${target.name} is already at full health.`], used: false };

  target.hp = clamp(target.hp + healAmt, 0, maxHp);
  return {
    used: true,
    lines: [
      `${actor.name} uses ${special.name} on ${target.name}!`,
      special.description || `${target.name} feels restored.`
    ],
    effects: { healedHp: healAmt }
  };
}

// ---------------- SIGNATURE EXECUTION ----------------

function executeSignature({ actor, party, enemy, special, targetIndex, M }) {
  const lines = [];
  const title = (actor.movie?.title || "Actor").slice(0, 10);

  const kind = special.sigKind ?? special.kind;

  // damageEnemy (supports optional self vulnerability)
  if (kind === "damageEnemy") {
    const mult = Number(special.powerMultiplier ?? 1.5);
    const atk = Number(actor.atk || 0);
    const dmg = computeSimpleDamage(atk * mult, enemy);
    applyDamageToEnemy(enemy, dmg);

    // Optional: apply self vulnerability (def debuff on self), refresh duration
    if (typeof special.selfDefDebuffPct === "number" && special.selfDefDebuffPct > 0) {
      const turns = normalizeTurns(special.selfDefDebuffTurns ?? 2, 2);

      ensureStatuses(actor);

      const currentPct = Number(actor.statuses.defDebuffPct ?? 0);
      actor.statuses.defDebuffPct = Math.max(currentPct, Number(special.selfDefDebuffPct));
      actor.statuses.defDebuffTurns = turns;

      lines.push(
        `${title} uses ${special.name} for ${dmg} damage! (Exposed: DEF ↓ ${Math.round(
          actor.statuses.defDebuffPct * 100
        )}% for ${turns}T)`
      );

      return {
        lines,
        used: true,
        effects: {
          damageDealt: dmg,
          selfDefDebuffPct: actor.statuses.defDebuffPct,
          selfDefDebuffTurns: turns
        }
      };
    }

    lines.push(`${title} uses ${special.name} for ${dmg} damage!`);
    return { lines, used: true, effects: { damageDealt: dmg } };
  }

  if (kind === "healSelf") {
    const amt = Number(special.amount ?? 30);
    const healed = applyHeal(actor, amt);

    lines.push(`${title} uses ${special.name} and heals ${healed} HP.`);
    return { lines, used: true, effects: { healedHp: healed } };
  }

    // ✅ Heal self for a % of missing HP; revives if down
  if (kind === "healSelfMissingPct") {
    const maxHp = Number(actor.maxHp ?? actor.hpMax ?? actor?.stats?.maxHp ?? 0);

    if (!maxHp || maxHp <= 0) {
      return { lines: ["Max HP unknown."], used: false };
    }

    const pct = typeof special.missingHealPct === "number"
      ? special.missingHealPct
      : 0.5;

    const revivePct = typeof special.revivePct === "number"
      ? special.revivePct
      : pct;

    // Revive case
    if (actor.hp <= 0) {
      const revivedHp = clamp(roundInt(maxHp * revivePct), 1, maxHp);
      actor.hp = revivedHp;

      lines.push(`${title} uses ${special.name} and returns to the fight!`);
      return {
        lines,
        used: true,
        effects: { healedHp: revivedHp }
      };
    }

    // Heal missing HP case
    const missing = Math.max(0, maxHp - Number(actor.hp || 0));
    const healAmt = roundInt(missing * pct);

    if (healAmt <= 0) {
      return { lines: [`${title} is already at full health.`], used: false };
    }

    actor.hp = clamp(actor.hp + healAmt, 0, maxHp);

    lines.push(`${title} uses ${special.name} and restores ${healAmt} HP.`);
    return {
      lines,
      used: true,
      effects: { healedHp: healAmt }
    };
  }


  if (kind === "healAlly") {
    if (targetIndex == null || targetIndex < 0 || targetIndex >= party.length) {
      return { lines: ["Choose an ally target."], used: false };
    }
    const target = party[targetIndex];
    const amt = Number(special.amount ?? 30);
    const healed = applyHeal(target, amt);

    lines.push(`${title} uses ${special.name} on ${target.movie.title.slice(0, 10)} (+${healed} HP).`);
    return { lines, used: true, effects: { healedHp: healed } };
  }

  if (kind === "healTeam") {
    if (!Array.isArray(party) || party.length === 0) {
      return { lines: ["No party to heal."], used: false };
    }

    const amt = Number(special.amount ?? 30);
    let totalHealed = 0;

    for (const m of party) {
      if (!m || m.hp <= 0) continue; // living allies only
      totalHealed += applyHeal(m, amt);
    }

    lines.push(`${title} uses ${special.name} and heals the team (+${totalHealed} total HP).`);
    return { lines, used: true, effects: { healedHp: totalHealed } };
  }

  // ✅ Team heal for a % of each ally's missing HP (signature)
  // ✅ ALSO revives downed allies to revivePct * maxHp (or missingHealPct if revivePct absent)
  if (kind === "healTeamMissingPct") {
    if (!Array.isArray(party) || party.length === 0) {
      return { lines: ["No party to heal."], used: false };
    }

    const pct = typeof special.missingHealPct === "number" ? special.missingHealPct : 0.5;
    const revivePct = typeof special.revivePct === "number" ? special.revivePct : pct;

    let totalHealed = 0;
    let revivedCount = 0;

    for (const m of party) {
      if (!m) continue;

      const maxHp = Number(m.maxHp ?? 0);
      if (maxHp <= 0) continue;

      // Revive case
      if (Number(m.hp || 0) <= 0) {
        const revivedHp = clamp(roundInt(maxHp * revivePct), 1, maxHp);
        m.hp = revivedHp;
        totalHealed += revivedHp; // counts as "healed" for summary purposes
        revivedCount += 1;
        continue;
      }

      // Heal missing HP case
      const missing = Math.max(0, maxHp - Number(m.hp || 0));
      const healAmt = roundInt(missing * pct);
      if (healAmt <= 0) continue;

      totalHealed += applyHeal(m, healAmt);
    }

    if (totalHealed <= 0 && revivedCount <= 0) {
      return { lines: ["The team is already fully recovered."], used: false };
    }

    const reviveText = revivedCount > 0 ? `, revived ${revivedCount}` : "";
    lines.push(`${title} uses ${special.name}! The team regains ${totalHealed} total HP${reviveText}.`);
    return { lines, used: true, effects: { healedHp: totalHealed } };
  }

  // ✅ Team heal + team buff (signature) using missingHealPct
  if (kind === "healTeamBuff") {
    if (!Array.isArray(party) || party.length === 0) {
      return { lines: ["No party to affect."], used: false };
    }

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

    lines.push(`${title} uses ${special.name}! (+${totalHealed} total HP, buffs ${turns}T).`);

    return {
      lines,
      used: true,
      effects: {
        healedHp: totalHealed,
        atkBuffPct: atkUp,
        atkBuffTurns: atkUp > 0 ? turns : 0,
        defBuffPct: defUp,
        defBuffTurns: defUp > 0 ? turns : 0
      }
    };
  }

  if (kind === "HIT") {
    const mult = Number(special.powerMultiplier ?? 1.5);
    const atk = Number(actor.atk || 0);
    const dmg = computeSimpleDamage(atk * mult, enemy);
    applyDamageToEnemy(enemy, dmg);

    lines.push(`${title} uses ${special.name} for ${dmg} damage!`);
    return { lines, used: true, effects: { damageDealt: dmg } };
  }

  // ✅ ENEMY debuff + alias: debuffEnemy
  if (kind === "ENEMY_DEBUFF" || kind === "debuffEnemy") {
    if (!enemy) return { lines: ["No enemy target."], used: false };

    const turns = normalizeTurns(
      special.turns ?? special.defDebuffTurns ?? special.atkDebuffTurns ?? 2,
      2
    );

    // supports BOTH schemas:
    // - authored schema: atkPct/defPct
    // - existing schema: atkDebuffPct/defDebuffPct
    const atkDown = normalizePct(special.atkPct ?? special.atkDebuffPct);
    const defDown = normalizePct(special.defPct ?? special.defDebuffPct);

    if (atkDown > 0) setPctDebuff(enemy, "atk", atkDown, turns);
    if (defDown > 0) setPctDebuff(enemy, "def", defDown, turns);

    if (atkDown <= 0 && defDown <= 0) {
      lines.push(`${title} uses ${special.name}, but it has no effect.`);
      return { lines, used: true, effects: null };
    }

    lines.push(`${title} uses ${special.name}! Debuffs applied (${turns}T).`);

    return {
      lines,
      used: true,
      effects: {
        enemyAtkDebuffPct: atkDown,
        enemyAtkDebuffTurns: atkDown > 0 ? turns : 0,
        enemyDefDebuffPct: defDown,
        enemyDefDebuffTurns: defDown > 0 ? turns : 0
      }
    };
  }

  if (kind === "SELF_BUFF") {
    const turns = normalizeTurns(special.turns ?? 2, 2);

    const atkUp = normalizePct(special.atkPct);
    const defUp = normalizePct(special.defPct);

    if (atkUp > 0) setPctBuff(actor, "atk", atkUp, turns);
    if (defUp > 0) setPctBuff(actor, "def", defUp, turns);

    let shieldAdded = 0;
    let shieldTurns = 0;

    if (special.shield != null) {
      const shieldAmt = Math.max(0, roundInt(Number(special.shield || 0)));
      if (shieldAmt > 0) {
        applyShield(actor, shieldAmt, turns);
        shieldAdded = shieldAmt;
        shieldTurns = turns;
      }
    } else if (special.shieldPct != null) {
      const pct = clamp(Number(special.shieldPct || 0), 0, 1);
      const shieldAmt = roundInt(Number(actor.maxHp || 0) * pct);
      if (shieldAmt > 0) {
        applyShield(actor, shieldAmt, turns);
        shieldAdded = shieldAmt;
        shieldTurns = turns;
      }
    }

    if (atkUp <= 0 && defUp <= 0 && shieldAdded <= 0) {
      lines.push(`${title} uses ${special.name}, but it has no effect.`);
      return { lines, used: true, effects: null };
    }

    lines.push(`${title} uses ${special.name}! Buffs applied (${turns}T).`);

    return {
      lines,
      used: true,
      effects: {
        atkBuffPct: atkUp,
        atkBuffTurns: atkUp > 0 ? turns : 0,
        defBuffPct: defUp,
        defBuffTurns: defUp > 0 ? turns : 0,
        shieldAdded,
        shieldTurns
      }
    };
  }

  // ✅ NEW: team buff (signature) — supports BOTH schemas:
  // - atkPct/defPct + turns
  // - atkBuffPct/defBuffPct + atkBuffTurns/defBuffTurns
  if (kind === "buffParty") {
    if (!Array.isArray(party) || party.length === 0) {
      return { lines: ["No party to buff."], used: false };
    }

    const turns = normalizeTurns(
      special.turns ?? special.atkBuffTurns ?? special.defBuffTurns ?? 2,
      2
    );

    const atkUp = normalizePct(special.atkPct ?? special.atkBuffPct);
    const defUp = normalizePct(special.defPct ?? special.defBuffPct);

    if (atkUp <= 0 && defUp <= 0) {
      lines.push(`${title} uses ${special.name}, but it has no effect.`);
      return { lines, used: true, effects: null };
    }

    for (const m of party) {
      if (!m || m.hp <= 0) continue;
      if (atkUp > 0) setPctBuff(m, "atk", atkUp, turns);
      if (defUp > 0) setPctBuff(m, "def", defUp, turns);
    }

    lines.push(`${title} uses ${special.name}! Team buffs applied (${turns}T).`);

    return {
      lines,
      used: true,
      effects: {
        atkBuffPct: atkUp,
        atkBuffTurns: atkUp > 0 ? turns : 0,
        defBuffPct: defUp,
        defBuffTurns: defUp > 0 ? turns : 0
      }
    };
  }

  // ✅ IMPORTANT CHANGE: STATUS target selection must use base target (supports tag arrays)
  // ✅ Alias: statusEnemy
  if (kind === "STATUS" || kind === "statusEnemy") {
    const statusName = String(special.status || "").trim();
    if (!statusName) {
      lines.push(`${title} uses ${special.name}, but no status was specified.`);
      return { lines, used: true, effects: null };
    }

    const turns = normalizeTurns(special.turns ?? 1, 1);
    const chance = special.chance == null ? 1 : clamp(Number(special.chance || 0), 0, 1);

    let tgtObj = enemy;
    let tgtLabel = enemy?.name || "the enemy";

    const baseTarget = getBaseTargetTag(special);

    if (baseTarget === "self") {
      tgtObj = actor;
      tgtLabel = "self";
    } else if (baseTarget === "ally") {
      if (targetIndex == null || targetIndex < 0 || targetIndex >= party.length) {
        return { lines: ["Choose an ally target."], used: false };
      }
      tgtObj = party[targetIndex];
      tgtLabel = tgtObj?.movie?.title ? tgtObj.movie.title.slice(0, 10) : "ally";
    } else if (baseTarget === "team") {
      // For now, team-status is not implemented; fall back to enemy unless you extend later.
      tgtObj = enemy;
      tgtLabel = enemy?.name || "the enemy";
    } else {
      // enemy default
      tgtObj = enemy;
      tgtLabel = enemy?.name || "the enemy";
    }

    if (!tgtObj) return { lines: [`No valid ${tgtLabel} target.`], used: false };

    if (!rollChance(chance)) {
      lines.push(`${title} uses ${special.name}… but it doesn’t stick.`);
      return { lines, used: true, effects: null };
    }

    applyGenericStatus(tgtObj, statusName, turns);
    lines.push(`${title} uses ${special.name}! ${statusName} (${turns}T).`);

    return { lines, used: true, effects: { statusApplied: statusName, statusTurns: turns } };
  }

  // Fallback hit
  const dmg = computeSimpleDamage(Number(actor.atk || 0), enemy);
  applyDamageToEnemy(enemy, dmg);
  lines.push(`${title} uses ${special.name} for ${dmg} damage!`);
  return { lines, used: true, effects: { damageDealt: dmg } };
}

// ---------------- GENRE EXECUTION ----------------

function executeGenre({ actor, party, enemy, special, M, targetIndex }) {
  const lines = [];
  const title = (actor.movie?.title || "Actor").slice(0, 10);
  const data = special.data || {};
  const genre = special.genre;

  const scaledPct = (obj) => {
    if (!obj) return 0;
    const base = Number(obj.value || 0);
    return obj.imdbScale ? base * M : base;
  };

  // ACTION / SCIFI
  if (genre === "ACTION" || genre === "SCIFI") {
    const atkBuff = scaledPct(data.atkBuffPct);
    const turns = data.atkBuffPct?.turns ?? 2;

    if (atkBuff > 0) setPctBuff(actor, "atk", atkBuff, turns);

    if (data.defDebuffPct) {
      const defDown = scaledPct(data.defDebuffPct);
      const dt = data.defDebuffPct?.turns ?? 2;
      if (defDown > 0) setPctDebuff(actor, "def", defDown, dt);
    }

    const ih = data.immediateHit;
    let dmg = 0;

    if (ih?.enabled) {
      const atkForHit = effectiveAtkWithTemporaryBoost(actor, atkBuff);
      const mult = randFloat(ih.minMult ?? 1.5, ih.maxMult ?? 2.0);
      dmg = computeSimpleDamage(atkForHit * mult, enemy);
      applyDamageToEnemy(enemy, dmg);
      lines.push(`${title} uses ${special.name}! (+ATK) and hits for ${dmg} damage.`);
    } else {
      lines.push(`${title} uses ${special.name}! (+ATK)`);
    }

    return {
      lines,
      used: true,
      effects: {
        atkBuffPct: atkBuff,
        atkBuffTurns: atkBuff > 0 ? turns : 0,
        damageDealt: dmg
      }
    };
  }

  // ADVENTURE / MUSICAL
  if (genre === "ADVENTURE" || genre === "MUSICAL") {
    const teamAtkBuff = scaledPct(data.teamAtkBuffPct);
    const teamAtkTurns = data.teamAtkBuffPct?.turns ?? (genre === "MUSICAL" ? 1 : 2);

    if (teamAtkBuff > 0) {
      for (const m of party) {
        if (!m || m.hp <= 0) continue;
        setPctBuff(m, "atk", teamAtkBuff, teamAtkTurns);
      }
    }

    if (data.teamDefBuffPct) {
      const teamDefBuff = scaledPct(data.teamDefBuffPct);
      const teamDefTurns = data.teamDefBuffPct?.turns ?? 2;
      if (teamDefBuff > 0) {
        for (const m of party) {
          if (!m || m.hp <= 0) continue;
          setPctBuff(m, "def", teamDefBuff, teamDefTurns);
        }
      }
    }

    if (data.teamHealMaxHpPct) {
      const healPct = scaledPct(data.teamHealMaxHpPct);
      let totalHealed = 0;
      for (const m of party) {
        if (!m || m.hp <= 0) continue;
        totalHealed += applyHeal(m, roundInt(Number(m.maxHp || 0) * healPct));
      }
      if (totalHealed > 0) lines.push(`${title} rallies the team (+${totalHealed} total HP).`);
    }

    if (data.teamStrike?.enabled) {
      const alive = party.filter((m) => m && m.hp > 0);
      if (alive.length > 0) {
        const R = randFloat(data.teamStrike.totalMinMult ?? 1.5, data.teamStrike.totalMaxMult ?? 2.8);

        const finalATKs = alive.map((m) => Number(m.atk || 0) * (1 + teamAtkBuff));
        const shares = sqrtWeightShares(finalATKs);

        let totalDmg = 0;
        for (let i = 0; i < alive.length; i++) {
          const portionMult = R * shares[i];
          const dmg = computeSimpleDamage(finalATKs[i] * portionMult, enemy);
          totalDmg += applyDamageToEnemy(enemy, dmg);
        }

        lines.push(`${title} triggers a TEAM STRIKE for ${totalDmg} total damage!`);
      }
    }

    lines.push(`${title} uses ${special.name}!`);
    return { lines, used: true, effects: null };
  }

  // COMEDY
  if (genre === "COMEDY") {
    const enemyAtkDown = scaledPct(data.enemyAtkDebuffPct);
    const turns = data.enemyAtkDebuffPct?.turns ?? 2;
    if (enemyAtkDown > 0) setPctDebuff(enemy, "atk", enemyAtkDown, turns);

    const teamDefUp = scaledPct(data.teamDefBuffPct);
    const defTurns = data.teamDefBuffPct?.turns ?? 2;
    if (teamDefUp > 0) {
      for (const m of party) {
        if (!m || m.hp <= 0) continue;
        setPctBuff(m, "def", teamDefUp, defTurns);
      }
    }

    // (your old heal loop doesn't return effects; keeping consistent)
    const healPct = scaledPct(data.teamHealMaxHpPct);
    for (const m of party) {
      if (!m || m.hp <= 0) continue;
      applyHeal(m, roundInt(Number(m.maxHp || 0) * healPct));
    }

    lines.push(`${title} uses ${special.name}!`);
    return {
      lines,
      used: true,
      effects: {
        enemyAtkDebuffPct: enemyAtkDown,
        enemyAtkDebuffTurns: enemyAtkDown > 0 ? turns : 0,
        defBuffPct: teamDefUp,
        defBuffTurns: teamDefUp > 0 ? defTurns : 0
      }
    };
  }

  // HORROR
  if (genre === "HORROR") {
    const boostPct = scaledPct(data.preHitAtkBuffPct);
    const atkForHit = effectiveAtkWithTemporaryBoost(actor, boostPct);
    const dmg = computeSimpleDamage(atkForHit, enemy);
    applyDamageToEnemy(enemy, dmg);

    const defDown = scaledPct(data.enemyDefDebuffPct);
    const turns = data.enemyDefDebuffPct?.turns ?? 2;
    if (defDown > 0) setPctDebuff(enemy, "def", defDown, turns);

    lines.push(`${title} uses ${special.name}!`);
    return {
      lines,
      used: true,
      effects: {
        damageDealt: dmg,
        enemyDefDebuffPct: defDown,
        enemyDefDebuffTurns: defDown > 0 ? turns : 0
      }
    };
  }

  // THRILLER
  if (genre === "THRILLER") {
    const vuln = scaledPct(data.nextHitVulnPct);
    const s = ensureStatuses(enemy);
    s.nextHitVulnPct = Math.max(Number(s.nextHitVulnPct || 0), Number(vuln || 0));
    s.nextHitVulnTurns = Math.max(Number(s.nextHitVulnTurns || 0), Number(data.nextHitVulnPct?.turns ?? 1));
    s.nextHitVulnActive = true;

    lines.push(`${title} uses ${special.name}! Enemy is exposed to the next hit.`);
    return { lines, used: true, effects: null };
  }

  // MYSTERY / CRIME / DOCUMENTARY
  if (genre === "MYSTERY" || genre === "CRIME" || genre === "DOCUMENTARY") {
    let defDown = 0;
    let atkDown = 0;
    let turns = 2;

    if (data.enemyDefDebuffPct) {
      defDown = scaledPct(data.enemyDefDebuffPct);
      turns = data.enemyDefDebuffPct?.turns ?? 2;
      if (defDown > 0) setPctDebuff(enemy, "def", defDown, turns);
    }
    if (data.enemyAtkDebuffPct) {
      atkDown = scaledPct(data.enemyAtkDebuffPct);
      turns = data.enemyAtkDebuffPct?.turns ?? 2;
      if (atkDown > 0) setPctDebuff(enemy, "atk", atkDown, turns);
    }

    lines.push(`${title} uses ${special.name}!`);
    return {
      lines,
      used: true,
      effects: {
        enemyAtkDebuffPct: atkDown,
        enemyAtkDebuffTurns: atkDown > 0 ? turns : 0,
        enemyDefDebuffPct: defDown,
        enemyDefDebuffTurns: defDown > 0 ? turns : 0
      }
    };
  }

  // ROMANCE (needs ally targeting)
  if (genre === "ROMANCE") {
    if (targetIndex == null || targetIndex < 0 || targetIndex >= party.length) {
      return { lines: ["Choose an ally target."], used: false };
    }
    const target = party[targetIndex];
    const healPct = scaledPct(data.healAllyMaxHpPct);
    const healed = applyHeal(target, roundInt(Number(target.maxHp || 0) * healPct));

    lines.push(`${title} uses ${special.name} on ${target.movie.title.slice(0, 10)} (+${healed} HP).`);
    return { lines, used: true, effects: { healedHp: healed } };
  }

  // FANTASY (needs ally targeting)
  if (genre === "FANTASY") {
    if (targetIndex == null || targetIndex < 0 || targetIndex >= party.length) {
      return { lines: ["Choose an ally target."], used: false };
    }
    const target = party[targetIndex];
    const shieldPct = scaledPct(data.shieldAllyMaxHpPct);
    const turns = data.shieldAllyMaxHpPct?.turns ?? 2;
    const shieldAmt = roundInt(Number(target.maxHp || 0) * shieldPct);
    applyShield(target, shieldAmt, turns);

    lines.push(`${title} uses ${special.name} on ${target.movie.title.slice(0, 10)} (shield +${shieldAmt}).`);
    return { lines: usedTrue(), used: true, effects: { shieldAdded: shieldAmt, shieldTurns: turns } };
  }

  // ANIMATION
  if (genre === "ANIMATION") {
    const dr = scaledPct(data.teamDamageReductionPct);
    const turns = data.teamDamageReductionPct?.turns ?? 2;

    for (const m of party) {
      if (!m || m.hp <= 0) continue;
      const s = ensureStatuses(m);
      s.damageReductionPct = Math.max(Number(s.damageReductionPct || 0), Number(dr || 0));
      s.damageReductionTurns = Math.max(Number(s.damageReductionTurns || 0), Number(turns || 0));
    }

    lines.push(`${title} uses ${special.name}! Team takes less damage.`);
    return { lines, used: true, effects: { damageReductionPct: dr, damageReductionTurns: turns } };
  }

  lines.push(`${title} uses ${special.name}.`);
  return { lines, used: true, effects: null };
}

// tiny helper to avoid accidental object-literal typos (keeps runtime stable)
function usedTrue() {
  return [];
}
