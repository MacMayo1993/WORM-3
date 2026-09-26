import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PAPER_GRID as P, glslFloat as f, glslVec3 } from '../utils/paperGrid.js';

// The paper's numbers live in PAPER_GRID, which the loading screen also draws its
// 2D-canvas copy of this sheet from: tune them there and both stay one paper.
const fragmentShader = `varying vec2 paperUv;
        uniform float aspect;
        uniform float time;
        uniform float motion;
        void main() {
          vec2 gridUv = paperUv * vec2(aspect, 1.0) * ${f(P.rows)};
          // Broad waves bend the grid by just over half a square, cycling
          // every 14–17 seconds so the motion reads within a glance on phones.
          // Opposing phases create a breathing-paper illusion, with
          // a single antialiased grid to avoid moire or flickering overlaps.
          vec2 wave = vec2(
            sin(gridUv.y * ${f(P.bendFreqY)} + time * ${f(P.bendSpeedY)}),
            sin(gridUv.x * ${f(P.bendFreqX)} - time * ${f(P.bendSpeedX)})
          );
          gridUv += motion * (wave * ${f(P.bend)} + vec2(
            sin(time * ${f(P.driftSpeedX)}), cos(time * ${f(P.driftSpeedY)})
          ) * ${f(P.drift)});
          vec2 line = abs(fract(gridUv - 0.5) - 0.5) / fwidth(gridUv);
          float grid = 1.0 - min(min(line.x, line.y), 1.0);
          vec3 paper = mix(${glslVec3(P.paperEdge)}, ${glslVec3(P.paperCentre)}, 1.0 - distance(paperUv, vec2(${P.highlight.map(f).join(', ')})));
          gl_FragColor = vec4(mix(paper, ${glslVec3(P.line)}, grid * ${f(P.lineMix)}), 1.0);
        }`;

// A screen-aligned backdrop INSIDE the existing WebGL scene. The transparent
// carousel overlay never paints over the live cube. Grid density uses the
// viewport aspect, so it is stable on high-DPR phones too.
export default function MenuPaperBackdrop() {
  const size = useThree(state => state.size);
  const reducedMotion = useRef(true);
  const uniforms = useMemo(() => ({
    aspect: { value: 1 },
    time: { value: 0 },
    motion: { value: 0 },
  }), []);
  uniforms.aspect.value = size.width / Math.max(size.height, 1);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => {
      reducedMotion.current = media?.matches ?? false;
      uniforms.motion.value = reducedMotion.current ? 0 : 1;
    };
    update();
    media?.addEventListener('change', update);
    return () => media?.removeEventListener('change', update);
  }, [uniforms]);

  useFrame((_, delta) => {
    // Local time avoids a jump after the tab resumes. No React updates or
    // camera movement: only the paper coordinates drift inside the shader.
    if (!reducedMotion.current && !document.hidden) {
      uniforms.time.value += Math.min(delta, 0.05);
    }
  });

  return <mesh frustumCulled={false} renderOrder={-0.5}>
    <planeGeometry args={[2, 2]} />
    <shaderMaterial depthWrite={false} toneMapped={false} uniforms={uniforms}
      vertexShader={`varying vec2 paperUv;
        void main() { paperUv = uv; gl_Position = vec4(position.xy, 0.999999, 1.0); }`}
      fragmentShader={fragmentShader}
      extensions={{ derivatives: true }} />
  </mesh>;
}
