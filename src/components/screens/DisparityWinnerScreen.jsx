import React, { useEffect, useState, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../hooks/useGameStore.js';
import { FACE_INFO, getFaceFromGridId } from '../../utils/disparityBetting.js';
import { predictionLabel } from '../../game/chaosExperience.js';
import { XpRunSummary } from '../../progression/ProgressWidgets.jsx';
import { Z, UI_FONT, DISPLAY_FONT, MONO_FONT } from '../../utils/uiTheme.js';
import '../../chaos/chaos.css';
import { useDialogBehavior } from '../ui/Panel.jsx';

const sourceName = source => source === 'conway' ? 'Surface surge' : source === 'chain' ? 'Chain spread' : 'Chaos';
export default function DisparityWinnerScreen({ onDismiss, primaryLabel = 'Play Again', onSecondary, secondaryLabel, onConfigure }) {
  const { winner, deaths, result, run, record } = useGameStore(useShallow(s => ({
    winner: s.disparityWinner, deaths: s.disparityDeaths, result: s.lastBetResult,
    run: s.chaosExperience, record: s.chaosRecord,
  })));
  const [ready, setReady] = useState(false);
  const dialogRef = useRef(null);
  const onDialogKeyDown = useDialogBehavior(dialogRef, ready ? onSecondary : undefined);
  useEffect(() => { const t = setTimeout(() => setReady(true), 500); return () => clearTimeout(t); }, []);
  const pair = winner?.pair || (winner?.gridId ? [winner.gridId] : []);
  const elapsed = run?.endedAt != null ? Math.max(0, Math.round((run.endedAt - run.startedAt) / 1000)) : null;
  const events = run?.events || [];
  const predictedFaces = run?.prediction?.type === 'PAIR'
    ? { RO: [1, 4], GB: [2, 5], WY: [3, 6] }[run.prediction.pick] || []
    : ['FIRST_OUT', 'SURVIVOR'].includes(run?.prediction?.type) ? [run.prediction.pick] : [];
  const lastBackedEvent = [...events].reverse().find(e => e.tiles.some(id => predictedFaces.includes(getFaceFromGridId(id))));
  const outcome = result?.push ? `${result.wager} PP returned`
    : result?.won ? `Prediction won · +${result.net ?? result.payout - result.wager} PP`
    : result ? `Prediction missed · −${result.wager} PP` : 'Round complete';
  return <div ref={dialogRef} tabIndex={-1} onKeyDown={onDialogKeyDown} className="chaos-ui chaos-results" style={{ zIndex: Z.FULLSCREEN, fontFamily: UI_FONT }} role="dialog" aria-modal="true" aria-labelledby="chaos-result-title">
    <div className="chaos-result-sheet">
      <div className="chaos-kicker">CHAOS · Last pair standing</div>
      <h1 id="chaos-result-title" style={{ fontFamily: DISPLAY_FONT }}>{run?.winningPair || 'Storm settled'}</h1>
      <div className="chaos-winners">
        {pair.map((id, i) => <React.Fragment key={id}>
          {i > 0 && <span aria-hidden="true">↔</span>}
          <div className="chaos-winner-tile" style={{ background: FACE_INFO[getFaceFromGridId(id)]?.hex || '#ddd' }}>
            <small>{FACE_INFO[getFaceFromGridId(id)]?.name}</small>
            <strong style={{ fontFamily: MONO_FONT }}>{id}</strong>
          </div>
        </React.Fragment>)}
      </div>
      <div className="chaos-result-call" data-won={result?.won}>
        <strong>{outcome}</strong>
        {run?.prediction && <p>Your call: {predictionLabel(run.prediction)}.</p>}
        {result && <p>{result.description}</p>}
        {!result && <p>The final survivors outlasted {deaths.length} fallen tiles.</p>}
        {lastBackedEvent && <p>Latest elimination in your color group: {sourceName(lastBackedEvent.source).toLowerCase()} at {Math.max(0, Math.round((lastBackedEvent.at - run.startedAt) / 1000))}s, with {lastBackedEvent.alive} tiles left on the cube.</p>}
      </div>
      <div className="chaos-result-grid">
        <div><strong>{elapsed == null ? '—' : `${elapsed}s`}</strong><small>Round duration</small></div>
        <div><strong>{run?.peakBurst || 0}</strong><small>Largest elimination burst</small></div>
        <div><strong>+{run?.healPoints || 0}</strong><small>Healing PP</small></div>
      </div>
      {!!run?.medals?.length && <><div className="chaos-kicker">This round’s feats</div>
        <div className="chaos-medals">{run.medals.map(medal => <span key={medal}>{medal}</span>)}</div></>}
      <XpRunSummary mode="chaos" />
      <details className="chaos-timeline">
        <summary tabIndex={0}>Round timeline · latest {events.length} elimination bursts</summary>
        <ol>{events.map((event, i) => <li key={`${event.at}-${i}`}>
          <time>{Math.max(0, Math.round((event.at - run.startedAt) / 1000))}s</time>
          <div>{sourceName(event.source)} · {event.tiles.length} eliminated · {event.alive} left
            <small>{event.tiles.join(' · ')}</small></div>
        </li>)}</ol>
      </details>
      <details className="chaos-timeline">
        <summary tabIndex={0}>Full tile ledger · {deaths.length} eliminations</summary>
        <ol>{[...deaths].reverse().map(entry => <li key={entry.gridId}>
          <time>#{entry.rank}</time><div style={{ fontFamily: MONO_FONT }}>{entry.gridId}
            {entry.endGridId && entry.endGridId !== entry.gridId && <small>Final position: {entry.endGridId}</small>}</div>
        </li>)}</ol>
        <p className="chaos-note">Numbers show elimination order, earliest first.</p>
      </details>
      <p className="chaos-note">Your record: {record.rounds} rounds · {record.correct}/{record.predictions} correct predictions · best streak {record.bestStreak}.</p>
      <div className="chaos-actions">
        <button disabled={!ready} onClick={onDismiss}>{primaryLabel}</button>
        {onConfigure && <button disabled={!ready} onClick={onConfigure}>Change setup</button>}
        {onSecondary && <button disabled={!ready} onClick={onSecondary}>{secondaryLabel || 'Main Menu'}</button>}
      </div>
    </div>
  </div>;
}
