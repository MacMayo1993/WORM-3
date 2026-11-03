import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import WormWordmark from '../components/branding/WormWordmark.jsx';
import { RUBIKS_CLASSIC } from '../utils/constants.js';

describe('shared WORM cubed mark', () => {
  it.each([{}, { inline: true }, { menu: true }, { animated: true }])('keeps one accessible name and a legible single exponent (%j)', props => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<WormWordmark {...props} />);
    expect(host.querySelectorAll('[role="img"][aria-label="WORM cubed"]')).toHaveLength(1);
    expect(host.querySelector('.worm-wordmark-letters').textContent).toBe('WORM');
    const cube = host.querySelector('svg');
    expect(cube.getAttribute('aria-hidden')).toBe('true');
    expect(cube.getAttribute('focusable')).toBe('false');
    expect(cube.querySelectorAll('text')).toHaveLength(1);
    expect(cube.querySelector('text').textContent).toBe('3');
    expect(cube.querySelector(`[fill="${RUBIKS_CLASSIC.yellow}"]`)).not.toBeNull();
  });
  it('can appear multiple times without SVG definition ID collisions', () => {
    const html = renderToStaticMarkup(<><WormWordmark /><WormWordmark inline /></>);
    expect(html).not.toMatch(/\sid=/);
  });
});
