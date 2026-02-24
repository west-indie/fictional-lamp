// frontend/js/battleText/buildStatusTickLines.js
//
// Phase 5 Step 2: centralized text for status tick/expiration events.

import {
  ACTOR_STATUS_EXPIRED_TEMPLATES,
  ENEMY_STATUS_EXPIRED_TEMPLATES,
  STATUS_EXPIRED_FALLBACK_TEMPLATE,
  STATUS_TICK_DEFAULT_ACTOR_NAME,
  STATUS_TICK_DEFAULT_ENEMY_NAME
} from "../lines/statusTickText.js";

function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

function safeName(v, fallback) {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

function buildActorExpiredLine(actorName, statusKey) {
  const who = safeName(actorName, STATUS_TICK_DEFAULT_ACTOR_NAME);
  const k = String(statusKey || "");
  const tpl = ACTOR_STATUS_EXPIRED_TEMPLATES[k] || STATUS_EXPIRED_FALLBACK_TEMPLATE;
  return renderTemplate(tpl, { who });
}

function buildEnemyExpiredLine(enemyName, statusKey) {
  const who = safeName(enemyName, STATUS_TICK_DEFAULT_ENEMY_NAME);
  const k = String(statusKey || "");
  const tpl = ENEMY_STATUS_EXPIRED_TEMPLATES[k] || STATUS_EXPIRED_FALLBACK_TEMPLATE;
  return renderTemplate(tpl, { who });
}

export function buildStatusTickLines({ events, actorName, enemyName }) {
  if (!Array.isArray(events) || events.length === 0) return [];

  const lines = [];
  for (const evt of events) {
    if (!evt || evt.type !== "statusExpired") continue;

    if (evt.side === "actor") {
      lines.push(buildActorExpiredLine(actorName, evt.statusKey));
      continue;
    }

    if (evt.side === "enemy") {
      lines.push(buildEnemyExpiredLine(enemyName, evt.statusKey));
      continue;
    }
  }

  return lines.filter(Boolean);
}
