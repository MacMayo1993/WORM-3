# Book, Prism and Inch visual upgrade

The character picker and Worm gameplay share the new geometry, finishes and face accessories.

| Character | Appearance |
| --- | --- |
| Book Worm | More curled paper edges, tighter page stacks, printed ink lines and gold margins, restrained page flutter, connected brass spectacles and amber irises. |
| Prism Worm | Faceted crystal segments, iridescent highlights, a forehead jewel and violet irises. The slower spectrum now uses identical segment spacing and timing in the picker and gameplay. |
| Inch Worm | Ribbed segments, softer body colour bands, a shaded underside, feelers and olive irises. Picker thickness now follows the gameplay arch/compression instead of remaining fixed. |

Geometry remains within the existing unit-radius envelope. Body details use existing instanced draws; Prism uses opaque crystal shading without adding a transmission pass. Character changes restore the selected skin's material and geometry. The existing travel-driven Inch gait, game rules and collision dimensions are preserved.

Hat models load when requested in the picker to keep the initial route within the existing mobile bundle budget. Discarded preview hat geometry/materials are disposed. An integration check covers asynchronous hat loading and returning to no hat.

Validation: 64 targeted tests cover character switching, preview arch/thickness, surface frames, geometry bounds, body surface clearance, Inch gait, face layout, hats and renderer ownership. Changed-file lint, production build and the existing bundle gate pass.

An offline geometry render was inspected for silhouettes and accessory placement. It does not reproduce WebGL shaders, iridescence or postprocessing. Browser download timed out in this environment, so live mobile visual verification remains outstanding: check each character with hats, side transitions, tunnels, short/long tails and reduced motion before release.
