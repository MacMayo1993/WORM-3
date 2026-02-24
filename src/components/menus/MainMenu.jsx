import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import IntroCubie from '../intro/IntroCubie.jsx';
import IntroTunnel from '../../manifold/IntroTunnel.jsx';
import { FACE_COLORS } from '../../utils/constants.js';

// ─── Antipodal helpers (same as before) ──────────────────────────────────────
const ANTIPODAL_FACES = { PZ:'NZ', NZ:'PZ', PX:'NX', NX:'PX', PY:'NY', NY:'PY' };
const FACE_COLOR_MAP  = { PZ:1, NZ:4, PX:5, NX:2, PY:3, NY:6 };

const getStickerOffset = (face) => {
  const o = 0.53;
  switch (face) {
    case 'PZ': return [0,0,o];   case 'NZ': return [0,0,-o];
    case 'PX': return [o,0,0];   case 'NX': return [-o,0,0];
    case 'PY': return [0,o,0];   case 'NY': return [0,-o,0];
    default:   return [0,0,0];
  }
};

// ─── 3-D rotating cube (reused from before, slightly tuned) ──────────────────
const MenuCubeBackground = () => {
  const size = 3;
  const [flipStates, setFlipStates] = useState({});
  const [tunnels, setTunnels]       = useState([]);
  const cubieRefs = useRef({});

  const items = useMemo(() => {
    const k = (size - 1) / 2;
    const result = [];
    for (let x=0;x<size;x++) for (let y=0;y<size;y++) for (let z=0;z<size;z++)
      result.push({ key:`${x}-${y}-${z}`, pos:[x-k,y-k,z-k], x,y,z });
    return result;
  }, []);

  useEffect(() => {
    const flipDuration  = 900;
    const interval      = 2800;
    const activeFlips   = new Map();
    const activeTunnels = new Map();
    let animId;

    const triggerFlips = () => {
      const n = Math.floor(Math.random()*2)+2;
      for (let i=0;i<n;i++) {
        const item   = items[Math.floor(Math.random()*items.length)];
        const faces  = ['PZ','NZ','PX','NX','PY','NY'];
        const face   = faces[Math.floor(Math.random()*faces.length)];
        const antiF  = ANTIPODAL_FACES[face];
        const antiX  = size-1-item.x, antiY = size-1-item.y, antiZ = size-1-item.z;
        const antiKey= `${antiX}-${antiY}-${antiZ}`;
        const now    = Date.now();
        activeFlips.set(item.key,  { face, startTime:now, endTime:now+flipDuration, item });
        const tk = `${item.key}-${face}`;
        activeTunnels.set(tk, {
          key:tk, cubieKey1:item.key, cubieKey2:antiKey,
          face1:face, face2:antiF,
          offset1:getStickerOffset(face), offset2:getStickerOffset(antiF),
          color1:FACE_COLORS[FACE_COLOR_MAP[face]], color2:FACE_COLORS[FACE_COLOR_MAP[antiF]],
          startTime:now, endTime:now+flipDuration,
        });
      }
    };

    const animate = () => {
      const now = Date.now();
      const newFlips = {};
      const curTunnels = [];

      activeFlips.forEach((flip, key) => {
        if (now >= flip.endTime) { activeFlips.delete(key); return; }
        const p = (now-flip.startTime)/flipDuration;
        const e = p<0.5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
        newFlips[key] = { rotation:{[flip.face]:e*Math.PI}, antipodal: p>0.5?{[flip.face]:true}:{} };
      });

      activeTunnels.forEach((t, key) => {
        if (now >= t.endTime) { activeTunnels.delete(key); return; }
        const p = (now-t.startTime)/flipDuration;
        const formation = p<0.5 ? p*2 : (1-p)*2;
        const c1 = cubieRefs.current[t.cubieKey1];
        const c2 = cubieRefs.current[t.cubieKey2];
        if (c1&&c2) {
          curTunnels.push({
            key:t.key,
            start:[c1.position.x+t.offset1[0], c1.position.y+t.offset1[1], c1.position.z+t.offset1[2]],
            end:  [c2.position.x+t.offset2[0], c2.position.y+t.offset2[1], c2.position.z+t.offset2[2]],
            color1:t.color1, color2:t.color2, formation, opacity:0.8,
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
            cubieFlips={fs?.rotation||{}}
            antipodalSwaps={fs?.antipodal||{}}
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
        groupRef.current.rotation.x = Math.sin(Date.now()*0.00025)*0.12 + 0.25;
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
        gap: '6px',
        padding: '14px 8px',
        background: hovered
          ? 'rgba(255,255,255,0.08)'
          : 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        boxShadow: hovered ? `0 0 24px ${color}33` : 'none',
      }}
    >
      <span style={{ fontSize: '24px', lineHeight: 1 }}>{icon}</span>
      <span style={{
        fontSize: '13px',
        fontWeight: 500,
        color: hovered ? color : 'rgba(255,255,255,0.7)',
        fontFamily: "'Courier New', monospace",
        letterSpacing: '0.05em',
        transition: 'color 0.2s',
      }}>
        {label}
      </span>
    </button>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const MainMenu = ({ onPlay, onLevels, onFreeplay, onCoop, onSettings, onBiome, onDisparity }) => {
  const [titleVisible,    setTitleVisible]    = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [btnVisible,      setBtnVisible]      = useState(false);
  const [hoverEnter,      setHoverEnter]      = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setTitleVisible(true),    200);
    const t2 = setTimeout(() => setSubtitleVisible(true), 500);
    const t3 = setTimeout(() => setBtnVisible(true),      800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#05050f',
      zIndex: 9999,
      overflow: 'hidden',
      fontFamily: "'Courier New', 'Lucida Console', monospace",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>

      {/* ── Starfield background ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(30,20,80,0.7) 0%, transparent 70%),' +
          'radial-gradient(ellipse 60% 40% at 80% 70%, rgba(80,10,40,0.4) 0%, transparent 60%),' +
          'radial-gradient(ellipse 50% 50% at 20% 80%, rgba(10,30,80,0.4) 0%, transparent 60%),' +
          '#05050f',
        pointerEvents: 'none',
      }} />

      {/* Subtle grid lines */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage:
          'linear-gradient(rgba(100,120,255,0.04) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(100,120,255,0.04) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
      }} />

      {/* ── 3D Cube canvas (center stage) ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // push cube up slightly so UI doesn't overlap
        paddingBottom: '80px',
      }}>
        {/* Glow halo behind cube */}
        <div style={{
          position: 'absolute',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(180,160,255,0.12) 0%, rgba(60,80,220,0.06) 40%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {/* Floor reflection line */}
        <div style={{
          position: 'absolute',
          bottom: 'calc(50% - 210px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '300px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(160,140,255,0.3), transparent)',
          pointerEvents: 'none',
        }} />

        <div style={{ width: '440px', height: '440px', maxWidth: '90vw', maxHeight: '50vw' }}>
          <Canvas camera={{ position: [0, 1.8, 9], fov: 42 }}>
            <color attach="background" args={['#00000000']} />
            <ambientLight intensity={0.5} />
            <pointLight position={[5, 8, 6]}  intensity={1.6} color="#ffffff" />
            <pointLight position={[-6, -4, 4]} intensity={0.8} color="#7070ff" />
            <pointLight position={[0, -6, -4]} intensity={0.5} color="#ff4040" />
            <RotatingCube />
            <Environment preset="night" />
          </Canvas>
        </div>
      </div>

      {/* ── Header: title + subtitle ── */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        textAlign: 'center',
        paddingTop: 'max(40px, env(safe-area-inset-top, 40px))',
        opacity:    titleVisible ? 1 : 0,
        transform:  titleVisible ? 'translateY(0)' : 'translateY(-20px)',
        transition: 'all 0.7s cubic-bezier(0.22,1,0.36,1)',
      }}>
        {/* WORM³ — rainbow gradient */}
        <h1 style={{
          margin: 0,
          fontSize: 'clamp(52px, 14vw, 88px)',
          fontWeight: 900,
          letterSpacing: '0.12em',
          lineHeight: 1,
          background:
            'linear-gradient(90deg, #ef4444 0%, #f97316 18%, #eab308 36%, #22c55e 54%, #3b82f6 72%, #a855f7 90%, #ef4444 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontFamily: "'Courier New', monospace",
          filter: 'drop-shadow(0 0 30px rgba(120,100,255,0.4))',
        }}>
          WORM<sup style={{
            fontSize: '0.45em',
            verticalAlign: 'super',
            WebkitTextFillColor: 'transparent',
          }}>3</sup>
        </h1>

        <p style={{
          margin: '10px 0 0',
          fontSize: 'clamp(12px, 2.5vw, 16px)',
          color: 'rgba(200,200,220,0.65)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 400,
          opacity: subtitleVisible ? 1 : 0,
          transform: subtitleVisible ? 'none' : 'translateY(8px)',
          transition: 'all 0.6s ease 0.1s',
        }}>
          — A Cube That Remembers —
        </p>
      </div>

      {/* ── ENTER THE CUBE button ── */}
      <div style={{
        position: 'absolute',
        bottom: '110px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        width: 'min(480px, 88vw)',
        opacity: btnVisible ? 1 : 0,
        transition: 'opacity 0.6s ease',
      }}>
        <button
          onClick={onPlay}
          onMouseEnter={() => setHoverEnter(true)}
          onMouseLeave={() => setHoverEnter(false)}
          style={{
            width: '100%',
            padding: '18px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            fontSize: 'clamp(15px, 3vw, 18px)',
            fontWeight: 700,
            letterSpacing: '0.18em',
            fontFamily: "'Courier New', monospace",
            color: '#ffffff',
            background: hoverEnter
              ? 'rgba(255,255,255,0.12)'
              : 'rgba(20,22,40,0.85)',
            border: hoverEnter
              ? '1.5px solid rgba(180,160,255,0.7)'
              : '1.5px solid rgba(120,100,200,0.4)',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(12px)',
            boxShadow: hoverEnter
              ? '0 0 40px rgba(140,120,255,0.35), inset 0 1px 0 rgba(255,255,255,0.1)'
              : '0 0 20px rgba(80,60,180,0.2)',
          }}
        >
          {/* Play triangle */}
          <svg width="16" height="18" viewBox="0 0 16 18" fill="white">
            <polygon points="0,0 16,9 0,18" />
          </svg>
          ENTER THE CUBE
        </button>
      </div>

      {/* ── Bottom nav: Watch / Explore / World ── */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        padding: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '8px 16px 16px',
          background: 'linear-gradient(to top, rgba(5,5,15,0.95) 0%, rgba(5,5,15,0.6) 70%, transparent 100%)',
          backdropFilter: 'blur(4px)',
        }}>
          {/* Watch */}
          <NavItem
            icon={<WatchIcon />}
            label="Watch"
            color="#f59e0b"
            onClick={onLevels}
            delay={900}
          />
          {/* Explore */}
          <NavItem
            icon={<ExploreIcon />}
            label="Explore"
            color="#22c55e"
            onClick={onFreeplay}
            delay={1050}
          />
          {/* World */}
          <NavItem
            icon={<WorldIcon />}
            label="World"
            color="#60a5fa"
            onClick={onBiome}
            delay={1200}
          />
        </div>
      </div>

      {/* ── Settings gear (bottom-right, above nav) ── */}
      <button
        onClick={onSettings}
        style={{
          position: 'absolute',
          bottom: '108px',
          right: '20px',
          zIndex: 20,
          width: '36px',
          height: '36px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.35)',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
      >
        <GearIcon />
      </button>
    </div>
  );
};

// ─── SVG icons ────────────────────────────────────────────────────────────────

const WatchIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    {/* Lightning bolt */}
    <path d="M13 2L4.5 13.5H11L10 22L20.5 10.5H14L13 2Z"
      fill="#f59e0b" stroke="#f59e0b" strokeWidth="0.5"
      strokeLinejoin="round"/>
  </svg>
);

const ExploreIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    {/* Crystal/gem */}
    <path d="M12 3L19 8.5L16 21H8L5 8.5L12 3Z"
      fill="none" stroke="#22c55e" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M5 8.5H19M12 3L8 8.5M12 3L16 8.5M8 8.5L8 21M16 8.5L16 21"
      stroke="#22c55e" strokeWidth="1" opacity="0.5"/>
  </svg>
);

const WorldIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    {/* City/dome silhouette */}
    <rect x="3" y="14" width="4" height="7" rx="0.5" stroke="#60a5fa" strokeWidth="1.5"/>
    <rect x="10" y="10" width="4" height="11" rx="0.5" stroke="#60a5fa" strokeWidth="1.5"/>
    <rect x="17" y="13" width="4" height="8" rx="0.5" stroke="#60a5fa" strokeWidth="1.5"/>
    {/* Dome arc */}
    <path d="M1 21 Q12 3 23 21" stroke="#60a5fa" strokeWidth="1.5" fill="none" opacity="0.4"/>
    <line x1="1" y1="21" x2="23" y2="21" stroke="#60a5fa" strokeWidth="1.5"/>
  </svg>
);

const GearIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65
     1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0
     9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0
     0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65
     1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65
     1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0
     1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0
     0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

export default MainMenu;
