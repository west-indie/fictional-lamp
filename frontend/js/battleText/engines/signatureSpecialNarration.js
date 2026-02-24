// frontend/js/battleText/signatureSpecialNarration.js
//
// Step B2 — build ordered message-box lines for signature specials.
// Converts "what happened" (dmg/heal/buffs/etc.) into narration strings.
//
// Goals:
// - One centralized place to control ordering + phrasing
// - Omit lines automatically when effects don't apply
// - No % values; no shield numbers
// - Damage/heal numbers allowed
// - Turns displayed as "1 turn" / "2 turns"
//
// ✅ Update:
// - Universal intro is ALWAYS the first line: "{actor} uses {move}!"
// - We do NOT require per-entry def.intro anymore (keeps SIGNATURE_SPECIAL_TEXT cleaner).
// - Stronger inference when executeSignature returns effects: null (prevents “skipping”).

import { SIGNATURE_SPECIAL_TEXT } from "../lines/signatureSpecialText.js";
import { clampInt, safeStr, renderTemplate, turnsPhrase, joinNatural } from "./signatureHelpers.js";
import {
  SIGNATURE_FALLBACK_ACTOR,
  SIGNATURE_FALLBACK_ALLY,
  SIGNATURE_FALLBACK_BUFF_LIST,
  SIGNATURE_FALLBACK_DEBUFF_LIST,
  SIGNATURE_FALLBACK_ENEMY,
  SIGNATURE_FALLBACK_MOVE,
  SIGNATURE_FALLBACK_STATUS,
  SIGNATURE_INTRO_TEMPLATE,
  SIGNATURE_BUFF_ATK_UP,
  SIGNATURE_BUFF_DEF_UP,
  SIGNATURE_BUFF_DAMAGE_RESIST,
  SIGNATURE_DEBUFF_ATK_DOWN,
  SIGNATURE_DEBUFF_DEF_DOWN
} from "../lines/signatureSpecialNarrationText.js";

function pushRendered(byPhaseArr, tpl, vars) {
  if (!tpl) return;
  if (Array.isArray(tpl)) {
    for (const t of tpl) {
      const line = renderTemplate(t, vars);
      if (line) byPhaseArr.push(line);
    }
    return;
  }
  const line = renderTemplate(tpl, vars);
  if (line) byPhaseArr.push(line);
}

function resolveSignatureTextDef({ key, movieId, kind, inlineText }) {
  // Inline always wins if provided (lets specials override)
  if (inlineText && typeof inlineText === "object") return inlineText;

  const reg = SIGNATURE_SPECIAL_TEXT;

  if (key && reg.byKey && reg.byKey[key]) return reg.byKey[key];

  const movieKey = movieId ? `movie:${movieId}` : null;
  if (movieKey && reg.byMovie && reg.byMovie[movieKey]) return reg.byMovie[movieKey];

  const k = String(kind || "").trim();
  if (k && reg.byKind && reg.byKind[k]) return reg.byKind[k];

  return reg.DEFAULT || { order: [] };
}

function inferBuffListFromSpecialOrEffects(sp, effectsLike) {
  const src = effectsLike || {};
  const list = [];

  // Prefer actual applied effects (runtime truth)
  if (Number(src.atkBuffPct || 0) > 0) list.push(SIGNATURE_BUFF_ATK_UP);
  if (Number(src.defBuffPct || 0) > 0) list.push(SIGNATURE_BUFF_DEF_UP);
  if (Number(src.damageReductionPct || 0) > 0) list.push(SIGNATURE_BUFF_DAMAGE_RESIST);

  // If effects missing, infer from authored special fields (common when effects: null)
  if (list.length === 0 && sp) {
    if (Number(sp.atkPct || sp.atkBuffPct || 0) > 0) list.push(SIGNATURE_BUFF_ATK_UP);
    if (Number(sp.defPct || sp.defBuffPct || 0) > 0) list.push(SIGNATURE_BUFF_DEF_UP);
    if (Number(sp.damageReductionPct || 0) > 0) list.push(SIGNATURE_BUFF_DAMAGE_RESIST);
    // shield is handled separately (numbers omitted)
  }

  return list;
}

