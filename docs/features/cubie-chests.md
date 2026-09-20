# Cubie chests and currencies

The Parity Store now has a **Cubie Chests** room, plus Worm and Trail collection tabs. The chest room contains CSS 3D dice, an outcome reveal, tier pools, exact odds, exchanges, claimable earned gems and the last 20 receipts. Reduced-motion users get an immediate reveal. Color is accompanied by tier names and symbols.

## Currency roles

| Resource | Role | Initial rules |
| --- | --- | --- |
| Orbs | Run resources, worm growth and healing | Existing mechanics remain |
| Parity Points | Direct catalog purchases and gem exchange | 100 PP → 10 gems |
| Gems | Chest rolls | 20 welcome gems; 5 per earned XP level; 10 per first WORM Story clear |
| XP | Permanent progression | White chests grant 25 XP, alongside 25 PP |
| Cubies | Weighted dice | Not a separate spendable balance |

Earned gem rewards are claimed in the chest room. Previously earned levels and Story clears qualify once; claim markers persist. Spent welcome gems do not reset on reload. Gem purchases for real money are not implemented.

## Dice and pricing

A single roll costs **10 gems** and awards its face tier. A paired roll costs **15 gems**, samples two independent faces, and awards the **lower tier** unless both faces match. A matching pair moves up one tier; red/red remains mythic. One roll always grants one reward, not two.

Paired dice use stronger face weights. Applying the lower-result rule to the single-die weights would reduce mythic odds from 1% to 0.1325%, making the higher price counterproductive. With the configured paired weights, mythic odds are 1.69% per roll: 69% higher per roll and about 12.7% higher expected mythic rewards per gem. This is a starting balance, not a guarantee for an individual session. Exact final odds are displayed before rolling.

| Tier | Reward | Single die / final | Each paired die | Paired final |
| --- | --- | ---: | ---: | ---: |
| Red — Mythic | Worm character | 1% | 5% | 1.69% |
| Orange — Legendary | Hats, skins, trails | 3.5% | 12% | 3.76% |
| Yellow — Very rare | Advanced tile families | 7.5% | 16% | 10.28% |
| Blue — Rare | Classic and Antipodal tile families | 13% | 22% | 20.77% |
| Green — Uncommon | Color palettes | 25% | 25% | 31.5% |
| White — Common | 25 PP + 25 XP | 50% | 20% | 32% |

For ascending tiers indexed 0–5 with face probabilities p_i, paired final probabilities are q_0 = 2p_0(1-p_0), q_i = 2p_i × sum(p_j for j > i) + p_(i-1)^2 for 1–4, and q_5 = p_5^2 + p_4^2. All 36 ordered outcomes are included. Odds stay fixed between rolls.

## Ownership and duplicate handling

The rarity is rolled first. Then an unowned item is selected uniformly within that tier. Free catalog defaults are excluded from reward pools. Advanced styles are Living, Living Surfaces, Non-Euclidean, Impossible and Surreal; Classic and Antipodal styles are blue-tier rewards.

When the entire tier is owned, it compensates 2/4/6/10/15 gems for green/blue/yellow/orange/red. The pool and compensation are visible in the room. No tier reroll occurs.

Classic is free for new players. Other existing worm characters cost 1,000 PP directly or can be awarded by a mythic chest. Existing players retain access to the characters that were freely available before this system. Direct purchases and chest rewards use the same ownership IDs and equip controls. Demonstrations can still preview characters without granting ownership.

## Transactions and save compatibility

`chestWallet` extends the authoritative version-1 player snapshot with gems, roll count, claimed progress and bounded receipt history. Older snapshots migrate without removing XP, PP or owned items. Explicit zero balances remain zero; invalid receipt contents are discarded.

A roll synchronously samples browser cryptographic randomness, resolves the reward and saves cost, reward, XP and ownership in one snapshot before the animation starts. Storage or entropy failure aborts the transaction. A busy guard prevents duplicate clicks during a reveal. Closing the room releases the animation lock but never refunds or rolls again; reloading displays the persisted receipt without granting it twice.

White XP participates in normal XP level payouts; the resulting PP bonus is included in the same transaction. Chests are an XP source rather than a new gameplay achievement mode. Purchase actions resolve prices from the catalog, and wallet actions reject negative, non-finite or unsafe amounts.

The client save is the existing device-local prototype economy. A future paid or cross-device economy would need server-authoritative balances, draws and transaction IDs before launch.

## Validation

Tests cover all 36 face pairs, full probability sums, weighted sample boundaries, complete pool coverage, owned-item compensation, mythic unlock/equip, failed storage and entropy, repeated clicks, interrupted reveals, zero-balance reloads, production migrations, one-time earned gems and authoritative prices. Full CI passed: 184 test files / 2,271 tests, lint, production build and bundle budgets. The initial route is 7 files, 2,022.8 KiB raw / 498.5 KiB Brotli. Wallet rules and catalog data have their own cacheable economy chunk; the production chunk also initializes successfully in a standalone module check. Phone/WebGL visual verification and long-term reward-rate playtesting remain outstanding.
