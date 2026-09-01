// src/holonomy/useHolonomyMode.js
// Game loop for Holonomy Mode — ported from Python Tracer class.
// Tracer moves with lissajous-style (u,v) motion; seam crossings apply
// the O(2) seam matrix to transport vector + accumulate holonomy.

import { useState, useRef, useCallback } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { progressManager } from '../levels/ProgressManager.js';
import { awardMilestone, HOLONOMY_LOOP_KEY, HOLONOMY_MOBIUS_KEY } from '../levels/rewards.js';
import { useFrame } from '@react-three/fiber';
import {
    mat2Identity, mat2Mul, mat2Clone, applyMat2,
    getSeamMatrix, getHolonomyAngle, getOrientationParity,
    getEdgeCrossed, clampAfterCross, NEIGH, twistSchedule,
} from './holonomyMath.js';

// Motion parameters matching Python Config
const VX_AMP = 0.013;
const VY_AMP = 0.013;
const W1 = 0.02;
const W2 = 1.37;
const HALF = 0.5;

const makeInitialState = () => ({
    face: 'PZ',
    u: -0.2,
    v: -0.2,
});

const normalize2 = (v) => {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1]) || 1;
    return [v[0] / len, v[1] / len];
};

export function useHolonomyMode() {
    // Tracer position on atlas
    const [tracerFace, setTracerFace] = useState('PZ');
    const [tracerU, setTracerU] = useState(-0.2);
    const [tracerV, setTracerV] = useState(-0.2);

    // Transport vector (normalized 2D in current chart frame)
    const [transportVec, setTransportVec] = useState([1, 0.3].map((v, _, a) => v / Math.sqrt(a.reduce((s, x) => s + x * x, 0))));

    // 2×2 holonomy matrix
    const [holonomyMatrix, setHolonomyMatrix] = useState(() => mat2Identity());

    // Derived readouts
    const [holonomyAngle, setHolonomyAngle] = useState(0);
    const [orientationParity, setOrientationParity] = useState(1);
    const [seamCount, setSeamCount] = useState(0);
    const [mobiusCount, setMobiusCount] = useState(0);
    const [loopClosed, setLoopClosed] = useState(false);
    const [twist, setTwist] = useState(0);

    // Mutable simulation state (not in React state — updated every frame for perf)
    const sim = useRef({
        face: 'PZ', u: -0.2, v: -0.2,
        vec: normalize2([1, 0.3]),
        H: [[1, 0], [0, 1]],
        t: 0,       // integer step counter
        time: 0,    // seconds
        seamCount: 0,
        mobiusCount: 0,
    });

    // Step accumulator — advance one logical step per STEP_INTERVAL seconds
    const STEP_INTERVAL = 0.04; // matches Python frame_ms=40ms
    const stepAcc = useRef(0);

    // Start position for loop detection
    const startFace = useRef('PZ');
    const startU = useRef(-0.2);
    const startV = useRef(-0.2);
    const stepsElapsed = useRef(0);

    // Loop flag cooldown
    const loopCooldown = useRef(0);

    // Pending player turn
    const pendingTurn = useRef(null); // 'left' | 'right' → affects W2 multiplier sign

    useFrame((_state, delta) => {
        stepAcc.current += delta;
        sim.current.time += delta;
        loopCooldown.current = Math.max(0, loopCooldown.current - delta);

        const s = sim.current;

        // Update twist animation
        const newTwist = twistSchedule(s.time);
        setTwist(newTwist);

        // Step once (or multiple if frame was slow)
        while (stepAcc.current >= STEP_INTERVAL) {
            stepAcc.current -= STEP_INTERVAL;

            // Lissajous motion — matches Python Tracer.step()
            const ang = W1 * s.t;
            const w2mult = pendingTurn.current === 'left' ? -W2 : W2;
            s.u += VX_AMP * Math.cos(ang);
            s.v += VY_AMP * Math.sin(w2mult * ang);
            s.t += 1;

            // Edge crossing detection
            const edge = getEdgeCrossed(s.u, s.v, HALF);
            if (edge) {
                const oldFace = s.face;
                const newFace = NEIGH[oldFace]?.[edge];
                if (newFace) {
                    const Aij = getSeamMatrix(oldFace, newFace);

                    // Transport vector
                    s.vec = normalize2(applyMat2(Aij, s.vec));

                    // Accumulate holonomy
                    s.H = mat2Mul(Aij, s.H);

                    // Check if Möbius seam (det(Aij) < 0)
                    const detAij = Aij[0][0] * Aij[1][1] - Aij[0][1] * Aij[1][0];
                    const isMobius = detAij < 0;

                    s.seamCount += 1;
                    if (isMobius) s.mobiusCount += 1;
                    s.face = newFace;

                    // Clamp (u,v) back to inside the new chart
                    const [nu, nv] = clampAfterCross(s.u, s.v, edge);
                    s.u = nu; s.v = nv;

                    // Update React state for HUD
                    setSeamCount(s.seamCount);
                    setMobiusCount(s.mobiusCount);
                    const newH = mat2Clone(s.H);
                    setHolonomyMatrix(newH);
                    setTransportVec([...s.vec]);
                    setHolonomyAngle(getHolonomyAngle(newH));
                    setOrientationParity(getOrientationParity(newH));
                }
            }

            // Loop detection — needs ≥6 steps to avoid false start
            stepsElapsed.current += 1;
            if (stepsElapsed.current > 80 && loopCooldown.current <= 0) {
                const du = s.u - startU.current;
                const dv = s.v - startV.current;
                if (s.face === startFace.current && Math.sqrt(du * du + dv * dv) < 0.06) {
                    setLoopClosed(true);
                    loopCooldown.current = 3.0;
                    setTimeout(() => setLoopClosed(false), 2500);

                    // Holonomy's two milestones, each paid once ever. The
                    // orientation-reversing loop is worth more because it is the
                    // mode's actual point: a path that comes home with det(H) =
                    // −1 is the non-orientability of RP² observed directly, not
                    // described. Read from the live matrix rather than the React
                    // state, which this frame has only just queued.
                    //
                    // This is a render-frame callback, so it must stay cheap and
                    // write nothing back into the traced state: awardMilestone
                    // short-circuits on an already-claimed key before it touches
                    // the wallet, and the loop cooldown bounds how often it runs.
                    const earn = (amount) => useGameStore.getState().earnCoins(amount);
                    awardMilestone(HOLONOMY_LOOP_KEY, { progress: progressManager, earn });
                    if (getOrientationParity(s.H) < 0) {
                        awardMilestone(HOLONOMY_MOBIUS_KEY, { progress: progressManager, earn });
                    }
                }
            }

            // Update position state for 3D renderer
            setTracerFace(s.face);
            setTracerU(s.u);
            setTracerV(s.v);
        }
    });

    // ─── Player controls ──────────────────────────────────────────────────────
    const queueTurn = useCallback((dir) => {
        pendingTurn.current = dir;
        // Auto-clear turn after a few steps
        setTimeout(() => { pendingTurn.current = null; }, 1200);
    }, []);

    const resetHolonomy = useCallback(() => {
        const init = makeInitialState();
        sim.current = {
            face: init.face, u: init.u, v: init.v,
            vec: normalize2([1, 0.3]),
            H: [[1, 0], [0, 1]],
            t: 0, time: 0,
            seamCount: 0, mobiusCount: 0,
        };
        stepAcc.current = 0;
        stepsElapsed.current = 0;
        loopCooldown.current = 0;
        startFace.current = init.face;
        startU.current = init.u;
        startV.current = init.v;
        pendingTurn.current = null;

        setTracerFace(init.face);
        setTracerU(init.u);
        setTracerV(init.v);
        setTransportVec(normalize2([1, 0.3]));
        setHolonomyMatrix(mat2Identity());
        setHolonomyAngle(0);
        setOrientationParity(1);
        setSeamCount(0);
        setMobiusCount(0);
        setLoopClosed(false);
        setTwist(0);
    }, []);

    return {
        // Tracer atlas state
        tracerFace,
        tracerU,
        tracerV,
        // Gauge transport
        transportVec,
        twist,
        // Holonomy
        holonomyMatrix,
        holonomyAngle,
        orientationParity,
        // Counts
        seamCount,
        mobiusCount,
        loopClosed,
        // Actions
        queueTurn,
        resetHolonomy,
    };
}
