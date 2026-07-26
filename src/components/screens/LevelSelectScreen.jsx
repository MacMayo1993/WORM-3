import React, { useState, useEffect } from 'react';
import { loadProgress, progressManager } from '../../utils/levels.js';
import { getPack } from '../../levels/index.js';
import {
  UI_FONT, PAPER_SHEET_RAISED, PAPER_BORDER, PAPER_BORDER_SOFT, PAPER_TEXT,
  PAPER_TEXT_MUTED, PAPER_TEXT_FAINT, PAPER_BG_MUTED, PAPER_CARD_SHADOW, UI_MOSS,
} from '../../utils/uiTheme.js';
import { wizardPaperBackground } from './WizardChrome.jsx';

// Warm amber that holds up on cream — the cream-on-blue gold used before is
// invisible against paper.
const STAR_GOLD = '#c8902a';
const STAR_EMPTY = 'rgba(30, 22, 18, 0.16)';

const STARS_PER_LEVEL = 3;

// Persisted "best" values become null once they round-trip through JSON
// (Infinity serializes to null), so treat anything non-positive as "unset".
const isRecorded = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;

const formatTime = (seconds) => {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const BestStats = ({ stats }) => {
  if (!stats) return null;
  const parts = [];
  if (isRecorded(stats.bestMoves)) parts.push(`${stats.bestMoves} moves`);
  if (isRecorded(stats.bestTime)) parts.push(formatTime(stats.bestTime));
  if (parts.length === 0) return null;
  return (
    <div style={{
      marginTop: '4px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em',
      color: PAPER_TEXT_MUTED, textAlign: 'center', lineHeight: 1,
    }}>
      {parts.join(' · ')}
    </div>
  );
};

const StarRow = ({ count, earned }) => (
  <div style={{ display: 'flex', gap: '1px', marginTop: '5px', lineHeight: 1 }}>
    {Array.from({ length: count }).map((_, i) => (
      <span
        key={i}
        style={{
          fontSize: '11px',
          color: i < earned ? STAR_GOLD : STAR_EMPTY,
        }}
      >
        ★
      </span>
    ))}
  </div>
);

const LevelSelectScreen = ({ onSelectLevel, onBack, packId = 'story-campaign' }) => {
  const pack = getPack(packId) ?? getPack('story-campaign');
  const LEVELS = pack.levels;
  const [completedLevels, setCompletedLevels] = useState([]);
  const [levelStats, setLevelStats] = useState({});
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    setCompletedLevels(loadProgress());
    setLevelStats(progressManager.loadLevelStats());
  }, []);

  // The chapter the player is up to — first unlocked one they have not beaten.
  // Computed once rather than per card so the grid stays O(n).
  const nextChapterId = LEVELS.find((l) => {
    const prereq = l.requirements?.previousLevel ?? null;
    return (prereq === null || completedLevels.includes(prereq)) && !completedLevels.includes(l.id);
  })?.id ?? null;

  // Both counters are scoped to THIS pack. Summing all of levelStats / all of
  // completedLevels would fold other packs' progress into this pack's header
  // now that three of them share one flat progress store.
  const packIds = LEVELS.map((l) => l.id);
  const completedInPack = packIds.filter((id) => completedLevels.includes(id)).length;
  const totalStars = LEVELS.length * STARS_PER_LEVEL;
  const earnedStars = packIds.reduce(
    (sum, id) => sum + Math.min(levelStats[id]?.stars || 0, STARS_PER_LEVEL), 0
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      height: '100dvh',
      zIndex: 2000,
      // Mobi's graph paper — the same surface as the setup wizards and dialogue
      // panel. Level Select is a decision screen, so it belongs to the paper
      // half of the system, not a bespoke palette of its own.
      ...wizardPaperBackground,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: UI_FONT,
      animation: 'lvSelIn 0.3s ease',
      padding: 'max(14px, env(safe-area-inset-top, 0px)) 14px max(14px, env(safe-area-inset-bottom, 0px))',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {/* Soft page-light down the centre, warm rather than the old cool beam */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '50%', width: '34%',
        transform: 'translateX(-50%)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.06))',
        filter: 'blur(24px)', pointerEvents: 'none',
      }} />

      {/* Top bar — star counter */}
      <div style={{
        width: '100%', maxWidth: '540px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 6px 14px', boxSizing: 'border-box', position: 'relative', zIndex: 1,
      }}>
        <div>
          <div style={{
            fontSize: '11px', fontWeight: 900, color: PAPER_TEXT,
            letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>{pack.name}</div>
          <div style={{
            marginTop: '3px', fontSize: '10px', fontWeight: 700,
            color: PAPER_TEXT_MUTED, letterSpacing: '0.07em', textTransform: 'uppercase',
          }}>{completedInPack}/{LEVELS.length} chapters complete</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{
            fontSize: '20px', fontWeight: 800, color: PAPER_TEXT, letterSpacing: '0.02em',
          }}>
            {earnedStars}/{totalStars}
          </span>
          <span style={{ fontSize: '22px', color: STAR_GOLD }}>★</span>
        </div>
      </div>

      {/* Level card grid */}
      <div style={{
        width: '100%', maxWidth: '540px', position: 'relative', zIndex: 1,
        overflowY: 'auto', flex: 1,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          paddingBottom: '90px',
        }}>
          {LEVELS.map((level) => {
            // Pack-relative: a level is open when its declared prerequisite is
            // done. isLevelUnlocked walks the story campaign, so it reported
            // every level of another pack as locked. testMode still has to be
            // honoured here — it is the one switch that opens the campaign for
            // dev builds and for ?unlockall=1, and computing the prerequisite
            // inline skips the check that used to apply it.
            const prereq = level.requirements?.previousLevel ?? null;
            const unlocked = progressManager.testMode || prereq === null || completedLevels.includes(prereq);
            const beaten = completedLevels.includes(level.id);
            const stat = levelStats[level.id];
            const stars = stat?.stars || 0;
            const isHover = hovered === level.id && unlocked;
            const isNext = level.id === nextChapterId;

            return (
              <button
                key={level.id}
                onClick={() => unlocked && onSelectLevel(level.id)}
                onMouseEnter={() => setHovered(level.id)}
                onMouseLeave={() => setHovered(null)}
                disabled={!unlocked}
                aria-label={`${unlocked ? (beaten ? 'Replay completed' : 'Play') : 'Locked'} level ${level.id}: ${level.name}`}
                style={{
                  position: 'relative',
                  minHeight: '132px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  borderRadius: '14px',
                  cursor: unlocked ? 'pointer' : 'not-allowed',
                  border: `1.5px solid ${isNext ? UI_MOSS : unlocked ? PAPER_BORDER_SOFT : PAPER_BORDER}`,
                  background: unlocked ? PAPER_SHEET_RAISED : PAPER_BG_MUTED,
                  // Chunky bottom edge for a physical "tile" feel; locked chapters
                  // sit flush and pressed-in instead of raised.
                  boxShadow: unlocked
                    ? `0 4px 0 ${PAPER_CARD_SHADOW}, 0 7px 14px rgba(60, 48, 34, ${isHover ? 0.18 : 0.12})`
                    : 'inset 0 2px 6px rgba(60, 48, 34, 0.13)',
                  transform: isHover ? 'translateY(-2px)' : 'translateY(0)',
                  transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                }}
              >
                {unlocked ? (
                  <>
                    {/* Completion was previously readable only by counting filled
                        stars — and a 1-star clear looks much like an unplayed
                        chapter at a glance. The badge states it outright. */}
                    {beaten && (
                      <span
                        aria-hidden
                        style={{
                          position: 'absolute', top: '8px', right: '8px',
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: UI_MOSS, color: '#fffdf5',
                          fontSize: '12px', fontWeight: 900, lineHeight: '20px',
                          textAlign: 'center',
                        }}
                      >✓</span>
                    )}
                    {isNext && (
                      <span style={{
                        position: 'absolute', top: '8px', left: '8px',
                        fontSize: '8px', fontWeight: 900, letterSpacing: '0.14em',
                        textTransform: 'uppercase', color: UI_MOSS,
                      }}>Next</span>
                    )}
                    <span style={{
                      fontSize: '26px',
                      fontWeight: 800,
                      color: PAPER_TEXT,
                      lineHeight: 1,
                    }}>
                      {level.id}
                    </span>
                    <span style={{
                      marginTop: '7px', padding: '0 8px',
                      color: PAPER_TEXT_MUTED, fontSize: '10px', fontWeight: 800,
                      letterSpacing: '0.06em', lineHeight: 1.2, textAlign: 'center',
                      textTransform: 'uppercase',
                    }}>
                      {level.name}
                    </span>
                    <StarRow count={STARS_PER_LEVEL} earned={stars} />
                    <BestStats stats={stat} />
                  </>
                ) : (
                  /* Locked chapters used to render a bare padlock — no name, no
                     number, nothing to want. Showing the chapter you are working
                     toward makes the ladder visible. */
                  <>
                    <span style={{
                      fontSize: '22px', fontWeight: 800, color: PAPER_TEXT_FAINT, lineHeight: 1,
                    }}>
                      {level.id}
                    </span>
                    <span style={{
                      marginTop: '6px', padding: '0 8px',
                      color: PAPER_TEXT_FAINT, fontSize: '10px', fontWeight: 800,
                      letterSpacing: '0.06em', lineHeight: 1.2, textAlign: 'center',
                      textTransform: 'uppercase', opacity: 0.85,
                    }}>
                      {level.name}
                    </span>
                    <svg width="17" height="20" viewBox="0 0 24 28" aria-hidden="true" style={{ marginTop: '7px' }}>
                      <path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke={PAPER_TEXT_FAINT} strokeWidth="2.4" strokeLinecap="round" />
                      <rect x="4.5" y="11" width="15" height="12.5" rx="2.6" fill={PAPER_TEXT_FAINT} />
                      <circle cx="12" cy="16.5" r="1.7" fill={PAPER_BG_MUTED} />
                      <rect x="11.2" y="17.5" width="1.6" height="3.6" rx="0.8" fill={PAPER_BG_MUTED} />
                    </svg>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Round red back button — bottom-left */}
      <button
        onClick={onBack}
        aria-label="Back"
        style={{
          position: 'absolute',
          left: 'max(18px, env(safe-area-inset-left, 0px))',
          bottom: 'max(18px, env(safe-area-inset-bottom, 0px))',
          width: '58px', height: '58px', borderRadius: '50%',
          border: `1.5px solid ${PAPER_BORDER_SOFT}`,
          background: PAPER_SHEET_RAISED,
          boxShadow: `0 4px 0 ${PAPER_CARD_SHADOW}, 0 7px 14px rgba(60, 48, 34, 0.16)`,
          cursor: 'pointer', zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.12s ease, box-shadow 0.12s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        onMouseDown={e => { e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = `0 1px 0 ${PAPER_CARD_SHADOW}, 0 3px 8px rgba(60,48,34,0.16)`; }}
        onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 0 ${PAPER_CARD_SHADOW}, 0 7px 14px rgba(60,48,34,0.16)`; }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 4 L7 12 L15 20" fill="none" stroke={PAPER_TEXT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <style>{`
        @keyframes lvSelIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default LevelSelectScreen;
