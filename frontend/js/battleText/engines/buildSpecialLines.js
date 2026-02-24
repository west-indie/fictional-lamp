// frontend/js/battleText/buildSpecialLines.js
//
// Step B — build final message-box lines for a Special.
//
// - Execution returns { used, effects, error, meta } (no strings)
// - Narration happens AFTER execution
// - ✅ If SIGNATURE_EFFECT_TEXT has an entry for this special.key:
//     we do FULL OVERRIDE (only the authored lines are shown).

import { buildGenreSpecialLines } from "./genreSpecialNarration.js";
import { buildSignatureSpecialLines } from "./signatureSpecialNarration.js";
import { SIGNATURE_EFFECT_TEXT } from "../lines/signatureEffectText.js";
import { deriveMarkersFromEffects } from "./targets.js";
import { auditEffectKeys } from "./auditEffectKeys.js";
import {
  SPECIAL_FALLBACK_ACTOR,
  SPECIAL_FALLBACK_ALLY,
  SPECIAL_FALLBACK_ENEMY,
  SPECIAL_FALLBACK_MOVE,
  SPECIAL_FALLBACK_OVERRIDE_INTRO,
  SPECIAL_FALLBACK_TEAM
} from "../lines/specialEngineText.js";
import {
  buildCantUseRightNowLine,
  buildInvalidTargetLine,
  buildNoSpecialSelectedLine,
  buildNoValidActorLine,
  buildNoValidAllyTargetsLine,
  buildNothingHappensLine,
  buildSpecialCooldownLine
} from "./corePrompts.js";

function safeTitle(x) {
  const t = x?.movie?.title || x?.title || x?.name || SPECIAL_FALLBACK_ACTOR;
  return String(t);
}

function asArray(v) {
  if (typeof v === "string" && v.trim()) return [v.trim()];
  if (Array.isArray(v)) return v.filter(Boolean).map((s) => String(s)).filter(Boolean);
  return [];
}

function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

function getBaseTargetTag(targetLike) {
  const tags = Array.isArray(targetLike) ? targetLike : [targetLike];
  const normalized = tags
    .map((t) => String(t || "").trim().toLowerCase())
    .filter(Boolean);

  // Prefer enemy when present to avoid generic "ally" fallback in enemy-facing moves.
  if (normalized.includes("enemy")) return "enemy";
  if (normalized.includes("team")) return "team";
  if (normalized.includes("self")) return "self";
  if (normalized.includes("ally")) return "ally";
  return null;
}

function fallbackTargetName({ baseTarget, actorName, enemyName, party, targetIndex }) {
  if (baseTarget === "enemy") return enemyName;
  if (baseTarget === "team") return SPECIAL_FALLBACK_TEAM;
  if (baseTarget === "self") return actorName;

  if (baseTarget === "ally") {
    if (typeof targetIndex === "number" && Array.isArray(party) && party[targetIndex]) {
      return safeTitle(party[targetIndex]);
    }
    return SPECIAL_FALLBACK_ALLY;
  }

  if (typeof targetIndex === "number" && Array.isArray(party) && party[targetIndex]) {
    return safeTitle(party[targetIndex]);
  }
  return enemyName || SPECIAL_FALLBACK_ENEMY;
}

/**
 * FULL override rendering:
 * - Renders intro/outro arrays (if present)
 * - Renders effectText in OBJECT INSERTION ORDER,
 *   but only for effect keys that exist in result.effects.
 * - Uses {value} for that effect key's value.
 */
function buildFullOverrideLines({ override, vars, effects }) {
  const lines = [];

  const introLines = asArray(override?.intro).map((tpl) => renderTemplate(tpl, vars));
  const outroLines = asArray(override?.outro).map((tpl) => renderTemplate(tpl, vars));

  // If no authored intro, keep a safe default headline.
  if (introLines.length > 0) lines.push(...introLines);
  else lines.push(renderTemplate(SPECIAL_FALLBACK_OVERRIDE_INTRO, vars));

  // If showEffects is explicitly false, skip effectText entirely.
  const showEffects = override?.showEffects !== false;

  if (showEffects && override?.effectText && typeof override.effectText === "object") {
    for (const key of Object.keys(override.effectText)) {
      if (!Object.prototype.hasOwnProperty.call(effects || {}, key)) continue;

      const raw = effects[key];
      const value =
        typeof raw === "number" ? raw : raw == null ? "" : String(raw);

      const tpls = asArray(override.effectText[key]);
      for (const tpl of tpls) {
        const line = renderTemplate(tpl, { ...vars, value });
        if (line) lines.push(line);
      }
    }
  }

  if (outroLines.length > 0) lines.push(...outroLines);

  // Safety: never empty
  if (lines.length === 0) lines.push(renderTemplate(SPECIAL_FALLBACK_OVERRIDE_INTRO, vars));

  return lines.filter(Boolean);
}

