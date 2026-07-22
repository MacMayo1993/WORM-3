// src/3d/MergedLedEdges.jsx
// Draws ALL of a cubie's glowing LED edges (neon / wireframe view modes) as a single
// segmented, vertex-colored line instead of one drei <Line> per edge.
//
// Why: the old per-edge WireframeEdge rendered each of a cubie's up-to-12 edges as its
// own Line2 mesh (1 draw call) AND ran its own useFrame pulse subscription. A neon-mode
// corner cubie therefore cost 12 draws + 12 useFrame subscriptions; at 7×7 that dominated
// the frame. Every edge of a given cubie shares the same pulse phase and differs only by
// color, so they collapse cleanly into one Line (`segments`) with per-vertex colors and a
// single pulse useFrame — up to a 12× reduction in both draws and subscriptions per cubie.
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

// edges: [{ start:[x,y,z], end:[x,y,z], color, intensity, pulsePhase }]
// All edges belonging to one cubie share intensity + pulsePhase (see Cubie.jsx), so we
// read those from the first edge for the shared pulse.
const MergedLedEdges = ({ edges }) => {
  const lineRef = useRef();

  // Flatten to segment endpoint pairs + matching per-vertex colors. `segments` mode
  // treats each consecutive pair of points as an independent segment, so no connecting
  // lines are drawn between separate edges.
  const { points, vertexColors } = useMemo(() => {
    const pts = [];
    const cols = [];
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const c = new THREE.Color(e.color);
      pts.push(e.start, e.end);
      cols.push(c, c);
    }
    return { points: pts, vertexColors: cols };
  }, [edges]);

  const intensity = edges[0]?.intensity ?? 1;
  const pulsePhase = edges[0]?.pulsePhase ?? 0;

  useFrame((state) => {
    if (!lineRef.current) return;
    const t = state.clock.elapsedTime + pulsePhase;
    const pulse = 0.7 + Math.sin(t * 3) * 0.3;
    lineRef.current.material.opacity = intensity * pulse;
  });

  if (points.length === 0) return null;

  return (
    <Line
      ref={lineRef}
      points={points}
      segments
      vertexColors={vertexColors}
      lineWidth={2.5}
      transparent
      opacity={intensity}
    />
  );
};

export default MergedLedEdges;
