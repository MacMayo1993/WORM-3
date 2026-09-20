import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Vector3 } from 'three';
import { createMenuCharacterRig, menuCharacterPair } from '../components/menus/menuCharacterRig.js';
import { WORM_CHARACTERS } from '../worm/wormCharacterData.js';
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('cycles through every playable character without repeating a pair member', () => {
  const ids = new Set();
  for (let cycle = 0; cycle < 7; cycle++) {
    const pair = menuCharacterPair(cycle);
    expect(pair[0]).not.toBe(pair[1]); pair.forEach(id => ids.add(id));
  }
  expect([...ids].sort()).toEqual(WORM_CHARACTERS.map(c => c.id).sort());
});
it.each(WORM_CHARACTERS.map(c => c.id))('poses and disposes the shared %s character assets', character => {
  const rig = createMenuCharacterRig(character);
  const p = new Vector3(0,0,1.62), n = new Vector3(0,0,1), f = new Vector3(0,1,0);
  for (let i = 0; i < rig.segments.length; i++) rig.pose(i, p, n, f, true, 1);
  expect(rig.group.name).toBe(`menu-character-${character}`);
  rig.group.updateMatrixWorld(true);
  rig.group.traverse(o => { if (o.isMesh) expect(o.matrixWorld.elements.every(Number.isFinite)).toBe(true); });
  if (character === 'mobi') expect(rig.group.getObjectByName('transparent-body')).toBeDefined();
  if (character === 'book') expect(rig.segments[2].hinges).toHaveLength(2);
  if (character === 'prism') expect(rig.segments[1].holder.children[0].geometry.type).toBe('IcosahedronGeometry');
  rig.dispose();
});
