// frontend/js/screens/battle.js

import { changeScreen } from "../game.js";
import { GameState } from "../core/GameState.js";
import { SCREEN, BATTLE_LAYOUT } from "../layout.js";
import { Input } from "../ui.js";
import { specials } from "../data/specials.js";
import { items } from "../data/items.js";
import { movieMeta } from "../data/movieMeta.js";

import { getAliveParty, getFirstAliveIndex } from "../systems/turnSystem.js";
import { computePlayerAttack } from "../systems/damageSystem.js";
import { runEnemyTurn } from "../systems/enemyTurnSystem.js";
import { applyItemToActor } from "../systems/itemSystem.js";
import { awardXpToParty } from "../systems/xpSystem.js";
import { buildPartyFromMovies } from "../systems/battleSystem.js";
import { spawnEnemy } from "../systems/enemySpawnSystem.js";

import {
  ensureStatsState,
  incWins,
  incLosses,
  setStat,
  recordWinForPartyMovies
} from "../systems/statsSystem.js";
import { evaluateUnlockRules } from "../systems/unlockSystem.js";

import {
  getResolvedSpecialsForActor,
  executeSpecial,
  tickCooldownsForActor
} from "../systems/specialSystem.js";

import {
  applyOneFourEffectsToParty,
  clearOneFourBattleApplyFlag,
  resetOneFourRuntimeForBattle
} from "../systems/onefourEffectSystem.js";

import {
  armAudio,
  playTextBlip,
  playUIBackBlip,
  playUIConfirmBlip,
  playUIMoveBlip,
  setSfxVolume
} from "../sfx/uiSfx.js";

// ✅ BGM system
import { playBgm, stopBgm, setBgmVolume } from "../systems/audioSystem.js";
// ✅ Family-based BGM picker (renamed from bgmThemes -> bgmFamilies)
import { pickFamilyBgm } from "../data/bgmFamilies.js";

import { createBattleMessageBox } from "../ui/battleMessageBox.js";
import { getBattleHelpPanelText, ACTION_DESCRIPTIONS } from "../ui/battleHelpPanel.js";
import { renderBattleCharacterSlots } from "../ui/battleCharacterSlots.js";

import { tickActorStatuses, tickEnemyStatuses } from "../systems/statusTickSystem.js";
import {
  canToggleSpecialPages as canToggleSpecialPagesExt,
  getSpecialPageCount as getSpecialPageCountExt,
  getSignatureMapForActorPage as getSignatureMapForActorPageExt,
  resolveSpecialsForActorCurrentPage as resolveSpecialsForActorCurrentPageExt,
  toggleSpecialPageInState
} from "../systems/specialPagesSystem.js";

import { createBattleActions } from "./battle/actions.js";

// ✅ Module B/C/D refactor (behavior-preserving)
import { handleBattleKeyboardInput } from "./battle/battleInput.js";
import { handleBattleMouse } from "./battle/battleMouse.js";
import {
  drawCommandMenu,
  drawConfirmMiniButtonsIfNeeded,
  drawPauseMiniIfNeeded,
  drawItemMenuLikeCommandRow,
  drawSpecialMenu
} from "../ui/battleMenus.js";

// ✅ dynamic EarthBound-ish background (active region only)
import { createBattleBackground } from "../ui/battleBackground.js";

// ✅ NEW: Pause/Options overlay (battle context hides Reset)
import { createOptionsOverlay } from "./optionsOverlay.js";
import { syncOptionsAudioNow } from "../systems/optionsAudioSync.js";
// (SFX volume imports are up top)

const actions = ["ATTACK", "DEFEND", "ITEM", "SPECIAL", "RUN"];

// ✅ Hover state (mouse-only affordance; never required for gameplay)
let hover = { kind: null, index: -1 };
function setHover(next) {
  const n = next || { kind: null, index: -1 };
  const changed = hover.kind !== n.kind || hover.index !== n.index;
  hover = n;

  // ✅ Hover any option => play the same ping as arrow-key movement
  if (changed && n.kind) {
    try { playUIMoveBlip(); } catch {}
  }
}


