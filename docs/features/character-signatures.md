# Character signature moves

The first playable set adds one signature button above Jump and Boost for Inch,
Glow and MOBI. Q activates the same action from the keyboard. Other characters
continue to use their existing controls.

| Character | Move | Effect | Cooldown |
| --- | --- | --- | --- |
| Inch | Spring Loaded | 0.24-second wind-up, then a 2.2-tile jump with increased height | 24 seconds from launch |
| Glow | Pulse Beacon | Reveals nearby color orbs and flipped entrances for 5 seconds; collects color orbs from adjacent manifold tiles | 22 seconds from activation |
| MOBI | Parity Lock | Seals the current or nearest valid entrance up to 3 tiles ahead for 6 seconds | 28 seconds from activation |

Cooldowns include the active window, advance with crawling simulation time, and
freeze during pause, tunnel transit and cinematic gameplay freezes. Death, retry
and leaving Worm mode clear the effect. Invalid activations spend no cooldown.
Signatures are unavailable during the lesson, countdown, cube turns and rocket
flight. Boost retains its own independent timer.

Spring previews the projected landing and checks for a flipped tile or occupied
body trail both on activation and after wind-up. Subsequent steering and hazards
still affect the jump; it does not grant blanket invulnerability. The existing
jump marker tracks its landing during flight.

Beacon highlights are the only signature markers visible through the cube. They
use a three-step manifold neighborhood, with at most 32 markers per category.
The collection radius is one step, and an existing magnet keeps its larger radius.
Highlights clear on expiry, death and tunnel entry. Landing and seal markers obey
depth testing. No additional scene lights are allocated.

Parity Lock seals one entrance, not both ends of a tunnel. It follows that sticker
through cube rotations, including paired turns in opposite directions. It does
not change stickers, deposit inventory, consume tunnel uses, award healing XP or
protect against other hazards. An expired seal restores normal entry under the
worm after any in-progress cube turn settles.

Implementation: `healerWorm/signatures.js` owns rules and balance constants;
`wormSim.js` applies input, movement and entrance suppression; `useWormCrawler`
reads the real selected character and mirrors the readout through `wormBuffs`.
The DOM button and keyboard use the existing turn bridge. `SignatureEffects`
owns bounded reusable meshes and disposes their resources on unmount.

Validation covers deterministic gameplay, the real hook/store/button/keyboard
path, pause and retry, effect visibility and disposal, and rotating seals. Mobile
WebGL appearance and subjective cooldown balance still need device playtesting.
