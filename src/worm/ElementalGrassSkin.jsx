import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { buildMeadowGeometry } from './healerWorm/natureMeadow.js';

const vertexShader = `
  attribute vec2 aRoot;
  attribute vec3 aBlade;
  attribute vec4 aCell;
  attribute float aSweep;
  uniform float uTime;
  uniform vec4 uEnv;
  uniform vec4 uWorm;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vBlade;
  varying float vGrowth;
  void main() {
    float turn = aCell.w * 6.283185;
    mat2 spin = mat2(cos(turn), -sin(turn), sin(turn), cos(turn));
    vec2 root = spin * aRoot;
    vec3 p = position;
    p.xy = spin * p.xy;
    // Stagger blades within each arriving cell so the meadow sprouts in a wave.
    // Reserve room for growth after travel: even the farthest cell completes
    // before claim reaches 1, rather than remaining permanently half-sprouted.
    float start = aSweep * 0.64 + aBlade.z * 0.06;
    float growth = smoothstep(start, start + 0.26, uEnv.y);
    p.xy = root + (p.xy - root) * growth;
    p.z *= growth;
    vec4 worldRoot = modelMatrix * instanceMatrix * vec4(root, 0.0, 1.0);
    float t = uTime;
    float wave = sin(dot(worldRoot.xyz, vec3(0.9, 0.55, 0.7)) - t * 1.35);
    float flutter = sin(t * 2.7 + aBlade.z * 12.0 + aCell.w * 8.0);
    float tip = aBlade.x * aBlade.x;
    vec3 right = normalize((modelMatrix * instanceMatrix * vec4(1., 0., 0., 0.)).xyz);
    vec3 forward = normalize((modelMatrix * instanceMatrix * vec4(0., 1., 0., 0.)).xyz);
    vec3 breeze = vec3(0.8, 0.2, 0.45) * wave + vec3(0.12, 0.04, -0.14) * flutter;
    p.xy += vec2(dot(breeze, right), dot(breeze, forward)) * 0.055 * tip * growth * uEnv.w;
    vec3 away = worldRoot.xyz - uWorm.xyz;
    float brush = exp(-dot(away, away) * 6.0) * uWorm.w;
    p.xy += vec2(dot(away, right), dot(away, forward)) * brush * tip * 0.55;
    p.z *= 1.0 - brush * tip * 0.52;
    vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vec3 scaleSq = vec3(dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz), dot(instanceMatrix[1].xyz, instanceMatrix[1].xyz), dot(instanceMatrix[2].xyz, instanceMatrix[2].xyz));
    vec3 n = normal;
    n.xy = spin * n.xy;
    vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * (n / max(scaleSq, vec3(0.00001))));
    vView = cameraPosition - wp.xyz;
    vBlade = aBlade;
    vGrowth = growth * uEnv.x;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const fragmentShader = `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vBlade;
  varying float vGrowth;
  void main() {
    if (vGrowth < 0.015) discard;
    vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 light = normalize(vec3(-0.4, 0.8, 0.6));
    float diffuse = 0.60 + abs(dot(n, light)) * 0.35;
    vec3 root = vec3(0.018, 0.085, 0.028);
    vec3 mid = mix(vec3(0.045, 0.28, 0.08), vec3(0.19, 0.39, 0.075), vBlade.z);
    vec3 tip = mix(vec3(0.30, 0.56, 0.11), vec3(0.49, 0.62, 0.19), vBlade.z);
    vec3 color = mix(root, mid, smoothstep(0.0, 0.45, vBlade.x));
    color = mix(color, tip, smoothstep(0.50, 1.0, vBlade.x) * 0.75);
    // Fold, centre vein, and transmitted light give each blade a readable volume.
    float vein = (1.0 - smoothstep(0.0, 0.18, abs(vBlade.y))) * vBlade.x;
    float rim = pow(1.0 - abs(dot(n, normalize(vView))), 3.0);
    color = color * diffuse + vec3(0.09, 0.13, 0.025) * vein;
    color += tip * rim * 0.16 * vBlade.x;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

let material;
export function getMeadowMaterial() {
  if (!material) material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uEnv: { value: new THREE.Vector4(0, 0, 0, 1) },
      uWorm: { value: new THREE.Vector4(0, 0, 0, 0) }
    }, vertexShader, fragmentShader, side: THREE.DoubleSide
  });
  material.userData.elementalInstanced = true;
  return material;
}

export default function ElementalGrassSkin({ count, bladesPerCell = 88, cellData, meshRef }) {
  const geometry = useMemo(() => {
    const geo = buildMeadowGeometry(bladesPerCell);
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cellData.cell, 4));
    geo.setAttribute('aSweep', new THREE.InstancedBufferAttribute(cellData.sweep, 1).setUsage(THREE.DynamicDrawUsage));
    return geo;
  }, [bladesPerCell, cellData]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <instancedMesh ref={meshRef} args={[geometry, getMeadowMaterial(), count]}
    dispose={null} frustumCulled={false} raycast={() => null} />;
}