let battleInitialized = false;

// ===== ITEM MENU SETTINGS =====
const ITEM_SLOTS_PER_PAGE = 5;
const ITEM_MAX_PAGES = 3;

// ===== Battle local state =====
const state = {
  party: [],
  enemy: null,
  phase: "player", // "player" | "enemy" | "victory" | "defeat"
  battleRunMode: null,
  battleIsCampaign: false,

  currentActorIndex: 0,

  uiMode: "command", // "command" | "item" | "itemTarget" | "special" | "specialTarget" | "confirm"
  actionIndex: 0,

  inventory: [],
  itemIndex: 0,
  itemsPageIndex: 0,
  pendingItemIndex: -1,

  targetIndex: 0,

  specialsList: [],
  specialsPageIndex: 0,
  specialIndex: 0,
  pendingSpecial: null,

  confirmAction: null,
  defeatReason: null
};

const QUIRKY_EXTRA_TURN_CHANCE = 0.08;
const FUNNY_DISRUPT_CHANCE = 0.05;

// ===== Message Box =====
const msgBox = createBattleMessageBox({ playTextBlip });

// ======================================================
// ✅ BATTLE BGM (start at battle start, stop at victory/defeat)
// ======================================================
const DEFAULT_BATTLE_BGM_URL = "frontend/assets/audio/bgm/Workin.mp3";
let battleBgmOn = false;

function startBattleBgm(enemy) {
  if (battleBgmOn) return;
  battleBgmOn = true;

  const family = enemy?.bgTheme;
  const pick = pickFamilyBgm(family) || DEFAULT_BATTLE_BGM_URL;

  const baseBattleVol = 0.2;

  // Track volume only: user Options volume is applied globally in audioSystem (bgmGain).
  if (typeof pick === "string") {
    // Old behavior: loop-only track
    playBgm(pick, { volume: baseBattleVol, loop: true });
  } else if (pick && typeof pick === "object") {
    // New behavior: intro once, then loop forever
    playBgm(pick.url, {
      volume: baseBattleVol,
      loop: true,
      introUrl: pick.introUrl
    });
  }
}

function stopBattleBgm() {
  if (!battleBgmOn) return;
  battleBgmOn = false;
  stopBgm({ fadeMs: 250 });
}

// ===== small helpers =====
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// ===== PROGRESSION HELPERS =====
function getProgressMap() {
  if (!GameState.party.progress) GameState.party.progress = {};
  return GameState.party.progress;
}

function saveProgressForActor(actor) {
  if (!actor || !actor.movie || !actor.movie.id) return;
  const progress = getProgressMap();

  progress[actor.movie.id] = {
    level: actor.level || 1,
    xp: actor.xp || 0,
    maxHp: actor.maxHp,
    atk: actor.atk,
    def: actor.def
  };
}

function syncPartyProgressToGameState() {
  state.party.forEach(saveProgressForActor);
}

// --- helper (top-level) ---
function completeRatatouilleTrialIfActive(GameStateRef) {
  const LS_RATA_TRIAL = "rpg_ratatouille_trial_v1";

  try {
    if (!GameStateRef.flags) GameStateRef.flags = {};
    if (!GameStateRef.flags.secrets) GameStateRef.flags.secrets = {};

    const trial = GameStateRef.flags.secrets.ratatouilleTrial;
    if (!trial || !trial.started || trial.completed) return false;

    trial.completed = true;

    let existing = null;
    try {
      existing = JSON.parse(window.localStorage.getItem(LS_RATA_TRIAL) || "null");
    } catch {
      existing = null;
    }

    const next = {
      ...(existing && typeof existing === "object" ? existing : {}),
      ...trial,
      completed: true
    };

    try {
      window.localStorage.setItem(LS_RATA_TRIAL, JSON.stringify(next));
    } catch {}

    GameStateRef.flags.secrets.ratatouilleTrial = next;
    return true;
  } catch {
    return false;
  }
}

