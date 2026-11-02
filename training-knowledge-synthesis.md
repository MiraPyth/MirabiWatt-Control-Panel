# Training Knowledge Synthesis — Cycling Library (~/cycling-library)

Extracted 2026-09-20 from the user's synced ebook/study library, for building the
2026-2027 season periodization engine. Athlete context: FTP 320W, CP 290W/W' 21000J,
LTHR 181, maxHR 198, weight ~83.6kg. Past problem: over-forcing indoor trainer volume
in winter → burnout by season start. 2026-2027 constraint: keep one fixed Tuesday/week
as a Zwift race (intensity anchor, not an add-on).

---

## 0. IMPORTANT — the user already has his own system

`Training.xlsx` in the library is **not a generic template — it's the user's own
existing personal training system**, built by him (probably with a coach or on his
own), already in Italian, already using a Z1-Z7 / CP+W' model:

- **Sheet "Allenamenti"**: ~12 named workouts he already uses and knows
  (EnduranceCadenza, EnduranceAgile, EnduranceCorto, EnduranceMedio, EnduranceLungo,
  MedioMini, MedioCorto, MedioBillat, ...) each with a full Italian-language script,
  a normal-ride and a rollers/trainer variant, mapped to TrainingPeaks folder names.
  These should be the **base vocabulary** for any templates we generate — reuse his
  own naming and structure rather than inventing new English workout names.
- **Sheet "Zone Watt"**: his own CP+W' spreadsheet model (assumes CP≈FTP for
  simplicity), with a MMP-based projection table (watts sustainable for 2-40 min)
  and estimated VO2max (~64 ml/kg/min from a CP=252.8W/AWC=23000J test — an older,
  lower-fitness snapshot than his current 320W/290W-CP/21000J profile on intervals.icu,
  so this sheet is a historical/methodology reference, not current numbers).
- **Sheet "ZoneHR"**: his own 7-zone HR table (Z1 Scarico <125, Z2 Endurance 126-150,
  Z3 Medio 151-170, Z4 Soglia 171-180, Z5 VO2max 181-195, Z6 Anaerobico/Z7 Neuro via
  Borg scale) — again an older snapshot (maxHR 195/soglia 177 vs current 198/181),
  but the *structure* (7 zones, sustainability column) is his standard and should be
  kept.
- **Sheet "RiscaldamentiPregara"**: three warm-up protocols (RiscLungo/RiscCorto/
  RiscMedio) keyed to race type/duration, with exact % of CP and timing — reusable
  directly for race-week templates.
- **Sheet "IndicazioniGara"**: a race-file template (event name, warm-up choice,
  in-race carb/fluid targets, pacing notes per climb) — already filled in once for
  "Dolomiti SBK" (5h event). This is the shape a per-event race brief should take
  once 2027 target events are known.
- **Sheet "Alimentazione"**: his own fueling-by-duration table (carbs/fluids by
  ride length, post-ride recovery nutrition, supplement notes) — consistent with
  the Di Marzio book's approach already cited in the Mirabiwatt panel.
- **`Critical Power Test.pdf`** in the library is also **written by the user**
  (signed "Tiziano" at the end, hosted on a site called "R2R Ready to Ride") —
  his own CP/W' testing protocol (3 & 12 min tests, ±3kJ margin on W', golden-cheetah
  based), not a third-party source.

**Implication for the season engine**: don't design a generic workout library from
scratch. Parse `Training.xlsx` "Allenamenti" as the canonical workout set, extend it
with the gap-filling interval science below (30/15, 4x8, VO2max microbursts — none
of which appear in his current sheet), and keep his Italian naming/Z-zone language
throughout the panel and any intervals.icu push, since that's what he already
recognizes.

---

## 1. Periodization models

