// frontend/js/systems/imdbScaling.js
//
// IMDb multiplier M(r) for scaling ATK-boosting values.
// This is the "linear 5.0–8.0" interpretation you approved.
//
// Bands:
// 0–3: harsher penalty (0.92 → 1.00)
// 3–5: slight buff (1.00 → 1.013333...)
// 5–8: linear ramp (1.013333... → 1.20)
// 8–10: linear ramp (1.20 → 1.30)

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function imdbMultiplier(imdb) {
  const r = clamp(Number(imdb ?? 0), 0, 10);

  // 0–3: 0.92 -> 1.00
  if (r < 3) {
    return 0.92 + (r / 3) * 0.08;
  }

  // 3–5: 1.00 -> 1.013333...
  if (r < 5) {
    return 1.0 + ((r - 3) / 2) * (0.013333333333333334);
  }

  // 5–8: 1.013333... -> 1.20 (linear)
  if (r < 8) {
    return 1.0133333333333334 + ((r - 5) / 3) * (0.18666666666666665);
  }

  // 8–10: 1.20 -> 1.30 (linear)
  return 1.2 + ((r - 8) / 2) * 0.1;
}
