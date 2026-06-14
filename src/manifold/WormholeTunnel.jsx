import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FLIP_CAP, getHalfLifeMultiplier } from '../utils/constants.js';
import { flipBurstMap } from '../3d/styles/TileStyleMaterials.jsx';

// Lightning bolt / Core Tube point count
const LIGHTNING_PTS = 40;

// Cached vectors — no per-frame allocations
const _wPos1 = new THREE.Vector3();
const _wPos2 = new THREE.Vector3();
const _wQuat1 = new THREE.Quaternion();
const _wQuat2 = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _glowQ1 = new THREE.Quaternion();
const _glowQ2 = new THREE.Quaternion();
const _faceNorm1 = new THREE.Vector3();
const _faceNorm2 = new THREE.Vector3();
const _vStart = new THREE.Vector3();
const _vEnd = new THREE.Vector3();
const _cp1 = new THREE.Vector3();
const _cp2 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();
const _trueUp = new THREE.Vector3();
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _cTemp = new THREE.Color();
const _cTemp2 = new THREE.Color();
const _white = new THREE.Color(1, 1, 1);
const _streakPos = new THREE.Vector3();
const _lPt = new THREE.Vector3();
const _startPt = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _yAxis = new THREE.Vector3(0, 1, 0);

// Geometry rebuild FPS kept low — TubeGeometry alloc+dispose is expensive.
// Core rebuilt at 8 fps (was 18), lightning at 12 fps (was 24).
const CORE_GEOMETRY_FPS = 8;
const LIGHTNING_GEOMETRY_FPS = 12;
const CORE_REBUILD_POS_EPS_SQ = 1e-4;
const LIGHTNING_REBUILD_POS_EPS_SQ = 1e-4;
const LIGHTNING_RADIUS_EPS = 1e-4;

const FACE_NORM_LOCAL = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1]
};

const FACE_OFFSET = 0.52;

const DANGER_START = 9;
const DANGER_RANGE = FLIP_CAP - 1 - DANGER_START;
const STREAK_COUNT_LOW = 10;
const STREAK_COUNT_HIGH = 18;
const STREAK_COUNT_MAX = STREAK_COUNT_HIGH;

const tubeVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const tubeFragmentShader = `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uDanger;
  uniform float uTime;
  uniform float uPulse;
  uniform float uBurst;
  uniform float uDead;
  
  varying vec2 vUv;
  
  void main() {
    if (uDead > 0.5) {
      gl_FragColor = vec4(0.2, 0.2, 0.2, 0.15);
      return;
    }
    
    // Wait until it hits the VoidCore at the center (0.5), then switch colors
    vec3 baseColor = mix(uColor1, uColor2, smoothstep(0.48, 0.52, vUv.x));
    
    if (uDanger > 0.0) {
      // Saturate hue
      baseColor = mix(baseColor, baseColor * 1.5, uDanger * 0.5);
    }
    
    // Energy pulses traveling along the tube
    float scroll = fract(vUv.x * 3.0 - uTime * 2.0);
    float energy = smoothstep(0.4, 0.6, scroll) * smoothstep(0.8, 0.6, scroll);
    
    // Brighten the core
    vec3 finalColor = baseColor + (baseColor * energy * 0.8 * uPulse);
    finalColor += (vec3(1.0) * uBurst * 0.8);
    
    // Gap in middle (disappear inside VoidCore)
    float centerDist = abs(vUv.x - 0.5);
    float coreHide = smoothstep(0.08, 0.12, centerDist);
    
    // Edges are more transparent (vUv.y is the circumference)
    float edgeAlpha = sin(vUv.y * 3.14159);
    float alpha = clamp((0.4 + energy * 0.3) * uPulse + (uBurst * 0.5), 0.0, 1.0) * mix(0.5, 1.0, edgeAlpha) * coreHide;
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const strandVertexShader = `
  attribute vec3 instanceColor;
  varying vec3 vColor;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vColor = instanceColor;
    vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const strandFragmentShader = `
  varying vec3 vColor;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uBurst;
  uniform float uOpacity;
  void main() {
    // Soft glowing edges around the cylinder circumference
    float edge = sin(vUv.x * 3.14159);
    
    // Flowing energy pulses traveling from tile to core
    float scroll = fract(vUv.y * 3.0 - uTime * 3.0);
    float energy = smoothstep(0.3, 0.5, scroll) * smoothstep(0.7, 0.5, scroll);
    
    // Fade out smoothly at the start (tile face) and end (core merge)
    float fade = smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.98, vUv.y);
    
    vec3 finalColor = vColor * (1.0 + energy * 2.0 + uBurst);
    float alpha = edge * (0.3 + energy * 0.7) * fade * (0.8 + uBurst * 0.5) * uOpacity;
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;


const WormholeTunnel = ({ gridId1, gridId2, meshIdx1, meshIdx2, dirKey1, dirKey2, active1, active2, cubieRefs, intensity, flips, color1, color2, isCenter, maxStrands = 50, _explosionFactor = 0 }) => {
  const coreTubeRef = useRef();
  const atmosphereTubeRef = useRef();
  const atmosphereMatRef = useRef();
  const coreMatRef = useRef();
  // Pre-allocated 3-point curve for the center rail — straight path, no corkscrew
  const centerRailRef = useRef(null);
  const centerRailCurveRef = useRef(new THREE.CatmullRomCurve3([
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()
  ]));
  const pulseT = useRef(Math.random() * Math.PI * 2);
  const strandsRef = useRef();
  const strandMatRef = useRef();
  const streaksRef = useRef();
  const streakMaterialRef = useRef();
  const coreOutlineTubeRef = useRef();
  const coreOutlineMatRef = useRef();

  const activeStreakCount = maxStrands > 30 ? STREAK_COUNT_HIGH : STREAK_COUNT_LOW;
  const streakSeed = useMemo(() => {
    const seed = new Float32Array(STREAK_COUNT_MAX * 4);
    for (let i = 0; i < STREAK_COUNT_MAX; i++) {
      const i4 = i * 4;
      seed[i4] = Math.random();
      seed[i4 + 1] = (Math.random() - 0.5) * (isCenter ? 0.03 : 0.12);
      seed[i4 + 2] = (Math.random() - 0.5) * (isCenter ? 0.03 : 0.12);
      seed[i4 + 3] = 0.45 + Math.random() * 0.55;
    }
    return seed;
  }, [isCenter]);

  const streakPositions = useMemo(() => new Float32Array(STREAK_COUNT_MAX * 3), []);
  const streakColors = useMemo(() => new Float32Array(STREAK_COUNT_MAX * 3), []);

  const [tubeUniforms] = React.useState(() => ({
    uColor1: { value: new THREE.Color() },
    uColor2: { value: new THREE.Color() },
    uDanger: { value: 0 },
    uTime: { value: 0 },
    uPulse: { value: 0 },
    uBurst: { value: 0 },
    uDead: { value: 0 }
  }));

  const [strandUniforms] = React.useState(() => ({
    uTime: { value: 0 },
    uBurst: { value: 0 },
    uOpacity: { value: 1 }
  }));

  // Entrance portal rings — one per tunnel endpoint, shining outward from cube faces
  const glowDisc1Ref = useRef();
  const glowDisc2Ref = useRef();
  const glowMat1Ref = useRef();
  const glowMat2Ref = useRef();

  const curveRef = useRef(new THREE.CatmullRomCurve3(Array(LIGHTNING_PTS).fill(0).map(() => new THREE.Vector3())));

  const lightningRef = useRef(null);
  const lightningCurveRef = useRef(new THREE.CatmullRomCurve3(Array(LIGHTNING_PTS).fill(0).map(() => new THREE.Vector3())));
  const lightningJagsRef = useRef(new Float32Array(LIGHTNING_PTS * 2));
  const lightningFrameRef = useRef(-1);
  const lastCoreGeometryBuildRef = useRef(-Infinity);
  const lastLightningGeometryBuildRef = useRef(-Infinity);
  const lastCoreStartRef = useRef(new THREE.Vector3());
  const lastCoreEndRef = useRef(new THREE.Vector3());
  const lastLightningStartRef = useRef(new THREE.Vector3());
  const lastLightningEndRef = useRef(new THREE.Vector3());
  const lastLightningRadiusRef = useRef(-1);

  useEffect(() => {
    const ct = coreTubeRef.current;
    const lt = lightningRef.current;
    const at = atmosphereTubeRef.current;
    const cr = centerRailRef.current;
    const co = coreOutlineTubeRef.current;
    return () => {
      if (ct?.geometry) ct.geometry.dispose();
      if (lt?.geometry) lt.geometry.dispose();
      if (at?.geometry) at.geometry.dispose();
      if (cr?.geometry) cr.geometry.dispose();
      if (co?.geometry) co.geometry.dispose();
    };
  }, []);

  useFrame((state, delta) => {
    const mesh1 = cubieRefs[meshIdx1];
    const mesh2 = cubieRefs[meshIdx2];
    if (!mesh1 || !mesh2) return;

    mesh1.getWorldPosition(_wPos1);
    mesh1.getWorldQuaternion(_wQuat1);
    mesh2.getWorldPosition(_wPos2);
    mesh2.getWorldQuaternion(_wQuat2);

    const n1 = FACE_NORM_LOCAL[dirKey1];
    const n2 = FACE_NORM_LOCAL[dirKey2];
    _faceNorm1.set(n1[0], n1[1], n1[2]).applyQuaternion(_wQuat1);
    _faceNorm2.set(n2[0], n2[1], n2[2]).applyQuaternion(_wQuat2);

    _vStart.copy(_wPos1).addScaledVector(_faceNorm1, -FACE_OFFSET);
    _vEnd.copy(_wPos2).addScaledVector(_faceNorm2, -FACE_OFFSET);

    const t = state.clock.elapsedTime;
    const dead = flips >= FLIP_CAP;

    const halfLife = getHalfLifeMultiplier(flips);
    const breathRate = dead ? 0 : halfLife;


    pulseT.current += delta * (2 + intensity * 0.5) * Math.max(1, breathRate);
    const pulse = dead ? 0.3 : Math.sin(pulseT.current) * 0.1 + 0.9;

    const dangerT = flips >= DANGER_START && !dead ? Math.max(0, Math.min(1, (flips - DANGER_START) / DANGER_RANGE)) : 0;

    if (dead) {
      _c1.set('#555555');
      _c2.set('#444444');
    } else {
      _c1.set(color1);
      _c2.set(color2);
    }

    const burstRaw = Math.max(flipBurstMap.get(gridId1) ?? 0, flipBurstMap.get(gridId2) ?? 0);
    // Violent snap: overshoots and vibrates — feels like a rupture, not a breath
    const burstEnv = Math.sin(burstRaw * Math.PI) * (1.0 + Math.sin(burstRaw * Math.PI * 5) * 0.2);

    // Route directly through the VoidCore (0,0,0)
    // Antipodal pairs will form perfectly straight X-crossing beams through the center.
    _cp1.set(0, 0, 0);
    _cp2.set(0, 0, 0);


    _dir.subVectors(_vEnd, _vStart).normalize();
    _up.set(0, 1, 0);
    _right.crossVectors(_dir, _up);
    if (_right.lengthSq() < 0.001) {
      _up.set(0, 0, 1);
      _right.crossVectors(_dir, _up);
    }
    _right.normalize();
    _trueUp.crossVectors(_right, _dir).normalize();

    // Burst bows the tunnel violently outward — applied after right/trueUp are ready
    if (burstEnv > 0.01) {
      _cp1.addScaledVector(_right, burstEnv * 0.4).addScaledVector(_trueUp, burstEnv * 0.2);
    }

    // UPDATE VOLUMETRIC CORE
    if (coreTubeRef.current) {
      for (let i = 0; i < LIGHTNING_PTS; i++) {
        const u = i / (LIGHTNING_PTS - 1);

        // Base uniform line from start to cp1 to end
        if (u < 0.5) {
          _lPt.copy(_vStart).lerp(_cp1, u * 2.0);
        } else {
          _lPt.copy(_cp1).lerp(_vEnd, (u - 0.5) * 2.0);
        }

        // Envelope: 0 at ends, max at the core (0.5). Straight if it's a center face connection.
        const env = isCenter ? 0 : Math.pow(Math.sin(u * Math.PI), 3);

        // Corkscrew sine wave displacement
        const waveAng = u * Math.PI * 10.0 - t * 4.0;
        const r_wave = 0.25;
        const rx = Math.sin(waveAng) * r_wave * env;
        const ry = Math.cos(waveAng) * r_wave * env;

        curveRef.current.points[i].copy(_lPt)
          .addScaledVector(_right, rx)
          .addScaledVector(_trueUp, ry);
      }

      // Regenerate geometry explicitly instead of mutating array to ensure
      // normals/tangents of the fat tube recalculate correctly. TubeGeo is cheap
      // enough to do 24x per frame.
      const coreMoved =
        lastCoreStartRef.current.distanceToSquared(_vStart) > CORE_REBUILD_POS_EPS_SQ ||
        lastCoreEndRef.current.distanceToSquared(_vEnd) > CORE_REBUILD_POS_EPS_SQ;
      if (coreMoved || (t - lastCoreGeometryBuildRef.current >= 1 / CORE_GEOMETRY_FPS)) {
        const oldGeo = coreTubeRef.current.geometry;
        // 20 segments along tube, 5 radial segments
        coreTubeRef.current.geometry = new THREE.TubeGeometry(curveRef.current, 20, 0.02 * (1 + _explosionFactor * 2), 5, false);
        if (oldGeo) oldGeo.dispose();

        // Black outline shell slightly thicker than the core — borders the glow for tangibility
        if (coreOutlineTubeRef.current) {
          const oldOutlineGeo = coreOutlineTubeRef.current.geometry;
          coreOutlineTubeRef.current.geometry = new THREE.TubeGeometry(curveRef.current, 20, 0.035 * (1 + _explosionFactor * 2), 5, false);
          if (oldOutlineGeo) oldOutlineGeo.dispose();
        }

        // Atmosphere tube — wide BackSide tube visible only from inside the tunnel.
        // Radius 0.28 creates tunnel-wall feel when camera flies through on centerline.
        if (atmosphereTubeRef.current) {
          const oldAtmo = atmosphereTubeRef.current.geometry;
          atmosphereTubeRef.current.geometry = new THREE.TubeGeometry(curveRef.current, 20, 0.28 * (1 + _explosionFactor * 2), 12, false);
          if (oldAtmo) oldAtmo.dispose();
        }

        // Center rail — clean straight path (no corkscrew displacement).
        // This stripe cuts through the middle of the glowing core, like train tracks.
        if (centerRailRef.current) {
          centerRailCurveRef.current.points[0].copy(_vStart);
          // points[1] is always origin — never changes
          centerRailCurveRef.current.points[2].copy(_vEnd);
          const oldRail = centerRailRef.current.geometry;
          centerRailRef.current.geometry = new THREE.TubeGeometry(centerRailCurveRef.current, 14, 0.006, 5, false);
          if (oldRail) oldRail.dispose();
        }

        lastCoreGeometryBuildRef.current = t;
        lastCoreStartRef.current.copy(_vStart);
        lastCoreEndRef.current.copy(_vEnd);
      }

      if (coreMatRef.current) {
        coreMatRef.current.uniforms.uColor1.value.copy(_c1);
        coreMatRef.current.uniforms.uColor2.value.copy(_c2);
        coreMatRef.current.uniforms.uTime.value = t;
        coreMatRef.current.uniforms.uPulse.value = pulse;
        coreMatRef.current.uniforms.uBurst.value = Math.min(1, burstEnv + _explosionFactor * 0.5);
        coreMatRef.current.uniforms.uDanger.value = dangerT;
        coreMatRef.current.uniforms.uDead.value = dead ? 1 : 0;
      }

      if (coreOutlineMatRef.current) {
        coreOutlineMatRef.current.opacity = dead ? 0 : 0.72;
      }

      // Atmosphere tube: dark tinted walls that actually occlude the background.
      // Normal blending means 82% of the dark tunnel color shows, blocking background.
      // The additive core tube + streaks then glow on top for the wormhole energy feel.
      if (atmosphereMatRef.current) {
        // Vivid dark tint from entry-face color (was 0.12 = nearly invisible; 0.42 = clearly colored).
        // Base blue-shift (0.18) ensures dark-hued faces still feel like deep space.
        const ar = _c1.r * 0.42 + 0.02;
        const ag = _c1.g * 0.42 + 0.02;
        const ab = _c1.b * 0.42 + 0.18;
        atmosphereMatRef.current.color.setRGB(ar, ag, ab);
        atmosphereMatRef.current.opacity = dead ? 0 : 0.97 + burstEnv * 0.03;
      }
      if (strandMatRef.current) {
        strandMatRef.current.uniforms.uTime.value = t;
        strandMatRef.current.uniforms.uBurst.value = burstEnv;
        strandMatRef.current.uniforms.uOpacity.value = dead ? 0 : 0.45 + (burstEnv * 0.25);
      }
    }

    const streaks = streaksRef.current;
    if (streaks && streakMaterialRef.current) {
      const points = curveRef.current.points;
      const maxSeg = LIGHTNING_PTS - 1;
      const colorMix = _cTemp;
      for (let i = 0; i < STREAK_COUNT_MAX; i++) {
        const i3 = i * 3;
        const i4 = i * 4;

        if (i >= activeStreakCount || (!active1 && !active2)) {
          streakPositions[i3] = 0;
          streakPositions[i3 + 1] = 0;
          streakPositions[i3 + 2] = 0;
          streakColors[i3] = 0;
          streakColors[i3 + 1] = 0;
          streakColors[i3 + 2] = 0;
          continue;
        }

        const flow = (streakSeed[i4] + t * (0.22 + intensity * 0.28)) % 1;
        const centerDist = Math.abs(flow - 0.5);
        const maskedFlow = centerDist < 0.1 ? (flow < 0.5 ? 0.39 : 0.61) : flow;

        const fSeg = maskedFlow * maxSeg;
        const seg = Math.floor(fSeg);
        const segT = fSeg - seg;
        _streakPos.copy(points[seg]).lerp(points[Math.min(seg + 1, maxSeg)], segT);

        if (!isCenter) {
          const wobble = Math.sin((t * 5) + i * 1.17) * 0.65 + 0.35;
          _streakPos.addScaledVector(_right, streakSeed[i4 + 1] * wobble);
          _streakPos.addScaledVector(_trueUp, streakSeed[i4 + 2] * wobble);
        }

        streakPositions[i3] = _streakPos.x;
        streakPositions[i3 + 1] = _streakPos.y;
        streakPositions[i3 + 2] = _streakPos.z;

        colorMix.lerpColors(_c1, _c2, maskedFlow);
        const lum = (1.0 + burstEnv * 0.6) * streakSeed[i4 + 3];
        streakColors[i3] = colorMix.r * lum;
        streakColors[i3 + 1] = colorMix.g * lum;
        streakColors[i3 + 2] = colorMix.b * lum;
      }

      streaks.geometry.attributes.position.needsUpdate = true;
      streaks.geometry.attributes.color.needsUpdate = true;
      streakMaterialRef.current.opacity = dead ? 0.02 : (0.06 + intensity * 0.04 + burstEnv * 0.08);
      streakMaterialRef.current.size = dead ? 0.006 : (0.010 + intensity * 0.003);
      streaks.visible = active1 || active2;
    }



    // UPDATE FLIP BURST LIGHTNING TUBE
    const lightningLine = lightningRef.current;
    if (lightningLine) {
      if (burstEnv > 0.03 && !dead) {
        const jagFrame = Math.floor(t * 20);
        if (jagFrame !== lightningFrameRef.current) {
          lightningFrameRef.current = jagFrame;
          const jags = lightningJagsRef.current;
          jags[0] = 0; jags[1] = 0;
          jags[(LIGHTNING_PTS - 1) * 2] = 0; jags[(LIGHTNING_PTS - 1) * 2 + 1] = 0;
          for (let j = 1; j < LIGHTNING_PTS - 1; j++) {
            const env = Math.sin((j / (LIGHTNING_PTS - 1)) * Math.PI);
            const spread = 0.38 * burstEnv * env;
            jags[j * 2] = (Math.random() - 0.5) * spread * 2;
            jags[j * 2 + 1] = (Math.random() - 0.5) * spread * 2;
          }
        }

        // curveRef points are already updated above in UPDATE VOLUMETRIC CORE
        // We just reuse them for the lightning bolt base path.

        const jags = lightningJagsRef.current;
        const boltPoints = lightningCurveRef.current.points;

        for (let j = 0; j < LIGHTNING_PTS; j++) {
          const u = j / (LIGHTNING_PTS - 1);
          _lPt.copy(curveRef.current.points[j]);

          // Gap in middle for lightning bolt too
          const centerDist = Math.abs(u - 0.5);
          const coreHide = centerDist < 0.1 ? 0 : 1;

          const rx = jags[j * 2] * coreHide;
          const ry = jags[j * 2 + 1] * coreHide;

          // Pinch the width of the bolt down to 0 in the core so it doesnt show
          if (coreHide === 0) {
            boltPoints[j].set(_lPt.x, _lPt.y, _lPt.z);
          } else {
            boltPoints[j].set(
              _lPt.x + _right.x * rx + _trueUp.x * ry,
              _lPt.y + _right.y * rx + _trueUp.y * ry,
              _lPt.z + _right.z * rx + _trueUp.z * ry
            );
          }
        }

        // Fat tube for the lightning bolt too! (Diameter halved per user request)
        const lightningRadius = 0.0075 + burstEnv * 0.0075;
        const lightningMoved =
          lastLightningStartRef.current.distanceToSquared(_vStart) > LIGHTNING_REBUILD_POS_EPS_SQ ||
          lastLightningEndRef.current.distanceToSquared(_vEnd) > LIGHTNING_REBUILD_POS_EPS_SQ ||
          Math.abs(lightningRadius - lastLightningRadiusRef.current) > LIGHTNING_RADIUS_EPS;
        if (lightningMoved || (t - lastLightningGeometryBuildRef.current >= 1 / LIGHTNING_GEOMETRY_FPS)) {
          const oldGeo = lightningLine.geometry;
          lightningLine.geometry = new THREE.TubeGeometry(lightningCurveRef.current, LIGHTNING_PTS * 2, lightningRadius, 4, false);
          if (oldGeo) oldGeo.dispose();
          lastLightningGeometryBuildRef.current = t;
          lastLightningStartRef.current.copy(_vStart);
          lastLightningEndRef.current.copy(_vEnd);
          lastLightningRadiusRef.current = lightningRadius;
        }

        lightningLine.material.opacity = Math.min(0.97, burstEnv * 1.4);

        // Color it purely using the antipodal colors
        lightningLine.material.color.lerpColors(_c1, _c2, 0.5).lerp(_white, _explosionFactor * 0.7);

        lightningLine.visible = true;
      } else {
        lightningLine.visible = false;
      }
    }

    // UPDATE ENTRANCE PORTAL RINGS — torus shockwave expanding outward from each tunnel mouth
    const disc1 = glowDisc1Ref.current;
    if (disc1) {
      disc1.position.copy(_wPos1).addScaledVector(_faceNorm1, 0.05);
      _glowQ1.setFromUnitVectors(_zAxis, _faceNorm1);
      disc1.quaternion.copy(_glowQ1);
      // Torus expands outward on burst, fades as it disperses
      disc1.scale.setScalar((0.5 + intensity * 0.25) * pulse + burstEnv * 1.5);
      disc1.visible = !dead && active1;
      if (glowMat1Ref.current) {
        glowMat1Ref.current.color.copy(_c1);
        glowMat1Ref.current.opacity = dead ? 0 : Math.max(0, (0.5 + burstEnv * 0.5) * (1 - burstEnv * 0.5));
      }
    }
    const disc2 = glowDisc2Ref.current;
    if (disc2) {
      disc2.position.copy(_wPos2).addScaledVector(_faceNorm2, 0.05);
      _glowQ2.setFromUnitVectors(_zAxis, _faceNorm2);
      disc2.quaternion.copy(_glowQ2);
      disc2.scale.setScalar((0.5 + intensity * 0.25) * pulse + burstEnv * 1.5);
      disc2.visible = !dead && active2;
      if (glowMat2Ref.current) {
        glowMat2Ref.current.color.copy(_c2);
        glowMat2Ref.current.opacity = dead ? 0 : Math.max(0, (0.5 + burstEnv * 0.5) * (1 - burstEnv * 0.5));
      }
    }

    // UPDATE STRANDS (Feeding into the main tunnel from the 8 spiral arms + center)
    const strands = strandsRef.current;
    if (strands) {
      const r_tip = 0.42; // Radius to the tips of the spiral arms
      const color1Obj = _cTemp;
      const color2Obj = _cTemp2;
      color1Obj.copy(_c1);
      color2Obj.copy(_c2);

      for (let side = 0; side < 2; side++) {
        const isM1 = side === 0;
        const isActive = isM1 ? active1 : active2;
        const vStart = isM1 ? _vStart : _vEnd;
        const norm = isM1 ? _faceNorm1 : _faceNorm2;
        const baseColor = isM1 ? color1Obj : color2Obj;

        if (!isActive) {
          // Collapse strands if this side is dormant
          for (let i = 0; i < 9; i++) {
            _dummy.scale.set(0, 0, 0);
            _dummy.updateMatrix();
            strands.setMatrixAt(side * 9 + i, _dummy.matrix);
          }
          continue;
        }

        // Calculate tangent vectors for the face
        _up.set(0, 1, 0);
        _right.crossVectors(norm, _up);
        if (_right.lengthSq() < 0.001) {
          _up.set(0, 0, 1);
          _right.crossVectors(norm, _up);
        }
        _right.normalize();
        _trueUp.crossVectors(_right, norm).normalize();

        // The point where the strands converge into the main tube
        // Interpolate slightly inwards towards the core (cp1 is 0,0,0)
        _lPt.copy(_cp1);

        for (let i = 0; i < 9; i++) {
          const idx = side * 9 + i;

          const startPt = _startPt.copy(vStart);
          if (i > 0) {
            // i=1..8 are the 8 arms. The spider fragment uses uTime * 5.0.
            // We rotate the 8 points around the face to match.
            const angle = (Math.PI * 2 * (i - 1) / 8) + (t * 5.0) / 8.0;
            const x = Math.cos(angle) * r_tip;
            const y = Math.sin(angle) * r_tip;
            startPt.addScaledVector(_right, x).addScaledVector(_trueUp, y);
          }

          // Position the cylinder between startPt and _lPt
          const dist = startPt.distanceTo(_lPt);
          _cp2.copy(startPt).lerp(_lPt, 0.5); // mid point

          // Orientation
          _dir.subVectors(_lPt, startPt).normalize();
          _wQuat1.setFromUnitVectors(_yAxis, _dir);

          _dummy.position.copy(_cp2);
          _dummy.quaternion.copy(_wQuat1);
          _dummy.scale.set(1, dist, 1);
          _dummy.updateMatrix();

          strands.setMatrixAt(idx, _dummy.matrix);

          // Add a pulse/burst effect to the strands' brightness
          _cTemp.copy(baseColor).multiplyScalar(1.0 + burstEnv * 2.0);
          strands.setColorAt(idx, _cTemp);
        }
      }
      strands.instanceMatrix.needsUpdate = true;
      if (strands.instanceColor) strands.instanceColor.needsUpdate = true;
      // Visibility is managed by scaling to 0, but hide completely if dead
      strands.visible = !dead;
    }

  });

  return (
    <group>
      {/* 18 connecting strands (9 per side) feeding into the main tunnel */}
      <instancedMesh ref={strandsRef} args={[null, null, 18]} visible={false}>
        <cylinderGeometry args={[0.003, 0.003, 1, 3]} />
        <shaderMaterial
          ref={strandMatRef}
          vertexShader={strandVertexShader}
          fragmentShader={strandFragmentShader}
          uniforms={strandUniforms}
          transparent
          depthWrite={false}
        />
      </instancedMesh>

      {/* Atmosphere tube — wide BackSide occluder, visible only from inside the tunnel.
          Uses normal blending so the dark walls block the background (additive can't).
          The core tube + streaks glow on top via additive blending for energy feel. */}
      <mesh ref={atmosphereTubeRef} renderOrder={1}>
        <tubeGeometry args={[new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 0, 0.1)), 2, 0.28, 12, false]} />
        <meshBasicMaterial
          ref={atmosphereMatRef}
          color="#01010f"
          transparent
          opacity={0.97}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Black outline shell around core — borders the glow so the tunnel feels solid */}
      <mesh ref={coreOutlineTubeRef} renderOrder={-1}>
        <tubeGeometry args={[new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 0, 0.1)), 2, 0.035, 5, false]} />
        <meshBasicMaterial
          ref={coreOutlineMatRef}
          color="#000000"
          transparent
          opacity={0.72}
          depthWrite={false}
        />
      </mesh>

      {/* Thick volumetric brain stem (core axis) */}
      <mesh ref={coreTubeRef}>
        <tubeGeometry args={[new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 0, 0.1)), 2, 0.02, 5, false]} />
        <shaderMaterial
          ref={coreMatRef}
          vertexShader={tubeVertexShader}
          fragmentShader={tubeFragmentShader}
          uniforms={tubeUniforms}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Center rail — thin dark stripe on the straight tunnel centerline (no corkscrew).
          renderOrder=4 draws on top of the additive glow, cutting a track-like dark line
          through the middle of the glowing core — train-track / road-center effect. */}
      <mesh ref={centerRailRef} renderOrder={4}>
        <tubeGeometry args={[new THREE.LineCurve3(new THREE.Vector3(-0.01, 0, 0), new THREE.Vector3(0.01, 0, 0)), 2, 0.006, 5, false]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.88}
          depthWrite={false}
        />
      </mesh>

      {/* Warp streak particles: gives all tunnels the same high-speed wormhole feel. */}
      <points ref={streaksRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={STREAK_COUNT_MAX} array={streakPositions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={STREAK_COUNT_MAX} array={streakColors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          ref={streakMaterialRef}
          size={0.026}
          transparent
          opacity={0.55}
          depthWrite={false}
          depthTest
          vertexColors
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>



      {/* Fat Lightning bolt flash */}
      <mesh ref={lightningRef} visible={false}>
        <tubeGeometry args={[new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 0, 0.1)), 2, 0.03, 4, false]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Entrance portal rings — torus shockwaves expanding outward from each tunnel mouth */}
      <mesh ref={glowDisc1Ref} renderOrder={5} visible={false}>
        <torusGeometry args={[0.3, 0.05, 8, 24]} />
        <meshBasicMaterial
          ref={glowMat1Ref}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={glowDisc2Ref} renderOrder={5} visible={false}>
        <torusGeometry args={[0.3, 0.05, 8, 24]} />
        <meshBasicMaterial
          ref={glowMat2Ref}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

export default WormholeTunnel;
