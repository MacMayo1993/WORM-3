import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import { gsap } from 'gsap';
import BlackHoleEnvironment from '../../3d/BlackHoleEnvironment.jsx';
import { FACE_COLORS } from '../../utils/constants.js';
import { vibrate } from '../../utils/audio.js';

// Simplified cubie for cutscene performance
const CutsceneCubie = ({ position, size, scale = 1, emissiveIntensity = 0 }) => {
  const groupRef = useRef();
  const k = (size - 1) / 2;

  // Determine which faces are visible (on the surface)
  const [x, y, z] = position;
  const faces = [];

  if (x === k) faces.push({ dir: 'PX', color: FACE_COLORS[5], normal: [1, 0, 0] });
  if (x === -k) faces.push({ dir: 'NX', color: FACE_COLORS[2], normal: [-1, 0, 0] });
  if (y === k) faces.push({ dir: 'PY', color: FACE_COLORS[3], normal: [0, 1, 0] });
  if (y === -k) faces.push({ dir: 'NY', color: FACE_COLORS[6], normal: [0, -1, 0] });
  if (z === k) faces.push({ dir: 'PZ', color: FACE_COLORS[1], normal: [0, 0, 1] });
  if (z === -k) faces.push({ dir: 'NZ', color: FACE_COLORS[4], normal: [0, 0, -1] });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Black core */}
      <mesh>
        <boxGeometry args={[0.95, 0.95, 0.95]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Colored stickers */}
      {faces.map((face, idx) => (
        <mesh key={idx} position={face.normal.map(n => n * 0.48)}>
          <planeGeometry args={[0.85, 0.85]} />
          <meshStandardMaterial
            color={face.color}
            emissive={face.color}
            emissiveIntensity={emissiveIntensity}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
};

// Wormhole tunnel effect
const WormholeTunnel = ({ start, end, color, progress, opacity = 1 }) => {
  const ref = useRef();

  const curve = useMemo(() => {
    const midPoint = new THREE.Vector3(
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2 + 2,
      (start[2] + end[2]) / 2
    );
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...start),
      midPoint,
      new THREE.Vector3(...end)
    );
  }, [start, end]);

  useFrame((_state) => {
    if (ref.current) {
      ref.current.material.dashOffset -= 0.02;
    }
  });

  return (
    <mesh ref={ref}>
      <tubeGeometry args={[curve, 32, 0.08, 8, false]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        transparent
        opacity={opacity * progress}
      />
    </mesh>
  );
};

// Particle streak for hyperspace effect
const HyperspaceParticle = ({ position, velocity, color }) => {
  const ref = useRef();
  const startPos = useRef([...position]);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.position.z += velocity * delta;
      if (ref.current.position.z > 50) {
        ref.current.position.z = startPos.current[2];
      }
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[0.02, 0.02, 2 + Math.random() * 3]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} />
    </mesh>
  );
};

// Star field for hyperspace
const HyperspaceStars = ({ count = 200, active }) => {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_) => ({
      position: [
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40,
        Math.random() * -100
      ],
      velocity: 20 + Math.random() * 40,
      color: Math.random() > 0.5 ? '#ffffff' : '#aaccff'
    }));
  }, [count]);

  if (!active) return null;

  return (
    <group>
      {particles.map((p, i) => (
        <HyperspaceParticle key={i} {...p} />
      ))}
    </group>
  );
};

