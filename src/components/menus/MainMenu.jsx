import React, { useState, useEffect, Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import IntroCubie from '../intro/IntroCubie.jsx';

// All stickers black — same as the opening frames of the intro
const ZERO_REVEAL = { PZ: 0, NZ: 0, PX: 0, NX: 0, PY: 0, NY: 0 };

const BlackCube = () => {
  const items = useMemo(() => {
    const result = [];
    for (let x = 0; x < 3; x++)
      for (let y = 0; y < 3; y++)
        for (let z = 0; z < 3; z++)
          result.push({ key: `${x}-${y}-${z}`, pos: [x-1, y-1, z-1] });
    return result;
  }, []);
  return (
    <>
      {items.map(it => (
        <IntroCubie
          key={it.key}
          position={it.pos}
          size={3}
          explosionFactor={0}
          faceReveal={ZERO_REVEAL}
          cubieFlips={{}}
          antipodalSwaps={{}}
        />
      ))}
    </>
  );
};

// Exactly mirrors the intro rotation: y = t*0.28, x = sin(t*0.15)*0.12
const RotatingBlackCube = () => {
  const groupRef = useRef();
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.y = t * 0.28;
    groupRef.current.rotation.x = Math.sin(t * 0.15) * 0.12;
  });
  return (
    <group ref={groupRef}>
      <BlackCube />
    </group>
  );
};

