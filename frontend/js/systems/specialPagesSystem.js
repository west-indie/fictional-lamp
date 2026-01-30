// frontend/js/systems/specialPagesSystem.js
//
// Helpers for paged signature specials (e.g. Office Space pages).
// Keeps battle.js from holding paging logic.
//
// This module does NOT execute specials; it just:
// - detects pages
// - clamps/toggles index
// - builds a signatureMap override for the current page
// - resolves a specials list via getResolvedSpecialsForActor
// - (NEW) optionally filters out genre specials per movie/page rules
//
// NEW FEATURE:
// - For SOME movies with pages, you can hide genre specials on specific pages.
// - For OTHER movies with pages, genre specials remain.
//
// How to configure (in specials data):
// specials[movieId] can now optionally be:
//   { pages: [...], pageMeta: [ { includeGenre: true }, { includeGenre: false } ] }
//
// If pageMeta is missing, includeGenre defaults to true for all pages.
//
// Exports:
// - getSpecialPagesForMovie
// - getSpecialPageCount
// - clampPageIndex
// - canToggleSpecialPages
// - getSignatureMapForActorPage
// - resolveSpecialsForActorCurrentPage
// - toggleSpecialPageInState

// -----------------------------
// Page discovery + indexing
// -----------------------------
export function getSpecialPagesForMovie(movieId, specialsMap) {
  const entry = specialsMap?.[movieId];
  if (!entry) return null;

  if (entry && typeof entry === "object" && Array.isArray(entry.pages) && entry.pages.length > 0) {
    return entry.pages;
  }

  return null;
}

export function getSpecialPageCount(movieId, specialsMap) {
  const pages = getSpecialPagesForMovie(movieId, specialsMap);
  return pages ? pages.length : 0;
}

export function clampPageIndex(movieId, pageIndex, specialsMap) {
  const count = getSpecialPageCount(movieId, specialsMap);
  if (count <= 0) return 0;
  const idx = Number(pageIndex) || 0;
  return ((idx % count) + count) % count;
}

export function canToggleSpecialPages(actor, specialsMap) {
  const movieId = actor?.movie?.id;
  if (!movieId) return false;
  return getSpecialPageCount(movieId, specialsMap) > 1;
}

// -----------------------------
// Per-page meta (NEW)
// -----------------------------
function getPageMetaArrayForMovie(movieId, specialsMap) {
  const entry = specialsMap?.[movieId];
  if (!entry || typeof entry !== "object") return null;
  if (!Array.isArray(entry.pageMeta) || entry.pageMeta.length === 0) return null;
  return entry.pageMeta;
}

// includeGenre defaults to true unless explicitly turned off for that page
export function getIncludeGenreForMoviePage(movieId, pageIndex, specialsMap) {
  const count = getSpecialPageCount(movieId, specialsMap);
  if (count <= 0) return true;

  const idx = clampPageIndex(movieId, pageIndex, specialsMap);
  const metaArr = getPageMetaArrayForMovie(movieId, specialsMap);
  if (!metaArr) return true;

  const meta = metaArr[idx];
  if (!meta || typeof meta !== "object") return true;

  // if includeGenre is explicitly false, we hide genre specials
  if (meta.includeGenre === false) return false;
  return true;
}

// -----------------------------
// Signature-map override
// -----------------------------
/**
 * Build a signature map override for actor's selected page.
 * If no pages or only one page, returns the original specialsMap.
 */
export function getSignatureMapForActorPage(actor, pageIndex, specialsMap) {
  const movieId = actor?.movie?.id;
  if (!movieId) return specialsMap;

  const pages = getSpecialPagesForMovie(movieId, specialsMap);
  if (!pages || pages.length <= 1) return specialsMap;

  const idx = clampPageIndex(movieId, pageIndex, specialsMap);
  const pageList = Array.isArray(pages[idx]) ? pages[idx] : [];

  // override only this movieId entry with the page array
  return { ...specialsMap, [movieId]: pageList };
}

// -----------------------------
// Genre filtering (NEW)
// -----------------------------
function defaultIsGenreSpecial(sp) {
  if (!sp || typeof sp !== "object") return false;

  // Most robust if your resolver tags these (recommended):
  if (sp.kind === "genre") return true;
  if (sp.source === "genre") return true;
  if (sp.category === "genre") return true;
  if (sp.isGenre === true) return true;

  // Fallbacks (won’t break if absent)
  if (typeof sp.id === "string" && sp.id.startsWith("genre_")) return true;

  return false;
}

function filterOutGenreSpecials(list, isGenreSpecialFn) {
  const isGenre = typeof isGenreSpecialFn === "function" ? isGenreSpecialFn : defaultIsGenreSpecial;
  return (list || []).filter((sp) => !isGenre(sp));
}

// -----------------------------
// Resolve list for actor/page
// -----------------------------
/**
 * Resolve final specials list for the actor at the given pageIndex.
 * Requires the getResolvedSpecialsForActor function from your specialSystem.
 *
 * NEW: Optionally filters out genre specials if includeGenre is false for this movie/page.
 *
 * @param {object} args
 * @param {object} args.actor
 * @param {number} args.pageIndex
 * @param {object} args.movieMetaMap
 * @param {object} args.specialsMap
 * @param {function} args.getResolvedSpecialsForActor
 * @param {function=} args.isGenreSpecial  Optional override predicate
 */
export function resolveSpecialsForActorCurrentPage({
  actor,
  pageIndex,
  movieMetaMap,
  specialsMap,
  getResolvedSpecialsForActor,
  isGenreSpecial
}) {
  if (!actor) return [];
  if (typeof getResolvedSpecialsForActor !== "function") return [];

  const signatureMap = getSignatureMapForActorPage(actor, pageIndex, specialsMap);
  const list = getResolvedSpecialsForActor(actor, movieMetaMap, signatureMap) || [];

  const movieId = actor?.movie?.id;
  if (!movieId) return list;

  const includeGenre = getIncludeGenreForMoviePage(movieId, pageIndex, specialsMap);
  if (includeGenre) return list;

  return filterOutGenreSpecials(list, isGenreSpecial);
}

/**
 * Mutates a battle-local state object to toggle pages safely.
 * This matches your existing local vars:
 * - specialsPageIndex
 * - specialsList
 * - specialIndex
 * - pendingSpecial
 *
 * NEW: supports optional isGenreSpecial predicate passthrough.
 *
 * @returns {boolean} whether it toggled
 */
export function toggleSpecialPageInState({
  state,
  actor,
  movieMetaMap,
  specialsMap,
  getResolvedSpecialsForActor,
  isGenreSpecial
}) {
  if (!state || !actor) return false;
  if (!canToggleSpecialPages(actor, specialsMap)) return false;

  const movieId = actor.movie.id;
  const count = getSpecialPageCount(movieId, specialsMap);
  if (count <= 1) return false;

  state.specialsPageIndex = (Number(state.specialsPageIndex || 0) + 1) % count;

  state.specialsList = resolveSpecialsForActorCurrentPage({
    actor,
    pageIndex: state.specialsPageIndex,
    movieMetaMap,
    specialsMap,
    getResolvedSpecialsForActor,
    isGenreSpecial
  });

  state.specialIndex = 0;
  state.pendingSpecial = null;

  return true;
}
