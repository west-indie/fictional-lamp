// frontend/js/layout.js
//
// Single source of truth for screen dimensions and shared UI anchor points.
// Goal: make UI positioning easy by editing *numbers only* (no translate/scale formulas).
//
// ✅ Native 400x300 layouts (no legacy letterbox).

export const SCREEN = {
  W: 400,
  H: 300
};

// -------------------------
// Per-screen anchor layouts
// -------------------------

// Legacy 320x180 (16:9) layout preserved inside 400x300 (4:3) via fixed letterbox.
// Some older screens/overlays still import this.
export const LEGACY_320 = {
  W: 320,
  H: 180,
  SCALE: 1.25,
  OFFSET_X: 0,
  OFFSET_Y: 37.5
};

export const MENU_LAYOUT = {
  title: { x: 112.5, y: 100 },
  subtitle: { x: 87.5, y: 118.75 },
  options: { x: 150, y: 162.5, dy: 25 },
  footer: { x: 60, y: 240 }
};

// If your intro screens are still using legacy numbers elsewhere,
// you can migrate them later; this file stays native-only.

export const BATTLE_LAYOUT = {
  party: { x: 4, y: 12, dx: 99 },
  enemy: { x: 128, y: 118, w: 140, h: 64, padX: 10, nameDy: 15, hpDy: 30 },
  command: { x: 20, y: 214 },
  message: { x: 0, y: 240, h: 64 }
};

// -------------------------
// Select (native 400x300)
// -------------------------
// Added for the new layout-driven select.js.
// Edit numbers only; select.js should not hardcode positions.

export const SELECT_LAYOUT = {
  title: { x: 12, y: 24, font: "15px monospace", color: "#fff", text: "Pick Your Movies" },
  help: { x: 12, y: 40, font: "9px monospace", color: "#777" },

  search: {
    h: 20,
    w: 213,
    btn: 20,
    gap: 8,
    y: 56,
    font: "11px monospace",
    iconFont: "13px monospace",
    placeholder: "search"
  },

  // ✅ UPDATED (your request):
  // - Make the whole slot smaller
  // - Keep slot aspect 2:3 (same as posters)
  // - Ensure no overlap with nameplate + bottom arrow + bottom bar
  slots: {
  poster: {
    shrink: 1
    },
    y: 96,

    // Slot box size (2:3 aspect)
    // Was 80x120; now slightly smaller to give more breathing room
    w: 72,
    h: 108,

    // Tighten gap so 4 slots still look centered and clean
    gap: 12,

    // Height of the arrow button boxes (top overlay + bottom below nameplate)
    arrowHitH: 16,

    // Poster uses the full slot area; keep pads at 0
    poster: { aspect: 2 / 3, padX: 0, padY: 0 },

    // Nameplate sits directly under the slot box.
    // IMPORTANT: basePosterH must match slots.h for correct stacking math in select.js
    nameplate: {
      gap: 3,
      basePosterH: 108,
      h: 24,
      padX: 4,
      lineH: 10,
      font: "8px monospace",
      bg: "#111"
    },

    arrowFont: "13px monospace",
    arrowUpChar: "▲",
    arrowDownChar: "▼",

    // These are legacy offsets used by older arrow drawing styles.
    // If your current select.js draws centered in the arrow boxes, these can stay.
    arrowDyUp: -3,
    arrowDyDown: 13
  },

  bottom: {
    cornerBtn: 23,
    y: 272,
    homeX: 10,

    archetype: {
      y: 272,
      h: 23,
      arrowW: 23,
      sidePad: 13,
      centerPad: 8,
      fontStart: 11,
      fontMin: 8,
      leftChar: "◀",
      rightChar: "▶",
      iconFont: "15px monospace"
    }
  },

  colors: {
    bg: "#000",
    panel: "#111",
    stroke: "#555",
    highlight: "#ff0",
    text: "#fff",
    textDim: "#aaa",
    posterLoading: "#666"
  },

  confirm: {
    box: { x: 40, y: 100, w: 320, h: 18 },
    font: "9px monospace",
    color: "#ff0",
    text: "Ready to start battle?"
  }
};

