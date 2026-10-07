import { wizardPaperBackground } from './WizardChrome.jsx';
import WormWordmark from '../branding/WormWordmark.jsx';
import WormPathArtwork from '../ui/WormPathArtwork.jsx';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { WORM_STORY_CHAPTERS, nextStoryLevel, storyStars, storyUnlocked, storyChecklist, storyChapter, storyLaunchSettings, storyChapterIndex, isChapterFinale } from '../../worm/story/levels.js';
import { chapterWorldColor, stageCode } from '../../worm/story/levelMapLayout.js';
import { MODE_THEMES } from '../../utils/modeThemes.js';
import { HEADING_FONT, UI_FONT, Z } from '../../utils/uiTheme.js';
import { StoryRewardChoices } from '../../worm/story/StoryCards.jsx';
import StoryWorldPreview from '../../worm/story/StoryWorldPreview.jsx';
import { STORY_WORLDS, storyAppearance, storyViewLabel } from '../../worm/story/worlds.js';
import { getSkin } from '../../worm/wormCosmeticsData.js';
import WormProfile from './WormProfile.jsx';
import StoryChapterMap from './StoryChapterMap.jsx';
import { wormMenuFeedback } from './wormMenuFeedback.js';
import './modeWizard.css';
import './wormStory.css';
import './wormLevelMap.css';
import '../ui/pieceKey.css';
import '../ui/pathSelect.css';
const FreePlaySetup = React.lazy(() => import('./WormModeSetupWizard.jsx'));

