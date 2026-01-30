// frontend/js/screens/levelIntro.js

import { GameState, changeScreen } from "../game.js";
import { SCREEN, LEGACY_320, INTRO_LAYOUT } from "../layout.js";
import { Input } from "../ui.js";
import { enemies } from "../data/enemies.js";
import { movies } from "../data/movies.js"; // ✅ needed for Dev preset party resolution

// ID-based pools
const levelEnemyPools = {
  1: ["disney_adult", "brain_rot", "old_head", "critic"],
  2: ["film_bro", "brain_rot", "comfort", "recent", "buster"],
  3: ["film_bro", "nolan_fan", "star_fan", "psych", "recent", "folk_horror", "critic"],
  4: ["film_bro", "goth_chick", "comfort", "old_head", "buster", "folk_horror", "critic"],
  5: ["film_bro", "critic", "franchise_fan", "star_fan", "psych", "buster", "nolan_fan", "light"],
  6: ["film_bro", "franchise_fan", "art_snob", "horror_purist", "light"],
  7: ["art_snob", "cinephile", "comfort", "old_head", "psych", "nolan_fan", "horror_purist", "folk_horror", "light"],
  8: ["cinephile", "brain_rot", "old_head", "nolan_fan", "light"],
  9: ["cinephile", "troll", "unironic_rot"]
};

function findEnemyById(id) {
  return enemies.find((e) => e.id === id) || enemies[0] || null;
}

function pickEnemyForLevel(level) {
  const pool = levelEnemyPools[level];
  const ids = pool && pool.length ? pool : enemies.map((e) => e.id);

  const chosenId = ids[Math.floor(Math.random() * ids.length)];
  const template = findEnemyById(chosenId);

  GameState.enemyTemplate = template;
  GameState.enemy = null; // ensure battle spawns fresh
}

function ensureCampaignState() {
  if (GameState.campaign) return;

  GameState.campaign = {
    onefourShown: false,
    firstPickApplied: null,
    fourthPickApplied: null,
    effects: { first: null, fourth: null },
    _onefourAppliedThisBattle: false
  };
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(" ");
  let line = "";
  let posY = y;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    if (ctx.measureText(testLine).width > maxWidth) {
      ctx.fillText(line.trim(), x, posY);
      line = words[i] + " ";
      posY += lineHeight;
    } else {
      line = testLine;
    }
  }

  ctx.fillText(line.trim(), x, posY);
}

// ✅ Dev Battle Select hook:
function applyDevBattleConfigIfAny() {
  const cfg = GameState.devBattleConfig;
  if (!cfg || !cfg.enabled) return false;

  const L = Math.max(1, Number(cfg.level) || 1);
  GameState.currentLevel = L;

  const ids = Array.isArray(cfg.partyMovieIds) ? cfg.partyMovieIds : [];
  const party = ids
    .slice(0, 4)
    .map((id) => movies.find((m) => m.id === id))
    .filter(Boolean);

  if (!GameState.party) GameState.party = {};
  GameState.party.movies = party;

  const forced = findEnemyById(cfg.enemyId);
  if (forced) {
    GameState.enemyTemplate = forced;
    GameState.enemy = null;
  } else {
    GameState.enemyTemplate = null;
  }

  GameState.devBattleConfig = null;
  return true;
}

// ✅ Enter must be released once on this screen before it can trigger
let enterArmed = false;

// ✅ tap/click helper (left = back, right = confirm)
function getTapAction(mouse) {
  if (!mouse) return null;
  const clicked = !!(mouse.clicked || mouse.tapped);
  if (!clicked) return null;

  const x = Number(mouse.x);
  if (!Number.isFinite(x)) return null;

  return x < SCREEN.W / 2 ? "back" : "confirm";
}

export const LevelIntroScreen = {
  enter() {
    enterArmed = false;
    applyDevBattleConfigIfAny();
  },

  update(mouse) {
    // Arm Enter only after it is released on this screen
    if (!Input.isDown("Enter")) {
      enterArmed = true;
    }

    // Choose enemy template on first entry (unless dev already set one)
    if (!GameState.enemyTemplate) {
      pickEnemyForLevel(GameState.currentLevel);
    }

    ensureCampaignState();

    // ✅ Tap/click: left side = back (NO-OP here), right side = confirm
    const tap = getTapAction(mouse);
    if (tap === "confirm") {
      // mirror Enter behavior (including enterArmed rule)
      if (enterArmed) {
        enterArmed = false;
        GameState.enemy = null;

        if (GameState.currentLevel === 1 && !GameState.campaign.onefourShown) {
          changeScreen("firstPick");
          return;
        }
        changeScreen("battle");
        return;
      }
    }

    if (enterArmed && Input.pressed("Enter")) {
      Input.consume("Enter");
      enterArmed = false;

      GameState.enemy = null;

      if (GameState.currentLevel === 1 && !GameState.campaign.onefourShown) {
        changeScreen("firstPick");
        return;
      }

      changeScreen("battle");
    }
  },

  render(ctx) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SCREEN.W, SCREEN.H);

    ctx.save();
    ctx.translate(LEGACY_320.OFFSET_X, LEGACY_320.OFFSET_Y);
    ctx.scale(LEGACY_320.SCALE, LEGACY_320.SCALE);

    const width = LEGACY_320.W;
    const height = LEGACY_320.H;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    ctx.fillText(`Level ${GameState.currentLevel} Incoming:`, INTRO_LAYOUT.heading.x, INTRO_LAYOUT.heading.y);

    const enemy = GameState.enemyTemplate;
    if (enemy) {
      ctx.fillText(enemy.name, INTRO_LAYOUT.name.x, INTRO_LAYOUT.name.y);

      if (enemy.description) {
        ctx.font = "8px monospace";
        wrapText(ctx, enemy.description, INTRO_LAYOUT.desc.x, INTRO_LAYOUT.desc.y, INTRO_LAYOUT.desc.w, INTRO_LAYOUT.desc.lh);
      }
    }

    const footerText = "Press Enter to Continue.";
    ctx.font = "10px monospace";
    const textWidth = ctx.measureText(footerText).width;
    ctx.fillText(footerText, Math.floor((width - textWidth) / 2), INTRO_LAYOUT.footer.y);

    ctx.restore();
  }
};
