import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import IntroScene from '../intro/IntroScene.jsx';
import TextOverlay from '../intro/TextOverlay.jsx';

// Simple error boundary for debugging on mobile
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: 20, background: '#111', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <strong>Error:</strong> {this.state.error?.message || 'Unknown error'}
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Timing (mirrors IntroScene constants) ───────────────────────────────────
const EXPLOSION_START = 8.7;
const EXPLOSION_END   = 10.5;
const IMPLODE_START   = 12.5;
const IMPLODE_END     = 14.5;

const _clamp = (t, a = 0, b = 1) => Math.max(a, Math.min(b, t));
const _ease  = t => t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
const _prog  = (t, s, e) => _clamp((t - s) / (e - s));

// ─── Reusable Vector2 — mutated each render to avoid per-frame allocations ───
const _chromaticVec = new Vector2(0, 0);

const WelcomeScreen = ({ onEnter }) => {
  const [time, setTime] = useState(0);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let raf;

    const animate = (now) => {
      const elapsed = (now - start) / 1000;
      setTime(elapsed);

      if (elapsed >= 2) setCanSkip(true);

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleEnter = () => {
    onEnter();
  };

  const handleSkip = () => {
    onEnter();
  };

  // ── Bloom intensity: quiet → explosion spike → elevated through worm → fades on implode ──
  const bloomIntensity = useMemo(() => {
    if (time < EXPLOSION_START)   return 0.6;
    if (time < EXPLOSION_END)     return 0.6 + _ease(_prog(time, EXPLOSION_START, EXPLOSION_END)) * 2.4;
    if (time < IMPLODE_START)     return 3.0;
    if (time < IMPLODE_END)       return 3.0 - _ease(_prog(time, IMPLODE_START, IMPLODE_END)) * 2.2;
    return 0.8;
  }, [time]);

  // ── Chromatic aberration: spikes hard at explosion start, fades over 1.5s ──
  const chromaticOffset = useMemo(() => {
    let mag = 0;
    if (time >= EXPLOSION_START && time < EXPLOSION_START + 0.4) {
      mag = _ease(_prog(time, EXPLOSION_START, EXPLOSION_START + 0.4)) * 0.008;
    } else if (time >= EXPLOSION_START + 0.4 && time < EXPLOSION_START + 1.8) {
      mag = _ease(1 - _prog(time, EXPLOSION_START + 0.4, EXPLOSION_START + 1.8)) * 0.005;
    }
    _chromaticVec.set(mag, mag * 0.4);
    return _chromaticVec;
  }, [time]);

  return (
    <div className="welcome-screen" style={{ background: '#05050f' }}>
      <div className="welcome-canvas">
        <ErrorBoundary>
          <Canvas camera={{ position: [0, 3, 12], fov: 40 }}>
            <color attach="background" args={['#05050f']} />
            <ambientLight intensity={0.6} />
            <pointLight position={[10, 10, 10]} intensity={1.8} />
            <pointLight position={[-10, -10, -10]} intensity={1.2} />
            <IntroScene time={time} onComplete={handleEnter} />
            <Suspense fallback={null}>
              <Environment preset="city" />
            </Suspense>
            <EffectComposer>
              <Bloom
                intensity={bloomIntensity}
                luminanceThreshold={0.15}
                luminanceSmoothing={0.85}
                mipmapBlur
              />
              <ChromaticAberration
                offset={chromaticOffset}
                blendFunction={BlendFunction.NORMAL}
              />
              <Vignette
                offset={0.35}
                darkness={0.75}
                blendFunction={BlendFunction.NORMAL}
              />
            </EffectComposer>
          </Canvas>
        </ErrorBoundary>
      </div>

      <TextOverlay time={time} />

      {canSkip && (
        <button
          className="skip-intro-btn"
          onClick={handleSkip}
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          Skip ►
        </button>
      )}

      {time >= 10 && (
        <button
          className="enter-btn"
          onClick={handleEnter}
          style={{
            background: '#1e88e5',
            border: 'none',
            color: '#ffffff',
          }}
        >
          ENTER
        </button>
      )}
    </div>
  );
};

export default WelcomeScreen;
