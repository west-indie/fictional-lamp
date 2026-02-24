// frontend/js/combat/stats.js

import { movieMeta } from "../data/movieMeta.js";

// Helper to clamp a value between min and max
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Convert a movie's actual runtime into the "effective" runtime
// according to your design:
//
// - if runtime < 150   → use actual runtime
// - if 150–204         → baseline of 165
// - if 205+            → baseline of 205
function getEffectiveRuntime(runtime) {
  if (runtime < 150) return runtime;
  if (runtime >= 150 && runtime <= 204) return 165;
  // 205 and above
  return 205;
}

// Genre bonuses: HP / ATK / DEF / crit / evasion.
// crit/evasion are decimals (0.05 = 5%)
const GENRE_BONUSES = {
  ACTION:       { hp: 0,   atk: 6,  def: -2, crit: 0.01, evade: 0.00 },
  ADVENTURE:    { hp: 6,   atk: 3,  def: 1,  crit: 0.00, evade: 0.00 },
  DRAMA:        { hp: 8,   atk: 0,  def: 1,  crit: 0.00, evade: 0.00 },
  COMEDY:       { hp: 5,   atk: 0,  def: 2,  crit: 0.00, evade: 0.03 },
  HORROR:       { hp: -2,  atk: 6,  def: 0,  crit: 0.04, evade: 0.00 },
  THRILLER:     { hp: 0,   atk: 5,  def: 1,  crit: 0.02, evade: 0.00 },
  SCIFI:        { hp: 0,   atk: 3,  def: 1,  crit: 0.01, evade: 0.00 },
  FANTASY:      { hp: 8,   atk: 1,  def: 0,  crit: 0.00, evade: 0.00 },
  ANIMATION:    { hp: -3,  atk: 0,  def: 3,  crit: 0.00, evade: 0.02 },
  MUSICAL:      { hp: 4,   atk: 3,  def: 1,  crit: 0.01, evade: 0.01 },
  MYSTERY:      { hp: 2,   atk: 2,  def: 2,  crit: 0.02, evade: 0.01 },
  CRIME:        { hp: 0,   atk: 3,  def: 1,  crit: 0.03, evade: 0.00 },
  ROMANCE:      { hp: 6,   atk: 0,  def: 1,  crit: 0.00, evade: 0.01 },
  DOCUMENTARY:  { hp: 0,   atk: -2, def: 4,  crit: 0.00, evade: 0.00 }
};

// Tone bonuses: HP / ATK / DEF / crit / evasion
const TONE_BONUSES = {
  SERIOUS: { hp: 0,  atk: 0, def: 2, crit: 0.00, evade: 0.00 },
  FUNNY:   { hp: 4,  atk: 0, def: 1, crit: 0.01, evade: 0.05 },
  DARK:    { hp: -2, atk: 0, def: 0, crit: 0.04, evade: 0.00 },
  EPIC:    { hp: 8,  atk: 0, def: 1, crit: 0.01, evade: 0.00 },
  QUIRKY:  { hp: 0,  atk: 0, def: 0, crit: 0.02, evade: 0.02 } // extra-turn behavior handled in battle.js
};

// Era bonus table from our design PLUS crit boosts.
// Classic       <= 1965    → +HP, +DEF, -ATK, 0 crit
// New Hollywood 1966–1980  → +HP, +DEF, +ATK, small crit
// Modern        1981–2000  → balanced buffs, medium crit
// Contemporary  >= 2001    → ATK & crit heavy
const ERA_BONUSES = {
  CLASSIC:       { hp: 10, def: 3, atk: -1, crit: 0.00 },
  NEW_HOLLYWOOD: { hp: 7,  def: 2, atk: 2,  crit: 0.01 },
  MODERN:        { hp: 4,  def: 1, atk: 4,  crit: 0.02 },
  CONTEMPORARY:  { hp: 0,  def: 0, atk: 5,  crit: 0.04 }
};

function getMetaForMovie(movie) {
  if (!movie || !movie.id) return null;
  return movieMeta[movie.id] || null;
}

function getEraFromYear(year) {
  if (!year) return "MODERN"; // safe default
  if (year <= 1965) return "CLASSIC";
  if (year >= 1966 && year <= 1980) return "NEW_HOLLYWOOD";
  if (year >= 1981 && year <= 2000) return "MODERN";
  return "CONTEMPORARY";
}

