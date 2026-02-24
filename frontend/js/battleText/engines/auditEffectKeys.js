// frontend/js/battleText/auditEffectKeys.js
// TEMP Phase 3 helper — remove after effect-key coverage is finalized

export const EFFECT_KEY_AUDIT_ENABLED = false;

globalThis.__SEEN_EFFECT_KEYS__ ??= new Set();

export function auditEffectKeys(effects, source = "unknown") {
  if (!EFFECT_KEY_AUDIT_ENABLED) return;
  if (!effects || typeof effects !== "object") return;

  const seen = globalThis.__SEEN_EFFECT_KEYS__;
  const newlyDiscovered = [];

  for (const k of Object.keys(effects)) {
    if (!seen.has(k)) {
      seen.add(k);
      newlyDiscovered.push(k);
    }
  }

  // Only log when something NEW appears
  if (newlyDiscovered.length > 0) {
    console.groupCollapsed(
      `%c[EffectKeyAudit] new keys (${newlyDiscovered.length})`,
      "color:#7cf;font-weight:bold"
    );
    console.log("Source:", source);
    console.log("New:", newlyDiscovered.sort());
    console.log("All so far:", Array.from(seen).sort());
    console.groupEnd();
  }
}
