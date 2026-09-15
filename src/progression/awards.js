import { ACHIEVEMENT_BY_ID, DISCOVERY_XP, wormFeats, puzzleFeats } from './achievements.js';
import { checkRubiksWin } from '../game/winDetection.js';
import { addXp, count, levelProgress, wormOrbXp } from './model.js';
import { computeStars } from '../levels/scoring.js';

export function xpChanges(state, amount, mode, label, run = null, progress = state.playerProgress) {
  const result = addXp(progress, amount, mode);
  const patch = { playerProgress: result.progress };
  if (result.amount > 0) {
    patch.parityPoints = (state.parityPoints || 0) + result.points;
    patch.xpNotice = {
      id: (state.xpNotice?.id || 0) + 1, mode, label, amount: result.amount,
      fromLevel: levelProgress(state.playerProgress.xp).level,
      toLevel: levelProgress(result.progress.xp).level,
    };
  }
  if (run) patch.xpRun = {
    ...run, xp: run.xp + result.amount,
    breakdown: { ...run.breakdown, ...(result.amount ? { [label]: (run.breakdown[label] || 0) + result.amount } : {}) },
  };
  return patch;
}

// Award all qualifying feats in one store transaction. Related tiers pay only
// the increase; one discovery bonus belongs to the entire family, forever.
export function achievementChanges(state, ids, { factor = 1, discoveriesOnly = false } = {}) {
  let next = state;
  for (const id of ids) {
    const def = ACHIEVEMENT_BY_ID[id], run = next.xpRun;
    if (!def || !run || def.mode !== run.mode || run.achievements?.some(a => a.id === id)) continue;
    const history = next.playerProgress.achievements || {};
    const familyKnown = Object.keys(history).some(key => ACHIEVEMENT_BY_ID[key]?.family === def.family);
    const first = !history[id];
    const previous = (run.achievements || []).filter(a => a.family === def.family);
    const previousBase = Math.max(0, ...previous.map(a => a.baseXp));
    const base = Math.max(0, def.xp - previousBase);
    const reward = Math.round(base * (discoveriesOnly ? (first ? 1 : 0) : factor));
    const discovery = !familyKnown ? DISCOVERY_XP : 0;
    const progress = { ...next.playerProgress, achievements: { ...history, [id]: { count: Math.min(1e6, (history[id]?.count || 0) + 1) } } };
    const patch = xpChanges(next, reward + discovery, def.mode, 'Run feats', run, progress);
    const receipt = { id, title: def.title, description: def.description, family: def.family, baseXp: def.xp, xpEarned: patch.xpRun.xp - run.xp, first };
    next = { ...next, ...patch, xpRun: { ...patch.xpRun, achievements: [...(run.achievements || []), receipt] } };
  }
  return { playerProgress: next.playerProgress, parityPoints: next.parityPoints, xpRun: next.xpRun, xpNotice: next.xpNotice };
}

export function wormXpChanges(state, kind, total, pair, runId) {
  const run = state.xpRun;
  if (!run || run.mode !== 'worm' || run.id !== runId || state.wormRunId !== runId ||
      run.completed || state.demoMode || state.wormPaused || !state.wormHealerMode || !state.wormAlive ||
      !['active', 'finalHealing'].includes(state.wormGamePhase)) return {};
  if (kind === 'element') {
    if (pair !== null && !['water', 'fire', 'grass', 'ice', 'lightning'].includes(pair)) return {};
    const f = run.featStats || {};
    const elements = pair ? [...new Set([...(f.elements || []), pair])] : (f.elements || []);
    const next = { ...run, featStats: { ...f, elements, element: pair, grassOrbs: 0 } };
    return achievementChanges({ ...state, xpRun: next }, wormFeats(next), { factor: run.multiplier });
  }
  if (kind === 'entry') return typeof pair === 'string' && /^[1-6]:[1-6]$/.test(pair)
    ? { xpRun: { ...run, pendingPair: pair } } : {};
  let base = 0, label, next = run;
  const old = run.counters[kind] || 0;
  if (kind === 'orbs' || kind === 'healed') {
    if (!Number.isSafeInteger(total) || total <= (kind === 'orbs' ? run.featStats?.orbs || 0 : old)) return {};
    const value = Math.min(total, kind === 'orbs' ? 80 : 6);
    if (value <= old && kind !== 'orbs') return {};
    base = kind === 'orbs' ? wormOrbXp(value) - wormOrbXp(old) : (value - old) * 15;
    label = kind === 'orbs' ? 'Orbs' : 'Healing';
    next = { ...run, counters: { ...run.counters, [kind]: value } };
    if (kind === 'orbs') {
      const f = run.featStats || {};
      const colors = Number.isInteger(pair) && pair >= 1 && pair <= 6 ? [...new Set([...(f.colors || []), pair])] : (f.colors || []);
      next.featStats = { ...f, colors, orbs: total, grassOrbs: f.element === 'grass' ? (f.grassOrbs || 0) + total - (f.orbs || 0) : 0 };
    }
  } else if (kind === 'tunnels') {
    const key = run.pendingPair;
    if (typeof key !== 'string' || !key || run.seen.includes(key) || run.seen.length >= 6) return {};
    base = 8; label = 'New tunnel routes';
    next = { ...run, pendingPair: null, seen: [...run.seen, key] };
  } else if (kind === 'mission') {
    if (!state.wormMission?.completed || !Number.isSafeInteger(total) || total !== old + 1 ||
        state.wormRunAchievements.length !== old) return {};
    base = state.wormMission.xp || 50; label = 'Achievements';
    next = { ...run, counters: { ...run.counters, mission: total } };
  } else return {};
  // Round each cumulative category, not each orb: fractional difficulty cannot
  // pay differently when the same pickups arrive individually or in a batch.
  const cumulative = (run.counters[`${kind}Base`] || 0) + base;
  const amount = Math.round(cumulative * run.multiplier) - Math.round((run.counters[`${kind}Base`] || 0) * run.multiplier);
  next = { ...next, counters: { ...next.counters, [`${kind}Base`]: cumulative } };
  const paid = { ...state, ...xpChanges(state, amount, 'worm', label, next) };
  return kind === 'mission' ? { playerProgress: paid.playerProgress, parityPoints: paid.parityPoints, xpRun: paid.xpRun, xpNotice: paid.xpNotice } : achievementChanges(paid, wormFeats(next), { factor: run.multiplier });
}

