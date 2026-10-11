# WORM³ Game Text

Use an arcade hierarchy: bold mode names and outcome titles, decisive controls, and readable instructions.

- Use Bungee (`DISPLAY_FONT`) for cube-face names, mode titles, pause/result headlines, and major screen titles. Keep the illustration visible alongside each title.
- Use bold Outfit (`HEADING_FONT`) for section headings, buttons, tab labels, status labels, and scores. Render short headings and actions in uppercase; retain accessible wording and meaningful labels.
- Use Nunito (`UI_FONT`) in sentence case for rules, explanations, and objective sentences. Keep Mobi dialogue in its existing handwritten face.
- Keep names intact: WORM³, MOBI, PP, XP, Story, Free Play. Do not mechanically lowercase mode names.
- Use PLAY, RESUME, NEXT, TRY AGAIN after a loss, PLAY AGAIN after a win, and EQUIP. Avoid vague navigation language.
- Mode cards show the mode name, one punchy description, and size/session facts. Longer rules and history live under HOW TO PLAY; store information uses GEAR & REWARDS.
- Put task counts beside the action. Preserve costs, odds, ownership, timers, difficulty, and unlock requirements exactly.
- Explain unavailable actions with a short reason. Reserve signature for code identifiers; use ability in instructions.
- Apply typography by semantic role through `gameTypography.css` and shared components. Do not uppercase paragraphs, shrink body text, or add a glow to every label.
- Keep 44–48px controls, short landscape layouts, focus visibility, safe areas, and reduced-motion behavior intact.

## Flip Cube vocabulary

- **Flip Cube** names the object; **FLIP CUBE** names the solve mode on its title plate.
- **flip pad** means a raised, flipped tile. Say **twin** and **straight through the middle**.
- **WORM³** is the game. **MOBI** is a **Multi-Oriented Block Intelligence** (hyphenated, every time) from **the Projective Plane**, a world where every spot has a twin straight through the middle. "Projective Plane" is a place name, written in Title Case, and is the one place the geometry gets named in story copy.
- **The Flip Cube** is Mobi's ship. Its tiles are doors; every size from pocket to mega is a **deck** of the same ship; **the Core** is the middle, the only spot that is its own twin. It survived **W³, the Great World Worm War**, then crash-landed here broken. Healing it is how Mobi gets home.
- **The World Worm** grew so long that it wrapped the Plane, met its own tail coming the other way, mirrored, and took it for an invader. That was the war. Its head came along in the crash, trapped in the Core. The player's worm hatched aboard. The story ends with the World Worm recognizing its own tail; the war ends, the way home opens, and Mobi stays with the player. Twins, tunnels and layer turns predate the war; the war only weaponized them. The Rumbler remains a stowaway, separate from the World Worm.
- Mobi stays warm, practical and a little funny ("I don't have a stomach"). He never restates a level's counts.
- WORM briefings (one to three dialogue cards) and success notes live in `src/worm/story/narrative.js`, keyed by level ID. At launch Mobi speaks the briefing and the mission card follows it. Map, preflight, pause and result cards show them too. Keep the live tracker, counts, costs, star requirements and control instructions literal; mission sentences come from `goalText.js`. A traversal heal spends charges; do not describe it as an orb reward.
- The demo tells the same story in miniature: the cold open names Mobi, the Projective Plane, the ship and W³; WORM practice is repairs to the crashed ship; the cube steps are its decks and doors; the view tour ends at the Core; Mobi's send-off points to WORM Levels. Step instructions stay plain (no "projective" outside the cold open), and `demoFlow.test.js` rejects the older premises.
- Say **pass yourself in the Core** for diving into a tunnel while the tail is still inside one, **double heal** for sealing two pairs with one body, and **grow to N segments** for body-length goals.
- Describe a control only once it is active in that mode. WORM keeps its current entry instructions until the new route is enabled.
- Wear warnings must include a legible static cue; movement and colour are supporting cues.
