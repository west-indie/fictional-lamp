// frontend/js/data/unlockKeyCombos.js
//
// Central list of key-sequence unlock combos.
// unlockTriggers reads this and handles:
// - progress tracking
// - unlock persistence (unlockSystem)
// - emitting overlay events to GameState.ui.events
//
// ✅ With the updated InputManager:
// - sequence entries like "i","m","d","b" work reliably (uses e.key char tracking)
// - avoids the KeyD/Right consume conflict entirely.

// frontend/js/data/unlockKeyCombos.js

export const unlockKeyCombos = [
  {
    id: "imdb_code",
    archetypeId: "imdb_minmaxer",
    sequence: ["i", "m", "d", "b"],
    codeLabel: "Code: I → M → D → B",
    showOverlay: true,

    // ✅ NEW: where Enter on the overlay should go
    confirmToScreen: "enemyIntro",

    screens: ["quickplay", "menu", "select"]
  }
];
