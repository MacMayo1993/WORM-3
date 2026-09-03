import React, { useState, useEffect, useMemo } from 'react';
import { levelsManager } from '../../levels/index.js';
import { getLevelPar } from '../../levels/scoring.js';
import { WIN_CONDITIONS } from '../../levels/schema.js';
import { manifoldInversion, isSolidButSplitManifold } from '../../game/winDetection.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { MONO_FONT, PAPER_WARN, PAPER_GOOD, TEXT_MICRO, PAPER_TEXT, PAPER_TEXT_MUTED } from '../../utils/uiTheme.js';

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
  const cubies = useGameStore((s) => s.cubies);
  const size = useGameStore((s) => s.size);

  const tutorial = level?.tutorial;
  const objective = tutorial?.objective || tutorial?.text;
  const levelId = level?.id;

  // On a level where either polarity wins, the player's decision is a COUNT:
  // how many pairs from all-clean against how many from all-dirty. Both numbers
  // are on the cube but nobody can tally 27 pairs by eye, so the HUD keeps them.
  // It reports the state, never which target to pick — that is the puzzle.
  const eitherPolarity = level?.winCondition === WIN_CONDITIONS.ANTIPODAL;
  const manifold = useMemo(() => {
    if (!eitherPolarity || !cubies?.length || cubies.length !== size) return null;
    return { ...manifoldInversion(cubies, size), solidButSplit: isSolidButSplitManifold(cubies, size) };
  }, [eitherPolarity, cubies, size]);

  // Golf target: matching the intended solution length (par) is a 3-star run.
  const par = getLevelPar(level);
  const overPar = par != null && moves > par;
  const parColor = overPar ? PAPER_WARN : PAPER_GOOD;

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
              aria-label={`${moves} move${moves === 1 ? '' : 's'} of ${par} par`}
              style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', color: parColor }}
            >
              <span aria-hidden="true">⛳ {moves}/{par}</span>
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
                fontSize: TEXT_MICRO, fontWeight: 800, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: PAPER_TEXT_MUTED, marginBottom: '4px',
              }}>
                {level.name} · {level.algorithm.quarterTurns} turns
              </div>
              <div style={{
                fontFamily: MONO_FONT, fontSize: '12.5px', fontWeight: 700,
                letterSpacing: '0.04em', color: PAPER_TEXT, lineHeight: 1.45,
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
          {manifold && (
            <div style={{ marginTop: '9px' }}>
              <div style={{
                fontSize: TEXT_MICRO, fontWeight: 800, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: PAPER_TEXT_MUTED, marginBottom: '4px',
              }}>
                Manifold
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.03em', color: PAPER_TEXT }}>
                <span>{manifold.pairs} of {manifold.totalPairs} pairs flipped</span>
                <span aria-hidden="true"> · </span>
                <span style={{ color: PAPER_TEXT_MUTED }}>
                  {manifold.pairs} to all home, {manifold.totalPairs - manifold.pairs} to all flipped
                </span>
              </div>
              {/* The one board that looks solved and is not. Silence here reads
                  as a broken win detector. */}
              {manifold.solidButSplit && (
                <p style={{
                  margin: '6px 0 0', fontSize: '11px', fontWeight: 700, lineHeight: 1.45, color: PAPER_WARN,
                }}>
                  Every face is solid, but the manifold is split — {manifold.pairs} pairs are flipped and{' '}
                  {manifold.totalPairs - manifold.pairs} are not. The cube is solved only when every pair agrees:
                  all home, or all flipped.
                </p>
              )}
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
