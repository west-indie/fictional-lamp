// frontend/js/systems/secretUnlockFlow.js
//
// Handles a single secret unlock flow:
// - tracks key sequence progress (consuming keys)
// - unlocks an archetype (persisted via unlockSystem)
// - prepares an overlay payload (name, party posters, code label)
// - leaves the screen (quickplay) in charge of showing/closing overlay + continuing to battle

import { ensureUnlockState, isArchetypeUnlocked, unlockArchetype } from "./unlockSystem.js";

function norm(k) {
  return String(k || "").toLowerCase();
}

function anyVariantPressed(Input, letter) {
  const upper = String(letter).toUpperCase();
  return !!Input.pressed(letter) || !!Input.pressed(upper);
}

function consumeVariants(Input, letter) {
  const upper = String(letter).toUpperCase();
  if (Input.pressed(letter)) Input.consume(letter);
  if (Input.pressed(upper)) Input.consume(upper);
}

// Restart logic:
// - correct next letter -> advance
// - wrong letter:
//   - if it's the first letter -> restart at 1
//   - otherwise -> reset to 0
function advanceProgress(sequence, progress, pressedLetter) {
  const expected = sequence[progress];
  if (pressedLetter === expected) {
    const next = progress + 1;
    const complete = next >= sequence.length;
    return { progress: complete ? 0 : next, complete };
  }

  if (pressedLetter === sequence[0]) return { progress: 1, complete: false };
  return { progress: 0, complete: false };
}

export function createSecretUnlockFlow({ sequence = [], codeLabel = "", archetypeId = "" } = {}) {
  const seq = sequence.map(norm).filter(Boolean);

  // Internal state
  let progress = 0;
  let overlayOpen = false;

  // Payload shown by unlockArcOverlay
  let payload = null;

  function resetAll() {
    progress = 0;
    overlayOpen = false;
    payload = null;
  }

  // Consume only letters relevant to this secret (so we don't eat other keys)
  function feedInput(Input) {
    if (!Input || seq.length === 0) return;
    if (overlayOpen) return; // ignore typing while overlay is open

    // only respond to letters that appear in the sequence
    for (const letter of seq) {
      if (!anyVariantPressed(Input, letter)) continue;

      consumeVariants(Input, letter);

      const res = advanceProgress(seq, progress, letter);
      progress = res.progress;

      // Only handle one key per frame
      return;
    }
  }

  function tryOpenOverlay(GameState, { getArchetypeById, getMovieById } = {}) {
    if (!GameState) return false;
    if (overlayOpen) return false;
    if (!archetypeId) return false;
    if (seq.length === 0) return false;

    // Only trigger if sequence was just completed (progress resets to 0 on complete)
    // We detect completion by: "the last input produced complete"
    // Since we don't store that flag, we instead check:
    // - progress === 0 AND
    // - the prior key press completed the sequence
    // We can do this cleanly by requiring: the player typed all letters in order.
    // To keep it robust, we’ll consider "ready" when progress is 0 AND we have no payload AND not unlocked overlay.
    //
    // But we *do* need an actual completion signal.
    // Easiest: we open overlay when the last letter is pressed and completes;
    // so we set a latch when completion happens. We'll implement that here by reading a private flag.

    // If someone calls tryOpenOverlay every frame, we need a latch.
    // We'll derive a latch by tracking whether the code is "armed":
    // - When progress hits 0 due to completion, we set an internal flag.
    // To do that, we store it on the function object closure:
    if (!tryOpenOverlay.__armed) tryOpenOverlay.__armed = false;

    // If feedInput advanced and completed, it sets progress to 0.
    // We can detect completion by remembering previous progress:
    // We'll keep that too:
    if (typeof tryOpenOverlay.__prevProgress !== "number") tryOpenOverlay.__prevProgress = 0;

    const prev = tryOpenOverlay.__prevProgress;
    tryOpenOverlay.__prevProgress = progress;

    // Completion condition: prev was last index (seq.length - 1) and now progress is 0
    if (prev === seq.length - 1 && progress === 0) {
      tryOpenOverlay.__armed = true;
    }

    if (!tryOpenOverlay.__armed) return false;
    tryOpenOverlay.__armed = false;

    // Finalize unlock immediately (persisted)
    ensureUnlockState(GameState);
    if (!isArchetypeUnlocked(GameState, archetypeId)) {
      unlockArchetype(GameState, archetypeId);
    }

    // Build overlay payload + force party to hidden archetype party
    const arch = typeof getArchetypeById === "function" ? getArchetypeById(archetypeId) : null;
    const movieIds = arch?.movieIds || [];
    const party = (movieIds || [])
      .slice(0, 4)
      .map((id) => (typeof getMovieById === "function" ? getMovieById(id) : null))
      .filter(Boolean);

    GameState.party.movies = party;

    payload = {
      archetypeId,
      archetypeName: arch?.name || "Unknown",
      codeLabel: codeLabel || seq.map((x) => x.toUpperCase()).join(" → "),
      party
    };

    overlayOpen = true;
    return true;
  }

  function closeOverlay() {
    overlayOpen = false;
    payload = null;
    // Keep progress reset so they don’t immediately re-open
    progress = 0;
    if (tryOpenOverlay.__armed) tryOpenOverlay.__armed = false;
    tryOpenOverlay.__prevProgress = 0;
  }

  function getPayload() {
    return payload;
  }

  return {
    feedInput,
    tryOpenOverlay,
    closeOverlay,
    getPayload,
    resetAll
  };
}
