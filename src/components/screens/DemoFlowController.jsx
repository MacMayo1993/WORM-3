import React from 'react';
import { UI_FONT, DISPLAY_FONT } from '../../utils/uiTheme.js';
import { makeCubies } from '../../game/cubeState.js';
import { flipStickerPair, buildManifoldGridMap } from '../../game/manifoldLogic.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { STEP_COPY, TWIN_ASIDE } from '../../utils/demoStepCopy.js';
import MobiIntroScreen from './MobiIntroScreen.jsx';

// Step ids are permanent (configs, tests and save data key off them); the
// labels are player-facing and stay in plain language — "Meet the Twins", not
// "Twin Paradox". A first-timer should be able to read the whole progress
// sequence and know what they just did.
const DEMO_STEPS = [
  { id: 'baby-cube', label: 'First Twist', num: 1 },
  { id: 'control-tour', label: 'Your Controls', num: 2 },
  { id: 'twin-paradox', label: 'Meet the Twins', num: 3 },
  { id: 'flip-gateway', label: 'Through the Middle', num: 4 },
  { id: 'view-showcase', label: 'Every Look', num: 5 },
  { id: 'make-it-yours', label: 'Make It Yours', num: 6 },
  { id: 'worm-traversal', label: 'Worm Run', num: 7 },
  { id: 'chaos-forecast', label: 'Call the Winner', num: 8 },
  { id: 'random-showcase', label: 'Surprise Cube', num: 9 },
  { id: 'cosmetic-reward', label: 'Spend Your Points', num: 10 },
  { id: 'end', label: 'Complete', num: 11 },
];

