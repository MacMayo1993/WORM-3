import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';

const WireframeEdge = ({ start, end, color, intensity = 1, pulsePhase = 0 }) => {
  const lineRef = useRef();

  useFrame((state) => {
    if (!lineRef.current) return;
    const t = state.clock.elapsedTime + pulsePhase;
    const pulse = 0.7 + Math.sin(t * 3) * 0.3;
    lineRef.current.material.opacity = intensity * pulse;
  });

  return (
    <Line
      ref={lineRef}
      points={[start, end]}
      color={color}
      lineWidth={2.5}
      transparent
      opacity={intensity}
    />
  );
};

export default WireframeEdge;
