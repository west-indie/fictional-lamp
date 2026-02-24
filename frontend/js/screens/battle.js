// frontend/js/screens/battle.js

import { changeScreen } from "../game.js";
import { GameState } from "../core/GameState.js";
import { SCREEN, BATTLE_LAYOUT } from "../layout.js";
import { Input } from "../ui.js";
import { specials } from "../data/specials.js";
import { items } from "../data/items.js";
import { movieMeta } from "../data/movieMeta.js";
import { openingKits } from "../data/starterKits.js";

import { getAliveParty, getFirstAliveIndex } from "../systems/turnSystem.js";
import { computePlayerAttack } from "../systems/damageSystem.js";
import { runEnemyTurn } from "../systems/enemyTurnSystem.js";
import { applyItemToActor } from "../systems/itemSystem.js";
import {
  awardXpToParty,
  createBattleXpTracker,
  recordBattleXpEvent,
  getXpToNextLevel
} from "../systems/xpSystem.js";
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

// âœ… BGM system
import { playBgm, stopBgm, setBgmVolume } from "../systems/audioSystem.js";
// âœ… Family-based BGM picker (renamed from bgmThemes -> bgmFamilies)
import { pickFamilyBgm } from "../data/bgmFamilies.js";
import { buildEnemyIntroLines } from "../battleText/engines/buildEnemyMetaLines.js";

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

// âœ… Module B/C/D refactor (behavior-preserving)
import { handleBattleKeyboardInput } from "./battle/battleInput.js";
import { handleBattleMouse } from "./battle/battleMouse.js";
import {
  drawCommandMenu,
  drawConfirmMiniButtonsIfNeeded,
  drawPauseMiniIfNeeded,
  drawItemMenuLikeCommandRow,
  drawSpecialMenu
} from "../ui/battleMenus.js";

// âœ… dynamic EarthBound-ish background (active region only)
import { createBattleBackground } from "../ui/battleBackground.js";

// âœ… NEW: Pause/Options overlay (battle context hides Reset)
import { createOptionsOverlay } from "./optionsOverlay.js";
import { syncOptionsAudioNow } from "../systems/optionsAudioSync.js";
// (SFX volume imports are up top)

import { buildSpecialLines } from "../battleText/engines/buildSpecialLines.js";
import {
  buildPerkBlockbusterLines,
  buildPerkCultClassicLines,
  buildPerkSleeperHitLines,
  buildPerkSpecialInvalidTargetLines,
  buildPerkSpecialNoAllyTargetLines,
  buildPerkSpecialNoContextLines,
  buildPerkSpecialNoEffectLines,
  buildPerkSpecialNoTargetLines
} from "../battleText/engines/buildPerkSpecialLines.js";
import {
  buildEnemyTurnLines,
  buildEnemyActsFallbackLine,
  buildEnemyStrikesFallbackLine,
  buildPartyFallenLine,
  buildPartyFallenPromptLine
} from "../battleText/engines/buildEnemyTurnLines.js";
import { buildStatusTickLines } from "../battleText/engines/buildStatusTickLines.js";
import {
  BATTLE_ACTION_LABELS,
  buildNoItemsMenuLine,
  buildPressEnterToContinuePhaseLine
} from "../battleText/engines/corePrompts.js";
import {
  createEnterReleaseGate,
  wrapLinesWithEnterReleaseArm
} from "../systems/enterReleaseGateSystem.js";

const actions = BATTLE_ACTION_LABELS;

let mouseSelectEnabled = true;
let actionHistory = [];
let actionHistoryCounter = 0;
let devActionsScrollPx = 0;
let battleXpTracker = null;
let lastXpAwardSummary = null;
let pendingMoveXpDebug = {};
let levelUpRollMap = {};
let pendingLevelIntroGate = false;

const DEV_ACTIONS_OVERLAY = {
  x: 28,
  y: 26,
  w: 344,
  h: 248,
  pad: 10,
  headerH: 24,
  rowH: 12
};
const PERK_OVERLAY_SIZE = {
  w: 340,
  h: 290
};

const PERK_TRACKS = [
  {
    id: "blockbusterPower",
    name: "Blockbuster",
    short: "POW",
    desc: "Attack and crit growth with a damage/crit move.",
    perkLines: [
      "Attack and crit chance scale up.",
      "Crit damage scales harder.",
      "Unlocks Blockbuster Strike.",
      "Power scales with level and rank."
    ]
  },
  {
    id: "cultClassic",
    name: "Cult Classic",
    short: "CLT",
    desc: "Defense and HP growth with an ally shield move.",
    perkLines: [
      "Defense and max HP scale up.",
      "Guarding mitigates more damage.",
      "Unlocks Cult Following.",
      "Shield strength scales with level and rank."
    ]
  },
  {
    id: "sleeperHit",
    name: "Sleeper Hit",
    short: "SLP",
    desc: "Support growth with stronger healing/utility moves.",
    perkLines: [
      "Healing and utility scale up.",
      "Support actions become more efficient.",
      "Unlocks Second Wind.",
      "Heal power scales with level and rank."
    ]
  }
];

// âœ… Hover state (mouse-only affordance; never required for gameplay)
let hover = { kind: null, index: -1 };

function setHover(next) {
  const n =
    next && typeof next === "object"
      ? next
      : { kind: null, index: -1 };

  const changed = hover.kind !== n.kind || hover.index !== n.index;
  hover = n;

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
  itemCooldowns: {},
  itemIndex: 0,
  itemsPageIndex: 0,
  pendingItemIndex: -1,

  targetIndex: 0,

  specialsList: [],
  specialsPageIndex: 0,
  specialIndex: 0,
  pendingSpecial: null,

  confirmAction: null,
  confirmHoldTurnStreak: 0,
  confirmHoldOptionKey: null,
  defeatReason: null,

  hpRoll: {
    partyDisplay: [],
    partyShieldDisplay: [],
    enemyDisplay: 0
  },
  statRoll: {
    partyAtkDisplay: [],
    partyDefDisplay: [],
    partyMaxHpDisplay: []
  }
};

const QUIRKY_EXTRA_TURN_CHANCE = 0.08;
const FUNNY_DISRUPT_CHANCE = 0.05;

// âœ… DEFEND duration (in enemy phases). Easy to change.
const DEFEND_ENEMY_PHASES = 2;

// ===== Message Box =====
const msgBox = createBattleMessageBox({ playTextBlip });
const enterReleaseGate = createEnterReleaseGate({ Input, key: "Enter" });

// ======================================================
// âœ… BATTLE BGM (start at battle start, stop at victory/defeat)
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

function toHpInt(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.round(v));
}

function getRollingStep(current, target, maxHp, dt) {
  const delta = Math.abs(target - current);
  if (delta <= 0) return 0;

  // Higher cap, gentler ramp: faster max without extreme acceleration.
  const hpCap = Math.max(1, toHpInt(maxHp));
  const goingUp = target > current;
  const downPerSecondBase = Math.min(24, 1.9 + Math.pow(delta, 0.5) * 1.66 + hpCap * 0.0035);
  const downPerSecond = Math.max(3, downPerSecondBase);
  // Upward roll should feel much snappier than damage roll-down.
  const upPerSecond = Math.min(90, downPerSecond * 2.4 + 2.0);
  const unitsPerSecond = goingUp ? upPerSecond : downPerSecond;
  return Math.max(0, unitsPerSecond * dt);
}

function rollHpToward(current, target, maxHp, dt) {
  if (current === target) return target;
  const step = getRollingStep(current, target, maxHp, dt);
  const diff = target - current;
  const move = Math.min(Math.abs(diff), step) * Math.sign(diff);
  return current + move;
}

function initHpRollState() {
  state.hpRoll.partyDisplay = Array.isArray(state.party)
    ? state.party.map((m) => toHpInt(m?.hp))
    : [];
  state.hpRoll.partyShieldDisplay = Array.isArray(state.party)
    ? state.party.map((m) => toHpInt(m?.tempShield))
    : [];
  state.hpRoll.enemyDisplay = toHpInt(state.enemy?.hp);

  state.statRoll.partyAtkDisplay = Array.isArray(state.party)
    ? state.party.map((m) => Number(m?.atk || 0))
    : [];
  state.statRoll.partyDefDisplay = Array.isArray(state.party)
    ? state.party.map((m) => Number(m?.def || 0))
    : [];
  state.statRoll.partyMaxHpDisplay = Array.isArray(state.party)
    ? state.party.map((m) => Number(m?.maxHp || 0))
    : [];

  if (Array.isArray(state.party)) {
    for (const actor of state.party) {
      if (!actor) continue;
      actor.pendingDownHp = null;
      actor.enteredMortalState = false;
      actor.isDowned = Number(actor.hp || 0) <= 0;
    }
  }
}

function getRollingStatStep(current, target, dt) {
  const delta = Math.abs(target - current);
  if (delta <= 0) return 0;
  const perSec = Math.min(90, Math.max(10, 10 + Math.pow(delta, 0.7) * 6));
  return perSec * dt;
}

function rollStatToward(current, target, dt) {
  if (current === target) return target;
  const step = getRollingStatStep(current, target, dt);
  const diff = target - current;
  const move = Math.min(Math.abs(diff), step) * Math.sign(diff);
  return current + move;
}

function getLevelUpRollControlByIndex(index) {
  const actor = state.party?.[index];
  if (!actor) return null;
  const key = actor?.movie?.id || actor?.name;
  return key ? (levelUpRollMap[key] || null) : null;
}

