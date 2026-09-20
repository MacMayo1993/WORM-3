# Reach, sag and pull: reviewed first milestone

This is a development fixture using the real Classic worm renderer. It establishes body-length and contact rules before live exploded-cube integration. It is not the finished game mode or a general rope physics solver.

## Production fix and branch bases

The expansion-scale correction is a separate production change, commit `362df4e` on **`codex/worm-expansion-scale`**. Its PR base is **`main`**, which now includes the rocket refinement. It corrects a live 4×4-and-up discrepancy: the lattice renderer used 1.53 while analytic tunnel positions and highlights used 1.8. The shared helper now covers cubie rendering, sticker coordinates, tunnel paths, highlights, smart routing, and inverse grid recovery.

The inverse fallback in `IntroCubie` uses the same scale. In this checkout, the current intro is instanced and does not import `IntroCubie`; no intro choreography change is implied.

This fixture lives on **`codex/worm-reach-sag-foundation`**. Its intended PR base is **`codex/worm-expansion-scale`**, so its diff excludes the production fix. If that base merges first, rebase the fixture onto the merged base before retargeting. The old combined local commit `ea7dc03` is preserved on `codex/worm-gap-original-ea7dc03` for comparison; it is not the submission branch. The publication stack is `main` → `codex/worm-expansion-scale` → `codex/worm-reach-sag-foundation`. A checkout of another branch will not contain the fixture.

## Run the fixture

Run `npm run dev`, then visit the Vite address with `/WORM-3/?gapLab=1`.

Hold **R** or **HOLD TO REACH**. Release before the catch to retract. Once caught, the worm settles and pulls its body over. **RESET** starts another crossing. A toggle control is also available. Pause freezes traversal; losing focus pauses and releases input.

Adjust gap width, carried ordinary orbs, landing height, and a blocking obstacle. Glass changes the test supports, not the production material system. Diagnostics show supported, hanging, and landed length and support reservations. The fixture intentionally selects Classic; it does not expose Prism or other character gameplay.

## Implemented behavior

- Body centerline length is `(segments - 1) * 0.09`. The fixture's ordinary pickups add three segments, or 0.27 length units. Material is never created at catch.
- Admission reserves 0.18 at each end and a 0.045 margin. It checks actual segment count. A pickup forecast is explanatory and does not grant admission.
- Plant → reach → catch → sag → pull → tail release → complete. Early release retracts the occupied approach. Release after catch permits completion.
- Before catch, only departure supports the occupied prefix of a prescribed motor trajectory. The destination becomes attached on contact. Settling increases sag while the head remains at the destination and material is drawn from departure.
- Contact shoulders clear island lips before the free span bends. The departure reservation remains after the head lands and clears when the tail leaves departure. The landing reservation remains until the hanging span is empty.
- The renderer samples one piecewise-linear centerline by cumulative chord length. Its partition into departure/free/landing material conserves that length. Face and body share the optional sampler; the solid-cube clearance code does not project fixture segments out of empty space.
- Epoch invalidation returns this isolated fixture to its initial support. This reset is not a production recovery policy.

## Sag family, bracket, and error bounds

The solver does not impose all body length on the gap. Given total length `L`, the available span budget is `B = L - 2(0.18) - 0.045`. It chooses the requested sag when that fits; otherwise it reduces sag within `[0, requestedSag]`.

Let `h > 0` be horizontal free-span width after two fixed shoulders of length `c`, `r` the landing height difference, and `d >= 0` sag depth. In a frame whose vertical axis is `up`, the quartic Bezier has

```
x(t) = h t
y(t) = r(3t² - 2t³) - 16d t²(1-t)²,     0 <= t <= 1
A(d) = 2c + integral sqrt(h² + y'(t)²) dt.
```

This is a one-parameter family, not a catenary or an arbitrary elastic rod. Its endpoint tangents are horizontal.

