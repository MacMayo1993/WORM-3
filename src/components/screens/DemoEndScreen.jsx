import React from 'react';
import {
  UI_FONT, DISPLAY_FONT,
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
    blurb: 'Play the action-healing version of what you just learned.',
    primary: true,
  },
  { id: 'story', name: 'STORY', blurb: 'Ten guided levels that build up one rule at a time.' },
  { id: 'freeplay', name: 'FREEPLAY', blurb: 'Solve the cube your way — no timer, no pressure.' },
  { id: 'chaos', name: 'CHAOS', blurb: 'Call the surviving pair and ride out the flipping cube.' },
  { id: 'random', name: 'RANDOM', blurb: 'Let the cube remix the rules and the look.' },
  { id: 'store', name: 'STORE', blurb: 'Spend Parity Points on cubes, skins, and worms.' },
];

const DemoEndScreen = ({ onWorm, onStory, onFreeplay, onChaos, onRandom, onStore, onReplay, onExit }) => {
  const handlers = { worm: onWorm, story: onStory, freeplay: onFreeplay, chaos: onChaos, random: onRandom, store: onStore };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: Z.DEMO,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, rgba(24,31,18,0.34), rgba(24,31,18,0.62))',
      backdropFilter: 'blur(9px) saturate(1.03)',
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
          Demo Complete
        </p>
        <h1 style={{
          fontFamily: DISPLAY_FONT,
          fontSize: 26,
          color: '#24331e',
          margin: '0 0 8px',
          letterSpacing: '0.04em',
        }}>
          Pick where to go next
        </h1>
        <p style={{
          color: '#43513a', fontSize: 13.5, lineHeight: 1.5,
          margin: '0 auto 22px', maxWidth: 360,
        }}>
          You have the whole idea already: the tile dead opposite any other one is
          its twin, and a tap sends a tile straight through the middle to it. Every
          mode below is built on that.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {MODES.map((mode) => (
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
                  {mode.name}
                  {mode.primary && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                      padding: '2px 7px', borderRadius: 999,
                      background: 'rgba(255,255,255,0.22)', color: '#fffdf5',
                      textTransform: 'uppercase',
                    }}>
                      Start here
                    </span>
                  )}
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

        {/* The solver and the step-by-step teacher live behind the nav bar's
            More button — the demo never opens that sheet, so name it here
            rather than leave two of the game's biggest helps undiscovered. */}
        <p style={{
          color: '#657156', fontSize: 12, lineHeight: 1.45,
          margin: '16px auto 0', maxWidth: 340,
        }}>
          Stuck in any mode? The <strong style={{ color: '#43513a' }}>More</strong> button on the
          bottom bar has <strong style={{ color: '#43513a' }}>Solve</strong> (watch it solve itself)
          and <strong style={{ color: '#43513a' }}>Teach</strong> (learn to do it yourself).
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={onReplay}
            style={{
              flex: 1, padding: '11px 0',
              background: 'transparent',
              color: '#43513a',
              border: '1px solid rgba(111,126,86,0.25)',
              borderRadius: 11,
              fontFamily: UI_FONT, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', letterSpacing: '0.03em',
            }}
          >
            Replay Demo
          </button>
          <button
            type="button"
            onClick={onExit}
            style={{
              flex: 1, padding: '11px 0',
              background: 'transparent',
              color: '#657156',
              border: 'none',
              borderRadius: 11,
              fontFamily: UI_FONT, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', letterSpacing: '0.03em',
            }}
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoEndScreen;
