# Solving the WORM-3 Cube Under Antipodal Identification

**A two-phase method for solving a Rubik's cube whose stickers may have been flipped through wormholes on the real projective plane (RP²).**

*WORM-3 (World of Rubik's Manifolds) — technical note. Last updated 2026-07-19.*

---

## Abstract

WORM-3 is a Rubik's cube built on RP² topology: opposite faces are glued by
the antipodal map, and a sticker can travel through a *wormhole* that recolours
it to its antipode. Standard Kociemba two-phase solving assumes six fixed,
distinguishable colours and rejects any cube in which a sticker shows the
"wrong" colour — so a single flipped tile makes the classical solver refuse to
run. This note develops the **WORM Antipodal Solve (WAS)** method, which solves
such cubes. We formalise the state model, prove that a wormhole flip is
*invertible from stored state* (so piece positions are recoverable regardless of
flip damage), introduce two distinct notions of "solved" — **strict** and
**quotient** — and give a two-phase algorithm: Phase 1 recovers piece positions
with unmodified Kociemba over normalised facelets, and Phase 2 clears residual
flip parity. We prove correctness of both phases, then show (Theorem 5) that
residual parity modulo the antipodal-symmetric subspace is conserved by all
rotations and flips — so the "clean single-pair flip" is simply the game's
native paired wormhole flip, every in-play residual is native-flip clearable in
half the operations of healing, and the single-sticker heal is the unique
operator that can break antipodal symmetry.

---

## 1. Motivation

The classical adapter (`src/game/kociembaAdapter.js`) builds a 54-character
facelet string from the painted colour `curr` of each sticker and validates that
each of the six face letters appears exactly nine times. A wormhole flip
recolours one sticker from a colour $c$ to its antipode $\alpha(c)$, so the count
of one face letter rises to ten and its antipode drops to eight; validation
fails and the solver returns `null` with *"cube has modified stickers… reset
first."* The player is told an intrinsically legal, physically reachable cube is
unsolvable. WAS removes that restriction.

---

## 2. The state model

### 2.1 Colours and the antipodal involution

Faces carry six colours, encoded $1..6$:

| id | 1 | 2 | 3 | 4 | 5 | 6 |
|----|---|---|---|---|---|---|
| colour | Red | Green | White | Orange | Blue | Yellow |
| face | F (PZ) | L (NX) | U (PY) | B (NZ) | R (PX) | D (NY) |

The **antipodal involution** $\alpha$ (`ANTIPODAL_COLOR` in
`src/utils/constants.js`) pairs each colour with the colour of its opposite
face:

$$\alpha:\quad 1\leftrightarrow 4,\quad 2\leftrightarrow 5,\quad 3\leftrightarrow 6,
\qquad \alpha=\alpha^{-1},\quad \alpha(c)\neq c.$$

In Kociemba face letters these are exactly the opposite-face pairs
$F\!\leftrightarrow\!B,\; L\!\leftrightarrow\!R,\; U\!\leftrightarrow\!D$.

### 2.2 Stickers

A sticker (`src/game/cubeState.js`) is a record

$$s=(\mathrm{curr},\ \mathrm{orig},\ \mathrm{flips},\ \mathrm{origPos},\ \mathrm{origDir}),$$

where `orig` $\in\{1..6\}$ is its **home colour**, fixed at construction and
**never reassigned**; `curr` is the colour painted right now; and
`flips` $\in\mathbb{Z}_{\ge 0}$ counts wormhole traversals. Let $S$ be the set of
exterior stickers ($54$ on a $3\times3$).

### 2.3 Generators

Three families of operators act on a cube state:

- **Rotations** $\mathcal{R}$ — the six face quarter-turns and their inverses
  (`rotateSliceCubies`). A rotation permutes sticker *records* between grid
  positions; it **does not read or write `curr`, `orig`, or `flips`**.
- **Flip** $\varphi_s$ — a wormhole traversal (`flipStickerPair`,
  `chaosSim.js`): $\mathrm{curr}\mapsto\alpha(\mathrm{curr})$,
  $\mathrm{flips}\mathbin{+}{=}1$. It is applied to a sticker **and its
  antipodal partner** $\bar s$ simultaneously (see §6.1). $\varphi_s$ is an
  involution on `curr`.
- **Heal** $\eta_s$ — `healSticker`: $\mathrm{curr}\mapsto\mathrm{orig}$,
  $\mathrm{flips}\mapsto 0$. Acts on a **single** sticker.

---

## 3. Two notions of "solved"

Let $\text{home}(s)\in\{1..6\}$ be the colour the face occupied by $s$ should
show (`DIR_TO_FACE` in `src/game/winDetection.js`).

**Definition (Strict).** A cube is *strict-solved* iff
$\mathrm{curr}(s)=\text{home}(s)$ for all $s\in S$.
(`checkRubiksSolved`, classical Rubik victory.)

**Definition (Quotient).** Let $[c]=\{c,\alpha(c)\}$ be the antipodal class and
$\kappa(c)=\min(c,\alpha(c))$ its representative (`colorClass`). A cube is
*quotient-solved* iff $\kappa(\mathrm{curr}(s))=\kappa(\text{home}(s))$ for all
$s\in S$. (`checkRubiksSolvedAntipodal`.)

The quotient notion reflects the RP² topology on the *colour* fibre: a colour
and its antipode are the same point of the quotient manifold, so a face is
solved when it is uniform **up to** $\alpha$. Strict $\Rightarrow$ quotient; the
converse fails exactly on flipped tiles.

**Remark 3.1 (this is a half-quotient).** The definition divides the colour
fibre by $\alpha$ but leaves the *position* set intact. A full state-level
antipodal quotient would additionally identify a cube with its image under the
antipodal echo action of `antipodalMode.js` (a CW face turn paired with its CCW
echo). $\kappa$-solvedness is therefore a deliberate design choice for a
playable win condition — the full quotient would call a cube solved when it is
solved only up to a global antipodal relabelling, which reads as a bug to a
player — and is presented here as a design choice, not as *the* RP² notion.

---

## 4. Flip invariance

The engine keeps enough state to *undo* any flip, which is what makes position
recovery possible.

> **Lemma 1 (Reachable colours).** For every sticker of every state reachable
> from a solved cube by $\mathcal{R}\cup\{\varphi\}$, we have
> $\mathrm{curr}(s)\in\{\mathrm{orig}(s),\ \alpha(\mathrm{orig}(s))\}$, and
> $\mathrm{curr}(s)=\mathrm{orig}(s)$ iff $\mathrm{flips}(s)$ is even.

*Proof.* Induction on move count. Initially $\mathrm{curr}=\mathrm{orig}$,
$\mathrm{flips}=0$. Rotations move the record intact, preserving the invariant.
A flip sends $\mathrm{curr}\mapsto\alpha(\mathrm{curr})$ and toggles the parity
of `flips`; since $\alpha$ is an involution and $\mathrm{orig}$ is untouched,
$\mathrm{curr}$ stays in $\{\mathrm{orig},\alpha(\mathrm{orig})\}$ and matches
$\mathrm{orig}$ exactly on even parity. $\square$

> **Lemma 2 (`orig` is rotation-equivariant).** Rotations act on the sticker
> records by a permutation $\pi\in\mathrm{Sym}(S)$ that is independent of
> colours. Reading the field `orig` therefore commutes with rotations: the
> facelet string built from `orig` is exactly the string the *unflipped* cube
> would present.

*Proof.* Immediate: rotations never read or write `orig`, so the multiset of
`orig` values at each position transforms only by $\pi$, identically to a cube
that was never flipped. $\square$

> **Theorem 1 (Position recovery).** Let $x$ be any state reachable by
> $\mathcal{R}\cup\{\varphi\}$. Define the **normalised facelet map**
> $\rho(x)$ by reading each position's `orig` value. Then $\rho(x)$ is a legal
> six-colour cube string, and applying stock Kociemba to $\rho(x)$ yields a
> rotation word $g\in\mathcal{R}^\ast$ that returns every piece to its home
> position.

*Proof.* By Lemma 2, $\rho(x)$ is the facelet string of the flip-free cube with
the same rotation history, which is a legal Kociemba input (exactly nine of each
letter, valid permutation and orientation parity because it is a genuine
rotation of the solved cube). Kociemba returns $g$ solving that permutation;
since rotations act identically on the flipped and unflipped cubes (Lemma 2),
$g$ homes every piece of $x$ as well. $\square$

### 4.1 Admissibility

Reading `orig` is only meaningful when every sticker's paint is explained by
flips. Call $x$ **admissible** iff
$\mathrm{curr}(s)\in\{\mathrm{orig}(s),\alpha(\mathrm{orig}(s))\}$ for all
$s\in S$. Admissibility is $O(|S|)$-decidable, is implied by reachability
(Lemma 1), and is exactly the hypothesis Theorem 1 needs.

The nine-of-each facelet count is **necessary but not sufficient** as a damage
filter: two stickers cross-mispainted into each other's classes leave all six
counts at nine while the state is not $\mathcal{R}\cup\{\varphi\}$-reachable.
Guarding on the count alone would then read an incoherent mix of `orig` (for
flipped tiles) and `curr` (for damaged tiles). (In normal play only flips ever
recolour a sticker, so inadmissible states do not arise — this is defensive
hardening, and makes the "forgives flips and nothing else" guarantee exact.)

**Implementation.** `cubiesToKociembaString(cubies, { ignoreFlips: true })`
first tests `isAdmissible` and returns `null` on failure, **then** computes
$\rho$ by reading `orig` throughout. The nine-of-each count is retained as a
cheap redundancy check on $\rho$, not as the damage filter.

---

## 5. The WAS algorithm

**Input.** A cube state $x$ reachable by $\mathcal{R}\cup\{\varphi\}$.
**Output.** A word $w$ over $\mathcal{R}\cup\{\eta\}$ with $w\cdot x$
strict-solved.

```
Phase 1 — position solve (rotations)
  facelets ← cubiesToKociembaString(x, { ignoreFlips: true })   # ρ(x)
  g        ← Kociemba(facelets)                                 # rotation word
  x        ← g · x                                              # now quotient-solved

Phase 2 — parity clearing (heals)
  R ← flipResiduals(x)                 # stickers with curr ≠ orig
  h ← [ η_s for s in R ]               # planStrictCompletion
  x ← h · x                            # now strict-solved

return  g ++ h
```

`src/game/antipodalSolver.js` implements Phase 2:
`flipResiduals`, `planStrictCompletion`, `applyStrictCompletion`,
`residualWeight`. Phase 1 is the existing Kociemba pipeline
(`useKociembaSolver` now calls the adapter with `ignoreFlips: true`).

> **Theorem 2 (Phase 1 solves the quotient puzzle).** After Phase 1, $x$ is
> quotient-solved.

*Proof.* By Theorem 1 every piece is home, so each sticker $s$ satisfies
$\mathrm{orig}(s)=\text{home}(s)$. By Lemma 1,
$\mathrm{curr}(s)\in\{\mathrm{orig}(s),\alpha(\mathrm{orig}(s))\}=[\text{home}(s)]$,
hence $\kappa(\mathrm{curr}(s))=\kappa(\text{home}(s))$. $\square$

> **Theorem 3 (Phase 2 completes to strict).** After Phase 2, $x$ is
> strict-solved. Moreover $|h|=$ `residualWeight`$(x)$ heals suffice, and this
> is minimal among heal-only completions.

*Proof.* By Theorem 2 each piece is home, so for every $s$,
$\text{home}(s)=\mathrm{orig}(s)$. A residual sticker has
$\mathrm{curr}(s)=\alpha(\mathrm{orig}(s))\neq\text{home}(s)$; a non-residual has
$\mathrm{curr}(s)=\mathrm{orig}(s)=\text{home}(s)$. Applying $\eta_s$ to each
residual sets $\mathrm{curr}(s)=\mathrm{orig}(s)=\text{home}(s)$ and touches no
other sticker, so afterwards every sticker matches its home colour: strict
solved. Each residual must change and $\eta$ changes one sticker, so no
heal-only completion uses fewer than `residualWeight` ops. $\square$

**Corollary.** WAS solves any admissible cube under the strict definition in
$|g|+|h|$ operations, where $|h|=$ residual weight $\le|S|$ and $|g|$ is the
length of a two-phase solution. (Note: $20$ HTM is *God's number* — the diameter
of the cube group, Rokicki et al. — not a guarantee on a single two-phase pass.
Plain two-phase typically returns $\le 22$ HTM and reaches optimal only under an
iterated-deepening, optimality-seeking configuration.)

---

## 6. Clearing parity in the game's native paired flips

Phase 2 as first stated uses **heal**, a single-sticker operator. The game's
*native* colour operator is the **paired wormhole flip**: flipping $s$ also
flips its antipodal partner $\bar s$ (`findAntipodalStickerByGrid`,
`flipStickerPair`). We now show that native flips clear every residual a player
can actually produce, and characterise exactly when they cannot.

### 6.1 The parity space

Model residual flip parity after Phase 1 as a vector
$f\in\mathbb{F}_2^{S}$, $f(s)=[\mathrm{curr}(s)\neq\mathrm{orig}(s)]$, **indexed
by sticker identity, not position**. Strict completion needs $f=0$.

> **Lemma 3.5 (The pairing $\beta$ is identity-based, hence rotation-invariant).**
> The native flip's partner map (`findAntipodalStickerByGrid`) computes the
> partner's grid id as $\texttt{M}\,\alpha(\mathrm{orig})\,\texttt{-}\,\iota$
> where $\iota$ is derived from `origPos` and `origDir`
> (`getManifoldGridId`, `gridIds.js`). All three inputs — `orig`, `origPos`,
> `origDir` — are set once at cube construction and **never** written by
> rotations (`cubeRotation.js` touches neither; the Sudokube identity test in
> `winDetection.test.js` depends on this). Therefore $\beta$ is a fixed
> fixed-point-free involution on sticker **identities**: $\beta(s)$ is the unique
> identity with $\mathrm{orig}(\beta(s))=\alpha(\mathrm{orig}(s))$ at the same
> original cell, independent of where either currently sits.

*Consequence.* A native flip at any position $p$ toggles the identity currently
at $p$ **and its fixed partner** — adding $e_s+e_{\beta(s)}$ for this fixed
$\beta$. A rotation-conjugated flip $u\varphi u^{-1}$ leaves positions unchanged
and still toggles some identity-pair $\{s',\beta(s')\}$; it only changes *which*
pair, never the pairing. So conjugation stays inside $P_\beta$ (below) and adds
no new generators — the commutator collapses to the primitive. (An analysis that
reads $\beta$ as a *slot*-level involution conjugated by rotations,
$\beta_x=\pi_x^{-1}\beta_0\pi_x$, misreads the code: the partner is looked up by
*original* cell, not current slot.)

