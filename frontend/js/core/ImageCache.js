// frontend/js/core/ImageCache.js
//
// Simple image cache for remote poster URLs (or local).
// - Creates at most one Image() per URL
// - Tracks status: "idle" | "loading" | "loaded" | "error"
// - Lets you request loads and then draw when ready
//
// Usage:
//   import { ImageCache } from "../core/ImageCache.js";
//   ImageCache.load(url);
//   const img = ImageCache.get(url);
//   if (img) ctx.drawImage(img, ...);

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// Compute a "cover" crop (like CSS background-size: cover)
export function computeCoverCrop(imgW, imgH, dstW, dstH) {
  if (!imgW || !imgH || !dstW || !dstH) {
    return { sx: 0, sy: 0, sw: imgW || 0, sh: imgH || 0 };
  }

  const imgAR = imgW / imgH;
  const dstAR = dstW / dstH;

  let sw, sh, sx, sy;

  if (imgAR > dstAR) {
    // image is wider: crop left/right
    sh = imgH;
    sw = Math.round(imgH * dstAR);
    sx = Math.round((imgW - sw) / 2);
    sy = 0;
  } else {
    // image is taller: crop top/bottom
    sw = imgW;
    sh = Math.round(imgW / dstAR);
    sx = 0;
    sy = Math.round((imgH - sh) / 2);
  }

  // Safety clamp
  sx = clamp(sx, 0, Math.max(0, imgW - 1));
  sy = clamp(sy, 0, Math.max(0, imgH - 1));
  sw = clamp(sw, 1, imgW);
  sh = clamp(sh, 1, imgH);

  return { sx, sy, sw, sh };
}

export const ImageCache = (() => {
  const map = new Map(); // url -> { img, status, error, promise }

  function ensureEntry(url) {
    if (!map.has(url)) {
      map.set(url, { img: null, status: "idle", error: null, promise: null });
    }
    return map.get(url);
  }

  function load(url) {
    if (!isNonEmptyString(url)) return Promise.resolve(null);

    const entry = ensureEntry(url);
    if (entry.status === "loaded") return Promise.resolve(entry.img);
    if (entry.status === "loading" && entry.promise) return entry.promise;

    entry.status = "loading";
    entry.error = null;

    entry.promise = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous"; // safe even for same-origin; helps for CDNs
      img.onload = () => {
        entry.img = img;
        entry.status = "loaded";
        entry.error = null;
        resolve(img);
      };
      img.onerror = () => {
        entry.img = null;
        entry.status = "error";
        entry.error = new Error("Image failed to load: " + url);
        resolve(null);
      };
      img.src = url;
    });

    return entry.promise;
  }

  function get(url) {
    if (!isNonEmptyString(url)) return null;
    const entry = map.get(url);
    if (!entry) return null;
    return entry.status === "loaded" ? entry.img : null;
  }

  function getStatus(url) {
    if (!isNonEmptyString(url)) return "idle";
    const entry = map.get(url);
    return entry ? entry.status : "idle";
  }

  function clear() {
    map.clear();
  }

  return { load, get, getStatus, clear };
})();