### Classic Base-Build-Peak (Friel, *The Cyclist's Training Bible* 5th ed.)
Linear/classic periodization: progression from **basic abilities** (aerobic
endurance, muscular force, speed skills) to **advanced abilities** (muscular
endurance, anaerobic endurance, sprint power) — advanced abilities are described as
literal products of the basic ones, so skipping the base phase undermines everything
built later. Named periods in order: **Prep → Base (1/2/3) → Build (1/2) → Peak →
Race → Transition**, organized as mesocycles built from 1-4 week microcycles.
- Peak period: typically **1-2 weeks**, ending several days before the target race.
- Between two major races: with **12-16 weeks** gap, redo a full Base3→Build→Peak
  cycle; with **7-11 weeks**, a shortened version; with **fewer than 7 weeks**, skip
  straight to Build2 + a short taper (3-5 days peak), provided aerobic base
  (checked via efficiency-factor/FAeT test) hasn't eroded >10%.
- Friel explicitly warns: skipping the short transition/rest period between
  build cycles is what causes **burnout within a few weeks** — "it's more mental
  than physical... without it you are likely to be burned out." Directly relevant
  to the user's past pattern.

### Polarized (Seiler; High North Performance "Polarised Training: A Comprehensive
Guide")
Three zones by lactate turn-points: **Low (~75% of sessions, <LT1)**, **Medium
(~5%, LT1-LT2)**, **High (~20%, >LT2)** — the "80/20" simplification undercounts
the high zone. Mapped to a 6/7-zone model: Low = Z1-2 + lower Z3 (<~85% FTP),
Medium = upper Z3/Z4, High = Z5+.
- Key clarification the guide stresses: **the 75/5/20 split is measured by number
  of sessions, not time-in-zone**. Time-in-zone will naturally show far more low
  (~90%) because of warm-ups/cool-downs/recoveries — that's expected, not a
  violation of the model.
- Threshold/Medium-zone work is *not* eliminated — it's ~1 session every 2-3 weeks,
  used deliberately (VLamax reduction, muscular endurance, race-pace familiarity),
  not banned.
- **Periodizing it**: no fixed rule — some coaches make training *more* polarized
  approaching race season (push high zone up, keep low zone dominant), others make
  it *less* polarized (more threshold as racing nears). Both are used; decide from
  testing + target race demands, not dogma. The ~75% low-zone floor should hold in
  **every** phase including winter — this is the load-bearing fact for the user's
  situation.
- **Time-crunched example week (5-8h/week)** given in the guide, VO2max-focused:
  Mon rest, Tue 1h VO2max (5-7x3min Z5, 3-4min recovery), Wed rest/light Z2,
  Thu 1h VO2max microbursts (3x9min blocks of 30s-on/15s-off @Z6), Fri rest,
  Sat 2-3h endurance Z2, Sun 1h fasted muscular-endurance (3-4x8-9min low-cadence
  Z3-top). This maps almost exactly onto the user's "one fixed Tuesday Zwift race"
  idea — the guide's own template puts the week's VO2max anchor on Tuesday.

### Block Periodization (Rønnestad et al. 2014, *Scand J Med Sci Sports* — the
12-week well-trained-cyclists study, read in full)
**Protocol**: 12 weeks split into three 4-week blocks. Each block = **1 week of 5
HIT sessions** (concentrated load) + **3 weeks of just 1 HIT session** (LIT-focused
recovery/consolidation), vs. a traditional (TRAD) group doing steady **2 HIT
sessions/week** throughout, same total HIT+LIT volume in both groups.
- HIT sessions in both groups: **6x5min or 5x6min @ Zone 3 (88-100% maxHR)**,
  2.5-3min recovery, ridden for max mean power (session itself is the fitness
  indicator).
- **Result**: Block periodization (BP) produced significantly larger VO2max gains
  (+8.8% vs +3.7%, p<0.05), a near-significant larger lactate-threshold power gain
  (+22% vs +10%, p=0.054), and moderate-to-large effect sizes favoring BP across
  every measured variable (Wmax, Hbmass, 40-min power) — **despite identical total
  training volume and intensity distribution** between groups. The only variable
  is *how the same HIT dose is clustered in time*.
