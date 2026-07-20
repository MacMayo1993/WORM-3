import React from 'react';
import { UI_FONT, DISPLAY_FONT } from '../../utils/uiTheme.js';
import { makeCubies } from '../../game/cubeState.js';
import { flipStickerPair, buildManifoldGridMap } from '../../game/manifoldLogic.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { STEP_COPY } from '../../utils/demoStepCopy.js';
import MobiIntroScreen from './MobiIntroScreen.jsx';

const DEMO_STEPS = [
  { id: 'baby-cube', label: 'Baby Cube', num: 1 },
  { id: 'twin-paradox', label: 'Twin Paradox', num: 2 },
  { id: 'flip-gateway', label: 'Flip Gateway', num: 3 },
  { id: 'view-showcase', label: 'View Modes', num: 4 },
  { id: 'worm-traversal', label: 'WORM Traversal', num: 5 },
  { id: 'chaos-forecast', label: 'Chaos Forecast', num: 6 },
  { id: 'random-showcase', label: 'Random Mode', num: 7 },
  { id: 'cosmetic-reward', label: 'Cosmetic Reward', num: 8 },
  { id: 'end', label: 'Complete', num: 9 },
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

    .demo-spotlight-hint {
      position: fixed;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 96px);
      left: 50%;
      transform: translateX(-50%);
      z-index: 11500;
      width: min(340px, calc(100vw - 40px));
      padding: 13px 16px 14px;
      border-radius: 18px;
      background: rgba(250, 247, 238, 0.95);
      border: 1px solid rgba(111, 126, 86, 0.25);
      box-shadow: 0 14px 34px rgba(40, 48, 32, 0.2);
      color: #26331f;
      font-family: ${UI_FONT};
      text-align: center;
      animation: demo-spotlight-hint-bob 1.6s ease-in-out infinite;
    }

    .demo-spotlight-hint::after {
      content: '';
      position: absolute;
      /* Point at the Views tile: 4th of 5 space-around slots in a bar capped
         at 420px wide, so its center sits ~20% of the bar width right of center. */
      left: calc(50% + min(19vw, 76px));
      bottom: -8px;
      transform: translateX(-50%) rotate(45deg);
      width: 16px;
      height: 16px;
      background: rgba(250, 247, 238, 0.95);
      border-right: 1px solid rgba(111, 126, 86, 0.25);
      border-bottom: 1px solid rgba(111, 126, 86, 0.25);
    }

    @keyframes demo-spotlight-hint-bob {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(-6px); }
    }

    .demo-beat-root {
      position: fixed;
      inset: 0;
      z-index: 11600;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      font-family: ${UI_FONT};
      text-align: center;
    }

    .demo-beat-flash {
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at center, rgba(255,255,255,0.30) 0%, rgba(184,143,74,0.14) 45%, transparent 72%);
      animation: demo-beat-flash 0.7s ease-out forwards;
    }

    @keyframes demo-beat-flash {
      0%   { opacity: 0.9; transform: scale(0.9); }
      55%  { opacity: 0.35; transform: scale(1.03); }
      100% { opacity: 0;   transform: scale(1.08); }
    }

    .demo-complete-stamp {
      animation: demo-stamp-punch 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    /* Launch stamp lingers (~2.65s) so the step name registers; the root
       modifier lifts it to the upper quarter of the screen. */
    .demo-launch-stamp {
      animation: demo-stamp-punch-long 2.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .demo-beat-root--upper {
      justify-content: flex-start;
      padding-top: calc(25vh - 60px);
    }

    @keyframes demo-stamp-punch-long {
      0%   { opacity: 0; transform: scale(2.3) rotate(-3deg); }
      7%   { opacity: 1; transform: scale(0.96) rotate(0deg); }
      10%  { transform: scale(1.02); }
      13%  { transform: scale(1); }
      90%  { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.06); }
    }

    @keyframes demo-stamp-punch {
      0%   { opacity: 0; transform: scale(2.3) rotate(-3deg); }
      16%  { opacity: 1; transform: scale(0.96) rotate(0deg); }
      24%  { transform: scale(1.02); }
      30%  { transform: scale(1); }
      78%  { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.06); }
    }

    .demo-beat-title {
      font-family: ${DISPLAY_FONT};
      font-size: clamp(34px, 9.5vw, 62px);
      line-height: 0.95;
      letter-spacing: 0.03em;
      color: #fffdf2;
      text-shadow: 0 3px 0 rgba(43, 53, 35, 0.55), 0 10px 34px rgba(24, 31, 18, 0.6);
      margin: 0;
    }

    .demo-beat-sub {
      font-size: clamp(12px, 3.4vw, 15px);
      font-weight: 900;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #ffe9ad;
      text-shadow: 0 2px 12px rgba(24, 31, 18, 0.7);
      margin: 0 0 10px;
    }

    .demo-complete-check {
      font-size: clamp(40px, 11vw, 72px);
      line-height: 1;
      color: #9fdb7a;
      text-shadow: 0 4px 0 rgba(43, 53, 35, 0.5), 0 12px 38px rgba(24, 31, 18, 0.65);
      margin: 0 0 6px;
    }

    /* Persistent step-complete: the stamp flies in and HOLDS over a blurred
       scene, waiting for a tap or the Next Step button instead of auto-advancing. */
    .demo-beat-root--hold {
      pointer-events: auto;
      cursor: pointer;
      background: radial-gradient(ellipse at center, rgba(24, 31, 18, 0.34), rgba(24, 31, 18, 0.62));
      backdrop-filter: blur(9px) saturate(1.03);
    }

    .demo-complete-stamp--hold {
      animation: demo-stamp-punch-hold 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes demo-stamp-punch-hold {
      0%   { opacity: 0; transform: scale(2.3) rotate(-3deg); }
      55%  { opacity: 1; transform: scale(0.96) rotate(0deg); }
      75%  { transform: scale(1.02); }
      100% { opacity: 1; transform: scale(1); }
    }

    .demo-complete-next {
      margin-top: 20px;
      animation: demo-complete-cta-in 0.5s ease 0.6s both;
    }

    .demo-complete-hint {
      margin: 12px 0 0;
      color: rgba(255, 253, 242, 0.72);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      animation: demo-complete-cta-in 0.5s ease 0.78s both;
    }

    @keyframes demo-complete-cta-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
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

    /* Worm mode owns the top edge with its glance strip — dock the pill at the
       bottom, above the thumb tray. Declared last so it wins over the mobile
       media-query top override. */
    .demo-progress-pill--bottom {
      top: auto;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 100px);
    }

    /* Compact advance pill left behind after Mobi's coach dialogue dismisses */
    .demo-coach-pill {
      position: fixed;
      top: calc(max(10px, env(safe-area-inset-top, 10px)) + 44px);
      left: 50%;
      transform: translateX(-50%);
      z-index: 11000;
    }

    .demo-coach-pill--bottom {
      top: auto;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 144px);
    }

    .demo-coach-pill-btn {
      padding: 8px 22px;
      background: #5f7f4a;
      color: #fffdf5;
      border: none;
      border-radius: 999px;
      font-family: ${UI_FONT};
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      letter-spacing: 0.03em;
      box-shadow: 0 6px 14px rgba(95, 127, 74, 0.28);
    }

    /* Worm control hint — non-blocking pill during early worm-step play.
       Sits above the bottom-docked progress/coach pills; fades out once the
       player makes progress (first tunnel) or the skip pill appears. */
    .demo-worm-hint {
      position: fixed;
      left: 50%;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 196px);
      transform: translateX(-50%);
      z-index: 11000;
      width: min(320px, calc(100vw - 40px));
      padding: 10px 16px;
      border-radius: 14px;
      background: rgba(250, 247, 238, 0.94);
      border: 1px solid rgba(111, 126, 86, 0.25);
      box-shadow: 0 10px 26px rgba(40, 48, 32, 0.22);
      color: #26331f;
      font-family: ${UI_FONT};
      font-size: 13px;
      font-weight: 600;
      line-height: 1.4;
      text-align: center;
      pointer-events: none;
      animation: demo-worm-hint-in 0.4s ease both;
    }

    .demo-worm-hint strong { font-weight: 800; color: #3f5730; }

    @keyframes demo-worm-hint-in {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    /* Flip-gateway progress pill — bottom-center, above the nav bar. Shows how
       many front-face tiles are flipped (or restored) so the loop feels bounded. */
    .demo-flip-progress {
      position: fixed;
      left: 50%;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 92px);
      transform: translateX(-50%);
      z-index: 11000;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 15px;
      border-radius: 999px;
      background: rgba(250, 247, 238, 0.94);
      border: 1px solid rgba(111, 126, 86, 0.25);
      box-shadow: 0 10px 26px rgba(40, 48, 32, 0.22);
      color: #27351f;
      font-family: ${UI_FONT};
      pointer-events: none;
      animation: demo-worm-hint-in 0.4s ease both;
    }

    .demo-flip-progress-label {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #657156;
    }

    .demo-flip-progress-track {
      width: 74px;
      height: 5px;
      background: rgba(92, 111, 76, 0.2);
      border-radius: 999px;
      overflow: hidden;
    }

    .demo-flip-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #7b8f5a, #b88f4a);
      border-radius: 999px;
      transition: width 0.25s ease;
    }

    .demo-flip-progress-count {
      font-size: 12px;
      font-weight: 800;
      color: #35452a;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
};

