import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { isCarouselActive } from './menuCarouselState.js';
import * as THREE from 'three';

// Shared time uniform — all overlay instances reference the same object so the
// GPU uniform is uploaded once per frame regardless of how many tiles are active.
const _menuOverlayT = { value: 0.0 };

const _sharedPlane = new THREE.PlaneGeometry(0.85, 0.85);
const _rimPlane    = new THREE.PlaneGeometry(1.05, 1.05);

// ── Shaders extracted verbatim from StickerPlane.jsx ─────────────────────────

const _vert = `varying vec2 vUv;
void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

const _wispyRingFrag = `
  uniform vec3 uColor;
  uniform vec3 uAntiColor;
  uniform float uTime;
  varying vec2 vUv;
  void main(){
    vec2 uv=vUv-0.5;
    float dist=length(uv);
    float angle=atan(uv.y,uv.x);
    float inDisc=1.0-smoothstep(0.44,0.50,dist);
    float r0=0.36,weave=0.030,turns=4.0,speed=1.6;
    float phase=angle*turns-uTime*speed;
    float rA=r0+weave*sin(phase);
    float rB=r0+weave*sin(phase+3.14159265);
    float sigma=0.013;
    float gA=exp(-pow(dist-rA,2.0)/(2.0*sigma*sigma));
    float gB=exp(-pow(dist-rB,2.0)/(2.0*sigma*sigma));
    gA*=0.75+0.25*sin(phase*2.0);
    gB*=0.75+0.25*sin(phase*2.0+3.14159265);
    gA*=inDisc; gB*=inDisc;
    float total=gA+gB;
    vec3 col=total>0.001?(uColor*gA+uAntiColor*gB)/total:uColor;
    float alpha=clamp(total,0.0,1.0)*0.92;
    gl_FragColor=vec4(col*1.3,alpha);
  }
`;

const _rimGlowFrag = `
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2  vUv;
  void main(){
    vec2 p=vUv-0.5;
    float dist=length(p);
    if(dist>0.5) discard;
    float rim=smoothstep(0.30,0.39,dist)*(1.0-smoothstep(0.44,0.50,dist));
    float t=fract(uTime*1.8);
    float beat=t<0.12?t/0.12:pow(1.0-(t-0.12)/0.88,2.5);
    float angle=atan(p.y,p.x);
    float shimmer=0.60+0.40*sin(angle*6.0+uTime*5.0);
    float alpha=rim*(0.55+beat*0.75)*shimmer*uIntensity;
    gl_FragColor=vec4(uColor*(1.5+beat*2.0),alpha);
  }
`;

const _hazardCrackFrag = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
  void main(){
    vec2 uv=vUv-0.5;
    float dist=length(uv);
    if(dist>0.5) discard;
    float radialMask=smoothstep(0.5,0.18,dist);
    float angle=atan(uv.y,uv.x);
    float angleN=(angle+3.14159265)/6.2831853;
    float crackA=abs(fract(angleN*7.0+sin(dist*20.0+uTime*2.1)*0.06)-0.5);
    float crackB=abs(fract(angleN*11.0+cos(dist*26.0-uTime*2.7)*0.08)-0.5);
    float crackLines=(1.0-smoothstep(0.0,0.05,crackA))+(1.0-smoothstep(0.0,0.04,crackB));
    float ringCrack=1.0-smoothstep(0.0,0.035,abs(dist-(0.25+sin(angle*3.0+uTime*3.0)*0.02)));
    float shards=smoothstep(0.78,1.0,hash21(floor((uv+0.5)*18.0)+uTime*0.02));
    float crackMask=clamp(crackLines*0.45+ringCrack*0.6+shards*0.25,0.0,1.0);
    float pulse=0.65+sin(uTime*8.0+angle*5.0)*0.35;
    float alpha=crackMask*radialMask*pulse*uIntensity;
    gl_FragColor=vec4(uColor*1.9,alpha);
  }
`;

