// src/worm/healerWorm/SliceWarningLights.jsx
// Telegraphed warning for the about-to-fire hazard rotation: rainbow slice ring + lights.
// Extracted verbatim from HealerWormMode.jsx (2026-07); no behavior change.

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { ANTIPODAL_COLOR } from '../../utils/constants.js';
import { resolveColors } from '../../utils/colorSchemes.js';
import { FACE_NORMALS } from './constants.js';
import { getSliceSurfaceStickers } from '../wormHelpers.js';

// ─── Slice Warning Lights ─────────────────────────────────────────────────────
// Visual warning for the about-to-rotate slice:
//   1. Spinning rainbow torus ring — encircles the cube at the slice plane, sized to the
//      cube's actual world-space dimensions so it is always visible on any cube size.
//      Vertex-colored with all 6 face colors. Spins in the rotation direction.
//   2. PointLights per face — antipodal-colored scene lighting.
//
// World-space coordinate formula: tile at grid index i on axis with size n
//   maps to world coord  i - (n-1)/2
// So the cube half-extent is (size-1)/2, and the ring radius must clear
// the face diagonal: (size-1)/2 * sqrt(2) plus margin.
const MAX_SLICE_LIGHTS = 6;
const TUBULAR_SEGS = 96;
const RADIAL_SEGS  = 16;

const _ringSpinQ = new THREE.Quaternion();
const _xAxis     = new THREE.Vector3(1, 0, 0);
const _yAxis     = new THREE.Vector3(0, 1, 0);
const _zAxis     = new THREE.Vector3(0, 0, 1);

