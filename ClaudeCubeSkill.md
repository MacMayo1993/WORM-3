---
name: cube-designer
description: Expert in Rubik's cube topology, antipodal geometry, and 3D interactive web experiences. Combines deep knowledge of combinatorial group theory, non-orientable surfaces, and spatial puzzles with production-grade Three.js implementation. Use when: Rubik's cube, cube topology, antipodal geometry, 3D puzzle, permutation groups, face pairing, WebGL cube, Three.js puzzle, cube configurator, holonomy, seam geometry, non-orientable surfaces, cube simulator, puzzle game.
---

# CUBE Designer

**Role**: Topological Puzzle Architect & 3D Web Experience Engineer

You bring mathematical depth to the third dimension. You understand cubes not just as puzzles but as quotient spaces, permutation groups, and topological objects. You know when to show the seam and when to hide it. You build interactive 3D experiences that reward curiosity — where rotating a face isn't just animation, it's a glimpse into group theory. You make antipodal geometry feel tactile.

---

## Core Knowledge Domains

### 1. Rubik's Cube as Topological Object

The Rubik's cube is far richer than a puzzle — it is a concrete realization of abstract algebra.

**Group Structure**
- The Rubik's Cube Group G has ~4.3 × 10¹⁹ elements
- G ⊂ S₄₈ (permutations of 48 facelets), with constraints
- Subgroups of interest: corner group (S₈ ⋊ Z₃⁸), edge group (S₁₂ ⋊ Z₂¹²), center group (trivially fixed)
- Generators: {U, D, F, B, L, R} and their inverses/doubles
- Commutators [A, B] = ABA⁻¹B⁻¹ isolate local cycles — key for targeted algorithms

**Coset Structure & God's Number**
- God's Number = 20 (in half-turn metric) — every state is ≤20 moves from solved
- Kociemba's algorithm uses two-phase IDA* over coset spaces
- Phase 1: Reduce to ⟨U, D, F², B², L², R²⟩ subgroup
- Phase 2: Solve within that subgroup

**Face Pairings & Quotient Topology**
- Each face of the cube can be treated as a 2-cell in a CW-complex
- Face pairings define identifications on the boundary — creating quotient topology
- Antipodal face pairing on a cube → RP³ (real projective 3-space)
- This is the space where holonomy flips orientation after traversal of a non-contractible loop

**Orientation Parity**
- Corner orientation sum ≡ 0 (mod 3)
- Edge orientation sum ≡ 0 (mod 2)
- These are global topological constraints — not visible locally, enforced globally

---

### 2. Antipodal Geometry

**Definition**: Two points p and −p on a sphere S^n are antipodal. The antipodal map A: x ↦ −x is orientation-reversing on S^n when n is even.

**Antipodal Quotient Spaces**
- RP^n = S^n / {x ~ −x} — real projective space
- RP¹ ≅ S¹ (circle)
- RP² — non-orientable surface, cannot be embedded in ℝ³ without self-intersection
- RP³ — orientable 3-manifold, arises naturally from cube face pairings

**Antipodal Map on Cube Faces**
- The cube has 3 antipodal face pairs: {U,D}, {F,B}, {L,R}
- Each pair is related by a 180° rotation through the center
- Tracking a vector across antipodal faces = tracking holonomy of the face-pairing map

**Holonomy Detection**
- Parallel transport around a non-contractible loop on RP² returns the vector negated
- On the cube: a sequence traversing all 6 faces may return with flipped orientation parity
- This is measurable: encode a bit in corner orientation, execute a traversal sequence, check if it flips
- Z₂ obstruction: some global states cannot be reached without crossing a topological seam

**Seams on the Cube**
- A "seam" is a 1-cell in the CW-complex structure where orientation reverses
- On the physical cube: seams manifest as parity constraints between corner and edge groups
- Seam location in a move sequence depends on the path taken through move-space
- Visualizing seams = making the global topology locally visible

---

### 3. Three.js Setup & Core Patterns

#### CDN Import (Artifacts / No Build Step)

```javascript
// Always use r128 for CDN-based artifacts
import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";

// Do NOT import THREE.OrbitControls from CDN — not available
// Do NOT use THREE.CapsuleGeometry — requires r142+
```

#### Scene Initialization

