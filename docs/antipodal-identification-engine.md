# Symmetry-Induced Exact Decoding Under a Free Involution

*The Antipodal Identification Engine: an operation-metric decoder, its geometric
realization on RP², and its extension to a cubical cochain complex.*

**Status:** rev 3 — full paper, incorporating two rounds of external review.
The contribution is positioned per §24: not a new linear-code family, but the
*factorisation of the shortest-repair problem induced by a free involution and
an operation-derived metric*, together with the point at which that
factorisation begins to break (§18–§19).

**Source of record (implementation):** `src/game/antipodalEngine.js` ·
`src/game/manifoldLogic.js` · `src/game/gridIds.js` ·
`src/hooks/useAntipodalEngine.js`. **In-repo prior art:**
`docs/worm3-monograph.md`, `docs/antipodal-solving.md`.

---

## Abstract

A finite set equipped with a fixed-point-free involution and a binary state
induces a particularly simple decoding problem. Let `X` be finite of cardinality
`2P`, let `τ : X → X` satisfy `τ² = id` and `τ(x) ≠ x`, and let `b : X → F₂`
assign one bit to every element. The involution partitions `X` into `P`
two-element orbits `Oᵢ = {xᵢ, τxᵢ}`, and every orbit carries a parity defect
`Δᵢ = b(xᵢ) + b(τxᵢ) (mod 2)`.

Operations acting equally on both members of an orbit preserve `Δ`, while a
single-member edit changes exactly one coordinate. Hence `wt(Δ)` is the exact
distance, in single-member operations, from the current state to the subspace of
`τ`-invariant states. Once that symmetric sector is reached, each orbit is
represented by one bit `qᵢ`, and identification under global complementation
gives the length-`P` repetition code `⟨1⟩ = {0, 1}`. The distance from `q` to
`⟨1⟩` is `min(k, P−k)`, `k = wt(q)`. Both stages admit closed-form decoding; no
search tree, matching algorithm, or geometric computation is required.

From a classical coding-theory perspective the first stage is the direct sum of
`P` length-two repetition codes and the second is a length-`P` repetition code.
The distinctive feature is not a new linear-code family but the way a free
involution generates the factorisation automatically, together with an
operation-induced cost model and a clean separation between invariant-preserving
dynamics and sector-changing repairs.

The real projective plane supplies a geometric realisation: when `X` discretises
`S²` and `τ` is the antipodal deck transformation of `π : S² → RP²`, the
condition `Δ = 0` is that a binary cochain descend through the double cover.
Under a cellular-basis identification, the global-complement vector corresponds
to the mod-2 fundamental class of `RP²` in `H₂(RP²; F₂)` — distinct from the
`H₁`-based logical structure of projective-plane surface codes.

The paper develops the construction, states its exact assumptions, relates it to
classical coset decoding, repetition codes, operation metrics, topological
codes, and projective directional data, and then extends it. The central
extension (§18) replaces one involution by `r` commuting free involutions,
turning the disconnected two-point checks into a cubical cochain complex whose
square relations are `d² = 0`. This exposes *two* phase changes rather than one:
the `r = 1` coordinatewise factorisation gives way to an orbitwise factorisation
with genuine coupling *inside* each orbit — yet still exactly solvable by
integration — and only the further step of gluing or cross-orbit constraints
(§19) produces genuinely nonlocal decoding.

---

## 1. Introduction

### 1.1 Complementary states as an algebraic primitive

Many discrete systems contain objects that occur in complementary pairs — an
opposite orientation, an identified antipode, a paired ledger entry, a conjugate
state. The essential feature is a map `τ : X → X` with `τ² = id`. When `τ` has no
fixed points, every element lies in exactly one orbit of size two; such a `τ` is
a **free involution**. If in addition every element carries a bit `b(x) ∈ F₂`,
the pair `{x, τx}` supports an immediately available quantity `b(x) + b(τx)`
(mod 2), which vanishes on `(0,0)` and `(1,1)` and equals one on `(0,1)` and
`(1,0)`. The observation is trivial locally; it becomes useful when the allowed
dynamics are pair-respecting, so that this discrepancy bit cannot change and the
state space splits into dynamically disconnected parity sectors.

The Antipodal Identification Engine arose from precisely this structure inside a
puzzle: objects were permanently paired under an antipodal identification, legal
paired operations preserved a binary discrepancy, and occasional one-sided
repairs moved between otherwise disconnected sectors. Once the puzzle vocabulary
is removed, none of the elementary decoding theorems requires a cube, a surface,
or geometry. The system is best regarded as a finite involutive state space with
an induced binary syndrome.

### 1.2 The central claim

Let `|X| = 2P` and pick one representative `xᵢ` per orbit. Define
`Δᵢ = b(xᵢ) + b(τxᵢ)`. Three elementary facts drive everything. (i) Any operation
adding the same bit to both members of an orbit preserves `Δᵢ`. (ii) A
single-member toggle changes exactly one `Δᵢ`; hence the minimum number of such
operations reaching the symmetric sector is `wt(Δ)`. (iii) Once symmetric, one
bit `qᵢ` describes each orbit, and if the two globally complementary states are
equivalent then the solved code is `C = ⟨1⟩ = {0, 1}` and nearest-codeword
decoding gives `d(q, C) = min(k, P−k)`, `k = wt(q)`. The whole computation is
`O(P)`; the syndrome, lower bound, attaining correction, quotient, and optimal
completion are all visible directly from the involution.

### 1.3 What is and is not claimed

