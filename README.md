<div align="center">
  <img src="public/logo-mark.svg" width="72" alt="" />
  <h1>Mind Miles</h1>
  <p><strong>Measure where your attention goes.</strong></p>
  <p>The digital fitness tracker for your mind.</p>
</div>

---

Mind Miles measures how you actually use a device and turns it into meaningful
metrics — Mind Miles, Digital Fitness, Focus, Strain, Recovery, Visual Load,
Fragmentation and Reclaimed Time — then turns improvement into personal records,
challenges and something worth sharing.

It is not a screen-time tracker. A screen-time app looks at two people who each
spent five hours on a device and reports the same number. One of them spent
three hours writing, one reading and one talking to people. The other spent five
hours fragmented across notifications, feeds and compulsive checking. Mind Miles
is built to tell those two days apart.

The product principle underneath everything: **don't help people use technology
less, help them use it better.**

## Where this came from

The measurement engine is migrated from the `pulse` section of
[Spotify666/veil](https://github.com/Spotify666/veil) and rebuilt as a
standalone product.

**Carried over** — the parts that were already right:

| From veil | Now | What it does |
|---|---|---|
| `lib/pulse/tracker.ts` | `lib/mm/tracker.ts` | The 1Hz measurement loop: engaged time, keystroke counts, clicks, scroll, context switches |
| `lib/pulse/store.ts` | `lib/mm/store.ts` | localStorage persistence, degrading to memory when storage is blocked |
| `lib/pulse/aggregate.ts` | `lib/mm/aggregate.ts` | Minute buckets → bouts, hours, light dose |
| `lib/pulse/brightness.ts` | `lib/mm/brightness.ts` | Brightness with honest provenance: native / sensor / declared |
| `lib/pulse/types.ts` | `lib/mm/types.ts` | The raw data model |
| `lib/pulse/seed.ts` | `lib/mm/seed.ts` | Sample history so day one is readable |

**Extended in the tracker** — scroll *velocity* (the signal that separates
reading from feed-flicking), per-minute context switches, and in-app navigation
as a context change.

**Built new** — everything above the raw data:

```
lib/mm/aggregate.ts    minute classification, mileage, recovery windows
lib/mm/metrics.ts      the seven metrics, each with its full arithmetic attached
lib/mm/baseline.ts     personal baselines — medians, weekday/weekend separated
lib/mm/records.ts      personal records, each with a qualifying floor
lib/mm/challenges.ts   challenges measured against your own baseline
lib/mm/reclaimed.ts    time won back
lib/mm/coach.ts        rule-based insight generation
lib/mm/presence.ts     device-level presence, and one writer across tabs
lib/mm/extension.ts    merging what the extension saw
```

## The ideas that shaped the code

**One Mind Mile is 20 engaged minutes.** Not a gamification point — a unit, with
a stated conversion, printed next to the number. Every engaged minute is
classified exactly once as Focus, Scattered or Scroll, so the three always sum
back to total mileage.

**Every score can be taken apart — without reading an essay.** Tap any metric
and you get the number, the word for it and one sentence. Under that, one row
per input: what it is, what it was, how much it mattered. Each row opens to its
explanation only if you ask. The full working is always there; nobody has to
walk past it to leave.

**Every score carries a real measurement, not just a number out of 100.** Six
abstract scores look interchangeable however carefully they are named — number,
word, bar, number, word, bar — and a reader reasonably concludes the definitions
are all the same thing. So each card leads with the concrete figure that score is
mostly about: *1h 42m best run*, *3 breaks taken*, *3h 8m on screen*, *32 jumps an
hour*. That is what makes it obvious Rest and Jumpiness are measuring two
different things, and it is the part anyone can act on.

**It is written the way people talk.** That includes the metric names, which is
where it was hardest and mattered most — Fragmentation is **Jumpiness**,
Intentionality is **On Plan**, Visual Load is **Eyes**, Recovery is **Rest**,
Strain is **Effort**. The ids underneath keep the precise terms so the code still
reads exactly; only the label changes, because the label is the part a person has
to understand. Every metric also carries a plain line under its name. A number
nobody can read is not transparent, whatever is printed underneath it.

**Four provenance labels, shown everywhere.** `measured` (observed directly),
`derived` (arithmetic on measured values), `estimated` (inferred — treat as a
trend), `unavailable` (cannot be measured here, so no number is shown). Visual
Load reads `estimated` because no browser can read display brightness. Scroll
distance in metres is `estimated` and reported in metres rather than inflated
into kilometres.

**You versus you.** No population averages anywhere — partly because they would
require sending behaviour off the device, mostly because a developer's Tuesday
and a nurse's Tuesday have no business on the same curve. Baselines are medians
over 28 days, weekdays and weekends separated, and say "building" below four
comparable days.

**Records have qualifying floors.** "Lowest fragmentation" with no floor is won
by leaving your laptop shut. Every record that could be won by absence carries a
minimum engaged time — you have to show up to set one.

**Strain is load, not sin.** A hard day of chosen work should read as a hard day.
Strain only costs you in Digital Fitness where it *exceeded* what you recovered.

**Reclaimed time never counts focus.** Doing less work is not reclaiming time.
Only rapid-scroll, fragmented and late-night minutes below your baseline count.

**No engagement loop.** The live readout is at the bottom of Today, not the top.
A user who goes several days without opening this because their digital life is
in good order is a successful user.

## Seeing past this one tab

A web page can only see itself, and that limit produced a fair complaint: switch
tabs, work for an hour, come back, and nothing was recorded. Three things get
past it, and all three are honest about their reach.

**Device presence.** With `IdleDetector` permission granted, Mind Miles knows
whether *you* are at your device — at the OS level, while it sits in the
background. It still cannot see which app you were in, and never claims to. The
live panel says "This tab only" or "Your whole device", never something vaguer.

**The extension.** `extension/` is a working MV3 extension that sees every tab.
It records, per minute, how many seconds you were active and the **domain** —
the path, query and page title are discarded the moment a URL is seen. It stores
to `chrome.storage.local`, makes no network call, and hands its totals to the
page when you open Mind Miles.

**One writer.** Several Mind Miles tabs would each count the same minute, so a
lock in `localStorage` elects a single writer. The others keep their own live
readout and bank nothing.

Where the extension fills a minute, it contributes **time only** — never
keystrokes or scroll. It knows you were there; it does not know what you did,
because it does not look.

## Privacy

There is no account, no server, no analytics and no network call. Everything is
written to `localStorage` on the device that measured it.

Keystrokes are **counted**; the key is never read. There is no code path in this
repository that touches `event.key`. Clicks are counted, not located. Scroll
distance and velocity are measured; what was on screen is never inspected. No
site or application is identified, because a page cannot see them and this
product does not ask for a permission that would let it.

Export gives you the complete raw record as JSON. Delete removes it from the only
place it has ever existed. Both are one tap away in Profile.

## The way in

A first visit is sent to `/welcome`, not the dashboard — six numbers that mean
nothing yet explain nothing about what you have opened. The welcome makes the
argument in one picture: two days, five hours each, one drawn in solid blocks and
one in confetti. Screen time counts both as five hours. That is the entire case
for the product, and it lands before a word about metrics.

It lives at its own URL and is linked from the profile, so it can be read again.
It first shipped as a branch inside the Today route, which meant pressing its one
button closed the door permanently — there was no way back to the only screen
explaining what the product is. The splash does not play in front of it either:
the welcome *is* the entrance, and a title card over it only hides the thing you
came to read.

`/guide` is the companion reference — every number on screen, with what it means,
what goes into it, which way is good, and whether it is worth acting on.

## The opening

A cold frame, then the route draws itself, a spark runs its length, the mile
marker lands, and the name settles into place. Two and a half seconds, once per
browser session, skippable with any tap or key. Reduced motion gets the frame
without the choreography.

It is one gesture rather than a sequence of animations, which is what makes it
read as a signature instead of a loading screen — and the last 200ms, where the
wordmark's letter-spacing tightens as it fades up, is most of the feeling.

## Design

Dark, instrument-grade — the reference points are WHOOP, Oura, Strava's activity
detail and Linear. Colour is semantic: each metric owns one hue everywhere it
appears.

The categorical palette is **validated, not chosen by eye** — it passes lightness
band, chroma floor, normal-vision separation and contrast against the chart
surface on all pairs, with colour-deficiency separation in the band that requires
direct labels and surface gaps (which every multi-series chart here carries). An
earlier blue/violet pair measured ΔE 0.4 under deuteranopia — indistinguishable —
and was re-fitted by separating the hues in lightness as well as hue. The
reasoning is in `components/ui/tokens.ts`.

The logo is a route profile that spells **M**. Its second peak is higher than the
first, and it ends above where it started — the distance covered is not the
achievement, the altitude gained is.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
npm run typecheck
```

Next.js 14 App Router, TypeScript strict, Tailwind. No runtime dependencies
beyond React, Next and `clsx` — the charts are hand-written SVG.

## Structure

```
app/          Today · Trends · Challenges · Profile · Share · Method · Privacy
components/
  brand/      the mark and wordmark
  charts/     day timeline, mileage, trend line, baseline bar
  nav/        bottom tab bar (mobile) and header nav (desktop)
  profile/    brightness, intentions, manual log, data and sharing controls
  today/      the live deck and the narrative cards
  Splash.tsx  the opening
  Welcome.tsx the first visit
extension/    MV3 extension — the part that can see your other tabs
  ui/         ring, sheet, metric card with its explain sheet, provenance badge
lib/mm/       the measurement and scoring engine
```

`/method` lists every signal the app measures, every one it cannot, and every
threshold used in the scoring — including the ones that make the product look
less impressive than it could.

## What this is not

Not a medical instrument. Visual Load estimates how hard a day asked your eyes to
work; it is not a statement about your eyes, and nothing here diagnoses anything.
The scores are transparent heuristics over published ergonomic and sleep guidance.

Not a complete picture. This measures one browser on one device. Anything outside
it is logged by hand or marked unavailable — a low number can mean a calm day or
a day spent on another machine, and the app will not pretend to know which.
