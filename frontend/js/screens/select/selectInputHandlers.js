// frontend/js/screens/select/selectInputHandlers.js
//
// Input dispatcher utilities for Select.
// These functions mutate the passed-in `state` and return `true` when handled.

function isPickSlotMode(state) {
  return !!(state?.search?.pickSlotMode || state?.pickSlotMode);
}

function clearPickSlotMode(state) {
  if (!state) return;
  if (state.search && typeof state.search === "object") {
    state.search.pickSlotMode = false;
    state.search.pickedBaseIndex = -1;
  }
  state.pickSlotMode = false;
  state.pickSlotMovieId = null;
}

export function detectKeyboardInput(Input, mouse, prevInputMode) {
  if (
    Input.pressed("Left") ||
    Input.pressed("Right") ||
    Input.pressed("Up") ||
    Input.pressed("Down") ||
    Input.pressed("Confirm") ||
    Input.pressed("Back") ||
    Input.pressed("Toggle") ||
    Input.pressed("Randomize") ||
    Input.pressed("GenreRandomize") ||
    Input.pressed("Clear")
  ) {
    return "keyboard";
  }
  if (mouse?.moved || mouse?.pressed || mouse?.clicked || mouse?.tapped) return "mouse";
  return prevInputMode;
}

export function shouldResetStreakThisFrame(Input, mouse, inConfirmPending) {
  if (inConfirmPending) return true;
  if (Input.pressed("GenreRandomize")) return true;
  if (Input.pressed("Toggle")) return true;
  if (Input.pressed("Confirm")) return true;
  if (Input.pressed("Back")) return true;
  if (Input.pressed("Clear")) return true;
  if (Input.pressed("Left") || Input.pressed("Right") || Input.pressed("Up") || Input.pressed("Down")) return true;
  if (mouse?.clicked) return true;
  return false;
}

// -------------------
// Hover handler (mouse sets focus)
// -------------------

export function handlePointerHover({
  mouse,
  state,
  pointInRect,
  homeCornerRect,
  battleCornerRect,
  searchRects,
  topArrowRect,
  bottomArrowRect,
  slotBounds,
  archetypeBarRects,
  persist,
  playUIMoveBlip
}) {
  if (state.inputMode !== "mouse") return false;
  if (!mouse) return false;
  if (!mouse.moved) return false;

  const mx = mouse.x;
  const my = mouse.y;

  const inConfirm = !!state.confirmPending;

  // Ensure field exists
  if (state.hoverCorner !== "home" && state.hoverCorner !== "battle") state.hoverCorner = null;

  // --- Corner hover (always allowed) ---
  const overHome = pointInRect(mx, my, homeCornerRect());
  const overBattle = pointInRect(mx, my, battleCornerRect());

  const nextCorner = overHome ? "home" : overBattle ? "battle" : null;
  if (state.hoverCorner !== nextCorner) {
    state.hoverCorner = nextCorner;
  }

  // If confirm is showing, don't move focus around on hover
  if (inConfirm) return nextCorner !== null;

  // If in pick-slot mode, keep focus on movies and don't change it via hover
  if (isPickSlotMode(state)) return nextCorner !== null;

  // --- Search hover ---
  const sr = searchRects();
  if (pointInRect(mx, my, sr.mid)) {
    if (state.focus !== "search") {
      state.focus = "search";
      persist();
      playUIMoveBlip();
    }
    return true;
  }

  // --- Slot arrows hover (priority) ---
  for (let i = 0; i < state.SLOT_COUNT; i++) {
    if (pointInRect(mx, my, topArrowRect(i)) || pointInRect(mx, my, bottomArrowRect(i))) {
      if (state.focus !== "movies" || state.activeSlot !== i) {
        state.focus = "movies";
        state.activeSlot = i;
        persist();
        playUIMoveBlip();
      }
      return true;
    }
  }

  // --- Slot body hover ---
  for (let i = 0; i < state.SLOT_COUNT; i++) {
    if (pointInRect(mx, my, slotBounds(i))) {
      if (state.focus !== "movies" || state.activeSlot !== i) {
        state.focus = "movies";
        state.activeSlot = i;
        persist();
        playUIMoveBlip();
      }
      return true;
    }
  }

  // --- Archetype bar hover ---
  const { left, right, center } = archetypeBarRects();
  if (pointInRect(mx, my, left) || pointInRect(mx, my, right) || pointInRect(mx, my, center)) {
    if (state.focus !== "archetypes") {
      state.focus = "archetypes";
      persist();
      playUIMoveBlip();
    }
    return true;
  }

  return nextCorner !== null;
}

