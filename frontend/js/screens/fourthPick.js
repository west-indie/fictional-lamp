// frontend/js/screens/fourthPick.js

import { GameState, changeScreen } from "../game.js";
import { Input } from "../ui.js";
import { playUIConfirmBlip, playUIBackBlip } from "../sfx/uiSfx.js";
import { SCREEN, FOURTH_PICK_LAYOUT as L } from "../layout.js";

import { drawCenteredGenres } from "../ui/genreStyle.js";

import {
  computeFourthPickEffect,
  describeFourthPick,
  clearOneFourBattleApplyFlag
} from "../systems/onefourEffectSystem.js";

import { ImageCache, computeCoverCrop } from "../core/ImageCache.js";

const FOURTH_HEADLINES = [
  "The Backbone Comes in Clutch",
  "The Anchor Holds the Line",
  "A Steady Hand Arrives",
  "Support Role, Big Impact",
  "The Foundation Locks In",
  "Closing Piece Completes the Team"
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function ensureCampaignBuckets() {
  if (!GameState.campaign) {
    GameState.campaign = {
      onefourShown: false,
      firstPickApplied: null,
      fourthPickApplied: null,
      effects: { first: null, fourth: null },
      _onefourAppliedThisBattle: false,
      flavor: {}
    };
  }
  if (!GameState.campaign.effects) GameState.campaign.effects = { first: null, fourth: null };
  if (!GameState.campaign.flavor) GameState.campaign.flavor = {};
}

function getFullTitle(movie) {
  return String(movie?.title || movie?.shortTitle || "Unknown");
}

function measure(ctx, s) {
  return ctx.measureText(String(s || "")).width;
}

function getLocalPosterPath(movie) {
  const id = movie?.id ? String(movie.id) : "";
  if (!id) return null;
  return `assets/posters/${id}.jpg`;
}

// ✅ tap/click helper (left = back, right = confirm)
function getTapAction(mouse) {
  if (!mouse) return null;
  const clicked = !!(mouse.clicked || mouse.tapped);
  if (!clicked) return null;

  const x = Number(mouse.x);
  if (!Number.isFinite(x)) return null;

  return x < SCREEN.W / 2 ? "back" : "confirm";
}

function drawCenteredSingleLineFit(ctx, text, cx, y, maxWidth, startPx, minPx) {
  const s = String(text || "");
  for (let px = startPx; px >= minPx; px--) {
    ctx.font = `${px}px monospace`;
    if (measure(ctx, s) <= maxWidth) {
      ctx.fillText(s, Math.floor(cx - measure(ctx, s) / 2), y);
      return;
    }
  }

  ctx.font = `${minPx}px monospace`;
  const ell = "…";

  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = s.slice(0, mid) + ell;
    if (measure(ctx, candidate) <= maxWidth) lo = mid + 1;
    else hi = mid;
  }
  const cut = Math.max(0, lo - 1);
  const out = s.slice(0, cut) + ell;
  ctx.fillText(out, Math.floor(cx - measure(ctx, out) / 2), y);
}

