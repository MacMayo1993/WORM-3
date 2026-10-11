# WORM³ campaign workshop

The game ships 120 authored levels in 12 chapters, all in `src/worm/story/campaign.js` (Mobi's lines are in `narrative.js`). Earlier builds generated levels 41–120 from a seeded recipe; that campaign was replaced by authored chapters with a story arc and harder, progressive objectives (body length, passes through the Core, double heals, fusions). The seeded generator remains here as a drafting workshop only. It no longer writes game files.

## Local auditor and generator

After `npm ci`, run `npm run worm:tools`, then open <http://127.0.0.1:4174/>. The generator is at `/generator.html`. It supports seeded generation, quest filters, editing and rerolling individual levels, import/export, and checks against the current game runtime. The auditor compares required pickups with staged and recurring supply for every integrated campaign level. It exercises six spawn seeds per density, full post-rotation food restoration, actual reserved-tunnel replacement, and action-counter fixtures. Filter generated levels and quests that require replenishment beyond their opening inventory. Pickup counts use actual credited orb colors. Flags and drafts stay in this browser; export them to retain a copy.

This command binds only to loopback. Tool files are outside the game public directory and its normal Vite build; they are not published to GitHub Pages. The existing hosted workshop remains owner-private. If hosting this tool elsewhere, configure authentication before making it accessible. Local builds show a local-only indicator, not an authentication claim.

## Drafting new levels

The generator page drafts seeded packs and checks them against the current runtime. Copy any level you keep into `src/worm/story/campaign.js` by hand, give it a world in `worlds.js` and Mobi's lines in `narrative.js`, then run the story tests: they stage every level for both orb densities, cycle its power offers, and check its completion rule, goal text and time budget.

Quest supply is checked using real game functions, not a simulated inventory model. A passing check does not prove navigation, combat difficulty, or a complete player run. Playtest chapter finales and action-based objectives before release. Timers reserve repeated pickup opportunities and routing slack; no lifetime pickup cap is introduced. The conservative power budget uses the largest of two cycles, explosion/rocket counts, elemental pickup quantity, and magnet catches divided by four (rounded up). Elemental effects block subsequent offers, and each magnet offer supports at most four quest catches. Both edited and imported packs must pass this timing check before the CLI writes campaign files or the workshop exports an integration module.

The original authored catalog used for this pack is from commit `1585a1b3c01c671774ebb32b4f0e21789ec54633`. The local auditor records the current checkout and hashes the source content, including uncommitted changes, rather than claiming a live GitHub sync.
