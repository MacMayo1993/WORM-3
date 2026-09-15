# CHAOS match experience

The forecast, live cube, and results now form one round flow. The existing four
prediction rules, odds, healing payouts, and completion XP remain unchanged.

## Playing

- Setup leads to a forecast sheet with the selected size, intensity, and flip
  limit. Color Pair is the default prediction type; its preview explains that
  any surviving tile pair in that color family wins. Players can skip a wager
  or go back to setup.
- The match panel pins the prediction and reports living tiles directly from
  the rendered board. Three color-family buttons mark original identities on
  the cube, including after rotations or flips. The backed family starts marked.
- Damage bars fill toward the configured limit. A pale notch marks a tile with
  one flip remaining. Match details list danger counts and the last six tiles'
  identities and remaining flips. Standings describe survival, not probabilities.
- Short notices announce elimination bursts and entire color eliminations.
  The live stage advances from Opening storm through The squeeze and Final six.
  Existing cascade bolts remain bounded to four concurrent effects. Stage
  sounds/haptics use the existing feel dispatcher and player settings.
- Healing objectives advance after restoring six and twelve distinct sticker
  identities. Repeat heals count once toward these feats. Existing healing PP
  still follows the original economy; these objectives add no extra payout.
- The real winning pair is marked on the cube for 1.8 seconds before results.
  Prediction settlement and completion XP happen at the authoritative winner,
  before the reveal, so exiting cannot refund an already resolved loss.
- Results show net prediction outcome, healing PP, existing XP/achievements,
  round feats, duration, largest elimination burst, the latest 48 elimination
  bursts, and the full tile ledger. Burst labels distinguish chain spread from
  surface surges; they do not claim to reconstruct every propagation path.
- Next round reuses the setup and asks for a fresh prediction. Change setup
  and Main Menu remain available.

The CHAOS match panel and optional help tutorial load on demand. The initial
route is 2,294.3 KB raw / 605.3 KB Brotli, below the existing 2,300 / 640 KB
budgets (baseline: 2,299.5 / 606.3 KB).

## Records and lifecycle

`worm3_chaos_record` stores completed rounds, resolved predictions, correct
predictions, best streak, and healing PP. Reads sanitize malformed data; records
are written by the store's central persistence subscription. Demo/campaign runs,
abandoned rounds, and pushed predictions do not inflate prediction records.

Round telemetry and color focus reset with the existing session defaults. Round
completion is idempotent. The winner snapshot freezes damage and delayed healing;
late worker messages and delayed result screens are guarded against superseded
rounds. Pending scramble-launch timers and callbacks are cancelled on exit.

## Verification

- Pure tests cover original-identity counts through rotation/damage/healing,
  multiple cube sizes, bounded history, milestones, prediction capture, record
  validation, duplicate completion, abandonment, and resets.
- React interaction tests cover accessible selection, a single wallet debit on
  rapid clicks, empty-wallet play, Back, color highlighting, objective replacement,
  payout before results, and cancelled launches.
- The repository lint, full test suite, production build, and bundle budget
  checks are the release gates.
- Live browser visual QA remains outstanding: the session browser blocked the
  local preview URL. Responsive CSS includes narrow portrait, short landscape,
  safe areas, keyboard focus, and reduced-motion handling; those layouts still
  need a real-device visual pass before release.
