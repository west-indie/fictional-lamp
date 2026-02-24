// frontend/js/screens/enemyIntro.js

import { GameState, changeScreen } from "../game.js";
import { SCREEN, LEGACY_320, INTRO_LAYOUT } from "../layout.js";
import { Input } from "../ui.js";
import { enemies } from "../data/enemies.js";
import { playUIConfirmBlip, playUIBackBlip } from "../sfx/uiSfx.js";

function pickRandomEnemy() {
  const list = Array.isArray(enemies) && enemies.length ? enemies : [];
  const template = list[Math.floor(Math.random() * list.length)] || list[0] || null;

  GameState.enemyTemplate = template;
  GameState.enemy = null; // ensure battle spawns fresh
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

export const EnemyIntroScreen = {
  enter() {
    enterArmed = false;
  },

  update(mouse) {
    if (!Input.isDown("Enter")) {
      enterArmed = true;
    }

    if (!GameState.enemyTemplate) {
      pickRandomEnemy();
    }

    const tap = getTapAction(mouse);
    if (tap === "back") {
      // "back if possible" — for Quickplay enemy intro, reasonable back is Quickplay
      playUIBackBlip();
      changeScreen("quickplay");
      return;
    }
    if (tap === "confirm") {
      if (enterArmed) {
        enterArmed = false;
        GameState.enemy = null;
        playUIConfirmBlip();
        changeScreen("battle");
        return;
      }
    }

    if (enterArmed && Input.pressed("Enter")) {
      Input.consume("Enter");
      enterArmed = false;

      GameState.enemy = null;

      playUIConfirmBlip();
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
    ctx.fillText("Enemy Incoming:", INTRO_LAYOUT.heading.x, INTRO_LAYOUT.heading.y);

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



