import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, Object3D, Vector3 } from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { DIR_FORWARD, WORM_LIFT } from './constants.js';
import { bodyDistanceAt } from './sliceBodyPath.js';
import {
  ARRIVAL_PORTAL_RADIUS as R,
  arrivalBeadInto, arrivalOffset, arrivalPathPointInto, storyArrivalPose,
} from './storyArrival.js';

const Z = new Vector3(0, 0, 1);
const SPARKS = 32;
const APERTURE_REACH = 1.7; // the disc reaches past the rim for the outer glow
const BEAM_HEIGHT = 1.15;

const vertexShader = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;

// A vortex well inside a live rim. Measured in portal radii, so the iris can
// open from a pinpoint and collapse back into one.
const apertureShader = `
  varying vec2 vUv; uniform float uTime, uOpen, uPower, uFlash;
  void main(){
    vec2 p=(vUv-.5)*${(APERTURE_REACH * 2).toFixed(2)};
    float r=length(p), a=atan(p.y,p.x);
    float iris=max(uOpen,.001), q=r/iris;
    float depth=1.-smoothstep(0.,1.,q);
    float arms=pow(.5+.5*sin(a*3.-log(q+.03)*6.5+uTime*3.4),3.);
    float glints=step(.965,.5+.5*sin(a*11.+log(q+.03)*15.+uTime*6.));
    vec3 col=mix(vec3(.2,.07,.6),vec3(.008,.004,.05),depth);
    col+=vec3(.22,.92,1.)*arms*(1.-depth*.8)*.75+vec3(.85,1.,1.)*glints*(1.-depth)*.9;
    float inside=1.-smoothstep(.95,1.,q);
    float rim=exp(-pow((r-iris)/.055,2.))*(.82+.18*sin(a*9.+uTime*7.));
    float glow=exp(-max(r-iris,0.)*4.5)*(1.-inside)*smoothstep(0.,.2,uOpen);
    float flash=uFlash*exp(-r*2.6);
    vec3 color=col*inside+vec3(.7,1.,.92)*rim*2.2+vec3(.25,.95,1.)*glow+vec3(1.)*flash*2.;
    float alpha=clamp(inside*.95+rim+glow*.55+flash,0.,1.)*uPower;
    gl_FragColor=vec4(color,alpha);
  }`;

// Light pouring up out of the mouth, streaked and climbing.
const beamShader = `
  varying vec2 vUv; uniform float uTime, uPower;
  void main(){
    float h=vUv.y;
    float streak=pow(.5+.5*sin(vUv.x*43.98+h*5.-uTime*2.4),3.);
    float climb=.65+.35*sin(h*18.-uTime*7.);
    float a=(1.-h)*(1.-h)*(.3+.7*streak)*climb*uPower;
    gl_FragColor=vec4(mix(vec3(.25,.9,1.),vec3(.85,1.,.95),streak*.5),a);
  }`;

const clamp01 = t => Math.max(0, Math.min(1, t));
const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };

// Render-only: the sim's body and history never change. This publishes where
// the arriving head is (`worm.arrival`) for WormBody, WormFace and the camera,
// and draws the portal it climbs out of.
export function StoryArrival({ worm, elapsed, children }) {
  const body = useRef(), portal = useRef(), aperture = useRef(), beam = useRef(), arcs = useRef([]),
    sparks = useRef(), shock = useRef(), ripple = useRef();
  const scratch = useMemo(() => ({
    dummy: new Object3D(), bead: { grow: 1, lift: 0 }, ahead: new Vector3(), behind: new Vector3(), n: new Vector3(),
    rest: new Vector3(), side: new Vector3(), breachAt: null,
    aperture: { uTime: { value: 0 }, uOpen: { value: 0 }, uPower: { value: 0 }, uFlash: { value: 0 } },
    beam: { uTime: { value: 0 }, uPower: { value: 0 } },
  }), []);
  const arrival = useMemo(() => ({
    active: false, offset: 0, mouth: 0, headGrow: 1,
    headPos: new Vector3(), headNormal: new Vector3(), headForward: new Vector3(),
    portalPos: new Vector3(), portalNormal: new Vector3(), focus: new Vector3(),
  }), []);
  useEffect(() => {
    worm.arrival = arrival;
    return () => { if (worm.arrival === arrival) worm.arrival = null; };
  }, [worm, arrival]);

  useFrame(() => {
    if (!body.current || !portal.current) return;
    const state = useGameStore.getState();
    const arriving = state.wormGamePhase === 'spawning';
    const hidden = state.wormGamePhase === 'scrambling' || (!!state.wormStoryLevel && !state.wormStoryStarted);
    const reduced = state.settings?.reducedMotion || prefersReducedMotion();
    body.current.visible = !hidden;
    arrival.active = arriving && !hidden && !reduced;
    if (!arrival.active) {
      scratch.breachAt = null;
      // While the board is hidden behind the scramble or the briefing, draw the
      // portal at a speck so its programs link then, not as it opens.
      portal.current.visible = hidden;
      portal.current.scale.setScalar(1e-4);
      return;
    }

    const now = elapsed.current;
    const pose = storyArrivalPose(now);
    const mouth = bodyDistanceAt(worm, Math.max(0, worm.tailLength.current - 1));
    const offset = arrivalOffset(pose.emerge, mouth);
    arrival.mouth = mouth;
    arrival.offset = offset;

    // The portal sits under the resting tail: the body pours out of it and
    // crawls up its own path, so the last bead out lands exactly at rest.
    arrivalPathPointInto(worm, mouth, arrival.portalPos, arrival.portalNormal);
    arrivalPathPointInto(worm, offset, arrival.headPos, arrival.headNormal);
    const bead = arrivalBeadInto(scratch.bead, offset, mouth, offset);
    arrival.headGrow = Math.max(1e-3, bead.grow);
    arrival.headPos.addScaledVector(arrival.headNormal, WORM_LIFT + bead.lift);

    // Face along the path, easing onto the steering heading as it comes to rest.
    arrivalPathPointInto(worm, Math.max(0, offset - 0.08), scratch.ahead, scratch.n);
    arrivalPathPointInto(worm, offset + 0.08, scratch.behind, scratch.n);
    const forward = arrival.headForward.subVectors(scratch.ahead, scratch.behind);
    const normal = arrival.headNormal;
    forward.addScaledVector(normal, -forward.dot(normal));
    const restArr = DIR_FORWARD[worm.pos.current.dirKey]?.[worm.moveDir.current] ?? [0, 1, 0];
    scratch.rest.set(restArr[0], restArr[1], restArr[2]);
    if (forward.lengthSq() < 1e-10) forward.copy(scratch.rest);
    forward.normalize().lerp(scratch.rest, 1 - smooth(offset / 0.25)).normalize();
    // Pitch head and face together with the leap: nose up out of the mouth,
    // nose down onto the tile.
    const eps = 0.02;
    const up = arrivalBeadInto(scratch.bead, offset - eps, mouth, offset).lift;
    const down = arrivalBeadInto(scratch.bead, offset + eps, mouth, offset).lift;
    const pitch = Math.atan((up - down) / (2 * eps)) * 0.8;
    if (Math.abs(pitch) > 1e-4) {
      scratch.side.crossVectors(forward, normal).normalize();
      forward.applyAxisAngle(scratch.side, pitch);
      normal.applyAxisAngle(scratch.side, pitch);
    }

    // The camera keeps the mouth and the start tile in frame, sliding onto the
    // head as the body comes out.
    arrivalPathPointInto(worm, 0, arrival.focus, scratch.n);
    arrival.focus.lerp(arrival.portalPos, 0.5 * (1 - pose.emerge));

    // ── Portal ──
    const g = portal.current;
    g.visible = true;
    g.scale.setScalar(1);
    g.position.copy(arrival.portalPos).addScaledVector(arrival.portalNormal, 0.012);
    g.quaternion.setFromUnitVectors(Z, arrival.portalNormal);

    const headU = mouth - offset; // how far the head has come out of the mouth
    if (scratch.breachAt === null && headU >= -0.02 && pose.emerge > 0) scratch.breachAt = now;
    const sinceBreach = scratch.breachAt === null ? -1 : now - scratch.breachAt;
    const breach = sinceBreach < 0 ? 0 : Math.exp(-sinceBreach * 4.5);
    const iris = pose.open * (1 - pose.close) * (1 + 0.12 * breach);

    scratch.aperture.uTime.value = now;
    scratch.aperture.uOpen.value = iris;
    scratch.aperture.uPower.value = smooth(pose.open * 3) * (1 - smooth((pose.close - 0.85) / 0.15));
    scratch.aperture.uFlash.value = Math.max(breach * 0.6, pose.shock * 0.9);

    scratch.beam.uTime.value = now;
    scratch.beam.uPower.value = pose.ring * (0.4 + 0.9 * breach) * (1 - smooth((pose.emerge - 0.35) / 0.45));
    beam.current.visible = scratch.beam.uPower.value > 0.002;
    beam.current.scale.set(iris, iris, 1 + 0.5 * breach);

    for (let i = 0; i < arcs.current.length; i++) {
      const arc = arcs.current[i];
      arc.rotation.z = now * (i ? -2.1 : 1.4) + i * 2.2;
      arc.scale.setScalar(R * iris * (1.06 + i * 0.12));
      arc.material.opacity = pose.ring * (0.75 - i * 0.2);
      arc.visible = pose.ring > 0.002;
    }

    // Breach ripple out across the tile, then the shock as the portal shuts.
    const rippleK = sinceBreach < 0 ? 1 : clamp01(sinceBreach / 0.7);
    ripple.current.visible = rippleK < 1;
    ripple.current.scale.setScalar(R * (1 + 1.6 * rippleK));
    ripple.current.material.opacity = (1 - rippleK) * 0.7;
    const shockK = clamp01((pose.t - 0.8) / 0.2);
    shock.current.visible = pose.shock > 0.002;
    shock.current.scale.setScalar(R * (0.4 + 3.2 * shockK));
    shock.current.material.opacity = pose.shock * 0.85;

    // Sparks swirl down into the opening mouth, then erupt with the head.
    const d = scratch.dummy;
    for (let i = 0; i < SPARKS; i++) {
      const seed = i * 2.39996;
      if (sinceBreach < 0) {
        const f = (now * 0.7 + i * 0.618) % 1;
        const radius = R * (2.3 - 2.1 * f);
        const angle = seed + now * 1.7 + f * 3.6;
        d.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.03 + (1 - f) * 0.22 * (0.5 + 0.5 * Math.sin(seed * 3)));
        d.scale.setScalar(0.02 * smooth(f * 4) * (1 - smooth((f - 0.85) / 0.15)) * pose.open);
      } else {
        const a = sinceBreach;
        const out = 0.35 + (i % 5) * 0.11, rise = 1.0 + (i % 7) * 0.13;
        const radius = R * 0.25 + out * a;
        const height = rise * a - 2.4 * a * a;
        d.position.set(Math.cos(seed) * radius, Math.sin(seed) * radius, Math.max(0.02, height));
        d.scale.setScalar(height > 0 ? 0.024 * (1 - smooth(a / 1.1)) : 0);
      }
      d.rotation.set(seed + now * 3, seed * 0.5, -seed);
      d.updateMatrix();
      sparks.current.setMatrixAt(i, d.matrix);
    }
    sparks.current.instanceMatrix.needsUpdate = true;
  }, -0.3);

  return <>
    <group ref={body} name="story-worm-arrival">{children}</group>
    <group ref={portal} visible={false} name="story-arrival-portal">
      <mesh ref={aperture} frustumCulled={false} renderOrder={2}>
        <planeGeometry args={[R * APERTURE_REACH * 2, R * APERTURE_REACH * 2]} />
        <shaderMaterial uniforms={scratch.aperture} vertexShader={vertexShader} fragmentShader={apertureShader}
          transparent depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh ref={beam} frustumCulled={false} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, BEAM_HEIGHT / 2]} renderOrder={3}>
        <cylinderGeometry args={[R * 0.45, R * 0.85, BEAM_HEIGHT, 32, 1, true]} />
        <shaderMaterial uniforms={scratch.beam} vertexShader={vertexShader} fragmentShader={beamShader}
          transparent depthWrite={false} side={DoubleSide} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      {[0, 1].map(i => <mesh key={i} ref={node => { arcs.current[i] = node; }} position={[0, 0, 0.012 + i * 0.01]} frustumCulled={false} renderOrder={3}>
        <torusGeometry args={[1, i ? 0.035 : 0.05, 6, 64, Math.PI * (i ? 1.1 : 1.55)]} />
        <meshBasicMaterial color={i ? '#c4a6ff' : '#9effe6'} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>)}
      <mesh ref={ripple} position={[0, 0, 0.006]} frustumCulled={false} renderOrder={3}>
        <ringGeometry args={[0.9, 1, 64]} />
        <meshBasicMaterial color="#9effe6" transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} side={DoubleSide} />
      </mesh>
      <mesh ref={shock} position={[0, 0, 0.008]} frustumCulled={false} renderOrder={3}>
        <ringGeometry args={[0.86, 1, 64]} />
        <meshBasicMaterial color="#e6fffb" transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} side={DoubleSide} />
      </mesh>
      <instancedMesh ref={sparks} args={[undefined, undefined, SPARKS]} frustumCulled={false} renderOrder={3}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#d6fbff" transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </instancedMesh>
    </group>
  </>;
}
