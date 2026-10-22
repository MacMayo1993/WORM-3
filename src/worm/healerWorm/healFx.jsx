import { tunnelDanger } from './tunnelReadout.js';
import { wormBuffs } from '../wormBuffs.js';
// src/worm/healerWorm/healFx.jsx
// Extracted from HealerWormMode.jsx (2026-07 monolith split).
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getWormStickerWorldPos as getStickerWorldPos } from '../wormExpansion.js';
import { readLiveTile, getOrbColor } from '../wormHelpers.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { resolveColors } from '../../utils/colorSchemes.js';
import { FACE_NORMALS } from './constants.js';
import { makeBurstRig, poseBurstRig, tintBurstRig } from './healBurstRig.js';

// 3D heal burst: an expanding shockwave and a flash on BOTH mouths of a healed pair,
// each in the colour that tile goes home to. A pair heals together (α² = id), so the
// beat lands on the two antipodal tiles at once, mirrored. A double heal rings
// bigger and sends a second wave. The rings lie in the tile's plane (ringGeometry
// faces +Z; each rig's +Z is turned onto the live tile normal) and follow the live
// cubie, so a piece still settling from its pop or a turning layer carries them.
//
// Pooled rigs (healBurstRig.js): no mount, no setState, on the frame a heal lands.
const _healNormalScratch = new THREE.Vector3();
const _healRingZ = new THREE.Vector3(0, 0, 1);
const BURST_RIGS = 4;

// Watches for heal events from the worm hook and plays the pooled bursts (tile
// recolour, seal and cubie pop are driven by applyHeal).
export function HealBurstSystem({ worm, size }) {
    const rigs = useMemo(() => Array.from({ length: BURST_RIGS }, makeBurstRig), []);
    const colorCache = useRef({ settings: null, colors: null });
    useEffect(() => () => {
        for (const rig of rigs) for (const mesh of [rig.outer, rig.wave, rig.core, rig.flash]) mesh.material.dispose();
    }, [rigs]);

    const place = (rig) => {
        const tile = rig.tile;
        if (!readLiveTile(tile, rig.group.position, _healNormalScratch)) {
            const wp = getStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size, 0);
            if (!wp) return false;
            rig.group.position.set(wp[0], wp[1], wp[2]);
            _healNormalScratch.copy(FACE_NORMALS[tile.dirKey] ?? FACE_NORMALS.PZ);
        }
        rig.group.quaternion.setFromUnitVectors(_healRingZ, _healNormalScratch);
        return true;
    };

    useFrame((_s, dt) => {
        const pending = worm.pendingHealBurstRef.current;
        if (pending) {
            worm.pendingHealBurstRef.current = null;
            const store = useGameStore.getState();
            const cache = colorCache.current;
            if (cache.settings !== store.settings) { cache.settings = store.settings; cache.colors = resolveColors(store.settings); }
            for (const tile of [pending.exitTile, pending.entryTile]) {
                if (!tile) continue;
                // A free rig, or the one furthest through its burst.
                let rig = rigs.find(r => !r.active);
                if (!rig) rig = rigs.reduce((a, b) => (b.t > a.t ? b : a));
                const home = store.cubies?.[tile.x]?.[tile.y]?.[tile.z]?.stickers?.[tile.dirKey]?.orig;
                // Lifted toward white, so a ring still reads over its own colour (it
                // lands on the tile that has just turned back to that colour).
                tintBurstRig(rig, getOrbColor(home, cache.colors, '#3affb0'));
                rig.tile = tile; rig.t = 0; rig.tier = pending.tier ?? 1; rig.active = true;
                rig.group.visible = place(rig);
                if (!rig.group.visible) rig.active = false;
            }
        }
        const held = useGameStore.getState().wormPaused;
        for (const rig of rigs) {
            // An idle rig stays hidden: a Suspense resume unhides every instance that
            // has no visible={false} prop, which drew four empty rigs every frame.
            if (!rig.active) { if (rig.group.visible) rig.group.visible = false; continue; }
            if (!held) rig.t += dt;
            place(rig);
            if (!poseBurstRig(rig, rig.t)) { rig.active = false; rig.group.visible = false; }
        }
    });

    return <>{rigs.map((rig, i) => <primitive key={i} object={rig.group} />)}</>;
}

// One surface ring links the contextual HUD card to its entrance.
// Fatal entry takes priority over the healing affordability color.
export function TunnelHealProgress({ size, worm }) {
    const ring = useRef();
    const scratch = useMemo(() => ({ position: new THREE.Vector3(), normal: new THREE.Vector3(), view: new THREE.Vector3() }), []);
    useFrame(({ camera }) => {
        const mesh = ring.current, need = wormBuffs.tunnelNeeds;
        if (!mesh) return;
        mesh.visible = false;
        if (!need || need.inTransit || worm.phase.current !== 'crawling') return;
        const { position, normal, view } = scratch;
        if (!readLiveTile(need.pos, position, normal)) {
            position.fromArray(getStickerWorldPos(need.pos.x, need.pos.y, need.pos.z, need.pos.dirKey, size, 0));
            normal.copy(FACE_NORMALS[need.pos.dirKey]);
        }
        if (view.copy(camera.position).sub(position).normalize().dot(normal) <= 0.18) return;
        mesh.visible = true;
        mesh.position.copy(position).addScaledVector(normal, 0.07);
        mesh.quaternion.setFromUnitVectors(_healRingZ, normal);
        mesh.material.color.set(tunnelDanger(need) ? '#ff493d' : need.ready ? '#8ee5a6' : '#ffffff');
    });
    return <mesh ref={ring} visible={false} raycast={() => null}>
        <ringGeometry args={[0.4, 0.44, 40]} />
        <meshBasicMaterial transparent opacity={0.9} depthTest depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>;
}
