import * as THREE from 'three';

// The finish every menu worm wears over its body: an ink outline, a soft
// contact shadow under each segment and a glistening slime trail behind it. Each
// is ONE instanced draw per worm, whatever its length, so the main menu's six
// worms and the carousel's pair cost three draws each on top of their bodies.
//
// All of it is plain three.js and render-only: the caller poses the body and
// hands each segment over (`outlineSegment`, `shadowSegment`), lays trail
// (`emitTrail`) and ticks the clock it already pauses (`update`).

// Outline thickness in world units, the same at every bead size, so a tapered
// tail keeps as heavy a line as the head.
export const MENU_WORM_INK = 0.016;
// Enough dots for the fastest menu worm's whole trail: the first stretch lies
// under its own body, so the life must outlast the body's length.
export const MENU_TRAIL_DOTS = 48;
export const MENU_TRAIL_LIFE = 2.2; // seconds of the worm's own clock

// Soft round decal: the shadow is a dark pool, the trail a hot core in a halo.
const DECAL_VERTEX = /* glsl */`
  attribute float aFade;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    vUv = uv;
    vFade = aFade;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;
const SHADOW_FRAGMENT = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    float d = length((vUv - 0.5) * 2.0);
    float a = (1.0 - smoothstep(0.0, 1.0, d)) * uOpacity * vFade;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;
const TRAIL_FRAGMENT = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    float d = length((vUv - 0.5) * 2.0);
    float halo = pow(max(0.0, 1.0 - d), 2.2);
    float core = smoothstep(0.42, 0.0, d);
    float a = min(1.0, (halo * 0.6 + core * 0.7) * uOpacity * vFade);
    if (a < 0.003) discard;
    // Blended, not added: a glow on white paper or a white sticker would
    // otherwise vanish. The core runs toward white, the halo keeps the glow.
    gl_FragColor = vec4(mix(uColor, vec3(1.0), core * 0.4), a);
  }
`;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

function decalMesh(count, fragmentShader, color, opacity) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  fade.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aFade', fade);
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: DECAL_VERTEX,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    // A decal a hair off a sticker: offset it toward the camera instead of
    // lifting it far enough to float.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Instances move with the worm across the whole cube; the base geometry's
  // bounds say nothing about where they are.
  mesh.frustumCulled = false;
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, _zero);
  return { mesh, fade };
}

/**
 * @param {object} options
 * @param {THREE.BufferGeometry} [options.geometry] body geometry to ink (null: no outline)
 * @param {number} options.segments  how many outline/shadow instances
 * @param {string|THREE.Color} options.ink  outline colour
 * @param {string|THREE.Color} options.glow trail colour
 * @param {number} [options.inkWidth]  outline thickness in world units
 * @param {number} [options.shadowOpacity]
 * @param {number} [options.trailOpacity] 0 turns the trail off
 */
