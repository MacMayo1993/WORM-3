// CPU-only, deterministic visibility sample. This is not a mobile GPU/FPS test.
import { performance } from 'node:perf_hooks';
import * as THREE from 'three';
import { createOrbVisibility } from '../src/worm/orbVisibility.js';
import { scaledWormOrbCount, WORM_DIFFICULTIES } from '../src/worm/wormDifficulty.js';

const camera = new THREE.PerspectiveCamera(75, 9 / 16, 0.1, 100);
camera.position.set(0, 0, 13);
camera.lookAt(0, 2, 7.5);
const visibility = createOrbVisibility();
for (const mode of WORM_DIFFICULTIES) {
    const count = scaledWormOrbCount(mode.settings.wormOrbCount, 15);
    const positions = Array.from({ length: count }, (_, i) => {
        const u = ((Math.floor(i / 6) * 7) % 15) - 7;
        const v = ((Math.floor(i / 6) * 11 + 3) % 15) - 7;
        const faces = [[7.8, u, v], [-7.8, u, v], [u, 7.8, v], [u, -7.8, v], [u, v, 7.8], [u, v, -7.8]];
        return new THREE.Vector3(...faces[i % 6]);
    });
    visibility.begin(camera);
    const visible = positions.filter(p => visibility.contains(p, 0.85)).length;
    let sink = 0;
    for (let i = 0; i < 1000; i++) for (const p of positions) sink += visibility.contains(p, 0.85);
    const start = performance.now();
    for (let frame = 0; frame < 10000; frame++) {
        visibility.begin(camera);
        for (const p of positions) sink += visibility.contains(p, 0.85);
    }
    console.log(JSON.stringify({ mode: mode.id, totalOrbs: count, visibleOrbs: visible,
        skippedAnimations: count - visible, meshesBeforeFrustum: count * 11,
        meshesAfterGroupFrustum: visible * 11, cpuMsPerFrame: +( (performance.now() - start) / 10000).toFixed(4) }));
    if (!Number.isFinite(sink)) throw Error('invalid result');
}
