import { it, expect, vi } from 'vitest';
import { makeCubies } from '../game/cubeState.js';

const rig = vi.hoisted(() => ({ state: {} }));
vi.mock('react', async original => ({ ...await original(), useMemo: fn => fn(), useRef: value => ({ current: value }) }));
vi.mock('@react-three/fiber', () => ({ useFrame: () => {} }));
vi.mock('@react-three/drei', () => ({ RoundedBox: () => null }));
vi.mock('zustand/react/shallow', () => ({ useShallow: fn => fn }));
vi.mock('../hooks/useGameStore.js', () => ({ useGameStore: Object.assign(fn => fn(rig.state), { subscribe: () => () => {}, getState: () => rig.state }) }));
vi.mock('../3d/StickerPlane.jsx', () => ({ default: () => null }));
vi.mock('../3d/MergedLedEdges.jsx', () => ({ default: () => null }));
import Cubie from '../3d/Cubie.jsx';
import StickerPlane from '../3d/StickerPlane.jsx';
import MergedLedEdges from '../3d/MergedLedEdges.jsx';

const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
  ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
function render(power, { wormMode = true, size = 3, flipped = false, ...settings } = {}) {
  rig.state = { visualMode: 'grid', explosionT: 0, settings: {}, randomMode: false,
    randomStyleTick: 0, perfReducedFX: true, wormViewPower: power, ...settings };
  const cube = makeCubies(size)[size - 1][size - 1][size - 1];
  if (flipped) { cube.stickers.PZ.flips = 1; cube.stickers.PZ.curr = 6; }
  const k = (size - 1) / 2;
  return nodes(Cubie.type.render({ cubie: cube, position: [k, k, k], size, wormMode, omitBody: size >= 15 }, null));
}

it('temporarily overrides random, hollow and mirror views and restores the selected appearance', () => {
  let tree = render('view-glass', { randomMode: true, hollowMode: true, mirrorMode: true });
  expect(tree.filter(n => n.type === StickerPlane).map(n => n.props.mode)).toEqual(['glass', 'glass', 'glass']);
  const body = tree.find(n => n.type === 'meshStandardMaterial');
  expect(body.props.opacity).toBe(0.12);
  expect(rig.state).toMatchObject({ randomMode: true, hollowMode: true, mirrorMode: true, visualMode: 'grid' });
  tree = render(null);
  expect(tree.filter(n => n.type === StickerPlane).every(n => n.props.mode === 'grid')).toBe(true);
  tree = render(null, { mirrorMode: true });
  expect(tree.filter(n => n.type === StickerPlane)).toHaveLength(0);
  tree = render('view-glass', { wormMode: false });
  expect(tree.filter(n => n.type === StickerPlane).every(n => n.props.mode === 'grid')).toBe(true);
});
it.each([3, 15])('renders LEGO studs and whole-cubie neon on a %i cube, including flipped corners', size => {
  const lego = render('view-lego', { size, flipped: true });
  expect(lego.filter(n => n.type?.name === 'LegoStud')).toHaveLength(3);
  const neon = render('view-neon', { size, flipped: true });
  expect(neon.find(n => n.type === MergedLedEdges).props.edges).toHaveLength(12);
  const restored = render(null, { size, flipped: true });
  expect(restored.find(n => n.type === MergedLedEdges).props.edges).toHaveLength(4);
});
