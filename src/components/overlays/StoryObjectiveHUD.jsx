import React, { useState, useEffect } from 'react';
import { getStoryLevelIds } from '../../levels/index.js';

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

  const tutorial = level?.tutorial;
  const objective = tutorial?.objective || tutorial?.text;
  const levelId = level?.id;

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

  // "Chapter X of N" reads from the live campaign list, so it stays correct if
  // the story ever gains or loses chapters. Falls back to the raw id for any
  // level that is not part of the ordered story campaign.
  const storyIds = getStoryLevelIds();
  const chapterIndex = storyIds.indexOf(levelId);
  const chapterLabel =
    chapterIndex >= 0 ? `Chapter ${chapterIndex + 1} of ${storyIds.length}` : `Chapter ${levelId}`;

  return (
    <aside className={`story-objective-hud ${collapsed ? 'is-collapsed' : ''}`} aria-label="Story objective">
      <button
        type="button"
        className="story-objective-toggle"
        onClick={() => setCollapsed((value) => !value)}
        aria-expanded={!collapsed}
      >
        <span className="story-objective-kicker">MOBI&apos;S OBJECTIVE</span>
        <span className="story-objective-chevron" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="story-objective-content">
          <div className="story-objective-chapter">
            <span>{chapterLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{level.name}</span>
          </div>
          <p>{objective}</p>
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
