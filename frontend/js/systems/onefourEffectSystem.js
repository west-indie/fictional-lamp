// frontend/js/systems/onefourEffectSystem.js
//
// One/Four pick campaign effects (V2 - additive + supports ALL genre systems)
//
// ✅ Design (locked in):
// - Additive bonuses everywhere (multipliers are 1 + sum(bonuses))
// - First Pick (slot 0):
//    - Strong SELF effect from Genre 1 (primary)  → "MAIN(Self)" tier
//    - Strong TEAM effect from Genre 2 (secondary) → "TEAM" tier
// - Fourth Pick (slot 3):
//    - Two TEAM effects (from both genres) using the "FOUR" tier
//    - BOTH are multiplied by IMDb scaling (no cap)
// - Effects persist across campaign levels (until you start a new run)
// - Per-battle growth tracking resets each battle (Musical/SciFi/Mystery roll history, etc)
// - This file:
//    1) Computes + stores the campaign effects
//    2) Applies STAT bonuses to battle actors at battle init
//    3) Exposes a unified "bonus bundle" for other systems (items/specials/cooldowns/attack chains)
//
// NOTE:
// - Stats applied here: atk/def/hp/critChance/evasion
// - Non-stat systems (Mystery/Adventure/Fantasy/Musical/SciFi/Comedy/Thriller) are exposed via
//   getOneFourBonusBundle(GameState) so your item/special systems can consume them.
//
// Requires:
// - movieMeta.js for genres
// - movies.js for imdb values

import { movieMeta } from "../data/movieMeta.js";
import { movies } from "../data/movies.js";

// -----------------------------
// Helpers
// -----------------------------
function clampMin(n, min) {
  return Math.max(min, n);
}

function getMovieId(movie) {
  return movie?.id || null;
}

function getMovieTitle(movie) {
  return movie?.shortTitle || movie?.title || "Unknown";
}

function getPrimaryGenre(movie) {
  const id = getMovieId(movie);
  return id ? (movieMeta?.[id]?.primaryGenre || null) : null;
}

function getSecondaryGenre(movie) {
  const id = getMovieId(movie);
  return id ? (movieMeta?.[id]?.secondaryGenre || null) : null;
}

function normalizeGenre(g) {
  const s = String(g || "").trim().toUpperCase();
  return s || "UNKNOWN";
}

function getImdbScore(movie) {
  // 1) Prefer score directly on the movie object (usual path from movies.js)
  const direct =
    movie?.imdbScore ??
    movie?.imdb ??
    movie?.rating ??
    movie?.score ??
    movie?.imdb_rating ??
    null;

  let n = Number(direct);
  if (Number.isFinite(n)) return clampMin(n, 0); // ✅ NO upper cap

  // 2) Fallback: look up canonical movie record from movies.js by id
  const id = getMovieId(movie);
  if (!id) return null;

  const canonical = Array.isArray(movies) ? movies.find((m) => m?.id === id) : null;
  const raw = canonical?.imdbScore ?? canonical?.imdb ?? canonical?.rating ?? canonical?.score ?? null;

  n = Number(raw);
  return Number.isFinite(n) ? clampMin(n, 0) : null; // ✅ NO upper cap
}

// IMDb scaling (no cap) – anchor interpolation + linear continuation
export function imdbScale(imdb) {
  if (!Number.isFinite(imdb)) return 1.0;

  // Anchor points (x = imdb, y = multiplier)
  const points = [
    [3.0, 1.0],
    [4.0, 1.2],
    [5.0, 1.4],
    [5.8, 1.7],
    [8.0, 3.1],
    [9.0, 4.2]
  ];

  if (imdb <= points[0][0]) return points[0][1];

  // Between anchors → linear interpolate
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    if (imdb <= x2) {
      const t = (imdb - x1) / (x2 - x1);
      return y1 + t * (y2 - y1);
    }
  }

  // Above highest anchor → continue last slope (NO CAP)
  const [x1, y1] = points[points.length - 2];
  const [x2, y2] = points[points.length - 1];
  const slope = (y2 - y1) / (x2 - x1);

  return y2 + (imdb - x2) * slope;
}

function addMods(a, b) {
  const out = { ...(a || {}) };
  for (const k of Object.keys(b || {})) out[k] = (out[k] || 0) + b[k];
  return out;
}

