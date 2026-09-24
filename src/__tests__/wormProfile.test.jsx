import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress } from '../progression/model.js';
import WormEntryScreen from '../components/screens/WormEntryScreen.jsx';
import WormProfile from '../components/screens/WormProfile.jsx';
import { feel } from '../utils/feel.js';

vi.mock('../utils/feel.js', () => ({ feel: vi.fn(), resumeFeel: vi.fn() }));
vi.mock('../hooks/index.js', () => ({ useIsMobile: () => true }));
vi.mock('../3d/WormPreviewCanvas.jsx', () => ({ default: ({ characterId, skinId, hatId }) =>
  <span data-preview={`${characterId}/${skinId}/${hatId}`} /> }));
vi.mock('../components/screens/wizardSteps/CubePlate.jsx', () => ({ default: () => null }));
vi.mock('../components/screens/WizardChrome.jsx', async importOriginal => ({
  ...await importOriginal(),
  WizardShell: ({ categories, active, onSelect, onPrimary, onBack }) => <>
    <button onClick={onBack}>Back</button>
    <nav>{categories.map((category, i) => <button key={category.key} onClick={() => onSelect(i)}>{category.label}</button>)}</nav>
    {categories[active].content}<button onClick={onPrimary}>Start Playing</button>
  </>
}));

let host, root;
const state = () => useGameStore.getState();
const button = name => [...host.querySelectorAll('button')].find(item =>
  item.getAttribute('aria-label') === name || item.textContent.trim() === name || item.querySelector('.worm-path-cta')?.textContent.trim() === name);
const click = name => act(() => button(name).click());
const preview = () => host.querySelector('.worm-profile-preview [data-preview]').dataset.preview;
const profileKeys = ['worm3_character', 'worm3_skin', 'worm3_hat'];

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  profileKeys.forEach(key => localStorage.removeItem(key));
  useGameStore.setState({ playerProgress: newProgress(), wormCharacter: 'classic', wormSkin: 'slime', wormHat: 'none',
    ownedItems: ['character_classic', 'character_book', 'skin_slime', 'skin_royal', 'hat_none', 'hat_crown'], demoMode: false });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); state().clearDisparityGame();
  profileKeys.forEach(key => localStorage.removeItem(key));
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it('saves equipment immediately, updates the preview, and preserves it when the profile remounts', () => {
  act(() => root.render(<WormProfile />));
  expect(host.querySelector('.worm-profile-options')).toBeNull();
  click('Customize ✎'); click('Book Worm'); click('Color'); click('Royal'); click('Hats'); click('Crown');
  expect(preview()).toBe('book/royal/crown');
  expect(profileKeys.map(key => localStorage.getItem(key))).toEqual(['book', 'royal', 'crown']);
  act(() => host.querySelector('.worm-profile-footer button').click()); expect(host.querySelector('.worm-profile-options')).toBeNull();
  act(() => root.render(null));
  act(() => root.render(<WormProfile />));
  expect(preview()).toBe('book/royal/crown');
  expect(host.querySelector('.worm-profile-identity').textContent).toContain('Book WormRoyal · Crown');
});

it('keeps locked items visible without equipping them or playing a confirmation cue', () => {
  act(() => root.render(<WormProfile defaultExpanded />));
  for (const [category, locked] of [['Worm', 'MOBI'], ['Color', 'Lava'], ['Hats', 'Wizard']]) {
    click(category); vi.clearAllMocks();
    expect(button(`${locked}, locked`).disabled).toBe(true);
    click(`${locked}, locked`);
    expect(feel).not.toHaveBeenCalled();
    expect(preview()).toBe('classic/slime/none');
  }
});

it.each(['Levels →', 'Free Play →'])('launches %s with the shared profile instead of stale setup equipment', async path => {
  const complete = vi.fn(settings => state().initWormMode(9999, 0, settings.wormSpeed, settings.wormOrbCount,
    settings.wormholeInterval, settings.wormColor, false, settings.wormEnemiesEnabled, settings.storyLevel ?? null));
  act(() => root.render(<WormEntryScreen onComplete={complete} onCancel={vi.fn()}
    initialSettings={{ wormColor: '#123456', wormCharacter: 'classic', wormSkin: 'slime' }} />));
  const split = host.querySelector('.worm-path-split');
  expect(split.nextElementSibling.classList.contains('worm-profile')).toBe(true);
  click('Customize ✎'); click('Book Worm'); click('Color'); click('Royal'); click('Hats'); click('Crown');
  await act(async () => { button(path).click(); await import('../components/screens/WormModeSetupWizard.jsx'); });
  expect(preview()).toBe('book/royal/crown');
  if (path.startsWith('Levels')) click('Play level →');
  else {
    // Editing within Free Play must also update the shared profile.
    click('Classic');
    click('Gameplay'); click('Start Playing');
  }
  expect(complete).toHaveBeenCalledWith(expect.objectContaining({ wormColor: '#a855f7' }));
  expect(state().wormCharacter).toBe(path.startsWith('Levels') ? 'book' : 'classic');
  if (path.startsWith('FREE')) expect(state().xpRun.character).toBe('classic');
  expect(state().wormSkin).toBe('royal'); expect(state().wormHat).toBe('crown');
  expect(state().wormColor).toBe('#a855f7');
});

