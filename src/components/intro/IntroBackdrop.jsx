import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Screen-space backdrop: it cannot intersect the cinematic's orbiting camera.
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

function fragmentShader(performanceMode) {
  return `
    varying vec2 vUv;
    uniform float uTime;
    uniform float uAspect;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    float cloud(vec2 p) {
      float n = 0.0, weight = 0.55;
      for (int i = 0; i < ${performanceMode ? 2 : 3}; i++) {
        n += noise(p) * weight;
        p = mat2(1.6, 1.2, -1.2, 1.6) * p + 4.7;
        weight *= 0.5;
      }
      return n;
    }
    void main() {
      vec2 p = (vUv - vec2(0.5, 0.56)) * vec2(uAspect, 1.0);
      float t = uTime * 0.045;
      float haze = cloud(p * 3.2 + vec2(t, -t * 0.4));
      float detail = noise(p * 8.0 + haze * 2.0 - vec2(t * 0.3, t));
      float bend = p.y - 0.18 * sin(p.x * 3.0 + t) - 0.10;
      float veil = exp(-abs(bend + (haze - 0.5) * 0.36) * 8.0);
      vec3 emerald = vec3(0.035, 0.24, 0.15);
      vec3 violet = vec3(0.19, 0.055, 0.22);
      vec3 gold = vec3(0.60, 0.37, 0.12);
      vec3 col = vec3(0.007, 0.012, 0.016);
      col += mix(emerald, violet, smoothstep(-0.4, 0.4, p.x))
        * (0.12 + veil * 0.62) * (0.35 + haze * 0.85);
      col += emerald * exp(-length((p - vec2(-0.28, -0.10)) * vec2(1.4, 1.0)) * 5.0) * 0.22;

      // Two fine, incomplete orbital contours frame the cube. Their light moves
      // slowly along the arcs; the rings themselves do not spin with the camera.
      vec2 orbit = mat2(0.91, 0.41, -0.41, 0.91) * p;
      orbit.y *= 1.55;
      float radius = length(orbit);
      float angle = atan(orbit.y, orbit.x);
      float aa = max(fwidth(radius), 0.001);
      float ring = 1.0 - smoothstep(0.001, 0.001 + aa, abs(radius - 0.43));
      float outer = 1.0 - smoothstep(0.0006, 0.0006 + aa, abs(radius - 0.59));
      float arc = smoothstep(0.15, 0.85, sin(angle * 2.0 + 0.7));
      float glimmer = 0.65 + 0.35 * sin(angle - t * 0.6);
      col += gold * (ring * arc * 0.24 + outer * (1.0 - arc) * 0.10) * glimmer;
      col += gold * exp(-abs(radius - 0.43) * 65.0) * arc * 0.035;
      // Folded light bands give the cloud a visible flow instead of a flat wash.
      float folds = pow(0.5 + 0.5 * sin(bend * 34.0 + haze * 10.0), 8.0);
      col += mix(emerald, violet, smoothstep(-0.3, 0.5, p.x))
        * veil * folds * (0.24 + detail * 0.18);

      // Sparse deterministic dust, no textures, particle meshes, or twinkle flashes.
      vec2 stars = (p + vec2(t * 0.025, -t * 0.018)) * 65.0;
      vec2 cell = floor(stars);
      vec2 offset = vec2(hash(cell + 2.3), hash(cell + 9.1)) * 0.6 + 0.2;
      float star = 1.0 - smoothstep(0.01, 0.085, length(fract(stars) - offset));
      star *= step(${performanceMode ? '0.989' : '0.981'}, hash(cell));
      col += vec3(0.70, 0.76, 0.60) * star * 0.35;

      // Let the cube occupy the brightest area; leave room for cream copy below.
      col *= mix(0.38, 1.0, smoothstep(0.03, 0.40, vUv.y));
      col *= 1.0 - smoothstep(0.28, 1.05, length(p)) * 0.48;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }
  `;
}

export default function IntroBackdrop({ time = 0, reducedMotion = false, performanceMode = false }) {
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uAspect: { value: 1 } }), []);
  const fragment = useMemo(() => fragmentShader(performanceMode), [performanceMode]);
  useFrame(({ size }) => {
    uniforms.uTime.value = reducedMotion ? 0 : time;
    uniforms.uAspect.value = size.width / Math.max(1, size.height);
  });
  return (
    <mesh frustumCulled={false} renderOrder={-1000}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragment}
        extensions={{ derivatives: true }} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
