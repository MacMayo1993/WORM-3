import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import ChestRoom from '../economy/ChestRoom.jsx';
import ParityStoreScreen from '../components/screens/ParityStoreScreen.jsx';
vi.mock('../3d/WormPreviewCanvas.jsx', () => ({ default: () => <div aria-label="Worm preview" /> }));
vi.mock('../3d/TilePreviewRenderer.js', () => ({ registerTilePreview: vi.fn(() => 1), updateTilePreview: vi.fn(), unregisterTilePreview: vi.fn() }));
vi.mock('../3d/CubePreviewCanvas.jsx', () => ({ default: () => <div aria-label="Cube preview" /> }));
import { STORE_ITEMS } from '../utils/storeCatalog.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress, readPlayerSave } from '../progression/model.js';
import { newChestWallet, CHEST_TIERS, CHEST_MODES } from '../economy/chests.js';
let root, host, close, back;
const state = () => useGameStore.getState();
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.includes(text));
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.useFakeTimers();
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(a => { a[0] = 0; return a; });
  useGameStore.setState({ playerProgress: newProgress(), chestWallet: newChestWallet(), chestRolling: false, ownedItems: ['character_classic'], parityPoints: 100, demoMode: false });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); close = vi.fn(); back = vi.fn();
  act(() => root.render(<ChestRoom onClose={close} onBack={back} />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
it('shows prices and exact final odds and resolves one paid roll before revealing it', () => {
  expect(host.textContent).toContain('1.69%'); expect(host.textContent).toContain('15 gems');
  act(() => button('Roll one cubie').click());
  expect(state().chestWallet.gems).toBe(10); expect(state().parityPoints).toBe(125);
  expect(host.querySelector('[role="status"]').textContent).toContain('Rolling');
  expect(button('Rolling').disabled).toBe(true);
  act(() => vi.advanceTimersByTime(2400));
  expect(host.querySelector('[role="status"]').textContent).toContain('25 Parity Points + 25 XP');
  expect(state().chestRolling).toBe(false);
});
it('displays two cubies and the matching-pair upgrade without charging twice on repeated taps', () => {
  act(() => button('Two cubies').click());
  expect(host.querySelectorAll('.chest-die')).toHaveLength(2);
  act(() => { button('Roll two cubies').click(); button('Roll two cubies')?.click(); });
  expect(state().chestWallet.rolls).toBe(1); expect(state().chestWallet.gems).toBe(5);
  act(() => vi.advanceTimersByTime(2400));
  expect(host.querySelector('[role="status"]').textContent).toContain('A match — one tier higher.');
  expect(state().ownedItems.length).toBe(1);
  expect(host.querySelectorAll('.chest-choice-card')).toHaveLength(3);
  const itemId = state().chestWallet.history.at(-1).reward.itemIds[1];
  act(() => host.querySelectorAll('.chest-choice-card')[1].click());
  expect(state().ownedItems).toContain(itemId);
  expect(host.querySelector('.chest-choices')).toBeNull();
  expect(state().chestWallet.gems).toBe(5);
});
it('retains a paid result and releases the animation lock when leaving early', () => {
  act(() => button('Roll one cubie').click());
  const saved = readPlayerSave(); act(() => root.render(null));
  expect(state().chestRolling).toBe(false);
  expect(readPlayerSave().chestWallet).toEqual(saved.chestWallet);
  act(() => root.render(<ChestRoom onClose={close} onBack={back} />));
  expect(host.querySelector('[role="status"]').textContent).toContain('25 Parity Points');
  act(() => host.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(close).toHaveBeenCalledOnce();
});

it('opens chests from the actual store and returns to equip a newly owned worm', () => {
  act(() => root.render(<ParityStoreScreen onClose={close} />));
  act(() => button('Cubie chests').click()); expect(host.querySelector('#chest-title').textContent).toBe('Cubie chests');
  act(() => button('Store').click());
  act(() => useGameStore.setState({ ownedItems: [...state().ownedItems, 'character_mobi'] }));
  act(() => button('Worms').click());
  act(() => button('MOBI').click()); act(() => button('Equip').click());
  expect(state().wormCharacter).toBe('mobi');
});

it('switches catalogue categories, filters ownership, and previews without spending', () => {
  act(() => root.render(<ParityStoreScreen onClose={close} />));
  const categories = host.querySelector('nav[aria-label="Store categories"]');
  expect([...categories.querySelectorAll('.catalogue-category')].map(b => b.querySelector('strong').textContent))
    .toEqual(['Worms', 'Trails', 'Skins', 'Hats', 'Palettes', 'Tiles']);
  act(() => button('MOBI').click());
  expect(host.querySelector('.catalogue-preview h3').textContent).toBe('MOBI');
  act(() => button('MOBI').click());
  expect(state().parityPoints).toBe(100);
  act(() => button('Owned only').click());
  expect(host.querySelectorAll('.store-card')).toHaveLength(1);
  act(() => button('Hats').click());
  expect(host.textContent).toContain('Nothing collected here yet');
  act(() => button('Browse all items').click());
  expect(host.querySelectorAll('.store-card').length).toBeGreaterThan(1);
  act(() => host.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(close).toHaveBeenCalledOnce();
});

it('uses the selected roll mode for the dice preview after a previous roll', () => {
  act(() => button('Roll one cubie').click());
  act(() => vi.advanceTimersByTime(2400));
  act(() => button('Two cubies').click());
  expect(host.querySelectorAll('.chest-die')).toHaveLength(2);
  expect(state().chestWallet.rolls).toBe(1);
  expect(host.querySelector('[role="status"]').textContent).toContain('25 Parity Points');
  const tiers = [...host.querySelectorAll('.chest-tiers>button strong')].map(n => n.textContent);
  expect(tiers).toEqual(['Mythic', 'Legendary', 'Very rare', 'Rare', 'Uncommon', 'Common']);
  act(() => button('Common').click());
  expect(host.querySelector('.chest-pool').textContent).toContain('25 PP and 25 XP');
});

it('reveals immediately with reduced motion while keeping the paid result', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  try {
    act(() => button('Roll one cubie').click());
    act(() => vi.advanceTimersByTime(0));
    expect(state().chestRolling).toBe(false);
    expect(state().chestWallet.gems).toBe(10);
    expect(host.querySelector('[role="status"]').textContent).toContain('25 Parity Points');
  } finally { vi.unstubAllGlobals(); }
});

it('renders only the selected tile family and switches its preview', () => {
  act(() => root.render(<ParityStoreScreen onClose={close} />));
  act(() => button('Tiles').click());
  expect(host.querySelectorAll('nav[aria-label="Tile families"] button')).toHaveLength(7);
  const initial = host.querySelectorAll('.store-card').length;
  act(() => button('Surreal').click());
  expect(host.querySelectorAll('.store-card')).toHaveLength(6);
  expect(initial).toBeGreaterThan(6);
  expect(host.querySelector('.catalogue-grid-heading').textContent).toContain('Surreal');
  const first = host.querySelector('.catalogue-preview h3').textContent;
  act(() => host.querySelector('[aria-label="Next item"]').click());
  expect(host.querySelector('.catalogue-preview h3').textContent).not.toBe(first);
});

it('restores a paid cosmetic choice after leaving mid-roll, without another charge', () => {
  act(() => button('Two cubies').click());
  act(() => button('Roll two cubies').click());
  expect(host.querySelector('.chest-choices')).toBeNull();
  const offered = state().chestWallet.history.at(-1).reward.itemIds;
  act(() => root.render(null));
  const saved = readPlayerSave();
  act(() => useGameStore.setState({ chestWallet: saved.chestWallet, ownedItems: saved.ownedItems, chestRolling: false }));
  act(() => root.render(<ChestRoom onClose={close} onBack={back} />));
  expect(host.querySelectorAll('.chest-die')).toHaveLength(2);
  expect(host.querySelectorAll('.chest-choice-card')).toHaveLength(3);
  expect(button('Pick a reward').disabled).toBe(true);
  expect(state().chestWallet.history.at(-1).reward.itemIds).toEqual(offered);
  const cards = [...host.querySelectorAll('.chest-choice-card')];
  act(() => { cards[0].click(); cards[1].click(); });
  expect(state().ownedItems).toContain(offered[0]);
  expect(state().ownedItems).not.toContain(offered[1]);
  expect(state().chestWallet.gems).toBe(5);
});

it.each([1, 2, 3, 4, 5])('shows three choices after tier %i lands even when everything is owned', tier => {
  const face = CHEST_MODES.single.weights.slice(0, tier).reduce((a,b) => a+b,0) / 10000 + .00001;
  crypto.getRandomValues.mockImplementation(a => { a[0] = Math.floor(face * 4294967296); return a; });
  const allOwned = STORE_ITEMS.map(i => i.id);
  act(() => useGameStore.setState({ ownedItems: allOwned }));
  act(() => button('Roll one cubie').click());
  expect(host.querySelector('.chest-choices')).toBeNull();
  act(() => vi.advanceTimersByTime(2400));
  const cards = [...host.querySelectorAll('.chest-choice-card')];
  expect(cards).toHaveLength(3);
  cards.forEach(card => expect(card.textContent).toContain(`Already owned · ${CHEST_TIERS[tier].compensation} gems`));
  expect(document.activeElement.id).toBe('chest-choice-title');
  expect(state().chestWallet.gems).toBe(10);
  act(() => cards[1].click());
  expect(host.querySelector('.chest-choices')).toBeNull();
  expect(state().chestWallet.gems).toBe(10 + CHEST_TIERS[tier].compensation);
  expect(state().ownedItems).toEqual(allOwned);
});