**Monotonicity.** Write `y' = a(t) - d b(t)` where `a(t) = 6r t(1-t)` and `b(t) = 32t(1-t)(1-2t)`. Under `t -> 1-t`, `a` is unchanged and `b` changes sign. Paired speed terms are `f(a-db) + f(a+db)` with `f(v) = sqrt(h²+v²)`. Because `h > 0`, `f` is strictly convex. The pair is even and strictly increasing in positive `d` wherever `b != 0`. Integrating gives strictly increasing `A(d)` on `d >= 0`, including unequal-height landings. The derivative at `d = 0` is zero; this does not prevent strict increase away from zero.

**Length enclosure.** On each subdivided Bezier interval, chord length is a lower bound and control-polygon length an upper bound on exact arclength. Subdivision divides the error budget between children. Summing accepted leaves gives:

```
length <= A(d) <= lengthUpper
lengthUpper - length <= 0.00001.
```

Sampling uses the lower-bound polyline length. Admission uses `lengthUpper`. Shoulder lengths are added equally to both bounds. Reaching the subdivision limit without resolving the budget throws; it never silently accepts a coarse curve. These are geometric bounds implemented in floating-point arithmetic, not an interval-arithmetic proof of machine rounding.

**Conservative bisection.** Zero sag must satisfy `lengthUpper <= B`, or admission fails. If requested sag fits, it is returned and unused budget is permitted. Otherwise the bracket retains a feasible lower sag and an upper sag whose upper length bound exceeds `B`; the latter can include at most `0.00001` of uncertainty around the true root. Bisection returns only a feasible curve. For a budget-constrained fit, `B - length <= 0.0001`. Failure to reach that tolerance within 64 iterations throws. An uncertain boundary may conservatively reject a feasible span; it never intentionally admits against the lower bound.

The fit tolerance is **450 times smaller** than the 0.045 gameplay margin; length-enclosure uncertainty is **4,500 times smaller**. Quantized ordinary growth can leave almost 0.27 extra supported length. That surplus is not grounds to reduce the margin.

**Collision is a separate bound.** A Bezier interval lies inside its control-point convex hull. The maximum control-point distance to the segment bounds curve-to-chord deviation. The checker inflates each AABB by body radius plus that interval's deviation, with subdivision targeting 0.0002. This bounds static curve collision independently of root-fit tolerance. The fixture's body radius is 0.10. It does not establish swept collision against moving cubies, arbitrary character geometry, or time-varying obstacles.

## Timing guarantee

The simulation runs fixed `1/120` second ticks. With the same initial state and tick-indexed inputs, and without cap saturation, equal accepted elapsed time produces equal tick state up to floating-point accumulator tolerance. Tests exercise 30, 60, 90, 120, and 144 Hz, nonzero end remainders, and jittered frame intervals. The latter two rates exercise fractional carry; they are still rationally commensurate with 120 Hz.

The fixture renders the latest completed tick. **There is no interpolation between simulation ticks.** These tests do not promise visually identical frames at unequal presentation times or identical tick assignment for inputs delivered on different browser frames.

An active frame accepts at most 0.1 seconds. Cap saturation records received, accepted, and dropped time in a `time-cap` event and cumulative counters. Wall-clock equivalence intentionally stops at that event. The bounded diagnostic event ring is not a persistent replay log; replay support must record inputs, ticks, and cap events durably. Paused wall time is intentionally ignored.

## Pickup growth and live character integration

The Classic fixture's “ordinary orbs needed” is explicitly a 0.27-unit forecast. `missingPickupsForGrowth` accepts a per-pickup growth schedule, handles a changing quantum, and reports unreachable length above the 1,200-segment cap. Its tests include a four-segment pickup followed by three-segment pickups; dividing the whole deficit by four would undercount after the bonus expires.

A production adapter must obtain that schedule from actual pickup resolution, including Prism's active state, remaining charges, eligibility, and capacity. A charge alone does not guarantee a bonus: current refraction also requires a needed target color. If future eligibility or expiry is unknown, show exact missing **segments/length** plus a labeled ordinary-pickup estimate. Do not present an optimistic Prism count as guaranteed. This fixture does not yet integrate that adapter.

## Chosen integration policies — not yet implemented

These decisions precede live cubie route discovery. They are requirements for the next milestone, not claims about current gameplay.

### Rotation: occupied crossings are cuttable; forced deadlines do not wait

