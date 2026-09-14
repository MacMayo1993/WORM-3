# Rendering optimization pass

- Character hero borrows the persistent WebGL canvas and renders directly, removing its animated GPU readback and 2D pixel copy. Cosmetic thumbnails retain the existing shared offscreen renderer. Resolution remains capped at 640 pixels and 2× DPR; motion and artwork are preserved. A layout cleanup restores canvas ownership before removing the hero. Desktop menu postprocessing pauses while the hero owns the canvas.
- Parity-orb opaque inner cores and antipodal poles are instanced by geometry/material identity. Shells, transparent halos, rings and patterned bands retain their meshes and sorting. Full mega-mode artwork is retained. Existing main-camera culling and PiP visibility rules remain in force. Batch disposal releases instance buffers, not shared geometry/materials.
- Sticker ancestry is checked once per frame; only changed transforms and descendants receive new world matrices and instance-buffer writes. Position, quaternion, scale, manual local matrices and reparenting are covered. Color comparison now retains double precision, fixing needless uploads caused by Float32 rounding.

Validation: 99 tests across seven focused regression files passed, including strict preview lifecycle/resize, batching transforms and cleanup, sticker rotation/reparenting, multi-layer worm rotation, and preview scheduling/motion. Production build and bundle budgets pass. Changed-source lint has no errors (three existing Fast Refresh warnings).

No mobile GPU frame-rate or visual claim is made: a phone check of selector entry/exit, full mega orbs and rotating/flipped stickers remains necessary before merging. This workspace cannot provide a working WebGL browser for that check.
