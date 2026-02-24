// frontend/js/systems/enterReleaseGateSystem.js
//
// Centralized Enter-release gate utilities:
// - Runtime gate state machine (release required if Enter was already held)
// - Message-line wrappers to arm the gate at specific checkpoints

function wrapSingleLineWithArm(line, armIfHeld) {
  const arm = typeof armIfHeld === "function" ? armIfHeld : null;
  if (!arm) return line;

  if (line && typeof line === "object" && !Array.isArray(line)) {
    const priorOnStart = typeof line.onStart === "function" ? line.onStart : null;
    return {
      ...line,
      onStart: () => {
        if (priorOnStart) priorOnStart();
        arm();
      }
    };
  }

  return {
    onStart: () => {
      arm();
    },
    text: String(line ?? "")
  };
}

export function wrapLinesWithEnterReleaseArm(lines, armIfHeld, mode = "all") {
  const arr = Array.isArray(lines) ? lines : [lines];
  if (!arr.length) return [];

  const useMode = String(mode || "all").toLowerCase();
  return arr.map((line, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === arr.length - 1;
    const shouldWrap =
      useMode === "all" ||
      (useMode === "last" && isLast) ||
      (useMode === "first" && isFirst);

    return shouldWrap ? wrapSingleLineWithArm(line, armIfHeld) : line;
  });
}

export function createEnterReleaseGate({ Input, key = "Enter" } = {}) {
  let armed = false;

  function isHeldNow() {
    if (!Input || typeof Input.isPhysicallyDown !== "function") return false;
    return !!Input.isPhysicallyDown(key);
  }

  return {
    armIfHeld() {
      if (!isHeldNow()) return;
      armed = true;
    },

    clear() {
      armed = false;
    },

    blocksAdvance() {
      if (!armed) return false;
      if (isHeldNow()) return true;
      armed = false;
      return false;
    }
  };
}
