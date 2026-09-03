import { describe, it, expect } from 'vitest';
import { buildRimGeometry, EXPOSED, FACE_DEFS, EDGE_UV, QUAD_HALF, TILE_HALF } from '../teach/layerGlow.js';

// Four vertices and six indices per quad.
const quadCount = (geo) => geo.getAttribute('position').count / 4;

describe('buildRimGeometry', () => {
  it('covers every exposed face of the whole cube when no filter is given', () => {
    // 6 faces × size² tiles — the shell, with nothing double-counted and no
    // interior cubie contributing.
    for (const size of [2, 3, 5]) {
      const geo = buildRimGeometry(size);
      expect(quadCount(geo)).toBe(6 * size * size);
      geo.dispose();
    }
  });

  it('emits four vertices and two triangles per quad', () => {
    const geo = buildRimGeometry(3);
    const quads = quadCount(geo);
    expect(geo.getAttribute('uv').count).toBe(quads * 4);
    expect(geo.getAttribute('aPhase').count).toBe(quads * 4);
    expect(geo.getIndex().count).toBe(quads * 6);
    geo.dispose();
  });

  it('restricts to the requested cubies', () => {
    // One middle slice of a 3×3: 3 cubies, each showing 4 of the shell's faces
    // except the two on the slice's own outer ends, which show none extra.
    const slice = buildRimGeometry(3, { includeCubie: (x) => x === 1 });
    const whole = buildRimGeometry(3);
    expect(quadCount(slice)).toBeGreaterThan(0);
    expect(quadCount(slice)).toBeLessThan(quadCount(whole));

    // Nothing in the slice geometry belongs to a cubie the filter excluded:
    // every x=1 face centre sits within half a cubie of the x=0 plane.
    const pos = slice.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      expect(Math.abs(pos.getX(i))).toBeLessThanOrEqual(QUAD_HALF + 1e-6);
    }
    slice.dispose();
    whole.dispose();
  });

  it('excludes everything when the filter rejects every cubie', () => {
    const geo = buildRimGeometry(3, { includeCubie: () => false });
    expect(quadCount(geo)).toBe(0);
    expect(geo.getIndex().count).toBe(0);
    geo.dispose();
  });

  it('passes each face its grid coords and centre to phaseOf, and stores the result per vertex', () => {
    const seen = [];
    const geo = buildRimGeometry(2, {
      phaseOf: (ctx) => {
        seen.push(ctx);
        return 0.25;
      }
    });
    expect(seen).toHaveLength(quadCount(geo));
    for (const ctx of seen) {
      expect(FACE_DEFS[ctx.dirKey]).toBeDefined();
      expect(EXPOSED[ctx.dirKey](ctx.x, ctx.y, ctx.z, 2)).toBe(true);
      expect(Number.isFinite(ctx.fx + ctx.fy + ctx.fz)).toBe(true);
    }
    const phase = geo.getAttribute('aPhase');
    for (let i = 0; i < phase.count; i++) expect(phase.getX(i)).toBeCloseTo(0.25);
    geo.dispose();
  });

  it('defaults the phase to zero', () => {
    const geo = buildRimGeometry(2);
    const phase = geo.getAttribute('aPhase');
    for (let i = 0; i < phase.count; i++) expect(phase.getX(i)).toBe(0);
    geo.dispose();
  });

  it('places the tile outline inside the quad', () => {
    // EDGE_UV is where the shaders draw the filament. It has to land inside the
    // quad (< 0.5 in uv) or the outline falls off the geometry carrying it.
    expect(EDGE_UV).toBeLessThan(0.5);
    expect(EDGE_UV).toBeCloseTo(0.5 * (TILE_HALF / QUAD_HALF));
  });
});
