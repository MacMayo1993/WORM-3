// The wizard's tile style step is laid out like the store: every family down a
// sidebar with its owned count, the open family's styles beside it, and Per
// Face set apart at the bottom of the sidebar.
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { COLOR_SCHEMES, TILE_STYLES } from '../utils/colorSchemes.js';
import { TILE_STYLE_SECTIONS } from '../utils/tileStyleCatalog.js';

vi.mock('../components/screens/wizardSteps/CubePlate.jsx', () => ({ default: ({ caption, title }) => <div data-plate={caption}>{title}</div> }));
vi.mock('../components/screens/wizardSteps/shared.jsx', async importOriginal => ({
  ...await importOriginal(),
  TilePreviewCanvas: ({ styleKey }) => <canvas data-style={styleKey} />
}));
vi.mock('../components/screens/wormMenuFeedback.js', () => ({ wormMenuFeedback: vi.fn() }));

import StyleStep from '../components/screens/wizardSteps/StyleStep.jsx';
import { styleCategory } from '../components/screens/wizardSteps/styleCategory.jsx';

const [classic, , living] = TILE_STYLE_SECTIONS;
// Own every classic style, and all but two living ones.
const OWNED = [...classic.keys, ...living.keys.slice(2)].map(key => `tile_${key}`);

// What the step has written back, for the assertions to read.
const latest = {};
let host, root;
function Harness({ slot = 'body' }) {
  const [settings, setSettings] = useState({ colorScheme: 'standard', tileStyle: 'solid', perFaceStyles: null });
  const [styleFamily, setStyleFamily] = useState(null);
  Object.assign(latest, { settings, styleFamily });
  const cos = {
    settings, setSettings, styleFamily, setStyleFamily, cubeSize: 3, colors: COLOR_SCHEMES.standard,
    accent: '#00a651', accentShadow: '#00632f', ownedItems: OWNED
  };
  return <StyleStep cos={cos} slot={slot} />;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<Harness />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

const rail = () => host.querySelector('nav[aria-label="Tile families"]');
const family = label => [...rail().querySelectorAll('button')].find(b => b.querySelector('strong').textContent === label);
const gridKeys = () => [...host.querySelectorAll('.style-browser-grid button canvas')].map(c => c.dataset.style);

it('lists every family down the sidebar with what you own of it, then Per Face', () => {
  const rows = [...rail().querySelectorAll('button')];
  expect(rows.map(b => b.querySelector('strong').textContent)).toEqual([...TILE_STYLE_SECTIONS.map(s => s.label), 'Per Face']);
  expect(family('Classic').querySelector('small').textContent).toBe(`${classic.keys.length} / ${classic.keys.length} owned`);
  expect(family('Living').querySelector('small').textContent).toBe(`${living.keys.length - 2} / ${living.keys.length} owned`);
  // Each family's cover is its first style.
  expect(family('Living').querySelector('canvas').dataset.style).toBe(living.keys[0]);
  // The family holding the worn style is open, and its grid sits beside the rail.
  expect(family('Classic').getAttribute('aria-pressed')).toBe('true');
  expect(host.querySelector('.style-browser-heading h2').textContent).toBe('Classic');
  expect(gridKeys()).toEqual(classic.keys);
});

it('opens a family from the sidebar and applies only owned styles from it', () => {
  act(() => family('Living').click());
  expect(latest.styleFamily).toBe('living');
  expect(family('Living').getAttribute('aria-pressed')).toBe('true');
  expect(family('Classic').getAttribute('aria-pressed')).toBe('false');
  expect(gridKeys()).toEqual(living.keys);

  const card = key => host.querySelector(`.style-browser-grid button[title="${TILE_STYLES[key].label}"]`);
  act(() => card(living.keys[0]).click());
  expect(latest.settings.tileStyle).toBe('solid');
  expect(card(living.keys[0]).getAttribute('aria-disabled')).toBe('true');

  act(() => card(living.keys[2]).click());
  expect(latest.settings).toMatchObject({ tileStyle: living.keys[2], perFaceStyles: null });
  expect(card(living.keys[2]).getAttribute('aria-pressed')).toBe('true');
});

it('shows a picker per face under Per Face, with only owned styles offered', () => {
  act(() => family('Per Face').click());
  expect(host.querySelector('.style-browser-grid')).toBeNull();
  const selects = [...host.querySelectorAll('.style-browser-faces select')];
  expect(selects.map(s => s.getAttribute('aria-label'))).toEqual(
    ['Front', 'Left', 'Top', 'Back', 'Right', 'Bottom'].map(face => `${face} face style`)
  );
  const offered = [...selects[0].querySelectorAll('option')].map(o => o.value);
  expect(offered).toEqual([...classic.keys, ...living.keys.slice(2)]);
});

it('keeps the families out of the wizard chrome', () => {
  const cat = styleCategory({ settings: { tileStyle: 'solid', perFaceStyles: null }, ownedItems: OWNED, styleFamily: null, setStyleFamily: () => {} });
  expect(cat).not.toHaveProperty('children');
  expect(cat.summary).toBe('Solid');
});