With $\beta$ fixed, $|S/\beta|=|S|/2$ ($27$ pairs on a $3\times3$), and a single
paired flip adds $e_s+e_{\beta(s)}$ to $f$. Hence the parity vectors reachable by
paired flips form

$$P_\beta=\big\langle\, e_s+e_{\beta(s)} : s\in S \,\big\rangle
        =\{\,f : f(s)=f(\beta(s))\ \forall s\,\}
        \cong \mathbb{F}_2^{\,|S|/2},$$

the **$\beta$-symmetric** vectors.

> **Proposition 4.** A residual $f$ is clearable by paired wormhole flips alone
> iff $f\in P_\beta$: each antipodal pair is flipped the same parity of times,
> $f(s)=f(\beta(s))\ \forall s$.

*Proof.* $P_\beta$ is spanned by the $e_s+e_{\beta(s)}$ and equals the
$\beta$-symmetric subspace. Reaching $0$ from $f$ by adding generators is
possible iff $f\in P_\beta$. $\square$

### 6.2 The parity invariant — why commutators add nothing

One might hope to escape $P_\beta$ with **rotation-conjugated flips**
$u\varphi u^{-1}$. They cannot, and the reason is structural.

> **Theorem 5 (Parity invariant).** Over the group generated by rotations and
> paired flips, the coset $f + P_\beta \in \mathbb{F}_2^{S}/P_\beta$ is
> invariant. Equivalently: rotations fix $f$ entirely, and every flip changes
> $f$ by a $\beta$-symmetric vector.

