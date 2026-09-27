import React from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { resolveColors } from '../../utils/colorSchemes.js';
import { ARCADE_PAPER, ARCADE_INK, UI_FONT, HEADING_FONT } from '../../utils/uiTheme.js';
import { inspectionSuspended } from '../../3d/inspectionBridge.js';
import './antipodalCoreKey.css';

const PAIRS = [[1, 4], [2, 5], [3, 6]];

export default function AntipodalCoreKey() {
  const visible = useGameStore(s => !s.captureMode && !inspectionSuspended(s) &&
    (s.showCutawayLens || s.explosionT > 0.15 || s.hollowMode || ['glass', 'gap', 'wireframe'].includes(s.visualMode)));
  const settings = useGameStore(s => s.settings);
  if (!visible) return null;
  const colors = resolveColors(settings, settings?.biomeMode?.faceAssignment);
  return <aside className="antipodal-core-key" aria-label="Antipodal core guide"
    style={{ '--core-paper': ARCADE_PAPER, '--core-ink': ARCADE_INK, fontFamily: UI_FONT }}>
    <strong style={{ fontFamily: HEADING_FONT }}>Antiverse <span aria-hidden="true">A ↔ A′</span></strong>
    <div className="antipodal-core-pairs" aria-label="Three linked color pairs">
      {PAIRS.map(([a, b]) => <span key={a} aria-label={`Face ${a} is paired with face ${b}`}>
        <i style={{ background: colors[a] }} aria-hidden="true" />
        <span aria-hidden="true">↔</span>
        <i style={{ background: colors[b] }} aria-hidden="true" />
      </span>)}
    </div>
    <p>Each inner tile shows the partner of the outer tile above it.</p>
  </aside>;
}
