import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getNewFeatures } from '../../utils/levels.js';
import { getStoryLevelIds } from '../../levels/index.js';
import { UI_FONT, HAND_FONT } from '../../utils/uiTheme.js';

/**
 * Level Tutorial — Mobi-driven level briefing.
 *
 * Shares the demo's Civ-6 dialogue look: Mobi peeks up from the bottom-left
 * behind a full-width cream graph-paper panel, a nameplate tab labels the
 * chapter, and a large hand-written line steps through the level's dialogue.
 * Keeping this visually identical to the demo intro (MobiIntroScreen) means
 * Mobi feels like the same character whether you meet them in the demo or a
 * story chapter.
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
    @keyframes ltPaperSettle   { from { transform: translateY(16px) rotate(-0.4deg); opacity: 0; } to { transform: translateY(0) rotate(0deg); opacity: 1; } }
    @keyframes ltTextFade      { from { opacity: 0; transform: translateY(2px); filter: blur(0.4px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
    @keyframes ltCursorBlink   { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
    @keyframes ltPencilWiggle  { 0%,100% { transform: translateY(0) rotate(-7deg); } 50% { transform: translateY(-1px) rotate(-3deg); } }
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

  const storyLevelIds = getStoryLevelIds();
  const isFinale = level.id === storyLevelIds[storyLevelIds.length - 1];

  // Paper palette, mirroring the demo's MobiIntroScreen. The finale nudges the
  // accent violet so the last chapter still reads as special.
  const accent = isFinale ? 'rgba(139, 122, 168, 0.82)' : 'rgba(98, 132, 164, 0.78)';
  const accentSolid = isFinale ? '#6d5b95' : '#486f95';
  const pencilLead = '#35404a';
  const paperBase = '#fbf7e9';
  const graphLine = 'rgba(80, 142, 190, 0.20)';
  const graphMajor = 'rgba(80, 142, 190, 0.32)';
  const PANEL_H = 'clamp(166px, 24vh, 230px)';
  const NAMEPLATE_H = 34;
  const mobiImgSrc = `${import.meta.env.BASE_URL}Mobi.webp`;
  const mobiImgFallback = `${import.meta.env.BASE_URL}Mobi.png`;

  const mobiAnim = isDismissing ? 'ltMobiOut 0.5s ease forwards' : 'ltMobiSlideIn 0.45s cubic-bezier(0.16,1,0.3,1) forwards';
  const uiAnim = isDismissing ? 'ltPanelDown 0.35s ease forwards' : 'ltPanelRise 0.4s cubic-bezier(0.16,1,0.3,1) forwards';

  return (
    <div
      onClick={advance}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2500,
        background: 'linear-gradient(to top, rgba(34, 31, 25, 0.38) 0%, rgba(34, 31, 25, 0.10) 42%, transparent 68%)',
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
        backdropFilter: isDismissing ? 'blur(0px)' : 'blur(5px)',
        WebkitBackdropFilter: isDismissing ? 'blur(0px)' : 'blur(5px)',
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
          style={{ display: 'block', height: 'clamp(384px, 62vh, 672px)', width: 'auto' }}
          onError={(e) => {
            if (e.currentTarget.src !== mobiImgFallback) e.currentTarget.src = mobiImgFallback;
            else e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      {/* Nameplate tab — sits on the top-left edge of the panel */}
      <div style={{
        position: 'absolute',
        bottom: PANEL_H,
        left: 0,
        zIndex: 2502,
        pointerEvents: 'none',
        animation: isDismissing ? uiAnim : 'ltPaperSettle 0.48s cubic-bezier(0.16,1,0.3,1) forwards',
      }}>
        <div style={{
          background: accent,
          clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)',
          padding: '2px',
          display: 'inline-block',
        }}>
          <div style={{
            background: paperBase,
            height: NAMEPLATE_H,
            padding: '0 24px 0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: 'inset 0 0 0 1px rgba(91, 72, 45, 0.10)',
          }}>
            <span style={{
              fontFamily: UI_FONT,
              fontSize: 14, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: pencilLead,
            }}>MOBI</span>
            <span style={{
              fontFamily: UI_FONT,
              fontSize: 9, fontWeight: 600, letterSpacing: '0.15em',
              textTransform: 'uppercase', color: accentSolid, opacity: 0.82,
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
          backgroundColor: paperBase,
          backgroundImage: `
            linear-gradient(${graphLine} 1px, transparent 1px),
            linear-gradient(90deg, ${graphLine} 1px, transparent 1px),
            linear-gradient(${graphMajor} 1px, transparent 1px),
            linear-gradient(90deg, ${graphMajor} 1px, transparent 1px),
            radial-gradient(circle at 18% 24%, rgba(255,255,255,0.64), transparent 28%),
            linear-gradient(115deg, rgba(255,255,255,0.34), rgba(219,205,176,0.20))
          `,
          backgroundSize: '18px 18px, 18px 18px, 90px 90px, 90px 90px, 100% 100%, 100% 100%',
          backgroundPosition: '0 0, 0 0, -1px -1px, -1px -1px, 0 0, 0 0',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          borderTop: `2px solid ${accent}`,
          boxShadow: '0 -14px 42px rgba(48, 39, 28, 0.22), inset 0 1px 0 rgba(255,255,255,0.72)',
          zIndex: 2501,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop: 'clamp(12px, 2vh, 18px)',
          paddingLeft: 'clamp(16px, 3vw, 32px)',
          paddingRight: 'clamp(16px, 3vw, 32px)',
          paddingBottom: 'max(clamp(20px, 3.5vh, 30px), env(safe-area-inset-bottom, 0px))',
          boxSizing: 'border-box',
          animation: uiAnim,
        }}
      >
        {/* Meta strip: size · difficulty + newly unlocked feature chips */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '6px',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: accentSolid, opacity: 0.82, fontFamily: UI_FONT,
          }}>
            {`${level.cubeSize}×${level.cubeSize}`} · {level.difficulty}
          </span>
          {newFeatures.map((feat, i) => (
            <span key={i} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: '5px',
              background: 'rgba(95, 127, 74, 0.16)', border: '1px solid rgba(95, 127, 74, 0.34)',
              color: '#4a6b2e', fontFamily: UI_FONT, fontWeight: 700,
            }}>
              ✦ {feat}
            </span>
          ))}
        </div>

        {/* Dialogue text — large hand-written line, matching the demo */}
        <div key={index} style={{ flex: 1, display: 'flex', alignItems: 'center', animation: 'ltTextFade 0.2s ease forwards' }}>
          <p style={{
            margin: 0,
            fontFamily: HAND_FONT,
            fontSize: 'clamp(26px, 6.2vw, 40px)',
            fontWeight: 400,
            color: pencilLead,
            lineHeight: 1.4,
            letterSpacing: '0.02em',
            textShadow: '0.35px 0.35px 0 rgba(53,64,74,0.22), -0.25px 0 rgba(53,64,74,0.12)',
          }}>
            {lines[index]}
            <span style={{
              display: 'inline-block', width: '2px', height: '1em', background: pencilLead,
              marginLeft: '5px', verticalAlign: 'middle', opacity: 0.7,
              animation: 'ltCursorBlink 1s step-end infinite, ltPencilWiggle 1.4s ease-in-out infinite',
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
                background: i === index ? accentSolid : 'rgba(72,111,149,0.24)',
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
                  background: 'none', border: '1px solid rgba(53,64,74,0.22)',
                  color: 'rgba(53,64,74,0.58)', fontSize: '11px', fontWeight: 500,
                  padding: '5px 12px', borderRadius: '999px', cursor: 'pointer',
                  fontFamily: UI_FONT, letterSpacing: '0.06em', transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = pencilLead; e.currentTarget.style.borderColor = 'rgba(53,64,74,0.42)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(53,64,74,0.58)'; e.currentTarget.style.borderColor = 'rgba(53,64,74,0.22)'; }}
              >
                ← Menu
              </button>
            )}
            {/* Skip: a briefing should never stand between a player and the
                cube. Hidden on the last line, where "Let's go" already is it. */}
            {!isLast && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); dismiss(); }}
                style={{
                  background: 'none', border: '1px solid rgba(53,64,74,0.22)',
                  color: 'rgba(53,64,74,0.58)', fontSize: '11px', fontWeight: 500,
                  padding: '5px 12px', borderRadius: '999px', cursor: 'pointer',
                  fontFamily: UI_FONT, letterSpacing: '0.06em', transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = pencilLead; e.currentTarget.style.borderColor = 'rgba(53,64,74,0.42)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(53,64,74,0.58)'; e.currentTarget.style.borderColor = 'rgba(53,64,74,0.22)'; }}
              >
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); advance(); }}
              style={{
                background: isLast ? pencilLead : 'rgba(251,247,233,0.72)',
                border: `1px solid ${accentSolid}`,
                color: isLast ? '#fbf7e9' : accentSolid,
                fontSize: '12px', fontWeight: 700,
                padding: '6px 22px', borderRadius: '999px', cursor: 'pointer',
                fontFamily: UI_FONT, letterSpacing: '0.08em', textTransform: 'uppercase',
                boxShadow: isLast ? '0 6px 14px rgba(53,64,74,0.20)' : '0 3px 8px rgba(53,64,74,0.08)',
                transition: 'all 0.18s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 7px 16px rgba(53,64,74,0.24)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = isLast ? '0 6px 14px rgba(53,64,74,0.20)' : '0 3px 8px rgba(53,64,74,0.08)'; e.currentTarget.style.transform = 'none'; }}
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
