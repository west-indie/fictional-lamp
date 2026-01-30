// frontend/js/screens/devBattleSelect.js
//
// Dev-only battle setup:
// - Pick enemy (any from enemies.js)
// - Pick level
// - Pick one of two preloaded party presets (4 movies)
// - Shows posters (best-effort)
// - Confirm -> sets GameState.devBattleConfig then jumps to levelIntro
//
// Controls (match your Input mappings):
// - Up/Down: enemy
// - Left/Right: level
// - Confirm: start
// - Back: return to menu
// - Q/E: preset (if your Input maps them)

import { GameState, changeScreen } from "../game.js";
import { SCREEN } from "../layout.js";
import { Input } from "../ui.js";

import { movies } from "../data/movies.js";
import { getEnemyCatalog } from "../systems/enemySpawnSystem.js";

// ✅ Silence menu layered stems while on this dev screen
import { MenuLayers, SILENT_MIX } from "../systems/menuLayeredMusic.js";

function normalizeTitle(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findMovieByTitle(title) {
  const want = normalizeTitle(title);

  // Try exact matches first
  let m =
    movies.find((x) => normalizeTitle(x.title) === want) ||
    movies.find((x) => normalizeTitle(x.shortTitle) === want);

  if (m) return m;

  // Try contains (fallback)
  m = movies.find((x) => normalizeTitle(x.title).includes(want));
  if (m) return m;

  // Try loose variant
  const wantLoose = want.replace(/\bs\b/g, "");
  m = movies.find((x) => normalizeTitle(x.title).replace(/\bs\b/g, "") === wantLoose);
  return m || null;
}

function getPosterSrc(movie) {
  if (!movie) return null;

  const direct =
    movie.poster ||
    movie.posterPath ||
    movie.posterSrc ||
    movie.posterURL ||
    movie.posterUrl ||
    movie.image ||
    movie.img;

  if (direct) return direct;

  return `assets/posters/${movie.id}.png`;
}

function makePosterCache() {
  const cache = new Map(); // key -> { img, ok }
  return {
    get(movie) {
      if (!movie) return null;
      const key = movie.id || movie.title;
      if (!key) return null;

      if (cache.has(key)) return cache.get(key);

      const src = getPosterSrc(movie);
      if (!src) {
        const rec = { img: null, ok: false };
        cache.set(key, rec);
        return rec;
      }

      const img = new Image();
      const rec = { img, ok: false };
      cache.set(key, rec);

      img.onload = () => (rec.ok = true);
      img.onerror = () => (rec.ok = false);
      img.src = src;

      return rec;
    }
  };
}

const PRESETS = [
  {
    name: "Leo",
    titles: ["This is Spinal Tap", "Office Space", "Howls Moving Castle", "Purple Rain"]
  }
];

// ✅ Helper: while this screen is active, always silence MenuLayers (if started)
function enforceSilentMenuLayers(fadeMs = 0) {
  try {
    MenuLayers.setMix(SILENT_MIX, fadeMs);
  } catch {}
}

export const DevBattleSelectScreen = {
  _enemies: [],
  _enemyIndex: 0,
  _level: 1,
  _presetIndex: 0,
  _posterCache: makePosterCache(),
  _armedConfirm: false,

  enter() {
    // ✅ Ensure menu stems are silent on this screen
    enforceSilentMenuLayers(0);

    this._enemies = (getEnemyCatalog?.() || [])
      .slice()
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));

    if (!this._enemies.length) {
      this._enemies = [{ id: "missing_enemy_catalog", name: "No enemies found" }];
    }

    this._enemyIndex = Math.min(this._enemyIndex, Math.max(0, this._enemies.length - 1));

    // Use your GameState.currentLevel convention
    const startL = Number(GameState.currentLevel || 1) || 1;
    this._level = Math.max(1, Math.min(99, startL));

    this._armedConfirm = false;
  },

  update() {
    // ✅ Keep silencing every frame so nothing “sticks” back in
    enforceSilentMenuLayers(0);

    // Back to menu
    if (Input.pressed("Back")) {
      Input.consume("Back");
      changeScreen("menu");
      return;
    }

    // Arm confirm so held confirm doesn’t instantly start
    if (!Input.isDown("Confirm")) this._armedConfirm = true;

    // Enemy select
    if (Input.pressed("Up")) {
      Input.consume("Up");
      this._enemyIndex = (this._enemyIndex - 1 + this._enemies.length) % this._enemies.length;
    }
    if (Input.pressed("Down")) {
      Input.consume("Down");
      this._enemyIndex = (this._enemyIndex + 1) % this._enemies.length;
    }

    // Level change
    if (Input.pressed("Left")) {
      Input.consume("Left");
      this._level = Math.max(1, this._level - 1);
    }
    if (Input.pressed("Right")) {
      Input.consume("Right");
      this._level = Math.min(99, this._level + 1);
    }

    // Preset toggle (optional)
    if (Input.pressed("q")) {
      Input.consume("q");
      this._presetIndex = (this._presetIndex - 1 + PRESETS.length) % PRESETS.length;
    }
    if (Input.pressed("e")) {
      Input.consume("e");
      this._presetIndex = (this._presetIndex + 1) % PRESETS.length;
    }

    // Confirm -> go to LevelIntro with dev config
    if (this._armedConfirm && Input.pressed("Confirm")) {
      Input.consume("Confirm");
      this._armedConfirm = false;

      const enemy = this._enemies[this._enemyIndex];
      const preset = PRESETS[this._presetIndex];
      const presetMovies = preset.titles.map(findMovieByTitle);

      if (!enemy || presetMovies.some((m) => !m)) return;

      GameState.devBattleConfig = {
        enabled: true,
        level: this._level,
        enemyId: enemy.id,
        partyMovieIds: presetMovies.map((m) => m.id)
      };

      changeScreen("levelIntro");
    }
  },

  render(ctx) {
    // (render unchanged)
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SCREEN.W, SCREEN.H);

    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    ctx.fillText("DEV BATTLE SETUP", 12, 24);

    const enemy = this._enemies[this._enemyIndex];
    const preset = PRESETS[this._presetIndex];

    ctx.font = "12px monospace";
    ctx.fillText(`Enemy: ${enemy?.name || enemy?.id || "(none)"}  [${enemy?.id || ""}]`, 12, 52);
    ctx.fillText(`Level: ${this._level}  (Left/Right)`, 12, 70);
    ctx.fillText(`Preset: ${preset.name}  (Q/E)`, 12, 88);
    ctx.fillStyle = "#aaa";
    ctx.fillText("Up/Down enemy | Enter confirm | Backspace/Esc back", 12, 110);

    const posterY = 125;
    const posterW = 72;
    const posterH = 100;
    const gap = 12;
    const startX = 12;

    const presetMovies = preset.titles.map(findMovieByTitle);

    for (let i = 0; i < 4; i++) {
      const x = startX + i * (posterW + gap);
      const y = posterY;

      ctx.strokeStyle = "#666";
      ctx.strokeRect(x, y, posterW, posterH);

      const m = presetMovies[i];
      if (!m) {
        ctx.fillStyle = "#f66";
        ctx.fillText("MISSING", x + 6, y + 16);
        continue;
      }

      const rec = this._posterCache.get(m);
      if (rec && rec.ok && rec.img) {
        const img = rec.img;
        const scale = Math.min(posterW / img.width, posterH / img.height);
        const dw = Math.floor(img.width * scale);
        const dh = Math.floor(img.height * scale);
        const dx = x + Math.floor((posterW - dw) / 2);
        const dy = y + Math.floor((posterH - dh) / 2);
        ctx.drawImage(img, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = "#bbb";
        ctx.font = "10px monospace";
        const label = (m.shortTitle || m.title || "").slice(0, 14);
        ctx.fillText(label, x + 4, y + 16);
        ctx.font = "12px monospace";
      }
    }

    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    ctx.fillText("Enemies:", 12, 245);

    const n = this._enemies.length;
    const center = this._enemyIndex;
    const windowSize = 5;

    for (let row = 0; row < windowSize; row++) {
      const idx = ((center - 2 + row) % n + n) % n;
      const e = this._enemies[idx];
      const y = 262 + row * 14;

      if (idx === center) {
        ctx.fillStyle = "#ff0";
        ctx.fillText(`> ${e.name || e.id}`, 12, y);
      } else {
        ctx.fillStyle = "#aaa";
        ctx.fillText(`  ${e.name || e.id}`, 12, y);
      }
    }
  }
};
