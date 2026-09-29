import React, { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { Color } from 'three';
import { ScenePanel } from '../components/menus/settings/ScenePanel.jsx';
import SceneStep from '../components/screens/wizardSteps/SceneStep.jsx';
import ProjectiscopeCreator from '../projectiscope/ProjectiscopeCreator.jsx';
import { createProjectiscopeBackground } from '../projectiscope/backgroundRenderer.js';
import { validProjectiscopeDesign, projectiscopeConfig } from '../projectiscope/design.js';
import { useGameStore } from '../hooks/useGameStore.js';

vi.mock('../components/screens/wizardSteps/CubePlate.jsx', () => ({ default: ({ onNext, onPrev }) => <><button onClick={onNext}>Next scene</button><button onClick={onPrev}>Previous scene</button></> }));

const design = { version: 1, recipe: btoa(JSON.stringify({ v: 1, grp: 'I', seed: 87 })), thumbnail: 'data:image/jpeg;base64,YQ==' };
let root, host, before;
const frame = () => document.querySelector('iframe');
const button = text => [...document.querySelectorAll('button')].find(b => b.textContent === text);
const message = (type, extra = {}, origin = location.origin, source = frame().contentWindow) => act(() => {
  window.dispatchEvent(new MessageEvent('message', { origin, source, data: { type: `projectiscope:${type}`, ...extra } }));
});
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  before = useGameStore.getState();
  useGameStore.setState({ wormHealerMode: false, projectiscopeEditing: false });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  useGameStore.setState(before, true);
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
it('requires a bounded valid recipe and JPEG preview', () => {
  expect(validProjectiscopeDesign(design)).toBe(true);
  for (const patch of [{ version: 2 }, { recipe: 'bad' }, { recipe: 'a'.repeat(180001) }, { thumbnail: 'https://example.com/a.jpg' }]) {
    expect(validProjectiscopeDesign({ ...design, ...patch })).toBe(false);
  }
  expect(projectiscopeConfig(design)).toMatchObject({ recipe: design.recipe });
  expect(projectiscopeConfig(design)).not.toHaveProperty('palette');
});
it('reopens even the selected background, applies only on request, and preserves Cancel', async () => {
  let settings;
  function Harness() {
    const [value, setValue] = useState({ backgroundTheme: 'forest', projectiscopeDesign: design });
    useEffect(() => { settings = value; }, [value]);
    return <ScenePanel settings={value} onSettingsChange={setValue} />;
  }
  await act(async () => root.render(<Harness />));
  const open = async () => act(async () => button('Projectiscope · Create your own').click());
  await open();
  expect(settings.backgroundTheme).toBe('forest');
  const post = vi.spyOn(frame().contentWindow, 'postMessage');
  message('ready'); expect(post).toHaveBeenLastCalledWith(projectiscopeConfig(design), location.origin);
  message('configured', {}, 'https://wrong.example'); expect(button('Apply background').disabled).toBe(true);
  message('configured'); expect(button('Apply background').disabled).toBe(false);
  message('background', { design }); expect(settings.backgroundTheme).toBe('forest');
  act(() => button('Apply background').click());
  message('background', { design }, location.origin, window); expect(settings.backgroundTheme).toBe('forest');
  message('background', { design });
  expect(settings).toEqual({ backgroundTheme: 'projectiscope', projectiscopeDesign: design });
  expect(frame()).toBeNull();
  await open(); expect(frame()).not.toBeNull();
  act(() => button('Cancel').click());
  expect(frame()).toBeNull(); expect(settings.projectiscopeDesign).toBe(design);
});
it.each([false, true])('restores the existing worm pause state (%s)', paused => {
  useGameStore.setState({ wormHealerMode: true, wormAlive: true, wormPaused: paused });
  act(() => root.render(<ProjectiscopeCreator design={design} onApply={vi.fn()} onCancel={vi.fn()} />));
  expect(useGameStore.getState()).toMatchObject({ projectiscopeEditing: true, wormPaused: true });
  act(() => root.render(null));
  expect(useGameStore.getState()).toMatchObject({ projectiscopeEditing: false, wormPaused: paused });
});
it('does not unpause a new run when the creator closes', () => {
  useGameStore.setState({ wormHealerMode: true, wormAlive: true, wormPaused: false, wormRunId: 1 });
  act(() => root.render(<ProjectiscopeCreator onApply={vi.fn()} onCancel={vi.fn()} />));
  useGameStore.setState({ wormRunId: 2 });
  act(() => root.render(null));
  expect(useGameStore.getState().wormPaused).toBe(true);
});
it('feeds the scene through one throttled texture and releases it on exit', () => {
  const previous = new Color('black'), scene = { background: previous };
  const renderer = createProjectiscopeBackground(scene, design);
  const iframe = frame();
  expect(new URL(iframe.src).search).toBe('');
  expect(new URL(iframe.src).hash).toBe('#background=1');
  iframe.contentDocument.write('<html><body></body></html>');
  const canvas = iframe.contentDocument.createElement('canvas'); canvas.id = 'paint';
  iframe.contentDocument.body.append(canvas);
  const api = { setPaused: vi.fn(), stepBackground: vi.fn(() => { canvas.dataset.frame = String(Number(canvas.dataset.frame || 0) + 1); }) };
  iframe.contentWindow.__projectiscope = api;
  message('configured', {}, 'https://wrong.example'); expect(scene.background).toBe(previous);
  message('configured'); expect(scene.background.isCanvasTexture).toBe(true);
  const texture = scene.background, dispose = vi.spyOn(texture, 'dispose');
  renderer.update(1000, false); renderer.update(1060, false); renderer.update(1125, true);
  expect(api.stepBackground).toHaveBeenCalledTimes(2);
  expect(api.setPaused.mock.calls).toEqual([[false], [true]]);
  renderer.dispose();
  expect(dispose).toHaveBeenCalledOnce(); expect(scene.background).toBe(previous); expect(frame()).toBeNull();
  renderer.update(1500, false); expect(api.stepBackground).toHaveBeenCalledTimes(2);
});

it('opens the creator from wizard arrows and cards before committing the scene', async () => {
  let settings;
  function Harness() {
    const [value, setValue] = useState({ backgroundTheme: 'nebula', projectiscopeDesign: design });
    useEffect(() => { settings = value; }, [value]);
    return <SceneStep cos={{ settings: value, setSettings: setValue, cubeSize: 3, colors: { 1: '#ffffff' },
      select: (key, val) => setValue(s => ({ ...s, [key]: val })), accent: '#ffffff' }} />;
  }
  await act(async () => root.render(<Harness />));
  await act(async () => button('Next scene').click());
  expect(settings.backgroundTheme).toBe('nebula'); expect(frame()).not.toBeNull();
  act(() => button('Cancel').click());
  expect(settings.backgroundTheme).toBe('nebula');
  await act(async () => button('Projectiscope · Create your own').click());
  message('configured'); act(() => button('Apply background').click());
  message('background', { design });
  expect(settings).toMatchObject({ backgroundTheme: 'projectiscope', projectiscopeDesign: design });
  await act(async () => button('Projectiscope · Create your own').click());
  expect(frame()).not.toBeNull();
});
