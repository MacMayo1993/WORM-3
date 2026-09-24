import { wizardPaperBackground } from './WizardChrome.jsx';
import { ArcadeHeader, ArcadeAction, ArcadeArtwork } from '../ui/ArcadeChrome.jsx';
import './wormReady.css';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { WORM_STORY_CHAPTERS, nextStoryLevel, storyStars, storyUnlocked, storyChecklist, storyChapter, storyLaunchSettings } from '../../worm/story/levels.js';
import { MODE_THEMES } from '../../utils/modeThemes.js';
import { HEADING_FONT, UI_FONT, Z } from '../../utils/uiTheme.js';
import { StoryRewardChoices } from '../../worm/story/StoryCards.jsx';
import StoryWorldPreview from '../../worm/story/StoryWorldPreview.jsx';
import { STORY_WORLDS, storyAppearance, storyViewLabel } from '../../worm/story/worlds.js';
import { COLOR_SCHEMES } from '../../utils/colorSchemes.js';
import { getSkin } from '../../worm/wormCosmeticsData.js';
import WormProfile from './WormProfile.jsx';
import { wormMenuFeedback } from './wormMenuFeedback.js';
import './modeWizard.css';
import './wormStory.css';
const FreePlaySetup = React.lazy(() => import('./WormModeSetupWizard.jsx'));

