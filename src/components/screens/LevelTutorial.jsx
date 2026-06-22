import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getNewFeatures } from '../../utils/levels.js';

/**
 * Level Tutorial — Mobi-driven level briefing.
 *
 * Civ-6-style dialogue: Mobi's portrait peeks up from the bottom-left, a
 * nameplate tab labels the level, and a full-width panel steps through the
 * level's dialogue lines. Replaces the old plain info card so Mobi himself
 * greets the player and explains each level.
 */

// ── Keyframes (injected once) ───────────────────────────────────────────────
const _STYLE_ID = 'mobi-level-tutorial-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(_STYLE_ID)) {
  const s = document.createElement('style');
  s.id = _STYLE_ID;
  s.textContent = `
    @keyframes ltMobiSlideIn  { from { transform: translateX(-30px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes ltMobiOut       { from { opacity: 1; transform: translateX(0) scale(1); } to { opacity: 0; transform: translateX(-22px) scale(0.95); } }
    @keyframes ltPanelRise     { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes ltPanelDown     { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(10px); } }
    @keyframes ltTextFade      { from { opacity: 0; } to { opacity: 1; } }
    @keyframes ltCursorBlink   { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
  `;
  document.head.appendChild(s);
}

// Build the dialogue lines for a level: prefer hand-authored Mobi lines,
// otherwise derive from the level's tutorial text + tip.
const buildLines = (level) => {
  const t = level.tutorial || {};
  if (t.mobiLines && t.mobiLines.length) return t.mobiLines;
  const lines = [];
  if (t.text) lines.push(t.text);
  if (t.tip) lines.push(`Tip: ${t.tip}`);
  if (!lines.length) lines.push(`Level ${level.id}: ${level.name}`);
  return lines;
};