function tickHpRoll(dt = 1 / 60) {
  if (!state.hpRoll) return;

  const party = Array.isArray(state.party) ? state.party : [];
  const display = state.hpRoll.partyDisplay || [];
  const shieldDisplay = state.hpRoll.partyShieldDisplay || [];

  for (let i = 0; i < party.length; i++) {
    const actor = party[i];
    if (!actor) continue;

    const targetShield = toHpInt(actor.tempShield);
    const curShield = Number.isFinite(shieldDisplay[i]) ? Number(shieldDisplay[i]) : targetShield;
    // Shield increases apply instantly; only depletion rolls down.
    const nextShield =
      targetShield >= curShield
        ? targetShield
        : rollHpToward(curShield, targetShield, actor.maxHp, dt);
    shieldDisplay[i] = nextShield;

    const ctl = getLevelUpRollControlByIndex(i);
    const pendingDownHp = actor.pendingDownHp;
    const hasPendingDown =
      typeof pendingDownHp === "number" &&
      Number.isFinite(pendingDownHp) &&
      pendingDownHp <= 0 &&
      Number(actor.hp || 0) > 0;
    const targetHp = hasPendingDown
      ? 0
      : (ctl && !ctl.maxHpReady ? toHpInt(ctl.hpBefore) : toHpInt(actor.hp));
    const curHp = Number.isFinite(display[i]) ? Number(display[i]) : targetHp;

    // If shield is currently draining and HP also dropped, drain shield first.
    const shieldStillDropping = nextShield > targetShield;
    const hpWouldDrop = targetHp < curHp;
    if (shieldStillDropping && hpWouldDrop) {
      display[i] = curHp;
    } else {
      display[i] = rollHpToward(curHp, targetHp, actor.maxHp, dt);
    }

    if (hasPendingDown) {
      const visualHp = toHpInt(display[i]);
      actor.hp = visualHp;
      if (visualHp <= 0) {
        actor.hp = 0;
        actor.pendingDownHp = null;
        actor.isDowned = true;
      }
    } else if (Number(actor.hp || 0) > 0) {
      actor.isDowned = false;
    }
  }

  display.length = party.length;
  shieldDisplay.length = party.length;
  state.hpRoll.partyDisplay = display;
  state.hpRoll.partyShieldDisplay = shieldDisplay;

  const enemyTargetHp = toHpInt(state.enemy?.hp);
  const enemyCurHp = Number.isFinite(state.hpRoll.enemyDisplay)
    ? Number(state.hpRoll.enemyDisplay)
    : enemyTargetHp;
  // Enemy HP damage should be instant (no roll-down).
  state.hpRoll.enemyDisplay =
    enemyTargetHp < enemyCurHp
      ? enemyTargetHp
      : rollHpToward(enemyCurHp, enemyTargetHp, state.enemy?.maxHP, dt);
}

function tickStatRoll(dt = 1 / 60) {
  const party = Array.isArray(state.party) ? state.party : [];
  const atkDisplay = state.statRoll.partyAtkDisplay || [];
  const defDisplay = state.statRoll.partyDefDisplay || [];
  const maxHpDisplay = state.statRoll.partyMaxHpDisplay || [];

  for (let i = 0; i < party.length; i++) {
    const actor = party[i];
    if (!actor) continue;

    const ctl = getLevelUpRollControlByIndex(i);
    const targetAtk = ctl && !ctl.atkDefReady ? Number(ctl.atkBefore || actor.atk || 0) : Number(actor.atk || 0);
    const targetDef = ctl && !ctl.atkDefReady ? Number(ctl.defBefore || actor.def || 0) : Number(actor.def || 0);
    const targetMaxHp = ctl && !ctl.maxHpReady ? Number(ctl.maxHpBefore || actor.maxHp || 0) : Number(actor.maxHp || 0);

    const curAtk = Number.isFinite(atkDisplay[i]) ? Number(atkDisplay[i]) : targetAtk;
    const curDef = Number.isFinite(defDisplay[i]) ? Number(defDisplay[i]) : targetDef;
    const curMaxHp = Number.isFinite(maxHpDisplay[i]) ? Number(maxHpDisplay[i]) : targetMaxHp;

    atkDisplay[i] = rollStatToward(curAtk, targetAtk, dt);
    defDisplay[i] = rollStatToward(curDef, targetDef, dt);
    maxHpDisplay[i] = rollStatToward(curMaxHp, targetMaxHp, dt);
  }

  atkDisplay.length = party.length;
  defDisplay.length = party.length;
  maxHpDisplay.length = party.length;
  state.statRoll.partyAtkDisplay = atkDisplay;
  state.statRoll.partyDefDisplay = defDisplay;
  state.statRoll.partyMaxHpDisplay = maxHpDisplay;
}

function getDisplayedPartyHp(index) {
  const actor = state.party?.[index];
  if (!actor) return 0;
  const raw = state.hpRoll?.partyDisplay?.[index];
  if (!Number.isFinite(raw)) return toHpInt(actor.hp);
  return toHpInt(raw);
}

function getDisplayedPartyMaxHp(index) {
  const actor = state.party?.[index];
  if (!actor) return 1;
  const raw = state.statRoll?.partyMaxHpDisplay?.[index];
  if (!Number.isFinite(raw)) return Math.max(1, toHpInt(actor.maxHp));
  return Math.max(1, toHpInt(raw));
}

function getDisplayedPartyAtk(index) {
  const actor = state.party?.[index];
  if (!actor) return 0;
  const raw = state.statRoll?.partyAtkDisplay?.[index];
  if (!Number.isFinite(raw)) return toHpInt(actor.atk);
  return toHpInt(raw);
}

function getDisplayedPartyDef(index) {
  const actor = state.party?.[index];
  if (!actor) return 0;
  const raw = state.statRoll?.partyDefDisplay?.[index];
  if (!Number.isFinite(raw)) return toHpInt(actor.def);
  return toHpInt(raw);
}

function getDisplayedPartyHpRaw(index) {
  const actor = state.party?.[index];
  if (!actor) return 0;
  const raw = state.hpRoll?.partyDisplay?.[index];
  if (!Number.isFinite(raw)) return Number(actor.hp || 0);
  return Number(raw);
}

function getDisplayedPartyShield(index) {
  const actor = state.party?.[index];
  if (!actor) return 0;
  const raw = state.hpRoll?.partyShieldDisplay?.[index];
  if (!Number.isFinite(raw)) return toHpInt(actor.tempShield);
  const n = Number(raw);
  if (n <= 0) return 0;
  // Keep shield visible through depletion frames so down-tint can be perceived.
  return Math.max(1, Math.ceil(n));
}

function getDisplayedPartyShieldRaw(index) {
  const actor = state.party?.[index];
  if (!actor) return 0;
  const raw = state.hpRoll?.partyShieldDisplay?.[index];
  if (!Number.isFinite(raw)) return Number(actor.tempShield || 0);
  return Number(raw);
}

function getDisplayedEnemyHp() {
  if (!state.enemy) return 0;
  const raw = state.hpRoll?.enemyDisplay;
  if (!Number.isFinite(raw)) return toHpInt(state.enemy.hp);
  return toHpInt(raw);
}

function getDisplayedEnemyHpRaw() {
  if (!state.enemy) return 0;
  const raw = state.hpRoll?.enemyDisplay;
  if (!Number.isFinite(raw)) return Number(state.enemy.hp || 0);
  return Number(raw);
}

function isPartyMemberConsciousAtIndex(index) {
  if (!Array.isArray(state.party) || index < 0 || index >= state.party.length) return false;
  const member = state.party[index];
  if (!member) return false;
  return getDisplayedPartyHp(index) > 0;
}

function getFirstConsciousPartyIndex() {
  if (!Array.isArray(state.party)) return -1;
  for (let i = 0; i < state.party.length; i++) {
    if (isPartyMemberConsciousAtIndex(i)) return i;
  }
  return -1;
}

function getConsciousParty() {
  if (!Array.isArray(state.party)) return [];
  return state.party.filter((_, i) => isPartyMemberConsciousAtIndex(i));
}

function beforeHealTarget(target) {
  if (!target) return;

  if (target === state.enemy) {
    const shown = getDisplayedEnemyHp();
    const actual = toHpInt(target.hp);
    if (shown > actual) {
      target.hp = shown;
      state.hpRoll.enemyDisplay = shown;
    }
    return;
  }

  const idx = Array.isArray(state.party) ? state.party.indexOf(target) : -1;
  if (idx < 0) return;

  const shown = getDisplayedPartyHp(idx);
  const actual = toHpInt(target.hp);
  if (shown > actual) {
    target.hp = shown;
    state.hpRoll.partyDisplay[idx] = shown;
  }
  target.pendingDownHp = null;
  target.enteredMortalState = false;
  target.isDowned = false;
}

function beforeShieldTarget(target) {
  if (!target) return;

  if (target === state.enemy) {
    const shown = getDisplayedEnemyHp();
    const actual = toHpInt(target.hp);
    if (shown > actual) {
      target.hp = shown;
      state.hpRoll.enemyDisplay = shown;
    }
    return;
  }

  const idx = Array.isArray(state.party) ? state.party.indexOf(target) : -1;
  if (idx < 0) return;

  const shown = getDisplayedPartyHp(idx);
  const actual = toHpInt(target.hp);
  if (shown > actual) {
    target.hp = shown;
    state.hpRoll.partyDisplay[idx] = shown;
  }
}

function settleMortalPartySlotsAtDisplayedHp() {
  const party = Array.isArray(state.party) ? state.party : [];
  for (let i = 0; i < party.length; i++) {
    const actor = party[i];
    if (!actor) continue;

    const actualHp = Number(actor.hp || 0);
    if (actualHp > 0) continue;

    const displayedHp = getDisplayedPartyHp(i);
    if (displayedHp <= 0) continue;

    actor.hp = Math.min(Math.max(1, displayedHp), Math.max(1, toHpInt(actor.maxHp)));
    actor.pendingDownHp = null;
    actor.isDowned = false;
    if (state.hpRoll?.partyDisplay) {
      state.hpRoll.partyDisplay[i] = actor.hp;
    }
  }
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
    def: actor.def,
    perks: actor.perks || { blockbusterPower: 0, cultClassic: 0, sleeperHit: 0 }
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
const DEFAULT_STARTING_INVENTORY = [
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

function normalizeInventoryEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const counts = new Map();
  for (const entry of entries) {
    const id = String(entry?.id || "");
    const count = Math.max(0, Math.floor(Number(entry?.count || 0)));
    if (!id || count <= 0) continue;
    if (!items[id]) continue;
    counts.set(id, (counts.get(id) || 0) + count);
  }
  return Array.from(counts.entries()).map(([id, count]) => ({ id, count }));
}

function getCampaignOpeningKitInventory() {
  const selectedId = String(GameState?.campaign?.openingKitSelectedId || "");
  if (!selectedId) return [];
  const selected = Array.isArray(openingKits)
    ? openingKits.find((k) => String(k?.id || "") === selectedId)
    : null;
  return normalizeInventoryEntries(selected?.items);
}

function initInventory() {
  const campaignInventory = state.battleIsCampaign ? getCampaignOpeningKitInventory() : [];
  state.inventory = campaignInventory.length > 0
    ? campaignInventory
    : normalizeInventoryEntries(DEFAULT_STARTING_INVENTORY);
  state.itemCooldowns = {};
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
  if (!actor || !isPartyMemberConsciousAtIndex(state.currentActorIndex)) return null;
  return actor;
}

function moveTargetCursor(delta) {
  if (state.party.length === 0) return;
  let idx = state.targetIndex;

  for (let attempts = 0; attempts < state.party.length; attempts++) {
    idx = (idx + delta + state.party.length) % state.party.length;
    if (isPartyMemberConsciousAtIndex(idx)) {
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

  // âœ… Dev override priority:
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

  // âœ… Consume template after spawning so it doesn't leak into later battles
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

  state.specialsList = [
    ...(resolveSpecialsForActorCurrentPage(actor) || []),
    ...getPerkSpecialsForActor(actor)
  ];
  if (state.specialIndex >= state.specialsList.length) state.specialIndex = 0;
  state.pendingSpecial = null;
}

function onPlayerPhaseStart() {
  if (!Array.isArray(state.party) || state.party.length === 0) return;

  tickItemCooldownsForActor();
  const phaseTickLines = [];
  for (let i = 0; i < state.party.length; i++) {
    if (!isPartyMemberConsciousAtIndex(i)) continue;
    const actor = state.party[i];
    if (!actor) continue;

    tickCooldownsForActor(actor);
    tickPerkCooldownsForActor(actor);

    const actorTickEvents = tickActorStatuses(actor);
    if (!actorTickEvents.length) continue;

    phaseTickLines.push(...buildStatusTickLines({
      events: actorTickEvents,
      actorName: actor?.movie?.title || actor?.name || "Actor",
      enemyName: state.enemy?.name || "The enemy"
    }));
  }

  if (phaseTickLines.length > 0) {
    msgBox.queue(phaseTickLines, () => {});
  }
}

// ===== âœ… Dynamic Background (active region only) =====
const TOP_BAR_H = 72;
const BOTTOM_BAR_H = SCREEN.H - BATTLE_LAYOUT.message.y;
const ACTIVE_Y = TOP_BAR_H;
const ACTIVE_H = SCREEN.H - TOP_BAR_H - BOTTOM_BAR_H;

// Allocate background ONLY for active region
const battleBg = createBattleBackground({ width: SCREEN.W, height: ACTIVE_H });

// ======================================================
// âœ… NEW: Pause/Options overlay state (battle context => no Reset)
// ======================================================
let pauseOverlay = null;
let overlayMode = "none"; // "none" | "pause" | "devActions" | "perk"
let perkChoiceQueue = [];
let perkOverlaySelection = 0;
let perkChoiceHistory = [];
let perkReadyToExit = false;

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
    },

    getBattleInfoLines: () => getBattlePauseInfoLines()
  });
}

