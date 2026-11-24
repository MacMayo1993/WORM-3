import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { ensureInstanceColor, uploadInstancePrefix } from '../../3d/instanceUploads.js';
import { BLAST_EMBERS, BLAST_LIFE, blastFrame } from './blastVisuals.js';

const Z = new THREE.Vector3(0, 0, 1);
const temp = new THREE.Object3D();
const projected = new THREE.Vector3();
const offset = new THREE.Vector3();
const q = new THREE.Quaternion();
const color = new THREE.Color();
const palettes = {
    bomb: ['#ffad48', '#fff0a3', '#ff5b24', '#ffbf57'],
    fire: ['#ff642a', '#ffcd50', '#ff4017', '#ff8d3c'],
};
const smokeColor = new THREE.Color('#38222d');
const hot = new THREE.Color('#fff5ba');

function makeMaterial(additive) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide,
        transparent: true, toneMapped: false, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    material.onBeforeCompile = shader => {
        shader.vertexShader = 'attribute float blastAlpha; varying float vBlastAlpha;\n' +
            shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlastAlpha = blastAlpha;');
        shader.fragmentShader = 'varying float vBlastAlpha;\n' +
            shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vBlastAlpha;');
    };
    return material;
}

// Retain the warmed shader variants even after the setup burst unmounts.
const energy = makeMaterial(true);
const haze = makeMaterial(false);

function makeLayer(name, geometry, capacity, material = energy) {
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('blastAlpha', alpha);
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    ensureInstanceColor(mesh);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.name = name;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return { mesh, alpha };
}

function put(layer, position, rotation, sx, sy, sz, tint, opacity) {
    const { mesh, alpha } = layer;
    const i = mesh.count++;
    temp.position.copy(position);
    temp.quaternion.copy(rotation);
    temp.scale.set(sx, sy, sz);
    temp.updateMatrix();
    mesh.setMatrixAt(i, temp.matrix);
    mesh.setColorAt(i, tint);
    alpha.setX(i, opacity);
}

export default function DetonationBurst({ points, kind, onDone, warm = false }) {
    const age = useRef(0);
    const done = useRef(false);
    const ttl = useMemo(() => points.reduce((n, p) => Math.max(n, p.delay), 0) + BLAST_LIFE, [points]);
    const tiles = useMemo(() => points.map(({ pos, normal, delay, epicenter }) => {
        const n = new THREE.Vector3(...normal).normalize();
        return { surface: new THREE.Vector3(...pos).addScaledVector(n, -0.30), n, delay, epicenter,
            pose: new THREE.Quaternion().setFromUnitVectors(Z, n) };
    }), [points]);
    const colors = useMemo(() => palettes[kind].map(c => new THREE.Color(c)), [kind]);
    const layers = useMemo(() => {
        const n = Math.max(1, points.length);
        const layers = [
            makeLayer('blast-shock-rings', new THREE.RingGeometry(0.54, 0.67, 32), n * 2),
            makeLayer('blast-fire-plume', new THREE.IcosahedronGeometry(0.5, 1), n * 2),
            makeLayer('blast-embers', new THREE.OctahedronGeometry(0.11), n * BLAST_EMBERS),
            makeLayer('blast-smoke', new THREE.IcosahedronGeometry(0.43, 0), n, haze),
        ];
        if (warm) for (const { mesh, alpha } of layers) {
            mesh.count = 1;
            mesh.setColorAt(0, hot);
            alpha.setX(0, 0.01);
        }
        return layers;
    }, [points, warm]);
    useEffect(() => () => {
        for (const { mesh } of layers) { mesh.geometry.dispose(); mesh.dispose(); }
    }, [layers]);

    useFrame((_, delta) => {
        if (warm || done.current) return;
        // Match the sim's hidden-tab/pause behavior. On a result screen let
        // the last detonation resolve rather than freezing over the board.
        const state = useGameStore.getState();
        if (document.hidden || (state.wormPaused && state.wormAlive && !state.wormStoryResult)) return;
        age.current += Math.min(delta, 0.08);
        if (age.current >= ttl) { done.current = true; onDone(); return; }
        const reduced = prefersReducedMotion() || state.settings?.reducedMotion;
        const emberCount = state.perfReducedFX ? 2 : BLAST_EMBERS;
        const [wave, plume, embers, smoke] = layers;
        for (const { mesh } of layers) mesh.count = 0;
        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            const f = blastFrame(age.current, tile.delay, reduced);
            if (!f) continue;
            if (f.waveAlpha > 0.01) {
                const shock = f.wave * (tile.epicenter ? 1.20 : 1);
                put(wave, tile.surface, tile.pose, shock, shock, 1, colors[0], f.waveAlpha);
                projected.copy(tile.surface).addScaledVector(tile.n, 0.02);
                put(wave, projected, tile.pose, f.wave * 0.72, f.wave * 0.72, 1, colors[1], f.waveAlpha * 0.7);
            }
            if (f.heat > 0.01) {
                projected.copy(tile.surface).addScaledVector(tile.n, 0.13 + (reduced ? 0 : f.flight * 0.52));
                const lift = f.plume * (tile.epicenter ? 1.7 : 1.26);
                put(plume, projected, tile.pose, f.plume * 0.70, f.plume * 0.70, lift, colors[2], f.heat * 0.74);
                projected.addScaledVector(tile.n, -0.035);
                put(plume, projected, tile.pose, f.plume * 0.37, f.plume * 0.37, f.plume * 0.84, colors[1], f.heat * 0.80);
            }
            if (!reduced && f.flight < 1) {
                for (let e = 0; e < emberCount; e++) {
                    const theta = e * (Math.PI * 2 / emberCount) + i * 2.40;
                    const radius = 0.11 + f.flight * (0.29 + e * 0.042);
                    offset.set(Math.cos(theta) * radius, Math.sin(theta) * radius,
                        0.09 + (0.58 + e * 0.10) * Math.sin(f.flight * Math.PI * 0.87)).applyQuaternion(tile.pose);
                    projected.copy(tile.surface).add(offset);
                    q.copy(tile.pose);
                    temp.rotation.set(0, 0, theta);
                    q.multiply(temp.quaternion);
                    color.copy(colors[3]).lerp(hot, 1 - f.flight);
                    put(embers, projected, q, 0.45, 0.40, 1.35 - 0.65 * f.flight, color, (1 - f.flight) ** 1.6);
                }
            }
            if (!state.perfReducedFX && f.smoke > 0.03) {
                projected.copy(tile.surface).addScaledVector(tile.n, 0.26 + f.flight * 0.85);
                put(smoke, projected, tile.pose, 0.67 + f.flight * 0.5, 0.60 + f.flight * 0.5, 0.65, smokeColor, f.smoke);
            }
        }
        for (const { mesh, alpha } of layers) {
            uploadInstancePrefix(mesh.instanceMatrix, mesh.count);
            if (mesh.instanceColor) uploadInstancePrefix(mesh.instanceColor, mesh.count);
            uploadInstancePrefix(alpha, mesh.count);
        }
    });

    return <group name={`worm-detonation-${kind}`}>{layers.map(({ mesh }, i) =>
        <primitive key={i} object={mesh} />)}</group>;
}
