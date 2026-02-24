// frontend/js/ui/text.js
//
// Small canvas text helpers used across screens (battle/select/etc).
// No game-state imports.
//
// Exports:
// - drawWrappedText
// - fitTextToWidth
// - drawTwoLineButtonText

export function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const paragraphs = String(text ?? "").split("\n");

  const lines = [];
  for (const para of paragraphs) {
    const words = String(para).split(" ");
    let line = "";

    for (let i = 0; i < words.length; i++) {
      const test = line ? `${line} ${words[i]}` : words[i];
      const w = ctx.measureText(test).width;

      if (w > maxWidth && line) {
        lines.push(line);
        line = words[i];

        if (lines.length >= maxLines) break;
      } else {
        line = test;
      }
    }

    if (lines.length >= maxLines) break;
    if (line) lines.push(line);

    // explicit newline between paragraphs (only if room)
    if (lines.length < maxLines && para !== paragraphs[paragraphs.length - 1]) {
      // add a blank line between paragraphs if you want spacing; usually not needed
      // lines.push("");
    }
  }

  // Ellipsis if overflowed beyond maxLines (only for single-paragraph overflow feel)
  if (lines.length === maxLines) {
    const originalWords = String(text ?? "").split(/\s+/).filter(Boolean);
    const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;

    if (consumed < originalWords.length) {
      let last = lines[maxLines - 1] || "";
      while (last.length > 0 && ctx.measureText(last + "...").width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = (last || "").trimEnd() + "...";
    }
  }

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * lineHeight);
  }
}

function drawLineWithHighlight(ctx, line, x, y, match, color) {
  const full = String(line ?? "");
  const m = String(match ?? "");
  const c = String(color ?? "").trim();
  if (!m || !c) {
    ctx.fillText(full, x, y);
    return;
  }

  const firstIdx = full.indexOf(m);
  if (firstIdx < 0) {
    ctx.fillText(full, x, y);
    return;
  }

  let dx = x;
  let start = 0;
  while (start < full.length) {
    const idx = full.indexOf(m, start);
    if (idx < 0) {
      const rest = full.slice(start);
      if (rest) {
        // While typewriter is revealing text, color partial actor-name prefixes too
        // so highlighting starts immediately instead of waiting for the full name.
        let partialLen = 0;
        const maxProbe = Math.min(rest.length, Math.max(0, m.length - 1));
        for (let n = maxProbe; n > 0; n--) {
          const tail = rest.slice(rest.length - n);
          if (m.startsWith(tail)) {
            partialLen = n;
            break;
          }
        }

        if (partialLen > 0) {
          const pre = rest.slice(0, rest.length - partialLen);
          const partial = rest.slice(rest.length - partialLen);
          if (pre) {
            ctx.fillStyle = "#fff";
            ctx.fillText(pre, dx, y);
            dx += ctx.measureText(pre).width;
          }
          ctx.fillStyle = c;
          ctx.fillText(partial, dx, y);
        } else {
          ctx.fillStyle = "#fff";
          ctx.fillText(rest, dx, y);
        }
      }
      break;
    }

    const pre = full.slice(start, idx);
    if (pre) {
      ctx.fillStyle = "#fff";
      ctx.fillText(pre, dx, y);
      dx += ctx.measureText(pre).width;
    }

    const hit = full.slice(idx, idx + m.length);
    ctx.fillStyle = c;
    ctx.fillText(hit, dx, y);
    dx += ctx.measureText(hit).width;
    start = idx + m.length;
  }
}

function normalizeHighlightNames(highlight) {
  const list = Array.isArray(highlight?.names) ? highlight.names : [highlight?.name];
  const out = [];
  for (const v of list) {
    const s = String(v || "").trim();
    if (!s) continue;
    if (!out.includes(s)) out.push(s);
  }
  out.sort((a, b) => b.length - a.length);
  return out;
}

function normalizeHighlightsInput(highlight) {
  const arr = Array.isArray(highlight) ? highlight : highlight ? [highlight] : [];
  const out = [];
  for (const h of arr) {
    if (!h || typeof h !== "object") continue;
    const color = String(h.color || "").trim();
    const names = normalizeHighlightNames(h);
    if (!color || names.length === 0) continue;
    out.push({ color, names });
  }
  return out;
}

function buildLineHighlightMatches(line, highlights) {
  const s = String(line ?? "");
  const raw = [];

  for (const hl of highlights) {
    for (const name of hl.names) {
      let at = s.indexOf(name);
      while (at >= 0) {
        raw.push({
          start: at,
          end: at + name.length,
          len: name.length,
          color: hl.color
        });
        at = s.indexOf(name, at + Math.max(1, name.length));
      }
    }
  }

  raw.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.len - a.len;
  });

  const chosen = [];
  let cursor = 0;
  for (const m of raw) {
    if (m.start < cursor) continue;
    chosen.push(m);
    cursor = m.end;
  }

  return chosen;
}

