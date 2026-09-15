import { BufferGeometry, Float32BufferAttribute } from 'three';

const random = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const MEADOW_SEGMENTS = 5;

// Small, irregular fans of leaves, distributed across the tile instead of seven
// identical clumps around a conspicuously empty centre. No gameplay RNG consumed.
export function meadowBlade(index, count) {
  const tuft = Math.floor(index / 5);
  const angle = tuft * 2.399963;
  const radius = Math.sqrt((tuft + 0.5) / Math.ceil(count / 5)) * 0.37;
  const x = Math.cos(angle) * radius + (random(index + 10) - 0.5) * 0.07;
  const y = Math.sin(angle) * radius + (random(index + 40) - 0.5) * 0.07;
  const rim = Math.min(1, Math.hypot(x, y) / 0.35);
  const broad = index % 9 === 0;
  return {
    x, y, broad,
    height: (0.13 + random(index + 70) * 0.19) * (0.65 + rim * 0.35),
    width: broad ? 0.025 + random(index + 90) * 0.012 : 0.009 + random(index + 90) * 0.009,
    angle: angle + (index % 5) * 1.2566 + (random(index + 120) - 0.5) * 0.7,
    bend: 0.22 + random(index + 160) * 0.40,
    tint: random(index + 200)
  };
}

export function buildMeadowGeometry(count = 88) {
  const positions = [], roots = [], bladeData = [], indices = [];
  for (let i = 0; i < count; i++) {
    const b = meadowBlade(i, count);
    const base = positions.length / 3;
    const ca = Math.cos(b.angle), sa = Math.sin(b.angle);
    for (let row = 0; row <= MEADOW_SEGMENTS; row++) {
      const t = row / MEADOW_SEGMENTS;
      // Pointed geometry, not transparent rectangular cards. The centre column
      // forms a shallow fold that catches light as the leaf turns in the wind.
      const profile = Math.pow(Math.sin(Math.PI * (0.08 + t * 0.92)), b.broad ? 0.65 : 0.9);
      for (const side of [-1, 0, 1]) {
        const width = side * b.width * profile;
        const bend = b.height * b.bend * t * t;
        const fold = (1 - Math.abs(side)) * b.width * profile * 0.38;
        positions.push(b.x + ca * width - sa * bend, b.y + sa * width + ca * bend,
          0.004 + b.height * (t - b.bend * 0.25 * t * t) + fold * t);
        roots.push(b.x, b.y);
        bladeData.push(t, side, b.tint);
      }
    }
    for (let row = 0; row < MEADOW_SEGMENTS; row++) for (let col = 0; col < 2; col++) {
      const a = base + row * 3 + col, b = a + 3;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('aRoot', new Float32BufferAttribute(roots, 2));
  geo.setAttribute('aBlade', new Float32BufferAttribute(bladeData, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
