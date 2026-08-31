// PackSelectScreen.jsx — choose a campaign.
//
// Story used to open chapter 1 directly, so the chapter map was reachable only
// from the in-game More sheet, and two shipped packs (Cube Academy, Algorithm
// Codex) had no entry point at all. This is the front door: pick a pack, then
// its chapter map.
//
// Paper family: the player is deciding and the panel owns the screen.

import React, { useEffect, useRef, useState } from 'react';
import { OFFICIAL_PACKS } from '../../levels/index.js';
import { progressManager } from '../../utils/levels.js';
import {
  UI_FONT, DISPLAY_FONT, PAPER_SHEET_RAISED, PAPER_BORDER, PAPER_BORDER_SOFT,
  PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT, PAPER_BG_MUTED,
  PAPER_CARD_SHADOW, UI_MOSS,
 Z, TEXT_MICRO } from '../../utils/uiTheme.js';
import { wizardPaperBackground } from './WizardChrome.jsx';
import { useDialogBehavior } from '../ui/Panel.jsx';

const STARS_PER_LEVEL = 3;
const ACCENTS = {
  'story-campaign': '#3b82f6',
  // Deliberately literal, not UI_MOSS/PAPER_WARN: these identify a pack, and
  // only happen to share a value with the shared action and warning inks.
  // Pointing them at those tokens would make a pack's identity shift if the
  // action colour ever moved.
  'cube-academy': '#5f7f4a',
  'algorithm-codex': '#b06a2e',
};

export default function PackSelectScreen({ onSelectPack, onBack }) {
  const [completed, setCompleted] = useState([]);
  const [stats, setStats] = useState({});
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    setCompleted(progressManager.loadProgress());
    setStats(progressManager.loadLevelStats());
  }, []);

  // Bespoke chrome, so this takes the dialog behaviour directly rather
  // than becoming an <Overlay>: focus moves in on open and back out on
  // close, Tab is trapped, and the page behind stops scrolling.
  const dialogRef = useRef(null);
  const onDialogKeyDown = useDialogBehavior(dialogRef, onBack);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose a level pack"
      tabIndex={-1}
      onKeyDown={onDialogKeyDown}
      style={{
      position: 'fixed', inset: 0, height: '100dvh', zIndex: Z.MODAL_RAISED,
      ...wizardPaperBackground,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: UI_FONT, animation: 'lvSelIn 0.3s ease',
      padding: 'max(18px, env(safe-area-inset-top, 0px)) 16px max(18px, env(safe-area-inset-bottom, 0px))',
      boxSizing: 'border-box', overflowY: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <div style={{ padding: '6px 4px 18px' }}>
          <div style={{
            fontSize: '11px', fontWeight: 900, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: PAPER_TEXT_FAINT,
          }}>Story</div>
          <h1 style={{
            margin: '4px 0 6px', fontFamily: DISPLAY_FONT, color: PAPER_TEXT,
            fontSize: 'clamp(26px, 7vw, 40px)', letterSpacing: '0.02em', lineHeight: 1,
          }}>Choose a campaign</h1>
          <p style={{ margin: 0, fontSize: '13px', color: PAPER_TEXT_MUTED, lineHeight: 1.5 }}>
            Three of them, and they do not overtake each other — your progress in one is its own.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '90px' }}>
          {OFFICIAL_PACKS.map((pack) => {
            const ids = pack.levels.map((l) => l.id);
            const done = ids.filter((id) => completed.includes(id)).length;
            const stars = ids.reduce((sum, id) => sum + Math.min(stats[id]?.stars || 0, STARS_PER_LEVEL), 0);
            const maxStars = ids.length * STARS_PER_LEVEL;
            const pct = ids.length ? done / ids.length : 0;
            const accent = ACCENTS[pack.id] || UI_MOSS;
            const isHover = hovered === pack.id;

            return (
              <button
                key={pack.id}
                onClick={() => onSelectPack(pack.id)}
                onMouseEnter={() => setHovered(pack.id)}
                onMouseLeave={() => setHovered(null)}
                aria-label={`Play ${pack.name}: ${done} of ${ids.length} complete`}
                style={{
                  textAlign: 'left', padding: '18px 20px', borderRadius: '16px',
                  border: `1.5px solid ${isHover ? accent : PAPER_BORDER_SOFT}`,
                  background: PAPER_SHEET_RAISED, cursor: 'pointer',
                  boxShadow: `0 4px 0 ${PAPER_CARD_SHADOW}, 0 7px 14px rgba(60,48,34,${isHover ? 0.16 : 0.10})`,
                  transform: isHover ? 'translateY(-2px)' : 'none',
                  transition: 'transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease',
                  fontFamily: UI_FONT, position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: PAPER_TEXT, letterSpacing: '-0.02em' }}>
                    {pack.name}
                  </span>
                  <span style={{
                    fontSize: TEXT_MICRO, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: accent, background: `${accent}16`, border: `1px solid ${accent}3a`,
                    borderRadius: '4px', padding: '2px 7px',
                  }}>
                    {ids.length} levels
                  </span>
                  {done === ids.length && ids.length > 0 && (
                    <span style={{
                      fontSize: TEXT_MICRO, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
                      color: '#fffdf5', background: UI_MOSS, borderRadius: '4px', padding: '2px 7px',
                    }}>Complete</span>
                  )}
                </div>

                <p style={{ margin: '8px 0 14px', fontSize: '13px', lineHeight: 1.55, color: PAPER_TEXT_MUTED }}>
                  {pack.description}
                </p>

                {/* Progress bar — the pack's own completion, never the global one */}
                <div style={{
                  height: '6px', borderRadius: '999px', background: PAPER_BG_MUTED,
                  overflow: 'hidden', border: `1px solid ${PAPER_BORDER}`,
                }}>
                  <div style={{
                    width: `${Math.round(pct * 100)}%`, height: '100%', background: accent,
                    transition: 'width 0.3s ease',
                  }} />
                </div>

                <div style={{
                  marginTop: '8px', display: 'flex', justifyContent: 'space-between',
                  fontSize: '11px', fontWeight: 700, color: PAPER_TEXT_FAINT, letterSpacing: '0.04em',
                }}>
                  <span>{done}/{ids.length} complete</span>
                  <span style={{ color: stars > 0 ? '#c8902a' : PAPER_TEXT_FAINT }}>{stars}/{maxStars} ★</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onBack}
        aria-label="Back"
        style={{
          position: 'absolute',
          left: 'max(18px, env(safe-area-inset-left, 0px))',
          bottom: 'max(18px, env(safe-area-inset-bottom, 0px))',
          width: '58px', height: '58px', borderRadius: '50%',
          border: `1.5px solid ${PAPER_BORDER_SOFT}`, background: PAPER_SHEET_RAISED,
          boxShadow: `0 4px 0 ${PAPER_CARD_SHADOW}, 0 7px 14px rgba(60, 48, 34, 0.16)`,
          cursor: 'pointer', zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 4 L7 12 L15 20" fill="none" stroke={PAPER_TEXT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
