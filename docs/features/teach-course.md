# Teach mode

The former Story carousel entry now opens a beginner 3×3 course. The menu cube
and demo's Teach card use the same entry. Existing turn/flip campaigns and saved
stars remain accessible through **Cube puzzle campaigns** on the lesson map.
Worm's arcade levels are unchanged.

The course has twelve lessons and one independent exercise:
notation, inverse/half turns, white cross, three white-corner cases, both
middle-edge insertions, yellow cross, Sune orientation, T corner permutation,
and the final three-edge cycle. The final exercise combines the seven solving
stages, offers an expandable reference, and supports regripping the cube.
This is one complete beginner method, not an exhaustive CFOP/OLL/PLL catalogue.

Each case is constructed by applying the inverse of its algorithm to a solved
cube with white down, yellow up and red front. Tests verify both the resulting
solve and the stage at the beginning of each case. Repetition/setup guidance is
included for use beyond the prepared case. Notation and method reference:
https://www.cubeskills.com/uploads/pdf/tutorials/the-beginners-method-for-solving-the-rubiks-cube.pdf

Practice asks the learner to choose each face turn. Watch plays the same engine
animations at 0.8 seconds per move with an additional pause, or advances once.
Incorrect button choices receive feedback without changing the cube. A drag
that diverges from the sequence can be restored to the current step. Restart
restores the actual case, rather than merely resetting the move counter.

Completion is checked against committed stickers after animation. Watching does
not mark a lesson practiced. The independent exercise accepts a solved cube in
any whole-cube orientation; showing its prepared solution or restoring a step
makes that attempt assisted. The solution is explicitly not an adaptive solver.
Saved practice IDs use `worm3-teach-course-v1`, separate from campaign stars.

The course uses the standard palette during lessons and restores the player's
palette on exit. Antipodal flips and ordinary keyboard reset/shuffle shortcuts
are disabled, and the timed gameplay HUD is hidden. The old in-game Teach
reference remains available in regular cube play.

Validation: curriculum/stage invariants, real animation commit integration,
wrong-turn recovery, restart and half turns, watch cancellation, independent
versus assisted completion, saved-data recovery, menu metadata, legacy Teach,
notation and player-progress tests. Production build and bundle budgets checked.
