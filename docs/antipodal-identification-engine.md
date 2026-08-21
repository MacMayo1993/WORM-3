# The Antipodal Identification Engine

*A technical note on the reusable kernel underneath WORM-3's antipodal solver.*

**Status:** rev 2 — claims scoped after external review. The companion visual
version is an Artifact; this file is the in-repo source of record.

**Source of record:**
`src/game/antipodalEngine.js` · `src/game/manifoldLogic.js` ·
`src/game/gridIds.js` · `src/hooks/useAntipodalEngine.js`
**Prior art in-repo:** `docs/worm3-monograph.md`, `docs/antipodal-solving.md`

---

## Abstract

WORM-3 is a Rubik's-cube puzzle whose solve rests on a kernel of pure
functions. Abstracted, the kernel is a triple `(X, τ, b)`: a finite set, a
fixed-point-free involution `τ` pairing each element with a partner, and a
binary state `b`. Over each pair sits a parity `Δ = b(x) ⊕ b(τx)`, conserved by
the moves that touch both members of a pair together, so `Δ` labels the
dynamically accessible sector. Two exact results follow: the minimum number of
sector-changing repairs is `wt(Δ)`, and completing to the solved coset of
`Z₂ᴾ/⟨1⟩` costs `min(k, P−k)` further flips. Both are proved in a few lines and
need no geometry.

The real projective plane enters only as a *realization*: gluing the cube
surface by `x ~ −x` gives RP². §7 resolves precisely which homological object
the engine is — it is **not** a Kitaev surface code, but it **is** the mod-2
fundamental class of RP² together with the equivariant-descent structure of the
double cover `S² → RP²`. The transfers in §5 are labelled by how tight each
correspondence really is.

---

## 1. What the engine does, in the game

A WORM-3 cube is not solved when its faces are one colour each. It is solved
when every sticker sits in its home *cell* up to the identification
`Red↔Orange, Green↔Blue, White↔Yellow` — the three antipodal colour pairs. A
"wormhole flip" recolours a sticker to its antipode *and* recolours the sticker
on the opposite side of the cube at the same time; it moves no piece. The engine
answers two questions exactly, and without searching move sequences: **is this
cube solved under antipodal identification**, and **what is the cheapest
repair**. Everything is derived algebraically from a single position-independent
labelling — which is what makes the kernel portable.

## 2. The mechanism, in four moves

Four pure modules compose into the whole thing. None mounts a piece, searches,
or touches React; each is a function of the board.

1. **A canonical identity that survives motion.** Every sticker gets a label
   derived from where it was *born* and which way it originally faced — never
   its live coordinates. Rotating a slice moves the sticker through space, but
   its label `M1-001` is unchanged, because it is a function of intrinsic
   origin. This is invariance under the group action, *not* content hashing: the
   label is fixed while the content (current colour) changes freely.
   — `gridIds.js · getManifoldGridId()`

2. **A free involution → the pairing.** Each label maps to a partner: same cell
   index on the antipodal colour, `M(antipode)-(same index)`. This is a
   fixed-point-free involution `τ` (`τ² = id`, no element its own partner).
   Realized geometrically it is the antipodal map, and gluing by it turns the
   sphere into RP²; the decoder below never uses that geometry, only the
   pairing. — `manifoldLogic.js · findAntipodalStickerByGrid()`

3. **A bit, and a parity that labels the sector.** Over each element sits one
   bit: *clean* if it shows its home colour, *dirty* if it shows its antipode.
   Per pair, `Δ = dirty(a) ⊕ dirty(b)`. Every operation in the *legal move
   group* — face turns and paired flips — adds the same bit to both members, so
   it leaves `Δ` unchanged. — `antipodalEngine.js · deltaInvariant()`

4. **A repair class, and a minimum-cost planner.** A *heal* acts on one member
   alone — deliberately outside the legal group — so it changes exactly one `Δᵢ`
   and moves the board to an adjacent sector. Once every pair is symmetric, the
   solved states form a two-element coset under the global flip `γ`, and
   completion costs `min(k, P−k)` flips. — `antipodalEngine.js ·
   planQuotientCompletion()`

### 2.1 Two move classes (reconciling "conserved" with "repaired")

An apparent contradiction in the first draft — `Δ` is called both *conserved*
and *repaired* — dissolves once two move classes are separated:

- The **legal group `G`** (face turns + paired flips) conserves `Δ`.
- The **repair operation** (single-member heal) lives *outside* `G`; each
  application changes exactly one `Δᵢ` at unit cost.

So `Δ` is invariant under the dynamics and simultaneously the exact budget of
interventions the dynamics cannot avoid. No contradiction — the two verbs
attach to different move classes.

