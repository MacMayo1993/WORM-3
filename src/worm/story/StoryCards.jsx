import ModeArtwork from '../../components/ui/ModeArtwork.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStoreItem } from '../../utils/storeCatalog.js';
import { UI_FONT, Z } from '../../utils/uiTheme.js';
import { storyLevel, storyChecklist, storyStars, WORM_STORY_LEVELS } from './levels.js';
import { feel, resumeFeel } from '../../utils/feel.js';
import '../../components/screens/wormStory.css';

export function StoryRewardChoices({ level }) {
  const { progress, owned, claim } = useGameStore(useShallow(s => ({ progress: s.playerProgress, owned: s.ownedItems, claim: s.claimWormStoryReward })));
  if (!level?.reward) return null;
  const claimed = progress.wormStory?.claimed?.[level.id];
  if (claimed) return <p className="worm-story-rewards" role="status">✓ {claimed === 'points' ? `${level.fallback} points received` : `${getStoreItem(claimed)?.label} unlocked`}</p>;
  const earned = storyStars(progress, level.id) > 0;
  const allOwned = level.reward.every(id => owned.includes(id));
  return <div className="worm-story-rewards" aria-label={level.rewardLabel}>
    {allOwned ? <button disabled={!earned} onClick={() => claim(level.id, 'points')}>Claim {level.fallback} points</button>
      : level.reward.map(id => <button key={id} disabled={!earned || owned.includes(id)} onClick={() => claim(level.id, id)}>
        {getStoreItem(id)?.label}{owned.includes(id) ? ' · Owned' : earned ? ' · Choose' : ''}
      </button>)}
  </div>;
}

export function StoryObjectiveCard({ compact = false, onInspect }) {
  const state = useGameStore(useShallow(s => ({ id: s.wormStoryLevel, started: s.wormStoryStarted,
    result: s.wormStoryResult, checklist: s.wormStoryChecklist, runId: s.wormRunId, alive: s.wormAlive, paused: s.wormPaused })));
  const level = storyLevel(state.id);
  const live = state.started && state.checklist?.runId === state.runId && state.checklist.levelId === level?.id ? state.checklist : null;
  const goals = live?.goals ?? (level ? storyChecklist(level) : []);
  const previous = useRef(null);
  const [celebration, setCelebration] = useState(null);
  const runKey = `${state.runId}:${state.id}`;
  useEffect(() => {
    if (!compact) return;
    const done = new Set((live?.goals ?? []).filter(goal => goal.done).map(goal => goal.key));
    const fresh = previous.current?.runKey === runKey
      ? live?.goals.find(goal => goal.done && !previous.current.done.has(goal.key)) : null;
    previous.current = { runKey, done };
    if (fresh && state.started && state.alive && !state.result && !state.paused) {
      feel('storyTask', { priority: 0 });
      setCelebration({ runKey, label: fresh.label });
    }
  }, [compact, live, runKey, state.started, state.alive, state.result, state.paused]);
  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => setCelebration(null), 1400);
    return () => clearTimeout(timer);
  }, [celebration]);
  if (!level || state.result || !state.alive) return null;
  const completed = goals.filter(goal => goal.done).length;
  const seconds = live?.seconds ?? level.limit;
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const recent = celebration?.runKey === runKey ? celebration : null;
  if (compact) return <button type="button" className={`worm-story-glance worm-hud-chip${recent ? ' worm-task-confirmed' : ''}`}
    onClick={onInspect} aria-label={`Level ${level.id}: ${level.title}. ${completed} of ${goals.length} tasks complete. ${seconds} seconds left. Pause to view tasks.`}
    aria-haspopup="dialog" title={level.title}>
    <span className="worm-story-glance-level">L{level.id}</span>
    <span className="worm-story-glance-progress">
      <span>{recent ? `✓ ${recent.label}` : live?.settling ? "Land and clear your tail" : `Tasks ${completed}/${goals.length}`}</span>
      <span className="worm-story-goal-bars" aria-hidden="true">{goals.map(goal => <i key={goal.key} data-done={goal.done}>
        <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, goal.value / goal.target))})` }} />
      </i>)}</span>
    </span>
    <span className="worm-story-glance-clock" data-urgent={seconds <= 30}>{clock}</span>
    <span className="worm-hud-sr" role="status">{recent ? `${recent.label} complete.` : ''}</span>
  </button>;
  return <section className="worm-story-card" aria-label="Story objective">
    <small>Level {level.id} / {WORM_STORY_LEVELS.length}</small><strong>{level.title}</strong>
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
  return <button className="worm-story-primary worm-story-start" disabled={!s.ready} onClick={() => { resumeFeel(); feel('uiKey'); s.start(); }}>
    {s.ready ? 'Start level' : "Loading…"}<span aria-hidden="true">→</span>
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
    <div className="worm-story-result-sheet"><ModeArtwork mode="success" className="screen-results-art" /><small>Level {level.id} / {WORM_STORY_LEVELS.length}</small><h2 id="worm-story-result-title">{level.id === WORM_STORY_LEVELS.at(-1).id ? 'Chapter complete' : 'Level complete'}</h2>
      <div className="worm-story-result-stars" aria-label={`${result.stars} out of 3 stars`}>{[0,1,2].map(i => <span key={i} data-earned={i < result.stars} style={{ '--star-index': i }} aria-hidden="true">★</span>)}</div>
      <p>{level.title}</p><div className="screen-stat-row"><div><strong>{result.seconds}s</strong><span>Time</span></div><div><strong>+{result.xp}</strong><span>XP</span></div><div><strong>+{result.points}</strong><span>Parity Points</span></div></div>
      <StoryRewardChoices level={level} />
      <button className="worm-story-primary" onClick={level.id < WORM_STORY_LEVELS.at(-1).id ? onNext : onLevels}>{level.id < WORM_STORY_LEVELS.at(-1).id ? 'Next level' : "Levels"} <span>→</span></button>
      <button className="worm-story-secondary" onClick={onRetry}>Play again</button><button className="worm-story-secondary" onClick={onLevels}>Levels</button>
    </div>
  </div>;
}
