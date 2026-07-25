// FlipScreenGlow.jsx — the flip, escaping the canvas.
//
// Everything a flip does today happens inside the WebGL layer: particles, the
// shockwave ring, the crossing bloom, the camera kick, the tunnel birth. Above
// the canvas the page stays perfectly still through the most dramatic thing in
// the game. This is the screen-space half of that beat: a symmetric edge bloom
// in the flipped pair's colour, rising fast and ringing out.
//
// Why symmetric rather than the menu's per-face edge mapping (MainMenu's
// ScreenGlow): in the menu the cube's orientation is controlled, so a face maps
// predictably to a screen region. In game the player orbits freely, so any fixed
// face→edge map would light the wrong side. A flip always moves an antipodal
// PAIR — two opposite faces at once — so a symmetric vignette is both
// orientation-proof and a truthful read of what happened.
//
// The envelope is a CSS keyframe rather than a rAF loop on purpose. Opacity
// animations are composited off the main thread, so the glow keeps its timing
// during a chaos cascade — exactly when the main thread is busiest and a
// JS-driven envelope would stutter or drop to a couple of frames. Re-keying the
// element on the pulse timestamp restarts the animation cleanly per flip.

import React from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';

export default function FlipScreenGlow() {
  const flipPulse = useGameStore((s) => s.flipPulse);
  if (!flipPulse?.color) return null;

  // A tile near its cap rings brighter — matching the camera kick and haptic.
  const peak = 0.16 + (flipPulse.danger ?? 0) * 0.14;
  const c = flipPulse.color;

  return (
    <div
      key={flipPulse.at}
      aria-hidden
      className="flip-screen-glow"
      style={{
        // Custom property drives the keyframe's crest so intensity can vary
        // per flip while the animation itself stays a static, cacheable rule.
        '--flip-glow-peak': peak,
        background: [
          `radial-gradient(ellipse 130% 60% at 50% 0%,   ${c} 0%, transparent 62%)`,
          `radial-gradient(ellipse 130% 60% at 50% 100%, ${c} 0%, transparent 62%)`,
          `radial-gradient(ellipse 60% 130% at 0%   50%, ${c} 0%, transparent 62%)`,
          `radial-gradient(ellipse 60% 130% at 100% 50%, ${c} 0%, transparent 62%)`,
        ].join(','),
      }}
    />
  );
}
