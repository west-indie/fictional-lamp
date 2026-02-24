// frontend/js/screens/startingItemsPick.js

import { GameState, changeScreen } from "../game.js";
import { Input } from "../ui.js";
import { SCREEN } from "../layout.js";
import { openingKits } from "../data/starterKits.js";
import { items } from "../data/items.js";
import { playUIConfirmBlip, playUIBackBlip, playUIMoveBlip } from "../sfx/uiSfx.js";

const ITEM_SELECT_MOVE_BEEP = {
  type: "sine",
  baseFreq: 180,
  endFreq: 168,
  jitter: 2,
  duration: 0.14,
  gainPeak: 0.12,
  hpFreq: 150,
  boxCutFreq: 340,
  boxCutGainDb: -7,
  lpFreq: 2800
};
const ITEM_SELECT_CONFIRM_BEEP = {
  type: "sine",
  baseFreq: 220,
  endFreq: 205,
  jitter: 2,
  duration: 0.16,
  gainPeak: 0.14,
  hpFreq: 160,
  boxCutFreq: 380,
  boxCutGainDb: -8,
  lpFreq: 3200
};
const ITEM_SELECT_BACK_BEEP = {
  type: "sine",
  baseFreq: 150,
  endFreq: 138,
  jitter: 1.5,
  duration: 0.15,
  gainPeak: 0.12,
  hpFreq: 140,
  boxCutFreq: 300,
  boxCutGainDb: -7,
  lpFreq: 2600
};

const CHOICE_COUNT = 3;
const CARD_W = 118;
const CARD_H = 182;
const CARD_GAP = 10;
const CARDS_Y = 70;
const REVEAL_DURATION = 0.32;

let selectedIndex = 0;
let hoverIndex = -1;
let mouseSelectEnabled = true;
let uiStage = "choose"; // "choose" | "confirmPending" | "reveal"
let revealElapsed = 0;

const KIT_SHORT_DESCRIPTIONS = {
  kids_meal: "A little bit of everything for the kids! You want a bib with that?",
  annoying_audience_member: "I always knew you were one of those.",
  candy_counter: "Go ahead. Pay for your dentist's second yacht.",
  soda_jerk: "So you're a big soda guy, huh?",
  family_bucket: "Sharables for the whole family to enjoy! Hope you brought a coupon.",
  marathon_starter_pack: "Adult diapers not included.",
  date_night_meal: "For that special someone in your life.",
  theater_floor_combo: "What? Five second rule dude."
};

function ensureCampaignBuckets() {
  if (!GameState.campaign) {
    GameState.campaign = {
      onefourShown: false,
      firstPickApplied: null,
      fourthPickApplied: null,
      effects: { first: null, fourth: null },
      _onefourAppliedThisBattle: false,
      flavor: {},
      runtime: {}
    };
  }
  if (!GameState.campaign.effects) GameState.campaign.effects = { first: null, fourth: null };
  if (!GameState.campaign.flavor) GameState.campaign.flavor = {};
  if (!GameState.campaign.runtime) GameState.campaign.runtime = {};
}

function sampleUniqueKitIds(poolIds, count) {
  const bag = [...poolIds];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }
  return bag.slice(0, Math.max(0, count));
}

function getKitPrimaryWeaponId(kit) {
  const entries = Array.isArray(kit?.items) ? kit.items : [];
  for (const entry of entries) {
    const id = String(entry?.id || "");
    if (!id) continue;
    if (String(items[id]?.type || "") === "reusableWeapon") return id;
  }
  return "";
}

function getKitOfferWeight(kit) {
  if (String(kit?.id || "") === "soda_jerk") return 0.25;
  return 1;
}

function pickWeightedKit(pool) {
  const source = Array.isArray(pool) ? pool : [];
  if (source.length <= 0) return null;
  let total = 0;
  for (const kit of source) total += Math.max(0, Number(getKitOfferWeight(kit) || 0));
  if (total <= 0) return source[Math.floor(Math.random() * source.length)] || null;

  let roll = Math.random() * total;
  for (const kit of source) {
    roll -= Math.max(0, Number(getKitOfferWeight(kit) || 0));
    if (roll <= 0) return kit;
  }
  return source[source.length - 1] || null;
}

