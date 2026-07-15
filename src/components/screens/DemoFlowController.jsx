import React from 'react';
import { UI_FONT, DISPLAY_FONT, GLASS_TEXT, GLASS_TEXT_MUTED } from '../../utils/uiTheme.js';

const DEMO_STEPS = [
  { id: 'baby-cube', label: 'Baby Cube', num: 1 },
  { id: 'twin-paradox', label: 'Twin Paradox', num: 2 },
  { id: 'flip-gateway', label: 'Flip Gateway', num: 3 },
  { id: 'worm-traversal', label: 'WORM Traversal', num: 4 },
  { id: 'chaos-forecast', label: 'Chaos Forecast', num: 5 },
  { id: 'cosmetic-reward', label: 'Cosmetic Reward', num: 6 },
  { id: 'end', label: 'Complete', num: 7 },
];

export const DEMO_STEP_IDS = DEMO_STEPS.map(s => s.id);

const DemoProgressBar = ({ currentStep }) => {
  const idx = DEMO_STEPS.findIndex(s => s.id === currentStep);
  const total = DEMO_STEPS.length - 1;
  const progress = idx >= 0 ? idx / total : 0;

  return (
    <div style={{
      position: 'fixed',
      top: 'max(8px, env(safe-area-inset-top, 8px))',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 11000,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 16px',
      background: 'rgba(4,6,20,0.80)',
      borderRadius: 20,
      backdropFilter: 'blur(12px)',
      fontFamily: UI_FONT,
      pointerEvents: 'none',
    }}>
      <span style={{ color: GLASS_TEXT_MUTED, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em' }}>
        DEMO
      </span>
      <div style={{
        width: 80,
        height: 4,
        background: 'rgba(255,255,255,0.12)',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${progress * 100}%`,
          height: '100%',
          background: '#3b82f6',
          borderRadius: 2,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ color: GLASS_TEXT, fontSize: 11, fontWeight: 500 }}>
        {idx + 1} / {total + 1}
      </span>
    </div>
  );
};

const DemoStepIntro = ({ step, onContinue }) => {
  const info = DEMO_STEPS.find(s => s.id === step);
  if (!info) return null;

  const STEP_COPY = {
    'baby-cube': 'Learn to rotate the cube.',
    'twin-paradox': 'Opposite faces are linked.',
    'flip-gateway': 'One flip. Two linked tiles.',
    'worm-traversal': 'Travel through the wormholes you opened.',
    'chaos-forecast': 'Predict which pair survives.',
    'cosmetic-reward': 'Spend your Parity Points.',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 11500,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(2,3,10,0.85)',
      backdropFilter: 'blur(16px)',
      fontFamily: UI_FONT,
      textAlign: 'center',
      padding: 24,
    }}>
      <p style={{
        color: GLASS_TEXT_MUTED,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        margin: '0 0 8px',
      }}>
        Step {info.num}
      </p>
      <h2 style={{
        fontFamily: DISPLAY_FONT,
        fontSize: 32,
        color: '#fff',
        margin: '0 0 12px',
        letterSpacing: '0.04em',
      }}>
        {info.label}
      </h2>
      <p style={{
        color: GLASS_TEXT,
        fontSize: 15,
        margin: '0 0 32px',
        maxWidth: 300,
      }}>
        {STEP_COPY[step]}
      </p>
      <button
        type="button"
        onClick={onContinue}
        style={{
          padding: '12px 40px',
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontFamily: UI_FONT,
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '0.04em',
        }}
      >
        Continue
      </button>
    </div>
  );
};

// Each cube step runs as WATCH → TRY:
//   • `watch` is auto-performed by the app so the mechanic plays itself
//     (a rotation via startAnimatedShuffle, or a live flip via onTapFlip that
//     fires the tunnel birth + travelling soliton).
//   • then the DemoCoach invites one optional hands-on interaction before the
//     player advances with Next.
const DEMO_LEVEL_CONFIGS = {
  'baby-cube': {
    type: 'cube',
    cubeSize: 2,
    scrambleSequence: null,
    flipSequence: null,
    watch: { type: 'rotate', moves: [{ axis: 'row', sliceIndex: 0, dir: 1 }, { axis: 'col', sliceIndex: 1, dir: -1 }] },
    features: { rotations: true, tunnels: false, flips: false },
    chaosLevel: 0,
  },
  'twin-paradox': {
    type: 'cube',
    cubeSize: 2,
    scrambleSequence: null,
    flipSequence: null,
    watch: { type: 'flip', tile: { x: 0, y: 0, z: 1, dirKey: 'PZ' } },
    features: { rotations: true, tunnels: true, flips: true },
    chaosLevel: 0,
  },
  'flip-gateway': {
    type: 'cube',
    cubeSize: 3,
    scrambleSequence: [
      { axis: 'row', sliceIndex: 1, dir: 1 },
      { axis: 'col', sliceIndex: 0, dir: -1 },
    ],
    flipSequence: null,
    watch: { type: 'flip', tile: { x: 1, y: 1, z: 2, dirKey: 'PZ' } },
    features: { rotations: true, tunnels: true, flips: true },
    chaosLevel: 0,
  },
  'worm-traversal': {
    type: 'worm',
    cubeSize: 3,
    wormSpeed: 0.8,
    wormOrbCount: 3,
    wormholeInterval: 8,
    wormColor: '#33ff66',
  },
  'chaos-forecast': {
    type: 'chaos',
    cubeSize: 3,
    disparityLevel: 3,
    flipCap: 12,
    gameLength: 'short',
  },
};

// ── TRY phase ──────────────────────────────────────────────────────────────
// After the WATCH beat auto-plays the mechanic, the coach invites one optional
// hands-on interaction. "Next" is always available, so the demo can never hang.
const TRY_COPY = {
  'baby-cube': 'Your turn — drag a row or column to spin it.',
  'twin-paradox': 'Your turn — tap any tile. Its twin on the far side flips too.',
  'flip-gateway': 'Your turn — tap tiles to open wormholes between the pairs.',
};

const DemoCoach = ({ step, onNext, onExit }) => {
  const copy = TRY_COPY[step];
  if (!copy) return null;

  return (
    <div style={{
      position: 'fixed',
      left: '50%',
      bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
      transform: 'translateX(-50%)',
      zIndex: 11400,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '12px 16px 12px 20px',
      maxWidth: 'min(92vw, 520px)',
      background: 'rgba(4,6,20,0.86)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 16,
      backdropFilter: 'blur(14px)',
      fontFamily: UI_FONT,
    }}>
      <span style={{ color: GLASS_TEXT, fontSize: 14, lineHeight: 1.4, flex: 1 }}>
        {copy}
      </span>
      <button
        type="button"
        onClick={onNext}
        style={{
          flexShrink: 0,
          padding: '10px 22px',
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontFamily: UI_FONT,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '0.04em',
        }}
      >
        Next ▶
      </button>
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          aria-label="Exit demo"
          style={{
            flexShrink: 0,
            padding: '10px 12px',
            background: 'transparent',
            color: GLASS_TEXT_MUTED,
            border: 'none',
            fontFamily: UI_FONT,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Exit
        </button>
      )}
    </div>
  );
};

export { DemoProgressBar, DemoStepIntro, DemoCoach, TRY_COPY, DEMO_STEPS, DEMO_LEVEL_CONFIGS };