// Chromatic aberration / distortion overlay
const DistortionOverlay = ({ intensity }) => {
  if (intensity <= 0) return null;

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at center,
          transparent 30%,
          rgba(100, 50, 200, ${intensity * 0.15}) 60%,
          rgba(50, 0, 100, ${intensity * 0.3}) 100%)`,
        mixBlendMode: 'screen'
      }} />
    </Html>
  );
};

// Main cutscene 3D scene
const CutsceneScene = ({ progress, onComplete: _onComplete }) => {
  const { camera } = useThree();
  const cubeGroupRef = useRef();
  const size = 5; // 5x5 cube for epic feel
  const tlRef = useRef(null);
  const [blackHolePulse, setBlackHolePulse] = useState(0);
  const [emissive, setEmissive] = useState(0);

  // Phase tracking
  const phase = useMemo(() => {
    if (progress < 20) return 'emergence';      // 0-3s (0-20%)
    if (progress < 53) return 'hyperspace';     // 3-8s (20-53%)
    if (progress < 80) return 'eventHorizon';   // 8-12s (53-80%)
    return 'ignite';                             // 12-15s (80-100%)
  }, [progress]);

  // Wormholes appear during hyperspace
  const wormholes = useMemo(() => {
    if (phase !== 'hyperspace' && phase !== 'eventHorizon') return [];
    return [
      { start: [-3, 2, -10], end: [3, -2, -20], color: '#ff6b6b' },
      { start: [4, -1, -15], end: [-4, 1, -25], color: '#4ecdc4' },
      { start: [0, 3, -18], end: [0, -3, -28], color: '#ffe66d' },
      { start: [-2, -2, -22], end: [2, 2, -32], color: '#95e1d3' },
      { start: [3, 0, -25], end: [-3, 0, -35], color: '#dda0dd' },
    ];
  }, [phase]);

  // Camera and cube animation via GSAP
  useEffect(() => {
    if (!cubeGroupRef.current) return;

    // Kill any existing timeline
    if (tlRef.current) tlRef.current.kill();

    const tl = gsap.timeline();
    tlRef.current = tl;

    // Initial state - very close zoom
    camera.position.set(0, 0, 3);
    cubeGroupRef.current.rotation.set(0, 0, 0);
    cubeGroupRef.current.position.set(0, 0, 0);

    // Phase 1: Emergence (0-3s) - Cube rotates slowly, camera pulls back slightly
    tl.to(cubeGroupRef.current.rotation, {
      y: Math.PI * 0.5,
      x: Math.PI * 0.15,
      duration: 3,
      ease: 'power2.inOut'
    }, 0);
    tl.to(camera.position, {
      z: 5,
      duration: 3,
      ease: 'power2.inOut'
    }, 0);

    // Phase 2: Hyperspace (3-8s) - Cube launches forward, camera follows
    tl.to(cubeGroupRef.current.position, {
      z: -30,
      duration: 5,
      ease: 'power2.in'
    }, 3);
    tl.to(cubeGroupRef.current.rotation, {
      y: Math.PI * 4,
      z: Math.PI * 0.5,
      duration: 5,
      ease: 'power1.inOut'
    }, 3);
    tl.to(camera.position, {
      z: -20,
      duration: 5,
      ease: 'power2.in'
    }, 3);

    // Phase 3: Event Horizon (8-12s) - Spiral approach
    tl.to(cubeGroupRef.current.position, {
      z: 0,
      x: 0,
      y: 0,
      duration: 4,
      ease: 'power4.out'
    }, 8);
    tl.to(cubeGroupRef.current.rotation, {
      y: Math.PI * 6,
      x: Math.PI * 0.1,
      z: 0,
      duration: 4,
      ease: 'power2.out'
    }, 8);
    tl.to(camera.position, {
      z: 12,
      y: 2,
      x: 0,
      duration: 4,
      ease: 'power2.out'
    }, 8);

    // Phase 4: Ignite (12-15s) - Lock into gameplay position
    tl.to(camera.position, {
      z: 10,
      y: 0,
      x: 0,
      duration: 3,
      ease: 'power2.inOut'
    }, 12);

    // Pause timeline - we'll control it via progress
    tl.pause();

    return () => {
      if (tlRef.current) tlRef.current.kill();
    };
  }, [camera]);

  // Update timeline based on progress
  useEffect(() => {
    if (tlRef.current) {
      const duration = tlRef.current.duration();
      tlRef.current.seek((progress / 100) * duration);
    }
  }, [progress]);

  // Emissive pulsing during hyperspace
  useFrame((state, _delta) => {
    if (phase === 'hyperspace' || phase === 'eventHorizon') {
      setEmissive(0.2 + Math.sin(state.clock.elapsedTime * 5) * 0.15);
    } else if (phase === 'ignite') {
      setEmissive(0.1);
    } else {
      setEmissive(0.05);
    }

    // Black hole pulse on phase change
    if (phase === 'eventHorizon' && progress > 55 && progress < 56) {
      setBlackHolePulse(Date.now());
    }
    if (phase === 'ignite' && progress > 85 && progress < 86) {
      setBlackHolePulse(Date.now());
    }
  });

  // Generate cube pieces
  const cubies = useMemo(() => {
    const k = (size - 1) / 2;
    const pieces = [];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          // Only surface pieces
          if (x === 0 || x === size - 1 || y === 0 || y === size - 1 || z === 0 || z === size - 1) {
            pieces.push({
              key: `${x}-${y}-${z}`,
              position: [x - k, y - k, z - k]
            });
          }
        }
      }
    }
    return pieces;
  }, [size]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.4} />

      {/* Black hole environment - always visible but intensifies */}
      <BlackHoleEnvironment flipTrigger={blackHolePulse} />

      {/* Hyperspace stars */}
      <HyperspaceStars count={300} active={phase === 'hyperspace'} />

      {/* Wormhole tunnels */}
      {wormholes.map((wh, i) => (
        <WormholeTunnel
          key={i}
          start={wh.start}
          end={wh.end}
          color={wh.color}
          progress={Math.min(1, (progress - 25) / 20)}
          opacity={phase === 'hyperspace' ? 1 : 0.5}
        />
      ))}

      {/* The cube */}
      <group ref={cubeGroupRef}>
        {cubies.map((cubie) => (
          <CutsceneCubie
            key={cubie.key}
            position={cubie.position}
            size={size}
            emissiveIntensity={emissive}
          />
        ))}
      </group>

      {/* Distortion overlay during hyperspace */}
      <DistortionOverlay intensity={phase === 'hyperspace' ? 0.8 : phase === 'eventHorizon' ? 0.4 : 0} />

      <Environment preset="night" />
    </>
  );
};

// Text overlay component
const CutsceneOverlay = ({ progress, phase: _phase }) => {
  const getOverlayContent = () => {
    if (progress < 5) return null;

    if (progress < 20) {
      // Phase 1: Title emergence
      return (
        <div style={{
          opacity: Math.min(1, (progress - 5) / 10),
          transform: `scale(${0.8 + (progress / 100) * 0.2})`
        }}>
          <h1 style={{
            fontSize: 'clamp(32px, 8vw, 72px)',
            fontWeight: 700,
            margin: 0,
            background: 'linear-gradient(135deg, #8b5cf6 0%, #c084fc 50%, #e879f9 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 60px rgba(139, 92, 246, 0.8)',
            letterSpacing: '0.1em'
          }}>
            SINGULARITY
          </h1>
          <p style={{
            fontSize: 'clamp(14px, 3vw, 24px)',
            color: 'rgba(255, 255, 255, 0.6)',
            marginTop: '8px',
            letterSpacing: '0.3em'
          }}>
            LEVEL 10
          </p>
        </div>
      );
    }

    if (progress >= 25 && progress < 50) {
      // Phase 2: Hyperspace text
      return (
        <div style={{
          opacity: Math.min(1, (progress - 25) / 10) * (progress < 45 ? 1 : (50 - progress) / 5)
        }}>
          <p style={{
            fontSize: 'clamp(16px, 4vw, 28px)',
            color: 'rgba(255, 255, 255, 0.8)',
            letterSpacing: '0.2em',
            textShadow: '0 0 20px rgba(78, 205, 196, 0.6)'
          }}>
            SEAMS TEAR... SYMMETRY BREAKS
          </p>
          <p style={{
            fontSize: 'clamp(10px, 2vw, 16px)',
            color: '#4ecdc4',
            marginTop: '12px',
            fontFamily: '"Courier New", monospace',
            opacity: 0.8
          }}>
            k* = 0.721 — RP² TOPOLOGY ENGAGED
          </p>
        </div>
      );
    }

    if (progress >= 55 && progress < 78) {
      // Phase 3: Event horizon
      return (
        <div style={{
          opacity: Math.min(1, (progress - 55) / 8) * (progress < 72 ? 1 : (78 - progress) / 6)
        }}>
          <p style={{
            fontSize: 'clamp(14px, 3vw, 22px)',
            color: 'rgba(255, 200, 100, 0.9)',
            letterSpacing: '0.15em',
            textShadow: '0 0 30px rgba(255, 150, 50, 0.6)'
          }}>
            APPROACHING EVENT HORIZON
          </p>
        </div>
      );
    }

    if (progress >= 85) {
      // Phase 4: Final message
      return (
        <div style={{
          opacity: Math.min(1, (progress - 85) / 8)
        }}>
          <p style={{
            fontSize: 'clamp(14px, 3.5vw, 26px)',
            color: 'rgba(255, 255, 255, 0.95)',
            letterSpacing: '0.12em',
            textShadow: '0 0 40px rgba(139, 92, 246, 0.8)',
            fontWeight: 500
          }}>
            MASTER THE MANIFOLD
          </p>
          <p style={{
            fontSize: 'clamp(12px, 2.5vw, 20px)',
            color: '#c084fc',
            marginTop: '8px',
            letterSpacing: '0.2em'
          }}>
            SURVIVE THE SINGULARITY
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      pointerEvents: 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '20px'
    }}>
      {getOverlayContent()}
    </div>
  );
};

// Main cutscene component
const Level10Cutscene = ({ onComplete, onSkip }) => {
  const [progress, setProgress] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const duration = 15000; // 15 seconds
  const startTime = useRef(Date.now());

  // Progress timer
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      const newProgress = Math.min(100, (elapsed / duration) * 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => onComplete(), 500);
      }
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [duration, onComplete]);

  // Enable skip after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => setCanSkip(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Play audio effects
  useEffect(() => {
    // Could add audio here: play('/sounds/singularity-whoosh.mp3');
    if (progress > 20 && progress < 21) {
      vibrate(50);
    }
    if (progress > 55 && progress < 56) {
      vibrate([50, 30, 50]);
    }
    if (progress > 85 && progress < 86) {
      vibrate([100, 50, 100]);
    }
  }, [progress]);

  const phase = useMemo(() => {
    if (progress < 20) return 'emergence';
    if (progress < 53) return 'hyperspace';
    if (progress < 80) return 'eventHorizon';
    return 'ignite';
  }, [progress]);

  const handleSkip = () => {
    if (canSkip) {
      onSkip ? onSkip() : onComplete();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 3000,
      background: '#000',
      overflow: 'hidden'
    }}>
      {/* 3D Scene */}
      <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
        <Suspense fallback={null}>
          <CutsceneScene progress={progress} onComplete={onComplete} />
        </Suspense>
      </Canvas>

      {/* Text overlay */}
      <CutsceneOverlay progress={progress} phase={phase} />

      {/* Skip button */}
      {canSkip && (
        <button
          onClick={handleSkip}
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '40px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            color: 'rgba(255, 255, 255, 0.7)',
            padding: '10px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer',
            fontFamily: '-apple-system, sans-serif',
            letterSpacing: '0.1em',
            transition: 'all 0.2s',
            zIndex: 10
          }}
          onMouseEnter={e => {
            e.target.style.background = 'rgba(255, 255, 255, 0.2)';
            e.target.style.color = '#fff';
          }}
          onMouseLeave={e => {
            e.target.style.background = 'rgba(255, 255, 255, 0.1)';
            e.target.style.color = 'rgba(255, 255, 255, 0.7)';
          }}
        >
          SKIP {'>>>'}
        </button>
      )}

      {/* Progress bar */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '200px',
        height: '3px',
        background: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #8b5cf6, #c084fc)',
          transition: 'width 0.1s linear'
        }} />
      </div>
    </div>
  );
};

export default Level10Cutscene;
