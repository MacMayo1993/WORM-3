// Geometry/submission accounting, not a frame-rate benchmark. Runs without GL.
// Reference: main 8c7a96c5's full 284-triangle sticker rendered in two transparent
// passes, plus its independently sorted two-triangle antipodal back.
//   node scripts/perf-worm/glass-cost.mjs
import { createPlayStickerGeometry } from '../../src/3d/rubiksPiece.js';
import { cubieBodyGeometry } from '../../src/3d/cubieBodyGeometry.js';
import { compactGlassGeometry } from '../../src/3d/glassViewQuality.js';

const triangles = g => (g.index?.count ?? g.attributes.position.count) / 3;
const full = createPlayStickerGeometry();
const compact = createPlayStickerGeometry(.85, 0, { bevelSegments: 1, curveSegments: 2 });
const result = {
  kind: 'structural submission counts, no GPU/frame-rate measurement',
  referenceCommit: '8c7a96c5',
  scope: 'all exterior glass stickers visible in one scene pass; excludes bodies, core, effects and other cameras',
  rows: [3, 7, 10, 15].map(size => {
    const tiles = 6 * size * size;
    const front = compactGlassGeometry(size, false, false) ? compact : full;
    return { size, tiles, beforeDraws: tiles * 3, afterDraws: tiles * 2,
      beforeTriangles: tiles * (triangles(full) * 2 + 2), afterTriangles: tiles * (triangles(front) + 2),
      mobileOrReducedTriangles: tiles * (triangles(compact) + 2) };
  }),
  roundedBodyTrianglesPerPass: { before: triangles(cubieBodyGeometry(.92)), compact: triangles(cubieBodyGeometry(.92, undefined, true)) },
};
console.log(JSON.stringify(result, null, 2));
full.dispose(); compact.dispose();