// Extra line held under a step's STEP COMPLETE stamp. Only the twin step has
// one: now that the player has felt two tiles move together, naming the formal
// concept costs nothing and rewards the curious.
const STEP_COMPLETE_NOTE = {
  'twin-paradox': TWIN_ASIDE,
};

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

    /* Flip tile is the middle (3rd of 5) slot, so its pointer sits dead centre. */
    .demo-spotlight-hint--flip::after {
      left: 50%;
    }

    /* Control tour: same card, but the pointer is aimed per beat at whichever
       of the five tiles is currently lit (--tour-pointer, set inline). */
    .demo-tour-card {
      animation: none;
      padding-top: 11px;
    }

    .demo-tour-card::after {
      left: var(--tour-pointer, 50%);
    }

    /* Views and More slide a sheet up over the bottom of the screen, so their
       beats move the card to the top and drop the pointer entirely. */
    .demo-tour-card--top {
      top: calc(max(10px, env(safe-area-inset-top, 10px)) + 46px);
      bottom: auto;
    }

    .demo-tour-card--top::after {
      display: none;
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

    /* Aside under the stamp (currently only the twin step's "antipodal pair"
       footnote) — quieter than the label, so it reads as trivia, not homework. */
    .demo-complete-note {
      margin: 14px auto 0;
      max-width: 300px;
      color: rgba(255, 253, 242, 0.82);
      font-size: 12.5px;
      font-weight: 600;
      line-height: 1.4;
      font-style: italic;
      animation: demo-complete-cta-in 0.5s ease 0.5s both;
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
      /* Phone bars are crowded: the pill sat on top of the mode label and the
         bar's icons. Drop it just below the bar instead of over it. */
      .demo-progress-pill {
        top: calc(var(--topbar-h, 44px) + env(safe-area-inset-top, 0px) + 6px);
        padding: 6px 12px;
        background: rgba(250, 247, 238, 0.92);
      }

      /* Everything else that stacks below the pill moves down with it. */
      .demo-coach-pill {
        top: calc(var(--topbar-h, 44px) + env(safe-area-inset-top, 0px) + 52px);
      }

      .demo-tour-card--top {
        top: calc(var(--topbar-h, 44px) + env(safe-area-inset-top, 0px) + 52px);
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

    /* Per-step hint — the one-line "here's the gesture" pill that sits above the
       bottom nav for the whole hands-on phase. Non-blocking: the nav bar, the
       cube and the coach pill all stay usable while it's up. */
    .demo-step-hint {
      position: fixed;
      left: 50%;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 92px);
      transform: translateX(-50%);
      z-index: 10900;
      width: min(340px, calc(100vw - 32px));
      padding: 9px 15px;
      border-radius: 14px;
      background: rgba(250, 247, 238, 0.94);
      border: 1px solid rgba(111, 126, 86, 0.25);
      box-shadow: 0 10px 26px rgba(40, 48, 32, 0.22);
      color: #26331f;
      font-family: ${UI_FONT};
      font-size: 12.5px;
      font-weight: 600;
      line-height: 1.38;
      text-align: center;
      pointer-events: none;
      animation: demo-worm-hint-in 0.4s ease both;
    }

    .demo-step-hint strong { font-weight: 800; color: #3f5730; }

    /* Flip-gateway progress pill — bottom-center, stacked above the step hint so
       both read at once. Shows how many front-face tiles are flipped (or
       restored) so the loop feels bounded. */
    .demo-flip-progress {
      position: fixed;
      left: 50%;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 148px);
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

// Step intro: Mobi delivers just the setup line over the blurred live scene.
// The hands-on guidance is surfaced by the staged UI (auto-played WATCH beat,
// progress pills, the coach's Next pill), so repeating it here read as Mobi
// talking twice — the intro stays to the single setup sentence.
const DemoStepIntro = ({ step, onContinue, onSkip }) => {
  const info = DEMO_STEPS.find(s => s.id === step);
  if (!info) return null;
  const lines = [STEP_COPY[step]].filter(Boolean);
  return (
    <MobiIntroScreen
      key={step}
      lines={lines}
      modeName={`Step ${info.num} · ${info.label}`}
      primaryLabel="▶ Start"
      onComplete={onContinue}
      skipLabel="Skip Step ▶"
      onSkip={onSkip}
      // The in-game top bar is up during the demo — keep the dialogue under it.
      topInset="var(--topbar-h)"
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
  // Guided sweep of the bottom bar. Staged on a scrambled 3×3 so the first two
  // buttons (Reset, Shuffle) visibly do something when pressed.
  'control-tour': {
    type: 'tour',
    cubeSize: 3,
    scrambleSequence: [
      { axis: 'row', sliceIndex: 0, dir: 1 },
      { axis: 'col', sliceIndex: 2, dir: -1 },
      { axis: 'row', sliceIndex: 2, dir: 1 },
    ],
  },
  'twin-paradox': {
    type: 'cube',
    cubeSize: 2,
    scrambleSequence: null,
    flipSequence: null,
    watch: { type: 'flip', tile: { x: 0, y: 0, z: 1, dirKey: 'PZ' } },
    features: { rotations: true, tunnels: true, flips: true },
    chaosLevel: 0,
    // Flip Mode is the switch that turns taps into twin travel, and it lives on
    // the bottom nav — so this step withholds it and asks the player to press it
    // themselves. The demo waits (with a timed fallback, see
    // FLIP_SPOTLIGHT_FALLBACK_MS) rather than flipping the switch for them.
    gateOnFlipToggle: true,
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
  // Opens the real Settings menu on the real cube. Completion is the player
  // closing it — whatever they changed in there survives the rest of the demo
  // and the exit back to the menu (see useDemoMode's settings bookkeeping).
  'make-it-yours': {
    type: 'settings',
    cubeSize: 3,
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
// After the WATCH beat auto-plays the mechanic, the player gets:
//   • a persistent hint pill (DemoStepHint) naming the exact gesture, and
//   • a compact "Next ▶" coach pill, so the demo can never hang.
// A step's presence in this map is what gives it a coach pill AND a hint, so
// keep every hands-on step listed. Copy rules: name the gesture, not the
// theory, and keep it to one breath — this pill has to read at a glance while
// the player's thumb is already on the cube.
const TRY_COPY = {
  'baby-cube': 'Drag across a row to twist it. Drag the space around the cube to spin the whole thing. Red <strong>Reset</strong> undoes the mess.',
  'twin-paradox': 'Tap any tile — the tile dead opposite it flips at the same moment.',
  'flip-gateway': 'Tap the front tiles to send them through the middle, then tap them again to bring them home.',
  'make-it-yours': 'Try the <strong>Colors</strong>, <strong>Tiles</strong> and <strong>Scene</strong> tabs. Close Settings when you like what you see.',
  'worm-traversal': 'Grab orbs, heal tiles, and dive through a glowing tunnel. Skip ahead anytime.',
  'chaos-forecast': 'Watch the pairs die off — yours has to be the last one standing.',
  'random-showcase': 'Every run rerolls the rules and the look. Skip when you have seen enough.',
};

// Coach: the guidance already played inside the step-intro dialogue and the hint
// pill names the gesture, so the default coach is just a compact "Next ▶" pill.
// Only a copy OVERRIDE (flip-gateway's second phase) brings Mobi back — that
// line is new info. Dismissing the override clears it in the hook (onCopySeen)
// rather than in local state, so the parent knows the blocking panel is gone and
// can put the bottom nav back.
const DemoCoach = ({ step, onNext, onExit, copy: copyOverride, onCopySeen }) => {
  ensureDemoShellStyle();
  const wormHealerMode = useGameStore((s) => s.wormHealerMode);
  if (!copyOverride && !TRY_COPY[step]) return null;

  if (copyOverride) {
    const info = DEMO_STEPS.find(s => s.id === step);
    return (
      <MobiIntroScreen
        key={copyOverride}
        lines={[copyOverride]}
        modeName={info ? `Step ${info.num} · ${info.label}` : 'Demo'}
        primaryLabel="▶ Got It"
        onComplete={() => onCopySeen?.()}
        skipLabel="Exit Demo"
        onSkip={onExit}
        topInset="var(--topbar-h)"
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

// Per-step gesture hint. Rendered for the whole hands-on phase of a step (the
// parent hides it behind blocking beats), so a player who looked away still has
// the instruction in front of them. Copy comes from TRY_COPY and may contain
// <strong> for the one word that names a button.
const DemoStepHint = ({ step }) => {
  ensureDemoShellStyle();
  const copy = TRY_COPY[step];
  if (!copy) return null;
  return (
    <div
      className="demo-step-hint"
      role="status"
      aria-live="polite"
      // TRY_COPY is authored in this file, never user input — the only markup is
      // <strong> around button names.
      dangerouslySetInnerHTML={{ __html: copy }}
    />
  );
};

// ── Control tour ─────────────────────────────────────────────────────────────
// One beat per bottom-bar button, in bar order. Each beat pulses its tile and
// waits for the player to press THAT tile — pressing it runs the button's real
// action, so the tour teaches by consequence rather than description (Reset
// visibly restores the scrambled cube, Shuffle re-scrambles it, Views and More
// slide their sheets up).
//
// `sheetBeat` marks the two beats whose button opens a bottom sheet: the caption
// card moves to the top of the screen for those, because the sheet fills the
// space it normally occupies.
//
// `slot` is the tile's 1-based position in the five-slot bar, used to aim the
// caption's pointer.
const CONTROL_TOUR_SEQUENCE = [
  {
    key: 'reset',
    slot: 1,
    title: 'Reset',
    copy: 'Puts the cube back exactly as you found it. Nothing you do here is unfixable — press it.',
  },
  {
    key: 'shuffle',
    slot: 2,
    title: 'Shuffle',
    copy: 'Mixes the cube up for a fresh puzzle whenever you want one. Give it a press.',
  },
  {
    key: 'flip',
    slot: 3,
    title: 'Flip',
    copy: 'The big one. With Flip on, tapping a tile sends it through the cube to its twin. Turn it on.',
  },
  {
    key: 'views',
    slot: 4,
    sheetBeat: true,
    title: 'Views',
    copy: 'Every look the cube can wear, plus Explode, Net and Hollow. Open it, have a look, then close it again.',
  },
  {
    key: 'more',
    slot: 5,
    sheetBeat: true,
    title: 'More',
    copy: 'Extra modes — and the two helpers: Solve does it for you, Teach shows you how. Open it, then close it to finish.',
  },
];

const CONTROL_TOUR_KEYS = CONTROL_TOUR_SEQUENCE.map((b) => b.key);

// Caption + pointer for one control-tour beat. Non-blocking apart from its own
// Skip button: the player has to reach the real button underneath it.
const DemoControlTour = ({ index, onSkip }) => {
  ensureDemoShellStyle();
  const beat = CONTROL_TOUR_SEQUENCE[index];
  if (!beat) return null;
  // Slots are evenly spaced around the middle tile (slot 3), one unit apart.
  const offset = beat.slot - 3;
  const pointer = offset === 0
    ? '50%'
    : `calc(50% ${offset < 0 ? '-' : '+'} ${Math.abs(offset)} * min(19vw, 76px))`;

  return (
    <div
      className={`demo-spotlight-hint demo-tour-card${beat.sheetBeat ? ' demo-tour-card--top' : ''}`}
      role="status"
      aria-live="polite"
      style={{ '--tour-pointer': pointer }}
    >
      <p className="demo-intro-step" style={{ marginBottom: 2 }}>
        {index + 1} / {CONTROL_TOUR_SEQUENCE.length}
      </p>
      <h3 className="demo-intro-title" style={{ fontSize: 'clamp(18px, 5vw, 24px)', marginBottom: 4 }}>
        {beat.title}
      </h3>
      <p className="demo-intro-copy" style={{ marginBottom: 8 }}>{beat.copy}</p>
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          aria-label="Skip the control tour"
          className="demo-intro-button"
          style={{ background: 'transparent', color: '#7b6f45', boxShadow: 'none', padding: '4px 12px' }}
        >
          Skip Tour ▶
        </button>
      )}
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
    copy: 'Guide lines on every face, so you can call out a tile by its row and column.',
    apply: (s) => s.setVisualMode('grid'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'sudokube',
    title: 'Sudoku',
    copy: 'Numbers instead of colors — every face has to end up with all nine, no repeats.',
    apply: (s) => s.setVisualMode('sudokube'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'wireframe',
    title: 'Wireframe',
    copy: 'Tiles stripped back to their outlines. Clean and minimal.',
    apply: (s) => s.setVisualMode('wireframe'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'glass',
    title: 'Glass',
    copy: 'See-through tiles, so you can look straight through the cube to the far side.',
    apply: (s) => s.setVisualMode('glass'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'chrome',
    title: 'Chrome',
    copy: 'Polished metal tiles that mirror whatever is around them.',
    apply: (s) => s.setVisualMode('chrome'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'neon',
    title: 'Neon',
    copy: 'Every tile edge lit up like a sign.',
    apply: (s) => s.setVisualMode('neon'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'gap',
    title: 'Gap',
    copy: 'Space between the tiles, so each one reads on its own.',
    apply: (s) => s.setVisualMode('gap'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'lego',
    title: 'Lego',
    copy: 'Every tile becomes a studded brick.',
    apply: (s) => s.setVisualMode('lego'),
    cleanup: (s) => s.setVisualMode('classic'),
  },
  {
    key: 'explode',
    title: 'Explode',
    copy: 'The faces float apart so you can see all six at once — including the ones facing away.',
    apply: (s) => s.setExploded(true),
    cleanup: (s) => s.setExploded(false),
  },
  {
    key: 'tunnels',
    title: 'Tunnels',
    copy: 'Here is the twin link made visible: send a tile through and a tunnel opens between it and the tile dead opposite. With the cube apart, you can watch it thread through the middle.',
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
    key: 'mirror',
    title: 'Far Side',
    copy: 'The little window watches the cube from exactly the opposite side. One tile is sent through here — find it in both pictures, and you are looking at one tile from two places at once.',
    // The strongest twin-teaching view in the game: main camera and the picture
    // -in-picture sit at opposite ends of the same line through the cube's
    // centre, so a flipped pair shows up in both at once. Stage one flip so
    // there is something to spot.
    apply: (s) => {
      s.setShowTunnels(true);
      s.setShowAntipodalPiP(true);
      const mid = Math.floor(s.size / 2);
      const map = buildManifoldGridMap(s.cubies, s.size);
      s.setRotatedCubies(flipStickerPair(s.cubies, s.size, mid, mid, s.size - 1, 'PZ', map));
    },
    cleanup: (s) => {
      s.setShowAntipodalPiP(false);
      s.setShowTunnels(false);
      s.setRotatedCubies(makeCubies(s.size));
    },
  },
  {
    key: 'hollow',
    title: 'Hollow',
    copy: 'The inside is gone — only the shell is left, so you can see right through the middle.',
    apply: (s) => s.setHollowMode(true),
    cleanup: (s) => s.setHollowMode(false),
  },
  {
    key: 'net',
    title: 'Net',
    copy: 'The cube unfolded flat, like a paper craft template. Handy for spotting patterns across faces.',
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
        {STEP_COMPLETE_NOTE[step] && (
          <p className="demo-complete-note">{STEP_COMPLETE_NOTE[step]}</p>
        )}
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

// Shown at the top of the twin step: the Flip tile on the bottom nav pulses
// (see BottomNavBar `spotlightFlip`) and this hint asks for the tap that arms
// tile-flipping. The demo deliberately does not flip this switch for the
// player — knowing where Flip Mode lives is the difference between "the demo
// did something" and "I can do that again".
const DemoFlipSpotlightHint = ({ onSkip }) => {
  ensureDemoShellStyle();
  return (
    <div className="demo-spotlight-hint demo-spotlight-hint--flip" role="status" aria-live="polite">
      <p className="demo-intro-copy" style={{ marginBottom: 8 }}>
        Tap the glowing <strong>Flip</strong> button below to arm tile-flipping.
      </p>
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          aria-label="Turn on flip mode for me"
          className="demo-intro-button"
          style={{ background: 'transparent', color: '#7b6f45', boxShadow: 'none', padding: '4px 12px' }}
        >
          Do It For Me ▶
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

// Flip-gateway progress: a bounded count of how many tile pairs have been sent
// through ("flip-all") or brought home ("unflip-all"), so the tap loop reads as
// a short task with a finish line rather than an open-ended chore.
const DemoFlipProgress = ({ progress }) => {
  ensureDemoShellStyle();
  if (!progress) return null;
  const { phase, done, total } = progress;
  const label = phase === 'unflip-all' ? 'Home' : 'Sent Through';
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
  DemoStepHint,
  DemoControlTour,
  CONTROL_TOUR_SEQUENCE,
  CONTROL_TOUR_KEYS,
  DemoViewShowcase,
  DemoViewSpotlightHint,
  DemoFlipSpotlightHint,
  DemoWormControlHint,
  DemoFlipProgress,
  DemoStepComplete,
  DemoStepLaunch,
  DemoRewardStamp,
  VIEW_SHOWCASE_SEQUENCE,
  TRY_COPY,
  STEP_COMPLETE_NOTE,
  DEMO_STEPS,
  DEMO_LEVEL_CONFIGS
};
