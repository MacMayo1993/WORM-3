# Live portal windows and cutaway lens

Live portal windows show the scene from the linked exit inside a circular mouth. The off-axis camera follows the viewer and the actual sticker transforms, including layer turns, raised pieces, and exploded spacing. Pairing follows sticker identity rather than a face's original position. Healed or spent pairs stop receiving a view. The remaining mouths retain their normal portal effects.

The cutaway lens removes the exterior only inside a movable circle, revealing the existing interior routes, core, and any worm geometry there. A faint cube outline keeps the interior in context. The lens temporarily reveals tunnel geometry even when Tunnels is Off, without changing that preference. This is an inspection view, not a slice through solid geometry with generated cap surfaces.

## Controls

- Live views default on; toggle **Live portal windows** in **Settings → Scene**.
- Open **Cutaway lens** with the top-bar magnifier, **Settings → Scene → Open cutaway lens**, or **Pause → Inspect inside the cube** in WORM.
- Drag the circle with mouse or touch. With its handle focused, use arrow keys to move, or Shift + arrow keys for larger steps. The Size slider changes the radius.
- Close with the × button or Escape. In WORM, inspecting from Pause leaves the simulation paused; closing the lens restores the Pause menu.
- Lens and far-side picture-in-picture are mutually exclusive. Inspection is suspended behind the main menus and during worm tunnel transit. WORM's Pause menu explains when the lens is unavailable.
- Starting or resetting a game closes the lens. Capture mode hides the lens controls while preserving the rendered view.

## Render budget and compatibility

| Tier | Simultaneous portal captures | Portal target | Lens target | Maximum capture cadence |
| --- | --- | --- | --- | --- |
| Desktop | 2 | 256² | 512² | 24 Hz |
| Mobile | 1 | 192² | 320² | 12 Hz |
| Reduced FX or cube size ≥ 10 | 1 | 128² | 256² | 8 Hz |

The lens uses one capture and suspends portal captures while open. Mouths follow their stickers every frame; images refresh at the selected cadence. Newly selected mouths capture immediately. Views are one hop: auxiliary passes hide the inspection meshes to prevent recursive rendering. Selection favors visible, front-facing mouths; it does not perform an additional GPU occlusion query.

All targets use RGBA unsigned bytes, linear filtering, no mipmaps, and zero MSAA samples. They require no half-float renderability, filtering, or multisample extensions. This trades HDR range for a portable WebGL1 baseline. The existing ambient-cube and tile-border shaders also enable their derivative extension, with fixed-width smoothing when unavailable, so those objects remain visible on WebGL1. A capture saves and restores the renderer's target, viewport, scissor, clear settings, XR state, shadow updates, and temporarily hidden objects even if rendering throws. An error disables inspection until context restoration or remount while preserving the main scene.

The lens disables the main ambient-occlusion pass while active, matching the existing far-side view's compatibility path. GPU targets and materials are disposed on teardown. Budgets limit extra rendering work; actual performance still depends on scene complexity and the device.

## Source and validation

- `src/3d/InspectionViews.jsx`: capture scheduling, selection, and compositing.
- `src/3d/portalViewMath.js`: live pairing and off-axis camera mapping.
- `src/3d/inspectionPass.js`: portable targets and renderer-state restoration.
- `src/3d/inspectionBridge.js`: actual sticker anchors, lens position, and budgets.
- `src/components/overlays/InspectionLens.jsx`: accessible drag, keyboard, and size controls.

Tests cover pairing after turns, rotated projection and handedness, exit clipping, capture-state restoration on success and failure, nonrecursive rendering, moving mouths, lens cropping and exterior visibility, suspension and cleanup, pause behavior, input cancellation, mutual exclusion, and viewport bounds. Browser smoke checks cover desktop, mobile portrait, landscape, WebGL1-only rendering, and WORM's Pause-to-lens round trip using software WebGL. Physical-device GPU and battery profiling remains separate from those checks.
