import StoryStarRequirements from './StoryStarRequirements.jsx';
import ModeArtwork from '../../components/ui/ModeArtwork.jsx';
import React, { useEffect, useId, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStoreItem } from '../../utils/storeCatalog.js';
import { UI_FONT, Z } from '../../utils/uiTheme.js';
import { storyLevel, storyChecklist, storyStars, WORM_STORY_LEVELS, storyChapterId, storyChapterIndex, isChapterFinale, STORY_CHAPTER_SIZE } from './levels.js';
import { feel, resumeFeel } from '../../utils/feel.js';
import WormPreviewCanvas from '../../3d/WormPreviewCanvas.jsx';
import { getWormCharacter } from '../wormCharacterData.js';
import { storyNarrative } from './narrative.js';
import '../../components/screens/wormStory.css';

// "Chapter 2 · Level 4 / 10": levels are numbered globally but read within their chapter.
const chapterLine = id => `Chapter ${storyChapterId(id)} · Level ${storyChapterIndex(id)} / ${STORY_CHAPTER_SIZE}`;

// A brief line in existing reading surfaces, never another modal or live HUD row.
export function StoryMobiNote({ levelId, complete = false }) {
  const story = storyNarrative(levelId);
  if (!story) return null;
  return <p className="worm-story-mobi" aria-label={complete ? 'Mobi’s field notes' : 'Mobi’s briefing'}>
    <b>Mobi</b>{' '}{complete ? story.debrief : story.briefing}
  </p>;
}

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

