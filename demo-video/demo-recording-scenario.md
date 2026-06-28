# OpenSlot — Live Demo Recording Scenario

A click-by-click scenario for the **screen recording** that goes into the DEMO
chapter of the submission video. Goal: in ~60–75 seconds, show the product
actually working across all four judging axes (Technical · Design · Impact ·
Originality) — with no trademarks, no dead ends, no fumbling.

---

## 0 · Setup (before you hit record)

- **Run the app clean**
  ```bash
  npm run build && PORT=3000 npm run start
  ```
  (Runs on the real Aurora DSQL plane via `.env`; the catalog self-heals to the
  fictional names — SKYLINE HORIZON, LUMA, PHANTOM 92, DropZone, AURORA NIGHTS.)
- **Browser**: Chrome, 1440×900 (or 1920×1080), **125% zoom off**, no extensions
  bar, hide bookmarks. Use an incognito window so localStorage starts empty
  (fresh "My tickets").
- **OS**: Do Not Disturb on (no notifications). Cursor highlight on if you have it.
- **Recorder**: 1080p, 30/60 fps, capture the browser content area only (no tabs/URL
  bar if you can — cleaner). QuickTime / OBS / CleanShot all fine.
- **Trademarks**: stay on the seeded fictional events. Don't type real brand names.
- **Rehearse once** so the on-sale events are LIVE (open) when you record.

> Tip: record each beat as its own take; you'll cut between them. Hold ~1s of
> stillness at the start/end of each so cuts are clean.

---

## 1 · Shot list (target ~70 s)

| # | Route | Action | Hold | What it proves |
|---|-------|--------|------|----------------|
| 1 | `/` | Land on the homepage. Slow scroll past the hero + the four guarantees. | 4 s | Design · product framing |
| 2 | `/org/console` | The organizer console loads. From the drop selector pick **"SKYLINE HORIZON World Tour"**. | 3 s | The B2B customer |
| 3 | `/org/console` | Click **"Sell out"** (Demo controls). Watch **Tickets sold / Revenue / Sell-through** count up; the **seat map** fills purple. | 6 s | It's live + real numbers |
| 4 | `/org/console` | Glance at **On-sale health** (✓ 0 double-sold · ✓ 0 failed checkouts · ✓ bots blocked) and the **Verified ✓** fair-allocation card. | 4 s | Impact + Originality |
| 5 | `/discover` | Click **Discover** in the nav. Type **"indie shows this weekend"** in search — cards re-rank. Note a **"soon"** card's live countdown ticking. | 6 s | Aurora PostgreSQL (geo+vector) |
| 6 | `/event/…` | Open a live multi-seat event (e.g. **SKYLINE HORIZON**). Click an open seat — it turns **purple with a ✓**; gray seats are taken. | 5 s | Design · the seat picker |
| 7 | `/claim/…` | Click **"Get tickets"**. Enter a phone (`+82 10 1234 5678`) → **Send code** → the demo code appears → **Verify & get ticket**. | 8 s | Buyer flow works end-to-end |
| 8 | claim result | Land on **"Seat #N is yours."** — receipt shows *confirmed in … · double-booked: never*. Click **View my ticket →**. | 4 s | Confirmed, no double-sell |
| 9 | `/me` | The ticket shows a **gate code that rotates every 30 s** (watch the meter shrink). | 4 s | Anti-scalp (rotating code) |
| 10 | `/demo` | Click **Proof** in the nav. Pick preset **"last seat · 2 regions"** → **▶ Fire stampede**. | 3 s | Set up the money shot |
| 11 | `/demo` | The result tiles land: **OVERSOLD 0** · GRANTED 1 · **OC000 ~799** · 800 buyers; two regions with **us-east-2 p95 ≥ us-east-1**. Hold on the big **0**. | 7 s | **Technical — zero oversell, real cross-region** |

**End on shot 11** (the `0 oversold`) — it's the strongest frame to cut back to the
outro.

---

## 2 · Shorter cut (~40 s, if you're tight)

Beats **3 → 6 → 7/8 → 11**:
console "Sell out" (numbers move) → pick a seat (purple ✓) → claim → "Seat is yours"
→ fire stampede → **OVERSOLD 0**. That alone tells the story.

---

## 3 · Optional bonus beat — create a drop (Design/Impact)

Between shots 2 and 3, click **"+ New drop"**: type a name (e.g. *"Night Market
Live"*), pick a **city preset**, drag the **map pin** (Aurora PostgreSQL location),
choose **open now**, **Create**. Shows self-serve onboarding + the second DB's geo
side. Adds ~8 s.

---

## 4 · After recording

- Trim each take; aim for a continuous ~60–75 s sequence.
- Drop the final file at **`demo-video/public/demo.mp4`** — tell me and I'll swap the
  screenshot montage in `src/scenes/Demo.tsx` for `OffthreadVideo` and re-render one
  final MP4 (keep total **< 3:00**).
- Or cut it in your editor over the wrapper's DEMO chapter (1:06–1:24) and extend as
  needed.

> Narration to read over it: see `narration.md` → "05 · LIVE DEMO".