*Proof.* $f$ is defined on sticker *identities* through the fields
$\mathrm{curr},\mathrm{orig}$. A rotation permutes sticker records between
positions but reads and writes none of those fields (Lemma 2 setup), so it
leaves $f$ pointwise unchanged. A paired flip adds $e_s+e_{\beta(s)}\in P_\beta$.
Conjugation $u\varphi u^{-1}$ therefore adds a single $\beta$-symmetric vector
(the rotations contribute $0$); it only changes *which* pair, via the piece
that $u$ brought to the flip site — never the coset. $\square$

**Consequences.**

1. The clean **single antipodal-pair flip that changes nothing else** is not a
   commutator to be discovered — it is the native primitive $\varphi$ itself
   (`antipodalPairFlip`): it toggles exactly $\{s,\beta(s)\}$ and moves no
   piece. The commutator $u\varphi u^{-1}$ collapses to $\varphi$ up to the
   choice of target pair.
2. **Every in-game flip is paired** (`flipStickerPair`, and the chaos worker
   emits one op per pair), so starting from a solved cube the residual is always
   $\beta$-symmetric: $f\in P_\beta$. By Proposition 4 it is *always* native-flip
   clearable, in $\lVert f\rVert/2$ flips — **half** the heal count, in the
   game's own moves, with no rotations required.
