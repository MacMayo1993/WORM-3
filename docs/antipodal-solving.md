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
flip parity. We prove correctness of both phases and close with the open problem
of clearing parity using only the game's native *paired* wormhole flips, which
motivates a library of **antipodal commutators**.

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

The quotient notion is the honest RP² notion: on the projective plane a colour
and its antipode are the *same point of the quotient manifold*, so a face is
solved when it is uniform **up to** $\alpha$. Strict $\Rightarrow$ quotient; the
converse fails exactly on flipped tiles.

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

**Implementation.** `cubiesToKociembaString(cubies, { ignoreFlips: true })`
computes $\rho$: it reads `orig` **only** when
$\mathrm{curr}\in\{\mathrm{orig},\alpha(\mathrm{orig})\}$ (a genuine flip, by
Lemma 1); any other paint — manifold recolouring, non-antipodal chaos damage —
is read as `curr` and rejected by the nine-of-each check. Forgiveness is thus
surgical: it forgives flips and nothing else.

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

**Corollary.** WAS solves any cube reachable by rotations and wormhole flips,
under the strict definition, in $|g|+|h|$ operations with $|g|\le 20$ (Kociemba
bound) and $|h|=$ residual weight $\le |S|$.

---

## 6. Clearing parity with paired flips (open problem)

Phase 2 as implemented uses **heal**, a single-sticker operator. The game's
*native* colour operator is the **paired wormhole flip**: flipping $s$ also
flips its antipodal partner $\bar s=\alpha\text{-image of }s$
(`findAntipodalStickerByGrid`, `flipStickerPair`). It is natural to ask whether
parity can be cleared with flips alone — the "topologically pure" completion.

### 6.1 The parity space

Model residual flip parity after Phase 1 as a vector
$f\in\mathbb{F}_2^{S}$, $f(s)=[\mathrm{curr}(s)\neq\mathrm{orig}(s)]$. Strict
completion needs to reach $f=0$. The antipodal pairing is a fixed-point-free
involution $\beta:S\to S$, $\beta(s)=\bar s$, with $S/\beta$ of size $|S|/2$
(e.g. $27$ pairs on a $3\times3$).

A single paired flip adds the indicator $e_s+e_{\beta(s)}$ to $f$. Hence the
subgroup of parity vectors reachable by paired flips is

$$P_\beta=\big\langle\, e_s+e_{\beta(s)} : s\in S \,\big\rangle
        =\{\,f : f(s)=f(\beta(s))\ \forall s\,\}
        \cong \mathbb{F}_2^{\,|S|/2},$$

the **$\beta$-symmetric** vectors.

> **Proposition 4.** A post-Phase-1 residual $f$ is clearable by paired
> wormhole flips alone iff $f\in P_\beta$, i.e. iff each antipodal pair is
> flipped the same parity of times: $f(s)=f(\beta(s))$ for all $s$.

*Proof.* $P_\beta$ is spanned by the $e_s+e_{\beta(s)}$ and equals the
$\beta$-symmetric subspace (each generator is symmetric, and any symmetric
vector is a sum of generators over a transversal of $S/\beta$). Reaching $0$
from $f$ by adding generators is possible iff $f\in P_\beta$. $\square$

So heal is strictly more powerful: it realises all of $\mathbb{F}_2^S$, while
paired flips realise only the index-$2^{|S|/2}$ subspace $P_\beta$. Asymmetric
residuals (one member of a pair flipped, the other not) are **not** paired-flip
clearable.

### 6.2 Antipodal commutators

The escape is to enlarge the flip toolkit with **rotation-conjugated flips**.
For a rotation word $u$ and a paired flip $\varphi$, the conjugate
$u\varphi u^{-1}$ flips a *different* pair of positions while returning all
pieces home — a colour-only operator with controllable support. Sequencing such
conjugates (an **antipodal commutator**, the flip analogue of the OLL/PLL
commutators in `src/teach/algorithms.js`) can move residual parity between pairs
and, in particular, realise a targeted **single-pair flip that changes nothing
else**. Characterising the group generated by
$\{\,u\varphi u^{-1}\,\}$ inside $\mathrm{Sym}(S)\ltimes\mathbb{F}_2^S$ — and
finding short words for the single-pair generator — is the natural next result,
and would let Phase 2 run entirely in the game's native moves. The engine
already exposes the required reversed-echo rotations in
`src/game/antipodalMode.js` (a CW face turn induces a CCW antipodal echo,
`getReverseDirection`, `getAntipodalSliceIndex`), which is the RP²
orientation-reversal these commutators exploit.

---

## 7. Complexity

- **Phase 1:** one Kociemba solve, $O(1)$ amortised via its pruning tables;
  $\le 20$ quarter/half turns.
- **Phase 2:** one $O(|S|)$ scan for residuals; $|h|\le|S|$ heals ($\le 54$).
- **Total moves:** $\le 20$ rotations $+\ \le 54$ heals. Move *count* is linear
  in stickers only because heal is per-sticker; with a solved single-pair
  antipodal commutator of length $\ell$ (§6.2), Phase 2 becomes
  $\le \lceil|h|/2\rceil\cdot\ell$ rotations with no heals.

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
clears residual parity to reach the classical strict solution (Theorem 3). The
one genuinely open piece is doing Phase 2 in the game's native paired flips,
which is possible exactly on $\beta$-symmetric residuals (Proposition 4) and in
general requires an antipodal-commutator library (§6.2) — the concrete next
build.