- **Fatigue pattern — directly relevant to the burnout problem**: during BP's HIT
  block weeks, perceived leg heaviness was significantly worse than TRAD
  (P<0.05) — but it **returned to normal during the following 3 LIT-focused
  weeks**. TRAD athletes reported "normal" legs throughout, i.e. smaller peaks but
  no true recovery trough either. BP concentrates fatigue into a bounded, known
  window with a mandatory 3-week unload after it; TRAD spreads moderate fatigue
  continuously with no built-in deep recovery. **This is a strong candidate
  structural fix for the user's winter pattern**: instead of a flat, unrelenting
  2x/week HIT winter (which is closer to what "forcing on the rollers all winter"
  usually turns into), use 1-week concentrated blocks (5 harder sessions) followed
  by 3 clearly easier weeks (1 HIT session, rest LIT) — the model's built-in
  unload weeks are the anti-burnout mechanism, not an afterthought.
- Only 8/9 (BP) and 7/9 (TRAD) athletes completed the 12 weeks (dropouts from
  illness), and only BP significantly increased Hb mass — plausible mechanism via
  transient GH/EPO response to concentrated HIT blocks.

### Time-Crunched / Low-Volume (Carmichael & Rutberg, *The Time-Crunched Cyclist*)
Built for ~**6 hours/week** (up to 8), explicitly for athletes who cannot do
classic high-volume base training. Core idea: since volume is capped, **intensity
must substitute for duration** to reach the same physiological targets — "a
high-intensity program is the answer" when only 6h/week are available. Structure:
**4 workouts/week**, built around **Tempo** (moderate aerobic, 20-60min continuous,
overlaps top of the endurance zone) and **SteadyState/LT intervals** (3-min-based
in some editions), with a documented **4-week program** (Table 5.1 in the book) as
the repeating building block rather than a full annual Base/Build. Chris
Carmichael's own framing: this is a deliberate trade — accept a more "fragile",
faster-decaying form in exchange for being race-ready on ~6h/week — matches what's
already written into the Mirabiwatt panel's own "Time-Crunched Week" template
description.

---

## 2. Concrete workout library (extractable as intervals.icu-pushable templates)

### From interval-duration research (all found as short papers/blog reviews in the
library, all traceable to peer-reviewed sources):