This is not a new theory of linear codes. Repetition codes and coset decoding
are classical, and both subproblems are elementary once written in
coding-theoretic language. Nor is the `RP²` implementation a surface code:
projective-plane topological codes encode their logical information through
`H₁(RP²; F₂)` and use boundary-coupled checks; the engine's checks are block
diagonal. The narrow contribution is the isolation of a reusable pattern —

> **free involution + binary state + paired dynamics ⇒ factorised exact decoder**

— together with an operation-derived metric, and (§18) the point at which adding
structure makes the factorisation fail in a controlled, homologically meaningful
way. Its practical value is recognising when an apparently domain-specific repair
problem already contains this structure.

## 2. Algebraic formulation

### 2.1 State space

Let `X = {x₁, τx₁, …, x_P, τx_P}` carry a free involution `τ`. The binary state
space is `V = F₂^X ≅ F₂^{2P}`. Ordering coordinates orbit by orbit, write
`b = (a₁, c₁, …, a_P, c_P)`, with `τ` exchanging `aᵢ ↔ cᵢ`. Define the parity map
`D : V → F₂^P` by `(Db)ᵢ = aᵢ + cᵢ`, so `Δ = Db`. In matrix form

```
D = I_P ⊗ [1  1].
```

### 2.2 The symmetric sector

`S = ker D = { (q₁,q₁,…,q_P,q_P) : qᵢ ∈ F₂ }`, and `φ : S → F₂^P`,
`(q₁,q₁,…) ↦ (q₁,…,q_P)`, is an isomorphism. Coding-theoretically
`S ≅ Rep₂^{⊕P}`, `Rep₂ = {00, 11}`. The involution supplies a canonical reason
those blocks exist.

## 3. Legal dynamics and the sector invariant

### 3.1 Paired operations

An operation on orbit `i` adding the same bit `rᵢ` to both entries gives
`Δ′ᵢ = (aᵢ+rᵢ) + (cᵢ+rᵢ) = Δᵢ` since `rᵢ + rᵢ = 0`.

> **Theorem 1 (Sector invariance).** Any operation acting identically on both
> members of every orbit leaves `Δ` unchanged. `Δ` labels the dynamically
> accessible sector under the paired-move group.

### 3.2 Group-action formulation, and non-semisimplicity over F₂

Let `T : V → V` be the permutation operator `(Tb)(x) = b(τx)`, so `T² = I`. Set
`N = I + T`; then `(Nb)(x) = b(x) + b(τx)`, so `N` is the uncompressed defect
operator, and over `F₂`

```
N² = (I + T)² = I + 2T + T² = 0,      Nb = 0 ⟺ Tb = b.
```

For a free involution on `2P` coordinates one has the sharper statement

```
rank N = P,     ker N = im N  (both = the P-dimensional invariant subspace).
```

Thus the `C₂`-representation on `V` is **not semisimple** over `F₂`: the invariant
subspace equals the image of `N`, and there is no complementary invariant
"anti-symmetric" summand. This is exactly why one must speak of the *descent
defect* rather than of separate `+1` / `−1` eigenspaces (see §9): in
characteristic two `I + T = I − T`, and the eigenspace decomposition available in
characteristic `≠ 2` collapses.

## 4. Minimum repair of the parity sector

A single-member repair toggles one coordinate of `b`, hence exactly one
coordinate of `Δ`.

> **Theorem 2 (Distance to the symmetric sector).** Under unit-cost single-member
> repair, `d(b, S) = wt(Δ)`.
>
> *Proof.* Each asymmetric orbit has `Δᵢ = 1`; a single-member op changes at most
> one `Δᵢ`, so `d(b,S) ≥ wt(Δ)`. Conversely, toggling one member of each
> asymmetric orbit is `wt(Δ)` non-interfering operations, so `d(b,S) ≤ wt(Δ)`. ∎

### 4.1 Syndrome interpretation

`H_τ = I_P ⊗ [1 1]` is a parity-check matrix for `S`, so `Δ = H_τ b` is literally
a syndrome and each block `[1 1]` is the check of `Rep₂`. The first stage decodes
`P` independent copies of `{00, 11}`. No check shares coordinates across orbits:
the Tanner graph is totally disconnected, so no matching problem can arise. This
total disconnection is the property that §18 removes deliberately.

## 5. Quotient completion

### 5.1 Orbit coordinates

For `b ∈ S`, write `b = (q₁,q₁,…,q_P,q_P)` and represent it by `q ∈ F₂^P`.
Identify `q ~ q + 1`, `1 = (1,…,1)`. Note the arithmetic carefully: the subgroup
`⟨1⟩ = {0, 1}` has **two elements**, but the quotient `F₂^P / ⟨1⟩` has `2^{P−1}`
cosets, each with two representatives `[q] = {q, q+1}`. "Two-element" describes
the *code*, never the quotient.

### 5.2 Exact completion

Toggling one symmetric orbit flips one coordinate of `q`.

> **Theorem 3 (Quotient completion).** For symmetric `q`,
> `d(q, ⟨1⟩) = min{ wt(q), wt(q+1) } = min(k, P−k)`, `k = wt(q)`.

The second stage is nearest-codeword decoding for the length-`P` repetition code.

## 6. Sequential versus joint optimality

The composite `wt(Δ) + min(k, P−k)` is exact under an operational assumption: the
first-stage repair must *determine* the resulting symmetric state `q` — e.g. a
heal with a prescribed direction dirty→clean. If instead a single-member repair
is a freely reversible toggle and the decoder may choose whether an asymmetric
pair is repaired toward `00` or `11`, the two stages couple and total cost can
fall.

