import { expect, it } from 'vitest';
import { BLAST_LIFE, blastFrame } from '../worm/healerWorm/blastVisuals.js';

it('ignites at the hit, grows a shock wave, then cools to smoke', () => {
    const hit = blastFrame(0);
    expect(hit.heat).toBeGreaterThan(0.9);
    expect(hit.waveAlpha).toBeGreaterThan(0.9);
    const after = blastFrame(0.26);
    expect(after.plume).toBeGreaterThan(hit.plume);
    expect(after.wave).toBeGreaterThan(hit.wave);
    expect(after.heat).toBeLessThan(hit.heat);
    expect(after.smoke).toBeGreaterThan(0);
    expect(blastFrame(0.71).waveAlpha).toBe(0);
    expect(blastFrame(BLAST_LIFE)).toBeNull();
});

it('respects delayed ignition and preserves a still hit cue in Reduced Motion', () => {
    expect(blastFrame(0.09, 0.10)).toBeNull();
    expect(blastFrame(0.10, 0.10).heat).toBe(blastFrame(0).heat);
    const initial = blastFrame(0, 0, true);
    const later = blastFrame(0.25, 0, true);
    expect(later.wave).toBe(initial.wave);
    expect(later.plume).toBe(initial.plume);
    expect(later.smoke).toBe(0);
    expect(initial.heat).toBeGreaterThan(0);
});