const _seamLeakFrag = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  void main(){
    vec2 uv=vUv;
    float edge=max(abs(uv.x-0.5),abs(uv.y-0.5));
    float edgeBand=smoothstep(0.38,0.5,edge);
    float centerBlock=1.0-smoothstep(0.18,0.28,length(uv-0.5));
    float seamMask=edgeBand*(1.0-centerBlock);
    float waveX=sin((uv.x*18.0+uTime*4.0));
    float waveY=cos((uv.y*22.0-uTime*3.2));
    float pulse=0.55+(waveX*waveY)*0.25+sin(uTime*7.5)*0.2;
    float alpha=clamp(seamMask*pulse*uIntensity,0.0,1.0);
    gl_FragColor=vec4(uColor*1.7,alpha);
  }
`;

/**
 * MenuTileOverlay — full layer stack for flipped center tiles on the menu cube.
 * Renders: wispy double-helix ring, hazard crack overlay, seam leak, and worm rim glow.
 * Positioned at z=+0.001..+0.004 above the main sticker plane to layer correctly.
 *
 * colorHex    — current face color (matches the tile's displayed color)
 * antiColorHex — its antipodal partner's color (used for the double-helix second strand)
 */
const MenuTileOverlay = ({ colorHex, antiColorHex }) => {
  const wispyMatRef   = useRef();
  const crackMatRef   = useRef();
  const seamMatRef    = useRef();
  const rimMatRef     = useRef();

  // per-instance uniform objects — created once, uColor/uAntiColor values are stable
  const [wispyU] = React.useState(() => ({
    uColor:     { value: new THREE.Color(colorHex) },
    uAntiColor: { value: new THREE.Color(antiColorHex || '#888888') },
    uTime:      _menuOverlayT,
  }));
  const [crackU] = React.useState(() => ({
    uColor:     { value: new THREE.Color(colorHex) },
    uTime:      _menuOverlayT,
    uIntensity: { value: 0.30 },
  }));
  const [seamU] = React.useState(() => ({
    uColor:     { value: new THREE.Color(colorHex) },
    uTime:      _menuOverlayT,
    uIntensity: { value: 0.45 },
  }));
  const [rimU] = React.useState(() => ({
    uColor:     { value: new THREE.Color(colorHex) },
    uTime:      _menuOverlayT,
    uIntensity: { value: 1.0 },
  }));

  const rootRef = React.useRef();

  useFrame((state) => {
    // All overlay instances write the same value — harmless duplication, cheap write.
    _menuOverlayT.value = state.clock.elapsedTime;
    // These overlays render with depth testing relaxed, so they draw straight
    // through the opaque six-faces mode plates — hide them while the selector
    // owns the cube.
    if (rootRef.current) rootRef.current.visible = !isCarouselActive();
  });

  return (
    <group ref={rootRef}>
      {/* Wispy double-helix ring — z=0.007 matching StickerPlane layout */}
      <mesh position={[0, 0, 0.007]} geometry={_sharedPlane} renderOrder={12}>
        <shaderMaterial
          ref={wispyMatRef}
          vertexShader={_vert}
          fragmentShader={_wispyRingFrag}
          uniforms={wispyU}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Hazard crack overlay — z=0.010 */}
      <mesh position={[0, 0, 0.010]} geometry={_sharedPlane} renderOrder={13}>
        <shaderMaterial
          ref={crackMatRef}
          vertexShader={_vert}
          fragmentShader={_hazardCrackFrag}
          uniforms={crackU}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Seam leak overlay — z=0.012 */}
      <mesh position={[0, 0, 0.012]} geometry={_sharedPlane} renderOrder={14}>
        <shaderMaterial
          ref={seamMatRef}
          vertexShader={_vert}
          fragmentShader={_seamLeakFrag}
          uniforms={seamU}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Worm rim glow (heartbeat ring) — z=0.022 matching StickerPlane, uses larger plane */}
      <mesh position={[0, 0, 0.022]} geometry={_rimPlane} renderOrder={11}>
        <shaderMaterial
          ref={rimMatRef}
          vertexShader={_vert}
          fragmentShader={_rimGlowFrag}
          uniforms={rimU}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};

export default MenuTileOverlay;
