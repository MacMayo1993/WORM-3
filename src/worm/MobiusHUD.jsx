import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { MONO_FONT, Z, TEXT_XS } from '../utils/uiTheme.js';
import { useShallow } from 'zustand/react/shallow';
import { tunnelState } from './tunnelProgressBridge.js';

const W = 220, H = 56;
const bY1 = 14, bY2 = 32, bMid = 23;
const xL = 10, tL = 90, tR = 130, xR = 210;
const tMid = (tL + tR) / 2;

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

    const dotGlowRef = useRef(null);
    const dotOuterRef = useRef(null);
    const dotInnerRef = useRef(null);
    const rafRef = useRef(null);

    useEffect(() => {
        if (!isActive) {
            cancelAnimationFrame(rafRef.current);
            if (dotGlowRef.current) dotGlowRef.current.setAttribute('visibility', 'hidden');
            return;
        }
        const animate = () => {
            const t = tunnelState.t;
            const g = dotGlowRef.current;
            if (g) {
                if (t > 0) {
                    const cx = xL + t * (xR - xL);
                    g.setAttribute('visibility', 'visible');
                    dotOuterRef.current.setAttribute('cx', cx);
                    dotInnerRef.current.setAttribute('cx', cx);
                } else {
                    g.setAttribute('visibility', 'hidden');
                }
            }
            if (tunnelState.active) rafRef.current = requestAnimationFrame(animate);
        };
        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
    }, [isActive]);

    if (!wormHealerMode) return null;

    const entryColor = tunnelColors?.entryColor ?? '#00bbff';
    const exitColor  = tunnelColors?.exitColor  ?? '#ff7700';

    return (
        <div style={{
            position: 'fixed',
            // Below the status bar and the rotation clock — at 62px it landed on
            // top of the HUD bar's second row and the two read as one jammed strip.
            top: 'calc(env(safe-area-inset-top, 0px) + 150px)',
            left: '50%',
            transform: `translateX(-50%) translateY(${isActive ? '0' : '-20px'})`,
            pointerEvents: 'none',
            zIndex: Z.NAV,
            opacity: isActive ? 1 : 0,
            transition: 'opacity 0.3s ease, transform 0.3s ease',
        }}>
            <div style={{
                color: 'rgba(255,255,255,0.48)',
                fontSize: TEXT_XS,
                fontFamily: MONO_FONT,
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

                <rect x={xL} y={bY1} width={tL - xL} height={bY2 - bY1} fill={entryColor} rx="3" opacity="0.78" />

                <polygon
                    points={`${tL},${bY1} ${tR},${bMid} ${tR},${bY2} ${tL},${bMid}`}
                    fill={entryColor} opacity="0.72"
                />
                <polygon
                    points={`${tL},${bMid} ${tR},${bY1} ${tR},${bMid} ${tL},${bY2}`}
                    fill={exitColor} opacity="0.72"
                />
                <line x1={tL} y1={bY1} x2={tR} y2={bY2} stroke="white" strokeWidth="1.5" opacity="0.5" />
                <line x1={tL} y1={bY2} x2={tR} y2={bY1} stroke="white" strokeWidth="1.5" opacity="0.5" />

                <rect x={tR} y={bY1} width={xR - tR} height={bY2 - bY1} fill={exitColor} rx="3" opacity="0.78" />

                <line x1={xL + 5} y1={bMid} x2={tL} y2={bMid} stroke="white" strokeWidth="0.75" opacity="0.18" />
                <line x1={tR} y1={bMid} x2={xR - 5} y2={bMid} stroke="white" strokeWidth="0.75" opacity="0.18" />

                <circle cx={xL} cy={bMid} r={4.5} fill={entryColor} />
                <circle cx={xR} cy={bMid} r={4.5} fill={exitColor} />

                <text x={xL + (tL - xL) / 2} y={bY2 + 12} textAnchor="middle"
                    fill={entryColor} fontSize="7.5" fontFamily={MONO_FONT} opacity="0.75">
                    ENTRY
                </text>
                <text x={tMid} y={bY2 + 12} textAnchor="middle"
                    fill="rgba(255,255,255,0.42)" fontSize="7.5" fontFamily={MONO_FONT}>
                    ½π
                </text>
                <text x={tR + (xR - tR) / 2} y={bY2 + 12} textAnchor="middle"
                    fill={exitColor} fontSize="7.5" fontFamily={MONO_FONT} opacity="0.75">
                    EXIT
                </text>

                <g ref={dotGlowRef} filter="url(#mbDotGlow)" visibility="hidden">
                    <circle ref={dotOuterRef} cx={xL} cy={bMid} r={6.5} fill="white" opacity="0.8" />
                    <circle ref={dotInnerRef} cx={xL} cy={bMid} r={3.5} fill="white" />
                </g>
            </svg>
        </div>
    );
}
