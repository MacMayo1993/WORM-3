// src/worm/TunnelTransitOverlay.jsx
//
// One continuous "you are in transit" signal for the whole wormhole ride.
//
// A traversal runs through five phases and three different camera regimes —
// outside watching the dive, inside riding the ribbon, outside again watching
// the exit. Each cut is motivated, but together they lose the thread: the HUD
// says EXITING while the picture is just a wall of tiles, so the player stops
// believing they are still inside a wormhole.
//
// This is the element that never drops. It holds from the first frame of the
// dive to the last frame of the exit flourish, independent of where the camera
// is or what it is looking at.
//
// Implemented as a DOM overlay rather than a post-processing pass on purpose:
// the in-game EffectComposer is AO-only and gated off on mobile and low-FPS
// devices (see GameScene), so an effects-based version would be invisible on
// exactly the hardware these screenshots came from. CSS gradients cost nothing
// and work everywhere.

import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { prefersReducedMotion } from '../utils/device.js';
import { tunnelState } from './tunnelProgressBridge.js';

// Intensity ramps in fast on entry and releases slower on exit, so the release
// reads as the ride ending rather than the effect being switched off.
const FADE_IN = 10;
const FADE_OUT = 4;

export default function TunnelTransitOverlay() {
  const { wormHealerMode, wormPhase, tunnelColors, wormAlive } = useGameStore(
    useShallow(s => ({
      wormHealerMode: s.wormHealerMode ?? false,
      wormPhase: s.wormPhase ?? 'crawling',
      wormAlive: s.wormAlive ?? true,
      tunnelColors: s.wormActiveTunnelColors,
    }))
  );

  // Held for the full arc including the wind-up spiral and the exit flourish —
  // deliberately wider than the phases that render the tunnel interior.
  const isActive = wormHealerMode && wormAlive && (
    wormPhase === 'windup' || wormPhase === 'entering' ||
    wormPhase === 'tunnel' || wormPhase === 'exiting' || wormPhase === 'windout'
  );

  const vignetteRef = useRef(null);
  const fringeRef = useRef(null);
  const seamRef = useRef(null);
  const ampRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    let lastFrame = null;
    const animate = now => {
      const dt = lastFrame == null ? 1 / 60 : Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;
      if (isActive && useGameStore.getState().wormPaused) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      const reduced = prefersReducedMotion();
      const target = isActive ? 1 : 0;
      ampRef.current += (target - ampRef.current) * (1 - Math.exp(-dt * (target > ampRef.current ? FADE_IN : FADE_OUT)));
      const amp = ampRef.current;

      if (amp < 0.004) {
        if (vignetteRef.current) vignetteRef.current.style.opacity = '0';
        if (fringeRef.current) fringeRef.current.style.opacity = '0';
        if (seamRef.current) seamRef.current.style.opacity = '0';
        if (!isActive) { rafRef.current = null; return; }
      } else {
        const t = tunnelState.t ?? 0;
        // Squeeze hardest at the Möbius midpoint, where the band's orientation
        // inverts and the camera is rolling through its half-twist.
        const mid = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));

        if (vignetteRef.current) {
          vignetteRef.current.style.opacity = String(amp * (reduced ? 0.06 : 0.08 + mid * 0.03));
        }
        if (fringeRef.current) {
          fringeRef.current.style.opacity = String(amp * (reduced ? 0.15 : 0.22 + mid * 0.20));
        }
        if (seamRef.current) {
          // A brief bloom exactly at ½π — the identification moment.
          const seam = Math.max(0, 1 - Math.abs(t - 0.5) / 0.07);
          // ...and a second, sharper one at t ≈ 0.33, which is where the camera
          // now punches through the entry hole. Passing through an opening is the
          // beat this overlay exists to sell, and until the camera actually did it
          // there was nothing at this point in the ride to mark.
          const punch = Math.max(0, 1 - Math.abs(t - 0.33) / 0.045);
          seamRef.current.style.opacity = String(reduced ? 0 : amp * Math.max(seam, punch * punch * 0.65) * 0.32);
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    if (rafRef.current == null) rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [isActive]);

  if (!wormHealerMode) return null;

  const entryColor = tunnelColors?.entryColor ?? '#00bbff';
  const exitColor = tunnelColors?.exitColor ?? '#ff7700';

  const base = {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 8,
    opacity: 0,
  };

  return (
    <>
      {/* Barrel-ish darkening that pulls the frame into a bore. */}
      <div
        ref={vignetteRef}
        style={{
          ...base,
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 48%, rgba(0,0,0,0.25) 78%, rgba(0,0,0,0.60) 100%)',
        }}
      />
      {/* Colour fringing toward the edges, tinted by the two tiles being joined —
          the entry colour trailing on one side, the exit colour leading on the other. */}
      <div
        ref={fringeRef}
        style={{
          ...base,
          background:
            `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, ${entryColor}00 55%, ${entryColor}55 100%),` +
            `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 52%, ${exitColor}00 64%, ${exitColor}44 100%)`,
          mixBlendMode: 'screen',
        }}
      />
      {/* Color separation around the crossing; the centre stays unobstructed. */}
      <div
        ref={seamRef}
        style={{
          ...base,
          background: `radial-gradient(ellipse at 50% 50%, transparent 25%, ${entryColor}00 38%, ${entryColor}88 51%, ${exitColor}66 57%, transparent 72%)`,
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
}