// ===== INVENTORY =====
function initInventory() {
  state.inventory = [
    { id: "small_popcorn", count: 3 },
    { id: "small_soda", count: 2 },
    { id: "jumbo_popcorn", count: 1 },
    { id: "large_soda", count: 2 },
    { id: "fun_candy", count: 5 },
    { id: "jumbo_candy", count: 1 },
    { id: "camcorder", count: 4 },
    { id: "camera_phone", count: 2 },
    { id: "soda_launcher", count: 5 },
    { id: "nacho_bomb", count: 2 }
  ];
  state.itemIndex = 0;
  state.itemsPageIndex = 0;
  state.pendingItemIndex = -1;
}

function getInventoryItemDef(entry) {
  if (!entry) return null;
  return items[entry.id] || null;
}

// ===== ITEM PAGING =====
function getItemPageCount() {
  const needed = Math.ceil((state.inventory?.length || 0) / ITEM_SLOTS_PER_PAGE) || 1;
  return clamp(needed, 1, ITEM_MAX_PAGES);
}

function getItemPageStart(pageIndex) {
  return pageIndex * ITEM_SLOTS_PER_PAGE;
}

function clampItemPagingAndSelection() {
  const len = state.inventory.length;
  const pageCount = getItemPageCount();

  state.itemsPageIndex = clamp(state.itemsPageIndex, 0, pageCount - 1);

  if (len <= 0) {
    state.itemIndex = 0;
    state.itemsPageIndex = 0;
    return;
  }

  state.itemIndex = clamp(state.itemIndex, 0, len - 1);

  const computedPage = Math.floor(state.itemIndex / ITEM_SLOTS_PER_PAGE);
  state.itemsPageIndex = clamp(computedPage, 0, pageCount - 1);

  const maxAllowedIndex = Math.min(
    len - 1,
    getItemPageStart(pageCount - 1) + (ITEM_SLOTS_PER_PAGE - 1)
  );
  state.itemIndex = clamp(state.itemIndex, 0, maxAllowedIndex);
}

function moveItemCursorWithinCurrentPage(delta) {
  const len = state.inventory.length;
  if (len <= 0) return;

  const pageStart = getItemPageStart(state.itemsPageIndex);
  const pageEndExclusive = pageStart + ITEM_SLOTS_PER_PAGE;

  const first = pageStart;
  const last = Math.min(len - 1, pageEndExclusive - 1);
  if (first > last) return;

  state.itemIndex = clamp(state.itemIndex, first, last);

  const count = last - first + 1;
  const local = state.itemIndex - first;
  const nextLocal = (local + delta + count) % count;
  state.itemIndex = first + nextLocal;
}

function toggleItemPageInState() {
  const pageCount = getItemPageCount();
  if (pageCount <= 1) return false;

  const curStart = getItemPageStart(state.itemsPageIndex);
  const local = clamp(state.itemIndex - curStart, 0, ITEM_SLOTS_PER_PAGE - 1);

  state.itemsPageIndex = (state.itemsPageIndex + 1) % pageCount;

  const nextStart = getItemPageStart(state.itemsPageIndex);
  const candidate = nextStart + local;

  if (candidate < state.inventory.length) {
    state.itemIndex = candidate;
  } else {
    const lastOverall = state.inventory.length - 1;
    const lastOnPage = Math.min(lastOverall, nextStart + ITEM_SLOTS_PER_PAGE - 1);
    state.itemIndex = lastOnPage;
  }

  return true;
}

// ===== ACTOR HELPERS =====
function getCurrentActor() {
  if (state.currentActorIndex < 0 || state.currentActorIndex >= state.party.length) return null;
  const actor = state.party[state.currentActorIndex];
  if (!actor || actor.hp <= 0) return null;
  return actor;
}

