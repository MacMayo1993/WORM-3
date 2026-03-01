// src/3d/DisparityHealthBar.jsx
// Thin flip-pressure bar at the bottom edge of a sticker face.
// Visible only during Disparity Mode on live tiles (not dead/headstoned).
// Pure component — only re-renders when flips or flipCap changes.
import React from 'react';

const DisparityHealthBar = React.memo(function DisparityHealthBar({ flips, flipCap }) {
    const pct = Math.min(flips / flipCap, 1);
    if (pct <= 0) return null;

    const barColor = pct < 0.33 ? '#22c55e' : pct < 0.66 ? '#f97316' : '#ef4444';
    const isFlashing = pct >= 0.9;
    const barWidth = pct * 0.82;

    return (
        <group position={[0, -0.41, 0.002]}>
            {/* Background track */}
            <mesh>
                <planeGeometry args={[0.82, 0.05]} />
                <meshBasicMaterial color="#111111" transparent opacity={0.5} depthWrite={false} />
            </mesh>
            {/* Fill bar — left-aligned so it shrinks from right */}
            <mesh position={[-(0.82 - barWidth) / 2, 0, 0.001]}>
                <planeGeometry args={[barWidth, 0.05]} />
                <meshBasicMaterial
                    color={barColor}
                    transparent
                    opacity={isFlashing ? 1.0 : 0.85}
                    depthWrite={false}
                    toneMapped={false}
                />
            </mesh>
        </group>
    );
});

export default DisparityHealthBar;
