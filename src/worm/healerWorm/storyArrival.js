import { COUNTDOWN_STEP_DURATION } from './constants.js';

// One shared clock for portal, camera, ready beats and control handoff.
export const STORY_ARRIVAL_SECONDS = COUNTDOWN_STEP_DURATION * 4;
export const STORY_ARRIVAL_REDUCED_SECONDS = 0.35;
const clamp = t => Math.max(0, Math.min(1, t));
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export function storyArrivalPose(elapsed, reduced = false) {
  const t = clamp((elapsed > 0 ? elapsed + 1e-10 : 0) / (reduced ? STORY_ARRIVAL_REDUCED_SECONDS : STORY_ARRIVAL_SECONDS));
  const reveal = smooth((t - 0.48) / 0.24);
  const settle = smooth((t - 0.73) / 0.27);
  const ring = smooth(t / 0.15) * (1 - smooth((t - 0.78) / 0.22));
  return {
    t, scale: reduced ? smooth(t) : reveal * (1 + 2.2 * (1 - settle)),
    lift: reduced ? 0 : reveal * (1 - settle) * 0.8,
    yaw: reduced || settle === 1 ? 0 : -0.35 * reveal * (1 - settle),
    ring: reduced ? 0 : ring,
    burst: reduced ? 0 : smooth((t - 0.7) / 0.06) * (1 - smooth((t - 0.8) / 0.2)),
    settle, step: reduced ? null : t < 0.25 ? 3 : t < 0.5 ? 2 : t < 0.75 ? 1 : 'go',
  };
}
