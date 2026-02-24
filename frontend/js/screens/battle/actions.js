// frontend/js/screens/battle/actions.js
//
// Battle action handlers extracted from battle.js.
//
// ✅ Tag-target specials:
// - special.target can be a string OR an array of tags.
// - We derive a BASE target ("self"|"ally"|"enemy"|"team") for UI flow.
// - Downed ally targeting is allowed for revive-tag OR healAllyMissingPct.
//
// Minimal + pruned: keeps your existing battle behavior.

import { buildPlayerAttackLines } from "../../battleText/engines/buildAttackLines.js";
import { buildPlayerDefendLines } from "../../battleText/engines/buildDefendLines.js";
import {
  buildEnemyBackedDownLine,
  buildEnemyDefeatedLine,
  buildInvalidTargetLine,
  buildNoSpecialsAvailableLine,
  buildNoValidAllyTargetsLine,
  buildPressEnterContinueBangLine,
  buildPressEnterContinueLine,
  buildQuirkyExtraTurnLine,
  buildRunUnavailableLines,
  buildSpecialCooldownLine,
  buildSpecialUsedFallbackLine,
  buildSpecialWrongTargetLine
} from "../../battleText/engines/corePrompts.js";
import {
  buildLevelUpAtkDefLine,
  buildLevelUpCritDamageBonusLine,
  buildLevelUpEvasionBonusLine,
  buildLevelUpHeadlineLine,
  buildLevelUpMaxHpLine
} from "../../battleText/engines/buildProgressionLines.js";
import {
  buildPartyItemHealFallbackLine,
  buildPartyItemNoEffectFallbackLine,
  buildUnknownItemLabel
} from "../../battleText/engines/buildItemPartyFallbackLines.js";
import {
  buildItemCooldownLine,
  buildItemNoEffectLine,
  buildItemResultLines,
  buildItemUnavailableLine,
  buildInvalidItemTargetLine,
  buildNoItemsLine,
  buildNoItemSelectedLine,
  buildNoValidItemTargetsLine
} from "../../battleText/engines/buildItemLines.js";
import { wrapLinesWithEnterReleaseArm } from "../../systems/enterReleaseGateSystem.js";
import { buildEnemyDefeatLines } from "../../battleText/engines/buildEnemyMetaLines.js";
import { getGenreColor } from "../../ui/genreStyle.js";
import { items } from "../../data/items.js";


function buildEnemyKnockdownLines(enemy, fallbackBuilder) {
  const authored = buildEnemyDefeatLines(enemy);
  if (authored.length > 0) return authored.map((text) => ({ text }));
  return [{ text: fallbackBuilder(enemy?.name) }];
}

function asLines(lines) {
  if (!Array.isArray(lines)) return [String(lines)];
  return lines.filter(Boolean).map(String);
}

function actorDisplayName(actor) {
  return String(actor?.movie?.title || actor?.title || actor?.name || "").trim();
}

function actorNameCandidates(actor) {
  const out = [];
  const add = (v) => {
    const s = String(v || "").trim();
    if (!s) return;
    if (!out.includes(s)) out.push(s);
  };
  add(actor?.movie?.title);
  add(actor?.movie?.shortTitle);
  add(actor?.title);
  add(actor?.name);
  return out;
}

function actorPrimaryGenre(actor, movieMetaMap) {
  const movieId = actor?.movie?.id || null;
  const meta = movieId && movieMetaMap ? movieMetaMap[movieId] : null;
  return String(
    actor?.primaryGenre ||
    actor?.movie?.primaryGenre ||
    meta?.primaryGenre ||
    "UNKNOWN"
  )
    .trim()
    .toUpperCase();
}

function buildActorHighlight(actor, movieMetaMap) {
  const names = actorNameCandidates(actor);
  const name = names[0] || actorDisplayName(actor);
  if (!name) return null;
  const genre = actorPrimaryGenre(actor, movieMetaMap);
  const color = getGenreColor(genre);
  if (!color) return null;
  return { name, names, color };
}

function withHighlights(lines, highlightList) {
  const list = Array.isArray(highlightList) ? highlightList.filter(Boolean) : [];
  if (list.length === 0) return Array.isArray(lines) ? lines : [lines];

  const arr = Array.isArray(lines) ? lines : [lines];
  return arr.map((line) => {
    if (line && typeof line === "object" && !Array.isArray(line)) {
      const text = line.text == null ? "" : String(line.text);
      const highlights = [];
      for (const hl of list) {
        const candidates = Array.isArray(hl.names) ? hl.names : [hl.name];
        const found = candidates.find((n) => n && text.includes(n));
        if (found) highlights.push({ ...hl, name: found });
      }
      if (highlights.length === 0) return { ...line, text };
      return { ...line, text, highlights };
    }

    const text = line == null ? "" : String(line);
    const highlights = [];
    for (const hl of list) {
      const candidates = Array.isArray(hl.names) ? hl.names : [hl.name];
      const found = candidates.find((n) => n && text.includes(n));
      if (found) highlights.push({ ...hl, name: found });
    }
    if (highlights.length === 0) return { text };
    return { text, highlights };
  });
}

function withActorHighlight(lines, actor, movieMetaMap) {
  return withHighlights(lines, [buildActorHighlight(actor, movieMetaMap)]);
}

function withActorAndTargetHighlights(lines, actor, targetActor, movieMetaMap) {
  const actorHl = buildActorHighlight(actor, movieMetaMap);
  const targetHl = buildActorHighlight(targetActor, movieMetaMap);
  const list = [];
  if (actorHl) list.push(actorHl);
  if (targetHl && (!actorHl || targetHl.name !== actorHl.name)) list.push(targetHl);
  return withHighlights(lines, list);
}

function attachOnStartToFirstLine(lines, onStart) {
  if (!Array.isArray(lines) || lines.length === 0 || typeof onStart !== "function") return lines;
  const out = lines.slice();
  const first = out[0];

  if (first && typeof first === "object" && !Array.isArray(first)) {
    const prior = typeof first.onStart === "function" ? first.onStart : null;
    out[0] = {
      ...first,
      onStart: () => {
        if (prior) prior();
        onStart();
      }
    };
    return out;
  }

  out[0] = { text: String(first), onStart };
  return out;
}

