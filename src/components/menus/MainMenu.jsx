import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import IntroCubie from '../intro/IntroCubie.jsx';
import IntroTunnel from '../../manifold/IntroTunnel.jsx';
import { FACE_COLORS } from '../../utils/constants.js';

// ─── Antipodal helpers ────────────────────────────────────────────────────────
const ANTIPODAL_FACES = { PZ: 'NZ', NZ: 'PZ', PX: 'NX', NX: 'PX', PY: 'NY', NY: 'PY' };
const FACE_COLOR_MAP = { PZ: 1, NZ: 4, PX: 5, NX: 2, PY: 3, NY: 6 };

const getStickerOffset = (face) => {
  const o = 0.53;
  switch (face) {
    case 'PZ': return [0, 0, o];   case 'NZ': return [0, 0, -o];
    case 'PX': return [o, 0, 0];   case 'NX': return [-o, 0, 0];
    case 'PY': return [0, o, 0];   case 'NY': return [0, -o, 0];
    default:   return [0, 0, 0];
  }
};

// ─── 3D rotating cube ────────────────────────────────────────────────────────
const MenuCubeBackground = () => {
  const size = 3;
  const [flipStates, setFlipStates] = useState({});
  const [tunnels, setTunnels] = useState([]);
  const cubieRefs = useRef({});

  const items = useMemo(() => {
    const k = (size - 1) / 2;
    const result = [];
    for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let z = 0; z < size; z++)
      result.push({ key: `${x}-${y}-${z}`, pos: [x - k, y - k, z - k], x, y, z });
    return result;
  }, []);

  useEffect(() => {
    const flipDuration = 900;
    const interval = 2800;
    const activeFlips = new Map();
    const activeTunnels = new Map();
    let animId;

    const triggerFlips = () => {
      const n = Math.floor(Math.random() * 2) + 2;
      for (let i = 0; i < n; i++) {
        const item = items[Math.floor(Math.random() * items.length)];
        const faces = ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY'];
        const face = faces[Math.floor(Math.random() * faces.length)];
        const antiF = ANTIPODAL_FACES[face];
        const antiX = size - 1 - item.x, antiY = size - 1 - item.y, antiZ = size - 1 - item.z;
        const antiKey = `${antiX}-${antiY}-${antiZ}`;
        const now = Date.now();
        activeFlips.set(item.key, { face, startTime: now, endTime: now + flipDuration, item });
        const tk = `${item.key}-${face}`;
        activeTunnels.set(tk, {
          key: tk, cubieKey1: item.key, cubieKey2: antiKey,
          face1: face, face2: antiF,
          offset1: getStickerOffset(face), offset2: getStickerOffset(antiF),
          color1: FACE_COLORS[FACE_COLOR_MAP[face]], color2: FACE_COLORS[FACE_COLOR_MAP[antiF]],
          startTime: now, endTime: now + flipDuration,
        });
      }
    };

    const animate = () => {
      const now = Date.now();
      const newFlips = {};
      const curTunnels = [];

      activeFlips.forEach((flip, key) => {
        if (now >= flip.endTime) { activeFlips.delete(key); return; }
        const p = (now - flip.startTime) / flipDuration;
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        newFlips[key] = { rotation: { [flip.face]: e * Math.PI }, antipodal: p > 0.5 ? { [flip.face]: true } : {} };
      });

      activeTunnels.forEach((t, key) => {
        if (now >= t.endTime) { activeTunnels.delete(key); return; }
        const p = (now - t.startTime) / flipDuration;
        const formation = p < 0.5 ? p * 2 : (1 - p) * 2;
        const c1 = cubieRefs.current[t.cubieKey1];
        const c2 = cubieRefs.current[t.cubieKey2];
        if (c1 && c2) {
          curTunnels.push({
            key: t.key,
            start: [c1.position.x + t.offset1[0], c1.position.y + t.offset1[1], c1.position.z + t.offset1[2]],
            end: [c2.position.x + t.offset2[0], c2.position.y + t.offset2[1], c2.position.z + t.offset2[2]],
            color1: t.color1, color2: t.color2, formation, opacity: 0.8,
          });
        }
      });

      setFlipStates(newFlips);
      setTunnels(curTunnels);
      animId = requestAnimationFrame(animate);
    };

    animate();
    const iv = setInterval(triggerFlips, interval);
    const init = setTimeout(triggerFlips, 600);
    return () => { cancelAnimationFrame(animId); clearInterval(iv); clearTimeout(init); };
  }, [items]);

  return (
    <group rotation={[0.25, 0, 0]}>
      {items.map(it => {
        const fs = flipStates[it.key];
        return (
          <IntroCubie
            key={it.key}
            ref={el => { cubieRefs.current[it.key] = el; }}
            position={it.pos}
            size={size}
            explosionFactor={0}
            cubieFlips={fs?.rotation || {}}
            antipodalSwaps={fs?.antipodal || {}}
          />
        );
      })}
      {tunnels.map(t => (
        <IntroTunnel key={t.key} start={t.start} end={t.end}
          color1={t.color1} color2={t.color2}
          opacity={t.opacity} formation={t.formation}
        />
      ))}
    </group>
  );
};

