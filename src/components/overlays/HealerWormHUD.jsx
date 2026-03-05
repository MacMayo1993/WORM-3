// src/components/overlays/HealerWormHUD.jsx
// Replaces old stub — now delegates to WormCrawlerHUD with store-based state.
// enterPortal is registered in the store as a callback by HealerWormMode3DWrapper.

import React from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import WormCrawlerHUD from '../../worm/WormCrawlerHUD.jsx';

export default function HealerWormHUD() {
    const wormHealerMode = useGameStore(s => s.wormHealerMode);
    const wormPhase = useGameStore(s => s.wormPhase);
    const wormOnFlippedTile = useGameStore(s => s.wormOnFlippedTile);

    if (!wormHealerMode) return null;

    const handleEnterPortal = () => {
        // Callback registered by HealerWormMode3DWrapper via store
        useGameStore.getState()._wormEnterPortal?.();
    };

    return (
        <WormCrawlerHUD
            phase={wormPhase}
            onFlippedTile={wormOnFlippedTile}
            onEnterPortal={handleEnterPortal}
        />
    );
}