function openPauseOverlay() {
  ensurePauseOverlay();
  overlayMode = "pause";
  pauseOverlay.open({ context: "battle" }); // âœ… hides Reset
}

function getActorDisplayName(actor) {
  return actor?.movie?.shortTitle || actor?.movie?.title || actor?.name || "Unknown";
}

function getActorTitleName(actor) {
  return actor?.movie?.title || actor?.movie?.shortTitle || actor?.name || "Unknown";
}

function getActorKey(actor) {
  return actor?.movie?.id || actor?.name || "unknown";
}

function getDevActionsListHeight() {
  const { h, pad, headerH } = DEV_ACTIONS_OVERLAY;
  return Math.max(0, h - (pad * 2) - headerH - 6);
}

function getDevActionsMaxScrollPx() {
  const contentH = actionHistory.length * DEV_ACTIONS_OVERLAY.rowH;
  return Math.max(0, contentH - getDevActionsListHeight());
}

function clampDevActionsScroll() {
  devActionsScrollPx = clamp(devActionsScrollPx, 0, getDevActionsMaxScrollPx());
}

function recordBattleAction(actor, kind, moveLabel) {
  const key = getActorKey(actor);
  const xpDebug = Number(pendingMoveXpDebug[key] || 0);
  if (key in pendingMoveXpDebug) delete pendingMoveXpDebug[key];
  const suffix = ` | XP+${xpDebug.toFixed(1)}`;

  actionHistoryCounter += 1;
  actionHistory.push({
    id: actionHistoryCounter,
    actorName: getActorDisplayName(actor),
    kind: String(kind || "ACTION"),
    moveLabel: `${String(moveLabel || "Unknown")}${suffix}`
  });
  clampDevActionsScroll();
}

function recordSystemAction(kind, moveLabel) {
  actionHistoryCounter += 1;
  actionHistory.push({
    id: actionHistoryCounter,
    actorName: "SYSTEM",
    kind: String(kind || "INFO"),
    moveLabel: String(moveLabel || "")
  });
  clampDevActionsScroll();
}

function getBattlePauseInfoLines() {
  const cards = [];
  for (let i = 0; i < 4; i++) {
    const actor = state.party?.[i] || null;
    if (!actor) {
      cards.push({
        title: `Slot ${i + 1}`,
        primaryGenre: "UNKNOWN",
        secondaryGenre: "",
        level: 1,
        xp: 0,
        nextNeed: 0,
        empty: true
      });
      continue;
    }
    const name = getActorDisplayName(actor);
    const movieId = actor?.movie?.id || null;
    const meta = (movieId && movieMeta && movieMeta[movieId]) ? movieMeta[movieId] : null;
    const primaryGenre = String(
      actor?.primaryGenre ||
      actor?.movie?.primaryGenre ||
      meta?.primaryGenre ||
      "UNKNOWN"
    ).toUpperCase();
    const secondaryGenre = String(
      actor?.secondaryGenre ||
      actor?.movie?.secondaryGenre ||
      meta?.secondaryGenre ||
      ""
    ).toUpperCase();
    const level = Math.max(1, Math.floor(Number(actor.level || 1)));
    const xp = Math.max(0, Math.floor(Number(actor.xp || 0)));
    const nextNeed = Math.max(0, getXpToNextLevel(level) - xp);
    cards.push({
      title: name,
      primaryGenre,
      secondaryGenre: secondaryGenre === primaryGenre ? "" : secondaryGenre,
      level,
      xp,
      nextNeed,
      empty: false
    });
  }
  return cards;
}

function recordXpSummaryToDevLog(summary) {
  if (!summary || !Array.isArray(summary.awards)) return;
  const pool = Number(summary.pool || 0);
  recordSystemAction("XP", `Pool ${pool}`);
  const downedAwards = summary.awards.filter((a) => !!a?.wasDowned);
  if (downedAwards.length > 0) {
    const names = downedAwards
      .map((a) => String(a?.actorName || a?.actorKey || "Actor"))
      .filter(Boolean)
      .join(", ");
    recordSystemAction("XP", `Downed XP Multiplier (x0.5): ${names}`);
  } else {
    recordSystemAction("XP", "Downed XP Multiplier (x0.5): none");
  }
  for (const award of summary.awards) {
    const name = String(award.actorName || award.actorKey || "Actor");
    const gained = Number(award.xpGained || 0);
    const lvlBefore = Number(award.levelBefore || 1);
    const lvlAfter = Number(award.levelAfter || lvlBefore);
    const m = award.metrics || {};
    recordSystemAction(
      "XP",
      `${name} +${gained}xp (L${lvlBefore}->L${lvlAfter}) D:${Number(m.damage || 0)} H:${Number(m.heal || 0)} M:${Number(m.mitigation || 0)} U:${Number(m.utility || 0)}`
    );
  }
}

function settleAllRollingDownCountersAtDisplay() {
  const party = Array.isArray(state.party) ? state.party : [];
  for (let i = 0; i < party.length; i++) {
    const actor = party[i];
    if (!actor) continue;

    const displayedHpRaw = getDisplayedPartyHpRaw(i);
    const displayedShieldRaw = getDisplayedPartyShieldRaw(i);
    const displayedAtkRaw = Number.isFinite(state.statRoll?.partyAtkDisplay?.[i]) ? Number(state.statRoll.partyAtkDisplay[i]) : Number(actor.atk || 0);
    const displayedDefRaw = Number.isFinite(state.statRoll?.partyDefDisplay?.[i]) ? Number(state.statRoll.partyDefDisplay[i]) : Number(actor.def || 0);
    const displayedMaxHpRaw = Number.isFinite(state.statRoll?.partyMaxHpDisplay?.[i]) ? Number(state.statRoll.partyMaxHpDisplay[i]) : Number(actor.maxHp || 0);

    if (displayedHpRaw > Number(actor.hp || 0)) actor.hp = toHpInt(displayedHpRaw);
    if (displayedShieldRaw > Number(actor.tempShield || 0)) actor.tempShield = toHpInt(displayedShieldRaw);
    if (displayedAtkRaw > Number(actor.atk || 0)) actor.atk = toHpInt(displayedAtkRaw);
    if (displayedDefRaw > Number(actor.def || 0)) actor.def = toHpInt(displayedDefRaw);
    if (displayedMaxHpRaw > Number(actor.maxHp || 0)) actor.maxHp = Math.max(1, toHpInt(displayedMaxHpRaw));

    // Stop any pending forced roll-down once the enemy-down line is shown.
    actor.pendingDownHp = null;
    if (Number(actor.hp || 0) > 0) actor.isDowned = false;
  }

  if (state.enemy) {
    const displayedEnemyHpRaw = getDisplayedEnemyHpRaw();
    if (displayedEnemyHpRaw > Number(state.enemy.hp || 0)) {
      state.enemy.hp = toHpInt(displayedEnemyHpRaw);
    }
  }
}

function prepareLevelUpRoll(summary) {
  levelUpRollMap = {};
  const awards = Array.isArray(summary?.awards) ? summary.awards : [];
  for (const award of awards) {
    const actorKey = String(award?.actorKey || "");
    if (!actorKey) continue;
    if (Number(award?.levelAfter || 0) <= Number(award?.levelBefore || 0)) continue;
    levelUpRollMap[actorKey] = {
      atkBefore: Number(award?.atkBefore || 0),
      defBefore: Number(award?.defBefore || 0),
      maxHpBefore: Number(award?.maxHpBefore || 0),
      hpBefore: Number(award?.hpBefore || 0),
      atkDefReady: false,
      maxHpReady: false
    };
  }

  for (let i = 0; i < (state.party || []).length; i++) {
    const actor = state.party[i];
    if (!actor) continue;
    const key = actor?.movie?.id || actor?.name;
    const ctl = key ? levelUpRollMap[key] : null;
    if (!ctl) continue;
    if (state.statRoll.partyAtkDisplay) state.statRoll.partyAtkDisplay[i] = Number(ctl.atkBefore || actor.atk || 0);
    if (state.statRoll.partyDefDisplay) state.statRoll.partyDefDisplay[i] = Number(ctl.defBefore || actor.def || 0);
    if (state.statRoll.partyMaxHpDisplay) state.statRoll.partyMaxHpDisplay[i] = Number(ctl.maxHpBefore || actor.maxHp || 0);
    if (state.hpRoll.partyDisplay) state.hpRoll.partyDisplay[i] = Number(ctl.hpBefore || actor.hp || 0);
  }
}

