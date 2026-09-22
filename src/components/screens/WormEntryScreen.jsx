import { wizardPaperBackground } from './WizardChrome.jsx';
import WormWordmark from '../branding/WormWordmark.jsx';
import WormPathArtwork from '../ui/WormPathArtwork.jsx';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { WORM_STORY_LEVELS, nextStoryLevel, storyStars, storyUnlocked, storyChecklist } from '../../worm/story/levels.js';
import { MODE_THEMES } from '../../utils/modeThemes.js';
import { HEADING_FONT, UI_FONT, Z } from '../../utils/uiTheme.js';
import { StoryRewardChoices } from '../../worm/story/StoryCards.jsx';
import { getSkin } from '../../worm/wormCosmeticsData.js';
import WormProfile from './WormProfile.jsx';
import { wormMenuFeedback } from './wormMenuFeedback.js';
import './modeWizard.css';
import './wormStory.css';
const FreePlaySetup = React.lazy(() => import('./WormModeSetupWizard.jsx'));

export default function WormEntryScreen({ onComplete, onCancel, initialSettings, initialPage = 'choice' }) {
  const [page, setPage] = useState(initialPage);
  const progress = useGameStore(s => s.playerProgress);
  const wormSkin = useGameStore(s => s.wormSkin);
  const [selected, setSelected] = useState(() => nextStoryLevel(progress).id);
  const root = useRef(null);
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
  const level = WORM_STORY_LEVELS.find(item => item.id === selected);
  const totalStars = WORM_STORY_LEVELS.reduce((n, item) => n + storyStars(progress, item.id), 0);
  const launch = () => { wormMenuFeedback(); onComplete({ ...initialSettings, perFaceStyles: initialSettings?.manifoldStyles,
    wormColor: getSkin(wormSkin).body,
    storyLevel: level.id, cubeSize: level.cubeSize ?? 5, megaMode: false, wormSpeed: level.speed, wormOrbCount: 1,
    wormholeInterval: 30, wormCombatMode: false, wormEnemiesEnabled: false }); };
  return <div ref={root} className={`mode-wizard worm-entry${page === 'choice' ? ' worm-entry-choice' : ''}`} role="dialog" aria-modal="true" aria-labelledby="worm-entry-title"
    style={{ '--mode-accent': MODE_THEMES.worm.accent, '--mode-ink': MODE_THEMES.worm.shadow, '--story-display': HEADING_FONT, fontFamily: UI_FONT, zIndex: Z.MODAL }}>
    <div className="worm-entry-sheet" style={wizardPaperBackground}>
      <nav className="worm-entry-nav"><button onClick={back} aria-label={page === 'choice' ? 'Back to modes' : 'Back to WORM choices'}>← Back</button><span><WormWordmark inline /></span></nav>
      <div className="worm-entry-scroll">
        {page === 'choice' ? <h1 id="worm-entry-title" className="worm-choice-title">WORM</h1> : <header className="worm-entry-heading"><h1 id="worm-entry-title">Levels</h1></header>}
        {page === 'choice' ? <>
          <div className="worm-path-split">
            <button className="worm-path-card worm-path-story" aria-label="Levels" onClick={() => { wormMenuFeedback(); setPage('story'); }}>
              <WormPathArtwork levels /><span className="worm-path-cta">Levels <b aria-hidden="true">→</b></span>
            </button>
            <button className="worm-path-card worm-path-free" aria-label="Free Play" onClick={() => { wormMenuFeedback(); setPage('free'); }}>
              <WormPathArtwork /><span className="worm-path-cta">Free Play <b aria-hidden="true">→</b></span>
            </button>
          </div>
          <WormProfile />
        </> : <>
          <div className="worm-chapter-progress"><span>Stars</span><strong>{totalStars} / {WORM_STORY_LEVELS.length * 3} ★</strong><progress value={totalStars} max={WORM_STORY_LEVELS.length * 3} aria-label="Chapter stars" /></div>
          <div className="worm-level-grid">{WORM_STORY_LEVELS.map(item => {
            const unlocked = storyUnlocked(progress, item.id), stars = storyStars(progress, item.id);
            return <button key={item.id} disabled={!unlocked} title={item.title} aria-pressed={selected === item.id} aria-label={`Level ${item.id}: ${item.title}${unlocked ? `, ${stars} stars` : ', locked'}`} onClick={() => { wormMenuFeedback(); setSelected(item.id); }} className={selected === item.id ? 'selected' : ''}>
              <span className="worm-level-number">{String(item.id).padStart(2, '0')}</span><small aria-hidden="true">{unlocked ? `${'★'.repeat(stars)}${'☆'.repeat(3-stars)}` : '—'}</small>
            </button>;
          })}</div>
          <section className="worm-level-detail" aria-label="Selected level"><div className="worm-path-kicker">Level {String(level.id).padStart(2, '0')}</div><h2>{level.title}</h2><ul className="worm-level-goals" aria-label="Level goals">{storyChecklist(level).map(goal => <li key={goal.key}><b>{goal.target}</b><span>{goal.label}</span></li>)}</ul>
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
