import { expect, it } from 'vitest';
import { Sprite, SpriteMaterial, Vector3 } from 'three';
import { updateHealBadgePose } from '../worm/healerWorm/healBadgePose.js';

it('shows only the facing mouth, including after a turn and on the underside', () => {
    const mesh = new Sprite(new SpriteMaterial());
    for (const n of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
        const normal = new Vector3(...n);
        const position = normal.clone().multiplyScalar(2.5);
        updateHealBadgePose(mesh, position, normal, normal.clone().multiplyScalar(6), 5, 'crawling');
        expect(mesh.visible).toBe(true);
        expect(mesh.position.clone().sub(position).dot(normal)).toBeCloseTo(0.68);
        updateHealBadgePose(mesh, position, normal, normal.clone().multiplyScalar(-6), 5, 'crawling');
        expect(mesh.visible).toBe(false);
    }
});
it('hides during an interior ride and fades at grazing angles', () => {
    const mesh = new Sprite(new SpriteMaterial());
    const position = new Vector3(0,0,2.5), normal = new Vector3(0,0,1);
    updateHealBadgePose(mesh, position, normal, new Vector3(0,0,2.52), 5, 'exiting');
    expect(mesh.visible).toBe(false);
    updateHealBadgePose(mesh, position, normal, new Vector3(5,0,2.6), 5, 'crawling');
    expect(mesh.visible).toBe(false);
    updateHealBadgePose(mesh, position, normal, new Vector3(5,0,4), 5, 'crawling');
    expect(mesh.visible).toBe(true);
    expect(mesh.material.opacity).toBeGreaterThan(0);
    expect(mesh.material.opacity).toBeLessThan(1);
});
