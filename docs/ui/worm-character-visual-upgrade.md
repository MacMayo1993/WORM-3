# Book, Prism and Inch visual upgrade

The character picker and Worm gameplay share the new geometry, finishes and face accessories.

| Character | Appearance |
| --- | --- |
| Book Worm | More curled paper edges, tighter page stacks, printed ink lines and gold margins, restrained page flutter, connected brass spectacles and amber irises. |
| Prism Worm | Hexagonal crystal cuts with broad flat panels, bright bevels and pointed ends. A stable ice-white head, triangular forehead prism and cyan/magenta crystal crest distinguish it at gameplay scale. Wider spectrum bands drift slowly along the body; gameplay, picker and menu share the geometry and palette. |
| Inch Worm | Ribbed segments, softer body colour bands, a shaded underside, feelers and olive irises. Picker thickness now follows the gameplay arch/compression instead of remaining fixed. |

Geometry remains within the existing unit-radius envelope. Body details use existing instanced draws; Prism uses opaque crystal shading without adding a transmission pass. Character changes restore the selected skin's material and geometry. The existing travel-driven Inch gait, game rules and collision dimensions are preserved.

Hat models load when requested in the picker to keep the initial route within the existing mobile bundle budget. Discarded preview hat geometry/materials are disposed. An integration check covers asynchronous hat loading and returning to no hat.

Prism readability validation: 33 focused tests cover character switching, geometry bounds and outward normals, all six surface frames, face layout, menu rigs, and preview accessory framing. The crystal body uses 48 triangles per segment (previously 80), with no added body draws or transmission pass. Changed-file lint, production build and the bundle gate pass.

Software WebGL captures were inspected in the character preview and a live story run at desktop and phone viewport sizes. The external environment HDR could not load, so these captures exercised fallback lighting; physical-device frame rates and environment-map reflections were not measured.