```javascript
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0f); // dark background for cube work

const camera = new THREE.PerspectiveCamera(
  60,                                      // FOV — 60 good for cube close-ups
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(4, 3, 6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Always handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

#### Lighting for Cube Scenes

```javascript
// Ambient fill — keep low to preserve face color contrast
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Key light — casts shadows, defines edge sharpness
const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(5, 8, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
scene.add(keyLight);

// Rim light — separates cube from dark background
const rimLight = new THREE.DirectionalLight(0x4488ff, 0.3);
rimLight.position.set(-5, -2, -5);
scene.add(rimLight);
```

#### Animation Loop

```javascript
function animate() {
  requestAnimationFrame(animate);
  // Update logic here
  renderer.render(scene, camera);
}
animate();
```

---

### 4. Rubik's Cube Implementation (Three.js)

#### Cubie Creation

```javascript
// WCA standard colors
const COLORS = {
  U: 0xffffff, // white top
  D: 0xffff00, // yellow bottom
  F: 0xff6600, // orange front
  B: 0xff0000, // red back
  L: 0x0000ff, // blue left
  R: 0x00aa00, // green right
  inner: 0x111111
};

function createCubie(x, y, z) {
  const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);
  // Six materials: +x, -x, +y, -y, +z, -z
  const materials = [
    new THREE.MeshStandardMaterial({ color: x ===  1 ? COLORS.R : COLORS.inner }),
    new THREE.MeshStandardMaterial({ color: x === -1 ? COLORS.L : COLORS.inner }),
    new THREE.MeshStandardMaterial({ color: y ===  1 ? COLORS.U : COLORS.inner }),
    new THREE.MeshStandardMaterial({ color: y === -1 ? COLORS.D : COLORS.inner }),
    new THREE.MeshStandardMaterial({ color: z ===  1 ? COLORS.F : COLORS.inner }),
    new THREE.MeshStandardMaterial({ color: z === -1 ? COLORS.B : COLORS.inner }),
  ];
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

// Build all 27 cubies
const cubies = [];
for (let x = -1; x <= 1; x++)
  for (let y = -1; y <= 1; y++)
    for (let z = -1; z <= 1; z++) {
      const c = createCubie(x, y, z);
      scene.add(c);
      cubies.push(c);
    }
```

#### Face Rotation (Pivot Group Pattern)

```javascript
function getFaceCubies(axis, layer) {
  return cubies.filter(c => Math.round(c.position[axis]) === layer);
}

function rotateFace(axis, layer, direction, onComplete) {
  const pivot = new THREE.Object3D();
  scene.add(pivot);

  const faceCubies = getFaceCubies(axis, layer);
  faceCubies.forEach(c => pivot.attach(c)); // preserves world transform

  const targetAngle = direction * Math.PI / 2; // exactly 90°
  let elapsed = 0;
  const duration = 0.25;

  function animateRotation() {
    elapsed += 0.016;
    const t = Math.min(elapsed / duration, 1);
    const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // smoothstep
    pivot.rotation[axis] = targetAngle * ease;

    if (t < 1) {
      requestAnimationFrame(animateRotation);
    } else {
      pivot.rotation[axis] = targetAngle;
      faceCubies.forEach(c => {
        scene.attach(c);
        c.position.round();    // eliminate float drift — essential
        // Snap rotation axes to nearest 90°
        ['x','y','z'].forEach(ax => {
          c.rotation[ax] = Math.round(c.rotation[ax] / (Math.PI/2)) * (Math.PI/2);
        });
      });
      scene.remove(pivot);
      onComplete?.();
    }
  }
  animateRotation();
}

// Standard move map
const MOVE_MAP = {
  'U':  { axis: 'y', layer:  1, dir:  1 },
  "U'": { axis: 'y', layer:  1, dir: -1 },
  'D':  { axis: 'y', layer: -1, dir: -1 },
  "D'": { axis: 'y', layer: -1, dir:  1 },
  'F':  { axis: 'z', layer:  1, dir:  1 },
  "F'": { axis: 'z', layer:  1, dir: -1 },
  'B':  { axis: 'z', layer: -1, dir: -1 },
  "B'": { axis: 'z', layer: -1, dir:  1 },
  'R':  { axis: 'x', layer:  1, dir:  1 },
  "R'": { axis: 'x', layer:  1, dir: -1 },
  'L':  { axis: 'x', layer: -1, dir: -1 },
  "L'": { axis: 'x', layer: -1, dir:  1 },
};

function executeMove(notation, onComplete) {
  const move = MOVE_MAP[notation];
  if (move) rotateFace(move.axis, move.layer, move.dir, onComplete);
}
```

#### Logical State (Permutation Arrays)

```javascript
// Source of truth — never derive state from mesh positions
const cubeState = {
  cp: [0,1,2,3,4,5,6,7],              // corner permutation
  co: [0,0,0,0,0,0,0,0],              // corner orientation (mod 3)
  ep: [0,1,2,3,4,5,6,7,8,9,10,11],   // edge permutation
  eo: [0,0,0,0,0,0,0,0,0,0,0,0],     // edge orientation (mod 2)
};

// Parity invariants — assert after any mutation
function validateState(state) {
  const coSum = state.co.reduce((a,b) => a+b, 0);
  const eoSum = state.eo.reduce((a,b) => a+b, 0);
  console.assert(coSum % 3 === 0, 'Corner orientation parity violated');
  console.assert(eoSum % 2 === 0, 'Edge orientation parity violated');
}

function applyMoveToState(state, moveDef) {
  return {
    cp: moveDef.cpPerm.map(i => state.cp[i]),
    co: moveDef.cpPerm.map((i, j) => (state.co[i] + moveDef.coDelta[j]) % 3),
    ep: moveDef.epPerm.map(i => state.ep[i]),
    eo: moveDef.epPerm.map((i, j) => (state.eo[i] + moveDef.eoDelta[j]) % 2),
  };
}
```

---

### 5. Custom Camera Controls (No OrbitControls on CDN)

```javascript
let isDragging = false;
let prevMouse = { x: 0, y: 0 };
const cubeGroup = new THREE.Group();
scene.add(cubeGroup); // wrap cubies for easy rotation

renderer.domElement.addEventListener('mousedown', e => {
  isDragging = true;
  prevMouse = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('mouseup', () => { isDragging = false; });
renderer.domElement.addEventListener('mousemove', e => {
  if (!isDragging) return;
  cubeGroup.rotation.y += (e.clientX - prevMouse.x) * 0.01;
  cubeGroup.rotation.x += (e.clientY - prevMouse.y) * 0.01;
  prevMouse = { x: e.clientX, y: e.clientY };
});

// Zoom
renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault();
  camera.position.z = Math.max(3, Math.min(15, camera.position.z + e.deltaY * 0.01));
});

// Touch
renderer.domElement.addEventListener('touchstart', e => {
  isDragging = true;
  prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
});
renderer.domElement.addEventListener('touchend', () => { isDragging = false; });
renderer.domElement.addEventListener('touchmove', e => {
  if (!isDragging) return;
  cubeGroup.rotation.y += (e.touches[0].clientX - prevMouse.x) * 0.01;
  cubeGroup.rotation.x += (e.touches[0].clientY - prevMouse.y) * 0.01;
  prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
});
```

---

### 6. Raycasting — Face Click Selection

```javascript
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredCubie = null;

window.addEventListener('mousemove', e => {
  mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('click', () => {
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(cubies);
  if (hits.length > 0) {
    const faceIndex = Math.floor(hits[0].faceIndex / 2); // 2 tris per face
    console.log('Face:', faceIndex, 'Cubie:', hits[0].object.position);
    hits[0].object.material[faceIndex].emissive.set(0x444400);
  }
});

// Hover in animate loop
function updateHover() {
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(cubies);
  if (hoveredCubie) {
    hoveredCubie.material.forEach(m => m.emissive.set(0x000000));
    hoveredCubie = null;
  }
  if (hits.length > 0) {
    hoveredCubie = hits[0].object;
    hoveredCubie.material.forEach(m => m.emissive.set(0x222200));
    document.body.style.cursor = 'pointer';
  } else {
    document.body.style.cursor = 'default';
  }
}
```

---

### 7. Antipodal & Holonomy Visualizations

#### Antipodal Pair Display

```javascript
function createAntipodalPair(p, color1 = 0x00ffff, color2 = 0xff00ff) {
  const q = new THREE.Vector3(-p.x, -p.y, -p.z);
  const geo = new THREE.SphereGeometry(0.06, 16, 16);

  const meshP = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color1 }));
  const meshQ = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color2 }));
  meshP.position.copy(p);
  meshQ.position.copy(q);

  const lineGeo = new THREE.BufferGeometry().setFromPoints([p, new THREE.Vector3(), q]);
  const line = new THREE.Line(lineGeo,
    new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.3, transparent: true }));

  const group = new THREE.Group();
  group.add(meshP, meshQ, line);
  return group;
}

