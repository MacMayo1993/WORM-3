// src/components/overlays/HealerWormHUD.jsx
// Replaces old stub — now delegates to WormCrawlerHUD with store-based state.
// enterPortal is registered in the store as a callback by HealerWormMode3DWrapper.

import React from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import WormCrawlerHUD from '../../worm/WormCrawlerHUD.jsx';

export default function HealerWormHUD({ onHome, onSettings, onTryAgain }) {
    const wormHealerMode = useGameStore(s => s.wormHealerMode);
    const wormPhase = useGameStore(s => s.wormPhase);
    const wormOnFlippedTile = useGameStore(s => s.wormOnFlippedTile);
    const size = useGameStore(s => s.size);
    const wormAlive = useGameStore(s => s.wormAlive ?? true);
    const showWormDeathMenu = useGameStore(s => s.showWormDeathMenu ?? false);

    if (!wormHealerMode) return null;

    const handleEnterPortal = () => {
        // Callback registered by HealerWormMode3DWrapper via store
        return useGameStore.getState()._wormEnterPortal?.() ?? false;
    };

    return (
        <WormCrawlerHUD
            phase={wormPhase}
            onFlippedTile={wormOnFlippedTile}
            onEnterPortal={handleEnterPortal}
            cubeSize={size}
            onHome={onHome}
            onSettings={onSettings}
            wormAlive={wormAlive}
            showDeathMenu={showWormDeathMenu}
            onTryAgain={onTryAgain}
        />
    );
}
