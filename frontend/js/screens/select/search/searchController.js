// frontend/js/screens/select/search/searchController.js
//
// Shared search controller for provider selection and async suggestion loading.

import { createLocalSearchProvider } from "./providers/localProvider.js";
import { createTmdbSearchProvider } from "./providers/tmdbProvider.js";

const MODE_LOCAL = "local";
const MODE_TMDB = "tmdb";
const SEARCH_MODE_KEY = "rpg_select_search_mode_v1";

const localProvider = createLocalSearchProvider();

function safeGetLS(key) {
  try {
    return window?.localStorage?.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLS(key, value) {
  try {
    window?.localStorage?.setItem(key, value);
  } catch {}
}

function normalizeMode(mode) {
  return mode === MODE_TMDB ? MODE_TMDB : MODE_LOCAL;
}

function getModeFromStateOrStorage(state) {
  const inState = String(state?.search?.mode || "").trim().toLowerCase();
  if (inState === MODE_LOCAL || inState === MODE_TMDB) return inState;
  const fromLs = String(safeGetLS(SEARCH_MODE_KEY) || "").trim().toLowerCase();
  if (fromLs === MODE_LOCAL || fromLs === MODE_TMDB) return fromLs;
  return MODE_LOCAL;
}

function getTmdbApiKeyFromState(state) {
  const keyFromState = String(state?.search?.tmdbApiKey || "").trim();
  if (keyFromState) return keyFromState;

  const keyFromWindow = String(window?.TMDB_API_KEY || "").trim();
  if (keyFromWindow) return keyFromWindow;

  return String(safeGetLS("tmdb_api_key") || "").trim();
}

export function ensureSearchControllerState(state) {
  if (!state?.search || typeof state.search !== "object") return;

  if (typeof state.search.mode !== "string") {
    state.search.mode = getModeFromStateOrStorage(state);
  } else {
    state.search.mode = normalizeMode(state.search.mode);
  }

  if (!state.search.controller || typeof state.search.controller !== "object") {
    state.search.controller = {
      cache: Object.create(null),
      inFlightKey: null,
      requestSeq: 0,
      tmdbProvider: null,
      tmdbProviderApiKey: ""
    };
  } else {
    if (!state.search.controller.cache || typeof state.search.controller.cache !== "object") {
      state.search.controller.cache = Object.create(null);
    }
    if (typeof state.search.controller.inFlightKey !== "string" && state.search.controller.inFlightKey !== null) {
      state.search.controller.inFlightKey = null;
    }
    if (!Number.isFinite(Number(state.search.controller.requestSeq))) {
      state.search.controller.requestSeq = 0;
    }
  }
}

function getTmdbProvider(state) {
  ensureSearchControllerState(state);
  const ctl = state.search.controller;
  const key = getTmdbApiKeyFromState(state);

  if (!ctl.tmdbProvider || ctl.tmdbProviderApiKey !== key) {
    ctl.tmdbProviderApiKey = key;
    ctl.tmdbProvider = createTmdbSearchProvider({
      getApiKey: () => key
    });
  }
  return ctl.tmdbProvider;
}

function getProviderForMode(state) {
  const mode = normalizeMode(state?.search?.mode);
  if (mode === MODE_TMDB) return getTmdbProvider(state);
  return localProvider;
}

function cacheKey(mode, query, baseVisibleLen, limit) {
  return `${mode}|${String(query || "").trim().toLowerCase()}|${baseVisibleLen}|${limit}`;
}

export function getSearchMode(state) {
  ensureSearchControllerState(state);
  return normalizeMode(state?.search?.mode);
}

export function setSearchMode(state, mode) {
  ensureSearchControllerState(state);
  const next = normalizeMode(mode);
  const prev = normalizeMode(state?.search?.mode);
  state.search.mode = next;
  safeSetLS(SEARCH_MODE_KEY, next);

  if (prev !== next) {
    state.search.suggestions = [];
    state.search.selectedSuggestion = 0;
    state.search.dropdownBox = null;
    state.search.controller.cache = Object.create(null);
    state.search.controller.inFlightKey = null;
    state.search.controller.requestSeq += 1;
  }
}

export function requestSuggestions(state, { query, baseVisible, limit = 6, onResults } = {}) {
  ensureSearchControllerState(state);
  const mode = getSearchMode(state);
  const q = String(query || "").trim();
  const src = Array.isArray(baseVisible) ? baseVisible : [];
  const ctl = state.search.controller;

  if (!q) {
    if (typeof onResults === "function") onResults([]);
    return;
  }

  const key = cacheKey(mode, q, src.length, limit);
  const cached = ctl.cache[key];
  if (Array.isArray(cached)) {
    if (typeof onResults === "function") onResults(cached);
    return;
  }

  if (ctl.inFlightKey === key) return;

  ctl.inFlightKey = key;
  ctl.requestSeq += 1;
  const seq = ctl.requestSeq;

  const provider = getProviderForMode(state);
  Promise.resolve(provider.search({ query: q, baseVisible: src, limit }))
    .then((results) => {
      const out = Array.isArray(results) ? results : [];
      ctl.cache[key] = out;
      if (seq !== ctl.requestSeq) return;
      if (ctl.inFlightKey === key) ctl.inFlightKey = null;
      if (typeof onResults === "function") onResults(out);
    })
    .catch(() => {
      if (seq !== ctl.requestSeq) return;
      if (ctl.inFlightKey === key) ctl.inFlightKey = null;
      if (typeof onResults === "function") onResults([]);
    });
}
