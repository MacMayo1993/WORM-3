import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { wormSegments } from '../wormSegments.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { uploadInstancePrefix } from '../../3d/instanceUploads.js';
import { MOBI_SEGMENT_RADIUS } from '../mobiSegments.js';
import { WORM_LIFT } from './constants.js';
import { cubeShellDirInto } from './rocketOrbit.js';
import {
    rocketBurnInto, createSmokePool, clearSmokePool, emitPuff, stepSmokePool, puffLookInto,
    createRocketRandom, ROCKET_SMOKE_CAPACITY
} from './rocketFx.js';

// The rocket burn, drawn: a booster strapped to the tail, a flickering plume out
// of its nozzle, a smoke contrail left hanging in world space, a launch cloud and
// shock ring on the pad, and a puff of dust at touchdown. Render-only — it reads
// the sim's rocket fields and the rendered tail (wormSegments) and writes nothing
// back. The beat of the burn comes from rocketBurnInto, the same envelope the
// chase camera shakes to.

// ── Booster, in its own frame: +Y points out of the nozzle, away from the body ──
const BODY_RADIUS = 0.09;           // the plain bead the parts below are sized for
const CASING_R = 0.062;
const CASING_Y0 = 0.03, CASING_Y1 = 0.2;
const NOZZLE_EXIT_Y = 0.265;
const FIN_COUNT = 4;

// Smoke budget: puffs per second at thrust 1, before quality scaling.
const SMOKE_RATE = 60;
const FIRE_RATE = 90;
const PUFF_ATTRIBUTES = ['position', 'aSize', 'aAlpha', 'aHeat', 'aSeed'];
// Share of the nozzle's own velocity new exhaust keeps (see the wake note below).
// Kept low: the orbit bends at every cube edge, and exhaust carried straight on
// at flight speed is flung off the path instead of trailing along it.
const SMOKE_WAKE = 0.35;
const FIRE_WAKE = 0.6;
const MAX_WAKE_SPEED = 14;

const _tail = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3();
const _side = new THREE.Vector3();
const _nozzle = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();
const _v = new THREE.Vector3();
const _p = new THREE.Vector3();
const _wake = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _look = { size: 0, alpha: 0, heat: 0 };
const _burn = {};

// A teardrop plume of unit radius and length along +Y: it swells just past the
// nozzle and tapers to a point, which reads as a jet rather than a traffic cone.
function createPlumeGeometry() {
    const points = [];
    for (let i = 0; i <= 18; i++) {
        const y = i / 18;
        points.push(new THREE.Vector2(Math.max(1e-3, (1 + 2.2 * y) * Math.pow(1 - y, 0.85)), y));
    }
    return new THREE.LatheGeometry(points, 28);
}

// Premultiplied output: rgb is light, alpha is how much of the scene behind it is
// covered. Hot gas adds light (alpha ≈ 0) and reads on a black sky; cooler gas and
// smoke cover, so the burn still reads against a bright desert or snow scene.
const PREMULTIPLIED = {
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor
};

const NOISE_GLSL = `
    float rHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float rNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(rHash(i), rHash(i + vec2(1.0, 0.0)), f.x),
                   mix(rHash(i + vec2(0.0, 1.0)), rHash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
`;

const plumeVertex = `
    uniform float uTime;
    uniform float uWobble;
    varying float vAlong;
    varying float vAround;
    varying float vFacing;
    void main() {
        vAlong = uv.y;
        vAround = uv.x;
        vec3 p = position;
        // Turbulence grows toward the tip, and the tip lashes, so the plume never
        // holds still the way a solid cone does.
        float w = sin(uv.y * 9.0 - uTime * 23.0 + uv.x * 6.2832) * 0.5 + sin(uv.y * 17.0 - uTime * 37.0) * 0.5;
        p.xz *= 1.0 + w * 0.2 * uWobble * uv.y;
        p.x += sin(uTime * 13.0 + uv.y * 4.0) * 0.25 * uWobble * uv.y * uv.y;
        p.z += cos(uTime * 11.0 + uv.y * 3.0) * 0.25 * uWobble * uv.y * uv.y;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
    }
`;