function buildLevelUpLinesFromSummary(party, summary, onLineStart = null) {
  const awards = Array.isArray(summary?.awards) ? summary.awards : [];
  if (!awards.length) return [];

  const slotByActorKey = {};
  for (let i = 0; i < (party || []).length; i++) {
    const actor = party[i];
    if (!actor) continue;
    const key = actor?.movie?.id || actor?.name || `slot_${i}`;
    slotByActorKey[key] = i;
  }

  const leveled = awards
    .filter((a) => Number(a?.levelAfter || 0) > Number(a?.levelBefore || 0))
    .sort((a, b) => {
      const ai = Number(slotByActorKey[String(a?.actorKey || "")]);
      const bi = Number(slotByActorKey[String(b?.actorKey || "")]);
      const aSlot = Number.isFinite(ai) ? ai : 999;
      const bSlot = Number.isFinite(bi) ? bi : 999;
      return aSlot - bSlot;
    });

  const lines = [];
  for (const award of leveled) {
    const name = String(award?.actorName || award?.actorKey || "Actor");
    const level = Math.max(1, Math.floor(Number(award?.levelAfter || 1)));
    const hpGain = Math.max(0, Math.floor(Number(award?.maxHpAfter || 0) - Number(award?.maxHpBefore || 0)));
    const actorKey = String(award?.actorKey || "");

    lines.push({
      text: buildLevelUpHeadlineLine(name, level)
    });
    lines.push({
      onStart: () => {
        if (typeof onLineStart === "function") onLineStart(actorKey, "atkDef");
      },
      text: buildLevelUpAtkDefLine()
    });
    lines.push({
      onStart: () => {
        if (typeof onLineStart === "function") onLineStart(actorKey, "maxHp");
      },
      text: buildLevelUpMaxHpLine(hpGain)
    });

    if (Number(award?.slotIndex) === 0 && Number(award?.critDamageBonusAfter || 0) > Number(award?.critDamageBonusBefore || 0)) {
      lines.push({
        text: buildLevelUpCritDamageBonusLine()
      });
    } else if (Number(award?.slotIndex) === 3 && Number(award?.evasionAfter || 0) > Number(award?.evasionBefore || 0)) {
      lines.push({
        text: buildLevelUpEvasionBonusLine()
      });
    }
  }

  return lines;
}

function validateBattleDeps(deps) {
  const requiredFns = [
    "computePlayerAttack",
    "applyItemToActor",
    "executeSpecial",
    "buildSpecialLines",
    "queueMessages",
    "getCurrentActor",
    "advanceToNextActor"
  ];

  for (const key of requiredFns) {
    if (typeof deps[key] !== "function") {
      throw new Error(`BattleActions: missing or invalid dependency "${key}"`);
    }
  }
}

// -------------------------
// Special target helpers (string OR array)
// -------------------------
function normalizeTargetTags(target) {
  if (Array.isArray(target)) {
    return target
      .filter(Boolean)
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof target === "string" && target.trim()) return [target.trim().toLowerCase()];
  return [];
}


function specialHasTag(sp, tag) {
  return normalizeTargetTags(sp?.target).includes(String(tag));
}

function getSpecialBaseTarget(sp) {
  const tags = normalizeTargetTags(sp?.target);

  if (tags.includes("self")) return "self";
  if (tags.includes("ally")) return "ally";
  if (tags.includes("enemy")) return "enemy";
  if (tags.includes("team")) return "team";
  if (tags.includes("party")) return "team"; // legacy support

  // Legacy: if target was a non-empty string but not one of the above
  if (typeof sp?.target === "string" && sp.target.trim()) return sp.target.trim();

  return "enemy";
}

