import React, { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../hooks/useGameStore.js';
import { WORM_DEMO_LESSONS, wormDemoLesson } from '../../game/wormDemoLessons.js';
import { arcadeModeVars } from '../../utils/arcadeTheme.js';
import '../ui/arcadeTheme.css';
import './wormDemoLesson.css';

export default function WormDemoLessonCard({ onRetry, onSkip }) {
  const s = useGameStore(useShallow(s => ({ demoWormLessonIndex: s.demoWormLessonIndex, complete: s.demoWormComplete, started: s.demoWormStarted, prepared: s.demoWormPrepared, start: s.startWormDemoLesson,
    progress: s.demoWormProgress, alive: s.wormAlive, paused: s.wormPauseMenuOpen,
    details: s.wormDeathDetails, phase: s.wormGamePhase, finished: s.demoWormFinished,
    retry: s.restartWormDemoLesson, next: s.nextWormDemoLesson, finish: s.finishWormDemo })));
  const lesson = wormDemoLesson(s);
  const retryRef = useRef(null);
  useEffect(() => { if (s.alive === false && !s.paused) retryRef.current?.focus(); }, [s.alive, s.paused]);
  if (s.paused || s.finished || !['active', 'finalHealing'].includes(s.phase ?? 'active')) return null;
  const dead = s.alive === false;
  const cause = s.details?.cause || s.details?.reason;
  const advice = cause === 'bomb' ? 'A bomb blast hit you. Keep clear of the marked blast tiles.'
    : cause === 'slice-rotation' || cause === 'rotation' ? 'The turning layer caught you. Move clear of its lights.'
    : 'Your run ended. Try this exercise again with a fresh practice board.';
  return <section className="arcade-card arcade-paper worm-demo-card" style={arcadeModeVars('worm')} aria-label="WORM practice">
    <div className="worm-demo-heading"><strong>{lesson.title}</strong><span>{(s.demoWormLessonIndex ?? 0) + 1}/{WORM_DEMO_LESSONS.length}</span></div>
    <div className="worm-demo-track" role="progressbar" aria-label="WORM practice progress" aria-valuemin={0} aria-valuemax={WORM_DEMO_LESSONS.length} aria-valuenow={(s.demoWormLessonIndex ?? 0) + (s.complete ? 1 : 0)}>
      <div style={{ width: `${((s.demoWormLessonIndex ?? 0) + (s.complete ? 1 : 0)) / WORM_DEMO_LESSONS.length * 100}%` }} />
    </div>
    <p role="status" aria-live="polite">{dead ? advice : s.complete ? lesson.success : lesson.instruction}</p>
    {s.complete && !dead && <div className="worm-demo-detail">Goal reached. Keep practicing, or choose {s.demoWormLessonIndex === WORM_DEMO_LESSONS.length - 1 ? 'Finish' : 'Next'} when you’re ready.</div>}
    {s.progress && !s.complete && !dead && <div className="worm-demo-detail">{s.progress}</div>}
    <div className="worm-demo-actions">
      <button ref={retryRef} disabled={!dead && !s.started && !s.prepared} className={dead || !s.started ? 'arcade-primary' : 'arcade-key'} onClick={!s.started && !dead ? s.start : onRetry ?? s.retry}>{dead ? 'Try again' : !s.started ? 'Try it' : 'Retry'}</button>
      <button className={s.complete && !dead ? 'arcade-primary' : 'arcade-key'} onClick={s.next}>{s.complete ? (s.demoWormLessonIndex === WORM_DEMO_LESSONS.length - 1 ? 'Finish' : 'Next') : 'Skip exercise'}</button>
      <button className="arcade-key" onClick={onSkip ?? s.finish}>End practice</button>
    </div>
  </section>;
}
