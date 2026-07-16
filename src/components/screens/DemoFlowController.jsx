import React from 'react';
import { UI_FONT, DISPLAY_FONT } from '../../utils/uiTheme.js';

const DEMO_STEPS = [
  { id: 'baby-cube', label: 'Baby Cube', num: 1 },
  { id: 'twin-paradox', label: 'Twin Paradox', num: 2 },
  { id: 'flip-gateway', label: 'Flip Gateway', num: 3 },
  { id: 'worm-traversal', label: 'WORM Traversal', num: 4 },
  { id: 'chaos-forecast', label: 'Chaos Forecast', num: 5 },
  { id: 'random-showcase', label: 'Random Mode', num: 6 },
  { id: 'cosmetic-reward', label: 'Cosmetic Reward', num: 7 },
  { id: 'end', label: 'Complete', num: 8 },
];

export const DEMO_STEP_IDS = DEMO_STEPS.map(s => s.id);

const DEMO_SHELL_STYLE_ID = 'worm3-demo-shell-style';

const ensureDemoShellStyle = () => {
  if (typeof document === 'undefined' || document.getElementById(DEMO_SHELL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = DEMO_SHELL_STYLE_ID;
  style.textContent = `
    .demo-progress-pill {
      position: fixed;
      top: max(10px, env(safe-area-inset-top, 10px));
      left: 50%;
      transform: translateX(-50%);
      z-index: 11000;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 7px 14px;
      border-radius: 999px;
      background: rgba(250, 246, 235, 0.88);
      border: 1px solid rgba(89, 109, 74, 0.24);
      box-shadow: 0 8px 24px rgba(43, 53, 35, 0.16);
      color: #27351f;
      backdrop-filter: blur(14px) saturate(1.08);
      font-family: ${UI_FONT};
      pointer-events: none;
    }

    .demo-progress-label {
      color: #657156;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.11em;
    }

    .demo-progress-track {
      width: 86px;
      height: 5px;
      background: rgba(92, 111, 76, 0.18);
      border-radius: 999px;
      overflow: hidden;
    }

    .demo-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #7b8f5a, #b88f4a);
      border-radius: 999px;
      transition: width 0.4s ease;
    }

    .demo-progress-count {
      color: #35452a;
      font-size: 11px;
      font-weight: 800;
    }

    .demo-intro-root {
      position: fixed;
      inset: 0;
      z-index: 11500;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: max(62px, calc(env(safe-area-inset-top, 0px) + 52px)) 18px 24px;
      background: linear-gradient(180deg, rgba(246, 241, 226, 0.50), rgba(246, 241, 226, 0.08) 38%, rgba(24, 31, 18, 0.10));
      backdrop-filter: blur(4px) saturate(0.98);
      font-family: ${UI_FONT};
      text-align: center;
    }

    .demo-intro-card {
      width: min(420px, calc(100vw - 32px));
      padding: 16px 18px 18px;
      border-radius: 22px;
      background: rgba(250, 247, 238, 0.94);
      border: 1px solid rgba(111, 126, 86, 0.25);
      box-shadow: 0 14px 34px rgba(40, 48, 32, 0.18);
      color: #26331f;
    }

    .demo-intro-step {
      color: #7b6f45;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin: 0 0 6px;
    }

    .demo-intro-title {
      font-family: ${DISPLAY_FONT};
      font-size: clamp(24px, 7.2vw, 36px);
      line-height: 0.96;
      color: #24331e;
      margin: 0 0 8px;
      letter-spacing: 0.025em;
    }

    .demo-intro-copy {
      color: #43513a;
      font-size: clamp(14px, 3.8vw, 16px);
      line-height: 1.38;
      margin: 0 auto 16px;
      max-width: 320px;
    }

    .demo-intro-button {
      padding: 11px 26px;
      background: #5f7f4a;
      color: #fffdf5;
      border: none;
      border-radius: 999px;
      font-family: ${UI_FONT};
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      letter-spacing: 0.03em;
      box-shadow: 0 7px 16px rgba(95, 127, 74, 0.24);
    }

    @media (max-width: 640px) {
      .demo-progress-pill {
        top: max(8px, env(safe-area-inset-top, 8px));
        padding: 6px 12px;
        background: rgba(250, 247, 238, 0.92);
      }

      .demo-intro-root {
        padding-top: max(88px, calc(env(safe-area-inset-top, 0px) + 84px));
        align-items: flex-start;
        background: linear-gradient(180deg, rgba(246, 241, 226, 0.38), rgba(246, 241, 226, 0.04) 46%, transparent 72%);
        backdrop-filter: blur(2px) saturate(0.95);
      }

      .demo-intro-card {
        padding: 13px 14px 14px;
        border-radius: 18px;
      }

      .demo-intro-title {
        font-size: clamp(22px, 6.6vw, 30px);
      }

      .demo-intro-copy {
        margin-bottom: 12px;
      }
    }
  `;
  document.head.appendChild(style);
};

const DemoProgressBar = ({ currentStep }) => {
  ensureDemoShellStyle();
  const idx = DEMO_STEPS.findIndex(s => s.id === currentStep);
  const total = DEMO_STEPS.length - 1;
  const progress = idx >= 0 ? idx / total : 0;

  return (
    <div className="demo-progress-pill">
      <span className="demo-progress-label">DEMO</span>
      <div className="demo-progress-track">
        <div className="demo-progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="demo-progress-count">
        {idx + 1} / {total + 1}
      </span>
    </div>
  );
};

const DemoStepIntro = ({ step, onContinue, onSkip }) => {
  ensureDemoShellStyle();
  const info = DEMO_STEPS.find(s => s.id === step);
  if (!info) return null;

  const STEP_COPY = {
    'baby-cube': 'Solve this first twist. Drag the turned row back into place to continue.',
    'twin-paradox': 'Opposite faces are linked.',
    'flip-gateway': 'Flip every tile, then flip them all back.',
    'worm-traversal': 'Travel through the wormholes you opened.',
    'chaos-forecast': 'Predict which pair survives.',
    'random-showcase': 'The cube cycles through random styles every few seconds.',
    'cosmetic-reward': 'Spend your Parity Points.',
  };

  return (
    <div className="demo-intro-root">
      <section className="demo-intro-card" aria-live="polite">
        <p className="demo-intro-step">Step {info.num}</p>
        <h2 className="demo-intro-title">{info.label}</h2>
        <p className="demo-intro-copy">{STEP_COPY[step]}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <button type="button" onClick={onContinue} className="demo-intro-button">
            Start Step
          </button>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              aria-label="Skip step"
              className="demo-intro-button"
              style={{ background: 'transparent', color: '#7b6f45', boxShadow: 'none' }}
            >
              Skip ▶
            </button>
          )}
        </div>
      </section>
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
    scrambleSequence: null,
    flipSequence: null,
    watch: null,
    features: { rotations: true, tunnels: true, flips: true },
    chaosLevel: 0,
  },
  'worm-traversal': {
    type: 'worm',
    cubeSize: 6,
    wormSpeed: 0.8,
    wormOrbCount: 3,
    wormholeInterval: 8,
    wormColor: '#33ff66',
  },
  'chaos-forecast': {
    type: 'chaos',
    cubeSize: 3,
    disparityLevel: 3,
    flipCap: 6,
    gameLength: 'short',
  },
  'random-showcase': {
    type: 'random',
    cubeSize: 3,
  },
};

