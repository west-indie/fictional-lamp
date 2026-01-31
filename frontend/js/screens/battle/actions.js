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

function asLines(lines) {
  if (!Array.isArray(lines)) return [String(lines)];
  return lines.filter(Boolean).map(String);
}

function validateBattleDeps(deps) {
  const requiredFns = [
    "computePlayerAttack",
    "applyItemToActor",
    "executeSpecial",
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
  if (Array.isArray(target)) return target.filter(Boolean).map(String);
  if (typeof target === "string" && target.trim()) return [target.trim()];
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
    awardXpToParty,
    syncPartyProgressToGameState,

    queueMessages,
    getCurrentActor,
    advanceToNextActor,
    getFirstAliveIndex,

    movieMetaMap,
    getSignatureMapForActorPage,
    resolveSpecialsForActorCurrentPage,

    QUIRKY_EXTRA_TURN_CHANCE = 0.08,
    rng = Math.random,
    
    DEFEND_ENEMY_PHASES = 2
  } = deps;

  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error("createBattleActions requires deps.actions (non-empty array)");
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
      state.defeatReason = "RUN";
      state.phase = "defeat";
      queueMessages(
        [
          "You try to run away...",
          "but this prototype doesn't support escaping yet.",
          "Press Enter to return to menu."
        ],
        null
      );
    }
  }

  // -------------------------
  // Player: Attack / Defend
  // -------------------------
  function playerAttackCurrentActor() {
    const actor = getCurrentActor();
    if (!actor) return advanceToNextActor();

    const result = computePlayerAttack(actor, state.enemy);
    state.enemy.hp = result.newHp;

    const title = actor.movie.title.slice(0, 10);
    const line = result.isCrit
      ? `${title} lands a CRITICAL hit for ${result.damage} damage!`
      : `${title} attacks for ${result.damage} damage!`;

    if (result.killed) {
      state.phase = "victory";

      if (typeof awardXpToParty === "function") awardXpToParty(state.party, state.enemy);
      if (typeof syncPartyProgressToGameState === "function") syncPartyProgressToGameState();

      queueMessages([line, `${state.enemy.name} has backed down!`, "Press Enter to continue!"], null);
      return;
    }

    if (actor.tone === "QUIRKY" && rng() < QUIRKY_EXTRA_TURN_CHANCE) {
      queueMessages([line, "Quirky energy! They get another action!"], () => {
        state.uiMode = "command";
        state.confirmAction = null;
        state.actionIndex = 0;
      });
      return;
    }

    queueMessages([line], () => advanceToNextActor());
  }

  function playerDefendCurrentActor() {
    const actor = getCurrentActor();
    if (!actor) return advanceToNextActor();

    actor.isDefending = true;

    // ✅ NEW: defend lasts for N enemy phases
    const n = Number.isFinite(DEFEND_ENEMY_PHASES) ? DEFEND_ENEMY_PHASES : 2;
    actor.defendEnemyPhasesLeft = Math.max(1, Math.floor(n));

    const title = actor.movie.title.slice(0, 10);
    queueMessages([`${title} braces for impact!`], () => advanceToNextActor());
  }


  // -------------------------
  // Items
  // -------------------------
  function playerUseItemCurrentActor() {
    const actor = getCurrentActor();
    if (!actor) {
      state.uiMode = "command";
      state.confirmAction = null;
      return;
    }

    if (!Array.isArray(state.inventory) || state.inventory.length === 0) {
      queueMessages(["You have no items!"], () => {
        state.uiMode = "command";
        state.confirmAction = null;
        state.actionIndex = 0;
      });
      return;
    }

    state.uiMode = "item";
    if (state.itemIndex >= state.inventory.length) state.itemIndex = 0;
  }

  function useItemOnActor(entry, targetActor) {
    const result = applyItemToActor(entry, targetActor);
    const text = result.message || "Nothing happens.";

    if (result.used) {
      entry.count -= 1;
      if (entry.count <= 0) {
        state.inventory = state.inventory.filter((e) => e.count > 0);
        if (state.itemIndex >= state.inventory.length) {
          state.itemIndex = Math.max(0, state.inventory.length - 1);
        }
      }
    }
    return text;
  }

  function confirmUseSelectedItem() {
    const actor = getCurrentActor();
    if (!actor) {
      state.uiMode = "command";
      state.confirmAction = null;
      return;
    }

    if (!Array.isArray(state.inventory) || state.inventory.length === 0) {
      queueMessages(["You have no items!"], () => {
        state.uiMode = "command";
        state.confirmAction = null;
        state.actionIndex = 0;
      });
      return;
    }

    const entry = state.inventory[state.itemIndex];
    if (!entry || entry.count <= 0) {
      queueMessages(["That item is not available."], () => {
        state.uiMode = "command";
        state.confirmAction = null;
        state.actionIndex = 0;
      });
      return;
    }

    // preview (do not mutate real inventory entry)
    const previewEntry = { id: entry.id, count: entry.count };
    const preview = applyItemToActor(previewEntry, actor);
    const def = preview.item;

    if (!def) {
      queueMessages(["That item has no effect."], () => {
        state.uiMode = "command";
        state.confirmAction = null;
        state.actionIndex = 0;
      });
      return;
    }

    if (def.target === "self") {
      const resultText = useItemOnActor(entry, actor);
      state.uiMode = "command";
      state.confirmAction = null;

      if (actor.tone === "QUIRKY" && rng() < QUIRKY_EXTRA_TURN_CHANCE) {
        queueMessages([resultText, "Quirky energy! They get another action!"], () => {
          state.actionIndex = 0;
        });
        return;
      }

      queueMessages([resultText], () => advanceToNextActor());
      return;
    }

    if (def.target === "ally") {
      state.uiMode = "itemTarget";
      state.pendingItemIndex = state.itemIndex;
      state.targetIndex = typeof getFirstAliveIndex === "function" ? getFirstAliveIndex(state.party) : 0;

      if (state.targetIndex < 0) {
        state.uiMode = "command";
        state.confirmAction = null;
        queueMessages(["No valid targets for this item."], () => {
          state.actionIndex = 0;
        });
      }
      return;
    }

    // default: apply to self if unknown target
    const resultText = useItemOnActor(entry, actor);
    state.uiMode = "command";
    state.confirmAction = null;
    queueMessages([resultText], () => advanceToNextActor());
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
      queueMessages(["No item selected."], () => {
        state.actionIndex = 0;
      });
      return;
    }

    const entry = state.inventory[state.pendingItemIndex];
    if (!entry || entry.count <= 0) {
      state.uiMode = "command";
      state.confirmAction = null;
      queueMessages(["That item is not available."], () => {
        state.actionIndex = 0;
      });
      return;
    }

    const target = state.party[state.targetIndex];
    if (!target || target.hp <= 0) {
      state.uiMode = "command";
      state.confirmAction = null;
      state.pendingItemIndex = -1;
      queueMessages(["Invalid target."], () => {
        state.actionIndex = 0;
      });
      return;
    }

    const resultText = useItemOnActor(entry, target);

    state.uiMode = "command";
    state.confirmAction = null;
    state.pendingItemIndex = -1;

    if (actor.tone === "QUIRKY" && rng() < QUIRKY_EXTRA_TURN_CHANCE) {
      queueMessages([resultText, "Quirky energy! They get another action!"], () => {
        state.actionIndex = 0;
      });
      return;
    }

    queueMessages([resultText], () => advanceToNextActor());
  }

  // -------------------------
  // Specials
  // -------------------------
  function playerOpenSpecialMenu() {
    const actor = getCurrentActor();
    if (!actor) return advanceToNextActor();

    state.specialsPageIndex = 0;

    state.specialsList = resolveSpecialsForActorCurrentPage(actor) || [];
    if (!state.specialsList.length) {
      queueMessages(["No specials available."], () => {
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
      queueMessages(
        [`${sp.name} is on cooldown (${sp.cooldownRemaining} turn${sp.cooldownRemaining === 1 ? "" : "s"}).`],
        () => {
          state.uiMode = "special";
        }
      );
      return;
    }

    // ✅ ally targeting uses base target (works for tag arrays)
    const baseTarget = getSpecialBaseTarget(sp);
    if (baseTarget === "ally" || sp.kind === "healAllyMissingPct") {
      state.pendingSpecial = sp;
      state.uiMode = "specialTarget";
      state.targetIndex = typeof getFirstAliveIndex === "function" ? getFirstAliveIndex(state.party) : 0;

      if (state.targetIndex < 0) {
        state.uiMode = "special";
        state.pendingSpecial = null;
        queueMessages(["No valid ally targets."], null);
      }
      return;
    }

    const signatureMap =
      typeof getSignatureMapForActorPage === "function"
        ? getSignatureMapForActorPage(actor, state.specialsPageIndex)
        : null;

    const result = executeSpecial({
      actor,
      party: state.party,
      enemy: state.enemy,
      special: sp,
      movieMetaMap,
      signatureMap,
      targetIndex: null
    });

    // Refresh list after using a special
    state.specialsList = resolveSpecialsForActorCurrentPage(actor) || [];

    state.uiMode = "command";
    state.confirmAction = null;
    state.actionIndex = 0;

    if (state.enemy && state.enemy.hp <= 0) {
      state.phase = "victory";
      if (typeof awardXpToParty === "function") awardXpToParty(state.party, state.enemy);
      if (typeof syncPartyProgressToGameState === "function") syncPartyProgressToGameState();
      queueMessages([...(result.lines || []), `${state.enemy.name} is defeated!`, "Press Enter to continue."], null);
      return;
    }

    if (actor.tone === "QUIRKY" && rng() < QUIRKY_EXTRA_TURN_CHANCE) {
      queueMessages([...(result.lines || []), "Quirky energy! They get another action!"], () => {
        state.uiMode = "command";
        state.confirmAction = null;
        state.actionIndex = 0;
      });
      return;
    }

    queueMessages(asLines(result.lines || ["Special used."]), () => advanceToNextActor());
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
      queueMessages(["That special doesn't target an ally."], null);
      return;
    }

    const target = state.party[state.targetIndex];

    // allow downed allies if revive-tag OR healAllyMissingPct
    const allowDowned = sp.kind === "healAllyMissingPct" || specialHasTag(sp, "revive");

    if (
      state.targetIndex < 0 ||
      state.targetIndex >= state.party.length ||
      !target ||
      (!allowDowned && target.hp <= 0)
    ) {
      state.uiMode = "special";
      state.pendingSpecial = null;
      queueMessages(["Invalid target."], null);
      return;
    }

    const signatureMap =
      typeof getSignatureMapForActorPage === "function"
        ? getSignatureMapForActorPage(actor, state.specialsPageIndex)
        : null;

    const result = executeSpecial({
      actor,
      party: state.party,
      enemy: state.enemy,
      special: sp,
      movieMetaMap,
      signatureMap,
      targetIndex: state.targetIndex
    });

    state.pendingSpecial = null;
    state.specialsList = resolveSpecialsForActorCurrentPage(actor) || [];

    state.uiMode = "command";
    state.confirmAction = null;
    state.actionIndex = 0;

    if (state.enemy && state.enemy.hp <= 0) {
      state.phase = "victory";
      if (typeof awardXpToParty === "function") awardXpToParty(state.party, state.enemy);
      if (typeof syncPartyProgressToGameState === "function") syncPartyProgressToGameState();
      queueMessages([...(result.lines || []), `${state.enemy.name} is defeated!`, "Press Enter to continue."], null);
      return;
    }

    if (actor.tone === "QUIRKY" && rng() < QUIRKY_EXTRA_TURN_CHANCE) {
      queueMessages([...(result.lines || []), "Quirky energy! They get another action!"], () => {
        state.uiMode = "command";
        state.confirmAction = null;
        state.actionIndex = 0;
      });
      return;
    }

    queueMessages(asLines(result.lines || ["Special used."]), () => advanceToNextActor());
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
