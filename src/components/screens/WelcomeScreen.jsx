import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import IntroScene from '../intro/IntroScene.jsx';
import TextOverlay from '../intro/TextOverlay.jsx';

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
    <div className="welcome-screen">
      <div className="welcome-canvas">
        <Canvas camera={{ position: [0, 3, 12], fov: 40 }}>
          <ambientLight intensity={1.25} />
          <pointLight position={[10, 10, 10]} intensity={1.35} />
          <pointLight position={[-10, -10, -10]} intensity={1.0} />
          <Suspense fallback={null}>
            <Environment preset="city" />
            <IntroScene time={time} />
          </Suspense>
        </Canvas>
      </div>

      <TextOverlay time={time} />

      {canSkip && (
        <button className="skip-intro-btn" onClick={handleSkip}>
          Skip ►
        </button>
      )}

      {time >= 10 && (
        <button className="enter-btn" onClick={handleEnter}>
          ENTER
        </button>
      )}
    </div>
  );
};

export default WelcomeScreen;