// ── TRY phase ──────────────────────────────────────────────────────────────
// After the WATCH beat auto-plays the mechanic, the coach invites one optional
// hands-on interaction. "Next" is always available, so the demo can never hang.
const TRY_COPY = {
  'baby-cube': 'Your turn — drag a row or column to spin it.',
  'twin-paradox': 'Your turn — tap any tile. Its twin on the far side flips too.',
  'flip-gateway': 'Tap every tile to flip it to wrong parity.',
  'worm-traversal': 'Nice! Skip ahead when you\'re ready.',
  'chaos-forecast': 'Skip ahead when you\'re ready.',
  'random-showcase': 'Watch the styles cycle, or skip ahead.',
};

const DemoCoach = ({ step, onNext, onExit, copy: copyOverride }) => {
  ensureDemoShellStyle();
  const copy = copyOverride || TRY_COPY[step];
  if (!copy) return null;

  return (
    <div className="demo-intro-root" style={{ pointerEvents: 'none', background: 'none', backdropFilter: 'none' }}>
      <section className="demo-intro-card" style={{ pointerEvents: 'auto' }} aria-live="polite">
        <p className="demo-intro-copy">{copy}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <button type="button" onClick={onNext} className="demo-intro-button">
            Next ▶
          </button>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              aria-label="Exit demo"
              className="demo-intro-button"
              style={{ background: 'transparent', color: '#7b6f45', boxShadow: 'none' }}
            >
              Exit
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

export { DemoProgressBar, DemoStepIntro, DemoCoach, TRY_COPY, DEMO_STEPS, DEMO_LEVEL_CONFIGS };
