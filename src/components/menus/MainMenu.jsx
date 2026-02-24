import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import IntroCubie from '../intro/IntroCubie.jsx';
import IntroTunnel from '../../manifold/IntroTunnel.jsx';
import { FACE_COLORS } from '../../utils/constants.js';

// ─── Antipodal helpers ────────────────────────────────────────────────────────
const ANTIPODAL_FACES = {
  PZ: 'NZ', NZ: 'PZ',
  PX: 'NX', NX: 'PX',
  PY: 'NY', NY: 'PY',
};

const FACE_COLOR_MAP = {
  PZ: 1, NZ: 4,
  PX: 5, NX: 2,
  PY: 3, NY: 6,
};

const getStickerOffset = (face) => {
  const o = 0.53;
  switch (face) {
    case 'PZ': return [0, 0, o];
    case 'NZ': return [0, 0, -o];
    case 'PX': return [o, 0, 0];
    case 'NX': return [-o, 0, 0];
    case 'PY': return [0, o, 0];
    case 'NY': return [0, -o, 0];
    default:   return [0, 0, 0];
  }
};

// ─── 3D hero cube with occasional flip animations ─────────────────────────────
const HeroCubeBackground = () => {
  const size = 3;
  const [flipStates, setFlipStates] = useState({});
  const [tunnels, setTunnels] = useState([]);
  const cubieRefs = useRef({});

  const items = useMemo(() => {
    const k = (size - 1) / 2;
    const result = [];
    for (let x = 0; x < size; x++)
      for (let y = 0; y < size; y++)
        for (let z = 0; z < size; z++)
          result.push({ key: `${x}-${y}-${z}`, pos: [x - k, y - k, z - k], x, y, z });
    return result;
  }, []);

  useEffect(() => {
    const flipDuration = 800;
    const timeBetweenFlips = 2800;
    const activeFlips = new Map();
    const activeTunnels = new Map();
    let animationId;

    const triggerRandomFlips = () => {
      const numFlips = Math.floor(Math.random() * 2) + 2;
      const now = Date.now();
      for (let i = 0; i < numFlips; i++) {
        const item = items[Math.floor(Math.random() * items.length)];
        const faces = ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY'];
        const face = faces[Math.floor(Math.random() * faces.length)];
        const antipodalFace = ANTIPODAL_FACES[face];
        const antiX = size - 1 - item.x;
        const antiY = size - 1 - item.y;
        const antiZ = size - 1 - item.z;
        const antiKey = `${antiX}-${antiY}-${antiZ}`;
        activeFlips.set(item.key, { face, startTime: now, endTime: now + flipDuration, item });
        const tunnelKey = `${item.key}-${face}`;
        activeTunnels.set(tunnelKey, {
          key: tunnelKey,
          cubieKey1: item.key,
          cubieKey2: antiKey,
          face1: face,
          face2: antipodalFace,
          offset1: getStickerOffset(face),
          offset2: getStickerOffset(antipodalFace),
          color1: FACE_COLORS[FACE_COLOR_MAP[face]],
          color2: FACE_COLORS[FACE_COLOR_MAP[antipodalFace]],
          startTime: now,
          endTime: now + flipDuration,
        });
      }
    };

    const animate = () => {
      const now = Date.now();
      const newFlips = {};
      const currentTunnels = [];
      activeFlips.forEach((flip, key) => {
        if (now >= flip.endTime) {
          activeFlips.delete(key);
        } else {
          const p = (now - flip.startTime) / flipDuration;
          const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          newFlips[key] = {
            rotation: { [flip.face]: eased * Math.PI },
            antipodal: p > 0.5 ? { [flip.face]: true } : {},
          };
        }
      });
      activeTunnels.forEach((tunnel, key) => {
        if (now >= tunnel.endTime) {
          activeTunnels.delete(key);
        } else {
          const p = (now - tunnel.startTime) / flipDuration;
          const formation = p < 0.5 ? p * 2 : (1 - p) * 2;
          const c1 = cubieRefs.current[tunnel.cubieKey1];
          const c2 = cubieRefs.current[tunnel.cubieKey2];
          if (c1 && c2) {
            currentTunnels.push({
              key: tunnel.key,
              start: [c1.position.x + tunnel.offset1[0], c1.position.y + tunnel.offset1[1], c1.position.z + tunnel.offset1[2]],
              end:   [c2.position.x + tunnel.offset2[0], c2.position.y + tunnel.offset2[1], c2.position.z + tunnel.offset2[2]],
              color1: tunnel.color1,
              color2: tunnel.color2,
              formation,
              opacity: 0.8,
            });
          }
        }
      });
      setFlipStates(newFlips);
      setTunnels(currentTunnels);
      animationId = requestAnimationFrame(animate);
    };

    animate();
    const flipInterval = setInterval(triggerRandomFlips, timeBetweenFlips);
    const initialTimer = setTimeout(triggerRandomFlips, 600);
    return () => {
      cancelAnimationFrame(animationId);
      clearInterval(flipInterval);
      clearTimeout(initialTimer);
    };
  }, [items]);

  return (
    <group rotation={[0.25, 0, 0]}>
      {items.map((it) => {
        const flipState = flipStates[it.key];
        return (
          <IntroCubie
            key={it.key}
            ref={(el) => { cubieRefs.current[it.key] = el; }}
            position={it.pos}
            size={size}
            explosionFactor={0}
            cubieFlips={flipState?.rotation || {}}
            antipodalSwaps={flipState?.antipodal || {}}
          />
        );
      })}
      {tunnels.map((t) => (
        <IntroTunnel key={t.key} start={t.start} end={t.end} color1={t.color1} color2={t.color2} opacity={t.opacity} formation={t.formation} />
      ))}
    </group>
  );
};

