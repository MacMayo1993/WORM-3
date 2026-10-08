import * as THREE from 'three';
import { CanvasLabel } from '../3d/NumberLabel.jsx';

// Every stroke, the half-tally and its dot are quads in ONE geometry, cached per
// (flip count, ink) and drawn with one shared material. They used to be a drei
// <Line> per stroke — its own geometry, material and draw each, rebuilt on every
// flip — and Chaos keeps a tally on every flipped tile, so a storm paid ~50 draws
// a frame and a geometry rebuild per flip for them.

// Drei's lines were 1.8 px wide on screen; at the play camera a tile spans about
// 90 px, so ~0.02 world units keeps the same weight.
const STROKE_W = 0.02;
const DARK_INK = '#1a1a1a';
const LIGHT_INK = '#ffffff';
const LIGHT_TILES = ['#ffffff', '#FFD500', '#f97316'];

const tallyMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, toneMapped: false });
const cache = new Map();
const _ink = new THREE.Color();

function tallyGeometry(flips, radius, dark) {
  const key = `${flips}|${radius}|${dark}`;
  let geo = cache.get(key);
  if (geo) return geo;

  // Each flip is a half-cycle through the antipodal tunnel; 2 flips = 1 tally.
  const fullTallies = Math.floor(flips / 2);
  const hasHalfTally = flips % 2 === 1;
  const baseScale = Math.min(radius * 1.4, 0.28);
  const lineHeight = baseScale * 0.7;
  const lineSpacing = baseScale * 0.18;
  const groupWidth = lineSpacing * 5;
  // Tallies come in sets of 5 (|||| with a diagonal); a lone half still gets a slot.
  const groups = Math.max(Math.ceil(fullTallies / 5), hasHalfTally ? 1 : 0);
  const startX = -(groups * groupWidth) / 2 + lineSpacing;

  const pos = [], col = [];
  _ink.set(dark ? DARK_INK : LIGHT_INK);
  const vert = (x, y, a) => { pos.push(x, y, 0); col.push(_ink.r, _ink.g, _ink.b, a); };
  const stroke = (x0, y0, x1, y1, w, a) => {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * w * 0.5, ny = (dx / l) * w * 0.5;
    vert(x0 + nx, y0 + ny, a); vert(x0 - nx, y0 - ny, a); vert(x1 + nx, y1 + ny, a);
    vert(x0 - nx, y0 - ny, a); vert(x1 - nx, y1 - ny, a); vert(x1 + nx, y1 + ny, a);
  };

  for (let g = 0, left = fullTallies; left > 0; g++, left -= 5) {
    const count = Math.min(left, 5);
    const gx = startX + g * groupWidth;
    for (let i = 0; i < count; i++) {
      const x = gx + i * lineSpacing;
      stroke(x, -lineHeight / 2, x, lineHeight / 2, STROKE_W, 0.9);
    }
    if (count === 5) {
      stroke(gx - lineSpacing * 0.3, -lineHeight / 2 - 0.01, gx + lineSpacing * 4.3, lineHeight / 2 + 0.01, STROKE_W, 0.9);
    }
  }
  if (hasHalfTally) {
    // A shorter, fainter stroke with a dot on top: a journey not yet completed.
    const x = startX + (fullTallies % 5) * lineSpacing + (fullTallies >= 5 ? Math.floor(fullTallies / 5) * groupWidth : 0);
    stroke(x, -lineHeight / 4, x, lineHeight / 4, STROKE_W * 0.8, 0.6);
    const cy = lineHeight / 4 + 0.02, r = 0.015, seg = 8;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      vert(x, cy, 0.6);
      vert(x + Math.cos(a0) * r, cy + Math.sin(a0) * r, 0.6);
      vert(x + Math.cos(a1) * r, cy + Math.sin(a1) * r, 0.6);
    }
  }

  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.computeBoundingSphere();
  cache.set(key, geo);
  return geo;
}

const TallyMarks = ({ flips, radius, origColor }) => {
  // Dark marks on light colours, light marks on dark colours.
  const dark = LIGHT_TILES.includes(origColor);
  if (flips <= 0) return null;
  return (
    <group position={[0, 0, 0.015]}>
      <mesh geometry={tallyGeometry(flips, radius, dark)} material={tallyMaterial} raycast={() => null} dispose={null} />
      {/* Show flip count as small text for higher counts (keeps marks within tile) */}
      {flips > 6 && (
        <CanvasLabel
          value={`×${flips}`}
          position={[0, -radius * 0.6, 0.005]}
          fontSize={0.06}
          color={dark ? DARK_INK : LIGHT_INK}
        />
      )}
    </group>
  );
};

export default TallyMarks;