## 3. The machine, proved without the game

Delete "sticker", "colour", "cube". Let `X = {1, …, 2P}` carry a
fixed-point-free involution `τ` (`τ² = id`, no fixed points), giving `P` orbits
`Oᵢ = {xᵢ, τxᵢ}`. Attach `b : X → Z₂` and define, per orbit,
`Δᵢ = b(xᵢ) ⊕ b(τxᵢ)`. Three results follow directly.

**Theorem 1 (Sector invariance).** Any operation that adds the same bit `cᵢ` to
both members of orbit `i` leaves `Δ` fixed.

```
b′(xᵢ)   = b(xᵢ)  + cᵢ
b′(τxᵢ)  = b(τxᵢ) + cᵢ
Δ′ᵢ = (b(xᵢ)+cᵢ) ⊕ (b(τxᵢ)+cᵢ) = b(xᵢ) ⊕ b(τxᵢ) = Δᵢ      (2cᵢ ≡ 0)
∴  Δ′ = Δ
```

**Theorem 2 (Minimum sector repair).** A single-member operation changes at most
one `Δᵢ`. Hence clearing `Δ` costs at least `wt(Δ)`; if each asymmetric orbit is
independently repairable, that bound is met.

```
each asymmetric orbit needs ≥ 1 single-member fix   ⇒  C_heal ≥ wt(Δ)
orbits independent ⇒ one fix per asymmetric orbit attains it
∴  C_heal = wt(Δ)
```

**Theorem 3 (Quotient completion).** With all orbits symmetric, encode each by
one bit `q ∈ Z₂ᴾ`. If solved states are identified under global complementation
`q ~ q + 1`, the distance to the solved coset is `min(k, P−k)`, where
`k = wt(q)`.

```
d([q],[0]) = min( wt(q), wt(q + 1) )
wt(q + 1)  = P − wt(q)
∴  d = min(k, P − k)
```

That is the whole decoder: **nearest-coset decoding of `Z₂ᴾ / ⟨1⟩`** — the
bit-vector space modulo the all-ones (global-flip) vector. It is a genuine
coding-theoretic optimum, closed-form, and needs no analogy to verify. RP² is a
realization of `(X, τ, b)`, and a legitimate one — but the theorems hold for
*any* free involution on a finite set.

### 3.1 On the numbers

The `⌊27/2⌋ = 13` figure bounds the **completion stage only** for a 3×3
(`P = 27`) — the maximum flips once the board is already symmetric. It is **not**
a bound on total repair: total cost is `wt(Δ) + min(k, P−k)`, and the
mandatory-heal term is additional.

## 4. Linear-algebra picture (setup for §7)

Everything is linear over Z₂. With the `2P` stickers indexed by `X`:

- The residual state is `b ∈ Z₂^{2P}`.
- The native flip group is `F = span{ e_x + e_{τx} : orbits }`. Each generator is
  τ-symmetric, and the `P` generators are independent, so `F` is exactly the
  **τ-symmetric subspace** `S = { b : b(x) = b(τx) ∀ orbits }`, `dim S = P`.
- `Δ : Z₂^{2P} → Z₂^P` is the quotient map by `S`: `Δ(b) = 0 ⟺ b ∈ S`. So `Δ` is
  the coset label of the flip subspace — which is why `F ⊆ ker Δ` (Theorem 1 is
  this fact).
- The reachable set from `b` under flips is the coset `b + S`.

## 5. Where the machine works outside the game

Tagged by how tight the correspondence is: **Structural** (same object) /
**Direct reuse** (code ports with renaming) / **Strong analogy** (genuinely
coding-theoretic flavour, full correspondence not yet constructed) /
**Suggestive** (pattern rhymes, worth borrowing).

- **The exact coset decoder itself — Structural.** The strongest result is the
  object of §3: nearest-coset decoding of `Z₂ᴾ/⟨1⟩` in closed form. Anywhere
  states come in exclusive complementary pairs and "solved" is defined up to a
  global flip, `min(k, P−k)` is the exact optimum. This is the portable core;
  everything below is a realization or analogy of it.

- **Axis- and direction-valued data (data on RP²) — Structural.** A line through
  the origin in ℝ³ *is* a point of RP², so unsigned directions `v ~ −v` live
  there by definition, not metaphor: nematic liquid-crystal directors,
  diffusion-tensor principal directions (averaged as vectors they cancel; on RP²
  they do not), Friedel pairs `(h,k,l) ↔ (−h,−k,−l)` (modulo the standard
  anomalous/resonant-scattering caveat), orientation-up-to-sign and undirected
  camera rays in robotics/vision. **What transfers is the *identification layer*
  (steps 1–2)** — canonical label plus involution partner — not necessarily the
  parity decoder.

