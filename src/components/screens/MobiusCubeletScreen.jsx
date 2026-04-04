// src/components/screens/MobiusCubeletScreen.jsx
// Full-screen viewer for the Möbius Cubelet visualization.
//
// Shows a 1×1 cubelet at the centre with three Möbius bands — one per
// antipodal face pair — demonstrating how RP² identification works:
// travelling through a face returns you to the opposite face with a half-twist.

import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import MobiusCubelet from '../../3d/MobiusCubelet.jsx';

// Antipodal pair legend entries
const LEGEND = [
  { colorA: '#ef4444', colorB: '#f97316', label: 'Front  ↔  Back', sub: 'Red  /  Orange · Z-axis' },
  { colorA: '#22c55e', colorB: '#3b82f6', label: 'Left  ↔  Right', sub: 'Green  /  Blue · X-axis' },
  { colorA: '#f0f0f0', colorB: '#eab308', label: 'Top  ↔  Bottom', sub: 'White  /  Yellow · Y-axis' },
];

function LegendRow({ colorA, colorB, label, sub }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Two-colour swatch */}
      <div style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: 14, height: 28, background: colorA }} />
        <div style={{ width: 14, height: 28, background: colorB }} />
      </div>
      <div>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'rgba(220,235,255,0.90)',
            fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: 'rgba(160,190,255,0.50)',
            fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
            marginTop: '2px',
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

export default function MobiusCubeletScreen({ onBack }) {
  const [visible, setVisible] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleBack = () => {
    setVisible(false);
    setTimeout(onBack, 320);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(3,5,15,0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        display: 'flex',
        flexDirection: 'column',
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(18px)',
        transition: 'opacity 0.32s ease, transform 0.32s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          flexShrink: 0,
          padding: 'max(18px, env(safe-area-inset-top, 18px)) 20px 0',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Back */}
        <button
          onClick={handleBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px 8px 8px',
            background: 'rgba(120,160,255,0.08)',
            border: '1px solid rgba(120,160,255,0.18)',
            borderRadius: '24px',
            cursor: 'pointer',
            color: 'rgba(180,210,255,0.75)',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(120,160,255,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(120,160,255,0.08)'; }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="rgba(180,210,255,0.75)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        {/* Title block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(20px, 5vw, 30px)',
              fontWeight: 900,
              fontFamily: "'Courier New', monospace",
              letterSpacing: '0.03em',
              background: 'linear-gradient(100deg,#ef4444 0%,#f97316 30%,#3b82f6 65%,#eab308 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Möbius Cubelet
          </h1>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '12px',
              color: 'rgba(160,190,255,0.50)',
              fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
              lineHeight: 1.4,
            }}
          >
            Each face is identified with its antipodal opposite via a half-twist — a Möbius band per axis.
          </p>
        </div>

        {/* Auto-rotate toggle */}
        <button
          onClick={() => setAutoRotate(v => !v)}
          title={autoRotate ? 'Pause rotation' : 'Resume rotation'}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: autoRotate ? 'rgba(120,160,255,0.15)' : 'rgba(120,160,255,0.06)',
            border: `1px solid ${autoRotate ? 'rgba(120,160,255,0.35)' : 'rgba(120,160,255,0.15)'}`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: autoRotate ? 'rgba(160,210,255,0.85)' : 'rgba(120,160,255,0.4)',
            fontSize: '16px',
            transition: 'all 0.2s ease',
          }}
        >
          {autoRotate ? '⏸' : '▶'}
        </button>
      </div>

      {/* ── 3D Canvas ── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <Canvas
          camera={{ position: [0, 0, 5.5], fov: 42 }}
          style={{ width: '100%', height: '100%' }}
          gl={{ antialias: true, alpha: true }}
        >
          <color attach="background" args={['#03050f']} />
          <ambientLight intensity={0.6} />
          <pointLight position={[4, 4, 6]}  intensity={2.5} color="#ffffff" />
          <pointLight position={[-4, -3, -4]} intensity={1.2} color="#6688ff" />
          <pointLight position={[0, 5, -3]}  intensity={0.8} color="#ffcc88" />
          <Suspense fallback={null}>
            <Environment preset="city" />
          </Suspense>
          <MobiusCubelet autoRotate={autoRotate} />
          {!autoRotate && <OrbitControls enablePan={false} minDistance={3} maxDistance={10} />}
        </Canvas>

        {/* Drag hint when auto-rotate is off */}
        {!autoRotate && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '11px',
              color: 'rgba(140,170,255,0.40)',
              fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
              letterSpacing: '0.08em',
              pointerEvents: 'none',
            }}
          >
            Drag to rotate
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 20px max(20px, env(safe-area-inset-bottom, 20px))',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'rgba(140,170,255,0.40)',
            fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
            marginBottom: '4px',
          }}
        >
          Antipodal Pairs · Möbius Bands
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
          {LEGEND.map(row => (
            <LegendRow key={row.sub} {...row} />
          ))}
        </div>
      </div>
    </div>
  );
}