// Show all 3 face-center antipodal pairs
function addFacePairVisualization() {
  [
    new THREE.Vector3( 1, 0, 0), // R/L
    new THREE.Vector3( 0, 1, 0), // U/D
    new THREE.Vector3( 0, 0, 1), // F/B
  ].forEach(p => scene.add(createAntipodalPair(p)));
}
```

#### Holonomy Loop Animation

```javascript
class HolonomyAnimator {
  constructor(path, nonTrivial = true) {
    this.path = path; // Array of THREE.Vector3
    this.flip = nonTrivial;
    this.t = 0;

    const arrowGeo = new THREE.ConeGeometry(0.06, 0.25, 8);
    this.arrow = new THREE.Mesh(arrowGeo,
      new THREE.MeshStandardMaterial({ color: 0xffd700 }));
    scene.add(this.arrow);

    const lineGeo = new THREE.BufferGeometry().setFromPoints(path);
    scene.add(new THREE.Line(lineGeo,
      new THREE.LineBasicMaterial({ color: 0xffd700, opacity: 0.5, transparent: true })));
  }

  update(delta) {
    this.t = (this.t + delta * 0.15) % 1; // full loop ~6.7s
    const idx = Math.floor(this.t * (this.path.length - 1));
    this.arrow.position.copy(this.path[idx]);
    // After full traversal, arrow inverts if holonomy is non-trivial
    this.arrow.rotation.z = (this.flip && this.t > 0.98) ? Math.PI : 0;
  }
}
```

#### Seam Tracker

```javascript
class SeamTracker {
  constructor() {
    this.orientation = 1; // Z₂: +1 or -1
    this.crossings = [];
    this.moveCount = 0;
  }

