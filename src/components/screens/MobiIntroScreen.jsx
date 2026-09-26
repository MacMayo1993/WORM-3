import DemoDialog from './DemoDialog.jsx';
// src/components/screens/MobiIntroScreen.jsx
/**
 * MobiIntroScreen — Civ 6-style dialogue: full-width panel at bottom,
 * character portrait on the left peaking above, nameplate on the top-left edge.
 * The look and the spoken-line reveal live in MobiStage.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PAPER_BACKDROP_BLUR, Z } from '../../utils/uiTheme.js';
import MobiStage, { MobiKey, useMobiSpeech } from './MobiStage.jsx';

// ── Dialogue banks ────────────────────────────────────────────────────────────

// Demo cold open — the framing beat before step 1. Sets up the game's one
// core promise (opposite tiles are twins) so the player twists the first cube
// knowing why, then hands off to the interactive steps.
//
// Deliberately jargon-free: no "antipodal", no "manifold", no topology. The
// idea a first-timer needs is spatial, not mathematical — "the tile dead
// opposite this one is the same tile" — so every line points at the cube
// instead of at the theory. The formal name shows up once, later, as an aside
// (TWIN_ASIDE in demoStepCopy.js).
export const MOBI_LINES_DEMO_INTRO = [
  "Aloha! I'm Mobi. I'm from a world called WORM³.",
  "This is a Flip Cube. It slipped out of my world and landed here scrambled.",
  "Every tile has a twin straight through the middle. Flip one and its twin flips too.",
  "Help me heal it, and my way home stays open.",
  "Try the controls one step at a time. You can skip any step.",
];

// Worm mode intro. Kept short and literal: a first-timer needs to know the
// controls and the goal, not the lore. Steering is relative ("Turn left/right"
// from the worm's heading — see WormCrawlerHUD's STEER_KEYS), so the copy frames
// it as riding the worm's head. Each line names one concrete thing to do:
// steer, collect, heal, survive.
export const MOBI_LINES_WORM = [
  "Tap Left or Right to steer. Collect orbs to heal wormholes.",
  "Enter a wormhole to spend your collected orbs on healing.",
  "Jump over your body or steer around it.",
];

export const MOBI_LINES_FREEPLAY = [
  "Turn the Flip Cube until each face is one color.",
  "Enable Flip Mode to move paired tiles through the cube.",
];

export const MOBI_LINES_TEACH = [
  "Use Guided for step-by-step practice, Demo for playback, Notation for move symbols, or Quiz to test your next move.",
  "The beginner method solves the bottom, middle, then top layer.",
];

export const MOBI_LINES_HOLLOW = [
  "View and solve the cube’s outer shell.",
];

export const MOBI_LINES_MIRROR = [
  "Moves are mirrored on the opposite side.",
];

export const MOBI_LINES_CHAOS = [
  "Tiles flip and disappear as the round progresses.",
  "Choose a prediction before the round, or skip betting.",
];

export const MOBI_LINES_CAMPAIGN = [
  "Complete each level’s goal to unlock the next.",
  "Classic requires matching colors. Sudokube requires every number once per face. Ultimate requires both.",
];

export const MOBI_LINES_BIOME = [
  "Solve the cube with grass, ice, sand, water, wood, and stone faces.",
];

export const MOBI_LINES_RANDOM = [
  "Solve the cube while its palette and tile style change every 10 seconds.",
  "Your chosen size and background stay fixed.",
];

// ── Main component ────────────────────────────────────────────────────────────

// Optional props for reuse beyond mode intros (demo step dialogues):
//   primaryLabel — overrides the last-line button label ('▶ Launch' default)
//   skipLabel    — overrides the secondary button label ('Skip' default)
//   onSkip       — alternate completion for the secondary button / Escape;
//                  falls back to onComplete when absent
//   topInset     — CSS length to start the overlay below (e.g. the top app
//                  bar's height). Dialogues that play while the in-game HUD is
//                  up pass this so the bar stays above the dim + blur instead
//                  of being buried under it.
const MobiIntroScreen = ({ lines = [], modeName, _accentColor, onComplete, primaryLabel, skipLabel, onSkip, topInset }) => {
  const [index, setIndex]           = useState(0);
  const [isDismissing, setDismissing] = useState(false);
  const isLast = index === lines.length - 1;
  const dismissTimer = useRef(null);
  const dismissed = useRef(false);
  const speech = useMobiSpeech(lines[index] ?? '');
  useEffect(() => {
    return () => clearTimeout(dismissTimer.current);
  }, []);
  useEffect(() => {
    if (!lines.length && !dismissed.current) {
      dismissed.current = true;
      onComplete();
    }
  }, [lines.length, onComplete]);

  // One cancellable completion: rapid taps and a parent unmount cannot launch
  // the next step twice or fire an old step’s callback over a newer screen.
  const finish = useCallback((done) => {
    if (dismissed.current) return;
    dismissed.current = true;
    setDismissing(true);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    dismissTimer.current = setTimeout(done, reduced ? 0 : 250);
  }, []);
  const dismiss = useCallback(() => finish(onComplete), [finish, onComplete]);
  const skip = useCallback(() => finish(onSkip || onComplete), [finish, onSkip, onComplete]);

  // Next while Mobi is still talking finishes the line first, so nobody skips
  // words they never saw; the next press moves on.
  const advance = useCallback(() => {
    if (isDismissing) return;
    if (speech.finish()) return;
    if (isLast) dismiss();
    else setIndex(i => i + 1);
  }, [isDismissing, isLast, dismiss, speech]);

  if (!lines.length) return null;

  return (
    <DemoDialog
      onClose={skip}
      className="demo-mobi-dialog"
      aria-label={`${modeName || 'Game'} · Mobi’s instructions`}
      style={{
        position: 'fixed',
        inset: 0,
        // Docked below the top app bar when the caller asks for it, so the bar
        // (and its Home / Settings / far-side buttons) stays legible and
        // reachable above the dialogue rather than under its dim and blur.
        top: topInset || 0,
        // Above all in-game chrome (nav bar, HUD, mobile controls) — a Mobi
        // dialogue is a blocking beat; only demo shell overlays sit higher.
        zIndex: Z.INTRO,
        background: 'linear-gradient(to top, rgba(38, 55, 45, 0.30) 0%, rgba(38, 55, 45, 0.08) 42%, transparent 68%)',
        pointerEvents: isDismissing ? 'none' : 'auto',
        cursor: 'default',
      }}
    >
      {/* Background blur layer — always transitioning so backdrop-filter animates correctly */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        backdropFilter:       isDismissing ? 'none' : PAPER_BACKDROP_BLUR,
        WebkitBackdropFilter: isDismissing ? 'none' : PAPER_BACKDROP_BLUR,
        transition: 'backdrop-filter 0.7s ease, -webkit-backdrop-filter 0.7s ease',
      }} />
      <MobiStage
        line={lines[index]}
        lineKey={index}
        index={index}
        count={lines.length}
        tag={modeName || 'WORM MODE'}
        dismissing={isDismissing}
        speech={speech}
        actions={<>
          <MobiKey disabled={isDismissing} onClick={(e) => { e.stopPropagation(); skip(); }}>
            {skipLabel || 'Skip'}
          </MobiKey>
          <MobiKey primary={isLast} data-demo-autofocus disabled={isDismissing}
            onClick={(e) => { e.stopPropagation(); advance(); }}>
            {isLast ? (primaryLabel || 'Launch ▶') : 'Next ▶'}
          </MobiKey>
        </>}
      />
    </DemoDialog>
  );
};

export default MobiIntroScreen;
