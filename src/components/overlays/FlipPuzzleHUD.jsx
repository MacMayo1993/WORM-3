import React, { useEffect, useMemo, useState } from 'react';
import { useGameStore, selectEffectiveFlipCap } from '../../hooks/useGameStore.js';
import { LESSON_MS, ROLL_MS, scarredPairs, showingRelapseLesson } from '../../game/flipRelapse.js';
import { flipHint, hintLine } from '../../levels/flipHint.js';
import { flipCheckTiles } from '../../game/flipCheck.js';
import { prefersReducedMotion } from '../../utils/device.js';
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
  const cubies = useGameStore(s => s.cubies);
  const size = useGameStore(s => s.size);
  const cap = useGameStore(selectEffectiveFlipCap);
  const check = useGameStore(s => s.flipCheck);
  // The next step of the level's own solution, from the board as it stands. It
  // follows every turn and flip while the hint is open (levels/flipHint.js).
  const step = useMemo(() => (hint && level ? flipHint(level, cubies, size, cap) : null), [hint, level, cubies, size, cap]);
  const wrong = useMemo(() => (check && level ? flipCheckTiles(cubies, size).length : 0), [check, level, cubies, size]);
  useEffect(() => { useGameStore.setState({ flipHint: step }); }, [step]);
  useEffect(() => () => useGameStore.setState({ flipHint: null, flipCheck: false }), []);
  const remaining = Math.max(0, (lesson ? LESSON_MS : due) - elapsed);
  const seconds = Math.ceil(remaining / 1000);
  const ringFraction = Math.min(1, (prefersReducedMotion() ? seconds * 1000 : remaining) / (lesson ? LESSON_MS : ROLL_MS));
  const showClock = candidates && (level ? level.relapse : true);
  const last = event && elapsed - event.at < 4000 ? event : null;
  if (!level && !showClock && !last) return null;
  return <aside className="flip-puzzle-hud" data-camera-avoid aria-label="Flip puzzle">
    <div className="flip-puzzle-row">
      {level && <><strong>Flips {flips}</strong><span>{level.flipPar ? 'Target ' + level.flipPar : 'Try for zero flips'}</span></>}
      {showClock && <span className="flip-clock" aria-label={'Next relapse roll in ' + seconds + ' seconds'}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="9" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - ringFraction} /></svg>
        {seconds}s</span>}
      {level && <button type="button" aria-expanded={hint} onClick={() => setHint(v => !v)}>{hint ? 'Hide hint' : 'Hint'}</button>}
      {level && <button type="button" aria-pressed={check} onClick={() => useGameStore.setState({ flipCheck: !check })}>
        {check ? `Check · ${wrong} off` : 'Check'}</button>}
    </div>
    {hint && <><p className="flip-hint-step">{hintLine(step)}</p><p>{level.tutorial.tip}</p>
      <button type="button" className="flip-net-key" onClick={() => useGameStore.getState().setShowNetPanel(true)}>Open cube net</button></>}
    {lesson && <p>Watch the cracked edge.</p>}
    <div role="status">{last && <p>{last.hits.length === 1 ? 'Scarred pair flipped' : last.hits.length + ' scarred pairs flipped'} · {last.hits.map(hit => hit.from + ' ↔ ' + hit.to).join(', ')}</p>}</div>
  </aside>;
}
