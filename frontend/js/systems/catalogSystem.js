// frontend/js/systems/catalogSystem.js
//
// Living catalog (browse-first) with paging + localStorage caching.
//
// Assumes you have a server proxy at:
//   GET /api/catalog/discover?page=1&minRuntime=80&sort=popularity.desc
//
// It returns:
//   { page, totalPages, items: [ { id, title, shortTitle, year, posterUrl, rating, provider, providerId } ] }
//
// Usage (Select screen):
//   import { CatalogSystem } from "../systems/catalogSystem.js";
//   await CatalogSystem.ensureDiscoverLoaded(); // loads cached page or fetches
//   const items = CatalogSystem.getItems();
//   // render items and call ImageCache.load(item.posterUrl) for visible ones
//
// Notes:
// - "Feature film" is approximated as runtime >= minRuntime.
// - Many discover lists won't include runtime; server can filter by runtime when provider supports it.
// - In TMDB's discover, runtime filter exists, but runtime is not returned in list results.
//   So runtime field in items is optional/null for now.

function nowMs() {
  return Date.now();
}

function safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

const STORAGE_KEY = "livingCatalog:v1";
const CACHE_TTL_MS_DEFAULT = 24 * 60 * 60 * 1000; // 24 hours

const DEFAULT_STATE = {
  mode: "discover",
  // discover controls
  discover: {
    page: 1,
    totalPages: 1,
    minRuntime: 80, // your "feature length" rule
    sort: "popularity.desc",
  },
  // cached pages
  cache: {
    // key -> { savedAt, payload }
    pages: {},
  },
  lastError: null,
};

function makeDiscoverCacheKey({ page, minRuntime, sort }) {
  return `discover|p=${page}|minRuntime=${minRuntime}|sort=${sort}`;
}

async function httpGetJson(url) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || "Request failed"}`);
  }
  return await res.json();
}

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(DEFAULT_STATE);
  const parsed = safeJsonParse(raw, null);
  if (!parsed || typeof parsed !== "object") return structuredClone(DEFAULT_STATE);

  // shallow sanitize / merge
  const merged = structuredClone(DEFAULT_STATE);
  if (parsed.mode === "discover") merged.mode = "discover";

  if (parsed.discover && typeof parsed.discover === "object") {
    merged.discover.page = isNum(parsed.discover.page) ? parsed.discover.page : merged.discover.page;
    merged.discover.totalPages = isNum(parsed.discover.totalPages) ? parsed.discover.totalPages : merged.discover.totalPages;
    merged.discover.minRuntime = isNum(parsed.discover.minRuntime) ? parsed.discover.minRuntime : merged.discover.minRuntime;
    merged.discover.sort = typeof parsed.discover.sort === "string" ? parsed.discover.sort : merged.discover.sort;
  }

  if (parsed.cache && parsed.cache.pages && typeof parsed.cache.pages === "object") {
    merged.cache.pages = parsed.cache.pages;
  }

  merged.lastError = typeof parsed.lastError === "string" ? parsed.lastError : null;

  return merged;
}

function saveToStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export const CatalogSystem = (() => {
  let state = loadFromStorage();

  function getState() {
    return state;
  }

  function setDiscoverFilters({ minRuntime, sort }) {
    if (isNum(minRuntime)) state.discover.minRuntime = clamp(Math.round(minRuntime), 40, 240);
    if (typeof sort === "string" && sort.trim()) state.discover.sort = sort.trim();

    // reset paging when filters change
    state.discover.page = 1;
    state.discover.totalPages = 1;
    state.lastError = null;
    saveToStorage(state);
  }

  function getDiscoverParams() {
    return { ...state.discover };
  }

  function getCacheTTLms() {
    return CACHE_TTL_MS_DEFAULT;
  }

  function pruneExpiredCache() {
    const ttl = getCacheTTLms();
    const pages = state.cache.pages || {};
    const next = {};
    const t = nowMs();

    for (const [k, v] of Object.entries(pages)) {
      if (!v || typeof v !== "object") continue;
      const savedAt = v.savedAt;
      if (!isNum(savedAt)) continue;
      if (t - savedAt <= ttl) next[k] = v;
    }

    state.cache.pages = next;
  }

  function getCachedPage(cacheKey) {
    pruneExpiredCache();
    const entry = state.cache.pages?.[cacheKey];
    if (!entry) return null;
    return entry.payload || null;
  }

  function setCachedPage(cacheKey, payload) {
    if (!state.cache.pages) state.cache.pages = {};
    state.cache.pages[cacheKey] = { savedAt: nowMs(), payload };
    saveToStorage(state);
  }

  function getItems() {
    if (state.mode !== "discover") return [];
    const params = state.discover;
    const key = makeDiscoverCacheKey(params);
    const cached = getCachedPage(key);
    return cached?.items || [];
  }

  function getPageInfo() {
    return {
      page: state.discover.page,
      totalPages: state.discover.totalPages,
      minRuntime: state.discover.minRuntime,
      sort: state.discover.sort,
      mode: state.mode,
      lastError: state.lastError,
    };
  }

  async function loadDiscoverPage(page) {
    state.mode = "discover";
    state.lastError = null;

    const p = clamp(Math.round(page || 1), 1, 500);
    state.discover.page = p;

    const params = state.discover;
    const key = makeDiscoverCacheKey(params);

    // serve from cache instantly if present
    const cached = getCachedPage(key);
    if (cached) {
      // keep totalPages in sync from cached payload
      if (isNum(cached.totalPages)) state.discover.totalPages = cached.totalPages;
      saveToStorage(state);
      return cached;
    }

    // fetch from server
    const qs = new URLSearchParams({
      page: String(params.page),
      minRuntime: String(params.minRuntime),
      sort: params.sort,
    });

    try {
      const payload = await httpGetJson(`/api/catalog/discover?${qs.toString()}`);
      // expected shape normalization
      const totalPages = isNum(payload.totalPages) ? payload.totalPages : 1;
      state.discover.totalPages = clamp(Math.round(totalPages), 1, 500);

      setCachedPage(key, payload);
      saveToStorage(state);
      return payload;
    } catch (err) {
      state.lastError = err?.message ? String(err.message) : "Catalog fetch failed";
      saveToStorage(state);
      return null;
    }
  }

  async function ensureDiscoverLoaded() {
    if (state.mode !== "discover") state.mode = "discover";
    const page = state.discover.page || 1;
    return await loadDiscoverPage(page);
  }

  async function nextPage() {
    const { page, totalPages } = getPageInfo();
    const next = clamp(page + 1, 1, totalPages || 1);
    return await loadDiscoverPage(next);
  }

  async function prevPage() {
    const { page } = getPageInfo();
    const prev = clamp(page - 1, 1, 500);
    return await loadDiscoverPage(prev);
  }

  function reset() {
    state = structuredClone(DEFAULT_STATE);
    saveToStorage(state);
  }

  return {
    getState,
    getItems,
    getPageInfo,
    getDiscoverParams,
    setDiscoverFilters,
    loadDiscoverPage,
    ensureDiscoverLoaded,
    nextPage,
    prevPage,
    reset,
  };
})();