function sampleOpeningKitIds(count) {
  const wanted = Math.max(0, Math.floor(Number(count || 0)));
  const pool = Array.isArray(openingKits)
    ? openingKits.filter((k) => String(k?.id || ""))
    : [];
  const picked = [];
  const usedWeaponIds = new Set();

  while (picked.length < wanted && pool.length > 0) {
    const uniqueWeaponPool = pool.filter((kit) => {
      const weaponId = getKitPrimaryWeaponId(kit);
      return !weaponId || !usedWeaponIds.has(weaponId);
    });
    const drawPool = uniqueWeaponPool.length > 0 ? uniqueWeaponPool : pool;
    const chosen = pickWeightedKit(drawPool);
    if (!chosen) break;

    picked.push(String(chosen.id || ""));
    const weaponId = getKitPrimaryWeaponId(chosen);
    if (weaponId) usedWeaponIds.add(weaponId);

    const chosenId = String(chosen.id || "");
    const idx = pool.findIndex((k) => String(k?.id || "") === chosenId);
    if (idx >= 0) pool.splice(idx, 1);
  }

  return picked.filter(Boolean);
}

function hasValidOfferIds(ids) {
  if (!Array.isArray(ids) || ids.length !== CHOICE_COUNT) return false;
  const seen = new Set();
  for (const raw of ids) {
    const id = String(raw || "");
    if (!id || seen.has(id)) return false;
    if (!openingKits.some((k) => k?.id === id)) return false;
    seen.add(id);
  }
  return true;
}

function ensureOpeningKitChoices() {
  ensureCampaignBuckets();
  if (hasValidOfferIds(GameState.campaign.openingKitOfferedIds)) return;
  GameState.campaign.openingKitOfferedIds = sampleOpeningKitIds(CHOICE_COUNT);
}

function getOfferedKits() {
  ensureOpeningKitChoices();
  const ids = Array.isArray(GameState.campaign.openingKitOfferedIds)
    ? GameState.campaign.openingKitOfferedIds
    : [];
  const byId = new Map(openingKits.map((k) => [String(k?.id || ""), k]));
  return ids.map((id) => byId.get(String(id || ""))).filter(Boolean);
}

function getCardRects() {
  const totalW = (CARD_W * CHOICE_COUNT) + (CARD_GAP * (CHOICE_COUNT - 1));
  const startX = Math.floor((SCREEN.W - totalW) / 2);
  const rects = [];
  for (let i = 0; i < CHOICE_COUNT; i++) {
    rects.push({
      x: startX + (i * (CARD_W + CARD_GAP)),
      y: CARDS_Y,
      w: CARD_W,
      h: CARD_H
    });
  }
  return rects;
}

function getClickedCardIndex(mouse) {
  if (!mouse || !(mouse.clicked || mouse.tapped)) return -1;
  const hovered = getHoveredCardIndex(mouse);
  if (hovered >= 0) return hovered;
  return -1;
}

function getHoveredCardIndex(mouse) {
  if (!mouse) return -1;
  const x = Number(mouse.x);
  const y = Number(mouse.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return -1;
  const rects = getCardRects();
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x <= (r.x + r.w) && y >= r.y && y <= (r.y + r.h)) return i;
  }
  return -1;
}

function itemLabel(entry) {
  const id = String(entry?.id || "");
  const count = Math.max(0, Math.floor(Number(entry?.count || 0)));
  const def = items[id] || null;
  const name = String(def?.name || def?.shortTitle || id || "Item").trim();
  const kind = String(def?.type || "").toLowerCase();
  const token =
    kind === "health" ? "Heal" :
    kind === "explosive" ? "Explosive" :
    kind === "reusableweapon" ? "Weapon" :
    "Item";
  return `${count}x ${name} (${token})`;
}

function drawWrappedLines(ctx, text, x, y, maxW, lineH, maxLines = 2) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxW || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);

  // Ellipsis when truncated.
  const usedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (usedWords < words.length && lines.length > 0) {
    let tail = lines[lines.length - 1];
    const ell = "...";
    while (tail.length > 1 && ctx.measureText(`${tail}${ell}`).width > maxW) {
      tail = tail.slice(0, -1);
    }
    lines[lines.length - 1] = `${tail}${ell}`;
  }

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + (i * lineH));
  }
  return lines.length;
}

function getKitBlurb(kit) {
  const id = String(kit?.id || "");
  return KIT_SHORT_DESCRIPTIONS[id] || "A curated starter combo.";
}

