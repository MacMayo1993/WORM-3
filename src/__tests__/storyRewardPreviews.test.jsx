import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { StoryRewardChoices } from '../worm/story/StoryCards.jsx';
import StoryRewardPreview from '../worm/story/StoryRewardPreview.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress } from '../progression/model.js';
import { storyLevel, WORM_STORY_LEVELS } from '../worm/story/levels.js';
import { getStoreItem } from '../utils/storeCatalog.js';
import { COLOR_SCHEMES } from '../utils/colorSchemes.js';
const drawn = vi.hoisted(() => ({ worm: vi.fn(), cube: vi.fn() }));
vi.mock('../3d/WormPreviewCanvas.jsx', () => ({ default: props => { drawn.worm(props); return <canvas data-worm-preview />; } }));
vi.mock('../3d/CubePreviewCanvas.jsx', () => ({ default: props => { drawn.cube(props); return <canvas data-cube-preview />; } }));
let host, root, before;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; before = useGameStore.getState(); vi.clearAllMocks();
  useGameStore.setState({ playerProgress: { ...newProgress(), wormStory: { stars: {3: 3}, claimed: {} } }, ownedItems: [], wormCharacter: 'classic', wormSkin: 'slime', wormHat: 'crown' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); useGameStore.setState(before, true); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
const render = node => act(async () => { root.render(node); });
it('shows both hat previews before claiming, then preserves the exact chosen item', async () => {
  await render(<StoryRewardChoices level={storyLevel(3)} />);
  expect(host.querySelectorAll('[data-worm-preview]')).toHaveLength(2);
  expect(drawn.worm.mock.calls.map(([p]) => p.hatId)).toEqual(expect.arrayContaining(['party', 'tophat']));
  expect(useGameStore.getState().ownedItems).toEqual([]);
  const chosen = host.querySelectorAll('button')[1];
  await act(async () => { chosen.click(); chosen.click(); });
  expect(useGameStore.getState().ownedItems).toEqual(['hat_tophat']);
  expect(host.querySelector('[role="status"]').textContent).toContain('Top Hat unlocked');
  expect(host.querySelectorAll('[data-worm-preview]')).toHaveLength(1);
  expect(drawn.worm.mock.lastCall[0].hatId).toBe('tophat');
});
it('shows owned choices without allowing them to be claimed again', async () => {
  useGameStore.setState({ ownedItems: ['hat_party'] });
  await render(<StoryRewardChoices level={storyLevel(3)} />);
  expect(host.querySelectorAll('button')[0].disabled).toBe(true);
  expect(host.querySelectorAll('button')[1].disabled).toBe(false);
  expect(host.querySelectorAll('[role="img"]')).toHaveLength(2);
});
it('retains the points fallback when both items are already owned', async () => {
  useGameStore.setState({ ownedItems: ['hat_party', 'hat_tophat'], parityPoints: 0 });
  await render(<StoryRewardChoices level={storyLevel(3)} />);
  expect(host.querySelector('[role="img"]')).toBeNull();
  await act(async () => host.querySelector('button').click());
  expect(useGameStore.getState().parityPoints).toBe(100);
  expect(host.textContent).toContain('100 points received');
});
it('does not grant rewards from an uncompleted level', async () => {
  await render(<StoryRewardChoices level={storyLevel(6)} />);
  expect([...host.querySelectorAll('button')].every(b => b.disabled)).toBe(true);
});
it('defers rendering during the star award, then loads the previews when ready', async () => {
  await render(<StoryRewardChoices level={storyLevel(3)} previewsReady={false} />);
  expect(drawn.worm).not.toHaveBeenCalled();
  await render(<StoryRewardChoices level={storyLevel(3)} previewsReady />);
  expect(host.querySelectorAll('[data-worm-preview]')).toHaveLength(2);
});
it.each([...new Set(WORM_STORY_LEVELS.flatMap(l => l.reward || []))])('previews the actual catalog asset for %s without changing equipment', async id => {
  const item = getStoreItem(id);
  await render(<StoryRewardPreview item={item} />);
  if (item.type === 'scheme' || item.type === 'tile') {
    expect(drawn.cube.mock.lastCall[0]).toMatchObject({ animated: false, interactive: false, colors: COLOR_SCHEMES[item.schemeKey] ?? COLOR_SCHEMES.standard, tileStyle: item.tileKey ?? 'solid' });
    if (item.type === 'scheme') expect(host.querySelectorAll('.palette-swatches > span')).toHaveLength(6);
  } else {
    const props = drawn.worm.mock.lastCall[0];
    expect(props.animated).toBe(false);
    if (item.type === 'skin') expect(props.skinId).toBe(item.skinId);
    if (item.type === 'hat') expect(props).toMatchObject({ hatId: item.hatId, framing: 'portrait' });
    if (item.type === 'accessory') expect(props.accessories[item.slot]).toBe(item.accessoryId);
  }
  expect(useGameStore.getState().wormHat).toBe('crown');
  expect(useGameStore.getState().wormSkin).toBe('slime');
  expect(useGameStore.getState().ownedItems).toEqual([]);
});