3. **Heal is the unique symmetry-breaker.** The only way to leave $P_\beta$ (to
   produce an asymmetric residual with one member of a pair dirty) is the
   single-sticker heal $\eta$. Hence heal is needed in Phase 2 *only* to repair
   externally-induced asymmetry, never for cubes reached by play.

### 6.3 Implementation

`src/game/antipodalSolver.js`:

- `antipodalPairFlip(cubies, size, x, y, z, dir)` — the clean single-pair
  operator; involution; moves no piece.
- `planNativeFlipCompletion(cubies, size)` — groups residuals into antipodal
  pairs via $\beta$ and emits one flip per pair; an asymmetric residual (partner
  already home) falls back to a heal and sets `asymmetric: true`.
- `applyNativeFlipCompletion(cubies, size, plan)` — applies paired flips then
  heal fallbacks. Positions are fixed after Phase 1, so one manifold-grid map
  serves all flips.

The reversed-echo rotations in `src/game/antipodalMode.js` (a CW face turn
induces a CCW antipodal echo, `getReverseDirection`, `getAntipodalSliceIndex`)
remain the RP² orientation-reversal used to *reposition* a target pair to a
preferred flip site, but by Theorem 5 they are a convenience, not a source of
parity power.

---

## 7. Complexity

- **Phase 1:** one Kociemba solve, $O(1)$ amortised via its pruning tables;
  typically $\le 22$ HTM (see the Corollary in §5).