function drawCenteredTitleBlock(ctx, text, cx, yTop, maxWidth, startPx, minPx) {
  const s = String(text || "").trim();
  const words = s.split(/\s+/);

  function wrapAt(px) {
    ctx.font = `${px}px monospace`;
    const lines = [];
    let line = "";
    let consumedWords = 0;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const test = line ? line + " " + w : w;

      if (measure(ctx, test) <= maxWidth || !line) {
        line = test;
        consumedWords++;
      } else {
        lines.push(line);
        line = w;
        if (lines.length >= 2) break;
        consumedWords++;
      }
    }
    if (line && lines.length < 2) lines.push(line);

    if (lines.some((ln) => measure(ctx, ln) > maxWidth)) return null;
    if (lines.length > 2) return null;

    const overflow = consumedWords < words.length;
    if (overflow && lines.length === 2) {
      const ell = "…";
      let base = lines[1];

      if (measure(ctx, base + ell) <= maxWidth) {
        lines[1] = base + ell;
      } else {
        let lo = 0, hi = base.length;
        while (lo < hi) {
          const mid = Math.floor((lo + hi) / 2);
          const candidate = base.slice(0, mid) + ell;
          if (measure(ctx, candidate) <= maxWidth) lo = mid + 1;
          else hi = mid;
        }
        const cut = Math.max(0, lo - 1);
        lines[1] = base.slice(0, cut) + ell;
      }
    }

    return { px, lines };
  }

  let chosen = null;
  for (let px = startPx; px >= minPx; px--) {
    const res = wrapAt(px);
    if (res) { chosen = res; break; }
  }

  if (!chosen) {
    ctx.font = `${minPx}px monospace`;
    drawCenteredSingleLineFit(ctx, s, cx, yTop + minPx, maxWidth, minPx, minPx);
    return;
  }

  const lh = Math.max(10, Math.floor(chosen.px + 2));
  ctx.font = `${chosen.px}px monospace`;

  for (let i = 0; i < chosen.lines.length; i++) {
    const line = chosen.lines[i];
    ctx.fillText(line, Math.floor(cx - measure(ctx, line) / 2), yTop + i * lh);
  }
}

function pctInt(x) {
  return Math.round(Number(x) * 100);
}

function drawCenteredWrappedFit(ctx, text, cx, yTop, maxWidth, startPx, minPx, maxLines = 2) {
  const s = String(text || "").trim();
  if (!s) return 0;

  const words = s.split(/\s+/);

  function wrapAt(px) {
    ctx.font = `${px}px monospace`;

    const lines = [];
    let line = "";

    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (measure(ctx, test) <= maxWidth) {
        line = test;
      } else {
        if (!line) line = w;
        lines.push(line);
        line = w;
        if (lines.length >= maxLines) break;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);

    const overflow =
      lines.length === maxLines &&
      lines.join(" ").split(/\s+/).length < words.length;

    if (overflow) {
      const ell = "…";
      let base = lines[maxLines - 1];

      if (measure(ctx, base + ell) <= maxWidth) {
        lines[maxLines - 1] = base + ell;
      } else {
        let lo = 0, hi = base.length;
        while (lo < hi) {
          const mid = Math.floor((lo + hi) / 2);
          const candidate = base.slice(0, mid) + ell;
          if (measure(ctx, candidate) <= maxWidth) lo = mid + 1;
          else hi = mid;
        }
        const cut = Math.max(0, lo - 1);
        lines[maxLines - 1] = base.slice(0, cut) + ell;
      }
    }

    if (lines.some((ln) => measure(ctx, ln) > maxWidth)) return null;
    return { px, lines };
  }

  let chosen = null;
  for (let px = startPx; px >= minPx; px--) {
    const res = wrapAt(px);
    if (res) { chosen = res; break; }
  }

  if (!chosen) {
    drawCenteredSingleLineFit(ctx, s, cx, yTop + minPx, maxWidth, minPx, minPx);
    return 1;
  }

  const lh = Math.max(10, Math.floor(chosen.px + 2));
  ctx.font = `${chosen.px}px monospace`;

  for (let i = 0; i < chosen.lines.length; i++) {
    const line = chosen.lines[i];
    ctx.fillText(line, Math.floor(cx - measure(ctx, line) / 2), yTop + i * lh);
  }

  return chosen.lines.length;
}

const NONSTAT_TEMPLATES = {
  COMEDY: { team: (pct) => `Specials have a ${pct}% chance to refund the last cooldown!` },
  THRILLER: { team: (pct) => `Basic attacks have a ${pct}% chance to trigger a critical follow-up!` },
  MYSTERY: { team: (pct) => `Items get +${pct}% stronger random stat rolls!` },

  ADVENTURE: { team: () => "Items are stronger!" },
  FANTASY: { team: () => "Special Moves hit harder!" },
  MUSICAL: { team: () => "Special Moves gain a bonus if used in a sequence!" },
  SCIFI: { team: () => "Special Moves build reuse stacks that boost repeats!" }
};

