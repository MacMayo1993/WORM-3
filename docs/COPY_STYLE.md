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
- **WORM³** is the game and Mobi's home world. The lost cube premise ties healing to keeping his way home open.
- Describe a control only once it is active in that mode. WORM keeps its current entry instructions until the new route is enabled.
- Wear warnings must include a legible static cue; movement and colour are supporting cues.