### 6.1 The joint decoder, stated with explicit local costs

Let each orbit `i` be in state `sᵢ ∈ {00, 11, 01, 10}`. Let a paired flip cost
`fᵢ` and one-sided edits on the two members cost `hᵢ^a` (member `a`) and `hᵢ^c`
(member `c`). Define the cost of driving orbit `i` to each global target:

```
to 00:   c_i(00→00)=0,  c_i(11→00)=g_i,  c_i(01→00)=h_i^c,  c_i(10→00)=h_i^a
to 11:   c_i(11→11)=0,  c_i(00→11)=g_i,  c_i(01→11)=h_i^a,  c_i(10→11)=h_i^c
with     g_i = min( f_i , h_i^a + h_i^c ).
```

> **Theorem 4 (Joint optimal decoder).** With free repair orientation, the exact
> minimum cost is
> ```
> C* = min{ Σ_i c_i(s_i → 00) ,  Σ_i c_i(s_i → 11) }.
> ```

Two points the first draft got wrong and this corrects:

- **The symmetric-pair conversion cost is `g_i = min(f_i, h_i^a + h_i^c)`, not
  `f_i`.** If one-sided edits remain legal on a symmetric pair, then `00 ↔ 11`
  can be done either by one paired flip (`f_i`) or by two one-sided edits
  (`h_i^a + h_i^c`). The naive `f_i` is correct only when `f_i ≤ h_i^a + h_i^c`
  for every orbit, or when one-sided edits are *semantically restricted* to
  repairing an asymmetric orbit and cannot be composed afterward. That
  restriction must be stated explicitly.
- **Asymmetric pairs need not cost the same toward both targets.** When
  `h_i^a ≠ h_i^c`, `c_i(01→00) = h_i^c` but `c_i(01→11) = h_i^a`; the single clean
  `min{Σ→00, Σ→11}` handles this automatically. Setting all `h = f = 1` recovers
  `C* = wt(Δ) + min(n₀₀, n₁₁)` (`n₀₀` clean pairs, `n₁₁` dirty pairs), and setting
  the one-sided op to lower-only (`hᵢ^{raise} = ∞`) recovers the sequential
  `wt(Δ) + min(k, P−k)`.

**Which model WORM implements.** WORM is the *restricted canonical* model: its
only one-sided operation, `healSticker`, lowers (dirty→clean) and cannot raise;
`flipStickerPair`/`unflipStickerPair` are paired and preserve `Δ`. So an
asymmetric pair can only reach `00` (one heal), giving `k = n₁₁`, and reaching
the `11` representative from an asymmetric pair costs heal+flip. The planner
`planQuotientCompletion` therefore correctly computes `min(k, P−k)` and **is
optimal for that operation set**. The strictly smaller `C*` needs a one-sided
*raise* (`curr := ANTIPODAL_COLOR[orig]`), a new player operation and thus a
gameplay change, deliberately out of scope. Reversibility of the paired flip does
not supply a raise and does not close the gap. (See Appendix A.)

## 7. What the coding interpretation really is

Stage one is `Rep₂^{⊕P}`; stage two is `Rep_P`. Neither is novel as a binary
linear code. The interest is their composition and the **operation metric**:
under ordinary Hamming distance on the `2P` coordinates a paired toggle costs two,
but the engine may count it as one atomic operation, so the relevant distance is
generally not ordinary Hamming distance. This places the construction near the
literature on weighted, block, and poset metrics (Brualdi–Graves–Lawrence 1995;
Firer et al. 2018; Firer 2019). The productive formalisation is to define an
**involution metric** directly from the generators: one-sided generators `sᵢ`
(cost `hᵢ`) and paired generators `pᵢ` (cost `fᵢ`), with distance the minimum
weighted word length connecting two states. Because distinct orbits commute the
model factors — until generators couple orbits, which is §18.

## 8. Geometric realisation on the real projective plane

`τ(x) = −x` on `S²` is a free involution and `S²/(x ∼ −x) = RP²`. Any
antipodally-compatible discretisation of the sphere inherits the required orbit
structure. The logical direction matters: a free involution does not imply `RP²`,
whereas `RP²` supplies a canonical free involution through its double cover. The
algebraic theorems survive removal of the geometry.

## 9. Equivariant descent

Let `π : S² → RP²` be the double cover, with a chosen cellulation downstairs and
its lift upstairs. A cochain `c` downstairs pulls back to a deck-invariant
`π*c`; conversely a cochain `b` upstairs that agrees on the two lifts of every
cell descends. Thus `b = π*c` for some `c` iff `b = τ*b`, i.e. `(I + τ*)b = 0`,
which is exactly `Δ = 0`. Accordingly:

> `Δ` measures the failure of the binary state to descend through `S² → RP²`.

Call `Δ` the **descent (deck-invariance) defect**, not a "`τ`-anti-invariant
part": by §3.2 the characteristic-two `C₂`-representation is non-semisimple, so
invariant and anti-invariant eigenspaces are not distinct (`I + τ* = I − τ*`).

## 10. The global flip and top-dimensional homology

Care is needed: the binary state is a cochain, whereas the fundamental class is a
chain. Let `K` be the cellulation. The all-ones orbit state is the top cochain
`γ* = Σ_{f ∈ K₂} f*`. The map

```
ι : C²(K; F₂) → C₂(K; F₂),      f* ↦ f
```

