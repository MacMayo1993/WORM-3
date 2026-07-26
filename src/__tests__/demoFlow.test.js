import { describe, it, expect } from 'vitest';
import { DEMO_STEPS, DEMO_LEVEL_CONFIGS, TRY_COPY, STEP_COMPLETE_NOTE } from '../components/screens/DemoFlowController.jsx';
import { STEP_COPY } from '../utils/demoStepCopy.js';

// Mirrors advanceDemoStep in useDemoMode.js: next id, or 'end' past the last.
const IDS = DEMO_STEPS.map((s) => s.id);
const advance = (from) => {
  const i = IDS.indexOf(from);
  return IDS[i + 1] || 'end';
};

describe('demo flow state machine', () => {
  it('has the expected 10-step order ending in end', () => {
    expect(IDS).toEqual([
      'baby-cube',
      'twin-paradox',
      'flip-gateway',
      'view-showcase',
      'make-it-yours',
      'worm-traversal',
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
    // every non-terminal step was visited on the way
    expect(seen.size).toBe(IDS.length - 1);
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
    for (const id of ['baby-cube', 'twin-paradox', 'flip-gateway']) {
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

  it('worm, chaos and settings steps carry their own config types', () => {
    expect(DEMO_LEVEL_CONFIGS['worm-traversal'].type).toBe('worm');
    expect(DEMO_LEVEL_CONFIGS['chaos-forecast'].type).toBe('chaos');
    expect(DEMO_LEVEL_CONFIGS['make-it-yours'].type).toBe('settings');
  });

  it('worm-traversal is skippable via the coach (has TRY_COPY + advances on death or solved)', () => {
    expect(TRY_COPY['worm-traversal']).toBeTruthy();
    expect(advance('worm-traversal')).toBe('chaos-forecast');
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
      if (id === 'end' || id === 'view-showcase' || id === 'cosmetic-reward') continue;
      expect(TRY_COPY[id], `missing TRY_COPY for ${id}`).toBeTruthy();
    }
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
    const notes = Object.entries(STEP_COMPLETE_NOTE);
    expect(notes).toHaveLength(1);
    const [step, note] = notes[0];
    expect(step).toBe('twin-paradox');
    expect(note.toLowerCase()).toContain('antipodal');
  });
});
