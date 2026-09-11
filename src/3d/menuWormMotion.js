// Menu-only locomotion: bounded path history, distance-spaced followers, no game state.
const CAPACITY = 256;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const WAYPOINTS = [[0.52, 0.24], [-0.48, 0.28], [-0.5, -0.26], [0.5, -0.25]];
export function createMenuWormMotion() {
  const history = Array.from({ length: CAPACITY }, (_, i) => ({ x: 0.2 - i * 0.005, z: 0 }));
  return { x: 0.2, z: 0, heading: 0, distance: 0, cursor: 0, history, target: { x: 0.52, z: 0.24 }, wait: 0, waypoint: 0 };
}
export function aimMenuWorm(state, u, v) {
  state.target = { x: clamp((u - 0.5) * 1.8, -0.58, 0.58), z: clamp((v - 0.5) * 1.8 * Math.SQRT2, -0.3, 0.3) };
  state.wait = 0;
}
export function stepMenuWorm(state, delta) {
  const dt = clamp(delta, 0, 0.05);
  const dx = state.target.x - state.x, dz = state.target.z - state.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.07) {
    state.wait += dt;
    if (state.wait > 1.2) {
      state.waypoint = (state.waypoint + 1) % WAYPOINTS.length;
      const [x, z] = WAYPOINTS[state.waypoint];
      state.target = { x, z }; state.wait = 0;
    }
    return;
  }
  // Tighten turns at the edge before the head can run off its tabletop.
  let desired = Math.atan2(dz, dx) + Math.sin(state.distance * 19) * 0.24;
  if ((Math.abs(state.x) > 0.58 && state.x * Math.cos(state.heading) > 0) ||
      (Math.abs(state.z) > 0.3 && state.z * Math.sin(state.heading) > 0)) desired = Math.atan2(-state.z, -state.x);
  const turn = Math.atan2(Math.sin(desired - state.heading), Math.cos(desired - state.heading));
  state.heading += clamp(turn, -3.8 * dt, 3.8 * dt);
  const speed = 0.34 * Math.min(1, distance / 0.16) * (1 - Math.min(0.65, Math.abs(turn) / Math.PI));
  const x = clamp(state.x + Math.cos(state.heading) * speed * dt, -0.69, 0.69);
  const z = clamp(state.z + Math.sin(state.heading) * speed * dt, -0.43, 0.43);
  state.distance += Math.hypot(x - state.x, z - state.z);
  state.x = x; state.z = z;
  const last = state.history[state.cursor];
  if (Math.hypot(x - last.x, z - last.z) >= 0.004) {
    state.cursor = (state.cursor + CAPACITY - 1) % CAPACITY;
    state.history[state.cursor].x = x; state.history[state.cursor].z = z;
  }
}
export function menuWormSegment(state, index, out) {
  let remaining = index * 0.11;
  let x = state.x, z = state.z;
  let tx = Math.cos(state.heading), tz = Math.sin(state.heading);
  for (let j = 0; j < CAPACITY; j++) {
    const p = state.history[(state.cursor + j) % CAPACITY];
    const d = Math.hypot(x - p.x, z - p.z);
    if (d > 0 && remaining <= d) {
      tx = (x - p.x) / d; tz = (z - p.z) / d;
      x -= tx * remaining; z -= tz * remaining; break;
    }
    remaining -= d; x = p.x; z = p.z;
  }
  // A traveling lateral wave stays on the plane and freezes when travel stops.
  const wave = Math.sin(index * 1.2 - state.distance * 22) * 0.032 * Math.min(1, index / 2);
  out.set(x - tz * wave, 0.105, z + tx * wave);
  return out;
}