is a **basis identification, not a natural chain/cochain isomorphism** — it
depends on the chosen cellular basis and should be read as a coordinate device,
not a canonical duality. Under `ι`, and for a regular cellulation (e.g. a
triangulation) of the closed surface in which **each edge lies in exactly two
incident faces**, `∂₂(ι γ*) = 0 (mod 2)` because the two face-contributions of
every edge cancel. With no 3-cells, `ι γ*` is a 2-cycle and not a boundary, so it
represents the mod-2 fundamental class

```
[RP²] ∈ H₂(RP²; F₂) ≅ F₂.
```

The state vector is therefore not *literally* a homology class; it *corresponds*
to one under `ι`. Mod-2 coefficients are essential: `RP²` is non-orientable and
has no integral top class (`H₂(RP²; Z) = 0`), but every closed manifold has an
`F₂` fundamental class.

## 11. Relation to projective-plane surface codes

The resemblance to topological quantum error correction is real but sharply
bounded. Projective-plane codes derive their logical information from
`H₁(RP²; F₂) ≅ F₂` and are organised around a chain complex
`C₂ →∂₂ C₁ →∂₁ C₀` with `∂₁∂₂ = 0`, whose incidence-coupled checks produce
spatially separated defects joined by inferred chains — the source of the
non-local matching problem (Freedman–Meyer 2001; Bombín–Martin-Delgado 2007;
Sarkar–Yoder 2024). The engine's parity matrix is block diagonal,
`H_τ = I_P ⊗ [1 1]`, so `C(Δ) = Σᵢ C(Δᵢ)`: no shared coordinates, no paths, no
separated defects. **The engine is not a surface code.** The homological content
is instead (i) `Δ = 0` as descent through the antipodal cover and (ii) the global
flip corresponding under `ι` to `[RP²] ∈ H₂`. For `RP²` both `H₁` and `H₂` are
one-dimensional over `F₂`, but equal dimension is not equal structure. The
distinction is constructive rather than defensive: it identifies exactly where a
genuinely coupled topological decoder begins — which is §18.

## 12. Relation to classical coset decoding

For a linear code `C ⊂ F₂^n`, received vectors partition into cosets `v + C`, and
decoding selects a low-weight representative (MacWilliams–Sloane 1977;
Slepian 1956). The engine does not replace this; its contribution is structural
specialisation. The free involution supplies the parity-check matrix
automatically, `τ ⇒ H_τ = I_P ⊗ [1 1]`; the legal-operation group explains why
the syndrome is conserved; the second quotient arises from the application-level
equivalence `q ∼ q + 1`. The code is *induced by the symmetries and legal
operations of the state space* rather than chosen first and decoded second.

## 13. Axial and unsigned directional data

A unit vector is a point of `S²`; an unoriented axis satisfies `v ∼ −v` and is a
point of `S²/{±1} = RP²`. This is not a software analogy but the established
sample space of **directional/axial statistics**: antipodally symmetric
distributions are the standard models for axes rather than vectors
(Mardia 1975; Bingham 1974; Watson; Bhattacharya–Patrangenaru 2005;
Kurz et al. 2019). Nematic liquid-crystal directors are headless (`n ≡ −n`);
diffusion-tensor eigenvectors carry arbitrary sign, so principal directions
appear as antipodal clusters and naive Euclidean averaging can cancel or
mis-orient them (Hutchinson et al. 2012).

The portable primitive here is the **identification layer**, not the whole binary
decoder:

```
canonicalAxis(v),   antipode(id),   sameAxis(v, w),
d_RP([v],[w]) = min{ d_S(v, w), d_S(v, −w) }.
```

That projective distance coincides with the metric of `RP²` used in directional
statistics — so the transfer is to a genuine established geometry. A
directional-data pipeline may have no binary `b` and no global-complement code
and still benefit from a representation that never silently treats `v` and `−v`
as unrelated.

## 14. Canonical identity under motion

The implementation also required identity stable under motion. This is *not*
content addressing (`ID = H(content)`, where changing content changes the id).
The property is invariance under the group action, `ID(g·x) = ID(x)` for every
permitted motion `g`, placing it near canonical labelling and orbit
representatives. Invariance alone is insufficient, though: two distinct objects
could share an invariant. The correct requirement is invariance **and**
discriminative power —

> `canonicalId` is constant on permitted-motion orbits **and** separates the
> physical identity classes the application must distinguish.

With that, the involution can act on identities rather than mutable coordinates,
`ID(x) ↦ τ(ID(x))`, so the pairing stays stable while the object moves.

## 15. Implementation as a generic kernel

Two domain-supplied functions suffice: `canonicalId(x) -> label` and
`partner(label) -> τ(label)` with `τ² = id`, `τ(ℓ) ≠ ℓ`. The generic layer builds
orbits and decodes:

```
enumeratePairs(X)  -> [{a, b}, ...]
delta(X)           -> { syndrome, weight, support }
planCompletion(X)  -> { sectorRepairs, quotientFlips, totalCost }
```

Each element is visited a constant number of times, so `T(P) = O(P)` with `O(P)`
storage; no branch factor grows with depth, size, or history. This makes the
decoder attractive as a **correctness layer** even inside a larger application
whose real optimisation lies elsewhere.

## 16. Expansion I: weighted operation costs

Assign `hᵢ` to one-sided repairs and `fᵢ` to paired flips. The sequential
sector-repair cost is `C_heal = Σ_{Δᵢ=1} hᵢ` (each asymmetric orbit independently
repairable), and canonical completion is
`min{ Σ_{qᵢ=1} fᵢ , Σ_{qᵢ=0} fᵢ }`. The **joint** decoder is Theorem 4 with the
corrected `gᵢ = min(fᵢ, hᵢ^a + hᵢ^c)` symmetric-conversion cost:

