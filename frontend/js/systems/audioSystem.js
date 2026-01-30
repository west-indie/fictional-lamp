// frontend/js/systems/audioSystem.js

import { getMusicGain01 } from "./sharedAudioState.js";

let audioCtx = null;

// ✅ Global user volume (Options slider)
let bgmGain = null;

// ✅ Per-track base volume (battle quiet / menu loud, etc.)
let trackGain = null;

// ✅ Now supports an optional one-shot intro source
let bgmSource = null;       // main (usually looping) source
let bgmIntroSource = null;  // optional intro source (plays once)

let bgmUrl = null; // we now store a "key" (url + introUrl + loop region) for de-dupe

const bufferCache = new Map();

// Track current values
let currentUserVolume = 0.6;   // bgmGain (user/master)
let currentTrackVolume = 1.0;  // trackGain

// ✅ Pull saved defaults at graph creation time so the FIRST screen that
// creates AudioContext inherits the user's Options values.

function ensureContext() {
  if (!audioCtx) {
    // Read saved user volume before we create any gain nodes.
    // (If localStorage is unavailable, sharedAudioState falls back safely.)
    try {
      currentUserVolume = Math.max(0, Math.min(1, getMusicGain01()));
    } catch {}

    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();

    // ✅ Create BOTH gains
    trackGain = audioCtx.createGain();
    bgmGain = audioCtx.createGain();

    // Defaults
    trackGain.gain.value = currentTrackVolume;
    bgmGain.gain.value = currentUserVolume;

    // ✅ Chain: source -> trackGain -> bgmGain -> destination
    trackGain.connect(bgmGain);
    bgmGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

export async function armAudio() {
  const ctx = ensureContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  // ✅ Whenever audio gets armed/resumed (gesture), re-apply saved user volumes.
  // This prevents "volume pops back" when a new screen starts music after being silent.
  try { setBgmVolume(getMusicGain01()); } catch {}
  return ctx;
}

export function getAudioContext() {
  return ensureContext();
}

export function getBgmBus() {
  ensureContext();
  return bgmGain;
}

async function fetchAndDecode(url) {
  if (bufferCache.has(url)) return bufferCache.get(url);

  const ctx = ensureContext();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`BGM fetch failed (${res.status}): ${url}`);

  const arr = await res.arrayBuffer();
  const buf = await ctx.decodeAudioData(arr);

  bufferCache.set(url, buf);
  return buf;
}

function stopInternal({ fadeMs = 0 } = {}) {
  if (!bgmSource && !bgmIntroSource) return;

  const ctx = ensureContext();
  const now = ctx.currentTime;

  try { trackGain.gain.cancelScheduledValues(now); } catch {}

  if (fadeMs > 0) {
    const start = trackGain.gain.value;
    trackGain.gain.setValueAtTime(start, now);
    trackGain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
  }

  const stopAt = now + (fadeMs > 0 ? fadeMs / 1000 : 0);

  try { if (bgmIntroSource) bgmIntroSource.stop(stopAt); } catch {}
  try { if (bgmSource) bgmSource.stop(stopAt); } catch {}

  bgmIntroSource = null;
  bgmSource = null;
  bgmUrl = null;
}

export async function playBgm(url, opts = {}) {
  // Existing options
  const { loop = true, volume = 1.0 } = opts;

  // ✅ New options (optional)
  // Two-file intro:
  const introUrl = opts.introUrl || null;

  // Single-file intro+loop region:
  // - loopStart: where the loop begins (seconds)
  // - loopEnd: where the loop ends (seconds)
  const loopStart = typeof opts.loopStart === "number" ? opts.loopStart : null;
  const loopEnd = typeof opts.loopEnd === "number" ? opts.loopEnd : null;

  // ✅ This is track volume now
  currentTrackVolume = Math.max(0, Math.min(1, volume));

  const ctx = ensureContext();
  const now = ctx.currentTime;

  // Apply track volume immediately
  try { trackGain.gain.cancelScheduledValues(now); } catch {}
  trackGain.gain.setValueAtTime(currentTrackVolume, now);

  // ✅ Build a de-dupe key so "same url but different intro/loop region" is treated as different
  const key =
    `${url}` +
    (introUrl ? `|intro:${introUrl}` : "") +
    (loopStart != null ? `|ls:${loopStart}` : "") +
    (loopEnd != null ? `|le:${loopEnd}` : "");

  if (bgmSource && bgmUrl === key) return;
  if (bgmSource || bgmIntroSource) stopInternal({ fadeMs: 0 });

  if (ctx.state === "suspended") return;

  // ---------- Mode 1: Two-file intro + loop ----------
  if (introUrl) {
    let introBuffer, loopBuffer;
    try {
      // Fetch both before scheduling for sample-accurate timing
      [introBuffer, loopBuffer] = await Promise.all([
        fetchAndDecode(introUrl),
        fetchAndDecode(url)
      ]);
    } catch {
      return;
    }

    const intro = ctx.createBufferSource();
    intro.buffer = introBuffer;
    intro.loop = false;
    intro.connect(trackGain);

    const main = ctx.createBufferSource();
    main.buffer = loopBuffer;
    main.loop = true;
    main.connect(trackGain);

    // ✅ Sample-accurate scheduling
    const t0 = now;
    intro.start(t0);
    main.start(t0 + introBuffer.duration);

    bgmIntroSource = intro;
    bgmSource = main;
    bgmUrl = key;

    // Keep cleanup sane:
    intro.onended = () => {
      if (bgmIntroSource === intro) bgmIntroSource = null;
    };

    main.onended = () => {
      if (bgmSource === main) {
        bgmSource = null;
        bgmUrl = null;
      }
    };

    return;
  }

  // ---------- Mode 2: Single-file with loop region (intro embedded) ----------
  let buffer;
  try {
    buffer = await fetchAndDecode(url);
  } catch {
    return;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  // If loopStart is provided, we force looping using the loop region.
  if (loopStart != null) {
    src.loop = true;
    src.loopStart = Math.max(0, loopStart);
    src.loopEnd = loopEnd != null ? Math.max(src.loopStart, loopEnd) : buffer.duration;
  } else {
    src.loop = !!loop;
  }

  // ✅ connect to trackGain (not bgmGain)
  src.connect(trackGain);

  try {
    src.start(0);
  } catch {
    return;
  }

  bgmIntroSource = null;
  bgmSource = src;
  bgmUrl = key;

  src.onended = () => {
    if (bgmSource === src) {
      bgmSource = null;
      bgmUrl = null;
    }
  };
}

export function stopBgm(opts = {}) {
  stopInternal(opts);
}

export function setBgmVolume(v) {
  // ✅ This is USER volume now (Options slider)
  currentUserVolume = Math.max(0, Math.min(1, v));
  const ctx = ensureContext();
  const now = ctx.currentTime;

  try { bgmGain.gain.cancelScheduledValues(now); } catch {}
  bgmGain.gain.setValueAtTime(currentUserVolume, now);
}

// Convenience: force the live graph to the saved Options value.
export function syncBgmVolumeFromSaved() {
  try {
    setBgmVolume(getMusicGain01());
  } catch {}
}

// Returns true if the AudioContext has already been created.
// Useful to avoid creating audio graphs from non-gesture code.
export function hasAudioContext() {
  return !!audioCtx;
}

// Safe version: only sync if the audio graph already exists.
export function trySyncBgmVolumeFromSaved() {
  if (!audioCtx || !bgmGain) return false;
  try {
    setBgmVolume(getMusicGain01());
    return true;
  } catch {
    return false;
  }
}
