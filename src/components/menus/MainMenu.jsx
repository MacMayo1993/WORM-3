import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import IntroCubie from '../intro/IntroCubie.jsx';
import IntroTunnel from '../../manifold/IntroTunnel.jsx';
import { FACE_COLORS } from '../../utils/constants.js';

// Antipodal face mapping
const ANTIPODAL_FACES = {
  PZ: 'NZ', NZ: 'PZ',
  PX: 'NX', NX: 'PX',
  PY: 'NY', NY: 'PY',
};

// Face to color ID mapping
const FACE_COLOR_MAP = {
  PZ: 1, // Red
  NZ: 4, // Orange
  PX: 5, // Blue
  NX: 2, // Green
  PY: 3, // White
  NY: 6, // Yellow
};

// Get sticker world position offset from cubie center
const getStickerOffset = (face) => {
  const offset = 0.53; // Same as IntroCubie
  switch (face) {
    case 'PZ': return [0, 0, offset];
    case 'NZ': return [0, 0, -offset];
    case 'PX': return [offset, 0, 0];
    case 'NX': return [-offset, 0, 0];
    case 'PY': return [0, offset, 0];
    case 'NY': return [0, -offset, 0];
    default: return [0, 0, 0];
  }
};

// Rotating cube background component with flip animations and wormhole tunnels
const MenuCubeBackground = () => {
  const size = 3;
  const [flipStates, setFlipStates] = useState({});
  const [tunnels, setTunnels] = useState([]);
  const cubieRefs = useRef({});

  const items = useMemo(() => {
    const k = (size - 1) / 2;
    const result = [];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          result.push({ key: `${x}-${y}-${z}`, pos: [x - k, y - k, z - k], x, y, z });
        }
      }
    }
    return result;
  }, [size]);

  // Animate flip rotations smoothly and track antipodal swaps with wormhole tunnels
  useEffect(() => {
    const flipDuration = 800; // ms for a complete flip
    const timeBetweenFlips = 2500; // ms between flip triggers
    const activeFlips = new Map(); // key -> { face, startTime, endTime, item }
    const activeTunnels = new Map(); // key -> tunnel data
    let animationId;

    const triggerRandomFlips = () => {
      // Pick 2-3 random tiles to flip
      const numFlips = Math.floor(Math.random() * 2) + 2;
      const selectedItems = [];
      for (let i = 0; i < numFlips; i++) {
        const randomItem = items[Math.floor(Math.random() * items.length)];
        selectedItems.push(randomItem);
      }

      // Schedule flip animations and create tunnels for selected tiles
      const now = Date.now();
      selectedItems.forEach((item) => {
        // Randomly choose a face to flip
        const faces = ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY'];
        const face = faces[Math.floor(Math.random() * faces.length)];
        const antipodalFace = ANTIPODAL_FACES[face];

        // Find antipodal partner cubie (opposite corner of cube)
        const antiX = size - 1 - item.x;
        const antiY = size - 1 - item.y;
        const antiZ = size - 1 - item.z;
        const antiKey = `${antiX}-${antiY}-${antiZ}`;

        activeFlips.set(item.key, {
          face,
          startTime: now,
          endTime: now + flipDuration,
          item,
        });

        // Create tunnel data
        const tunnelKey = `${item.key}-${face}`;
        const stickerOffset = getStickerOffset(face);
        const antiStickerOffset = getStickerOffset(antipodalFace);

        activeTunnels.set(tunnelKey, {
          key: tunnelKey,
          cubieKey1: item.key,
          cubieKey2: antiKey,
          face1: face,
          face2: antipodalFace,
          offset1: stickerOffset,
          offset2: antiStickerOffset,
          color1: FACE_COLORS[FACE_COLOR_MAP[face]],
          color2: FACE_COLORS[FACE_COLOR_MAP[antipodalFace]],
          startTime: now,
          endTime: now + flipDuration,
        });
      });
    };

    const animate = () => {
      const now = Date.now();
      const newFlips = {};
      const currentTunnels = [];

      // Update flip rotations and tunnels based on time
      activeFlips.forEach((flip, key) => {
        if (now >= flip.endTime) {
          // Flip animation complete - remove from active flips
          activeFlips.delete(key);
        } else {
          // Calculate flip progress (0 to 1)
          const progress = (now - flip.startTime) / flipDuration;
          // Ease-in-out for smooth animation
          const eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          // Animate from 0 to π (180 degrees)
          const rotation = eased * Math.PI;

          // Show antipodal swap when past halfway point (sticker has flipped over)
          const showAntipodal = progress > 0.5;

          newFlips[key] = {
            rotation: { [flip.face]: rotation },
            antipodal: showAntipodal ? { [flip.face]: true } : {}
          };
        }
      });

      // Update tunnels - remove expired ones
      activeTunnels.forEach((tunnel, key) => {
        if (now >= tunnel.endTime) {
          activeTunnels.delete(key);
        } else {
          // Calculate tunnel formation progress
          const progress = (now - tunnel.startTime) / flipDuration;
          const formation = progress < 0.5 ? progress * 2 : (1 - progress) * 2;

          // Get cubie refs and calculate world positions
          const cubie1 = cubieRefs.current[tunnel.cubieKey1];
          const cubie2 = cubieRefs.current[tunnel.cubieKey2];

          if (cubie1 && cubie2) {
            // Get cubie positions
            const pos1 = cubie1.position;
            const pos2 = cubie2.position;

            // Add sticker offsets
            const start = [
              pos1.x + tunnel.offset1[0],
              pos1.y + tunnel.offset1[1],
              pos1.z + tunnel.offset1[2]
            ];
            const end = [
              pos2.x + tunnel.offset2[0],
              pos2.y + tunnel.offset2[1],
              pos2.z + tunnel.offset2[2]
            ];

            currentTunnels.push({
              key: tunnel.key,
              start,
              end,
              color1: tunnel.color1,
              color2: tunnel.color2,
              formation,
              opacity: 0.7
            });
          }
        }
      });

      setFlipStates(newFlips);
      setTunnels(currentTunnels);
      animationId = requestAnimationFrame(animate);
    };

    // Start animation loop
    animate();

    // Trigger flips periodically
    const flipInterval = setInterval(triggerRandomFlips, timeBetweenFlips);
    // Trigger initial flips after a short delay
    const initialTimer = setTimeout(triggerRandomFlips, 500);

    return () => {
      cancelAnimationFrame(animationId);
      clearInterval(flipInterval);
      clearTimeout(initialTimer);
    };
  }, [items]);

  return (
    <group rotation={[0.3, 0, 0]}>
      {/* Cubies */}
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

      {/* Wormhole Tunnels */}
      {tunnels.map((tunnel) => (
        <IntroTunnel
          key={tunnel.key}
          start={tunnel.start}
          end={tunnel.end}
          color1={tunnel.color1}
          color2={tunnel.color2}
          opacity={tunnel.opacity}
          formation={tunnel.formation}
        />
      ))}
    </group>
  );
};

