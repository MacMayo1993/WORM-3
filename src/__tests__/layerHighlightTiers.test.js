// The rim ships as two programs. A 15×15 warning shades 225 tiles per threatened
// plane at 1.7× the tile footprint each, additively, for the whole ten-second
// cycle and sometimes on two planes at once — three octaves of value noise per
// fragment on top of that is what took Mega's frame rate apart. The lite program
// keeps everything the player reads (the filament, the halo, the sweep that says
// which way the layer goes) and drops the noise.

import { describe, it, expect } from 'vitest';
import { rimFragmentShader } from '../teach/LayerHighlight.jsx';

describe('layer rim programs', () => {
  const full = rimFragmentShader(false);
  const lite = rimFragmentShader(true);

  it('keeps the noise out of the lite program entirely', () => {
    expect(full).toContain('fbm(');
    expect(lite).not.toContain('fbm(');
    expect(lite).not.toContain('vnoise');
  });

  it('still says which layer and which way in lite', () => {
    // The sweep (uDir-driven) is the direction cue; the filament is the layer cue.
    for (const src of [full, lite]) {
      expect(src).toContain('uDir');
      expect(src).toContain('float line');
      expect(src).toContain('uGain');
    }
  });

  it('leaves the solver\'s hint on the full program', () => {
    // Nothing but an explicit lite flag may drop the noise — the teaching mode
    // draws one rim on a 3×3 and should look exactly as it always has.
    expect(rimFragmentShader()).toContain('fbm(');
  });
});