function triggerLevelUpRoll(actorKey, phase) {
  const key = String(actorKey || "");
  if (!key || !levelUpRollMap[key]) return;
  if (phase === "atkDef") levelUpRollMap[key].atkDefReady = true;
  if (phase === "maxHp") levelUpRollMap[key].maxHpReady = true;
}

function ensureActorPerkState(actor) {
  if (!actor) return;
  if (!actor.perks || typeof actor.perks !== "object") {
    actor.perks = { blockbusterPower: 0, cultClassic: 0, sleeperHit: 0 };
  }
  if (!actor.perkCooldowns || typeof actor.perkCooldowns !== "object") {
    actor.perkCooldowns = {};
  }
  if (typeof actor.critDamageBonus !== "number") actor.critDamageBonus = 0;
  if (typeof actor.defendDamageMult !== "number") actor.defendDamageMult = 0.5;
  if (typeof actor.healPower !== "number") actor.healPower = 1;
  if (typeof actor.utilityPower !== "number") actor.utilityPower = 1;
  if (typeof actor.supportEfficiency !== "number") actor.supportEfficiency = 0;
}

function enqueuePerkChoicesFromSummary(summary) {
  if (!summary || !Array.isArray(summary.awards)) return;
  for (const award of summary.awards) {
    const count = Math.max(0, Math.floor(Number(award?.perkChoices || 0)));
    if (count <= 0) continue;
    for (let i = 0; i < count; i++) {
      perkChoiceQueue.push({ actorKey: String(award.actorKey || ""), actorName: String(award.actorName || "Actor") });
    }
  }
}

function getActorByKey(key) {
  return (state.party || []).find((a) => (a?.movie?.id || a?.name) === key) || null;
}

function openPerkOverlay() {
  if (!perkChoiceQueue.length) return false;
  overlayMode = "perk";
  perkOverlaySelection = 0;
  if (!perkChoiceHistory.length) perkReadyToExit = false;
  return true;
}

function closePerkOverlay() {
  overlayMode = "none";
  perkOverlaySelection = 0;
  perkChoiceHistory = [];
  perkReadyToExit = false;
}

function snapshotActorPerkState(actor) {
  return {
    atk: Number(actor.atk || 0),
    def: Number(actor.def || 0),
    hp: Number(actor.hp || 0),
    maxHp: Number(actor.maxHp || 0),
    critChance: Number(actor.critChance || 0),
    critDamageBonus: Number(actor.critDamageBonus || 0),
    defendDamageMult: Number(actor.defendDamageMult || 0.5),
    healPower: Number(actor.healPower || 1),
    utilityPower: Number(actor.utilityPower || 1),
    supportEfficiency: Number(actor.supportEfficiency || 0),
    perks: {
      blockbusterPower: Number(actor?.perks?.blockbusterPower || 0),
      cultClassic: Number(actor?.perks?.cultClassic || 0),
      sleeperHit: Number(actor?.perks?.sleeperHit || 0)
    }
  };
}

function restoreActorPerkState(actor, snapshot) {
  if (!actor || !snapshot) return;
  actor.atk = snapshot.atk;
  actor.def = snapshot.def;
  actor.hp = snapshot.hp;
  actor.maxHp = snapshot.maxHp;
  actor.critChance = snapshot.critChance;
  actor.critDamageBonus = snapshot.critDamageBonus;
  actor.defendDamageMult = snapshot.defendDamageMult;
  actor.healPower = snapshot.healPower;
  actor.utilityPower = snapshot.utilityPower;
  actor.supportEfficiency = snapshot.supportEfficiency;
  actor.perks = {
    blockbusterPower: snapshot.perks.blockbusterPower,
    cultClassic: snapshot.perks.cultClassic,
    sleeperHit: snapshot.perks.sleeperHit
  };
}

function continueVictoryFlow() {
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
    GameState.party.progress = {};
    GameState.enemyTemplate = null;
    clearOneFourBattleApplyFlag(GameState);
    changeScreen("menu");
    return;
  }

  if (isCampaign && curLevel < maxLevel) {
    GameState.currentLevel = curLevel + 1;
    GameState.enemyTemplate = null;
    pendingLevelIntroGate = false;
    clearOneFourBattleApplyFlag(GameState);
    changeScreen("levelIntro");
  } else {
    GameState.party.progress = {};
    GameState.enemyTemplate = null;
    clearOneFourBattleApplyFlag(GameState);
    changeScreen("menu");
  }
}

function applyPerkChoice(actor, trackId) {
  if (!actor || !trackId) return;
  ensureActorPerkState(actor);
  const cur = Math.max(0, Math.floor(Number(actor.perks[trackId] || 0)));
  const next = Math.min(4, cur + 1);
  if (next === cur) return;

  actor.perks[trackId] = next;

  if (trackId === "blockbusterPower") {
    actor.atk = Math.max(1, Math.round(actor.atk * 1.04));
    actor.critChance = Math.min(0.8, Math.max(0, Number(actor.critChance || 0) + 0.015));
    actor.critDamageBonus = Math.max(0, Number(actor.critDamageBonus || 0) + 0.08);
  } else if (trackId === "cultClassic") {
    actor.maxHp = Math.max(1, Math.round(actor.maxHp * 1.05));
    actor.hp = Math.min(actor.maxHp, Math.max(0, Number(actor.hp || 0)) + Math.round(actor.maxHp * 0.05));
    actor.def = Math.max(1, Math.round(actor.def * 1.04));
    actor.defendDamageMult = Math.max(0.32, Number(actor.defendDamageMult || 0.5) - 0.03);
  } else if (trackId === "sleeperHit") {
    actor.healPower = (Number(actor.healPower || 1) + 0.08);
    actor.utilityPower = (Number(actor.utilityPower || 1) + 0.06);
    actor.supportEfficiency = Math.max(0, Number(actor.supportEfficiency || 0) + 1);
  }
}

function tickPerkCooldownsForActor(actor) {
  if (!actor || !actor.perkCooldowns) return;
  for (const k of Object.keys(actor.perkCooldowns)) {
    actor.perkCooldowns[k] = Math.max(0, Math.floor(Number(actor.perkCooldowns[k] || 0) - 1));
  }
}

function tickItemCooldownsForActor() {
  if (!state.itemCooldowns || typeof state.itemCooldowns !== "object") return;
  for (const k of Object.keys(state.itemCooldowns)) {
    state.itemCooldowns[k] = Math.max(0, Math.floor(Number(state.itemCooldowns[k] || 0) - 1));
  }
}

function getPerkSpecialsForActor(actor) {
  if (!actor) return [];
  ensureActorPerkState(actor);
  const perks = actor.perks || {};
  const out = [];

  if (Number(perks.blockbusterPower || 0) > 0) {
    const key = "perk:blockbusterPower:strike";
    const cd = Math.max(0, Math.floor(Number(actor.perkCooldowns?.[key] || 0)));
    out.push({
      source: "perk",
      key,
      id: "perk_blockbuster_strike",
      name: "Blockbuster Strike",
      description: "Heavy single-target hit with extra crit scaling.",
      target: "enemy",
      perkTrack: "blockbusterPower",
      rank: Number(perks.blockbusterPower || 1),
      cooldownTurns: 3,
      cooldownRemaining: cd,
      ready: cd <= 0
    });
  }

  if (Number(perks.cultClassic || 0) > 0) {
    const key = "perk:cultClassic:shield";
    const cd = Math.max(0, Math.floor(Number(actor.perkCooldowns?.[key] || 0)));
    out.push({
      source: "perk",
      key,
      id: "perk_cult_shield",
      name: "Cult Following",
      description: "Grant a scaling shield to one ally.",
      target: "ally",
      perkTrack: "cultClassic",
      rank: Number(perks.cultClassic || 1),
      cooldownTurns: 3,
      cooldownRemaining: cd,
      ready: cd <= 0
    });
  }

  if (Number(perks.sleeperHit || 0) > 0) {
    const key = "perk:sleeperHit:heal";
    const cd = Math.max(0, Math.floor(Number(actor.perkCooldowns?.[key] || 0)));
    out.push({
      source: "perk",
      key,
      id: "perk_sleeper_heal",
      name: "Second Wind",
      description: "Restore missing HP with level/rank scaling.",
      target: "ally",
      perkTrack: "sleeperHit",
      rank: Number(perks.sleeperHit || 1),
      cooldownTurns: 2,
      cooldownRemaining: cd,
      ready: cd <= 0
    });
  }

  return out;
}

