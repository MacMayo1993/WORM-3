// One active objective at a time. Completion immediately advances the saved
// track; the run keeps every earned achievement for its results. Goals never
// repeat within a run, and recently completed goals are deprioritized. Targets stay
// fixed across cube sizes, and each assignment starts from fresh progress.
export const WORM_MISSION_STORAGE_KEY = 'worm3_missions_v1';
export const WORM_MISSIONS = [
  { id: 'orb-starter', kind: 'orbs', target: 8, title: 'Collect 8 orbs', reward: 20, xp: 25 },
  { id: 'first-crossing', kind: 'tunnels', target: 1, title: 'Complete 1 tunnel trip', reward: 25, xp: 25 },
  { id: 'color-collector', kind: 'colors', target: 3, title: 'Collect 3 face colors', reward: 30, xp: 50 },
  { id: 'tunnel-healer', kind: 'healed', target: 1, title: 'Heal 1 tunnel', reward: 40, xp: 50 },
  { id: 'orb-explorer', kind: 'orbs', target: 20, title: 'Collect 20 orbs', reward: 35, xp: 50 },
  { id: 'round-trip', kind: 'tunnels', target: 3, title: 'Complete 3 tunnel trips', reward: 45, xp: 50 },
  { id: 'orb-dozen', kind: 'orbs', target: 12, title: 'Collect a dozen orbs', reward: 25, xp: 25 },
  { id: 'four-colors', kind: 'colors', target: 4, title: 'Collect 4 face colors', reward: 35, xp: 50 },
  { id: 'double-crossing', kind: 'tunnels', target: 2, title: 'Complete 2 tunnel trips', reward: 30, xp: 25 },
  { id: 'orb-harvest', kind: 'orbs', target: 35, title: 'Collect 35 orbs', reward: 50, xp: 100 },
  { id: 'five-colors', kind: 'colors', target: 5, title: 'Collect 5 face colors', reward: 45, xp: 50 },
  { id: 'all-colors', kind: 'colors', target: 6, title: 'Collect all 6 face colors', reward: 60, xp: 100 },
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
export function startMission(completed, runId, counters = {}, { earned = [], recent = [], phase } = {}) {
  const start = missionCount(completed) % WORM_MISSIONS.length;
  const ordered = [...WORM_MISSIONS.slice(start), ...WORM_MISSIONS.slice(0, start)];
  const candidates = ordered.filter(d => !earned.includes(d.id) && !(phase === 'finalHealing' && d.kind === 'healed'));
  const definition = candidates.find(d => !recent.includes(d.id)) || candidates[0];
  if (!definition) return null;
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
