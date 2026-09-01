// AchievementsPanel.jsx — render the awards ProgressManager has been recording.
//
// The award system has been granting, persisting and emitting these ids since
// the progress manager landed; nothing ever displayed them, so a player could
// hold five and never know any existed. This is that display.
//
// It is an inline expandable section rather than a modal on purpose: an ambient
// panel that never owns the screen needs no entry in hooks/uiSurfaces.js, so it
// cannot break the Escape-to-dismiss or keyboard-gating contract.
//
// Paper family, matching the campaign chooser it sits under.

import React, { useState } from 'react';
import { decorateAchievements } from '../../levels/achievements.js';
import {
  UI_FONT, PAPER_SHEET_RAISED, PAPER_BORDER, PAPER_BORDER_SOFT,
  PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT, PAPER_BG_MUTED,
  PAPER_CARD_SHADOW, UI_CREAM, TEXT_MICRO,
} from '../../utils/uiTheme.js';

const EARNED_ACCENT = '#c8902a'; // the same gold the star counts use

function AchievementTile({ achievement }) {
  const { label, description, glyph, earned } = achievement;

  return (
    <li
      title={description}
      style={{
        listStyle: 'none',
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '10px 12px', borderRadius: '10px',
        background: earned ? PAPER_SHEET_RAISED : PAPER_BG_MUTED,
        border: `1px solid ${earned ? `${EARNED_ACCENT}55` : PAPER_BORDER_SOFT}`,
        opacity: earned ? 1 : 0.72,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', lineHeight: 1,
          background: earned ? EARNED_ACCENT : 'transparent',
          border: `1px solid ${earned ? EARNED_ACCENT : PAPER_BORDER}`,
          color: earned ? UI_CREAM : PAPER_TEXT_FAINT,
        }}
      >{earned ? glyph : '·'}</span>

      <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span style={{
          fontSize: '12px', fontWeight: 800, letterSpacing: '-0.01em',
          color: earned ? PAPER_TEXT : PAPER_TEXT_MUTED,
        }}>{label}</span>
        {/* The description is how it is earned — locked tiles need it most, so it
            is never hidden behind the earned state. */}
        <span style={{ fontSize: '11px', lineHeight: 1.4, color: PAPER_TEXT_FAINT }}>
          {description}
        </span>
      </span>
    </li>
  );
}

/**
 * @param {object} props
 * @param {string[]} props.earned  ids from progressManager.loadAchievements()
 */
export default function AchievementsPanel({ earned = [] }) {
  const [open, setOpen] = useState(false);
  const items = decorateAchievements(earned);
  const earnedCount = items.filter((a) => a.earned).length;

  return (
    <section style={{ fontFamily: UI_FONT }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 18px', borderRadius: '14px',
          border: `1.5px solid ${PAPER_BORDER_SOFT}`,
          background: PAPER_SHEET_RAISED, fontFamily: UI_FONT,
          boxShadow: `0 3px 0 ${PAPER_CARD_SHADOW}`,
        }}
      >
        <span style={{ fontSize: '15px', fontWeight: 900, color: PAPER_TEXT, letterSpacing: '-0.02em' }}>
          Achievements
        </span>
        <span style={{
          fontSize: TEXT_MICRO, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: earnedCount > 0 ? EARNED_ACCENT : PAPER_TEXT_FAINT,
          background: earnedCount > 0 ? `${EARNED_ACCENT}18` : PAPER_BG_MUTED,
          border: `1px solid ${earnedCount > 0 ? `${EARNED_ACCENT}44` : PAPER_BORDER}`,
          borderRadius: '4px', padding: '2px 7px', fontVariantNumeric: 'tabular-nums',
        }}>
          {earnedCount} / {items.length}
        </span>

        <svg
          width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"
          style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
        >
          <path d="M6 9 L12 15 L18 9" fill="none" stroke={PAPER_TEXT_MUTED} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul style={{
          margin: '10px 0 0', padding: 0,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px',
        }}>
          {items.map((a) => <AchievementTile key={a.id} achievement={a} />)}
        </ul>
      )}
    </section>
  );
}