const DemoProgressBar = ({ currentStep }) => {
  ensureDemoShellStyle();
  // Worm mode's glance strip owns the top edge — dock the pill at the bottom there.
  const wormHealerMode = useGameStore((s) => s.wormHealerMode);
  const idx = DEMO_STEPS.findIndex(s => s.id === currentStep);
  const total = DEMO_STEPS.length - 1;
  const progress = idx >= 0 ? idx / total : 0;

  return (
    <div className={`demo-progress-pill${wormHealerMode ? ' demo-progress-pill--bottom' : ''}`}>
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

// Step intro: Mobi delivers the setup line AND the hands-on guidance in one
// dialogue over the blurred live scene — the mid-step coach is just a pill.
const DemoStepIntro = ({ step, onContinue, onSkip }) => {
  const info = DEMO_STEPS.find(s => s.id === step);
  if (!info) return null;
  const lines = [STEP_COPY[step], TRY_COPY[step]].filter(Boolean);
  return (
    <MobiIntroScreen
      key={step}
      lines={lines}
      modeName={`Step ${info.num} · ${info.label}`}
      primaryLabel="▶ Start"
      onComplete={onContinue}
      skipLabel="Skip Step ▶"
      onSkip={onSkip}
    />
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
  'view-showcase': {
    type: 'showcase',
    cubeSize: 3,
    features: { rotations: true, tunnels: false, flips: false },
    chaosLevel: 0,
  },
  'worm-traversal': {
    type: 'worm',
    cubeSize: 6,
    wormSpeed: 2.5,
    wormOrbCount: 25,
    wormholeInterval: 8,
    wormColor: '#33ff66',
    wormCharacter: 'glow',
    wormSkin: 'lava',
    // The worm demo swaps in a Shanghai skybox; tiles keep the demo-wide
    // topographic look. applyDemoStepConfig's worm branch layers this over
    // applyDemoSettings.
    backgroundTheme: 'shanghai',
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
  'baby-cube': 'Your turn — drag a row to twist it. Drag the space around the cube to orbit.',
  'twin-paradox': 'Your turn — tap any tile and watch its twin flip on the far side too.',
  'flip-gateway': 'Tap each front-face tile to send it to its twin, then tap them back home to solve.',
  'worm-traversal': 'Grab orbs, heal tiles, and dive through a glowing tunnel. Skip ahead anytime.',
  'chaos-forecast': 'Bet on the pair you think survives, then watch it play out. Skip anytime.',
  'random-showcase': 'Watch a few random cubes roll by, or skip ahead.',
};

// Coach: the guidance already played inside the step-intro dialogue, so the
// default coach is just a compact "Next ▶" pill. Only a copy OVERRIDE
// (flip-gateway's second phase) brings Mobi back — that line is new info.
const DemoCoach = ({ step, onNext, onExit, copy: copyOverride }) => {
  ensureDemoShellStyle();
  const [overrideSeen, setOverrideSeen] = React.useState(false);
  const wormHealerMode = useGameStore((s) => s.wormHealerMode);
  React.useEffect(() => {
    setOverrideSeen(false);
  }, [copyOverride]);
  if (!copyOverride && !TRY_COPY[step]) return null;

  if (copyOverride && !overrideSeen) {
    const info = DEMO_STEPS.find(s => s.id === step);
    return (
      <MobiIntroScreen
        key={copyOverride}
        lines={[copyOverride]}
        modeName={info ? `Step ${info.num} · ${info.label}` : 'Demo'}
        primaryLabel="▶ Got It"
        onComplete={() => setOverrideSeen(true)}
        skipLabel="Exit Demo"
        onSkip={onExit}
      />
    );
  }

  return (
    <div className={`demo-coach-pill${wormHealerMode ? ' demo-coach-pill--bottom' : ''}`}>
      <button type="button" onClick={onNext} className="demo-coach-pill-btn">
        Next ▶
      </button>
    </div>
  );
};

// ── View Showcase sequence ────────────────────────────────────────────────────
// Each entry describes one beat of the view-showcase demo step.
// `apply` is called with the store to activate the view; `cleanup` reverses it.
const VIEW_SHOWCASE_SEQUENCE = [
  {
    key: 'grid',
    title: 'Grid',
    copy: 'Grid overlays coordinate lines on each face — useful for tracking tile positions.',
    apply: (s) => s.setVisualMode('grid'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'sudokube',
    title: 'Sudoku',
    copy: 'Sudoku mode shows unique numbers on every tile — a number-puzzle twist.',
    apply: (s) => s.setVisualMode('sudokube'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'wireframe',
    title: 'Wireframe',
    copy: 'Wireframe strips each tile down to its outline. Clean and minimal.',
    apply: (s) => s.setVisualMode('wireframe'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'glass',
    title: 'Glass',
    copy: 'Glass makes tiles transparent — see through the cube to the far side.',
    apply: (s) => s.setVisualMode('glass'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'chrome',
    title: 'Chrome',
    copy: 'Chrome gives each tile a reflective metallic surface.',
    apply: (s) => s.setVisualMode('chrome'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'neon',
    title: 'Neon',
    copy: 'Neon lights up every tile edge with a glowing outline.',
    apply: (s) => s.setVisualMode('neon'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'gap',
    title: 'Gap',
    copy: 'Gap adds visible spacing between tiles so you can see each one individually.',
    apply: (s) => s.setVisualMode('gap'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'lego',
    title: 'Lego',
    copy: 'Lego turns each tile into a brick-like stud.',
    apply: (s) => s.setVisualMode('lego'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'explode',
    title: 'Explode',
    copy: 'Explode separates every face outward so you can see all six sides at once.',
    apply: (s) => s.setExploded(true),
    cleanup: (s) => s.setExploded(false),
  },
  {
    key: 'tunnels',
    title: 'Tunnels',
    copy: 'Flipping a tile opens a wormhole to its antipodal twin — with the cube still exploded, watch the tunnel thread through its core.',
    // Keep the previous beat's exploded view (the tunnel is invisible inside a
    // closed cube) and flip the front-face center tile so exactly one
    // antipodal tunnel lights up.
    apply: (s) => {
      s.setExploded(true);
      s.setShowTunnels(true);
      const mid = Math.floor(s.size / 2);
      const map = buildManifoldGridMap(s.cubies, s.size);
      s.setRotatedCubies(flipStickerPair(s.cubies, s.size, mid, mid, s.size - 1, 'PZ', map));
    },
    // Rebuild solved cubies rather than re-flipping: the user may have rotated
    // the flipped tile away from where apply() put it.
    cleanup: (s) => {
      s.setExploded(false);
      s.setShowTunnels(false);
      s.setRotatedCubies(makeCubies(s.size));
    },
  },
  {
    key: 'hollow',
    title: 'Hollow',
    copy: 'Hollow removes internal cubies, revealing the cube\'s skeletal structure.',
    apply: (s) => s.setHollowMode(true),
    cleanup: (s) => s.setHollowMode(false),
  },
  {
    key: 'net',
    title: 'Net',
    copy: 'Net unfolds the cube flat — like paper craft. Great for spotting patterns.',
    apply: (s) => s.setShowNetPanel(true),
    cleanup: (s) => s.setShowNetPanel(false),
  },
];

// ── Step beats ───────────────────────────────────────────────────────────────
// Full-screen, non-interactive punches that bookend each demo step:
//   • DemoStepComplete fires the moment a step's goal is achieved (cube
//     re-solved, parity restored, worm through) — flash + "STEP COMPLETE"
//     stamp, then the hook auto-advances.
//   • DemoStepLaunch slams the new step's title over the freshly staged scene
//     so the next stage arrives with energy instead of a silent swap.

// The step-complete stamp flies in and HOLDS over a blurred scene. It no longer
// auto-advances — the player dismisses it by tapping anywhere or pressing the
// Next Step button, so the win registers before the next stage arrives.
const DemoStepComplete = ({ step, onDismiss }) => {
  ensureDemoShellStyle();
  const info = DEMO_STEPS.find(s => s.id === step);
  if (!info) return null;
  const handleDismiss = () => onDismiss?.();
  return (
    <div
      className="demo-beat-root demo-beat-root--hold"
      aria-live="assertive"
      role="button"
      tabIndex={0}
      aria-label={`Step ${info.num} complete — tap to continue`}
      onClick={handleDismiss}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleDismiss();
        }
      }}
    >
      <div className="demo-beat-flash" />
      <div className="demo-complete-stamp demo-complete-stamp--hold">
        <p className="demo-complete-check">✓</p>
        <p className="demo-beat-sub">Step {info.num} Complete</p>
        <h2 className="demo-beat-title">{info.label}</h2>
        <button
          type="button"
          className="demo-intro-button demo-complete-next"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
        >
          Next Step ▶
        </button>
        <p className="demo-complete-hint">Tap anywhere to continue</p>
      </div>
    </div>
  );
};

const DemoStepLaunch = ({ step }) => {
  ensureDemoShellStyle();
  const info = DEMO_STEPS.find(s => s.id === step);
  if (!info) return null;
  return (
    <div className="demo-beat-root demo-beat-root--upper" aria-live="polite">
      <div className="demo-beat-flash" />
      <div className="demo-launch-stamp">
        <p className="demo-beat-sub">Step {info.num}</p>
        <h2 className="demo-beat-title">{info.label}</h2>
      </div>
    </div>
  );
};

// Chaos payout: announces the Parity Points won using the same launch-stamp
// text treatment as DemoStepLaunch, so the reward reads with the same weight
// as a new step arriving. `correct` distinguishes a nailed forecast (200) from
// the consolation grant (50).
const DemoRewardStamp = ({ amount, correct }) => {
  ensureDemoShellStyle();
  return (
    <div className="demo-beat-root demo-beat-root--upper" aria-live="polite">
      <div className="demo-beat-flash" />
      <div className="demo-launch-stamp">
        <p className="demo-beat-sub">{correct ? 'Forecast Correct' : 'Parity Points Won'}</p>
        <h2 className="demo-beat-title">+{amount} PP</h2>
      </div>
    </div>
  );
};

// Shown before the view sequence starts: the Views tile on the bottom nav bar
// pulses (see BottomNavBar `spotlightViews`) and this hint asks for the tap
// that kicks off the first view.
const DemoViewSpotlightHint = ({ onSkip }) => {
  ensureDemoShellStyle();
  return (
    <div className="demo-spotlight-hint" role="status" aria-live="polite">
      <p className="demo-intro-copy" style={{ marginBottom: 8 }}>
        Tap the glowing <strong>Views</strong> button below to open the first view mode.
      </p>
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          aria-label="Skip views"
          className="demo-intro-button"
          style={{ background: 'transparent', color: '#7b6f45', boxShadow: 'none', padding: '4px 12px' }}
        >
          Skip All ▶
        </button>
      )}
    </div>
  );
};

// Worm-step control hint: the healer worm crawls on its own and shows no
// controls of its own, so the demo names the steer gesture while the player
// plays. Non-interactive; the parent unmounts it once the worm makes progress.
const DemoWormControlHint = () => {
  ensureDemoShellStyle();
  return (
    <div className="demo-worm-hint" role="status" aria-live="polite">
      The worm crawls on its own — <strong>swipe ← →</strong> (or arrow keys) to steer it toward orbs and tunnels.
    </div>
  );
};

// Flip-gateway progress: a bounded count of how many front-face tiles are
// flipped ("flip-all") or restored ("unflip-all"), so the tap loop reads as a
// short task with a finish line rather than an open-ended chore.
const DemoFlipProgress = ({ progress }) => {
  ensureDemoShellStyle();
  if (!progress) return null;
  const { phase, done, total } = progress;
  const label = phase === 'unflip-all' ? 'Restored' : 'Flipped';
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div className="demo-flip-progress" role="status" aria-live="polite">
      <span className="demo-flip-progress-label">{label}</span>
      <div className="demo-flip-progress-track">
        <div className="demo-flip-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="demo-flip-progress-count">{done} / {total}</span>
    </div>
  );
};

const DemoViewShowcase = ({ subStep, onNext, onSkip }) => {
  ensureDemoShellStyle();
  const entry = VIEW_SHOWCASE_SEQUENCE[subStep];
  if (!entry) return null;
  const progress = `${subStep + 1} / ${VIEW_SHOWCASE_SEQUENCE.length}`;

  return (
    <div className="demo-intro-root" style={{ pointerEvents: 'none', background: 'none', backdropFilter: 'none' }}>
      <section className="demo-intro-card" style={{ pointerEvents: 'auto' }} aria-live="polite">
        <p className="demo-intro-step" style={{ marginBottom: 2 }}>{progress}</p>
        <h2 className="demo-intro-title" style={{ fontSize: 'clamp(20px, 5.5vw, 28px)', marginBottom: 6 }}>
          {entry.title}
        </h2>
        <p className="demo-intro-copy">{entry.copy}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <button type="button" onClick={onNext} className="demo-intro-button">
            {subStep < VIEW_SHOWCASE_SEQUENCE.length - 1 ? 'Next View' : 'Done'}
          </button>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              aria-label="Skip views"
              className="demo-intro-button"
              style={{ background: 'transparent', color: '#7b6f45', boxShadow: 'none' }}
            >
              Skip All ▶
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

export {
  DemoProgressBar,
  DemoStepIntro,
  DemoCoach,
  DemoViewShowcase,
  DemoViewSpotlightHint,
  DemoWormControlHint,
  DemoFlipProgress,
  DemoStepComplete,
  DemoStepLaunch,
  DemoRewardStamp,
  VIEW_SHOWCASE_SEQUENCE,
  TRY_COPY,
  DEMO_STEPS,
  DEMO_LEVEL_CONFIGS
};
