import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ── Shared GLSL ───────────────────────────────────────────────── */

const VERT = `
  varying vec3 vPosition;
  void main() {
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NOISE_LIB = `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float f = 0.5 * noise(p); p *= 2.01;
    f += 0.25 * noise(p); p *= 2.02;
    f += 0.125 * noise(p); p *= 2.03;
    f += 0.0625 * noise(p);
    return f;
  }
`;

/* ── Reusable hook + wrapper ───────────────────────────────────── */

function useWonderShader(fragmentShader, flipTrigger) {
  const materialRef = useRef();
  const [pulseIntensity, setPulseIntensity] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (flipTrigger > 0) setPulseIntensity(1.0); }, [flipTrigger]);

  const shaderMaterial = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { time: { value: 0 }, pulseIntensity: { value: 0 } },
    vertexShader: VERT,
    fragmentShader,
  }), [fragmentShader]);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.pulseIntensity.value = pulseIntensity;
    }
    if (pulseIntensity > 0) setPulseIntensity((prev) => Math.max(0, prev - delta * 2.5));
  });

  return { materialRef, shaderMaterial };
}

function WonderSphere({ shader, flipTrigger }) {
  const { materialRef, shaderMaterial } = useWonderShader(shader, flipTrigger);
  return (
    <mesh>
      <sphereGeometry args={[100, 32, 32]} />
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   1. GREAT WALL OF CHINA
   Layered mountain ridges with the wall tracing the ridgeline,
   golden hour sunset, mist in the valleys.
   ═══════════════════════════════════════════════════════════════════ */

const GREAT_WALL_FRAG = `
  uniform float time;
  uniform float pulseIntensity;
  varying vec3 vPosition;
  ${NOISE_LIB}

  void main() {
    vec3 dir = normalize(vPosition);
    float t = time * 0.08;
    float angle = atan(dir.x, dir.z);
    float y = dir.y;

    // Golden hour sky
    vec3 skyHigh = vec3(0.1, 0.15, 0.42);
    vec3 skyMid  = vec3(0.85, 0.5, 0.22);
    vec3 skyLow  = vec3(0.95, 0.72, 0.32);
    vec3 color = y > 0.3 ? mix(skyMid, skyHigh, smoothstep(0.3, 0.9, y))
                         : mix(skyLow, skyMid, smoothstep(-0.1, 0.3, y));

    // Clouds
    float cloud = fbm(vec2(angle * 3.0 + t * 0.3, y * 5.0 + t * 0.08));
    cloud = smoothstep(0.42, 0.65, cloud) * smoothstep(0.85, 0.3, y) * smoothstep(0.05, 0.25, y);
    color = mix(color, mix(vec3(0.95, 0.7, 0.35), vec3(1.0, 0.9, 0.8), cloud), cloud * 0.5);

    // Sun
    vec3 sunDir = normalize(vec3(0.5, 0.13, 0.86));
    float sunDot = max(0.0, dot(dir, sunDir));
    color += vec3(1.0, 0.88, 0.55) * pow(sunDot, 120.0) * 2.0;
    color += vec3(0.6, 0.35, 0.1) * pow(sunDot, 8.0) * 0.35;

    // 5 mountain ridges, back-to-front
    for (float i = 0.0; i < 5.0; i++) {
      float depth = (4.0 - i) / 4.0;
      float h = -0.22 + depth * 0.13;
      h += sin(angle * (3.0 + i * 2.5) + i * 2.0) * (0.08 + i * 0.012);
      h += sin(angle * (8.0 + i * 3.0) + i * 5.0) * 0.04;
      h += fbm(vec2(angle * 4.0 + i * 7.0, i)) * 0.06;

      if (y < h + 0.01) {
        vec3 mc = mix(vec3(0.1, 0.16, 0.07), vec3(0.32, 0.36, 0.46), depth);
        mc = mix(mc, vec3(0.7, 0.55, 0.42), depth * 0.55);
        color = mix(color, mc, smoothstep(h + 0.01, h - 0.02, y));
      }
      // Mist
      float mh = h + 0.04;
      float mist = smoothstep(mh + 0.04, mh, y) * smoothstep(mh - 0.08, mh, y);
      color = mix(color, vec3(0.75, 0.62, 0.5), mist * depth * 0.22);
    }

    // Wall on the 2nd ridge
    float wh = -0.22 + 0.75 * 0.13;
    wh += sin(angle * 5.5 + 2.0) * 0.092;
    wh += sin(angle * 11.0 + 5.0) * 0.04;
    wh += fbm(vec2(angle * 4.0 + 7.0, 1.0)) * 0.06;
    wh += 0.015;
    float wt = 0.006;
    float tw = mod(angle, 0.35);
    float isTower = smoothstep(0.035, 0.012, abs(tw - 0.175));
    float th = wt * (1.0 + isTower * 2.5);
    if (y > wh - wt * 0.3 && y < wh + th) {
      color = vec3(0.48, 0.4, 0.32);
    }

    if (pulseIntensity > 0.01) color += vec3(0.4, 0.25, 0.08) * pulseIntensity * 0.5;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function GreatWallEnvironment({ flipTrigger = 0 }) {
  return <WonderSphere shader={GREAT_WALL_FRAG} flipTrigger={flipTrigger} />;
}

/* ═══════════════════════════════════════════════════════════════════
   2. PETRA
   Rose-red sandstone canyon (the Siq) with the Treasury facade
   carved into the rock, warm desert light, floating dust motes.
   ═══════════════════════════════════════════════════════════════════ */

const PETRA_FRAG = `
  uniform float time;
  uniform float pulseIntensity;
  varying vec3 vPosition;
  ${NOISE_LIB}

  void main() {
    vec3 dir = normalize(vPosition);
    float t = time * 0.1;
    float angle = atan(dir.x, dir.z);
    float y = dir.y;
    float fa = mod(angle + 3.14159, 6.28318) - 3.14159;

    // Narrow sky above
    vec3 sky = mix(vec3(0.55, 0.7, 0.92), vec3(0.3, 0.5, 0.85), smoothstep(0.3, 0.95, y));
    vec3 color = sky;

    // Canyon walls — sandstone on either side
    float cw = 0.55 + fbm(vec2(y * 2.0, 1.0)) * 0.15;
    float wallBlend = 0.0;
    if (fa < -cw * 0.5) wallBlend = smoothstep(-cw * 0.5, -cw * 0.5 - 0.5, fa);
    if (fa >  cw * 0.5) wallBlend = smoothstep(cw * 0.5, cw * 0.5 + 0.5, fa);

    // Also walls behind us
    float behindAngle = abs(abs(fa) - 3.14159);
    if (behindAngle < 1.2) wallBlend = max(wallBlend, smoothstep(1.2, 0.3, behindAngle));

    if (wallBlend > 0.0) {
      float layers = sin(y * 18.0 + fbm(vec2(fa * 5.0, y * 3.0)) * 3.0) * 0.5 + 0.5;
      vec3 stone = mix(vec3(0.72, 0.35, 0.25), vec3(0.88, 0.55, 0.38), layers);
      stone = mix(stone, vec3(0.6, 0.28, 0.18), fbm(vec2(fa * 8.0, y * 6.0)) * 0.3);
      float erosion = fbm(vec2(fa * 12.0, y * 8.0));
      stone *= 1.0 - smoothstep(0.5, 0.7, erosion) * 0.2;
      color = mix(color, stone, wallBlend);
    }

    // Treasury facade — facing forward (angle near 0)
    if (abs(fa) < 0.4 && y > -0.45 && y < 0.55) {
      float fx = fa / 0.4;
      float fy = (y + 0.45) / 1.0;

      // Pediment (triangular top)
      float pedH = 0.7 + max(0.0, 1.0 - fx * fx * 2.0) * 0.18;
      float facade = step(abs(fx), 0.85) * step(0.0, fy) * step(fy, pedH);

      // Columns
      float cols = 0.0;
      for (float c = -3.0; c <= 3.0; c++) {
        float cx = c * 0.2;
        cols += smoothstep(0.025, 0.008, abs(fx - cx)) * step(0.08, fy) * step(fy, pedH - 0.04);
      }

      // Dark doorway
      float door = step(abs(fx), 0.1) * step(0.04, fy) * step(fy, 0.32);

      vec3 fc = vec3(0.78, 0.45, 0.33);
      fc = mix(fc, fc * 0.65, cols);
      fc = mix(fc, vec3(0.04, 0.02, 0.015), door);
      float fb = facade * smoothstep(0.4, 0.25, abs(fa));
      color = mix(color, fc, fb * 0.92);
    }

    // Sandy ground
    if (y < -0.35) {
      vec3 sand = mix(vec3(0.72, 0.58, 0.42), vec3(0.82, 0.68, 0.5), fbm(vec2(angle * 4.0, y * 3.0)));
      color = mix(color, sand, smoothstep(-0.35, -0.55, y));
    }

    // Light shaft from above
    float shaft = smoothstep(0.35, 0.0, abs(fa)) * smoothstep(-0.1, 0.4, y);
    color += vec3(0.75, 0.55, 0.35) * shaft * 0.12;

    // Dust motes
    vec3 ds = dir * 35.0;
    vec3 dc = floor(ds);
    for (int dx = 0; dx <= 1; dx++) {
      for (int dy = 0; dy <= 1; dy++) {
        for (int dz = 0; dz <= 1; dz++) {
          vec3 n = dc + vec3(float(dx), float(dy), float(dz));
          float h = hash3(n);
          vec3 dp = n + vec3(h, hash3(n + 100.0), hash3(n + 200.0));
          dp += vec3(sin(t + h * 6.28) * 0.3, sin(t * 0.4 + h * 3.14) * 0.2, 0.0);
          float d = length(ds - dp);
          color += vec3(0.9, 0.7, 0.45) * smoothstep(0.4, 0.0, d) * shaft * 0.12;
        }
      }
    }

    if (pulseIntensity > 0.01) color += vec3(0.5, 0.25, 0.12) * pulseIntensity * 0.4;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function PetraEnvironment({ flipTrigger = 0 }) {
  return <WonderSphere shader={PETRA_FRAG} flipTrigger={flipTrigger} />;
}

/* ═══════════════════════════════════════════════════════════════════
   3. CHRIST THE REDEEMER
   Twilight panorama from Corcovado — Rio city lights below,
   Sugarloaf silhouette, ocean reflecting moonlight, tropical sky.
   ═══════════════════════════════════════════════════════════════════ */

const REDEEMER_FRAG = `
  uniform float time;
  uniform float pulseIntensity;
  varying vec3 vPosition;
  ${NOISE_LIB}

  void main() {
    vec3 dir = normalize(vPosition);
    float t = time * 0.06;
    float angle = atan(dir.x, dir.z);
    float y = dir.y;

    // Twilight sky — deep blue to warm horizon
    vec3 skyTop = vec3(0.02, 0.04, 0.12);
    vec3 skyMid = vec3(0.08, 0.06, 0.2);
    vec3 skyHor = vec3(0.35, 0.2, 0.35);
    vec3 color = y > 0.3 ? mix(skyMid, skyTop, smoothstep(0.3, 0.95, y))
                         : mix(skyHor, skyMid, smoothstep(-0.1, 0.3, y));

    // Stars
    vec3 sp = dir * 70.0;
    vec3 sc = floor(sp);
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        for (int dz = -1; dz <= 1; dz++) {
          vec3 nb = sc + vec3(float(dx), float(dy), float(dz));
          float h = hash3(nb);
          if (h > 0.85 && y > 0.1) {
            vec3 spos = nb + vec3(h, hash3(nb + 100.0), hash3(nb + 200.0));
            float d = length(sp - spos);
            float twinkle = 0.6 + 0.4 * sin(time * (1.5 + h * 3.0) + h * 6.28);
            color += vec3(0.9, 0.92, 1.0) * smoothstep(0.03, 0.0, d) * twinkle * 0.8;
          }
        }
      }
    }

    // Moon
    vec3 moonDir = normalize(vec3(-0.4, 0.55, 0.7));
    float moonDot = max(0.0, dot(dir, moonDir));
    color += vec3(0.9, 0.88, 0.8) * pow(moonDot, 600.0) * 3.0;
    color += vec3(0.2, 0.2, 0.25) * pow(moonDot, 15.0) * 0.3;

    // Mountain silhouettes (Sugarloaf + surrounding peaks)
    float mtnH = -0.18;
    mtnH += sin(angle * 2.0 + 1.0) * 0.06;
    mtnH += sin(angle * 5.0 + 3.0) * 0.04;
    mtnH += fbm(vec2(angle * 3.0, 0.5)) * 0.05;
    // Sugarloaf — distinctive dome at one angle
    float sugarloaf = exp(-pow((angle - 1.2) * 4.0, 2.0)) * 0.2;
    mtnH += sugarloaf;

    if (y < mtnH + 0.01) {
      vec3 mc = vec3(0.02, 0.03, 0.06);
      color = mix(color, mc, smoothstep(mtnH + 0.01, mtnH - 0.01, y));
    }

    // Ocean — lower hemisphere
    if (y < -0.22) {
      vec3 ocean = vec3(0.01, 0.02, 0.06);
      // Moonpath reflection
      float moonRefl = pow(max(0.0, dot(normalize(vec3(dir.x, -dir.y, dir.z)), moonDir)), 80.0);
      float ripple = sin(angle * 40.0 + t * 3.0) * 0.5 + 0.5;
      ocean += vec3(0.4, 0.38, 0.3) * moonRefl * ripple * 0.5;
      color = mix(color, ocean, smoothstep(-0.22, -0.35, y));
    }

    // City lights — scattered below the mountains
    if (y < mtnH && y > -0.4) {
      vec2 cityUV = vec2(angle * 80.0, y * 80.0);
      vec2 ci = floor(cityUV);
      float h = hash(ci);
      if (h > 0.7) {
        float twinkle = 0.5 + 0.5 * sin(time * (1.0 + h * 4.0) + h * 20.0);
        vec2 cf = fract(cityUV);
        float light = smoothstep(0.35, 0.15, length(cf - 0.5)) * twinkle;
        vec3 lc = h > 0.9 ? vec3(1.0, 0.8, 0.3) : h > 0.8 ? vec3(1.0, 0.6, 0.2) : vec3(0.9, 0.85, 0.7);
        color += lc * light * 0.4;
      }
    }

    // Warm glow on horizon from city
    color += vec3(0.12, 0.06, 0.03) * smoothstep(0.1, -0.15, y) * smoothstep(-0.4, -0.1, y);

    // Thin clouds
    float cloud = fbm(vec2(angle * 2.0 + t * 0.2, y * 4.0));
    cloud = smoothstep(0.5, 0.65, cloud) * smoothstep(0.7, 0.15, y) * smoothstep(0.0, 0.15, y);
    color = mix(color, vec3(0.08, 0.07, 0.15), cloud * 0.3);

    if (pulseIntensity > 0.01) color += vec3(0.15, 0.1, 0.3) * pulseIntensity * 0.5;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function RedeemerEnvironment({ flipTrigger = 0 }) {
  return <WonderSphere shader={REDEEMER_FRAG} flipTrigger={flipTrigger} />;
}

