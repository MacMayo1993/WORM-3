import React, { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../hooks/useGameStore.js';
import { wormPracticeLessons, wormDemoLesson, WORM_DEMO_LESSONS, WORM_SHOWCASE_LESSONS } from '../../game/wormDemoLessons.js';
import { demoChapter } from '../../game/wormDemoCatalog.js';
import { arcadeModeVars } from '../../utils/arcadeTheme.js';
import '../ui/arcadeTheme.css';
import './wormDemoLesson.css';
import DemoProgressBar from './DemoProgressBar.jsx';
import WormChallengeCard from './WormChallengeCard.jsx';

export default function WormDemoLessonCard({ onRetry, onSkipStep, onExit, pauseControl, telemetry, length }) {
  const s = useGameStore(useShallow(s => ({ demoWormCourse: s.demoWormCourse, demoWormLessonIndex: s.demoWormLessonIndex, complete: s.demoWormComplete, started: s.demoWormStarted, prepared: s.demoWormPrepared, start: s.startWormDemoLesson,
    attempt: s.demoWormAttempt, helpOpen: s.demoChallengeHelpOpen, progress: s.demoWormProgress, alive: s.wormAlive, paused: s.wormPauseMenuOpen,
    details: s.wormDeathDetails, phase: s.wormGamePhase, finished: s.demoWormFinished,
    retry: s.restartWormDemoLesson, next: s.nextWormDemoLesson, skip: s.skipWormDemoLesson })));
  const lesson = wormDemoLesson(s);
  const lessons = wormPracticeLessons(s);
  const challenges = s.demoWormCourse === 'challenges';
  const retryRef = useRef(null), nextRef = useRef(null);
  const pickerWasPaused = useRef(true);
  const groups = Object.groupBy ? Object.groupBy(WORM_DEMO_LESSONS, demoChapter) : WORM_DEMO_LESSONS.reduce((out, item) => { (out[demoChapter(item)] ??= []).push(item); return out; }, {});
  useEffect(() => {
    if (s.alive === false && !s.paused) (s.complete && lesson.preview ? nextRef : retryRef).current?.focus();
  }, [s.alive, s.paused, s.complete, lesson.preview]);
  if (s.paused) return null;
  const navigation = <div className="worm-demo-navigation">
    {!challenges && <DemoProgressBar currentStep="worm-traversal" inline onSkipStep={onSkipStep} onExit={onExit} />}
    {pauseControl}
  </div>;
  // Arrival and completion still need a pause/exit door, even without a lesson.
  if (s.finished || !['active', 'finalHealing'].includes(s.phase ?? 'active')) {
    return <section className="arcade-card arcade-paper worm-demo-card" style={arcadeModeVars('worm')} aria-label="Demo controls">{navigation}</section>;
  }
  const dead = s.alive === false;
  const cause = s.details?.cause || s.details?.reason;
  // One line per way a run can end (killWormSim reasons), each naming the rule
  // that ended it and the move that avoids it.
  const advice = cause === 'challenge-timeout' ? 'Time is up. Plan a shorter route and try again.' : cause === 'lightning' ? 'Lightning struck you. Move off the marked tile, or jump.' : cause === 'bomb' ? 'A bomb blast hit you. Keep clear of the marked blast tiles.'
    : cause === 'slice-rotation' || cause === 'rotation' ? 'The turning layer caught you. Move clear of its lights.'
    : cause === 'self-collision' || cause === 'self' ? 'You ran into your own body. Steer around it, or press JUMP to hop over it.'
    : cause === 'caution-fall' ? 'The caution-tape timer ran out. Press left, right or jump during the one-second cue to escape.'
    : cause === 'pit' ? 'You fell into a pit. A tunnel collapses behind you after its third ride; turn away or jump clear at the rim.'
    : cause === 'voided' || cause === 'void-tunnel-exhausted' ? 'That tunnel collapsed. An open tunnel holds for three rides; heal it before then.'
    : 'Your run ended. Try this exercise again with a fresh practice board.';
  const index = s.demoWormLessonIndex ?? 0;
  const last = index === lessons.length - 1;
  const nextLabel = last ? challenges ? 'Finish challenges' : 'Next: Flip Cube' : 'Next';
  if (challenges) return <WormChallengeCard key={`${index}:${s.attempt}`} lesson={lesson} state={s} index={index} count={lessons.length} advice={advice} pauseControl={pauseControl} length={length} />;
  return <section className="arcade-card arcade-paper worm-demo-card" style={arcadeModeVars('worm')} aria-label={challenges ? "WORM short challenges" : "WORM practice"}>
    {navigation}
    {!challenges && <div className="worm-demo-scene-bar">
      <select aria-label="Choose demo scene" value={`${s.demoWormCourse}:${index}`}
        onFocus={() => { pickerWasPaused.current = useGameStore.getState().wormPaused; useGameStore.getState().setWormPaused(true); }}
        onBlur={() => { if (!pickerWasPaused.current) useGameStore.getState().setWormPaused(false); }}
        onChange={event => {
          const [course, scene] = event.target.value.split(':');
          pickerWasPaused.current = true;
          useGameStore.getState().selectWormDemoScene(course, Number(scene));
        }}>
        <optgroup label="Playable highlights">
          {WORM_SHOWCASE_LESSONS.map((item, i) => <option key={item.id} value={`showcase:${i}`}>{i + 1}. {item.title}</option>)}
        </optgroup>
        {Object.entries(groups).map(([chapter, items]) => <optgroup key={chapter} label={chapter}>
          {items.map(item => <option key={item.id} value={`practice:${WORM_DEMO_LESSONS.indexOf(item)}`}>{item.title}</option>)}
        </optgroup>)}
      </select>
    </div>}
    <div className="worm-demo-heading">
      {challenges ? <strong>{lesson.title}</strong> : <span className="worm-demo-live">{!s.started ? 'READY TO PLAY' : s.complete ? 'SCENE CLEAR' : dead ? 'RETRY READY' : 'LIVE GAMEPLAY'}</span>}
      {length != null && <span className="worm-demo-length" aria-label={`Worm length: ${length} tiles`}>{length} tiles</span>}
      <span>Scene {(s.demoWormLessonIndex ?? 0) + 1}/{lessons.length}</span>
    </div>
    <div className="worm-demo-track" role="progressbar" aria-label="WORM practice progress" aria-valuemin={0} aria-valuemax={lessons.length} aria-valuenow={(s.demoWormLessonIndex ?? 0) + (s.complete ? 1 : 0)}>
      <div style={{ width: `${((s.demoWormLessonIndex ?? 0) + (s.complete ? 1 : 0)) / lessons.length * 100}%` }} />
    </div>
    <p role="status" aria-live="polite">{s.complete ? lesson.success : dead ? advice : lesson.instruction}</p>
    {s.complete && <div className="worm-demo-detail">{lesson.preview ? 'Demonstration complete. Tap Next to practice the rescue.' : `Goal reached. Keep practicing or tap ${nextLabel}.`}</div>}
    {s.progress && !s.complete && !dead && <div className="worm-demo-detail">{s.progress}</div>}
    {telemetry && <div className="worm-demo-telemetry">{telemetry}</div>}
    <div className="worm-demo-actions">
      <button ref={retryRef} disabled={!dead && !s.started && !s.prepared} className={dead || !s.started ? 'arcade-primary' : 'arcade-key'} onClick={!s.started && !dead ? s.start : onRetry ?? s.retry}>{lesson.preview ? !s.started && !dead ? 'Watch it' : 'Replay' : dead ? 'Try again' : !s.started ? 'Try it' : 'Retry'}</button>
      <button ref={nextRef} disabled={!s.complete} className={s.complete ? 'arcade-primary' : 'arcade-key'} onClick={s.next}>{nextLabel}</button>
      <button className="arcade-key" onClick={() => s.skip(index)}>Skip Exercise</button>
    </div>
  </section>;
}
