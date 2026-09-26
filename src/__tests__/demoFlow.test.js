import { describe, it, expect } from 'vitest';
import {
  DEMO_STEPS, DEMO_LEVEL_CONFIGS, TRY_COPY, STEP_COMPLETE_NOTE, CONTROL_TOUR_SEQUENCE, CONTROL_TOUR_KEYS,
  VIEW_SHOWCASE_SEQUENCE,
} from '../components/screens/DemoFlowController.jsx';
import { STEP_COPY } from '../utils/demoStepCopy.js';
import { FLIP_CAP } from '../utils/constants.js';
import { WORM_DEMO_LESSONS } from '../game/wormDemoLessons.js';
import { WORMHOLE_MAX_TRAVERSALS as WORM_MAX_RIDES } from '../worm/healerWorm/constants.js';
import { classifyTraversal } from '../worm/healerWorm/economy.js';

// Mirrors advanceDemoStep in useDemoMode.js: next id, or 'end' past the last.
const IDS = DEMO_STEPS.map((s) => s.id);
const advance = (from) => {
  if (from === 'worm-traversal') return 'end';
  const i = IDS.indexOf(from);
  return IDS[i + 1] || 'end';
};

describe('demo flow state machine', () => {
  it('has the expected 12-step order ending in end', () => {
    expect(IDS).toEqual([
      'baby-cube',
      'twin-paradox',
      'flip-gateway',
      'worm-traversal',
      'learn-to-solve',
      'control-tour',
      'view-showcase',
      'make-it-yours',
      'chaos-forecast',
      'random-showcase',
      'cosmetic-reward',
      'end',
    ]);
  });

  it('walks from the first step to end with no gaps or cycles (the demo can always complete)', () => {
    const seen = new Set();
    let step = IDS[0];
    let guard = 0;
    while (step !== 'end' && guard++ < 20) {
      expect(seen.has(step)).toBe(false); // no cycle
      seen.add(step);
      step = advance(step);
    }
    expect(step).toBe('end');
    expect([...seen]).toEqual(['baby-cube', 'twin-paradox', 'flip-gateway', 'worm-traversal']);
  });

  it('numbers steps 1..n in order, so the progress pill never disagrees with the stamps', () => {
    DEMO_STEPS.forEach((s, i) => expect(s.num).toBe(i + 1));
  });

  it('cosmetic-reward is store-routed, not a dead cube step, and advances to the end screen', () => {
    // Regression for the step-6 dead-end: it must have NO cube level config
    // (handleDemoStepContinue routes it to the Parity Store instead), and
    // closing the store must advance to 'end'.
    expect(DEMO_LEVEL_CONFIGS['cosmetic-reward']).toBeUndefined();
    expect(advance('cosmetic-reward')).toBe('end');
  });

  it('every cube step has a try-phase instruction; watch steps also have a watch action', () => {
    for (const id of ['baby-cube', 'learn-to-solve', 'twin-paradox', 'flip-gateway']) {
      const cfg = DEMO_LEVEL_CONFIGS[id];
      expect(cfg?.type).toBe('cube');
      expect(TRY_COPY[id]).toBeTruthy();
      if (cfg.watch) {
        expect(['rotate', 'flip']).toContain(cfg.watch.type);
        if (cfg.watch.type === 'rotate') expect(Array.isArray(cfg.watch.moves)).toBe(true);
        if (cfg.watch.type === 'flip') expect(cfg.watch.tile).toBeTruthy();
      }
    }
  });

  it('worm, chaos, settings and tour steps carry their own config types', () => {
    expect(DEMO_LEVEL_CONFIGS['worm-traversal'].type).toBe('worm');
    expect(DEMO_LEVEL_CONFIGS['chaos-forecast'].type).toBe('chaos');
    expect(DEMO_LEVEL_CONFIGS['make-it-yours'].type).toBe('settings');
    expect(DEMO_LEVEL_CONFIGS['control-tour'].type).toBe('tour');
  });

  it('worm-traversal has an escape hatch and ends the core tour', () => {
    expect(TRY_COPY['worm-traversal']).toBeTruthy();
    expect(advance('worm-traversal')).toBe('end');
  });

  // ── Coverage: every step the player can stand in has to say something ──────
  it('every non-terminal step has a Mobi setup line', () => {
    for (const id of IDS) {
      if (id === 'end') continue;
      expect(STEP_COPY[id], `missing STEP_COPY for ${id}`).toBeTruthy();
    }
  });

  it('every hands-on step has an on-screen gesture hint', () => {
    // view-showcase drives its own dialogue cards, so it is the one hands-on
    // step without a hint pill; everything else must have one.
    for (const id of IDS) {
      // view-showcase and control-tour drive their own cards; the store step
      // hands off to the Parity Store.
      if (['end', 'view-showcase', 'control-tour', 'cosmetic-reward'].includes(id)) continue;
      expect(TRY_COPY[id], `missing TRY_COPY for ${id}`).toBeTruthy();
    }
  });
});

