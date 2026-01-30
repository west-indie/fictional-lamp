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
  setSfxVolume,
  syncSfxVolumeFromSaved
} from "../sfx/uiSfx.js";

// ✅ BGM system
import {
  playBgm,
  stopBgm,
  setBgmVolume,
  syncBgmVolumeFromSaved
} from "../systems/audioSystem.js";
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

// ✅ dynamic EarthBound-ish background (active region only)
import { createBattleBackground } from "../ui/battleBackground.js";

// ✅ NEW: Pause/Options overlay (battle context hides Reset)
import { createOptionsOverlay } from "./optionsOverlay.js";
import { syncOptionsAudioNow } from "../systems/optionsAudioSync.js";
// (SFX volume imports are up top)

const actions = ["ATTACK", "DEFEND", "ITEM", "SPECIAL", "RUN"];

// ✅ Hover state (mouse-only affordance; never required for gameplay)
let hover = { kind: null, index: -1 };

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
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

function isSpacePressed() {
  return Input.pressed("Space");
}

function consumeSpace() {
  Input.consume("Space");
}

// ===== PAGE DOTS =====
function drawPageDots(ctx, { xCenter, y, pageIndex, pageCount, dotRadius = 2, gap = 7 }) {
  if (pageCount <= 1) return;

  const totalWidth = (pageCount - 1) * gap;
  const startX = xCenter - totalWidth / 2;

  for (let i = 0; i < pageCount; i++) {
    const cx = startX + i * gap;

    if (i === pageIndex) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx, y, dotRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// ======================================================
// ✅ COMMAND ROW LAYOUT (fills entire X axis)
// ✅ OLD ASPECT RATIO PRESERVED (55x25 => 11:5)
// ======================================================
const COMMAND_ASPECT_W = 11;
const COMMAND_ASPECT_H = 5;

const ROW_GAP = 5;

function getRowMetrics(slotCount) {
  const padX = BATTLE_LAYOUT.command.x; // treat as left+right padding
  const usableW = SCREEN.W - padX * 2;
  const gaps = ROW_GAP * (slotCount - 1);

  const buttonW = Math.floor((usableW - gaps) / slotCount);
  const buttonH = clamp(Math.round(buttonW * (COMMAND_ASPECT_H / COMMAND_ASPECT_W)), 20, 26);

  return { padX, usableW, buttonW, buttonH };
}

function getRowButtonX(slotIndex, buttonW) {
  const padX = BATTLE_LAYOUT.command.x;
  return padX + slotIndex * (buttonW + ROW_GAP);
}

// ======================================================
// ✅ TOP MINI BUTTONS (ITEM, SPECIAL, CONFIRM ONLY)
// FIX: Mini button SIZE is CANONICAL across ALL menus.
// - We compute miniW/miniH from the 5-slot row (same as ITEM row).
// - Then we position them relative to whichever row is being drawn.
//
// ✅ NEW: In normal command mode, we draw ONLY the left mini button
//        and label it "Pause" (same size/position as confirm mode's Back).
//        In confirm mode, it remains "Back" + "Confirm" as before.
// ======================================================
const MINI_GAP_Y = 4;
const MINI_H_MIN = 14;
const MINI_H_MAX = 18;

// Canonical sizing base: 5-slot row (same as items + command buttons)
function getCanonicalMiniMetrics() {
  const { buttonW, buttonH } = getRowMetrics(ITEM_SLOTS_PER_PAGE);
  const miniW = Math.floor(buttonW / 2);
  const miniH = clamp(Math.round(buttonH * 0.65), MINI_H_MIN, MINI_H_MAX);
  return { miniW, miniH };
}

function getTopMiniRects({ uiBaseY, slotCount, buttonW }) {
  const { miniW, miniH } = getCanonicalMiniMetrics();

  const firstX = getRowButtonX(0, buttonW);
  const lastX = getRowButtonX(slotCount - 1, buttonW);

  const y = uiBaseY - miniH - MINI_GAP_Y;

  const backRect = { x: firstX, y, w: miniW, h: miniH };

  // right edge aligned to last button's right edge
  const rightX = lastX + buttonW - miniW;
  const rightRect = { x: rightX, y, w: miniW, h: miniH };

  return { backRect, rightRect };
}

function drawMiniButton(ctx, rect, label, isHot = false) {
  const { x, y, w, h } = rect;

  ctx.fillStyle = "#000";
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = isHot ? "#ff0" : "#fff";
  ctx.strokeRect(x, y, w, h);

  ctx.font = "7px monospace";
  ctx.fillStyle = isHot ? "#ff0" : "#fff";

  const tx = x + 4;
  const ty = y + Math.floor(h * 0.68);
  ctx.fillText(label, tx, ty);
}

function drawTopMiniButtons(ctx, { uiBaseY, slotCount, buttonW, rightLabel, hotBack = false, hotRight = false }) {
  const { backRect, rightRect } = getTopMiniRects({ uiBaseY, slotCount, buttonW });

  drawMiniButton(ctx, backRect, "Back", hotBack);
  drawMiniButton(ctx, rightRect, rightLabel, hotRight);

  return { backRect, rightRect };
}

function drawDotsAboveRightMini(ctx, rightRect, { pageIndex, pageCount }) {
  if (pageCount <= 1) return;

  const xCenter = rightRect.x + Math.floor(rightRect.w * 0.75); // biased right
  const y = rightRect.y - 6;

  drawPageDots(ctx, { xCenter, y, pageIndex, pageCount });
}

// ✅ NEW: command-mode pause mini (left mini only)
function drawPauseMiniIfNeeded(ctx, uiBaseY, slotCount, buttonW) {
  if (state.uiMode !== "command") return;

  // In your current flow, we only want it during player/enemy phases (not victory/defeat screens)
  if (state.phase !== "player" && state.phase !== "enemy") return;

  const { backRect } = getTopMiniRects({ uiBaseY, slotCount, buttonW });
  const hot = hover?.kind === "pause";
  drawMiniButton(ctx, backRect, "Pause", hot);
}

// ======================================================

function drawTwoLineButtonTextAdaptive(ctx, line1, line2, x, y, w, h) {
  const pad = 4;

  const l1 = (line1 || "").trim();
  const l2 = (line2 || "").trim();

  if (l2) {
    const y1 = y + Math.floor(h * 0.45);
    const y2 = y + Math.floor(h * 0.8);

    ctx.fillText(l1, x + pad, y1);
    ctx.fillText(l2, x + pad, y2);
  } else {
    const y1 = y + Math.floor(h * 0.65);
    ctx.fillText(l1, x + pad, y1);
  }
}

function wrapToTwoLines(ctx, text, maxWidth) {
  const t = (text || "").trim();
  if (!t) return ["", ""];

  if (ctx.measureText(t).width <= maxWidth) return [t, ""];

  const words = t.split(/\s+/);
  if (words.length === 1) {
    for (let i = 1; i < t.length; i++) {
      const a = t.slice(0, i);
      if (ctx.measureText(a).width > maxWidth) {
        const a2 = t.slice(0, Math.max(1, i - 1));
        const b2 = t.slice(Math.max(1, i - 1));
        return [a2, b2];
      }
    }
    return [t.slice(0, Math.floor(t.length / 2)), t.slice(Math.floor(t.length / 2))];
  }

  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const wa = ctx.measureText(a).width;
    const wb = ctx.measureText(b).width;
    if (wa <= maxWidth && wb <= maxWidth) {
      const score = Math.abs(wa - wb);
      if (!best || score < best.score) best = { a, b, score };
    }
  }

  if (best) return [best.a, best.b];

  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
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
      // ✅ This is correct: changes the master BGM gain immediately.
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

// ===== RENDER HELPERS =====
function drawCommandMenu(ctx, uiBaseY) {
  const confirming = state.uiMode === "confirm" && !!state.confirmAction;
  const { buttonW, buttonH } = getRowMetrics(actions.length);

  actions.forEach((a, i) => {
    const bx = getRowButtonX(i, buttonW);
    const by = uiBaseY;

    const isCursor = i === state.actionIndex && state.phase === "player";
    const isLocked = confirming && a === state.confirmAction;
    const isDisabled = confirming && a !== state.confirmAction;

    if (isLocked) {
      ctx.fillStyle = "#444";
      ctx.fillRect(bx, by, buttonW, buttonH);
      ctx.strokeStyle = "#ff0";
    } else if (isDisabled) {
      ctx.fillStyle = "#111";
      ctx.fillRect(bx, by, buttonW, buttonH);
      ctx.strokeStyle = "#555";
    } else if (isCursor) {
      ctx.fillStyle = "#444";
      ctx.fillRect(bx, by, buttonW, buttonH);
      ctx.strokeStyle = "#ff0";
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(bx, by, buttonW, buttonH);
      const isHover = hover?.kind === "action" && hover?.index === i;
      ctx.strokeStyle = isHover ? "#ff0" : "#fff";
    }

    ctx.strokeRect(bx, by, buttonW, buttonH);

    ctx.font = "9px monospace";
    ctx.fillStyle = isDisabled ? "#777" : "#fff";
    ctx.fillText(a, bx + 4, by + Math.floor(buttonH * 0.65));
  });
}

function drawConfirmMiniButtonsIfNeeded(ctx, uiBaseY, slotCount, buttonW) {
  // Only show in confirm UI for ATTACK / DEFEND / RUN
  if (state.uiMode !== "confirm") return;

  const a = state.confirmAction;
  if (a !== "ATTACK" && a !== "DEFEND" && a !== "RUN") return;

  drawTopMiniButtons(ctx, {
    uiBaseY,
    slotCount,
    buttonW,
    rightLabel: "Confirm",
    hotBack: hover?.kind === "miniBack",
    hotRight: hover?.kind === "miniRight"
  });
}

function drawItemMenuLikeCommandRow(ctx, uiBaseY) {
  const pageCount = getItemPageCount();
  const pageStart = getItemPageStart(state.itemsPageIndex);

  const { buttonW, buttonH } = getRowMetrics(ITEM_SLOTS_PER_PAGE);

  // minis (canonical size)
  const { rightRect } = drawTopMiniButtons(ctx, {
    uiBaseY,
    slotCount: ITEM_SLOTS_PER_PAGE,
    buttonW,
    rightLabel: "Toggle",
    hotBack: hover?.kind === "miniBack",
    hotRight: hover?.kind === "miniRight"
  });

  // dots above right mini
  if (pageCount > 1) {
    drawDotsAboveRightMini(ctx, rightRect, {
      pageIndex: state.itemsPageIndex,
      pageCount
    });
  }

  for (let slot = 0; slot < ITEM_SLOTS_PER_PAGE; slot++) {
    const bx = getRowButtonX(slot, buttonW);
    const by = uiBaseY;

    const idx = pageStart + slot;
    const hasItem = idx < state.inventory.length;
    const isSelected = hasItem && idx === state.itemIndex && state.phase === "player";

    if (isSelected) {
      ctx.fillStyle = "#444";
      ctx.fillRect(bx, by, buttonW, buttonH);
      ctx.strokeStyle = "#ff0";
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(bx, by, buttonW, buttonH);
      const isHover = hover?.kind === "itemSlot" && hover?.index === slot;
      if (isHover && hasItem) ctx.strokeStyle = "#ff0";
      else ctx.strokeStyle = hasItem ? "#fff" : "#555";
    }

    ctx.strokeRect(bx, by, buttonW, buttonH);

    if (!hasItem) continue;

    const entry = state.inventory[idx];
    const def = getInventoryItemDef(entry);

    const label = def ? def.shortTitle || def.name : "Unknown";
    const line1 = (label || "Item").slice(0, 14);
    const line2 = `x${entry.count}`;

    ctx.font = "8px monospace";
    ctx.fillStyle = "#fff";
    drawTwoLineButtonTextAdaptive(ctx, line1, line2, bx, by, buttonW, buttonH);
  }
}

// =========================
// ✅ SCREEN EXPORT
// =========================
const BattleScreenObj = {
  update(mouse) {
    if (!battleInitialized) initBattle();

    // Reset hover each frame; screens will set cursor when relevant
    hover = { kind: null, index: -1 };
    if (mouse && typeof mouse.setCursor === "function") mouse.setCursor("default");

    if (battleBg && typeof battleBg.tick === "function") battleBg.tick(1 / 60);

    msgBox.tick();

    // ✅ NEW: Pause overlay is modal; while open, it owns input and blocks battle flow.
    if (overlayMode === "pause") {
      ensurePauseOverlay();
      // ✅ Mouse support for pause/options overlay
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

    // ✅ NEW: Backspace opens PAUSE overlay ONLY when not in confirm-pending mode.
    // - In confirm-pending mode: Backspace remains "cancel/back" as before.
    // - In other UI modes: Backspace remains "cancel/back" as before.
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
      // ✅ Mouse support (hover + click) for existing buttons/menus
      if (mouse && (mouse.moved || mouse.pressed || mouse.released || mouse.clicked || mouse.down)) {
        const uiBaseY = BATTLE_LAYOUT.command.y;

        // --- confirm mode minis + command-row behavior ---
        if (state.uiMode === "confirm") {
          let hitAnyConfirmUi = false;
          const a = state.confirmAction;

          // Minis (back/confirm) only exist for simple confirms
          if (a === "ATTACK" || a === "DEFEND" || a === "RUN") {
            const { buttonW } = getRowMetrics(actions.length);
            const { backRect, rightRect } = getTopMiniRects({ uiBaseY, slotCount: actions.length, buttonW });

            if (pointInRect(mouse.x, mouse.y, backRect)) {
              hitAnyConfirmUi = true;
              hover = { kind: "miniBack", index: -1 };
              mouse.setCursor("pointer");
              if (mouse.clicked) {
                try { playUIBackBlip(); } catch {}
                cancelUI();
                return;
              }
            } else if (pointInRect(mouse.x, mouse.y, rightRect)) {
              hitAnyConfirmUi = true;
              hover = { kind: "miniRight", index: -1 };
              mouse.setCursor("pointer");
              if (mouse.clicked) {
                try { playUIConfirmBlip(); } catch {}
                const act = state.confirmAction;
                state.confirmAction = null;
                state.uiMode = "command";
                if (act) battleActions.runConfirmedAction(act);
                return;
              }
            }
          }

          // ✅ Clicking on command buttons while confirm-pending:
          // - Click SAME command again => execute
          // - Click DIFFERENT command => cancel confirm mode and return to normal command UI
          const { buttonW, buttonH } = getRowMetrics(actions.length);
          for (let i = 0; i < actions.length; i++) {
            const bx = getRowButtonX(i, buttonW);
            const r = { x: bx, y: uiBaseY, w: buttonW, h: buttonH };
            if (pointInRect(mouse.x, mouse.y, r)) {
              hitAnyConfirmUi = true;
              hover = { kind: "action", index: i };
              mouse.setCursor("pointer");
              state.actionIndex = i;
              if (mouse.clicked) {
                const clickedAct = actions[i];
                if (clickedAct === state.confirmAction) {
                  try { playUIConfirmBlip(); } catch {}
                  const act = state.confirmAction;
                  state.confirmAction = null;
                  state.uiMode = "command";
                  if (act) battleActions.runConfirmedAction(act);
                  return;
                }
                // Different command: cancel confirm mode (Back behavior)
                try { playUIBackBlip(); } catch {}
                state.confirmAction = null;
                state.uiMode = "command";
                return;
              }
              break;
            }
          }

          // Clicked elsewhere: cancel confirm mode
          if (mouse.clicked && !hitAnyConfirmUi) {
            try { playUIBackBlip(); } catch {}
            state.confirmAction = null;
            state.uiMode = "command";
            return;
          }
        }

        // --- command mode: pause mini + action buttons ---
        if (state.uiMode === "command") {
          const { buttonW, buttonH } = getRowMetrics(actions.length);
          const { backRect } = getTopMiniRects({ uiBaseY, slotCount: actions.length, buttonW });

          // Pause mini (left)
          if ((state.phase === "player" || state.phase === "enemy") && pointInRect(mouse.x, mouse.y, backRect)) {
            hover = { kind: "pause", index: -1 };
            mouse.setCursor("pointer");
            if (mouse.clicked) {
              openPauseOverlay();
              return;
            }
          }

          // Action row
          for (let i = 0; i < actions.length; i++) {
            const bx = getRowButtonX(i, buttonW);
            const r = { x: bx, y: uiBaseY, w: buttonW, h: buttonH };
            if (pointInRect(mouse.x, mouse.y, r)) {
              hover = { kind: "action", index: i };
              mouse.setCursor("pointer");
              // ✅ Unify selection: hover becomes the real selection.
              state.actionIndex = i;
              if (mouse.clicked) {
                battleActions.handlePlayerActionFromCommand();
                if (state.uiMode === "item") clampItemPagingAndSelection();
                return;
              }
              break;
            }
          }
        }

        // --- item mode: minis + slots ---
        if (state.uiMode === "item") {
          if (state.inventory && state.inventory.length > 0) {
            clampItemPagingAndSelection();
            const pageCount = getItemPageCount();
            const pageStart = getItemPageStart(state.itemsPageIndex);
            const { buttonW, buttonH } = getRowMetrics(ITEM_SLOTS_PER_PAGE);
            const { backRect, rightRect } = getTopMiniRects({ uiBaseY, slotCount: ITEM_SLOTS_PER_PAGE, buttonW });

            if (pointInRect(mouse.x, mouse.y, backRect)) {
              hover = { kind: "miniBack", index: -1 };
              mouse.setCursor("pointer");
              if (mouse.clicked) {
                cancelUI();
                return;
              }
            } else if (pointInRect(mouse.x, mouse.y, rightRect)) {
              hover = { kind: "miniRight", index: -1 };
              mouse.setCursor("pointer");
              if (mouse.clicked) {
                // Toggle page
                toggleItemPageInState();
                if (pageCount > 1 && typeof playUIMoveBlip === "function") playUIMoveBlip();
                return;
              }
            }

            for (let slot = 0; slot < ITEM_SLOTS_PER_PAGE; slot++) {
              const bx = getRowButtonX(slot, buttonW);
              const r = { x: bx, y: uiBaseY, w: buttonW, h: buttonH };
              const idx = pageStart + slot;
              const hasItem = idx < state.inventory.length;
              if (hasItem && pointInRect(mouse.x, mouse.y, r)) {
                hover = { kind: "itemSlot", index: slot };
                mouse.setCursor("pointer");
                // ✅ Hover becomes selection so keyboard starts here.
                state.itemIndex = idx;
                if (mouse.clicked) {
                  battleActions.confirmUseSelectedItem();
                  return;
                }
                break;
              }
            }
          }
        }

        // --- special mode: minis + slots ---
        if (state.uiMode === "special") {
          if (state.specialsList && state.specialsList.length > 0) {
            const count = state.specialsList.length;
            const { buttonW, buttonH } = getRowMetrics(count);
            const { backRect, rightRect } = getTopMiniRects({ uiBaseY, slotCount: count, buttonW });

            if (pointInRect(mouse.x, mouse.y, backRect)) {
              hover = { kind: "miniBack", index: -1 };
              mouse.setCursor("pointer");
              if (mouse.clicked) {
                cancelUI();
                return;
              }
            } else if (pointInRect(mouse.x, mouse.y, rightRect)) {
              hover = { kind: "miniRight", index: -1 };
              mouse.setCursor("pointer");
              if (mouse.clicked) {
                const actor = getCurrentActor();
                const toggled =
                  actor &&
                  toggleSpecialPageInState({
                    state,
                    actor,
                    movieMetaMap: movieMeta,
                    specialsMap: specials,
                    getResolvedSpecialsForActor
                  });
                if (toggled && typeof playUIMoveBlip === "function") playUIMoveBlip();
                return;
              }
            }

            for (let i = 0; i < count; i++) {
              const bx = getRowButtonX(i, buttonW);
              const r = { x: bx, y: uiBaseY, w: buttonW, h: buttonH };
              const sp = state.specialsList[i];
              const ready = !!sp?.ready;
              if (ready && pointInRect(mouse.x, mouse.y, r)) {
                hover = { kind: "specialSlot", index: i };
                mouse.setCursor("pointer");
                // ✅ Hover becomes selection so keyboard starts here.
                state.specialIndex = i;
                if (mouse.clicked) {
                  battleActions.confirmUseSelectedSpecial();
                  return;
                }
                break;
              }
            }
          }
        }

        // --- target modes: choose an ally ---
        if (state.uiMode === "itemTarget" || state.uiMode === "specialTarget") {
          let hitTarget = false;
          // Party slot hit regions (approximate: whole top slot width)
          for (let i = 0; i < state.party.length; i++) {
            const m = state.party[i];
            if (!m) continue;
            // Keep parity with keyboard cursor: only allow living allies.
            if (m.hp <= 0) continue;

            const r = {
              x: BATTLE_LAYOUT.party.x + i * BATTLE_LAYOUT.party.dx,
              y: BATTLE_LAYOUT.party.y - 6,
              w: BATTLE_LAYOUT.party.dx - 4,
              h: 76
            };
            if (pointInRect(mouse.x, mouse.y, r)) {
              hitTarget = true;
              hover = { kind: "target", index: i };
              mouse.setCursor("pointer");
              // ✅ Hover becomes selection so keyboard starts here.
              state.targetIndex = i;
              if (mouse.clicked) {
                if (state.uiMode === "itemTarget") {
                  battleActions.confirmUseItemOnTarget();
                } else {
                  battleActions.confirmUseSpecialOnTarget();
                }
                return;
              }
              break;
            }
          }

          // ✅ Requested behavior: when using an item on a target, clicking anywhere *not* on a target acts as Back.
          if (state.uiMode === "itemTarget" && mouse.clicked && !hitTarget) {
            try { playUIBackBlip(); } catch {}
            cancelUI();
            return;
          }
        }
      }

      if (state.uiMode === "confirm") {
        if (Input.pressed("Enter")) {
          Input.consume("Enter");
          const a = state.confirmAction;
          state.confirmAction = null;
          state.uiMode = "command";
          if (a) battleActions.runConfirmedAction(a);
        }
        return;
      }

      if (state.uiMode === "command") {
        if (Input.pressed("ArrowLeft")) {
          Input.consume("ArrowLeft");
          state.actionIndex = (state.actionIndex - 1 + actions.length) % actions.length;
        }
        if (Input.pressed("ArrowRight")) {
          Input.consume("ArrowRight");
          state.actionIndex = (state.actionIndex + 1) % actions.length;
        }
        if (Input.pressed("Enter")) {
          Input.consume("Enter");
          battleActions.handlePlayerActionFromCommand();
          if (state.uiMode === "item") clampItemPagingAndSelection();
        }
      } else if (state.uiMode === "item") {
        if (state.inventory.length > 0) {
          clampItemPagingAndSelection();

          if (isSpacePressed()) {
            const changed = toggleItemPageInState();
            consumeSpace();
            if (changed && typeof playUIMoveBlip === "function") playUIMoveBlip();
          }

          if (Input.pressed("ArrowLeft")) {
            Input.consume("ArrowLeft");
            moveItemCursorWithinCurrentPage(-1);
          }
          if (Input.pressed("ArrowRight")) {
            Input.consume("ArrowRight");
            moveItemCursorWithinCurrentPage(1);
          }
          if (Input.pressed("Enter")) {
            Input.consume("Enter");
            battleActions.confirmUseSelectedItem();
          }
        } else {
          state.uiMode = "command";
          msgBox.queue(["You have no items!"], () => {
            state.actionIndex = 0;
          });
        }
      } else if (state.uiMode === "itemTarget") {
        if (Input.pressed("ArrowLeft")) {
          Input.consume("ArrowLeft");
          moveTargetCursor(-1);
        }
        if (Input.pressed("ArrowRight")) {
          Input.consume("ArrowRight");
          moveTargetCursor(1);
        }
        if (Input.pressed("Enter")) {
          Input.consume("Enter");
          battleActions.confirmUseItemOnTarget();
        }
      } else if (state.uiMode === "special") {
        const actor = getCurrentActor();

        if (isSpacePressed()) {
          const toggled =
            actor &&
            toggleSpecialPageInState({
              state,
              actor,
              movieMetaMap: movieMeta,
              specialsMap: specials,
              getResolvedSpecialsForActor
            });

          consumeSpace();
          if (toggled && typeof playUIMoveBlip === "function") playUIMoveBlip();
        }

        if (state.specialsList.length > 0) {
          if (Input.pressed("ArrowLeft")) {
            Input.consume("ArrowLeft");
            state.specialIndex =
              (state.specialIndex - 1 + state.specialsList.length) % state.specialsList.length;
          }
          if (Input.pressed("ArrowRight")) {
            Input.consume("ArrowRight");
            state.specialIndex = (state.specialIndex + 1) % state.specialsList.length;
          }
          if (Input.pressed("Enter")) {
            Input.consume("Enter");
            battleActions.confirmUseSelectedSpecial();
          }
        } else {
          state.uiMode = "command";
        }
      } else if (state.uiMode === "specialTarget") {
        if (Input.pressed("ArrowLeft")) {
          Input.consume("ArrowLeft");
          moveTargetCursor(-1);
        }
        if (Input.pressed("ArrowRight")) {
          Input.consume("ArrowRight");
          moveTargetCursor(1);
        }
        if (Input.pressed("Enter")) {
          Input.consume("Enter");
          battleActions.confirmUseSpecialOnTarget();
        }
      }

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
      drawCommandMenu(ctx, uiBaseY);

      // ✅ NEW: In normal command mode, show PAUSE mini (left position).
      // In confirm mode, show Back/Confirm minis as before.
      if (state.uiMode === "command") {
        const { buttonW } = getRowMetrics(actions.length);
        drawPauseMiniIfNeeded(ctx, uiBaseY, actions.length, buttonW);
      }

      if (state.uiMode === "confirm") {
        const { buttonW } = getRowMetrics(actions.length);
        drawConfirmMiniButtonsIfNeeded(ctx, uiBaseY, actions.length, buttonW);
      }
    } else if (state.uiMode === "item") {
      ctx.font = "8px monospace";

      if (state.inventory.length === 0) {
        ctx.fillStyle = "#fff";
        ctx.fillText("No items!", BATTLE_LAYOUT.command.x, uiBaseY + 16);
      } else {
        clampItemPagingAndSelection();
        drawItemMenuLikeCommandRow(ctx, uiBaseY);
      }
    } else if (state.uiMode === "special") {
      ctx.font = "8px monospace";

      if (!state.specialsList || state.specialsList.length === 0) {
        ctx.fillStyle = "#fff";
        ctx.fillText("No specials!", BATTLE_LAYOUT.command.x, uiBaseY + 22);
      } else {
        const count = state.specialsList.length;
        const { buttonW, buttonH } = getRowMetrics(count);

        // minis (canonical size, same as item)
        const { rightRect } = drawTopMiniButtons(ctx, {
          uiBaseY,
          slotCount: count,
          buttonW,
          rightLabel: "Toggle",
          hotBack: hover?.kind === "miniBack",
          hotRight: hover?.kind === "miniRight"
        });

        state.specialsList.forEach((sp, i) => {
          const bx = getRowButtonX(i, buttonW);
          const by = uiBaseY;
          const isSelected = i === state.specialIndex;

          const ready = !!sp.ready;

          if (isSelected && state.phase === "player") {
            ctx.fillStyle = ready ? "#444" : "#222";
            ctx.fillRect(bx, by, buttonW, buttonH);
            ctx.strokeStyle = "#ff0";
          } else {
            ctx.fillStyle = "#000";
            ctx.fillRect(bx, by, buttonW, buttonH);
            const isHover = hover?.kind === "specialSlot" && hover?.index === i;
            if (isHover && ready) ctx.strokeStyle = "#ff0";
            else ctx.strokeStyle = ready ? "#fff" : "#555";
          }

          ctx.strokeRect(bx, by, buttonW, buttonH);

          ctx.font = "8px monospace";
          ctx.fillStyle = ready ? "#fff" : "#777";

          const maxTextW = buttonW - 8;
          const [l1, l2] = wrapToTwoLines(ctx, sp.name || "Special", maxTextW);
          drawTwoLineButtonTextAdaptive(ctx, l1, l2, bx, by, buttonW, buttonH);
        });

        const actor = getCurrentActor();
        if (canToggleSpecialPages(actor)) {
          const pageCount = getSpecialPageCount(actor.movie.id);
          if (pageCount > 1 && state.specialsList.length > 0) {
            drawDotsAboveRightMini(ctx, rightRect, {
              pageIndex: state.specialsPageIndex,
              pageCount
            });
          }
        }
      }
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

    // ✅ NEW: Render pause/options overlay on top (styled like unlock overlay)
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