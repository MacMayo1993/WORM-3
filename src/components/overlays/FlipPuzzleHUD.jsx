import React, { useEffect, useState } from 'react';
import { useGameStore, selectEffectiveFlipCap } from '../../hooks/useGameStore.js';
import { LESSON_MS, ROLL_MS, scarredPairs, showingRelapseLesson } from '../../game/flipRelapse.js';
import './flipPuzzleHUD.css';

export default function FlipPuzzleHUD({ level }) {
  const [hint, setHint] = useState(false);
  const flips = useGameStore(s => s.flipRun.flips);
  const elapsed = useGameStore(s => s.flipRun.elapsed);
  const due = useGameStore(s => s.flipRun.nextRoll);
  const event = useGameStore(s => s.flipRun.event);
  const lesson = useGameStore(showingRelapseLesson);
  const candidates = useGameStore(s => scarredPairs(s.cubies, s.size, selectEffectiveFlipCap(s))
    .some(p => !(s.flipRun.cooldowns[p.id] > s.flipRun.elapsed || s.flipRun.cooldowns[p.twinId] > s.flipRun.elapsed)));
  useEffect(() => {
    useGameStore.setState({ flipHintBand: !!(hint && level?.id === 604) });
    return () => useGameStore.setState({ flipHintBand: false });
  }, [hint, level?.id]);
  const remaining = Math.max(0, (lesson ? LESSON_MS : due) - elapsed);
  const seconds = Math.ceil(remaining / 1000);
  const showClock = candidates && (level ? level.relapse : true);
  const last = event && elapsed - event.at < 4000 ? event : null;
  if (!level && !showClock && !last) return null;
  return <aside className="flip-puzzle-hud" data-camera-avoid aria-label="Flip puzzle">
    <div className="flip-puzzle-row">
      {level && <><strong>Flips {flips}</strong><span>{level.flipPar ? 'Target ' + level.flipPar : 'Try for zero flips'}</span></>}
      {showClock && <span className="flip-clock" aria-label={'Next relapse roll in ' + seconds + ' seconds'}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="9" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - remaining / (lesson ? LESSON_MS : ROLL_MS)} /></svg>
        {seconds}s</span>}
      {level && <button type="button" aria-expanded={hint} onClick={() => setHint(v => !v)}>{hint ? 'Hide hint' : 'Hint'}</button>}
    </div>
    {hint && <><p>{level.tutorial.tip}</p><button type="button" onClick={() => useGameStore.getState().setShowNetPanel(true)}>Open cube net</button></>}
    {lesson && <p>Watch the cracked edge.</p>}
    <div role="status">{last && <p>{last.hits.length === 1 ? 'Scarred pair flipped' : last.hits.length + ' scarred pairs flipped'} · {last.hits.map(hit => hit.from + ' ↔ ' + hit.to).join(', ')}</p>}</div>
  </aside>;
}
