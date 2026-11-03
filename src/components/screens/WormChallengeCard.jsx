import React, { useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';

// A live attempt gets one small readout. Explanations and secondary actions
// only open deliberately, while the simulation (and its clock) is paused.
export default function WormChallengeCard({ lesson, state: s, index, count, advice }) {
  const [details, setDetails] = useState(false);
  const dead = s.alive === false;
  const live = s.started && !s.complete && !dead;
  const showDetails = details || !s.started || dead || s.complete;
  const toggle = () => {
    const open = !details;
    setDetails(open);
    if (live) useGameStore.getState().setWormPaused(open);
  };
  return <section className={`worm-challenge-card${showDetails ? ' is-expanded' : ''}`} aria-label="WORM short challenges">
    <div className="worm-challenge-strip">
      <div>
        <strong>{index + 1}/{count} · {lesson.title}</strong>
        <span role="status">{s.complete ? lesson.success : dead ? 'Attempt ended' : s.progress || `${lesson.goal} ${lesson.timeLimit}s`}</span>
      </div>
      {!dead && !s.complete && <button type="button" aria-label="Challenge options" aria-expanded={details} onClick={toggle}>?</button>}
    </div>
    {showDetails && <div className="worm-challenge-details">
      {dead ? <p>{advice}</p> : details && !s.complete && <p>{lesson.instruction}</p>}
      {details && !dead && !s.complete && <small>Clock pauses during help and tunnel rides.</small>}
      <div className="worm-challenge-actions">
        {s.complete ? <button onClick={s.next}>{index === count - 1 ? 'Finish challenges' : 'Next challenge'}</button>
          : dead ? <button autoFocus onClick={s.retry}>Try again</button>
            : !s.started ? <button disabled={!s.prepared} onClick={() => { setDetails(false); s.start(); }}>Start challenge</button>
              : <button onClick={toggle}>Resume</button>}
        {live && details && <button onClick={s.retry}>Retry</button>}
        {!s.complete && (details || dead) && <button onClick={() => s.skip(index)}>Skip challenge</button>}
      </div>
    </div>}
  </section>;
}
