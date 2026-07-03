// src/worm/PlatformerWormMode.jsx
// Dual-screen co-op mode: Manifolder (P1) rotates the cube, Crawler (P2) navigates the surface.
// Uses two <Canvas> elements in a horizontal split layout sharing React state.

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, TrackballControls, View, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

import SimpleCubeRenderer from './SimpleCubeRenderer.jsx';
import CrawlerCharacter, { CrawlerOrb } from './CrawlerCharacter.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
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
import { isMobile as isMobileDevice } from '../utils/device.js';
import { UI_FONT } from '../utils/uiTheme.js';

// Module-level scratch objects — never reallocated per frame
const _camNormal = new THREE.Vector3();
const _camBehind = new THREE.Vector3();
const _camAhead = new THREE.Vector3();
const _CAM_AXIS_COL = new THREE.Vector3(1, 0, 0);
const _CAM_AXIS_ROW = new THREE.Vector3(0, 1, 0);
const _CAM_AXIS_DEPTH = new THREE.Vector3(0, 0, 1);

// ============================================================================
// MOBILE TOUCH CONTROLS
// ============================================================================
function MobileCrawlerControls({ inputRef }) {
  const setInput = (patch) => { inputRef.current = { ...inputRef.current, ...patch }; };

  const btnStyle = (color = '#00ff88') => ({
    width: '60px', height: '60px', borderRadius: '50%',
    border: `2px solid ${color}`, background: `rgba(0,0,0,0.7)`,
    color, fontSize: '22px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', touchAction: 'manipulation', userSelect: 'none',
    WebkitUserSelect: 'none', cursor: 'pointer', flexShrink: 0,
  });

  const onPress = (patch) => (e) => { e.preventDefault(); setInput(patch); };
  const onRelease = (patch) => (e) => { e.preventDefault(); setInput(patch); };

  return (
    <div style={{
      position: 'absolute', bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
      right: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '6px', zIndex: 200, pointerEvents: 'auto',
    }}>
      {/* Up */}
      <button style={btnStyle()}
        onTouchStart={onPress({ thrust: 1 })} onTouchEnd={onRelease({ thrust: 0 })}
        onMouseDown={onPress({ thrust: 1 })} onMouseUp={onRelease({ thrust: 0 })}>▲</button>
      {/* Left / Jump / Right row */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button style={btnStyle()}
          onTouchStart={onPress({ turnRate: -1 })} onTouchEnd={onRelease({ turnRate: 0 })}
          onMouseDown={onPress({ turnRate: -1 })} onMouseUp={onRelease({ turnRate: 0 })}>◄</button>
        <button style={{ ...btnStyle('#ffe066'), width: '64px', height: '64px', fontSize: '16px', fontWeight: 'bold' }}
          onTouchStart={onPress({ jump: true })} onTouchEnd={onRelease({ jump: false })}
          onMouseDown={onPress({ jump: true })} onMouseUp={onRelease({ jump: false })}>JUMP</button>
        <button style={btnStyle()}
          onTouchStart={onPress({ turnRate: 1 })} onTouchEnd={onRelease({ turnRate: 0 })}
          onMouseDown={onPress({ turnRate: 1 })} onMouseUp={onRelease({ turnRate: 0 })}>►</button>
      </div>
      {/* Down */}
      <button style={btnStyle()}
        onTouchStart={onPress({ brake: 1 })} onTouchEnd={onRelease({ brake: 0 })}
        onMouseDown={onPress({ brake: 1 })} onMouseUp={onRelease({ brake: 0 })}>▼</button>
    </div>
  );
}

function MobileManifoldControls({ onRotate, selectedAxis, selectedSlice, size, onAxisToggle, onSliceChange, gameState }) {
  if (gameState !== 'playing') return null;
  const btnStyle = (color = '#60a5fa') => ({
    padding: '8px 14px', borderRadius: '8px', border: `2px solid ${color}`,
    background: 'rgba(0,0,0,0.7)', color, fontSize: '18px',
    touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer',
  });
  return (
    <div style={{
      position: 'absolute', bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
      left: '12px', display: 'flex', flexDirection: 'column', gap: '6px',
      zIndex: 200, pointerEvents: 'auto', alignItems: 'flex-start',
    }}>
      {/* Rotate up/down */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button style={btnStyle()} onClick={() => onRotate(selectedAxis, -1)}>▲</button>
        <button style={btnStyle()} onClick={() => onRotate(selectedAxis, 1)}>▼</button>
      </div>
      {/* Rotate left/right (row) */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button style={btnStyle()} onClick={() => onRotate('row', -1)}>◄</button>
        <button style={btnStyle()} onClick={() => onRotate('row', 1)}>►</button>
      </div>
      {/* Depth + axis/slice info */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button style={btnStyle('#a78bfa')} onClick={() => onRotate('depth', 1)}>↺</button>
        <button style={btnStyle('#a78bfa')} onClick={() => onRotate('depth', -1)}>↻</button>
        <button style={{ ...btnStyle('#888'), fontSize: '12px', padding: '6px 10px' }} onClick={onAxisToggle}>
          {selectedAxis.toUpperCase()}
        </button>
      </div>
      {/* Slice selector */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {Array.from({ length: size }, (_, i) => (
          <button key={i} style={{
            ...btnStyle(i === selectedSlice ? '#60a5fa' : '#444'),
            padding: '6px 10px', fontSize: '13px',
            background: i === selectedSlice ? 'rgba(96,165,250,0.2)' : 'rgba(0,0,0,0.7)',
          }} onClick={() => onSliceChange(i)}>{i + 1}</button>
        ))}
      </div>
    </div>
  );
}

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
function ManifoldScene({ cubies, size, faceColors, crawlerWorldPos, orbs, rotationAnim, isGlowChar, trackRef }) {
  const [domEl, setDomEl] = useState(null);
  useEffect(() => { setDomEl(trackRef.current); }, [trackRef]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.0} />
      <pointLight position={[-8, -4, 8]} intensity={0.4} />

      <SimpleCubeRenderer cubies={cubies} size={size} faceColors={faceColors} rotationAnim={rotationAnim} />

      {crawlerWorldPos && (
        <mesh position={crawlerWorldPos.toArray()}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.8} />
        </mesh>
      )}

      {orbs.map((orb) => (
        <CrawlerOrb key={orb.id} position={orb.position} collected={orb.collected} color="#ffd700" isGlowChar={isGlowChar} />
      ))}

      {domEl && (
        <TrackballControls
          domElement={domEl}
          noPan
          noZoom={false}
          minDistance={5}
          maxDistance={28}
          staticMoving={false}
          dynamicDampingFactor={0.08}
          rotateSpeed={1.2}
        />
      )}
      <Environment preset="city" />
    </>
  );
}

// ============================================================================
// CRAWLER VIEW (Right canvas) — Chase camera following the worm
// ============================================================================
function CrawlerScene({ cubies, size, faceColors, crawlerState, orbs, rotationAnim, isGlowChar }) {
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
          orbCount={orbs.filter(o => o.collected).length}
        />
      )}

      {/* Orbs */}
      {orbs.map((orb) => (
        <CrawlerOrb key={orb.id} position={orb.position} collected={orb.collected} color="#ffd700" isGlowChar={isGlowChar} />
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
    const faceNormal = FACE_NORMALS[face];
    if (faceNormal) {
      _camNormal.copy(faceNormal);
    } else {
      _camNormal.set(0, 1, 0);
    }

    // Behind and above — reuse scratch vectors, no clone()
    _camBehind.copy(forward).normalize().multiplyScalar(-2.5);
    targetPos.current.copy(position).add(_camBehind).addScaledVector(_camNormal, 1.8);

    // Look ahead
    _camAhead.copy(forward).normalize().multiplyScalar(2.0);
    targetLookAt.current.copy(position).add(_camAhead);

    camera.position.lerp(targetPos.current, lerpSpeed);
    camera.up.copy(_camNormal);
    camera.lookAt(targetLookAt.current);
  });

  return null;
}

// ============================================================================
// GAME LOOP — runs in the Crawler canvas to drive physics each frame
// ============================================================================
function CrawlerGameLoop({ crawlerRef, inputRef, gameStateRef, size, cubies, orbsRef, orbsVersionRef, healthRef: _healthRef, onOrbCollect, onDamage, lastParityDamage }) {
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
        orbsVersionRef.current++;
        onOrbCollect();
      }
    }

    // Tick down parity damage cooldown using capped game-time delta so pausing
    // the game (or backgrounding the tab) cannot reset the cooldown for free.
    if (lastParityDamage.current > 0) {
      lastParityDamage.current = Math.max(0, lastParityDamage.current - dt);
    }
    // Check parity zone damage
    if (isOnParityZone(newState, cubies, size)) {
      if (lastParityDamage.current <= 0) {
        lastParityDamage.current = CONFIG.parityDamageCooldown;
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
  const isGlowChar = useGameStore(s => (s.wormCharacter ?? 'classic') === 'glow');

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
  // Synchronous guard: prevents a second rotation from starting in the narrow window
  // between setRotationAnim() and the component re-render that would update the
  // performRotation closure. React state updates are async, so without this ref the
  // stale closure (rotationAnim === null) could pass the early-return check twice.
  const rotationAnimActiveRef = useRef(false);

  // --- Portrait / landscape layout ---
  // Recalculated on resize so both canvases stay usable after orientation changes.
  const [isPortrait, setIsPortrait] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  );
  useEffect(() => {
    const onResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    // orientationchange fires before the browser has settled on new dimensions —
    // delay 100 ms so the subsequent resize event carries the correct values.
    const onOrientationChange = () => setTimeout(onResize, 100);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrientationChange);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrientationChange);
    };
  }, []);

  // --- Crawler state (ref for per-frame mutation) ---
  const crawlerRef = useRef(null);
  const [crawlerDisplay, setCrawlerDisplay] = useState(null); // for React re-renders

  // --- Orbs ---
  const orbsRef = useRef([]);
  const [orbsDisplay, setOrbsDisplay] = useState([]);
  // Version counter incremented whenever orbsRef.current is replaced (orb collected / init)
  const orbsVersionRef = useRef(0);
  const orbsDisplayVersionRef = useRef(0);

  // --- Input refs (updated on keydown/keyup, read in game loop) ---
  const inputRef = useRef({
    turnRate: 0, thrust: 0, brake: 0, jump: false, sprint: false,
  });
  // Persisted across effect re-runs so held keys survive gameState transitions (e.g. pause → resume)
  const keyStateRef = useRef(new Set());

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
      jumpT: 0,
      jumpReady: true,
      alive: true,
    };

    const orbs = spawnCrawlerOrbs(CONFIG.orbCount, size, startPos);
    orbsRef.current = orbs;
    orbsVersionRef.current++;
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
      // Only spread the orbs array when it has actually changed (version counter check)
      if (orbsVersionRef.current !== orbsDisplayVersionRef.current) {
        orbsDisplayVersionRef.current = orbsVersionRef.current;
        setOrbsDisplay([...orbsRef.current]);
      }
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
    // Use a ref for the primary guard so it's synchronous — the rotationAnim state update
    // is async and the stale closure would pass this check a second time before re-render.
    if (rotationAnimActiveRef.current) return;
    if (gameState !== 'playing') return;

    const slice = selectedSlice;

    rotationAnimActiveRef.current = true;
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
        rotationAnimActiveRef.current = false;
        setRotationAnim(null);
        setCubies(prev => rotateSliceCubies(prev, size, axis, slice, dir));
        setRotationCount(prev => prev + 1);

        // Update crawler position
        if (crawlerRef.current) {
          crawlerRef.current = rotateCrawlerWithSlice(crawlerRef.current, axis, slice, dir, size);
        }

        // Update orb positions — use module-level axis vectors to avoid allocations
        const rotAxis = axis === 'col' ? _CAM_AXIS_COL : axis === 'row' ? _CAM_AXIS_ROW : _CAM_AXIS_DEPTH;
        const rotQuat = new THREE.Quaternion().setFromAxisAngle(rotAxis, dir * Math.PI / 2);

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
        orbsVersionRef.current++;
      }
    };
    requestAnimationFrame(animate);
  }, [gameState, selectedSlice, size]);

  // --- Keyboard input ---
  useEffect(() => {
    const updateInput = () => {
      const ks = keyStateRef.current;
      inputRef.current = {
        turnRate: (ks.has('arrowleft') ? -1 : 0) + (ks.has('arrowright') ? 1 : 0),
        thrust: ks.has('arrowup') ? 1 : 0,
        brake: ks.has('arrowdown') ? 1 : 0,
        jump: ks.has(' '),
        sprint: ks.has('shift'),
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
        keyStateRef.current.add(key === ' ' ? ' ' : e.key.startsWith('Arrow') ? e.key.toLowerCase() : key);
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
      keyStateRef.current.delete(key === ' ' ? ' ' : e.key.startsWith('Arrow') ? e.key.toLowerCase() : key);
      updateInput();
    };

    // Clear held keys whenever the effect re-runs (e.g. gameState changes) so no
    // key appears stuck after a pause/resume transition.
    keyStateRef.current.clear();
    updateInput();

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
  // In portrait mode the panel is half the screen height rather than half the width,
  // so pull the camera back ~40 % to keep the cube fully in frame.
  const baseCameraZ = { 2: 10, 3: 14, 4: 20, 5: 26 }[size] || 14;
  const cameraZ = isPortrait ? Math.round(baseCameraZ * 1.4) : baseCameraZ;

  // Compute crawler world position for the manifolder view marker
  const crawlerWorldPos = crawlerDisplay?.position || null;

  const rootRef = useRef(null);
  const manifoldTrackRef = useRef(null);
  const crawlerTrackRef = useRef(null);

  return (
    <div ref={rootRef} style={{ ...styles.root, flexDirection: isPortrait ? 'column' : 'row' }}>
      {/* Tracking panels — define where each View renders via scissor */}
      <div ref={manifoldTrackRef} style={isPortrait ? styles.topPanel : styles.leftPanel}>
        <div style={styles.panelLabel}>
          <span style={{ color: '#60a5fa' }}>MANIFOLDER</span>
        </div>
      </div>
      <div ref={crawlerTrackRef} style={isPortrait ? styles.bottomPanel : styles.rightPanel}>
        <div style={styles.panelLabel}>
          <span style={{ color: '#00ff88' }}>CRAWLER</span>
        </div>
      </div>

      {/* Single Canvas — scissor-rendered into both panels */}
      <Canvas
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        eventSource={rootRef}
        eventPrefix="client"
      >
        <View track={manifoldTrackRef} index={1}>
          <PerspectiveCamera makeDefault position={[0, 2, cameraZ]} fov={40} />
          <Suspense fallback={null}>
            <ManifoldScene
              cubies={cubies}
              size={size}
              faceColors={faceColors}
              crawlerWorldPos={crawlerWorldPos}
              orbs={orbsDisplay}
              rotationAnim={rotationAnim}
              isGlowChar={isGlowChar}
              trackRef={manifoldTrackRef}
            />
          </Suspense>
        </View>
        <View track={crawlerTrackRef} index={2}>
          <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={55} />
          <Suspense fallback={null}>
            <CrawlerScene
              cubies={cubies}
              size={size}
              faceColors={faceColors}
              crawlerState={crawlerDisplay}
              orbs={orbsDisplay}
              rotationAnim={rotationAnim}
              isGlowChar={isGlowChar}
            />
            <CrawlerGameLoop
              crawlerRef={crawlerRef}
              inputRef={inputRef}
              gameStateRef={gameStateRef}
              size={size}
              cubies={cubies}
              orbsRef={orbsRef}
              orbsVersionRef={orbsVersionRef}
              healthRef={healthRef}
              onOrbCollect={handleOrbCollect}
              onDamage={handleDamage}
              lastParityDamage={lastParityDamage}
            />
          </Suspense>
        </View>
      </Canvas>

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

      {/* Mobile touch controls */}
      {isMobileDevice && gameState === 'playing' && (
        <>
          <MobileCrawlerControls inputRef={inputRef} />
          <MobileManifoldControls
            onRotate={performRotation}
            selectedAxis={selectedAxis}
            selectedSlice={selectedSlice}
            size={size}
            onAxisToggle={() => setSelectedAxis(prev => { const axes = ['col', 'row', 'depth']; return axes[(axes.indexOf(prev) + 1) % 3]; })}
            onSliceChange={setSelectedSlice}
            gameState={gameState}
          />
        </>
      )}
    </div>
  );
}

const styles = {
  root: {
    position: 'fixed', inset: 0, zIndex: 9998,
    display: 'flex', background: '#000',
  },
  // Landscape layout (default)
  leftPanel: {
    flex: 1, position: 'relative',
    borderRight: '1px solid rgba(96, 165, 250, 0.2)',
  },
  rightPanel: {
    flex: 1, position: 'relative',
    borderLeft: '1px solid rgba(0, 255, 136, 0.2)',
  },
  // Portrait layout — panels stacked vertically
  topPanel: {
    flex: 1, position: 'relative',
    borderBottom: '1px solid rgba(96, 165, 250, 0.2)',
  },
  bottomPanel: {
    flex: 1, position: 'relative',
    borderTop: '1px solid rgba(0, 255, 136, 0.2)',
  },
  panelLabel: {
    position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
    fontSize: '10px', fontFamily: UI_FONT,
    fontWeight: 'bold', letterSpacing: '0.2em', opacity: 0.4,
    pointerEvents: 'none',
  },
};
