import { it, expect, vi } from 'vitest';
import { applyProps } from '@react-three/fiber';
const { cleanups } = vi.hoisted(() => ({ cleanups: [] }));
vi.mock('react', async original => ({ ...await original(), useMemo: fn => fn(), useEffect: fn => { cleanups.push(fn()); } }));
vi.mock('@react-three/fiber', async original => ({ ...await original(), useFrame: () => {} }));
import { ElementalPatches } from '../worm/healerWorm/ElementalPatches.jsx';

it('can clean up and recreate both patch meshes on repeated retries', () => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const element = ElementalPatches({ worm: {}, size: 5 });
    const disposed = [];
    for (const child of element.props.children) {
      const { object: mesh, ...props } = child.props;
      // Use R3F's real prop application: dispose={null} overwrites mesh.dispose.
      applyProps(mesh, props);
      for (const resource of [mesh.geometry, mesh.material, mesh]) {
        const listener = vi.fn(); resource.addEventListener('dispose', listener); disposed.push(listener);
      }
    }
    expect(() => cleanups.pop()()).not.toThrow();
    disposed.forEach(listener => expect(listener).toHaveBeenCalledTimes(1));
  }
});
