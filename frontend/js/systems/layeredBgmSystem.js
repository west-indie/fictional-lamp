// frontend/js/systems/layeredBgmSystem.js
//
// Phase-locked layered looping stems (Mario Kart-style), autoplay-safe.
// - AudioContext creation/resume ONLY happens inside ensureStarted() (gesture-driven).
// - load() may be called any time; it will only decode AFTER ensureStarted() has armed audio,
//   unless you explicitly call ensureStarted() first.
// - Screens can call setMix anytime; it queues until loaded/started.

import { getAudioContext, getBgmBus, armAudio, stopBgm } from "./audioSystem.js";

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function rampGain(ctx, gainNode, value, ms = 120) {
  const t = ctx.currentTime;
  const v = clamp01(value);

  try { gainNode.gain.cancelScheduledValues(t); } catch {}
  gainNode.gain.setValueAtTime(gainNode.gain.value, t);
  gainNode.gain.linearRampToValueAtTime(v, t + ms / 1000);
}

async function decodeUrl(url, ctx) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Stem fetch failed (${res.status}): ${url}`);
  const arr = await res.arrayBuffer();
  return await ctx.decodeAudioData(arr);
}

export function createLayeredBgm({
  stems,                 // { layer1: "url", layer2: "url" }
  initialMix = null,     // optional
  loopStart = 0,
  loopEnd = null,
}) {
  // ✅ IMPORTANT: do NOT create/get AudioContext here.
  // Some Chrome policies treat AudioContext creation as "starting audio".
  let ctx = null;
  let bus = null;

  let loaded = false;
  let started = false;
  let startTime = 0;

  const buffers = new Map(); // name -> AudioBuffer
  const nodes = new Map();   // name -> { src, gain }

  let pendingMix = initialMix ? { ...initialMix } : null;

  // Prevent duplicate concurrent loads
  let loadingPromise = null;

  function ensureGraphContext() {
    // Only call this AFTER armAudio() succeeded (gesture-driven),
    // because getAudioContext() may create the context.
    if (!ctx) ctx = getAudioContext();
    if (!bus) bus = getBgmBus();
  }

  async function load() {
    if (loaded) return;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      // We intentionally do NOT decode until context exists.
      // Context must be created/armed inside ensureStarted().

      // If context isn't available yet, just leave mix queued and bail.
      // This keeps load() safe if called from enter() without gesture.
      if (!ctx) return;

      // Stop single-track BGM so we don't layer over it accidentally.
      // (If stopBgm creates context in your audioSystem, that's fine here because ctx exists.)
      try { stopBgm({ fadeMs: 80 }); } catch {}

      const entries = Object.entries(stems);

      // Decode buffers
      for (const [name, url] of entries) {
        const buf = await decodeUrl(url, ctx);
        buffers.set(name, buf);
      }

      // Create node graph (muted), not started yet
      for (const [name, buf] of buffers.entries()) {
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(bus);

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.loopStart = loopStart;
        src.loopEnd = loopEnd ?? buf.duration;

        src.connect(gain);

        nodes.set(name, { src, gain });
      }

      loaded = true;

      // Apply initial/pending mix (still muted until started, but values set)
      if (pendingMix) setMix(pendingMix, 0);
    })();

    try {
      await loadingPromise;
    } finally {
      loadingPromise = null;
    }
  }

  // ✅ Call this ONLY inside a user gesture (key/click).
  async function ensureStarted() {
    if (started) return true;

    // Must be in a gesture; if not, armAudio will throw/reject.
    await armAudio();

    // Now it is safe to create/get the context + bus.
    ensureGraphContext();

    // If load() was called earlier before ctx existed, we can load now.
    if (!loaded) await load();

    // Start all stems at same future time (phase lock)
    startTime = ctx.currentTime + 0.02;
    for (const { src } of nodes.values()) {
      try { src.start(startTime); } catch {}
    }

    started = true;

    // Apply pending mix after start so ramps work correctly
    if (pendingMix) setMix(pendingMix, 120);
    return true;
  }

  function setMix(mix, fadeMs = 140) {
    pendingMix = { ...(mix || {}) };

    // If not loaded yet, just store mix; it will apply on load/start
    if (!loaded || !ctx) return;

    for (const [name, node] of nodes.entries()) {
      const target = name in pendingMix ? clamp01(pendingMix[name]) : 0;
      rampGain(ctx, node.gain, target, fadeMs);
    }
  }

  function stop({ fadeMs = 160 } = {}) {
    // If ctx doesn't exist yet, nothing to stop; just clear intent.
    if (!ctx || !loaded) {
      pendingMix = null;
      loaded = false;
      started = false;
      buffers.clear();
      nodes.clear();
      return;
    }

    // Fade out whatever exists
    for (const node of nodes.values()) rampGain(ctx, node.gain, 0, fadeMs);

    const stopAt = ctx.currentTime + fadeMs / 1000;

    for (const { src } of nodes.values()) {
      try { src.stop(stopAt); } catch {}
    }

    nodes.clear();
    buffers.clear();
    loaded = false;
    started = false;
    pendingMix = null;
  }

  return {
    load,
    ensureStarted,
    setMix,
    stop,
    get started() { return started; },
    get loaded() { return loaded; },
  };
}
