// frontend/js/systems/transientUiReset.js
//
// Resets transient UI flags that should never survive a refresh.
// Currently: confirm-pending modes (select/quickplay/etc.)

export function resetAllConfirmPending(state) {
  if (!state || typeof state !== "object") return;

  const seen = new Set();

  function walk(obj) {
    if (!obj || typeof obj !== "object") return;
    if (seen.has(obj)) return;
    seen.add(obj);

    for (const k of Object.keys(obj)) {
      const v = obj[k];

      // Common patterns for "confirm" modal/armed states.
      if (
        k === "confirmPending" ||
        k === "confirm_pending" ||
        k === "isConfirmPending" ||
        k === "confirmArmed" ||
        k === "confirmMode" ||
        k === "confirming"
      ) {
        if (typeof v === "boolean") obj[k] = false;
        else if (typeof v === "number") obj[k] = 0;
        else obj[k] = null;
      }

      // Often paired fields
      if (
        k === "confirmTimerMs" ||
        k === "confirmMsLeft" ||
        k === "pendingMsLeft"
      ) {
        if (typeof v === "number") obj[k] = 0;
      }

      if (typeof v === "object" && v !== null) {
        walk(v);
      }
    }
  }

  walk(state);

  // Optional: if you keep a dedicated ui bucket, hard-force it too.
  if (state.ui && typeof state.ui === "object") {
    if (typeof state.ui.confirmPending === "boolean") state.ui.confirmPending = false;
    if ("confirmTarget" in state.ui) state.ui.confirmTarget = null;
  }
}