export default function WormEntryScreen({ onComplete, onCancel, initialSettings, initialPage = 'choice', onSettings }) {
  const [page, setPage] = useState(initialPage);
  const [path, setPath] = useState('levels');
  const progress = useGameStore(s => s.playerProgress);
  const wormSkin = useGameStore(s => s.wormSkin);
  const settingsOpen = useGameStore(s => s.showSettings);
  const [selected, setSelected] = useState(() => nextStoryLevel(progress).id);
  const root = useRef(null);
  const back = () => { wormMenuFeedback(); if (page === 'choice') onCancel(); else setPage('choice'); };
  useEffect(() => {
    if (settingsOpen) return;
    const prior = document.activeElement;
    root.current?.querySelector('button')?.focus();
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (page === 'choice') onCancel(); else setPage('choice'); }
      if (e.key === 'Tab' && root.current) {
        const buttons = [...root.current.querySelectorAll('button:not(:disabled), summary')];
        const first = buttons[0], last = buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('keydown', key, true); prior?.focus?.(); };
  }, [page, onCancel, settingsOpen]);
  if (page === 'free') return <Suspense fallback={<div className="worm-story-loading" role="status">Loading…</div>}><FreePlaySetup onComplete={onComplete} onCancel={() => setPage('choice')} initialSettings={initialSettings} /></Suspense>;
  const chapter = storyChapter(selected);
  const level = chapter.levels.find(item => item.id === selected);
  const chapterStars = chapter.levels.reduce((n, item) => n + storyStars(progress, item.id), 0);
  const size = level.cubeSize ?? 5, view = storyViewLabel(level.id);
  // Opening a chapter lands on its next unplayed level, or its first.
  const openChapter = next => { wormMenuFeedback(); setSelected((next.levels.find(item => storyUnlocked(progress, item.id) && !storyStars(progress, item.id)) ?? next.levels[0]).id); };
  const launch = () => { wormMenuFeedback(); onComplete({ ...initialSettings, ...storyAppearance(level.id), perFaceStyles: STORY_WORLDS[level.id].styles,
    wormColor: getSkin(wormSkin).body, ...storyLaunchSettings(level) }); };
  const theme = { '--mode-accent': MODE_THEMES.worm.accent, '--mode-shadow': MODE_THEMES.worm.shadow, zIndex: Z.MODAL };
  if (page === 'choice') return <section ref={root} className="worm-ready arcade-paper" role="dialog" aria-modal="true" aria-labelledby="worm-entry-title" style={theme}>
    <div className="worm-ready-shell">
      <ArcadeHeader onSettings={onSettings} />
      <nav className="worm-ready-heading"><button className="arcade-icon-button" onClick={back} aria-label="Back to modes">←</button><h1 id="worm-entry-title">WORM</h1></nav>
      <div className="worm-ready-content">
      <div className="worm-ready-hero"><ArcadeArtwork mode="worm" /></div>
      <div className="worm-ready-tabs" role="tablist" aria-label="WORM play style">
        {['levels', 'free'].map(value => <button key={value} role="tab" id={`worm-${value}-tab`} aria-selected={path === value} aria-controls="worm-ready-panel" tabIndex={path === value ? 0 : -1}
          onClick={() => { wormMenuFeedback(); setPath(value); }} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const target = e.key === 'Home' ? 'levels' : e.key === 'End' ? 'free' : path === 'levels' ? 'free' : 'levels'; setPath(target); document.getElementById(`worm-${target}-tab`)?.focus(); } }}>
          {value === 'levels' ? 'Levels' : 'Free Play'}
        </button>)}
      </div>
      <div className="worm-ready-objective" id="worm-ready-panel" role="tabpanel" aria-labelledby={`worm-${path}-tab`}>
        <strong>{path === 'levels' ? `Level ${level.id}` : 'Free Play'}</strong>
        <span>{path === 'levels' ? level.goal : 'Choose your cube, style, and challenge.'}</span>
      </div>
      <div className="worm-ready-options">
        <div className="worm-ready-look" aria-label={`Level world: ${STORY_WORLDS[level.id].name}`}><img src={`${import.meta.env.BASE_URL}images/arcade/cube.webp`} alt="" width="60" height="60" /><div><small>{path === 'levels' ? STORY_WORLDS[level.id].name : 'Your next adventure'}</small><span>{path === 'levels' ? `${size}×${size} · ${Math.floor(level.limit / 60)}:${String(level.limit % 60).padStart(2, '0')} to finish` : 'No level objectives'}</span></div></div>
        <button className="arcade-link" onClick={() => { wormMenuFeedback(); setPage('customize'); }}>Customize</button>
      </div>
      </div>
      <footer className="worm-ready-footer">
        <ArcadeAction onClick={path === 'levels' ? launch : () => { wormMenuFeedback(); setPage('free'); }}>{path === 'levels' ? 'Start level' : 'Set up Free Play'}</ArcadeAction>
        <button className="arcade-link" onClick={() => { wormMenuFeedback(); setPage('story'); }}>All levels</button>
      </footer>
    </div>
  </section>;
  return <div ref={root} className="mode-wizard worm-entry" role="dialog" aria-modal="true" aria-labelledby="worm-entry-title"
    style={{ '--mode-accent': MODE_THEMES.worm.accent, '--mode-ink': MODE_THEMES.worm.shadow, '--story-display': HEADING_FONT, fontFamily: UI_FONT, zIndex: Z.MODAL }}>
    <div className="worm-entry-sheet" style={wizardPaperBackground}>
      <div className="worm-entry-brand"><ArcadeHeader onSettings={onSettings} /></div>
      <nav className="worm-entry-nav"><button onClick={back} aria-label="Back to WORM choices">← Back</button><span>WORM</span></nav>
      <div className="worm-entry-scroll">
        <header className="worm-entry-heading"><h1 id="worm-entry-title">{page === 'customize' ? 'Your worm' : 'Levels'}</h1></header>
        {page === 'customize' ? <WormProfile defaultExpanded /> : <>
          <div className="worm-chapter-tabs" role="group" aria-label="Chapters">{WORM_STORY_CHAPTERS.map(item => {
            const open = storyUnlocked(progress, item.levels[0].id);
            const stars = item.levels.reduce((n, l) => n + storyStars(progress, l.id), 0);
            return <button key={item.id} type="button" disabled={!open} aria-pressed={item.id === chapter.id}
              aria-label={`Chapter ${item.id}: ${item.title}${open ? `, ${stars} of ${item.levels.length * 3} stars` : ', locked'}`}
              className={item.id === chapter.id ? 'selected' : ''} onClick={() => openChapter(item)}>
              <small>Chapter {item.id}</small><strong>{item.title}</strong><span aria-hidden="true">{open ? `${stars} ★` : 'Locked'}</span>
            </button>;
          })}</div>
          <p className="worm-chapter-blurb">{chapter.blurb}</p>
          <div className="worm-chapter-progress"><span>Chapter {chapter.id} stars</span><strong>{chapterStars} / {chapter.levels.length * 3} ★</strong><progress value={chapterStars} max={chapter.levels.length * 3} aria-label="Chapter stars" /></div>
          <div className="worm-level-grid">{chapter.levels.map(item => {
            const unlocked = storyUnlocked(progress, item.id), stars = storyStars(progress, item.id);
            return <button key={item.id} disabled={!unlocked} title={item.title} aria-pressed={selected === item.id} aria-label={`Level ${item.id}: ${item.title}${unlocked ? `, ${stars} stars` : ', locked'}`} onClick={() => { wormMenuFeedback(); setSelected(item.id); }} className={selected === item.id ? 'selected' : ''}
              style={{ '--world-color': COLOR_SCHEMES[STORY_WORLDS[item.id].palette][1] }}>
              <StoryWorldPreview levelId={item.id} compact />
              <span className="worm-level-number">{String(item.id).padStart(2, '0')}</span><small aria-hidden="true">{unlocked ? `${'★'.repeat(stars)}${'☆'.repeat(3-stars)}` : '—'}</small>
            </button>;
          })}</div>
          <section className="worm-level-detail" aria-label="Selected level"><div className="worm-path-kicker">Level {String(level.id).padStart(2, '0')} · {STORY_WORLDS[level.id].name}</div><h2>{level.title}</h2>
            <p className="worm-level-board">{size}×{size} cube{view ? ` · ${view}` : ''}</p>
            <StoryWorldPreview levelId={level.id} />
            <ul className="worm-level-goals" aria-label="Level goals">{storyChecklist(level).map(goal => <li key={goal.key}><b>{goal.target}</b><span>{goal.label}</span></li>)}</ul>
            <p className="worm-story-limit">{Math.floor(level.limit / 60)}:{String(level.limit % 60).padStart(2, '0')} to finish{level.rotateEvery ? ` · Turns every ${level.rotateEvery}s` : ''}</p>
            <details><summary>Goals & Rewards</summary><p>{level.goal}</p><ul><li>★ Finish before time runs out</li><li>★ Finish within {level.par}s</li><li>★ No tail cuts</li></ul></details>
            <div className="worm-level-reward"><span>First Win</span><strong>{level.rewardLabel || `${level.points} Parity Points`} + 50 XP</strong></div>
            <StoryRewardChoices level={level} />
            <div className="worm-level-profile"><WormProfile /></div>
            <button className="worm-story-primary" onClick={launch}>{storyStars(progress, level.id) ? "Play again" : 'Play level'} <span>→</span></button>

          </section>
        </>}
      </div>
    </div>
  </div>;
}
