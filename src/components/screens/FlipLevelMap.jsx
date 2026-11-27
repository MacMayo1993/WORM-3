// src/components/screens/FlipLevelMap.jsx
// Flip Cube Levels as a map: ten stages on a winding road that climbs the page,
// level 1 at the daycare at the foot, the crowned finale at the black hole at the
// top (flipLevelMapLayout.js). Each stage is a cube piece in Flip Cube yellow
// once it is open, with its name, scene, stars and best flips beside it. Cleared
// road is solid yellow, open road dashed, locked road faint; the next stage
// pulses and the map opens scrolled to it.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { loadProgress, progressManager } from '../../utils/levels.js';
import { MODE_THEMES } from '../../utils/modeThemes.js';
import { UI_FONT, Z } from '../../utils/uiTheme.js';
import { wizardPaperBackground } from './WizardChrome.jsx';
import { useDialogBehavior } from '../ui/Panel.jsx';
import { STAGE_SPACING, SCENE_NAMES, flipMapNodes, flipMapTrail } from './flipLevelMapLayout.js';
import '../ui/pieceKey.css';
import './flipLevelMap.css';

const STARS = 3;
const VIEW_WIDTH = 100;

const flipsWord = n => `${n} ${n === 1 ? 'flip' : 'flips'}`;

export default function FlipLevelMap({ pack, onSelectLevel, onBack }) {
  const levels = pack.levels;
  const [completed, setCompleted] = useState([]);
  const [stats, setStats] = useState({});
  useEffect(() => {
    setCompleted(loadProgress());
    setStats(progressManager.loadLevelStats());
  }, []);

  const isOpen = level => {
    const prereq = level.requirements?.previousLevel ?? null;
    return progressManager.testMode || prereq === null || completed.includes(prereq);
  };
  const nextId = levels.find(level => isOpen(level) && !completed.includes(level.id))?.id ?? null;
  const cleared = levels.filter(level => completed.includes(level.id)).length;
  const earned = levels.reduce((sum, level) => sum + Math.min(stats[level.id]?.stars || 0, STARS), 0);

  const height = levels.length * STAGE_SPACING;
  const nodes = useMemo(() => flipMapNodes(levels.length), [levels.length]);
  const trail = useMemo(() => flipMapTrail(nodes, VIEW_WIDTH, height), [nodes, height]);

  // Open on the stage the player is up to (or the finale once all are cleared).
  const scroller = useRef(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const index = Math.max(0, levels.findIndex(level => level.id === (nextId ?? levels[levels.length - 1].id)));
    el.scrollTop = Math.max(0, nodes[index].y * height - el.clientHeight / 2);
  }, [levels, nextId, nodes, height]);

  const dialog = useRef(null);
  const onKeyDown = useDialogBehavior(dialog, onBack);
  const yellow = MODE_THEMES.cube.accent;

  return (
    <div ref={dialog} role="dialog" aria-modal="true" aria-label="Choose a Flip Cube level" tabIndex={-1} onKeyDown={onKeyDown}
      className="flip-map mode-paper-selector" style={{ ...wizardPaperBackground, zIndex: Z.MODAL_RAISED, fontFamily: UI_FONT, '--flip-yellow': yellow }}>
      <header className="flip-map-head">
        <button type="button" className="piece-icon" onClick={onBack} aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 L7 12 L15 20" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="flip-map-title">
          <h1>{pack.name}</h1>
          <p>{cleared}/{levels.length} cleared</p>
        </div>
        <div className="flip-map-stars" aria-label={`${earned} of ${levels.length * STARS} stars`}>{earned}<span aria-hidden="true">★</span></div>
      </header>

      <div ref={scroller} className="flip-map-scroll">
        <div className="flip-map-board" style={{ height }}>
          <svg className="flip-map-trail" viewBox={`0 0 ${VIEW_WIDTH} ${height}`} preserveAspectRatio="none" aria-hidden="true">
            {trail.map((d, i) => {
              const state = completed.includes(levels[i].id) && completed.includes(levels[i + 1].id) ? 'cleared'
                : isOpen(levels[i + 1]) ? 'open' : 'locked';
              return <React.Fragment key={i}>
                <path d={d} className={`flip-map-road flip-map-road--${state}`} vectorEffect="non-scaling-stroke" />
                {state === 'cleared' && <path d={d} className="flip-map-road flip-map-road--line" vectorEffect="non-scaling-stroke" />}
              </React.Fragment>;
            })}
          </svg>
          {levels.map((level, index) => {
            const open = isOpen(level);
            const beaten = completed.includes(level.id);
            const stat = stats[level.id];
            const stars = Math.min(stat?.stars || 0, STARS);
            const finale = index === levels.length - 1;
            const next = level.id === nextId;
            const side = nodes[index].x < 0.5 ? 'left' : 'right';
            return (
              <div key={level.id} className={`flip-map-stage flip-map-stage--${side}${next ? ' flip-map-stage--next' : ''}`}
                style={{ left: `${nodes[index].x * 100}%`, top: `${nodes[index].y * 100}%` }}>
                {finale && <svg className="flip-map-crown" viewBox="0 0 24 16" aria-hidden="true"><path d="M2 14 L4 4 L9 9 L12 2 L15 9 L20 4 L22 14 Z" /></svg>}
                <button type="button" className={`piece flip-map-piece${open ? '' : ' flip-map-piece--locked'}`}
                  style={{ '--piece-color': open ? yellow : '#c9c6b4' }} disabled={!open}
                  onClick={() => open && onSelectLevel(level.id)}
                  aria-label={`${open ? (beaten ? 'Replay' : 'Play') : 'Locked'} level ${index + 1}: ${level.name}${beaten ? `, ${stars} of 3 stars` : ''}`}>
                  <span className="piece-face"><span className="flip-map-number">{open ? index + 1 : '🔒'}</span></span>
                </button>
                <div className="flip-map-label" aria-hidden="true">
                  <strong>{level.name}</strong>
                  <span className="flip-map-scene">{SCENE_NAMES[level.background] ?? ''}</span>
                  <span className="flip-map-row">
                    <span className="flip-map-stars-row">{Array.from({ length: STARS }, (_, i) => <b key={i} className={i < stars ? 'on' : ''}>★</b>)}</span>
                    {beaten && Number.isInteger(stat?.bestFlips) ? <span>Best {flipsWord(stat.bestFlips)}</span> : <span>Target {level.flipPar}</span>}
                  </span>
                  {next && <span className="flip-map-next">Next</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
