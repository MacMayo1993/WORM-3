import { describe, it, expect } from 'vitest';
import { DEMO_STEPS, DEMO_LEVEL_CONFIGS, TRY_COPY } from '../components/screens/DemoFlowController.jsx';

// Mirrors advanceDemoStep in App.jsx: next id, or 'end' past the last.
const IDS = DEMO_STEPS.map((s) => s.id);
const advance = (from) => {
  const i = IDS.indexOf(from);
  return IDS[i + 1] || 'end';
};

describe('demo flow state machine', () => {
  it('has the expected 7-step order ending in end', () => {
    expect(IDS).toEqual([
      'baby-cube',
      'twin-paradox',
      'flip-gateway',
      'worm-traversal',
      'chaos-forecast',
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

  it('cosmetic-reward is store-routed, not a dead cube step, and advances to the end screen', () => {
    // Regression for the step-6 dead-end: it must have NO cube level config
    // (handleDemoStepContinue routes it to the Parity Store instead), and
    // closing the store must advance to 'end'.
    expect(DEMO_LEVEL_CONFIGS['cosmetic-reward']).toBeUndefined();
    expect(advance('cosmetic-reward')).toBe('end');
  });

  it('every cube step is hybrid: has a watch action AND a try-phase instruction', () => {
    for (const id of ['baby-cube', 'twin-paradox', 'flip-gateway']) {
      const cfg = DEMO_LEVEL_CONFIGS[id];
      expect(cfg?.type).toBe('cube');
      expect(cfg.watch).toBeTruthy();
      expect(['rotate', 'flip']).toContain(cfg.watch.type);
      if (cfg.watch.type === 'rotate') expect(Array.isArray(cfg.watch.moves)).toBe(true);
      if (cfg.watch.type === 'flip') expect(cfg.watch.tile).toBeTruthy();
      expect(TRY_COPY[id]).toBeTruthy();
    }
  });

  it('worm and chaos steps carry their own config types (they auto-advance, not via the coach)', () => {
    expect(DEMO_LEVEL_CONFIGS['worm-traversal'].type).toBe('worm');
    expect(DEMO_LEVEL_CONFIGS['chaos-forecast'].type).toBe('chaos');
  });
});