const RotatingCube = () => {
  const groupRef = useRef();
  useEffect(() => {
    let id;
    const tick = () => {
      if (groupRef.current) {
        groupRef.current.rotation.y += 0.004;
        groupRef.current.rotation.x = Math.sin(Date.now() * 0.00025) * 0.12 + 0.25;
      }
      id = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(id);
  }, []);
  return <group ref={groupRef}><MenuCubeBackground /></group>;
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
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
        padding: '12px 8px',
        background: hovered ? `${color}18` : 'transparent',
        border: `1px solid ${hovered ? color + '55' : 'transparent'}`,
        borderRadius: '14px',
        cursor: 'pointer',
        transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: visible ? 1 : 0,
        transform: visible
          ? (hovered ? 'translateY(-2px)' : 'translateY(0)')
          : 'translateY(16px)',
      }}
    >
      <span style={{ fontSize: '22px', lineHeight: 1 }}>{icon}</span>
      <span style={{
        fontSize: '11px',
        fontWeight: 600,
        color: hovered ? color : 'rgba(255,255,255,0.4)',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        transition: 'color 0.22s',
      }}>
        {label}
      </span>
    </button>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const MainMenu = ({ onPlay, onLevels, onFreeplay, _onCoop, onSettings, onBiome, _onDisparity }) => {
  const [titleVisible, setTitleVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [btnVisible, setBtnVisible] = useState(false);
  const [hoverEnter, setHoverEnter] = useState(false);
  const [pressEnter, setPressEnter] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setTitleVisible(true), 200);
    const t2 = setTimeout(() => setSubtitleVisible(true), 500);
    const t3 = setTimeout(() => setBtnVisible(true), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#06060f',
      zIndex: 9999,
      overflow: 'hidden',
      fontFamily: "'Courier New', 'Lucida Console', monospace",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>

      {/* ── Ambient background glow ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(ellipse 65% 50% at 50% 20%, rgba(80,60,220,0.14) 0%, transparent 65%),' +
          'radial-gradient(ellipse 45% 35% at 85% 72%, rgba(180,50,90,0.07) 0%, transparent 55%),' +
          'radial-gradient(ellipse 40% 40% at 12% 82%, rgba(20,70,200,0.07) 0%, transparent 55%)',
        pointerEvents: 'none',
      }} />

      {/* Dot grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(rgba(180,180,255,0.065) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        pointerEvents: 'none',
      }} />

      {/* ── Settings — top right ── */}
      <button
        onClick={onSettings}
        style={{
          position: 'absolute',
          top: 'max(16px, env(safe-area-inset-top, 16px))',
          right: '20px',
          zIndex: 20,
          width: '38px',
          height: '38px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          backdropFilter: 'blur(10px)',
          padding: 0,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.11)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
        }}
      >
        <GearIcon />
      </button>

      {/* ── 3D Cube canvas ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: '70px',
      }}>
        {/* Soft glow halo behind cube */}
        <div style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(100,85,255,0.09) 0%, rgba(60,80,220,0.04) 45%, transparent 72%)',
          pointerEvents: 'none',
        }} />
        <div style={{ width: '420px', height: '420px', maxWidth: '88vw', maxHeight: '48vw' }}>
          <Canvas camera={{ position: [0, 1.8, 9], fov: 42 }}>
            <color attach="background" args={['#00000000']} />
            <ambientLight intensity={0.5} />
            <pointLight position={[5, 8, 6]} intensity={1.6} color="#ffffff" />
            <pointLight position={[-6, -4, 4]} intensity={0.8} color="#7070ff" />
            <pointLight position={[0, -6, -4]} intensity={0.5} color="#ff4040" />
            <RotatingCube />
            <Environment preset="night" />
          </Canvas>
        </div>
      </div>

      {/* ── Title + subtitle ── */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        textAlign: 'center',
        paddingTop: 'max(48px, env(safe-area-inset-top, 48px))',
        opacity: titleVisible ? 1 : 0,
        transform: titleVisible ? 'translateY(0)' : 'translateY(-18px)',
        transition: 'all 0.75s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        {/* WORM³ rainbow title */}
        <h1 style={{
          margin: 0,
          fontSize: 'clamp(54px, 14vw, 92px)',
          fontWeight: 900,
          letterSpacing: '0.1em',
          lineHeight: 1,
          background: 'linear-gradient(100deg, #ef4444 0%, #f97316 18%, #eab308 36%, #22c55e 54%, #3b82f6 72%, #a855f7 90%, #ef4444 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontFamily: "'Courier New', monospace",
        }}>
          WORM<sup style={{ fontSize: '0.42em', verticalAlign: 'super', WebkitTextFillColor: 'transparent' }}>3</sup>
        </h1>

        {/* Thin divider */}
        <div style={{
          margin: '14px auto 0',
          width: 'clamp(60px, 16vw, 140px)',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(160,140,255,0.45), transparent)',
          opacity: subtitleVisible ? 1 : 0,
          transition: 'opacity 0.5s ease 0.1s',
        }} />

        {/* Subtitle */}
        <p style={{
          margin: '10px 0 0',
          fontSize: 'clamp(10px, 2vw, 13px)',
          color: 'rgba(200,200,220,0.45)',
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          fontWeight: 500,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
          opacity: subtitleVisible ? 1 : 0,
          transform: subtitleVisible ? 'none' : 'translateY(6px)',
          transition: 'all 0.5s ease 0.1s',
        }}>
          A Cube That Remembers
        </p>
      </div>

      {/* ── ENTER THE CUBE button ── */}
      <div style={{
        position: 'absolute',
        bottom: '106px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        width: 'min(380px, 82vw)',
        opacity: btnVisible ? 1 : 0,
        transition: 'opacity 0.55s ease',
      }}>
        <button
          onClick={onPlay}
          onMouseEnter={() => setHoverEnter(true)}
          onMouseLeave={() => { setHoverEnter(false); setPressEnter(false); }}
          onMouseDown={() => setPressEnter(true)}
          onMouseUp={() => setPressEnter(false)}
          style={{
            width: '100%',
            padding: '16px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'clamp(13px, 2.6vw, 15px)',
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
            color: hoverEnter ? '#ffffff' : 'rgba(255,255,255,0.88)',
            background: hoverEnter
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(255,255,255,0.05)',
            border: `1px solid ${hoverEnter ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '100px',
            cursor: 'pointer',
            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
            backdropFilter: 'blur(16px)',
            transform: pressEnter
              ? 'scale(0.975)'
              : hoverEnter
                ? 'translateY(-2px)'
                : 'none',
            boxShadow: hoverEnter
              ? '0 8px 36px rgba(120,100,255,0.28), 0 2px 8px rgba(0,0,0,0.25)'
              : '0 2px 10px rgba(0,0,0,0.18)',
          }}
        >
          Enter the Cube
        </button>
      </div>

      {/* ── Bottom nav: Watch / Explore / World ── */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        padding: '0 14px',
        paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))',
      }}>
        {/* Fade above nav */}
        <div style={{
          position: 'absolute',
          top: '-56px',
          left: 0,
          right: 0,
          height: '56px',
          background: 'linear-gradient(to top, rgba(6,6,15,0.85), transparent)',
          pointerEvents: 'none',
        }} />

        <div style={{
          display: 'flex',
          gap: '6px',
          padding: '8px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '18px',
          backdropFilter: 'blur(20px)',
        }}>
          <NavItem icon={<WatchIcon />}   label="Watch"   color="#f59e0b" onClick={onLevels}   delay={900} />
          <NavItem icon={<ExploreIcon />} label="Explore" color="#22c55e" onClick={onFreeplay} delay={1050} />
          <NavItem icon={<WorldIcon />}   label="World"   color="#60a5fa" onClick={onBiome}    delay={1200} />
        </div>
      </div>
    </div>
  );
};

// ─── SVG icons ────────────────────────────────────────────────────────────────

const WatchIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M13 2L4.5 13.5H11L10 22L20.5 10.5H14L13 2Z"
      fill="#f59e0b" stroke="#f59e0b" strokeWidth="0.5" strokeLinejoin="round" />
  </svg>
);

const ExploreIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M12 3L19 8.5L16 21H8L5 8.5L12 3Z"
      fill="none" stroke="#22c55e" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M5 8.5H19M12 3L8 8.5M12 3L16 8.5M8 8.5L8 21M16 8.5L16 21"
      stroke="#22c55e" strokeWidth="1" opacity="0.5" />
  </svg>
);

const WorldIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="14" width="4" height="7" rx="0.5" stroke="#60a5fa" strokeWidth="1.5" />
    <rect x="10" y="10" width="4" height="11" rx="0.5" stroke="#60a5fa" strokeWidth="1.5" />
    <rect x="17" y="13" width="4" height="8" rx="0.5" stroke="#60a5fa" strokeWidth="1.5" />
    <path d="M1 21 Q12 3 23 21" stroke="#60a5fa" strokeWidth="1.5" fill="none" opacity="0.4" />
    <line x1="1" y1="21" x2="23" y2="21" stroke="#60a5fa" strokeWidth="1.5" />
  </svg>
);

const GearIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65
     1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0
     9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0
     0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65
     1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65
     1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0
     1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0
     0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export default MainMenu;
