// frontend/js/screens/select/search/searchEngine.js
//
// Shared search UI engine (keyboard queue, pointer, dropdown, render).
// Suggestions are provider-agnostic and loaded through searchController.

import {
  ensureSearchControllerState,
  requestSuggestions,
  getSearchMode,
  setSearchMode
} from "./searchController.js";

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function normalizeQuery(q) {
  return String(q || "").trim();
}

function isPrintableKey(e) {
  return (
    e &&
    typeof e.key === "string" &&
    e.key.length === 1 &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey
  );
}

function isBackspace(e) {
  return e?.key === "Backspace";
}

function isEnter(e) {
  return e?.key === "Enter";
}

function isEscape(e) {
  return e?.key === "Escape";
}

function isArrowUp(e) {
  return e?.key === "ArrowUp";
}

function isArrowDown(e) {
  return e?.key === "ArrowDown";
}

function isArrowLeft(e) {
  return e?.key === "ArrowLeft";
}

function isArrowRight(e) {
  return e?.key === "ArrowRight";
}

function getYearFromMovie(movie) {
  const y =
    movie?.year ??
    movie?.releaseYear ??
    movie?.release_date?.slice?.(0, 4) ??
    movie?.date?.slice?.(0, 4);

  const yn = Number(y);
  return Number.isFinite(yn) && yn > 1800 ? String(yn) : "";
}

function getYear(movie, movieMeta) {
  const direct = getYearFromMovie(movie);
  if (direct) return direct;

  const id = movie?.id;
  const my = movieMeta && id ? movieMeta[id]?.year : null;
  const myn = Number(my);
  return Number.isFinite(myn) && myn > 1800 ? String(myn) : "";
}

function wrapTextLines(ctx, text, maxW, maxLines) {
  const words = String(text || "").split(/\s+/g).filter(Boolean);
  if (words.length === 0) return [""];

  const lines = [];
  let line = "";
  let wordIdx = 0;

  while (wordIdx < words.length && lines.length < maxLines) {
    const w = words[wordIdx];
    const test = line ? `${line} ${w}` : w;

    if (ctx.measureText(test).width <= maxW) {
      line = test;
      wordIdx += 1;
      continue;
    }

    if (!line) {
      let cut = w;
      while (cut.length > 1 && ctx.measureText(cut).width > maxW) {
        cut = cut.slice(0, -1);
      }
      line = cut;
      wordIdx += 1;
    }

    lines.push(line);
    line = "";
  }

  if (line && lines.length < maxLines) lines.push(line);

  if (wordIdx < words.length && lines.length) {
    let last = lines[lines.length - 1] || "";
    const ell = "...";
    while (last && ctx.measureText(last + ell).width > maxW) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = (last || "").trimEnd() + ell;
  }

  return lines;
}

function getDropdownRect({ SCREEN, L, sr, count }) {
  const rowH = num(L?.search?.dropdownRowH, 34);
  const maxRows = num(L?.search?.dropdownMaxRows, 6);
  const rows = clamp(count, 0, maxRows);

  const pad = num(L?.search?.dropdownPad, 2);
  const w = sr.mid.w;
  const x = sr.mid.x;
  const y = sr.mid.y + sr.mid.h + num(L?.search?.dropdownGap, 3);

  const h = rows * rowH + pad * 2;

  return {
    rowH,
    box: { x, y, w, h },
    pad,
    rows
  };
}

