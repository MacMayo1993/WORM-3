import { advanceMission, startMission } from './missions.js';
import { wormXpChanges } from '../progression/awards.js';

export function wormMissionChanges(state, kind, total, faceId, runId) {
    const mission = state.wormMission;
    if (!state.wormHealerMode || state.demoMode || !state.wormAlive || state.wormPaused || !mission || mission.completed ||
        state.xpRun?.completed || mission.runId !== state.wormRunId || runId !== state.wormRunId ||
        !['active', 'finalHealing'].includes(state.wormGamePhase) ||
        !['orbs', 'tunnels', 'healed'].includes(kind) || !Number.isSafeInteger(total) ||
        total <= state.wormMissionCounters[kind]) return null;
    // Track every real event, even while a different objective is active. The
    // next assignment takes its baseline after this event, so old pickups and
    // completed trips cannot cascade into free achievements on the same tick.
    const counters = { ...state.wormMissionCounters, [kind]: total };
    const next = advanceMission(mission, kind, total, faceId);
    if (!next.completed) return { wormMissionCounters: counters, wormMission: next };
    const completed = state.wormMissionsCompleted + 1;
    const xp = wormXpChanges({ ...state, wormMission: next }, 'mission', state.wormRunAchievements.length + 1, next.id, runId);
    const achievement = {
      ...next,
      xpEarned: (xp.xpRun?.xp ?? state.xpRun?.xp ?? 0) - (state.xpRun?.xp ?? 0),
    };
    // Rewards, the earned list and the replacement objective commit together.
    // Results only display these receipts; opening them never pays a second time.
    return {
      ...xp,
      wormMissionCounters: counters,
      wormRunAchievements: [...state.wormRunAchievements, achievement],
      wormMission: startMission(completed, runId, counters, {
        earned: [...state.wormRunAchievements.map(a => a.id), next.id],
        recent: state.playerProgress.recentGoals || [], phase: state.wormGamePhase,
      }),
      playerProgress: { ...(xp.playerProgress || state.playerProgress), recentGoals: [...(state.playerProgress.recentGoals || []), next.id].slice(-6) },
      wormMissionsCompleted: completed,
      parityPoints: Math.max(0, (xp.parityPoints ?? state.parityPoints ?? 0) + next.reward),
    };
}

// Preserve XP-before-mission ordering while publishing a single event patch.
export function wormEventChanges(state, kind, total, faceId, runId) {
  const xp = wormXpChanges(state, kind, total, faceId, runId);
  return { ...xp, ...wormMissionChanges({ ...state, ...xp }, kind, total, faceId, runId) };
}
