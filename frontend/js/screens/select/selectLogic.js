// frontend/js/screens/select/selectLogic.js
//
// Pure select domain logic:
// - slot tokens
// - randomize / cycle rules
// - resolve special slots into a party
// - genre helpers (using movieMeta passed in)

export const SLOT_TOKEN_BLANK = "__SLOT_BLANK__";
export const SLOT_TOKEN_RANDOM = "__SLOT_RANDOM__";

export const GENRE_RANDOM_SLOTS = [
  { token: "__SLOT_RAND_ACTION__", genre: "ACTION", label: "RANDOM: ACTION" },
  { token: "__SLOT_RAND_ADVENTURE__", genre: "ADVENTURE", label: "RANDOM: ADVENTURE" },
  { token: "__SLOT_RAND_DRAMA__", genre: "DRAMA", label: "RANDOM: DRAMA" },
  { token: "__SLOT_RAND_COMEDY__", genre: "COMEDY", label: "RANDOM: COMEDY" },
  { token: "__SLOT_RAND_HORROR__", genre: "HORROR", label: "RANDOM: HORROR" },
  { token: "__SLOT_RAND_THRILLER__", genre: "THRILLER", label: "RANDOM: THRILLER" },
  { token: "__SLOT_RAND_MYSTERY__", genre: "MYSTERY", label: "RANDOM: MYSTERY" },
  { token: "__SLOT_RAND_SCIFI__", genre: "SCIFI", label: "RANDOM: SCIFI" },
  { token: "__SLOT_RAND_FANTASY__", genre: "FANTASY", label: "RANDOM: FANTASY" },
  { token: "__SLOT_RAND_ANIMATION__", genre: "ANIMATION", label: "RANDOM: ANIMATION" },
  { token: "__SLOT_RAND_CRIME__", genre: "CRIME", label: "RANDOM: CRIME" },
  { token: "__SLOT_RAND_ROMANCE__", genre: "ROMANCE", label: "RANDOM: ROMANCE" },
  { token: "__SLOT_RAND_MUSICAL__", genre: "MUSICAL", label: "RANDOM: MUSICAL" }
];

export const GENRE_TOKEN_TO_DEF = new Map(GENRE_RANDOM_SLOTS.map((g) => [g.token, g]));

export function clampIndex(i, len) {
  if (len <= 0) return 0;
  return ((i % len) + len) % len;
}

export function isSpecialSlotValue(v) {
  return typeof v === "string";
}

export function isBlankSlotValue(v) {
  return v === SLOT_TOKEN_BLANK;
}

export function hasBlankSlot(slots, SLOT_COUNT) {
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (slots?.[i] === SLOT_TOKEN_BLANK) return true;
  }
  return false;
}

export function normalizeSlotsToBaseLength(slots, SLOT_COUNT, baseLen) {
  if (!Array.isArray(slots) || slots.length !== SLOT_COUNT) return;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const v = slots[i];
    if (typeof v === "string") continue;
    if (typeof v !== "number" || !Number.isFinite(v) || baseLen <= 0) slots[i] = 0;
    else slots[i] = ((v % baseLen) + baseLen) % baseLen;
  }
}

export function getAllowedBaseIndices(baseLen, displayToBase) {
  if (baseLen <= 0) return [];
  if (Array.isArray(displayToBase) && displayToBase.length > 0) return displayToBase.slice();
  const out = new Array(baseLen);
  for (let i = 0; i < baseLen; i++) out[i] = i;
  return out;
}