const plumeFragment = `
    uniform float uTime;
    uniform float uOpacity;
    uniform float uHot;
    uniform float uCover;
    varying float vAlong;
    varying float vAround;
    varying float vFacing;
    ${NOISE_GLSL}
    void main() {
        float a = vAlong;
        float n = rNoise(vec2(vAround * 9.0, a * 6.0 - uTime * 9.0)) * 0.6
                + rNoise(vec2(vAround * 18.0, a * 13.0 - uTime * 17.0)) * 0.4;
        float body = pow(vFacing, 1.2);
        float tip = 1.0 - smoothstep(0.4, 1.0, a + (n - 0.5) * 0.4);
        // White-hot throat → yellow → orange → deep red, pushed hotter for the core.
        float t = a * (1.0 - 0.6 * uHot);
        vec3 c = mix(vec3(1.0, 0.98, 0.9), vec3(1.0, 0.84, 0.36), smoothstep(0.0, 0.16, t));
        c = mix(c, vec3(1.0, 0.46, 0.08), smoothstep(0.14, 0.48, t));
        c = mix(c, vec3(0.78, 0.13, 0.04), smoothstep(0.48, 0.95, t));
        // Shock diamonds down the hot core.
        float diamonds = pow(max(0.0, cos(a * 34.0 - uTime * 2.0)), 6.0) * (1.0 - smoothstep(0.0, 0.6, a)) * uHot;
        c += vec3(0.5, 0.6, 0.8) * diamonds;
        float strength = body * tip * uOpacity * (0.7 + 0.6 * n);
        float cover = strength * smoothstep(0.08, 0.55, a) * uCover;
        gl_FragColor = vec4(c * strength, cover);
    }
`;

const smokeVertex = `
    attribute float aSize;
    attribute float aAlpha;
    attribute float aHeat;
    attribute float aSeed;
    uniform float uScale;
    uniform float uMaxPx;
    varying float vAlpha;
    varying float vHeat;
    varying float vSeed;
    void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float depth = max(0.05, -mv.z);
        gl_PointSize = min(uMaxPx, aSize * uScale / depth);
        // Puffs drifting back past the chase camera thin out instead of filling the lens.
        vAlpha = aAlpha * smoothstep(0.35, 1.1, depth);
        vHeat = aHeat;
        vSeed = aSeed;
        gl_Position = projectionMatrix * mv;
    }
`;

const smokeFragment = `
    varying float vAlpha;
    varying float vHeat;
    varying float vSeed;
    ${NOISE_GLSL}
    void main() {
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float r = length(c);
        if (r > 1.0 || vAlpha < 0.003) discard;
        vec3 fire = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.93, 0.7), clamp((1.0 - r) * 1.4, 0.0, 1.0));
        if (vSeed < 0.0) {
            // The nozzle glow: pure light, no coverage.
            float g = pow(1.0 - r, 2.2);
            gl_FragColor = vec4(fire * g * vAlpha, 0.0);
            return;
        }
        float n = rNoise(c * 2.6 + vSeed * 37.0);
        float edge = 1.0 - smoothstep(0.4, 1.0, r + (n - 0.5) * 0.45);
        // Lit from above so each puff has a body, not a flat disc.
        float shade = clamp(0.62 + 0.3 * -c.y + 0.25 * (1.0 - r) + (n - 0.5) * 0.2, 0.0, 1.0);
        vec3 smoke = mix(vec3(0.46, 0.45, 0.46), vec3(0.97, 0.96, 0.94), shade);
        float a = edge * vAlpha;
        vec3 col = mix(smoke, fire, vHeat);
        gl_FragColor = vec4(col * a, a * (1.0 - 0.8 * vHeat));
    }
`;

const ringVertex = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const ringFragment = `
    uniform float uOpacity;
    varying vec2 vUv;
    void main() {
        float r = length(vUv - 0.5) * 2.0;
        float band = smoothstep(0.5, 0.9, r) * (1.0 - smoothstep(0.93, 1.0, r));
        // A grey dust wall with a hot leading edge: visible on light and dark stickers.
        vec3 c = mix(vec3(0.55, 0.53, 0.52), vec3(1.0, 0.93, 0.78), smoothstep(0.78, 0.97, r));
        float a = band * uOpacity;
        gl_FragColor = vec4(c * a, a * 0.7);
    }
`;

