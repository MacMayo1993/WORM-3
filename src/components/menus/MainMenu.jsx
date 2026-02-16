import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import IntroCubie from '../intro/IntroCubie.jsx';

// Rotating cube background component
const MenuCubeBackground = () => {
  const size = 3;
  const items = [];
  const k = (size - 1) / 2;

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        items.push({ key: `${x}-${y}-${z}`, pos: [x - k, y - k, z - k] });
      }
    }
  }

  return (
    <group rotation={[0.3, 0, 0]}>
      {items.map((it) => (
        <IntroCubie
          key={it.key}
          position={it.pos}
          size={size}
          explosionFactor={0}
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

const MainMenu = ({ onPlay, onLevels, onFreeplay, onCoop, onTeach, onSettings, onHelp }) => {
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
      background: 'linear-gradient(to right, #e5e5e5 1px, transparent 1px), linear-gradient(to bottom, #e5e5e5 1px, transparent 1px), #f5f5f5',
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
        background: 'radial-gradient(ellipse at center, rgba(245,245,245,0.3) 0%, rgba(245,245,245,0.6) 70%, rgba(245,245,245,0.85) 100%)',
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