/* ═══════════════════════════════════════════════════════════════════
   4. MACHU PICCHU
   Cloud-forest terraces among misty Andean peaks, dramatic light
   breaking through swirling clouds, lush green vegetation.
   ═══════════════════════════════════════════════════════════════════ */

const MACHU_PICCHU_FRAG = `
  uniform float time;
  uniform float pulseIntensity;
  varying vec3 vPosition;
  ${NOISE_LIB}

  void main() {
    vec3 dir = normalize(vPosition);
    float t = time * 0.1;
    float angle = atan(dir.x, dir.z);
    float y = dir.y;

    // Overcast sky with drama
    vec3 skyTop = vec3(0.45, 0.52, 0.6);
    vec3 skyLow = vec3(0.7, 0.72, 0.68);
    vec3 color = mix(skyLow, skyTop, smoothstep(0.0, 0.9, y));

    // Dramatic clouds
    float cloud = fbm(vec2(angle * 2.5 + t * 0.15, y * 3.0 + t * 0.05));
    float cloud2 = fbm(vec2(angle * 4.0 - t * 0.1, y * 5.0 + t * 0.08));
    float cm = cloud * 0.6 + cloud2 * 0.4;
    float cloudMask = smoothstep(0.35, 0.6, cm) * smoothstep(0.95, 0.2, y);
    color = mix(color, vec3(0.82, 0.82, 0.78), cloudMask * 0.6);

    // God rays breaking through
    float rayAngle = sin(t * 0.3) * 0.5;
    float ray = smoothstep(0.15, 0.0, abs(angle - rayAngle)) * smoothstep(0.0, 0.4, y) * (1.0 - cloudMask);
    color += vec3(0.9, 0.85, 0.6) * ray * 0.25;

    // Sharp mountain peaks (Huayna Picchu style)
    float peakH = -0.1;
    peakH += sin(angle * 2.5 + 0.5) * 0.08;
    peakH += sin(angle * 6.0 + 2.0) * 0.05;
    peakH += fbm(vec2(angle * 5.0, 0.0)) * 0.08;
    // Dramatic central peak
    float huayna = exp(-pow((angle - 0.8) * 3.5, 2.0)) * 0.35;
    peakH += huayna;
    float peak2 = exp(-pow((angle + 1.5) * 2.8, 2.0)) * 0.25;
    peakH += peak2;

    if (y < peakH + 0.01) {
      float rockBlend = smoothstep(peakH + 0.01, peakH - 0.03, y);
      // Green vegetation lower, grey rock on peaks
      float vegLine = peakH - 0.08;
      vec3 rock = vec3(0.3, 0.32, 0.28);
      vec3 veg = mix(vec3(0.12, 0.28, 0.08), vec3(0.18, 0.35, 0.12), fbm(vec2(angle * 8.0, y * 6.0)));
      vec3 mc = y > vegLine ? rock : veg;
      color = mix(color, mc, rockBlend);
    }

    // Terraces — horizontal steps on the mountainside
    if (y < peakH - 0.02 && y > -0.3) {
      float terraceY = mod(y * 25.0, 1.0);
      float terrace = smoothstep(0.08, 0.03, abs(terraceY - 0.5));
      float inRange = smoothstep(-0.3, -0.1, y) * smoothstep(peakH - 0.02, peakH - 0.08, y);
      // Only on certain angular ranges (where ruins would be)
      float ruinZone = smoothstep(0.2, 0.5, abs(sin(angle * 1.5 + 0.3)));
      color = mix(color, vec3(0.55, 0.5, 0.38), terrace * inRange * ruinZone * 0.5);
    }

    // Flowing mist through valleys
    float mistY = -0.15 + sin(t * 0.3) * 0.03;
    float mistBand = smoothstep(mistY + 0.12, mistY + 0.02, y) * smoothstep(mistY - 0.1, mistY, y);
    float mistDensity = fbm(vec2(angle * 3.0 + t * 0.4, y * 2.0 + t * 0.1));
    color = mix(color, vec3(0.85, 0.87, 0.82), mistBand * mistDensity * 0.6);

    // Green valley floor
    if (y < -0.25) {
      vec3 valley = mix(vec3(0.1, 0.22, 0.06), vec3(0.15, 0.3, 0.1), fbm(vec2(angle * 6.0, y * 4.0)));
      color = mix(color, valley, smoothstep(-0.25, -0.45, y));
    }

    if (pulseIntensity > 0.01) color += vec3(0.2, 0.3, 0.1) * pulseIntensity * 0.5;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function MachuPicchuEnvironment({ flipTrigger = 0 }) {
  return <WonderSphere shader={MACHU_PICCHU_FRAG} flipTrigger={flipTrigger} />;
}

/* ═══════════════════════════════════════════════════════════════════
   5. CHICHEN ITZA
   El Castillo stepped pyramid against a star-filled Mayan sky,
   dense jungle surroundings, fireflies, warm tropical night.
   ═══════════════════════════════════════════════════════════════════ */

const CHICHEN_ITZA_FRAG = `
  uniform float time;
  uniform float pulseIntensity;
  varying vec3 vPosition;
  ${NOISE_LIB}

  void main() {
    vec3 dir = normalize(vPosition);
    float t = time * 0.08;
    float angle = atan(dir.x, dir.z);
    float y = dir.y;

    // Night sky — deep blue-black with Milky Way
    vec3 skyDark = vec3(0.01, 0.015, 0.04);
    vec3 skyHorizon = vec3(0.03, 0.04, 0.08);
    vec3 color = mix(skyHorizon, skyDark, smoothstep(0.0, 0.8, y));

    // Milky Way band
    float milkyAngle = angle * 0.5 + 0.8;
    float milkyBand = exp(-pow((milkyAngle - y * 2.0) * 1.5, 2.0));
    float milkyNoise = fbm(vec2(angle * 8.0 + 0.5, y * 8.0 + 0.3));
    color += vec3(0.08, 0.07, 0.12) * milkyBand * milkyNoise * smoothstep(0.0, 0.2, y);

    // Stars
    vec3 sp = dir * 80.0;
    vec3 sc = floor(sp);
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        for (int dz = -1; dz <= 1; dz++) {
          vec3 nb = sc + vec3(float(dx), float(dy), float(dz));
          float h = hash3(nb);
          vec3 spos = nb + vec3(h, hash3(nb + 100.0), hash3(nb + 200.0));
          float d = length(sp - spos);
          float twinkle = 0.6 + 0.4 * sin(time * (1.5 + h * 3.0) + h * 6.28);
          float star = smoothstep(0.025, 0.0, d) * twinkle;
          vec3 starCol = mix(vec3(1.0, 0.9, 0.7), vec3(0.7, 0.8, 1.0), h);
          color += starCol * star * 0.7 * smoothstep(-0.05, 0.15, y);
        }
      }
    }

    // El Castillo pyramid — stepped silhouette
    float pyramidAngle = angle - 0.5;
    float pa = mod(pyramidAngle + 3.14159, 6.28318) - 3.14159;
    float pyramidW = 0.35;
    if (abs(pa) < pyramidW) {
      float px = abs(pa) / pyramidW;
      // 9 stepped levels
      float stepH = 0.0;
      for (float s = 0.0; s < 9.0; s++) {
        float sw = 1.0 - s / 9.0;
        if (px < sw) stepH = s * 0.04 + 0.02;
      }
      // Temple on top
      if (px < 0.15) stepH = max(stepH, 0.38);
      stepH -= 0.08;

      if (y < stepH && y > -0.1) {
        vec3 stone = vec3(0.35, 0.32, 0.25);
        float tex = fbm(vec2(pa * 20.0, y * 15.0));
        stone = mix(stone, stone * 0.7, tex * 0.3);
        color = mix(color, stone, smoothstep(stepH, stepH - 0.005, y));
      }
    }

    // Jungle treeline
    float jungleH = -0.08 + sin(angle * 4.0) * 0.04 + sin(angle * 11.0) * 0.025;
    jungleH += fbm(vec2(angle * 6.0, 0.0)) * 0.06;
    // Individual treetops
    float treeDetail = sin(angle * 25.0 + sin(angle * 40.0) * 0.5) * 0.015;
    jungleH += treeDetail;

    if (y < jungleH + 0.01) {
      vec3 jungle = mix(vec3(0.02, 0.06, 0.02), vec3(0.04, 0.08, 0.03), fbm(vec2(angle * 10.0, y * 8.0)));
      color = mix(color, jungle, smoothstep(jungleH + 0.01, jungleH - 0.02, y));
    }

    // Stone plaza / ground
    if (y < -0.12) {
      vec3 ground = vec3(0.08, 0.07, 0.05);
      color = mix(color, ground, smoothstep(-0.12, -0.2, y));
    }

    // Fireflies
    for (float i = 0.0; i < 3.0; i++) {
      vec3 fs = dir * (15.0 + i * 10.0);
      vec3 fc = floor(fs);
      for (int dx = -1; dx <= 1; dx++) {
        for (int dy = -1; dy <= 1; dy++) {
          for (int dz = -1; dz <= 1; dz++) {
            vec3 nb = fc + vec3(float(dx), float(dy), float(dz));
            float h = hash3(nb);
            vec3 fp = nb + vec3(h, hash3(nb + 100.0), hash3(nb + 200.0));
            fp += vec3(sin(t * 2.0 + h * 6.28) * 0.4, sin(t * 1.5 + h * 3.14) * 0.3, cos(t * 1.8 + h * 4.0) * 0.4);
            float d = length(fs - fp);
            float pulse = pow(0.5 + 0.5 * sin(t * 3.0 + h * 12.0), 3.0);
            color += vec3(0.6, 0.9, 0.2) * smoothstep(0.4, 0.0, d) * pulse * 0.2;
          }
        }
      }
    }

    if (pulseIntensity > 0.01) color += vec3(0.2, 0.15, 0.05) * pulseIntensity * 0.5;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function ChichenItzaEnvironment({ flipTrigger = 0 }) {
  return <WonderSphere shader={CHICHEN_ITZA_FRAG} flipTrigger={flipTrigger} />;
}

