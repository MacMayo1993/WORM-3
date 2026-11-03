import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import StoryObjectiveHUD from '../components/overlays/StoryObjectiveHUD.jsx';
import { SHORT_CHALLENGE_LEVELS } from '../levels/packs/short-challenges.js';

it('keeps cube challenges folded across puzzles without changing the Story guidance preference', () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem('worm3_objective_collapsed', '0');
  const host = document.createElement('div'), root = createRoot(host);
  document.body.append(host);
  try {
    act(() => root.render(<StoryObjectiveHUD level={SHORT_CHALLENGE_LEVELS[0]} />));
    expect(host.querySelector('.story-objective-content')).toBeNull();
    const toggle = host.querySelector('.story-objective-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    act(() => toggle.click());
    expect(host.textContent).toContain('Aim for 4 moves');
    expect(host.textContent).not.toContain(SHORT_CHALLENGE_LEVELS[0].tutorial.tip);
    act(() => host.querySelector('.story-objective-hint-button').click());
    expect(host.textContent).toContain(SHORT_CHALLENGE_LEVELS[0].tutorial.tip);
    act(() => root.render(<StoryObjectiveHUD level={SHORT_CHALLENGE_LEVELS[1]} />));
    expect(host.querySelector('.story-objective-content')).toBeNull();
    expect(localStorage.getItem('worm3_objective_collapsed')).toBe('0');
    act(() => root.render(<StoryObjectiveHUD level={{ id: 1, name: 'Story', tutorial: { objective: 'Story goal' } }} />));
    expect(host.querySelector('.story-objective-content')).not.toBeNull();
    expect(localStorage.getItem('worm3_objective_collapsed')).toBe('0');
  } finally {
    act(() => root.unmount()); host.remove();
    localStorage.removeItem('worm3_objective_collapsed');
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
