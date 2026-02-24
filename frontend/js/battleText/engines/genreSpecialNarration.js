// frontend/js/battleText/genreSpecialNarration.js
//
// Step B — build ordered message-box lines for genre specials.
// Converts "what happened" (outcome flags + numbers) into narration strings.
//
// Universal intro is ALWAYS the same:
//   "{actor} uses {move}!"
//
// Genre templates control ONLY effect lines + their order.

import { GENRE_SPECIAL_TEXT } from "../lines/genreSpecialText.js";
import {
  GENRE_SPECIAL_FALLBACK_ORDER,
  GENRE_SPECIAL_INTRO_TEMPLATE
} from "../lines/genreSpecialNarrationText.js";

function clampInt(n) {
  const x = Math.round(Number(n || 0));
  return Number.isFinite(x) ? x : 0;
}

function renderTurns(n) {
  const t = clampInt(n);
  if (t <= 0) return "";
  return `for ${t} turn${t === 1 ? "" : "s"}`;
}

function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => {
    return vars[k] != null ? String(vars[k]) : `{${k}}`;
  });
}

/**
 * Build message-box lines for a genre special.
 *
 * @param {object} args
 * @param {string} args.genre - e.g. "MUSICAL"
 * @param {string} args.actor - short actor title
 * @param {string} args.move - special name
 * @param {string} [args.target] - optional: target short title (ROMANCE/FANTASY)
 * @param {object} [args.outcome] - booleans + numbers computed in executeGenre
 * @returns {string[]} ordered lines
 */
export function buildGenreSpecialLines({ genre, actor, move, target = "", outcome = {} }) {
  const def = GENRE_SPECIAL_TEXT[String(genre || "").toUpperCase()] || GENRE_SPECIAL_TEXT.DEFAULT;

  const vars = {
    actor: String(actor || "Actor"),
    move: String(move || "Special"),
    target: String(target || "ally"),

    dmg: clampInt(outcome.dmg),
    teamDmg: clampInt(outcome.teamDmg),
    heal: clampInt(outcome.heal),
    teamHeal: clampInt(outcome.teamHeal),

    turnsPhrase: renderTurns(outcome.turns),
    buffTurnsPhrase: renderTurns(outcome.buffTurns),
    debuffTurnsPhrase: renderTurns(outcome.debuffTurns),

    shieldTurnsPhrase: renderTurns(outcome.shieldTurns),
    drTurnsPhrase: renderTurns(outcome.drTurns)
  };

  const can = {
    // damage / team strike / heals
    onHit: vars.dmg > 0 && Boolean(def.onHit),
    teamStrike: vars.teamDmg > 0 && Boolean(def.teamStrike),
    selfHeal: vars.heal > 0 && Boolean(def.selfHeal),
    teamHeal: vars.teamHeal > 0 && Boolean(def.teamHeal),
    allyHeal: vars.heal > 0 && Boolean(def.allyHeal),

    // ✅ ADD: team buffs (keys used by ADVENTURE/MUSICAL/COMEDY templates)
    teamAtkUp: Boolean(outcome.teamAtkBuffApplied) && Boolean(def.teamAtkUp),
    teamDefUp: Boolean(outcome.teamDefBuffApplied) && Boolean(def.teamDefUp),

    // shields
    allyShield: Boolean(outcome.shieldApplied) && Boolean(def.allyShield),

    // buffs/debuffs
    atkUp: Boolean(outcome.atkBuffApplied) && Boolean(def.atkUp),
    defUp: Boolean(outcome.defBuffApplied) && Boolean(def.defUp),
    selfDefDown: Boolean(outcome.selfDefDebuffApplied) && Boolean(def.selfDefDown),
    enemyAtkDown: Boolean(outcome.enemyAtkDebuffApplied) && Boolean(def.enemyAtkDown),
    enemyDefDown: Boolean(outcome.enemyDefDebuffApplied) && Boolean(def.enemyDefDown),

    // thriller / animation
    expose: Boolean(outcome.nextHitVulnApplied) && Boolean(def.expose),
    damageReduction: Boolean(outcome.damageReductionApplied) && Boolean(def.damageReduction),

    fallback: Boolean(def.fallback)
  };

  const lines = [];

  // ✅ Universal intro (always first)
  lines.push(renderTemplate(GENRE_SPECIAL_INTRO_TEMPLATE, vars));

    // Prefer declared order. If none provided, fall back to a stable key list.
  const preferred = Array.isArray(def.order) ? def.order.filter((k) => k && k !== "intro") : [];

  // Stable fallback ordering (only used if def.order is missing/empty)
  const eligible = preferred.length ? preferred : GENRE_SPECIAL_FALLBACK_ORDER;

  for (const key of eligible) {
    if (key === "intro") continue;
    if (!can[key]) continue;

    const tpl = def[key];
    if (!tpl) continue;

    lines.push(renderTemplate(tpl, vars));
  }

  // Absolute safety: never return empty.
  if (lines.length === 0) lines.push(renderTemplate(GENRE_SPECIAL_INTRO_TEMPLATE, vars));

  return lines;
}