export function StoryObjectiveCard({ compact = false }) {
  const state = useGameStore(useShallow(s => ({ id: s.wormStoryLevel, started: s.wormStoryStarted,
    result: s.wormStoryResult, checklist: s.wormStoryChecklist, runId: s.wormRunId, alive: s.wormAlive, paused: s.wormPaused })));
  const level = storyLevel(state.id);
  const live = state.started && state.checklist?.runId === state.runId && state.checklist.levelId === level?.id ? state.checklist : null;
  const goals = live?.goals ?? (level ? storyChecklist(level) : []);
  const previous = useRef(null);
  const [celebration, setCelebration] = useState(null);
  const [expandedRun, setExpandedRun] = useState(null);
  const trackerRef = useRef(null);
  const toggleRef = useRef(null);
  const detailsId = useId();
  const runKey = `${state.runId}:${state.id}`;
  const expanded = expandedRun === runKey && !state.paused;
  useEffect(() => {
    if (state.paused) setExpandedRun(null);
  }, [state.paused]);
  useEffect(() => {
    if (!compact || !expanded) return;
    const dismiss = event => {
      if (!trackerRef.current?.contains(event.target)) setExpandedRun(null);
    };
    const escape = event => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setExpandedRun(null);
      toggleRef.current?.focus();
    };
    document.addEventListener('pointerdown', dismiss);
    window.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', escape, true);
    };
  }, [compact, expanded]);
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
  if (compact) {
    const next = goals.find(goal => !goal.done);
    const headline = live?.canFinish ? 'Tasks complete' : recent ? `✓ ${recent.label}`
      : live?.settling ? 'Land and clear your tail to finish'
        : next ? `${next.label} ${next.value}/${next.target}` : `Tasks ${completed}/${goals.length}`;
    return <section ref={trackerRef} className={`worm-story-tracker${expanded ? '' : ' is-collapsed'}`} aria-label="Level tasks">
      <div className={`worm-story-summary${recent ? ' worm-task-confirmed' : ''}`}>
        <span className="worm-story-glance-level" title={level.title}>L{level.id}</span>
        <span className="worm-story-next" title={headline}>{headline}</span>
        <span className="worm-story-glance-clock" data-urgent={seconds <= 30} aria-label={`${seconds} seconds left`}>{clock}</span>
        {live?.canFinish && <button type="button" className="worm-story-finish" aria-label={`Finish with ${live.starGoals.stars} stars`} onClick={() => useGameStore.getState().finishWormStory()}>
          Finish · {live.starGoals.stars}★
        </button>}
        <button ref={toggleRef} type="button" className="worm-story-glance worm-hud-chip"
          onClick={() => setExpandedRun(expanded ? null : runKey)} aria-expanded={expanded} aria-controls={detailsId}
          aria-label={`Level ${level.id}: ${level.title}. ${completed} of ${goals.length} tasks complete.${next && !live?.settling ? ` Next: ${next.label}, ${next.value} of ${next.target}.` : ''} ${expanded ? 'Hide' : 'Show'} goals and star requirements.`}>
          <span>Goals <b>{completed}/{goals.length}</b></span>
          <span className="worm-story-tracker-chevron" aria-hidden="true">{expanded ? '▴' : '▾'}</span>
        </button>
        <span className="worm-hud-sr" role="status">{recent ? `${recent.label} complete.` : ''}</span>
      </div>
      {expanded && <div id={detailsId} className="worm-story-details" role="region" aria-label="Goals and star requirements" tabIndex={0}>
        <strong className="worm-story-details-title">L{level.id} · {level.title}</strong>
        {live?.settling && <p className="worm-story-live-hint">Land and clear your tail to finish</p>}
        <ul className="worm-story-live" aria-label="Task checklist">
          {goals.map(goal => <li key={goal.key} data-done={goal.done} aria-label={`${goal.label}: ${goal.value} of ${goal.target}${goal.done ? ', complete' : ''}`}>
            <span className="worm-story-live-label">{goal.label}</span>
            <b aria-hidden="true">{goal.value}/{goal.target}</b>
            <i className="worm-story-live-bar" aria-hidden="true"><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, goal.value / goal.target))})` }} /></i>
          </li>)}
        </ul>
        <StoryStarRequirements level={level} progress={live?.starGoals} />
        {live?.hint && !live.settling && <p className="worm-story-live-hint">{live.hint}</p>}
      </div>}
    </section>;
  }

  return <section className="worm-story-card" aria-label="Story objective">
    <small>{chapterLine(level.id)}</small><strong>{level.title}</strong>
    <StoryMobiNote levelId={level.id} />
    <ul className="worm-story-checklist" aria-label="Level tasks">{goals.map(goal => <li key={goal.key} className={goal.done ? 'is-complete' : ''}
      aria-label={`${goal.label}: ${goal.value} of ${goal.target}${goal.done ? ', complete' : ''}`}>
      <span className="worm-story-check" aria-hidden="true">{goal.done ? '✓' : '○'}</span>
      <span className="worm-story-task">{goal.label}</span><b aria-hidden="true">{goal.value}/{goal.target}</b>
    </li>)}</ul>
    <StoryStarRequirements level={level} progress={live?.starGoals} />
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
  const last = level.id === WORM_STORY_LEVELS.at(-1).id, finale = isChapterFinale(level.id);
  const heading = last ? 'Story complete' : finale ? 'Chapter complete' : 'Level complete';
  const primary = last ? 'Levels' : finale ? `Start chapter ${storyChapterId(level.id) + 1}` : 'Next level';
  return <div ref={ref} className="worm-story-result" role="dialog" aria-modal="true" aria-labelledby="worm-story-result-title" style={{ zIndex: Z.MODAL, fontFamily: UI_FONT }}>
    <div className="worm-story-result-sheet"><ModeArtwork mode="success" className="screen-results-art" /><small>{chapterLine(level.id)}</small><h2 id="worm-story-result-title">{heading}</h2>
      <div className="worm-story-result-stars" aria-label={`${result.stars} out of 3 stars`}>{[0,1,2].map(i => <span key={i} data-earned={i < result.stars} style={{ '--star-index': i }} aria-hidden="true">★</span>)}</div>
      <p>{level.title}</p>
      <StoryMobiNote levelId={level.id} complete />
      <div className="screen-stat-row"><div><strong>{result.seconds}s</strong><span>Time</span></div><div><strong>+{result.xp}</strong><span>XP</span></div><div><strong>+{result.points}</strong><span>Parity Points</span></div></div>
      {result.unlockedCharacter && <div className="worm-story-unlock" role="status">
        <WormPreviewCanvas size={84} characterId={result.unlockedCharacter} skinId="slime" hatId="none" framing="body" />
        <span><small>New worm unlocked</small><strong>{getWormCharacter(result.unlockedCharacter).label}</strong>
          <em>{getWormCharacter(result.unlockedCharacter).type} · equip it from Your Worm</em></span>
      </div>}
      <StoryStarRequirements level={level} result={result} />
      <StoryRewardChoices level={level} />
      <button className="worm-story-primary" onClick={last ? onLevels : onNext}>{primary} <span>→</span></button>
      <button className="worm-story-secondary" onClick={onRetry}>Play again</button><button className="worm-story-secondary" onClick={onLevels}>Levels</button>
    </div>
  </div>;
}