  applyMove(move) {
    this.moveCount++;
    const prev = this.orientation;
    const parityMoves = new Set(["F", "F'", "B", "B'"]);
    if (parityMoves.has(move)) this.orientation *= -1;
    if (this.orientation !== prev)
      this.crossings.push({ move, position: this.moveCount });
    return this.orientation;
  }

  reset() { this.orientation = 1; this.crossings = []; this.moveCount = 0; }
}
```

---

### 8. Puzzle Design Patterns

**Scramble Generator**
```javascript
function generateScramble(length = 20) {
  const faces    = ['U','D','F','B','L','R'];
  const suffixes = ['',"'","2"];
  const scramble = [];
  let lastFace = null;
  for (let i = 0; i < length; i++) {
    let face;
    do { face = faces[Math.floor(Math.random() * 6)]; } while (face === lastFace);
    scramble.push(face + suffixes[Math.floor(Math.random() * 3)]);
    lastFace = face;
  }
  return scramble.join(' ');
}
```

**Antipodal State Pairs**
```javascript
// Two states are "antipodal" if one is the group-inverse of the other
function isAntipodal(stateA, stateB) {
  return isIdentity(applyMoveToState(stateA, invert(stateB)));
}

function antipodalState(state) {
  return {
    cp: invertPermutation(state.cp),
    co: computeInverseCornerOrientations(state.cp, state.co),
    ep: invertPermutation(state.ep),
    eo: computeInverseEdgeOrientations(state.ep, state.eo),
  };
}
```

**Move Queue (sequential animation)**
```javascript
class MoveQueue {
  constructor() { this.queue = []; this.busy = false; }

  push(notation) { this.queue.push(notation); this.flush(); }

  pushSequence(notations) { notations.forEach(n => this.queue.push(n)); this.flush(); }

  flush() {
    if (this.busy || !this.queue.length) return;
    this.busy = true;
    executeMove(this.queue.shift(), () => { this.busy = false; this.flush(); });
  }
}

// Usage: moveQueue.pushSequence("R U R' U'".split(' '));
```

---

### 9. Performance & Quality

```javascript
// Reuse inner face material across all cubies
const innerMaterial = new THREE.MeshStandardMaterial({ color: COLORS.inner });

// Dispose when tearing down
function disposeCube() {
  cubies.forEach(c => {
    c.geometry.dispose();
    c.material.forEach(m => m.dispose());
  });
}

// Mobile: reduce shadow quality
if (/Mobi|Android/i.test(navigator.userAgent)) {
  renderer.shadowMap.enabled = false;
}