// -------------------
// Priority handlers
// -------------------

export function handleUnlockOverlayMode({
  Input,
  state,
  closeOverlay,
  ensureInitialized,
  clearAllSlotsToBlank,
  playUIConfirmBlip,
  playUIBackBlip
}) {
  if (state.uiMode !== "unlock") return false;

  if (Input.pressed("Clear")) {
    Input.consume("Clear");
    closeOverlay();
    ensureInitialized();
    clearAllSlotsToBlank();
    playUIConfirmBlip();
    return true;
  }

  if (Input.pressed("Back")) {
    Input.consume("Back");
    playUIBackBlip();
    closeOverlay();
    return true;
  }

  if (state.enterArmed && Input.pressed("Confirm")) {
    state.enterArmed = false;
    Input.consume("Confirm");
    playUIConfirmBlip();
    closeOverlay();
    return true;
  }

  return true; // in overlay mode, block rest of update
}

export function handleConfirmPending({
  Input,
  mouse,
  state,
  pointInRect,
  homeCornerRect,
  battleCornerRect,
  baseVisible,
  persist,
  confirmPicks,
  playUIBackBlip,
  playUIConfirmBlip
}) {
  if (!state.confirmPending) return false;

  // ✅ Backspace/Esc cancels confirm pending (keyboard)
  if (Input.pressed("Back")) {
    Input.consume("Back");
    playUIBackBlip();
    state.confirmPending = false;
    persist();
    return true;
  }

  // Keyboard Confirm commits
  if (state.inputMode === "keyboard" && state.enterArmed && Input.pressed("Confirm")) {
    state.enterArmed = false;
    Input.consume("Confirm");
    confirmPicks(baseVisible);
    state.confirmPending = false;
    return true;
  }

  // Mouse/touch confirm pending
  if (mouse?.clicked) {
    const mx = mouse.x;
    const my = mouse.y;

    if (pointInRect(mx, my, homeCornerRect())) {
      playUIBackBlip();
      state.confirmPending = false;
      persist();
      return true;
    }

    if (pointInRect(mx, my, battleCornerRect())) {
      playUIConfirmBlip();
      confirmPicks(baseVisible);
      state.confirmPending = false;
      return true;
    }

    playUIBackBlip();
    state.confirmPending = false;
    persist();
    return true;
  }

  return true;
}

export function handleGlobalHotkeys({
  Input,
  state,
  persist,
  goHome,
  clearAllSlotsToBlank,
  playUIBackBlip,
  playUIConfirmBlip
}) {
  if (Input.pressed("Clear")) {
    Input.consume("Clear");
    clearAllSlotsToBlank();
    playUIConfirmBlip();
    return true;
  }

  if (Input.pressed("Back")) {
    Input.consume("Back");
    playUIBackBlip();

    // If we are in pick-slot mode, Back cancels that instead of leaving screen
    if (isPickSlotMode(state)) {
      clearPickSlotMode(state);
      persist();
      return true;
    }

    if (state.confirmPending) {
      state.confirmPending = false;
      persist();
      return true;
    }

    goHome();
    return true;
  }

  return false;
}

