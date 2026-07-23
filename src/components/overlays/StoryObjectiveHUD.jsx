import React, { useState } from 'react';

/**
 * Persistent, compact story guidance. The intro dialogue establishes why a
 * chapter matters; this card keeps the player's immediate task and optional
 * hint within reach after that dialogue is dismissed.
 */
export default function StoryObjectiveHUD({ level }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const tutorial = level?.tutorial;
  const objective = tutorial?.objective || tutorial?.text;

  if (!level || !objective) return null;

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
            <span>CHAPTER {level.id}</span>
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