// ─── Bottom nav item ──────────────────────────────────────────────────────────
const NavItem = ({ icon, label, color, onClick, delay }) => {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <button onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '7px', padding: '16px 8px 14px',
        background: hovered ? 'rgba(18,48,105,0.9)' : 'rgba(10,28,68,0.78)',
        border: `1px solid ${hovered ? color + '60' : 'rgba(60,100,200,0.28)'}`,
        borderRadius: '18px', cursor: 'pointer',
        transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
        opacity: visible ? 1 : 0,
        transform: visible ? (hovered ? 'translateY(-3px) scale(1.02)' : 'none') : 'translateY(20px)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        boxShadow: hovered
          ? '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)'
          : '0 2px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
      <span style={{ fontSize: '26px', lineHeight: 1 }}>{icon}</span>
      <span style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: hovered ? color : 'rgba(160,190,240,0.6)', transition: 'color 0.22s',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
      }}>{label}</span>
    </button>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const MainMenu = ({ onPlay, _onLevels, onFreeplay, _onCoop, onSettings, onBiome, onDisparity }) => {
  const [titleVisible, setTitleVisible]       = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [btnVisible, setBtnVisible]           = useState(false);
  const [hoverEnter, setHoverEnter]           = useState(false);
  const [pressEnter, setPressEnter]           = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setTitleVisible(true), 200);
    const t2 = setTimeout(() => setSubtitleVisible(true), 500);
    const t3 = setTimeout(() => setBtnVisible(true), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05050f', zIndex: 9999, overflow: 'hidden' }}>

      {/* ── Full-screen 3D canvas — same setup as WelcomeScreen ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <Canvas camera={{ position: [0, 3, 12], fov: 40 }}>
          <color attach="background" args={['#05050f']} />
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 10, 10]} intensity={1.8} />
          <pointLight position={[-10, -10, -10]} intensity={1.2} />
          <RotatingBlackCube />
          <Suspense fallback={null}>
            <Environment preset="city" />
          </Suspense>
          <EffectComposer>
            <Bloom intensity={0.6} luminanceThreshold={0.15} luminanceSmoothing={0.85} mipmapBlur />
            <Vignette offset={0.35} darkness={0.75} />
          </EffectComposer>
        </Canvas>
      </div>

      {/* ── UI overlay ── */}
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>

        {/* Settings gear */}
        <button onClick={onSettings} style={{
          position: 'absolute', bottom: 'max(14px, env(safe-area-inset-bottom,14px))', right: '16px',
          zIndex: 20, width: '32px', height: '32px', padding: 0,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '9px', cursor: 'pointer', color: 'rgba(255,255,255,0.28)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s', backdropFilter: 'blur(10px)', pointerEvents: 'all',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.28)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
        ><GearIcon /></button>

        {/* Title */}
        <div style={{
          textAlign: 'center',
          paddingTop: 'max(44px, env(safe-area-inset-top,44px))',
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? 'translateY(0)' : 'translateY(-18px)',
          transition: 'all 0.75s cubic-bezier(0.22,1,0.36,1)',
        }}>
          <h1 style={{
            margin: 0, fontSize: 'clamp(54px,13vw,96px)', fontWeight: 900,
            letterSpacing: '0.1em', lineHeight: 1, fontFamily: "'Courier New', monospace",
            background: 'linear-gradient(100deg,#ef4444 0%,#f97316 18%,#eab308 36%,#22c55e 54%,#3b82f6 72%,#a855f7 90%,#ef4444 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            WORM<sup style={{ fontSize: '0.42em', verticalAlign: 'super', WebkitTextFillColor: 'transparent' }}>3</sup>
          </h1>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '14px',
            opacity: subtitleVisible ? 1 : 0,
            transform: subtitleVisible ? 'none' : 'translateY(6px)',
            transition: 'all 0.55s ease 0.1s',
          }}>
            <div style={{ width: '30px', height: '1px', background: 'linear-gradient(to right, transparent, rgba(140,180,255,0.45))' }} />
            <p style={{
              margin: 0, fontSize: 'clamp(10px,1.7vw,13px)', letterSpacing: '0.26em',
              textTransform: 'uppercase', fontWeight: 500, color: 'rgba(170,205,255,0.5)',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
            }}>A Cube That Remembers</p>
            <div style={{ width: '30px', height: '1px', background: 'linear-gradient(to left, transparent, rgba(140,180,255,0.45))' }} />
          </div>
        </div>

        {/* Enter the Cube button */}
        <div style={{
          position: 'absolute', bottom: '118px', left: '50%', transform: 'translateX(-50%)',
          width: 'min(400px,85vw)', opacity: btnVisible ? 1 : 0, transition: 'opacity 0.55s ease',
          pointerEvents: 'all',
        }}>
          <button onClick={onPlay}
            onMouseEnter={() => setHoverEnter(true)}
            onMouseLeave={() => { setHoverEnter(false); setPressEnter(false); }}
            onMouseDown={() => setPressEnter(true)} onMouseUp={() => setPressEnter(false)}
            style={{
              width: '100%', padding: '17px 32px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              fontSize: 'clamp(13px,2.4vw,15px)', fontWeight: 700, letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
              color: hoverEnter ? '#ffffff' : 'rgba(210,230,255,0.88)',
              background: hoverEnter ? 'rgba(18,52,125,0.92)' : 'rgba(10,32,88,0.85)',
              border: `1px solid ${hoverEnter ? 'rgba(80,140,255,0.55)' : 'rgba(55,105,220,0.32)'}`,
              borderRadius: '100px', cursor: 'pointer',
              transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              transform: pressEnter ? 'scale(0.975)' : hoverEnter ? 'translateY(-2px)' : 'none',
              boxShadow: hoverEnter
                ? '0 8px 40px rgba(30,80,255,0.22),0 2px 8px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.1)'
                : '0 2px 16px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.05)',
            }}>
            <PlayIcon hovered={hoverEnter} />
            Enter the Cube
          </button>
        </div>

        {/* Bottom nav */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom,16px))',
          display: 'flex', gap: '10px', pointerEvents: 'all',
        }}>
          <NavItem icon={<DisparityIcon />} label="Disparity" color="#f59e0b" onClick={onDisparity} delay={900} />
          <NavItem icon={<ExploreIcon />}   label="Explore"   color="#22c55e" onClick={onFreeplay}  delay={1050} />
          <NavItem icon={<WorldIcon />}     label="World"     color="#60a5fa" onClick={onBiome}     delay={1200} />
        </div>
      </div>
    </div>
  );
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const PlayIcon = ({ hovered }) => (
  <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
    <polygon points="2,1 11,6 2,11" fill={hovered ? '#ffffff' : 'rgba(180,210,255,0.8)'} style={{ transition: 'fill 0.2s' }} />
  </svg>
);
const DisparityIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <circle cx="5"  cy="5"  r="1.8" fill="#f59e0b" />
    <circle cx="19" cy="5"  r="1.8" fill="#f59e0b" opacity="0.5" />
    <circle cx="12" cy="12" r="1.8" fill="#f59e0b" />
    <circle cx="5"  cy="19" r="1.8" fill="#f59e0b" opacity="0.5" />
    <circle cx="19" cy="19" r="1.8" fill="#f59e0b" />
    <line x1="5"  y1="5"  x2="19" y2="19" stroke="#f59e0b" strokeWidth="1.2" opacity="0.4" />
    <line x1="19" y1="5"  x2="5"  y2="19" stroke="#f59e0b" strokeWidth="1.2" opacity="0.4" />
  </svg>
);
const ExploreIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <polygon points="12,2 20,10 12,22 4,10" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="12,2 20,10 12,14 4,10" fill="#22c55e" opacity="0.25" />
    <line x1="4" y1="10" x2="20" y2="10" stroke="#22c55e" strokeWidth="1.2" opacity="0.65" />
  </svg>
);
const WorldIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M3 18 Q3 10 12 10 Q21 10 21 18" stroke="#60a5fa" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    <line x1="3"  y1="18" x2="21" y2="18"   stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" />
    <line x1="6"  y1="18" x2="6"  y2="14"   stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="12" y1="18" x2="12" y2="10.5" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="18" y1="18" x2="18" y2="14"   stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const GearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export default MainMenu;