function bestPartialAtEnd(text, highlights) {
  const s = String(text || "");
  let best = null;

  for (const hl of highlights) {
    for (const n of hl.names) {
      const maxProbe = Math.min(s.length, Math.max(0, n.length - 1));
      for (let k = maxProbe; k > 0; k--) {
        if (s.endsWith(n.slice(0, k))) {
          if (!best || k > best.len) {
            best = { len: k, color: hl.color };
          }
          break;
        }
      }
    }
  }
  return best;
}

function drawLineWithHighlights(ctx, line, x, y, highlightsInput) {
  const full = String(line ?? "");
  const highlights = normalizeHighlightsInput(highlightsInput);
  if (highlights.length === 0) {
    ctx.fillStyle = "#fff";
    ctx.fillText(full, x, y);
    return;
  }

  const matches = buildLineHighlightMatches(full, highlights);

  let dx = x;
  let pos = 0;
  for (const m of matches) {
    if (m.start > pos) {
      const plain = full.slice(pos, m.start);
      if (plain) {
        ctx.fillStyle = "#fff";
        ctx.fillText(plain, dx, y);
        dx += ctx.measureText(plain).width;
      }
    }

    const hit = full.slice(m.start, m.end);
    if (hit) {
      ctx.fillStyle = m.color;
      ctx.fillText(hit, dx, y);
      dx += ctx.measureText(hit).width;
    }
    pos = m.end;
  }

  const rest = full.slice(pos);
  if (!rest) return;

  const partial = bestPartialAtEnd(rest, highlights);
  if (partial && partial.len > 0) {
    const pre = rest.slice(0, rest.length - partial.len);
    const tail = rest.slice(rest.length - partial.len);
    if (pre) {
      ctx.fillStyle = "#fff";
      ctx.fillText(pre, dx, y);
      dx += ctx.measureText(pre).width;
    }
    ctx.fillStyle = partial.color;
    ctx.fillText(tail, dx, y);
  } else {
    ctx.fillStyle = "#fff";
    ctx.fillText(rest, dx, y);
  }
}

export function drawWrappedTextWithHighlight(
  ctx,
  text,
  x,
  y,
  maxWidth,
  lineHeight,
  maxLines = 2,
  highlight = null
) {
  const paragraphs = String(text ?? "").split("\n");

  const lines = [];
  for (const para of paragraphs) {
    const words = String(para).split(" ");
    let line = "";

    for (let i = 0; i < words.length; i++) {
      const test = line ? `${line} ${words[i]}` : words[i];
      const w = ctx.measureText(test).width;

      if (w > maxWidth && line) {
        lines.push(line);
        line = words[i];

        if (lines.length >= maxLines) break;
      } else {
        line = test;
      }
    }

    if (lines.length >= maxLines) break;
    if (line) lines.push(line);
  }

  if (lines.length === maxLines) {
    const originalWords = String(text ?? "").split(/\s+/).filter(Boolean);
    const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;

    if (consumed < originalWords.length) {
      let last = lines[maxLines - 1] || "";
      while (last.length > 0 && ctx.measureText(last + "...").width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = (last || "").trimEnd() + "...";
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const ly = y + i * lineHeight;
    drawLineWithHighlights(ctx, lines[i], x, ly, highlight);
  }
}

export function fitTextToWidth(ctx, text, maxWidth) {
  const s = String(text || "");
  if (ctx.measureText(s).width <= maxWidth) return s;

  const ell = "...";
  const ellW = ctx.measureText(ell).width;

  let lo = 0;
  let hi = s.length;

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const part = s.slice(0, mid);
    if (ctx.measureText(part).width + ellW <= maxWidth) lo = mid;
    else hi = mid - 1;
  }

  return s.slice(0, Math.max(0, lo)).trimEnd() + ell;
}

export function drawTwoLineButtonText(ctx, line1, line2, x, y, buttonW, opts = {}) {
  const padX = Number(opts.padX ?? 4);
  const line1Y = Number(opts.line1Y ?? (y + 11));
  const line2Y = Number(opts.line2Y ?? (y + 20));

  const maxW = buttonW - padX * 2;

  const t1 = fitTextToWidth(ctx, line1, maxW);
  const t2 = fitTextToWidth(ctx, line2, maxW);

  ctx.fillText(t1, x + padX, line1Y);
  ctx.fillText(t2, x + padX, line2Y);
}
