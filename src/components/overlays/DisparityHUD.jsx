import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, selectEffectiveFlipCap } from '../../hooks/useGameStore.js';
import { chaosBoard, chaosStage, predictionLabel, predictionFaces, chaosObjective } from '../../game/chaosExperience.js';
import { bettingPalette, speedThresholdFor } from '../../utils/disparityBetting.js';
import { feel } from '../../utils/feel.js';
import { Z, UI_FONT } from '../../utils/uiTheme.js';
import '../../chaos/chaos.css';
import { ChaosGlyph } from '../../chaos/ChaosArt.jsx';

export default function DisparityHUD() {
  const s = useGameStore(useShallow(state => ({ cubies: state.cubies, size: state.size, settings: state.settings,
    cap: selectEffectiveFlipCap(state), run: state.chaosExperience, winner: state.disparityWinner,
    showWinner: state.showDisparityWinner, focus: state.chaosFocusFaces,
    activeBet: state.activeBet, score: state.disparityParityScore, eliminated: state.disparityEliminatedFaces })));
  const [details, setDetails] = useState(false);
  useEffect(() => { setDetails(false); }, [s.run?.startedAt]);
  const [notice, setNotice] = useState(null);
  const [faceNotice, setFaceNotice] = useState(null);
  const board = useMemo(() => chaosBoard(s.cubies, s.size, s.cap, s.settings), [s.cubies, s.size, s.cap, s.settings]);
  const { faces: faceInfo } = useMemo(() => bettingPalette(s.settings), [s.settings]);
  const latest = s.run?.events.at(-1);
  useEffect(() => {
    if (!latest) { setNotice(null); return; }
    setNotice(latest);
    const timeout = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timeout);
  }, [latest]);
  const latestFace = s.eliminated.at(-1);
  useEffect(() => {
    setFaceNotice(latestFace ?? null);
    if (latestFace == null) return;
    const timeout = setTimeout(() => setFaceNotice(null), 3200);
    return () => clearTimeout(timeout);
  }, [latestFace]);
  const bet = s.run?.prediction || s.activeBet;
  const faces = predictionFaces(bet);
  const backed = faces.reduce((n, f) => n + (board.faces[f]?.alive || 0), 0);
  const danger = faces.reduce((n, f) => n + (board.faces[f]?.danger || 0), 0);
  const stage = chaosStage(board.alive, board.total);
  const objective = chaosObjective(s.run, board);
  const previousStage = useRef(stage);
  useEffect(() => {
    if (stage !== previousStage.current) {
      if (stage === 'Final six') feel('beacon');
      if (stage === 'Last pair standing') feel('parityLock');
    }
    previousStage.current = stage;
  }, [stage]);
  const focusPair = pair => useGameStore.getState().setChaosFocusFaces(
    pair.faces.every(f => s.focus.includes(f)) ? [] : pair.faces);
  if (s.showWinner) return null;
  return <div className="chaos-ui" style={{ fontFamily: UI_FONT }}>
    {s.winner && <div className="chaos-finale" style={{ zIndex: Z.HUD_RAISED }} role="status">
      <ChaosGlyph kind="trophy" /><div className="chaos-kicker">The storm has settled</div>
      <h2>Last pair standing</h2>
      <p>{s.winner.pair?.join(' ↔ ')}</p>
    </div>}
    <section className="chaos-hud" style={{ zIndex: Z.HUD_RAISED }} aria-label="Chaos match">
      <div className="chaos-match" data-finale={board.alive <= 6}>
        <div className="chaos-scoreline">
          <div><div className="chaos-kicker"><i className="chaos-status-dot" /> CHAOS · {s.cap} flip limit</div><h2 aria-live="polite">{stage}</h2></div>
          <div className="chaos-count">{board.alive}<small> / {board.total} tiles</small></div>
        </div>
        <div className="chaos-survival" role="progressbar" aria-label="Surviving tiles" aria-valuenow={board.alive} aria-valuemin={0} aria-valuemax={board.total}>
          {board.pairs.map(pair => <span key={pair.id} style={{ width: `${board.total ? 100 * pair.alive / board.total : 0}%`, background: `linear-gradient(90deg, ${faceInfo[pair.faces[0]].hex}, ${faceInfo[pair.faces[1]].hex})` }} />)}
        </div>
        <div className="chaos-compact-call"><span>{bet ? predictionLabel(bet, s.settings) : 'Tap damaged tiles to heal'}</span><strong>+{s.score} PP</strong></div>
        <button className="chaos-detail-button" onClick={() => setDetails(v => !v)} aria-expanded={details} aria-controls="chaos-match-details">
          {details ? 'Hide match details' : 'Inspect match'} <span aria-hidden="true">{details ? '−' : '+'}</span>
        </button>
        {details && <div className="chaos-expanded" id="chaos-match-details">
          {(faceNotice != null || notice) && !s.winner && <div className="chaos-live-event" key={faceNotice ?? notice?.at}>
            <ChaosGlyph />{faceNotice != null ? `${faceInfo[faceNotice]?.name} eliminated — every tile has fallen` : `${notice.tiles.length} tiles fell · ${notice.source === 'conway' ? 'Surface surge' : 'Chain spread'}`}
          </div>}
          <div className="chaos-prediction">
            <div><div className="chaos-kicker">{bet ? 'Your prediction' : 'Your objective'}</div>
              <strong>{bet ? predictionLabel(bet, s.settings) : 'Heal the storm'}</strong>
              <small>{bet ? `${bet.wager} PP committed` : 'Tap a damaged living tile to start a healing wave.'}</small>
            </div>
            <div style={{ textAlign: 'right' }}>
              {faces.length > 0 ? <><strong className={danger ? 'chaos-danger' : ''}>{backed} alive</strong>
                <small>{bet.type === 'FIRST_OUT' && s.eliminated.length ? (s.eliminated[0] === bet.pick ? 'First fall called' : 'Another color fell first') : danger ? `${danger} near the limit` : backed ? 'Still in play' : 'Color eliminated'}</small></>
                : bet?.type === 'SPEED' ? <small>{speedThresholdFor(s.run?.level, s.cap)}s benchmark<br />First → last elimination</small>
                : <><strong>+{s.score} PP</strong><small>Healing earned</small></>}
            </div>
          </div>
          <div className="chaos-pairs" aria-label="Color pair standings">
            {board.pairs.map(pair => <button className="chaos-pair" key={pair.id}
              aria-label={`Highlight ${pair.label}: ${pair.alive} living tiles`}
              aria-pressed={pair.faces.every(f => s.focus.includes(f))} data-out={pair.alive === 0}
              onClick={() => focusPair(pair)}>
              <span className="chaos-swatches">{pair.faces.map(f => <i key={f} style={{ background: faceInfo[f].hex }} />)}</span>
              <strong>{pair.alive}</strong><small>{pair.label}</small>
              <span className="chaos-pair-meter" aria-hidden="true" style={{ width: `${100 * pair.alive / (2 * s.size * s.size)}%`, background: `linear-gradient(90deg, ${faceInfo[pair.faces[0]].hex}, ${faceInfo[pair.faces[1]].hex})` }} />
            </button>)}
          </div>
          <div className="chaos-objective"><ChaosGlyph kind="heal" /><div style={{ flex: 1 }}>
            <p className="chaos-note">{objective.label}{objective.value != null ? ` · ${objective.value}/${objective.target}` : ''}</p>
            {objective.value != null && <div className="chaos-objective-track" aria-hidden="true"><span style={{ width: `${Math.min(100, 100 * objective.value / objective.target)}%` }} /></div>}
          </div></div>
          <div className="chaos-detail">
            <p className="chaos-note">Tap a color pair above to mark its living tiles on the cube. Marks follow original identity through every flip and turn.</p>
            <p className="chaos-note"><span className="chaos-danger">{board.danger} tiles near elimination.</span> Damage bars fill toward {s.cap}; a notch means one flip remains.</p>
            <p className="chaos-note">Healing changes the outcome. +{s.run?.healPoints || 0} PP earned this round.</p>
            {board.alive <= 6 && <p className="chaos-note">{board.survivors.map(t => `${t.gridId}: ${t.remaining} left`).join(' · ')}</p>}
          </div>
        </div>}
      </div>
    </section>
  </div>;
}