- **Persistent canonical identity under a group action — Structural.** Step 1
  alone is `ID(g·x) = ID(x)` for allowed motions `g` — *invariant identification
  under a symmetry*, not content addressing (`ID = H(content)` changes the
  address when content changes; here the address is fixed *while* content
  changes). The right neighbours are equivariant/canonical labelling and orbit
  canonicalization. `buildManifoldGridMapIncremental` rebuilds only cells whose
  reference changed — an ordinary incremental-index optimization. *(Withdrawn
  from rev 1: the "content-addressed storage" framing and the CRDT-convergence
  claim; CRDT convergence comes from algebraic merge properties, not from
  reference-diffed rebuilds.)*

- **Topological quantum error correction — Strong analogy.** See §7; the short
  version is that the resemblance is real and has a precise homological reason,
  but the engine is not literally a surface code.

- **Parity-preserving atomic edits & minimal reconciliation — Suggestive.**
  Every edit changes a conserved quantity in a matched pair, and the pair is the
  unit of undo (double-entry bookkeeping, charge-conserving steps, transactional
  invariants). The two-target planner rhymes with minimizing a diff by
  transforming whichever side is closer. `flipStickerPair` / `unflipStickerPair`
  (undo returns the cost it spent) are a template for invariant-safe edit APIs.

- **A tested non-orientable manifold, as a data structure — Direct reuse.**
  Seam-crossing neighbour resolution, antipodal wraparound, and one canonical
  coordinate convention shared across threads (the chaos worker and main thread
  must agree on the pairing or the two cubes silently desync — `gridIds.js`
  exists to prevent exactly that). Ports to procedural worlds with genuine
  wraparound topology, teaching tools for quotient geometry, and as a
  correctness oracle for anyone discretizing a non-orientable surface.

## 6. What does not transfer

- **The decoder is easy because corrections factor.** `min(k, P−k)` is exact
  precisely because the checks are diagonal per orbit; general surface codes
  face hard minimum-weight matching across coupled defects (see §7).
- **The "quantum" is only the classical, combinatorial skeleton**, and even that
  is analogy until the construction of §7.3 is carried out. No amplitudes,
  measurement, or noise model is claimed.
- **RP² is a realization, not the source of the theorems.** The results are
  properties of a free involution on a finite set.