export function puzzleXpChanges(state) {
  const run = state.xpRun;
  if (!run?.puzzle || run.completed || state.demoMode || state.wormHealerMode ||
      state.showMainMenu || state.teachModeActive || !state.victory || !state.hasShuffled || state.animState ||
      run.levelId !== state.currentLevel || run.size !== state.size || count(state.moves) === 0 || !checkRubiksWin(state.cubies, state.size)) return {};
  let progress = state.playerProgress;
  const completed = { ...run, completed: true };
  if (!run.eligible) return { xpRun: completed };
  const records = [...progress.challenges];
  const prior = records.find(r => r.key === run.challenge);
  const repeats = prior?.times || 0;
  const replayFactor = [1, 0.35, 0.15][repeats] || 0;
  const recordKey = run.levelId ? `level:${run.levelId}` : `${run.mode}:${run.size}`;
  const milestones = { ...progress.milestones };
  const bests = { ...progress.bests };
  const grants = [];
  if (run.dailyKey) {
    const key = `daily:${run.dailyKey}`;
    const paid = milestones[key] || 0;
    const earned = run.assisted ? 25 : 120;
    milestones[key] = Math.max(paid, earned);
    grants.push([run.assisted ? 'Guided daily' : 'Daily Descent', Math.max(0, earned - paid)]);
    if (!run.assisted && run.par && state.moves <= run.par && !milestones[`${key}:par`]) {
      milestones[`${key}:par`] = 1;
      grants.push(['At par', 30]);
    }
  } else if (run.assisted) {
    grants.push(['Guided solve', prior?.guided ? 0 : 25]);
  } else {
    grants.push(['Puzzle solved', Math.round((20 + Math.min(run.scrambleMoves, 20) * 5) * run.multiplier * replayFactor)]);
    const first = `first:${recordKey}`;
    if (!milestones[first]) { milestones[first] = 1; grants.push(['First clear', 40]); }
    if (run.levelId) {
      const key = `stars:${run.levelId}`;
      const stars = computeStars(state.currentLevelData, { moves: state.moves, time: state.gameTime });
      const extra = Math.max(0, stars - (milestones[key] || 0));
      milestones[key] = Math.max(stars, milestones[key] || 0);
      if (extra) grants.push(['New stars', extra * 20]);
      if (bests[recordKey] && state.moves < bests[recordKey]) grants.push(['Personal best', 30]);
      bests[recordKey] = Math.min(bests[recordKey] || Infinity, state.moves);
    }
  }
  progress = {
    ...progress, milestones, bests,
    challenges: [...records.filter(r => r.key !== run.challenge), { key: run.challenge, times: Math.min(3, repeats + (run.assisted ? 0 : 1)), guided: !!prior?.guided || run.assisted }].slice(-64),
  };
  let nextState = { ...state, playerProgress: progress, xpRun: completed };
  for (const [label, amount] of grants) nextState = { ...nextState, ...xpChanges(nextState, amount, run.mode, label, nextState.xpRun) };
  const stars = run.levelId ? computeStars(state.currentLevelData, { moves: state.moves, time: state.gameTime }) : 0;
  // Puzzle feats use the same replay reduction as the solve. Daily feats pay
  // once per date; a later improved par result can still earn its own feat.
  let ids = puzzleFeats(state, run, stars, state.playerProgress.bests[recordKey]);
  if (run.dailyKey) ids = ids.filter(id => !state.playerProgress.milestones[`daily:${run.dailyKey}:feat:${id}`]);
  const rewarded = achievementChanges(nextState, ids, { factor: run.dailyKey ? 1 : replayFactor });
  if (run.dailyKey && ids.length) rewarded.playerProgress = { ...rewarded.playerProgress, milestones: {
    ...rewarded.playerProgress.milestones, ...Object.fromEntries(ids.map(id => [`daily:${run.dailyKey}:feat:${id}`, 1])),
  } };
  return rewarded;
}
