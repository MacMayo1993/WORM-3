import React, { useState, useEffect } from 'react';
import { levelsManager } from '../../levels/index.js';
import { getLevelPar } from '../../levels/scoring.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { MONO_FONT } from '../../utils/uiTheme.js';

const COLLAPSE_KEY = 'worm3_objective_collapsed';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Persistent, compact story guidance. The intro dialogue establishes why a
 * chapter matters; this card keeps the player's immediate task and optional
 * hint within reach after that dialogue is dismissed.
 */
export default function StoryObjectiveHUD({ level }) {
  // Whether the card is tucked away is a lasting player preference, so it is
  // seeded from — and written back to — storage rather than reset per chapter.
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [showHint, setShowHint] = useState(false);
  const moves = useGameStore((s) => s.moves);

  const tutorial = level?.tutorial;
  const objective = tutorial?.objective || tutorial?.text;
  const levelId = level?.id;

  // Golf target: matching the intended solution length (par) is a 3-star run.
  const par = getLevelPar(level);
  const overPar = par != null && moves > par;
  const parColor = overPar ? '#b06a2e' : '#426b2e';

  // A fresh chapter starts with its hint hidden — never leak the previous
  // chapter's revealed hint into the next one.
  useEffect(() => {
    setShowHint(false);
  }, [levelId]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* storage unavailable (private mode / quota) — non-fatal */
    }
  }, [collapsed]);

  if (!level || !objective) return null;

  // "Chapter X of N" reads from the OWNING pack's ordered list, so it stays
  // correct as packs gain or lose levels — and so a pack numbered in its own id
  // range does not print its raw id ("Chapter 203") instead of its position.
  const ownerLevels = levelsManager.getPackForLevel(levelId)?.levels ?? [];
  const chapterIndex = ownerLevels.findIndex((l) => l.id === levelId);
  const chapterLabel =
    chapterIndex >= 0 ? `Chapter ${chapterIndex + 1} of ${ownerLevels.length}` : `Chapter ${levelId}`;

  return (
    <aside className={`story-objective-hud ${collapsed ? 'is-collapsed' : ''}`} aria-label="Story objective">
      <button
        type="button"
        className="story-objective-toggle"
        onClick={() => setCollapsed((value) => !value)}
        aria-expanded={!collapsed}
      >
        <span className="story-objective-kicker">MOBI&apos;S OBJECTIVE</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          {par != null && (
            <span
              title="Moves so far / Par"
              style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', color: parColor }}
            >
              ⛳ {moves}/{par}
            </span>
          )}
          <span className="story-objective-chevron" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
        </span>
      </button>

      {!collapsed && (
        <div className="story-objective-content">
          <div className="story-objective-chapter">
            <span>{chapterLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{level.name}</span>
          </div>
          <p>{objective}</p>

          {/* Algorithm levels carry the sequence itself. Monospace is reserved
              for grid ids and algorithm notation, so it belongs here. */}
          {level.algorithm && (
            <div style={{
              marginTop: '9px', padding: '8px 10px', borderRadius: '8px',
              background: 'rgba(30, 22, 18, 0.05)', border: '1px solid rgba(30, 22, 18, 0.10)',
            }}>
              <div style={{
                fontSize: '9px', fontWeight: 800, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: '#7a6e62', marginBottom: '4px',
              }}>
                {level.name} · {level.algorithm.quarterTurns} turns
              </div>
              <div style={{
                fontFamily: MONO_FONT, fontSize: '12.5px', fontWeight: 700,
                letterSpacing: '0.04em', color: '#1e1612', lineHeight: 1.45,
              }}>
                {level.algorithm.notation}
              </div>
            </div>
          )}
          {par != null && (
            <div style={{
              marginTop: '9px', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.03em', color: parColor,
            }}>
              <span>Par {par}</span>
              <span aria-hidden="true">·</span>
              <span>{moves} move{moves === 1 ? '' : 's'} so far</span>
              {overPar && <span style={{ opacity: 0.85 }}>(over par)</span>}
            </div>
          )}
          {tutorial?.tip && (
            <>
              <button
                type="button"
                className="story-objective-hint-button"
                onClick={() => setShowHint((value) => !value)}
                aria-expanded={showHint}
              >
                {showHint ? 'Hide Mobi hint' : 'Need a hint?'}
              </button>
              {showHint && <p className="story-objective-hint">{tutorial.tip}</p>}
            </>
          )}
        </div>
      )}
    </aside>
  );
}
