import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TUNNEL_ANCHOR_OFFSET } from '../utils/constants.js';

/**
 * TunnelSnap — the death of an antipodal pair, made visible.
 *
 * When a pair reaches FLIP_CAP it is severed: WormholeNetwork stops emitting it
 * and the cord simply stopped existing between one frame and the next. That is
 * the single most consequential thing that can happen to a pair — the tile is
 * dead, the parity multiplier is gone — and it had no feedback at all.
 *
 * Now the cord breaks. Both halves recoil from the midpoint back toward their
 * own tiles, flash white-hot at the break, then desaturate to the same grey the
 * dead-tile ribbon used, and fade. A shard burst marks the break point.
 *
 * Entries carry their own endpoint anchors (see the tunnelDeaths store comment)
 * because the pair is already absent from the network by the time this renders.
 */

const SEGS      = 10;             // must be even — matches the cord's mid gap
const VERTS     = (SEGS + 1) * 2;
const IDX_COUNT = (SEGS - 1) * 6;

// Match MobiusTunnel / RestingCords so the snap starts exactly where the cord was.
const MINI_FACE_R = 0.25;
const SNAP_WIDTH  = 0.34;

// Deliberately much fatter than the cord's taper. A tunnel's ends are anchored on
// their tiles, so the first stretch out of each end runs through the opaque cubie
// body and is occluded — the only span reliably on screen is the middle, which is
// exactly what a tight taper shrinks to sub-pixel width. A dying cord has to stay
// legible where it can actually be seen.
const TAPER_MIN   = 0.55;

const SHARDS = 14;

const FACE_NORM_LOCAL = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1],
};

const _wPos      = new THREE.Vector3();
const _wQuat     = new THREE.Quaternion();
const _faceNorm1 = new THREE.Vector3();
const _faceNorm2 = new THREE.Vector3();
const _vStart    = new THREE.Vector3();
const _vEnd      = new THREE.Vector3();
const _midA      = new THREE.Vector3();
const _midB      = new THREE.Vector3();
const _break     = new THREE.Vector3();
const _colA      = new THREE.Color();
const _colB      = new THREE.Color();
const _grey      = new THREE.Color('#4a4a4a');

const vertexShader = `
  attribute float aSide;
  attribute float aT;
  attribute vec3  aTangent;
  attribute float aWidth;
  varying   float vT;
  varying   float vSide;
  void main() {
    vT = aT; vSide = aSide;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3  tView = normalize(mat3(modelViewMatrix) * aTangent);
    vec3  c     = cross(tView, vec3(0.0, 0.0, 1.0));
    float cl    = length(c);
    vec3  perp  = cl > 1e-4 ? c / cl : vec3(1.0, 0.0, 0.0);
    mv.xyz += perp * (aSide * aWidth * 0.5);
    gl_Position = projectionMatrix * mv;
  }
`;

// uProgress 0→1 over the death animation.
const fragmentShader = `
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uProgress;
  varying float vT;
  varying float vSide;

  void main() {
    // The broken ends retreat from the midpoint outward, so the gap in the
    // middle widens as the halves recoil. Kept modest on purpose: a gap that
    // grows past ~0.25 erases the whole visible span of the cord before the
    // fade ever gets a chance to read as a break.
    float d = abs(vT - 0.5);
    float gap = 0.04 + uProgress * 0.20;
    if (d < gap) discard;

    vec3 base = vT < 0.5 ? uColorA : uColorB;

    // The break end flashes white-hot, then the whole cord ashes over to grey.
    // Both the ash and the fade start late on purpose: grey-on-black at this
    // width is nearly invisible, so an early ramp spends most of the animation
    // showing nothing. The break should stay hot for most of its short life.
    float nearBreak = 1.0 - smoothstep(0.0, 0.16, d - gap);
    vec3  hot       = mix(base, vec3(1.0), nearBreak * (1.0 - uProgress));
    vec3  col       = mix(hot, vec3(0.29, 0.29, 0.29), smoothstep(0.45, 0.95, uProgress));

    float u        = vSide * 0.5 + 0.5;
    float edgeFade = smoothstep(0.0, 0.4, u) * smoothstep(1.0, 0.6, u);
    float alpha    = (1.0 - smoothstep(0.70, 1.0, uProgress)) * edgeFade * 0.9;

    gl_FragColor = vec4(col * (1.0 + nearBreak * 1.6), alpha);
  }
`;

