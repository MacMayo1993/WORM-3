import React, { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStoreItem } from '../../utils/storeCatalog.js';
import { UI_FONT, Z } from '../../utils/uiTheme.js';
import { storyLevel, storyChecklist, storyStars, WORM_STORY_LEVELS } from './levels.js';
import '../../components/screens/wormStory.css';

export function StoryRewardChoices({ level }) {
  const { progress, owned, claim } = useGameStore(useShallow(s => ({ progress: s.playerProgress, owned: s.ownedItems, claim: s.claimWormStoryReward })));
  if (!level?.reward) return null;
  const claimed = progress.wormStory?.claimed?.[level.id];
  if (claimed) return <p className="worm-story-rewards" role="status">✓ {claimed === 'points' ? `${level.fallback} points received` : `${getStoreItem(claimed)?.label} unlocked`}</p>;
  const earned = storyStars(progress, level.id) > 0;
  const allOwned = level.reward.every(id => owned.includes(id));
  return <div className="worm-story-rewards" aria-label={level.rewardLabel}>
    {allOwned ? <button disabled={!earned} onClick={() => claim(level.id, 'points')}>Already own both? Claim {level.fallback} points</button>
      : level.reward.map(id => <button key={id} disabled={!earned || owned.includes(id)} onClick={() => claim(level.id, id)}>
        {getStoreItem(id)?.label}{owned.includes(id) ? ' · Owned' : earned ? ' · Choose' : ' · Clear to earn'}
      </button>)}
  </div>;
}

export function StoryObjectiveCard() {
  const state = useGameStore(useShallow(s => ({ id: s.wormStoryLevel, started: s.wormStoryStarted,
    result: s.wormStoryResult, checklist: s.wormStoryChecklist, runId: s.wormRunId, alive: s.wormAlive })));
  const level = storyLevel(state.id);
  if (!level || state.result || !state.alive) return null;
  const live = state.started && state.checklist?.runId === state.runId && state.checklist.levelId === level.id ? state.checklist : null;
  const goals = live?.goals ?? storyChecklist(level);
  return <section className="worm-story-card" aria-label="Story objective">
    <small>LEVEL {level.id} / {WORM_STORY_LEVELS.length}</small><strong>{level.title}</strong>
    <ul className="worm-story-checklist" aria-label="Level tasks">{goals.map(goal => <li key={goal.key} className={goal.done ? 'is-complete' : ''}
      aria-label={`${goal.label}: ${goal.value} of ${goal.target}${goal.done ? ', complete' : ''}`}>
      <span className="worm-story-check" aria-hidden="true">{goal.done ? '✓' : '○'}</span>
      <span className="worm-story-task">{goal.label}</span><b aria-hidden="true">{goal.value}/{goal.target}</b>
    </li>)}</ul>
    <p className="worm-story-clock">{state.started ? `${live?.seconds ?? level.limit}s left` : `Time limit: ${level.limit}s`}
      {!state.started && level.rotateEvery ? ` · Turn every ${level.rotateEvery}s` : ''}</p>
    {live?.settling ? <p role="status">Clear your tail and land to finish.</p> : live?.hint ? <p className="worm-story-power-hint">{live.hint}</p> : null}
  </section>;
}

export function StoryStartButton() {
  const s = useGameStore(useShallow(s => ({ level: s.wormStoryLevel, ready: s.wormStoryReady, started: s.wormStoryStarted,
    alive: s.wormAlive, result: s.wormStoryResult, start: s.startWormStory })));
  if (!s.level || !s.alive || s.result || s.started) return null;
  return <button className="worm-story-primary worm-story-start" disabled={!s.ready} onClick={s.start}>
    {s.ready ? 'Start level' : 'Preparing level…'}<span aria-hidden="true">→</span>
  </button>;
}

export function StoryResult({ onNext, onRetry, onLevels }) {
  const result = useGameStore(s => s.wormStoryResult);
  const ref = useRef(null);
  useEffect(() => {
    const prior = document.activeElement;
    ref.current?.querySelector('button:not(:disabled)')?.focus();
    const key = e => {
      if (e.key !== 'Tab') return;
      const buttons = [...(ref.current?.querySelectorAll('button:not(:disabled)') || [])];
      const first = buttons[0], last = buttons.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); prior?.focus?.(); };
  }, []);
  const level = storyLevel(result?.levelId);
  if (!result || !level) return null;
  return <div ref={ref} className="worm-story-result" role="dialog" aria-modal="true" aria-labelledby="worm-story-result-title" style={{ zIndex: Z.MODAL, fontFamily: UI_FONT }}>
    <div className="worm-story-result-sheet"><small>STORY · LEVEL {level.id} / {WORM_STORY_LEVELS.length}</small><h2 id="worm-story-result-title">{level.id === WORM_STORY_LEVELS.at(-1).id ? 'CHAPTER COMPLETE!' : 'LEVEL CLEAR!'}</h2>
      <div className="worm-story-result-stars" aria-label={`${result.stars} out of 3 stars`}>{'★'.repeat(result.stars)}{'☆'.repeat(3-result.stars)}</div>
      <p>{level.title} · {result.seconds}s<br />+{result.xp} XP · +{result.points} Parity Points</p>
      <StoryRewardChoices level={level} />
      <button className="worm-story-primary" onClick={level.id < WORM_STORY_LEVELS.at(-1).id ? onNext : onLevels}>{level.id < WORM_STORY_LEVELS.at(-1).id ? 'Next level' : 'Back to chapter'} <span>→</span></button>
      <button className="worm-story-secondary" onClick={onRetry}>Replay</button><button className="worm-story-secondary" onClick={onLevels}>Chapter map</button>
    </div>
  </div>;
}