function executePerkSpecial({
  actor,
  party,
  enemy,
  special,
  targetIndex = null,
  beforeHealTarget = null,
  beforeShieldTarget = null
}) {
  if (!actor || !special) return { used: false, lines: buildPerkSpecialNoContextLines(), effects: {} };
  ensureActorPerkState(actor);

  const rank = Math.max(1, Math.floor(Number(special.rank || 1)));
  const level = Math.max(1, Math.floor(Number(actor.level || 1)));
  const effects = {};
  const lines = [];

  if (special.perkTrack === "blockbusterPower") {
    if (!enemy) return { used: false, lines: buildPerkSpecialNoTargetLines(), effects: {} };
    const base = Math.max(1, Math.round(Number(actor.atk || 1) * (1.25 + (rank * 0.15)) + (level * 2)));
    const critRoll = Math.random() < Math.min(0.9, Number(actor.critChance || 0));
    const critMult = 1.5 + Math.max(0, Number(actor.critDamageBonus || 0));
    const dmg = Math.max(1, Math.round(base * (critRoll ? critMult : 1)));
    const before = Math.max(0, Math.round(Number(enemy.hp || 0)));
    enemy.hp = Math.max(0, Math.round(before - dmg));
    effects.damageDealt = Math.max(0, before - enemy.hp);
    lines.push(...buildPerkBlockbusterLines({
      actorName: getActorTitleName(actor),
      specialName: special.name,
      damageDealt: effects.damageDealt,
      crit: critRoll
    }));
  } else if (special.perkTrack === "cultClassic") {
    if (!Array.isArray(party) || targetIndex == null || targetIndex < 0 || targetIndex >= party.length) {
      return { used: false, lines: buildPerkSpecialNoAllyTargetLines(), effects: {} };
    }
    const target = party[targetIndex];
    if (!target || Number(target.hp || 0) <= 0) return { used: false, lines: buildPerkSpecialInvalidTargetLines(), effects: {} };
    if (typeof beforeShieldTarget === "function") beforeShieldTarget(target);
    const shield = Math.max(1, Math.round(Number(target.maxHp || 1) * (0.12 + (rank * 0.04)) + (level * 3)));
    target.tempShield = Math.max(0, Math.round(Number(target.tempShield || 0))) + shield;
    effects.shieldAdded = shield;
    lines.push(...buildPerkCultClassicLines({
      actorName: getActorTitleName(actor),
      specialName: special.name,
      targetName: getActorTitleName(target),
      shieldAdded: shield
    }));
  } else if (special.perkTrack === "sleeperHit") {
    if (!Array.isArray(party) || targetIndex == null || targetIndex < 0 || targetIndex >= party.length) {
      return { used: false, lines: buildPerkSpecialNoAllyTargetLines(), effects: {} };
    }
    const target = party[targetIndex];
    if (!target || Number(target.hp || 0) <= 0) return { used: false, lines: buildPerkSpecialInvalidTargetLines(), effects: {} };
    if (typeof beforeHealTarget === "function") beforeHealTarget(target);
    const missing = Math.max(0, Number(target.maxHp || 0) - Number(target.hp || 0));
    const healRaw = Math.max(1, Math.round((missing * (0.30 + (rank * 0.05)) + (level * 2)) * Math.max(0.5, Number(actor.healPower || 1))));
    const before = Math.max(0, Math.round(Number(target.hp || 0)));
    target.hp = Math.min(Math.max(1, Math.round(Number(target.maxHp || 1))), before + healRaw);
    effects.healedHp = Math.max(0, Math.round(target.hp - before));
    lines.push(...buildPerkSleeperHitLines({
      actorName: getActorTitleName(actor),
      specialName: special.name,
      targetName: getActorTitleName(target),
      healedHp: effects.healedHp
    }));
  }

  const used = (effects.damageDealt || 0) > 0 || (effects.healedHp || 0) > 0 || (effects.shieldAdded || 0) > 0;
  if (!used) return { used: false, lines: buildPerkSpecialNoEffectLines(), effects };

  const cdBase = Math.max(1, Math.floor(Number(special.cooldownTurns || 2)));
  const cdReduction = Math.max(0, Math.floor(Number(actor.supportEfficiency || 0) / 2));
  const cd = Math.max(1, cdBase - cdReduction);
  actor.perkCooldowns[special.key] = cd;

  return { used: true, lines, effects };
}

function handlePerkOverlayInput(mouse) {
  if (!perkChoiceQueue.length) {
    closePerkOverlay();
    return true;
  }

  const { cardRects } = getPerkOverlayLayoutRects();

  if (mouse && typeof mouse.x === "number" && typeof mouse.y === "number") {
    let clickedSlot = false;
    for (let i = 0; i < cardRects.length; i++) {
      const r = cardRects[i];
      if (mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) {
        perkOverlaySelection = i;
        clickedSlot = true;
        if (mouse.clicked) {
          const pick = perkChoiceQueue.shift();
          const actor = getActorByKey(pick?.actorKey);
          const track = PERK_TRACKS[perkOverlaySelection];
          if (actor && track) {
            const snapshot = snapshotActorPerkState(actor);
            applyPerkChoice(actor, track.id);
            syncPartyProgressToGameState();
            recordSystemAction("PERK", `${getActorDisplayName(actor)} chose ${track.name}`);
            perkChoiceHistory.push({ pick, trackId: track.id, snapshot });
          }
          if (!perkChoiceQueue.length) {
            closePerkOverlay();
            continueVictoryFlow();
            return true;
          }
          return true;
        }
      }
    }

    // Click/tap anywhere outside the slot cards => Back (undo previous pick).
    if (mouse.clicked && !clickedSlot) {
      if (perkChoiceHistory.length > 0) {
        const last = perkChoiceHistory.pop();
        const actor = getActorByKey(last?.pick?.actorKey);
        if (actor && last?.snapshot) {
          restoreActorPerkState(actor, last.snapshot);
          syncPartyProgressToGameState();
        }
        if (last?.pick) perkChoiceQueue.unshift(last.pick);
        perkReadyToExit = false;
      }
      // Outside click never confirms current slot.
      return true;
    }
  }

  if (Input.pressed("Left")) {
    Input.consume("Left");
    perkOverlaySelection = (perkOverlaySelection + PERK_TRACKS.length - 1) % PERK_TRACKS.length;
    return true;
  }
  if (Input.pressed("Right")) {
    Input.consume("Right");
    perkOverlaySelection = (perkOverlaySelection + 1) % PERK_TRACKS.length;
    return true;
  }

  if (Input.pressed("Enter") || mouse?.clicked) {
    if (Input.pressed("Enter")) Input.consume("Enter");
    if (perkReadyToExit && !perkChoiceQueue.length) {
      closePerkOverlay();
      continueVictoryFlow();
      return true;
    }

    if (perkChoiceQueue.length <= 0) return true;

    const pick = perkChoiceQueue.shift();
    const actor = getActorByKey(pick?.actorKey);
    const track = PERK_TRACKS[perkOverlaySelection];
    if (actor && track) {
      const snapshot = snapshotActorPerkState(actor);
      applyPerkChoice(actor, track.id);
      syncPartyProgressToGameState();
      recordSystemAction("PERK", `${getActorDisplayName(actor)} chose ${track.name}`);
      perkChoiceHistory.push({ pick, trackId: track.id, snapshot });
    }
    if (!perkChoiceQueue.length) {
      closePerkOverlay();
      continueVictoryFlow();
      return true;
    }
    return true;
  }

  return true;
}

function getPerkOverlayLayoutRects() {
  const w = PERK_OVERLAY_SIZE.w;
  const h = PERK_OVERLAY_SIZE.h;
  const x = Math.floor((SCREEN.W - w) / 2);
  const y = Math.floor((SCREEN.H - h) / 2);
  const cardW = Math.floor((w - 40) / 3);
  const cardH = h - 86;
  const cardRects = [];
  for (let i = 0; i < 3; i++) {
    cardRects.push({
      x: x + 12 + (i * (cardW + 8)),
      y: y + 58,
      w: cardW,
      h: cardH
    });
  }
  return { x, y, w, h, cardW, cardH, cardRects };
}

function wrapTextLinesByWidth(ctx, text, maxW, font) {
  const t = String(text || "").trim();
  if (!t) return [];
  ctx.save();
  if (font) ctx.font = font;
  const words = t.split(/\s+/g);
  const lines = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    const w = ctx.measureText(test).width;
    if (w <= maxW || !cur) {
      cur = test;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  ctx.restore();
  return lines;
}

function getPerkOverlayLinesForTrack(actor, track) {
  const base = Array.isArray(track?.perkLines) ? track.perkLines : [];
  const rank = Math.max(0, Math.floor(Number(actor?.perks?.[track?.id] || 0)));
  if (rank <= 0) return base;

  if (track?.id === "blockbusterPower") {
    return [
      "Attack and crit chance scale up.",
      "Crit damage scales harder.",
      "Increases Blockbuster Strike damage."
    ];
  }
  if (track?.id === "cultClassic") {
    return [
      "Defense and max HP scale up.",
      "Guarding mitigates more damage.",
      "Increases Cult Following shield strength."
    ];
  }
  if (track?.id === "sleeperHit") {
    return [
      "Healing and utility scale up.",
      "Support actions become more efficient.",
      "Increases Second Wind healing."
    ];
  }

  return base;
}

function renderPerkOverlay(ctx) {
  const { x, y, w, h, cardRects } = getPerkOverlayLayoutRects();
  const cur = perkChoiceQueue[0] || null;
  const actor = cur ? getActorByKey(cur.actorKey) : null;
  const actorName = actor ? getActorTitleName(actor) : "Actor";

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.86)";
  ctx.fillRect(0, 0, SCREEN.W, SCREEN.H);
  ctx.fillStyle = "#060812";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#7fa7ff";
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.fillStyle = "#fff";
  ctx.font = "12px monospace";
  ctx.fillText("Perk Choice", x + 14, y + 20);
  ctx.font = "9px monospace";
  ctx.fillStyle = "#cdd7ef";
  ctx.fillText(`${actorName} - choose 1 track`, x + 14, y + 34);
  ctx.fillText(`Remaining picks: ${perkChoiceQueue.length}`, x + 14, y + 46);

  for (let i = 0; i < PERK_TRACKS.length; i++) {
    const t = PERK_TRACKS[i];
    const rect = cardRects[i];
    const cx = rect.x;
    const cy = rect.y;
    const cardW = rect.w;
    const cardH = rect.h;
    const hot = i === perkOverlaySelection;
    const centerX = cx + Math.floor(cardW / 2);
    const iconY = cy + 36;
    const overlayLines = getPerkOverlayLinesForTrack(actor, t);

    // Invisible card body; keep only subtle selection rails.
    if (hot) {
      ctx.strokeStyle = "#ff0";
      ctx.beginPath();
      ctx.moveTo(cx + 6, cy + 6);
      ctx.lineTo(cx + cardW - 6, cy + 6);
      ctx.moveTo(cx + 6, cy + cardH - 6);
      ctx.lineTo(cx + cardW - 6, cy + cardH - 6);
      ctx.stroke();
    }

    drawPerkTrackIcon(ctx, t.id, centerX, iconY, hot, 66);

    ctx.textAlign = "center";
    ctx.font = "9px monospace";
    ctx.fillStyle = hot ? "#ff0" : "#d9e2ff";
    ctx.fillText(`${t.name} [${t.short}]`, centerX, cy + 18);

    ctx.font = "8px monospace";
    ctx.fillStyle = "#b8c3e0";
    let lineY = cy + 126;
    const maxTextWidth = cardW - 10;
    for (const perkLine of overlayLines) {
      const wrapped = wrapTextLinesByWidth(ctx, perkLine, maxTextWidth, "8px monospace");
      for (const ln of wrapped) {
        if (lineY > cy + cardH - 10) break;
        ctx.fillText(ln, centerX, lineY);
        lineY += 8;
      }
      lineY += 1; // force a fresh line block per perk item
      if (lineY > cy + cardH - 10) break;
    }

    ctx.textAlign = "start";
  }

  ctx.restore();
}