function drawKitIcon(ctx, kitId, cx, topY, isHot) {
  const id = String(kitId || "");
  const line = isHot ? "#ff0" : "#9bb1d9";
  const fill = isHot ? "#2f436f" : "#1a2946";
  ctx.save();
  ctx.strokeStyle = line;
  ctx.fillStyle = fill;
  ctx.lineWidth = 2;

  if (id === "kids_meal") {
    // Small striped popcorn tub.
    ctx.beginPath();
    ctx.moveTo(cx - 9, topY + 10);
    ctx.lineTo(cx + 9, topY + 10);
    ctx.lineTo(cx + 6, topY + 27);
    ctx.lineTo(cx - 6, topY + 27);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Vertical stripe accents.
    ctx.strokeStyle = "#dbe7ff";
    ctx.beginPath();
    ctx.moveTo(cx - 4, topY + 12);
    ctx.lineTo(cx - 3, topY + 25);
    ctx.moveTo(cx, topY + 11);
    ctx.lineTo(cx, topY + 26);
    ctx.moveTo(cx + 4, topY + 12);
    ctx.lineTo(cx + 3, topY + 25);
    ctx.stroke();
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.arc(cx - 6, topY + 7, 3, 0, Math.PI * 2);
    ctx.arc(cx, topY + 5, 3, 0, Math.PI * 2);
    ctx.arc(cx + 6, topY + 7, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (id === "annoying_audience_member") {
    // Diagonal ringing cell phone (still image).
    ctx.translate(cx, topY + 18);
    ctx.rotate(-0.35);
    ctx.fillRect(-8, -12, 16, 24);
    ctx.strokeRect(-8, -12, 16, 24);
    ctx.fillStyle = "#13213d";
    ctx.fillRect(-5, -8, 10, 13);
    ctx.strokeRect(-5, -8, 10, 13);
    ctx.fillStyle = line;
    ctx.fillRect(-1, 8, 2, 2);
    // Ring lines.
    ctx.beginPath();
    ctx.arc(-12, -2, 4, -1.4, -0.2);
    ctx.arc(-13, -2, 7, -1.4, -0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(12, -2, 4, -2.9, -1.7);
    ctx.arc(13, -2, 7, -2.9, -1.7);
    ctx.stroke();
  } else if (id === "candy_counter") {
    // Large diagonal wrapped candy with stronger 3D shading.
    ctx.save();
    ctx.translate(cx, topY + 18);
    ctx.rotate(-0.42);
    ctx.beginPath();
    ctx.moveTo(-11, -6);
    ctx.lineTo(11, -6);
    ctx.lineTo(13, 6);
    ctx.lineTo(-13, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Left wrap twist.
    ctx.beginPath();
    ctx.moveTo(-13, -5);
    ctx.lineTo(-20, -9);
    ctx.lineTo(-18, -2);
    ctx.lineTo(-20, 5);
    ctx.lineTo(-13, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Right wrap twist.
    ctx.beginPath();
    ctx.moveTo(13, -5);
    ctx.lineTo(20, -9);
    ctx.lineTo(18, -2);
    ctx.lineTo(20, 5);
    ctx.lineTo(13, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Gloss + shadow bands.
    ctx.strokeStyle = "#dbe7ff";
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(8, -2);
    ctx.stroke();
    ctx.strokeStyle = "#10192f";
    ctx.beginPath();
    ctx.moveTo(-9, 3);
    ctx.lineTo(9, 3);
    ctx.stroke();
    ctx.restore();
  } else if (id === "soda_jerk") {
    // Soda cup with lid, straw, and side shading.
    ctx.beginPath();
    ctx.moveTo(cx - 10, topY + 11);
    ctx.lineTo(cx + 10, topY + 11);
    ctx.lineTo(cx + 7, topY + 29);
    ctx.lineTo(cx - 7, topY + 29);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Lid.
    ctx.fillRect(cx - 11, topY + 8, 22, 4);
    ctx.strokeRect(cx - 11, topY + 8, 22, 4);
    // Straw.
    ctx.beginPath();
    ctx.moveTo(cx + 1, topY + 1);
    ctx.lineTo(cx + 7, topY + 8);
    ctx.lineTo(cx + 7, topY + 15);
    ctx.stroke();
    // Side shade + highlight for depth.
    ctx.fillStyle = "#111a31";
    ctx.fillRect(cx + 3, topY + 13, 3, 14);
    ctx.strokeStyle = "#dbe7ff";
    ctx.beginPath();
    ctx.moveTo(cx - 5, topY + 14);
    ctx.lineTo(cx - 5, topY + 26);
    ctx.stroke();
  } else if (id === "family_bucket") {
    // Large striped popcorn bucket.
    ctx.beginPath();
    ctx.moveTo(cx - 13, topY + 8);
    ctx.lineTo(cx + 13, topY + 8);
    ctx.lineTo(cx + 10, topY + 29);
    ctx.lineTo(cx - 10, topY + 29);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Bold bucket stripes for readability.
    ctx.strokeStyle = "#dbe7ff";
    ctx.beginPath();
    ctx.moveTo(cx - 6, topY + 10);
    ctx.lineTo(cx - 5, topY + 27);
    ctx.moveTo(cx - 1, topY + 9);
    ctx.lineTo(cx - 1, topY + 28);
    ctx.moveTo(cx + 4, topY + 10);
    ctx.lineTo(cx + 3, topY + 27);
    ctx.stroke();
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.arc(cx - 5, topY + 6, 3, 0, Math.PI * 2);
    ctx.arc(cx + 1, topY + 4, 3, 0, Math.PI * 2);
    ctx.arc(cx + 7, topY + 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (id === "marathon_starter_pack") {
    // Film reel + curved film strip (inspired by reference).
    const rx = cx - 8;
    const ry = topY + 16;
    // Reel body.
    ctx.beginPath();
    ctx.arc(rx, ry, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Reel holes.
    ctx.fillStyle = "#0b1020";
    ctx.beginPath(); ctx.arc(rx, ry, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx - 5, ry - 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx + 5, ry - 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx - 5, ry + 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx + 5, ry + 5, 2.5, 0, Math.PI * 2); ctx.fill();
    // Rim highlight for slight depth.
    ctx.strokeStyle = "#dbe7ff";
    ctx.beginPath();
    ctx.arc(rx - 2, ry - 2, 8, 3.7, 5.7);
    ctx.stroke();
    ctx.strokeStyle = line;
    // Film strip ribbon.
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(rx + 10, ry + 2);
    ctx.bezierCurveTo(cx + 2, topY + 32, cx + 10, topY + 7, cx + 22, topY + 20);
    ctx.stroke();
    // Sprocket holes on ribbon.
    ctx.fillStyle = "#0b1020";
    for (let i = 0; i < 6; i++) {
      const px = cx + 3 + (i * 3);
      const pyTop = topY + 17 + (i % 2 === 0 ? 2 : 0);
      ctx.fillRect(px, pyTop, 1, 1);
      ctx.fillRect(px, pyTop + 5, 1, 1);
    }
    ctx.lineWidth = 2;
  } else if (id === "date_night_meal") {
    // Heart.
    ctx.beginPath();
    ctx.moveTo(cx, topY + 26);
    ctx.bezierCurveTo(cx - 14, topY + 16, cx - 10, topY + 5, cx, topY + 11);
    ctx.bezierCurveTo(cx + 10, topY + 5, cx + 14, topY + 16, cx, topY + 26);
    ctx.fill();
    ctx.stroke();
  } else if (id === "theater_floor_combo") {
    // Spilled soda cup + large puddle (no ice cubes).
    ctx.beginPath();
    ctx.ellipse(cx + 1, topY + 24, 18, 9, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#111a31";
    ctx.beginPath();
    ctx.ellipse(cx + 4, topY + 24, 8, 3, -0.08, 0, Math.PI * 2);
    ctx.fill();
    // Tipped soda cup body with clearer cylindrical look.
    ctx.fillStyle = "#dbe7ff";
    ctx.beginPath();
    ctx.moveTo(cx - 12, topY + 7);
    ctx.lineTo(cx + 6, topY + 11);
    ctx.lineTo(cx + 2, topY + 20);
    ctx.lineTo(cx - 16, topY + 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Red label patch for cup readability.
    ctx.fillStyle = "#b3262b";
    ctx.beginPath();
    ctx.moveTo(cx - 6, topY + 9);
    ctx.lineTo(cx + 3, topY + 11);
    ctx.lineTo(cx + 1, topY + 16);
    ctx.lineTo(cx - 8, topY + 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Lid edge + straw.
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(cx - 14, topY + 6);
    ctx.lineTo(cx + 7, topY + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 5, topY + 2);
    ctx.lineTo(cx - 1, topY + 9);
    ctx.stroke();
    // Cup side highlight (faux 3D).
    ctx.strokeStyle = "#dbe7ff";
    ctx.beginPath();
    ctx.moveTo(cx - 10, topY + 10);
    ctx.lineTo(cx - 11, topY + 14);
    ctx.stroke();
    ctx.strokeStyle = line;
    // Spill stream connecting cup to puddle.
    ctx.beginPath();
    ctx.moveTo(cx - 1, topY + 17);
    ctx.lineTo(cx + 3, topY + 21);
    ctx.lineTo(cx + 7, topY + 23);
    ctx.stroke();
  } else {
    // Fallback ticket icon.
    ctx.fillRect(cx - 12, topY + 10, 24, 14);
    ctx.strokeRect(cx - 12, topY + 10, 24, 14);
    ctx.beginPath();
    ctx.moveTo(cx - 5, topY + 14);
    ctx.lineTo(cx + 5, topY + 20);
    ctx.stroke();
  }

  ctx.restore();
}

function beginReveal(kits) {
  uiStage = "reveal";
  const len = Array.isArray(kits) ? kits.length : 0;
  const centerIndex = Math.floor((Math.max(1, len) - 1) / 2);
  revealElapsed = selectedIndex === centerIndex ? REVEAL_DURATION : 0;
}

function pickSelectedKitAndStartBattle(kits, index) {
  const kit = kits[index] || null;
  if (!kit) return;
  ensureCampaignBuckets();
  GameState.campaign.openingKitSelectedId = String(kit.id || "");
  playUIConfirmBlip(ITEM_SELECT_CONFIRM_BEEP);
  changeScreen("battle");
}

export const StartingItemsPickScreen = {
  enter() {
    ensureOpeningKitChoices();
    selectedIndex = 0;
    hoverIndex = -1;
    mouseSelectEnabled = true;
    uiStage = "choose";
    revealElapsed = 0;
  },

  update(mouse) {
    const kits = getOfferedKits();
    if (kits.length <= 0) {
      changeScreen("battle");
      return;
    }
    selectedIndex = Math.max(0, Math.min(selectedIndex, kits.length - 1));
    if (mouse?.moved) mouseSelectEnabled = true;
    hoverIndex = getHoveredCardIndex(mouse);

    if (mouse && typeof mouse.setCursor === "function") {
      if (uiStage === "confirmPending") {
        mouse.setCursor(hoverIndex === selectedIndex ? "pointer" : "default");
      } else {
        mouse.setCursor(hoverIndex >= 0 ? "pointer" : "default");
      }
    }

    if (
      uiStage === "choose" &&
      mouseSelectEnabled &&
      hoverIndex >= 0 &&
      hoverIndex !== selectedIndex
    ) {
      selectedIndex = hoverIndex;
      playUIMoveBlip(ITEM_SELECT_MOVE_BEEP);
    }

    if (uiStage === "reveal") {
      revealElapsed = Math.min(REVEAL_DURATION, revealElapsed + (1 / 60));
      const revealDone = revealElapsed >= REVEAL_DURATION;
      if (revealDone && (Input.pressed("Enter") || mouse?.clicked || mouse?.tapped)) {
        Input.consume("Enter");
        pickSelectedKitAndStartBattle(kits, selectedIndex);
      }
      return;
    }

    const clickedCard = getClickedCardIndex(mouse);
    if (uiStage === "choose" && clickedCard >= 0) {
      selectedIndex = clickedCard;
      playUIConfirmBlip(ITEM_SELECT_CONFIRM_BEEP);
      uiStage = "confirmPending";
      return;
    }
    if (uiStage === "confirmPending" && clickedCard >= 0) {
      if (clickedCard === selectedIndex) {
        playUIConfirmBlip(ITEM_SELECT_CONFIRM_BEEP);
        beginReveal(kits);
      } else {
        selectedIndex = clickedCard;
        playUIMoveBlip(ITEM_SELECT_MOVE_BEEP);
      }
      return;
    }
    if (uiStage === "confirmPending" && !!(mouse?.clicked || mouse?.tapped) && clickedCard < 0) {
      uiStage = "choose";
      return;
    }

    if (Input.pressed("Backspace") || Input.pressed("Escape")) {
      Input.consume("Backspace");
      Input.consume("Escape");
      mouseSelectEnabled = false;
      playUIBackBlip(ITEM_SELECT_BACK_BEEP);
      if (uiStage === "confirmPending") {
        uiStage = "choose";
      } else {
        changeScreen("fourthPick");
      }
      return;
    }

    if (Input.pressed("Left") || Input.pressed("ArrowLeft")) {
      Input.consume("Left");
      Input.consume("ArrowLeft");
      mouseSelectEnabled = false;
      if (uiStage !== "choose") return;
      selectedIndex = (selectedIndex + kits.length - 1) % kits.length;
      playUIMoveBlip(ITEM_SELECT_MOVE_BEEP);
      return;
    }

    if (Input.pressed("Right") || Input.pressed("ArrowRight")) {
      Input.consume("Right");
      Input.consume("ArrowRight");
      mouseSelectEnabled = false;
      if (uiStage !== "choose") return;
      selectedIndex = (selectedIndex + 1) % kits.length;
      playUIMoveBlip(ITEM_SELECT_MOVE_BEEP);
      return;
    }

    if (Input.pressed("Enter")) {
      Input.consume("Enter");
      mouseSelectEnabled = false;
      if (uiStage === "choose") {
        playUIConfirmBlip(ITEM_SELECT_CONFIRM_BEEP);
        uiStage = "confirmPending";
      } else if (uiStage === "confirmPending") {
        playUIConfirmBlip(ITEM_SELECT_CONFIRM_BEEP);
        beginReveal(kits);
      }
    }
  },

  render(ctx) {
    const kits = getOfferedKits();
    const rects = getCardRects();

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SCREEN.W, SCREEN.H);

    ctx.fillStyle = "#fff";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Choose Starting Inventory", Math.floor(SCREEN.W / 2), 24);

    ctx.fillStyle = "#9bb1d9";
    ctx.font = "9px monospace";
    ctx.fillText("Pick a combo to begin.", Math.floor(SCREEN.W / 2), 38);
    ctx.textAlign = "start";

    const revealProgress = Math.min(1, revealElapsed / REVEAL_DURATION);
    const revealKit = kits[selectedIndex] || null;

    for (let i = 0; i < rects.length; i++) {
      const kit = kits[i];
      const baseRect = rects[i];
      const isSelected = i === selectedIndex;
      const centerX = Math.floor((SCREEN.W - CARD_W) / 2);
      const revealX =
        uiStage === "reveal" && isSelected
          ? Math.round(baseRect.x + ((centerX - baseRect.x) * revealProgress))
          : baseRect.x;
      const r = { ...baseRect, x: revealX };
      if (uiStage === "reveal" && !isSelected) continue;

      const hot = i === selectedIndex;
      const inactiveDuringConfirm = uiStage === "confirmPending" && !hot;

      ctx.fillStyle = inactiveDuringConfirm ? "#070b15" : "#0b1020";
      ctx.fillRect(r.x, r.y, r.w, r.h);

      ctx.fillStyle = hot ? "#ff0" : "#d9e2ff";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`Combo #${i + 1}`, r.x + Math.floor(r.w / 2), r.y + 14);

      if (!kit) continue;

      drawKitIcon(ctx, kit.id, r.x + Math.floor(r.w / 2), r.y + 22, hot);

      const kitItems = Array.isArray(kit.items) ? kit.items : [];
      ctx.fillStyle = "#d4dcf0";
      ctx.font = "8px monospace";
      let lineY = r.y + 68;
      for (const entry of kitItems) {
        if (lineY > r.y + r.h - 10) break;
        const used = drawWrappedLines(
          ctx,
          itemLabel(entry),
          r.x + Math.floor(r.w / 2),
          lineY,
          r.w - 16,
          8,
          2
        );
        lineY += (used * 8) + 2;
      }
      ctx.textAlign = "start";
    }

    if (uiStage === "confirmPending") {
      ctx.fillStyle = "#111a31";
      ctx.fillRect(38, 258, 324, 22);
      ctx.strokeStyle = "#7fa7ff";
      ctx.strokeRect(38.5, 258.5, 323, 21);
      ctx.fillStyle = "#ffed8f";
      ctx.font = "9px monospace";
      ctx.fillText(`Confirm Combo #${selectedIndex + 1}? Enter to lock in.`, 48, 272);
    } else if (uiStage === "reveal") {
      const done = revealElapsed >= REVEAL_DURATION;
      if (done && revealKit) {
        ctx.fillStyle = "#111a31";
        ctx.fillRect(24, 258, 352, 30);
        ctx.strokeStyle = "#7fa7ff";
        ctx.strokeRect(24.5, 258.5, 351, 29);
        ctx.fillStyle = "#ffed8f";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`You have selected ${String(revealKit.name || "Starter Combo")}!`, 200, 270);
        ctx.fillStyle = "#9bb1d9";
        ctx.font = "9px monospace";
        ctx.fillText(getKitBlurb(revealKit), 200, 282);
        ctx.textAlign = "start";
      }
    }
  }
};