export function handleToggleFocus({ Input, state, persist, playUIMoveBlip }) {
  if (!Input.pressed("Toggle")) return false;
  Input.consume("Toggle");

  // Don't toggle focus during pick-slot mode
  if (isPickSlotMode(state)) return true;

  state.confirmPending = false;

  if (state.focus === "search") state.focus = "movies";
  else state.focus = state.focus === "movies" ? "archetypes" : "movies";

  persist();
  playUIMoveBlip();
  return true;
}

export function handleRandomizeActions({
  Input,
  state,
  baseVisible,
  displayToBase,
  onPressRandomizeMaybeStartTrial,
  randomizeSlots,
  randomizeSlotsCommonGenre,
  persist,
  playUIMoveBlip
}) {
  // Block randomize while in pick-slot mode
  if (isPickSlotMode(state)) return false;

  if (Input.pressed("Randomize")) {
    Input.consume("Randomize");
    state.archetypeIndex = 0;
    state.archetypeConfirmed = false;

    const next = randomizeSlots({ SLOT_COUNT: state.SLOT_COUNT, baseLen: baseVisible.length, displayToBase });
    if (next) state.slots = next;

    state.confirmPending = false;
    persist();
    playUIMoveBlip();

    onPressRandomizeMaybeStartTrial();
    return true;
  }

  if (Input.pressed("GenreRandomize")) {
    Input.consume("GenreRandomize");
    state.archetypeIndex = 0;
    state.archetypeConfirmed = false;

    const picked = randomizeSlotsCommonGenre({
      SLOT_COUNT: state.SLOT_COUNT,
      movieMeta: state.movieMeta,
      baseVisible,
      displayToBase
    });

    if (picked) state.slots = picked;
    else {
      const next = randomizeSlots({ SLOT_COUNT: state.SLOT_COUNT, baseLen: baseVisible.length, displayToBase });
      if (next) state.slots = next;
    }

    state.confirmPending = false;
    persist();
    playUIMoveBlip();
    return true;
  }

  return false;
}

export function handleConfirmPressed({
  Input,
  state,
  archetypes,
  setArchetypeByIndex,
  persist,
  playUIConfirmBlip,
  playUIBackBlip
}) {
  if (!(state.inputMode === "keyboard" && state.enterArmed && Input.pressed("Confirm"))) return false;

  // If pick-slot mode is active, Enter does nothing (must click a slot or press Back/Esc)
  if (isPickSlotMode(state)) {
    Input.consume("Confirm");
    playUIBackBlip();
    return true;
  }

  state.enterArmed = false;
  Input.consume("Confirm");

  // NOTE: Search prompt mode removed when you use dropdown search.
  // We keep this behavior: if focus is search, just open confirmPending? no.
  // Minimal: confirm does nothing special here; the dropdown handles Enter via keyboard capture.
  if (state.focus === "search") {
    playUIConfirmBlip();
    return true;
  }

  if (state.focus === "archetypes") {
    if (!state.archetypeConfirmed) {
      state.archetypeConfirmed = true;
      state.confirmedArchetypeIndex =
        ((state.archetypeIndex % archetypes.length) + archetypes.length) % archetypes.length;
      setArchetypeByIndex(state.confirmedArchetypeIndex);
      state.confirmPending = false;
      persist();
      playUIConfirmBlip();
      return true;
    }

    state.confirmPending = true;
    persist();
    playUIConfirmBlip();
    return true;
  }

  state.confirmPending = true;
  persist();
  playUIConfirmBlip();
  return true;
}