function buildGeometry() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(VERTS * 3), 3));
  geo.setAttribute('aTangent', new THREE.BufferAttribute(new Float32Array(VERTS * 3), 3));
  geo.setAttribute('aSide',    new THREE.BufferAttribute(new Float32Array(VERTS),     1));
  geo.setAttribute('aT',       new THREE.BufferAttribute(new Float32Array(VERTS),     1));
  geo.setAttribute('aWidth',   new THREE.BufferAttribute(new Float32Array(VERTS),     1));

  const idx = new Uint16Array(IDX_COUNT);
  let w = 0;
  for (let i = 0; i < SEGS; i++) {
    if (i === SEGS / 2) continue;
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx[w++] = a; idx[w++] = b; idx[w++] = c;
    idx[w++] = b; idx[w++] = d; idx[w++] = c;
  }
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

/** One dying pair. */
const SnapCord = ({ death, cubieRefs }) => {
  const groupRef  = useRef();
  const shardsRef = useRef();
  const doneRef   = useRef(false);

  const geo = useMemo(() => buildGeometry(), []);
  const uniforms = useMemo(() => ({
    uColorA:   { value: new THREE.Color(death.color1 || '#ffffff') },
    uColorB:   { value: new THREE.Color(death.color2 || '#ffffff') },
    uProgress: { value: 0 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Shard directions are fixed at spawn — the burst should not re-roll per frame.
  const shardSeeds = useMemo(() => {
    const s = [];
    for (let i = 0; i < SHARDS; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = (Math.random() - 0.5) * Math.PI;
      s.push({
        dir: new THREE.Vector3(
          Math.cos(theta) * Math.cos(phi),
          Math.sin(phi),
          Math.sin(theta) * Math.cos(phi)
        ),
        speed: 0.7 + Math.random() * 1.1,
      });
    }
    return s;
  }, []);

  const shardGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SHARDS * 3), 3));
    return g;
  }, []);

  useEffect(() => () => { geo.dispose(); shardGeo.dispose(); }, [geo, shardGeo]);

  useFrame(() => {
    const mesh1 = cubieRefs[death.meshIdx1];
    const mesh2 = cubieRefs[death.meshIdx2];
    if (!mesh1 || !mesh2) return;

    const p = Math.min(1, Math.max(0, (performance.now() - death.startMs) / death.durationMs));
    uniforms.uProgress.value = p;
    if (p >= 1) {
      if (groupRef.current) groupRef.current.visible = false;
      doneRef.current = true;
      return;
    }
    if (groupRef.current) groupRef.current.visible = true;
    if (doneRef.current) return;

    mesh1.getWorldPosition(_wPos);
    mesh1.getWorldQuaternion(_wQuat);
    const n1 = FACE_NORM_LOCAL[death.dirKey1];
    _faceNorm1.set(n1[0], n1[1], n1[2]).applyQuaternion(_wQuat);
    _vStart.copy(_wPos).addScaledVector(_faceNorm1, TUNNEL_ANCHOR_OFFSET);

    mesh2.getWorldPosition(_wPos);
    mesh2.getWorldQuaternion(_wQuat);
    const n2 = FACE_NORM_LOCAL[death.dirKey2];
    _faceNorm2.set(n2[0], n2[1], n2[2]).applyQuaternion(_wQuat);
    _vEnd.copy(_wPos).addScaledVector(_faceNorm2, TUNNEL_ANCHOR_OFFSET);

    _midA.set(n1[0], n1[1], n1[2]).multiplyScalar(MINI_FACE_R);
    _midB.set(n2[0], n2[1], n2[2]).multiplyScalar(MINI_FACE_R);

    // ── Cord halves ──────────────────────────────────────────────────────────
    const pos  = geo.attributes.position.array;
    const tan  = geo.attributes.aTangent.array;
    const side = geo.attributes.aSide.array;
    const tt   = geo.attributes.aT.array;
    const wid  = geo.attributes.aWidth.array;
    const half = SEGS / 2;

    const tAx = _midA.x - _vStart.x, tAy = _midA.y - _vStart.y, tAz = _midA.z - _vStart.z;
    const tAL = Math.sqrt(tAx * tAx + tAy * tAy + tAz * tAz) || 1;
    const tBx = _vEnd.x - _midB.x, tBy = _vEnd.y - _midB.y, tBz = _vEnd.z - _midB.z;
    const tBL = Math.sqrt(tBx * tBx + tBy * tBy + tBz * tBz) || 1;

    for (let i = 0; i <= SEGS; i++) {
      const t     = i / SEGS;
      const taper = TAPER_MIN + (1.0 - TAPER_MIN) * Math.abs(2.0 * t - 1.0);
      let cx, cy, cz, nx, ny, nz;
      if (i <= half) {
        const s = i / half;
        cx = _vStart.x + (_midA.x - _vStart.x) * s;
        cy = _vStart.y + (_midA.y - _vStart.y) * s;
        cz = _vStart.z + (_midA.z - _vStart.z) * s;
        nx = tAx / tAL; ny = tAy / tAL; nz = tAz / tAL;
      } else {
        const s = (i - half) / half;
        cx = _midB.x + (_vEnd.x - _midB.x) * s;
        cy = _midB.y + (_vEnd.y - _midB.y) * s;
        cz = _midB.z + (_vEnd.z - _midB.z) * s;
        nx = tBx / tBL; ny = tBy / tBL; nz = tBz / tBL;
      }
      for (let sg = 0; sg < 2; sg++) {
        const vi = i * 2 + sg, p3 = vi * 3;
        pos[p3] = cx; pos[p3 + 1] = cy; pos[p3 + 2] = cz;
        tan[p3] = nx; tan[p3 + 1] = ny; tan[p3 + 2] = nz;
        side[vi] = sg === 0 ? -1 : 1;
        tt[vi]   = t;
        wid[vi]  = SNAP_WIDTH * taper;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aTangent.needsUpdate = true;
    geo.attributes.aSide.needsUpdate    = true;
    geo.attributes.aT.needsUpdate       = true;
    geo.attributes.aWidth.needsUpdate   = true;

    // ── Shard burst at the break point ───────────────────────────────────────
    _break.copy(_midA).add(_midB).multiplyScalar(0.5);
    const sp = shardGeo.attributes.position.array;
    // Ease-out so shards fly fast then coast, and fade with the cord.
    const spread = (1 - Math.pow(1 - p, 2.2)) * 0.9;
    for (let i = 0; i < SHARDS; i++) {
      const s = shardSeeds[i];
      sp[i * 3]     = _break.x + s.dir.x * s.speed * spread;
      sp[i * 3 + 1] = _break.y + s.dir.y * s.speed * spread - p * p * 0.25; // slight droop
      sp[i * 3 + 2] = _break.z + s.dir.z * s.speed * spread;
    }
    shardGeo.attributes.position.needsUpdate = true;

    if (shardsRef.current) {
      _colA.set(death.color1 || '#ffffff');
      _colB.set(death.color2 || '#ffffff');
      _colA.lerp(_colB, 0.5).lerp(_grey, Math.min(1, p * 1.4));
      shardsRef.current.material.color.copy(_colA);
      shardsRef.current.material.opacity = (1 - p) * 0.95;
      shardsRef.current.material.size = 0.17 * (1 - p * 0.55);
    }
  });

  return (
    // depthTest is off here, unlike the living tunnels. A tunnel routes through the
    // cube's interior, which is exactly the volume the cubie bodies hide — so
    // depending on the pair's axis and the camera angle a depth-tested snap is
    // simply never seen (verified: the same animation is invisible face-on and
    // obvious with depthTest disabled). Losing a pair is the most consequential
    // thing that can happen to it, and this marker lasts under a second and fades,
    // so it is drawn as event feedback rather than as world geometry.
    <group ref={groupRef} renderOrder={9000}>
      {/* World-space positions in a mesh at the origin — see MobiusTunnel. */}
      <mesh geometry={geo} frustumCulled={false} renderOrder={9000}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      <points ref={shardsRef} geometry={shardGeo} frustumCulled={false} renderOrder={9001}>
        <pointsMaterial
          size={0.17}
          transparent
          opacity={0.95}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
};

const TunnelSnap = ({ deaths, cubieRefs }) => {
  const entries = useMemo(() => Object.entries(deaths || {}), [deaths]);
  if (!entries.length) return null;
  return (
    <group>
      {entries.map(([pairId, death]) => (
        <SnapCord key={pairId} death={death} cubieRefs={cubieRefs} />
      ))}
    </group>
  );
};

export default TunnelSnap;