function inferSearchMidRect(SCREEN, L) {
  const W = num(SCREEN?.W, 400);
  const sh = num(L?.search?.h, 20);
  const sw = num(L?.search?.w, 213);
  const y = num(L?.search?.y, 56);
  const x = Math.floor((W - sw) / 2);
  return { x, y, w: sw, h: sh };
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function ensureSearchState(state) {
  if (!state) return;
  if (!state.search || typeof state.search !== "object") {
    state.search = {
      bound: false,
      queue: [],
      suggestions: [],
      selectedSuggestion: 0,
      pickSlotMode: false,
      hoveredSlotIndex: -1,
      pickedBaseIndex: -1,
      dropdownBox: null,
      mode: "local",
      tmdbApiKey: ""
    };
  } else {
    if (!Array.isArray(state.search.queue)) state.search.queue = [];
    if (!Array.isArray(state.search.suggestions)) state.search.suggestions = [];
    if (typeof state.search.selectedSuggestion !== "number") state.search.selectedSuggestion = 0;
    if (typeof state.search.pickSlotMode !== "boolean") state.search.pickSlotMode = false;
    if (typeof state.search.hoveredSlotIndex !== "number") state.search.hoveredSlotIndex = -1;
    if (typeof state.search.pickedBaseIndex !== "number") state.search.pickedBaseIndex = -1;
    if (typeof state.search.bound !== "boolean") state.search.bound = false;
    if (typeof state.search.dropdownBox !== "object") state.search.dropdownBox = null;
    if (typeof state.search.mode !== "string") state.search.mode = "local";
    if (typeof state.search.tmdbApiKey !== "string") state.search.tmdbApiKey = "";
  }

  ensureSearchControllerState(state);
}

export function getSearchModeValue(state) {
  ensureSearchState(state);
  return getSearchMode(state);
}

export function setSearchModeValue(state, mode) {
  ensureSearchState(state);
  setSearchMode(state, mode);
}

export function enterPickSlotMode(state, baseMovieIndex) {
  ensureSearchState(state);
  state.search.pickSlotMode = true;
  state.search.hoveredSlotIndex = -1;
  state.search.pickedBaseIndex = Number(baseMovieIndex);
  state.search.suggestions = [];
  state.search.selectedSuggestion = 0;
  state.search.dropdownBox = null;
}

export function exitPickSlotMode(state) {
  ensureSearchState(state);
  state.search.pickSlotMode = false;
  state.search.hoveredSlotIndex = -1;
  state.search.pickedBaseIndex = -1;
  state.search.suggestions = [];
  state.search.selectedSuggestion = 0;
  state.search.dropdownBox = null;
}

export function closeSearchDropdown(state) {
  ensureSearchState(state);
  state.search.suggestions = [];
  state.search.selectedSuggestion = 0;
  state.search.dropdownBox = null;
}

export function bindSearchKeyboard(Input, state) {
  ensureSearchState(state);
  if (state.search.bound) return;
  state.search.bound = true;

  window.addEventListener(
    "keydown",
    (e) => {
      if (!state) return;
      ensureSearchState(state);

      const focusIsSearch = state.focus === "search";
      const dropdownOpen = (state.search.suggestions || []).length > 0;
      const pickMode = !!state.search.pickSlotMode;
      if (!focusIsSearch && !dropdownOpen && !pickMode) return;

      if (isEscape(e)) {
        state.search.queue.push({ type: "escape" });
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (isBackspace(e)) {
        state.search.queue.push({ type: "backspace" });
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (isEnter(e)) {
        state.search.queue.push({ type: "enter" });
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (isArrowUp(e)) {
        state.search.queue.push({ type: "move", dir: -1 });
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (isArrowDown(e)) {
        state.search.queue.push({ type: "move", dir: +1 });
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (isArrowLeft(e) || isArrowRight(e)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e?.key === " " || e?.code === "Space") {
        state.search.queue.push({ type: "space" });
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (isPrintableKey(e)) {
        state.search.queue.push({ type: "char", ch: e.key });
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { passive: false }
  );
}

export function updateSearchFromQueue(state, baseVisible, opts = {}) {
  ensureSearchState(state);
  if (!Array.isArray(baseVisible)) baseVisible = [];

  const focusIsSearch = state.focus === "search";
  if (!focusIsSearch) {
    state.search.queue = [];
    closeSearchDropdown(state);
    return;
  }

  const q0 = normalizeQuery(state.searchQuery);
  let q = q0;

  const queue = state.search.queue || [];
  if (queue.length) {
    for (const ev of queue) {
      if (!ev || typeof ev !== "object") continue;

      if (ev.type === "char") {
        q = q + String(ev.ch || "");
      } else if (ev.type === "backspace") {
        q = q.length ? q.slice(0, -1) : q;
      } else if (ev.type === "space") {
        // swallow
      } else if (ev.type === "escape") {
        state.search.queue = [];

        if (state.search.pickSlotMode) exitPickSlotMode(state);
        closeSearchDropdown(state);
        state.focus = "movies";
        state.confirmPending = false;
        return;
      } else if (ev.type === "enter") {
        const s = state.search.suggestions || [];
        if (s.length) {
          const idx = clamp(state.search.selectedSuggestion || 0, 0, s.length - 1);
          const chosen = s[idx];
          if (chosen && Number.isFinite(chosen.baseIndex) && Number(chosen.baseIndex) >= 0) {
            enterPickSlotMode(state, Number(chosen.baseIndex));
          }
        }
      } else if (ev.type === "move") {
        const s = state.search.suggestions || [];
        if (s.length) {
          const dir = ev.dir === -1 ? -1 : +1;
          state.search.selectedSuggestion = clamp(
            (state.search.selectedSuggestion || 0) + dir,
            0,
            s.length - 1
          );
        }
      }
    }
    state.search.queue = [];
  }

  state.searchQuery = q;

  if (state.search.pickSlotMode) {
    closeSearchDropdown(state);
  } else if (!q) {
    closeSearchDropdown(state);
  } else {
    if (q !== q0) {
      state.search.suggestions = [];
      state.search.selectedSuggestion = 0;
    }

    requestSuggestions(state, {
      query: q,
      baseVisible,
      limit: 6,
      onResults: (results) => {
        ensureSearchState(state);
        if (state.search.pickSlotMode) return;
        if (normalizeQuery(state.searchQuery) !== normalizeQuery(q)) return;

        state.search.suggestions = Array.isArray(results) ? results : [];
        state.search.selectedSuggestion = clamp(
          state.search.selectedSuggestion || 0,
          0,
          Math.max(0, state.search.suggestions.length - 1)
        );
      }
    });
  }

  if (opts.SCREEN && opts.L) {
    const srMid = inferSearchMidRect(opts.SCREEN, opts.L);
    const dd = getDropdownRect({
      SCREEN: opts.SCREEN,
      L: opts.L,
      sr: { mid: srMid },
      count: (state.search.suggestions || []).length
    });
    state.search.dropdownBox = dd?.box || null;
  }
}

export function handleSearchHover({ mouse, state, SCREEN, L }) {
  ensureSearchState(state);
  if (!mouse) return false;

  const focusIsSearch = state.focus === "search";
  const sugg = state.search.suggestions || [];
  if (!focusIsSearch || !sugg.length || state.search.pickSlotMode) return false;

  const srMid = inferSearchMidRect(SCREEN, L);
  const dd = getDropdownRect({ SCREEN, L, sr: { mid: srMid }, count: sugg.length });
  state.search.dropdownBox = dd.box;

  const mx = mouse.x;
  const my = mouse.y;

  if (pointInRect(mx, my, dd.box)) {
    const relY = my - dd.box.y - dd.pad;
    const idx = clamp(Math.floor(relY / dd.rowH), 0, Math.max(0, dd.rows - 1));
    if (Number.isFinite(idx)) state.search.selectedSuggestion = idx;
    return true;
  }

  return false;
}

export function handleSearchPointer({
  mouse,
  state,
  SCREEN,
  L,
  pointInRect: pointInRectExternal,
  searchRects,
  slotBounds,
  baseVisible,
  onPlaceMovie,
  onCancelPickMode,
  onEnterPickMode,
  playUIMoveBlip,
  persist
}) {
  ensureSearchState(state);
  if (!mouse || !mouse.clicked) return false;

  const mx = mouse.x;
  const my = mouse.y;

  if (state.search.pickSlotMode) {
    let clickedSlot = -1;
    for (let i = 0; i < state.SLOT_COUNT; i++) {
      if (pointInRectExternal(mx, my, slotBounds(i))) {
        clickedSlot = i;
        break;
      }
    }

    if (clickedSlot >= 0) {
      const bi = state.search.pickedBaseIndex;
      if (Number.isFinite(bi) && bi >= 0 && bi < baseVisible.length) {
        try {
          onPlaceMovie(clickedSlot, bi);
        } catch {}
      }
      exitPickSlotMode(state);
      try {
        persist();
      } catch {}
      return true;
    }

    try {
      onCancelPickMode();
    } catch {}
    exitPickSlotMode(state);
    try {
      persist();
    } catch {}
    return true;
  }

  const sr = searchRects();
  if (pointInRectExternal(mx, my, sr.mid)) {
    state.focus = "search";
    try {
      persist();
    } catch {}
    try {
      playUIMoveBlip();
    } catch {}
    return true;
  }

  const sugg = state.search.suggestions || [];
  if (sugg.length) {
    const srMid = inferSearchMidRect(SCREEN, L);
    const dd = getDropdownRect({ SCREEN, L, sr: { mid: srMid }, count: sugg.length });
    state.search.dropdownBox = dd.box;

    if (pointInRectExternal(mx, my, dd.box)) {
      const relY = my - dd.box.y - dd.pad;
      const idx = clamp(Math.floor(relY / dd.rowH), 0, Math.max(0, dd.rows - 1));
      state.search.selectedSuggestion = idx;

      const chosen = sugg[idx];
      if (chosen && Number.isFinite(chosen.baseIndex) && Number(chosen.baseIndex) >= 0) {
        try {
          onEnterPickMode(chosen.baseIndex);
        } catch {}
        enterPickSlotMode(state, chosen.baseIndex);
        try {
          persist();
        } catch {}
        return true;
      }
      return true;
    }
  }

  return false;
}

export function isMouseOverSearchDropdown({ mouse, state }) {
  ensureSearchState(state);
  if (!mouse) return false;
  const box = state.search.dropdownBox;
  if (!box) return false;
  return pointInRect(mouse.x, mouse.y, box);
}

export function renderSearchDropdown(ctx, {
  state,
  SCREEN,
  L,
  colors,
  baseVisible,
  movieMeta,
  getLocalPosterPath,
  ImageCache
}) {
  ensureSearchState(state);

  const focusIsSearch = state.focus === "search";
  const sugg = state.search.suggestions || [];
  if (!focusIsSearch) return;
  if (!sugg.length) return;
  if (state.search.pickSlotMode) return;

  const srMid = inferSearchMidRect(SCREEN, L);
  const dd = getDropdownRect({ SCREEN, L, sr: { mid: srMid }, count: sugg.length });
  state.search.dropdownBox = dd.box;

  ctx.fillStyle = colors.panel || "#111";
  ctx.fillRect(dd.box.x, dd.box.y, dd.box.w, dd.box.h);

  ctx.strokeStyle = colors.stroke || "#555";
  ctx.strokeRect(dd.box.x, dd.box.y, dd.box.w, dd.box.h);

  const rowH = dd.rowH;
  const pad = dd.pad;

  const posterW = num(L?.search?.dropdownPosterW, 20);
  const posterH = num(L?.search?.dropdownPosterH, 28);
  const textX = dd.box.x + pad + posterW + 8;

  const titleFont = L?.search?.dropdownTitleFont || "9px monospace";
  const yearFont = L?.search?.dropdownYearFont || "8px monospace";

  const rightPad = num(L?.search?.dropdownTextPadRight, 8);
  const textW = dd.box.x + dd.box.w - rightPad - textX;

  const line1YOff = num(L?.search?.dropdownLine1Y, 12);
  const lineGap = num(L?.search?.dropdownLineGap, 10);

  for (let i = 0; i < dd.rows; i++) {
    const rowY = dd.box.y + pad + i * rowH;

    const isSel = i === (state.search.selectedSuggestion || 0);
    if (isSel) {
      ctx.strokeStyle = colors.highlight || "#ff0";
      ctx.strokeRect(dd.box.x + 1, rowY + 1, dd.box.w - 2, rowH - 2);
    }

    const { movie } = sugg[i];
    const title = String(movie?.title || "Unknown");
    const year = getYear(movie, movieMeta);

    const posterPath = getLocalPosterPath(movie);
    const px = dd.box.x + pad;
    const py = rowY + Math.floor((rowH - posterH) / 2);

    ctx.fillStyle = colors.posterLoading || "#666";
    ctx.fillRect(px, py, posterW, posterH);

    if (posterPath) {
      try {
        ImageCache.load(posterPath);
        const img = ImageCache.get(posterPath);
        if (img && img.width && img.height) {
          ctx.drawImage(img, px, py, posterW, posterH);
        }
      } catch {}
    }

    ctx.fillStyle = colors.text || "#fff";
    ctx.font = titleFont;

    const titleLines = wrapTextLines(ctx, title, Math.max(10, textW), 2);
    const line1Y = rowY + line1YOff;
    ctx.fillText(titleLines[0] || "", textX, line1Y);

    const hasLine2 = !!titleLines[1];
    if (hasLine2) ctx.fillText(titleLines[1], textX, line1Y + lineGap);

    ctx.fillStyle = colors.textDim || "#aaa";
    ctx.font = yearFont;

    const yearY = hasLine2 ? (line1Y + lineGap * 2) : (line1Y + lineGap);
    ctx.fillText(year, textX, yearY);
  }
}