function moveTargetCursor(delta) {
  if (state.party.length === 0) return;
  let idx = state.targetIndex;

  for (let attempts = 0; attempts < state.party.length; attempts++) {
    idx = (idx + delta + state.party.length) % state.party.length;
    if (state.party[idx].hp > 0) {
      state.targetIndex = idx;
      return;
    }
  }
}

// ===== ENEMY =====
function ensureEnemyExists() {
  if (GameState.enemy) {
    state.enemy = GameState.enemy;
    return;
  }

  const level = GameState.currentLevel || 1;

  // ✅ Dev override priority:
  // If enemyTemplate is set (LevelIntro sets it for dev), ignore enemyId/poolIds.
  const hasForcedTemplate = !!GameState.enemyTemplate;

  const enemyId = hasForcedTemplate ? null : (GameState.enemyId || null);
  const poolIds = hasForcedTemplate ? null : (GameState.enemyPoolIds || null);

  const spawned = spawnEnemy({
    level,
    template: GameState.enemyTemplate || null,
    enemyId,
    poolIds
  });

  // ✅ Consume template after spawning so it doesn't leak into later battles
  GameState.enemyTemplate = null;

  GameState.enemy = spawned;
  state.enemy = spawned;
}

// ===== SPECIAL PAGES (wrappers) =====
function canToggleSpecialPages(actor) {
  return canToggleSpecialPagesExt(actor, specials);
}

function getSpecialPageCount(movieId) {
  return getSpecialPageCountExt(movieId, specials);
}

function getSignatureMapForActorPage(actor, pageIndex) {
  return getSignatureMapForActorPageExt(actor, pageIndex, specials);
}

function resolveSpecialsForActorCurrentPage(actor) {
  return resolveSpecialsForActorCurrentPageExt({
    actor,
    pageIndex: state.specialsPageIndex,
    movieMetaMap: movieMeta,
    specialsMap: specials,
    getResolvedSpecialsForActor
  });
}

// ===== TURN START =====
function onActorTurnStart() {
  const actor = getCurrentActor();
  if (!actor) return;

  state.specialsPageIndex = 0;

  tickCooldownsForActor(actor);
  tickActorStatuses(actor);

  state.specialsList = resolveSpecialsForActorCurrentPage(actor);
  if (state.specialIndex >= state.specialsList.length) state.specialIndex = 0;
  state.pendingSpecial = null;
}

// ===== ✅ Dynamic Background (active region only) =====
const TOP_BAR_H = 72;
const BOTTOM_BAR_H = SCREEN.H - BATTLE_LAYOUT.message.y;
const ACTIVE_Y = TOP_BAR_H;
const ACTIVE_H = SCREEN.H - TOP_BAR_H - BOTTOM_BAR_H;

// Allocate background ONLY for active region
const battleBg = createBattleBackground({ width: SCREEN.W, height: ACTIVE_H });

// ======================================================
// ✅ NEW: Pause/Options overlay state (battle context => no Reset)
// ======================================================
let pauseOverlay = null;
let overlayMode = "none"; // "none" | "pause"

function ensurePauseOverlay() {
  if (pauseOverlay) return;

  pauseOverlay = createOptionsOverlay({
    width: SCREEN.W,
    height: SCREEN.H,

    onClose: () => {
      overlayMode = "none";
    },

    // No Reset in battle context, but keep safe no-op even if called.
    onReset: () => {},

    onSetMusicGain: (g01) => {
      try { setBgmVolume(g01); } catch {}
    },

    onSetSfxGain: (g01) => {
      try { setSfxVolume(g01); } catch {}
    }
  });
}

function openPauseOverlay() {
  ensurePauseOverlay();
  overlayMode = "pause";
  pauseOverlay.open({ context: "battle" }); // ✅ hides Reset
}