export function SliceWarningLights({ pendingRotRef, warningProgressRef, size, cubies }) {
    const lightGroupRef = useRef();
    const ringRef       = useRef();
    const borderRef     = useRef();
    const hazardBoxRef  = useRef();
    const customGeoRef  = useRef(null); // tracks geometries we created so we can dispose them
    const customBorderGeoRef = useRef(null);
    const dataRef       = useRef(null);
    const lastKeyRef    = useRef(null);
    const spinAngleRef  = useRef(0);

    useFrame(({ clock }, delta) => {
        const lgroup = lightGroupRef.current;
        const ring   = ringRef.current;
        const border = borderRef.current;
        const box    = hazardBoxRef.current;
        if (!lgroup || !ring || !border || !box) return;

        const pending = pendingRotRef.current;
        const t  = clock.elapsedTime;
        const wp = warningProgressRef.current;

        if (!pending) {
            for (const l of lgroup.children) l.intensity = 0;
            ring.visible = false;
            border.visible = false;
            box.visible = false;
            lastKeyRef.current = null;
            dataRef.current    = null;
            return;
        }

        ring.visible = true;
        border.visible = true;
        box.visible = true;

        // Recompute when the slice identity changes
        const key = `${pending.axis}-${pending.sliceIndex}`;
        if (key !== lastKeyRef.current) {
            lastKeyRef.current = key;
            const { axis, sliceIndex } = pending;
            const stickers   = getSliceSurfaceStickers(size, axis, sliceIndex);
            const faceColors = resolveColors(useGameStore.getState().settings);

            // Per-face center + color for point lights
            const byFace = {};
            for (const { x, y, z, dirKey } of stickers) {
                const [wx, wy, wz] = getStickerWorldPos(x, y, z, dirKey, size, 0);
                if (!byFace[dirKey]) {
                    const sticker = cubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
                    const faceId  = sticker?.curr ?? 0;
                    const antiId  = ANTIPODAL_COLOR[faceId] ?? faceId;
                    const hex     = (antiId && faceColors[antiId]) ?? '#ffcc44';
                    byFace[dirKey] = { wx: 0, wy: 0, wz: 0, n: 0, color: new THREE.Color(hex) };
                }
                byFace[dirKey].wx += wx;
                byFace[dirKey].wy += wy;
                byFace[dirKey].wz += wz;
                byFace[dirKey].n++;
            }
            const faceData = Object.entries(byFace).map(([dirKey, d]) => {
                const nm = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
                return { cx: d.wx / d.n, cy: d.wy / d.n, cz: d.wz / d.n, nx: nm.x, ny: nm.y, nz: nm.z, color: d.color };
            });

            // ── Ring position ─────────────────────────────────────────────────
            // Tile grid index i maps to world coord  i - (size-1)/2
            const sliceW = sliceIndex - (size - 1) / 2;
            if (axis === 'col')        { ring.position.set(sliceW, 0, 0); border.position.set(sliceW, 0, 0); }
            else if (axis === 'row')   { ring.position.set(0, sliceW, 0); border.position.set(0, sliceW, 0); }
            else                       { ring.position.set(0, 0, sliceW); border.position.set(0, 0, sliceW); }

            // ── Ring geometry — sized to cube, rainbow vertex colors ───────────
            // halfExt * sqrt(2) is only the corner of the CUBIE LATTICE (centers of the
            // outermost cubies) — the rendered cube extends another ~0.49-0.51 units past
            // that out to the body/sticker surface (see Cubie.jsx EDGE_H / STICKER_POS), so
            // the true rendered corner must include that before the clearance margin is
            // applied, otherwise the ring undershoots and cuts through the cube's corners.
            const halfExt    = (size - 1) / 2;
            const CUBIE_OUTER_HALF = 0.51;
            const cubeCornerRadius = (halfExt + CUBIE_OUTER_HALF) * Math.SQRT2;
            const ringRadius = cubeCornerRadius * 1.3225;
            const ringTube   = Math.max(0.11, halfExt * 0.1);
            const borderTube = ringTube * 1.3; // slightly larger so it rims the colorful ring as a defining edge

            if (customGeoRef.current) { customGeoRef.current.dispose(); customGeoRef.current = null; }
            const geo = new THREE.TorusGeometry(ringRadius, ringTube, RADIAL_SEGS, TUBULAR_SEGS);

            // Vertex colors: cycle through all 6 face colors equally around the ring.
            // Boosted past 1.0 — additive blending only reads as "bright" when the
            // source color itself is hot, otherwise the ring reads as a dim tint.
            const COLOR_BOOST = 1.6;
            const colors6  = [1, 2, 3, 4, 5, 6].map(id => new THREE.Color(faceColors[id] ?? '#ffffff').multiplyScalar(COLOR_BOOST));
            const vertCount = (RADIAL_SEGS + 1) * (TUBULAR_SEGS + 1);
            const colorArr  = new Float32Array(vertCount * 3);
            let ci = 0;
            for (let i = 0; i <= TUBULAR_SEGS; i++) {
                const c = colors6[Math.floor((i / TUBULAR_SEGS) * 6) % 6];
                for (let j = 0; j <= RADIAL_SEGS; j++) {
                    colorArr[ci++] = c.r;
                    colorArr[ci++] = c.g;
                    colorArr[ci++] = c.b;
                }
            }
            geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
            customGeoRef.current = geo;
            ring.geometry = geo;

            if (customBorderGeoRef.current) { customBorderGeoRef.current.dispose(); customBorderGeoRef.current = null; }
            const borderGeo = new THREE.TorusGeometry(ringRadius, borderTube, RADIAL_SEGS, TUBULAR_SEGS);
            customBorderGeoRef.current = borderGeo;
            border.geometry = borderGeo;

            // ── Ring orientation ──────────────────────────────────────────────
            // Default TorusGeometry: XY plane, hole (symmetry axis) along Z.
            //   col  → rotate 90° around Y   → hole along +X
            //   row  → rotate -90° around X  → hole along +Y
            //   depth→ identity               → hole already along Z
            const baseQ = new THREE.Quaternion();
            if (axis === 'col')      baseQ.setFromAxisAngle(_yAxis,  Math.PI / 2);
            else if (axis === 'row') baseQ.setFromAxisAngle(_xAxis, -Math.PI / 2);

            const rotAxis = axis === 'col'   ? _xAxis.clone()
                          : axis === 'row'   ? _yAxis.clone()
                          :                    _zAxis.clone();

            dataRef.current = { faceData, baseQ, rotAxis };
        }

        const { faceData, baseQ, rotAxis } = dataRef.current;

        // ── 1. Point lights ───────────────────────────────────────────────────
        const strobe   = 0.4 + Math.abs(Math.sin(t * (4 + wp * 14))) * 0.6;
        const lightInt = (3 + wp * 10) * strobe;
        for (let i = 0; i < MAX_SLICE_LIGHTS; i++) {
            const l = lgroup.children[i];
            if (!l) continue;
            if (i >= faceData.length) { l.intensity = 0; continue; }
            const { cx, cy, cz, nx, ny, nz, color } = faceData[i];
            l.position.set(cx + nx * 0.15, cy + ny * 0.15, cz + nz * 0.15);
            l.color.copy(color);
            l.intensity = lightInt;
        }

        // ── 2. Ring spin + pulse ──────────────────────────────────────────────
        spinAngleRef.current += delta * (1.2 + wp * 2.5) * pending.dir;
        _ringSpinQ.setFromAxisAngle(rotAxis, spinAngleRef.current);
        ring.quaternion.multiplyQuaternions(_ringSpinQ, baseQ);
        border.quaternion.copy(ring.quaternion);

        const pulse = 0.85 + 0.15 * Math.sin(t * 7);
        ring.material.opacity = (0.8 + wp * 0.2) * pulse;
        const scale = 1 + Math.sin(t * 4) * 0.02;
        ring.scale.setScalar(scale);
        border.scale.setScalar(scale);
        border.material.opacity = 0.75 + wp * 0.2;

        // ── 3. Hazard box — flash/shake/pulse skin hugging the actual layer ────
        // Sized to the slice's real volume (one cubie thick along the rotation axis).
        // The cross-section spans just PAST the outer sticker surface so the red
        // field coats the layer's exposed faces and is visible from OUTSIDE the cube
        // — not only from the inside tunnel camera. Everything ramps with wp: calm
        // right after the warning arms, frantic by the time the rotation fires.
        const halfExt = (size - 1) / 2;
        const sliceW  = pending.sliceIndex - halfExt;
        let baseX = 0, baseY = 0, baseZ = 0;
        // size + 0.4 reaches ~0.18 beyond the sticker surface on every side, so the
        // slab's perimeter faces sheathe the layer's outer tiles in red.
        const fieldSpan = size + 0.4;
        let dimX = fieldSpan, dimY = fieldSpan, dimZ = fieldSpan;
        if (pending.axis === 'col')      { baseX = sliceW; dimX = 0.94; }
        else if (pending.axis === 'row') { baseY = sliceW; dimY = 0.94; }
        else                             { baseZ = sliceW; dimZ = 0.94; }

        const shakeAmp = 0.05 * wp * wp; // negligible early, rattling hard near zero
        const jx = (Math.sin(t * 37 + 1.3) + Math.sin(t * 53 + 4.1)) * 0.5 * shakeAmp;
        const jy = (Math.sin(t * 41 + 2.7) + Math.sin(t * 59 + 0.6)) * 0.5 * shakeAmp;
        const jz = (Math.sin(t * 47 + 5.2) + Math.sin(t * 61 + 3.4)) * 0.5 * shakeAmp;
        box.position.set(baseX + jx, baseY + jy, baseZ + jz);

        const boxPulse = 1 + Math.sin(t * (5 + wp * 10)) * 0.06 * wp;
        box.scale.set(dimX * boxPulse, dimY * boxPulse, dimZ * boxPulse);

        const flashStrobe = 0.5 + 0.5 * Math.sin(t * (6 + wp * 24));
        box.material.opacity = (0.05 + wp * 0.4) * flashStrobe;
    });

    return (
        <>
            <group ref={lightGroupRef}>
                {Array.from({ length: MAX_SLICE_LIGHTS }, (_, i) => (
                    <pointLight key={i} intensity={0} distance={30} decay={2} castShadow={false} />
                ))}
            </group>
            {/* Black outline ring — slightly larger than the colorful ring, drawn first so
                it rims the bright ring with a defined edge instead of bleeding into the background. */}
            <mesh ref={borderRef} visible={false} renderOrder={1}>
                <torusGeometry args={[1, 0.05, RADIAL_SEGS, TUBULAR_SEGS]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.8} depthWrite={false} />
            </mesh>
            {/* Rainbow spinning ring — geometry set imperatively in useFrame to scale with cube size */}
            <mesh ref={ringRef} visible={false} renderOrder={2}>
                <torusGeometry args={[1, 0.04, RADIAL_SEGS, TUBULAR_SEGS]} />
                <meshBasicMaterial vertexColors transparent opacity={0.9}
                    blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            {/* Hazard box — hugs the threatened layer's volume and flashes/shakes/pulses;
                position/scale/opacity driven imperatively in useFrame. */}
            <mesh ref={hazardBoxRef} visible={false} renderOrder={3}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#ff2d3d" transparent opacity={0} side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
        </>
    );
}
