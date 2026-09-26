import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getNewFeatures } from '../../utils/levels.js';
import { getStoryLevelIds } from '../../levels/index.js';
import { HEADING_FONT, ARCADE_INK, ARCADE_INK_STRONG, ARCADE_CARD } from '../../utils/uiTheme.js';
import { MODE_THEMES } from '../../utils/modeThemes.js';
import MobiStage, { MobiKey, useMobiSpeech } from './MobiStage.jsx';

/**
 * Level Tutorial — Mobi-driven level briefing.
 *
 * Shares the demo's dialogue (MobiStage): Mobi peeks up from the bottom-left
 * behind a full-width sheet of the arcade graph paper, a nameplate labels the
 * level, and each line is spoken onto the page. Keeping this identical to the
 * demo intro (MobiIntroScreen) means Mobi feels like the same character whether
 * you meet them in the demo or a story chapter.
 */

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

  const speech = useMobiSpeech(lines[index] ?? '');
  // Advancing while Mobi is mid-line finishes the line first; the next press moves on.
  const advance = useCallback(() => {
    if (isDismissing) return;
    if (speech.finish()) return;
    if (isLast) dismiss();
    else setIndex((i) => i + 1);
  }, [isDismissing, isLast, dismiss, speech]);

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

  const chip = { padding: '4px 9px', borderRadius: 9, border: `2px solid ${ARCADE_INK_STRONG}`, background: ARCADE_CARD,
    color: ARCADE_INK, font: `800 10px/1.2 ${HEADING_FONT}`, letterSpacing: '.1em', textTransform: 'uppercase' };

  return (
    <div
      onClick={advance}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2500,
        background: 'linear-gradient(to top, rgba(38, 55, 45, 0.30) 0%, rgba(38, 55, 45, 0.08) 42%, transparent 68%)',
        pointerEvents: isDismissing ? 'none' : 'auto',
        cursor: isDismissing ? 'default' : 'pointer',
      }}
    >
      {/* Backdrop blur */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backdropFilter: isDismissing ? 'blur(0px)' : 'blur(5px)',
        WebkitBackdropFilter: isDismissing ? 'blur(0px)' : 'blur(5px)',
        transition: 'backdrop-filter 0.6s ease, -webkit-backdrop-filter 0.6s ease',
      }} />
      <MobiStage
        line={lines[index]}
        lineKey={index}
        index={index}
        count={lines.length}
        tag={`Level ${isFinale ? '∞' : level.id} · ${level.name}`}
        dismissing={isDismissing}
        speech={speech}
        meta={<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={chip}>{`${level.cubeSize}×${level.cubeSize}`} · {level.difficulty}</span>
          {newFeatures.map((feat, i) => (
            <span key={i} style={{ ...chip, background: MODE_THEMES.worm.accent, color: '#fffdf2', borderColor: ARCADE_INK }}>✦ {feat}</span>
          ))}
        </div>}
        actions={<>
          {onMainMenu && <MobiKey onClick={(e) => { e.stopPropagation(); onMainMenu(); }}>← Menu</MobiKey>}
          {/* Skip: a briefing should never stand between a player and the
              cube. Hidden on the last line, where "Let's go" already is it. */}
          {!isLast && <MobiKey onClick={(e) => { e.stopPropagation(); dismiss(); }}>Skip</MobiKey>}
          <MobiKey primary={isLast} onClick={(e) => { e.stopPropagation(); advance(); }}>
            {isLast ? "▶ Let's go" : 'Next ▶'}
          </MobiKey>
        </>}
      />
    </div>
  );
};

export default LevelTutorial;