export function createMenuWormFinish({ geometry = null, segments, ink, glow, inkWidth = MENU_WORM_INK, shadowOpacity = 0.55, trailOpacity = 0.7 }) {
  const group = new THREE.Group();
  group.name = 'menu-worm-finish';
  const disposables = [];
  let outline = null;
  if (geometry) {
    const material = new THREE.MeshBasicMaterial({ color: ink, side: THREE.BackSide });
    outline = new THREE.InstancedMesh(geometry, material, segments);
    outline.name = 'menu-worm-outline';
    outline.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    outline.frustumCulled = false;
    // Drawn after the bodies, so the hull is depth-rejected wherever a bead is
    // in front of it and only the rim survives.
    outline.renderOrder = 1;
    for (let i = 0; i < segments; i++) outline.setMatrixAt(i, _zero);
    disposables.push(material);
    group.add(outline);
  }
  const shadow = decalMesh(segments, SHADOW_FRAGMENT, '#0d1410', shadowOpacity);
  shadow.mesh.name = 'menu-worm-shadow';
  shadow.mesh.renderOrder = -1;
  disposables.push(shadow.mesh.geometry, shadow.mesh.material);
  group.add(shadow.mesh);

  const trailOn = trailOpacity > 0;
  const trail = trailOn ? decalMesh(MENU_TRAIL_DOTS, TRAIL_FRAGMENT, glow, trailOpacity, false) : null;
  const dots = trailOn ? Array.from({ length: MENU_TRAIL_DOTS }, () => ({
    position: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1), born: -Infinity, size: 0, spin: 0,
  })) : [];
  let nextDot = 0;
  if (trail) {
    trail.mesh.name = 'menu-worm-trail';
    disposables.push(trail.mesh.geometry, trail.mesh.material);
    group.add(trail.mesh);
  }
  const dirty = { outline: false, shadow: false };

  return {
    group,
    outline,
    shadow: shadow.mesh,
    trail: trail?.mesh ?? null,
    setInk(color) { outline?.material.color.set(color); },
    setGlow(color) { trail?.mesh.material.uniforms.uColor.value.set(color); },
    /**
     * Ink one body mesh. `holder` and `body` are the rig's segment group and
     * the mesh inside it; the hull is the body grown by MENU_WORM_INK.
     */
    outlineSegment(i, holder, body, visible) {
      if (!outline) return;
      dirty.outline = true;
      if (!visible || !body) { outline.setMatrixAt(i, _zero); return; }
      holder.updateMatrix();
      const radius = Math.max(1e-4, body.scale.x);
      _s.copy(body.scale).multiplyScalar((radius + inkWidth) / radius);
      _m.compose(body.position, body.quaternion, _s).premultiply(holder.matrix);
      outline.setMatrixAt(i, _m);
    },
    /** Lay a shadow on the surface under a segment; `strength` 0 hides it. */
    shadowSegment(i, surface, normal, radius, strength) {
      dirty.shadow = true;
      if (!(strength > 0.01)) { shadow.mesh.setMatrixAt(i, _zero); shadow.fade.setX(i, 0); return; }
      _q.setFromUnitVectors(_zAxis, normal);
      // Wider than the bead, so a soft rim of it shows round the body.
      _s.set(radius * 3.6, radius * 3.6, 1);
      _p.copy(surface).addScaledVector(normal, 0.004);
      shadow.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      shadow.fade.setX(i, Math.min(1, strength));
    },
    /** Drop one glowing dot on the surface. `time` is the worm's own clock. */
    emitTrail(surface, normal, radius, time) {
      if (!trail) return;
      const dot = dots[nextDot];
      nextDot = (nextDot + 1) % dots.length;
      dot.position.copy(surface).addScaledVector(normal, 0.006);
      dot.normal.copy(normal);
      dot.born = time;
      dot.size = radius * (0.9 + 0.2 * Math.sin(time * 13.7 + nextDot));
      dot.spin = nextDot * 2.399;
    },
    clearTrail() { for (const dot of dots) dot.born = -Infinity; },
    update(time, reducedMotion = false) {
      if (dirty.outline && outline) { outline.instanceMatrix.needsUpdate = true; dirty.outline = false; }
      if (dirty.shadow) { shadow.mesh.instanceMatrix.needsUpdate = true; shadow.fade.needsUpdate = true; dirty.shadow = false; }
      if (!trail) return;
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        const age = (time - dot.born) / MENU_TRAIL_LIFE;
        if (!(age >= 0 && age < 1)) { trail.mesh.setMatrixAt(i, _zero); trail.fade.setX(i, 0); continue; }
        const life = 1 - age;
        // Bright when laid, then it soaks into the sticker; reduced motion
        // drops the twinkle but keeps the fade.
        const twinkle = reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(time * 9 + dot.spin);
        _q.setFromUnitVectors(_zAxis, dot.normal);
        const size = dot.size * (0.55 + 0.45 * life);
        _s.set(size, size, 1);
        trail.mesh.setMatrixAt(i, _m.compose(dot.position, _q, _s));
        trail.fade.setX(i, life * (0.4 + 0.6 * life) * twinkle);
      }
      trail.mesh.instanceMatrix.needsUpdate = true;
      trail.fade.needsUpdate = true;
    },
    dispose() {
      disposables.forEach(resource => resource.dispose());
      outline?.dispose(); shadow.mesh.dispose(); trail?.mesh.dispose();
    },
  };
}
