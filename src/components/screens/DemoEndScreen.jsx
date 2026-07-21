import React from 'react';
import {
  UI_FONT, DISPLAY_FONT,
  GLASS_PANEL, GLASS_PANEL_BORDER, GLASS_TEXT, GLASS_TEXT_MUTED, GLASS_SHADOW,
} from '../../utils/uiTheme.js';

// Six-mode landing: the demo taught rotate → twin → flip → views → worm →
// chaos → random → store, and this screen sends the player into the real mode
// that matches whichever beat they liked. Each row names a destination and ties
// it back to something the demo just showed. WORM is the primary CTA because the
// demo ends on worm/chaos gameplay.
const MODES = [
  {
    id: 'worm',
    icon: '🐛',
    name: 'WORM',
    blurb: 'Play the action-healing version of what you just learned.',
    primary: true,
  },
  { id: 'story', icon: '🎯', name: 'STORY', blurb: 'Ten guided levels across three rule sets.' },
  { id: 'freeplay', icon: '🧊', name: 'FREEPLAY', blurb: 'Solve the cube your way — no timer, no pressure.' },
  { id: 'chaos', icon: '⚡', name: 'CHAOS', blurb: 'Bet on a pair and survive the flipping cube.' },
  { id: 'random', icon: '🎲', name: 'RANDOM', blurb: 'Let the cube remix the rules and the look.' },
  { id: 'store', icon: '🛍️', name: 'STORE', blurb: 'Spend Parity Points on cubes, skins, and worms.' },
];

const DemoEndScreen = ({ onWorm, onStory, onFreeplay, onChaos, onRandom, onStore, onReplay, onExit }) => {
  const handlers = { worm: onWorm, story: onStory, freeplay: onFreeplay, chaos: onChaos, random: onRandom, store: onStore };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 12000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(2,3,10,0.88)',
      backdropFilter: 'blur(18px)',
      fontFamily: UI_FONT,
      padding: 16,
      overflowY: 'auto',
    }}>
      <div style={{
        background: GLASS_PANEL,
        border: `1px solid ${GLASS_PANEL_BORDER}`,
        borderRadius: 20,
        boxShadow: GLASS_SHADOW,
        padding: '32px 24px 24px',
        maxWidth: 460,
        width: '100%',
        margin: 'auto',
        textAlign: 'center',
      }}>
        <p style={{
          color: GLASS_TEXT_MUTED, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 6px',
        }}>
          Demo Complete
        </p>
        <h1 style={{
          fontFamily: DISPLAY_FONT,
          fontSize: 26,
          color: '#fff',
          margin: '0 0 8px',
          letterSpacing: '0.04em',
        }}>
          Pick where to go next
        </h1>
        <p style={{
          color: GLASS_TEXT, fontSize: 13.5, lineHeight: 1.5,
          margin: '0 auto 22px', maxWidth: 360,
        }}>
          You learned the whole idea: opposite tiles are twins, and a flip travels
          between them. Every mode below is built on that.
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
                background: mode.primary ? '#5f7f4a' : 'rgba(255,255,255,0.06)',
                border: mode.primary ? '1px solid #6f9256' : `1px solid ${GLASS_PANEL_BORDER}`,
                boxShadow: mode.primary ? '0 8px 20px rgba(95,127,74,0.32)' : 'none',
                transition: 'transform 0.12s ease, background 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
            >
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }} aria-hidden="true">{mode.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: '#fff', fontSize: 15, fontWeight: 800, letterSpacing: '0.05em',
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
                  color: mode.primary ? 'rgba(255,253,245,0.88)' : GLASS_TEXT_MUTED,
                  fontSize: 12.5, lineHeight: 1.35, fontWeight: 500,
                }}>
                  {mode.blurb}
                </span>
              </span>
              <span aria-hidden="true" style={{
                flexShrink: 0, fontSize: 18,
                color: mode.primary ? '#fffdf5' : GLASS_TEXT_MUTED,
              }}>
                ›
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={onReplay}
            style={{
              flex: 1, padding: '11px 0',
              background: 'transparent',
              color: GLASS_TEXT,
              border: `1px solid ${GLASS_PANEL_BORDER}`,
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
              color: GLASS_TEXT_MUTED,
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
