# Live portal windows and cutaway lens

Live portal windows show the scene from the linked exit inside a circular mouth. The off-axis camera follows the viewer and the actual sticker transforms, including layer turns, raised pieces, and exploded spacing. Pairing follows sticker identity rather than a face's original position. Healed or spent pairs stop receiving a view. The remaining mouths retain their normal portal effects.

The cutaway lens removes the exterior only inside a movable circle, revealing the existing interior routes, core, and any worm geometry there. A faint cube outline keeps the interior in context. The lens temporarily reveals tunnel geometry even when Tunnels is Off, without changing that preference. This is an inspection view, not a slice through solid geometry with generated cap surfaces.

## Controls

- Live views default **off**; opt in under **Settings → Scene → Portal windows**. Settings migration v2 also turns off the earlier persisted default-on value, preserving other preferences. A subsequent explicit opt-in persists normally.
- Open **Cutaway lens** with the top-bar magnifier, **Settings → Scene → Open cutaway lens**, or **Pause → Inspect inside the cube** in WORM.
- Drag the circle with mouse or touch. With its handle focused, use arrow keys to move, or Shift + arrow keys for larger steps. The Size slider changes the radius.
- Close with the × button or Escape. In WORM, inspecting from Pause leaves the simulation paused; closing the lens restores the Pause menu.
- Lens and far-side picture-in-picture are mutually exclusive. Inspection is suspended behind the main menus and during worm tunnel transit. WORM's Pause menu explains when the lens is unavailable.
- Starting or resetting a game closes the lens. Capture mode hides the lens controls while preserving the rendered view.

## Render budget and compatibility

| Tier | Simultaneous portal captures when enabled | Portal target | Lens target | Maximum lens capture cadence |
| --- | --- | --- | --- | --- |
| Desktop | 1 | 192² | 512² | 24 Hz |
| Mobile | 1 | 128² | 320² | 12 Hz |
| Reduced FX or cube size ≥ 10 | 0 | — | 256² | 8 Hz |

With live views off and the lens closed, the capture component is unmounted: no auxiliary scene hook, target allocation, frame subscription, or mouth selection. The ordinary portal effects remain animated.

An enabled portal captures once per game frame so its image, camera, and mouth transform stay synchronized. This replaces the original 8–24 Hz portal throttle, which looked like a slideshow while still paying for whole-scene renders. The guard measures wall time between main renders, averaging each block of 12 captured frames and capping an individual sample at 100 ms to tolerate an isolated hitch. If that average falls below 40 FPS, or immediately on reduced FX / a size ≥ 10 cube, live capture stops and the ordinary animated effect takes over. The fallback stays latched so recovered frame rate cannot repeatedly restart the expensive pass. Toggle live views off/on to retry; a context restoration or component remount also resets it. The cutaway lens remains available independently.

The lens retains its separate capture cadence and remains available after portal fallback. Views are one hop: auxiliary passes hide inspection meshes to prevent recursive rendering. Selection favors a nearby, front-facing mouth, keeps the current mouth until another scores 20% higher, and skips mouths less than approximately 12 CSS pixels across. It does not perform an additional GPU occlusion query.

All targets use RGBA unsigned bytes, linear filtering, no mipmaps, and zero MSAA samples. They require no half-float renderability, filtering, or multisample extensions. This trades HDR range for a portable WebGL1 baseline. The existing ambient-cube and tile-border shaders also enable their derivative extension, with fixed-width smoothing when unavailable, so those objects remain visible on WebGL1. A capture saves and restores the renderer's target, viewport, scissor, clear settings, XR state, shadow updates, and temporarily hidden objects even if rendering throws. An error disables inspection until context restoration or remount while preserving the main scene.

The lens disables the main ambient-occlusion pass while active, matching the existing far-side view's compatibility path. GPU targets and materials are disposed on teardown. Budgets limit extra rendering work; actual performance still depends on scene complexity and the device.

## Source and validation

- `src/3d/InspectionViews.jsx`: capture scheduling, selection, and compositing.
- `src/3d/portalViewMath.js`: live pairing and off-axis camera mapping.
- `src/3d/inspectionPass.js`: portable targets and renderer-state restoration.
- `src/3d/inspectionBridge.js`: actual sticker anchors, lens position, and budgets.
- `src/components/overlays/InspectionLens.jsx`: accessible drag, keyboard, and size controls.

Tests cover pairing after turns, rotated projection and handedness, exit clipping, capture-state restoration on success and failure, nonrecursive rendering, moving mouths, lens cropping and exterior visibility, suspension and cleanup, pause behavior, input cancellation, mutual exclusion, and viewport bounds. Performance regression checks verify zero captures by default, one synchronized capture per frame when enabled, latched fallback, explicit retry, reduced-FX behavior, and saved-setting migration. Browser smoke checks cover desktop, mobile portrait, landscape, WebGL1-only rendering, and WORM's Pause-to-lens round trip using software WebGL. Physical-device GPU and battery profiling remains separate from those checks.
