# Jump rescue window

Normal WORM and combat runs now offer a 0.5-second jump prompt when the grounded
head starts a step into an occupied body tile. Guided demo lessons keep their
existing scripted timing.

The candidate must still exist in the live trail. Tunnel entry, existing jumps,
rocket/landing protection, rotation grace, active Shed Skin, and unavailable jumps
do not trigger a prompt. Detection uses the existing tile collision model; this
change does not replace it with mesh collision detection.

During the prompt:

- Movement, trail recording, survival rewards, buffs and spawning clocks stop.
- Enemies, shots, bombs and the rotation hazard countdown stop. In-flight GSAP
  layer turns pause synchronously with the prompt.
- Jump gets a steady outline, a “JUMP NOW” label and a shrinking countdown bar.
  There is no flashing or camera shake. Touch and Space use the same input path.
- Jump resumes with a physical hop. Other gameplay inputs cannot accumulate.
- Opening Pause or switching to a background tab holds the remaining time.
  Retry, death and leaving WORM clear it.

Missing the window resumes the original collision check. The same collision
candidate cannot open another window. A later body encounter can offer a new one;
there is no additional cooldown in this initial version.

## Jump geometry

The contact threshold remains 40% of the tile step. The prompt is offered during
the first 10%, with no forward travel during the countdown. The accepted hop uses
the normal jump height and extends its span to at least 1.25 tile steps:

`height(u) = jumpHeight × sin(πu)`, with `u = traveledTileSteps / jumpSpan`.

This keeps the head raised as it leaves the occupied tile instead of landing on
that same body. Longer corner/spring jumps retain their normal span. Real height
clearance still applies; the prompt does not grant collision immunity, and a new
obstacle at the landing can still be dangerous.

## Validation

Simulation regressions cover timeout, last-moment input, no repeated prompt for a
single candidate, clock/trail freezes, cut-body revalidation, death/reset cleanup,
existing protection, and completed landings. Traversal cases include sizes 2, 3,
5 and 15, speeds 0.5–3.5, boost, and 30/60/120 Hz.

React integration tests run the real crawler, HUD and keyboard/touch handlers;
they verify the prompt, gameplay/combat holds, successful landings, Pause and
retry. Scheduler tests verify bomb fuses and rotation dispatch remain frozen,
including the prompt's release frame.

Device playtesting is still needed to judge the half-second reaction window and
prompt frequency. These tests do not certify the rendered GPU appearance.

To keep the existing startup bundle budget, the character preview now loads its
canvas relocation component only when a preview opens. The existing preview
subscription stays lightweight; canvas restoration and resizing remain covered
by the preview tests. Bundle budgets are unchanged.
