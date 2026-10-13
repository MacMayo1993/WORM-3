// Presentation time only; the simulation and authored body remain untouched.
export const STORY_ARRIVAL_SECONDS = 1.5;
export const STORY_ARRIVAL_REDUCED_SECONDS = 0.2;
export function storyArrivalPose(elapsed, reduced = false) {
  const t = Math.max(0, Math.min(1, elapsed / (reduced ? STORY_ARRIVAL_REDUCED_SECONDS : STORY_ARRIVAL_SECONDS)));
  const reveal = Math.max(0, Math.min(1, (t - 0.18) / 0.72));
  const smooth = reveal * reveal * (3 - 2 * reveal);
  return { t, scale: reduced ? t : smooth,
    lift: reduced ? 0 : Math.sin(smooth * Math.PI) * 0.45,
    ring: reduced ? 0 : Math.sin(Math.PI * t),
  };
}
