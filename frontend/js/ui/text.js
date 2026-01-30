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