const LevelTutorial = ({ level, onClose, onMainMenu }) => {
  const [index, setIndex] = useState(0);
  const [isDismissing, setDismissing] = useState(false);

  const lines = useMemo(() => (level ? buildLines(level) : []), [level]);
  const newFeatures = useMemo(() => (level ? getNewFeatures(level.id) : []), [level]);
  const isLast = index === lines.length - 1;

  const dismiss = useCallback(() => {
    setDismissing(true);
    setTimeout(() => onClose?.(), 600);
  }, [onClose]);

  const advance = useCallback(() => {
    if (isDismissing) return;
    if (isLast) dismiss();
    else setIndex((i) => i + 1);
  }, [isDismissing, isLast, dismiss]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        advance();
      } else if (e.key === 'ArrowLeft') {
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Escape') {
        dismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, dismiss]);

  if (!level || !level.tutorial) return null;

  const isFinale = level.id === 10;
  const accent = isFinale ? 'rgba(167, 139, 250, 0.9)' : 'rgba(0, 210, 248, 0.85)';
  const accentSolid = isFinale ? '#a78bfa' : '#00d2f8';
  const PANEL_H = 'clamp(150px, 22vh, 200px)';
  const NAMEPLATE_H = 32;
  const mobiImgSrc = `${import.meta.env.BASE_URL}Mobi.png`;

  const mobiAnim = isDismissing ? 'ltMobiOut 0.5s ease forwards' : 'ltMobiSlideIn 0.45s cubic-bezier(0.16,1,0.3,1) forwards';
  const uiAnim = isDismissing ? 'ltPanelDown 0.35s ease forwards' : 'ltPanelRise 0.4s cubic-bezier(0.16,1,0.3,1) forwards';

  return (
    <div
      onClick={advance}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2500,
        background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 55%)',
        pointerEvents: isDismissing ? 'none' : 'auto',
        cursor: isDismissing ? 'default' : 'pointer',
      }}
    >
      {/* Backdrop blur */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        backdropFilter: isDismissing ? 'blur(0px)' : 'blur(6px)',
        WebkitBackdropFilter: isDismissing ? 'blur(0px)' : 'blur(6px)',
        transition: 'backdrop-filter 0.6s ease, -webkit-backdrop-filter 0.6s ease',
      }} />

      {/* Mobi portrait — bottom-left, behind the panel */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        zIndex: 901,
        pointerEvents: 'none',
        lineHeight: 0,
        animation: mobiAnim,
      }}>
        <img
          src={mobiImgSrc}
          alt="Mobi"
          style={{ display: 'block', height: 'clamp(360px, 58vh, 640px)', width: 'auto' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      {/* Nameplate tab — sits on the top-left edge of the panel */}
      <div style={{
        position: 'absolute',
        bottom: PANEL_H,
        left: 0,
        zIndex: 2502,
        pointerEvents: 'none',
        animation: uiAnim,
      }}>
        <div style={{
          background: accent,
          clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)',
          padding: '2px',
          display: 'inline-block',
        }}>
          <div style={{
            background: 'rgba(2, 7, 20, 0.97)',
            height: NAMEPLATE_H,
            padding: '0 24px 0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{
              fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
              fontSize: 14, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#fff',
            }}>MOBI</span>
            <span style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: 9, fontWeight: 600, letterSpacing: '0.15em',
              textTransform: 'uppercase', color: accentSolid, opacity: 0.9,
            }}>
              {`Level ${isFinale ? '∞' : level.id} · ${level.name}`}
            </span>
          </div>
        </div>
      </div>

      {/* Dialogue panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          minHeight: PANEL_H,
          background: 'rgba(3, 7, 20, 0.93)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: `2px solid ${accent}`,
          boxShadow: `0 -2px 40px ${accentSolid}22`,
          zIndex: 2501,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop: 'clamp(12px, 2vh, 18px)',
          paddingLeft: 'clamp(120px, 16vw, 220px)',
          paddingRight: 'clamp(16px, 3vw, 32px)',
          paddingBottom: 'max(clamp(16px, 3vh, 26px), env(safe-area-inset-bottom, 0px))',
          boxSizing: 'border-box',
          animation: uiAnim,
        }}
      >
        {/* Meta strip: size · difficulty + newly unlocked feature chips */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '8px',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: accentSolid, opacity: 0.85, fontFamily: 'system-ui, sans-serif',
          }}>
            {`${level.cubeSize}×${level.cubeSize}`} · {level.difficulty}
          </span>
          {newFeatures.map((feat, i) => (
            <span key={i} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: '5px',
              background: 'rgba(34, 197, 94, 0.14)', border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#4ade80', fontFamily: 'system-ui, sans-serif', fontWeight: 600,
            }}>
              ✦ {feat}
            </span>
          ))}
        </div>

        {/* Dialogue text */}
        <div key={index} style={{ flex: 1, display: 'flex', alignItems: 'center', animation: 'ltTextFade 0.2s ease forwards' }}>
          <p style={{
            margin: 0,
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: 'clamp(14px, 2.8vw, 18px)',
            fontWeight: 450,
            color: '#e6f2ff',
            lineHeight: 1.5,
            letterSpacing: '0.005em',
          }}>
            {lines[index]}
            <span style={{
              display: 'inline-block', width: '2px', height: '1em', background: accentSolid,
              marginLeft: '3px', verticalAlign: 'middle', opacity: 0.7,
              animation: 'ltCursorBlink 1s step-end infinite',
            }} />
          </p>
        </div>

        {/* Footer: progress dots + controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {lines.map((_, i) => (
              <div key={i} style={{
                width: i === index ? '16px' : '5px',
                height: '5px',
                borderRadius: '3px',
                background: i === index ? accentSolid : `${accentSolid}4d`,
                transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
              }} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {onMainMenu && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onMainMenu(); }}
                style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.18)',
                  color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 500,
                  padding: '5px 12px', borderRadius: '4px', cursor: 'pointer',
                  fontFamily: 'system-ui, sans-serif', letterSpacing: '0.06em', transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
              >
                ← Menu
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); advance(); }}
              style={{
                background: isLast ? accentSolid : `${accentSolid}1f`,
                border: `1px solid ${accentSolid}`,
                color: isLast ? '#000e1a' : accentSolid,
                fontSize: '12px', fontWeight: 700,
                padding: '6px 22px', borderRadius: '4px', cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase',
                boxShadow: isLast ? `0 0 18px ${accentSolid}99` : `0 0 8px ${accentSolid}33`,
                transition: 'all 0.18s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 22px ${accentSolid}cc`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = isLast ? `0 0 18px ${accentSolid}99` : `0 0 8px ${accentSolid}33`; e.currentTarget.style.transform = 'none'; }}
            >
              {isLast ? "▶ Let's go" : 'Next ▶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LevelTutorial;
