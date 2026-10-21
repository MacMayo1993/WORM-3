// ── Mega Mode chassis geometry ────────────────────────────────────────────────
// A single 15×15 shell would cost >1,100 individual rounded bodies, so Mega
// backs its sticker grid with one dark box instead. At rest that box is fine,
// but a static box CANNOT back a *rotating* slice: its corners reach
// √2·(size/2) ≈ 10.5 from centre, so a side-sticker sweeping at radius ~7.5
// dips inside the solid box around 45° and is occluded. During a turn the box is
// carved into the stationary slabs on either side of each rotating band plus one
// band box per plane that spins WITH its slice, so the swept tiles always stay in
// front of it.
//
// Every piece stays inside the resting box's own extent, `full` (a hairline under
// the cube). A face layer's band used to reach the full layer, ±size/2: its outer
// face sat 0.01 under a flat sticker (STICKER_POS, 0.51 from the cubie's centre)
// and in front of a tile the worm presses (tilePressVisual.js sinks it up to
// ~0.036), so the worm's own tiles, and at grazing angles the whole turning face,
// drew black for the length of every face turn.
//
// Pure: no Three imports, so tests hold the layout.

/** The chassis stops this far inside the cube on each axis (a hairline at the edges). */
export const MEGA_CHASSIS_INSET = 0.08;
export const MEGA_SIZE = 15;

/**
 * The chassis boxes for a Mega cube at rest (`animState` null) or mid-turn.
 * Rest: { rest: true, full }. Turn: { rest: false, axisI, bands, slabs }, each box
 * `{ args: [w, h, d], pos: [x, y, z] }`; bands also carry their plane's `dir`.
 */
export function megaChassisLayout(size, animState) {
  if (size < MEGA_SIZE) return null;
  const full = size - MEGA_CHASSIS_INSET;
  const half = full / 2;
  if (!animState) return { rest: true, full };
  const axisI = animState.axis === 'col' ? 0 : animState.axis === 'row' ? 1 : 2;
  const k = (size - 1) / 2;
  const layers = animState.sliceIndices?.length ? animState.sliceIndices : [animState.sliceIndex];
  const dirs = animState.sliceDirs?.length ? animState.sliceDirs : layers.map(() => animState.dir);
  // A box that is `full` on the two perpendicular axes and [from..to] along the
  // rotation axis, cut to the resting box's extent.
  const boxAlong = (from, to) => {
    const lo = Math.max(from, -half), hi = Math.min(to, half);
    const args = [full, full, full];
    const pos = [0, 0, 0];
    args[axisI] = hi - lo;
    pos[axisI] = (lo + hi) / 2;
    return { args, pos };
  };
  // Each rotating plane gets a one-layer-thick band box that spins with it (in its
  // own direction). The stationary regions between/around the planes are filled by
  // static slabs so the resting silhouette stays a solid cube and the seams opening
  // mid-turn read as interior. Works for one plane or several non-adjacent ones.
  const sorted = layers
    .map((idx, i) => ({ idx, dir: dirs[i] }))
    .sort((a, b) => a.idx - b.idx);
  const bands = [];
  const slabs = [];
  let cursor = -half;
  for (const { idx, dir } of sorted) {
    const bandLo = idx - k - 0.5;
    const bandHi = idx - k + 0.5;
    if (bandLo > cursor) slabs.push(boxAlong(cursor, bandLo)); // stationary gap before this plane
    bands.push({ dir, ...boxAlong(bandLo, bandHi) });
    cursor = Math.max(cursor, bandHi);
  }
  if (cursor < half) slabs.push(boxAlong(cursor, half));
  return { rest: false, axisI, bands, slabs };
}