// ===== INIT / ADVANCE =====
function initBattle() {
  battleInitialized = true;
  state.phase = "player";
  state.uiMode = "command";
  state.confirmAction = null;
  state.actionIndex = 0;
  state.defeatReason = null;

  battleBgmOn = false;

  // ✅ Ensure AudioContext exists/resumed
  armAudio();

  // ✅ NEW: Sync BGM bus to saved slider BEFORE starting battle music
  try { syncOptionsAudioNow(); } catch {}

  msgBox.clear();

  state.party = buildPartyFromMovies(GameState.party.movies || []);
  state.battleRunMode = GameState.runMode || null;
  state.battleIsCampaign = state.battleRunMode === "campaign" || !!GameState.campaign;

  clearOneFourBattleApplyFlag(GameState);
  resetOneFourRuntimeForBattle(GameState);
  applyOneFourEffectsToParty(GameState, state.party);

  state.currentActorIndex = getFirstAliveIndex(state.party);
  if (state.currentActorIndex < 0) state.currentActorIndex = 0;

  // ✅ ensure the enemy exists BEFORE starting BGM
  ensureEnemyExists();

  // ✅ Start BGM AFTER enemy exists
  startBattleBgm(state.enemy);

  initInventory();
  onActorTurnStart();

  // ✅ Theme comes from enemy.bgTheme, intensity comes from the level you’re on.
  if (battleBg && typeof battleBg.configure === "function") {
    battleBg.configure({
      theme: state.enemy?.bgTheme,
      level: GameState.currentLevel || 1
    });
  }

  if (battleBg && typeof battleBg.randomize === "function") battleBg.randomize();

  // ✅ ensure pause overlay constructed (safe)
  ensurePauseOverlay();
}

function advanceToNextActor() {
  const n = state.party.length;
  let next = state.currentActorIndex + 1;
  while (next < n && state.party[next].hp <= 0) next++;

  if (next >= n) {
    state.phase = "enemy";
    state.uiMode = "command";
    state.confirmAction = null;
    state.actionIndex = 0;
    msgBox.queue(["Press Enter to Continue."], null);
  } else {
    state.currentActorIndex = next;
    state.uiMode = "command";
    state.confirmAction = null;
    state.actionIndex = 0;
    state.specialIndex = 0;
    state.pendingSpecial = null;

    onActorTurnStart();
  }
}

// ===== CANCEL =====
function cancelPressed() {
  return Input.pressed("Backspace");
}

function getCancelDestination(mode) {
  if (mode === "item") return "command";
  if (mode === "itemTarget") return "item";
  if (mode === "special") return "command";
  if (mode === "specialTarget") return "special";
  if (mode === "confirm") return "command";
  return null;
}

function cancelUI() {
  const dest = getCancelDestination(state.uiMode);
  if (!dest) return false;

  if (state.uiMode === "itemTarget") state.pendingItemIndex = -1;
  if (state.uiMode === "specialTarget") state.pendingSpecial = null;
  if (state.uiMode === "confirm") state.confirmAction = null;

  state.uiMode = dest;
  return true;
}

// ===== ACTIONS MODULE =====
const battleActions = createBattleActions({
  state,
  deps: {
    actions,
    computePlayerAttack,
    applyItemToActor,
    executeSpecial,
    awardXpToParty,
    syncPartyProgressToGameState,

    queueMessages: (lines, onDone) => msgBox.queue(lines, onDone),
    getCurrentActor,
    advanceToNextActor,
    getFirstAliveIndex,

    movieMetaMap: movieMeta,

    getSignatureMapForActorPage: (actor, pageIndex) => getSignatureMapForActorPage(actor, pageIndex),
    resolveSpecialsForActorCurrentPage: (actor) => resolveSpecialsForActorCurrentPage(actor),

    getInventoryItemDef,

    QUIRKY_EXTRA_TURN_CHANCE
  }
});

