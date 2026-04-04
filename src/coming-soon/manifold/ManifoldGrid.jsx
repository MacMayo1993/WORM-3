import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const ManifoldGrid = ({ color = '#3d5a3d', opacity = 0.2 }) => {
  const materialRef = useRef();

  const vertexShader = `
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
      vPosition = position;
      vNormal = normal;
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uOpacity;

    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;

    #define PI 3.14159265359

    // Grid line function
    float gridLine(float coord, float width) {
      float line = abs(fract(coord - 0.5) - 0.5);
      return 1.0 - smoothstep(0.0, width, line);
    }

    // Projective plane coordinate transformation
    // Maps sphere to RP2 by identifying antipodal points
    vec2 projectiveCoords(vec3 p) {
      // Normalize to sphere
      vec3 n = normalize(p);

      // Use absolute values to identify antipodal points
      // This creates the "fold" of the projective plane
      float theta = atan(length(n.xy), abs(n.z));
      float phi = atan(abs(n.y), abs(n.x));

      return vec2(phi / PI, theta / PI * 2.0);
    }

    void main() {
      vec3 pos = normalize(vPosition);

      // Get projective coordinates (identifies opposite points)
      vec2 pCoord = projectiveCoords(vPosition);

      // Latitude/longitude grid on sphere
      float theta = acos(pos.y); // 0 to PI
      float phi = atan(pos.z, pos.x); // -PI to PI

      // Grid lines - latitude and longitude
      float latLines = gridLine(theta * 6.0 / PI, 0.02);
      float lonLines = gridLine(phi * 6.0 / PI, 0.02);

      // Finer grid
      float fineLatLines = gridLine(theta * 18.0 / PI, 0.015) * 0.4;
      float fineLonLines = gridLine(phi * 18.0 / PI, 0.015) * 0.4;

      // Combine grids
      float grid = max(latLines, lonLines) + max(fineLatLines, fineLonLines);

      // Animated "flow" lines showing antipodal connection
      float flow = sin(theta * 4.0 + phi * 4.0 + uTime * 0.5) * 0.5 + 0.5;
      float flowLines = smoothstep(0.48, 0.5, flow) * smoothstep(0.52, 0.5, flow) * 0.5;

      // Equator highlight (shows the "seam" of projective plane)
      float equator = smoothstep(0.1, 0.0, abs(pos.y)) * 0.3;

      // Meridian highlights at 90 degree intervals
      float meridianHighlight = smoothstep(0.05, 0.0, abs(fract(phi / PI * 2.0 + 0.25) - 0.5)) * 0.2;

      // Cross-cap singularity hints at poles
      float poleGlow = smoothstep(0.3, 0.0, abs(abs(pos.y) - 1.0)) * 0.15;

      // Combine everything
      float total = grid + flowLines + equator + meridianHighlight + poleGlow;

      vec3 finalColor = uColor * total;
      float alpha = total * uOpacity;

      // Add slight color variation based on hemisphere (shows identification)
      finalColor += vec3(0.1, 0.05, 0.0) * (pos.y > 0.0 ? 0.1 : 0.0) * grid;

      gl_FragColor = vec4(finalColor, alpha);
    }
  `;

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[30, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
        }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
      />
    </mesh>
  );
};

export default ManifoldGrid;
