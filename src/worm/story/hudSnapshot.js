import { storyChecklist, storyProgressText } from './levels.js';

// Metrics/completion still run every frame. Rebuild display data only when a
// visible value changes; don't allocate two goal lists and serialize both every tick.
export function storyHudSnapshot(previous, level, metrics, runId, outcome) {
  const seconds = Math.max(0, Math.ceil(level.limit - metrics.elapsed));
  const hint = metrics.powerHint || '';
  const old = previous?.checklist;
  const sameRun = old?.runId === runId && old?.levelId === level.id;
  const sameGoals = sameRun && old.goals.every(goal =>
    goal.value === Math.min(goal.target, Math.max(0, metrics[goal.key] ?? 0)));
  const goals = sameGoals ? old.goals : storyChecklist(level, metrics);
  const settling = !outcome && goals.every(goal => goal.done);
  if (sameGoals && old.seconds === seconds && old.hint === hint && old.settling === settling &&
      previous.tailClear === metrics.tailClear) return previous;
  return {
    tailClear: metrics.tailClear,
    progress: storyProgressText(level, metrics),
    checklist: { runId, levelId: level.id, goals, seconds, hint, settling },
  };
}