// ===== ENEMY TURN =====
function enemyAttack() {
  const alive = getAliveParty(state.party);
  if (alive.length === 0) {
    state.phase = "defeat";
    stopBattleBgm();
    msgBox.queue(["Your party has fallen..."], null);
    return;
  }

  tickEnemyStatuses(state.enemy);

  const hasFunny = alive.some((m) => m.tone === "FUNNY");
  const disrupted = hasFunny && Math.random() < FUNNY_DISRUPT_CHANCE;

  const result = runEnemyTurn(state.enemy, state.party, { funnyDisrupt: disrupted });

  msgBox.queue(result.lines, () => {
    if (result.partyDefeated) {
      state.phase = "defeat";
      stopBattleBgm();
      msgBox.queue(["Your party has fallen... Press Enter to return to menu."], null);
      return;
    }

    state.phase = "player";
    state.currentActorIndex = getFirstAliveIndex(state.party);
    state.uiMode = "command";
    state.confirmAction = null;
    state.actionIndex = 0;
    state.specialIndex = 0;
    state.pendingSpecial = null;

    onActorTurnStart();
  });
}

// =========================
// ✅ SCREEN EXPORT
// =========================
const BattleScreenObj = {
  update(mouse) {
  if (!battleInitialized) initBattle();

  // ✅ Do NOT reset hover each frame — battleMouse clears it when not over UI.
  // Keep cursor default each frame; battleMouse will set pointer when relevant.
  if (mouse && typeof mouse.setCursor === "function") mouse.setCursor("default");

  if (battleBg && typeof battleBg.tick === "function") battleBg.tick(1 / 60);

  msgBox.tick();

  // ✅ Pause overlay is modal; while open, it owns input and blocks battle flow.
  if (overlayMode === "pause") {
    ensurePauseOverlay();
    pauseOverlay.update(1 / 60, Input, mouse);
    return;
  }

  if (msgBox.isBusy()) {
    if (Input.pressed("Enter") || mouse?.clicked) {
      if (Input.pressed("Enter")) Input.consume("Enter");
      if (mouse?.clicked) try { playUIConfirmBlip(); } catch {}
      msgBox.advance();
    }
    return;
  }

  if (state.phase === "victory" || state.phase === "defeat") {
    stopBattleBgm();
  }

  // VICTORY
  if (state.phase === "victory") {
    if (Input.pressed("Enter") || mouse?.clicked) {
      if (Input.pressed("Enter")) Input.consume("Enter");
      if (mouse?.clicked) try { playUIConfirmBlip(); } catch {}

      ensureStatsState(GameState);

      const isQuickplay = state.battleRunMode === "quickplay";
      const isCampaign = state.battleIsCampaign;

      incWins(GameState, 1);
      recordWinForPartyMovies(GameState, GameState.party.movies);

      const curLevel = GameState.currentLevel || 1;
      const maxLevel = GameState.maxLevel || 15;

      const campaignCleared = isCampaign && curLevel >= maxLevel;
      if (campaignCleared) {
        setStat(GameState, "campaignCleared", true);
        completeRatatouilleTrialIfActive(GameState);
      }

      evaluateUnlockRules(GameState);

      battleInitialized = false;

      GameState.enemy = null;
      state.enemy = null;

      if (isQuickplay) {
        GameState.runMode = null;
        GameState.enemyTemplate = null;
        clearOneFourBattleApplyFlag(GameState);
        changeScreen("menu");
        return;
      }

      if (isCampaign && curLevel < maxLevel) {
        GameState.currentLevel = curLevel + 1;
        GameState.enemyTemplate = null;
        changeScreen("levelIntro");
      } else {
        GameState.enemyTemplate = null;
        clearOneFourBattleApplyFlag(GameState);
        changeScreen("menu");
      }
    }
    return;
  }

  // DEFEAT
  if (state.phase === "defeat") {
    if (Input.pressed("Enter") || mouse?.clicked) {
      if (Input.pressed("Enter")) Input.consume("Enter");
      if (mouse?.clicked) try { playUIConfirmBlip(); } catch {}

      ensureStatsState(GameState);

      const isQuickplay = GameState.runMode === "quickplay";
      if (isQuickplay) GameState.runMode = null;

      completeRatatouilleTrialIfActive(GameState);

      if (state.defeatReason !== "RUN") incLosses(GameState, 1);

      evaluateUnlockRules(GameState);

      GameState.campaign = null;
      GameState.party.movies = [null, null, null, null];
      GameState.enemyTemplate = null;
      GameState.enemy = null;
      GameState.currentLevel = 1;

      battleInitialized = false;
      state.enemy = null;

      clearOneFourBattleApplyFlag(GameState);
      changeScreen("menu");
    }
    return;
  }

  // Backspace opens PAUSE overlay ONLY when not in confirm-pending mode.
  if (
    (state.phase === "player" || state.phase === "enemy") &&
    state.uiMode === "command" &&
    Input.pressed("Backspace")
  ) {
    Input.consume("Backspace");
    openPauseOverlay();
    return;
  }

  // cancel (existing behavior) — unchanged
  if (state.phase === "player" && cancelPressed()) {
    Input.consume("Backspace");
    if (cancelUI()) return;
  }

  // player phase
  if (state.phase === "player") {
    const toggleSpecialPage = (actor) =>
      !!(
        actor &&
        toggleSpecialPageInState({
          state,
          actor,
          movieMetaMap: movieMeta,
          specialsMap: specials,
          getResolvedSpecialsForActor
        })
      );

    if (
      handleBattleMouse({
        mouse,
        state,
        SCREEN,
        BATTLE_LAYOUT,
        actions,
        itemSlotsPerPage: ITEM_SLOTS_PER_PAGE,
        battleActions,
        clampItemPagingAndSelection,
        getItemPageCount,
        getItemPageStart,
        toggleItemPageInState,
        toggleSpecialPage,
        getCurrentActor,
        cancelUI,
        openPauseOverlay,
        playUIBackBlip,
        playUIConfirmBlip,
        playUIMoveBlip,
        setHover
      })
    ) {
      return;
    }

    handleBattleKeyboardInput({
      state,
      Input,
      actions,
      battleActions,
      clampItemPagingAndSelection,
      toggleItemPageInState,
      moveItemCursorWithinCurrentPage,
      moveTargetCursor,
      getCurrentActor,
      toggleSpecialPage,
      playUIMoveBlip,
      msgBox
    });

    return;
  }

  // enemy phase
  if (state.phase === "enemy") {
    if (Input.pressed("Enter")) {
      Input.consume("Enter");
      enemyAttack();
    }
  }
},


  render(ctx) {
    // ✅ HARD RESET (prevents cumulative shrink/offset from leaked transforms)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Base clear
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SCREEN.W, SCREEN.H);

    if (!battleInitialized) initBattle();

    const width = SCREEN.W;
    const height = SCREEN.H;

    // ✅ render dynamic background ONLY in active region
    if (battleBg && typeof battleBg.render === "function") {
      battleBg.render(ctx, { x: 0, y: ACTIVE_Y });
    }

    // ✅ draw letterbox bars LAST (solid black, always)
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SCREEN.W, TOP_BAR_H);
    ctx.fillRect(0, SCREEN.H - BOTTOM_BAR_H, SCREEN.W, BOTTOM_BAR_H);

    const indicatorIndex =
      state.uiMode === "itemTarget" || state.uiMode === "specialTarget"
        ? state.targetIndex
        : state.currentActorIndex;

    renderBattleCharacterSlots(ctx, {
      state,
      BATTLE_LAYOUT,
      indicatorIndex
    });

    const uiBaseY = BATTLE_LAYOUT.command.y;

    if (state.uiMode === "command" || state.uiMode === "confirm") {
      drawCommandMenu(ctx, {
        SCREEN,
        BATTLE_LAYOUT,
        uiBaseY,
        actions,
        state,
        hover
      });

      if (state.uiMode === "command") {
        drawPauseMiniIfNeeded(ctx, {
          SCREEN,
          BATTLE_LAYOUT,
          uiBaseY,
          actions,
          itemSlotsPerPage: ITEM_SLOTS_PER_PAGE,
          state,
          hover
        });
      }

      if (state.uiMode === "confirm") {
        drawConfirmMiniButtonsIfNeeded(ctx, {
          SCREEN,
          BATTLE_LAYOUT,
          uiBaseY,
          actions,
          itemSlotsPerPage: ITEM_SLOTS_PER_PAGE,
          state,
          hover
        });
      }
    } else if (state.uiMode === "item") {
      ctx.font = "8px monospace";

      if (state.inventory.length === 0) {
        ctx.fillStyle = "#fff";
        ctx.fillText("No items!", BATTLE_LAYOUT.command.x, uiBaseY + 16);
      } else {
        clampItemPagingAndSelection();
        drawItemMenuLikeCommandRow(ctx, {
          SCREEN,
          BATTLE_LAYOUT,
          uiBaseY,
          itemSlotsPerPage: ITEM_SLOTS_PER_PAGE,
          getItemPageCount,
          getItemPageStart,
          getInventoryItemDef,
          state,
          hover,
          itemsPageIndex: state.itemsPageIndex
        });
      }
    } else if (state.uiMode === "special") {
      drawSpecialMenu(ctx, {
        SCREEN,
        BATTLE_LAYOUT,
        uiBaseY,
        itemSlotsPerPage: ITEM_SLOTS_PER_PAGE,
        state,
        hover,
        canToggleSpecialPages: (actor) => canToggleSpecialPages(actor),
        getSpecialPageCount: (movieId) => getSpecialPageCount(movieId),
        getCurrentActor
      });
    }

    msgBox.render(ctx, {
      width,
      height,
      x: BATTLE_LAYOUT.message.x,
      y: BATTLE_LAYOUT.message.y,
      boxHeight: BATTLE_LAYOUT.message.h,

      getHelpPanelText: () => {
        const base = getBattleHelpPanelText({
          phase: state.phase,
          uiMode: state.uiMode,
          actor: getCurrentActor(),
          isMessageBusy: () => msgBox.isBusy(),

          actions,
          actionIndex: state.actionIndex,
          actionDescriptions: ACTION_DESCRIPTIONS,

          confirmAction: state.confirmAction,

          inventory: state.inventory,
          itemIndex: state.itemIndex,
          itemPageCount: getItemPageCount(),
          getInventoryItemDef,

          pendingItemIndex: state.pendingItemIndex,
          targetIndex: state.targetIndex,
          party: state.party,

          specialsList: state.specialsList,
          specialIndex: state.specialIndex,
          pendingSpecial: state.pendingSpecial,

          canToggleSpecialPages: (actor) => canToggleSpecialPages(actor),
          getSpecialPageCount: (movieId) => getSpecialPageCount(movieId),
          specialsPageIndex: state.specialsPageIndex
        });

        if (state.uiMode === "item" && state.inventory.length > 0) {
          const actor = getCurrentActor();
          const entry = state.inventory[state.itemIndex];
          const def = entry ? getInventoryItemDef(entry) : null;

          const movieName =
            (actor && actor.movie && (actor.movie.shortTitle || actor.movie.title)) ||
            (actor && actor.movie && actor.movie.id) ||
            "Actor";

          const itemFullName = (def && def.name) || "Item";

          return {
            ...base,
            title: `(${movieName}): ${itemFullName}`
          };
        }

        return base;
      }
    });

    // ✅ Render pause/options overlay on top
    if (overlayMode === "pause") {
      ensurePauseOverlay();
      pauseOverlay.render(ctx);
    }
  }
};

// Named export (what your game.js expects)
export const BattleScreen = BattleScreenObj;

// Default export (extra safety / debugging)
export default BattleScreenObj;
