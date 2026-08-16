// src/worm/healerWorm/WormBody.jsx
// Extracted from HealerWormMode.jsx (2026-07 monolith split) — code unchanged.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import {
    isTileInSlice,
    makeTunnelCenterline,
    buildTunnelCenterlineInto,
    tunnelTToArc,
    getTunnelArcPosSmoothInto,
    getWindWorldPosInto,
} from '../wormLogic.js';
import { liveRotation } from '../liveRotation.js';
import { shAt } from '../circularBuffers.js';
import { beginWormSegments, pushWormSegment, endWormSegments } from '../wormSegments.js';
import { getWormHaloGeometry, getWormHaloMaterial } from '../wormGlowHalo.js';

// Halos are drawn every other segment and capped. Each is a camera-facing quad
// several bead-radii across, so they overlap heavily and their real cost is fill
// rate, not instance count — a mega-worm does not need three hundred of them to
// read as glowing, and uncapped they would shade the screen many times over.
const HALO_STRIDE = 2;
const HALO_MAX = 48;
const _haloDummy = new THREE.Object3D();
import { getSkin } from '../wormCosmeticsData.js';
import { getWormCharacter } from '../wormCharacterData.js';
import { getSkinFX } from '../wormSkinFX.js';
import { createWormSkinMaterial, applySkinMaterialProfile, updateWormSkinMaterialTime, applyBioluminescence } from '../wormSkinMaterial.js';
import WormSkinParticles from '../WormSkinParticles.jsx';
import {
    PAGE_GEO_ARGS, PAGE_HINGE_X, PAGE_HINGE_Y, PAGE_LAYER_COUNT, PAGE_LAYER_GAP, PAGE_COLORS,
    BOOK_HEAD_RADIUS, BOOK_HEAD_LIFT, SPINE_X_SCALE, TURN_SIGNAL_GAIN,
    turnSignalFromDirections, smoothTurn, pageHingeAngles,
} from '../wormBookFX.js';
import {
    WORM_LIFT,
    ORB_SEGMENT_GROWTH,
    STEPS_PER_TILE,
    BODY_BALL_SPACING,
    BASE_TAIL_LENGTH,
    MAX_TAIL,
    WINDOUT_SEGMENT_DT,
    windoutHeadS,
    rocketFlightLift,
} from './constants.js';

// ─── Worm Body (head = smooth lerp; body = per-step tile history) ─────────────
const _wormDummy = new THREE.Object3D();
// Pre-allocated scratch objects — avoids per-frame GC pressure from WormBody loop
const _bodyColor = new THREE.Color();
const _fireTail = new THREE.Vector3();
const _fireInner = new THREE.Vector3();
const _fireDirection = new THREE.Vector3();
const _fireUp = new THREE.Vector3(0, 1, 0);

/** Flame fixed to the final visible orb while rocket overdrive is active. */
export function RocketTailFire({ worm }) {
    const groupRef = useRef();
    useFrame((state) => {
        const group = groupRef.current;
        if (!group) return;
        const active = worm.rocketActive.current && worm.phase.current === 'crawling';
        group.visible = active;
        if (!active) return;

        const history = worm.stepHistory.current;
        if (history.count < 2) {
            group.visible = false;
            return;
        }
        const tailSteps = Math.min(history.count - 1, Math.max(0, Math.round(worm.tailLength.current * BODY_BALL_SPACING * STEPS_PER_TILE)));
        const tail = shAt(history, tailSteps);
        const inner = shAt(history, Math.max(0, tailSteps - 4));
        if (!tail || !inner) return;
        _fireTail.copy(tail.pos);
        _fireInner.copy(inner.pos);
        // Lift with the flying body so the flame stays glued to the risen tail.
        const flightLift = rocketFlightLift(true, worm.rocketT.current);
        if (flightLift) {
            _fireTail.addScaledVector(tail.normal, flightLift);
            _fireInner.addScaledVector(inner.normal, flightLift);
        }
        _fireDirection.subVectors(_fireTail, _fireInner).normalize();
        group.position.copy(_fireTail).addScaledVector(_fireDirection, 0.12);
        group.quaternion.setFromUnitVectors(_fireUp, _fireDirection);
        const pulse = 0.9 + Math.sin(state.clock.elapsedTime * 24) * 0.16;
        group.scale.set(pulse, pulse * 1.25, pulse);
    });

    return (
        <group ref={groupRef} visible={false}>
            <mesh position={[0, 0.16, 0]}>
                <coneGeometry args={[0.18, 0.52, 12]} />
                <meshBasicMaterial color="#ff5a16" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.11, 0]}>
                <coneGeometry args={[0.1, 0.34, 10]} />
                <meshBasicMaterial color="#ffe96a" blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
            <pointLight color="#ff7b24" intensity={1.8} distance={2.2} decay={2} />
        </group>
    );
}
// Book Worm page-flip scratch — see the isBook block in the segment loop below.
const _pageDummy = new THREE.Object3D();
const _bookPageColor = new THREE.Color();
const _bookHeadDir = new THREE.Vector3();
const _bookZ = new THREE.Vector3();
const _bookX = new THREE.Vector3();
const _bookY = new THREE.Vector3();
const _bookBasisMat = new THREE.Matrix4();
const _bookQuat = new THREE.Quaternion();
const _bookHingeQuat = new THREE.Quaternion();
const _bookPageQuat = new THREE.Quaternion();
const _bookPageOffset = new THREE.Vector3();
const _bookZAxisUnit = new THREE.Vector3(0, 0, 1);
const _bookHeadDummy = new THREE.Object3D();
const _bodyHeadPos = new THREE.Vector3();
const _bodyNormal = new THREE.Vector3();
const _bodyClonePos = new THREE.Vector3();
const _bodyCloneNormal = new THREE.Vector3();
const _bodySegForward = new THREE.Vector3();
const _bodySideVec = new THREE.Vector3();
// Scratch used to ride mid-rotation body points without mutating the history ring.
const _bodyRideAxis = new THREE.Vector3();
const _bodyEffA = new THREE.Vector3();
const _bodyEffB = new THREE.Vector3();
// Camera-proximity cull while riding a wormhole: fully hidden inside CAM_CULL_HIDE
// of the lens, back to full size by CAM_CULL_FULL. See the cull block in the
// segment loop for why the camera ends up inside its own worm at all.
const CAM_CULL_HIDE = 0.30;
const CAM_CULL_FULL = 0.52;
const _camWorldPos = new THREE.Vector3();
// Suck-in shaping: how much a segment necks down at the entry aperture, and over how
// much arc-length inside the mouth it recovers. Deliberately shorter than the throat
// (utils/tunnelPath) so the whole squeeze happens while the hole is still on screen.
const MOUTH_SQUEEZE = 0.42;
const MOUTH_SQUEEZE_ARC = 0.3;
// Scratch for the suck-in / spit-out tunnel funnel (body segments streamed along the ribbon).
// Centerline is sampled by world arc-length so segments stay evenly spaced (no stretched beads).
const _funnelCenterline = makeTunnelCenterline();
// Stable path-points buffer: reused every frame to avoid spread-array allocation.
// The head point carries a sentinel tile (tx<0) so the body ride never rotates it —
// the head's world position is already ridden upstream in the main worm useFrame.
const _pathPointsBuffer = [];
const _headPathPoint = { pos: _bodyHeadPos, normal: _bodyNormal, tx: -1, ty: -1, tz: -1 };