function parsePctFromDescribeLine(line) {
  const s = String(line || "");
  const m = s.match(/\+(\d+)\s*%/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

function parseStatKeyFromDescribeLine(line) {
  const s = String(line || "").toUpperCase();
  if (s.includes("ATK")) return "ATK";
  if (s.includes("DEF")) return "DEF";
  if (s.includes("HP")) return "HP";
  if (s.includes("CRIT DMG") || s.includes("CRITD")) return "CRIT_DMG";
  if (s.includes("CRIT")) return "CRIT";
  if (s.includes("EVA")) return "EVA";
  return null;
}

function formatTeamStatSentence({ statKey, pct }) {
  if (pct == null || !statKey) return "";

  let phrase = "their stats";
  if (statKey === "ATK") phrase = "their attacks";
  else if (statKey === "DEF") phrase = "their defense";
  else if (statKey === "HP") phrase = "their max HP";
  else if (statKey === "CRIT") phrase = "their critical chance";
  else if (statKey === "CRIT_DMG") phrase = "their critical damage";
  else if (statKey === "EVA") phrase = "their evasion";

  return `Team receives an extra +${pct}% on ${phrase}!`;
}

function resolveTeamEffectLine({ genre, describedLine, nonStat }) {
  const pct = parsePctFromDescribeLine(describedLine);
  const statKey = parseStatKeyFromDescribeLine(describedLine);
  if (pct != null && statKey) return formatTeamStatSentence({ statKey, pct });

  const raw = String(describedLine || "").toLowerCase();
  if (!describedLine || raw.includes("no stat change")) {
    const tmpl = NONSTAT_TEMPLATES[genre];
    if (!tmpl) return "";

    if (genre === "COMEDY" && nonStat?.chance != null) return tmpl.team(pctInt(nonStat.chance));
    if (genre === "THRILLER" && nonStat?.chance != null) return tmpl.team(pctInt(nonStat.chance));
    if (genre === "MYSTERY" && nonStat?.rollBonus != null) return tmpl.team(pctInt(nonStat.rollBonus));

    return typeof tmpl.team === "function" ? tmpl.team() : "";
  }

  const cleaned = String(describedLine).replace(/^Self:\s*/i, "").replace(/^Team:\s*/i, "").trim();
  if (/no stat change/i.test(cleaned)) return "";
  return cleaned;
}

function maxLinesForGenre(genre) {
  return (genre === "COMEDY" || genre === "THRILLER" || genre === "MYSTERY") ? 3 : 2;
}

export const FourthPickScreen = {
  update(mouse) {
    ensureCampaignBuckets();

    const movie = GameState.party?.movies?.[3] || null;

    if (!GameState.campaign.flavor.fourthHeadline) {
      GameState.campaign.flavor.fourthHeadline = pick(FOURTH_HEADLINES);
    }

    if (!GameState.campaign.effects.fourth) {
      const eff = computeFourthPickEffect(movie, GameState.campaign.flavor.fourthHeadline);
      GameState.campaign.effects.fourth = eff;
      GameState.campaign.fourthPickApplied = eff?.movieId || null;
    }

    const tap = getTapAction(mouse);
    if (tap === "back") {
      playUIBackBlip();
      changeScreen("firstPick");
      return;
    }
    if (tap === "confirm") {
      GameState.campaign.onefourShown = true;
      clearOneFourBattleApplyFlag(GameState);
      playUIConfirmBlip();
      changeScreen("battle");
      return;
    }

    if (Input.pressed("Backspace") || Input.pressed("Escape")) {
      Input.consume("Backspace");
      Input.consume("Escape");
      playUIBackBlip();
      changeScreen("firstPick");
      return;
    }

    if (Input.pressed("Enter")) {
      Input.consume("Enter");
      GameState.campaign.onefourShown = true;
      clearOneFourBattleApplyFlag(GameState);
      playUIConfirmBlip();
      changeScreen("battle");
      return;
    }
  },

  render(ctx) {
    // (render unchanged)
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SCREEN.W, SCREEN.H);

    ensureCampaignBuckets();

    const movie = GameState.party?.movies?.[3] || null;
    const eff = GameState.campaign?.effects?.fourth || null;

    const title = getFullTitle(movie);

    const g1 = eff?.primaryGenre || null;
    const g2 = eff?.secondaryGenre || null;

    const [rawA, rawB] = describeFourthPick(eff);

    const teamLineA = resolveTeamEffectLine({
      genre: g1,
      describedLine: rawA,
      nonStat: eff?.teamNonStatA || null
    });

    const teamLineB = resolveTeamEffectLine({
      genre: g2,
      describedLine: rawB,
      nonStat: eff?.teamNonStatB || null
    });

    const POST_X = L.poster.x;
    const POST_Y = L.poster.y;
    const POST_W = L.poster.w;
    const POST_H = L.poster.h;

    const labelCenterX = POST_X + Math.floor(POST_W / 2);

    const TEXT_X = L.text.x;
    const TEXT_W = L.text.w;
    const textCenterX = TEXT_X + Math.floor(TEXT_W / 2);

    ctx.strokeStyle = "#777";
    ctx.strokeRect(POST_X, POST_Y, POST_W, POST_H);
    ctx.fillStyle = "#111";
    ctx.fillRect(POST_X + 1, POST_Y + 1, POST_W - 2, POST_H - 2);

    const posterPath = getLocalPosterPath(movie);
    if (posterPath) {
      ImageCache.load(posterPath);
      const img = ImageCache.get(posterPath);
      if (img && img.width && img.height) {
        const dw = POST_W - 2;
        const dh = POST_H - 2;
        const { sx, sy, sw, sh } = computeCoverCrop(img.width, img.height, dw, dh);
        try {
          ctx.drawImage(img, sx, sy, sw, sh, POST_X + 1, POST_Y + 1, dw, dh);
        } catch {}
      }
    }

    ctx.fillStyle = "#fff";
    const titleTopY = POST_Y + POST_H + L.title.dyUnderPoster;
    drawCenteredTitleBlock(ctx, title, labelCenterX, titleTopY, L.title.maxW, L.title.startPx, L.title.minPx);

    const genreY = titleTopY + L.title.genreDy;
    drawCenteredGenres(ctx, g1, g2, labelCenterX, genreY, L.genres.fontPx);

    ctx.fillStyle = "#fff";
    drawCenteredSingleLineFit(
      ctx,
      eff?.headline || "Support Role, Big Impact",
      textCenterX,
      L.headline.y,
      L.headline.maxW,
      L.headline.startPx,
      L.headline.minPx
    );

    ctx.fillStyle = "#777";

    const linesUsedA = drawCenteredWrappedFit(
      ctx,
      teamLineA,
      textCenterX,
      L.effects.y,
      TEXT_W,
      L.effects.startPx,
      L.effects.minPx,
      maxLinesForGenre(g1)
    );

    const nextY = L.effects.y + linesUsedA * L.effects.lineStep + L.effects.gapAfterBlock;

    drawCenteredWrappedFit(
      ctx,
      teamLineB,
      textCenterX,
      nextY,
      TEXT_W,
      L.effects.startPx,
      L.effects.minPx,
      maxLinesForGenre(g2)
    );

    ctx.fillStyle = "#666";
    ctx.font = `${L.footer.fontPx}px monospace`;
    ctx.fillText(L.footer.text, L.footer.x, L.footer.y);
  }
};
