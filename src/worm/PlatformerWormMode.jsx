// src/worm/PlatformerWormMode.jsx
// Dual-screen co-op mode: Manifolder (P1) rotates the cube, Crawler (P2) navigates the surface.
// Uses two <Canvas> elements in a horizontal split layout sharing React state.

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, TrackballControls } from '@react-three/drei';
import * as THREE from 'three';

import SimpleCubeRenderer from './SimpleCubeRenderer.jsx';
import CrawlerCharacter, { CrawlerOrb } from './CrawlerCharacter.jsx';
import PlatformerHUD from './PlatformerHUD.jsx';
import {
  stepCrawler,
  projectOntoCube,
  getGroundPosition,
  worldToGrid,
  rotateCrawlerWithSlice,
  spawnCrawlerOrbs,
  checkOrbCollision,
  isOnParityZone,
  FACE_NORMALS,
  SURFACE_OFFSET,
} from './crawlerPhysics.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { play } from '../utils/audio.js';

// ============================================================================
// GAME CONFIG
// ============================================================================
const CONFIG = {
  orbCount: 12,
  maxHealth: 5,
  parityDamageCooldown: 1.5,  // seconds between parity damage ticks
  rotationDamageRadius: 1.5,  // world units — if crawler is close to rotating slice, shake
  countdownDuration: 3,
};

// ============================================================================
// MANIFOLDER VIEW (Left canvas) — Overview camera showing the full cube
// ============================================================================
function ManifoldScene({ cubies, size, faceColors, crawlerWorldPos, orbs, rotationAnim }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.0} />
      <pointLight position={[-8, -4, 8]} intensity={0.4} />

      <SimpleCubeRenderer cubies={cubies} size={size} faceColors={faceColors} rotationAnim={rotationAnim} />

      {/* Crawler position marker visible from overview */}
      {crawlerWorldPos && (
        <mesh position={crawlerWorldPos.toArray()}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Orbs */}
      {orbs.map((orb) => (
        <CrawlerOrb key={orb.id} position={orb.position} collected={orb.collected} color="#ffd700" />
      ))}

      <TrackballControls
        noPan
        noZoom={false}
        minDistance={5}
        maxDistance={28}
        staticMoving={false}
        dynamicDampingFactor={0.08}
        rotateSpeed={1.2}
      />
      <Environment preset="city" />
    </>
  );
}

// ============================================================================
// CRAWLER VIEW (Right canvas) — Chase camera following the worm
// ============================================================================
function CrawlerScene({ cubies, size, faceColors, crawlerState, orbs, rotationAnim }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={1.0} />
      <pointLight position={[-5, -5, -5]} intensity={0.3} />

      <SimpleCubeRenderer cubies={cubies} size={size} faceColors={faceColors} rotationAnim={rotationAnim} />

      {crawlerState && (
        <CrawlerCharacter
          position={crawlerState.position}
          forward={crawlerState.forward}
          face={crawlerState.face}
          jumpHeight={crawlerState.jumpHeight}
          velocity={crawlerState.velocity}
          alive={crawlerState.alive}
        />
      )}

      {/* Orbs */}
      {orbs.map((orb) => (
        <CrawlerOrb key={orb.id} position={orb.position} collected={orb.collected} color="#ffd700" />
      ))}

      {/* Chase camera */}
      {crawlerState && <ChaseCam crawlerState={crawlerState} size={size} />}

      <Environment preset="sunset" />
    </>
  );
}

// Chase camera that follows behind the crawler
function ChaseCam({ crawlerState, size: _size }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 0, 10));
  const targetLookAt = useRef(new THREE.Vector3());
  const lerpSpeed = 0.06;

  useFrame(() => {
    if (!crawlerState) return;

    const { position, forward, face } = crawlerState;
    const normal = FACE_NORMALS[face]?.clone() || new THREE.Vector3(0, 1, 0);

    // Behind and above
    const behind = forward.clone().normalize().multiplyScalar(-2.5);
    const above = normal.clone().multiplyScalar(1.8);
    targetPos.current.copy(position).add(behind).add(above);

    // Look ahead
    const ahead = forward.clone().normalize().multiplyScalar(2.0);
    targetLookAt.current.copy(position).add(ahead);

    camera.position.lerp(targetPos.current, lerpSpeed);
    camera.up.copy(normal);
    camera.lookAt(targetLookAt.current);
  });

  return null;
}

