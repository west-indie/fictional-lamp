// frontend/js/ui/battleMessageBox.js
//
// Battle message box controller:
// - Typewriter effect with punctuation pauses
// - Queue of message lines
// - Optional "onDone" callback after queue finishes
// - Render helper that can show either help text OR message text
//
// ✅ Update (positioning for 400x300-friendly layout):
// - `render()` now supports explicit positioning via:
//     renderOpts.x, renderOpts.y
//   If provided, the message box is drawn at (x,y) with (width,boxHeight).
// - If `y` is NOT provided, it falls back to the old behavior (anchored to bottom).
//
// ✅ Existing update kept:
// - Help titles can be multi-line using "\n" (we render up to 2 lines).
// - Help BODY can contain "\n" and will render as real new lines (handled by drawWrappedText).
// - Help BODY renders up to 3 lines.
//
// Exports:
// - createBattleMessageBox

import { drawWrappedText } from "./text.js";

export function createBattleMessageBox(options = {}) {
  const playTextBlip = typeof options.playTextBlip === "function" ? options.playTextBlip : null;

  // timings
  const TYPE_MS_PER_CHAR = Number(options.typeMsPerChar ?? 18);
  const TYPE_PUNCTUATION_PAUSE_MS = Number(options.punctuationPauseMs ?? 120);
  const TYPE_BIG_PUNCTUATION_PAUSE_MS = Number(options.bigPunctuationPauseMs ?? 220);
  const BLIP_EVERY_N_CHARS = Number(options.blipEveryNChars ?? 2);
  const BLIP_ON_FIRST_CHAR = options.blipOnFirstChar ?? true;

  // box render defaults
  const DEFAULT_BOX_H = Number(options.boxHeight ?? 44);

  // state
  let message = "";
  let messageShown = "";
  let isTyping = false;
  let typeIndex = 0;
  let lastTypeMs = 0;

  let messageQueue = [];
  let messageOnDone = null;

  function punctuationPauseForChar(ch) {
    if (ch === "." || ch === "," || ch === ":" || ch === ";") return TYPE_PUNCTUATION_PAUSE_MS;
    if (ch === "!" || ch === "?") return TYPE_BIG_PUNCTUATION_PAUSE_MS;
    return 0;
  }

  function nowMs() {
    return performance.now ? performance.now() : Date.now();
  }

  function clear() {
    message = "";
    messageShown = "";
    isTyping = false;
    typeIndex = 0;
    lastTypeMs = 0;
    messageQueue = [];
    messageOnDone = null;
  }

  function startTyping(text) {
    message = String(text || "");
    messageShown = "";
    isTyping = true;
    typeIndex = 0;
    lastTypeMs = nowMs();
  }

  function finishTyping() {
    messageShown = message;
    isTyping = false;
    typeIndex = message.length;
  }

  function tick() {
    if (!isTyping) return;

    const now = nowMs();
    if (now < lastTypeMs) return;

    while (typeIndex < message.length && now >= lastTypeMs) {
      typeIndex++;
      messageShown = message.slice(0, typeIndex);

      const ch = message[typeIndex - 1];

      const shouldBlip =
        ch !== " " &&
        (BLIP_ON_FIRST_CHAR && typeIndex === 1 ? true : typeIndex % BLIP_EVERY_N_CHARS === 0);

      if (shouldBlip && playTextBlip) playTextBlip();

      lastTypeMs += TYPE_MS_PER_CHAR;

      const pause = punctuationPauseForChar(ch);
      if (pause > 0) {
        lastTypeMs += pause;
        break;
      }
    }

    if (typeIndex >= message.length) {
      isTyping = false;
    }
  }

  function isBusy() {
    return isTyping || messageQueue.length > 0 || messageOnDone !== null;
  }

  function queue(lines, onDone = null) {
    const arr = Array.isArray(lines) ? lines : [String(lines)];
    const cleaned = arr.filter(Boolean).map(String);

    if (!isTyping && messageQueue.length === 0 && messageOnDone === null) {
      const first = cleaned.shift() || "";
      startTyping(first);
    }

    messageQueue.push(...cleaned);
    messageOnDone = onDone;
  }

  function advance() {
    if (isTyping) {
      finishTyping();
      return;
    }

    if (messageQueue.length > 0) {
      startTyping(messageQueue.shift());
      return;
    }

    if (messageOnDone) {
      const cb = messageOnDone;
      messageOnDone = null;
      cb();
    }
  }

  function render(ctx, renderOpts = {}) {
    // Default to 400x300 if you’re now rendering in true screen space.
    // (Still compatible if you pass 320x180.)
    const width = Number(renderOpts.width ?? 400);
    const height = Number(renderOpts.height ?? 300);

    const boxH = Number(renderOpts.boxHeight ?? DEFAULT_BOX_H);

    // ✅ NEW: explicit position support (easy UI nudging)
    const boxX = Number(renderOpts.x ?? 0);

    // If y is provided, use it. Otherwise, keep old “anchored to bottom” behavior.
    const boxY =
      renderOpts.y != null
        ? Number(renderOpts.y)
        : height - boxH;

    const getHelpPanelText =
      typeof renderOpts.getHelpPanelText === "function" ? renderOpts.getHelpPanelText : null;

    // background
    ctx.fillStyle = "#000";
    ctx.fillRect(boxX, boxY, width, boxH);

    // text style
    ctx.fillStyle = "#fff";
    ctx.font = renderOpts.font ?? "8px monospace";

    const paddingX = Number(renderOpts.paddingX ?? 8);
    const lineHeight = Number(renderOpts.lineHeight ?? 10);
    const maxWidth = width - paddingX * 2;

    // If help available, show help instead of message
    const help = getHelpPanelText ? getHelpPanelText() : null;

    if (help) {
      // Support up to 2 title lines via "\n"
      const rawTitle = String(help.title ?? "");
      const titleLines = rawTitle.split("\n").slice(0, 2).map((s) => s.trim());

      const titleLine1 = (titleLines[0] || "").slice(0, 80);
      const titleLine2 = (titleLines[1] || "").slice(0, 80);

      // Render title line 1
      ctx.fillText(titleLine1, boxX + paddingX, boxY + 14);

      // Render title line 2 if present
      const hasSecondTitleLine = titleLine2.length > 0;
      if (hasSecondTitleLine) {
        ctx.fillText(titleLine2, boxX + paddingX, boxY + 14 + lineHeight);
      }

      // Body starts under the title lines
      const bodyY = hasSecondTitleLine ? boxY + 14 + lineHeight * 2 : boxY + 28;

      // allow 3 lines so your footer (Target | CD) can sit on its own line
      drawWrappedText(ctx, help.body ?? "", boxX + paddingX, bodyY, maxWidth, lineHeight, 3);
      return;
    }

    // Message mode (typewriter)
    drawWrappedText(ctx, messageShown, boxX + paddingX, boxY + 14, maxWidth, lineHeight, 3);

    // show arrow indicator if queue remains
    if (!isTyping && (messageQueue.length > 0 || messageOnDone)) {
      ctx.fillText("▶", boxX + width - 14, boxY + boxH - 10);
    }
  }

  function getCurrentText() {
    return messageShown;
  }

  return {
    clear,
    tick,
    isBusy,
    queue,
    advance,
    render,
    getCurrentText
  };
}