/* ═══════════════════════════════════════════════════════════════════
   6. ROMAN COLOSSEUM
   Inside the ancient arena — tiered arches, warm travertine stone,
   dramatic Mediterranean sunset, atmospheric dust.
   ═══════════════════════════════════════════════════════════════════ */

const COLOSSEUM_FRAG = `
  uniform float time;
  uniform float pulseIntensity;
  varying vec3 vPosition;
  ${NOISE_LIB}

  void main() {
    vec3 dir = normalize(vPosition);
    float t = time * 0.06;
    float angle = atan(dir.x, dir.z);
    float y = dir.y;

    // Mediterranean sunset sky
    vec3 skyTop = vec3(0.15, 0.22, 0.55);
    vec3 skyMid = vec3(0.7, 0.45, 0.25);
    vec3 skyLow = vec3(0.9, 0.65, 0.3);
    vec3 color = y > 0.35 ? mix(skyMid, skyTop, smoothstep(0.35, 0.95, y))
                          : mix(skyLow, skyMid, smoothstep(-0.05, 0.35, y));

    // Wispy clouds
    float cloud = fbm(vec2(angle * 2.0 + t * 0.2, y * 4.0 + t * 0.05));
    cloud = smoothstep(0.45, 0.65, cloud) * smoothstep(0.9, 0.25, y) * smoothstep(0.1, 0.25, y);
    color = mix(color, vec3(0.95, 0.75, 0.5), cloud * 0.4);

    // Sun
    vec3 sunDir = normalize(vec3(-0.6, 0.2, 0.77));
    float sunDot = max(0.0, dot(dir, sunDir));
    color += vec3(1.0, 0.9, 0.6) * pow(sunDot, 100.0) * 1.8;
    color += vec3(0.7, 0.4, 0.15) * pow(sunDot, 6.0) * 0.3;

    // Colosseum wall — repeating arch pattern wrapping around
    float wallTop = 0.35;
    float wallBot = -0.15;

    if (y < wallTop && y > wallBot) {
      float wy = (y - wallBot) / (wallTop - wallBot); // 0 at bottom, 1 at top

      // Three tiers of arches
      float archPattern = 0.0;
      for (float tier = 0.0; tier < 3.0; tier++) {
        float tierBot = tier / 3.0;
        float tierTop = (tier + 1.0) / 3.0;
        if (wy > tierBot && wy < tierTop) {
          float tierY = (wy - tierBot) / (tierTop - tierBot);
          // Arch openings — repeating columns
          float archFreq = 18.0 + tier * 2.0;
          float archX = mod(angle * archFreq / 6.28318, 1.0);
          float archW = 0.35 - tier * 0.03;
          float inArch = step(abs(archX - 0.5), archW * 0.5);
          // Arch curve (semicircle top)
          float archH = sqrt(max(0.0, 1.0 - pow((archX - 0.5) / (archW * 0.5), 2.0)));
          float archCurve = step(tierY, 0.4 + archH * 0.45);
          archPattern += inArch * archCurve * step(0.15, tierY);
        }
      }

      // Travertine stone
      float stoneTex = fbm(vec2(angle * 15.0, y * 12.0));
      vec3 stone = mix(vec3(0.72, 0.62, 0.48), vec3(0.82, 0.72, 0.55), stoneTex);
      stone *= 0.9 + 0.1 * sin(y * 60.0); // Horizontal courses

      // Dark arch openings
      vec3 archColor = vec3(0.08, 0.06, 0.04);

      vec3 wallColor = mix(stone, archColor, archPattern * 0.85);

      // Wall fade
      float wallFade = smoothstep(wallTop, wallTop - 0.02, y) * smoothstep(wallBot, wallBot + 0.02, y);
      color = mix(color, wallColor, wallFade * 0.9);
    }

    // Partial ruin — broken top edge
    float ruinH = wallTop + fbm(vec2(angle * 6.0, 0.0)) * 0.06 - 0.02;
    if (y > wallTop - 0.03 && y < ruinH) {
      float ruinTex = fbm(vec2(angle * 12.0, y * 10.0));
      vec3 ruinStone = vec3(0.65, 0.55, 0.42) * (0.8 + ruinTex * 0.2);
      float ruinBlend = smoothstep(wallTop + 0.02, wallTop - 0.02, y) * step(y, ruinH);
      color = mix(color, ruinStone, ruinBlend * 0.7);
    }

    // Sandy arena floor
    if (y < wallBot) {
      vec3 sand = mix(vec3(0.65, 0.55, 0.38), vec3(0.75, 0.65, 0.48), fbm(vec2(angle * 5.0, y * 4.0)));
      color = mix(color, sand, smoothstep(wallBot, wallBot - 0.15, y));
    }

    // Dust particles in golden light
    vec3 ds = dir * 25.0;
    vec3 dc = floor(ds);
    for (int dx = 0; dx <= 1; dx++) {
      for (int dy = 0; dy <= 1; dy++) {
        for (int dz = 0; dz <= 1; dz++) {
          vec3 nb = dc + vec3(float(dx), float(dy), float(dz));
          float h = hash3(nb);
          vec3 dp = nb + vec3(h, hash3(nb + 100.0), hash3(nb + 200.0));
          dp += vec3(sin(t * 1.5 + h * 6.28) * 0.3, t * 0.2 + sin(t + h * 3.14) * 0.1, 0.0);
          float d = length(ds - dp);
          float dustLight = pow(max(0.0, dot(normalize(dp), sunDir)), 4.0);
          color += vec3(1.0, 0.85, 0.5) * smoothstep(0.3, 0.0, d) * dustLight * 0.1;
        }
      }
    }

    if (pulseIntensity > 0.01) color += vec3(0.45, 0.3, 0.1) * pulseIntensity * 0.5;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function ColosseumEnvironment({ flipTrigger = 0 }) {
  return <WonderSphere shader={COLOSSEUM_FRAG} flipTrigger={flipTrigger} />;
}

/* ═══════════════════════════════════════════════════════════════════
   7. TAJ MAHAL
   Dawn over the marble monument — onion dome and minarets reflected
   in a long pool, soft pink-gold sky, morning mist, marble glow.
   ═══════════════════════════════════════════════════════════════════ */

const TAJ_MAHAL_FRAG = `
  uniform float time;
  uniform float pulseIntensity;
  varying vec3 vPosition;
  ${NOISE_LIB}

  void main() {
    vec3 dir = normalize(vPosition);
    float t = time * 0.05;
    float angle = atan(dir.x, dir.z);
    float y = dir.y;
    float fa = mod(angle + 3.14159, 6.28318) - 3.14159;

    // Dawn sky — peach to deep blue
    vec3 skyTop = vec3(0.12, 0.18, 0.42);
    vec3 skyMid = vec3(0.55, 0.4, 0.5);
    vec3 skyPeach = vec3(0.9, 0.65, 0.45);
    vec3 skyGold = vec3(0.95, 0.8, 0.5);
    vec3 color = y > 0.4 ? mix(skyMid, skyTop, smoothstep(0.4, 0.95, y))
               : y > 0.1 ? mix(skyPeach, skyMid, smoothstep(0.1, 0.4, y))
                         : mix(skyGold, skyPeach, smoothstep(-0.05, 0.1, y));

    // Soft clouds
    float cloud = fbm(vec2(angle * 2.0 + t * 0.15, y * 4.0 + t * 0.04));
    cloud = smoothstep(0.42, 0.62, cloud) * smoothstep(0.85, 0.2, y) * smoothstep(0.05, 0.2, y);
    color = mix(color, mix(vec3(0.95, 0.7, 0.55), vec3(0.98, 0.9, 0.85), cloud), cloud * 0.4);

    // Sun glow at horizon
    vec3 sunDir = normalize(vec3(0.0, 0.08, 1.0));
    float sunDot = max(0.0, dot(dir, sunDir));
    color += vec3(1.0, 0.85, 0.5) * pow(sunDot, 60.0) * 1.2;
    color += vec3(0.8, 0.5, 0.25) * pow(sunDot, 5.0) * 0.2;

    // Taj Mahal silhouette — dome + minarets facing forward
    float taj = 0.0;
    vec3 tajColor = vec3(0.92, 0.9, 0.88); // White marble

    // Main dome (onion shape)
    float domeX = fa;
    float domeW = 0.18;
    if (abs(domeX) < domeW) {
      float dx = domeX / domeW;
      // Onion dome profile: wider at middle, narrow at top, with point
      float domeH = sqrt(max(0.0, 1.0 - dx * dx)) * 0.2;
      domeH *= 1.0 + 0.15 * (1.0 - abs(dx)); // Onion bulge
      float domeBot = 0.05;
      float domeTop = domeBot + domeH;
      if (y > domeBot && y < domeTop) {
        taj = 1.0;
      }
      // Finial (spire on top)
      if (abs(domeX) < 0.015 && y >= domeTop && y < domeTop + 0.06) {
        taj = 1.0;
      }
    }

    // Base platform
    if (abs(fa) < 0.3 && y > -0.05 && y < 0.06) {
      taj = 1.0;
    }

    // Four minarets
    float minaretPositions[4];
    minaretPositions[0] = -0.28;
    minaretPositions[1] = -0.22;
    minaretPositions[2] = 0.22;
    minaretPositions[3] = 0.28;
    for (int m = 0; m < 4; m++) {
      float mx = fa - minaretPositions[m];
      if (abs(mx) < 0.012 && y > -0.04 && y < 0.22) {
        taj = 1.0;
        // Small dome on top
        float mdx = mx / 0.018;
        float mDome = sqrt(max(0.0, 1.0 - mdx * mdx)) * 0.02;
        if (y > 0.22 && y < 0.22 + mDome) taj = 1.0;
      }
    }

    if (taj > 0.5) {
      // Marble texture — subtle veining
      float vein = fbm(vec2(fa * 40.0, y * 30.0));
      tajColor *= 0.92 + vein * 0.08;
      // Dawn light coloring the marble
      tajColor = mix(tajColor, vec3(1.0, 0.85, 0.7), 0.15);
      color = tajColor;
    }

    // Gardens / trees on the sides
    float gardenH = -0.04 + sin(angle * 8.0) * 0.015 + fbm(vec2(angle * 6.0, 0.0)) * 0.02;
    if (y < gardenH && y > -0.1 && (abs(fa) > 0.08 || abs(fa) < 0.02)) {
      vec3 garden = mix(vec3(0.1, 0.2, 0.05), vec3(0.15, 0.28, 0.08), fbm(vec2(angle * 12.0, y * 8.0)));
      // Cypress trees
      float tree = sin(angle * 20.0) * 0.5 + 0.5;
      tree = pow(tree, 8.0);
      float treeH = gardenH + tree * 0.06;
      if (y < treeH) garden = mix(garden, vec3(0.05, 0.12, 0.03), 0.5);
      color = mix(color, garden, smoothstep(gardenH, gardenH - 0.01, y) * step(-0.1, y));
    }

    // Reflecting pool — directly in front
    if (y < -0.06 && abs(fa) < 0.04) {
      // Mirror the Taj above
      float ry = -y - 0.06;
      float ripple = sin(fa * 100.0 + t * 3.0) * 0.003 + sin(y * 80.0 + t * 2.0) * 0.002;
      float reflFa = fa + ripple;

      // Simplified dome reflection
      float rdomeX = reflFa;
      float rdomeW = 0.18;
      float reflTaj = 0.0;
      if (abs(rdomeX) < rdomeW) {
        float rdx = rdomeX / rdomeW;
        float rdomeH = sqrt(max(0.0, 1.0 - rdx * rdx)) * 0.2 * (1.0 + 0.15 * (1.0 - abs(rdx)));
        if (ry > 0.0 && ry < rdomeH) reflTaj = 1.0;
      }

      vec3 poolColor = vec3(0.15, 0.2, 0.3);
      if (reflTaj > 0.5) {
        poolColor = tajColor * 0.6;
      }
      // Sky reflection
      poolColor = mix(poolColor, color * 0.4, 0.3);
      float poolBlend = smoothstep(-0.06, -0.1, y) * smoothstep(-0.4, -0.15, y);
      color = mix(color, poolColor, poolBlend);
    }

    // Ground / pathway beyond the pool
    if (y < -0.1 && abs(fa) > 0.04) {
      vec3 path = vec3(0.55, 0.48, 0.38);
      color = mix(color, path, smoothstep(-0.1, -0.2, y) * 0.5);
    }

    // Morning mist
    float mist = smoothstep(0.05, -0.08, y) * smoothstep(-0.3, -0.05, y);
    float mistNoise = fbm(vec2(angle * 3.0 + t * 0.3, y * 2.0));
    color = mix(color, vec3(0.85, 0.82, 0.78), mist * mistNoise * 0.35);

    if (pulseIntensity > 0.01) color += vec3(0.3, 0.25, 0.15) * pulseIntensity * 0.5;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function TajMahalEnvironment({ flipTrigger = 0 }) {
  return <WonderSphere shader={TAJ_MAHAL_FRAG} flipTrigger={flipTrigger} />;
}
