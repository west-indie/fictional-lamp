// frontend/js/specialKinds/kindFx.js
//
// "FX" family classifier.
// FX = anything that is not a plain stat buff/debuff/heal/shield/damage
// but still needs a token/label: status effects, next-hit vulnerability, etc.
//
// IMPORTANT:
// - This does NOT rename VULN or remove it from gameplay.
// - It just detects FX-like mechanics so Phase 3 can label them as (FX).

const STATUS_KINDS = new Set([
  "STATUS",
  "statusEnemy"
]);

function norm(s) {
  return String(s || "").trim();
}

export const kind = {
  id: "fx",
  name: "FX",

  match(special) {
    const k = norm(special?.sigKind || special?.kind);
    if (STATUS_KINDS.has(k)) return true;

    // Status shape
    if (typeof special?.status === "string" && special.status.trim()) return true;

    // Next-hit vulnerability shape
    if (special?.nextHitVulnActive) return true;
    if (typeof special?.nextHitVulnPct === "number" && special.nextHitVulnPct > 0) return true;

    // Target tags can also imply FX (your upcoming tag normalization will standardize this)
    const t = special?.target;
    if (Array.isArray(t) && t.some((x) => String(x).toLowerCase().includes("vuln"))) return true;
    if (typeof t === "string" && t.toLowerCase().includes("vuln")) return true;

    return false;
  }
};
