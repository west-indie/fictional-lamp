// frontend/js/systems/specialTags.js
//
// Step A — target tag normalization + helpers.
//
// Purpose:
// - Provide ONE normalization rule for target tags (string or array).
// - Keep logic-only; no UI strings emitted here.
// - Used later for unified target labels and FX token rules.
//
// Normalization rules (conservative):
// - trim
// - lowercase
// - keep exact content otherwise (do NOT rewrite '-' vs '_' yet)

function asTag(x) {
  return String(x ?? "").trim().toLowerCase();
}

/**
 * Normalize target tags from a special.
 * Accepts:
 * - string: "enemy" -> ["enemy"]
 * - array: ["Enemy","VULN"] -> ["enemy","vuln"]
 */
export function normalizeTargetTags(target) {
  if (Array.isArray(target)) return target.map(asTag).filter(Boolean);
  if (typeof target === "string" && target.trim()) return [asTag(target)];
  return [];
}

export function specialHasTag(special, tag) {
  const t = asTag(tag);
  if (!t) return false;
  return normalizeTargetTags(special?.target).includes(t);
}

/**
 * Convenience helpers used a lot across systems.
 */
export function getBaseTargetFromTags(target) {
  const tags = normalizeTargetTags(target);
  if (tags.includes("self")) return "self";
  if (tags.includes("ally")) return "ally";
  if (tags.includes("enemy")) return "enemy";
  if (tags.includes("team") || tags.includes("party")) return "team";
  // If the target was a non-empty string but not a standard tag, return it.
  if (typeof target === "string" && target.trim()) return asTag(target);
  return "enemy";
}