function createResources() {
    const casing = new THREE.CylinderGeometry(CASING_R, CASING_R * 0.94, CASING_Y1 - CASING_Y0, 22);
    casing.translate(0, (CASING_Y0 + CASING_Y1) / 2, 0);
    const band = new THREE.CylinderGeometry(CASING_R * 1.06, CASING_R * 1.06, 0.028, 22);
    band.translate(0, 0.15, 0);
    // Swept fin in (outward, along) — root on the casing, tip trailing past the nozzle.
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0.09);
    finShape.lineTo(0.058, 0.17);
    finShape.lineTo(0.058, 0.25);
    finShape.lineTo(0, 0.2);
    finShape.closePath();
    const fin = new THREE.ExtrudeGeometry(finShape, { depth: 0.012, bevelEnabled: false });
    fin.translate(CASING_R - 0.004, 0, -0.006);
    const bell = new THREE.LatheGeometry([
        new THREE.Vector2(0.042, 0.19), new THREE.Vector2(0.04, 0.205), new THREE.Vector2(0.046, 0.225),
        new THREE.Vector2(0.056, 0.245), new THREE.Vector2(0.067, NOZZLE_EXIT_Y)
    ], 22);
    const throat = new THREE.CircleGeometry(0.041, 20);
    throat.rotateX(-Math.PI / 2);
    throat.translate(0, 0.205, 0);
    const plume = createPlumeGeometry();
    const ring = new THREE.RingGeometry(0.5, 1, 56);

    const white = new THREE.MeshStandardMaterial({ color: '#f4f0e6', roughness: 0.35, metalness: 0.05 });
    const red = new THREE.MeshStandardMaterial({ color: '#e0412f', roughness: 0.4, metalness: 0.05 });
    const metal = new THREE.MeshStandardMaterial({ color: '#555b66', roughness: 0.3, metalness: 0.7, side: THREE.DoubleSide });
    const glow = new THREE.MeshBasicMaterial({ color: '#ffe0a0', toneMapped: false });
    const plumeUniforms = hot => ({
        uTime: { value: 0 }, uWobble: { value: 1 }, uOpacity: { value: 1 }, uHot: { value: hot }, uCover: { value: hot ? 0.2 : 0.85 }
    });
    const outer = new THREE.ShaderMaterial({
        ...PREMULTIPLIED, side: THREE.DoubleSide, uniforms: plumeUniforms(0), vertexShader: plumeVertex, fragmentShader: plumeFragment
    });
    const core = new THREE.ShaderMaterial({
        ...PREMULTIPLIED, side: THREE.DoubleSide, uniforms: plumeUniforms(1), vertexShader: plumeVertex, fragmentShader: plumeFragment
    });
    const smoke = new THREE.ShaderMaterial({
        ...PREMULTIPLIED, uniforms: { uScale: { value: 600 }, uMaxPx: { value: 256 } },
        vertexShader: smokeVertex, fragmentShader: smokeFragment
    });
    const shock = new THREE.ShaderMaterial({
        ...PREMULTIPLIED, side: THREE.DoubleSide, uniforms: { uOpacity: { value: 0 } },
        vertexShader: ringVertex, fragmentShader: ringFragment
    });

    // One slot beyond the smoke ring carries the nozzle glow.
    const slots = ROCKET_SMOKE_CAPACITY + 1;
    const puffs = new THREE.BufferGeometry();
    const dynamic = (itemSize) => new THREE.BufferAttribute(new Float32Array(slots * itemSize), itemSize).setUsage(THREE.DynamicDrawUsage);
    puffs.setAttribute('position', dynamic(3));
    puffs.setAttribute('aSize', dynamic(1));
    puffs.setAttribute('aAlpha', dynamic(1));
    puffs.setAttribute('aHeat', dynamic(1));
    puffs.setAttribute('aSeed', dynamic(1));
    puffs.setDrawRange(0, 0);

    return {
        geometries: { casing, band, fin, bell, throat, plume, ring, puffs },
        materials: { white, red, metal, glow, outer, core, smoke, shock }
    };
}

function disposeResources(res) {
    Object.values(res.geometries).forEach(g => g.dispose());
    Object.values(res.materials).forEach(m => m.dispose());
}

