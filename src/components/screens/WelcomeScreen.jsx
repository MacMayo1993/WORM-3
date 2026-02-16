import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
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

  return (
    <div className="welcome-screen" style={{
      background: 'linear-gradient(to right, #e5e5e5 1px, transparent 1px), linear-gradient(to bottom, #e5e5e5 1px, transparent 1px), #f5f5f5',
      backgroundSize: '20px 20px'
    }}>
      <div className="welcome-canvas">
        <ErrorBoundary>
          <Canvas camera={{ position: [0, 3, 12], fov: 40 }}>
            <ambientLight intensity={1.25} />
            <pointLight position={[10, 10, 10]} intensity={1.35} />
            <pointLight position={[-10, -10, -10]} intensity={1.0} />
            <IntroScene time={time} onComplete={handleEnter} />
            <Suspense fallback={null}>
              <Environment preset="city" />
            </Suspense>
          </Canvas>
        </ErrorBoundary>
      </div>

      <TextOverlay time={time} />

      {canSkip && (
        <button
          className="skip-intro-btn"
          onClick={handleSkip}
          style={{
            background: '#ffffff',
            color: '#202124',
            border: '1px solid #e8eaed',
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