- **Phase 2:** one $O(|S|)$ scan for residuals; $|h|\le|S|$ heals ($\le 54$).
- **Total moves:** $\le 22$-HTM rotations (typical) $+\ \le 54$ heals. The heal
  count is per-sticker; using the native paired flip instead (§6) halves it to
  $\lceil\lVert f\rVert/2\rceil$ flips, since one flip clears a whole antipodal
  identity-pair.

---

## 8. Code map

| Concept | Symbol | Code |
|---|---|---|
| Antipodal involution | $\alpha$ | `ANTIPODAL_COLOR` (`utils/constants.js`) |
| Antipodal class rep. | $\kappa$ | `colorClass` (`game/winDetection.js`) |
| Normalised facelets | $\rho$ | `cubiesToKociembaString(_, { ignoreFlips: true })` |
| Strict solved | — | `checkRubiksSolved` |
| Quotient solved | — | `checkRubiksSolvedAntipodal` |
| Phase 1 (positions) | $g$ | `useKociembaSolver` → `kociemba-wasm` |
| Residual set | $R$, $f$ | `flipResiduals` (`game/antipodalSolver.js`) |
| Phase 2 plan | $h$ | `planStrictCompletion` / `applyStrictCompletion` |
| Residual weight | $\lVert f\rVert$ | `residualWeight` |
| Paired flip | $\varphi$, $\beta$ | `flipStickerPair` / `findAntipodalStickerByGrid` (`game/manifoldLogic.js`) |
| Single-pair operator | $\varphi$ | `antipodalPairFlip` (`game/antipodalSolver.js`) |
| Native-flip Phase 2 | — | `planNativeFlipCompletion` / `applyNativeFlipCompletion` |
| Heal | $\eta$ | `healSticker` (`game/cubeState.js`) |
| Antipodal echo turns | — | `game/antipodalMode.js` |

Tests: `src/__tests__/kociembaAdapter.test.js` (flip-tolerant $\rho$),
`src/__tests__/winDetection.test.js` (quotient solved),
`src/__tests__/antipodalSolver.test.js` (Phase 2 correctness).

---

## 9. Summary

Wormhole flips are not damage to be reset away but a second, structured
generator of the cube's symmetry. Because a flip only toggles a sticker between
`orig` and $\alpha(\mathrm{orig})$ and never moves a piece (Lemma 1) while
`orig` records the flip-invariant identity (Lemma 2), piece positions survive
any amount of flipping and are recoverable by unmodified Kociemba (Theorem 1).
Phase 1 thereby solves the RP² quotient puzzle outright (Theorem 2); Phase 2
clears residual parity to reach the classical strict solution (Theorem 3).
Because residual parity modulo the antipodal-symmetric subspace is conserved by
every rotation and flip (Theorem 5), Phase 2 also runs in the game's own
moves: the native paired flip *is* the clean single-pair operator, it clears
every in-play residual in half the ops of healing (Proposition 4), and the
single-sticker heal is the only operator that can break antipodal symmetry —
needed solely to repair externally-induced asymmetry. What remains genuinely
open is purely optimisational: shortest native-move words (via the reversed-echo
turns of `antipodalMode.js`) for repositioning a target pair to a preferred flip
site.
