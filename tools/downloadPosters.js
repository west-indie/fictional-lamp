// tools/downloadPosters.js
//
// One-time utility script.
// Downloads posters for movies in frontend/js/data/movies.js into frontend/assets/posters/
//
// Supports overrides:
// - directPosterUrl: downloads exactly that image URL (best when you picked the art)
// - tmdbId: fetches movie details from TMDB and downloads its poster_path
// - query/year: fallback search
//
// Run (PowerShell):
//   $env:TMDB_API_KEY="YOUR_KEY"; node .\tools\downloadPosters.js
//
// Force re-download (overwrite existing):
//   $env:TMDB_API_KEY="YOUR_KEY"; node .\tools\downloadPosters.js --force

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const OVERRIDES = {
  // ✅ EXACT posters (direct URLs you chose)
  rear_window: {
    tmdbId: 567, // Rear Window (1954)
  },

  harry_potter_2001: {
    tmdbId: 671, // Harry Potter and the Philosopher's Stone (2001)
  },

  love_and_mercy: {
    tmdbId: 271714, // Love & Mercy (2014)
  },

  steve_jobs_2015: {
    tmdbId: 321697, // Steve Jobs (2015)
  },
  howls_moving_castle: {
    directPosterUrl: "https://image.tmdb.org/t/p/original/jVuYH2SS9GfJhmW40spJ03mZ15l.jpg",
  },
  raging_bull: {
    directPosterUrl: "https://image.tmdb.org/t/p/original/wpfpnVUVy6kElwz1Z6p5QiCpbwB.jpg",
  },
  ten_things_i_hate_about_you: {
    directPosterUrl: "https://image.tmdb.org/t/p/original/u3jyD55Tdbj4hCgDhvRyOK9nFsH.jpg",
  },
  this_is_spinal_tap: {
  directPosterUrl: "https://image.tmdb.org/t/p/original/lTdoAGlVvIn3W1ZVa8iX4Sh2SCq.jpg",
},
  rushmore: {
    directPosterUrl: "https://image.tmdb.org/t/p/original/5BpHFugpgiNg68FXSqc4EJRfOuE.jpg",
  },
  eight_half: {
    directPosterUrl: "https://image.tmdb.org/t/p/original/xmdsHc9f2vOsKYh2zTOaI5k4quj.jpg",
  },

  // ✅ Parasite by TMDB ID (you provided)
  parasite: {
    tmdbId: 496243,
  },
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== CONFIG =====
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const POSTER_SIZE = "w342"; // used only for tmdbId/search paths
const FORCE = process.argv.includes("--force");

const MOVIES_PATH = path.join(__dirname, "../frontend/js/data/movies.js");
const POSTERS_DIR = path.join(__dirname, "../frontend/assets/posters");
// ===================

const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";

if (!TMDB_API_KEY) {
  console.error("❌ Missing TMDB_API_KEY");
  console.error('PowerShell: $env:TMDB_API_KEY="YOUR_KEY"; node .\\tools\\downloadPosters.js');
  process.exit(1);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function yearFromReleaseDate(d) {
  if (!d || typeof d !== "string") return null;
  const y = Number(d.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

async function tmdbGetJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`TMDB ${res.status}: ${txt || "Request failed"}`);
  }
  return res.json();
}

async function tmdbSearch(query) {
  const url = new URL(`${TMDB_API}/search/movie`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("query", query);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "en-US");
  return tmdbGetJson(url.toString());
}

async function tmdbGetMovieDetails(tmdbId) {
  const url = new URL(`${TMDB_API}/movie/${tmdbId}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  return tmdbGetJson(url.toString());
}

async function download(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download (${res.status}) ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
}

async function loadMovies() {
  const mod = await import(pathToFileURL(MOVIES_PATH).href);
  if (!mod.movies || !Array.isArray(mod.movies)) {
    throw new Error("movies.js must export `movies` array");
  }
  return mod.movies;
}

function chooseResult(results, preferredYear) {
  if (!Array.isArray(results) || results.length === 0) return null;

  if (preferredYear) {
    const yearWithPoster = results.find(
      (r) => yearFromReleaseDate(r.release_date) === preferredYear && r.poster_path
    );
    if (yearWithPoster) return yearWithPoster;
  }

  const firstWithPoster = results.find((r) => r.poster_path);
  if (firstWithPoster) return firstWithPoster;

  return results[0];
}

async function main() {
  ensureDir(POSTERS_DIR);

  const movies = await loadMovies();

  let ok = 0;
  let skipped = 0;
  let fail = 0;
  const failures = [];

  console.log(`Poster size (tmdbId/search only): ${POSTER_SIZE}`);
  console.log(`Force overwrite: ${FORCE ? "YES" : "NO"}`);
  console.log("");

  for (const movie of movies) {
    if (!movie?.id || !movie?.title) continue;

    const id = String(movie.id);
    const outFile = path.join(POSTERS_DIR, `${id}.jpg`);

    if (!FORCE && fs.existsSync(outFile)) {
      console.log(`⏭️  ${id} already exists`);
      skipped++;
      continue;
    }

    const override = OVERRIDES[id];

    try {
      // ✅ 1) Direct URL override (exact poster)
      if (override?.directPosterUrl) {
        console.log(`🖼️  ${id}: downloading direct URL`);
        await download(override.directPosterUrl, outFile);
        console.log(`✅ Downloaded (direct): ${movie.title}`);
        ok++;
        continue;
      }

      // ✅ 2) TMDB ID override
      if (override?.tmdbId) {
        console.log(`🎬 ${id}: downloading via tmdbId ${override.tmdbId}`);
        const details = await tmdbGetMovieDetails(override.tmdbId);

        if (!details?.poster_path) {
          throw new Error(`tmdbId ${override.tmdbId} has no poster_path`);
        }

        const posterUrl = `${TMDB_IMG}/${POSTER_SIZE}${details.poster_path}`;
        await download(posterUrl, outFile);
        console.log(`✅ Downloaded (tmdbId): ${movie.title}`);
        ok++;
        continue;
      }

      // 3) Fallback: query/year search (for everything else)
      const query = override?.query || movie.title;
      const preferredYear = override?.year || movie.year || null;

      console.log(`🔎 ${id}: searching "${query}"${preferredYear ? ` (${preferredYear})` : ""}`);
      const data = await tmdbSearch(query);
      const result = chooseResult(data.results, preferredYear);

      if (!result || !result.poster_path) {
        throw new Error("No poster_path in search results");
      }

      const posterUrl = `${TMDB_IMG}/${POSTER_SIZE}${result.poster_path}`;
      await download(posterUrl, outFile);
      console.log(`✅ Downloaded (search): ${movie.title}`);
      ok++;
    } catch (err) {
      const reason = err?.message ? String(err.message) : String(err);
      console.log(`❌ Failed: ${id} (${movie.title}) — ${reason}`);
      fail++;
      failures.push({ id, title: movie.title, reason });
    }
  }

  console.log("");
  console.log("Done.");
  console.log(`✅ Success: ${ok}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${fail}`);

  if (failures.length) {
    console.log("");
    console.log("Failures list:");
    for (const f of failures) console.log(` - ${f.id} (${f.title}): ${f.reason}`);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e?.message || e);
  process.exit(1);
});
