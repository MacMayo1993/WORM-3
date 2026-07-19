# Solving the WORM-3 Cube Under Antipodal Identification

**A two-phase method — unmodified Kociemba for piece positions, F₂-linear parity clearing for wormhole flips — with every implementation claim pinned to code.**

*WORM-3 (World of Rubik's Manifolds) — technical note. Last updated 2026-07-19.*

---

## Abstract

WORM-3 is a Rubik's cube variant in which a ℤ₂ acts on the *colour state* rather
than the underlying geometry: a sticker travelling through a *wormhole* is
repainted by a fixed antipodal colour involution α, moving no piece. A classical
solver assumes six fixed, distinguishable colours and rejects any facelet string
whose colour counts are off, so a single flipped sticker makes an off-the-shelf
Kociemba refuse to run. This note develops the **WORM Antipodal Solve (WAS)**: a
two-phase method in which Phase 1 recovers all piece positions with an
*unmodified* Kociemba two-phase solver over normalised facelets, and Phase 2
clears residual flip parity using the game's native paired-flip operator.

We prove that flips are invertible from stored identity (Lemmas 1–2), that Phase
1 is correct on admissible states (Theorem 1) and solves the half-quotient puzzle
outright (Theorem 2), and that Phase 2's reachability is governed by a conserved
coset in an F₂-vector space of identity-indexed residuals (Theorem 3): a residual
is clearable by native flips **iff** it is symmetric under the identity pairing
β, in exactly ‖f‖/2 flips (provably optimal), with the single-sticker heal
required exactly on the asymmetric component. The pairing's identity-indexed
semantics — the fact on which the entire Phase-2 analysis stands — is established
by direct code citation (Lemma 3), and a repository-wide audit (§8) discharges
the two conditions the analysis depends on: identity fields are written only at
construction, and every in-game colour mutation applies α to an antipodal pair.

The contribution is a **solver-reuse decomposition**: lift a state-quotient
puzzle to its classical cover, solve the base with commodity tools, and clear the
fibre obstruction in a linear phase.

---

## 1. Motivation

The classical adapter (`src/game/kociembaAdapter.js`) builds a 54-character
facelet string from the painted colour `curr` of each sticker and validates that
each of the six face letters appears exactly nine times. Under wormhole play this
validation fails constantly: flips repaint stickers by α without moving any
piece, so the cube can be position-solved yet colour-scrambled, or the reverse.
The naive responses — resetting flip damage before solving, or forking the solver
to understand flipped colours — either destroy game state or forfeit the
engineering investment embodied in the classical two-phase solver and its pruning
tables.

The correct response is a decomposition. Flip damage and permutation damage live
in independent coordinates of the state, and each has a native solving
technology: Kociemba for the permutation factor, F₂-linear algebra for the flip
factor. WAS is that decomposition made precise.

## 2. Positioning

Quotient-topology twisty puzzles are an established genre. Roice Nelson's
*MagicTile* realises twisty puzzles on quotient surfaces — including the real
projective plane and the Klein bottle — by choosing a fundamental domain of a
covering tiling and identifying its edges. Independently, a "Rubik's real
projective plane" is obtained from a physical cube by identifying antipodal
cubies, so that turning the front face clockwise is automatically accompanied by
turning the back face counterclockwise — equivalently, restricting to slice
moves. These constructions quotient the **geometry**: the surface the stickers
live on, and hence the move structure.

The subsystem analysed here does something disjoint. In WAS's scope — the classic
3×3 with the full face-turn generator set, plus wormhole flips — the move
structure is entirely standard, and the ℤ₂ acts through the antipodal **colour**
involution α applied dynamically to individual stickers. The group being
quotiented acts on the colour fibre, not the base. (WORM-3 *also* ships a separate
geometric antipodal mode, `src/game/antipodalMode.js`, in which a CW face turn
induces a CCW antipodal echo; that mode is the geometric-quotient construction and
is outside WAS's scope.)

This changes which question is interesting. Geometric-quotient puzzles need
bespoke solvers because their move structure is nonstandard. WAS's move structure
is standard, so the natural question is the opposite: *how much of the classical
solving stack survives the colour-state quotient unmodified?* The answer proved
below — all of it for the position factor, with the flip factor reduced to a
27-dimensional F₂-linear problem carrying a complete one-line invariant — is a
solver-reuse theorem, and that, not the RP² framing, is the contribution.

## 3. State model

### 3.1 Stickers, identities, and the two involutions

Let 𝒮 denote the set of the 54 sticker **identities**. Each sticker object
carries immutable identity fields — `orig` (the solved-state colour), `origPos`,
`origDir` (the solved-state grid position and facing) — and mutable state fields,
including the painted colour `curr` and the flip count. Identity fields are
assigned at construction and never rewritten (Lemma 3, discharged repo-wide in
§8.1).

Two involutions organise the structure:

- **α — the antipodal colour involution** (`ANTIPODAL_COLOR`,
  `src/utils/constants.js`): a fixed-point-free involution on the six colours
  pairing each with its opposite-face colour,
  $$1\leftrightarrow4,\quad 2\leftrightarrow5,\quad 3\leftrightarrow6,$$
  i.e. F↔B, L↔R, U↔D. A wormhole flip repaints a sticker $s$ by
  $\mathrm{curr}(s)\mapsto\alpha(\mathrm{curr}(s))$.
- **β — the antipodal identity pairing**: the fixed-point-free involution on 𝒮
  sending each identity to the identity whose home colour is α(orig) at the same
  solved-state grid cell (`findAntipodalStickerByGrid`, `src/game/manifoldLogic.js`).
  It partitions 𝒮 into 27 pairs. β is a well-defined involution because it is a
  function of immutable identity fields only (Lemma 3); no claim is made here that
  it coincides with exact geometric central inversion, and none is needed — the
  Phase-2 theory uses only that β is a fixed, fixed-point-free involution with 27
  orbits.

### 3.2 Residuals

Under the admissibility invariant of §4, every sticker satisfies
$\mathrm{curr}(s)\in\{\mathrm{orig}(s),\alpha(\mathrm{orig}(s))\}$. The **flip
residual** is the identity-indexed vector

$$f\in\mathbb F_2^{\mathcal S},\qquad f(s)=\mathbf 1\{\mathrm{curr}(s)=\alpha(\mathrm{orig}(s))\}.$$

Because $f$ is indexed by identity, not by current position, **rotations act
trivially on residuals**: a face turn moves stickers but repaints nothing, so it
permutes positions while fixing every value $f(s)$. This observation — legitimate
precisely because β and $f$ are identity-indexed (Lemma 3) — is what makes the
entire Phase-2 theory rotation-free.

### 3.3 Two notions of solved

**Strict solved:** every piece in solved position and $f=0$ (`checkRubiksSolved`).

**κ-solved (half-quotient):** every piece in solved position, $f$ arbitrary;
equivalently, solved in the per-sticker quotient of the colour fibre by ⟨α⟩
(`checkRubiksSolvedAntipodal`, with `colorClass` = $\kappa(c)=\min(c,\alpha(c))$).

κ-solved is a **design choice**, not "the" projective notion. It quotients the
colour fibre but leaves the position set intact. A full state-level quotient — by
the group generated by α together with the geometric antipodal action $A$ on
slots, $X/\langle\alpha_{\mathrm{col}},A\rangle$ — identifies more states and is a
genuinely different puzzle (Open Problem 1). The full quotient would declare a
cube solved when it is solved only up to a global antipodal relabelling, which
reads as a bug to a player; κ-solved is the deliberate, playable choice, and this
note analyses that choice.

### 3.4 Lemma 3 — the pairing is identity-indexed (code citations)

> **Lemma 3.** The native pairing β used by the paired-flip operator is a fixed
> involution on sticker identities. It is not conjugated by rotations: for every
> face or whole-cube rotation $u$ and native paired flip $\varphi$,
> $u\varphi u^{-1}=\varphi$ as operators on residuals.

**Evidence.**

1. *Partner computation is identity-based.* `getManifoldGridId`
   (`src/game/gridIds.js:36–40`) builds a sticker's grid id from `sticker.orig`,
   `sticker.origPos`, `sticker.origDir`; `findAntipodalStickerByGrid`
   (`src/game/manifoldLogic.js:176–183`) derives the partner's id from those same
   immutable fields. No mutable state field enters the computation.
2. *Identity fields are immutable under rotation.* `src/game/cubeRotation.js`
   reads but never writes `orig`, `origPos`, or `origDir` (§8.1 extends this
   repo-wide).
3. *Immutability is already load-bearing.* The Sudokube win test
   (`src/__tests__/winDetection.test.js:150`, "proves values track sticker
   identity") depends on `orig*` immutability under rotation; a mutation would
   break the current suite independently of this note.

**Proof.** Since β is a function of immutable fields only, it is a fixed
involution on 𝒮. A rotation $u$ permutes positions and fixes all identity fields
and all colours; a native flip $\varphi_s$ toggles `curr` on the identity pair
$\{s,\beta(s)\}$ wherever those stickers currently sit. Hence $u\varphi_s u^{-1}$
toggles the same identity pair: rotations and native flips commute on residuals.
$\square$

*(An analysis that reads β as a slot-level involution conjugated by rotations,
$\beta_x=\pi_x^{-1}\beta_0\pi_x$, misreads the code: the partner is looked up by
*original* cell, not current slot. This is the error corrected in the Revision
history.)*

## 4. Admissibility

### 4.1 The predicate

A state is **admissible** iff every sticker satisfies
$\mathrm{curr}(s)\in\{\mathrm{orig}(s),\alpha(\mathrm{orig}(s))\}$. Admissibility
is $O(|\mathcal S|)$-decidable, is implied by reachability (Lemma 1), and is
exactly the hypothesis Theorem 1 needs.

The naive predicate — each of the six face letters appears exactly nine times —
is **necessary but not sufficient**. Counterexample: a *count-balanced
cross-mispaint*, in which two stickers of different `orig` colours exchange
painted colours outside their α-orbits. The nine-of-each count is preserved, yet
no sequence of flips produces the state, and reading `orig` for the flipped tiles
while reading `curr` for the damaged ones would emit an incoherent mixture to the
solver — garbage in, confidently wrong solution out.

### 4.2 Implementation

`cubiesToKociembaString(cubies, { ignoreFlips: true })` tests `isAdmissible`
first and returns `null` on failure, **then** reads `orig` throughout. The
nine-of-each count is retained as a cheap redundancy check on the normalised
string, not as the damage filter. The test suite includes the count-balanced
rejection case (`src/__tests__/kociembaAdapter.test.js`).

### 4.3 Status

The audit of §8.2 shows every in-game colour mutation applies only α or heal, so
inadmissible states **cannot arise from play** — `isAdmissible` is provably
redundant in normal operation. It is retained as defensive hardening against
save-file corruption, debug tooling, and future colour-mutating features, and it
makes the "forgives flips and nothing else" guarantee exact rather than
conditional.

## 5. Phase 1 — position recovery by unmodified Kociemba

### 5.1 Invertibility from stored state

> **Lemma 1 (flips move nothing).** A wormhole flip changes `curr` on an identity
> pair and changes no position field. Piece permutation and flip residual are
> independent coordinates of the state.

> **Lemma 2 (identity survives).** For every reachable state,
> $\mathrm{curr}(s)\in\{\mathrm{orig}(s),\alpha(\mathrm{orig}(s))\}$, so `orig`
> records the flip-invariant identity of each sticker; by Lemma 3 it also
> survives all rotations. Hence the map state ↦ (piece permutation) is computable
> from stored fields regardless of flip damage.

*Proof of Lemma 2.* Induction on move count. Initially $\mathrm{curr}=\mathrm{orig}$.
Rotations move the record intact; a flip sends $\mathrm{curr}\mapsto\alpha(\mathrm{curr})$,
and since α is an involution fixing neither the fibre $\{\mathrm{orig},\alpha(\mathrm{orig})\}$,
`curr` stays in that fibre. $\square$

### 5.2 Correctness

> **Theorem 1 (Phase 1 correctness).** On an admissible state, the facelet string
> built from `orig` (the `ignoreFlips` normalisation) is exactly the facelet
> string of the underlying permutation state, and unmodified Kociemba two-phase
> applied to it returns a maneuver solving all piece positions.

*Proof.* Admissibility makes `orig` the well-defined per-sticker identity, so by
Lemma 2 the normalised string is that of the flip-free cube with the same
rotation history — a legal classical state (nine of each letter; valid
permutation and orientation parity, being a genuine rotation of the solved cube).
Rotations act identically on the flipped and unflipped cubes (Lemma 3), so the
returned word homes every piece of the actual state. $\square$

> **Theorem 2 (half-quotient solve).** The Phase-1 output alone reaches a κ-solved
> state; in the half-quotient puzzle of §3.3, WAS Phase 1 is a complete solver.

*Proof.* After Phase 1 every piece is home, so $\mathrm{orig}(s)=\text{home}(s)$;
by Lemma 2 $\mathrm{curr}(s)\in[\text{home}(s)]$, hence
$\kappa(\mathrm{curr}(s))=\kappa(\text{home}(s))$. $\square$

### 5.3 Length

Kociemba two-phase output is **typically ≤ 22 HTM**. This is a statement about the
algorithm's practical output distribution, not about God's Number: the diameter
of the cube group in HTM is 20 (Rokicki et al.), but the two-phase algorithm does
not promise, and does not need, optimality — it reaches the optimum only under an
iterated-deepening configuration.

## 6. Phase 2 — flip parity in the native operator

### 6.1 The flip space

The game's native Phase-2 generator is the **paired flip**: for an identity $s$,
the operator $\varphi_s$ toggles $f$ on $\{s,\beta(s)\}$, i.e. adds $e_s+e_{\beta(s)}$
to the residual (`flipStickerPair`, `src/game/manifoldLogic.js`). Let

$$P_\beta:=\operatorname{span}_{\mathbb F_2}\{\,e_s+e_{\beta(s)}:s\in\mathcal S\,\}
=\{\,f:f(s)=f(\beta(s))\ \forall s\,\},\qquad \dim P_\beta=27.$$

By Lemma 3 the operators $\varphi_s$ are rotation-invariant, so $P_\beta$ is the
*entire* reachable set from $0$ under game moves that touch colour: face turns act
trivially on residuals, flips add pair vectors, and there is no conjugation
enlargement. With the actual identity-indexed pairing, the naive $P_\beta$
analysis is not naive — it is correct.

### 6.2 The conserved coset

Define the **asymmetry map** indexed by the 27 identity pairs,

$$\Delta:\mathbb F_2^{\mathcal S}\to\mathbb F_2^{27},\qquad \Delta(f)_{[s]}=f(s)+f(\beta(s)),$$

so that $\ker\Delta=P_\beta$.

> **Theorem 3 (parity invariant).** For any admissible state with residual $f$:
>
> 1. Every game move (face turn, whole-cube rotation, native paired flip)
>    preserves the coset $f+P_\beta$; equivalently, $\Delta(f)$ is conserved.
> 2. $f$ is clearable to $0$ by native paired flips **iff** $\Delta(f)=0$ (i.e.
>    $f$ is β-symmetric).
> 3. When clearable, `planNativeFlipCompletion` — one flip per fully-flipped
>    identity pair — clears $f$ in exactly $\lVert f\rVert/2$ flips, and this is
>    optimal: each flip changes the residual on exactly two coordinates, and the
>    27 pair-supports are disjoint.
> 4. The single-sticker **heal** (`healSticker`, $\mathrm{curr}\mapsto\mathrm{orig}$)
>    is the unique generator that changes $\Delta$. The minimum number of heals
>    taking $f$ to a clearable residual is $\lVert\Delta(f)\rVert$, achieved by
>    healing the dirty sticker in each asymmetric pair.

*Proof.* (1) Face turns and rotations fix $f$ pointwise (§3.2, Lemma 3); flips add
elements of $P_\beta=\ker\Delta$. (2) "If": a β-symmetric $f$ is the sum of its
fully-flipped pair vectors, each killed by one flip. "Only if": (1) with target
$0$. (3) The plan realises that decomposition; the lower bound is the
two-coordinate observation together with disjointness of the 27 pair-supports,
which forces at least one flip per dirty pair. (4) Heal toggles one coordinate of
$f$, hence one coordinate of $\Delta$ (the pair $[s]$); an asymmetric pair needs
exactly one such toggle, and flips cannot change $\Delta$, so $\lVert\Delta(f)\rVert$
heals are necessary and sufficient. $\square$

> **Corollary (heal semantics).** Heal fires exactly when $\Delta(f)\neq0$. By the
> audit of §8.2 every in-game flip is β-symmetric, so $\Delta\equiv0$ invariantly
> in play: **heal is dead code for any cube reached by normal play, and Phase 2 is
> complete with native flips alone.**

### 6.3 What is not needed

Because β is identity-indexed, the following is objectless and is *not* part of
WAS: rotation-conjugated flips as new parity generators, an orbit-type invariant
finer than $\Delta$, setup-word minimisation over slot-pair stabilisers, and a
minimum-weight-matching formulation of flip scheduling. Each is the correct theory
of a *different* puzzle — one whose pairing rides on slots rather than identities
— and is recorded here only so the distinction cannot be re-litigated (see
Revision history).

## 7. The WAS algorithm

Given an arbitrary state:

1. **Admissibility gate.** Reject if `isAdmissible` fails (§4).
2. **Phase 1.** Build the `orig`-normalised facelet string; run unmodified
   Kociemba; execute the returned maneuver. Result: κ-solved (Theorem 2),
   typically ≤ 22 HTM.
3. **Phase 2.** Compute $f$ and $\Delta(f)$. If $\Delta(f)\neq0$, heal the dirty
   sticker in each asymmetric pair ($\lVert\Delta(f)\rVert$ heals — never triggered
   in normal play, §8.2). Run `planNativeFlipCompletion` ($\lVert f'\rVert/2$ flips
   on the post-heal residual $f'$). Result: strict solved (Theorem 3).

Both phases are deterministic and Phase 2's cost is exact:
$\lVert\Delta(f)\rVert$ heals $+\ \lVert f'\rVert/2$ flips.

## 8. Implementation audit

The Phase-2 theory rests on two empirical facts about the code. Both are here
discharged repository-wide.

### 8.1 Identity immutability (closes the Lemma 3 residual)

A repository-wide search for writers of `orig`, `origPos`, `origDir` across
`src/` finds exactly two, neither a mutation of an existing identity:

- `src/game/cubeState.js:13–18` — construction (`makeCubies`), the sole assignment
  of identity fields.
- `src/game/cubeState.js:48` — `clone3D` copies `origPos` **by value**, preserving it.

No reorientation, serialisation, undo, or scramble path rewrites identity fields.
Whole-cube reorientation and undo operate by moving or deep-copying records
(`clone3D` preserves `origPos`), never by rebasing identity. Lemma 3 therefore
holds repository-wide, not merely within `src/game`.

### 8.2 Colour-mutation coherence and β-pairing (closes admissibility and Δ≡0)

A repository-wide search for writers of `curr` finds, outside tests, exactly these
mutations — every one either heal or an α-flip on a β-pair:

| Site | Operation | Coherent (α or heal) | β-paired |
|---|---|---|---|
| `cubeState.js:37` (`healSticker`) | `curr = orig` | heal | — |
| `manifoldLogic.js:211` (`flipStickerPair`) | `curr = α(curr)` | α | yes (`findAntipodalStickerByGrid`) |
| `chaosSim.js:160,181` | `curr = α(curr)` | α | yes (pair loop) |
| `useChaosWorker.js:46,79` | `curr = α(curr)` | α | yes (`findAntipodalStickerByGrid`, :54–56) |
| `MainMenu.jsx:382,385` | `curr = α(curr)` | α | yes (`MENU_FLIP_PAIRS`, antipodal) |

Two consequences follow:

- **Admissibility is invariant.** `curr` starts at `orig` and every mutation maps
  the fibre $\{\mathrm{orig},\alpha(\mathrm{orig})\}$ to itself (heal → `orig`,
  α-flip → the other member). So every reachable state is admissible, discharging
  §4.3.
- **Δ ≡ 0 is invariant.** Every flip toggles a full β-pair $\{s,\beta(s)\}$, an
  element of $\ker\Delta$. So $\Delta(f)=0$ for every state reached by play, and by
  the Corollary of §6.2 heal never fires in normal operation.

Both facts are properties of the current code; a future colour-mutating feature
that painted non-antipodally, or flipped a non-β pair, would reopen the
corresponding item, which is why the `isAdmissible` gate and the $\Delta$
computation in `planNativeFlipCompletion` are retained rather than optimised away.

## 9. Open problems

1. **Full quotient.** Whether the $X/\langle\alpha_{\mathrm{col}},A\rangle$ win
   condition of §3.3 admits a two-phase solve, and what its Phase-2 invariant is.
   The geometric action $A$ moves slots, so the identity-indexed triviality of
   §3.2 does not transfer; this is the one setting where a
   conjugation-style slot analysis genuinely applies.
2. **Positioning follow-up.** A comparative note against MagicTile-class geometric
   quotients (§2), stating the state-quotient / solver-reuse pattern as a general
   recipe: lift to the classical cover, solve the base with commodity tools, clear
   the fibre obstruction linearly.

## 10. Summary

Wormhole flips are not damage to be reset away but a second, structured generator
acting on the colour fibre of a standard cube. Because flips move nothing (Lemma
1) and identity fields survive everything (Lemma 2, Lemma 3, discharged repo-wide
in §8.1), the state factors: unmodified Kociemba solves the permutation factor on
`orig`-normalised facelets of any admissible state (Theorem 1), reaching the
κ-solved half-quotient outright (Theorem 2), and the flip factor is a
27-dimensional F₂-linear problem whose complete invariant is the per-pair
asymmetry $\Delta(f)$ (Theorem 3): clearable iff symmetric, in exactly ‖f‖/2
native flips, with heal required exactly and only on asymmetric pairs — and, by
the audit of §8.2, never in normal play. The pairing's identity-indexed
semantics, the single fact on which all of this stands, is pinned to the
implementation by code citation.

## Code map

| Concept | Symbol | Code |
|---|---|---|
| Antipodal colour involution | α | `ANTIPODAL_COLOR` (`utils/constants.js`) |
| κ-class representative | κ | `colorClass` (`game/winDetection.js`) |
| Antipodal identity pairing | β | `findAntipodalStickerByGrid` (`game/manifoldLogic.js`) |
| Admissibility predicate | — | `isAdmissible` (`game/kociembaAdapter.js`) |
| Normalised facelets | ρ | `cubiesToKociembaString(_, { ignoreFlips: true })` |
| Strict / κ solved | — | `checkRubiksSolved` / `checkRubiksSolvedAntipodal` |
| Phase 1 (positions) | $g$ | `useKociembaSolver` → `kociemba-wasm` |
| Residual set / vector | $R$, $f$ | `flipResiduals` (`game/antipodalSolver.js`) |
| Single-pair flip | $\varphi$ | `antipodalPairFlip` |
| Native-flip Phase 2 | — | `planNativeFlipCompletion` / `applyNativeFlipCompletion` |
| Heal | $\eta$ | `healSticker` (`game/cubeState.js`) |

Tests: `src/__tests__/kociembaAdapter.test.js` (flip-tolerant ρ; admissibility
rejection of count-balanced damage), `src/__tests__/winDetection.test.js`
(κ-solved), `src/__tests__/antipodalSolver.test.js` (Phase 2 correctness; native
paired-flip completion; asymmetric heal fallback).

---

## Appendix — Revision history

This paper was developed through an adversarial review process; the record is
kept because one revision embedded a subtle, fully-rigorous error whose only
detector was the source code.

- **Initial draft.** Established the two-phase method: flip-invariance (Lemmas
  1–2), position recovery by unmodified Kociemba (Theorem 1), the κ-solved
  half-quotient (Theorem 2), and heal-based Phase 2 (Theorem 3, heal form). Three
  defects, all corrected later: (a) admissibility was filtered by the
  nine-of-each colour count, which is necessary but not sufficient; (b) the
  Phase-1 length was stated as "≤ 20 (Kociemba bound)", conflating God's Number
  (the group diameter) with single-pass two-phase output; (c) the κ notion was
  called "the honest RP² notion", overstating a design choice.

- **Adversarial review (retracted).** A review inferred, from the prose alone,
  that the native pairing β was *position*-indexed and therefore conjugated by
  rotations ($\beta_x=\pi_x^{-1}\beta_0\pi_x$), and built an internally consistent
  correction on that premise: a (ℤ/2)⁵ orbit-type grading in place of the coset
  invariant, a rotation-conjugated `conjugatedPairFlip`, a completeness theorem, a
  setup-word minimisation problem, and a Blossom-matching formulation of flip
  scheduling. Every proof was valid *conditional on that premise*. The premise is
  an empirical claim about the code, and it is **false**:
  `findAntipodalStickerByGrid` computes the partner from immutable identity fields
  (`orig`, `origPos`, `origDir`), not from current position. The entire apparatus
  is withdrawn (§6.3). The review's three secondary corrections were genuine and
  are retained: the admissibility predicate (§4), the length claim (§5.3), and the
  half-quotient framing (§3.3).

- **Reconciliation and audit (this paper).** The identity-indexed parity theory is
  restored and stated over identities, pinned to the implementation by Lemma 3
  with file-and-line citations. The two conditions the theory depends on are
  discharged repository-wide in §8: identity fields are written only at
  construction (§8.1), and every in-game colour mutation is a heal or an α-flip on
  a β-pair (§8.2), which makes admissibility invariant and heal dead code in
  normal play. The remaining open items are the full state-level quotient (Open
  Problem 1) and a positioning note (Open Problem 2).

Two standing rules came out of this process and govern the paper:

1. **Implementation claims carry code citations.** Any lemma whose truth depends
   on what the code does cites file and line. A formalisation of a program that
   does not cite the program is a formalisation of a guess.
2. **Documents do not arbitrate documents.** When two rigorous analyses disagree
   about implementation semantics, neither is evidence; the repository is. The
   §8 audit is that arbitration carried out in full.

*Test status at publication: 650/650 passing, lint clean.*
