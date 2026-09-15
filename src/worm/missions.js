// One active objective at a time. Completion immediately advances the saved
// track; the run keeps every earned achievement for its results. Targets stay
// fixed across cube sizes, and each assignment starts from fresh progress.
export const WORM_MISSION_STORAGE_KEY = 'worm3_missions_v1';
export const WORM_MISSIONS = [
  { id: 'orb-starter', kind: 'orbs', target: 8, title: 'Collect 8 orbs', reward: 20 },
  { id: 'first-crossing', kind: 'tunnels', target: 1, title: 'Complete 1 tunnel trip', reward: 25 },
  { id: 'color-collector', kind: 'colors', target: 3, title: 'Collect 3 face colors', reward: 30 },
  { id: 'tunnel-healer', kind: 'healed', target: 1, title: 'Heal 1 tunnel', reward: 40 },
  { id: 'orb-explorer', kind: 'orbs', target: 20, title: 'Collect 20 orbs', reward: 35 },
  { id: 'round-trip', kind: 'tunnels', target: 3, title: 'Complete 3 tunnel trips', reward: 45 },
];
export function missionCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
export function readMissionCount() {
  try { return missionCount(JSON.parse(localStorage.getItem(WORM_MISSION_STORAGE_KEY))?.completed); }
  catch { return 0; }
}
export function missionDefinition(completed) {
  return WORM_MISSIONS[missionCount(completed) % WORM_MISSIONS.length];
}
export function startMission(completed, runId, counters = {}) {
  const definition = missionDefinition(completed);
  const counter = definition.kind === 'colors' ? 'orbs' : definition.kind;
  const startTotal = missionCount(counters[counter]);
  return { ...definition, sequence: missionCount(completed), runId, startTotal, lastTotal: startTotal, progress: 0, colors: [], completed: false };
}
// Absolute totals are measured from assignment time. A repeated/older event
// cannot advance even a new color, and depositing orbs never erases progress.
export function advanceMission(mission, kind, total, faceId) {
  if (!mission || mission.completed || !Number.isSafeInteger(total) || total <= mission.lastTotal) return mission;
  let progress = mission.progress, colors = mission.colors;
  if (mission.kind === 'colors' && kind === 'orbs') {
    if (!Number.isInteger(faceId) || faceId < 1 || faceId > 6) return mission;
    if (!colors.includes(faceId)) colors = [...colors, faceId];
    progress = colors.length;
  } else if (mission.kind === kind) {
    progress = Math.max(progress, total - mission.startTotal);
  } else return mission;
  progress = Math.min(mission.target, progress);
  return { ...mission, colors, lastTotal: total, progress, completed: progress >= mission.target };
}
