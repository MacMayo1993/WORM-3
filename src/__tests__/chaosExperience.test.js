import { describe, it, expect, beforeEach } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { chaosBoard, chaosStage, newChaosExperience, recordChaosTick, chaosRecap, predictionFaces, readChaosRecord, CHAOS_RECORD_KEY, emptyChaosRecord } from '../game/chaosExperience.js';
import { useGameStore } from '../hooks/useGameStore.js';

describe('CHAOS match tracking', () => {
  it('counts the visible board by original identity through damage, turns and healing', () => {
    const cube = makeCubies(3);
    cube[0][0][2].stickers.PZ.flips = 8;
    cube[0][1][2].stickers.PZ.flips = 7;
    cube[0][1][2].stickers.PZ.curr = 4;
    const before = chaosBoard(cube, 3, 8);
    expect(before.alive).toBe(53);
    expect(before.faces[1]).toMatchObject({ alive: 8, danger: 1 });
    const after = chaosBoard(rotateSliceCubies(cube, 3, 'row', 0, 1), 3, 8);
    expect(after.faces).toEqual(before.faces);
    cube[0][1][2].stickers.PZ.flips = 0;
    expect(chaosBoard(cube, 3, 8).faces[1].danger).toBe(0);
  });
  it.each([2, 3, 7])('reports all starting stickers for size %i', size => {
    const board = chaosBoard(makeCubies(size), size, 8);
    expect(board.alive).toBe(6 * size * size);
    expect(board.pairs.map(p => p.alive)).toEqual([2 * size * size, 2 * size * size, 2 * size * size]);
  });
  it('retains real milestones across a large burst and bounds history', () => {
    let run = newChaosExperience({ size: 3, disparityRoundId: 2, disparityFlipCap: 8, chaosLevel: 3 }, 1000);
    for (let i = 0; i < 70; i++) run = recordChaosTick(run, { deaths: [{ gridId: 'M1-001' }], cascades: [{}], source: 'chain' }, { alive: 4, total: 54 }, 2000 + i);
    expect(run.events).toHaveLength(48);
    expect(run.cascadeCount).toBe(70);
    expect(run.milestones).toEqual(['Halfway', 'Final six']);
    const finished = recordChaosTick(run, { winner: ['M1-002', 'M4-002'] }, { alive: 2, total: 54 }, 3000);
    expect(recordChaosTick(finished, { deaths: [{}] }, { alive: 0, total: 54 }, 4000)).toBe(finished);
    expect(chaosStage(2, 54)).toBe('Last pair standing');
  });
  it('captures only a prediction stamped for this round', () => {
    const state = { disparityRoundId: 2, activeBet: { roundId: 1, type: 'PAIR', pick: 'RO' } };
    expect(newChaosExperience(state).prediction).toBeNull();
    expect(predictionFaces({ type: 'PAIR', pick: 'RO' })).toEqual([1, 4]);
  });
  it('recaps the captured prediction after the live bet has been cleared', () => {
    const run = { prediction: { type: 'PAIR', pick: 'RO' }, peakBurst: 6, healPoints: 20 };
    const recap = chaosRecap(run, { disparityWinner: { pair: ['M1-002', 'M4-008'] } });
    expect(recap.predictionResult.won).toBe(true);
    expect(recap.medals).toEqual(['Storm witnessed', 'Helping hand', 'Called it', 'Chain reaction']);
  });
  it('validates a malformed persisted record', () => {
    localStorage.setItem(CHAOS_RECORD_KEY, JSON.stringify({ rounds: -3, predictions: 2, correct: 20, bestStreak: 'oops' }));
    expect(readChaosRecord()).toMatchObject({ rounds: 0, predictions: 2, correct: 2, bestStreak: 0 });
  });
});

describe('CHAOS round lifecycle', () => {
  beforeEach(() => {
    useGameStore.setState({ chaosLevel: 0, chaosRecord: emptyChaosRecord(), activeBet: null,
      demoMode: false, currentLevel: null, wormHealerMode: false, disparityRoundId: 10,
      betStreak: 2, disparityWinner: null, cubies: makeCubies(3), size: 3, disparityFlipCap: 8 });
    useGameStore.getState().clearDisparityGame();
  });
  it('records a completed round exactly once without changing the wallet', () => {
    useGameStore.setState({ activeBet: { roundId: 10, type: 'PAIR', pick: 'RO', wager: 25 }, parityPoints: 200 });
    useGameStore.getState().startChaosExperience();
    useGameStore.setState({ disparityWinner: { pair: ['M1-002', 'M4-008'] }, activeBet: null });
    useGameStore.getState().finishChaosExperience();
    useGameStore.getState().finishChaosExperience();
    expect(useGameStore.getState().chaosRecord).toMatchObject({ rounds: 1, predictions: 1, correct: 1, bestStreak: 2 });
    expect(useGameStore.getState().parityPoints).toBe(200);
  });
  it('does not count abandoned, stale, or demo rounds', () => {
    useGameStore.getState().startChaosExperience();
    useGameStore.getState().finishChaosExperience();
    expect(useGameStore.getState().chaosRecord.rounds).toBe(0);
    useGameStore.setState({ disparityRoundId: 11, disparityWinner: { pair: ['M1-002', 'M4-008'] } });
    useGameStore.getState().finishChaosExperience();
    expect(useGameStore.getState().chaosRecord.rounds).toBe(0);
    useGameStore.setState({ demoMode: true });
    useGameStore.getState().startChaosExperience();
    useGameStore.getState().finishChaosExperience();
    expect(useGameStore.getState().chaosRecord.rounds).toBe(0);
  });
  it('clears the round and focus while preserving career records', () => {
    useGameStore.setState({ chaosFocusFaces: [1, 4], chaosRecord: { ...emptyChaosRecord(), rounds: 4 } });
    useGameStore.getState().startChaosExperience();
    useGameStore.getState().clearDisparityGame();
    expect(useGameStore.getState().chaosExperience).toBeNull();
    expect(useGameStore.getState().chaosFocusFaces).toEqual([]);
    expect(useGameStore.getState().chaosRecord.rounds).toBe(4);
  });
});
