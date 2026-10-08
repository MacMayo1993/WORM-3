import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AboutPanel } from '../components/menus/settings/AboutPanel.jsx';
import { CC_BY_4, ENVIRONMENT_CREDITS, MODEL_CHANGES, MODEL_CREDITS } from '../utils/credits.js';

let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<AboutPanel />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });

describe('About panel (credits)', () => {
  it('credits every CC BY model with its title, author and licence, and says what was changed', () => {
    for (const model of MODEL_CREDITS) {
      const title = [...host.querySelectorAll('a')].find(a => a.textContent === model.title);
      const author = [...host.querySelectorAll('a')].find(a => a.getAttribute('href') === model.authorUrl);
      expect(title?.getAttribute('href'), `${model.title} links its source`).toBe(model.source);
      expect(author?.textContent, `${model.title} names its author`).toBe(model.author);
    }
    const licence = [...host.querySelectorAll('a')].find(a => a.getAttribute('href') === CC_BY_4.url);
    expect(licence?.textContent).toBe('CC BY 4.0');
    expect(host.textContent).toContain(MODEL_CHANGES);
  });

  it('names the verified environment maps and their source', () => {
    for (const map of ENVIRONMENT_CREDITS) expect(host.textContent).toContain(map.title);
    expect(host.textContent).toContain('Poly Haven');
  });

  it('opens every external link safely, in a new tab', () => {
    const links = [...host.querySelectorAll('a')];
    expect(links.length).toBeGreaterThanOrEqual(MODEL_CREDITS.length * 2);
    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\//);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });
});