| Format | Protocol | Evidence | Notes |
|---|---|---|---|
| **30/15 short intervals** | 30s hard / 15s easy, 13 reps (9.5min) per set, 3 sets, 3min between sets (39 total 30s efforts) | Rønnestad 2015, *Scand J Med Sci Sports* 25:143-151. 10 weeks, 2x/week vs 4x5min (2.5min recovery). 30/15 group: VO2max +8.7% vs +2.6%; power@4mmol/L +12% vs +5%; 40-min power +12% vs +4%; 5-min power +8% vs +3%. | Outperformed the classic 4x5 threshold-style interval on *every* metric, matched total work duration (19.5 vs 20 min) — the mechanism is thought to be more time >90% VO2max, higher effective power per rep, and/or greater lactate exposure. |
| **4x8min long intervals** | 4x8min @ intensity giving ~90% maxHR / ~10mmol/L lactate, 2min recovery, 2x/week | Seiler 2013, *Scand J Med Sci Sports* 23:74-83. 7 weeks, 35 amateur cyclists, compared 4x4/4x8/4x16/LIT-only. 4x8 group: power@4mmol/L +16.2% (vs 9%/8%/8% for 4x16/4x4/LIT), VO2max +10.4% (vs 6.5%/5.6%/3.4%) — both p<0.02 vs all other groups. | Sweet spot between intensity and sustainable duration; 4x4 was too intense to sustain productively (94% HRmax, 13mmol/L lactate — mostly anaerobic), 4x16 too diluted (88% HRmax, 5mmol/L). **4x8 + 30/15 together** are explicitly recommended by the source as a complementary short+long high-intensity pairing. |
| **VO2max hard-start / progressively-decreasing intervals** | Long first interval (3min) at ~117% CP (~120% FTP), then progressively shorter (2min→1min→45s→30s→30s) with 3:2 work:recovery, recovery at ~83% CP (~87% FTP, i.e. NOT easy) | Rønnestad et al. HNP paper-review (12 amateur cyclists). Progressively-decreasing design: 312s >90% VO2peak vs 183s (constant short) and 179s (constant long) — but no difference in total work or time-to-exhaustion. High variability (2 strong responders drove much of the effect; 4/12 didn't respond best to this design). | HNP's practical recommendation: 2 blocks of [3m/2m easy, 2m/1m20s easy, 1m/40s easy, 30s/20s easy] at 110-125% FTP work / ~80% FTP recovery, 5min easy between blocks. |
| **Fast-start intervals (general)** | 5x5min @90s fast-start then settle, vs constant pace | Bossi et al. 2019 (varied-power 5x5, +410s vs +286s at >90% VO2max, p=0.02); Rønnestad et al. 2019 XC-ski study (fast-start 5x5, 12.0min vs 10.8min >90% VO2max, not significant) | Consistent trend across 2 papers/2 sports that varying power within an interval (front-loading intensity) increases time at high VO2 for the same mean power — small effect, not yet proven to translate to superior long-term adaptation. |
| **Critical Power / W' test protocol** | 2-3 max efforts of 3min + 7min + 12min (±30-90s tolerance), each preceded by 3-5min unloaded @ SS (~90% FTP), min 40-60min between efforts if same day (not recommended), never 2 consecutive days | User's own R2R article ("Critical Power Test.pdf", authored by the user) | This is the user's **own existing CP test protocol** — reuse it verbatim for any FTP/CP retest built into the season plan, rather than proposing a different protocol. |

### From High North Performance's "Key Workouts Guide" (10 workouts, full
physiological rationale + evidence per workout — good candidate set to convert
directly into intervals.icu structured-workout JSON):

1. **Easy Recovery Spin** — 45min-1.5h, <50% FTP / <65% maxHR / RPE 2-3.
2. **Aerobic Development w/ late-stage efforts** — 1.5h+ @55-75% FTP, + 2-3min
   sub-LT efforts near the end (Type IIa recruitment).
3. **Sweetspot low-cadence blocks** — 2-3x10-20min @90-98% FTP, 50-70rpm, RPE 7.
4. **Over/unders** — 2-4 blocks of 8-20min alternating just-above/just-below LT
   (e.g. 103-105%/1min + 80-90%/1.5min), RPE 7, 80-90% maxHR.
5. **Threshold tolerance intervals** — 3-4x10min or 2-3x15min @98-103% FTP, 2:1
   work:recovery — trains time-to-exhaustion at threshold, not threshold power
   itself.
6. **Hard-start VO2max intervals** — 20-60s @120-130% FTP then settle to
   100-115% FTP for remainder (3-8min total), 1:1-2:1 work:recovery, ≥90% maxHR.
7. **VO2max microbursts** — 2-4 blocks of 15-45s on/off (2:1 ratio best per HNP
   experience) @120-130% FTP, 9-15min/block, ≥85% maxHR, RPE 8.
8. **Anaerobic power intervals** — 5-8x20-90s max effort, ≥1:5 work:recovery,
   long warm-up w/ 10s surges.
9. **Anaerobic stamina intervals** — 2 blocks of 5x60s @130-140% FTP, 2min
   recovery, 10min between blocks — for crit/CX/road-race repeatability.
10. **Max-effort sprints** — 3-10x5-20s all-out, full recovery, ~30min warm-up.

