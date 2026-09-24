import ModeArtwork from '../../components/ui/ModeArtwork.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStoreItem } from '../../utils/storeCatalog.js';
import { UI_FONT, Z } from '../../utils/uiTheme.js';
import { storyLevel, storyChecklist, storyStars, WORM_STORY_LEVELS, storyChapterId, storyChapterIndex, isChapterFinale, STORY_CHAPTER_SIZE } from './levels.js';
import { feel, resumeFeel } from '../../utils/feel.js';
import '../../components/screens/wormStory.css';

// "Chapter 2 · Level 4 / 10": levels are numbered 1-40 globally but read within their chapter.
const chapterLine = id => `Chapter ${storyChapterId(id)} · Level ${storyChapterIndex(id)} / ${STORY_CHAPTER_SIZE}`;

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

// How many unfinished tasks the in-play tracker lists before "+N more".
const TRACKER_ROWS = 3;
const TRACKER_PREF_KEY = 'worm3_story_tracker_collapsed';
const readTrackerPref = () => { try { return localStorage.getItem(TRACKER_PREF_KEY) !== '1'; } catch { return true; } };
const writeTrackerPref = expanded => { try { localStorage.setItem(TRACKER_PREF_KEY, expanded ? '0' : '1'); } catch { /* private mode */ } };

export function StoryObjectiveCard({ compact = false }) {
  const state = useGameStore(useShallow(s => ({ id: s.wormStoryLevel, started: s.wormStoryStarted,
    result: s.wormStoryResult, checklist: s.wormStoryChecklist, runId: s.wormRunId, alive: s.wormAlive, paused: s.wormPaused })));
  const level = storyLevel(state.id);
  const live = state.started && state.checklist?.runId === state.runId && state.checklist.levelId === level?.id ? state.checklist : null;
  const goals = live?.goals ?? (level ? storyChecklist(level) : []);
  const previous = useRef(null);
  const [celebration, setCelebration] = useState(null);
  const [expanded, setExpanded] = useState(readTrackerPref);
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
  if (compact) {
    // Unfinished tasks stay on screen during play, in authored order, so the
    // player never has to pause to learn what is left. The header collapses the
    // list to the single next task; the full checklist is still in the pause menu.
    const open = goals.filter(goal => !goal.done);
    const shown = live?.settling ? [] : expanded ? open.slice(0, TRACKER_ROWS) : open.slice(0, 1);
    const hidden = live?.settling ? 0 : open.length - shown.length;
    const toggle = () => setExpanded(value => { writeTrackerPref(!value); return !value; });
    return <section className={`worm-story-tracker${expanded ? '' : ' is-collapsed'}`} aria-label="Level tasks">
      <button type="button" className={`worm-story-glance worm-hud-chip${recent ? ' worm-task-confirmed' : ''}`}
        onClick={toggle} aria-expanded={expanded}
        aria-label={`Level ${level.id}: ${level.title}. ${completed} of ${goals.length} tasks complete. ${seconds} seconds left. ${expanded ? 'Hide' : 'Show'} task list.`}
        title={level.title}>
        <span className="worm-story-glance-level">L{level.id}</span>
        <span className="worm-story-glance-progress">
          <span>{recent ? `✓ ${recent.label}` : `Tasks ${completed}/${goals.length}`}</span>
          <span className="worm-story-goal-bars" aria-hidden="true">{goals.map(goal => <i key={goal.key} data-done={goal.done}>
            <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, goal.value / goal.target))})` }} />
          </i>)}</span>
        </span>
        <span className="worm-story-glance-clock" data-urgent={seconds <= 30}>{clock}</span>
        <span className="worm-story-tracker-chevron" aria-hidden="true">{expanded ? '▴' : '▾'}</span>
        <span className="worm-hud-sr" role="status">{recent ? `${recent.label} complete.` : ''}</span>
      </button>
      <ul className="worm-story-live">
        {live?.settling ? <li className="is-settling"><span className="worm-story-live-label">Land and clear your tail to finish</span></li>
          : shown.map(goal => <li key={goal.key} aria-label={`${goal.label}: ${goal.value} of ${goal.target}`}>
            <span className="worm-story-live-label">{goal.label}</span>
            <b aria-hidden="true">{goal.value}/{goal.target}</b>
            <i className="worm-story-live-bar" aria-hidden="true"><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, goal.value / goal.target))})` }} /></i>
          </li>)}
        {hidden > 0 && expanded && <li className="worm-story-live-more">+{hidden} more · full list in Pause</li>}
      </ul>
      {expanded && live?.hint && !live.settling ? <p className="worm-story-live-hint">{live.hint}</p> : null}
    </section>;
  }
  return <section className="worm-story-card" aria-label="Story objective">
    <small>{chapterLine(level.id)}</small><strong>{level.title}</strong>
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
  const last = level.id === WORM_STORY_LEVELS.at(-1).id, finale = isChapterFinale(level.id);
  const heading = last ? 'Story complete' : finale ? 'Chapter complete' : 'Level complete';
  const primary = last ? 'Levels' : finale ? `Start chapter ${storyChapterId(level.id) + 1}` : 'Next level';
  return <div ref={ref} className="worm-story-result" role="dialog" aria-modal="true" aria-labelledby="worm-story-result-title" style={{ zIndex: Z.MODAL, fontFamily: UI_FONT }}>
    <div className="worm-story-result-sheet"><ModeArtwork mode="success" className="screen-results-art" /><small>{chapterLine(level.id)}</small><h2 id="worm-story-result-title">{heading}</h2>
      <div className="worm-story-result-stars" aria-label={`${result.stars} out of 3 stars`}>{[0,1,2].map(i => <span key={i} data-earned={i < result.stars} style={{ '--star-index': i }} aria-hidden="true">★</span>)}</div>
      <p>{level.title}</p><div className="screen-stat-row"><div><strong>{result.seconds}s</strong><span>Time</span></div><div><strong>+{result.xp}</strong><span>XP</span></div><div><strong>+{result.points}</strong><span>Parity Points</span></div></div>
      <StoryRewardChoices level={level} />
      <button className="worm-story-primary" onClick={last ? onLevels : onNext}>{primary} <span>→</span></button>
      <button className="worm-story-secondary" onClick={onRetry}>Play again</button><button className="worm-story-secondary" onClick={onLevels}>Levels</button>
    </div>
  </div>;
}
