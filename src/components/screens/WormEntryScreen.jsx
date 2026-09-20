import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { WORM_STORY_LEVELS, nextStoryLevel, storyStars, storyUnlocked } from '../../worm/story/levels.js';
import { MODE_THEMES } from '../../utils/modeThemes.js';
import { DISPLAY_FONT, UI_FONT, Z } from '../../utils/uiTheme.js';
import { StoryRewardChoices } from '../../worm/story/StoryCards.jsx';
import './modeWizard.css';
import './wormStory.css';
const FreePlaySetup = React.lazy(() => import('./WormModeSetupWizard.jsx'));

function PathArt({ story }) {
  return <svg viewBox="0 0 220 170" aria-hidden="true" className="worm-path-art">
    <path d={story ? 'M25 140H70V99H116V58H168V21H198' : 'M24 84C24 12 107 12 110 84S196 156 196 84S114 12 110 84S24 156 24 84'} fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="4 8" opacity=".45" />
    {story && [[70,140],[116,99],[168,58]].map(([x,y], i) => <g key={x}><circle cx={x} cy={y} r="16" fill="var(--wiz-base)" stroke="currentColor" strokeWidth="2" /><text x={x} y={y+5} textAnchor="middle" fill="currentColor" fontSize="14">{i+1}</text></g>)}
    <path d={story ? 'M29 133Q24 118 39 111T52 86Q49 68 67 65' : 'M70 73Q65 50 83 49T107 65Q119 87 137 75'} fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
    <circle cx={story ? 67 : 137} cy={story ? 65 : 75} r="12" fill="currentColor" />
    <circle cx={story ? 65 : 136} cy={story ? 61 : 71} r="2.5" fill="#122025" /><circle cx={story ? 72 : 143} cy={story ? 62 : 72} r="2.5" fill="#122025" />
    {story && <path d="m193 11 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z" fill="currentColor" />}
  </svg>;
}