function inferDebuffListFromSpecialOrEffects(sp, effectsLike) {
  const src = effectsLike || {};
  const list = [];

  // Prefer actual applied effects (runtime truth)
  if (Number(src.enemyAtkDebuffPct || 0) > 0) list.push(SIGNATURE_DEBUFF_ATK_DOWN);
  if (Number(src.enemyDefDebuffPct || 0) > 0) list.push(SIGNATURE_DEBUFF_DEF_DOWN);

  // If effects missing, infer from authored special fields
  if (list.length === 0 && sp) {
    if (Number(sp.atkPct || sp.atkDebuffPct || 0) > 0) list.push(SIGNATURE_DEBUFF_ATK_DOWN);
    if (Number(sp.defPct || sp.defDebuffPct || 0) > 0) list.push(SIGNATURE_DEBUFF_DEF_DOWN);
  }

  return list;
}

function inferHasShield(sp, effectsLike) {
  const src = effectsLike || {};
  const shieldApplied =
    Number(src.shieldAdded || 0) > 0 ||
    Number(src.shieldTurns || 0) > 0;

  if (shieldApplied) return true;

  // Infer from authored special fields if runtime effects missing
  if (sp) {
    if (sp.shield != null && Number(sp.shield || 0) > 0) return true;
    if (sp.shieldPct != null && Number(sp.shieldPct || 0) > 0) return true;
  }

  return false;
}

function inferHasStatus(sp, effectsLike) {
  const src = effectsLike || {};
  const statusName = String(src.statusApplied || sp?.status || "").trim();
  return Boolean(statusName);
}

function pickStatusTemplateKey(def, statusNameRaw, turnsPhraseStr) {
  const s = String(statusNameRaw || "").toLowerCase().trim();
  const has = (k) => def && Object.prototype.hasOwnProperty.call(def, k) && def[k];

  const hasTurns = Boolean(String(turnsPhraseStr || "").trim());

  if (s.includes("stun")) {
    if (hasTurns && has("stunTimed")) return "stunTimed";
    if (has("stun")) return "stun";
  }

  if (s.includes("dazed")) {
    if (hasTurns && has("dazedTimed")) return "dazedTimed";
    if (has("dazed")) return "dazed";
  }

  if (s.includes("confus") && has("confused")) return "confused";

  return has("status") ? "status" : null;
}

function renderSignatureStep({ step, baseVars, def, sp }) {
  const stepLines = [];

  const effectsLike = step.effects || {};

  // Allow step-level durations (especially for status steps)
  const stepTurns =
    clampInt(step?.outcome?.turns) ||
    clampInt(step?.outcome?.statusTurns) ||
    clampInt(effectsLike?.statusTurns) ||
    clampInt(effectsLike?.turns) ||
    0;

  const vars = {
    ...baseVars,
    // Prefer step turns if present; otherwise fall back to baseVars
    turnsPhrase: turnsPhrase(stepTurns) || baseVars.turnsPhrase || "",
    statusName: safeStr(effectsLike.statusApplied || sp.status, SIGNATURE_FALLBACK_STATUS)
  };

  const buffList = inferBuffListFromSpecialOrEffects(sp, effectsLike);
  const debuffList = inferDebuffListFromSpecialOrEffects(sp, effectsLike);
  const hasShield = inferHasShield(sp, effectsLike);
  const hasStatus = inferHasStatus(sp, effectsLike);

  const revived = Boolean(effectsLike.revived);
  const teamRevived = Boolean(effectsLike.teamRevive || effectsLike.revivedCount > 0);

  const can = {
    onHit: Number(effectsLike.damageDealt || 0) > 0 && Boolean(def.onHit),
    heal: Number(effectsLike.healedHp || 0) > 0 && Boolean(def.heal),
    teamHeal: Number(effectsLike.teamHeal || 0) > 0 && Boolean(def.teamHeal),

    revive: revived && Boolean(def.revive),
    teamRevive: teamRevived && Boolean(def.teamRevive),

    buffs: buffList.length > 0 && Boolean(def.buffs) && Boolean(vars.turnsPhrase),
    debuffs: debuffList.length > 0 && Boolean(def.debuffs) && Boolean(vars.turnsPhrase),

    // ✅ Barrier can exist without turns; don’t require turnsPhrase
    shield: hasShield && Boolean(def.shield),

    // ✅ Status narration does not require turns
    status: hasStatus && Boolean(pickStatusTemplateKey(def, vars.statusName, vars.turnsPhrase)),

    selfRisk: Boolean(def.selfRisk) && Boolean(vars.turnsPhrase)
  };

  const phaseOverride = def.phase || {};
  const byPhase = { preFx: [], dmg: [], heal: [], buffs: [], debuffs: [], postFx: [] };

  const put = (key) => {
    const forced = phaseOverride[key];
    if (forced && byPhase[forced]) return forced;

    if (key === "revive" || key === "teamRevive") return "preFx";
    if (key === "onHit") return "dmg";
    if (key === "heal" || key === "teamHeal") return "heal";
    if (key === "buffs") return "buffs";
    if (key === "debuffs") return "debuffs";
    return "postFx";
  };

  const preferred = Array.isArray(def.order) ? def.order.filter((k) => k !== "intro") : [];
  const eligible = Object.keys(can).filter((k) => can[k]);

  const ordered = [];
  for (const k of preferred) if (eligible.includes(k)) ordered.push(k);
  for (const k of eligible) if (!ordered.includes(k)) ordered.push(k);

  for (const k of ordered) {
    if (k === "status") {
      const keyName = pickStatusTemplateKey(def, vars.statusName, vars.turnsPhrase);
      const tpl = keyName ? def[keyName] : null;
      pushRendered(byPhase[put(k)], tpl, vars);
      continue;
    }

    const tpl = def[k];
    pushRendered(byPhase[put(k)], tpl, vars);
  }

  const sequence = ["preFx", "dmg", "heal", "buffs", "debuffs", "postFx"];
  for (const ph of sequence) stepLines.push(...byPhase[ph]);

  return stepLines;
}

