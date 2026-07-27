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
import { tunnelState } from './tunnelProgressBridge.js';

// Intensity ramps in fast on entry and releases slower on exit, so the release
// reads as the ride ending rather than the effect being switched off.
const FADE_IN = 0.16;
const FADE_OUT = 0.05;

export default function TunnelTransitOverlay() {
  const { wormHealerMode, wormPhase, tunnelColors } = useGameStore(
    useShallow(s => ({
      wormHealerMode: s.wormHealerMode ?? false,
      wormPhase: s.wormPhase ?? 'crawling',
      tunnelColors: s.wormActiveTunnelColors,
    }))
  );

  // Held for the full arc including the wind-up spiral and the exit flourish —
  // deliberately wider than the phases that render the tunnel interior.
  const isActive = wormHealerMode && (
    wormPhase === 'windup' || wormPhase === 'entering' ||
    wormPhase === 'tunnel' || wormPhase === 'exiting' || wormPhase === 'windout'
  );

  const vignetteRef = useRef(null);
  const fringeRef = useRef(null);
  const seamRef = useRef(null);
  const ampRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const animate = () => {
      const target = isActive ? 1 : 0;
      ampRef.current += (target - ampRef.current) * (target > ampRef.current ? FADE_IN : FADE_OUT);
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
          vignetteRef.current.style.opacity = String(amp * (0.55 + mid * 0.35));
        }
        if (fringeRef.current) {
          fringeRef.current.style.opacity = String(amp * (0.22 + mid * 0.4));
        }
        if (seamRef.current) {
          // A brief bloom exactly at ½π — the identification moment.
          const seam = Math.max(0, 1 - Math.abs(t - 0.5) / 0.07);
          seamRef.current.style.opacity = String(amp * seam * 0.5);
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
            'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 26%, rgba(0,0,0,0.45) 62%, rgba(0,0,0,0.88) 100%)',
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
      {/* ½π bloom. */}
      <div
        ref={seamRef}
        style={{
          ...base,
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 58%)',
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
}