```
C* = min{ Σ_i c_i(s_i→00) , Σ_i c_i(s_i→11) },
```

with the local costs of §6.1. The weighted model is likely more useful than the
uniform one because real operations rarely have equal cost, and it is a clean
entry into weighted/poset-metric coding rather than a claim of novelty where a
mature metric literature exists.

## 17. Expansion II: larger alphabets

Let `b : X → A` for an abelian group `A`, with `Δᵢ = b(xᵢ) − b(τxᵢ)`. A common
translation of both members preserves `Δᵢ`, and the symmetric sector remains
`b(x) = b(τx)`. **Caveat:** with subtraction, `Δᵢ` is only defined up to sign
unless each orbit is given a fixed orientation/representative — harmless over
`F₂` (`−1 = 1`), but for `A = Z_m` the representative choice matters and the
metric on `A` (circular, weighted-Cayley, …) sets the repair cost. Orbit
factorisation survives. The deeper reusable feature is a group-valued label on a
free involution with diagonal per-orbit operations; the binary case is
distinguished by its exceptionally simple syndrome and its mod-2 topology.

## 18. Expansion III: several commuting involutions — a cubical cochain complex

Replace one involution by `r` commuting free involutions. This turns the finer
`r = 1` decomposition — over individual defect coordinates — into a coarser but
still-exact decomposition over orbits, with genuine *internal* coupling inside
each orbit. It is a first phase change, not yet a loss of factorisation; the
second phase change (true inter-orbit coupling) is deferred to §19. Read §18 as
locating exactly the boundary between the two.

### 18.1 Setup and a freeness caveat

Let `G = (Z₂)^r` act on `X` with generators `τ₁,…,τ_r` (`τⱼ² = id`,
`τᵢτⱼ = τⱼτᵢ`). **Assume the action is free and faithful.** This is a real
hypothesis, not a formality: commuting fixed-point-free involutions need not give
free `2^r`-element orbits — a product `τᵢτⱼ` may have fixed points, or the
generators may be dependent, collapsing orbit size. Under freeness every orbit is
a `G`-torsor, non-canonically identified (after choosing a basepoint) with the
vertex set of the `r`-cube.

**Notation.** Write `I^r = [0,1]^r` for the *filled* cubical complex (vertices,
edges, squares, …, up to the top `r`-cell), and reserve `Q_r = (I^r)^{(1)}` for
its **1-skeleton**, the hypercube *graph*. The distinction is load-bearing below:
`I^r` is contractible, whereas `Q_r` is not — the graph has many independent
cycles for `r ≥ 2`.

### 18.2 The defect field is a coboundary

Give each orbit the cubical CW structure of `I^r`: vertices = orbit elements,
edges = generator-moves, squares = commuting pairs, and so on. A state
`b : X → F₂` is a **0-cochain**. For generator `j` define the edge defect

```
Δⱼ(x) = b(x) + b(τⱼ x) = (δ⁰ b)(edge x →_j τⱼ x),
```

which is exactly the cubical coboundary `δ⁰ : C⁰ → C¹`. So the whole defect field
is `Δ = δ⁰ b`, a **1-coboundary** — and hence, in the model where `b` is always
the underlying state, `[Δ] = 0 ∈ H¹` always (§18.5).

### 18.3 The square relations are `d² = 0`

Around the square through `x` spanned by directions `i, j`,

```
Δᵢ(x) + Δⱼ(τᵢ x) + Δᵢ(τⱼ x) + Δⱼ(x) = 0,
```

because the eight `b`-terms cancel in pairs using `τᵢτⱼ = τⱼτᵢ`. This is not
merely "chain-complex-like": it is `δ¹ δ⁰ = 0`. The defect field of any `b` is a
**1-cocycle** (`δ¹ Δ = 0`), and

```
C⁰(orbit) →δ⁰ C¹(orbit) →δ¹ C²(orbit) → ···
```

is the cubical cochain complex of `I^r`.

### 18.4 Two exact decoders, and where each phase change is

For `r = 1` each vertex meets one edge, so a vertex toggle flips one `Δ`
coordinate: the syndrome factorises **coordinatewise** and repair is `wt(Δ)`. For
`r ≥ 2` **each vertex meets `r` edges**, so a single-member toggle flips `r`
defect coordinates at once. The `r = 1` coordinatewise factorisation is gone —
but a *coarser* factorisation survives, because distinct `G`-orbits remain
mutually independent:

> **Theorem 5 (Sector repair under a free `(Z₂)^r`).** Reaching the
> deck-invariant sector `Δ = 0` requires `b` constant on each orbit. With
> unit-cost single-member toggles, the minimum cost factorises over orbits:
> ```
> C_sector = Σ_{orbits o} min( k_o , 2^r − k_o ),     k_o = wt(b |_o).
> ```
> *Proof.* `Δ|_o = 0` iff `b` is constant on orbit `o`; making it all-`0` costs
> `k_o` toggles, all-`1` costs `2^r − k_o`, and no non-constant state has
> `Δ = 0`. The legal moves (per-orbit constants, `= ker δ⁰`) realise exactly the
> all-`0`/all-`1` choice. Orbits are disjoint, so the sum is achievable. ∎

