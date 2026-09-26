// A spaced field of independent, slowly tumbling cubes beyond the camera.
import { maxCameraDistance } from './cameraLimits.js';
import { COLOR_SCHEMES } from '../utils/colorSchemes.js';

export const AMBIENCE_STYLES = ['classic', 'glass', 'neon', 'lego', 'chrome', 'wireframe', 'grid', 'gap'];
export const AMBIENCE_PALETTES = Object.keys(COLOR_SCHEMES).filter(key => key !== 'biome');
export const AMBIENCE_QUALITY = { full: { cubes: 40 }, reduced: { cubes: 16 } };

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
function shuffle(values, rand) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export const ambienceRadius = size => maxCameraDistance(size) * 1.3 + 12;

export function ambienceLayout(size = 3, quality = 'full', seed = 0x57a3) {
  const rand = mulberry32(seed + size * 101), radius = ambienceRadius(size);
  // Shuffle a deck, rather than independently rolling duplicates. Every cube
  // owns one palette and one style; the first row already covers all styles.
  const styles = shuffle(AMBIENCE_STYLES, rand);
  const palettes = shuffle(AMBIENCE_PALETTES, rand);
  const slots = shuffle(Array.from({ length: 40 }, (_, i) => i), rand);
  const rotation = rand() * Math.PI * 2;
  const cubes = slots.map((slot, i) => {
    // A jittered Fibonacci sphere keeps neighbours apart. Shared slow sky
    // rotation preserves that spacing; independent radial bob and spin add life.
    const y = 1 - 2 * (slot + .5) / 40;
    const angle = slot * Math.PI * (3 - Math.sqrt(5)) + rotation + (rand() - .5) * .08;
    const ring = Math.sqrt(1 - y * y);
    return {
      id: slot, direction: [ring * Math.cos(angle), y, ring * Math.sin(angle)],
      radius: radius * (1.05 + rand() * .3),
      phase: rand() * Math.PI * 2, speed: .008,
      spin: [rand() - .5, rand() - .5, rand() - .5].map(x => x * .22),
      scale: radius * (.030 + rand() * .022),
      palette: palettes[i % palettes.length],
      style: styles[i % styles.length],
    };
  });
  return { radius, cubes: cubes.slice(0, (AMBIENCE_QUALITY[quality] ?? AMBIENCE_QUALITY.full).cubes) };
}

export function cubePositionAt(cube, t, out = [0, 0, 0]) {
  const angle = cube.speed * t, c = Math.cos(angle), s = Math.sin(angle);
  const r = cube.radius * (1 + .015 * Math.sin(t * .12 + cube.phase));
  const [x, y, z] = cube.direction;
  out[0] = (x * c - z * s) * r;
  out[1] = y * r;
  out[2] = (x * s + z * c) * r;
  return out;
}
