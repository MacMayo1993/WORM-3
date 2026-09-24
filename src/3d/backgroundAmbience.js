// backgroundAmbience.js — pure layout for the sky around the puzzle.
//
// Small Rubik's cubes tumble along slow great circles, and wormholes hang in
// the distance in antipodal twin pairs: each portal has a partner at exactly
// the opposite point of the sky, rimmed in its twin colour (red↔orange,
// green↔blue, white↔yellow) — the same pairing the cube's own tiles obey.
//
// Everything sits on a shell wider than the camera's maximum zoom-out for the
// current cube size, so no ambient object can ever pass between the camera and
// the puzzle. Seeded, so a given size always gets the same sky.
import { maxCameraDistance } from './cameraLimits.js';

// Face IDs → the twin pairs of the cube (1 red ↔ 4 orange, 2 green ↔ 5 blue,
// 3 white ↔ 6 yellow).
export const TWIN_FACE_PAIRS = [[1, 4], [2, 5], [3, 6]];

export const AMBIENCE_QUALITY = {
  // The view covers only ~7% of the sky, so a readable handful on screen at
  // once needs dozens in total. All cubes are one instanced draw.
  full: { cubes: 40, wormholePairs: 2 },
  reduced: { cubes: 16, wormholePairs: 1 },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const unit = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const randomDirection = rand => {
  const z = rand() * 2 - 1, t = rand() * Math.PI * 2, r = Math.sqrt(1 - z * z);
  return [r * Math.cos(t), z, r * Math.sin(t)];
};

/** Radius of the ambience shell for a cube size: clear of the farthest camera. */
export function ambienceRadius(size) {
  return maxCameraDistance(size) * 1.3 + 12;
}

export function ambienceLayout(size = 3, quality = 'full', seed = 0x57a3) {
  const counts = AMBIENCE_QUALITY[quality] ?? AMBIENCE_QUALITY.full;
  const rand = mulberry32(seed + size * 101);
  const radius = ambienceRadius(size);

  const cubes = Array.from({ length: counts.cubes }, () => {
    // A great circle through a random axis: u and v span its plane.
    const axis = unit(randomDirection(rand));
    const helper = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = unit(cross(axis, helper));
    const v = cross(axis, u);
    return {
      radius: radius * (1 + rand() * 0.35),
      u, v,
      phase: rand() * Math.PI * 2,
      // Radians per second along the orbit: a slow drift, either direction.
      speed: (0.006 + rand() * 0.01) * (rand() < 0.5 ? -1 : 1),
      spin: [rand() - 0.5, rand() - 0.5, rand() - 0.5].map(x => x * 0.5),
      scale: radius * (0.028 + rand() * 0.022),
    };
  });

  const wormholes = [];
  for (let i = 0; i < counts.wormholePairs; i++) {
    const [a, b] = TWIN_FACE_PAIRS[i % TWIN_FACE_PAIRS.length];
    // The first portal hangs behind the puzzle as the default camera sees it
    // (so its twin waits behind the player); later ones sit in the horizon
    // band, off the zenith and nadir.
    const dir = i === 0 ? unit([-0.42 + rand() * 0.2, 0.2 + rand() * 0.12, -1])
      : unit([rand() * 2 - 1, (rand() - 0.5) * 0.9, rand() * 2 - 1]);
    const r = radius * 1.35;
    const ring = radius * (0.1 + rand() * 0.04);
    const spin = 0.12 + rand() * 0.1;
    wormholes.push({ face: a, twin: b, position: dir.map(x => x * r), ring, spin });
    wormholes.push({ face: b, twin: a, position: dir.map(x => -x * r), ring, spin: -spin });
  }
  return { radius, cubes, wormholes };
}

/** Where a drifting cube is at time `t` (seconds). Writes into `out`. */
export function cubePositionAt(cube, t, out = [0, 0, 0]) {
  const angle = cube.phase + cube.speed * t;
  const c = Math.cos(angle) * cube.radius, s = Math.sin(angle) * cube.radius;
  out[0] = cube.u[0] * c + cube.v[0] * s;
  out[1] = cube.u[1] * c + cube.v[1] * s;
  out[2] = cube.u[2] * c + cube.v[2] * s;
  return out;
}
