# Slice cuts at the body intersection

The slice detector previously found a visited tile, converted its trail index
into a bead count, and kept `index × 50` history records. The renderer instead
walks the actual path by distance. A partial tile step, corner, jump, dense
history or contracted Inch body therefore put the cut and its effect at different
places. Truncating history without enough distance could also stack surviving
beads at its endpoint.

Slice damage now intersects the occupied centre-line with the two boundaries of
each turning layer before rotation begins. It includes the live head/history
bracket, measures distance through bends, and stops at the actual trailing bead.
Outer layers include their lifted surface beads. Tunnel records are excluded from
slice intersections; the existing scheduler still holds turns while a tunnel is
occupied.

For a seam distance `s`, retained bead `i` satisfies:

`bodyDistance(i) ≤ s − 0.09`

Ordinary beads use `bodyDistance(i) = i × 0.09`. Inch uses its shared contracted
gait. The gait is now advanced by the simulation and consumed by both rendering
and damage, so a cut does not depend on a capped effects feed or camera LOD.

The final retained history bracket is clipped to the intersection and inherits
the head-side rotation tags. This preserves interpolation while preventing the
moving layer from pulling that bracket across the opening. The cut never grows
the body, and carried orb colors and spendable inventory are reconciled to the
remaining segment capacity. Effects and the cut camera use the same intersection.

Fatal hits also sever at the intersection, then stop gameplay before dispatching
the turn. They no longer rotate an intact corpse underneath its stationary head.
A neck cut that cannot retain the minimum living body is fatal rather than
extending the retained body back across the seam. Whole-body layer rides, rocket
protection and death priority across multiple turning planes remain supported.

The damage decision still happens once at turn start. This does not introduce
continuous cutting during an already-running rotation or replace bomb damage's
tile-based detection. Cosmetic lateral wiggle is not an independent damage path.

Regression coverage includes all three slice axes on sizes 2, 3, 5, 7 and 15;
sparse/dense history, bends, partial steps, old history beyond the visible tail,
long bodies, multi-plane death priority, neck cuts, Inch contraction and inventory.
A CPU test reads production body instance matrices and verifies the severed beads
remain absent while the adjacent layer turns through 90 degrees. Scheduler tests
verify a fatal hit stops further rotation dispatch.

These checks cover geometry and game state. A device playthrough remains needed
to confirm the appearance of the reported scene.
