// frontend/js/screens/select/search/providers/localProvider.js
//
// Local in-memory suggestions from the currently visible movie list.

function normalizeQuery(q) {
  return String(q || "").trim().toLowerCase();
}

export function createLocalSearchProvider() {
  return {
    mode: "local",
    async search({ query, baseVisible, limit = 6 }) {
      const q = normalizeQuery(query);
      if (!q) return [];
      if (!Array.isArray(baseVisible) || !baseVisible.length) return [];

      const out = [];
      for (let i = 0; i < baseVisible.length; i++) {
        const movie = baseVisible[i];
        const title = String(movie?.title || "").toLowerCase();
        if (!title) continue;
        if (!title.includes(q)) continue;

        out.push({
          source: "local",
          baseIndex: i,
          movie
        });
        if (out.length >= limit) break;
      }
      return out;
    }
  };
}

