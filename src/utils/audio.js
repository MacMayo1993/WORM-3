// src/utils/audio.js
// Audio and haptic feedback utilities

export const play = (src) => {
  try {
    const a = new Audio(src);
    a.currentTime = 0;
    a.volume = 0.5;
    a.play().catch(() => {});
  } catch (_) {}
};

export const vibrate = (ms = 18) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch (_) {}
  }
};
