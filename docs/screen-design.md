# WORM screen design

The playable cube and the player's worm carry the personality. Screens give them room.

- Use `DISPLAY_FONT` for bold uppercase mode and result titles, `HEADING_FONT` for strong uppercase section/action labels, and `UI_FONT` for sentence-case instructions. Preserve artwork beside the titles; follow `COPY_STYLE.md`.
- Give a screen one visible heading. Do not repeat its name in an eyebrow, subtitle, preview caption and footer.
- A preview explains the choice. Use the shared `modeArtwork` scenes or an existing live character/cube preview; do not add another WebGL canvas for decoration.
- Name actions plainly: Next, Play, Resume, Try again after a loss, Play again after a win, and Equip. Show a price or an irreversible consequence beside the action when it changes the decision.
- Keep the selected item's name near its preview. Category summaries may preserve choices across tabs; the footer should not repeat them.
- Keep essentials visible: tasks before a level, the clock during play, the cause after a loss, and rewards after a win. Put rules, settings and detailed histories in named disclosures.
- Keep odds, costs, ownership, timers and difficulty accurate. Shorter copy must not remove a condition needed to understand a reward or finish a level.
- Use the paper and night tokens from `uiTheme.js`. A mode accent identifies a mode; tile colors identify gameplay state.
- Respect 48px action targets, safe areas, short landscape screens, keyboard focus and reduced motion. Keep live gameplay unobstructed.
- Movement should respond to an action or mark a change. Decorative animation is brief; menu decals are static and shared across their meshes. Dispose textures when the menu unmounts.