// ============================================================================
// GAME LOOP — runs in the Crawler canvas to drive physics each frame
// ============================================================================
function CrawlerGameLoop({ crawlerRef, inputRef, gameStateRef, size, cubies, orbsRef, healthRef: _healthRef, onOrbCollect, onDamage, lastParityDamage }) {
  useFrame((_, delta) => {
    if (gameStateRef.current !== 'playing') return;

    const dt = Math.min(delta, 0.05); // Cap dt to prevent tunneling
    const input = inputRef.current;
    const state = crawlerRef.current;
    if (!state) return;

    // Step physics
    const newState = stepCrawler(state, input, dt, size);
    crawlerRef.current = { ...newState, alive: true };

    // Check orb collisions
    const orbs = orbsRef.current;
    const groundPos = getGroundPosition(newState, size);
    for (let i = 0; i < orbs.length; i++) {
      if (!orbs[i].collected && checkOrbCollision(groundPos, orbs[i].position, 0.7)) {
        orbs[i] = { ...orbs[i], collected: true };
        orbsRef.current = [...orbs];
        onOrbCollect();
      }
    }

    // Check parity zone damage
    if (isOnParityZone(newState, cubies, size)) {
      const now = performance.now() / 1000;
      if (now - lastParityDamage.current > CONFIG.parityDamageCooldown) {
        lastParityDamage.current = now;
        onDamage();
      }
    }
  });

  return null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function PlatformerWormMode({ cubies: initialCubies, size, faceColors, onQuit }) {
  // --- Cube state (local copy for co-op mode) ---
  const [cubies, setCubies] = useState(initialCubies);

  // --- Game state ---
  const [gameState, setGameState] = useState('waiting'); // waiting, playing, paused, gameover, victory
  const gameStateRef = useRef('waiting');
  gameStateRef.current = gameState;

  const [timer, setTimer] = useState(0);
  const timerRef = useRef(0);

  const [health, setHealth] = useState(CONFIG.maxHealth);
  const healthRef = useRef(CONFIG.maxHealth);
  healthRef.current = health;

  const [orbsCollected, setOrbsCollected] = useState(0);
  const [rotationCount, setRotationCount] = useState(0);

  // --- Manifolder state ---
  const [selectedSlice, setSelectedSlice] = useState(0);
  const [selectedAxis, setSelectedAxis] = useState('col');
  const [rotationAnim, setRotationAnim] = useState(null);

  // --- Crawler state (ref for per-frame mutation) ---
  const crawlerRef = useRef(null);
  const [crawlerDisplay, setCrawlerDisplay] = useState(null); // for React re-renders

  // --- Orbs ---
  const orbsRef = useRef([]);
  const [orbsDisplay, setOrbsDisplay] = useState([]);

  // --- Input refs (updated on keydown/keyup, read in game loop) ---
  const inputRef = useRef({
    turnRate: 0, thrust: 0, brake: 0, jump: false, sprint: false,
  });

  const lastParityDamage = useRef(0);

  // --- Initialize crawler and orbs ---
  const initGame = useCallback(() => {
    const k = (size - 1) / 2;
    const s = k + SURFACE_OFFSET;

    // Start crawler on front face center
    const startPos = new THREE.Vector3(0, 0, s);
    const startForward = new THREE.Vector3(1, 0, 0);

    crawlerRef.current = {
      position: startPos,
      forward: startForward,
      face: 'PZ',
      velocity: 0,
      jumpHeight: 0,
      jumpVel: 0,
      alive: true,
    };

    const orbs = spawnCrawlerOrbs(CONFIG.orbCount, size, startPos);
    orbsRef.current = orbs;
    setOrbsDisplay(orbs);
    setOrbsCollected(0);
    setHealth(CONFIG.maxHealth);
    healthRef.current = CONFIG.maxHealth;
    setRotationCount(0);
    setTimer(0);
    timerRef.current = 0;
    lastParityDamage.current = 0;
    setCubies(initialCubies);
  }, [size, initialCubies]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // --- Sync crawler display (throttled to avoid re-render every frame) ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (crawlerRef.current) {
        setCrawlerDisplay({ ...crawlerRef.current });
      }
      setOrbsDisplay([...orbsRef.current]);
      if (gameStateRef.current === 'playing') {
        timerRef.current += 1 / 30;
        setTimer(timerRef.current);
      }
    }, 1000 / 30); // 30fps UI updates
    return () => clearInterval(interval);
  }, []);

  // --- Orb collection callback ---
  const handleOrbCollect = useCallback(() => {
    play('/sounds/eat.mp3');
    setOrbsCollected(prev => {
      const next = prev + 1;
      if (next >= CONFIG.orbCount) {
        setGameState('victory');
        play('/sounds/victory.mp3');
      }
      return next;
    });
  }, []);

  // --- Damage callback ---
  const handleDamage = useCallback(() => {
    play('/sounds/warp.mp3');
    setHealth(prev => {
      const next = prev - 1;
      healthRef.current = next;
      if (next <= 0) {
        setGameState('gameover');
        play('/sounds/gameover.mp3');
      }
      return next;
    });
  }, []);

  // --- Manifolder rotation ---
  const performRotation = useCallback((axis, dir) => {
    if (rotationAnim) return; // Already animating
    if (gameState !== 'playing') return;

    const slice = selectedSlice;

    // Animate rotation
    setRotationAnim({ axis, sliceIndex: slice, dir, progress: 0 });

    // Animate progress 0→1 over 300ms
    const startTime = performance.now();
    const duration = 300;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      if (progress < 1) {
        setRotationAnim({ axis, sliceIndex: slice, dir, progress });
        requestAnimationFrame(animate);
      } else {
        // Complete rotation
        setRotationAnim(null);
        setCubies(prev => rotateSliceCubies(prev, size, axis, slice, dir));
        setRotationCount(prev => prev + 1);

        // Update crawler position
        if (crawlerRef.current) {
          crawlerRef.current = rotateCrawlerWithSlice(crawlerRef.current, axis, slice, dir, size);
        }

        // Update orb positions
        const rotQuat = new THREE.Quaternion().setFromAxisAngle(
          axis === 'col' ? new THREE.Vector3(1, 0, 0) :
          axis === 'row' ? new THREE.Vector3(0, 1, 0) :
          new THREE.Vector3(0, 0, 1),
          dir * Math.PI / 2
        );

        orbsRef.current = orbsRef.current.map(orb => {
          if (orb.collected) return orb;
          const grid = worldToGrid(orb.position, orb.face, size);
          let inSlice = false;
          if (axis === 'col' && grid.x === slice) inSlice = true;
          if (axis === 'row' && grid.y === slice) inSlice = true;
          if (axis === 'depth' && grid.z === slice) inSlice = true;
          if (!inSlice) return orb;
          const newPos = orb.position.clone().applyQuaternion(rotQuat);
          const projected = projectOntoCube(newPos, size);
          return { ...orb, position: projected.position, face: projected.face };
        });
      }
    };
    requestAnimationFrame(animate);
  }, [rotationAnim, gameState, selectedSlice, size]);

  // --- Keyboard input ---
  useEffect(() => {
    const keyState = new Set();

    const updateInput = () => {
      inputRef.current = {
        turnRate: (keyState.has('arrowleft') ? -1 : 0) + (keyState.has('arrowright') ? 1 : 0),
        thrust: keyState.has('arrowup') ? 1 : 0,
        brake: keyState.has('arrowdown') ? 1 : 0,
        jump: keyState.has(' '),
        sprint: keyState.has('shift'),
      };
    };

    const onKeyDown = (e) => {
      const key = e.key.toLowerCase();

      // --- Global controls ---
      if (key === 'escape' || key === 'p') {
        e.preventDefault();
        if (gameState === 'playing') setGameState('paused');
        else if (gameState === 'paused') setGameState('playing');
        return;
      }

      // --- Crawler controls (Arrow keys + Space + Shift) ---
      if (e.key.startsWith('Arrow') || key === ' ' || key === 'shift') {
        e.preventDefault();
        keyState.add(key === ' ' ? ' ' : e.key.startsWith('Arrow') ? e.key.toLowerCase() : key);
        updateInput();
        return;
      }

      // --- Manifolder controls ---
      if (gameState !== 'playing') return;

      // Slice selection: 1-5
      if (/^[1-5]$/.test(key)) {
        e.preventDefault();
        const idx = parseInt(key) - 1;
        if (idx < size) setSelectedSlice(idx);
        return;
      }

      // Axis toggle: Tab
      if (key === 'tab') {
        e.preventDefault();
        setSelectedAxis(prev => {
          const axes = ['col', 'row', 'depth'];
          return axes[(axes.indexOf(prev) + 1) % 3];
        });
        return;
      }

      // WASD rotations
      switch (key) {
        case 'w': e.preventDefault(); performRotation(selectedAxis, -1); break;
        case 's': e.preventDefault(); performRotation(selectedAxis, 1); break;
        case 'a': e.preventDefault(); performRotation('row', -1); break;
        case 'd': e.preventDefault(); performRotation('row', 1); break;
        case 'q': e.preventDefault(); performRotation('depth', 1); break;
        case 'e': e.preventDefault(); performRotation('depth', -1); break;
      }
    };

    const onKeyUp = (e) => {
      const key = e.key.toLowerCase();
      keyState.delete(key === ' ' ? ' ' : e.key.startsWith('Arrow') ? e.key.toLowerCase() : key);
      updateInput();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [gameState, performRotation, selectedAxis, size]);

  // --- Restart ---
  const handleRestart = useCallback(() => {
    initGame();
    setGameState('waiting');
  }, [initGame]);

  // --- Start ---
  const handleStart = useCallback(() => {
    setGameState('playing');
  }, []);

  // --- Camera Z for left canvas ---
  const cameraZ = { 2: 10, 3: 14, 4: 20, 5: 26 }[size] || 14;

  // Compute crawler world position for the manifolder view marker
  const crawlerWorldPos = crawlerDisplay?.position || null;

  return (
    <div style={styles.root}>
      {/* Left canvas: Manifolder overview */}
      <div style={styles.leftPanel}>
        <Canvas camera={{ position: [0, 2, cameraZ], fov: 40 }}>
          <Suspense fallback={null}>
            <ManifoldScene
              cubies={cubies}
              size={size}
              faceColors={faceColors}
              crawlerWorldPos={crawlerWorldPos}
              orbs={orbsDisplay}
              rotationAnim={rotationAnim}
            />
          </Suspense>
        </Canvas>
        <div style={styles.panelLabel}>
          <span style={{ color: '#60a5fa' }}>MANIFOLDER</span>
        </div>
      </div>

      {/* Right canvas: Crawler view */}
      <div style={styles.rightPanel}>
        <Canvas camera={{ position: [0, 0, 10], fov: 55 }}>
          <Suspense fallback={null}>
            <CrawlerScene
              cubies={cubies}
              size={size}
              faceColors={faceColors}
              crawlerState={crawlerDisplay}
              orbs={orbsDisplay}
              rotationAnim={rotationAnim}
            />
            {/* Game loop runs here (needs useFrame) */}
            <CrawlerGameLoop
              crawlerRef={crawlerRef}
              inputRef={inputRef}
              gameStateRef={gameStateRef}
              size={size}
              cubies={cubies}
              orbsRef={orbsRef}
              healthRef={healthRef}
              onOrbCollect={handleOrbCollect}
              onDamage={handleDamage}
              lastParityDamage={lastParityDamage}
            />
          </Suspense>
        </Canvas>
        <div style={styles.panelLabel}>
          <span style={{ color: '#00ff88' }}>CRAWLER</span>
        </div>
      </div>

      {/* HUD overlay */}
      <PlatformerHUD
        gameState={gameState}
        timer={timer}
        health={health}
        maxHealth={CONFIG.maxHealth}
        orbsCollected={orbsCollected}
        orbsTotal={CONFIG.orbCount}
        crawlerSpeed={crawlerDisplay?.velocity || 0}
        crawlerFace={crawlerDisplay?.face || '?'}
        rotationCount={rotationCount}
        selectedSlice={selectedSlice}
        selectedAxis={selectedAxis}
        onPause={() => setGameState('paused')}
        onResume={gameState === 'waiting' ? handleStart : () => setGameState('playing')}
        onRestart={handleRestart}
        onQuit={onQuit}
      />
    </div>
  );
}

const styles = {
  root: {
    position: 'fixed', inset: 0, zIndex: 9998,
    display: 'flex', background: '#000',
  },
  leftPanel: {
    flex: 1, position: 'relative',
    borderRight: '1px solid rgba(96, 165, 250, 0.2)',
  },
  rightPanel: {
    flex: 1, position: 'relative',
    borderLeft: '1px solid rgba(0, 255, 136, 0.2)',
  },
  panelLabel: {
    position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
    fontSize: '10px', fontFamily: "'Courier New', monospace",
    fontWeight: 'bold', letterSpacing: '0.2em', opacity: 0.4,
  },
};
