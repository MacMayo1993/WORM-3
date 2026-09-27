# Intro-inspired Möbius tunnels

The focus tunnels combine the opening passages' translucent walls, spaced ribs,
and spiral light with the game's existing half-twisted ribbon. The colored spine
has a satin finish and pearly edge lips. Two translucent sides curl upward from
its edges, leaving the top open so the ribbon, worm, and core remain visible.
The obsolete floating portal squares at the core have been removed.

The decorative sides use the rendered floor and rail buffers as their frame;
they do not define another centerline or move the worm, camera, or floor. They
inherit the half-twist, slice turns, occupied-route zoom rules, and flip motion.
Their radius fades to zero at the mouths and core docks, and the same aperture
half-space guard bounds every curl. Growth, colors, pulses, and the animation
clock are shared with the main band. Custom tile patterns retain their designs.
The spine, styled surfaces, and curls share a per-vertex arc-distance attribute
for spiral phase. It is sampled before Float32 UV conversion, so asymmetric arms
and the two distinct core docks keep the correct distances across the hidden gap.
The curls also continue the spine's cross-strip coordinate at both welded edges.

One extra mesh draws both curled sides of each detailed tunnel, with normal
alpha blending and no depth writes. Geometry changes only when the band rebuilds;
spiral light animates in the shader. There are no new textures, lights, offscreen
camera passes, or postprocessing effects. Reduced FX omits and disposes the
decorative mesh; reduced motion freezes the shared finish clock. Resting cords
keep their existing merged rendering budget.

Checks cover welded edges, open topology, aperture containment, unchanged floor
buffers, dock collapse on all six faces including size 15, reduced FX disposal,
and the existing ride/zoom and raised-mouth regressions. Actual WebGL previews
cover ordinary, WORM, and styled bands, including close and onboard views.