export function cycleSlotWithOptionalFilter({ slots, slotIdx, dir, displayToBase, baseLen }) {
  if (baseLen <= 0) return;

  const allowed = getAllowedBaseIndices(baseLen, displayToBase);
  if (!allowed.length) return;

  const cur = slots[slotIdx];

  const isMovie = typeof cur === "number" && Number.isFinite(cur);
  const isBlank = cur === SLOT_TOKEN_BLANK;
  const isRandom = cur === SLOT_TOKEN_RANDOM;
  const isGenre = typeof cur === "string" && GENRE_TOKEN_TO_DEF.has(cur);

  const genreTokens = GENRE_RANDOM_SLOTS.map((g) => g.token);
  const firstGenre = genreTokens[0];

  if (isBlank) {
    if (dir > 0) {
      slots[slotIdx] = allowed[0];
      return;
    }
    slots[slotIdx] = SLOT_TOKEN_RANDOM;
    return;
  }

  if (isRandom) {
    if (dir > 0) {
      slots[slotIdx] = firstGenre || SLOT_TOKEN_BLANK;
      return;
    }
    slots[slotIdx] = allowed[allowed.length - 1];
    return;
  }

  if (isGenre) {
    const gi = genreTokens.indexOf(cur);
    if (gi < 0) {
      slots[slotIdx] = SLOT_TOKEN_RANDOM;
      return;
    }

    if (dir < 0) {
      if (gi === 0) {
        slots[slotIdx] = SLOT_TOKEN_RANDOM;
        return;
      }
      slots[slotIdx] = genreTokens[gi - 1];
      return;
    }

    if (gi === genreTokens.length - 1) {
      slots[slotIdx] = SLOT_TOKEN_BLANK;
      return;
    }

    slots[slotIdx] = genreTokens[gi + 1];
    return;
  }

  let pos = allowed.indexOf(isMovie ? cur : allowed[0]);
  if (pos < 0) pos = 0;

  if (dir < 0 && pos === 0) {
    slots[slotIdx] = SLOT_TOKEN_BLANK;
    return;
  }

  if (dir > 0 && pos === allowed.length - 1) {
    slots[slotIdx] = SLOT_TOKEN_RANDOM;
    return;
  }

  pos = clampIndex(pos + dir, allowed.length);
  slots[slotIdx] = allowed[pos];
}

function pickDistinct(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a.slice(0, n);
}

export function randomizeSlots({ SLOT_COUNT, baseLen, displayToBase }) {
  const allowed = getAllowedBaseIndices(baseLen, displayToBase);
  if (allowed.length <= 0) return null;

  const picks = allowed.length >= SLOT_COUNT ? pickDistinct(allowed, SLOT_COUNT) : null;

  const next = new Array(SLOT_COUNT);
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (picks) next[i] = picks[i];
    else next[i] = allowed[Math.floor(Math.random() * allowed.length)];
  }

  return next;
}

export function normalizeGenreName(g) {
  const s = String(g || "").trim();
  return s ? s.toUpperCase() : "";
}

export function getMetaEntryForMovieId(movieMeta, id) {
  if (!id) return null;

  if (movieMeta && typeof movieMeta === "object" && !Array.isArray(movieMeta)) {
    if (movieMeta[id]) return movieMeta[id];
  }

  if (Array.isArray(movieMeta)) {
    return movieMeta.find((m) => m?.id === id || m?.movieId === id) || null;
  }

  return null;
}

export function getGenresForMovie(movieMeta, movie) {
  const id = movie?.id ? String(movie.id) : "";
  if (!id) return [];

  const meta = getMetaEntryForMovieId(movieMeta, id);
  if (!meta) return [];

  const out = new Set();
  const list = [];

  if (Array.isArray(meta.genres)) list.push(...meta.genres);
  if (meta.primaryGenre) list.push(meta.primaryGenre);
  if (meta.secondaryGenre) list.push(meta.secondaryGenre);
  if (meta.genre) list.push(meta.genre);

  for (const g of list) {
    const ng = normalizeGenreName(g);
    if (ng) out.add(ng);
  }

  return Array.from(out);
}

export function indicesForGenre(movieMeta, baseVisible, genre) {
  const g = normalizeGenreName(genre);
  const out = [];
  for (let i = 0; i < baseVisible.length; i++) {
    const gs = getGenresForMovie(movieMeta, baseVisible[i]);
    if (gs.includes(g)) out.push(i);
  }
  return out;
}