it('emits one tactile cue per activation and wraps focus around the expanded selector', () => {
  act(() => root.render(<WormEntryScreen onComplete={vi.fn()} onCancel={vi.fn()} />));
  click('Customize ✎');
  expect(feel).toHaveBeenCalledExactlyOnceWith('uiKey');
  vi.clearAllMocks(); click('Book Worm');
  expect(feel).toHaveBeenCalledExactlyOnceWith('uiKey');
  const buttons = [...host.querySelectorAll('button:not(:disabled)')];
  buttons.at(-1).focus();
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })));
  expect(document.activeElement).toBe(buttons[0]);
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })));
  expect(document.activeElement).toBe(buttons.at(-1));
});


it('mixes a hat with body and tail pieces, then removes only the selected slot', () => {
  act(() => useGameStore.setState({wormAccessories:{face:'none',neck:'none',body:'none',tail:'none'},
    wormHat:'acorn',demoMode:false,ownedItems:['hat_acorn','accessory_seedSatchel','accessory_ribbonTail']}));
  act(() => root.render(<WormProfile defaultExpanded />));
  act(() => button('Body').click());
  act(() => host.querySelector('button[aria-label="Seed Satchel"]').click());
  act(() => button('Tail').click());
  act(() => host.querySelector('button[aria-label="Ribbon Tail"]').click());
  expect(state().wormAccessories).toMatchObject({body:'seedSatchel',tail:'ribbonTail'});
  expect(host.querySelector('button[aria-label="Paintbrush Tail, locked"]').disabled).toBe(true);
  act(() => host.querySelector('button[aria-label="None"]').click());
  expect(state().wormAccessories).toMatchObject({body:'seedSatchel',tail:'none'});
  expect(state().wormHat).toBe('acorn');
});

it('uses a vertical tab rail with one tab stop and arrow-key navigation', () => {
  act(() => root.render(<WormProfile defaultExpanded />));
  const rail = host.querySelector('[role="tablist"]');
  const tabs = [...rail.querySelectorAll('[role="tab"]')];
  const panel = () => host.querySelector('[role="tabpanel"]');
  expect(rail.getAttribute('aria-orientation')).toBe('vertical');
  expect(tabs.filter(tab => tab.tabIndex === 0)).toHaveLength(1);
  tabs[0].focus();
  const key = value => act(() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })));
  vi.clearAllMocks(); key('ArrowDown');
  expect(document.activeElement).toBe(tabs[1]);
  expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  expect(panel().getAttribute('aria-labelledby')).toBe(tabs[1].id);
  expect(tabs[1].getAttribute('aria-controls')).toBe(panel().id);
  expect(host.querySelector('[aria-label="Color options"]')).not.toBeNull();
  expect(feel).toHaveBeenCalledExactlyOnceWith('uiKey');
  key('End'); expect(document.activeElement).toBe(tabs.at(-1));
  key('ArrowDown'); expect(document.activeElement).toBe(tabs[0]);
  key('ArrowUp'); expect(document.activeElement).toBe(tabs.at(-1));
  key('Home'); expect(document.activeElement).toBe(tabs[0]);
  expect(tabs.filter(tab => tab.tabIndex === 0)).toHaveLength(1);
});

it('shows equipment in the category rail and returns focus when finishing customization', () => {
  act(() => root.render(<WormProfile defaultExpanded />));
  click('Color'); click('Royal');
  expect(host.querySelector('[role="tab"][aria-label="Color"]').textContent).toContain('Royal');
  act(() => host.querySelector('.worm-profile-footer button').click());
  expect(host.querySelector('[role="tablist"]')).toBeNull();
  expect(document.activeElement).toBe(button('Customize ✎'));
  expect(preview()).toBe('classic/royal/none');
});
