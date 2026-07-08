// src/holonomy/HolonomyHUD.jsx
// DOM overlay for Holonomy Mode — shows φ, parity, seam stats, and live 2×2 matrix.

import React, { useState, useEffect, useRef } from 'react';
import { UI_FONT, MONO_FONT, GLASS_PANEL, GLASS_PANEL_BORDER, GLASS_TEXT } from '../utils/uiTheme.js';

const fmt = (n) => (n >= 0 ? '+' : '') + n.toFixed(3);
const fmtDeg = (r) => ((r * 180) / Math.PI).toFixed(1) + '°';

export default function HolonomyHUD({
    holonomyAngle = 0,
    orientationParity = 1,
    holonomyMatrix,
    seamCount = 0,
    mobiusCount = 0,
    loopClosed = false,
    onReset,
    onTurnLeft,
    onTurnRight,
}) {
    const [showMatrix, setShowMatrix] = useState(false);
    const [loopFlash, setLoopFlash] = useState(false);
    const prevLoop = useRef(false);

    // Animate the loop-closed badge
    useEffect(() => {
        if (loopClosed && !prevLoop.current) {
            setLoopFlash(true);
            const t = setTimeout(() => setLoopFlash(false), 2500);
            prevLoop.current = true;
            return () => clearTimeout(t);
        }
        if (!loopClosed) prevLoop.current = false;
    }, [loopClosed]);

    const isFlipped = orientationParity < 0;
    const parityColor = isFlipped ? '#ff3366' : '#00ff88';
    const parityLabel = isFlipped ? '⊗ FLIPPED' : '⊕ ORIENTED';

    const H = holonomyMatrix || [[1, 0], [0, 1]];

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0,
            pointerEvents: 'none', zIndex: 500,
            fontFamily: MONO_FONT,
        }}>
            {/* Top info bar */}
            <div style={{
                display: 'flex', justifyContent: 'center', padding: '10px 0 0',
            }}>
                <div style={{
                    background: GLASS_PANEL,
                    border: '1.5px solid rgba(0,245,255,0.3)',
                    borderRadius: 12,
                    padding: '8px 20px',
                    display: 'flex', gap: 24, alignItems: 'center',
                    backdropFilter: 'blur(12px)',
                    pointerEvents: 'auto',
                }}>
                    {/* Title */}
                    <span style={{ color: '#00f5ff', fontWeight: 900, fontSize: 13, letterSpacing: 2 }}>
                        HOLONOMY MODE
                    </span>

                    {/* φ angle */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#aaa', fontSize: 9, letterSpacing: 1 }}>ANGLE φ</div>
                        <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
                            {fmtDeg(holonomyAngle)}
                        </div>
                    </div>

                    {/* Orientation parity */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#aaa', fontSize: 9, letterSpacing: 1 }}>PARITY</div>
                        <div style={{
                            color: parityColor, fontSize: 13, fontWeight: 800,
                            textShadow: `0 0 8px ${parityColor}`,
                        }}>
                            {parityLabel}
                        </div>
                    </div>

                    {/* Seams */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#aaa', fontSize: 9, letterSpacing: 1 }}>SEAMS</div>
                        <div style={{ color: '#fff', fontSize: 14 }}>{seamCount}</div>
                    </div>

                    {/* Möbius seams */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#aaa', fontSize: 9, letterSpacing: 1 }}>MÖBIUS</div>
                        <div style={{
                            color: mobiusCount > 0 ? '#ff00ff' : '#555', fontSize: 14,
                            textShadow: mobiusCount > 0 ? '0 0 8px #ff00ff' : 'none',
                        }}>
                            {mobiusCount}
                        </div>
                    </div>

                    {/* Matrix toggle */}
                    <button
                        onClick={() => setShowMatrix(s => !s)}
                        style={{
                            background: 'rgba(0,245,255,0.1)',
                            border: '1px solid rgba(0,245,255,0.4)',
                            borderRadius: 6, color: '#00f5ff', fontSize: 10,
                            padding: '3px 8px', cursor: 'pointer', letterSpacing: 1,
                        }}
                    >
                        {showMatrix ? 'HIDE H' : 'SHOW H'}
                    </button>

                    {/* Reset */}
                    <button
                        onClick={onReset}
                        style={{
                            background: 'rgba(255,50,50,0.12)',
                            border: '1px solid rgba(255,80,80,0.4)',
                            borderRadius: 6, color: '#ff6666', fontSize: 10,
                            padding: '3px 8px', cursor: 'pointer', letterSpacing: 1,
                        }}
                    >
                        RESET
                    </button>
                </div>
            </div>

            {/* 2×2 matrix panel */}
            {showMatrix && (
                <div style={{
                    display: 'flex', justifyContent: 'center', marginTop: 6,
                    pointerEvents: 'auto',
                }}>
                    <div style={{
                        background: GLASS_PANEL,
                        border: '1px solid rgba(0,245,255,0.25)',
                        borderRadius: 10, padding: '8px 20px',
                        backdropFilter: 'blur(10px)',
                    }}>
                        <div style={{ color: '#00f5ff', fontSize: 9, letterSpacing: 2, textAlign: 'center', marginBottom: 4 }}>
                            HOLONOMY MATRIX H
                        </div>
                        <table style={{ borderCollapse: 'collapse', color: '#fff', fontSize: 13 }}>
                            <tbody>
                                {H.map((row, ri) => (
                                    <tr key={ri}>
                                        {row.map((v, ci) => (
                                            <td key={ci} style={{
                                                padding: '2px 10px', textAlign: 'right',
                                                color: Math.abs(v) > 0.01 ? '#00ff88' : '#444',
                                            }}>
                                                {fmt(v)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ color: '#888', fontSize: 9, textAlign: 'center', marginTop: 4 }}>
                            det(H) = {fmt(H[0][0] * H[1][1] - H[0][1] * H[1][0])}
                        </div>
                    </div>
                </div>
            )}

            {/* Loop-closed banner */}
            {loopFlash && (
                <div style={{
                    position: 'fixed', top: '50%', left: '50%',
                    transform: 'translate(-50%,-50%)',
                    background: isFlipped
                        ? 'linear-gradient(135deg, rgba(80,0,100,0.92), rgba(200,0,255,0.7))'
                        : 'linear-gradient(135deg, rgba(0,40,80,0.92), rgba(0,200,100,0.7))',
                    border: `2px solid ${isFlipped ? '#cc44ff' : '#00ff88'}`,
                    borderRadius: 20, padding: '24px 48px',
                    textAlign: 'center', pointerEvents: 'none',
                    boxShadow: `0 0 60px ${isFlipped ? '#cc44ff' : '#00ff88'}`,
                    animation: 'holonomy-pop 0.4s cubic-bezier(0.22,1,0.36,1) forwards',
                    zIndex: 6000,
                }}>
                    <div style={{
                        fontSize: 36, fontWeight: 900, letterSpacing: 4,
                        color: isFlipped ? '#ff88ff' : '#00ff88',
                        textShadow: `0 0 20px ${isFlipped ? '#cc44ff' : '#00ff88'}`,
                    }}>
                        {isFlipped ? '⚡ LOOP CLOSED' : '✓ LOOP CLOSED'}
                    </div>
                    <div style={{ color: GLASS_TEXT, fontSize: 16, marginTop: 8, fontFamily: UI_FONT }}>
                        {isFlipped
                            ? `NON-TRIVIAL HOLONOMY — MÖBIUS LOOP DETECTED`
                            : `Trivial loop — bundle is orientable here`}
                    </div>
                    <div style={{ color: '#ccc', fontSize: 13, marginTop: 4 }}>
                        φ = {fmtDeg(holonomyAngle)} · det(H) = {orientationParity > 0 ? '+1' : '−1'}
                    </div>
                </div>
            )}

            {/* Mobile steer buttons */}
            <div style={{
                position: 'fixed', bottom: 140, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', gap: 12, pointerEvents: 'auto',
            }}>
                <button
                    onPointerDown={() => onTurnLeft?.()}
                    style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'rgba(0,245,255,0.15)',
                        border: '2px solid rgba(0,245,255,0.5)',
                        color: '#00f5ff', fontSize: 22, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >↺</button>
                <button
                    onPointerDown={() => onTurnRight?.()}
                    style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'rgba(0,245,255,0.15)',
                        border: '2px solid rgba(0,245,255,0.5)',
                        color: '#00f5ff', fontSize: 22, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >↻</button>
            </div>

            <style>{`
        @keyframes holonomy-pop {
          from { transform: translate(-50%,-50%) scale(0.6); opacity: 0; }
          to   { transform: translate(-50%,-50%) scale(1);   opacity: 1; }
        }
      `}</style>
        </div>
    );
}
