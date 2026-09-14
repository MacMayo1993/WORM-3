// One objective per run. Failed attempts retry the same objective; completion
// advances the saved track. Targets are fixed so changing cube size cannot
// change what a mission means or make a failed attempt harder.
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
export function startMission(completed, runId) {
  return { ...missionDefinition(completed), runId, progress: 0, colors: [], completed: false };
}
// Counters are absolute run totals, so repeated notifications cannot advance
// the mission twice. Colors remember pickups even after the orbs are deposited.
export function advanceMission(mission, kind, total, faceId) {
  if (!mission || mission.completed) return mission;
  let progress = mission.progress, colors = mission.colors;
  if (mission.kind === 'colors' && kind === 'orbs') {
    if (!Number.isInteger(faceId) || faceId < 1 || faceId > 6 || colors.includes(faceId)) return mission;
    colors = [...colors, faceId]; progress = colors.length;
  } else if (mission.kind === kind && Number.isFinite(total)) {
    progress = Math.max(progress, Math.floor(total));
  } else return mission;
  progress = Math.min(mission.target, progress);
  if (progress === mission.progress) return mission;
  return { ...mission, colors, progress, completed: progress >= mission.target };
}
