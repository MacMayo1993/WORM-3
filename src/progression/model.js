import { sanitizeChestWallet } from '../economy/chests.js';
import { sanitizeStoryProgress } from '../worm/story/levels.js';
import { ACHIEVEMENT_BY_ID } from './achievements.js';
// Permanent XP is independent of the spendable wallet and of any one run.
export const PLAYER_SAVE_KEY = 'worm3_player_progress_v1';
export const MAX_PLAYER_LEVEL = 50;
export const POINTS_PER_LEVEL = 25;
export const XP_MODES = {
  worm: 'Worm', story: 'Story', cube: 'Cube', codex: 'Algorithm Codex',
  freeplay: 'Freeplay', random: 'Random', biome: 'Biome', chaos: 'Chaos',
  daily: 'Daily Descent', teach: 'Teach', explore: 'Exploration', demo: 'Introduction',
};
// Chests grant XP, but are not a gameplay mode with run achievements.
export const XP_SOURCES = { ...XP_MODES, chests: "Cubie chests" };
export const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
export const xpForLevel = level => {
  const n = Math.max(0, Math.min(MAX_PLAYER_LEVEL - 1, (Number.isFinite(level) ? Math.floor(level) : 1) - 1));
  return 100 * n + 25 * n * (n - 1) / 2;
};
export function levelProgress(xp) {
  const total = count(xp);
  let level = 1;
  while (level < MAX_PLAYER_LEVEL && total >= xpForLevel(level + 1)) level++;
  const max = level === MAX_PLAYER_LEVEL;
  const needed = max ? 0 : 100 + 25 * (level - 1);
  return { level, max, needed, current: max ? 0 : total - xpForLevel(level), fraction: max ? 1 : (total - xpForLevel(level)) / needed };
}
export function playerRank(level) {
  if (level >= 50) return 'Singularity';
  if (level >= 40) return 'Beyond the Surface';
  if (level >= 30) return 'Front & Back';
  if (level >= 20) return 'Living Geometry';
  if (level >= 10) return 'Inside Out';
  return 'Explorer';
}
export const newProgress = () => ({ xp: 0, modeXp: {}, milestones: {}, bests: {}, challenges: [], claimedRewards: {}, achievements: {}, recentGoals: [], chaosColors: [], wormStory: { stars: {}, claimed: {} } });
const record = value => value && typeof value === 'object' && !Array.isArray(value);
export function sanitizeProgress(raw) {
  const p = newProgress();
  if (!record(raw)) return p;
  p.xp = Math.min(count(raw.xp), 1e9);
  p.wormStory = sanitizeStoryProgress(raw.wormStory);
  for (const id of Object.keys(ACHIEVEMENT_BY_ID)) {
    const value = raw.achievements?.[id];
    if (record(value) && count(value.count)) p.achievements[id] = { count: Math.min(count(value.count), 1e6) };
  }
  p.recentGoals = (Array.isArray(raw.recentGoals) ? raw.recentGoals : []).filter(id => typeof id === 'string' && /^[a-z-]{1,40}$/.test(id)).slice(-6);
  p.chaosColors = [...new Set((Array.isArray(raw.chaosColors) ? raw.chaosColors : []).filter(n => Number.isInteger(n) && n >= 1 && n <= 6))];
  for (const key of Object.keys(XP_SOURCES)) if (count(raw.modeXp?.[key])) p.modeXp[key] = Math.min(count(raw.modeXp[key]), p.xp);
  // Only bounded, internally-issued keys are accepted. Historical records never
  // turn into actions or revive archived modes.
  for (const [key, value] of Object.entries(record(raw.milestones) ? raw.milestones : {}).slice(0, 2000)) {
    if (/^(first|stars|daily|teach|quiz|explore|demo):[\w:.-]{1,100}$/.test(key)) p.milestones[key] = Math.min(count(value), 1000);
  }
  for (const [key, value] of Object.entries(record(raw.bests) ? raw.bests : {}).slice(0, 500)) {
    if (/^[\w:.-]{1,100}$/.test(key) && count(value) > 0) p.bests[key] = count(value);
  }
  p.challenges = (Array.isArray(raw.challenges) ? raw.challenges : []).filter(r => record(r) && typeof r.key === 'string' && r.key.length <= 100)
    .slice(-64).map(r => ({ key: r.key, times: Math.min(3, count(r.times)), guided: r.guided === true }));
  for (let level = 5; level <= MAX_PLAYER_LEVEL; level += 5) {
    if (level <= levelProgress(p.xp).level && typeof raw.claimedRewards?.[level] === 'string') p.claimedRewards[level] = raw.claimedRewards[level];
  }
  return p;
}
export function readPlayerSave(storage) {
  try {
    storage ??= globalThis.localStorage;
    const raw = JSON.parse(storage.getItem(PLAYER_SAVE_KEY));
    if (raw?.version !== 1 || !record(raw.progress) || !Number.isSafeInteger(raw.points) || raw.points < 0 || !Array.isArray(raw.ownedItems)) return null;
    return { progress: sanitizeProgress(raw.progress), points: raw.points, ownedItems: [...new Set(raw.ownedItems.filter(id => typeof id === 'string'))], chestWallet: sanitizeChestWallet(raw.chestWallet), legacyCharacters: raw.chestWallet == null };
  } catch { return null; }
}
export function savePlayerState(state, storage) {
  try {
    storage ??= globalThis.localStorage;
    // One storage write commits XP, level payouts and ownership together.
    // Legacy wallet keys remain mirrors; this snapshot is authoritative on load.
    storage.setItem(PLAYER_SAVE_KEY, JSON.stringify({ version: 1, progress: state.playerProgress, points: state.parityPoints, ownedItems: state.ownedItems, chestWallet: state.chestWallet ?? sanitizeChestWallet(null) }));
    return true;
  } catch { return false; }
}
export function addXp(progress, amount, mode) {
  const grant = Math.min(count(amount), Math.max(0, 1e9 - progress.xp));
  if (!grant || !XP_SOURCES[mode]) return { progress, points: 0, amount: 0 };
  const next = { ...progress, xp: progress.xp + grant, modeXp: { ...progress.modeXp, [mode]: (progress.modeXp[mode] || 0) + grant } };
  return { progress: next, points: POINTS_PER_LEVEL * (levelProgress(next.xp).level - levelProgress(progress.xp).level), amount: grant };
}
export function createXpRun(mode, id, xp, details = {}) {
  return { mode, id, startXp: xp, xp: 0, breakdown: {}, counters: {}, seen: [], achievements: [], featStats: {}, completed: false, assisted: false, ...details };
}
export function wormOrbXp(total) {
  const n = count(total);
  // Same curve on every board size: 2 XP for the first 20, then 1 per pair
  // through 80. Huge boards cannot turn orb density into unlimited XP.
  return Math.min(n, 20) * 2 + Math.floor(Math.min(Math.max(0, n - 20), 60) / 2);
}
export function difficultyMultiplier(difficulty) {
  return ['hard', 'expert', 'master'].includes(difficulty) ? 1.4 : difficulty === 'medium' ? 1.2 : 1;
}
export function wormMultiplier(speed, interval) {
  if (speed >= 3.5 && interval <= 5) return 1.4;
  if (speed >= 2.75 && interval <= 10) return 1.2;
  return 1;
}
// Fingerprint the actual sticker arrangement after a scramble, not its random
// seed or a wall clock. A reloaded identical challenge is still a replay.
export function puzzleFingerprint(cubies, size) {
  let a = 2166136261, b = 5381;
  for (const plane of cubies) for (const row of plane) for (const cubie of row) {
    for (const [face, sticker] of Object.entries(cubie.stickers).sort(([a], [b]) => a.localeCompare(b))) {
      const text = `${face}:${sticker.curr}:${sticker.flips || 0};`;
      for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); }
    }
  }
  return `${size}:${a >>> 0}:${b >>> 0}`;
}
export function puzzleMode(state) {
  if (state.currentLevelData?.dailyKey) return 'daily';
  if (state.currentLevel) {
    if (state.activePackId === 'algorithm-codex') return 'codex';
    if (state.activePackId === 'cube-academy') return 'cube';
    return 'story';
  }
  if (state.settings?.biomeMode?.enabled) return 'biome';
  return state.randomMode ? 'random' : 'freeplay';
}

export const levelDescription = level => level === 1 ? 'Your journey starts here' : `Reach ${xpForLevel(level).toLocaleString()} XP · +25 Parity Points`;