**This remains an exact, closed-form decoder — not a hard one.** Because
`Δ = δ⁰ b` determines `b` up to a constant on each connected orbit, one simply
integrates `Δ` from a chosen basepoint to recover `b`, then takes the lighter of
`b` and `b + 1`:

```
Δ  →(integrate from basepoint)→  {b, b+1}  →(choose lighter)→  min(wt b, 2^r − wt b),
```

still linear in orbit size. So `min(k_o, 2^r − k_o)` should be advertised as a
*second exact decoder obtained by integration*, not as a hard coset-weight search.
For `r = 1`, `min(k_o, 2 − k_o) = [k_o = 1] = Δ`, recovering Theorem 2. The precise
transition is therefore

```
r = 1:  independent (coordinatewise) edge checks
r ≥ 2:  coupled edge checks INSIDE independent G-orbits — still orbitwise
        factorised and exactly integrable
§19:    gluing / cross-orbit constraints — coupling BETWEEN orbit blocks,
        where genuine nonlocal decoding can appear
```

Two phase changes, not one. The one-involution engine is the fully-decoupled
corner; §18 is the middle regime; genuinely nonlocal decoding is §19's territory.

### 18.5 Cocycles, coboundaries, and when `H¹` becomes operational

Keep three spaces distinct:

- `Z¹ = ker δ¹` — **locally square-consistent candidate edge fields** (closed).
- `B¹ = im δ⁰` — **edge-defect fields actually induced by a global vertex state
  `b`** (exact).
- `H¹ = Z¹ / B¹` — the **obstruction to integrating a closed edge field to a
  global `b`**.

In the model where `b` is always the underlying physical variable,
`Δ = δ⁰ b ∈ B¹`, so its class is always trivial, `[Δ] = 0`. One must therefore
*not* call all of `Z¹` "valid syndromes": for a single filled cube `I^r` (which
is contractible), `H¹(I^r; F₂) = 0`, so closed = exact and integration always
succeeds — whereas `H¹(Q_r; F₂)` for the *graph* is generally nonzero and is a
different object. Deleting 2-cells or gluing cubes does not *automatically*
produce nontrivial `H¹`; it makes it *possible*, in which case `H¹` may become
nonzero.

`H¹` becomes **operational** only when the edge field is promoted to independent
data — when a measured or noisy `η ∈ C¹` need not equal `δ⁰ b`. Then three
increasingly coding-theoretic problems appear, and they are the concrete form of
research direction §25(2):

```
(1) integration:     η ∈ Z¹, is η ∈ B¹?          (is the closed field exact?)
(2) classification:  [η] ∈ H¹                     (which logical class?)
(3) nearest-exact:   min_{β ∈ B¹} d(η, β)         (decode to a genuine defect)
```

Problem (3) is the genuine coding problem, and it is nontrivial exactly when the
complex has `H¹ ≠ 0` and/or the metric couples across orbits — i.e. under §19's
gluing/hybrid constraints. This cocycle-versus-coboundary separation is the same
device homological code constructions use to tell trivial cycles from logical
classes (Breuckmann–Terhal 2016; Bombín–Martin-Delgado 2007).

## 19. Expansion IV: hybrid diagonal and boundary-coupled codes

Combine two syndrome sources: local involution defects `H_τ` (block diagonal) and
ordinary cellular boundary defects `H_∂` (incidence-coupled), stacked as
`H_hybrid = [H_τ ; H_∂]`. If they interact weakly, the diagonal part can be
decoded first, shrinking the state presented to the coupled decoder. No quantum
performance claim follows without analysis of commutation, degeneracy, noise, and
fault tolerance. The precise research question is: **under what compatibility
conditions can an involution-induced direct-sum syndrome be split off from a
boundary-coupled syndrome without changing the optimum of the full decoder?** If
exact decomposition conditions exist, the engine becomes a *preprocessing
theorem* rather than an analogy. §18's cubical complex is the natural setting to
pose it, since it already contains both regimes as `r` varies.

## 20. Expansion V: antipodally consistent data pipelines

For unsigned data `vᵢ ∈ S^{d−1}` with `vᵢ ∼ −vᵢ`, a projective-data API should
represent every observation as an explicit class `[vᵢ]` and require comparison,
binning, interpolation, clustering, and neighbour lookup to respect `[v] = [−v]`,
using `d_RP` of §13. This prevents the common failure in which Euclidean
averaging treats antipodal representatives as opposite measurements rather than
the same axis — a failure mode with an established fix in directional statistics
(Bingham 1974; Mardia 1975; Kurz et al. 2019), which is what makes this the
easiest place to demonstrate measurable practical value (§25(4)).

## 21. Expansion VI: non-orientable discrete geometry

The geometry separates cleanly from the decoder. A discrete quotient surface
must answer consistently: the neighbour of a boundary cell across an identified
seam; whether crossing reverses orientation; which lifted cells share a quotient
cell; the coordinate convention shared across components; whether an update
commutes with the identification. These are error-prone on non-orientable spaces,
where local indexing mistakes propagate globally. A tested `RP²`/Klein-bottle
module that exposes the quotient as a data structure is valuable engineering
(procedural environments, teaching tools, cellular simulations, visualisations,
test oracles) even absent a new theorem. WORM's `gridIds.js` exists precisely to
prevent two threads from drifting into different antipodal pairings.

## 22. Expansion VII: invariant-preserving transaction APIs

