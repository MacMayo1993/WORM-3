// src/worm/healerWorm/PowerupOrbs.jsx
// Collectible orbs on the cube surface, tinted by the tile they sit on.
// Extracted verbatim from HealerWormMode.jsx (2026-07); no behavior change.

import React, { useMemo } from 'react';

import { useGameStore } from '../../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { getStickerSafe } from '../../game/cubeState.js';
import { ANTIPODAL_COLOR } from '../../utils/constants.js';
import { resolveColors } from '../../utils/colorSchemes.js';
import ParityOrbs from '../ParityOrb.jsx';
import { ensureOrbContrast } from '../wormHelpers.js';

// ─── Powerup Orbs ─────────────────────────────────────────────────────────────
// Each orb inherits the color of the sticker tile it sits on and follows
// that tile through cube rotations. Rendered using the shared ParityOrbs component.
export function PowerupOrbs({ size }) {
    const { wormPowerups, cubies, settings, wormCharacter } = useGameStore(useShallow(s => ({
        wormPowerups: s.wormPowerups,
        cubies: s.cubies,
        settings: s.settings,
        wormCharacter: s.wormCharacter ?? 'classic',
    })));
    const faceColors = useMemo(() => resolveColors(settings), [settings]);

    // Cheap signature of just the orb-tile stickers' colors. `cubies` gets a new
    // array reference on every single rotation/flip, but only a handful of tiles
    // (the ~24 orb positions) actually matter here — keying the heavier `orbs`
    // memo below on this signature instead of raw `cubies` lets it skip
    // recomputing (and keep returning the same array reference) on every move
    // that doesn't touch an orb tile.
    const orbSignature = useMemo(() => {
        if (!wormPowerups || !cubies) return '';
        let sig = wormPowerups.length + '|';
        for (const p of wormPowerups) {
            const sticker = getStickerSafe(cubies, p.x, p.y, p.z, p.dirKey);
            sig += `${p.x},${p.y},${p.z},${p.dirKey}:${sticker?.curr ?? 0},${sticker?.orig ?? 0};`;
        }
        return sig;
    }, [wormPowerups, cubies]);

    const orbs = useMemo(() => {
        if (!wormPowerups || !cubies) return [];
        return wormPowerups.map(p => {
            const sticker = getStickerSafe(cubies, p.x, p.y, p.z, p.dirKey);
            const faceId = sticker?.curr ?? 0;
            const color = ensureOrbContrast((faceId && faceColors[faceId]) ?? '#22ff88');
            const antipodalFaceId = ANTIPODAL_COLOR[faceId];
            const antipodalColor = ensureOrbContrast((antipodalFaceId && faceColors[antipodalFaceId]) ?? color);
            // Orbs on flipped tiles hover above the surface — worm must jump to collect
            const elevated = !!(sticker && sticker.curr !== sticker.orig);
            return { ...p, color, antipodalColor, elevated };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orbSignature, faceColors]);

    return <ParityOrbs orbs={orbs} size={size} isGlowWorm={wormCharacter === 'glow'} />;
}

// Watches for orb pickups by the glow worm and renders a color bloom at the collect point.
// Follows the same pendingRef + useFrame polling pattern as HeartBurstSystem.
