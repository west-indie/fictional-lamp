// frontend/js/screens/select/search/providers/tmdbProvider.js
//
// TMDB-backed suggestions. Results are mapped to local movies when possible
// so pick-slot flow can still place into local party slots.

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function yearFromAny(movieLike) {
  const y =
    movieLike?.year ??
    movieLike?.releaseYear ??
    movieLike?.release_date?.slice?.(0, 4) ??
    movieLike?.date?.slice?.(0, 4);
  const yn = Number(y);
  return Number.isFinite(yn) && yn > 1800 ? yn : null;
}

function buildLocalIndex(baseVisible) {
  const byTitle = new Map();
  for (let i = 0; i < baseVisible.length; i++) {
    const m = baseVisible[i];
    const k = norm(m?.title || "");
    if (!k) continue;
    if (!byTitle.has(k)) byTitle.set(k, []);
    byTitle.get(k).push({ baseIndex: i, movie: m, year: yearFromAny(m) });
  }
  return { byTitle };
}

function resolveLocalMatch(tmdbResult, localIndex) {
  const title = String(tmdbResult?.title || tmdbResult?.name || "");
  const key = norm(title);
  if (!key) return null;

  const candidates = localIndex.byTitle.get(key) || [];
  if (!candidates.length) return null;

  const tmdbYear = yearFromAny(tmdbResult);
  if (tmdbYear != null) {
    const exactYear = candidates.find((c) => c.year === tmdbYear);
    if (exactYear) return exactYear;
  }
  return candidates[0];
}

export function createTmdbSearchProvider({
  getApiKey,
  fetchImpl = (...args) => fetch(...args),
  minQueryLength = 2
} = {}) {
  return {
    mode: "tmdb",
    async search({ query, baseVisible, limit = 6 }) {
      const q = String(query || "").trim();
      if (!q || q.length < minQueryLength) return [];
      if (!Array.isArray(baseVisible) || !baseVisible.length) return [];

      const apiKey = typeof getApiKey === "function" ? String(getApiKey() || "").trim() : "";
      if (!apiKey) return [];

      const url =
        `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(apiKey)}` +
        `&query=${encodeURIComponent(q)}&include_adult=false&page=1`;

      const res = await fetchImpl(url, { method: "GET" });
      if (!res?.ok) return [];

      const data = await res.json().catch(() => null);
      const results = Array.isArray(data?.results) ? data.results : [];
      if (!results.length) return [];

      const localIndex = buildLocalIndex(baseVisible);
      const out = [];
      const seen = new Set();

      for (const r of results) {
        const match = resolveLocalMatch(r, localIndex);

        const baseIndex = Number.isFinite(Number(match?.baseIndex))
          ? Number(match.baseIndex)
          : null;

        const dedupeKey = baseIndex != null
          ? `base:${baseIndex}`
          : `tmdb:${String(r?.id || "")}:${norm(r?.title || r?.name || "")}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        out.push({
          source: "tmdb",
          baseIndex,
          tmdbId: Number.isFinite(Number(r?.id)) ? Number(r.id) : null,
          movie: match?.movie || {
            id: `tmdb_${String(r?.id || "").trim() || norm(r?.title || r?.name || "")}`,
            title: String(r?.title || r?.name || "Unknown"),
            release_date: String(r?.release_date || "")
          }
        });

        if (out.length >= limit) break;
      }

      return out;
    }
  };
}