export default function WormEntryScreen({ onComplete, onCancel, initialSettings, initialPage = 'choice' }) {
  const [page, setPage] = useState(initialPage);
  const progress = useGameStore(s => s.playerProgress);
  const wormSkin = useGameStore(s => s.wormSkin);
  const [selected, setSelected] = useState(() => nextStoryLevel(progress).id);
  const root = useRef(null);
  const chapterTabs = useRef(null);
  useEffect(() => {
    const nav = chapterTabs.current, active = nav?.querySelector('[aria-pressed="true"]');
    if (!active) return;
    // Reveal the resumed chapter without scrolling the entire level sheet.
    if (active.offsetLeft < nav.scrollLeft) nav.scrollLeft = active.offsetLeft;
    else if (active.offsetLeft + active.offsetWidth > nav.scrollLeft + nav.clientWidth)
      nav.scrollLeft = active.offsetLeft + active.offsetWidth - nav.clientWidth;
  }, [page, selected]);
  const back = () => { wormMenuFeedback(); if (page === 'choice') onCancel(); else setPage('choice'); };
  useEffect(() => {
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
  }, [page, onCancel]);
  if (page === 'free') return <Suspense fallback={<div className="worm-story-loading" role="status">Loading…</div>}><FreePlaySetup onComplete={onComplete} onCancel={() => setPage('choice')} initialSettings={initialSettings} /></Suspense>;
  const chapter = storyChapter(selected);
  const level = chapter.levels.find(item => item.id === selected);
  const chapterStars = chapter.levels.reduce((n, item) => n + storyStars(progress, item.id), 0);
  const size = level.cubeSize ?? 5, view = storyViewLabel(level.id);
  // Opening a chapter lands on its next unplayed level, or its first.
  const openChapter = next => { wormMenuFeedback(); setSelected((next.levels.find(item => storyUnlocked(progress, item.id) && !storyStars(progress, item.id)) ?? next.levels[0]).id); };
  const launch = () => { wormMenuFeedback(); onComplete({ ...initialSettings, ...storyAppearance(level.id), perFaceStyles: STORY_WORLDS[level.id].styles,
    wormColor: getSkin(wormSkin).body, ...storyLaunchSettings(level) }); };
  if (page === 'choice') {
    // Where the player's campaign stands, so Levels says where it will take them.
    const next = nextStoryLevel(progress);
    const nextChapter = storyChapter(next.id);
    const allLevels = WORM_STORY_CHAPTERS.flatMap(item => item.levels);
    const allStars = allLevels.reduce((n, item) => n + storyStars(progress, item.id), 0);
    return <div ref={root} className="mode-wizard worm-entry path-select" role="dialog" aria-modal="true" aria-labelledby="worm-entry-title"
      style={{ '--mode-accent': MODE_THEMES.worm.accent, '--mode-ink': MODE_THEMES.worm.shadow, fontFamily: UI_FONT, zIndex: Z.MODAL }}>
      <div className="path-select-page">
        <header className="path-select-head">
          <button className="piece-icon" onClick={back} aria-label="Back to modes"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 L7 12 L15 20" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
          <span className="path-select-brand" aria-hidden="true"><WormWordmark /></span>
          <span className="path-select-spacer" aria-hidden="true" />
        </header>
        <h1 id="worm-entry-title" className="path-select-title">Choose how to play</h1>
        <div className="worm-path-split path-select-cards">
          <button className="worm-path-card worm-path-story path-select-card piece piece--glint" style={{ '--piece-color': MODE_THEMES.worm.accent }}
            aria-label="Levels" onClick={() => { wormMenuFeedback(); setPage('story'); }}>
            <span className="piece-face">
              <span className="path-select-art"><WormPathArtwork levels /></span>
              <span className="path-select-copy">
                <span className="worm-path-cta path-select-cta piece-trailer">Levels <b aria-hidden="true">→</b></span>
                <span className="path-select-note">Chapter {nextChapter.id} · {nextChapter.title}</span>
                <span className="path-select-meta"><span aria-label={`${allStars} of ${allLevels.length * 3} stars`}>★ {allStars}/{allLevels.length * 3}</span>
                  <span>Next: {next.title}</span></span>
              </span>
            </span>
          </button>
          <button className="worm-path-card worm-path-free path-select-card piece" style={{ '--piece-color': MODE_THEMES.cube.accent }}
            aria-label="Free Play" onClick={() => { wormMenuFeedback(); setPage('free'); }}>
            <span className="piece-face">
              <span className="path-select-art"><WormPathArtwork /></span>
              <span className="path-select-copy">
                <span className="worm-path-cta path-select-cta piece-trailer">Free Play <b aria-hidden="true">→</b></span>
                <span className="path-select-note">Your cube, your rules</span>
                <span className="path-select-meta"><span>Pick the size, scene and speed</span></span>
              </span>
            </span>
          </button>
        </div>
        <WormProfile />
      </div>
    </div>;
  }
  const chapterIndex = WORM_STORY_CHAPTERS.indexOf(chapter);
  const prevChapter = WORM_STORY_CHAPTERS[chapterIndex - 1], nextChapter = WORM_STORY_CHAPTERS[chapterIndex + 1];
  const chapterOpen = item => storyUnlocked(progress, item.levels[0].id);
  const world = chapterWorldColor(chapter.id);
  const levelStars = storyStars(progress, level.id), finale = isChapterFinale(level.id);
  const totalStars = WORM_STORY_CHAPTERS.reduce((n, item) => n + item.levels.reduce((m, l) => m + storyStars(progress, l.id), 0), 0);
  const totalMax = WORM_STORY_CHAPTERS.reduce((n, item) => n + item.levels.length * 3, 0);
  const clock = `${Math.floor(level.limit / 60)}:${String(level.limit % 60).padStart(2, '0')}`;
  const starRules = ['Finish before time runs out', `Finish within ${level.par}s`, 'No tail cuts'];
  return <div ref={root} className="mode-wizard worm-entry worm-levels" role="dialog" aria-modal="true" aria-labelledby="worm-entry-title"
    style={{ '--mode-accent': MODE_THEMES.worm.accent, '--mode-ink': MODE_THEMES.worm.shadow, '--story-display': HEADING_FONT,
      '--world': world.color, '--world-ink': world.ink, fontFamily: UI_FONT, zIndex: Z.MODAL }}>
    <div className="worm-entry-sheet" style={wizardPaperBackground}>
      <nav className="worm-entry-nav"><button className="piece-icon" onClick={back} aria-label="Back to WORM choices"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 L7 12 L15 20" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg></button><span className="worm-levels-brand"><WormWordmark inline /></span>
        <h1 id="worm-entry-title" className="worm-levels-title">Levels</h1>
        <span className="worm-levels-total" aria-label={`${totalStars} of ${totalMax} stars`}><b aria-hidden="true">★</b>{totalStars}<small>/{totalMax}</small></span></nav>
      <div className="worm-levels-body">
        <div className="worm-levels-world">
          <header className="worm-world-banner">
            <button type="button" className="worm-world-arrow" aria-label="Previous chapter" disabled={!prevChapter}
              onClick={() => openChapter(prevChapter)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8" /></svg></button>
            <div className="worm-world-ribbon" key={chapter.id}>
              <small>Chapter {chapter.id} of {WORM_STORY_CHAPTERS.length}</small>
              <strong>{chapter.title}</strong>
            </div>
            <button type="button" className="worm-world-arrow" aria-label="Next chapter" disabled={!nextChapter || !chapterOpen(nextChapter)}
              onClick={() => openChapter(nextChapter)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 4 8 8-8 8" /></svg></button>
          </header>
          <div ref={chapterTabs} className="worm-chapter-tabs" role="group" aria-label="Chapters">{WORM_STORY_CHAPTERS.map(item => {
            const open = chapterOpen(item);
            const stars = item.levels.reduce((n, l) => n + storyStars(progress, l.id), 0);
            const done = item.levels.every(l => storyStars(progress, l.id));
            return <button key={item.id} type="button" disabled={!open} aria-pressed={item.id === chapter.id}
              aria-label={`Chapter ${item.id}: ${item.title}${open ? `, ${stars} of ${item.levels.length * 3} stars` : ', locked'}`}
              className={`${item.id === chapter.id ? 'selected' : ''}${done ? ' is-done' : ''}`} title={open ? item.title : 'Locked'}
              style={{ '--medal': chapterWorldColor(item.id).color, '--medal-ink': chapterWorldColor(item.id).ink }} onClick={() => openChapter(item)}>
              <strong aria-hidden="true">{open ? item.id : <svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" strokeWidth="2.6" /></svg>}</strong>
              {done && <i aria-hidden="true">★</i>}
            </button>;
          })}</div>
          <div className="worm-map-board" key={chapter.id}>
            <StoryChapterMap chapter={chapter} progress={progress} selected={selected} wormColor={getSkin(wormSkin).body}
              onSelect={id => { wormMenuFeedback(); setSelected(id); }} />
            <div className="worm-chapter-progress">
              <p className="worm-chapter-blurb">{chapter.blurb}</p>
              <span className="worm-chapter-meter"><b aria-hidden="true">★</b><strong>{chapterStars} / {chapter.levels.length * 3}</strong>
                <progress value={chapterStars} max={chapter.levels.length * 3} aria-label="Chapter stars" /></span>
            </div>
          </div>
        </div>
        <section className="worm-level-detail" aria-label="Selected level" key={level.id}>
          <div className="worm-stage-ribbon"><span className="worm-path-kicker">Stage {stageCode(chapter.id, storyChapterIndex(level.id))} · {STORY_WORLDS[level.id].name}</span>
            {finale && <em>Finale</em>}</div>
          <h2>{level.title}</h2>
          {level.subtitle && <p className="worm-stage-subtitle">{level.subtitle}</p>}
          <div className="worm-stage-stars" aria-label={`${levelStars} of 3 stars earned`}>{starRules.map((rule, n) =>
            <span key={rule} data-earned={n < levelStars || undefined}><b aria-hidden="true">★</b><small>{rule}</small></span>)}</div>
          <div className="worm-stage-chips">
            <span className="worm-stage-chip"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 21 7.3v9.4L12 21.5 3 16.7V7.3zM3 7.3l9 4.8 9-4.8M12 12.1v9.4" /></svg><span className="worm-level-board">{size}×{size} cube{view ? ` · ${view}` : ''}</span></span>
            <span className="worm-stage-chip"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8.5" /><path d="M12 8.5V13l3 2M9.5 2.5h5" /></svg><span className="worm-story-limit">{clock} to finish</span></span>
            {level.rotateEvery ? <span className="worm-stage-chip"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" /></svg><span>Turns every {level.rotateEvery}s</span></span> : null}
          </div>
          <StoryWorldPreview levelId={level.id} />
          <h3 className="worm-stage-heading">Mission</h3>
          <p className="worm-stage-goal">{level.goal}</p>
          <ul className="worm-level-goals" aria-label="Level goals">{storyChecklist(level).map(goal => <li key={goal.key}><b>{goal.target}</b><span>{goal.label}</span></li>)}</ul>
          <div className="worm-level-reward"><span className="worm-stage-chest" aria-hidden="true"><svg viewBox="0 0 32 28"><path d="M3 12h26v13H3z" /><path d="M3 12V9a6 6 0 0 1 6-6h14a6 6 0 0 1 6 6v3" /><path d="M13 10h6v6h-6z" /></svg></span>
            <span><small>{levelStars ? 'First clear · claimed' : 'First clear reward'}</small><strong>{level.rewardLabel || `${level.points} Parity Points`} + 50 XP</strong></span></div>
          <StoryRewardChoices level={level} />
          <div className="worm-level-profile"><WormProfile /></div>
        </section>
        <div className="worm-stage-play">
          <button className="worm-story-primary piece piece--bar piece--glint" style={{ '--piece-color': MODE_THEMES.worm.accent }} onClick={launch}>
            <span className="piece-face"><span className="piece-trailer">{levelStars ? 'Play again' : 'Play level'}</span>{' '}<small className="worm-stage-play-code" aria-hidden="true">{stageCode(chapter.id, storyChapterIndex(level.id))}</small>{' '}<b className="piece-trailer" aria-hidden="true">→</b></span>
          </button>
        </div>
      </div>
    </div>
  </div>;
}