If a system maintains `F(a, b) = 0` for matched objects, expose only
invariant-preserving atomic operations (for the binary engine,
`(a,b) ↦ (a+1, b+1)`), and mark one-sided changes explicitly as repairs / sector
transitions. Examples: transactional ledgers, paired-resource accounting,
reversible simulation primitives, synchronised replicas. This is a **design
pattern, not a theorem** that those domains instantiate `RP²` mathematics. The
transferable lesson: make invariant-preserving mutation the primitive, and make
invariant-breaking mutation explicit and measurable, so illegal states are harder
to construct.

## 23. Limitations

- **The easy decoder comes from factorisation, and it degrades in two stages.**
  The `r = 1` *coordinatewise* identity `C(Δ) = Σᵢ C(Δᵢ)` holds because each
  single edit changes one syndrome coordinate. Under a free `(Z₂)^r` action
  (§18, `r ≥ 2`) that coordinatewise identity fails — edits inside an orbit
  couple — **but the coarser orbitwise factorisation survives and is still exactly
  solvable by integration** (Theorem 5). Only genuine *inter-orbit* coupling
  (§19: gluing, cross-orbit constraints, or noisy independent edge fields) removes
  the remaining product structure and can make decoding nonlocal. The simplicity
  is a theorem about which decomposition holds, not evidence that coupled
  topological decoding is easy.
- **The binary code is classical.** `F₂`, syndromes, cosets, and homology do not
  make a system quantum: no superposition, measurement, stabilizer Hilbert space,
  quantum noise model, or fault-tolerance claim follows.
- **Not every antipodal application needs the decoder.** An application may live
  on `RP²` with no binary fibre and no global-complement code; then only the
  identification layer (§13) transfers.
- **The two-stage formula depends on repair semantics.** `wt(Δ) + min(k, P−k)` is
  correct once the post-repair `q` is specified; with free repair orientation and
  composable one-sided edits the joint optimum is Theorem 4 with
  `gᵢ = min(fᵢ, hᵢ^a + hᵢ^c)`. State the assumption whenever the formula is
  advertised as globally optimal.
- **Canonical identity is domain-dependent.** The decoder assumes reliable
  pairing and consumes a correct identification layer with both invariance and
  discriminative power (§14); it does not solve graph isomorphism, registration,
  or arbitrary canonicalisation.

## 24. What can reasonably be claimed as the contribution

The ingredients are classical: free involutions, parity checks, repetition
codes, cosets, Hamming weight, projective quotients, mod-2 fundamental classes,
deck-invariant descent. The defensible contribution is their *factorisation
around an application-generated involution*, specifically:

- a domain-independent formulation `(X, τ, b)`;
- the induced syndrome operator `D` and its non-semisimple `C₂`-structure over
  `F₂`;
- an exact distance theorem to the invariant sector, and its `(Z₂)^r`
  generalisation `Σ min(k_o, 2^r − k_o)` (Theorem 5);
- an exact quotient-completion theorem, and a corrected joint decoder (Theorem 4);
- a clear separation of symmetry-preserving moves from sector-changing repairs;
- an operation-cost metric that may differ from ordinary Hamming geometry;
- an `RP²` realisation with a precise equivariant-descent and `H₂` interpretation
  (distinct from `H₁` surface codes);
- a software interface confining domain complexity to identity and partner
  selection.

The right framing is not "a new decoder" but a two-phase-change story:

> **A free `C₂`-action gives coordinatewise factorisation. A free `(Z₂)^r`-action
> replaces independent defect coordinates with an internally coupled cubical
> coboundary system while retaining orbitwise exact solvability (by integration).
> Genuine nonlocal decoding appears only after additional topology, incomplete
> filling, noise, or cross-orbit constraints introduce nontrivial cohomology or
> destroy the remaining product structure.**

Compactly:
`independent checks → cubically constrained but exactly integrable checks →
genuinely topological/coupled decoding`. The repetition-code result is the binary
rank-one corner; identifying *two* phase changes rather than one is what makes the
claim precise enough to be hard to dismiss.

## 25. Suggested research programme

1. Formalise the operation metric and prove the canonical and free-orientation
   decoder theorems under explicit assumptions; property-test `τ² = id`,
   `τ(x) ≠ x`, and `D(gb) = Db` for all legal paired `g`, with closed-form vs.
   exhaustive agreement on small instances.
2. **Develop the `(Z₂)^r` cubical complex of §18** along the progression
   `exact cube integration → closed but non-exact edge fields → noisy/inconsistent
   edge fields → glued complexes → hybrid decoding`. Concretely, once the edge
   field `η ∈ C¹` is promoted to independent data: (a) the *integration* test
   `η ∈ Z¹ ⇒ η ∈ B¹?`; (b) the *classification* `[η] ∈ H¹`; (c) the
   *nearest-exact-field* decoder `min_{β ∈ B¹} d(η, β)` — the first genuine coding
   problem of the family. Characterise `H¹` for glued / partially-filled complexes
   (distinguishing the filled cube `I^r`, with `H¹ = 0`, from the graph `Q_r`).
   *(Mathematically richest.)*
3. Prove an exact decomposition theorem for hybrid `H = [H_τ ; H_∂]` (§19).
4. Demonstrate a projective-data pipeline (§20) where quotient-aware
   representation prevents a *measurable* sign/averaging failure.
   *(Easiest practical proof of value.)*

## 26. Conclusion

