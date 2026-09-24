import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { checkRubiksSolvedRotationInvariant } from '../game/winDetection.js';
import { parseAlgorithm } from './algorithms.js';
import { TEACH_LESSONS, FULL_SOLVE, COURSE_STORAGE_KEY, readCourseProgress, prepareLesson, courseSignature, courseHome, inspectCourseStage } from './course.js';
import './teachCourse.css';

const LESSONS = [...TEACH_LESSONS, FULL_SOLVE];
const TOKENS = ['U', "U'", 'U2', 'R', "R'", 'R2', 'F', "F'", 'F2', 'L', "L'", 'L2', 'D', "D'", 'D2', 'B', "B'", 'B2'];
const HOME = courseSignature(courseHome());

export default function TeachCourse({ onClose, onHighlight, onPuzzles }) {
  const [completed, setCompleted] = useState(readCourseProgress);
  const [index, setIndex] = useState(() => Math.max(0, LESSONS.findIndex(l => !readCourseProgress().includes(l.id))));
  const [map, setMap] = useState(true);
  const [mode, setMode] = useState('practice');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hint, setHint] = useState(false);
  const [message, setMessage] = useState('');
  const [finished, setFinished] = useState(false);
  const [compact, setCompact] = useState(false);
  const cube = useGameStore(s => s.cubies);
  const anim = useGameStore(s => s.animState);
  const lesson = LESSONS[index];
  const prepared = useMemo(() => prepareLesson(lesson), [lesson]);
  useEffect(() => {
    const previous = useGameStore.getState().settings;
    useGameStore.getState().setSettings({ ...previous, colorScheme: 'standard', biomeMode: { enabled: false, faceAssignment: null } });
    return () => {
      const current = useGameStore.getState().settings;
      useGameStore.getState().setSettings({ ...current, colorScheme: previous.colorScheme, biomeMode: previous.biomeMode });
    };
  }, []);
  const lastCube = useRef(cube);
  const expected = useRef(null);
  const assisted = useRef(false);
  const free = lesson.id === 'full-solve';

  const load = useCallback((nextIndex, nextMode = 'practice') => {
    if (useGameStore.getState().animState) return;
    const p = prepareLesson(LESSONS[nextIndex]);
    setIndex(nextIndex); setMode(nextMode); setStep(0); setPlaying(false);
    setHint(false); setFinished(false); setMessage(''); setMap(false); setCompact(false);
    expected.current = null; assisted.current = nextMode === 'watch';
    lastCube.current = p.frames[0];
    const s = useGameStore.getState();
    s.clearHistory();
    useGameStore.setState({ cubies: p.frames[0], rotationEpoch: s.rotationEpoch + 1, lastRotation: null,
      pendingMove: null, victory: null, hasShuffled: false, moves: 0, solveHighlights: [] });
  }, []);

  // Confirm the committed board, never the click or the start of an animation.
  useEffect(() => {
    if (map || anim || lastCube.current === cube) return;
    lastCube.current = cube;
    const signature = courseSignature(cube);
    let next = step;
    if (expected.current !== null) {
      if (signature === prepared.signatures[expected.current]) next = expected.current;
      expected.current = null;
    } else if (signature === prepared.signatures[step + 1]) next = step + 1;
    else if (!free) {
      setPlaying(false);
      setMessage('That changed a different layer. Restore this step to try again.');
      return;
    }
    setStep(next);
    if ((free ? checkRubiksSolvedRotationInvariant(cube, 3) : signature === HOME && next === prepared.moves.length)) {
      setFinished(true); setPlaying(false);
      setMessage(mode === 'watch' ? 'Demonstration complete. Now try the moves yourself.' : 'Solved. Compare all six faces before moving on.');
      if (mode === 'practice' && !assisted.current) {
        setCompleted(old => {
          const result = [...new Set([...old, lesson.id])];
          try { localStorage.setItem(COURSE_STORAGE_KEY, JSON.stringify(result)); } catch { /* session progress still works */ }
          return result;
        });
      }
    }
  }, [cube, anim, map, step, prepared, free, mode, lesson.id]);

  const move = prepared.moves[step];
  useEffect(() => {
    onHighlight(!map && !finished && (!free || hint) && move ? { axis: move.axis, sliceIndex: move.sliceIndex, dir: move.dir } : null);
    return () => onHighlight(null);
  }, [map, finished, free, hint, move, onHighlight]);

  const turn = useCallback((token, demonstration = false) => {
    const s = useGameStore.getState();
    if (s.animState || finished || map) return;
    if (!free && !demonstration && token !== move?.notation) {
      setMessage(`Try ${move.notation}: ${move.notation.endsWith('2') ? 'a half turn' : move.notation.endsWith("'") ? 'counterclockwise' : 'clockwise'}, looking at that face.`);
      return;
    }
    if (!free && courseSignature(s.cubies) !== prepared.signatures[step]) {
      setMessage('Restore this step before continuing.'); setPlaying(false); return;
    }
    const [rotation] = parseAlgorithm(token, 3);
    if (!rotation) return;
    expected.current = (!free || demonstration) ? step + 1 : null;
    setMessage('');
    if (demonstration) { assisted.current = true; s.markXpAssisted(); }
    useGameStore.setState({ pendingMove: rotation, animState: { ...rotation, t: 0, teachSlow: true } });
  }, [finished, map, free, move, prepared, step]);

  useEffect(() => {
    if (!playing || anim || finished || !move || map) return;
    const timer = setTimeout(() => turn(move.notation, true), 850);
    return () => clearTimeout(timer);
  }, [playing, anim, finished, move, map, turn]);

  const regrip = dir => {
    if (useGameStore.getState().animState || finished) return;
    setPlaying(false); expected.current = null;
    const rotation = { axis: 'row', sliceIndex: 1, sliceIndices: [0, 1, 2], dir, numTurns: 1 };
    useGameStore.setState({ pendingMove: rotation, animState: { ...rotation, t: 0, teachSlow: true } });
  };
  const restore = () => {
    if (anim) return;
    setPlaying(false); setMessage(''); expected.current = null;
    lastCube.current = prepared.frames[step];
    useGameStore.getState().clearHistory();
    useGameStore.getState().setRotatedCubies(prepared.frames[step]);
    if (free) assisted.current = true;
  };
  const exit = () => { setPlaying(false); useGameStore.getState().clearAnimation(); onHighlight(null); onClose(); };

  return <section className={`teach-course ${map ? 'teach-course-map' : ''} ${compact ? 'teach-course-compact' : ''}`} aria-label="Teach mode">
    <header><div><small>TEACH · 3×3</small><h1>{map ? 'Learn to solve a cube' : lesson.title}</h1></div>
      <button aria-label="Exit Teach mode" onClick={exit}>×</button></header>
    {map ? <>
      <p>Learn a complete beginner method. Watch a prepared case, practice its turns, then solve independently.</p>
      <p className="teach-progress">{completed.length} / {LESSONS.length} practiced · No timer</p>
      <div className="teach-lesson-list">{LESSONS.map((l, i) => <button key={l.id} onClick={() => load(i)} disabled={!!anim}>
        <span>{completed.includes(l.id) ? '✓' : String(i + 1).padStart(2, '0')}</span><div><small>{l.chapter}</small><strong>{l.title}</strong></div><span>→</span>
      </button>)}</div>
      <button className="teach-primary" disabled={!!anim} onClick={() => load(index)}>Continue learning</button>
      <button disabled={!!anim} onClick={() => { exit(); onPuzzles(); }}>Cube puzzle campaigns</button>
    </> : <>
      <nav><button disabled={!!anim} onClick={() => { setPlaying(false); setMap(true); }}>← Lessons</button>
        <button onClick={() => setCompact(!compact)}>{compact ? 'Show explanation' : 'Focus on cube'}</button></nav>
      <div className="teach-explanation"><small>{lesson.chapter}</small><p><strong>{lesson.goal}</strong></p><p>{lesson.notice}</p>
        <details><summary>Why this works</summary><p>{lesson.why}</p></details>
        {free && <details><summary>Seven-stage reference · {inspectCourseStage(cube)}</summary>{TEACH_LESSONS.slice(2).map(l => <div key={l.id}><h3>{l.chapter} · {l.title}</h3><code>{l.notation}</code><p>{l.notice}</p></div>)}</details>}
        <p className="teach-grip">{free ? 'Keep yellow Up and white Down. Regrip changes which side is Front so you can work on another slot.' : 'Fixed grip: yellow Up · white Down · red Front.'} Orbiting the camera changes only your view. Letters follow the cube’s fixed axes.</p>
      </div>
      <div className="teach-actions"><button disabled={!!anim} aria-pressed={mode === 'practice'} onClick={() => load(index)}>Practice</button>
        <button disabled={!!anim} aria-pressed={mode === 'watch'} onClick={() => load(index, 'watch')}>Watch</button>
        <button disabled={!!anim} onClick={() => load(index, mode)}>Restart case</button></div>
      {(!free || hint || mode === 'watch') && <div className="teach-sequence" aria-label="Algorithm">{prepared.moves.map((m, i) => <span key={i} aria-current={i === step ? 'step' : undefined} className={i < step ? 'done' : ''}>{m.notation}</span>)}</div>}
      <div role="status" className="teach-feedback">{message || (finished ? 'Complete' : free && !hint ? 'Your turn. Work through the seven stages.' : `Move ${Math.min(step + 1, prepared.moves.length)} of ${prepared.moves.length}: ${move?.notation ?? ''}`)}</div>
      {mode === 'watch' ? <div className="teach-actions"><button disabled={finished} onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play slowly'}</button><button disabled={!!anim || finished || playing} onClick={() => turn(move.notation, true)}>One move</button></div>
        : <div className="teach-turns" aria-label="Face turns">{TOKENS.map(token => <button key={token} disabled={!!anim || finished} onClick={() => turn(token)}>{token}</button>)}</div>}
      {free && mode === 'practice' && <div className="teach-actions"><button disabled={!!anim || finished} onClick={() => regrip(1)}>Regrip left</button><button disabled={!!anim || finished} onClick={() => regrip(-1)}>Regrip right</button></div>}
      <div className="teach-actions"><button disabled={!!anim || finished} onClick={restore}>Restore this step</button>
        {free && <button onClick={() => { setHint(!hint); assisted.current = true; setMessage('This is the prepared solution, not an adaptive hint. Restart the case before following it if you have taken a different path.'); }}> {hint ? 'Hide solution' : 'Show prepared solution'}</button>}</div>
      {finished && <button className="teach-primary" disabled={!!anim} onClick={() => mode === 'watch' ? load(index) : index < LESSONS.length - 1 ? load(index + 1) : setMap(true)}>{mode === 'watch' ? 'Try it yourself' : index < LESSONS.length - 1 ? 'Next lesson →' : 'Return to lessons'}</button>}
    </>}
  </section>;
}