Explicit dosage guardrails from the same guide (their own words, matches the
user's burnout history closely): *"the number of interval sessions should usually
be limited to ~2x per week, even for those with limited training time"*, and
overshooting workout targets when not fresh should trigger aborting to an easy
ride, since *"pushing on regardless can lead to greater fatigue with poor/no
specific fitness yield... can result in non-functional overreaching or
overtraining."*

### From "Training Week Templates Guide" (10 week-shapes, directly reusable as
the season engine's weekly template library):
1. Basic week starting with recovery day (most common default)
2. Basic week starting with training day (used after a recovery week)
3. High-volume week (training camp — 2 recovery days, limits interval count)
4. Low-volume week (raise average intensity, protect 1-2 long weekend rides)
5. Recovery week (every 3-4 weeks; 2 full days off, 1 reduced threshold session,
   1 medium endurance ride — explicit target: fatigue↓ without fitness loss)
6. Week including fitness test (fresh day before test; easy ride after unless
   test was very short)
7. **Block-method week** — the practical microcycle version of Rønnestad's
   macro-level block periodization: 3 concentrated days lowering intensity /
   raising duration as fatigue accumulates, framed explicitly as usable
   "as a short-term tapering strategy between races... at key times throughout the
   training plan... or even if you have a schedule with travel constraints."
8. Taper week (1 week out): cut volume, keep/slightly raise intensity, avoid
   medium-intensity "grey zone" entirely (only hard or very easy).
9-10. Peak race week (Saturday/Sunday variants): recovery ride 2 days out,
   openers day before, only hard+easy sessions, day off after (Saturday variant).

Their own explicit warning, verbatim: *"it's very easy to get mentally and
physically burnt out from high intensity training when this goes beyond a certain
level (typically greater than 2-3x per week)"* — same number as Coggan/HNP above,
independent confirmation.

---

## 3. Winter/off-season guidance cross-reference (the core question)

Every source that addresses it agrees on the same three things, independently:

1. **Cap high-intensity frequency at 2-3 sessions/week, hard limit** (HNP Key
   Workouts Guide, HNP Week Templates Guide, implicit in Rønnestad's 2 vs 5
   sessions/week comparison). The user's past "forcing on the rollers" almost
   certainly means either exceeding this or running moderate-hard rides too
   often without a true easy/low floor (Seiler's "faulty threshold model" problem
   — see polarized guide's "Why train polarised" section: threshold-zone-heavy
   training was the old default precisely because it feels productive per-session
   while being unsustainable and burnout-prone over months).
2. **The ~75% low-intensity floor must hold in every phase, including winter** —
   the polarized guide is explicit that this doesn't relax in the off-season; if
   anything, base/winter is where the low-intensity aerobic floor is built that
   later phases draw down. Friel's Base 1/2/3 phases are literally built around
   this too (aerobic endurance + muscular force first, before any advanced-ability
   work is layered on).
3. **Concentrate the necessary hard-work stress into bounded blocks with a
   mandatory unload, rather than spreading it flat** — this is Rønnestad's block
   periodization finding directly: same total dose, but clustering it (1 hard
   week / 3 easier weeks) beat spreading it evenly, and did so with *better*,
   not worse, subjective fatigue outcomes over the full 12 weeks precisely because
   of the built-in recovery weeks. A flat "hard 2x/week all winter, no defined
   unload" schedule is structurally the highest-burnout-risk shape available in
   this whole library, and matches what "forcing it on the rollers" usually
   collapses into in practice (no long low-intensity outdoor rides available,
   so indoor sessions drift toward moderate-hard by default, with no macro-level
   easy weeks planned in because "it's just an indoor spin").

### Tuesday Zwift race anchor — validated against the sources
The HNP time-crunched example week (5-8h/week) puts its **VO2max session on
Tuesday** as a matter of default structure (Monday rest after the weekend, Tuesday
= first hard day of the week, fresh). A Zwift race is a very close real-world
analogue of a hard-start/VO2max-or-anaerobic-stamina session (variable, often
front-loaded power, sustained high-HR efforts) — so it slots naturally into that
Tuesday HIT slot rather than being an *additional* session layered onto an
already-full trainer week. Practical implication for the engine: **treat Tuesday
Zwift race as one of the ≤2-3 weekly HIT sessions (not zero-cost "just for fun"
volume)**, plan the rest of the week's intensity budget around it (e.g. one more
HIT day, e.g. Thursday or Saturday, everything else Z1/Z2), and keep it as the
one fixed point even inside Rønnestad-style concentrated block weeks — either as
the single HIT session during the 3 "quiet" weeks, or nested into the 5-session
block week without turning every day around it hard too.

