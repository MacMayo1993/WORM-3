import { getManifoldGridId } from './gridIds.js';
import { ANTIPODAL_PAIRS, FACE_INFO, getFaceFromGridId, resolveBet } from '../utils/disparityBetting.js';

export const CHAOS_RECORD_KEY = 'worm3_chaos_record';
export const emptyChaosRecord = () => ({ rounds: 0, predictions: 0, correct: 0, bestStreak: 0, healedPoints: 0 });
export function readChaosRecord() {
  const record = emptyChaosRecord();
  try {
    const raw = JSON.parse(localStorage.getItem(CHAOS_RECORD_KEY) || '{}');
    for (const key of Object.keys(record)) {
      if (Number.isFinite(raw?.[key])) record[key] = Math.max(0, Math.floor(raw[key]));
    }
    record.correct = Math.min(record.correct, record.predictions);
  } catch { /* A new or unavailable save starts at zero. */ }
  return record;
}

// Read identity and damage from the rendered board, never infer health from the
// historical ledger. Rotation changes position; flips change curr, not orig.
export function chaosBoard(cubies, size, cap) {
  const faces = Object.fromEntries(Object.keys(FACE_INFO).map(id => [id, { alive: 0, danger: 0, total: 0, pressure: 0 }]));
  const survivors = [];
  for (const layer of cubies || []) for (const row of layer) for (const cubie of row) {
    for (const sticker of Object.values(cubie.stickers || {})) {
      const face = faces[sticker.orig];
      if (!face) continue;
      face.total++;
      const flips = Math.max(0, sticker.flips || 0);
      if (flips >= cap) continue;
      face.alive++;
      face.pressure += flips / cap;
      if (cap - flips <= Math.max(1, Math.floor(cap * 0.25))) face.danger++;
      survivors.push({ gridId: getManifoldGridId(sticker, size), flips, remaining: cap - flips });
    }
  }
  const alive = survivors.length;
  const total = Object.values(faces).reduce((n, f) => n + f.total, 0);
  const pairs = ANTIPODAL_PAIRS.map(pair => ({ ...pair,
    alive: pair.faces.reduce((n, f) => n + faces[f].alive, 0),
    danger: pair.faces.reduce((n, f) => n + faces[f].danger, 0),
    total: pair.faces.reduce((n, f) => n + faces[f].total, 0),
  }));
  return { faces, pairs, alive, total, survivors, danger: pairs.reduce((n, p) => n + p.danger, 0) };
}

export function chaosStage(alive, total) {
  if (alive <= 2) return 'Last pair standing';
  if (alive <= 6) return 'Final six';
  if (alive <= Math.ceil(total / 2)) return 'The squeeze';
  return 'Opening storm';
}

export function predictionLabel(bet) {
  if (!bet) return 'Open round';
  if (bet.type === 'PAIR') return ANTIPODAL_PAIRS.find(p => p.id === bet.pick)?.label || 'Color pair';
  if (bet.type === 'SPEED') return bet.pick === 'FAST' ? 'Fast collapse' : 'Slow collapse';
  return `${FACE_INFO[bet.pick]?.name || 'Color'} ${bet.type === 'FIRST_OUT' ? 'falls first' : 'survives'}`;
}

export function predictionFaces(bet) {
  if (bet?.type === 'PAIR') return ANTIPODAL_PAIRS.find(p => p.id === bet.pick)?.faces || [];
  return ['SURVIVOR', 'FIRST_OUT'].includes(bet?.type) ? [Number(bet.pick)] : [];
}

export function newChaosExperience(state, now = Date.now()) {
  return { roundId: state.disparityRoundId, startedAt: now, endedAt: null,
    prediction: state.activeBet?.roundId === state.disparityRoundId ? { ...state.activeBet } : null,
    size: state.size, cap: state.disparityFlipCap, level: state.chaosLevel,
    events: [], peakBurst: 0, cascadeCount: 0, healPoints: 0, healedIds: [], milestones: [], completed: false };
}

export function recordChaosTick(run, payload, board, now = Date.now()) {
  if (!run || run.completed || run.endedAt != null) return run;
  const deaths = payload.deaths || [];
  const events = [...run.events];
  if (deaths.length) events.push({ at: now, source: payload.source || 'chaos',
    tiles: deaths.map(d => d.gridId), alive: board.alive });
  const milestones = [...run.milestones];
  if (board.alive <= Math.ceil(board.total / 2) && !milestones.includes('Halfway')) milestones.push('Halfway');
  if (board.alive <= 6 && !milestones.includes('Final six')) milestones.push('Final six');
  return { ...run, events: events.slice(-48), milestones,
    peakBurst: Math.max(run.peakBurst, deaths.length),
    cascadeCount: run.cascadeCount + (payload.cascades?.length || 0),
    endedAt: payload.winner?.length ? now : null };
}

export function chaosRecap(run, state) {
  const prediction = run.prediction ? resolveBet(run.prediction, state) : null;
  const winningFaces = new Set((state.disparityWinner?.pair || []).map(getFaceFromGridId));
  const pair = ANTIPODAL_PAIRS.find(p => p.faces.every(f => winningFaces.has(f)));
  const medals = ['Storm witnessed'];
  if (run.healPoints > 0) medals.push('Helping hand');
  if ((run.healedIds?.length || 0) >= 6) medals.push('Six restored');
  if ((run.healedIds?.length || 0) >= 12) medals.push('Storm keeper');
  if (prediction?.won) medals.push('Called it');
  if (run.peakBurst >= 6) medals.push('Chain reaction');
  return { ...run, completed: true, predictionResult: prediction, winningPair: pair?.label || 'Final survivors', medals };
}

// Round objectives count distinct identities, so repeatedly healing one tile
// cannot complete them. They are feats; wallet/XP settlement stays unchanged.
export function recordChaosHealing(run, gridIds, points) {
  if (!run || run.completed || run.endedAt != null) return run;
  return { ...run, healPoints: run.healPoints + points,
    healedIds: [...new Set([...(run.healedIds || []), ...gridIds])] };
}
export function chaosObjective(run, board) {
  const healed = run?.healedIds?.length || 0;
  if (healed < 6) return { label: 'Restore six different tiles', value: healed, target: 6 };
  if (healed < 12) return { label: 'Restore twelve different tiles', value: healed, target: 12 };
  return { label: board.alive > 6 ? 'Reach the final six' : 'Follow the final survivors', value: null };
}
