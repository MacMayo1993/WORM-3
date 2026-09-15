// src/components/overlays/HandsOverlay.jsx
// HUD overlay for Hands Mode: shows recent moves, combo detection, finger hints, and move notation

import React, { useState, useEffect, useRef } from 'react';
import { MOVE_DESCRIPTIONS, HANDS_KEY_MAP, detectCombo } from '../../game/handsInput.js';

// Reverse map: move → key
const MOVE_TO_KEY = {};
for (const [key, move] of Object.entries(HANDS_KEY_MAP)) {
  if (!MOVE_TO_KEY[move]) MOVE_TO_KEY[move] = key.toUpperCase();
}

const HandsOverlay = ({ recentMoves = [], lastMove = null, tps = 0 }) => {
  const [combo, setCombo] = useState(null);
  const comboTimeoutRef = useRef(null);

  // Detect combos when recentMoves changes
  useEffect(() => {
    const detected = detectCombo(recentMoves);
    if (detected) {
      setCombo(detected);
      if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
      comboTimeoutRef.current = setTimeout(() => setCombo(null), 2500);
    }
    return () => {
      if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
    };
  }, [recentMoves]);

  const moveDesc = lastMove ? MOVE_DESCRIPTIONS[lastMove] : null;

  return (
    <div className="hands-overlay">
      {/* Move notation trail */}
      <div className="hands-move-trail">
        {recentMoves.slice(-12).map((move, i) => (
          <span
            key={i}
            className={`hands-move-notation ${i === recentMoves.slice(-12).length - 1 ? 'latest' : ''}`}
          >
            {move}
          </span>
        ))}
      </div>

      {/* Last move detail */}
      {moveDesc && (
        <div className="hands-move-detail">
          <span className="hands-move-plane">{moveDesc.plane}</span>
          <span className="hands-move-finger">{moveDesc.finger}</span>
        </div>
      )}

      {/* Combo alert */}
      {combo && (
        <div className="hands-combo-alert">
          <span className="hands-combo-name">{combo.name}</span>
          <span className="hands-combo-notation">{combo.notation}</span>
        </div>
      )}

      {/* TPS counter */}
      {tps > 0 && (
        <div className="hands-tps">
          {tps.toFixed(1)} TPS
        </div>
      )}

      {/* Compact key reference (always visible) */}
      <div className="hands-key-ref">
        <div className="hands-key-ref-row">
          <span className="hands-key-group">
            <kbd>I</kbd>/<kbd>K</kbd> U
          </span>
          <span className="hands-key-group">
            <kbd>J</kbd>/<kbd>L</kbd> R
          </span>
          <span className="hands-key-group">
            <kbd>F</kbd>/<kbd>D</kbd> L
          </span>
        </div>
        <div className="hands-key-ref-row">
          <span className="hands-key-group">
            <kbd>H</kbd>/<kbd>G</kbd> F
          </span>
          <span className="hands-key-group">
            <kbd>S</kbd>/<kbd>;</kbd> D
          </span>
          <span className="hands-key-group">
            <kbd>,</kbd>/<kbd>M</kbd> M
          </span>
        </div>
      </div>
    </div>
  );
};

export default HandsOverlay;