export default function RocketExhaust({ worm, size }) {
    const { gl, camera, scene } = useThree();
    const res = useMemo(() => createResources(), []);
    useEffect(() => () => disposeResources(res), [res]);
    const booster = useRef();
    const plume = useRef();
    const points = useRef();
    const ringMesh = useRef();
    const reducedMotion = prefersReducedMotion();
    const fx = useRef(null);
    if (fx.current === null) {
        fx.current = {
            pool: createSmokePool(ROCKET_SMOKE_CAPACITY),
            random: createRocketRandom(0x5eed),
            time: 0,
            smokeAcc: 0,
            fireAcc: 0,
            flash: 0,
            prevNozzle: new THREE.Vector3(),
            nozzleValid: false,
            wasActive: false,
            prevRocketT: 0,
            runId: null,
            ring: { t: Infinity, dur: 1, radius: 1, peak: 0 },
            warmKey: null
        };
    }
    const character = useGameStore(s => s.wormCharacter ?? 'classic');
    const tailScale = (character === 'mobi' ? MOBI_SEGMENT_RADIUS : BODY_RADIUS) / BODY_RADIUS;

    useEffect(() => {
        // Sprites near the camera can exceed a GPU's point size cap; ask once.
        try {
            const range = gl.getContext?.()?.getParameter?.(0x846d); // ALIASED_POINT_SIZE_RANGE
            if (range?.[1] > 0) res.materials.smoke.uniforms.uMaxPx.value = Math.min(1024, range[1]);
        } catch (_) { /* keep the conservative default */ }
    }, [gl, res]);

    useFrame((state, delta) => {
        const f = fx.current;
        const group = booster.current;
        if (!group || !points.current || !ringMesh.current) return;
        const store = useGameStore.getState();
        const { pool, random } = f;

        // Compile every rocket program before the first burn, so ignition is not
        // also the frame the GPU stalls on new shaders. Re-warm when the lighting
        // environment (part of the lit materials' program key) changes.
        // (compile prepares hidden objects too, so nothing needs to be shown.)
        const warmKey = `${scene.environment?.uuid}|${scene.environment?.version}|${scene.fog ? 1 : 0}`;
        if (f.warmKey !== warmKey && gl.compile) {
            f.warmKey = warmKey;
            for (const object of [group, points.current, ringMesh.current]) gl.compile(object, camera, scene);
        }

        if (store.wormRunId !== f.runId) {
            f.runId = store.wormRunId;
            clearSmokePool(pool);
            f.ring.t = Infinity;
            f.wasActive = false;
            f.nozzleValid = false;
        }

        const paused = !!store.wormPaused;
        const dt = paused ? 0 : Math.min(delta, 0.05);
        const animate = !reducedMotion;
        if (animate) f.time += dt;

        const simActive = !!worm.rocketActive.current;
        const rocketT = worm.rocketT.current ?? 0;
        const flight = worm.rocketFlight?.current ?? 0;
        const grace = worm.landingGraceT?.current ?? 0;
        const burn = rocketBurnInto(_burn, simActive, rocketT, flight, grace);
        const onSurface = store.wormAlive && worm.phase.current === 'crawling';

        // ── Where the booster is: the rendered tail, pointing away from the body ──
        let frameOk = onSurface && wormSegments.tailCount >= 2;
        if (frameOk) {
            _tail.fromArray(wormSegments.tail);
            _dir.fromArray(wormSegments.beforeTail).sub(_tail).negate();
            frameOk = _dir.lengthSq() > 1e-8;
        }
        if (frameOk) {
            _dir.normalize();
            // Roll the fins to the cube: one pair straddles "up" (away from the cube).
            if (Number.isFinite(size)) cubeShellDirInto(_up, _tail, size);
            else _up.copy(_tail);
            _up.addScaledVector(_dir, -_up.dot(_dir));
            if (!(_up.lengthSq() > 1e-8)) perpendicularInto(_up, _dir);
            _up.normalize();
            _side.crossVectors(_dir, _up);
            _basis.makeBasis(_side, _dir, _up);
            group.position.copy(_tail);
            group.quaternion.setFromRotationMatrix(_basis);
            _nozzle.copy(_tail).addScaledVector(_dir, NOZZLE_EXIT_Y * tailScale);
        }

        // Reduced motion: the booster is simply there for the burn, without the clunk.
        const hardware = animate ? burn.hardware : burn.hardware > 0.001 ? 1 : 0;
        const showHardware = frameOk && hardware > 0.001;
        group.visible = showHardware;
        if (showHardware) group.scale.setScalar(Math.max(1e-3, hardware) * tailScale);

        // ── Plume ──
        const flicker = animate ? 1 + 0.1 * Math.sin(f.time * 37) + 0.07 * Math.sin(f.time * 61 + 1.3) : 1;
        const showPlume = showHardware && burn.thrust > 0.01;
        plume.current.visible = showPlume;
        if (showPlume) {
            // In booster units; the booster's own pop-in scale is divided back out
            // so the flame keeps its length while the hardware clunks into place.
            const hold = Math.max(0.2, hardware);
            const length = (0.3 + 0.85 * burn.thrust) * flicker / hold;
            const radius = 0.06 * (0.85 + 0.3 * burn.thrust) / hold;
            plume.current.scale.set(radius, length, radius);
            for (const m of [res.materials.outer, res.materials.core]) {
                m.uniforms.uTime.value = f.time;
                m.uniforms.uWobble.value = animate ? 1 : 0;
                m.uniforms.uOpacity.value = Math.min(1, burn.ignite * 1.2);
            }
        }

        // ── Beats: launch, refuel, touchdown ──
        if (!paused && frameOk && animate) {
            if (simActive && !f.wasActive && flight < 0.5) {
                launchBurst(f, random, size);
            } else if (simActive && f.wasActive && rocketT > f.prevRocketT + 0.5) {
                afterburnerBurst(f, random);
            } else if (!simActive && f.wasActive && grace > 0.5) {
                touchdownBurst(f, random, size);
            }
        }
        if (!paused) {
            f.wasActive = simActive && onSurface;
            f.prevRocketT = rocketT;
        }

        // ── Continuous exhaust: fire tongues and the smoke contrail ──
        const budget = store.perfReducedFX ? 0.6 : 1;
        if (!paused && animate && frameOk && simActive && burn.thrust > 0.02) {
            if (!f.nozzleValid) f.prevNozzle.copy(_nozzle);
            // Exhaust is dragged a little way along in the worm's wake before it
            // falls behind, so the plume billows around the tail rather than
            // vanishing under the chase camera the instant it is exhaled.
            _wake.subVectors(_nozzle, f.prevNozzle);
            if (dt > 0 && _wake.lengthSq() < 1) _wake.multiplyScalar(1 / dt).clampLength(0, MAX_WAKE_SPEED);
            else { _wake.set(0, 0, 0); f.prevNozzle.copy(_nozzle); }
            f.smokeAcc += dt * SMOKE_RATE * burn.thrust * budget;
            f.fireAcc += dt * FIRE_RATE * burn.thrust * budget;
            const smokeCount = Math.floor(f.smokeAcc);
            const fireCount = Math.floor(f.fireAcc);
            f.smokeAcc -= smokeCount;
            f.fireAcc -= fireCount;
            for (let k = 0; k < smokeCount; k++) {
                const along = (k + random()) / smokeCount;
                _p.lerpVectors(f.prevNozzle, _nozzle, along);
                jitterInto(_v, random, 0.65).addScaledVector(_dir, 0.8 + random() * 0.6).addScaledVector(_wake, SMOKE_WAKE);
                emitPuff(pool, _p.x, _p.y, _p.z, _v.x, _v.y, _v.z, {
                    age: (1 - along) * dt, life: 1.1 + random() * 0.7, size0: 0.12, size1: 0.7 + random() * 0.35,
                    alpha: 0.7 + random() * 0.25, heat: 1, cool: 14, drag: 2.2, seed: random()
                });
            }
            for (let k = 0; k < fireCount; k++) {
                const along = (k + random()) / fireCount;
                _p.lerpVectors(f.prevNozzle, _nozzle, along);
                jitterInto(_v, random, 0.35).addScaledVector(_dir, 2.6 + random() * 1.4).addScaledVector(_wake, FIRE_WAKE);
                emitPuff(pool, _p.x, _p.y, _p.z, _v.x, _v.y, _v.z, {
                    age: (1 - along) * dt, life: 0.16 + random() * 0.1, size0: 0.15 + 0.06 * burn.thrust, size1: 0.05,
                    alpha: 0.9, heat: 1, cool: 2, drag: 1, seed: random()
                });
            }
            f.prevNozzle.copy(_nozzle);
            f.nozzleValid = true;
        } else if (!paused) {
            f.nozzleValid = false;
        }
        stepSmokePool(pool, dt);
        f.flash = Math.max(0, f.flash - dt * 3);

        // ── Shock ring on the pad ──
        const ring = f.ring;
        if (!paused) ring.t += dt;
        const ringU = ring.t / ring.dur;
        ringMesh.current.visible = ringU < 1;
        if (ringU < 1) {
            const grow = 1 - Math.pow(1 - ringU, 3);
            ringMesh.current.scale.setScalar(Math.max(1e-3, ring.radius * grow));
            res.materials.shock.uniforms.uOpacity.value = ring.peak * (1 - ringU) * (1 - ringU);
        }

        // ── Upload the puffs: nozzle glow first, then newest → oldest, which is
        // back-to-front for the chase camera trailing the worm ──
        const geometry = res.geometries.puffs;
        const pos = geometry.attributes.position.array;
        const aSize = geometry.attributes.aSize.array;
        const aAlpha = geometry.attributes.aAlpha.array;
        const aHeat = geometry.attributes.aHeat.array;
        const aSeed = geometry.attributes.aSeed.array;
        let n = 0;
        const glowAlpha = showPlume ? Math.min(0.85, 0.6 * burn.thrust + f.flash) : 0;
        if (glowAlpha > 0.005) {
            pos[0] = _nozzle.x + _dir.x * 0.03; pos[1] = _nozzle.y + _dir.y * 0.03; pos[2] = _nozzle.z + _dir.z * 0.03;
            aSize[0] = (0.28 + 0.4 * burn.thrust + 0.8 * f.flash) * tailScale * flicker;
            aAlpha[0] = glowAlpha;
            aHeat[0] = 1;
            aSeed[0] = -1;
            n = 1;
        }
        for (let k = 1; k <= pool.capacity; k++) {
            const i = (pool.next - k + pool.capacity) % pool.capacity;
            if (!puffLookInto(_look, pool, i)) continue;
            pos[n * 3] = pool.pos[i * 3]; pos[n * 3 + 1] = pool.pos[i * 3 + 1]; pos[n * 3 + 2] = pool.pos[i * 3 + 2];
            aSize[n] = _look.size;
            aAlpha[n] = _look.alpha;
            aHeat[n] = _look.heat;
            aSeed[n] = pool.seed[i];
            n++;
        }
        geometry.setDrawRange(0, n);
        points.current.visible = n > 0;
        if (n > 0) {
            for (const name of PUFF_ATTRIBUTES) uploadInstancePrefix(geometry.attributes[name], n);
            const fov = state.camera?.isPerspectiveCamera ? state.camera.fov : 50;
            res.materials.smoke.uniforms.uScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan(fov * Math.PI / 360));
        }
    });

    // Launch: a cloud rolling out across the pad under the worm, a column of hot
    // exhaust, the ring, and a glow flash.
    function launchBurst(f, random, cubeSize) {
        surfaceFrameInto(cubeSize);
        const { pool } = f;
        const count = 38;
        for (let k = 0; k < count; k++) {
            const angle = (k + random() * 0.8) / count * Math.PI * 2;
            _v.copy(_t1).multiplyScalar(Math.cos(angle)).addScaledVector(_t2, Math.sin(angle));
            _p.copy(_tail).addScaledVector(_normal, 0.02).addScaledVector(_v, 0.06);
            _v.multiplyScalar(1.5 + random() * 1.5).addScaledVector(_normal, 0.15 + random() * 0.45);
            emitPuff(pool, _p.x, _p.y, _p.z, _v.x, _v.y, _v.z, {
                life: 1.4 + random() * 1.0, size0: 0.14, size1: 0.55 + random() * 0.4,
                alpha: 0.7 + random() * 0.2, heat: 0.7, cool: 6, drag: 3.2, seed: random()
            });
        }
        for (let k = 0; k < 14; k++) {
            jitterInto(_v, random, 0.5).addScaledVector(_normal, 0.6 + random() * 0.9).addScaledVector(_dir, 0.5);
            emitPuff(pool, _nozzle.x, _nozzle.y, _nozzle.z, _v.x, _v.y, _v.z, {
                life: 0.45 + random() * 0.35, size0: 0.12, size1: 0.35, alpha: 0.9, heat: 1, cool: 4, drag: 2.5, seed: random()
            });
        }
        startRing(f, 1.7, 0.6, 1);
        f.flash = 1;
    }

    // Refuel mid-flight: an afterburner kick out of the nozzle.
    function afterburnerBurst(f, random) {
        for (let k = 0; k < 16; k++) {
            jitterInto(_v, random, 0.6).addScaledVector(_dir, 2 + random() * 1.5);
            emitPuff(f.pool, _nozzle.x, _nozzle.y, _nozzle.z, _v.x, _v.y, _v.z, {
                life: 0.35 + random() * 0.3, size0: 0.16, size1: 0.3, alpha: 0.9, heat: 1, cool: 4, drag: 2, seed: random()
            });
        }
        f.flash = 1;
    }

    // Touchdown: a ring of dust kicked out from under the tail.
    function touchdownBurst(f, random, cubeSize) {
        surfaceFrameInto(cubeSize);
        const count = 22;
        for (let k = 0; k < count; k++) {
            const angle = (k + random() * 0.8) / count * Math.PI * 2;
            _v.copy(_t1).multiplyScalar(Math.cos(angle)).addScaledVector(_t2, Math.sin(angle));
            _p.copy(_tail).addScaledVector(_normal, 0.02).addScaledVector(_v, 0.05);
            _v.multiplyScalar(1.0 + random() * 0.9).addScaledVector(_normal, 0.1 + random() * 0.3);
            emitPuff(f.pool, _p.x, _p.y, _p.z, _v.x, _v.y, _v.z, {
                life: 0.8 + random() * 0.5, size0: 0.08, size1: 0.35 + random() * 0.2,
                alpha: 0.55, heat: 0, drag: 3.5, seed: random()
            });
        }
        startRing(f, 0.9, 0.4, 0.8);
    }

    // The surface under the tail: its outward normal and two tangents.
    function surfaceFrameInto(cubeSize) {
        if (Number.isFinite(cubeSize)) cubeShellDirInto(_normal, _tail, cubeSize);
        else _normal.copy(_up);
        _t1.copy(_dir).addScaledVector(_normal, -_dir.dot(_normal));
        if (_t1.lengthSq() < 1e-6) perpendicularInto(_t1, _normal);
        _t1.normalize();
        _t2.crossVectors(_normal, _t1);
    }

    function startRing(f, radius, dur, peak) {
        const mesh = ringMesh.current;
        mesh.position.copy(_tail).addScaledVector(_normal, 0.025 - WORM_LIFT);
        mesh.quaternion.setFromUnitVectors(_zAxis, _normal);
        Object.assign(f.ring, { t: 0, dur, radius, peak });
    }

    const { geometries: g, materials: m } = res;
    return <>
        <group ref={booster} visible={false}>
            <mesh geometry={g.casing} material={m.white} />
            <mesh geometry={g.band} material={m.red} />
            {Array.from({ length: FIN_COUNT }, (_, k) => (
                <mesh key={k} geometry={g.fin} material={m.red} rotation={[0, Math.PI / 4 + k * Math.PI / 2, 0]} />
            ))}
            <mesh geometry={g.bell} material={m.metal} />
            <mesh geometry={g.throat} material={m.glow} />
            <group ref={plume} position={[0, NOZZLE_EXIT_Y - 0.01, 0]} visible={false}>
                <mesh geometry={g.plume} material={m.outer} renderOrder={3} />
                <mesh geometry={g.plume} material={m.core} renderOrder={4} scale={[0.5, 0.45, 0.5]} />
            </group>
        </group>
        <points ref={points} geometry={g.puffs} material={m.smoke} frustumCulled={false} renderOrder={2} visible={false} />
        <mesh ref={ringMesh} geometry={g.ring} material={m.shock} renderOrder={1} visible={false} />
    </>;
}

// A random vector inside a cube of the given half-width (cheap spread).
function jitterInto(out, random, radius) {
    return out.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).multiplyScalar(radius);
}

// Any unit vector perpendicular to `v`.
function perpendicularInto(out, v) {
    return out.set(0, 1, 0).cross(v).lengthSq() > 1e-6 ? out.normalize() : out.set(1, 0, 0).cross(v).normalize();
}