export function createBattleActions({ state, deps }) {
  validateBattleDeps(deps);
  if (!state) throw new Error("createBattleActions requires { state }");
  if (!deps) throw new Error("createBattleActions requires { deps }");

  const {
    actions,

    computePlayerAttack,
    applyItemToActor,
    executeSpecial,
    buildSpecialLines,
    awardXpToParty,
    syncPartyProgressToGameState,
    onPrepareLevelUpRoll,
    onLevelUpRollTrigger,
    onVictoryEnemyDownLineStart,

    queueMessages,
    getCurrentActor,
    advanceToNextActor,
    getFirstAliveIndex,
    getFirstConsciousIndex,
    isActorConsciousByIndex,

    movieMetaMap,
    getSignatureMapForActorPage,
    resolveSpecialsForActorCurrentPage,
    getPerkSpecialsForActor,
    executePerkSpecial,
    onRecordAction,
    onXpEvent,
    isConfirmHeld,
    beforeHealTarget,
    beforeShieldTarget,
    settleMortalPartySlotsAtDisplayedHp,

    QUIRKY_EXTRA_TURN_CHANCE = 0.08,
    rng = Math.random,
    
    DEFEND_ENEMY_PHASES = 2
  } = deps;

  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error("createBattleActions requires deps.actions (non-empty array)");
  }

  const HELD_DAMAGE_PENALTY_MULT = 0.85;
  const HELD_DAMAGE_PENALTY_START_STREAK = 3;

  function getPlayerDamageMultiplierForTurn(optionKey) {
    const held = typeof isConfirmHeld === "function" ? !!isConfirmHeld() : false;
    if (!held) {
      state.confirmHoldTurnStreak = 0;
      state.confirmHoldOptionKey = null;
      return 1;
    }

    const nextKey = String(optionKey || "UNKNOWN");
    const prevKey = state.confirmHoldOptionKey == null ? null : String(state.confirmHoldOptionKey);

    if (prevKey !== nextKey) {
      state.confirmHoldTurnStreak = 1;
      state.confirmHoldOptionKey = nextKey;
    } else {
      const prior = Math.max(0, Math.floor(Number(state.confirmHoldTurnStreak || 0)));
      state.confirmHoldTurnStreak = prior + 1;
    }

    return state.confirmHoldTurnStreak >= HELD_DAMAGE_PENALTY_START_STREAK
      ? HELD_DAMAGE_PENALTY_MULT
      : 1;
  }

  function applyDamagePenaltyToEnemyDamage(enemy, enemyHpBefore, rawDamage, damageMultiplier) {
    const hpBefore = Math.max(0, Math.round(Number(enemyHpBefore || 0)));
    const baseDamage = Math.max(0, Math.round(Number(rawDamage || 0)));
    if (!enemy || hpBefore <= 0 || baseDamage <= 0) return 0;
    if (!(damageMultiplier < 1)) return Math.min(baseDamage, hpBefore);

    const scaledDamage = Math.max(0, Math.min(hpBefore, Math.round(baseDamage * damageMultiplier)));
    enemy.hp = Math.max(0, hpBefore - scaledDamage);
    return scaledDamage;
  }

  function applyDamagePenaltyToSpecialResult(result, enemy, enemyHpBefore, damageMultiplier) {
    if (!enemy || !result || !(damageMultiplier < 1)) return;

    const hpBefore = Math.max(0, Math.round(Number(enemyHpBefore || 0)));
    const hpAfter = Math.max(0, Math.round(Number(enemy.hp || 0)));
    const dealt = Math.max(0, hpBefore - hpAfter);
    if (dealt <= 0) return;

    const scaled = Math.max(0, Math.min(hpBefore, Math.round(dealt * damageMultiplier)));
    enemy.hp = Math.max(0, hpBefore - scaled);

    if (!result.effects || typeof result.effects !== "object") return;
    if (typeof result.effects.damageDealt === "number") result.effects.damageDealt = scaled;
    if (typeof result.effects.teamDmg === "number") {
      const teamScaled = Math.max(0, Math.round(Number(result.effects.teamDmg || 0) * damageMultiplier));
      result.effects.teamDmg = Math.min(teamScaled, scaled);
    }
    if (typeof result.effects.dmg === "number") {
      result.effects.dmg = Math.max(0, Math.round(Number(result.effects.dmg || 0) * damageMultiplier));
    }
  }

  function emitXpEvent(event) {
    if (typeof onXpEvent !== "function") return;
    onXpEvent({
      ...event,
      confirmHeld: typeof isConfirmHeld === "function" ? !!isConfirmHeld() : false
    });
  }

  function resolveAllSpecialsForActor(actor) {
    const core = resolveSpecialsForActorCurrentPage(actor) || [];
    const perk = typeof getPerkSpecialsForActor === "function" ? (getPerkSpecialsForActor(actor) || []) : [];
    return [...core, ...perk];
  }

  // -------------------------
  // Confirm helpers
  // -------------------------
  function beginConfirm(action) {
    state.confirmAction = action;
    state.uiMode = "confirm";
  }

  function runConfirmedAction(action) {
    if (action === "ATTACK") return playerAttackCurrentActor();
    if (action === "DEFEND") return playerDefendCurrentActor();
    if (action === "RUN") {
      getPlayerDamageMultiplierForTurn("RUN");
      state.defeatReason = "RUN";
      state.phase = "defeat";
      queueMessages(wrapLinesWithEnterReleaseArm(buildRunUnavailableLines(), onVictoryEnemyDownLineStart, "all"), () => {});
    }
  }

  // -------------------------
  // Player: Attack / Defend
  // -------------------------
  function playerAttackCurrentActor() {
    const actor = getCurrentActor();
    if (!actor) return advanceToNextActor();
    const playerDamageMultiplier = getPlayerDamageMultiplierForTurn("ATTACK");

    const action = { result: null };

    queueMessages(
      [{
        onStart: () => {
          const enemyHpBefore = Number(state.enemy?.hp || 0);
          const result = computePlayerAttack(actor, state.enemy);
          const baseDamage = Math.max(0, enemyHpBefore - Number(result?.newHp ?? enemyHpBefore));
          const finalDamage = applyDamagePenaltyToEnemyDamage(
            state.enemy,
            enemyHpBefore,
            baseDamage,
            playerDamageMultiplier
          );
          if (!(playerDamageMultiplier < 1)) state.enemy.hp = result.newHp;

          const finalHp = Math.max(0, Math.round(Number(state.enemy?.hp || result?.newHp || 0)));
          action.result = {
            ...result,
            damage: finalDamage,
            newHp: finalHp,
            killed: finalHp <= 0
          };
          emitXpEvent({
            type: "attack",
            actor,
            effectiveDamage: finalDamage,
            isCrit: !!action.result?.isCrit
          });
          if (typeof onRecordAction === "function") {
            onRecordAction(actor, "ATTACK", "Basic Attack");
          }
        },
        text: () => buildPlayerAttackLines({ actor, result: action.result })[0],
        actorHighlight: buildActorHighlight(actor, movieMetaMap)
      }],
      () => {
        const result = action.result;
        if (!result) return advanceToNextActor();

        if (result.killed) {
          state.phase = "victory";

          const xpSummary = typeof awardXpToParty === "function"
            ? awardXpToParty(state.party, state.enemy)
            : null;
          if (typeof onPrepareLevelUpRoll === "function") onPrepareLevelUpRoll(xpSummary);
          if (typeof syncPartyProgressToGameState === "function") syncPartyProgressToGameState();
          const levelLines = buildLevelUpLinesFromSummary(
            state.party,
            xpSummary,
            onLevelUpRollTrigger
          );

          const enemyDownLines = wrapLinesWithEnterReleaseArm(
            buildEnemyKnockdownLines(state.enemy, buildEnemyBackedDownLine),
            onVictoryEnemyDownLineStart,
            "all"
          );
          const postEnemyDownLines = [
            ...levelLines,
            ...wrapLinesWithEnterReleaseArm([buildPressEnterContinueBangLine()], onVictoryEnemyDownLineStart, "all")
          ];
          const postEnemyDownWithSettle = attachOnStartToFirstLine(postEnemyDownLines, () => {
            if (typeof settleMortalPartySlotsAtDisplayedHp === "function") {
              settleMortalPartySlotsAtDisplayedHp();
            }
          });

          queueMessages(enemyDownLines, () => {
            queueMessages(postEnemyDownWithSettle, () => {});
          });
          return;
        }

        if (actor.tone === "QUIRKY" && rng() < QUIRKY_EXTRA_TURN_CHANCE) {
          queueMessages([buildQuirkyExtraTurnLine()], () => {
            state.uiMode = "command";
            state.confirmAction = null;
            state.actionIndex = 0;
          });
          return;
        }

        advanceToNextActor();
      }
    );
  }

  function playerDefendCurrentActor() {
    const actor = getCurrentActor();
    if (!actor) return advanceToNextActor();
    getPlayerDamageMultiplierForTurn("DEFEND");

    actor.isDefending = true;

    // ✅ NEW: defend lasts for N enemy phases
    const n = Number.isFinite(DEFEND_ENEMY_PHASES) ? DEFEND_ENEMY_PHASES : 2;
    actor.defendEnemyPhasesLeft = Math.max(1, Math.floor(n));
    emitXpEvent({ type: "defend", actor });
    if (typeof onRecordAction === "function") {
      onRecordAction(actor, "DEFEND", "Guard");
    }

    queueMessages(withActorHighlight(buildPlayerDefendLines({ actor }), actor, movieMetaMap), () => advanceToNextActor());
  }


  // -------------------------
  // Items
  // -------------------------
  function ensureItemCooldownState() {
    if (!state.itemCooldowns || typeof state.itemCooldowns !== "object") {
      state.itemCooldowns = {};
    }
  }

  function getItemCooldownRemaining(actor, itemId) {
    if (!itemId) return 0;
    ensureItemCooldownState();
    const itemCd = Math.max(0, Math.floor(Number(state.itemCooldowns[itemId] || 0)));
    const def = itemId ? items[itemId] : null;
    const type = String(def?.type || "").trim().toLowerCase();
    if (type !== "reusableweapon") return itemCd;
    const weaponCd = Math.max(0, Math.floor(Number(state.itemCooldowns.__weapon__ || 0)));
    return Math.max(itemCd, weaponCd);
  }

  function setItemCooldownIfNeeded(actor, itemId, itemType, cooldownTurns, wasUsed) {
    if (!itemId || !wasUsed) return;
    const baseCd = Math.max(0, Math.floor(Number(cooldownTurns || 0)));
    // Cooldowns tick at player-phase start; store +1 so "1 turn" blocks the next full player phase.
    const cd = baseCd > 0 ? baseCd + 1 : 0;
    if (cd <= 0) return;
    ensureItemCooldownState();
    state.itemCooldowns[itemId] = cd;
    if (String(itemType || "").trim().toLowerCase() === "reusableweapon") {
      state.itemCooldowns.__weapon__ = Math.max(
        Math.max(0, Math.floor(Number(state.itemCooldowns.__weapon__ || 0))),
        cd
      );
    }
  }

  function playerUseItemCurrentActor() {
    const actor = getCurrentActor();
    if (!actor) {
      state.uiMode = "command";
      state.confirmAction = null;
      return;
    }

    if (!Array.isArray(state.inventory) || state.inventory.length === 0) {
      queueMessages([buildNoItemsLine()], () => {
        state.uiMode = "command";
        state.confirmAction = null;
        state.actionIndex = 0;
      });
      return;
    }

    state.uiMode = "item";
    if (state.itemIndex >= state.inventory.length) state.itemIndex = 0;
  }

  function useItemOnActor(entry, targetActor, sourceActor = null) {
    const result = applyItemToActor(entry, targetActor, { beforeHealTarget });
    const textLines = buildItemResultLines({ result, target: targetActor, actor: sourceActor });
    const text = textLines[0] || buildItemNoEffectLine();
    const itemName = result?.item?.name || entry?.id || buildUnknownItemLabel();

    if (result.consume) {
      entry.count -= 1;
      if (entry.count <= 0) {
        state.inventory = state.inventory.filter((e) => e.count > 0);
        if (state.itemIndex >= state.inventory.length) {
          state.itemIndex = Math.max(0, state.inventory.length - 1);
        }
      }
    }
    return {
      text,
      textLines,
      itemName,
      itemId: String(result?.item?.id || entry?.id || ""),
      itemType: String(result?.item?.type || ""),
      used: !!result?.used,
      cooldownTurns: Math.max(0, Math.floor(Number(result?.item?.cooldownTurns || 0))),
      healedHp: Number(result?.healedHp || 0),
      damageDealt: Number(result?.damageDealt || 0),
      effects: result?.effects || {}
    };
  }

  function useItemOnParty(entry, partyMembers, { includeDowned = false, sourceActor = null } = {}) {
    if (!entry || !Array.isArray(partyMembers)) {
      return { text: buildItemNoEffectLine(), itemName: "Item", healedHp: 0, damageDealt: 0, effects: {} };
    }

    const defPreview = applyItemToActor({ id: entry.id, count: entry.count }, {});
    const def = defPreview?.item || null;
    const itemName = def?.name || entry?.id || buildUnknownItemLabel();

    let totalHealed = 0;
    let totalDamage = 0;
    let anyConsume = false;
    let anyUsed = false;
    const mergedEffects = {};

    for (const member of partyMembers) {
      if (!member) continue;
      if (!includeDowned && Number(member.hp || 0) <= 0) continue;

      const result = applyItemToActor(entry, member, { beforeHealTarget });
      totalHealed += Number(result?.healedHp || 0);
      totalDamage += Number(result?.damageDealt || 0);
      anyConsume = anyConsume || !!result?.consume;
      anyUsed = anyUsed || !!result?.used;

      const fx = result?.effects || {};
      for (const [k, v] of Object.entries(fx)) {
        mergedEffects[k] = !!(mergedEffects[k] || v);
      }
    }

    if (anyConsume) {
      entry.count -= 1;
      if (entry.count <= 0) {
        state.inventory = state.inventory.filter((e) => e.count > 0);
        if (state.itemIndex >= state.inventory.length) {
          state.itemIndex = Math.max(0, state.inventory.length - 1);
        }
      }
    }

    const baseText = anyUsed
      ? buildPartyItemHealFallbackLine(itemName, totalHealed)
      : buildPartyItemNoEffectFallbackLine(itemName);
    const resultForLines = {
      item: def || { id: entry?.id, name: itemName },
      outcome: anyUsed ? "heal" : "noEffect",
      healedHp: Math.max(0, Math.round(totalHealed)),
      damageDealt: Math.max(0, Math.round(totalDamage)),
      effects: mergedEffects
    };
    const textLines = buildItemResultLines({
      result: resultForLines,
      target: { name: "the party" },
      actor: sourceActor
    });

    return {
      text: textLines[0] || baseText,
      textLines: textLines.length > 0 ? textLines : [baseText],
      itemName,
      itemId: String(def?.id || entry?.id || ""),
      itemType: String(def?.type || ""),
      used: anyUsed,
      cooldownTurns: Math.max(0, Math.floor(Number(def?.cooldownTurns || 0))),
      healedHp: Math.max(0, Math.round(totalHealed)),
      damageDealt: Math.max(0, Math.round(totalDamage)),
      effects: mergedEffects
    };
  }

  function confirmUseSelectedItem() {
    const actor = getCurrentActor();
    if (!actor) {
      state.uiMode = "command";
      state.confirmAction = null;
      return;
    }

    if (!Array.isArray(state.inventory) || state.inventory.length === 0) {
      queueMessages([buildNoItemsLine()], () => {
        state.uiMode = "command";
        state.confirmAction = null;
        state.actionIndex = 0;
      });
      return;
    }

    const entry = state.inventory[state.itemIndex];
    if (!entry || entry.count <= 0) {
      queueMessages([buildItemUnavailableLine()], () => {
        state.uiMode = "command";
        state.confirmAction = null;
        state.actionIndex = 0;
      });
      return;
    }

    // preview (do not mutate real inventory entry)
    const previewEntry = { id: entry.id, count: entry.count };
    const preview = applyItemToActor(previewEntry, { ...actor });
    const def = preview.item;

    if (!def) {
      queueMessages([buildItemNoEffectLine()], () => {
        state.uiMode = "command";
        state.confirmAction = null;
        state.actionIndex = 0;
      });
      return;
    }

    const cooldownRemaining = getItemCooldownRemaining(actor, def.id);
    if (cooldownRemaining > 0) {
      queueMessages([buildItemCooldownLine(def.name, cooldownRemaining)], () => {
        state.uiMode = "item";
      });
      return;
    }

    if (def.target === "self") {
      getPlayerDamageMultiplierForTurn("ITEM");
      state.uiMode = "command";
      state.confirmAction = null;

      const action = { result: null };
      queueMessages(
        [{
          onStart: () => {
            const result = useItemOnActor(entry, actor, actor);
            action.result = result;
            setItemCooldownIfNeeded(actor, result.itemId, result.itemType, result.cooldownTurns, result.used);
            emitXpEvent({
              type: "item",
              actor,
              itemName: result.itemName,
              healedHp: Number(result.healedHp || 0),
              damageDealt: Number(result.damageDealt || 0),
              effects: result.effects || {}
            });
            if (typeof onRecordAction === "function") {
              onRecordAction(actor, "ITEM", result.itemName);
            }
          },
          text: () => action.result?.text || buildItemNoEffectLine(),
          actorHighlight: buildActorHighlight(actor, movieMetaMap)
        }],
        () => {
          const remainder = (action.result?.textLines || []).slice(1);
          const finalize = () => {
            if (actor.tone === "QUIRKY" && rng() < QUIRKY_EXTRA_TURN_CHANCE) {
              queueMessages([buildQuirkyExtraTurnLine()], () => {
                state.actionIndex = 0;
              });
              return;
            }
            advanceToNextActor();
          };
          if (remainder.length > 0) queueMessages(withActorHighlight(remainder, actor, movieMetaMap), finalize);
          else finalize();
        }
      );
      return;
    }

    if (def.target === "ally") {
      const allowDowned = !!def.revive;
      state.uiMode = "itemTarget";
      state.pendingItemIndex = state.itemIndex;
      const firstConscious =
        typeof getFirstConsciousIndex === "function"
          ? getFirstConsciousIndex(state.party)
          : (typeof getFirstAliveIndex === "function" ? getFirstAliveIndex(state.party) : 0);
      const firstDowned = allowDowned ? getFirstDownedIndex(state.party) : -1;
      state.targetIndex = firstDowned >= 0 ? firstDowned : firstConscious;

      if (state.targetIndex < 0) {
        state.uiMode = "command";
        state.confirmAction = null;
        queueMessages([buildNoValidItemTargetsLine()], () => {
          state.actionIndex = 0;
        });
      }
      return;
    }

    if (def.target === "team") {
      getPlayerDamageMultiplierForTurn("ITEM");
      state.uiMode = "command";
      state.confirmAction = null;

      const action = { result: null };
      queueMessages(
        [{
          onStart: () => {
            const result = useItemOnParty(entry, state.party, { includeDowned: false, sourceActor: actor });
            action.result = result;
            setItemCooldownIfNeeded(actor, result.itemId, result.itemType, result.cooldownTurns, result.used);
            emitXpEvent({
              type: "item",
              actor,
              itemName: result.itemName,
              healedHp: Number(result.healedHp || 0),
              damageDealt: Number(result.damageDealt || 0),
              effects: result.effects || {}
            });
            if (typeof onRecordAction === "function") {
              onRecordAction(actor, "ITEM", result.itemName);
            }
          },
          text: () => action.result?.text || buildItemNoEffectLine(),
          actorHighlight: buildActorHighlight(actor, movieMetaMap)
        }],
        () => {
          const remainder = (action.result?.textLines || []).slice(1);
          const finalize = () => {
            if (actor.tone === "QUIRKY" && rng() < QUIRKY_EXTRA_TURN_CHANCE) {
              queueMessages([buildQuirkyExtraTurnLine()], () => {
                state.actionIndex = 0;
              });
              return;
            }
            advanceToNextActor();
          };
          if (remainder.length > 0) queueMessages(withActorHighlight(remainder, actor, movieMetaMap), finalize);
          else finalize();
        }
      );
      return;
    }

    if (def.target === "enemy") {
      if (!state.enemy || Number(state.enemy.hp || 0) <= 0) {
        queueMessages([buildNoValidItemTargetsLine()], () => {
          state.uiMode = "command";
          state.confirmAction = null;
          state.actionIndex = 0;
        });
        return;
      }

      getPlayerDamageMultiplierForTurn("ITEM");
      state.uiMode = "command";
      state.confirmAction = null;

      const action = { result: null };
      queueMessages(
        [{
          onStart: () => {
            const result = useItemOnActor(entry, state.enemy, actor);
            action.result = result;
            setItemCooldownIfNeeded(actor, result.itemId, result.itemType, result.cooldownTurns, result.used);
            emitXpEvent({
              type: "item",
              actor,
              itemName: result.itemName,
              healedHp: Number(result.healedHp || 0),
              damageDealt: Number(result.damageDealt || 0),
              effects: result.effects || {}
            });
            if (typeof onRecordAction === "function") {
              onRecordAction(actor, "ITEM", result.itemName);
            }
          },
          text: () => action.result?.text || buildItemNoEffectLine(),
          actorHighlight: buildActorHighlight(actor, movieMetaMap)
        }],
        () => {
          const remainder = (action.result?.textLines || []).slice(1);
          const finishTurn = () => {
          if (state.enemy && Number(state.enemy.hp || 0) <= 0) {
            state.phase = "victory";

            const xpSummary = typeof awardXpToParty === "function"
              ? awardXpToParty(state.party, state.enemy)
              : null;
            if (typeof onPrepareLevelUpRoll === "function") onPrepareLevelUpRoll(xpSummary);
            if (typeof syncPartyProgressToGameState === "function") syncPartyProgressToGameState();
            const levelLines = buildLevelUpLinesFromSummary(
              state.party,
              xpSummary,
              onLevelUpRollTrigger
            );

            const enemyDownLines = wrapLinesWithEnterReleaseArm(
              buildEnemyKnockdownLines(state.enemy, buildEnemyBackedDownLine),
              onVictoryEnemyDownLineStart,
              "all"
            );
            const postEnemyDownLines = [
              ...levelLines,
              ...wrapLinesWithEnterReleaseArm([buildPressEnterContinueBangLine()], onVictoryEnemyDownLineStart, "all")
            ];
            const postEnemyDownWithSettle = attachOnStartToFirstLine(postEnemyDownLines, () => {
              if (typeof settleMortalPartySlotsAtDisplayedHp === "function") {
                settleMortalPartySlotsAtDisplayedHp();
              }
            });

            queueMessages(enemyDownLines, () => {
              queueMessages(postEnemyDownWithSettle, () => {});
            });
            return;
          }

          if (actor.tone === "QUIRKY" && rng() < QUIRKY_EXTRA_TURN_CHANCE) {
            queueMessages([buildQuirkyExtraTurnLine()], () => {
              state.actionIndex = 0;
            });
            return;
          }
          advanceToNextActor();
          };
          if (remainder.length > 0) queueMessages(withActorHighlight(remainder, actor, movieMetaMap), finishTurn);
          else finishTurn();
        }
      );
      return;
    }

    // default: apply to self if unknown target
    getPlayerDamageMultiplierForTurn("ITEM");
    state.uiMode = "command";
    state.confirmAction = null;
    const action = { result: null };
    queueMessages(
      [{
        onStart: () => {
          const result = useItemOnActor(entry, actor, actor);
          action.result = result;
          setItemCooldownIfNeeded(actor, result.itemId, result.itemType, result.cooldownTurns, result.used);
            emitXpEvent({
              type: "item",
              actor,
              itemName: result.itemName,
              healedHp: Number(result.healedHp || 0),
              damageDealt: Number(result.damageDealt || 0),
              effects: result.effects || {}
            });
          if (typeof onRecordAction === "function") {
            onRecordAction(actor, "ITEM", result.itemName);
          }
        },
        text: () => action.result?.text || buildItemNoEffectLine(),
        actorHighlight: buildActorHighlight(actor, movieMetaMap)
      }],
      () => {
        const remainder = (action.result?.textLines || []).slice(1);
        if (remainder.length > 0) queueMessages(withActorHighlight(remainder, actor, movieMetaMap), () => advanceToNextActor());
        else advanceToNextActor();
      }
    );
  }

  function confirmUseItemOnTarget() {
    const actor = getCurrentActor();
    if (!actor) {
      state.uiMode = "command";
      state.confirmAction = null;
      return;
    }

    if (state.pendingItemIndex < 0 || state.pendingItemIndex >= state.inventory.length) {
      state.uiMode = "command";
      state.confirmAction = null;
      queueMessages([buildNoItemSelectedLine()], () => {
        state.actionIndex = 0;
      });
      return;
    }

    const entry = state.inventory[state.pendingItemIndex];
    if (!entry || entry.count <= 0) {
      state.uiMode = "command";
      state.confirmAction = null;
      queueMessages([buildItemUnavailableLine()], () => {
        state.actionIndex = 0;
      });
      return;
    }

    const defPreview = applyItemToActor({ id: entry.id, count: entry.count }, { ...actor });
    const def = defPreview?.item || null;
    const cooldownRemaining = getItemCooldownRemaining(actor, def?.id);
    if (cooldownRemaining > 0) {
      state.uiMode = "item";
      state.confirmAction = null;
      state.pendingItemIndex = -1;
      queueMessages([buildItemCooldownLine(def?.name || entry.id, cooldownRemaining)], () => {
        state.actionIndex = 0;
      });
      return;
    }
    const allowDowned = !!def?.revive;

    const target = state.party[state.targetIndex];
    const conscious =
      typeof isActorConsciousByIndex === "function"
        ? isActorConsciousByIndex(state.targetIndex)
        : !!(target && target.hp > 0);
    if (!target || (!conscious && !allowDowned)) {
      state.uiMode = "command";
      state.confirmAction = null;
      state.pendingItemIndex = -1;
      queueMessages([buildInvalidItemTargetLine()], () => {
        state.actionIndex = 0;
      });
      return;
    }

    state.uiMode = "command";
    state.confirmAction = null;
    state.pendingItemIndex = -1;
    getPlayerDamageMultiplierForTurn("ITEM");

    const action = { result: null };
    queueMessages(
      [{
        onStart: () => {
          const result = useItemOnActor(entry, target, actor);
          action.result = result;
          setItemCooldownIfNeeded(actor, result.itemId, result.itemType, result.cooldownTurns, result.used);
          emitXpEvent({
            type: "item",
            actor,
            itemName: result.itemName,
            healedHp: Number(result.healedHp || 0),
            damageDealt: Number(result.damageDealt || 0),
            effects: result.effects || {}
          });
          if (typeof onRecordAction === "function") {
            onRecordAction(actor, "ITEM", result.itemName);
          }
        },
        text: () => action.result?.text || buildItemNoEffectLine(),
        actorHighlight: buildActorHighlight(actor, movieMetaMap)
      }],
      () => {
        const remainder = (action.result?.textLines || []).slice(1);
        const finalize = () => {
          if (actor.tone === "QUIRKY" && rng() < QUIRKY_EXTRA_TURN_CHANCE) {
            queueMessages([buildQuirkyExtraTurnLine()], () => {
              state.actionIndex = 0;
            });
            return;
          }
          advanceToNextActor();
        };
        if (remainder.length > 0) queueMessages(withActorAndTargetHighlights(remainder, actor, target, movieMetaMap), finalize);
        else finalize();
      }
    );
  }

  // -------------------------
  // Specials
  // -------------------------
  function playerOpenSpecialMenu() {
    const actor = getCurrentActor();
    if (!actor) return advanceToNextActor();

    state.specialsPageIndex = 0;

    state.specialsList = resolveAllSpecialsForActor(actor);
    if (!state.specialsList.length) {
      queueMessages([buildNoSpecialsAvailableLine()], () => {
        state.uiMode = "command";
        state.confirmAction = null;
        state.actionIndex = 0;
      });
      return;
    }

    state.uiMode = "special";
    state.specialIndex = 0;
    state.pendingSpecial = null;
  }

  function confirmUseSelectedSpecial() {
    const actor = getCurrentActor();
    if (!actor) {
      state.uiMode = "command";
      state.confirmAction = null;
      return;
    }

    const sp = state.specialsList?.[state.specialIndex];
    if (!sp) {
      state.uiMode = "command";
      state.confirmAction = null;
      return;
    }

    if (!sp.ready) {
      queueMessages([buildSpecialCooldownLine(sp)], () => {
        state.uiMode = "special";
      });
      return;
    }

    // ✅ ally targeting uses base target (works for tag arrays)
    const baseTarget = getSpecialBaseTarget(sp);
    if (baseTarget === "ally" || sp.kind === "healAllyMissingPct") {
      state.pendingSpecial = sp;
      state.uiMode = "specialTarget";

      // allow downed allies if revive-tag OR healAllyMissingPct
      const allowDowned = sp.kind === "healAllyMissingPct" || specialHasTag(sp, "revive");

      const firstAlive =
        typeof getFirstConsciousIndex === "function"
          ? getFirstConsciousIndex(state.party)
          : (typeof getFirstAliveIndex === "function" ? getFirstAliveIndex(state.party) : 0);

      const firstDowned = allowDowned ? getFirstDownedIndex(state.party) : -1;

      // If revive-allowed and someone is down, start cursor on them; else start on first alive.
      state.targetIndex = firstDowned >= 0 ? firstDowned : firstAlive;

      if (state.targetIndex < 0) {
        state.uiMode = "special";
        state.pendingSpecial = null;
        queueMessages([buildNoValidAllyTargetsLine()], () => {});
      }
      return;
    }


    state.uiMode = "command";
    state.confirmAction = null;
    state.actionIndex = 0;
    const playerDamageMultiplier = getPlayerDamageMultiplierForTurn("SPECIAL");
    const action = { lines: [], result: null };
    queueMessages(
      [{
        onStart: () => {
          const enemyHpBefore = Number(state.enemy?.hp || 0);
          const signatureMap =
            typeof getSignatureMapForActorPage === "function"
              ? getSignatureMapForActorPage(actor, state.specialsPageIndex)
              : null;

          if (sp.source === "perk" && typeof executePerkSpecial === "function") {
            action.result = executePerkSpecial({
              actor,
              party: state.party,
              enemy: state.enemy,
              special: sp,
              targetIndex: null,
              beforeHealTarget,
              beforeShieldTarget
            });
          } else {
            action.result = executeSpecial({
              actor,
              party: state.party,
              enemy: state.enemy,
              special: sp,
              movieMetaMap,
              signatureMap,
              targetIndex: null,
              beforeHealTarget,
              beforeShieldTarget
            });
          }
          applyDamagePenaltyToSpecialResult(
            action.result,
            state.enemy,
            enemyHpBefore,
            playerDamageMultiplier
          );

          if (sp.source === "perk" && Array.isArray(action.result?.lines)) {
            action.lines = withActorHighlight(asLines(action.result.lines), actor, movieMetaMap);
          } else {
            action.lines = withActorHighlight(asLines(
              buildSpecialLines({
                actor,
                party: state.party,
                enemy: state.enemy,
                special: sp,
                targetIndex: null,
                result: action.result
              }) || [buildSpecialUsedFallbackLine()]
            ), actor, movieMetaMap);
          }
          emitXpEvent({
            type: "special",
            actor,
            special: sp,
            effects: action.result?.effects || null
          });

          if (typeof onRecordAction === "function") {
            onRecordAction(actor, "SPECIAL", sp?.name || sp?.label || sp?.id || "Unknown Special");
          }
          state.specialsList = resolveAllSpecialsForActor(actor);
        },
        text: () => action.lines[0]?.text || buildSpecialUsedFallbackLine(),
        actorHighlight: buildActorHighlight(actor, movieMetaMap)
      }],
      () => {
        const remainder = action.lines.slice(1);
        const finalize = () => {
          if (state.enemy && state.enemy.hp <= 0) {
            state.phase = "victory";
            const xpSummary = typeof awardXpToParty === "function"
              ? awardXpToParty(state.party, state.enemy)
              : null;
            if (typeof onPrepareLevelUpRoll === "function") onPrepareLevelUpRoll(xpSummary);
            if (typeof syncPartyProgressToGameState === "function") syncPartyProgressToGameState();
            const levelLines = buildLevelUpLinesFromSummary(
              state.party,
              xpSummary,
              onLevelUpRollTrigger
            );
            const enemyDownLines = wrapLinesWithEnterReleaseArm(
              buildEnemyKnockdownLines(state.enemy, buildEnemyDefeatedLine),
              onVictoryEnemyDownLineStart,
              "all"
            );
            const postEnemyDownLines = [
              ...levelLines,
              ...wrapLinesWithEnterReleaseArm([buildPressEnterContinueLine()], onVictoryEnemyDownLineStart, "all")
            ];
            const postEnemyDownWithSettle = attachOnStartToFirstLine(postEnemyDownLines, () => {
              if (typeof settleMortalPartySlotsAtDisplayedHp === "function") {
                settleMortalPartySlotsAtDisplayedHp();
              }
            });

            queueMessages(enemyDownLines, () => {
              queueMessages(postEnemyDownWithSettle, () => {});
            });
            return;
          }

          if (actor.tone === "QUIRKY" && rng() < QUIRKY_EXTRA_TURN_CHANCE) {
            queueMessages([buildQuirkyExtraTurnLine()], () => {
              state.uiMode = "command";
              state.confirmAction = null;
              state.actionIndex = 0;
            });
            return;
          }
          advanceToNextActor();
        };

        if (remainder.length > 0) queueMessages(remainder, finalize);
        else finalize();
      }
    );
  }

  function getFirstDownedIndex(party) {
    if (!Array.isArray(party)) return -1;
    for (let i = 0; i < party.length; i++) {
      const m = party[i];
      const conscious =
        typeof isActorConsciousByIndex === "function"
          ? isActorConsciousByIndex(i)
          : !!(m && m.hp > 0);
      if (m && !conscious) return i;
    }
    return -1;
  }

  function confirmUseSpecialOnTarget() {
    const actor = getCurrentActor();
    if (!actor) {
      state.uiMode = "command";
      state.confirmAction = null;
      state.pendingSpecial = null;
      return;
    }

    const sp = state.pendingSpecial;
    if (!sp) {
      state.uiMode = "special";
      return;
    }

    // safety: only ally-target specials should be here
    const baseTarget = getSpecialBaseTarget(sp);
    if (baseTarget !== "ally") {
      state.uiMode = "special";
      state.pendingSpecial = null;
      queueMessages([buildSpecialWrongTargetLine()], () => {});
      return;
    }

    const target = state.party[state.targetIndex];

    // allow downed allies if revive-tag OR healAllyMissingPct
    const allowDowned = sp.kind === "healAllyMissingPct" || specialHasTag(sp, "revive");

    if (
      state.targetIndex < 0 ||
      state.targetIndex >= state.party.length ||
      !target ||
      (!allowDowned &&
        !(
          typeof isActorConsciousByIndex === "function"
            ? isActorConsciousByIndex(state.targetIndex)
            : !!(target && target.hp > 0)
        ))
    ) {
      state.uiMode = "special";
      state.pendingSpecial = null;
      queueMessages([buildInvalidTargetLine()], () => {});
      return;
    }

    state.pendingSpecial = null;
    state.uiMode = "command";
    state.confirmAction = null;
    state.actionIndex = 0;
    const playerDamageMultiplier = getPlayerDamageMultiplierForTurn("SPECIAL");
    const action = { lines: [], result: null };
    const fixedTargetIndex = state.targetIndex;
    queueMessages(
      [{
        onStart: () => {
          const enemyHpBefore = Number(state.enemy?.hp || 0);
          const signatureMap =
            typeof getSignatureMapForActorPage === "function"
              ? getSignatureMapForActorPage(actor, state.specialsPageIndex)
              : null;

          if (sp.source === "perk" && typeof executePerkSpecial === "function") {
            action.result = executePerkSpecial({
              actor,
              party: state.party,
              enemy: state.enemy,
              special: sp,
              targetIndex: fixedTargetIndex,
              beforeHealTarget,
              beforeShieldTarget
            });
          } else {
            action.result = executeSpecial({
              actor,
              party: state.party,
              enemy: state.enemy,
              special: sp,
              movieMetaMap,
              signatureMap,
              targetIndex: fixedTargetIndex,
              beforeHealTarget,
              beforeShieldTarget
            });
          }
          applyDamagePenaltyToSpecialResult(
            action.result,
            state.enemy,
            enemyHpBefore,
            playerDamageMultiplier
          );

          if (sp.source === "perk" && Array.isArray(action.result?.lines)) {
            action.lines = withActorHighlight(asLines(action.result.lines), actor, movieMetaMap);
          } else {
            action.lines = withActorHighlight(asLines(
              buildSpecialLines({
                actor,
                party: state.party,
                enemy: state.enemy,
                special: sp,
                targetIndex: fixedTargetIndex,
                result: action.result
              }) || [buildSpecialUsedFallbackLine()]
            ), actor, movieMetaMap);
          }
          emitXpEvent({
            type: "special",
            actor,
            special: sp,
            effects: action.result?.effects || null
          });
          if (typeof onRecordAction === "function") {
            onRecordAction(actor, "SPECIAL", sp?.name || sp?.label || sp?.id || "Unknown Special");
          }
          state.specialsList = resolveAllSpecialsForActor(actor);
        },
        text: () => action.lines[0]?.text || buildSpecialUsedFallbackLine(),
        actorHighlight: buildActorHighlight(actor, movieMetaMap)
      }],
      () => {
        const remainder = action.lines.slice(1);
        const finalize = () => {
          if (state.enemy && state.enemy.hp <= 0) {
            state.phase = "victory";
            const xpSummary = typeof awardXpToParty === "function"
              ? awardXpToParty(state.party, state.enemy)
              : null;
            if (typeof onPrepareLevelUpRoll === "function") onPrepareLevelUpRoll(xpSummary);
            if (typeof syncPartyProgressToGameState === "function") syncPartyProgressToGameState();
            const levelLines = buildLevelUpLinesFromSummary(
              state.party,
              xpSummary,
              onLevelUpRollTrigger
            );
            const enemyDownLines = wrapLinesWithEnterReleaseArm(
              buildEnemyKnockdownLines(state.enemy, buildEnemyDefeatedLine),
              onVictoryEnemyDownLineStart,
              "all"
            );
            const postEnemyDownLines = [
              ...levelLines,
              ...wrapLinesWithEnterReleaseArm([buildPressEnterContinueLine()], onVictoryEnemyDownLineStart, "all")
            ];
            const postEnemyDownWithSettle = attachOnStartToFirstLine(postEnemyDownLines, () => {
              if (typeof settleMortalPartySlotsAtDisplayedHp === "function") {
                settleMortalPartySlotsAtDisplayedHp();
              }
            });

            queueMessages(enemyDownLines, () => {
              queueMessages(postEnemyDownWithSettle, () => {});
            });
            return;
          }

          if (actor.tone === "QUIRKY" && rng() < QUIRKY_EXTRA_TURN_CHANCE) {
            queueMessages([buildQuirkyExtraTurnLine()], () => {
              state.uiMode = "command";
              state.confirmAction = null;
              state.actionIndex = 0;
            });
            return;
          }
          advanceToNextActor();
        };

        if (remainder.length > 0) queueMessages(remainder, finalize);
        else finalize();
      }
    );
  }

  // -------------------------
  // Dispatch (from command menu)
  // -------------------------
  function handlePlayerActionFromCommand() {
    const actor = getCurrentActor();
    if (!actor) return advanceToNextActor();

    const action = actions[state.actionIndex];

    if (action === "ATTACK" || action === "DEFEND" || action === "RUN") {
      beginConfirm(action);
      return;
    }

    if (action === "ITEM") playerUseItemCurrentActor();
    else if (action === "SPECIAL") playerOpenSpecialMenu();
  }

  return {
    beginConfirm,
    runConfirmedAction,
    handlePlayerActionFromCommand,

    playerAttackCurrentActor,
    playerDefendCurrentActor,

    playerUseItemCurrentActor,
    confirmUseSelectedItem,
    confirmUseItemOnTarget,

    playerOpenSpecialMenu,
    confirmUseSelectedSpecial,
    confirmUseSpecialOnTarget
  };
}


