import React, { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../hooks/useGameStore.js';
import { WORM_DEMO_LESSONS, wormDemoLesson } from '../../game/wormDemoLessons.js';
import { arcadeModeVars } from '../../utils/arcadeTheme.js';
import '../ui/arcadeTheme.css';
import './wormDemoLesson.css';

export default function WormDemoLessonCard({ onRetry }) {
  const s = useGameStore(useShallow(s => ({ demoWormLessonIndex: s.demoWormLessonIndex, complete: s.demoWormComplete, started: s.demoWormStarted, prepared: s.demoWormPrepared, start: s.startWormDemoLesson,
    progress: s.demoWormProgress, alive: s.wormAlive, paused: s.wormPauseMenuOpen,
    details: s.wormDeathDetails, phase: s.wormGamePhase, finished: s.demoWormFinished,
    retry: s.restartWormDemoLesson, next: s.nextWormDemoLesson, skip: s.skipWormDemoLesson })));
  const lesson = wormDemoLesson(s);
  const retryRef = useRef(null), nextRef = useRef(null);
  useEffect(() => {
    if (s.alive === false && !s.paused) (s.complete && lesson.preview ? nextRef : retryRef).current?.focus();
  }, [s.alive, s.paused, s.complete, lesson.preview]);
  if (s.paused || s.finished || !['active', 'finalHealing'].includes(s.phase ?? 'active')) return null;
  const dead = s.alive === false;
  const cause = s.details?.cause || s.details?.reason;
  // One line per way a run can end (killWormSim reasons), each naming the rule
  // that ended it and the move that avoids it.
  const advice = cause === 'lightning' ? 'Lightning struck you. Move off the marked tile, or jump.' : cause === 'bomb' ? 'A bomb blast hit you. Keep clear of the marked blast tiles.'
    : cause === 'slice-rotation' || cause === 'rotation' ? 'The turning layer caught you. Move clear of its lights.'
    : cause === 'self-collision' || cause === 'self' ? 'You ran into your own body. Steer around it, or press JUMP to hop over it.'
    : cause === 'caution-fall' ? 'The caution-tape timer ran out. Press left, right or jump during the one-second cue to escape.'
    : cause === 'voided' || cause === 'void-tunnel-exhausted' ? 'That tunnel collapsed. An open tunnel holds for three rides; heal it before then.'
    : 'Your run ended. Try this exercise again with a fresh practice board.';
  const index = s.demoWormLessonIndex ?? 0;
  const last = index === WORM_DEMO_LESSONS.length - 1;
  return <section className="arcade-card arcade-paper worm-demo-card" style={arcadeModeVars('worm')} aria-label="WORM practice">
    <div className="worm-demo-heading"><strong>{lesson.title}</strong><span>{(s.demoWormLessonIndex ?? 0) + 1}/{WORM_DEMO_LESSONS.length}</span></div>
    <div className="worm-demo-track" role="progressbar" aria-label="WORM practice progress" aria-valuemin={0} aria-valuemax={WORM_DEMO_LESSONS.length} aria-valuenow={(s.demoWormLessonIndex ?? 0) + (s.complete ? 1 : 0)}>
      <div style={{ width: `${((s.demoWormLessonIndex ?? 0) + (s.complete ? 1 : 0)) / WORM_DEMO_LESSONS.length * 100}%` }} />
    </div>
    <p role="status" aria-live="polite">{s.complete ? lesson.success : dead ? advice : lesson.instruction}</p>
    {s.complete && <div className="worm-demo-detail">{lesson.preview ? 'Demonstration complete. Tap Next to practice the rescue.' : `Goal reached. Keep practicing or tap ${last ? 'Next: Flip Cube' : 'Next'}.`}</div>}
    {s.progress && !s.complete && !dead && <div className="worm-demo-detail">{s.progress}</div>}
    <div className="worm-demo-actions">
      <button ref={retryRef} disabled={!dead && !s.started && !s.prepared} className={dead || !s.started ? 'arcade-primary' : 'arcade-key'} onClick={!s.started && !dead ? s.start : onRetry ?? s.retry}>{lesson.preview ? !s.started && !dead ? 'Watch it' : 'Replay' : dead ? 'Try again' : !s.started ? 'Try it' : 'Retry'}</button>
      <button ref={nextRef} disabled={!s.complete} className={s.complete ? 'arcade-primary' : 'arcade-key'} onClick={s.next}>{last ? 'Next: Flip Cube' : 'Next'}</button>
      <button className="arcade-key" onClick={() => s.skip(index)}>Skip Exercise</button>
    </div>
  </section>;
}
