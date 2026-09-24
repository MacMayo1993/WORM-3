import React from 'react';
import { useThree } from '@react-three/fiber';

// A screen-aligned backdrop INSIDE the existing WebGL scene. The transparent
// carousel overlay never paints over the live cube. Grid density uses the
// viewport aspect, so it is stable on high-DPR phones too.
export default function MenuPaperBackdrop() {
  const size = useThree(state => state.size);
  return <mesh frustumCulled={false} renderOrder={-0.5}>
    <planeGeometry args={[2, 2]} />
    <shaderMaterial depthWrite={false} toneMapped={false} uniforms={{ aspect: { value: size.width / size.height } }}
      vertexShader={`varying vec2 paperUv;
        void main() { paperUv = uv; gl_Position = vec4(position.xy, 0.999999, 1.0); }`}
      fragmentShader={`varying vec2 paperUv; uniform float aspect;
        void main() {
          vec2 gridUv = paperUv * vec2(aspect, 1.0) * 26.0;
          vec2 line = abs(fract(gridUv - 0.5) - 0.5) / fwidth(gridUv);
          float grid = 1.0 - min(min(line.x, line.y), 1.0);
          vec3 paper = mix(vec3(0.97, 0.95, 0.90), vec3(1.0, 0.99, 0.95), 1.0 - distance(paperUv, vec2(0.5, 0.55)));
          gl_FragColor = vec4(mix(paper, vec3(0.80, 0.80, 0.75), grid * 0.24), 1.0);
        }`}
      extensions={{ derivatives: true }} />
  </mesh>;
}
