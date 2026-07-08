import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PALETTES = {
  intro: {
    core: '#dffaff',
    mid: '#4ea7ff',
    outer: '#17103f',
    vein: '#f8dca0',
  },
  menu: {
    core: '#fff3ba',
    mid: '#a35cff',
    outer: '#060616',
    vein: '#5ee7ff',
  },
  game: {
    core: '#e6fbff',
    mid: '#6d65ff',
    outer: '#050713',
    vein: '#ffc36b',
  },
};

function makeNebulaFragmentShader(stepCount) {
  return `
    varying vec3 vWorldPosition;

    uniform float uTime;
    uniform float uRidgeTime;
    uniform float uVeinTime;
    uniform float uPulse;
    uniform float uDensityMult;
    uniform float uStructure;
    uniform vec3 uColorCore;
    uniform vec3 uColorMid;
    uniform vec3 uColorOuter;
    uniform vec3 uColorVein;

    float hash31(vec3 p) {
      p = fract(p * 0.1031);
      p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }

    float noise3(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
      float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
      float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
      float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
      float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
      float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
      float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
      float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

      float nx00 = mix(n000, n100, f.x);
      float nx10 = mix(n010, n110, f.x);
      float nx01 = mix(n001, n101, f.x);
      float nx11 = mix(n011, n111, f.x);
      float nxy0 = mix(nx00, nx10, f.y);
      float nxy1 = mix(nx01, nx11, f.y);
      return mix(nxy0, nxy1, f.z);
    }

    float fbm(vec3 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * noise3(p);
        p = p * 2.05 + vec3(7.1, 3.7, 5.3);
        a *= 0.5;
      }
      return v;
    }

    float ridge(vec3 p) {
      float v = 0.0;
      float a = 0.55;
      for (int i = 0; i < 4; i++) {
        float n = noise3(p);
        n = 1.0 - abs(n * 2.0 - 1.0);
        v += n * n * a;
        p = p * 2.15 + vec3(11.0, 2.0, 6.0);
        a *= 0.48;
      }
      return v;
    }

    float veinNoise(vec3 p) {
      float n = fbm(p);
      float lines = abs(fract(n * 7.0 + fbm(p * 0.55) * 1.6) - 0.5);
      return smoothstep(0.085, 0.0, lines);
    }

    vec2 hitBox(vec3 ro, vec3 rd, vec3 boxSize) {
      vec3 invR = 1.0 / rd;
      vec3 tbot = (-boxSize - ro) * invR;
      vec3 ttop = ( boxSize - ro) * invR;
      vec3 tmin = min(ttop, tbot);
      vec3 tmax = max(ttop, tbot);
      float t0 = max(max(tmin.x, tmin.y), tmin.z);
      float t1 = min(min(tmax.x, tmax.y), tmax.z);
      return vec2(t0, t1);
    }

    void main() {
      vec3 ro = cameraPosition;
      vec3 rd = normalize(vWorldPosition - ro);
      vec2 bounds = hitBox(ro, rd, vec3(19.0));
      if (bounds.x > bounds.y) discard;

      float t = max(bounds.x, 0.0);
      float endT = bounds.y;
      float stepSize = (endT - t) / float(${stepCount});
      vec3 accum = vec3(0.0);
      float alpha = 0.0;

      for (int i = 0; i < ${stepCount}; i++) {
        if (t > endT || alpha > 0.96) break;
        vec3 pos = ro + rd * t;
        vec3 p = pos * 0.075;

        p.xy += vec2(sin(uTime * 0.08), cos(uTime * 0.06)) * 0.45;
        p.z += uTime * 0.055;

        float cloud = fbm(p * (1.15 + uStructure * 0.25));
        float ridges = ridge(p * 1.65 + vec3(0.0, uRidgeTime * 0.06, 0.0));
        float veins = veinNoise(p * 2.25 + vec3(uVeinTime * 0.05, 0.0, -uVeinTime * 0.04));

        float radial = 1.0 - smoothstep(4.0, 18.5, length(pos));
        float density = smoothstep(0.38, 0.82, cloud + ridges * 0.55) * radial;
        density += veins * 0.22 * radial;
        density *= 0.072 * uDensityMult * (1.0 + uPulse * 0.75);

        vec3 nebulaColor = mix(uColorOuter, uColorMid, smoothstep(0.18, 0.78, cloud));
        nebulaColor = mix(nebulaColor, uColorCore, smoothstep(0.58, 1.18, ridges + veins * 0.65));
        nebulaColor += uColorVein * veins * (0.45 + uPulse * 0.85);

        float starSeed = hash31(floor(pos * 0.75));
        float starCell = smoothstep(0.992, 1.0, starSeed);
        nebulaColor += vec3(0.9, 0.96, 1.0) * starCell * radial * 1.4;
        density += starCell * 0.015;

        float oneMinusAlpha = 1.0 - alpha;
        accum += nebulaColor * density * oneMinusAlpha;
        alpha += density * oneMinusAlpha;
        t += stepSize;
      }

      vec3 dir = normalize(vWorldPosition);
      float vignette = smoothstep(-0.35, 0.8, dir.y) * 0.18 + 0.82;
      vec3 color = uColorOuter * 0.46 + accum * 1.35;
      color *= vignette;
      color += uColorCore * uPulse * 0.10;
      gl_FragColor = vec4(color, 1.0);
    }
  `;
}

const vertexShader = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export default function NebulaEnvironment({
  pulseTrigger = 0,
  speed = 1,
  density = 1,
  structure = 1,
  variant = 'menu',
  performanceMode = false,
}) {
  const meshRef = useRef();
  const materialRef = useRef();
  const [pulseIntensity, setPulseIntensity] = useState(0);

  useEffect(() => {
    if (pulseTrigger > 0) setPulseIntensity(1);
  }, [pulseTrigger]);

  const palette = PALETTES[variant] ?? PALETTES.menu;
  const shaderMaterial = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uRidgeTime: { value: 0 },
      uVeinTime: { value: 0 },
      uPulse: { value: 0 },
      uDensityMult: { value: density },
      uStructure: { value: structure },
      uColorCore: { value: new THREE.Color(palette.core) },
      uColorMid: { value: new THREE.Color(palette.mid) },
      uColorOuter: { value: new THREE.Color(palette.outer) },
      uColorVein: { value: new THREE.Color(palette.vein) },
    },
    vertexShader,
    fragmentShader: makeNebulaFragmentShader(performanceMode ? 18 : 32),
  }), [density, structure, palette.core, palette.mid, palette.outer, palette.vein, performanceMode]);

  useEffect(() => () => shaderMaterial.dispose(), [shaderMaterial]);

  useFrame((state, delta) => {
    const mat = materialRef.current;
    if (!mat) return;

    const t = state.clock.elapsedTime * speed;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uRidgeTime.value = t * 1.35;
    mat.uniforms.uVeinTime.value = t * 0.75;
    mat.uniforms.uPulse.value = pulseIntensity;
    mat.uniforms.uDensityMult.value = density;
    mat.uniforms.uStructure.value = structure;

    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.012 * speed;
      meshRef.current.rotation.x = Math.sin(t * 0.05) * 0.04;
    }

    if (pulseIntensity > 0) {
      setPulseIntensity((prev) => Math.max(0, prev - delta * 1.8));
    }
  });

  return (
    <mesh ref={meshRef} scale={[40, 40, 40]} renderOrder={-1000} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  );
}
