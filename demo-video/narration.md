# OpenSlot — Demo Video Narration Script

Voice: calm, confident, ~150 words/min. The on-screen captions already show the
key lines; the VO should match them closely (so captions and voice never drift).
The wrapper is **1:42**; if you insert a screen recording in the DEMO chapter,
keep the whole thing **under 3:00**.

Timecodes are for the rendered wrapper (30 fps).

---

## 01 · INTRO — 0:00–0:10
> OpenSlot is the on-sale platform for event businesses.
> Run a worldwide rush for the same scarce seat — with zero oversell.

*(Beat. Let the title and the AWS line land.)*

## 02 · PROBLEM — 0:10–0:22
> High-demand on-sales break the same three ways:
> oversold seats, bot armies, and crashes at peak.
> And the root cause is always the same — there's no single source of truth for a seat.

## 03 · DATABASES — 0:22–0:48  *(the required AWS-database explainer)*
> So the seat ledger runs on Amazon Aurora DSQL —
> multi-region and active-active: us-east-1 and us-east-2 both take reads and writes,
> as one strongly-consistent database.
> A seat is sold exactly once. That's structural — conflicts surface as an OC000 and retry, never a double-sell.
>
> Discovery needs something different, so it runs on a second database — Amazon Aurora PostgreSQL —
> with PostGIS and pgvector, the extensions DSQL can't host. That's how fans find drops near them, ranked by meaning.

## 04 · ARCHITECTURE — 0:48–1:06
> Next.js on Vercel sits in front — the UI and the API.
> Aurora DSQL owns the money: seat claims, metrics, and the fairness ledger.
> Aurora PostgreSQL owns discovery — and discovery joins live stock straight from the DSQL ledger.
> Strong consistency where the money is; geo and vector where discovery is.

## 05 · LIVE DEMO — 1:06–1:24  *(no VO needed; the product speaks)*
*Talking points if you narrate over your own screen recording:*
- "Here's the organizer console — live sales, the seat map, and the revenue we protect."
- "A fan finds a drop on the storefront, picks a seat — purple is yours, gray is taken."
- "Now a worldwide rush at one seat — eight hundred buyers, two regions. Oversold stays zero."
- "And the ticket has a gate code that rotates every thirty seconds, so a screenshot is worthless."

## 06 · RESULTS — 1:24–1:42
> Only a strongly-consistent, multi-region ledger does all five —
> multi-region writes, strong consistency, zero oversell, provably fair, and geo-plus-vector discovery.
> Async multi-region simply can't.
> OpenSlot — sell out, safely.

---

## Production notes
- **Captions**: already burned into the wrapper (`Subtitles.tsx`). If you record VO, the
  timings above line up; tweak `NARRATION[].from/.dur` if your delivery is faster/slower.
- **Music**: add a royalty-free / no-attribution bed (e.g. Mixkit), low (~-18 LUFS), ducked
  under the live demo. Don't use copyrighted tracks (hackathon rule).
- **Live footage**: drop your recording as `demo-video/public/demo.mp4` and swap the
  screenshot montage in `src/scenes/Demo.tsx` for `<OffthreadVideo src={staticFile("demo.mp4")} …>`.
- **Trademarks**: the app's seed events were renamed to fictional names (SKYLINE HORIZON,
  LUMA, PHANTOM 92, DropZone, AURORA NIGHTS) — keep your screen recording on those.
- **Total length**: wrapper 1:42 + your demo clip → keep under 3:00 (judges stop at 3:00).