function buildErrorLines({ actorName, moveName, error }) {
  if (!error || typeof error !== "object") return [buildNothingHappensLine()];
  if (error.code === "noActor") return [buildNoValidActorLine()];
  if (error.code === "noSpecial") return [buildNoSpecialSelectedLine()];
  if (error.code === "cooldown") {
    const cd = Number(error.cooldownTurns || 0);
    return [buildSpecialCooldownLine({ name: moveName, cooldownRemaining: cd })];
  }
  if (error.code === "noAllyTarget") return [buildNoValidAllyTargetsLine()];
  if (error.code === "invalidTarget") return [buildInvalidTargetLine()];
  return [buildCantUseRightNowLine(actorName)];
}

/**
 * Build final lines for UI.
 */
export function buildSpecialLines({ actor, party, enemy, special, targetIndex, result }) {
  const actorName = safeTitle(actor);
  const moveName = String(special?.name || SPECIAL_FALLBACK_MOVE);
  const enemyName = safeTitle(enemy) || SPECIAL_FALLBACK_ENEMY;
  const specialBaseTarget = getBaseTargetTag(special?.target);

  const metaTargetName =
    result?.meta?.targetName != null && String(result.meta.targetName).trim()
      ? String(result.meta.targetName)
      : "";

  const targetName =
    metaTargetName ||
    fallbackTargetName({
      baseTarget: specialBaseTarget,
      actorName,
      enemyName,
      party,
      targetIndex
    });

  if (!result?.used) {
    return buildErrorLines({ actorName, moveName, error: result?.error });
  }

  // Validate marker pipeline (even if caller uses it elsewhere)
  deriveMarkersFromEffects(result.effects);
  auditEffectKeys(result.effects, `special:${special?.key || special?.id || moveName}`);

  // ✅ FULL OVERRIDE PATH (signatureEffectText)
  const override = SIGNATURE_EFFECT_TEXT?.[special?.key] || null;
  if (override && typeof override === "object") {
    const vars = {
      actor: actorName,
      move: moveName,
      target: targetName,
      enemy: enemyName
    };

    // (Optional) keep this — useful to tag "override" in logs
    auditEffectKeys(result.effects || {}, `override:${special?.key || special?.id || moveName}`);

    return buildFullOverrideLines({ override, vars, effects: result.effects || {} });
  }


  // ----- Base narration (genre vs signature) -----
  if (special?.source === "genre") {
    return buildGenreSpecialLines({
      genre: special.genre,
      actor: actorName,
      move: moveName,
      target: targetName,
      outcome: result.effects || {}
    });
  }

  // ✅ Signature narration
  // dualEffect execution stores ordered steps at result.meta.stepResults (per your specialSystem.js).
  const stepResults = Array.isArray(result?.meta?.stepResults) ? result.meta.stepResults : null;

if (stepResults && stepResults.length > 0) {
  const lines = [];

  for (let i = 0; i < stepResults.length; i++) {
    const step = stepResults[i];
    if (!step) continue;

    // ✅ Phase 3 audit: capture step-level effects too
    auditEffectKeys(
      step.effects || {},
      `dualStep:${special?.key || special?.id || moveName}:#${i}:${step.kind || "unknown"}`
    );

    const stepKind = step.kind || null;

    const stepMetaTargetName =
      step?.meta?.targetName != null && String(step.meta.targetName).trim()
        ? String(step.meta.targetName)
        : "";
    const stepTargetName =
      stepMetaTargetName ||
      fallbackTargetName({
        baseTarget: getBaseTargetTag(step?.target),
        actorName,
        enemyName,
        party,
        targetIndex
      });

    // Tiny “step special” shell so signature narration can infer target/team etc.
    const stepSpecial = {
      kind: stepKind,
      sigKind: stepKind,
      target: step.target ?? null
    };

    const stepLines = buildSignatureSpecialLines({
      special: stepSpecial,
      actor: actorName,
      move: moveName,
      target: stepTargetName,
      enemy: enemyName,
      effects: step.effects || null,
      outcome: null,
      kind: stepKind,
      key: null,
      movieId: result?.meta?.movieId || null,
      inlineText: null,

      // ✅ intro ONLY on first step (prevents duplication forever)
      includeIntro: i === 0
    });

    for (const ln of stepLines) if (ln) lines.push(ln);
  }

  return lines.filter(Boolean);
}

  // Normal single-effect signature
  auditEffectKeys(result.effects || {}, `sig:${special?.key || special?.id || moveName}`);

  return buildSignatureSpecialLines({
    special,
    actor: actorName,
    move: moveName,
    target: targetName,
    enemy: enemyName,
    effects: result.effects || null,
    outcome: null,
    key: special.key || null,
    movieId: result?.meta?.movieId || null
  });
}