export function randomizeSlotsCommonGenre({ SLOT_COUNT, movieMeta, baseVisible, displayToBase }) {
  const baseLen = Array.isArray(baseVisible) ? baseVisible.length : 0;
  const allowed = getAllowedBaseIndices(baseLen, displayToBase);
  if (allowed.length <= 0) return null;

  const genreToIndices = new Map();

  for (const idx of allowed) {
    const m = baseVisible[idx];
    const genres = getGenresForMovie(movieMeta, m);
    for (const g of genres) {
      if (!genreToIndices.has(g)) genreToIndices.set(g, []);
      genreToIndices.get(g).push(idx);
    }
  }

  const candidates = [];
  for (const [g, arr] of genreToIndices.entries()) {
    const uniq = Array.from(new Set(arr));
    if (uniq.length >= SLOT_COUNT) candidates.push({ genre: g, indices: uniq });
  }

  if (candidates.length === 0) return null;

  const weighted = [];
  for (const c of candidates) {
    const w = Math.max(1, Math.min(6, Math.floor(c.indices.length / 4)));
    for (let k = 0; k < w; k++) weighted.push(c);
  }
  const chosen = weighted[Math.floor(Math.random() * weighted.length)] || candidates[0];
  const picked = pickDistinct(chosen.indices, SLOT_COUNT);

  return picked.length === SLOT_COUNT ? picked : null;
}

export function resolvePartyFromSlots({
  SLOT_COUNT,
  movieMeta,
  slots,
  baseVisible,
  fallbackMovie
}) {
  const baseLen = Array.isArray(baseVisible) ? baseVisible.length : 0;
  if (baseLen <= 0) return new Array(SLOT_COUNT).fill(fallbackMovie);

  const used = new Set();
  for (let i = 0; i < SLOT_COUNT; i++) {
    const v = slots[i];
    if (typeof v === "number" && v >= 0) used.add(v);
  }

  function pickFromPool(pool) {
    if (!Array.isArray(pool) || pool.length === 0) return null;
    const unused = pool.filter((x) => !used.has(x));
    const src = unused.length ? unused : pool;
    const idx = src[Math.floor(Math.random() * src.length)];
    if (typeof idx === "number") used.add(idx);
    return idx;
  }

  const party = new Array(SLOT_COUNT);

  for (let i = 0; i < SLOT_COUNT; i++) {
    const v = slots[i];

    if (typeof v === "number" && v >= 0) {
      party[i] = baseVisible[v] || baseVisible[0];
      continue;
    }

    if (v === SLOT_TOKEN_RANDOM) {
      const all = [];
      for (let k = 0; k < baseLen; k++) all.push(k);
      const pick = pickFromPool(all);
      party[i] = baseVisible[pick ?? 0] || baseVisible[0];
      continue;
    }

    const def = GENRE_TOKEN_TO_DEF.get(v);
    if (def) {
      const pool = indicesForGenre(movieMeta, baseVisible, def.genre);
      const pick = pickFromPool(pool);

      if (pick == null) {
        const all = [];
        for (let k = 0; k < baseLen; k++) all.push(k);
        const anyPick = pickFromPool(all);
        party[i] = baseVisible[anyPick ?? 0] || baseVisible[0];
      } else {
        party[i] = baseVisible[pick] || baseVisible[0];
      }
      continue;
    }

    party[i] = baseVisible[0];
  }

  return party;
}

export function specialSlotLabel(v) {
  if (v === SLOT_TOKEN_BLANK) return "BLANK";
  if (v === SLOT_TOKEN_RANDOM) return "RANDOM";
  const def = GENRE_TOKEN_TO_DEF.get(v);
  if (def) return def.label || `RAND: ${def.genre}`;
  return "SPECIAL";
}
