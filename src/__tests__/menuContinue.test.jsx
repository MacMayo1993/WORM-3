import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('troika-three-text', () => ({ preloadFont: () => {} }));
vi.mock('@fontsource/bungee/files/bungee-latin-400-normal.woff', () => ({ default: '' }));

import { MenuContinueKey } from '../components/menus/MainMenu.jsx';
import { continueStoryLevel, WORM_STORY_LEVELS } from '../worm/story/levels.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress } from '../progression/model.js';

// A returning player gets one tap from the menu back into WORM Story: the next
// level they have not cleared. A new save (the intro already hands it level 1)
// and a finished story get no key.
const cleared = n => ({ ...newProgress(), wormStory: { stars: Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 1])), claimed: {} } });

describe('continueStoryLevel', () => {
  it('is the next unplayed level for a returning player, and nothing otherwise', () => {
    expect(continueStoryLevel(newProgress())).toBeNull();
    expect(continueStoryLevel(cleared(1)).id).toBe(2);
    expect(continueStoryLevel(cleared(22)).id).toBe(23);
    expect(continueStoryLevel(cleared(WORM_STORY_LEVELS.length))).toBeNull();
  });
});

describe('the menu key', () => {
  let root, host, before;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    before = useGameStore.getState();
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount()); host.remove();
    useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('names the stage, launches it, and hides for a new save', () => {
    const onContinue = vi.fn();
    act(() => useGameStore.setState({ playerProgress: cleared(12) }));
    act(() => root.render(<MenuContinueKey onContinue={onContinue} />));
    const key = host.querySelector('.menu-key--continue');
    expect(key.textContent).toContain('Continue');
    expect(key.textContent).toContain('Stage 2-3');
    act(() => key.click());
    expect(onContinue).toHaveBeenCalledWith(13);
    act(() => useGameStore.setState({ playerProgress: newProgress() }));
    expect(host.querySelector('.menu-key--continue')).toBeNull();
  });
});