- Timed/forced rotations execute on their existing game-clock deadline. Crossing reservations cannot postpone them. Manual turns and explosion changes affecting occupied supports are rejected while occupied, with an immediate visible reason; they do not enter an unbounded queue.
- Before catch, a known conflicting rotation triggers retraction only if retraction can finish before the deadline. Otherwise the deadline still wins. Candidate previews warn about the threatened span and reject a new reach that cannot complete or retract before a known conflict.
- At a forced turn, test the actual occupied traversal centerline against the physical slice sweep using the established slice-cut clearance. A planned but empty span is not worm material.
- An intersecting cut invalidates the crossing lease immediately and applies the normal retained-head/tail-cut rules. If the head retains a valid landing support, switch the surviving material to a one-support recovery/pull state. If the head has no valid support or the cut is fatal, use the game's damage/death outcome. Never teleport to departure, manufacture length, or delay the rotation.
- Moving a support invalidates that contact even when a simple span/slice test misses it. This contact-loss path needs the same support-or-death decision. Unaffected crossings can continue.

Required tests: longest admitted crossing cannot block the countdown; pre-catch interruption; post-catch body cut; support moves without a body intersection; fatal cut; surviving supported head; collision sampled before transform commit. The fixture's epoch reset does not satisfy these tests.

### Length: freeze traversal material; queue elective deltas until fully supported

- Admission creates a lease over the current segment/material interval. During occupancy, ordinary earned growth and voluntary healing expenditure are recorded as ordered, uniquely identified pending transactions. A pending healing spend reserves inventory immediately, but the heal effect and shrink commit together at settlement. It cannot be spent twice.
- Settle when **all hanging material has cleared**, or after an early retraction returns fully to support. “Tail release” from the departure alone is too early: the body can still hang from the landing then.
- Preserve each pickup's resolved growth at pickup time; do not recompute it after a Prism charge expires. Update actual inventory/score according to existing award rules once, show growth as pending, and keep pending awards separate from spendable material until settlement. Clamp growth at the existing maximum in transaction order.
- Damage and forced cuts bypass this elective queue: they invalidate the lease immediately and enter the cut/recovery/death policy above. Crossing must never grant temporary invulnerability. Nonfatal settlement then applies earned growth to surviving supported material and cancels uncommitted healing reservations; death uses the existing run-loss rules and discards the body-growth queue.
- Pause freezes both the gameplay clock and lease progress. Geometry changes cannot strand an active lease indefinitely: manual changes are rejected, forced changes preempt. A future implementation that allows stopped pull motion must add an explicit deadline/recovery transition before enabling that behavior.

Required tests: pickup then heal versus heal then pickup; charge expiry; tail cap; canceled healing refunds its reservation; forced cut with pending growth; death with pending transactions; reset/retry cannot duplicate rewards; ledger equality every occupied tick.

## Validation and remaining work

Before rebasing onto the latest main, the separate geometry commit passed full `npm run ci`: **2,198 tests in 183 files**, lint with zero errors, production build, and bundle budgets. The 5×5/full-explosion regression mounts actual Cubie scene objects and compares both world-space tunnel anchors; decal rendering and the GL driver are mocked. Forward/inverse coordinate tests cover size 3 and larger intro fallback lattices.

Before rebasing onto the latest main, the revised fixture also passed full `npm run ci`: **2,220 tests in 187 files**, lint with zero errors (existing warnings remain), production build, and the new bundle audit.

The fixture adds numerical integration comparisons, certified sampled monotonicity, solver bracket/tolerance tests, non-divisor and jitter timing, cap-event recording, and per-pickup growth forecasts, alongside reach/retract/pause/conservation and real body-position tests. The build now emits a Rollup module audit. `bundle:check` rejects fixture modules in any production chunk, including merged static imports, and fails if the audit is absent. A regression build tests both exclusion and a deliberately used static import.

GPU visual/playability review remains outstanding. Next: tune the fixture's motion, implement and test the above policies, construct real cubie supports/routes, wire live inventory, then add production Glass/Lego presentation, multiple crossings, character-specific clearance, and mobile/camera/performance gates. Full-mode release remains gated on those steps.