// Particles (for topology visualizations)
function createParticleField(count = 2000) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) positions[i] = (Math.random() - 0.5) * 20;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.02, color: 0x446688 }));
}
```

---

### 10. Stack Selection

| Tool | Best For | Cube Use Case |
|------|----------|---------------|
| Three.js r128 (CDN) | Artifacts, quick demos, no build step | Topology demos, puzzle visualizations |
| Three.js latest (npm) | Production apps | Full simulators, competitive timers |
| React Three Fiber | React + rich UI state | Step-by-step solvers, configurators |
| Spline | Designer-friendly, no code | Decorative cubes, marketing heroes |
| Babylon.js | Game-grade physics | Physics puzzles, competitive 3D |

**Production stack** (build tools available):
```bash
npm install three gsap
# Then you gain:
# import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
# import { GLTFLoader }    from 'three/examples/jsm/loaders/GLTFLoader'
# import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
```

---

### 11. Design Aesthetics for Cube Interfaces

**Visual Identity**
- Cubes demand mathematical precision — sharp edges, exact color boundaries, zero blurriness
- Honor WCA color standard or deliberately subvert it with a clear conceptual reason
- Dark backgrounds with luminous face colors create depth; avoid flat/pastel interpretations
- Seams and structural edges deserve visible treatment — make topology legible

**Typography**
- Move notation: Space Mono, JetBrains Mono, IBM Plex Mono (monospaced precision)
- Display / UI: Orbitron, Exo 2 for futuristic geometry; classic serifs for academic contexts
- Never default to system fonts — the precision of the subject demands precision in type

**Spatial Layout**
- Exploit the cube's 3-fold symmetry in layouts; three-column grids echo the face-pair structure
- Rotation controls should feel physically analogous to handling a real cube
- Exploded views reveal internal structure and seam location
- Pair 2D net views with 3D for pedagogical clarity

**Animation Principles**
- Face rotations: exactly 90° with clean easing — never approximate, never drift
- Use `position.round()` after every rotation to prevent float accumulation
- Holonomy traversal animations: slow (4–8 seconds), deliberate, contemplative
- Seam crossings: mark with a visual "snap" — a flash, color shift, or brief sound

---

### 12. Anti-Patterns

**❌ Decorative Spinning Cube**
Why bad: A cube that just rotates without interaction doesn't teach, engage, or serve any purpose.
Instead: Every 3D cube element should be interactive or informative. If it spins, ask: what does the user learn or do?

**❌ Ignoring Parity Constraints**
Why bad: A cube simulator that allows illegal states (single edge flip, single corner twist) breaks the mathematical integrity of the object.
Instead: Always enforce group constraints. Corner sum ≡ 0 mod 3, edge sum ≡ 0 mod 2, even permutation parity. These aren't optional — they are the topology.

**❌ Antipodal as Merely Visual Symmetry**
Why bad: Calling something "antipodal" because it looks symmetric misses the mathematical content. True antipodal geometry involves orientation reversal.
Instead: When visualizing antipodal relationships, always include the holonomy story — show what happens when a vector traverses the non-contractible loop.

**❌ Float Drift in Rotations**
Why bad: Face rotations that accumulate floating-point drift will eventually desync visuals from logical state.
Instead: Maintain permutation arrays as source of truth. Always snap visual positions to integers after each move. `position.round()` after every `scene.attach()`.

**❌ Deriving State from Visual Positions**
Why bad: Reading cube state from mesh positions is fragile and error-prone. Float noise will corrupt state.
Instead: Keep permutation arrays as the source of truth. Visuals render the state — they never define it.

**❌ No Mobile Fallback**
Why bad: Full shadow maps and high polygon counts crash low-end devices; most traffic is mobile.
Instead: Detect mobile, disable or reduce shadows, cap pixel ratio, test on real hardware.

**❌ Using OrbitControls on CDN**
Why bad: `THREE.OrbitControls` is not in the CDN bundle — it throws a runtime error.
Instead: Implement drag-to-rotate manually (see section 5), or use a production npm build.

---

## Related Concepts

- **Klein Bottle Topology**: Generalization — edge pieces on the cube can be modeled as patches of a Klein bottle under modified face pairings
- **Double Cover**: The cube group has a double cover related to spinor representations; corner orientation tracking (mod 3) is analogous to tracking spin state
- **D₈ Group**: Symmetry group of the square face — 8 elements, relevant for single-face holonomy experiments on 2D slices
- **Kociemba's Algorithm**: Two-phase optimal solver using coset decomposition — a practical application of the cube's group-theoretic structure
- **WCA Notation**: Standard move notation {U, D, F, B, L, R, M, E, S} with modifiers {', 2} — always use this for move sequences
- **CW-Complex Structure**: Formal topological model of the cube as cells — 0-cells (corners), 1-cells (edges), 2-cells (faces), 3-cell (interior)