export const QUICKPLAY_LAYOUT = {
  poster: { w: 64, h: 96, gap: 8 },
  list: { startY: 44, rowH: 12, visibleRows: 5 }
};

// -------------------------
// Quickplay (native 400x300)
// -------------------------
export const QUICKPLAY_SCREEN_LAYOUT = {
  title: { x: 12, y: 24, font: "14px monospace", color: "#fff" },
  subtitle: { x: 12, y: 40, font: "10px monospace", color: "#fff" },

  list: {
    leftX: 25,
    rightX: 213,
    startY: 64,
    rowH: 15,
    visibleRows: 5,
    font: "12px monospace",
    color: "#fff",
    selectedColor: "#ff0"
  },

  scroll: { x: 338, y: 85, font: "9px monospace", color: "#fff" },

  preview: {
    postersY: 144,
    confirmBoxY: 100,
    confirmBoxW: 375,
    confirmBoxH: 23,
    font: "10px monospace",
    color: "#ff0",
    padX: 10,
    textY: 16
  },

  toast: {
    x: 0,
    y: 248,
    w: 400,
    h: 15,
    font: "10px monospace",
    color: "#ff0",
    padX: 10,
    textY: 11
  }
};

// -------------------------
// First/Fourth Pick (native 400x300)
// -------------------------
export const INTRO_LAYOUT = {
  heading: { x: 125, y: 56 },
  name: { x: 125, y: 88 },
  desc: { x: 125, y: 112, w: 150, lh: 24 },
  footer: { y: 176 }
};

// -------------------------
// Native 400x300 intro screens (no legacy letterbox)
// -------------------------
export const LEVEL_INTRO_LAYOUT = {
  heading: { y: 113 },
  name: { y: 150 },
  desc: { y: 169, w: 150, lh: 13 },
  footer: { y: 225 }
};

export const ENEMY_INTRO_LAYOUT = {
  heading: { y: 113 },
  name: { y: 150 },
  desc: { y: 169, w: 150, lh: 13 },
  footer: { y: 225 }
};

export const FIRST_PICK_LAYOUT = {
  poster: { x: 40, y: 32, w: 128, h: 192 },
  title: { dyUnderPoster: 24, genreDy: 22, maxW: 240, startPx: 15, minPx: 9 },
  genres: { fontPx: 12 },
  text: { x: 200, w: 186 },
  headline: { y: 120, maxW: 186, startPx: 18, minPx: 12 },
  effects: { y: 145, startPx: 10, minPx: 5, lineStep: 11, gapAfterBlock: 3 },
  footer: { x: 14, y: 288, fontPx: 10, text: "Enter: Continue   Esc/Bksp: Back" }
};

export const FOURTH_PICK_LAYOUT = {
  poster: { x: 232, y: 32, w: 128, h: 192 },
  title: { dyUnderPoster: 24, genreDy: 22, maxW: 240, startPx: 15, minPx: 9 },
  genres: { fontPx: 12 },
  text: { x: 14, w: 186 },
  headline: { y: 120, maxW: 186, startPx: 18, minPx: 12 },
  effects: { y: 145, startPx: 10, minPx: 5, lineStep: 11, gapAfterBlock: 3 },
  footer: { x: 14, y: 288, fontPx: 10, text: "Enter: Start Battle   Esc/Bksp: Back" }
};

// -------------------------
// Unlock overlay (native 400x300)
// -------------------------
export const UNLOCK_OVERLAY_LAYOUT = {
  panel: { x: 18, y: 60, w: 364, h: 180 },

  title: { x: 30, y: 83 },
  unlocked: { x: 30, y: 100 },
  code: { x: 30, y: 115 },

  posters: { y: 125 },

  footer: {
    y: 238,
    leftX: 30,
    rightX: 213
  }
};
