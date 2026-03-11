// src/components/overlays/HealerWormHUD.jsx
// Replaces old stub — now delegates to WormCrawlerHUD with store-based state.

import React from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import WormCrawlerHUD from '../../worm/WormCrawlerHUD.jsx';

export default function HealerWormHUD({ onHome, onSettings, onRetry, onNewGame }) {
    const { wormHealerMode, wormPhase, wormOnFlippedTile, size, wormAlive, showWormDeathMenu, wormDeathDetails } = useGameStore(
        useShallow(s => ({
            wormHealerMode: s.wormHealerMode,
            wormPhase: s.wormPhase,
            wormOnFlippedTile: s.wormOnFlippedTile,
            size: s.size,
            wormAlive: s.wormAlive ?? true,
            showWormDeathMenu: s.showWormDeathMenu ?? false,
            wormDeathDetails: s.wormDeathDetails ?? null,
        }))
    );

    if (!wormHealerMode) return null;

    return (
        <WormCrawlerHUD
            phase={wormPhase}
            onFlippedTile={wormOnFlippedTile}
            cubeSize={size}
            onHome={onHome}
            onSettings={onSettings}
            wormAlive={wormAlive}
            showDeathMenu={showWormDeathMenu}
            deathDetails={wormDeathDetails}
            onRetry={onRetry}
            onNewGame={onNewGame}
        />
    );
}
