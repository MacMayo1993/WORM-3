import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';

// Approximate total tunnel traversal duration in ms:
// entering (0.5s) + tunnel (1.92s) + exiting (0.625s) ≈ 3.05s
const TOTAL_TUNNEL_MS = 3050;

export default function MobiusHUD() {
    const { wormHealerMode, wormPhase, tunnelColors } = useGameStore(
        useShallow(s => ({
            wormHealerMode: s.wormHealerMode ?? false,
            wormPhase: s.wormPhase ?? 'crawling',
            tunnelColors: s.wormActiveTunnelColors,
        }))
    );

    const isActive = wormHealerMode && (
        wormPhase === 'entering' || wormPhase === 'tunnel' || wormPhase === 'exiting'
    );

    const [dotT, setDotT] = useState(0);
    const rafRef = useRef(null);
    const startRef = useRef(null);

    useEffect(() => {
        if (!isActive) {
            cancelAnimationFrame(rafRef.current);
            setDotT(0);
            startRef.current = null;
            return;
        }
        startRef.current = performance.now();
        const animate = () => {
            const p = Math.min((performance.now() - startRef.current) / TOTAL_TUNNEL_MS, 1.0);
            setDotT(p);
            if (p < 1.0) rafRef.current = requestAnimationFrame(animate);
        };
        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
    }, [isActive]);

    if (!wormHealerMode) return null;

    const entryColor = tunnelColors?.entryColor ?? '#00bbff';
    const exitColor = tunnelColors?.exitColor ?? '#ff7700';

    // SVG layout constants
    const W = 220, H = 56;
    const bY1 = 14, bY2 = 32, bMid = 23;
    const xL = 10, tL = 90, tR = 130, xR = 210;
    const tMid = (tL + tR) / 2;

    // Dot travels linearly from xL to xR over the full tunnel duration
    const dotX = xL + dotT * (xR - xL);

    return (
        <div style={{
            position: 'fixed',
            bottom: '90px',
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 900,
            opacity: isActive ? 1 : 0,
            transition: 'opacity 0.3s ease',
        }}>
            <div style={{
                color: 'rgba(255,255,255,0.48)',
                fontSize: '8px',
                fontFamily: 'monospace',
                letterSpacing: '2.5px',
                textAlign: 'center',
                marginBottom: '2px',
                textShadow: '0 0 6px rgba(0,200,255,0.6)',
            }}>
                MÖBIUS BAND
            </div>
            <svg
                width={W} height={H}
                viewBox={`0 0 ${W} ${H}`}
                style={{ overflow: 'visible', filter: 'drop-shadow(0 0 6px rgba(0,180,255,0.35))' }}
            >
                <defs>
                    <filter id="mbDotGlow" x="-80%" y="-80%" width="260%" height="260%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Left band — entry face color */}
                <rect x={xL} y={bY1} width={tL - xL} height={bY2 - bY1} fill={entryColor} rx="3" opacity="0.78" />

                {/* Twist region: two crossing straps showing the Möbius half-twist.
                    Entry strap descends (top-left → bottom-right), exit strap ascends
                    (bottom-left → top-right). Together they form an X at the midpoint,
                    demonstrating RP² non-orientability — left and right are swapped on exit. */}
                <polygon
                    points={`${tL},${bY1} ${tR},${bMid} ${tR},${bY2} ${tL},${bMid}`}
                    fill={entryColor} opacity="0.72"
                />
                <polygon
                    points={`${tL},${bMid} ${tR},${bY1} ${tR},${bMid} ${tL},${bY2}`}
                    fill={exitColor} opacity="0.72"
                />
                {/* White X lines — mark the crossing point */}
                <line x1={tL} y1={bY1} x2={tR} y2={bY2} stroke="white" strokeWidth="1.5" opacity="0.5" />
                <line x1={tL} y1={bY2} x2={tR} y2={bY1} stroke="white" strokeWidth="1.5" opacity="0.5" />

                {/* Right band — exit face color */}
                <rect x={tR} y={bY1} width={xR - tR} height={bY2 - bY1} fill={exitColor} rx="3" opacity="0.78" />

                {/* Centerline guides on each straight segment */}
                <line x1={xL + 5} y1={bMid} x2={tL} y2={bMid} stroke="white" strokeWidth="0.75" opacity="0.18" />
                <line x1={tR} y1={bMid} x2={xR - 5} y2={bMid} stroke="white" strokeWidth="0.75" opacity="0.18" />

                {/* Endpoint markers */}
                <circle cx={xL} cy={bMid} r={4.5} fill={entryColor} />
                <circle cx={xR} cy={bMid} r={4.5} fill={exitColor} />

                {/* Labels */}
                <text x={xL + (tL - xL) / 2} y={bY2 + 12} textAnchor="middle"
                    fill={entryColor} fontSize="7.5" fontFamily="monospace" opacity="0.75">
                    ENTRY
                </text>
                <text x={tMid} y={bY2 + 12} textAnchor="middle"
                    fill="rgba(255,255,255,0.42)" fontSize="7.5" fontFamily="monospace">
                    ½π
                </text>
                <text x={tR + (xR - tR) / 2} y={bY2 + 12} textAnchor="middle"
                    fill={exitColor} fontSize="7.5" fontFamily="monospace" opacity="0.75">
                    EXIT
                </text>

                {/* Animated worm-head dot tracking progress through the band */}
                {isActive && dotT > 0 && (
                    <g filter="url(#mbDotGlow)">
                        <circle cx={dotX} cy={bMid} r={6.5} fill="white" opacity="0.8" />
                        <circle cx={dotX} cy={bMid} r={3.5} fill="white" />
                    </g>
                )}
            </svg>
        </div>
    );
}