export function handleKeyboardNavigation({
  Input,
  state,
  baseVisibleLen,
  displayToBase,
  archetypesLen,
  setArchetypeByIndex,
  cycleSlotWithOptionalFilter,
  clampIndex,
  persist,
  playUIMoveBlip
}) {
  if (state.inputMode !== "keyboard") return false;

  // Block slot/archetype navigation while in pick-slot mode
  if (isPickSlotMode(state)) return false;

  if (state.focus === "movies") {
    if (Input.pressed("Left")) {
      Input.consume("Left");
      state.activeSlot = (state.activeSlot - 1 + state.SLOT_COUNT) % state.SLOT_COUNT;
      state.confirmPending = false;
      persist();
      playUIMoveBlip();
    }
    if (Input.pressed("Right")) {
      Input.consume("Right");
      state.activeSlot = (state.activeSlot + 1) % state.SLOT_COUNT;
      state.confirmPending = false;
      persist();
      playUIMoveBlip();
    }
    if (Input.pressed("Up")) {
      Input.consume("Up");
      if (state.archetypeIndex !== 0) state.archetypeIndex = 0;
      state.archetypeConfirmed = false;

      cycleSlotWithOptionalFilter({
        slots: state.slots,
        slotIdx: state.activeSlot,
        dir: -1,
        displayToBase,
        baseLen: baseVisibleLen
      });

      state.confirmPending = false;
      persist();
      playUIMoveBlip();
    }
    if (Input.pressed("Down")) {
      Input.consume("Down");
      if (state.archetypeIndex !== 0) state.archetypeIndex = 0;
      state.archetypeConfirmed = false;

      cycleSlotWithOptionalFilter({
        slots: state.slots,
        slotIdx: state.activeSlot,
        dir: +1,
        displayToBase,
        baseLen: baseVisibleLen
      });

      state.confirmPending = false;
      persist();
      playUIMoveBlip();
    }
    return true;
  }

  if (state.focus === "archetypes") {
    if (Input.pressed("Left")) {
      Input.consume("Left");
      if (!state.archetypeConfirmed) {
        state.archetypeIndex = clampIndex(state.archetypeIndex - 1, archetypesLen);
        setArchetypeByIndex(state.archetypeIndex);
        state.confirmPending = false;
        persist();
      }
      playUIMoveBlip();
      return true;
    }
    if (Input.pressed("Right")) {
      Input.consume("Right");
      if (!state.archetypeConfirmed) {
        state.archetypeIndex = clampIndex(state.archetypeIndex + 1, archetypesLen);
        setArchetypeByIndex(state.archetypeIndex);
        state.confirmPending = false;
        persist();
      }
      playUIMoveBlip();
      return true;
    }
    return true;
  }

  return false;
}

