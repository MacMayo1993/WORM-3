# WORM-3

**A Rubik's Cube on the Real Projective Plane**

WORM-3 is an interactive 3D puzzle built on a single mathematical premise: opposite faces of the cube are not merely "across from each other" — they are **the same face**, viewed from opposite sides of a non-orientable surface. The game is a tangible model of the real projective plane (RP²), the simplest compact non-orientable 2-manifold, made playable.

**[Play Live](https://macmayo1993.github.io/WORM-3/)**

---

## Table of Contents

- [The Core Idea](#the-core-idea)
- [The Mathematics](#the-mathematics)
  - [What Is RP²?](#what-is-rp²)
  - [Non-Orientability](#non-orientability)
  - [Antipodal Pairs and the Quotient Map](#antipodal-pairs-and-the-quotient-map)
  - [Parity on a Non-Orientable Surface](#parity-on-a-non-orientable-surface)
  - [Group Theory and Altered Configuration Space](#group-theory-and-altered-configuration-space)
- [Pedagogy: How the Game Teaches the Topology](#pedagogy-how-the-game-teaches-the-topology)
  - [Mechanic → Concept Map](#mechanic--concept-map)
  - [Level Progression as a Topology Curriculum](#level-progression-as-a-topology-curriculum)
- [Gameplay](#gameplay)
  - [Core Mechanics](#core-mechanics)
  - [Solving Modes](#solving-modes)
  - [Chaos Mode](#chaos-mode)
  - [Teaching Mode (CFOP Assistant)](#teaching-mode-cfop-assistant)
  - [WORM Mode: Crawling the Manifold](#worm-mode-crawling-the-manifold)
- [Controls](#controls)
- [Visual Modes and Tile Styles](#visual-modes-and-tile-styles)
- [Immersive Environments](#immersive-environments)
- [Settings and Customization](#settings-and-customization)
- [Technical Architecture](#technical-architecture)
- [Getting Started](#getting-started)
- [License](#license)
- [Author](#author)

---

## The Core Idea

Every Rubik's Cube simulator you have ever used assumes an orientable surface with six independent faces. WORM-3 does not.

Consider holding a cube. The red face (front) and the orange face (back) appear separate. But on the real projective plane, they are not. They are one point on the manifold, seen from two directions. Manipulate one and you manipulate the other. Navigate from one to the other along a closed path and your handedness can reverse. Standard algorithms fail because they were designed for a surface with a consistent notion of "left" and "right." On RP², that consistency does not exist everywhere.

WORM-3 makes this abstract fact into a physical experience. Every mechanic — flipping stickers, tracing wormhole tunnels, watching parity shift, seeing chaos cascade along manifold paths rather than Euclidean ones — is a direct enactment of a theorem about non-orientable surfaces. The mathematics is not decorative. It is the game.

---

## The Mathematics

### What Is RP²?

The real projective plane is the quotient space:

```
RP² = S² / Z₂
```

You begin with the 2-sphere S² — the surface of an ordinary ball — and identify every point with its antipodal point (the point diametrically opposite on the other side of the center). The resulting space is RP².

Equivalently, RP² is the space of all lines through the origin in R³. Each such line intersects S² in exactly two antipodal points, confirming the identification.

RP² cannot be embedded in three-dimensional space without self-intersection. You cannot physically build it. You can only work with it abstractly, or via representations that preserve its local geometry while hiding the global topology. WORM-3 is one such representation: a cube whose opposite face pairs enact the antipodal identification, with wormhole tunnels making the identification visible as a geometric feature rather than hiding it.

### Non-Orientability

An orientable surface is one where you can make a globally consistent choice of "clockwise." Give every small patch of the surface an orientation (a notion of which direction is positive rotation) and check that adjacent patches agree. On a sphere, this works fine. On RP², it does not.

The obstruction is this: RP² contains a Möbius band. If you trace a loop across an antipodal identification — that is, exit one face of the cube and re-enter through its paired opposite — your orientation can be reversed when you return to the start. A clockwise path becomes counterclockwise. A right-handed frame becomes left-handed.

This is not a flaw or an artifact of the representation. It is a fundamental topological invariant: the first Stiefel-Whitney class of RP² is non-trivial. Orientability is not just missing; it is provably absent.

**In gameplay**, this manifests concretely. The flip mechanic (pressing F on a sticker) travels through the identification. You exit one sticker and emerge at its antipodal partner — on the opposite face, rotated 180°, with spatial orientation reversed. If you flip twice along a closed path, you return to your starting orientation. If you flip once along the non-trivial loop, you have enacted a path that reverses handedness. The parity indicator registers this: the cube's algebraic state has changed in a way that no sequence of standard slice rotations can undo without performing another projective crossing.

### Antipodal Pairs and the Quotient Map

The quotient map q: S² → RP² sends each point to its equivalence class under antipodal identification. In WORM-3, this is implemented directly through face pairing:

| Face | Direction | Color | Antipodal Partner | Color |
|------|-----------|-------|-------------------|-------|
| Front | +Z | Red | Back (-Z) | Orange |
| Left | -X | Green | Right (+X) | Blue |
| Top | +Y | White | Bottom (-Y) | Yellow |

When you flip a sticker on the Red face, the corresponding sticker on the Orange face flips simultaneously. They are the same point under q. The flip mechanic is the quotient map made interactive: you reach through the identification and feel that the two stickers are one.

The wormhole tunnels (toggle with T) make this visual. Each antipodal pair is connected by a Bézier curve passing through the cube's interior — a representation of the identification in the ambient space, analogous to how a Möbius band's edge-gluing is sometimes drawn with an arrow showing where the identification happens. You can see the topology.

In Explode View (X key), the cubies separate and the full network of wormhole connections is exposed simultaneously. This is equivalent to looking at the identifications on a polygon representation of RP² — the pairing arrows become visible all at once.

### Parity on a Non-Orientable Surface

Parity is one of the most subtle and important topics in Rubik's Cube theory. On the standard cube, the group of reachable states has a parity constraint: corner parity, edge parity, and orientation parity are each independently conserved. Some combinations of piece positions that look plausible are actually unreachable because they would require a parity violation — a fact that has defeated countless people who disassemble a scrambled cube and reassemble it randomly.

On RP², the parity story changes.

Standard Rubik's parity arises because every face rotation is an even permutation of the sticker positions. To reach an odd permutation, you would need a single transposition — swapping exactly two pieces — which no combination of legal moves can achieve. This is a consequence of the orientability of the standard cube's surface. The cycle structure of legal rotations is constrained by the surface geometry.

WORM-3 introduces a new parity class via the flip mechanic. Each flip passes through the antipodal identification — it traverses the non-trivial loop in the fundamental group of RP²:

```
π₁(RP²) = Z₂
```

The fundamental group of RP² has exactly two elements: the trivial loop (contractible, even parity) and the non-trivial loop (the projective generator, odd parity). Traversing the identification once gives you the generator. Traversing it twice returns you to the identity.

In WORM-3, this means:

- **Even parity** (cyan glow): The cube is in a state reachable by an even number of projective crossings combined with standard rotations. Algorithms from ordinary Rubik's theory apply with modification.
- **Odd parity** (purple glow): The cube contains a "projective twist" — a fundamental topological defect introduced by an odd number of flip operations. This state is unreachable by slice rotations alone. You must perform another flip to return to even parity before standard solving techniques apply cleanly.

This is pedagogically significant. The game does not just tell you that RP² has a non-trivial fundamental group. It makes you solve around it. If you ignore parity when solving in odd state, your algorithms will seem to work but produce a subtly wrong result — exactly as happens when you ignore edge orientation on a standard cube, but now the cause is the topology of the surface rather than the topology of the permutation group.

**An important distinction**: Because flips always affect antipodal *pairs* simultaneously, a single flip operation is an even permutation of sticker positions in the product group sense. What changes is the *topological* parity — whether the path traced by your sequence of moves is contractible in RP² or passes through the non-trivial loop class. Algebraic parity and topological parity are distinct invariants in this game. Both matter for solving.

### Group Theory and Altered Configuration Space

The standard 3×3 Rubik's Cube group has approximately 4.3 × 10¹⁹ elements. The configuration space is:

```
G = (Z₃⁷ × Z₂¹¹) ⋊ (A₈ × A₁₂)
```

with constraints coupling the orientation and permutation subgroups.

WORM-3's manifold identification alters this group structure. The antipodal pairing means that certain sticker position classes are now identified. The flip operations generate new elements not in the standard Rubik's group — they correspond to coset generators for the projective crossings. The resulting configuration space contains orbits that are entirely unreachable on the ordinary cube.

The **Commutator Norm** provides a measure of how non-central an operation is with respect to the antipodal map A:

```
C(T) = ||T ∘ A - A ∘ T||     (count of elements moved by the commutator)
C(T) = 0  ⟺  T commutes with the antipodal map
```

Standard face rotations have C(T) > 0: they do not commute with antipodal identification (rotating the front face moves pieces that are identified with back-face pieces). Flips have C(T) = 0 by construction: they act symmetrically on antipodal pairs. This is why flips feel "cleaner" topologically even though they introduce the projective twist.

The **Antipodal Integrity Metric** measures how well the current cube state maintains its RP² quotient structure:

```
I(T) = (number of antipodal pairs preserved) / 27
```

A fully solved cube has I(T) = 1. A random scramble drives I(T) toward 1/27 ≈ 0.037. Analysis suggests a critical threshold near:

```
k* ≈ 0.721
```

Below k*, the cube state is dominated by manifold structure. Above it, entropy dominates and standard solving heuristics degrade rapidly. This threshold is analogous to phase transitions in statistical mechanics and is one of the reasons Levels 9 and 10 feel qualitatively harder than a mere increase in cube size would explain.

---

## Pedagogy: How the Game Teaches the Topology

WORM-3 is not a mathematics lesson with a game bolted on. It is designed so that playing the game *is* learning the topology, through mechanics that directly enact the mathematical concepts rather than illustrating them from the outside.

### Mechanic → Concept Map

| Mechanic | What It Does in Game | What It Teaches |
|----------|---------------------|-----------------|
| **Slice rotation** (WASD / drag) | Rotates a row, column, or depth slice | Group action on the cube; composing moves is composing permutations |
| **Antipodal flip** (F key / click) | Flips a sticker and its antipodal partner simultaneously | The quotient map q: S² → RP²; two points identified as one |
| **Wormhole tunnels** (T key) | Draws Bézier curves connecting antipodal sticker pairs through the cube interior | Visual representation of the identification; topology as geometry |
| **Explode view** (X key) | Separates cubies; shows all wormhole connections at once | The full identification diagram; seeing the manifold structure globally |
| **Net view** (N key) | Unfolds cube into 2D with antipodal edges annotated | The polygon representation of RP²; how gluing instructions encode topology |
| **Parity indicator** | Cyan (even) or purple (odd) glow on the cube | π₁(RP²) = Z₂; the non-trivial loop class as a solvable invariant |
| **Chaos propagation** | Flips cascade along manifold neighbors (not Euclidean neighbors) | Dynamics on the manifold; why manifold distance ≠ Euclidean distance |
| **Sudokube mode** | Each face must form a Latin square simultaneously with color matching | Constraint satisfaction on a non-orientable surface; independent algebraic structures |
| **WORM surface mode** | A worm crawls across face boundaries with direction remapping | Parallel transport on a surface; how vectors transform when crossing identifications |
| **WORM tunnel mode** | A worm travels through antipodal wormhole tunnels | Physically traversing the quotient map; experiencing the identification from inside |

Each mechanic is introduced at the moment the player has sufficient context to connect it to the previous concept. This is not arbitrary sequencing — it mirrors the mathematical progression from "what is a rotation?" to "what is a quotient space?" to "what is a non-trivial fundamental group element?" to "what does solving on a non-orientable surface actually require?"

### Level Progression as a Topology Curriculum

The 10-level campaign is structured as an explicit topology curriculum. Each level introduces exactly one new concept, in an order that mirrors how mathematicians build intuition about RP². The 3D environments — each set in a stage of human life, from a daycare to a black hole — serve as mnemonic anchors: the chaos of a high school cafeteria corresponds to chaos mode; the lunar surface corresponds to seeing Earth from outside (a net view of the sphere); the singularity corresponds to the total collapse of structure.

| Level | Name | New Concept | Mathematical Content | Win Condition |
|-------|------|-------------|----------------------|---------------|
| 1 | Baby Cube | Slice rotations | Group action: each rotation is a permutation; compose moves to compose permutations | Classic |
| 2 | Twin Paradox | Wormhole tunnels | Antipodal identification is visible; opposite faces are geometrically connected | Classic |
| 3 | Flip Gateway | Antipodal flip | The quotient map made interactive; flipping enacts q: S² → RP² | Classic |
| 4 | Chaos Ripple | Chaos propagation | Dynamics follow manifold topology, not Euclidean proximity | Classic |
| 5 | Parity Gate | Parity indicators | π₁(RP²) = Z₂; topological parity as a solvable invariant | Classic |
| 6 | Manifold Axes | Explode + net views | The full identification diagram; polygon representation of RP² | Classic |
| 7 | Sudokube Veil | Sudokube mode | Independent constraint structures on a non-orientable surface | Sudokube |
| 8 | Ultimate Seam | Ultimate mode | Simultaneous color + Latin square constraints; maximally constrained solving on RP² | Ultimate |
| 9 | Quotient Collapse | 5×5 + full RP² | Scale reveals why k* ≈ 0.721 matters; entropy-dominated regime | Ultimate |
| 10 | Black Hole | Everything maximum | The solver must fully integrate all topological knowledge | Ultimate |

**Level 1** begins on a 2×2 cube — small enough that the group of rotations is manageable and the learner can feel that moves compose. The daycare environment with its rotation-axis mobile (X=Red, Y=Green, Z=Blue) makes the three rotation axes visible as physical objects hanging from the ceiling.

**Level 2** introduces wormhole tunnels (press T) without introducing flips. The learner can see the antipodal connections without yet being asked to manipulate them. The "Twin Paradox" name is deliberate: the two ends of each wormhole are the same point seen from two directions, an analogy to twin-paradox time dilation where two perspectives on the same event produce different experiences. Understanding before doing.

**Level 3** introduces the flip mechanic. Now the learner can actively traverse the identification. The middle school hallway environment — a passage space, a place of transition between learning contexts — carries the metaphor: you are crossing from one way of thinking about the cube to another.

**Level 5** is where the topology becomes unavoidable. The parity gate requires the solver to recognize whether the cube is in a topologically even or odd state before selecting an algorithm. A solver who ignores parity will reach a configuration that looks almost solved but has one projective twist remaining — a deeply frustrating experience that makes the topology viscerally real.

**Level 9** introduces Net View on a 5×5 cube. At this size, the full RP² polygon diagram becomes meaningful: 25 stickers per face, fully annotated antipodal connections, a 2D representation of the identification space. This is the moment the game asks the learner to see the manifold as a mathematician would — not from inside the cube, but as a diagram of the space itself.

**Level 10** offers no new mechanics. It is a synthesis. The solver must apply everything learned — antipodal constraints, parity management, chaos navigation, dual constraint satisfaction — on the hardest possible configuration. The GLSL black hole environment, with its procedural gravitational lensing and accretion disk responding to flip events, is a visual metaphor for the total breakdown of Euclidean intuition: space itself bends, orientation reverses, structure collapses.

---

## Gameplay

### Core Mechanics

#### Slice Rotations

Drag on the cube or use WASD to rotate a row, column, or depth slice by 90°. Supports cubes from 2×2 to 5×5. On release, the rotation snaps to the nearest 90° with a GSAP animation (0.15s, back.out easing).

Each rotation is a permutation of the sticker positions. Composing rotations is composing permutations. The manifold identification means that rotating a slice also implicitly affects which stickers are in antipodal correspondence — the map between antipodal pairs updates with each rotation.

#### Antipodal Flips

Press F or click a sticker (in flip mode) to flip it and its antipodal partner simultaneously. This is the game's central mechanic: the direct implementation of the quotient map. The flip:

1. Exchanges the color of the selected sticker with its antipodal partner.
2. Reverses the orientation of the antipodal pair (because the identification reverses local orientation).
3. Increments the flip counter for both stickers (used by chaos mode).
4. Changes the topological parity of the cube state if this is the (2n+1)th flip along the non-trivial loop.

Flips have a 7-second refractory period per sticker to prevent degenerate rapid toggling.

#### Wormhole Tunnels

Toggle with T. Draws Bézier curves through the cube interior connecting each antipodal sticker pair. The curves use smart routing to avoid intersecting the cube geometry itself, making the network of identifications legible. In Explode View, the full network is exposed simultaneously.

#### Explode View

Toggle with X. Separates all cubies from each other, revealing the internal structure and the wormhole network in its entirety. Each sticker's connection to its antipodal partner becomes visible as a curve through the space between cubies.

#### Net View

Toggle with N. Unfolds the cube into a 2D flat projection with antipodal edge annotations. This is the standard mathematical representation: a polygon whose edges carry identification arrows. The six faces are laid flat; antipodal pairs are annotated. This is how a mathematician would draw RP² as a cell complex.

### Solving Modes

#### Classic

Solve for uniform color on each face. The antipodal constraint is unavoidable: the Red and Orange faces are identified, so you cannot solve Red independently of Orange. Every algorithm must account for the ripple effect across the manifold.

#### Sudokube

Each face must form a valid Latin square: every digit from 1 to N (where N = size²) appears exactly once in each row and column. This imposes an independent algebraic structure on top of the topological one. The Latin square constraint is permutation-group-theoretic; the manifold constraint is topological; they interact through the shared sticker positions.

#### Ultimate

Both Classic and Sudokube conditions must be satisfied simultaneously. This is a genuine constraint satisfaction problem on a non-orientable surface: find a configuration that is simultaneously a valid coloring, a valid arrangement of Latin squares, and consistent with antipodal identification. The hardest mode in the game and the mathematical endpoint of the curriculum.

#### Hands Mode (Speedcube Notation)

Maps keyboard keys to standard Rubik's notation (U, R, F, L, D, B and their inverses). Supports double moves (U2), combo detection (Sexy Move: R U R' U', Sune: R U R' U R U2 R', T-Perm: R U R' U' R' F R2 U' R' U' R U R' F'), and TPS (turns per second) tracking with a rolling 5-second window.

### Chaos Mode

Toggle with C. Introduces probabilistic flip cascades along manifold paths.

When a sticker is flipped, its per-sticker tally increments. When the tally exceeds a threshold, the flip propagates to manifold neighbors — stickers that are topologically adjacent across the manifold, not necessarily Euclidean neighbors — with probability determined by the chaos level. The propagation continues as a chain, subject to a decay function.

The key insight: chaos propagates along the manifold, not along Euclidean proximity. A sticker on the front face may cascade to its manifold neighbor on the bottom face before cascading to the adjacent sticker directly beside it on the front face. This makes the chaos mechanic a direct lesson in why manifold geometry matters: "neighbor" depends on the space you are in.

| Chaos Level | Propagation Speed | Chain Probability | Decay Rate | Auto-Rotate |
|-------------|-------------------|-------------------|------------|-------------|
| 1 | Slow | Low | High | No |
| 2 | Moderate | Increased | Medium | No |
| 3 | Fast | High | Low | No |
| 4 | Maximum | Very High | Minimal | Yes (disparity-driven) |

At Level 4, the cube auto-rotates based on the current scramble disparity — the more disordered the cube, the more frequently it rotates itself. This creates a feedback loop: the more you let chaos propagate, the more unstable the cube becomes.

### Teaching Mode (CFOP Assistant)

An interactive solving guide built on the CFOP method (Cross, F2L, OLL, PLL), adapted for the projective surface. It tracks the current state of the solve, highlights relevant stickers for the active stage, and provides algorithm suggestions.

**Stages**:
1. **White Cross** — Place white-face edges with correct adjacent colors
2. **White Corners** — Insert white corners using R' D' R D
3. **Middle Layer Edges** — Complete the F2L pairs
4. **Yellow Cross** — Orient the yellow face edges
5. **OLL** — Orient the last layer
6. **PLL** — Permute the last layer

**Three sub-modes**:
- **Guided**: Suggests the next algorithm; the player executes it
- **Demo**: Auto-solves with pauses for observation
- **Quiz**: Multiple-choice algorithm selection with topology-aware hints

Each algorithm in the library includes a **topology tip** explaining how it interacts with the RP² structure. For example: "F2 traces a closed loop on the projective plane. Because F2 passes through the antipodal identification twice, its parity contribution is even — this is why it is safe to use as a setup move without altering topological parity."

### WORM Mode: Crawling the Manifold

An alternative gameplay mode where a "worm" creature navigates the cube, turning abstract manifold connectivity into a physical experience of locomotion.

#### Surface Mode

The worm crawls across the cube surface. At face boundaries, the direction is automatically remapped according to the adjacency graph — the worm crosses from one face to its neighbor without any explicit decision by the player. This enacts **parallel transport** on the surface: a vector (the worm's direction of travel) is carried along a path on the manifold, and the direction transforms when crossing face junctions.

If the worm crosses through an antipodal identification (rather than a regular edge), its orientation is reversed on arrival. This is the non-orientability made locomotive: you can watch the worm return to its starting position facing the opposite direction after a projective loop.

#### Tunnel Mode

The worm travels through the wormhole tunnels — the Bézier curves through the cube interior connecting antipodal pairs. It enters at one end of a tunnel and exits at the antipodal partner, demonstrating that the two endpoints are literally the same point on RP². Orbs spawn at tunnel midpoints. The worm can chain tunnels, tracing paths through the identification space.

This mode makes the quotient map physically traversable. You do not just see that the two ends are identified. You travel through the identification.

**Scoring**:
```
Score = (worm length × 100) + (orbs eaten × 50) + (warps used × 25)
```

---

## Controls

### Keyboard

| Action | Key | Description |
|--------|-----|-------------|
| Move cursor | Arrow keys | Navigate between stickers (wraps across faces) |
| Rotate slice up | W | Rotate the column slice upward |
| Rotate slice down | S | Rotate the column slice downward |
| Rotate slice left | A | Rotate the row slice leftward |
| Rotate slice right | D | Rotate the row slice rightward |
| Rotate face CCW | Q | Counter-clockwise face rotation |
| Rotate face CW | E | Clockwise face rotation |
| Flip sticker | F | Flip sticker at cursor and its antipodal partner |
| Toggle tunnels | T | Show/hide wormhole identification curves |
| Toggle flip mode | G | Enable/disable click-to-flip |
| Toggle chaos | C | Activate manifold cascade propagation |
| Toggle explode | X | Separate cubies to reveal internal structure |
| Toggle net view | N | Show unfolded RP² polygon diagram |
| Cycle visual mode | V | Classic → Grid → Sudokube → Wireframe |
| Undo | Ctrl+Z | Reverse last move (max 10 history) |
| Show help | H or ? | Controls reference overlay |
| Escape | Esc | Close menus, hide cursor |

### Mouse

- **Left-drag on cube**: Rotate the corresponding slice
- **Shift + drag on cube**: Twist the face (rotate around face normal)
- **Left-click sticker (flip mode active)**: Flip sticker and its antipodal partner
- **Drag on empty space**: Orbit camera
- **Scroll**: Zoom in/out

### Touch (Mobile)

- **Swipe on cube**: Rotate slices
- **Tap sticker**: Flip (when flip mode active)
- **Pinch**: Zoom
- **Two-finger rotate**: Orbit camera
- **Bottom toolbar**: Access all toggle functions

### Hands Mode (Speedcube Notation)

| Key | Move | Key | Move |
|-----|------|-----|------|
| I | U | K | U' |
| J | R | L | R' |
| F | L | D | L' |
| H | F | G | F' |

---

## Visual Modes and Tile Styles

### Visual Modes

- **Classic**: Standard solid-color stickers
- **Grid**: Numbered grid overlay showing position indices (useful for understanding the manifold map)
- **Sudokube**: Large centered numbers for Latin square solving
- **Wireframe**: Minimalist edge-only rendering with emissive glow

### Tile Styles (13 per-face customizable)

Each of the six manifold faces can independently use a different material. All implemented as custom GLSL shader materials:

| Style | Type | Description |
|-------|------|-------------|
| Solid | Static | Flat color fill |
| Glossy | Static | Specular highlights |
| Matte | Static | Soft diffuse shading |
| Metallic | Static | Brushed metal with anisotropic highlights |
| Carbon Fiber | Static | Woven pattern |
| Hex Grid | Static | Honeycomb pattern |
| Glass | Static | Transparent with Fresnel glow |
| Comic | Static | Halftone dots and bold outlines |
| Circuit | Animated | Tech traces with traveling pulse signals |
| Holographic | Animated | View-dependent rainbow iridescence |
| Pulse | Animated | Radial brightness waves from sticker center |
| Lava | Animated | Molten flow via fractal Brownian motion noise |
| Galaxy | Animated | Stars and nebula field |

---

## Immersive Environments

### Level Backgrounds: The Life Journey

Each level's 3D environment is built from Three.js geometry (no image textures — pure code geometry) and serves as both atmosphere and metaphor.

**Level 1 — Daycare**: Warm afternoon sunlight streams through a window. A rotation-axis mobile hangs from the ceiling with colored arrows labeling the three Cartesian rotation axes (X=Red, Y=Green, Z=Blue). The floor uses a cube-net pattern in all six face colors. A shape-sorter toy and scattered crayons complete the scene. *The rotation axes are made physical and named before any mathematics is spoken.*

**Level 2 — Elementary Classroom**: A chalkboard reads "Welcome to Miss Cole's Class." Desks in rows, gold stars floating overhead, an alphabet banner. *Learning to read the symbols before reading the map.*

**Level 3 — Middle School Hallway**: Blue lockers, linoleum, fluorescent lights, floating notebook pages. *A corridor — a topology of passages and transitions. The flip mechanic is about crossing from one place to another.*

**Level 4 — High School Cafeteria**: Chaotic mood lighting, multi-colored point lights, vending machines, crowded tables. *Chaos is the environment before it is the mechanic.*

**Level 5 — College Dorm**: A desk lamp in darkness, a laptop glow, moonlight, bookshelves. *Late-night mathematics: sitting with parity until you understand it.*

**Level 6 — Office**: A cubicle farm with 12 workstations, grid lighting, floating bar charts. *Structured space that reveals structure in the cube. The explode view makes the internal geometry of the manifold visible for the first time.*

**Level 7 — NASA Mission Control**: A 30-meter display wall, tiered control consoles with cyan emissive glow, data streams cascading through the air. *The Sudokube constraint is a control problem: managing independent systems simultaneously.*

**Level 8 — Launch Pad**: A rocket on concrete under 200 stars, a red launch tower, engine flame cones. *The moment before the ultimate challenge. Both constraints are active. There is no undoing the launch.*

**Level 9 — Lunar Surface**: Gray terrain, 500 stars, Earth hanging in the black sky, 20 craters, a lunar module with footprints. *From the Moon, you can see the whole Earth — a sphere, viewed from outside, with its antipodal structure comprehensible from this altitude. The Net View gives you the same perspective on the cube.*

**Level 10 — Black Hole**: A custom GLSL shader environment featuring procedural gravitational lensing, an accretion disk with flowing temperature bands, a photon sphere ring, and Hawking radiation glow. The environment pulses in response to flip operations. *Orientation does not exist here. The topology completes its argument.*

### Free Play Backgrounds

Interactive HDR photographic panoramas (actual photographs, not shaders) that wrap the scene in 360°. Orbiting the camera rotates the panorama. Also provides image-based lighting so cube reflections match the environment. Options: Sunset, Forest, Sunrise, Park, Night Sky, City Skyline, Apartment, Modern Lobby, Warehouse, Photo Studio, Dark, Midnight Blue, and the Black Hole procedural shader.

---

## Settings and Customization

All settings persist to localStorage. Accessible via the gear icon.

### Color Schemes

| Scheme | Description |
|--------|-------------|
| Standard | Classic Rubik's colors (Red, Green, White, Orange, Blue, Yellow) |
| Neon | Bright fluorescent variants |
| Pastel | Soft muted tones |
| Mono | Grayscale with subtle differentiation |
| Custom | User-defined colors per face |

**Extract from Image**: Upload any photograph and k-means clustering (10 iterations) extracts 6 dominant colors, sorted by hue and assigned to cube faces automatically.

### Face Textures

Upload images to map onto individual cube faces as Three.js textures.

### Per-Face Tile Styles

Each of the six manifold faces can use a different style from the 13 options. Antipodal pairs can be given contrasting styles to make the identification visually prominent — seeing that the Galaxy face and the Lava face are "the same face" is a useful cognitive jolt.

### UI Toggles

- **Stats Bar**: Move counter, timer, entropy percentage
- **Manifold Footer**: Manifold state information panel
- **Face Progress Bars**: Per-face solve completion indicators

---

## Technical Architecture

### Stack

| Technology | Version | Role |
|------------|---------|------|
| React | 18.2 | UI framework |
| Three.js | 0.159 | 3D rendering |
| @react-three/fiber | 8.15 | React renderer for Three.js |
| @react-three/drei | 9.93 | Camera, environment maps, text, shadows |
| Zustand | 5.0 | State management |
| GSAP | 3.14 | Animation timelines |
| Vite | 5.4 | Dev server and bundler |
| Vitest | 4.0 | Test framework |

### Source Structure

```
src/
├── game/                    # Pure game logic (no React dependencies)
│   ├── cubeState.js         # Cubie generation, deep cloning
│   ├── cubeRotation.js      # 90° rotations and sticker remapping
│   ├── manifoldLogic.js     # RP² antipodal identification and flip logic
│   ├── antipodalMode.js     # Antipodal echo operations
│   ├── winDetection.js      # Victory conditions (Classic, Sudokube, Ultimate, WORM)
│   ├── solveDetection.js    # CFOP stage tracking (460 lines)
│   ├── coordinates.js       # Grid positioning and world-space conversion
│   ├── cubeUtils.js         # Edge detection and sticker iteration
│   ├── handsInput.js        # Speedcube notation parsing and combo detection
│   ├── antipodalIntegrity.js # I(T) metric computation
│   └── refractoryMap.js     # Per-sticker flip cooldowns
│
├── hooks/                   # Custom React hooks
│   ├── useGameStore.js      # Central Zustand store (340 lines)
│   ├── useCubeState.js      # Rotate, flip, shuffle operations
│   ├── useAnimation.js      # Rotation animation with GSAP snap
│   ├── useGameSession.js    # Timer and win detection loop
│   ├── useChaosMode.js      # Cascade propagation engine
│   ├── useCursor.js         # Keyboard navigation with face wrapping
│   ├── useKeyboardControls.js
│   ├── useLevelSystem.js    # Level progression and feature gating
│   ├── useSettings.js       # Preferences and texture loading
│   ├── useHandsMode.js      # Speedcube control and TPS tracking
│   └── useUndo.js           # Move reversal (max 10)
│
├── 3d/                      # Three.js components
│   ├── CubeAssembly.jsx     # Main cube with drag interactions
│   ├── Cubie.jsx            # Individual pieces (RoundedBox)
│   ├── StickerPlane.jsx     # Clickable sticker surfaces
│   ├── TileStyleMaterials.jsx # 13 custom GLSL shader materials
│   ├── BlackHoleEnvironment.jsx # GLSL black hole shader
│   ├── BackgroundEnvironments.jsx # Procedural shader backgrounds
│   └── LifeJourneyBackgrounds.jsx # 10 handcrafted 3D scenes
│
├── levels/
│   ├── schema.js            # Level schema and BACKGROUNDS enum
│   └── data/                # 10 level definition files
│
├── manifold/
│   └── smartRouting.js      # Bézier curve routing for wormhole tunnels
│
├── worm/
│   ├── WormGame.jsx         # Surface and tunnel worm logic
│   └── WormCamera.jsx       # Worm-following camera
│
├── teach/                   # CFOP teaching system
└── utils/
    ├── constants.js         # Face/color/direction mappings
    ├── colorSchemes.js      # Color schemes and tile style defaults
    └── audio.js             # Audio pooling (4 instances per sound)
```

### Key Algorithms

**Antipodal Mapping — O(1)**: Each sticker is assigned a manifold grid ID (`M{faceId}-{paddedIndex}`). The manifold map provides instant access to any sticker's antipodal partner. Antipodal face pairs: 1↔4, 2↔5, 3↔6.

**Slice Rotation**: `rotateSliceCubies()` computes new 3D positions for all cubies in a slice via 90° vector rotation, then remaps sticker direction keys to maintain correct face assignments after the rotation. Handles the coupling between position and orientation that makes Rubik's group theory non-trivial.

**Drag-to-Rotate**: Custom pointer handler (not OrbitControls). Drag threshold: 5px mouse / 8px touch. `mapSwipe()` projects the drag vector onto the face plane, crosses it with the face normal to determine the rotation axis, applies real-time rotation during drag, then GSAP-snaps to nearest 90° on release (0.15s, back.out easing).

**Chaos Propagation**: Per-sticker tally system. Propagation probability = `tally × chaos_level_factor`. Cascades along manifold neighbors (not Euclidean), making topological adjacency the governing structure for instability.

**Win Detection**: `checkRubiksSolved()` — O(n³) uniform color verification. `checkSudokubeSolved()` — O(n³) Latin square validation (no row/column repeats per face). Ultimate mode runs both. Short-circuit evaluation for performance.

**CFOP Solver** (460 lines): Tracks white cross edges, F2L corner-edge pairs, OLL orientation, PLL permutation. Provides algorithm suggestions and topology-aware hints for each stage.

**Wormhole Routing**: Bézier curves connecting antipodal sticker pairs through the interior. Smart routing pushes control points perpendicular to the main axis to avoid intersecting the cube geometry.

### State Management

Single Zustand store (`useGameStore.js`, 340 lines) with `subscribeWithSelector` for efficient component updates. Manages: cube state, game session (moves, timer, undo history), visual modes, chaos state, animation queue, UI state, level system, hands mode, and settings.

---

## Getting Started

```bash
git clone https://github.com/MacMayo1993/WORM-3.git
cd WORM-3
npm install --legacy-peer-deps
npm run dev
```

The dev server starts on port 5173.

```bash
npm run build      # Production build to dist/
npm run preview    # Preview production build
npm run test       # Run test suite (Vitest)
npm run lint       # ESLint check
npm run ci         # Full pipeline: lint → test → build
```

---

## License

MIT License

---

## Author

**Mac Mayo**
macmayo@mayomanifoldresearch.org
https://mayomanifoldresearch.org

---

*WORM-3 exists to make non-orientable geometry tangible and playable. The real projective plane is not an abstraction you learn about. It is a place you go.*

---

## Active Development Focus — Biome Mode Visual Polish

**Current sprint: elevating the visual quality of city tiles on the Manifold Biome faces.**

Each face of the cube in Biome Mode renders a living 3D city in miniature — a procedurally generated settlement scaled to fit within a 0.85×0.85 unit sticker tile. The six cities are:

| Face | Color | City | Antipodal Partner |
|------|-------|------|-------------------|
| PZ (Front) | Red | Volcanic Foundry | Solar Arcology |
| NX (Left) | Green | Bio-Dome | Neural Hub |
| PY (Top) | White | Frozen Citadel | Deep Station |
| NZ (Back) | Orange | Solar Arcology | Volcanic Foundry |
| PX (Right) | Blue | Neural Hub | Bio-Dome |
| NY (Bottom) | Yellow | Deep Station | Frozen Citadel |

Cities are rendered as pure Three.js geometry (no textures) using `InstancedMesh` for performance and `MeshPhysicalMaterial` / `MeshStandardMaterial` with emissive accents. Ground planes are canvas-baked `CanvasTexture` singletons. On every flip the tile transitions to its antipodal city — the parity of `meta.flips % 2` governs which city is currently shown.

### Work in Progress

**Frozen Citadel (white face / top)** — primary focus.

The Citadel uses a Swiss Modernism × Arctic precision design language: one dominant hexagonal obelisk, stepped cap with 30° crystal twist, glow pinnacle, satellite shard cluster, ice-shelf ground anchor, and frost-ring base detail. Materials use `MeshPhysicalMaterial` with `clearcoat: 1.0`, `flatShading: true`, and faint blue emissive to read as faceted crystal glass.

Upcoming improvements:
- Animated `useFrame` crystal pulse — slow emissive intensity oscillation on the glow pinnacle
- Shard lean variation — outer shards tilt more aggressively inward for a tighter formation silhouette
- Frost ring enhancement — double-ring (inner + outer) for more precision-engineering character
- Material refinement — increase clearcoat roughness differential between obelisk body and glow tip
- Depth layering — ensure obelisk renders above shelf with correct Z-offset ordering

**Queued (after Citadel)**:
- Solar Arcology — animated dish rotation, focal-point pulse, panel energy feed
- Volcanic Foundry — lava pool ripple, smoke column shimmer
- Bio-Dome — canopy arch glow pulse, spiral tower twist animation
- Neural Hub — bridge data-packet travel animation, antenna tip flicker
- Deep Station — hab-ring orbital rotation, dome pressure shimmer
