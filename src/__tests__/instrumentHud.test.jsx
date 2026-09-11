import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import BottomNavBar from '../components/menus/BottomNavBar.jsx';
import OrbInventoryHUD from '../worm/OrbInventoryHUD.jsx';
import TopMenuBar from '../components/menus/TopMenuBar.jsx';
import SecondaryModesSheet from '../components/menus/SecondaryModesSheet.jsx';
vi.mock('../hooks/useGameStore.js', () => ({ useGameStore: selector => selector({chaosStats:null}), selectEffectiveFlipCap: () => 5 }));
vi.mock('../components/overlays/ParityWallet.jsx', () => ({default: () => <span>Parity wallet</span>}));
vi.mock('../utils/audio.js', () => ({ vibrate: vi.fn() }));
vi.mock('../3d/TilePreviewRenderer.js', () => ({ renderTileImage: vi.fn(() => 'data:image/png;base64,sample') }));
let root, host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
it('keeps Undo gated by history and Flip gated by the level', () => {
  const undo = vi.fn(), flip = vi.fn(), more = vi.fn();
  const render = (props) => act(() => root.render(<BottomNavBar onUndo={undo} onToggleFlip={flip} onToggleMore={more} {...props} />));
  render({ canUndo: false, flipLocked: true });
  act(() => { host.querySelector('[aria-label="Undo"]').click(); host.querySelector('[aria-label="Flip"]').click(); });
  expect(undo).not.toHaveBeenCalled(); expect(flip).not.toHaveBeenCalled();
  render({ canUndo: true, flipLocked: false, flipMode: true });
  act(() => { host.querySelector('[aria-label="Undo"]').click(); host.querySelector('[aria-label="More"]').click(); });
  expect(undo).toHaveBeenCalledTimes(1); expect(more).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[aria-label="Flip"]').getAttribute('aria-pressed')).toBe('true');
  expect(host.querySelector('[aria-label="Reset"]')).toBeNull();
});
it('preserves the guided reset and shuffle actions when spotlighted', () => {
  for (const label of ['Reset', 'Shuffle']) {
    const action = vi.fn();
    act(() => root.render(<BottomNavBar spotlightTile={label.toLowerCase()} onReset={action} onShuffle={action} />));
    act(() => host.querySelector(`[aria-label="${label}"]`).click());
    expect(action).toHaveBeenCalledTimes(1);
  }
});
it('keeps six stable inventory slots and highlights only a pickup, not spending', () => {
  vi.useFakeTimers();
  const colors = {1:'#fff',2:'#fff',3:'#f00',4:'#0f0',5:'#00f',6:'#888'};
  const render = count => act(() => root.render(<OrbInventoryHUD orbInventory={{1:count}} faceColors={colors} tileStyles={{2:'stripes'}} />));
  render(0);
  const original = [...host.querySelectorAll('[role="listitem"]')];
  expect(original).toHaveLength(6); expect(host.querySelector('.orb-slot-pickup')).toBeNull();
  render(3);
  expect([...host.querySelectorAll('[role="listitem"]')]).toEqual(original);
  expect(host.querySelectorAll('.orb-slot-pickup')).toHaveLength(1);
  expect(original[0].getAttribute('aria-label')).toBe('Front: 3 orbs');
  expect(original[1].getAttribute('aria-label')).toBe('Left: 0 orbs');
  act(() => vi.advanceTimersByTime(400));
  render(1); expect(host.querySelector('.orb-slot-pickup')).toBeNull();
});

it('keeps settings, wallet and secondary stats in the session menu and closes on Escape', () => {
  const settings = vi.fn();
  act(() => root.render(<TopMenuBar cubies={[[[{stickers:{PZ:{curr:1}}}]]]} size={3}
    metrics={{flips:7,wormholes:2}} onShowSettings={settings} />));
  expect(host.querySelector('.top-bar-progress').textContent).toBe('100%');
  const menu = host.querySelector('details');
  expect(menu.open).toBe(false);
  act(() => menu.querySelector('summary').click());
  expect(menu.open).toBe(true);
  expect(menu.textContent).toContain('Parity wallet');
  expect(menu.textContent).toContain('Flips7');
  act(() => menu.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true})));
  expect(menu.open).toBe(false);
  act(() => { menu.querySelector('summary').click(); [...menu.querySelectorAll('button')].find(b=>b.textContent==='Settings').click(); });
  expect(settings).toHaveBeenCalledTimes(1); expect(menu.open).toBe(false);
});
it('keeps Reset and Shuffle reachable in More and suppresses Shuffle during chaos', () => {
  const reset = vi.fn(), shuffle = vi.fn();
  const render = chaosMode => act(() => root.render(<SecondaryModesSheet open mode="more" onReset={reset} onShuffle={shuffle} chaosMode={chaosMode} />));
  render(false);
  const button = label => [...host.querySelectorAll('button')].find(b=>b.textContent===label);
  act(() => { button('Reset').click(); button('Shuffle').click(); });
  expect(reset).toHaveBeenCalledTimes(1); expect(shuffle).toHaveBeenCalledTimes(1);
  render(true); expect(button('Shuffle')).toBeUndefined(); expect(button('Reset')).toBeTruthy();
});