export default function WormEntryScreen({ onComplete, onCancel, initialSettings, initialPage = 'choice' }) {
  const [page, setPage] = useState(initialPage);
  const progress = useGameStore(s => s.playerProgress);
  const [selected, setSelected] = useState(() => nextStoryLevel(progress).id);
  const root = useRef(null);
  const back = () => page === 'choice' ? onCancel() : setPage('choice');
  useEffect(() => {
    const prior = document.activeElement;
    root.current?.querySelector('button')?.focus();
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (page === 'choice') onCancel(); else setPage('choice'); }
      if (e.key === 'Tab' && root.current) {
        const buttons = [...root.current.querySelectorAll('button:not(:disabled)')];
        const first = buttons[0], last = buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('keydown', key, true); prior?.focus?.(); };
  }, [page, onCancel]);
  if (page === 'free') return <Suspense fallback={<div className="worm-story-loading" role="status">Loading Free Play…</div>}><FreePlaySetup onComplete={onComplete} onCancel={() => setPage('choice')} initialSettings={initialSettings} /></Suspense>;
  const level = WORM_STORY_LEVELS.find(item => item.id === selected);
  const totalStars = WORM_STORY_LEVELS.reduce((n, item) => n + storyStars(progress, item.id), 0);
  const launch = () => onComplete({ ...initialSettings, perFaceStyles: initialSettings?.manifoldStyles,
    storyLevel: level.id, cubeSize: 5, megaMode: false, wormSpeed: level.speed, wormOrbCount: 1,
    wormholeInterval: 30, wormCombatMode: false, wormEnemiesEnabled: false });
  return <div ref={root} className="mode-wizard worm-entry" role="dialog" aria-modal="true" aria-labelledby="worm-entry-title"
    style={{ '--mode-accent': MODE_THEMES.worm.accent, '--story-display': DISPLAY_FONT, fontFamily: UI_FONT, zIndex: Z.MODAL }}>
    <div className="worm-entry-sheet">
      <nav className="worm-entry-nav"><button onClick={back} aria-label={page === 'choice' ? 'Back to modes' : 'Back to WORM choices'}>← Back</button><span className="mode-wizard-kicker">Choose your path</span><span>WORM³</span></nav>
      <div className="worm-entry-scroll">
        <header className="worm-entry-heading"><p>{page === 'choice' ? 'A little worm. A whole world.' : 'CHAPTER 01 · FIND YOUR FEET'}</p><h1 id="worm-entry-title">{page === 'choice' ? 'HOW WILL YOU WORM?' : 'THE FIRST TURN'}</h1><span>{page === 'choice' ? 'Follow a story. Or follow your curiosity.' : 'Ten timed challenges. One increasingly restless cube.'}</span></header>
        {page === 'choice' ? <>
          <div className="worm-path-split">
            <button className="worm-path-card worm-path-story" onClick={() => setPage('story')}>
              <span className="worm-path-kicker">A journey to grow into</span><PathArt story /><h2>STORY</h2><p>Learn the moves.<br />Earn your look.</p>
              <span className="worm-path-tags">{WORM_STORY_LEVELS.length} levels · Hats · Palettes · Skins · Trails</span><span className="worm-path-cta">{totalStars ? 'Continue story' : 'Begin your story'} <b>↗</b></span>
            </button>
            <button className="worm-path-card worm-path-free" onClick={() => setPage('free')}>
              <span className="worm-path-kicker">Your cube. Your rules.</span><PathArt /><h2>FREE PLAY</h2><p>Set your challenge.<br />Find your flow.</p>
              <span className="worm-path-tags">Custom runs · XP · Personal bests</span><span className="worm-path-cta">Build your run <b>↗</b></span>
            </button>
          </div><footer className="worm-entry-foot">One collection. Everything you earn travels with you.</footer>
        </> : <>
          <div className="worm-chapter-progress"><span>CHAPTER PROGRESS</span><strong>{totalStars} / {WORM_STORY_LEVELS.length * 3} ★</strong><progress value={totalStars} max={WORM_STORY_LEVELS.length * 3} aria-label="Chapter stars" /></div>
          <div className="worm-level-grid">{WORM_STORY_LEVELS.map(item => {
            const unlocked = storyUnlocked(progress, item.id), stars = storyStars(progress, item.id);
            return <button key={item.id} disabled={!unlocked} aria-pressed={selected === item.id} aria-label={`Level ${item.id}: ${item.title}${unlocked ? `, ${stars} stars` : ', locked'}`} onClick={() => setSelected(item.id)} className={selected === item.id ? 'selected' : ''}>
              <span className="worm-level-number">{String(item.id).padStart(2, '0')}</span><strong>{item.title}</strong><small>{unlocked ? `${'★'.repeat(stars)}${'☆'.repeat(3-stars)}` : 'Clear the previous level'}</small>
            </button>;
          })}</div>
          <section className="worm-level-detail" aria-label="Selected level"><div className="worm-path-kicker">LEVEL {String(level.id).padStart(2, '0')}</div><h2>{level.title}</h2><p>{level.subtitle}</p><strong>{level.goal}</strong>
            <p className="worm-story-limit">Time limit: {level.limit} seconds{level.rotateEvery ? ` · Layer turns every ${level.rotateEvery}s while moving on the surface` : ''}</p>
            <ul><li>★ Finish the objective before time runs out</li><li>★ Finish within {level.par} seconds</li><li>★ Finish without a tail cut</li></ul>
            <div className="worm-level-reward"><span>FIRST CLEAR</span><strong>{level.rewardLabel || `${level.points} Parity Points`} + 50 XP</strong></div>
            <StoryRewardChoices level={level} />
            <button className="worm-story-primary" onClick={launch}>{storyStars(progress, level.id) ? 'Replay level' : 'Play level'} <span>→</span></button>
            <small>Extra stars never block the next level. Rewards pay once; new stars earn bonuses.</small>
          </section>
        </>}
      </div>
    </div>
  </div>;
}
