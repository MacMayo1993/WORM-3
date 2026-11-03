import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { newWormDemo, wormPracticeCount } from '../game/wormDemoState.js';
import { WORM_DEMO_LESSONS, WORM_SHOWCASE_LESSONS } from '../game/wormDemoLessons.js';
import WormDemoLessonCard from '../components/screens/WormDemoLessonCard.jsx';
let root, host;
const state = () => useGameStore.getState();
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ ...newWormDemo(), demoMode: true, demoStep: 'worm-traversal', demoWormCourse: 'showcase',
    wormAlive: true, wormPaused: false, wormPauseMenuOpen: false, wormGamePhase: 'active', demoWormPrepared: true, demoWormStarted: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<WormDemoLessonCard />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
it('starts the highlights with a combined live repair and exposes every optional scene', () => {
  expect(WORM_SHOWCASE_LESSONS[0].id).toBe('collect-heal');
  expect(WORM_SHOWCASE_LESSONS.every(Boolean)).toBe(true);
  expect(new Set(WORM_DEMO_LESSONS.map(l => l.id)).size).toBe(WORM_DEMO_LESSONS.length);
  expect(wormPracticeCount(state())).toBe(WORM_SHOWCASE_LESSONS.length);
  expect(host.querySelectorAll('option')).toHaveLength(WORM_SHOWCASE_LESSONS.length + WORM_DEMO_LESSONS.length);
});
it('pauses while choosing and stages a fresh incomplete scene, without faking completion', () => {
  const picker = host.querySelector('select');
  act(() => picker.focus()); expect(state().wormPaused).toBe(true);
  const index = WORM_DEMO_LESSONS.findIndex(l => l.id === 'fusion-slipstream');
  act(() => { picker.value = `practice:${index}`; picker.dispatchEvent(new Event('change', { bubbles: true })); });
  act(() => picker.blur());
  expect(state()).toMatchObject({ demoWormCourse: 'practice', demoWormLessonIndex: index, wormPaused: true,
    demoWormStarted: false, demoWormPrepared: false, demoWormComplete: false, demoSkipped: true });
  expect(state().demoWormCompleted).toEqual([]);
  act(() => state().nextWormDemoLesson()); expect(state().demoWormLessonIndex).toBe(index);
});
it('resumes on cancelling the native picker and rejects invalid selection or challenge changes', () => {
  const picker = host.querySelector('select');
  act(() => picker.focus()); act(() => picker.blur()); expect(state().wormPaused).toBe(false);
  act(() => state().selectWormDemoScene('practice', -1)); expect(state().demoWormCourse).toBe('showcase');
  act(() => state().selectWormDemoScene('practice', 9999)); expect(state().demoWormCourse).toBe('showcase');
  act(() => useGameStore.setState({ demoWormCourse: 'challenges' }));
  act(() => state().selectWormDemoScene('practice', 0)); expect(state().demoWormCourse).toBe('challenges');
  expect(host.querySelector('select')).toBeNull();
});
