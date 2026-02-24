// frontend/js/battleText/buildEnemyTurnLines.js
//
// Phase 4B: centralized narration for enemy-turn outcomes.

import {
  ENEMY_ACTS_FALLBACK,
  ENEMY_ATTACK_CRIT_TEMPLATE,
  ENEMY_ATTACK_GUARDED_SUFFIX_TEMPLATE,
  ENEMY_ATTACK_MORTAL_TEMPLATE,
  ENEMY_ATTACK_NORMAL_TEMPLATE,
  ENEMY_ATTACK_SHIELD_ONLY_TEMPLATE,
  ENEMY_ATTACK_SPLIT_SHIELD_HP_TEMPLATE,
  ENEMY_CONFUSED_LOW_ACC_HIT_TEMPLATE,
  ENEMY_CONFUSED_MISFIRE_TEMPLATE,
  ENEMY_CONFUSED_SELF_HEAL_TEMPLATE,
  ENEMY_CONFUSED_WILD_MISS_TEMPLATE,
  ENEMY_CONFUSION_CLEARED_TEMPLATE,
  ENEMY_MISS_DAZED_TEMPLATE,
  ENEMY_MOVE_UNKNOWN_TEMPLATE,
  ENEMY_STUNNED_SKIP_TEMPLATE,
  ENEMY_STRIKES_FALLBACK,
  ENEMY_TURN_DISRUPTED_FUNNY,
  ENEMY_TURN_DEFAULT_ENEMY_NAME,
  ENEMY_TURN_DEFAULT_MOVE_NAME,
  ENEMY_TURN_DEFAULT_TARGET_NAME,
  ENEMY_TURN_GENERIC_TARGET_NAME,
  PARTY_FALLEN,
  PARTY_FALLEN_PROMPT,
  TARGET_KNOCKED_OUT_TEMPLATE
} from "../lines/enemyTurnText.js";

function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function buildPartyFallenLine() {
  return PARTY_FALLEN;
}

export function buildPartyFallenPromptLine() {
  return PARTY_FALLEN_PROMPT;
}

export function buildEnemyStrikesFallbackLine() {
  return ENEMY_STRIKES_FALLBACK;
}

export function buildEnemyActsFallbackLine() {
  return ENEMY_ACTS_FALLBACK;
}

export function buildEnemyTurnLines({ events }) {
  if (!Array.isArray(events) || events.length === 0) return [];

  const lines = [];

  for (const evt of events) {
    const type = String(evt?.type || "");

    if (type === "turnDisruptedFunny") {
      lines.push(ENEMY_TURN_DISRUPTED_FUNNY);
      continue;
    }

    if (type === "enemyStunnedSkip") {
      lines.push(renderTemplate(ENEMY_STUNNED_SKIP_TEMPLATE, { enemyName: evt.enemyName || ENEMY_TURN_DEFAULT_ENEMY_NAME }));
      continue;
    }

    if (type === "enemyMoveUnknown") {
      lines.push(renderTemplate(ENEMY_MOVE_UNKNOWN_TEMPLATE, { enemyName: evt.enemyName || ENEMY_TURN_DEFAULT_ENEMY_NAME }));
      continue;
    }

    if (type === "enemyMissDazed") {
      lines.push(
        renderTemplate(ENEMY_MISS_DAZED_TEMPLATE, {
          enemyName: evt.enemyName || ENEMY_TURN_DEFAULT_ENEMY_NAME,
          moveName: evt.moveName || ENEMY_TURN_DEFAULT_MOVE_NAME
        })
      );
      continue;
    }

    if (type === "enemyConfusedMisfire") {
      lines.push(renderTemplate(ENEMY_CONFUSED_MISFIRE_TEMPLATE, {
        enemyName: evt.enemyName || ENEMY_TURN_DEFAULT_ENEMY_NAME,
        moveName: evt.moveName || ENEMY_TURN_DEFAULT_MOVE_NAME
      }));
      continue;
    }

    if (type === "enemyConfusedSelfHeal") {
      lines.push(renderTemplate(ENEMY_CONFUSED_SELF_HEAL_TEMPLATE, {
        enemyName: evt.enemyName || ENEMY_TURN_DEFAULT_ENEMY_NAME,
        healed: Number(evt.healed || 0)
      }));
      continue;
    }

    if (type === "enemyConfusedWildMiss") {
      lines.push(renderTemplate(ENEMY_CONFUSED_WILD_MISS_TEMPLATE, {
        enemyName: evt.enemyName || ENEMY_TURN_DEFAULT_ENEMY_NAME,
        moveName: evt.moveName || ENEMY_TURN_DEFAULT_MOVE_NAME
      }));
      continue;
    }

    if (type === "enemyConfusedLowAccuracyHit") {
      lines.push(renderTemplate(ENEMY_CONFUSED_LOW_ACC_HIT_TEMPLATE, { enemyName: evt.enemyName || ENEMY_TURN_DEFAULT_ENEMY_NAME }));
      continue;
    }

    if (type === "enemyConfusionCleared") {
      lines.push(renderTemplate(ENEMY_CONFUSION_CLEARED_TEMPLATE, { enemyName: evt.enemyName || ENEMY_TURN_DEFAULT_ENEMY_NAME }));
      continue;
    }

    if (type === "enemyAttackHit") {
      const enemyName = evt.enemyName || ENEMY_TURN_DEFAULT_ENEMY_NAME;
      const moveName = evt.moveName || ENEMY_TURN_DEFAULT_MOVE_NAME;
      const targetName = evt.targetName || ENEMY_TURN_GENERIC_TARGET_NAME;
      const hpDmg = Number(evt.damage || 0);
      const shieldDmg = Number(evt.absorbedShield || 0);
      const totalDmg = hpDmg + shieldDmg;

      let line = "";
      if (evt.isMortal) {
        line = renderTemplate(ENEMY_ATTACK_MORTAL_TEMPLATE, { enemyName, moveName, targetName });
      } else {
        line = evt.isCrit
          ? renderTemplate(ENEMY_ATTACK_CRIT_TEMPLATE, { enemyName, moveName, targetName, totalDmg })
          : renderTemplate(ENEMY_ATTACK_NORMAL_TEMPLATE, { enemyName, moveName, targetName, totalDmg });
      }

      if (shieldDmg > 0 && hpDmg > 0) {
        line += renderTemplate(ENEMY_ATTACK_SPLIT_SHIELD_HP_TEMPLATE, { shieldDmg, hpDmg });
      } else if (shieldDmg > 0) {
        line += renderTemplate(ENEMY_ATTACK_SHIELD_ONLY_TEMPLATE, { shieldDmg });
      }

      if (evt.guarded) line += renderTemplate(ENEMY_ATTACK_GUARDED_SUFFIX_TEMPLATE, { targetName });
      lines.push(line);
      continue;
    }

    if (type === "targetKnockedOut") {
      lines.push(renderTemplate(TARGET_KNOCKED_OUT_TEMPLATE, { targetName: evt.targetName || ENEMY_TURN_DEFAULT_TARGET_NAME }));
      continue;
    }
  }

  return lines;
}