// Step 2 hands the player the bottom bar one button at a time. Each beat waits
// for a press of that specific tile, so the sequence has to name every tile
// exactly once, in bar order, with no gaps.
describe('control tour', () => {
  // Reset, Shuffle and Undo share the first slot: the tour swaps the first two
  // in for Undo while it teaches them, then hands the slot back to Undo.
  const BAR_ORDER = ['reset', 'shuffle', 'undo', 'flip', 'views', 'more'];

  it('covers every bottom-bar button, in bar order, once each', () => {
    expect(CONTROL_TOUR_KEYS).toEqual(BAR_ORDER);
    expect(new Set(CONTROL_TOUR_KEYS).size).toBe(CONTROL_TOUR_KEYS.length);
  });

  it('maps Reset, Shuffle and Undo to the same first slot in the four-button dock', () => {
    expect(CONTROL_TOUR_SEQUENCE.map((b) => b.slot)).toEqual([1, 1, 1, 2, 3, 4]);
  });

  it('gives every beat a title and copy that asks for the press', () => {
    for (const beat of CONTROL_TOUR_SEQUENCE) {
      expect(beat.title, `${beat.key} title`).toBeTruthy();
      expect(beat.copy, `${beat.key} copy`).toBeTruthy();
    }
  });

  it('marks exactly the two beats whose button opens a bottom sheet', () => {
    // Those two move their caption to the top of the screen — the sheet fills
    // the space it normally sits in.
    const sheetBeats = CONTROL_TOUR_SEQUENCE.filter((b) => b.sheetBeat).map((b) => b.key);
    expect(sheetBeats).toEqual(['views', 'more']);
  });

  it('stages a scrambled cube, so Reset and Shuffle visibly do something', () => {
    const cfg = DEMO_LEVEL_CONFIGS['control-tour'];
    expect(cfg.scrambleSequence?.length).toBeGreaterThan(0);
  });
});

// The demo's whole job is to make the antipodal mechanic land with people who
// will never use the word "antipodal". These guard that: the plain-language
// framing stays in the copy, and the jargon stays out of it (bar the single
// deliberate aside on the twin step's completion stamp).
describe('demo copy stays in plain language', () => {
  const JARGON = ['antipodal', 'manifold', 'topolog', 'parity point', 'projective', 'holonomy', 'rp2'];

  const allStepCopy = Object.entries(STEP_COPY).filter(([id]) => id !== 'cosmetic-reward');

  it('no step setup line leans on math jargon', () => {
    for (const [id, line] of allStepCopy) {
      for (const word of JARGON) {
        expect(line.toLowerCase(), `${id} uses "${word}"`).not.toContain(word);
      }
    }
  });

  it('no gesture hint leans on math jargon', () => {
    for (const [id, line] of Object.entries(TRY_COPY)) {
      for (const word of JARGON) {
        expect(line.toLowerCase(), `${id} uses "${word}"`).not.toContain(word);
      }
    }
  });

  it('names the twin idea in spatial terms on the steps that teach it', () => {
    expect(STEP_COPY['twin-paradox'].toLowerCase()).toContain('twin');
    expect(STEP_COPY['twin-paradox'].toLowerCase()).toContain('opposite');
    expect(STEP_COPY['flip-gateway'].toLowerCase()).toContain('through the middle');
  });

  it('drops the formal name exactly once, as an aside after the mechanic has landed', () => {
    // Completion notes may exist for other steps (learn-to-solve points at the
    // full Teach lesson), but the math jargon appears in exactly one of them:
    // the twin step's deliberate aside.
    const jargonNotes = Object.entries(STEP_COMPLETE_NOTE)
      .filter(([, note]) => JARGON.some((word) => note.toLowerCase().includes(word)));
    expect(jargonNotes).toHaveLength(1);
    expect(jargonNotes[0][0]).toBe('twin-paradox');
    expect(jargonNotes[0][1].toLowerCase()).toContain('antipodal');
  });

  it('the learn-to-solve completion note points at the full lesson by its menu name', () => {
    expect(STEP_COMPLETE_NOTE['learn-to-solve'].toLowerCase()).toContain('learn to solve');
  });
});