---

## 4. FTP/CP zone models found — cross-check against current profile

The user's current intervals.icu profile has power zones at **[55, 75, 90, 105,
120, 150]% of FTP=320W** with names Active Recovery / Endurance / Tempo /
Threshold / VO2 Max / Anaerobic / Neuromuscular — this is **exactly** the classic
Allen & Coggan 7-level model (confirmed directly in *Training + Racing with a
Power Meter*: L1 Active Recovery <55%, L2 Endurance 56-75%, L3 Tempo 76-90%,
L4 Threshold 91-105%, L5 VO2max 106-120%, L6 Anaerobic Capacity 121-150%, L7
Neuromuscular Power = max sprint, no % ceiling). No adjustment needed there — it's
already the standard model, matching what the Mirabiwatt panel's own FTP/CP
calculator already cites.

The **polarized model's 3-zone view** doesn't replace this — HNP's own mapping
(also independently confirmed here) is: **Low = Coggan Z1-2 + lower Z3 (<~85%
FTP), Medium = upper Z3/Z4, High = Z5+**. So the existing intervals.icu zones can
be reused as-is; the season engine just needs a session-classification layer on
top (which Coggan zone(s) a given workout mostly sits in → low/medium/high bucket)
rather than a second parallel zone system.

**Indoor FTP caveat (Hunter Allen, TrainingPeaks article, directly relevant to
winter volume planning)**: indoor wattage is commonly 10-30W lower than outdoor
for the same effort, from trainer type (rear-wheel resistance trainers lose the
momentum/inertia road riding has — direct-drive trainers like the user's "Bianchi
da rulli"/Zwift Hub setup are much closer to true), heat buildup (can alone cost
20-30W if not actively cooled/fanned), fixed body position, and motivation. Allen's
explicit recommendation: **if indoor vs outdoor FTP differs by >10W, test FTP
indoors separately and use that indoor-specific FTP for winter zones** — using an
outdoor-measured FTP all winter on the trainer means every "Z3/Z4" indoor session
is actually being ridden at a higher relative intensity than intended, which is a
very plausible *quantitative* mechanism behind the user's burnout pattern (zones
silently harder than prescribed, every single indoor session, all winter). This is
worth checking directly: compare the user's rides on "La Bianchi da rulli" /
Zwift Hub bike profiles in intervals.icu against outdoor rides on "La bici" for a
systematic power offset before finalizing winter zones.

---

## 5. Files skimmed only lightly / not read in depth (lower priority per the task)
- `Allen & Coggan_Training + Racing with a Power Meter.pdf` (55MB) — only grepped
  for the power-zone table; the rest of the book (periodization chapters, race
  analysis) not read in this pass.
- `Marco di Marzio_Allenamento e alimentazione nel ciclismo.pdf` — not opened this
  pass (Mirabiwatt panel already cites its nutrition numbers directly: 2.2g/kg
  protein, 1.0g/kg fat); worth a dedicated pass later for its training-periodization
  content specifically, which wasn't covered here.
- `Complete Polarized Cycling Training Guide, With Calculator 2021.pdf` (17MB,
  image-based) — not read; likely overlaps heavily with the Comprehensive Guide
  above plus an interactive calculator tool. Worth checking only if the
  Comprehensive Guide's content proves insufficient.
- `Cycling+Physiology+&+Training+Science+Guide.pdf`, `Che cos'è la VAM...pdf`,
  `Cycling in the Heat...pdf` — not opened (VAM/heat are climbing- and
  environment-specific, not periodization-relevant; physiology guide is general
  background, lower priority than the sources above which are all more directly
  actionable).
- The 5 `.webp` infographics (Recovery pyramid, Sleep and light/caffeine/shared
  rooms/recovery) — not reviewed; these look like sleep-hygiene reference cards,
  likely useful for a future "recovery" section of the panel but not periodization
  itself.
