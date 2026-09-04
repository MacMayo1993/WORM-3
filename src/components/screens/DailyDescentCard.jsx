// DailyDescentCard.jsx — the Daily Descent's entry point, at the head of Story.
//
// A daily is not a campaign, so it does not get a campaign card: there is no
// ladder to show progress against and no chapter map behind it. What a player
// needs before committing is today's par, whether they have already solved it,
// and what their streak stands at — so those are what the card shows.
//
// Paper family: the player is deciding and the panel owns the screen.

import React from 'react';
import {
  UI_FONT, PAPER_SHEET_RAISED, PAPER_BORDER, PAPER_BORDER_SOFT,
  PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT, PAPER_BG_MUTED,
  PAPER_CARD_SHADOW, UI_CREAM, TEXT_MICRO,
} from '../../utils/uiTheme.js';

// Indigo — deliberately none of the three campaign accents (Descent blue,
// Academy moss, Codex ochre), so the daily never reads as a fourth campaign.
export const DAILY_ACCENT = '#584b9c';

const STAR = '★';

/** The day's result, once it has one: three stars and the move count. */
function SolvedStars({ stars }) {
  return (
    <span aria-label={`${stars} of 3 stars`} style={{ letterSpacing: '0.08em', color: '#c8902a', fontSize: '13px' }}>
      {STAR.repeat(Math.max(0, stars))}
      <span style={{ color: PAPER_TEXT_FAINT }}>{STAR.repeat(Math.max(0, 3 - stars))}</span>
    </span>
  );
}

/** One boxed number in the card's stat row. */
function Stat({ label, value, tone }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
      <span style={{
        fontSize: TEXT_MICRO, fontWeight: 800, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: PAPER_TEXT_FAINT,
      }}>{label}</span>
      <span style={{
        fontSize: '17px', fontWeight: 900, letterSpacing: '-0.02em',
        color: tone || PAPER_TEXT, fontVariantNumeric: 'tabular-nums',
      }}>{value}</span>
    </div>
  );
}

/**
 * @param {object}  props
 * @param {string}  props.dateLabel  human date for the eyebrow
 * @param {number}  props.par        today's exact analytic par
 * @param {boolean} props.solved     already solved today
 * @param {number}  props.streak     live streak (0 once a run has lapsed)
 * @param {number}  props.best       longest run ever
 * @param {number}  props.stars      today's stars, when solved
 * @param {number|null} props.moves  today's best move count, when solved
 * @param {number}  props.reward     Parity Points for the first solve of the day
 * @param {Function} props.onPlay
 */
export default function DailyDescentCard({
  dateLabel, par, solved, streak, best, stars = 0, moves = null, reward, onPlay,
}) {
  const [hover, setHover] = React.useState(false);
  const accent = DAILY_ACCENT;

  return (
    <button
      onClick={onPlay}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={solved
        ? `Daily Descent for ${dateLabel}, already solved in ${moves ?? par} moves. Play again.`
        : `Play the Daily Descent for ${dateLabel}. Par is ${par} move${par === 1 ? '' : 's'}.`}
      style={{
        textAlign: 'left', padding: '18px 20px', borderRadius: '16px',
        border: `1.5px solid ${hover ? accent : PAPER_BORDER_SOFT}`,
        background: PAPER_SHEET_RAISED, cursor: 'pointer',
        boxShadow: `0 4px 0 ${PAPER_CARD_SHADOW}, 0 7px 14px rgba(60,48,34,${hover ? 0.16 : 0.10})`,
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease',
        fontFamily: UI_FONT, position: 'relative', width: '100%',
      }}
    >
      {/* Accent spine — the one thing that separates today's puzzle from a campaign */}
      <div aria-hidden="true" style={{
        position: 'absolute', left: 0, top: '14px', bottom: '14px', width: '4px',
        borderRadius: '0 4px 4px 0', background: accent,
      }} />

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '18px', fontWeight: 900, color: PAPER_TEXT, letterSpacing: '-0.02em' }}>
          Daily Descent
        </span>
        <span style={{
          fontSize: TEXT_MICRO, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: accent, background: `${accent}16`, border: `1px solid ${accent}3a`,
          borderRadius: '4px', padding: '2px 7px',
        }}>
          Par {par}
        </span>
        {solved && (
          <span style={{
            fontSize: TEXT_MICRO, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: UI_CREAM, background: accent, borderRadius: '4px', padding: '2px 7px',
          }}>Solved</span>
        )}
      </div>

      <p style={{ margin: '6px 0 0', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: PAPER_TEXT_FAINT }}>
        {dateLabel}
      </p>

      <p style={{ margin: '8px 0 14px', fontSize: '13px', lineHeight: 1.55, color: PAPER_TEXT_MUTED }}>
        {solved
          ? `Done in ${moves ?? par} move${moves === 1 ? '' : 's'}. A new puzzle arrives at midnight.`
          : `One puzzle, the same for everyone playing today. Match par for all three stars.`}
      </p>

      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: '14px', flexWrap: 'wrap',
        borderTop: `1px solid ${PAPER_BORDER}`, paddingTop: '12px',
      }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <Stat label="Streak" value={streak > 0 ? `${streak}d` : '—'} tone={streak > 0 ? accent : PAPER_TEXT_FAINT} />
          <Stat label="Best" value={best > 0 ? `${best}d` : '—'} />
          {solved
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{
                  fontSize: TEXT_MICRO, fontWeight: 800, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: PAPER_TEXT_FAINT,
                }}>Today</span>
                <SolvedStars stars={stars} />
              </div>
            : <Stat label="Reward" value={`+${reward}`} />}
        </div>

        <span style={{
          fontSize: '12px', fontWeight: 900, letterSpacing: '0.10em', textTransform: 'uppercase',
          color: solved ? PAPER_TEXT_MUTED : UI_CREAM,
          background: solved ? PAPER_BG_MUTED : accent,
          border: `1px solid ${solved ? PAPER_BORDER : accent}`,
          borderRadius: '999px', padding: '7px 16px', whiteSpace: 'nowrap',
        }}>
          {solved ? 'Play again' : 'Play'}
        </span>
      </div>
    </button>
  );
}
