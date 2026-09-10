// Stable clusters for the Nature wash. No simulation state or random stream is touched.
const random = (seed, index) => {
  const n = Math.sin(seed * 17.31 + index * 78.233) * 43758.5453;
  return n - Math.floor(n);
};
export function natureBlade(seed, index) {
  const cluster = index % 7;
  const angle = random(seed, cluster + 1) * Math.PI * 2;
  const radius = 0.26 + random(seed, cluster + 20) * 0.08;
  let x = Math.cos(angle) * radius + (random(seed, index + 101) - 0.5) * 0.12;
  let y = Math.sin(angle) * radius + (random(seed, index + 401) - 0.5) * 0.12;
  const rim = Math.max(Math.abs(x), Math.abs(y));
  if (rim < 0.19) { const scale = 0.19 / Math.max(rim, 0.001); x *= scale; y *= scale; }
  return {
    x: Math.max(-0.38, Math.min(0.38, x)),
    y: Math.max(-0.38, Math.min(0.38, y)),
    height: 0.08 + 0.16 * random(seed, index + 701),
    width: 0.65 + 0.65 * random(seed, index + 901),
    angle: random(seed, index + 1101) * Math.PI
  };
}
