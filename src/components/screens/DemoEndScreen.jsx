import { XpReceipt } from '../../progression/ProgressWidgets.jsx';
import DemoDialog from './DemoDialog.jsx';
import { useGameStore } from '../../hooks/useGameStore.js';
import React, { useState } from 'react';
import {
  UI_FONT, HEADING_FONT,
  UI_CREAM, UI_MOSS, UI_ACTION_SHADOW,
 Z } from '../../utils/uiTheme.js';

// Six-mode landing: the demo taught rotate → twin → flip → views → worm →
// chaos → random → store, and this screen sends the player into the real mode
// that matches whichever beat they liked. Each row names a destination and ties
// it back to something the demo just showed. WORM is the primary CTA because the
// demo ends on worm/chaos gameplay.
const MODES = [
  {
    id: 'worm',
    name: 'WORM',
    blurb: 'Steer a worm, collect orbs, and heal the cube.',
    primary: true,
  },
  { id: 'story', name: 'Teach', blurb: 'Learn a complete beginner cube method.' },
  { id: 'freeplay', name: 'Flip Cube', blurb: 'Solve the Flip Cube at any size, no timer.' },
  { id: 'chaos', name: 'Chaos', blurb: 'Predict which color pair lasts longest.' },
  { id: 'random', name: 'Random', blurb: 'Solve while the colors and tile styles change.' },
  { id: 'store', name: 'Store', blurb: 'Spend Parity Points on palettes, styles, and worm gear.' },
];

const DemoEndScreen = ({ onWorm, onStory, onFreeplay, onChaos, onRandom, onStore, onReplay, onExit, onExplore }) => {
  const explored = useGameStore(s => s.demoExploreComplete);
  const [expanded, setExpanded] = useState(false);
  const handlers = { worm: onWorm, story: onStory, freeplay: onFreeplay, chaos: onChaos, random: onRandom, store: onStore };

  return (
    <DemoDialog onClose={onExit} aria-label={explored ? "Explore complete" : "Demo complete"} style={{
      position: 'fixed', inset: 0, zIndex: Z.DEMO,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, rgba(24,31,18,0.34), rgba(24,31,18,0.62))',
      backdropFilter: 'var(--paper-blur, none)',
      fontFamily: UI_FONT,
      padding: 16,
      overflowY: 'auto',
    }}>
      <div style={{
        background: 'rgba(250,247,238,0.94)',
        border: '1px solid rgba(111,126,86,0.25)',
        borderRadius: 20,
        boxShadow: '0 14px 34px rgba(40,48,32,0.22)',
        padding: '32px 24px 24px',
        maxWidth: 460,
        width: '100%',
        margin: 'auto',
        textAlign: 'center',
      }}>
        <p style={{
          color: '#7b6f45', fontSize: 11, fontWeight: 800,
          letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 6px',
        }}>
          {explored ? 'Explore Complete' : 'Demo Complete'}
        </p>
        <XpReceipt mode="demo" />
        <h1 style={{
          fontFamily: HEADING_FONT,
          fontSize: 26,
          color: '#24331e',
          margin: '0 0 8px',
          letterSpacing: '0.04em',
        }}>
          Choose a mode
        </h1>


        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {MODES.filter(mode => mode.primary || expanded).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={handlers[mode.id]}
              style={{
                display: 'flex', alignItems: 'center', gap: 13,
                width: '100%', padding: '13px 16px',
                textAlign: 'left',
                borderRadius: 13,
                cursor: 'pointer',
                fontFamily: UI_FONT,
                background: mode.primary ? UI_MOSS : 'rgba(255,255,255,0.56)',
                border: mode.primary ? '1px solid #6f9256' : '1px solid rgba(111,126,86,0.20)',
                boxShadow: mode.primary ? UI_ACTION_SHADOW : 'none',
                transition: 'transform 0.12s ease, background 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: mode.primary ? UI_CREAM : '#26331f', fontSize: 15, fontWeight: 800, letterSpacing: '0.05em',
                }}>
                  {mode.primary ? 'Play WORM' : mode.name}

                </span>
                <span style={{
                  display: 'block', marginTop: 2,
                  color: mode.primary ? 'rgba(255,253,245,0.88)' : '#657156',
                  fontSize: 12.5, lineHeight: 1.35, fontWeight: 500,
                }}>
                  {mode.blurb}
                </span>
              </span>
              <span aria-hidden="true" style={{
                flexShrink: 0, fontSize: 18,
                color: mode.primary ? '#fffdf5' : '#657156',
              }}>
                ›
              </span>
            </button>
          ))}
        </div>

        <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}
          style={{ minHeight: 48, marginTop: 12, background: 'transparent', border: 0, color: '#43513a', font: 'inherit' }}>
          {expanded ? 'Show fewer modes' : 'Show all modes'}
        </button>
        {!explored && <button type="button" onClick={onExplore}
          style={{ display: 'block', width: '100%', minHeight: 48, background: 'transparent', border: '1px solid #cec8be', borderRadius: 12, color: '#43513a', font: 'inherit' }}>
          Keep learning: 7 more lessons
        </button>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={onReplay}
            style={{
              flex: 1, minHeight: 48, padding: '11px 0',
              background: 'transparent',
              color: '#43513a',
              border: '1px solid rgba(111,126,86,0.25)',
              borderRadius: 11,
              fontFamily: UI_FONT, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', letterSpacing: '0.03em',
            }}
          >
            Replay demo
          </button>
          <button
            type="button"
            onClick={onExit}
            style={{
              flex: 1, minHeight: 48, padding: '11px 0',
              background: 'transparent',
              color: '#657156',
              border: 'none',
              borderRadius: 11,
              fontFamily: UI_FONT, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', letterSpacing: '0.03em',
            }}
          >
            Main menu
          </button>
        </div>
      </div>
    </DemoDialog>
  );
};

export default DemoEndScreen;