// Slow auto-rotating wrapper
const RotatingHeroCube = () => {
  const groupRef = useRef();
  useEffect(() => {
    let id;
    const tick = () => {
      if (groupRef.current) {
        groupRef.current.rotation.y += 0.004;
        groupRef.current.rotation.x = Math.sin(Date.now() * 0.0003) * 0.08 + 0.25;
      }
      id = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <group ref={groupRef}>
      <HeroCubeBackground />
    </group>
  );
};

// ─── Bottom nav button ─────────────────────────────────────────────────────────
const NavButton = ({ icon, label, onClick, accentColor, delay }) => {
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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '12px 20px',
        borderRadius: '12px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease, background 0.2s ease',
        background: hovered ? `rgba(${accentColor}, 0.12)` : 'transparent',
      }}
    >
      <span style={{
        fontSize: '22px',
        lineHeight: 1,
        filter: hovered ? `drop-shadow(0 0 8px rgba(${accentColor}, 0.9))` : 'none',
        transition: 'filter 0.2s ease',
      }}>
        {icon}
      </span>
      <span style={{
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: hovered ? `rgb(${accentColor})` : 'rgba(255,255,255,0.45)',
        fontFamily: "'Roboto Mono', 'Courier New', monospace",
        transition: 'color 0.2s ease',
      }}>
        {label}
      </span>
    </button>
  );
};