function scaleMods(mods, factor) {
  const out = {};
  for (const k of Object.keys(mods || {})) out[k] = mods[k] * factor;
  return out;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// -----------------------------
// Genre effect tables (V2 boosted)
// Tiers: MAIN (self), TEAM (team), FOUR (team-from-4th)
// -----------------------------
//
// This is the SINGLE source of truth for:
// - stat bonuses (atk/def/hp/crit/eva) applied at battle init
// - item/special/cooldown/attack-chain bonuses exposed to other systems
//
// Represent everything as additive bonuses.
// Example: atkPct: 0.60 means ATK *= (1 + 0.60) when applied.

const GENRE_EFFECTS = {
  ACTION: {
    stat: {
      MAIN: { atkPct: 0.60 },
      TEAM: { atkPct: 0.25 },
      FOUR: { atkPct: 0.15 }
    }
  },

  DRAMA: {
    stat: {
      MAIN: { defPct: 0.60 },
      TEAM: { defPct: 0.25 },
      FOUR: { defPct: 0.15 }
    }
  },

  HORROR: {
    stat: {
      MAIN: { critPct: 0.18 },
      TEAM: { critPct: 0.10 },
      FOUR: { critPct: 0.06 }
    }
  },

  CRIME: {
    stat: {
      MAIN: { atkPct: 0.35 }, // crit damage is non-stat system; exposed below
      TEAM: { atkPct: 0.20 },
      FOUR: { atkPct: 0.10 }
    },
    critDamage: {
      MAIN: { critDmgAdd: 0.40 },
      TEAM: { critDmgAdd: 0.25 },
      FOUR: { critDmgAdd: 0.15 }
    }
  },

  ROMANCE: {
    stat: {
      MAIN: { hpPct: 0.50 },
      TEAM: { hpPct: 0.30 },
      FOUR: { hpPct: 0.20 }
    }
  },

  DOCUMENTARY: {
    stat: {
      MAIN: { defPct: 0.55 },
      TEAM: { defPct: 0.30 },
      FOUR: { defPct: 0.20 }
    }
  },

  ANIMATION: {
    stat: {
      MAIN: { hpPct: 0.45, defPct: 0.25 },
      TEAM: { hpPct: 0.25, defPct: 0.15 },
      FOUR: { hpPct: 0.15 }
    }
  },

  // -----------------------------
  // Non-stat “system” genres
  // These are NOT applied here to actor base stats,
  // but are exposed to item/special logic via getOneFourBonusBundle().
  // -----------------------------

  ADVENTURE: {
    itemMagnitude: {
      MAIN: { itemMagAdd: 0.60 },
      TEAM: { itemMagAdd: 0.25 },
      FOUR: { itemMagAdd: 0.15 }
    }
  },

  MYSTERY: {
    itemRandomStat: {
      // bonus added to the rolled stat multiplier (1 + bonus)
      MAIN: { rollBonus: 0.75 },
      TEAM: { rollBonus: 0.35 },
      FOUR: { rollBonus: 0.20 },
      rules: {
        // You asked:
        // ✅ cannot buff the same stat back-to-back
        noBackToBackSameStat: true,
        pool: ["ATK", "DEF", "CRIT", "EVA"]
      }
    }
  },

  FANTASY: {
    specialMagnitude: {
      MAIN: { specialMagAdd: 0.85 },
      TEAM: { specialMagAdd: 0.45 },
      FOUR: { specialMagAdd: 0.25 },
      rules: {
        magnitudeOnly: true // does not affect cooldown/reuse/cost
      }
    }
  },

  MUSICAL: {
    specialSequence: {
      // + per step, where step = (chainLen - 1), chain cap = 5 (steps max 4)
      MAIN: { perStepAdd: 0.30 },
      TEAM: { perStepAdd: 0.14 },
      FOUR: { perStepAdd: 0.08 },
      rules: {
        chainCap: 5,
        resetOnNonSpecial: true
      }
    }
  },

  SCIFI: {
    specialReuseStacks: {
      // + per stack for that specific special; per-actor per-special; reset each battle
      MAIN: { perStackAdd: 0.25 },
      TEAM: { perStackAdd: 0.15 },
      FOUR: { perStackAdd: 0.08 },
      rules: {
        stackCap: 5,
        perActorPerSpecial: true
      }
    }
  },

  COMEDY: {
    cooldownRefund: {
      // ✅ Reverted numbers, and you requested: remove caps
      MAIN: { refundChance: 0.18 },
      TEAM: { refundChance: 0.15 },
      FOUR: { refundChance: 0.05 },
      rules: {
        onlyLastUsedSpecial: true,
        noRecursion: true
      }
    }
  },

  THRILLER: {
    attackFollowupCrit: {
      // ✅ Reverted numbers, and you requested: remove caps
      MAIN: { followupChance: 0.20 },
      TEAM: { followupChance: 0.10 },
      FOUR: { followupChance: 0.05 },
      rules: {
        basicAttacksOnly: true,
        maxOneFollowupPerTurn: true,
        noChain: true
      }
    }
  }
};

function getNonStatDetailsForGenre(genre, tier) {
  const g = GENRE_EFFECTS?.[genre];
  if (!g) return null;

  // COMEDY: cooldownRefund.refundChance
  if (g.cooldownRefund?.[tier]?.refundChance != null) {
    return {
      kind: "COMEDY_COOLDOWN_REFUND",
      chance: g.cooldownRefund[tier].refundChance // decimal, e.g. 0.15
    };
  }

  // THRILLER: attackFollowupCrit.followupChance
  if (g.attackFollowupCrit?.[tier]?.followupChance != null) {
    return {
      kind: "THRILLER_FOLLOWUP_CRIT",
      chance: g.attackFollowupCrit[tier].followupChance
    };
  }

  // MYSTERY: itemRandomStat.rollBonus (not chance; deterministic bonus)
  if (g.itemRandomStat?.[tier]?.rollBonus != null) {
    return {
      kind: "MYSTERY_ITEM_ROLL_BONUS",
      rollBonus: g.itemRandomStat[tier].rollBonus, // decimal, e.g. 0.35
      rules: g.itemRandomStat.rules || null
    };
  }

  return null;
}


function getTierBlock(genreKey, blockName, tier) {
  const g = GENRE_EFFECTS[genreKey];
  if (!g) return null;
  const block = g[blockName];
  if (!block) return null;
  return block[tier] || null;
}

function getStatModsForGenreTier(genreKey, tier) {
  const g = GENRE_EFFECTS[genreKey];
  if (!g?.stat?.[tier]) return {};
  return g.stat[tier] || {};
}

// -----------------------------
// Effect objects stored in GameState.campaign.effects
// -----------------------------
//
// first effect = {
//   kind:"first",
//   movieId, title, primaryGenre, secondaryGenre,
//   selfTier:"MAIN", teamTier:"TEAM",
//   selfModsStat, teamModsStat,
//   bundleSelf, bundleTeam,
//   headline
// }
//
// fourth effect = {
//   kind:"fourth",
//   movieId, title, primaryGenre, secondaryGenre,
//   tier:"FOUR",
//   imdb, scaleFactor,
//   teamModsStatA, teamModsStatB,
//   bundleTeamA, bundleTeamB,
//   headline
// }

// Build a unified “bundle” that downstream systems can consume.
// The bundle is additive and categorized by system.
function buildBonusBundleForGenreTier(genreKey, tier) {
  const key = normalizeGenre(genreKey);

  const bundle = {
    genre: key,
    tier,
    // stats (applied here at battle init)
    stat: getStatModsForGenreTier(key, tier),

    // non-stat systems (consumed by other systems)
    itemMagnitude: getTierBlock(key, "itemMagnitude", tier) || null,
    itemRandomStat: getTierBlock(key, "itemRandomStat", tier) || null,
    specialMagnitude: getTierBlock(key, "specialMagnitude", tier) || null,
    specialSequence: getTierBlock(key, "specialSequence", tier) || null,
    specialReuseStacks: getTierBlock(key, "specialReuseStacks", tier) || null,
    cooldownRefund: getTierBlock(key, "cooldownRefund", tier) || null,
    attackFollowupCrit: getTierBlock(key, "attackFollowupCrit", tier) || null,
    critDamage: getTierBlock(key, "critDamage", tier) || null,

    // rule metadata (optional)
    rules: {
      itemRandomStat: GENRE_EFFECTS[key]?.itemRandomStat?.rules || null,
      specialSequence: GENRE_EFFECTS[key]?.specialSequence?.rules || null,
      specialReuseStacks: GENRE_EFFECTS[key]?.specialReuseStacks?.rules || null,
      cooldownRefund: GENRE_EFFECTS[key]?.cooldownRefund?.rules || null,
      attackFollowupCrit: GENRE_EFFECTS[key]?.attackFollowupCrit?.rules || null,
      specialMagnitude: GENRE_EFFECTS[key]?.specialMagnitude?.rules || null
    }
  };

  return bundle;
}

export function computeFirstPickEffect(movie, headlineText = "") {
  const primary = normalizeGenre(getPrimaryGenre(movie));
  const secondary = normalizeGenre(getSecondaryGenre(movie));

  // First pick uses:
  // - SELF uses MAIN of primary
  // - TEAM uses TEAM of secondary
  const selfTier = "MAIN";
  const teamTier = "TEAM";

  const selfBundle = buildBonusBundleForGenreTier(primary, selfTier);
  const teamBundle = buildBonusBundleForGenreTier(secondary, teamTier);

  // Pull display-friendly non-stat details from the bundles
  // (This avoids depending on GENRE_EFFECTS directly and stays consistent with bundle logic.)
  const selfNonStat = extractNonStatForDisplay(selfBundle);
  const teamNonStat = extractNonStatForDisplay(teamBundle);

  return {
    kind: "first",
    movieId: getMovieId(movie),
    title: getMovieTitle(movie),
    primaryGenre: primary,
    secondaryGenre: secondary,

    selfTier,
    teamTier,

    // only stat mods are applied directly by applyOneFourEffectsToParty()
    selfModsStat: selfBundle.stat || {},
    teamModsStat: teamBundle.stat || {},

    // downstream systems use these bundles
    bundleSelf: selfBundle,
    bundleTeam: teamBundle,

    // NEW: used by pick screens for % / non-stat messaging
    selfNonStat,
    teamNonStat,

    headline: headlineText || "Group Leader Takes the Reins!"
  };
}

export function computeFourthPickEffect(movie, headlineText = "") {
  const primary = normalizeGenre(getPrimaryGenre(movie));
  const secondary = normalizeGenre(getSecondaryGenre(movie));

  const imdb = getImdbScore(movie);
  const sf = imdbScale(imdb); // ✅ NO CAP

  const tier = "FOUR";

  const aBundle = buildBonusBundleForGenreTier(primary, tier);
  const bBundle = buildBonusBundleForGenreTier(secondary, tier);

  // Stat mods for 4th pick are FOUR tier and IMDb scaled
  const teamModsStatA = scaleMods(aBundle.stat || {}, sf);
  const teamModsStatB = scaleMods(bBundle.stat || {}, sf);

  // Also scale non-stat bundles that are magnitude-based / chance-based
  // We only scale the numeric fields, preserving rules.
  function scaleBundle(bundle) {
    if (!bundle) return bundle;
    const out = { ...bundle, scaleFactor: sf, imdb };

    const scaleBlock = (blk) => {
      if (!blk) return blk;
      const b = { ...blk };
      for (const k of Object.keys(b)) {
        if (typeof b[k] === "number") b[k] = b[k] * sf;
      }
      return b;
    };

    out.itemMagnitude = scaleBlock(out.itemMagnitude);
    out.itemRandomStat = scaleBlock(out.itemRandomStat);
    out.specialMagnitude = scaleBlock(out.specialMagnitude);
    out.specialSequence = scaleBlock(out.specialSequence);
    out.specialReuseStacks = scaleBlock(out.specialReuseStacks);
    out.cooldownRefund = scaleBlock(out.cooldownRefund);
    out.attackFollowupCrit = scaleBlock(out.attackFollowupCrit);
    out.critDamage = scaleBlock(out.critDamage);

    return out;
  }

  const scaledA = scaleBundle(aBundle);
  const scaledB = scaleBundle(bBundle);

  // NEW: pull display non-stat from the SCALED bundles so UI matches gameplay
  const teamNonStatA = extractNonStatForDisplay(scaledA);
  const teamNonStatB = extractNonStatForDisplay(scaledB);

  return {
    kind: "fourth",
    movieId: getMovieId(movie),
    title: getMovieTitle(movie),
    primaryGenre: primary,
    secondaryGenre: secondary,

    imdb,
    scaleFactor: sf,
    tier,

    teamModsStatA,
    teamModsStatB,

    bundleTeamA: scaledA,
    bundleTeamB: scaledB,

    // NEW: used by pick screens for % / non-stat messaging
    teamNonStatA,
    teamNonStatB,

    headline: headlineText || "The Backbone Comes in Clutch"
  };
}

/**
 * Extract just what the UI needs for % messaging:
 * - COMEDY: chance (refundChance)
 * - THRILLER: chance (followupChance)
 * - MYSTERY: rollBonus
 *
 * Returns:
 *   { kind: "...", chance: 0.xx } OR { kind: "...", rollBonus: 0.xx } OR null
 */
function extractNonStatForDisplay(bundle) {
  if (!bundle || typeof bundle !== "object") return null;

  // COMEDY
  if (bundle.cooldownRefund?.refundChance != null) {
    return {
      kind: "COMEDY_COOLDOWN_REFUND",
      chance: bundle.cooldownRefund.refundChance
    };
  }

  // THRILLER
  if (bundle.attackFollowupCrit?.followupChance != null) {
    return {
      kind: "THRILLER_FOLLOWUP_CRIT",
      chance: bundle.attackFollowupCrit.followupChance
    };
  }

  // MYSTERY
  if (bundle.itemRandomStat?.rollBonus != null) {
    return {
      kind: "MYSTERY_ITEM_ROLL_BONUS",
      rollBonus: bundle.itemRandomStat.rollBonus,
      rules: bundle.itemRandomStat.rules || null
    };
  }

  return null;
}


// -----------------------------
// Applying STAT mods to battle actors
// -----------------------------
function applyStatModsToActor(actor, mods) {
  if (!actor || !mods) return;

  // ATK / DEF
  if (mods.atkPct) actor.atk = Math.round(actor.atk * (1 + mods.atkPct));
  if (mods.defPct) actor.def = Math.round(actor.def * (1 + mods.defPct));

  // HP (maxHp and current hp shift together)
  if (mods.hpPct) {
    const newMax = Math.round(actor.maxHp * (1 + mods.hpPct));
    const delta = newMax - actor.maxHp;
    actor.maxHp = newMax;
    actor.hp = Math.min(actor.maxHp, actor.hp + delta);
  }

  // Crit / evasion (still clamped by engine constraints)
  if (mods.critPct) actor.critChance = clamp(actor.critChance + mods.critPct, 0, 0.95);
  if (mods.evasionPct) actor.evasion = clamp(actor.evasion + mods.evasionPct, 0, 0.60);
}

export function applyOneFourEffectsToParty(GameState, partyActors) {
  if (!GameState || !Array.isArray(partyActors) || partyActors.length === 0) return;
  if (!GameState.campaign) return;

  // Apply-once-per-battle guard
  if (GameState.campaign._onefourAppliedThisBattle) return;

  const first = GameState.campaign?.effects?.first || null;
  const fourth = GameState.campaign?.effects?.fourth || null;

  // 1) First pick:
  //    - TEAM stat mods to everyone (from secondary genre TEAM tier)
  //    - SELF stat mods only to the slot0 movie actor (from primary genre MAIN tier)
  if (first) {
    // team
    for (const a of partyActors) applyStatModsToActor(a, first.teamModsStat);

    // self leader
    if (first.movieId) {
      const leader = partyActors.find((a) => a?.movie?.id === first.movieId) || null;
      if (leader) applyStatModsToActor(leader, first.selfModsStat);
    }
  }

  // 2) Fourth pick:
  //    - TWO IMDb-scaled FOUR-tier stat mods applied to everyone
  if (fourth) {
    for (const a of partyActors) {
      applyStatModsToActor(a, fourth.teamModsStatA);
      applyStatModsToActor(a, fourth.teamModsStatB);
    }
  }

  GameState.campaign._onefourAppliedThisBattle = true;
}

export function clearOneFourBattleApplyFlag(GameState) {
  if (!GameState?.campaign) return;
  GameState.campaign._onefourAppliedThisBattle = false;
}

// -----------------------------
// Bonus bundle for other systems (items/specials/cooldowns/attacks)
// -----------------------------
//
// This returns ONE merged object that downstream code can query.
// It's additive by default (e.g., itemMagAdd values are additive bonuses).
//
// Example usage in itemSystem:
//   const bonus = getOneFourBonusBundle(GameState);
//   const itemMagBonus = bonus.itemMagnitudeAdd; // additive
//   finalMag *= (1 + itemMagBonus)
//
// Mystery needs per-actor memory "last rolled stat" — stored on GameState.campaign.runtime.

function ensureCampaignRuntime(GameState) {
  if (!GameState.campaign) {
    GameState.campaign = {
      onefourShown: false,
      effects: { first: null, fourth: null },
      _onefourAppliedThisBattle: false,
      flavor: {},
      runtime: {}
    };
  }
  if (!GameState.campaign.effects) GameState.campaign.effects = { first: null, fourth: null };
  if (!GameState.campaign.runtime) GameState.campaign.runtime = {};
}

// Reset per-battle growth trackers
export function resetOneFourRuntimeForBattle(GameState) {
  ensureCampaignRuntime(GameState);

  GameState.campaign.runtime = {
    // Musical
    musicalChain: 0,

    // Sci-Fi: { [actorIdOrMovieId]: { [specialId]: stacks } }
    scifiStacks: {},

    // Mystery: { [actorIdOrMovieId]: "ATK"/"DEF"/"CRIT"/"EVA" }
    mysteryLastStat: {},

    // Thriller: { turnId: boolean } handled in battle system if you want, but stash slot here
    thrillerFollowedThisTurn: false,

    // Comedy: store last used special per actor if you want to centralize it
    comedyLastSpecial: {}
  };
}

// Merge the active onefour effects into a single consumable bundle
export function getOneFourBonusBundle(GameState) {
  ensureCampaignRuntime(GameState);

  const first = GameState.campaign?.effects?.first || null;
  const fourth = GameState.campaign?.effects?.fourth || null;

  // Aggregate additive bonuses
  let itemMagnitudeAdd = 0;
  let specialMagnitudeAdd = 0;

  // Musical per-step adds (store values, battle will apply with chain steps)
  let musicalPerStepAdd = 0;
  let musicalChainCap = 5;
  let musicalResetOnNonSpecial = true;

  // Sci-Fi per-stack adds
  let scifiPerStackAdd = 0;
  let scifiStackCap = 5;

  // Mystery roll bonus
  let mysteryRollBonusAdd = 0;
  let mysteryNoBackToBack = true;
  let mysteryPool = ["ATK", "DEF", "CRIT", "EVA"];

  // Comedy cooldown refund chance
  let comedyRefundChanceAdd = 0;

  // Thriller followup chance
  let thrillerFollowupChanceAdd = 0;
  let thrillerOnePerTurn = true;
  let thrillerBasicOnly = true;

  // Crit damage additive (if/when you wire it into damage calc)
  let critDmgAdd = 0;

  function absorbBundle(bundle) {
    if (!bundle) return;

    // item magnitude
    if (bundle.itemMagnitude?.itemMagAdd) itemMagnitudeAdd += bundle.itemMagnitude.itemMagAdd;

    // special magnitude
    if (bundle.specialMagnitude?.specialMagAdd) specialMagnitudeAdd += bundle.specialMagnitude.specialMagAdd;

    // musical
    if (bundle.specialSequence?.perStepAdd) musicalPerStepAdd += bundle.specialSequence.perStepAdd;
    const mRules = bundle.rules?.specialSequence;
    if (mRules?.chainCap) musicalChainCap = mRules.chainCap;
    if (typeof mRules?.resetOnNonSpecial === "boolean") musicalResetOnNonSpecial = mRules.resetOnNonSpecial;

    // scifi
    if (bundle.specialReuseStacks?.perStackAdd) scifiPerStackAdd += bundle.specialReuseStacks.perStackAdd;
    const sRules = bundle.rules?.specialReuseStacks;
    if (sRules?.stackCap) scifiStackCap = sRules.stackCap;

    // mystery
    if (bundle.itemRandomStat?.rollBonus) mysteryRollBonusAdd += bundle.itemRandomStat.rollBonus;
    const yRules = bundle.rules?.itemRandomStat;
    if (yRules?.pool) mysteryPool = yRules.pool.slice();
    if (typeof yRules?.noBackToBackSameStat === "boolean") mysteryNoBackToBack = yRules.noBackToBackSameStat;

    // comedy
    if (bundle.cooldownRefund?.refundChance) comedyRefundChanceAdd += bundle.cooldownRefund.refundChance;

    // thriller
    if (bundle.attackFollowupCrit?.followupChance) thrillerFollowupChanceAdd += bundle.attackFollowupCrit.followupChance;
    const tRules = bundle.rules?.attackFollowupCrit;
    if (typeof tRules?.maxOneFollowupPerTurn === "boolean") thrillerOnePerTurn = tRules.maxOneFollowupPerTurn;
    if (typeof tRules?.basicAttacksOnly === "boolean") thrillerBasicOnly = tRules.basicAttacksOnly;

    // crime crit damage
    if (bundle.critDamage?.critDmgAdd) critDmgAdd += bundle.critDamage.critDmgAdd;
  }

  // First pick contributes:
  // - self bundle (applies conceptually to the leader only; downstream systems should check actor matching)
  // - team bundle (applies to everyone)
  absorbBundle(first?.bundleSelf);
  absorbBundle(first?.bundleTeam);

  // Fourth pick contributes:
  absorbBundle(fourth?.bundleTeamA);
  absorbBundle(fourth?.bundleTeamB);

  return {
    // additive magnitudes
    itemMagnitudeAdd,
    specialMagnitudeAdd,
    critDmgAdd,

    // Musical
    musicalPerStepAdd,
    musicalChainCap,
    musicalResetOnNonSpecial,

    // Sci-Fi
    scifiPerStackAdd,
    scifiStackCap,

    // Mystery
    mysteryRollBonusAdd,
    mysteryNoBackToBack,
    mysteryPool,

    // Comedy
    comedyRefundChanceAdd,

    // Thriller
    thrillerFollowupChanceAdd,
    thrillerOnePerTurn,
    thrillerBasicOnly
  };
}

// -----------------------------
// UI helpers (keep your existing UI usage)
// -----------------------------
export function formatGenres(primary, secondary) {
  const p = String(primary || "").trim().toUpperCase();
  const s = String(secondary || "").trim().toUpperCase();

  const bad = new Set(["", "NONE", "UNKNOWN", "NULL", "UNSET"]);
  if (bad.has(p) && bad.has(s)) return "UNKNOWN";
  if (!bad.has(p) && (bad.has(s) || s === p)) return p;
  if (bad.has(p) && !bad.has(s)) return s;
  return `${p} / ${s}`;
}

function fmtPctBonus(x) {
  // x is additive (0.60 => +60%)
  return `${Math.round(x * 100)}%`;
}

function summarizeStatMods(mods, labelPrefix = "", opts = {}) {
  const { emptyAsBlank = false } = opts || {};
  const prefix = labelPrefix ? String(labelPrefix) : "";

  if (!mods || typeof mods !== "object") {
    return emptyAsBlank ? "" : `${prefix}No stat change`;
  }

  const parts = [];

  if (typeof mods.atkPct === "number" && mods.atkPct !== 0) parts.push(`ATK +${fmtPctBonus(mods.atkPct)}`);
  if (typeof mods.defPct === "number" && mods.defPct !== 0) parts.push(`DEF +${fmtPctBonus(mods.defPct)}`);
  if (typeof mods.hpPct === "number" && mods.hpPct !== 0) parts.push(`HP +${fmtPctBonus(mods.hpPct)}`);
  if (typeof mods.critPct === "number" && mods.critPct !== 0) parts.push(`CRIT +${fmtPctBonus(mods.critPct)}`);
  if (typeof mods.evasionPct === "number" && mods.evasionPct !== 0) parts.push(`EVA +${fmtPctBonus(mods.evasionPct)}`);

  if (parts.length === 0) {
    return emptyAsBlank ? "" : `${prefix}No stat change`;
  }

  const s = parts.join("  ");
  return prefix ? `${prefix}${s}` : s;
}

export function describeFirstPick(effect) {
  if (!effect) return ["", ""];
  return [
    summarizeStatMods(effect.selfModsStat, "Self: ", { emptyAsBlank: true }),
    summarizeStatMods(effect.teamModsStat, "Team: ", { emptyAsBlank: true })
  ];
}

export function describeFourthPick(effect) {
  if (!effect) return ["", ""];
  return [
    summarizeStatMods(effect.teamModsStatA, "Team: ", { emptyAsBlank: true }),
    summarizeStatMods(effect.teamModsStatB, "Team: ", { emptyAsBlank: true })
  ];
}