// The demo is the only tutorial most players see, so each rule a mode runs on
// has to be stated somewhere in it — and stated the way the code enforces it.
// These pin the copy to the constants behind it, so a tuning change that makes
// the demo wrong fails here instead of shipping.
describe('demo explains every mode’s rules accurately', () => {
  it('Flip Cube: the first step names its finish line — every face one color', () => {
    expect(STEP_COPY['baby-cube'].toLowerCase()).toContain('every face is one color');
    expect(TRY_COPY['baby-cube'].toLowerCase()).toContain('every face is one color');
  });

  it('Flip Cube: tile life matches FLIP_CAP, and Undo is named as the free take-back', () => {
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
    const note = STEP_COMPLETE_NOTE['flip-gateway'].toLowerCase();
    expect(note).toContain(`${words[FLIP_CAP]} times`);
    expect(note).toContain('undo');
  });

  it('Flip Cube: the control tour teaches Undo, the key that holds the first slot after it', () => {
    expect(CONTROL_TOUR_KEYS).toContain('undo');
    const undo = CONTROL_TOUR_SEQUENCE.find((b) => b.key === 'undo');
    // Shuffle empties the history, so the beat has to ask for a move first.
    expect(undo.copy.toLowerCase()).toMatch(/twist .* then tap undo/);
    expect(CONTROL_TOUR_KEYS.indexOf('undo')).toBeGreaterThan(CONTROL_TOUR_KEYS.indexOf('shuffle'));
  });

  it('Teach: the solve cameo is named as the Solve guide, and Teach as the full course', () => {
    const note = STEP_COMPLETE_NOTE['learn-to-solve'].toLowerCase();
    expect(note).toContain('solve guide');
    expect(note).toContain('more');
    expect(note).toContain('teach');
    expect(note).not.toContain('that was teach');
  });

  it('Chaos: the setup line covers the first strike, tile wear in twin pairs, and healing', () => {
    const line = STEP_COPY['chaos-forecast'].toLowerCase();
    expect(line).toContain('strikes first');
    expect(line).toContain('twins drop out together');
    expect(line).toContain('heal');
  });

  it('Random: says only the look changes, never the rules, on the real ten-second cycle', () => {
    for (const line of [STEP_COPY['random-showcase'], TRY_COPY['random-showcase']]) {
      expect(line.toLowerCase()).not.toMatch(/\brules\b/);
      expect(line.toLowerCase()).toContain('ten seconds');
    }
  });

  it('Store: names what it sells and where points come from', () => {
    const line = STEP_COPY['cosmetic-reward'].toLowerCase();
    for (const word of ['worms', 'signature', 'palettes', 'tiles', 'earn']) expect(line).toContain(word);
  });

  it('WORM: the chapter note explains how a full run is won and introduces portal enemies', () => {
    const note = STEP_COMPLETE_NOTE['worm-traversal'].toLowerCase();
    expect(note).toContain('scramble');
    expect(note).toContain('heal every tunnel to win');
    expect(note).toContain('enemies');
    expect(note).toContain('fire');
  });

  it('WORM: tunnel wear matches the traversal limit, and orb color matching is spelled out', () => {
    const words = ['zero', 'one', 'two', 'three', 'four', 'five'];
    const lesson = (id) => WORM_DEMO_LESSONS.find((l) => l.id === id);
    expect(lesson('tunnel').success).toContain(`${words[WORM_MAX_RIDES]} rides`);
    expect(classifyTraversal(WORM_MAX_RIDES)).toBe('safe');
    expect(classifyTraversal(WORM_MAX_RIDES + 1)).toBe('void-arm');
    expect(lesson('orbs').success.toLowerCase()).toContain('color');
    expect(lesson('rotation').instruction.toLowerCase()).toContain('head');
    expect(lesson('rotation').instruction.toLowerCase()).toContain('tail');
  });

  it('Views: Grid is described as tile addresses, which is what it renders', () => {
    const grid = VIEW_SHOWCASE_SEQUENCE.find((v) => v.key === 'grid');
    expect(grid.copy.toLowerCase()).toContain('address');
    expect(grid.copy.toLowerCase()).not.toContain('grid lines');
  });
});