- **A hard cap on repairs (the game's dying tiles) is game-specific.** It turns
  the clean involution lossy; drop it outside the game unless the domain has an
  analogous exhaustion limit.

## 7. The chain-complex question, resolved

The rev-1 draft claimed the engine was a "fully-tested instance of a surface
code" and equated `wt(Δ)` with minimum-weight matching. Both are wrong, and the
correction is more interesting than the overclaim.

### 7.1 What a surface code requires

A Kitaev / CSS surface code on a cellulation of a surface Σ is a chain complex
over Z₂,

```
C₂  ──∂₂──▶  C₁  ──∂₁──▶  C₀ ,      ∂₁∂₂ = 0,
```

with **qubits on 1-cells (edges)**, `Z`-checks from 2-cells (`∂₂`), `X`-checks
from 0-cells (`∂₁ᵀ`), and the logical qubit in `H₁(Σ; Z₂) = ker ∂₁ / im ∂₂`. An
error `e ∈ C₁` produces a syndrome `∂₁ e` supported on *separated* vertex
defects; the minimum-weight correction must join those defects with edge chains
— which is exactly why matching algorithms appear. The hardness lives in the
boundary operator coupling neighbouring cells.

### 7.2 What the engine actually is

The engine's bit lives on **2-cells, not edges**, and its check `Δ` is
**diagonal** — orbit `i`'s parity depends only on orbit `i`. There is no
boundary operator coupling orbits, so:

```
C(Δ) = Σᵢ C(Δᵢ)        (corrections factor; no matching problem ever arises)
```

That is why the decoder is closed-form and `wt(Δ) ≠` minimum-weight matching in
general. The engine is therefore a **Z₂ parity system on the 2-cells of an RP²
cellulation**, not a stabilizer code with a constructed cellulation.

Its global structure is genuinely homological, but in the **top** degree:

- The stickers are the 2-cells of the square tiling of the cube surface `≈ S²`.
  The free involution `τ` is the antipodal Z₂-action; `π : S² → RP²` is the
  orientation double cover, and the `P` orbits are the 2-cells of the induced
  cellulation of RP².
- `Δ(b) = 0 ⟺ b` is τ-invariant `⟺ b = π*(c)` for a 2-cochain `c` on RP². So
  **`Δ` is the obstruction to descending a cochain from the double cover** — the
  τ-anti-invariant component. The engine is an equivariant-descent computation.
- The global flip `γ` = all-ones on the `P` orbit-faces. On a closed surface
  `∂₂(Σ all faces) = 0 mod 2` (every edge borders exactly two faces), so `γ` is a
  2-cycle; with `C₃ = 0` it is not a boundary. Hence **`γ` generates
  `H₂(RP²; Z₂) ≅ Z₂` — the mod-2 fundamental class.**

### 7.3 The verdict

The "one logical bit" coincided with a surface code only because RP² satisfies
`H₁(RP²; Z₂) ≅ H₂(RP²; Z₂) ≅ Z₂` (mod-2 Poincaré duality). But the surface
code's qubit is in `H₁`; the **engine's invariant is in `H₂`**. They are
numerically equal and structurally different.

Two details sharpen this. First, the fundamental class is a genuinely *mod-2*
phenomenon: `H₂(RP²; Z) = 0`, so over the integers there is no such class at all
— matching the engine being a Z₂ theory. Second, if one *wanted* an honest
surface code on this substrate, the construction is different and concrete: move
the bits to **edges**, define star/plaquette checks from `∂₁, ∂₂`, and accept
the matching decoder that comes with the coupling. That is a real, separate
build — the legitimate "next step," not a claim to make now.

**Upgraded status:** the surface-code framing does *not* become structural. What
*does* hold structurally is the sharper, correct statement — the engine realizes
the **mod-2 top-homology / equivariant-descent structure of the double cover
`S² → RP²`**, with `γ` the fundamental class of `H₂(RP²; Z₂)`. That is a tighter
and more defensible identification than "surface code" ever was.

## 8. Porting: the general kernel

The reusable core is `(X, τ, b)`. Domain specifics enter through two callbacks;
the decoder is unchanged.

```
// domain supplies these two; τ must satisfy τ²=id, no fixed points
canonicalId(x)   → label, invariant under the symmetry action
antipode(label)  → the partner's label            // the free involution τ

// generic kernel, unchanged from antipodalEngine.js
enumeratePairs(X) → [{a, b, Δᵢ, kind}]
delta(X)          → { weight, support }            // Thm 1 — conserved sector label
planCompletion(X) → { heals: wt(Δ), flips: min(k, P−k) }   // Thm 2 + 3
```

`planQuotientCompletion` already never mentions colour or geometry — it consumes
the pair enumeration and returns the optimum. Swapping the two callbacks is the
whole port.

## 9. Thesis, stated conservatively

> A puzzle mechanic induced a generic Z₂-involution decoder with an exact
> closed-form optimum. Its geometric realization is RP², whose *top* mod-2
> homology `H₂(RP²; Z₂) ≅ Z₂` carries the engine's global invariant — which is
> why homological coding theory appears around it, and also why the engine is
> not a surface code (those live in `H₁`).

No "accidental quantum surface code" is claimed. The defensible core is
Theorems 1–3 — elementary, self-contained, and specific to this codebase. The
RP² realization and the axis-valued-data transfer are legitimate; the
surface-code resemblance is real, has a precise homological reason, and is
correctly re-attributed to `H₂` and equivariant descent in §7.

---

### Terms

- **`(X, τ, b)`** — a finite set, a fixed-point-free involution pairing its
  elements, a Z₂ state on each. The engine minus the game.
- **free involution** — `τ² = id` with no fixed points. The antipodal map is one
  realization.
- **`Δ`** — per orbit, `b(x) ⊕ b(τx)`. Conserved by the legal group; changed
  only by out-of-group single-member repairs. Its weight is the mandatory-repair
  count, and (§4) the quotient map by the flip subspace `S`.
- **`γ` / all-ones vector** — global complementation `q ↦ q + 1`; generates
  `Z₂ᴾ/⟨1⟩` (the solved coset) and, geometrically, `H₂(RP²; Z₂)`.
- **nearest-coset decoding** — correcting to the nearest representative of a
  quotient; here `min(k, P−k)`.
- **RP²** — `S²/(x ~ −x)`. Non-orientable; `H₁ ≅ H₂ ≅ Z₂` mod 2, but
  `H₂(RP²; Z) = 0`.

### External precedent

- M. Freedman & D. Meyer, *Projective plane and planar quantum codes*
  (arXiv:quant-ph/9810055) — RP² surface codes encoding one logical qubit in
  `H₁`. Cited to mark the resemblance and to make the `H₁`-vs-`H₂` distinction of
  §7 precise.
- IUCr, on Friedel's law and the inversion `(h,k,l) ↔ (−h,−k,−l)`.
