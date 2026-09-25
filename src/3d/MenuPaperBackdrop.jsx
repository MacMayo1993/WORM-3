import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

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
      fragmentShader={`varying vec2 paperUv;
        uniform float aspect;
        uniform float time;
        uniform float motion;
        void main() {
          vec2 gridUv = paperUv * vec2(aspect, 1.0) * 26.0;
          // Broad waves move just a fraction of a square over ~30 seconds.
          // Opposing phases create a gentle breathing-paper illusion, with
          // a single antialiased grid to avoid moire or flickering overlaps.
          vec2 wave = vec2(
            sin(gridUv.y * 0.24 + time * 0.20),
            sin(gridUv.x * 0.22 - time * 0.17)
          );
          gridUv += motion * (wave * 0.12 + vec2(
            sin(time * 0.10), cos(time * 0.09)
          ) * 0.16);
          vec2 line = abs(fract(gridUv - 0.5) - 0.5) / fwidth(gridUv);
          float grid = 1.0 - min(min(line.x, line.y), 1.0);
          vec3 paper = mix(vec3(0.94, 0.92, 0.86), vec3(0.98, 0.97, 0.92), 1.0 - distance(paperUv, vec2(0.5, 0.55)));
          gl_FragColor = vec4(mix(paper, vec3(0.64, 0.68, 0.61), grid * 0.40), 1.0);
        }`}
      extensions={{ derivatives: true }} />
  </mesh>;
}
