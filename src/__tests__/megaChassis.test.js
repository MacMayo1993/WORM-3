import { describe, it, expect } from 'vitest';
import { megaChassisLayout, MEGA_CHASSIS_INSET } from '../3d/megaChassis.js';
import { STICKER_POS } from '../3d/stickerFrames.js';
import { PRESS_DEPTH } from '../worm/tilePressVisual.js';

const N = 15, k = (N - 1) / 2, half = (N - MEGA_CHASSIS_INSET) / 2;
const span = (box, axisI) => [box.pos[axisI] - box.args[axisI] / 2, box.pos[axisI] + box.args[axisI] / 2];
const turn = (axis, layers, dirs = layers.map(() => 1)) =>
  ({ axis, dir: dirs[0], sliceIndex: layers[0], sliceIndices: layers, sliceDirs: dirs });

describe('Mega chassis', () => {
  it('is only built for Mega and is one box at rest', () => {
    expect(megaChassisLayout(10, null)).toBeNull();
    expect(megaChassisLayout(N, null)).toEqual({ rest: true, full: N - MEGA_CHASSIS_INSET });
  });

  // The worm presses its tile in by up to PRESS_DEPTH (with the spring's 12%
  // overshoot), so the chassis face must stay behind the deepest pressed sticker.
  it('stays behind a sticker the worm presses in', () => {
    const outermostSticker = k + STICKER_POS.PZ[2];
    expect(outermostSticker - PRESS_DEPTH * 1.12).toBeGreaterThan(half);
  });

  const cases = [
    ['a face', turn('col', [0])], ['the far face', turn('row', [N - 1])],
    ['an inner layer', turn('depth', [7])], ['two faces at once', turn('col', [0, N - 1], [1, -1])],
    ['a hazard pair', turn('row', [3, 11], [-1, 1])]
  ];
  it.each(cases)('keeps every piece of %s turn inside the resting box and tiles it exactly', (_label, animState) => {
    const layout = megaChassisLayout(N, animState);
    const { axisI } = layout;
    const pieces = [...layout.slabs, ...layout.bands].map(box => {
      for (const extent of box.args) expect(extent).toBeLessThanOrEqual(N - MEGA_CHASSIS_INSET + 1e-9);
      const [lo, hi] = span(box, axisI);
      expect(lo).toBeGreaterThanOrEqual(-half - 1e-9);
      expect(hi).toBeLessThanOrEqual(half + 1e-9);
      return [lo, hi];
    }).sort((a, b) => a[0] - b[0]);
    // Contiguous, no overlap, from one face of the box to the other.
    expect(pieces[0][0]).toBeCloseTo(-half, 9);
    expect(pieces[pieces.length - 1][1]).toBeCloseTo(half, 9);
    for (let i = 1; i < pieces.length; i++) expect(pieces[i][0]).toBeCloseTo(pieces[i - 1][1], 9);
    // Each band spins about the turn axis, so it is centred on that axis line.
    for (const band of layout.bands) {
      band.pos.forEach((value, i) => { if (i !== axisI) expect(value).toBe(0); });
    }
    expect(layout.bands.map(band => band.dir)).toEqual([...animState.sliceDirs].map((dir, i) => [dir, animState.sliceIndices[i]])
      .sort((a, b) => a[1] - b[1]).map(([dir]) => dir));
  });

  it('ends a face band at the resting box face, not the full layer', () => {
    const [band] = megaChassisLayout(N, turn('col', [0])).bands;
    const [lo, hi] = span(band, 0);
    expect(lo).toBeCloseTo(-half, 9);
    expect(hi).toBeCloseTo(0.5 - k, 9);
  });
});
