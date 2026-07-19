// src/utils/audio.js
// Audio and haptic feedback utilities with pooling for performance.
//
// No sound assets currently ship with the app — there is no public/sounds/
// directory, so every play('/sounds/*.mp3') call used to 404 (and the paths
// also skipped BASE_URL, so they'd 404 under the /WORM-3/ base regardless).
// That was pure console noise on every flip/rotate. Audio playback is gated
// off until real assets land: flip this to `true` (and add the files under
// public/sounds/, referenced via import.meta.env.BASE_URL) to re-enable.
// Haptics (vibrate) are unaffected and stay live.
const AUDIO_ENABLED = false;

// Audio pool configuration
const POOL_SIZE = 4; // Number of audio instances per sound
const audioPool = new Map(); // Map<src, Audio[]>
const poolIndex = new Map(); // Map<src, number> - round-robin index

/**
 * Get or create an audio pool for a given source
 */
const getPool = (src) => {
  if (!audioPool.has(src)) {
    // Create pool of audio instances for this source
    const pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      try {
        const audio = new Audio(src);
        audio.volume = 0.5;
        pool.push(audio);
      } catch (_) {
        // If Audio creation fails, push null
        pool.push(null);
      }
    }
    audioPool.set(src, pool);
    poolIndex.set(src, 0);
  }
  return audioPool.get(src);
};

/**
 * Play a sound using the audio pool
 * Reuses Audio objects to avoid creating new ones on each play
 */
export const play = (src) => {
  if (!AUDIO_ENABLED) return; // no sound assets ship yet — avoid 404s
  try {
    const pool = getPool(src);
    const idx = poolIndex.get(src);
    const audio = pool[idx];

    if (audio) {
      // Reset and play
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }

    // Round-robin to next audio instance
    poolIndex.set(src, (idx + 1) % POOL_SIZE);
  } catch (_) {}
};

/**
 * Preload audio files to avoid delay on first play
 */
export const preload = (sources) => {
  if (!AUDIO_ENABLED) return; // no sound assets ship yet — avoid 404s
  sources.forEach(src => getPool(src));
};

export const vibrate = (ms = 18) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch (_) {}
  }
};