// ─── Main menu ─────────────────────────────────────────────────────────────────
const MainMenu = ({ onPlay, onLevels, onFreeplay, onCoop, onSettings, onBiome, onDisparity }) => {
  const [titleVisible, setTitleVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);
  const [ctaHovered, setCtaHovered] = useState(false);
  const [settingsHovered, setSettingsHovered] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setTitleVisible(true), 120);
    const t2 = setTimeout(() => setSubtitleVisible(true), 420);
    const t3 = setTimeout(() => setCtaVisible(true), 700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#05050f',
      zIndex: 9999,
      overflow: 'hidden',
      fontFamily: "'Roboto', 'Google Sans', -apple-system, sans-serif",
    }}>

      {/* ── Nebula / glow background layers ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: [
          'radial-gradient(ellipse 70% 55% at 50% 30%, rgba(80,20,120,0.45) 0%, transparent 70%)',
          'radial-gradient(ellipse 50% 40% at 20% 80%, rgba(120,20,40,0.3) 0%, transparent 60%)',
          'radial-gradient(ellipse 40% 35% at 80% 75%, rgba(20,40,120,0.25) 0%, transparent 60%)',
        ].join(', '),
        pointerEvents: 'none',
      }} />

      {/* Subtle grid overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(100,80,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(100,80,255,0.05) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />

      {/* ── 3D hero cube ── */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {/* Glow halo behind cube */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -58%)',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(120,60,220,0.22) 0%, rgba(80,20,140,0.12) 40%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <Canvas camera={{ position: [0, 2, 10], fov: 42 }}>
          <color attach="background" args={['#05050f']} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 8, 5]} intensity={1.0} />
          <pointLight position={[0, 0, 6]} intensity={0.6} color="#a855f7" />
          <pointLight position={[-6, 4, -4]} intensity={0.4} color="#3b82f6" />
          <RotatingHeroCube />
          <Environment preset="city" />
        </Canvas>

        {/* Reflection / ground fade */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '38%',
          background: 'linear-gradient(to top, #05050f 0%, #05050f 30%, transparent 100%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── UI layer ── */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
      }}>

        {/* Title block */}
        <div style={{
          marginTop: 'clamp(32px, 6vh, 56px)',
          textAlign: 'center',
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? 'translateY(0)' : 'translateY(-24px)',
          transition: 'opacity 0.9s ease-out, transform 0.9s ease-out',
          pointerEvents: 'auto',
        }}>
          <h1 style={{
            fontSize: 'clamp(52px, 13vw, 108px)',
            fontWeight: 800,
            margin: 0,
            lineHeight: 1,
            background: 'linear-gradient(135deg, #e53935 0%, #fb8c00 18%, #fdd835 36%, #43a047 54%, #1e88e5 72%, #8e24aa 90%, #e53935 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontFamily: "'Roboto Mono', 'Courier New', monospace",
            letterSpacing: '0.06em',
            filter: 'drop-shadow(0 0 24px rgba(168,85,247,0.4))',
          }}>
            WORM³
          </h1>

          <p style={{
            margin: '12px 0 0',
            fontSize: 'clamp(11px, 2.2vw, 14px)',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.38)',
            fontFamily: "'Roboto Mono', 'Courier New', monospace",
            fontWeight: 400,
            opacity: subtitleVisible ? 1 : 0,
            transform: subtitleVisible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
          }}>
            — A Cube That Remembers —
          </p>
        </div>

        {/* Spacer — cube lives in the absolute layer behind */}
        <div style={{ flex: 1 }} />

        {/* ── Bottom UI area ── */}
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingBottom: 'clamp(20px, 4vh, 36px)',
          gap: '0',
          pointerEvents: 'auto',
        }}>

          {/* ENTER THE CUBE CTA */}
          <button
            onClick={onPlay}
            onMouseEnter={() => setCtaHovered(true)}
            onMouseLeave={() => setCtaHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              width: 'clamp(260px, 56vw, 380px)',
              padding: '18px 36px',
              fontSize: 'clamp(14px, 2.6vw, 17px)',
              fontWeight: 700,
              fontFamily: "'Roboto Mono', 'Courier New', monospace",
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              border: `1px solid ${ctaHovered ? 'rgba(168,85,247,0.8)' : 'rgba(168,85,247,0.35)'}`,
              borderRadius: '10px',
              background: ctaHovered
                ? 'rgba(168,85,247,0.18)'
                : 'rgba(10,6,20,0.75)',
              color: '#ffffff',
              cursor: 'pointer',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: ctaHovered
                ? '0 0 32px rgba(168,85,247,0.35), inset 0 0 20px rgba(168,85,247,0.08)'
                : '0 4px 24px rgba(0,0,0,0.5)',
              opacity: ctaVisible ? 1 : 0,
              transform: ctaVisible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.6s ease, transform 0.6s ease, border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease',
              marginBottom: '20px',
            }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>▶</span>
            Enter the Cube
          </button>

          {/* Bottom nav row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0',
            width: '100%',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            paddingTop: '8px',
            position: 'relative',
          }}>
            <NavButton icon="⚡" label="Watch"   onClick={onLevels}    accentColor="253,224,71"   delay={900} />
            <NavButton icon="◈"  label="Explore" onClick={onFreeplay}  accentColor="129,209,255"  delay={1050} />
            <NavButton icon="🏙" label="World"   onClick={onBiome}     accentColor="134,239,172"  delay={1200} />

            {/* Settings gear — absolute right */}
            <button
              onClick={onSettings}
              onMouseEnter={() => setSettingsHovered(true)}
              onMouseLeave={() => setSettingsHovered(false)}
              style={{
                position: 'absolute',
                right: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                color: settingsHovered ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
                transition: 'color 0.2s ease, transform 0.2s ease',
                padding: '8px',
                lineHeight: 1,
                rotate: settingsHovered ? '60deg' : '0deg',
              }}
              title="Settings"
            >
              ⚙
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
