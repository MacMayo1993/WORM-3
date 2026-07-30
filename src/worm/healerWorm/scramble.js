export const MEGA_WORM_CUBE_SIZE = 15;

const AXES = ['col', 'row', 'depth'];

// Build the opening turns shared by the scramble and its timed inverse. Only
// Mega has enough room for the two independently rotating, non-adjacent planes;
// the regular 2x2-7x7 boards use one plane per turn.
export function buildWormScramble(size, steps, random = Math.random) {
  const useParallelPlanes = size === MEGA_WORM_CUBE_SIZE;
  const seq = [];
  let prevAxis = null;
  let prevKey = null;

  for (let i = 0; i < steps; i++) {
    let move;
    let key;
    do {
      const axis = AXES[Math.floor(random() * AXES.length)];
      const sliceIndex = Math.floor(random() * size);
      const dir = random() < 0.5 ? 1 : -1;

      if (useParallelPlanes) {
        const candidates = Array.from(
          { length: size },
          (_, index) => index,
        ).filter(index => Math.abs(sliceIndex - index) >= 2);
        const second = candidates[Math.floor(random() * candidates.length)];
        const sliceIndices = [sliceIndex, second];
        move = {
          axis,
          sliceIndex,
          dir,
          sliceIndices,
          sliceDirs: [dir, -dir],
          wormScramble: true,
        };
        key = [...sliceIndices].sort((a, b) => a - b).join(',');
      } else {
        move = { axis, sliceIndex, dir, wormScramble: true };
        key = String(sliceIndex);
      }
    } while (move.axis === prevAxis && key === prevKey);

    seq.push(move);
    prevAxis = move.axis;
    prevKey = key;
  }

  return seq;
}

export function invertWormScramble(seq) {
  return [...seq].reverse().map(move => {
    if (!move.sliceDirs?.length) return { ...move, dir: -move.dir };
    const sliceDirs = move.sliceDirs.map(dir => -dir);
    return { ...move, sliceDirs, dir: sliceDirs[0] };
  });
}
