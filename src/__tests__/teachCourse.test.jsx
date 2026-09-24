import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import TeachCourse from '../teach/TeachCourse.jsx';
import { TEACH_LESSONS, FULL_SOLVE, prepareLesson, courseHome, courseSignature, applyCourseMove, inspectCourseStage, COURSE_STORAGE_KEY, readCourseProgress } from '../teach/course.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { useAnimation } from '../hooks/useAnimation.js';
import { parseAlgorithm } from '../teach/algorithms.js';

it('stages every algorithm as a legal unsolved case that its full sequence solves', () => {
  for (const lesson of [...TEACH_LESSONS, FULL_SOLVE]) {
    const p = prepareLesson(lesson);
    expect(p.moves.length).toBe(lesson.notation.split(' ').length);
    expect(p.signatures[0]).not.toBe(courseSignature(courseHome()));
    expect(p.signatures.at(-1)).toBe(courseSignature(courseHome()));
    expect(p.frames[0].flat(2).flatMap(c => Object.values(c.stickers)).every(s => s.flips === 0)).toBe(true);
  }
});
it('each practice case begins at its advertised solve stage', () => {
  for (const lesson of TEACH_LESSONS.slice(2)) expect(inspectCourseStage(prepareLesson(lesson).frames[0])).toBe(lesson.chapter);
});
it('full solve keeps earlier layers intact as it advances through the seven stages', () => {
  const p = prepareLesson(FULL_SOLVE);
  let offset = 0;
  for (const lesson of TEACH_LESSONS.slice(2)) {
    expect(Number(inspectCourseStage(p.frames[offset])[0])).toBeGreaterThanOrEqual(Number(lesson.chapter[0]));
    offset += parseAlgorithm(lesson.notation).length;
  }
  expect(inspectCourseStage(p.frames.at(-1))).toBe('Solved');
});
it('recovers safely from invalid saved progress', () => {
  localStorage.setItem(COURSE_STORAGE_KEY, '{bad'); expect(readCourseProgress()).toEqual([]);
  localStorage.setItem(COURSE_STORAGE_KEY, '["made-up", "cross"]'); expect(readCourseProgress()).toEqual(['cross']);
});

let host, root, animation;
const highlight = vi.fn();
function Harness() { const api = useAnimation(); React.useEffect(() => { animation = api; }); return <TeachCourse onClose={vi.fn()} onPuzzles={vi.fn()} onHighlight={highlight} />; }
beforeEach(() => {
  localStorage.removeItem(COURSE_STORAGE_KEY);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ size:3, cubies:courseHome(), animState:null, pendingMove:null, hasShuffled:false, demoMode:false, teachModeActive:true, teachCourseActive:true });
  host=document.createElement('div'); document.body.append(host); root=createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
const click = text => { const button=[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===text || b.textContent.includes(text)); expect(button).toBeTruthy(); act(()=>button.click()); };
const mount = () => act(()=>root.render(<Harness/>));
const finish = () => act(()=>animation.handleAnimComplete());
it('rejects a wrong move, waits for the committed animation, then saves practice progress', () => {
  mount(); click('Read a face turn');
  const wrong=[...host.querySelectorAll('.teach-turns button')].find(b=>b.textContent==='L'); act(()=>wrong.click());
  expect(useGameStore.getState().animState).toBeNull(); expect(host.textContent).toContain('Try R');
  const right=[...host.querySelectorAll('.teach-turns button')].find(b=>b.textContent==='R'); act(()=>right.click());
  expect(readCourseProgress()).toEqual([]); expect(host.textContent).not.toContain('Next lesson');
  finish(); expect(readCourseProgress()).toEqual(['turn']); expect(host.textContent).toContain('Next lesson');
});
it('watch playback does not claim a practiced lesson and stops after leaving the lesson', () => {
  vi.useFakeTimers(); mount(); click('Read a face turn'); click('Watch'); click('Play slowly');
  act(()=>vi.advanceTimersByTime(851)); expect(useGameStore.getState().pendingMove.notation).toBe('R');
  finish(); expect(readCourseProgress()).toEqual([]); expect(host.textContent).toContain('Try it yourself');
  click('Restart case'); click('Play slowly'); click('← Lessons');
  act(()=>vi.advanceTimersByTime(3000)); expect(useGameStore.getState().animState).toBeNull();
});
it('restart restores the prepared board and half turns commit both quarter turns', () => {
  mount(); click('Reverse and double');
  const initial=courseSignature(useGameStore.getState().cubies);
  const press=token=>act(()=>[...host.querySelectorAll('.teach-turns button')].find(b=>b.textContent===token).click());
  press("R'"); finish(); press('U2');
  expect(useGameStore.getState().pendingMove.numTurns).toBe(2); finish();
  expect(courseSignature(useGameStore.getState().cubies)).toBe(courseSignature(courseHome()));
  click('Restart case'); expect(courseSignature(useGameStore.getState().cubies)).toBe(initial);
});
it('detects a manual deviation and restores the current step without advancing', () => {
  mount(); click('Read a face turn');
  const initial=courseSignature(useGameStore.getState().cubies);
  act(()=>useGameStore.getState().setRotatedCubies(applyCourseMove(useGameStore.getState().cubies,parseAlgorithm('L')[0])));
  expect(host.textContent).toContain('different layer'); click('Restore this step');
  expect(courseSignature(useGameStore.getState().cubies)).toBe(initial); expect(readCourseProgress()).toEqual([]);
});
it('accepts an independent full solve after changing the working front face', () => {
  mount(); click('Your first full solve'); click('Regrip left'); finish();
  // Apply the authored solution in the rotated frame (conjugation by y).
  // This takes a different path from the fixed-frame hint and must still count.
  const rotate = (cube, dir) => {
    for (let sliceIndex=0; sliceIndex<3; sliceIndex++) cube=applyCourseMove(cube,{axis:'row',sliceIndex,dir});
    return cube;
  };
  for (const move of prepareLesson(FULL_SOLVE).moves) {
    act(() => {
      const cube=useGameStore.getState().cubies;
      useGameStore.getState().setRotatedCubies(rotate(applyCourseMove(rotate(cube,-1),move),1));
    });
  }
  expect(readCourseProgress()).toContain('full-solve');
});
it('does not mark an assisted full solve as independent practice', () => {
  mount(); click('Your first full solve'); click('Show prepared solution');
  act(()=>useGameStore.getState().setRotatedCubies(courseHome()));
  expect(readCourseProgress()).not.toContain('full-solve');
});
it('recognizes solved layers after a whole-cube regrip', () => {
  let cube=courseHome();
  for(let sliceIndex=0;sliceIndex<3;sliceIndex++) cube=applyCourseMove(cube,{axis:'row',sliceIndex,dir:1});
  expect(inspectCourseStage(cube)).toBe('Solved');
});
