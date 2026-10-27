import React from 'react';
import { ACTION_CUES, actionCue } from '../../game/actionCues.js';
import './actionCue.css';

export function ActionCue({ kind, children }) {
  const cue = actionCue(kind);
  return <span className="action-cue" data-action-cue={kind} style={{ '--cue-color': cue.color, '--cue-deep': cue.deep }}>
    <span className="action-cue-symbol" aria-hidden="true">{cue.symbol}</span>
    <span>{children ?? cue.label}</span>
  </span>;
}

export default function ActionLegend() {
  return <details className="action-legend">
    <summary>Read the cube</summary>
    <dl>{Object.entries(ACTION_CUES).map(([kind, cue]) => <div key={kind}>
      <dt><ActionCue kind={kind} /></dt><dd>{cue.description}</dd>
    </div>)}</dl>
  </details>;
}