/**
 * Build message-box lines for a signature special.
 */
export function buildSignatureSpecialLines({
  special = null,
  actor,
  move,
  target = "",
  enemy = SIGNATURE_FALLBACK_ENEMY,
  outcome = null,
  effects = null,
  kind = null,
  key = null,
  movieId = null,
  inlineText = null,
  includeIntro = true
}) {
  const sp = special || {};
  const resolvedKey = key || sp.key || null;
  const resolvedMovieId =
    movieId ||
    (typeof sp.key === "string" && sp.key.startsWith("sig:")
      ? sp.key.split(":")[1]
      : null);

  const resolvedKind = kind || sp.sigKind || sp.kind || "";

  const def = resolveSignatureTextDef({
    key: resolvedKey,
    movieId: resolvedMovieId,
    kind: resolvedKind,
    inlineText
  });

  const dmg =
    clampInt(outcome?.dmg) ||
    clampInt(outcome?.damageDealt) ||
    clampInt(effects?.damageDealt) ||
    clampInt(effects?.damageDealtTotal) ||
    0;

  const targetTags = Array.isArray(sp.target) ? sp.target : [sp.target].filter(Boolean);
  const isTeamTarget = targetTags.map(String).map((s) => s.toLowerCase()).includes("team");

  const rawHeal =
    clampInt(outcome?.heal) ||
    clampInt(outcome?.healedHp) ||
    clampInt(effects?.healedHp) ||
    0;

  const heal = isTeamTarget ? 0 : rawHeal;

  const teamHeal =
    clampInt(outcome?.teamHeal) ||
    (isTeamTarget ? rawHeal : 0) ||
    0;

  const turns =
    clampInt(outcome?.turns) ||
    clampInt(outcome?.statusTurns) ||
    clampInt(effects?.statusTurns) ||
    clampInt(effects?.atkBuffTurns) ||
    clampInt(effects?.defBuffTurns) ||
    clampInt(effects?.enemyAtkDebuffTurns) ||
    clampInt(effects?.enemyDefDebuffTurns) ||
    clampInt(effects?.damageReductionTurns) ||
    clampInt(effects?.shieldTurns) ||
    clampInt(sp.turns) ||
    clampInt(sp.atkBuffTurns) ||
    clampInt(sp.defBuffTurns) ||
    clampInt(sp.atkDebuffTurns) ||
    clampInt(sp.defDebuffTurns) ||
    0;

  const vars = {
    actor: safeStr(actor, SIGNATURE_FALLBACK_ACTOR),
    move: safeStr(move, SIGNATURE_FALLBACK_MOVE),
    target: safeStr(target, SIGNATURE_FALLBACK_ALLY),
    enemy: safeStr(enemy, SIGNATURE_FALLBACK_ENEMY),

    dmg,
    heal,
    teamHeal,

    turnsPhrase: turnsPhrase(turns),

    buffList:
      joinNatural(inferBuffListFromSpecialOrEffects(sp, effects || outcome || {}), { conj: "and" }) ||
      SIGNATURE_FALLBACK_BUFF_LIST,
    debuffList:
      joinNatural(inferDebuffListFromSpecialOrEffects(sp, effects || outcome || {}), { conj: "and" }) ||
      SIGNATURE_FALLBACK_DEBUFF_LIST,

    statusName: safeStr(
      (effects && effects.statusApplied) || (outcome && outcome.statusApplied) || sp.status,
      SIGNATURE_FALLBACK_STATUS
    )
  };

  const lines = [];

  if (includeIntro) {
    lines.push(renderTemplate(SIGNATURE_INTRO_TEMPLATE, vars));
  }

  const buffList = inferBuffListFromSpecialOrEffects(sp, effects || outcome || {});
  const debuffList = inferDebuffListFromSpecialOrEffects(sp, effects || outcome || {});
  const hasShield = inferHasShield(sp, effects || outcome || {});
  const hasStatus = inferHasStatus(sp, effects || outcome || {});

  const revived =
    Boolean(effects?.revived) ||
    Boolean(outcome?.revived) ||
    Boolean(outcome?.revive) ||
    Boolean(outcome?.didRevive) ||
    Boolean(outcome?.wasRevive) ||
    false;

  const teamRevived =
    Boolean(effects?.teamRevive) ||
    Boolean(effects?.revivedCount > 0) ||
    Boolean(outcome?.teamRevived) ||
    Boolean(outcome?.revivedCount > 0) ||
    false;

  const can = {
    onHit: dmg > 0 && Boolean(def.onHit),

    heal: heal > 0 && Boolean(def.heal),
    teamHeal: teamHeal > 0 && Boolean(def.teamHeal),

    revive: revived && Boolean(def.revive),
    teamRevive: teamRevived && Boolean(def.teamRevive),

    buffs: buffList.length > 0 && Boolean(def.buffs) && Boolean(vars.turnsPhrase),
    debuffs: debuffList.length > 0 && Boolean(def.debuffs) && Boolean(vars.turnsPhrase),

    // ✅ Barrier can exist without turns; don’t require turnsPhrase
    shield: hasShield && Boolean(def.shield),

    status: hasStatus && Boolean(pickStatusTemplateKey(def, vars.statusName, vars.turnsPhrase)),

    selfRisk: Boolean(def.selfRisk) && Boolean(vars.turnsPhrase)
  };

  const phaseOverride = (def && def.phase && typeof def.phase === "object") ? def.phase : {};
  const byPhase = { preFx: [], dmg: [], heal: [], buffs: [], debuffs: [], postFx: [] };

  const put = (keyName) => {
    const forced = String(phaseOverride[keyName] || "").trim();
    if (forced && byPhase[forced]) return forced;

    if (keyName === "revive" || keyName === "teamRevive") return "preFx";
    if (keyName === "onHit") return "dmg";
    if (keyName === "heal" || keyName === "teamHeal") return "heal";
    if (keyName === "buffs") return "buffs";
    if (keyName === "debuffs") return "debuffs";
    if (keyName === "shield" || keyName === "status") return "postFx";

    return "postFx";
  };

  const eligibleKeys = Object.keys(can).filter((k) => k !== "intro" && can[k]);

  const preferred = Array.isArray(def.order) ? def.order.filter((k) => k && k !== "intro") : [];

  const orderedEligible = [];
  for (const k of preferred) if (eligibleKeys.includes(k) && !orderedEligible.includes(k)) orderedEligible.push(k);
  for (const k of eligibleKeys) if (!orderedEligible.includes(k)) orderedEligible.push(k);

  for (const k of orderedEligible) {
    const tpl = def[k];
    if (!tpl && k !== "status") continue;

    if (k === "status") {
      const keyName = pickStatusTemplateKey(def, vars.statusName, vars.turnsPhrase);
      const chosen = keyName ? def[keyName] : null;
      pushRendered(byPhase[put(k)], chosen, vars);
      continue;
    }

    pushRendered(byPhase[put(k)], tpl, vars);
  }

  const sequence = ["preFx", "dmg", "heal", "buffs", "debuffs", "postFx"];
  for (const ph of sequence) {
    for (const line of byPhase[ph]) lines.push(line);
  }

  // Only add fallback intro when this call is allowed to include intros.
  // This prevents duplicate "{actor} uses {move}!" lines on non-intro dualEffect steps.
  if (lines.length === 0 && includeIntro) {
    lines.push(renderTemplate(SIGNATURE_INTRO_TEMPLATE, vars));
  }

  return lines;
}