export function WormBody({ worm, size }) {
    const meshRef = useRef();       // sphere body (classic / inch / glow)
    const boxMeshRef = useRef();    // box body (book worm only)
    const leftPageRef = useRef();   // book worm only — left page-stack overlay
    const rightPageRef = useRef();  // book worm only — right page-stack overlay
    const bookHeadRef = useRef();   // book worm only — the round head orb
    const particlesGroupRef = useRef(); // ambient skin FX (embers/bubbles/sparkle/...), anchored to the head
    // Book Worm: turn force inferred from how fast the head's direction of
    // travel is swinging frame to frame (no continuous turn signal exists in
    // Healer mode's tile-based movement, so we derive one from position deltas).
    const prevHeadPosRef = useRef(new THREE.Vector3());
    const prevHeadDirRef = useRef(new THREE.Vector3());
    const bookInitedRef = useRef(false);
    const bookTurnRef = useRef(0);
    const transitScaleRef = useRef(1); // dissolve: 1 on surface, 0 inside tunnel
    const wormSkinId = useGameStore(s => s.wormSkin ?? 'slime');
    const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
    const wormCharacter = getWormCharacter(wormCharacterId);
    const isInch = wormCharacter.id === 'inch';
    const isGlow = wormCharacter.id === 'glow';
    const isBook = wormCharacter.id === 'book';
    const isWiggle = wormCharacter.id === 'wiggle';
    const isPrism = wormCharacter.id === 'prism';
    const skin = getSkin(wormSkinId);
    const wormColor = skin.body;
    const bellyColor = skin.belly;
    // Skin-themed material (metalness/roughness/clearcoat/transmission/iridescence/
    // flatShading + body-surface displacement) — one material shared by every
    // instance of the sphere body, since only one skin is ever equipped at once.
    const haloRef = useRef();       // soft additive glow billboards (glow worm only)
    const skinMaterial = useMemo(() => createWormSkinMaterial(), []);
    useEffect(() => {
        applySkinMaterialProfile(skinMaterial, getSkinFX(wormSkinId), 0);
        // After the profile, which resets emissiveIntensity from the skin.
        applyBioluminescence(skinMaterial, skin.glow, isGlow);
    }, [skinMaterial, wormSkinId, skin.glow, isGlow]);
    useEffect(() => () => skinMaterial.dispose(), [skinMaterial]);
    // Refs so useFrame always reads latest values without closure staleness
    const wormColorRef = useRef(wormColor);
    wormColorRef.current = wormColor;
    const glowColorRef = useRef(skin.glow);
    glowColorRef.current = skin.glow;
    const bellyColorRef = useRef(bellyColor);
    bellyColorRef.current = bellyColor;
    const isInchRef = useRef(isInch);
    isInchRef.current = isInch;
    const isGlowRef = useRef(isGlow);
    isGlowRef.current = isGlow;
    const isBookRef = useRef(isBook);
    isBookRef.current = isBook;
    const isWiggleRef = useRef(isWiggle);
    isWiggleRef.current = isWiggle;
    const isPrismRef = useRef(isPrism);
    isPrismRef.current = isPrism;
    // Inch Worm accordion gait state — advances with real crawl distance (not wall-clock),
    // so the body bunches/extends in lockstep with movement and relaxes when the worm stops.
    const gaitPhaseRef = useRef(0);
    const prevInterpTRef = useRef(0);
    const gaitMoveRef = useRef(0);
    // Tracks the inputs that affect per-segment color so the instanced color buffer
    // is only rewritten on frames where something actually changed (orb pickup,
    // skin/character swap, or tail length change) instead of every frame.
    const prevColorStateRef = useRef({ epoch: -1, visibleCount: -1, baseColor: null, bellyCol: null, isGlow: null, isInch: null });

    useFrame((state, delta) => {
        // Copy head/normal into scratch vectors (avoids .clone() allocation)
        _bodyHeadPos.copy(worm.headInterpPos.current);
        _bodyNormal.copy(worm.currentNormal.current);

        const currentJumpVal = worm.isJumping.current ? Math.sin(worm.jumpT.current * Math.PI) * 0.55 : 0;
        // Rocket flight: the whole worm cruises above the surface for the burn. Added to the
        // rendered head and every body segment below (not to the path-walk anchor), so the
        // worm rises level and flies rather than rearing up from a lifted head.
        const flightLift = rocketFlightLift(worm.rocketActive.current, worm.rocketT.current);
        // During transit (entering/tunnel/exiting) and the windout spiral the body segments ride
        // the ribbon/spiral centerline exactly — no face-normal lift, or the head floats off.
        // windout uses getWindWorldPosInto which supplies its own lift, so WORM_LIFT must not
        // be added again here (face is already placed at headInterpPos + 0.09, consistent).
        const _bodyTransit = worm.phase.current === 'entering' || worm.phase.current === 'tunnel' || worm.phase.current === 'exiting' || worm.phase.current === 'windout';
        _bodyHeadPos.addScaledVector(_bodyNormal, _bodyTransit ? 0 : WORM_LIFT + currentJumpVal);
        // Only the in-tunnel shots put the lens on the body's own line — the surface
        // chase camera sits well above and behind it, so nothing there needs culling
        // and gating on the phase keeps segments from blinking out during a jump.
        const _transitCull = _bodyTransit || worm.phase.current === 'windup';
        if (_transitCull) _camWorldPos.copy(state.camera.position);

        const _isInch = isInchRef.current;
        const _isGlow = isGlowRef.current;
        const _isBook = isBookRef.current;
        const _isWiggle = isWiggleRef.current;
        const _isPrism = isPrismRef.current;
        const mesh = _isBook ? boxMeshRef.current : meshRef.current;
        if (!mesh) return;

        // Book Worm: infer turn force from how fast the head's direction of
        // travel swings frame to frame, then swing both page flaps together —
        // reading as pages flung toward the outside of the turn by inertia.
        if (_isBook) {
            if (bookInitedRef.current) {
                _bookHeadDir.subVectors(_bodyHeadPos, prevHeadPosRef.current);
                if (_bookHeadDir.lengthSq() > 1e-10) {
                    _bookHeadDir.normalize();
                    if (prevHeadDirRef.current.lengthSq() > 0) {
                        const rawTurn = turnSignalFromDirections(prevHeadDirRef.current, _bookHeadDir, _bodyNormal) * TURN_SIGNAL_GAIN;
                        bookTurnRef.current = smoothTurn(bookTurnRef.current, THREE.MathUtils.clamp(rawTurn, -1, 1), delta);
                    }
                    prevHeadDirRef.current.copy(_bookHeadDir);
                }
            } else {
                bookInitedRef.current = true;
            }
            prevHeadPosRef.current.copy(_bodyHeadPos);

            // Head: a round orb, the same shape every other worm wears. The
            // head used to be a flat standing cover panel with two paper leaves
            // and inked scribbles — a book seen edge-on, which at gameplay size
            // read as a rectangle with a face stuck on it rather than a head.
            // The body keeps its books; only the head is round now.
            const headMesh = bookHeadRef.current;
            if (headMesh) {
                _bookHeadDummy.position.copy(_bodyHeadPos)
                    .addScaledVector(_bodyNormal, BOOK_HEAD_LIFT);
                _bookHeadDummy.quaternion.identity();
                _bookHeadDummy.scale.setScalar(BOOK_HEAD_RADIUS);
                _bookHeadDummy.updateMatrix();
                headMesh.setMatrixAt(0, _bookHeadDummy.matrix);
                _bookPageColor.set(wormColorRef.current);
                headMesh.setColorAt(0, _bookPageColor);
                headMesh.count = 1;
                headMesh.instanceMatrix.needsUpdate = true;
                if (headMesh.instanceColor) headMesh.instanceColor.needsUpdate = true;
            }
        } else if (bookHeadRef.current) {
            bookHeadRef.current.count = 0;
        }

        const tLen = worm.tailLength.current;
        const steps = worm.stepHistory.current;
        const time = state.clock.getElapsedTime();
        updateWormSkinMaterialTime(skinMaterial, time);

        // Ambient skin FX (embers/bubbles/sparkle/...) hover just off the head,
        // and hide whenever the body itself is hidden (mid-tunnel dissolve, or
        // the worm not on the surface at all).
        if (particlesGroupRef.current) {
            const _particlesVisible = worm.phase.current === 'crawling' && transitScaleRef.current >= 0.015;
            particlesGroupRef.current.visible = _particlesVisible;
            if (_particlesVisible) {
                particlesGroupRef.current.position.copy(_bodyHeadPos).addScaledVector(_bodyNormal, 0.05);
            }
        }

        // ── Inch Worm accordion driver ─────────────────────────────────────────
        // interpT runs 0→1 within each tile step; its per-frame delta (with wrap) is the
        // distance actually crawled this frame. Accumulate it into a gait phase so the
        // compress→extend cycle stays synced to real movement, and ease a 0..1 "moving"
        // factor that drops to 0 when idle so the body smoothly spreads back out at rest.
        const _interpNow = worm.interpT.current;
        let _dCrawl = _interpNow - prevInterpTRef.current;
        if (_dCrawl < -0.5) _dCrawl += 1;                 // wrapped into the next tile
        if (_dCrawl < 0 || _dCrawl > 0.5) _dCrawl = 0;    // reset / teleport guard
        prevInterpTRef.current = _interpNow;
        const _moveTarget = (worm.phase.current === 'crawling' && _dCrawl > 1e-5) ? 1 : 0;
        gaitMoveRef.current += (_moveTarget - gaitMoveRef.current) * Math.min(1, delta * 6);
        gaitPhaseRef.current += _dCrawl;                  // accordion phase advances with crawl distance
        const _gaitMove = gaitMoveRef.current;
        const _gaitPhase = gaitPhaseRef.current;
        // Slow, symmetric accordion: one smooth squish→expand roughly every 2 tiles crawled
        // (rate 0.5). A raised-cosine pulse (no snap) eases the body together in the middle and
        // back out. Global — only ever one hump — and it rears taller the more orbs are carried.
        const _gaitCyc = ((_gaitPhase * 0.5) % 1 + 1) % 1;
        const _gaitPulse = (0.5 - 0.5 * Math.cos(_gaitCyc * Math.PI * 2)) * _gaitMove;
        const _orbCount = worm.orbPickupColorsRef.current?.length ?? 0;
        const _humpHeight = 0.15 + Math.min(_orbCount, 14) * 0.028; // 0.15 → ~0.54 as orbs stack up

        // Rebuild path-points buffer in-place (no array allocation or spread).
        // Only fill as many step-history points as the visible body can actually walk back
        // to. The tail reaches ~visibleCount × spacing world units behind the head, and the
        // ring stores STEPS_PER_TILE points per ~1-unit tile, so the curve-walk below never
        // needs more than that many points. The ring's `count` saturates to its full capacity
        // (MAX_TAIL × STEPS_PER_TILE = 60 000) over a long run regardless of how short the worm
        // actually is, so capping here keeps this per-frame copy proportional to body length
        // instead of paying for 60 000 ref writes every frame for a 4-segment worm.
        const _bodyReach = Math.min(MAX_TAIL, tLen) * (_isInch ? 0.095 : BODY_BALL_SPACING);
        // ×2 headroom covers corner arcs (which lengthen the path) + 2 spare tiles of margin,
        // so the walk's last segment finds its bracket rather than freezing at the buffer end.
        const _neededSteps = Math.ceil(_bodyReach * STEPS_PER_TILE * 2) + STEPS_PER_TILE * 2;
        const _fillCount = Math.min(steps.count, _neededSteps);
        _pathPointsBuffer.length = _fillCount + 1;
        _pathPointsBuffer[0] = _headPathPoint;
        for (let j = 0; j < _fillCount; j++) _pathPointsBuffer[j + 1] = shAt(steps, j);

        // Ride: while a slice is mid-rotation, body points sitting in that slice must turn
        // with the cube. We rotate their world position about the slice axis on the fly (into
        // scratch vectors, never mutating the ring) by the exact signed angle CubeAssembly
        // applies to the cubies — so the body stays glued to the surface through the tween and,
        // because commit bakes the same turn into history, there is no snap when it lands.
        const _ride = liveRotation.active;
        const _rAxis = liveRotation.axis;
        const _rSlice = liveRotation.sliceIndex;
        const _rAngle = liveRotation.angle;
        if (_ride) _bodyRideAxis.set(_rAxis === 'col' ? 1 : 0, _rAxis === 'row' ? 1 : 0, _rAxis === 'depth' ? 1 : 0);
        // Returns the effective (possibly ridden) world position for a path point, writing into
        // `out` only when a rotation is applied; otherwise returns the point's own vector.
        const effPos = (pt, out) => {
            if (_ride && pt.tx >= 0 && isTileInSlice(_rAxis, _rSlice, pt.tx, pt.ty, pt.tz)) {
                return out.copy(pt.pos).applyAxisAngle(_bodyRideAxis, _rAngle);
            }
            return pt.pos;
        };

        // Worm stays visible through the whole Möbius ride now (the tunnel camera rides inside on
        // the band, so the player watches the worm ride it). No dissolve.
        const _phase = worm.phase.current;
        const targetTS = 1.0;
        transitScaleRef.current += (targetTS - transitScaleRef.current) * Math.min(1, delta * 9);
        const transitScale = transitScaleRef.current;

        if (transitScale < 0.015) {
            // Body hidden (mid-tunnel): publish an empty feed so effects aiming at it
            // stop rather than firing at where it used to be.
            beginWormSegments();
            endWormSegments();
            mesh.count = 0;
            if (haloRef.current) haloRef.current.count = 0;
            if (leftPageRef.current) leftPageRef.current.count = 0;
            if (rightPageRef.current) rightPageRef.current.count = 0;
            if (bookHeadRef.current) bookHeadRef.current.count = 0;
            return;
        }

        // ── Suck-in / spit-out funnel ──────────────────────────────────────────
        // During entering/exiting the head already follows the Möbius ribbon (the main worm
        // useFrame writes headInterpPos along the tunnel). Stream the body behind it along the
        // same ribbon: each segment sits one spacing further back in tunnel-parameter space, so
        // as the head dives in the body gets vacuumed through the entry hole, and as the head
        // climbs out the body is spat from the exit hole. Segments that haven't reached the
        // mouth yet stay on the surface (entering) or are hidden until they emerge (exiting).
        const _funnelTunnel = worm.activeTunnel.current;
        const _funnelOn = (_phase === 'entering' || _phase === 'tunnel' || _phase === 'exiting') && !!_funnelTunnel;
        let _headTunArc = -1;
        if (_funnelOn) {
            const _tprog = worm.tunnelProgress.current;
            const _headTunT = _phase === 'entering' ? _tprog * 0.33
                            : _phase === 'tunnel'   ? 0.33 + _tprog * 0.34
                            :                         0.67 + _tprog * 0.33;
            // Build the centerline once per frame, then place each body segment by world
            // arc-length behind the head so they stay evenly spaced (matches surface spacing).
            buildTunnelCenterlineInto(_funnelCenterline, _funnelTunnel, size);
            _headTunArc = tunnelTToArc(_funnelCenterline, _headTunT);
        }

        // Wind-up: body coils behind the head along the spiral above the entry hole.
        const _windOn = _phase === 'windup' && !!_funnelTunnel;
        const _windSegDt = 0.07; // spacing between segments in spiral-s units
        const _windHeadS = _windOn ? Math.min(1, worm.tunnelProgress.current) : 0;

        // Wind-out: segments emerge from the exit one by one. The head continues
        // virtually past s=0 (getWindWorldPosInto clamps it on the surface) until
        // even the final segment reaches s=0 and has cleared the aperture.
        const _windOutOn = _phase === 'windout' && !!_funnelTunnel;
        const _windOutHeadS = _windOutOn
            ? windoutHeadS(worm.tunnelProgress.current, tLen)
            : 0;

        let walkIndex = 0;
        let cumulativeDist = 0;
        let writeIdx = 0; // compacted instance slot — advances only for segments actually drawn
        let haloIdx = 0;  // compacted slot into the glow-halo overlay
        let pageWriteIdx = 0; // book worm only — compacted slot into the page-flap overlays (body segments only, no head entry)

        const visibleCount = Math.min(MAX_TAIL, tLen);

        const orbColors = worm.orbPickupColorsRef.current;
        const baseColor = wormColorRef.current;
        const bellyCol = bellyColorRef.current;

        // Per-segment color only changes on orb pickup/deposit, skin/character swap, or
        // tail growth — not every frame. Skip the setColorAt pass + GPU upload otherwise.
        const colorEpoch = worm.colorEpochRef?.current ?? 0;
        const prevCS = prevColorStateRef.current;
        // Prism cycles its hue continuously, so its color buffer must be rewritten every
        // frame; all other characters only recolor when an input actually changes.
        const colorDirty = _isPrism || colorEpoch !== prevCS.epoch || visibleCount !== prevCS.visibleCount ||
            baseColor !== prevCS.baseColor || bellyCol !== prevCS.bellyCol || _isGlow !== prevCS.isGlow || _isInch !== prevCS.isInch;
        if (colorDirty) {
            prevCS.epoch = colorEpoch;
            prevCS.visibleCount = visibleCount;
            prevCS.baseColor = baseColor;
            prevCS.bellyCol = bellyCol;
            prevCS.isGlow = _isGlow;
            prevCS.isInch = _isInch;
        }

        beginWormSegments();
        for (let i = 0; i < visibleCount; i++) {
            // Distance LOD: segments far behind the head are visually indistinguishable at
            // gameplay camera distance, so thin them out — every segment near the head,
            // every 2nd beyond 200, every 4th beyond 600. Skipped segments never run the
            // curve-walk math below; the walk's cumulative distance naturally catches up to
            // the next rendered segment's (larger) target distance. Surviving segments keep
            // their normal scale so orb growth never changes body-ball size at an LOD boundary.
            const lodStep = i < 200 ? 1 : (i < 600 ? 2 : 4);
            if (i !== 0 && i % lodStep !== 0) continue;

            const fade = 1 - i / tLen;

            if (i === 0) {
                // Head — reset quaternion every frame: body segments (below) rotate this
                // same shared scratch object for book worm, and the head never re-orients.
                _wormDummy.quaternion.identity();
                _wormDummy.position.copy(_bodyHeadPos);
                if (flightLift) _wormDummy.position.addScaledVector(_bodyNormal, flightLift);
                // Book worm rides slightly higher off the surface — see the isBook
                // lift below (matches the body segments so the head doesn't float
                // at a different height than the rest of the book).
                if (_isBook) _wormDummy.position.addScaledVector(_bodyNormal, 0.092 * PAGE_HINGE_Y);
                _wormDummy.scale.setScalar(0.092);
                // Book Worm draws its head as the orb above, so the spine box
                // must not also be drawn here — two heads, one inside the other.
                if (_isBook) _wormDummy.scale.setScalar(0.00001);
            } else {
                // Inch Worm: a single hump locked to the middle of the body (sin profile over
                // the whole length → 0 at head & tail, peak at centre). It rears up and the
                // body scrunches on the gather pulse, then flattens to the full spread when the
                // pulse falls / the worm rests. One arch only, regardless of body length.
                const _inchArch = (_isInch && visibleCount > 1) ? Math.sin(Math.PI * (i / (visibleCount - 1))) : 0;
                const targetDist = _isInch ? (i * 0.095 * (1 - _gaitPulse * 0.28)) : i * 0.09;

                // Clones — parametrically walk backwards along the curve to exact target distance
                let foundPosition = false;

                while (walkIndex < _pathPointsBuffer.length - 1) {
                    const ptA = _pathPointsBuffer[walkIndex];
                    const ptB = _pathPointsBuffer[walkIndex + 1];
                    const aPos = effPos(ptA, _bodyEffA);
                    const bPos = effPos(ptB, _bodyEffB);
                    const distToNext = aPos.distanceTo(bPos);

                    if (cumulativeDist + distToNext >= targetDist) {
                        // Found the bracket on the curve! Interpolate exact point.
                        const t = distToNext > 0 ? (targetDist - cumulativeDist) / distToNext : 0;
                        // Use scratch vectors instead of .clone() to avoid GC pressure
                        _bodyClonePos.lerpVectors(aPos, bPos, t);
                        _bodyCloneNormal.lerpVectors(ptA.normal, ptB.normal, t).normalize();
                        // Keep the surface normal consistent with a ridden segment so the
                        // wiggle/orientation track the rotating face rather than the old one.
                        if (_ride && ptA.tx >= 0 && isTileInSlice(_rAxis, _rSlice, ptA.tx, ptA.ty, ptA.tz)) {
                            _bodyCloneNormal.applyAxisAngle(_bodyRideAxis, _rAngle).normalize();
                        }

                        // Calculate forward/side vector for the wiggle at this exact localized point
                        _bodySegForward.subVectors(aPos, bPos).normalize();
                        _bodySideVec.crossVectors(_bodyCloneNormal, _bodySegForward).normalize();

                        // Wiggle Worm is a sidewinder: a wide, smooth lateral wave that
                        // travels down the whole body like a snake. The wave must span many
                        // segments (small phase-step → long spatial wavelength); a large
                        // phase-step would alias the closely-spaced (0.09 apart) segments into
                        // a jagged scatter instead of a coherent S-curve.
                        const wiggleAmp = _isInch ? 0.0 : (_isWiggle ? 0.26 : 0.08) * Math.sin(fade * Math.PI);
                        const wigglePhase = i * (_isWiggle ? 0.5 : 0.8) - time * (_isWiggle ? 8.0 : 6.0);
                        _bodyClonePos.addScaledVector(_bodySideVec, Math.sin(wigglePhase) * wiggleAmp);
                        // Inch Worm: raise the body's middle up off the surface along the normal
                        // so it arches into a single inchworm hump on the squish — taller with orbs.
                        if (_isInch) _bodyClonePos.addScaledVector(_bodyCloneNormal, _inchArch * _gaitPulse * _humpHeight);
                        foundPosition = true;
                        break;
                    }
                    cumulativeDist += distToNext;
                    walkIndex++;
                }

                // If the track runs out (just spawned and moving), freeze at the last known point.
                if (!foundPosition && _pathPointsBuffer.length > 0) {
                    _bodyClonePos.copy(effPos(_pathPointsBuffer[_pathPointsBuffer.length - 1], _bodyEffA));
                }

                // Funnel override: pull segments that have crossed the mouth onto the ribbon.
                let _funnelHide = false;
                let _funnelPop = 1;
                if (_funnelOn) {
                    // Each segment sits a fixed world distance (0.09 — the surface spacing)
                    // further back along the centerline, so the body reads as a continuous
                    // worm through the tunnel instead of stretched, separated beads.
                    const _segArc = _headTunArc - i * 0.09;
                    if (_segArc >= 0) {
                        // In the tunnel — ride the ribbon one spacing behind the segment ahead.
                        getTunnelArcPosSmoothInto(_bodyClonePos, _funnelCenterline, _segArc);
                        if (_phase === 'exiting') {
                            // Squash-and-pop: each segment bulges as it bursts out of the exit
                            // mouth (arc ≈ total), then settles back to normal size as it travels out.
                            const _d = Math.abs(_segArc - _funnelCenterline.total);
                            _funnelPop = 1 + 0.6 * Math.max(0, 1 - _d / 0.18);
                        } else {
                            // …and the mirror of it on the way in: a segment necks down as the
                            // hole swallows it, so the body visibly *drains* through the
                            // aperture instead of simply ceasing to be on the surface. Ends
                            // (and is back to full size) within the throat, where the mouth
                            // still frames it.
                            _funnelPop = 1 - MOUTH_SQUEEZE * Math.max(0, 1 - _segArc / MOUTH_SQUEEZE_ARC);
                        }
                    } else if (_phase === 'exiting') {
                        // Tail hasn't emerged from the exit hole yet — keep it hidden rather than
                        // show it on the now-stale entry-side surface trail.
                        _funnelHide = true;
                    }
                    // entering & _segArc < 0: leave it on the surface, trailing toward the hole.
                } else if (_windOn) {
                    // Coil the body behind the head along the entry spiral; segments trail
                    // OUTWARD (smaller s). _segS < 0 → still on the surface trail (keep normal).
                    const _segS = _windHeadS - i * _windSegDt;
                    if (_segS >= 0 && _segS <= 1) {
                        getWindWorldPosInto(_bodyClonePos, _funnelTunnel, 'entry', _segS, size);
                    }
                } else if (_windOutOn) {
                    // Exit spiral: segments emerge from hole one by one as the head rises.
                    // _segS > 1 means not yet surfaced — hide until they pop out.
                    const _segS = _windOutHeadS + i * WINDOUT_SEGMENT_DT;
                    if (_segS <= 1.0) {
                        getWindWorldPosInto(_bodyClonePos, _funnelTunnel, 'exit', _segS, size);
                    } else {
                        _funnelHide = true;
                    }
                }

                if (_isBook) {
                    // Book worm rides on top of the surface, lifted by its own
                    // height, instead of centered/embedded at the usual crawl
                    // height — a real book resting on the ground, not floating
                    // through it. Mutates _bodyClonePos itself (not just this
                    // segment's dummy) so the page instances below, which read
                    // _bodyClonePos directly, inherit the same lift.
                    _bodyClonePos.addScaledVector(_bodyCloneNormal, 0.088 * PAGE_HINGE_Y);
                }
                // Rocket flight lifts every surface segment by the same amount as the head,
                // so the body flies level. Skipped in transit (tunnel/wind own their path).
                if (flightLift && !_bodyTransit) _bodyClonePos.addScaledVector(_bodyCloneNormal, flightLift);
                _wormDummy.position.copy(_bodyClonePos);
                if (_isBook) {
                    // Orient the cover to face the direction of travel, using the same
                    // lookAt convention CrawlerCharacter.jsx uses (local -Z = forward),
                    // so the page-flap hinge math below (wormBookFX.js) matches exactly.
                    _bookZ.copy(_bodySegForward).negate();
                    if (_bookZ.lengthSq() < 1e-8) _bookZ.set(0, 0, 1);
                    _bookZ.normalize();
                    _bookX.crossVectors(_bodyCloneNormal, _bookZ);
                    if (_bookX.lengthSq() < 1e-8) { _bookZ.x += 1e-4; _bookZ.normalize(); _bookX.crossVectors(_bodyCloneNormal, _bookZ); }
                    _bookX.normalize();
                    _bookY.crossVectors(_bookZ, _bookX);
                    _bookBasisMat.makeBasis(_bookX, _bookY, _bookZ);
                    _bookQuat.setFromRotationMatrix(_bookBasisMat);
                    _wormDummy.quaternion.copy(_bookQuat);
                }
                if (_isInch) {
                    // Segments fatten at the hump's peak, thin elsewhere — only while moving.
                    const sc = 0.082 + _inchArch * _gaitPulse * 0.03; // 0.082 (rest/extended) → fatter at the hump
                    _wormDummy.scale.setScalar(sc);
                } else if (_isBook) {
                    _wormDummy.scale.set(0.088, 0.055, 0.1);
                } else if (_isGlow) {
                    // Slightly varied glow segment sizes
                    const glowSc = 0.088 + Math.sin(time * 3.5 + i * 1.6) * 0.01;
                    _wormDummy.scale.setScalar(glowSc);
                } else {
                    _wormDummy.scale.setScalar(0.09);
                }
                if (_funnelHide) _wormDummy.scale.setScalar(0.00001); // tail not yet spat out
                else if (_funnelPop !== 1) _wormDummy.scale.multiplyScalar(_funnelPop); // burst-out pop
            }

            if (transitScale < 1) _wormDummy.scale.multiplyScalar(transitScale);
            // LOD removes distant instances to control cost, but must never make
            // the survivors larger: that produced an abrupt size jump at segment
            // 200/600 and made collected-orb growth look non-uniform.
            // Camera-proximity cull, transit only.
            //
            // Inside a wormhole the camera trails the head along the very centerline
            // the body is strung down, and at the entry mouth it has to be ON that
            // line — that is what threading the hole means. So segments necessarily
            // pass through the lens, and a 0.09 ball a hand's width from the near
            // plane is a wall of colour across the frame: the shot reads as being
            // inside the worm rather than behind it. Shrink whatever comes that
            // close to nothing, over a band wide enough that it is a fade rather
            // than a pop.
            // The head is exempt: it is the subject of the shot, and the camera's
            // own trailing distance keeps it clear of the lens anyway.
            if (_transitCull && i !== 0) {
                const _camD = _bodyClonePos.distanceTo(_camWorldPos);
                if (_camD < CAM_CULL_HIDE) continue;
                if (_camD < CAM_CULL_FULL) {
                    _wormDummy.scale.multiplyScalar((_camD - CAM_CULL_HIDE) / (CAM_CULL_FULL - CAM_CULL_HIDE));
                }
            }
            _wormDummy.updateMatrix();
            mesh.setMatrixAt(writeIdx, _wormDummy.matrix);
            // Publish where this segment actually ended up, for effects that need to
            // aim at the body (the lightning theme's strikes). Recorded here rather
            // than recomputed elsewhere because this position has already been
            // through the curve walk, the live-slice ride and the LOD thinning —
            // anything re-deriving it would drift from what the player sees.
            pushWormSegment(_wormDummy.position.x, _wormDummy.position.y, _wormDummy.position.z);

            // Glow worm: a soft camera-facing halo at this segment. The material's
            // own uScale widens it, so the instance carries the segment's scale
            // unchanged and one constant governs halo size in both renderers.
            if (_isGlow && writeIdx % HALO_STRIDE === 0 && haloIdx < HALO_MAX) {
                const haloMesh = haloRef.current;
                if (haloMesh) {
                    _haloDummy.position.copy(_wormDummy.position);
                    _haloDummy.scale.setScalar(_wormDummy.scale.x);
                    _haloDummy.updateMatrix();
                    haloMesh.setMatrixAt(haloIdx++, _haloDummy.matrix);
                }
            }

            // Color per segment — only recomputed when colorDirty (see above)
            if (colorDirty) {
                const orbPickupIndex = Math.floor((i - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH);
                const hasOrbColor = orbPickupIndex >= 0 && orbPickupIndex < orbColors.length;
                if (_isPrism) {
                    // Spectrum: a rainbow that flows down the body and scrolls over time.
                    _bodyColor.setHSL(((i * 0.022) + time * 0.12) % 1, 0.85, 0.6);
                } else if (i === 0 && _isGlow) {
                    // Glow head — use base worm color; GlowWormAura point light IS the
                    // bioluminescence. There was also an additive sphere at 1.4x the
                    // bead on every other segment; a halo wider than its bead cannot
                    // hide behind it, so the parts occluded by neighbouring beads were
                    // depth-rejected and the surviving crescents squeezed out of every
                    // joint as spikes growing off the body. Removed — the light carries
                    // the character on its own, and the overlay was a whole instanced
                    // mesh of up to MAX_TAIL instances per frame.
                    _bodyColor.set(baseColor);
                } else if (hasOrbColor) {
                    // Each orb grows a trio of segments (ORB_SEGMENT_GROWTH): 2 in the worm's
                    // own colour + 1 accent in the picked-up orb's colour — e.g. an emerald
                    // worm that eats a yellow orb grows 2 emerald + 1 yellow. The accent sits
                    // on the middle segment of the trio so each orb reads as one clean band
                    // separated from its neighbours by the worm's base colour.
                    const trioOffset = (i - BASE_TAIL_LENGTH) % ORB_SEGMENT_GROWTH;
                    _bodyColor.set(trioOffset === 1 ? orbColors[orbPickupIndex] : baseColor);
                } else if (_isInch) {
                    // Alternating body/belly bands for visible ring pattern. Uses writeIdx
                    // (not i) so bands keep alternating once LOD thinning makes consecutive
                    // drawn segments an even number of real segments apart.
                    _bodyColor.set(writeIdx % 2 === 0 ? baseColor : bellyCol);
                } else {
                    _bodyColor.set(baseColor);
                }
                mesh.setColorAt(writeIdx, _bodyColor);
            }

            // Book Worm: a stack of thin page layers hinged along the cover's
            // spine, propped open at rest and flung toward the outside of a
            // turn (bookTurnRef, computed above from the head's frame-to-
            // frame direction swing) — the whole stack banks together, layer
            // count giving the body its visible "many pages" height.
            if (_isBook && i !== 0) {
                const pageScale = _wormDummy.scale.x; // matches the cover's current (post transit/LOD) scale
                const { left, right } = pageHingeAngles(bookTurnRef.current);

                _bookHingeQuat.setFromAxisAngle(_bookZAxisUnit, left);
                _bookPageQuat.copy(_bookQuat).multiply(_bookHingeQuat);
                _bookPageOffset.set(PAGE_GEO_ARGS[0] * 0.5, 0, 0).applyQuaternion(_bookPageQuat);
                for (let layer = 0; layer < PAGE_LAYER_COUNT; layer++) {
                    _pageDummy.position.copy(_bodyClonePos)
                        .addScaledVector(_bookX, PAGE_HINGE_X * pageScale)
                        .addScaledVector(_bookY, pageScale * (PAGE_HINGE_Y + layer * PAGE_LAYER_GAP))
                        .addScaledVector(_bookPageOffset, pageScale);
                    _pageDummy.quaternion.copy(_bookPageQuat);
                    if (layer === PAGE_LAYER_COUNT - 1) {
                        const flutter = time * 3.1 + i * 1.37;
                        _pageDummy.position.addScaledVector(_bookY, pageScale * (0.12 + (Math.sin(flutter) * 0.5 + 0.5) * 0.24));
                        _pageDummy.rotateX(Math.sin(flutter * 0.7) * 0.42);
                        _pageDummy.rotateY(Math.cos(flutter) * 0.32);
                    }
                    _pageDummy.scale.setScalar(pageScale);
                    _pageDummy.updateMatrix();
                    if (leftPageRef.current) leftPageRef.current.setMatrixAt(pageWriteIdx + layer, _pageDummy.matrix);
                }

                _bookHingeQuat.setFromAxisAngle(_bookZAxisUnit, right);
                _bookPageQuat.copy(_bookQuat).multiply(_bookHingeQuat);
                _bookPageOffset.set(-PAGE_GEO_ARGS[0] * 0.5, 0, 0).applyQuaternion(_bookPageQuat);
                for (let layer = 0; layer < PAGE_LAYER_COUNT; layer++) {
                    _pageDummy.position.copy(_bodyClonePos)
                        .addScaledVector(_bookX, -PAGE_HINGE_X * pageScale)
                        .addScaledVector(_bookY, pageScale * (PAGE_HINGE_Y + layer * PAGE_LAYER_GAP))
                        .addScaledVector(_bookPageOffset, pageScale);
                    _pageDummy.quaternion.copy(_bookPageQuat);
                    if (layer === PAGE_LAYER_COUNT - 1) {
                        const flutter = time * 3.1 + i * 1.37;
                        _pageDummy.position.addScaledVector(_bookY, pageScale * (0.1 + (Math.cos(flutter) * 0.5 + 0.5) * 0.22));
                        _pageDummy.rotateX(-Math.sin(flutter * 0.8) * 0.38);
                        _pageDummy.rotateY(-Math.cos(flutter * 0.9) * 0.3);
                    }
                    _pageDummy.scale.setScalar(pageScale);
                    _pageDummy.updateMatrix();
                    if (rightPageRef.current) rightPageRef.current.setMatrixAt(pageWriteIdx + layer, _pageDummy.matrix);
                }

                if (colorDirty) {
                    for (let layer = 0; layer < PAGE_LAYER_COUNT; layer++) {
                        _bookPageColor.set(PAGE_COLORS[layer % PAGE_COLORS.length]);
                        if (leftPageRef.current) leftPageRef.current.setColorAt(pageWriteIdx + layer, _bookPageColor);
                        if (rightPageRef.current) rightPageRef.current.setColorAt(pageWriteIdx + layer, _bookPageColor);
                    }
                }
                pageWriteIdx += PAGE_LAYER_COUNT;
            }
            writeIdx++;
        }

        mesh.count = writeIdx;
        mesh.instanceMatrix.needsUpdate = true;
        endWormSegments();

        const haloMesh = haloRef.current;
        if (haloMesh) {
            haloMesh.count = _isGlow ? haloIdx : 0;
            if (haloIdx > 0) {
                haloMesh.instanceMatrix.needsUpdate = true;
                haloMesh.material.uniforms.uColor.value.set(glowColorRef.current);
            }
        }
        if (mesh.instanceColor && colorDirty) mesh.instanceColor.needsUpdate = true;

        // Update book worm page-flap overlay counts (meshes are only mounted when isBook)
        if (_isBook) {
            const lp = leftPageRef.current;
            const rp = rightPageRef.current;
            if (lp) { lp.count = pageWriteIdx; lp.instanceMatrix.needsUpdate = true; if (lp.instanceColor && colorDirty) lp.instanceColor.needsUpdate = true; }
            if (rp) { rp.count = pageWriteIdx; rp.instanceMatrix.needsUpdate = true; if (rp.instanceColor && colorDirty) rp.instanceColor.needsUpdate = true; }
        }
    });

    return isBook ? (
        /* Book body — Book Worm only. Conditionally mounted so the sphere instancedMesh
           (MAX_TAIL=1200 instances) is not allocated in GPU memory when unused.
           The cover is the existing flattened box; the page-stack overlays
           (PAGE_LAYER_COUNT thin layers per side) ride on top of it, hinged
           along its spine (see the isBook block in the useFrame loop above
           and wormBookFX.js for the hinge math). The head gets a standing
           open-book face with inked paper leaves instead of a page stack. */
        <>
            <instancedMesh ref={boxMeshRef} args={[undefined, undefined, MAX_TAIL]} frustumCulled={false}>
                {/* Thin spine/binding — the pages (below) are the visible body now, not a
                    flat square slab the pages ride on top of. */}
                <boxGeometry args={[SPINE_X_SCALE, 0.68, 1.12]} />
                <meshStandardMaterial
                    color="white"
                    emissive="white"
                    emissiveIntensity={0.18}
                    roughness={0.58}
                    metalness={0.2}
                />
            </instancedMesh>
            <instancedMesh ref={leftPageRef} args={[undefined, undefined, MAX_TAIL * PAGE_LAYER_COUNT]} frustumCulled={false}>
                <boxGeometry args={PAGE_GEO_ARGS} />
                <meshStandardMaterial color="white" roughness={0.8} metalness={0} side={THREE.DoubleSide} />
            </instancedMesh>
            <instancedMesh ref={rightPageRef} args={[undefined, undefined, MAX_TAIL * PAGE_LAYER_COUNT]} frustumCulled={false}>
                <boxGeometry args={PAGE_GEO_ARGS} />
                <meshStandardMaterial color="white" roughness={0.8} metalness={0} side={THREE.DoubleSide} />
            </instancedMesh>
            {/* Round head orb — the same sphere the other worms wear, so the
                Book Worm reads as a worm carrying books rather than as a
                rectangle. Shares the skin material, so skins and their FX
                (metalness, transmission, iridescence…) apply here exactly as
                they do on the sphere-bodied characters. Material colour must
                stay white for setColorAt to pass through untinted. */}
            <instancedMesh ref={bookHeadRef} args={[undefined, undefined, 1]} frustumCulled={false}>
                <sphereGeometry args={[1, 16, 16]} />
                <primitive object={skinMaterial} attach="material" />
            </instancedMesh>
            <group ref={particlesGroupRef}>
                <WormSkinParticles skinId={wormSkinId} glowColor={skin.glow} />
            </group>
        </>
    ) : (
        /* Sphere body — Classic, Inch Worm, Glow Worm.
           IMPORTANT: material color must be white so per-instance colors (setColorAt)
           pass through unmodified. Three.js multiplies instanceColor × material.color,
           so any non-white material color taints every orb pickup color. */
        <>
            <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_TAIL]} frustumCulled={false}>
                <sphereGeometry args={[1, 16, 16]} />
                {/* Wet-slime clearcoat is just the "slime" skin's starting point now —
                    the skin's own FX profile (metalness/roughness/clearcoat/transmission/
                    iridescence/flatShading + body-surface displacement) drives this
                    material instead. color MUST stay white so the per-instance orb
                    colours (setColorAt) pass through untinted. */}
                <primitive object={skinMaterial} attach="material" />
            </instancedMesh>
            {isGlow && (
                <instancedMesh
                    ref={haloRef}
                    args={[getWormHaloGeometry(), getWormHaloMaterial(), HALO_MAX]}
                    frustumCulled={false}
                    raycast={() => null}
                    renderOrder={-1}
                />
            )}
            <group ref={particlesGroupRef}>
                <WormSkinParticles skinId={wormSkinId} glowColor={skin.glow} />
            </group>
        </>
    );
}

