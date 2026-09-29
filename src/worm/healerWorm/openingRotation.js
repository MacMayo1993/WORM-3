// Opening turns use the render clock: a slow first frame or a resumed tab must
// not consume an entire turn before the player has seen it move.
export function createOpeningTurn(size, complete) {
  return { elapsed: 0, duration: 0.22 + Math.min(13, Math.max(0, size - 2)) * 0.01,
    started: false, complete };
}

export function advanceOpeningTurn(turn, delta) {
  if (!turn.started) {
    turn.started = true;
    return 0;
  }
  turn.elapsed = Math.min(turn.duration, turn.elapsed + Math.min(1 / 30, Math.max(0, delta)));
  if (turn.duration - turn.elapsed < 1e-9) turn.elapsed = turn.duration;
  const t = turn.elapsed / turn.duration;
  // Monotonic, zero velocity at both ends; never overshoots the cube lattice.
  return t * t * (3 - 2 * t);
}

export const OPENING_FOV = 55;

export function openingCameraDistance(size, aspect) {
  const vertical = OPENING_FOV * Math.PI / 360;
  const horizontal = Math.atan(Math.tan(vertical) * Math.max(0.1, aspect));
  // A quarter-turn preserves each corner's radius. Fit that enclosing sphere,
  // including a small sticker allowance, with a 12% margin on the narrower axis.
  const radius = Math.sqrt(3) * (size / 2 + 0.04);
  return radius / Math.sin(Math.min(vertical, horizontal)) * 1.12;
}
