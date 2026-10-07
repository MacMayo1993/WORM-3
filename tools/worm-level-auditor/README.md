# WORM³ campaign workshop

The game contains the original 40 authored levels plus 80 generated levels (41–120), grouped into 12 chapters. The shipped recipe is `worm-100-plus`, balanced quests, standard pacing, board sizes 3–10, combat and mastery enabled. Generation uses only the original 40 world templates so later generation does not change earlier output.

## Local auditor and generator

After `npm ci`, run `npm run worm:tools`, then open <http://127.0.0.1:4174/>. The generator is at `/generator.html`. It supports seeded generation, quest filters, editing and rerolling individual levels, import/export, and checks against the current game runtime. The auditor covers every integrated campaign level and compares required pickups with staged and recurring supply. Flags and drafts stay in this browser; export them to retain a copy.

This command binds only to loopback. Tool files are outside the game public directory and its normal Vite build; they are not published to GitHub Pages. The existing hosted workshop remains owner-private. If hosting this tool elsewhere, configure authentication before making it accessible. Local builds show a local-only indicator, not an authentication claim.

## Reproduce or extend the campaign

```sh
npm run worm:generate -- --check
npm run worm:generate -- --total 150
npm run worm:generate -- --settings ./recipe.json
npm run worm:generate -- --pack ./exported-pack.json
```

The CLI validates consecutive IDs, chapter coverage, supported schema, actual Standard/Classic staging, tunnel allowances, repeated power placement, elemental variety, magnet catch support, food replenishment, and completion predicates before writing `src/worm/story/generated.js`. `--check` compares the output without writing. JSON recipes use the fields in `WORM_GENERATION_RECIPE`; exported packs retain manual level edits. Generation replaces the generated portion of the campaign. Review the diff and rerun tests before committing. Original levels 1–40 and their rewards are preserved.

Quest supply is checked using real game functions, not a simulated inventory model. A passing check does not prove navigation, combat difficulty, or a complete player run. Playtest chapter finales and action-based objectives before release. Timers reserve repeated pickup opportunities and routing slack; no lifetime pickup cap is introduced.

The original authored catalog used for this pack is from commit `1585a1b3c01c671774ebb32b4f0e21789ec54633`. The local auditor records the current checkout and hashes the source content, including uncommitted changes, rather than claiming a live GitHub sync.