function drawPerkTrackIcon(ctx, trackId, centerX, topY, hot, size = 16) {
  const line = hot ? "#ff0" : "#b8c8ea";
  const fill = hot ? "#2d3f66" : "#1a2740";
  const s = Math.max(16, Math.floor(size));
  const x = Math.floor(centerX - (s / 2));
  const y = topY;
  ctx.save();
  ctx.strokeStyle = line;
  ctx.fillStyle = fill;
  ctx.lineWidth = 2;

  if (trackId === "blockbusterPower") {
    // Starburst icon.
    ctx.beginPath();
    ctx.moveTo(x + (s * 0.5), y + 0);
    ctx.lineTo(x + (s * 0.62), y + (s * 0.36));
    ctx.lineTo(x + s, y + (s * 0.36));
    ctx.lineTo(x + (s * 0.68), y + (s * 0.58));
    ctx.lineTo(x + (s * 0.78), y + s);
    ctx.lineTo(x + (s * 0.5), y + (s * 0.74));
    ctx.lineTo(x + (s * 0.22), y + s);
    ctx.lineTo(x + (s * 0.32), y + (s * 0.58));
    ctx.lineTo(x + 0, y + (s * 0.36));
    ctx.lineTo(x + (s * 0.38), y + (s * 0.36));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (trackId === "cultClassic") {
    // Shield icon.
    ctx.beginPath();
    ctx.moveTo(x + (s * 0.5), y + 0);
    ctx.lineTo(x + (s * 0.92), y + (s * 0.18));
    ctx.lineTo(x + (s * 0.92), y + (s * 0.62));
    ctx.lineTo(x + (s * 0.5), y + s);
    ctx.lineTo(x + (s * 0.08), y + (s * 0.62));
    ctx.lineTo(x + (s * 0.08), y + (s * 0.18));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + (s * 0.5), y + (s * 0.3));
    ctx.lineTo(x + (s * 0.5), y + (s * 0.72));
    ctx.moveTo(x + (s * 0.3), y + (s * 0.5));
    ctx.lineTo(x + (s * 0.7), y + (s * 0.5));
    ctx.stroke();
  } else {
    // Sleeper Hit: heart + pulse.
    ctx.beginPath();
    ctx.moveTo(x + (s * 0.5), y + (s * 0.92));
    ctx.lineTo(x + (s * 0.15), y + (s * 0.55));
    ctx.lineTo(x + (s * 0.15), y + (s * 0.25));
    ctx.lineTo(x + (s * 0.35), y + (s * 0.12));
    ctx.lineTo(x + (s * 0.5), y + (s * 0.25));
    ctx.lineTo(x + (s * 0.65), y + (s * 0.12));
    ctx.lineTo(x + (s * 0.85), y + (s * 0.25));
    ctx.lineTo(x + (s * 0.85), y + (s * 0.55));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + (s * 0.2), y + (s * 0.68));
    ctx.lineTo(x + (s * 0.38), y + (s * 0.68));
    ctx.lineTo(x + (s * 0.46), y + (s * 0.55));
    ctx.lineTo(x + (s * 0.57), y + (s * 0.78));
    ctx.lineTo(x + (s * 0.68), y + (s * 0.68));
    ctx.lineTo(x + (s * 0.82), y + (s * 0.68));
    ctx.stroke();
  }

  ctx.restore();
}

function openDevActionsOverlay() {
  overlayMode = "devActions";
  devActionsScrollPx = 0;
  clampDevActionsScroll();
  setHover({ kind: null, index: -1 });
}

function closeDevActionsOverlay() {
  overlayMode = "none";
  setHover({ kind: null, index: -1 });
}

function isDevActionsTogglePressed() {
  return Input.pressed("7") || Input.pressed("Numpad7");
}

function consumeDevActionsToggle() {
  if (Input.pressed("7")) Input.consume("7");
  if (Input.pressed("Numpad7")) Input.consume("Numpad7");
}

function handleDevActionsOverlayInput(mouse) {
  if (Input.keys?.Escape) {
    Input.consume("Back");
    closeDevActionsOverlay();
    return true;
  }

  if (mouse && Number.isFinite(mouse.wheelY) && mouse.wheelY !== 0) {
    devActionsScrollPx += mouse.wheelY;
    clampDevActionsScroll();
  }

  return false;
}

function renderDevActionsOverlay(ctx) {
  const frame = DEV_ACTIONS_OVERLAY;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.86)";
  ctx.fillRect(0, 0, SCREEN.W, SCREEN.H);

  ctx.fillStyle = "#0d1018";
  ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
  ctx.strokeStyle = "#7fa7ff";
  ctx.lineWidth = 1;
  ctx.strokeRect(frame.x + 0.5, frame.y + 0.5, frame.w - 1, frame.h - 1);

  const headerX = frame.x + frame.pad;
  const headerY = frame.y + frame.pad + 8;
  ctx.font = "8px monospace";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#dbe5ff";
  ctx.fillText("DEV ACTION LOG", headerX, headerY);
  ctx.fillStyle = "#8ea0c6";
  ctx.fillText("[Esc] Close  |  Mouse Wheel Scroll", headerX, headerY + 10);

  const listX = frame.x + frame.pad;
  const listY = frame.y + frame.pad + frame.headerH;
  const listW = frame.w - (frame.pad * 2);
  const listH = getDevActionsListHeight();

  ctx.fillStyle = "#05070b";
  ctx.fillRect(listX, listY, listW, listH);
  ctx.strokeStyle = "#3c4b6c";
  ctx.strokeRect(listX + 0.5, listY + 0.5, listW - 1, listH - 1);

  ctx.save();
  ctx.beginPath();
  ctx.rect(listX + 1, listY + 1, listW - 2, listH - 2);
  ctx.clip();

  ctx.fillStyle = "#f5f7ff";
  if (!actionHistory.length) {
    ctx.fillText("No actions recorded yet.", listX + 6, listY + 6);
  } else {
    const startIdx = Math.max(0, Math.floor(devActionsScrollPx / frame.rowH));
    const visibleRows = Math.ceil(listH / frame.rowH) + 1;
    const endIdx = Math.min(actionHistory.length, startIdx + visibleRows);

    for (let i = startIdx; i < endIdx; i++) {
      const rowY = listY + 4 + (i * frame.rowH) - devActionsScrollPx;
      const row = actionHistory[i];
      ctx.fillText(`${row.id}. ${row.actorName} | ${row.kind}: ${row.moveLabel}`, listX + 4, rowY);
    }
  }
  ctx.restore();

  ctx.restore();
}

// ===== INIT / ADVANCE =====
function initBattle() {
  battleInitialized = true;
  state.phase = "player";
  state.uiMode = "command";
  state.confirmAction = null;
  state.confirmHoldTurnStreak = 0;
  state.confirmHoldOptionKey = null;
  state.actionIndex = 0;
  state.defeatReason = null;
  overlayMode = "none";
  actionHistory = [];
  actionHistoryCounter = 0;
  devActionsScrollPx = 0;
  lastXpAwardSummary = null;
  pendingMoveXpDebug = {};
  levelUpRollMap = {};
  enterReleaseGate.clear();
  pendingLevelIntroGate = false;
  perkChoiceQueue = [];
  perkOverlaySelection = 0;

  battleBgmOn = false;

  // âœ… Ensure AudioContext exists/resumed
  armAudio();

  // âœ… NEW: Sync BGM bus to saved slider BEFORE starting battle music
  try { syncOptionsAudioNow(); } catch {}

  msgBox.clear();

  state.battleRunMode = GameState.runMode || null;
  state.battleIsCampaign = state.battleRunMode === "campaign" || !!GameState.campaign;
  const progressMap = state.battleIsCampaign ? (GameState.party.progress || {}) : {};
  state.party = buildPartyFromMovies(GameState.party.movies || [], progressMap);

  clearOneFourBattleApplyFlag(GameState);
  resetOneFourRuntimeForBattle(GameState);
  applyOneFourEffectsToParty(GameState, state.party);

  state.currentActorIndex = getFirstConsciousPartyIndex();
  if (state.currentActorIndex < 0) state.currentActorIndex = 0;

  // âœ… ensure the enemy exists BEFORE starting BGM
  ensureEnemyExists();
  initHpRollState();
  battleXpTracker = createBattleXpTracker({ party: state.party, enemy: state.enemy });

  // âœ… Start BGM AFTER enemy exists
  startBattleBgm(state.enemy);

  initInventory();

  const enemyIntroLines = buildEnemyIntroLines(state.enemy);
  if (enemyIntroLines.length > 0) {
    msgBox.queue(
      wrapLinesWithEnterReleaseArm(enemyIntroLines, () => enterReleaseGate.armIfHeld(), "all"),
      () => {}
    );
  }

  onPlayerPhaseStart();
  onActorTurnStart();

  // âœ… Theme comes from enemy.bgTheme, intensity comes from the level youâ€™re on.
  if (battleBg && typeof battleBg.configure === "function") {
    battleBg.configure({
      theme: state.enemy?.bgTheme,
      level: GameState.currentLevel || 1
    });
  }

  if (battleBg && typeof battleBg.randomize === "function") battleBg.randomize();

  // âœ… ensure pause overlay constructed (safe)
  ensurePauseOverlay();
}

