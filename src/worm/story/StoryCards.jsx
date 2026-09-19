import React, { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStoreItem } from '../../utils/storeCatalog.js';
import { UI_FONT, Z } from '../../utils/uiTheme.js';
import { storyLevel, storyStars } from './levels.js';
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
  const state = useGameStore(useShallow(s => ({ id: s.wormStoryLevel, ready: s.wormStoryReady, started: s.wormStoryStarted, result: s.wormStoryResult, progress: s.wormStoryProgress, start: s.startWormStory, alive: s.wormAlive })));
  const level = storyLevel(state.id);
  if (!level || state.result || !state.alive) return null;
  return <section className="worm-story-card" aria-label="Story objective">
    <small>STORY · LEVEL {level.id} / 6</small><strong>{level.title}</strong><p>{state.started ? state.progress || level.goal : level.goal}</p>
    {state.ready && !state.started && <button className="worm-story-primary" onClick={state.start}>Start level <span>→</span></button>}
  </section>;
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
    <div className="worm-story-result-sheet"><small>STORY · LEVEL {level.id} / 6</small><h2 id="worm-story-result-title">{level.id === 6 ? 'CHAPTER COMPLETE!' : 'LEVEL CLEAR!'}</h2>
      <div className="worm-story-result-stars" aria-label={`${result.stars} out of 3 stars`}>{'★'.repeat(result.stars)}{'☆'.repeat(3-result.stars)}</div>
      <p>{level.title} · {result.seconds}s<br />+{result.xp} XP · +{result.points} Parity Points</p>
      <StoryRewardChoices level={level} />
      <button className="worm-story-primary" onClick={level.id < 6 ? onNext : onLevels}>{level.id < 6 ? 'Next level' : 'Back to chapter'} <span>→</span></button>
      <button className="worm-story-secondary" onClick={onRetry}>Replay</button><button className="worm-story-secondary" onClick={onLevels}>Chapter map</button>
    </div>
  </div>;
}
