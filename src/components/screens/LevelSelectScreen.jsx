import React, { useState, useEffect } from 'react';
import { LEVELS, isLevelUnlocked, loadProgress, progressManager } from '../../utils/levels.js';
import { UI_FONT, GLASS_PANEL_BORDER } from '../../utils/uiTheme.js';

const STARS_PER_LEVEL = 3;

const StarRow = ({ count, earned }) => (
  <div style={{ display: 'flex', gap: '1px', marginTop: '5px', lineHeight: 1 }}>
    {Array.from({ length: count }).map((_, i) => (
      <span
        key={i}
        style={{
          fontSize: '11px',
          color: i < earned ? '#ffd23f' : 'rgba(40, 70, 110, 0.35)',
          textShadow: i < earned ? '0 1px 1px rgba(150, 90, 0, 0.55)' : 'none',
        }}
      >
        ★
      </span>
    ))}
  </div>
);

const LevelSelectScreen = ({ onSelectLevel, onBack }) => {
  const [completedLevels, setCompletedLevels] = useState([]);
  const [levelStats, setLevelStats] = useState({});
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    setCompletedLevels(loadProgress());
    setLevelStats(progressManager.loadLevelStats());
  }, []);

  const totalStars = LEVELS.length * STARS_PER_LEVEL;
  const earnedStars = Object.values(levelStats).reduce((sum, stats) => sum + Math.min(stats.stars || 0, STARS_PER_LEVEL), 0);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      height: '100dvh',
      zIndex: 2000,
      // Bright steel-blue field with a soft vertical light beam, like the reference.
      background: 'linear-gradient(180deg, #6f9fd8 0%, #4a7cb6 48%, #2f5b93 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: UI_FONT,
      animation: 'lvSelIn 0.3s ease',
      padding: 'max(14px, env(safe-area-inset-top, 0px)) 14px max(14px, env(safe-area-inset-bottom, 0px))',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {/* Center light beam */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '50%', width: '34%',
        transform: 'translateX(-50%)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.02))',
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
            fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.82)',
            letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>Life Journey</div>
          <div style={{
            marginTop: '3px', fontSize: '10px', fontWeight: 700,
            color: 'rgba(229,240,255,0.72)', letterSpacing: '0.07em', textTransform: 'uppercase',
          }}>{completedLevels.length}/{LEVELS.length} chapters complete</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{
            fontSize: '20px', fontWeight: 800, color: '#fff',
            textShadow: '0 2px 3px rgba(0, 30, 70, 0.45)', letterSpacing: '0.02em',
          }}>
            {earnedStars}/{totalStars}
          </span>
          <span style={{ fontSize: '22px', color: '#ffd23f', textShadow: '0 1px 2px rgba(150,90,0,0.6)' }}>★</span>
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
            const unlocked = isLevelUnlocked(level.id, completedLevels);
            const stars = levelStats[level.id]?.stars || 0;
            const isHover = hovered === level.id && unlocked;

            return (
              <button
                key={level.id}
                onClick={() => unlocked && onSelectLevel(level.id)}
                onMouseEnter={() => setHovered(level.id)}
                onMouseLeave={() => setHovered(null)}
                disabled={!unlocked}
                aria-label={`${unlocked ? 'Play' : 'Locked'} level ${level.id}: ${level.name}`}
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
                  border: unlocked ? '1px solid rgba(255,255,255,0.85)' : '1px solid rgba(255,255,255,0.18)',
                  background: unlocked
                    ? 'linear-gradient(180deg, #f3f8ff 0%, #cddcf2 100%)'
                    : 'linear-gradient(180deg, #3a608f 0%, #2b4a73 100%)',
                  // Chunky bottom edge + soft drop shadow for a physical "tile" feel.
                  boxShadow: unlocked
                    ? `0 4px 0 rgba(26, 54, 96, ${isHover ? 0.55 : 0.4}), 0 7px 12px rgba(0, 20, 50, 0.3)`
                    : 'inset 0 2px 6px rgba(0, 20, 50, 0.4)',
                  transform: isHover ? 'translateY(-2px)' : 'translateY(0)',
                  transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                }}
              >
                {unlocked ? (
                  <>
                    <span style={{
                      fontSize: '26px',
                      fontWeight: 800,
                      color: '#214a86',
                      textShadow: '0 1px 0 rgba(255,255,255,0.7)',
                      lineHeight: 1,
                    }}>
                      {level.id}
                    </span>
                    <span style={{
                      marginTop: '7px', padding: '0 8px',
                      color: '#31578f', fontSize: '10px', fontWeight: 800,
                      letterSpacing: '0.06em', lineHeight: 1.2, textAlign: 'center',
                      textTransform: 'uppercase',
                    }}>
                      {level.name}
                    </span>
                    <StarRow count={STARS_PER_LEVEL} earned={stars} />
                  </>
                ) : (
                  <svg width="22" height="26" viewBox="0 0 24 28" aria-hidden="true">
                    <path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="rgba(220,232,255,0.6)" strokeWidth="2.4" strokeLinecap="round" />
                    <rect x="4.5" y="11" width="15" height="12.5" rx="2.6" fill="rgba(220,232,255,0.55)" />
                    <circle cx="12" cy="16.5" r="1.7" fill="#2b4a73" />
                    <rect x="11.2" y="17.5" width="1.6" height="3.6" rx="0.8" fill="#2b4a73" />
                  </svg>
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
          border: '2px solid rgba(255,255,255,0.85)',
          background: 'radial-gradient(circle at 35% 30%, #ff5a5a 0%, #e23b3b 55%, #b81f1f 100%)',
          boxShadow: '0 5px 0 rgba(120, 18, 18, 0.6), 0 8px 14px rgba(0,0,0,0.35)',
          cursor: 'pointer', zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.12s ease, box-shadow 0.12s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        onMouseDown={e => { e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = '0 2px 0 rgba(120,18,18,0.6), 0 4px 8px rgba(0,0,0,0.35)'; }}
        onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 5px 0 rgba(120,18,18,0.6), 0 8px 14px rgba(0,0,0,0.35)'; }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 4 L7 12 L15 20" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <style>{`
        @keyframes lvSelIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default LevelSelectScreen;
