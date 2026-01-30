// frontend/js/systems/secretArcInput.js
//
// Tiny helper to track a secret key sequence (letters).
// Usage:
//   const secret = createSecretArcInput(["i","m","d","b"]);
//   secret.input("i");
//   if (secret.isReady()) { ... }
//

export function createSecretArcInput(sequence) {
  const seq = (sequence || []).map((k) => String(k).toLowerCase());

  let progress = 0;
  let ready = false;

  function reset() {
    progress = 0;
    ready = false;
  }

  function input(key) {
    if (ready) return;

    const k = String(key || "").toLowerCase();
    if (!k) return;

    const expected = seq[progress];
    if (k === expected) {
      progress++;
      if (progress >= seq.length) {
        progress = 0;
        ready = true;
      }
      return;
    }

    // restart logic: if current key equals first key, start at 1; else reset to 0
    progress = k === seq[0] ? 1 : 0;
  }

  function isReady() {
    return ready;
  }

  // Clears "ready" after you consume it once
  function consumeReady() {
    if (!ready) return false;
    ready = false;
    return true;
  }

  return { input, isReady, consumeReady, reset };
}