function advanceToNextActor() {
  const n = state.party.length;
  let next = state.currentActorIndex + 1;
  while (next < n && !isPartyMemberConsciousAtIndex(next)) next++;

  if (next >= n) {
    state.phase = "enemy";
    state.uiMode = "command";
    state.confirmAction = null;
    state.actionIndex = 0;
    // âœ… NEW: end of team turn â†’ clear any mouse hover highlight
    setHover({ kind: null, index: -1 });
    msgBox.queue([{
      onStart: () => {
        enterReleaseGate.armIfHeld();
      },
      text: buildPressEnterToContinuePhaseLine()
    }], () => {});
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

function applyDisplayedHpToRenderState(renderState) {
  if (!renderState) return renderState;

  const rs = { ...renderState };
  const party = Array.isArray(renderState.party) ? renderState.party : [];
  rs.party = party.map((member, i) => {
    if (!member) return member;
    const ctl = getLevelUpRollControlByIndex(i);
    const displayedHp = getDisplayedPartyHp(i);
    const displayedRaw = getDisplayedPartyHpRaw(i);
    const displayedShield = getDisplayedPartyShield(i);
    const displayedShieldRaw = getDisplayedPartyShieldRaw(i);
    const displayedMaxHp = getDisplayedPartyMaxHp(i);
    const displayedAtk = getDisplayedPartyAtk(i);
    const displayedDef = getDisplayedPartyDef(i);
    const displayedAtkRaw = Number.isFinite(state.statRoll?.partyAtkDisplay?.[i]) ? Number(state.statRoll.partyAtkDisplay[i]) : displayedAtk;
    const displayedDefRaw = Number.isFinite(state.statRoll?.partyDefDisplay?.[i]) ? Number(state.statRoll.partyDefDisplay[i]) : displayedDef;
    const actualRaw = Number(state.party?.[i]?.hp ?? member.hp ?? 0);
    const pendingDownRaw = state.party?.[i]?.pendingDownHp;
    const hasPendingDown =
      typeof pendingDownRaw === "number" &&
      Number.isFinite(pendingDownRaw) &&
      pendingDownRaw <= 0 &&
      actualRaw > 0;
    const actualShieldRaw = Number(state.party?.[i]?.tempShield ?? member.tempShield ?? 0);
    const actualAtkRaw = Number(state.party?.[i]?.atk ?? member.atk ?? 0);
    const actualDefRaw = Number(state.party?.[i]?.def ?? member.def ?? 0);
    const isMortal = hasPendingDown;
    const clampedHp = Math.max(0, Math.min(displayedHp, displayedMaxHp));
    const hpRollTrend = (isMortal || (ctl && !ctl.maxHpReady))
      ? "steady"
      : (displayedRaw > actualRaw ? "down" : displayedRaw < actualRaw ? "up" : "steady");
    const shieldRollTrend = isMortal
      ? "steady"
      : (displayedShieldRaw > actualShieldRaw ? "down" : displayedShieldRaw < actualShieldRaw ? "up" : "steady");
    const atkRollTrend = (ctl && !ctl.atkDefReady)
      ? "steady"
      : (displayedAtkRaw > actualAtkRaw ? "down" : displayedAtkRaw < actualAtkRaw ? "up" : "steady");
    const defRollTrend = (ctl && !ctl.atkDefReady)
      ? "steady"
      : (displayedDefRaw > actualDefRaw ? "down" : displayedDefRaw < actualDefRaw ? "up" : "steady");
    return {
      ...member,
      hp: clampedHp,
      maxHp: displayedMaxHp,
      atk: displayedAtk,
      def: displayedDef,
      tempShield: displayedShield,
      hpRollTrend,
      shieldRollTrend,
      atkRollTrend,
      defRollTrend,
      isMortal
    };
  });

  if (renderState.enemy) {
    const displayedHp = getDisplayedEnemyHp();
    const displayedRaw = getDisplayedEnemyHpRaw();
    const actualRaw = Number(state.enemy?.hp ?? renderState.enemy.hp ?? 0);
    const hpRollTrend = displayedRaw > actualRaw ? "down" : displayedRaw < actualRaw ? "up" : "steady";
    rs.enemy = { ...renderState.enemy, hp: displayedHp, hpRollTrend };
  } else {
    rs.enemy = renderState.enemy;
  }

  return rs;
}

// ======================================================
// âœ… RENDER-ONLY STATE: ensures ONLY ONE highlight at a time
// - If hover is active, suppress selection highlight everywhere.
// - Optionally map selection index to hovered slot so help panel matches.
// ======================================================
function getRenderStateForUi() {
  if (!hover || !hover.kind) return applyDisplayedHpToRenderState(state);

  const rs = { ...state };

  // Suppress any "selected" highlight while hovering something
  rs.actionIndex = -1;
  rs.itemIndex = -1;
  rs.specialIndex = -1;

  // If hovering a slot, align the render index to that slot (visual + help panel coherence)
  if (rs.uiMode === "command" || rs.uiMode === "confirm") {
    if (hover.kind === "action") rs.actionIndex = hover.index;
  } else if (rs.uiMode === "item") {
    if (hover.kind === "itemSlot") {
      const pageStart = getItemPageStart(rs.itemsPageIndex);
      const idx = pageStart + hover.index;
      if (idx >= 0 && idx < rs.inventory.length) rs.itemIndex = idx;
    }
  } else if (rs.uiMode === "special") {
    if (hover.kind === "specialSlot") rs.specialIndex = hover.index;
  } else if (rs.uiMode === "itemTarget" || rs.uiMode === "specialTarget") {
    if (hover.kind === "target") rs.targetIndex = hover.index;
  }

  return applyDisplayedHpToRenderState(rs);
}

// ===== ACTIONS MODULE =====
const battleActions = createBattleActions({
  state,
  deps: {
    actions,
    computePlayerAttack,
    applyItemToActor,
    executeSpecial,
    buildSpecialLines,
    awardXpToParty: (party, enemy) => {
      const summary = awardXpToParty(party, enemy, battleXpTracker);
      lastXpAwardSummary = summary;
      recordXpSummaryToDevLog(summary);
      enqueuePerkChoicesFromSummary(summary);
      return summary;
    },
    syncPartyProgressToGameState,
    queueMessages: (lines, onDone) => msgBox.queue(lines, onDone),
    getCurrentActor,
    advanceToNextActor,
    getFirstAliveIndex,
    getFirstConsciousIndex: () => getFirstConsciousPartyIndex(),
    isActorConsciousByIndex: (index) => isPartyMemberConsciousAtIndex(index),
    movieMetaMap: movieMeta,
    getSignatureMapForActorPage: (actor, pageIndex) => getSignatureMapForActorPage(actor, pageIndex),
    resolveSpecialsForActorCurrentPage: (actor) => resolveSpecialsForActorCurrentPage(actor),
    getPerkSpecialsForActor: (actor) => getPerkSpecialsForActor(actor),
    executePerkSpecial: (args) => executePerkSpecial(args),
    getInventoryItemDef,
    QUIRKY_EXTRA_TURN_CHANCE,
    onRecordAction: (actor, kind, moveLabel) => {
      recordBattleAction(actor, kind, moveLabel);
    },
    onXpEvent: (event) => {
      const dbg = recordBattleXpEvent(battleXpTracker, event);
      if (dbg && dbg.actorKey) {
        pendingMoveXpDebug[dbg.actorKey] = Number(dbg.debugXp || 0);
      }
    },
    isConfirmHeld: () => !!(Input?.isPhysicallyDown?.("Confirm") || Input?.isPhysicallyDown?.("Enter")),
    onPrepareLevelUpRoll: (summary) => {
      prepareLevelUpRoll(summary);
    },
    onLevelUpRollTrigger: (actorKey, phase) => {
      triggerLevelUpRoll(actorKey, phase);
    },
    onVictoryEnemyDownLineStart: () => {
      settleAllRollingDownCountersAtDisplay();
      enterReleaseGate.armIfHeld();
    },
    beforeHealTarget,
    beforeShieldTarget,
    settleMortalPartySlotsAtDisplayedHp: () => settleMortalPartySlotsAtDisplayedHp(),

    // âœ… NEW
    DEFEND_ENEMY_PHASES
  }
});

function tickDefendEnemyPhaseCounters() {
  for (const m of state.party) {
    if (!m) continue;

    const left = m.defendEnemyPhasesLeft;
    if (!Number.isFinite(left) || left <= 0) continue;

    const next = left - 1;
    if (next <= 0) {
      m.defendEnemyPhasesLeft = 0;
      m.isDefending = false;
    } else {
      m.defendEnemyPhasesLeft = next;
    }
  }
}


// ===== ENEMY TURN =====
function enemyAttack() {
  // Avoid stale gate state carrying into a new enemy turn sequence.
  enterReleaseGate.clear();

  const alive = getConsciousParty();
  if (alive.length === 0) {
    state.phase = "defeat";
    stopBattleBgm();
    msgBox.queue(
      wrapLinesWithEnterReleaseArm([buildPartyFallenLine()], () => enterReleaseGate.armIfHeld(), "all"),
      () => {}
    );
    return;
  }

  recordBattleXpEvent(battleXpTracker, { type: "enemyPhaseStart" });

  const hasFunny = alive.some((m) => m.tone === "FUNNY");
  const disrupted = hasFunny && Math.random() < FUNNY_DISRUPT_CHANCE;
  const result = runEnemyTurn(state.enemy, state.party, {
    funnyDisrupt: disrupted,
    deferApply: true
  });

  if (state.enemy) {
    recordBattleAction(state.enemy, "ATTACK", "Enemy Turn");
  }

  const enemyEntries = (result?.events || []).map((evt) => {
    const line = (buildEnemyTurnLines({ events: [evt] }) || [])[0];

    if (evt?.type === "enemyAttackHit") {
      return {
        onStart: () => {
          const idx = Number(evt.targetIndex);
          if (!Number.isFinite(idx) || idx < 0 || idx >= state.party.length) return;

          const target = state.party[idx];
          if (!target) return;

          const nextHp = Number(evt.newHp ?? target.hp ?? 0);
          const shownHp = getDisplayedPartyHp(idx);
          const hpDamage = Number(evt.damage || 0);
          const currentHpAtHit = Math.max(0, toHpInt(target.hp));
          const shouldApplyMortal =
            !!evt.isMortal &&
            currentHpAtHit > 0 &&
            hpDamage >= currentHpAtHit;
          if (shouldApplyMortal && nextHp <= 0) {
            target.hp = Math.max(1, Math.min(shownHp, Math.max(1, Number(target.maxHp || shownHp || 1))));
            target.pendingDownHp = 0;
            target.enteredMortalState = true;
            target.isDowned = false;
            if (state.hpRoll?.partyDisplay) {
              state.hpRoll.partyDisplay[idx] = target.hp;
            }
          } else {
            target.hp = nextHp;
            target.pendingDownHp = null;
            target.isDowned = Number(target.hp || 0) <= 0;
          }
          if (typeof evt.newTempShield === "number") {
            target.tempShield = Math.max(0, Math.round(evt.newTempShield));
          }
          if (evt.consumeDefend) target.isDefending = false;

          const maxHp = Math.max(1, Number(target.maxHp || 1));
          const hpNow = Math.max(0, Number(target.hp || 0));
          const lowHpMoment = hpNow > 0 && (hpNow / maxHp) <= 0.35;
          recordBattleXpEvent(battleXpTracker, {
            type: "enemyHit",
            actor: target,
            damage: Number(evt.damage || 0),
            absorbedShield: Number(evt.absorbedShield || 0),
            lowHpMoment,
            allyDowned: !!evt.isMortal,
            guardedCrit: !!evt.guarded && !!evt.isCrit
          });
        },
        text: line || buildEnemyStrikesFallbackLine()
      };
    }

    return { text: line || buildEnemyActsFallbackLine() };
  });

  // Tick enemy statuses AFTER the enemy acts/skips, so 1-turn effects
  // still influence the immediate upcoming enemy phase.
  const enemyTickEvents = tickEnemyStatuses(state.enemy);
  const enemyTickLines = buildStatusTickLines({
    events: enemyTickEvents,
    actorName: null,
    enemyName: state.enemy?.name || "The enemy"
  });

  const finalizeEnemyPhase = () => {
    const finishAfterTicks = () => {
      if (getConsciousParty().length === 0) {
        state.phase = "defeat";
        stopBattleBgm();
        msgBox.queue(
          wrapLinesWithEnterReleaseArm([buildPartyFallenPromptLine()], () => enterReleaseGate.armIfHeld(), "all"),
          () => {}
        );
        return;
      }

      // âœ… NEW: one tick per enemy phase
      tickDefendEnemyPhaseCounters();

      state.phase = "player";
      state.currentActorIndex = getFirstConsciousPartyIndex();
      state.uiMode = "command";
      state.confirmAction = null;
      state.actionIndex = 0;
      state.specialIndex = 0;
      state.pendingSpecial = null;

      onPlayerPhaseStart();
      onActorTurnStart();
    };

    if (enemyTickLines.length > 0) {
      // If a status-tick block exists, its last line is the true end-of-enemy-turn line.
      enterReleaseGate.clear();
      msgBox.queue(
        wrapLinesWithEnterReleaseArm(enemyTickLines, () => enterReleaseGate.armIfHeld(), "last"),
        finishAfterTicks
      );
    } else finishAfterTicks();
  };

  if (enemyEntries.length > 0) {
    // Gate the enemy action block only when it's truly the final enemy-turn text.
    const linesForQueue =
      enemyTickLines.length > 0
        ? enemyEntries
        : wrapLinesWithEnterReleaseArm(enemyEntries, () => enterReleaseGate.armIfHeld(), "last");
    msgBox.queue(
      linesForQueue,
      finalizeEnemyPhase
    );
  }
  else finalizeEnemyPhase();
}


// =========================
// âœ… SCREEN EXPORT
// =========================

function handleDefeatReturnToMenu() {
  ensureStatsState(GameState);

  const isQuickplay = GameState.runMode === "quickplay";
  if (isQuickplay) GameState.runMode = null;

  completeRatatouilleTrialIfActive(GameState);

  if (state.defeatReason !== "RUN") incLosses(GameState, 1);

  evaluateUnlockRules(GameState);

  GameState.campaign = null;
  GameState.party.movies = [null, null, null, null];
  GameState.party.progress = {};
  GameState.enemyTemplate = null;
  GameState.enemy = null;
  GameState.currentLevel = 1;

  battleInitialized = false;
  state.enemy = null;

  clearOneFourBattleApplyFlag(GameState);
  changeScreen("menu");
}
const BattleScreenObj = {
  update(mouse) {
    if (!battleInitialized) initBattle();

    // Keep cursor default each frame; battleMouse will set pointer when relevant.
    if (mouse && typeof mouse.setCursor === "function") mouse.setCursor("default");

    // If the mouse moved this frame, mouse can own selection again
    if (mouse?.moved) mouseSelectEnabled = true;

    if (battleBg && typeof battleBg.tick === "function") battleBg.tick(1 / 60);

    msgBox.tick();
    tickHpRoll(1 / 60);
    tickStatRoll(1 / 60);

    // Pause overlay is modal; while open, it owns input and blocks battle flow.
    if (overlayMode === "pause") {
      ensurePauseOverlay();
      pauseOverlay.update(1 / 60, Input, mouse);
      return;
    }

    if (overlayMode === "devActions") {
      handleDevActionsOverlayInput(mouse);
      return;
    }

    if (overlayMode === "perk") {
      handlePerkOverlayInput(mouse);
      return;
    }

    if (isDevActionsTogglePressed()) {
      consumeDevActionsToggle();
      openDevActionsOverlay();
      return;
    }

    if (msgBox.isBusy()) {
      if (enterReleaseGate.blocksAdvance()) return;
      if (Input.pressed("Enter") || mouse?.clicked) {
        if (Input.pressed("Enter")) Input.consume("Enter");
        if (mouse?.clicked) try { playUIConfirmBlip(); } catch {}
        msgBox.advance();

        if (!msgBox.isBusy() && state.phase === "defeat") {
          handleDefeatReturnToMenu();
          return;
        }
      }
      return;
    }

    if (pendingLevelIntroGate) {
      if (enterReleaseGate.blocksAdvance()) return;

      if (Input.pressed("Enter") || mouse?.clicked) {
        if (Input.pressed("Enter")) Input.consume("Enter");
        if (mouse?.clicked) try { playUIConfirmBlip(); } catch {}
        pendingLevelIntroGate = false;
        battleInitialized = false;
        clearOneFourBattleApplyFlag(GameState);
        changeScreen("levelIntro");
      }
      return;
    }

    // âœ… Safety: never show hover highlights outside player phase
    if (state.phase !== "player" && hover?.kind) {
      setHover({ kind: null, index: -1 });
    }


    if (state.phase === "victory" || state.phase === "defeat") {
      stopBattleBgm();
    }

    // VICTORY
    if (state.phase === "victory") {
      if (enterReleaseGate.blocksAdvance()) return;
      if (Input.pressed("Enter") || mouse?.clicked) {
        if (Input.pressed("Enter")) Input.consume("Enter");
        if (mouse?.clicked) try { playUIConfirmBlip(); } catch {}

        if (perkChoiceQueue.length > 0) {
          openPerkOverlay();
          return;
        }
        continueVictoryFlow();
      }
      return;
    }

    // DEFEAT
    if (state.phase === "defeat") {
      if (Input.pressed("Enter") || mouse?.clicked) {
        if (Input.pressed("Enter")) Input.consume("Enter");
        if (mouse?.clicked) try { playUIConfirmBlip(); } catch {}
        handleDefeatReturnToMenu();
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

    // cancel (existing behavior) â€” unchanged
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

      // KEYBOARD FIRST:
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
        msgBox,

        onKeyboardNavigate: () => {
          mouseSelectEnabled = false;
        }
      });

      // MOUSE SECOND:
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
          setHover,
          mouseSelectEnabled
        })
      ) {
        return;
      }

      return;
    }

    // enemy phase
    if (state.phase === "enemy") {
      if (Input.pressed("Enter") || mouse?.clicked || mouse?.tapped) {
        if (Input.pressed("Enter")) Input.consume("Enter");
        if (mouse?.clicked || mouse?.tapped) {
          try { playUIConfirmBlip(); } catch {}
        }
        enemyAttack();
      }
    }
  },

  render(ctx) {
    // HARD RESET (prevents cumulative shrink/offset from leaked transforms)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Base clear
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SCREEN.W, SCREEN.H);

    if (!battleInitialized) initBattle();

    const width = SCREEN.W;
    const height = SCREEN.H;

    // render dynamic background ONLY in active region
    if (battleBg && typeof battleBg.render === "function") {
      battleBg.render(ctx, { x: 0, y: ACTIVE_Y });
    }

    // draw letterbox bars LAST (solid black, always)
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SCREEN.W, TOP_BAR_H);
    ctx.fillRect(0, SCREEN.H - BOTTOM_BAR_H, SCREEN.W, BOTTOM_BAR_H);

    // âœ… RENDER-ONLY state enforces "single highlight"
    const renderState = getRenderStateForUi();

    const indicatorIndex =
      renderState.uiMode === "itemTarget" || renderState.uiMode === "specialTarget"
        ? renderState.targetIndex
        : renderState.currentActorIndex;

    renderBattleCharacterSlots(ctx, {
      state: renderState,
      BATTLE_LAYOUT,
      indicatorIndex
    });

    const uiBaseY = BATTLE_LAYOUT.command.y;

    if (renderState.uiMode === "command" || renderState.uiMode === "confirm") {
      drawCommandMenu(ctx, {
        SCREEN,
        BATTLE_LAYOUT,
        uiBaseY,
        actions,
        state: renderState,
        hover
      });

      if (renderState.uiMode === "command") {
        drawPauseMiniIfNeeded(ctx, {
          SCREEN,
          BATTLE_LAYOUT,
          uiBaseY,
          actions,
          itemSlotsPerPage: ITEM_SLOTS_PER_PAGE,
          state: renderState,
          hover
        });
      }

      if (renderState.uiMode === "confirm") {
        drawConfirmMiniButtonsIfNeeded(ctx, {
          SCREEN,
          BATTLE_LAYOUT,
          uiBaseY,
          actions,
          itemSlotsPerPage: ITEM_SLOTS_PER_PAGE,
          state: renderState,
          hover
        });
      }
    } else if (renderState.uiMode === "item") {
      ctx.font = "8px monospace";

      if (renderState.inventory.length === 0) {
        ctx.fillStyle = "#fff";
        ctx.fillText(buildNoItemsMenuLine(), BATTLE_LAYOUT.command.x, uiBaseY + 16);
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
          state: renderState,
          hover,
          itemsPageIndex: renderState.itemsPageIndex
        });
      }
    } else if (renderState.uiMode === "special") {
      drawSpecialMenu(ctx, {
        SCREEN,
        BATTLE_LAYOUT,
        uiBaseY,
        itemSlotsPerPage: ITEM_SLOTS_PER_PAGE,
        state: renderState,
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
          phase: renderState.phase,
          uiMode: renderState.uiMode,
          actor: getCurrentActor(),
          isMessageBusy: () => msgBox.isBusy(),

          actions,
          actionIndex: renderState.actionIndex,
          actionDescriptions: ACTION_DESCRIPTIONS,

          confirmAction: renderState.confirmAction,

          inventory: renderState.inventory,
          itemIndex: renderState.itemIndex,
          itemPageCount: getItemPageCount(),
          getInventoryItemDef,

          pendingItemIndex: renderState.pendingItemIndex,
          targetIndex: renderState.targetIndex,
          party: renderState.party,

          specialsList: renderState.specialsList,
          specialIndex: renderState.specialIndex,
          pendingSpecial: renderState.pendingSpecial,

          canToggleSpecialPages: (actor) => canToggleSpecialPages(actor),
          getSpecialPageCount: (movieId) => getSpecialPageCount(movieId),
          specialsPageIndex: renderState.specialsPageIndex
        });

        if (renderState.uiMode === "item" && renderState.inventory.length > 0) {
          const actor = getCurrentActor();
          const entry = renderState.inventory[renderState.itemIndex];
          const def = entry ? getInventoryItemDef(entry) : null;

          const movieName =
            (actor && actor.movie && actor.movie.title) ||
            (actor && actor.movie && actor.movie.shortTitle) ||
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

    // Render pause/options overlay on top
    if (overlayMode === "pause") {
      ensurePauseOverlay();
      pauseOverlay.render(ctx);
    } else if (overlayMode === "devActions") {
      renderDevActionsOverlay(ctx);
    } else if (overlayMode === "perk") {
      renderPerkOverlay(ctx);
    }
  }
};

// Named export (what your game.js expects)
export const BattleScreen = BattleScreenObj;

// Default export (extra safety / debugging)
export default BattleScreenObj;




