The engine begins with a small object `(X, τ, b)` and a canonical defect
`Δᵢ = b(xᵢ) + b(τxᵢ)`, conserved by paired dynamics, whose weight is the exact
number of one-sided corrections to enter the invariant sector. Algebraically
`H_τ = I_P ⊗ [1 1]`, so the first stage is `Rep₂^{⊕P}`; after symmetry the state
is `q ∈ F₂^P`, and identifying global complementation makes the target the
repetition code `⟨1⟩`, with exact completion `min(k, P−k)`. The value is that the
involution makes the coding structure unavoidable. On `RP²` the same defect
detects failure to descend through `S² → RP²`, and the global complement
corresponds under a basis identification to the mod-2 fundamental 2-cycle —
related to, but structurally distinct from, `H₁`-based projective-plane surface
codes. Outside topology the pairing layer applies directly to unsigned
directional data, where antipodal identification is part of the sample space, and
in software the separation of canonical identity, invariant-preserving
operations, and explicit sector transitions is a compact reliability pattern.

The lesson is conservative: **a free involution can expose hidden block
structure, and hidden block structure can turn repair from search into algebra.**
The most promising expansions preserve that insight — weighted operations retain
factorisation, larger alphabets replace parity by group difference, and several
commuting involutions turn the disconnected checks into a cubical cochain complex
where coupling first appears as `d² = 0`. That last transition, from `C₂` to
`(Z₂)^r`, is where a simple decoder from hidden symmetry starts to become
something deeper.

---

## Appendix A. WORM implementation notes

- **Pairing / identity.** `getManifoldGridId` (`gridIds.js`) assigns each sticker
  a label from its origin, invariant under rotation (a realisation of §14);
  `findAntipodalStickerByGrid` (`manifoldLogic.js`) is the free involution `τ`.
  The one shared implementation exists so the main thread and chaos worker cannot
  drift into different pairings.
- **Operations.** `healSticker` (`cubeState.js`) is the one-sided repair and
  **lowers only** (`curr := orig`). `flipStickerPair` / `unflipStickerPair`
  (`manifoldLogic.js`) are paired and preserve `Δ`. There is no one-sided *raise*.
- **Planner.** `planQuotientCompletion` (`antipodalEngine.js`) implements the
  restricted canonical model of §6 and is optimal for it: asymmetric pairs heal
  to `00` (`k = n₁₁`), completion is `min(k, P−k)` flips. Theorem 4's smaller
  `C*` requires a raise operation and is a deliberate non-goal (a gameplay
  change). The planner is left unchanged; this is a documented modelling choice,
  not a missed optimisation.

## References

- MacWilliams, F. J., & Sloane, N. J. A. (1977). *The Theory of Error-Correcting
  Codes.* North-Holland. — repetition codes, cosets, syndromes, nearest-codeword
  decoding.
- Slepian, D. (1956). A class of binary signaling alphabets. *Bell System
  Technical Journal*, 35, 203–234.
- Brualdi, R. A., Graves, J. S., & Lawrence, K. M. (1995). Codes with a poset
  metric. *Discrete Mathematics*, 147, 57–72.
- Firer, M. (2019). Alternative metrics. arXiv:1911.12396.
- Firer, M., Alves, M. M. S., Pinheiro, J. A., & Panek, L. (2018). *Poset Codes:
  Partial Orders, Metrics and Coding Theory.* Springer.
- Freedman, M. H., & Meyer, D. A. (2001). Projective plane and planar quantum
  codes. *Foundations of Computational Mathematics*, 1(3), 325–332.
  (Preprint arXiv:quant-ph/9810055.)
- Bombín, H., & Martin-Delgado, M. A. (2007). Homological error correction:
  classical and quantum codes. *Journal of Mathematical Physics*, 48(5), 052105.
- Sarkar, R., & Yoder, T. J. (2024). A graph-based formalism for surface codes and
  twists. *Quantum*, 8, 1416.
- Breuckmann, N. P., & Terhal, B. M. (2016). Constructions and noise threshold of
  hyperbolic surface codes. *IEEE Transactions on Information Theory*, 62(6),
  3731–3744. — cocycle-vs-coboundary (`H₁ = Z₁/B₁`) separation of trivial cycles
  from logical classes.
- Kaczynski, T., Mischaikow, K., & Mrozek, M. (2004). *Computational Homology.*
  Springer. — cubical complexes vs. their skeleta (the `I^r` vs. `Q_r`
  distinction of §18.1).
- Pilarczyk, P., & Real, P. (2015). Computation of cubical homology, cohomology,
  and (co)homological operations via chain contraction. *Advances in Computational
  Mathematics*, 41.
- Barceló, H., Greene, C., Jarrah, A. S., & Welker, V. (2019). Discrete cubical
  and path homologies of graphs. *Algebraic Combinatorics*, 2(3), 417–437.
- Mardia, K. V. (1975). Statistics of directional data. *J. Royal Statistical
  Society: Series B*, 37(3), 349–393.
- Bingham, C. (1974). An antipodally symmetric distribution on the sphere.
  *Annals of Statistics*, 2, 1201–1225.
- Bhattacharya, R., & Patrangenaru, V. (2005). Large sample theory of intrinsic
  and extrinsic sample means on manifolds — II. *Annals of Statistics*, 33(3).
- Kurz, G., Gilitschenski, I., Pfaff, F., et al. (2019). Directional statistics
  and filtering using libDirectional. *Journal of Statistical Software*, 89(4).
- Hutchinson, E. B., Rutecki, P. A., Alexander, A. L., & Sutula, T. P. (2012).
  Fisher statistics for analysis of diffusion tensor directional information.
  *Journal of Neuroscience Methods*, 206(1), 40–45.
- WORM-3 implementation: `antipodalEngine.js`, `manifoldLogic.js`, `gridIds.js`.