// Animated rotating wrapper
const RotatingCube = () => {
  const groupRef = React.useRef();

  React.useEffect(() => {
    let animationId;
    const animate = () => {
      if (groupRef.current) {
        groupRef.current.rotation.y += 0.003;
        groupRef.current.rotation.x = Math.sin(Date.now() * 0.0003) * 0.1 + 0.3;
      }
      animationId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <group ref={groupRef}>
      <MenuCubeBackground />
    </group>
  );
};

const MenuButton = ({ children, onClick, delay, icon, primary }) => {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const baseStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '280px',
    padding: '16px 32px',
    fontSize: '16px',
    fontWeight: 500,
    fontFamily: "'Roboto', 'Product Sans', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    letterSpacing: '0.02em',
    border: 'none',
    borderRadius: '8px',
    background: primary
      ? (hovered ? '#1565c0' : '#1e88e5')
      : (hovered ? '#f1f3f4' : '#ffffff'),
    color: primary ? '#ffffff' : '#202124',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    opacity: visible ? 1 : 0,
    transform: visible
      ? hovered ? 'translateY(-2px)' : 'translateY(0)'
      : 'translateY(20px)',
    boxShadow: hovered
      ? '0 2px 8px 0 rgba(60, 64, 67, 0.3), 0 4px 12px 3px rgba(60, 64, 67, 0.15)'
      : '0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)',
  };

  return (
    <button
      style={baseStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {icon && <span style={{ fontSize: '20px' }}>{icon}</span>}
      {children}
    </button>
  );
};

const MainMenu = ({ onPlay, onLevels, onFreeplay, onCoop, onSettings, onHelp }) => {
  const [titleVisible, setTitleVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);

  useEffect(() => {
    const titleTimer = setTimeout(() => setTitleVisible(true), 100);
    const subtitleTimer = setTimeout(() => setSubtitleVisible(true), 400);
    return () => {
      clearTimeout(titleTimer);
      clearTimeout(subtitleTimer);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(to right, #90caf9 1px, transparent 1px), linear-gradient(to bottom, #90caf9 1px, transparent 1px), #e3f2fd',
      backgroundSize: '20px 20px',
      zIndex: 9999,
      overflow: 'hidden',
    }}>
      {/* 3D Cube Background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.3,
      }}>
        <Canvas camera={{ position: [0, 2, 10], fov: 45 }}>
          <color attach="background" args={['#90caf9']} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 8, 5]} intensity={1.2} />
          <pointLight position={[10, 10, 10]} intensity={0.6} />
          <RotatingCube />
          <Environment preset="city" />
        </Canvas>
      </div>

      {/* Subtle Gradient Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(227,242,253,0.3) 0%, rgba(227,242,253,0.6) 70%, rgba(227,242,253,0.85) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Menu Content */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
      }}>
        {/* Title */}
        <div style={{
          textAlign: 'center',
          marginBottom: '60px',
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? 'translateY(0)' : 'translateY(-30px)',
          transition: 'all 0.8s ease-out',
        }}>
          <h1 style={{
            fontSize: 'clamp(48px, 12vw, 96px)',
            fontWeight: 700,
            margin: 0,
            background: 'linear-gradient(135deg, #e53935 0%, #fb8c00 20%, #fdd835 40%, #43a047 60%, #1e88e5 80%, #e53935 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontFamily: "'Roboto', 'Product Sans', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            letterSpacing: '0.08em',
            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
          }}>
            WORM-3
          </h1>
          <p style={{
            fontSize: 'clamp(14px, 3vw, 18px)',
            color: '#5f6368',
            margin: '16px 0 0 0',
            fontFamily: "'Roboto', 'Product Sans', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            letterSpacing: '0.05em',
            fontWeight: 400,
            opacity: subtitleVisible ? 1 : 0,
            transform: subtitleVisible ? 'translateY(0)' : 'translateY(10px)',
            transition: 'all 0.6s ease-out',
          }}>
            A Manifold Puzzle Game
          </p>
        </div>

        {/* Menu Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          alignItems: 'center',
        }}>
          <MenuButton onClick={onPlay} delay={600} icon="▶" primary>
            Play
          </MenuButton>
          <MenuButton onClick={onLevels} delay={750} icon="◈">
            Levels
          </MenuButton>
          <MenuButton onClick={onFreeplay} delay={900} icon="∞">
            Freeplay
          </MenuButton>
          <MenuButton onClick={onCoop} delay={1000} icon="&#9775;">
            Co-op Crawler
          </MenuButton>
          <MenuButton onClick={onSettings} delay={1100} icon="⚙">
            Settings
          </MenuButton>
          <MenuButton onClick={onHelp} delay={1250} icon="?">
            How to Play
          </MenuButton>
        </div>

        {/* Footer */}
        <div style={{
          position: 'absolute',
          bottom: '30px',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: '12px',
          fontFamily: "'Roboto', 'Product Sans', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: '#80868b',
          letterSpacing: '0.02em',
        }}>
          Explore the topology of quotient spaces
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