export function handlePointerInput({
  mouse,
  state,
  pointInRect,
  homeCornerRect,
  battleCornerRect,
  searchRects,
  topArrowRect,
  bottomArrowRect,
  slotBounds,
  archetypeBarRects,
  baseVisible,
  displayToBase,
  archetypes,
  clampIndex,
  cycleSlotWithOptionalFilter,
  setArchetypeByIndex,
  persist,
  goHome,
  confirmPicks,
  playUIBackBlip,
  playUIConfirmBlip,
  playUIMoveBlip,

  // --- NEW: search system hooks ---
  handleSearchPointerFn,
  getAllMovies,
  onSelectMovieId,
  ImageCache,
  getPosterPath
}) {
  if (!(state.inputMode === "mouse" && mouse?.clicked)) return false;

  const mx = mouse.x;
  const my = mouse.y;

  // Home corner
  if (pointInRect(mx, my, homeCornerRect())) {
    if (state.confirmPending) {
      playUIBackBlip();
      state.confirmPending = false;
      persist();
      return true;
    }

    // If pick-slot mode, Back/Cancel via home click
    if (isPickSlotMode(state)) {
      playUIBackBlip();
      clearPickSlotMode(state);
      persist();
      return true;
    }

    goHome();
    return true;
  }

  // Confirm pending is handled by higher-priority handler; safe guard:
  if (state.confirmPending) return true;

  // Battle corner triggers confirm pending (disabled during pick-slot mode)
  if (!isPickSlotMode(state) && pointInRect(mx, my, battleCornerRect())) {
    state.confirmPending = true;
    persist();
    playUIConfirmBlip();
    return true;
  }

  // --- NEW: Search row + dropdown pointer handling ---
  if (
    handleSearchPointerFn?.({
      mouse,
      state,
      pointInRect,
      searchRects,
      getAllMovies,
      onSelectMovieId,
      playUIConfirmBlip,
      playUIBackBlip,
      playUIMoveBlip,
      persist,
      ImageCache,
      getPosterPath
    })
  ) {
    return true;
  }

  // --- NEW: Pick-slot mode click assigns movie to slot ---
  if (isPickSlotMode(state)) {
    for (let i = 0; i < state.SLOT_COUNT; i++) {
      if (!pointInRect(mx, my, slotBounds(i))) continue;

      const targetId = state.pickSlotMovieId;

      // Find movie in current baseVisible list by id
      const displayIdx = baseVisible.findIndex((m) => m && m.id === targetId);
      if (displayIdx < 0) {
        playUIBackBlip();
        return true;
      }

      // Convert display index -> base index if mapping exists
      const baseIdx = displayToBase ? (displayToBase[displayIdx] ?? displayIdx) : displayIdx;

      state.slots[i] = baseIdx;
      state.focus = "movies";
      state.activeSlot = i;

      clearPickSlotMode(state);

      state.confirmPending = false;
      persist();
      playUIConfirmBlip();
      return true;
    }

    // Clicks outside slots while in pick-slot mode do nothing
    return true;
  }

  // Slot arrow hitboxes (must be checked before slot bounds)
  for (let i = 0; i < state.SLOT_COUNT; i++) {
    if (pointInRect(mx, my, topArrowRect(i))) {
      state.focus = "movies";
      state.activeSlot = i;
      state.archetypeIndex = 0;
      state.archetypeConfirmed = false;

      cycleSlotWithOptionalFilter({
        slots: state.slots,
        slotIdx: i,
        dir: -1,
        displayToBase,
        baseLen: baseVisible.length
      });

      state.confirmPending = false;
      persist();
      playUIMoveBlip();
      return true;
    }
    if (pointInRect(mx, my, bottomArrowRect(i))) {
      state.focus = "movies";
      state.activeSlot = i;
      state.archetypeIndex = 0;
      state.archetypeConfirmed = false;

      cycleSlotWithOptionalFilter({
        slots: state.slots,
        slotIdx: i,
        dir: +1,
        displayToBase,
        baseLen: baseVisible.length
      });

      state.confirmPending = false;
      persist();
      playUIMoveBlip();
      return true;
    }
  }

  // Slot bounds click selects active slot
  for (let i = 0; i < state.SLOT_COUNT; i++) {
    if (pointInRect(mx, my, slotBounds(i))) {
      state.activeSlot = i;
      state.focus = "movies";
      state.confirmPending = false;
      persist();
      playUIMoveBlip();
      return true;
    }
  }

  // Archetype bar clicks
  const { left, right, center } = archetypeBarRects();

  if (pointInRect(mx, my, left)) {
    state.focus = "archetypes";
    if (!state.archetypeConfirmed) {
      state.archetypeIndex = clampIndex(state.archetypeIndex - 1, archetypes.length);
      setArchetypeByIndex(state.archetypeIndex);
      state.confirmPending = false;
      persist();
    }
    playUIMoveBlip();
    return true;
  }

  if (pointInRect(mx, my, right)) {
    state.focus = "archetypes";
    if (!state.archetypeConfirmed) {
      state.archetypeIndex = clampIndex(state.archetypeIndex + 1, archetypes.length);
      setArchetypeByIndex(state.archetypeIndex);
      state.confirmPending = false;
      persist();
    }
    playUIMoveBlip();
    return true;
  }

  if (pointInRect(mx, my, center)) {
    state.focus = state.focus === "movies" ? "archetypes" : "movies";
    state.confirmPending = false;
    persist();
    playUIMoveBlip();
    return true;
  }

  return true;
}