// Main function to calculate stats from a movie object
// movie is expected to have: { id, runtime, imdb }
export function calculateMovieStats(movie) {
  const runtime = movie.runtime || 0;
  const imdb = movie.imdb || 0;

  // 1) Effective runtime bucketing
  const effectiveRuntime = getEffectiveRuntime(runtime);

  // 2) Normalized runtime for HP & ATK (0–1) based on 80–205 window
  const MIN_RUNTIME = 80;
  const MAX_RUNTIME = 205;

  const rtClamped = clamp(effectiveRuntime, MIN_RUNTIME, MAX_RUNTIME);
  const rtNorm = (rtClamped - MIN_RUNTIME) / (MAX_RUNTIME - MIN_RUNTIME);

  // 3) Normalized IMDb rating (0–1) based on 6.5–9.2 window
  const MIN_RATING = 6.5;
  const MAX_RATING = 9.2;

  const ratingClamped = clamp(imdb, MIN_RATING, MAX_RATING);
  const imNorm = (ratingClamped - MIN_RATING) / (MAX_RATING - MIN_RATING);

  // 4) Base formulas (before genre/tone/era bonuses)

  // HP: mostly runtime, some IMDb
  let hp = 70 + rtNorm * 60 + imNorm * 20;

  // DEF: mostly IMDb, some runtime
  let def = 4 + imNorm * 10 + rtNorm * 4;

  // ATK: balanced mix of runtime and IMDb
  let atk = 6 + (rtNorm + imNorm) * 5;

  // 5) Base crit & evasion
  // Start from modest universal values, then layer bonuses.
  let critChance = 0.05; // 5% base crit for everyone
  let evasion = 0.02;    // 2% base evasion

  // 6) Apply genre, tone, and era bonuses

  const meta = getMetaForMovie(movie);

  let bonusHp = 0;
  let bonusAtk = 0;
  let bonusDef = 0;
  let bonusCrit = 0;
  let bonusEvade = 0;

  let toneValue = null;
  let eraValue = null;

  if (meta) {
    const { primaryGenre, secondaryGenre, tone, year } = meta;

    toneValue = tone || null;
    eraValue = getEraFromYear(year);

    const hasSecondary = !!secondaryGenre;

    // --- Genre bonuses (support single or dual) ---
    if (primaryGenre && GENRE_BONUSES[primaryGenre]) {
      const g = GENRE_BONUSES[primaryGenre];
      const factor = hasSecondary ? 0.7 : 1.2; // primary: 120% if single, 70% if dual
      bonusHp    += g.hp * factor;
      bonusAtk   += g.atk * factor;
      bonusDef   += g.def * factor;
      bonusCrit  += (g.crit || 0) * factor;
      bonusEvade += (g.evade || 0) * factor;
    }

    if (secondaryGenre && GENRE_BONUSES[secondaryGenre]) {
      const g = GENRE_BONUSES[secondaryGenre];
      const factor = 0.5; // secondary: 50% of its base bonus
      bonusHp    += g.hp * factor;
      bonusAtk   += g.atk * factor;
      bonusDef   += g.def * factor;
      bonusCrit  += (g.crit || 0) * factor;
      bonusEvade += (g.evade || 0) * factor;
    }

    // --- Tone bonuses ---
    if (tone && TONE_BONUSES[tone]) {
      const t = TONE_BONUSES[tone];
      bonusHp    += t.hp;
      bonusAtk   += t.atk;
      bonusDef   += t.def;
      bonusCrit  += t.crit || 0;
      bonusEvade += t.evade || 0;
    }

    // --- Era bonuses ---
    const era = eraValue;
    const e = ERA_BONUSES[era];
    if (e) {
      bonusHp   += e.hp;
      bonusAtk  += e.atk;
      bonusDef  += e.def;
      bonusCrit += e.crit || 0;
    }
  }

  // 7) Apply all bonuses
  hp  += bonusHp;
  atk += bonusAtk;
  def += bonusDef;

  critChance += bonusCrit;
  evasion    += bonusEvade;

  // Clamp crit and evasion to sensible ranges:
  critChance = clamp(critChance, 0, 0.5); // max 50%
  evasion    = clamp(evasion, 0, 0.35);   // max 35%

  // ✅ GLOBAL BUFF: add +10 to final stats for ALL movies (after all bonuses)
  const GLOBAL_FINAL_STAT_BONUS = 10;
  hp  += GLOBAL_FINAL_STAT_BONUS;
  //atk += GLOBAL_FINAL_STAT_BONUS;
  //def += GLOBAL_FINAL_STAT_BONUS;

  // Round and enforce minimums
  hp  = Math.max(1, Math.round(hp));
  atk = Math.max(1, Math.round(atk));
  def = Math.max(1, Math.round(def));

  return {
    atk,
    def,
    maxHp: hp,
    critChance,
    evasion,
    tone: toneValue,
    era: eraValue
  };
}