// ─── Glow Worm Aura ───────────────────────────────────────────────────────────
// Pulsing point light that follows the Glow Worm's head.
export function GlowWormAura({ worm }) {
    const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
    const wormSkinId = useGameStore(s => s.wormSkin ?? 'slime');
    const isGlow = wormCharacterId === 'glow';
    const glowColor = getSkin(wormSkinId).glow;
    const lightRef = useRef();

    useFrame(({ clock }) => {
        if (!isGlow) return;
        const t = clock.elapsedTime;

        // Soft pulsing light — illuminates the worm face only.
        // Kept below the 0.82 bloom threshold so nearby cube tiles don't bloom.
        if (lightRef.current) {
            lightRef.current.position.copy(worm.headInterpPos.current)
                .addScaledVector(worm.currentNormal.current, WORM_LIFT + 0.1 + rocketFlightLift(worm.rocketActive.current, worm.rocketT.current));
            // Zero out only while inside the Möbius ribbon — worm is visible during entering/exiting
            const inTunnel = worm.phase.current === 'tunnel';
            lightRef.current.intensity = inTunnel ? 0 : 1.2 + Math.sin(t * 4.0) * 0.4;
        }
    });

    if (!isGlow) return null;

    return <pointLight ref={lightRef} color={glowColor} intensity={2.0} distance={5.5} decay={2} />;
}
