// frontend/js/battleText/signatureHelpers.js
//
// Step B2 — shared helpers for signature message-box narration.
// Text-only helpers: no combat math.

export function clampInt(n) {
  const x = Math.round(Number(n || 0));
  return Number.isFinite(x) ? x : 0;
}

export function safeStr(s, fallback = "") {
  const v = String(s ?? "").trim();
  return v ? v : fallback;
}

export function pluralize(n, singular, plural = null) {
  const x = clampInt(n);
  const p = plural ?? `${singular}s`;
  return x === 1 ? singular : p;
}

export function turnsPhrase(turns) {
  const t = clampInt(turns);
  if (t <= 0) return "";
  return `${t} ${pluralize(t, "turn")}`;
}

export function renderTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => {
    return vars[k] != null ? String(vars[k]) : `{${k}}`;
  });
}

export function asList(v) {
  if (typeof v === "string" && v.trim()) return [v.trim()];
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  return [];
}

export function uniqStrings(arr) {
  const out = [];
  for (const x of arr || []) {
    const s = String(x || "").trim();
    if (!s) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

export function joinNatural(list, { conj = "and" } = {}) {
  const a = uniqStrings(list);
  if (a.length === 0) return "";
  if (a.length === 1) return a[0];
  if (a.length === 2) return `${a[0]} ${conj} ${a[1]}`;
  return `${a.slice(0, -1).join(", ")}, ${conj} ${a[a.length - 1]}`;
}
