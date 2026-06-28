# Testing Instructions for the Judges

**Live app:** https://openslot-five.vercel.app  ← *(please confirm this is your final Vercel URL)*

No login or install required. The whole tour takes **~2–3 minutes**. Everything
below runs against the real backend — **Amazon Aurora DSQL** (the seat ledger) and
**Amazon Aurora PostgreSQL** (discovery).

> **Demo affordance:** the SMS step shows the 6-digit code on screen (`demo code:
> ……`) so you can complete a real purchase without a phone. In a true production
> deploy this is disabled with `OPENSLOT_DEMO_OTP=off`.

---

## The 90-second path (recommended)

### 1 · Organizer console — watch a sell-out, with zero oversell
1. Open **`/org/console`** (top nav → **Console**).
2. From the event selector, pick **"SKYLINE HORIZON World Tour"** (any multi-seat event).
3. Under **Demo controls**, click **"Sell out"** (or tap **"+ 8 buyers"** a few times).
4. Watch **Tickets sold / Revenue / Sell-through** count up and the **seat map** fill in real time.
5. Confirm the **On-sale health** panel stays green:
   `0 double-sold · 0 failed checkouts · bots blocked · fair allocation verified`.
6. Note **Fair allocation → VERIFIED ✓** — order is projected from the DSQL ledger,
   not an in-memory guess.

### 2 · Buyer flow — discover → pick a seat → claim it
1. Go to **`/discover`** (top nav → **Discover**). Type **"indie shows this weekend"**
   — results re-rank by meaning + distance (Aurora PostgreSQL: pgvector + PostGIS).
2. Open any **live** event, then **click an open seat** — it turns **purple with a ✓**
   (gray = already taken). Click **"Get tickets"**.
3. Enter any phone (e.g. **`+82 10 1234 5678`**) → **Send code** → the **demo code**
   appears on screen → **Verify & get ticket**.
4. You land on **"Seat #N is yours."** — note **double-booked: never** and the commit time.
5. Click **View my ticket** (`/me`): the **gate code rotates every 30 seconds**
   (a screenshot is useless at the gate).

### 3 · The proof — a worldwide stampede on one ledger
1. Open **`/demo`** (top nav → **Proof**).
2. Pick the preset **"capacity 100 · flash"** (or **"last seat · 2 regions"**) → **▶ Fire stampede**.
3. Read the result tiles:
   - **OVERSOLD = 0** (structural) — the headline result.
   - **GRANTED = 100 / 100**, **BUYERS = 2,000**, **OC000 conflicts ≈ 2,264** (retried, never double-sold).
   - **By region:** `us-east-1` and `us-east-2` both take writes; the `us-east-2`
     p95 shows the *honest cost* of synchronous cross-region commits (zero data loss,
     zero stale reads).

---

## What to look for (maps to the judging axes)

| You'll see | Why it matters |
|---|---|
| `OVERSOLD 0` after 2,000 buyers race 100 seats | **Technical** — strong consistency + OCC (`OC000` retry) on Aurora DSQL |
| Two regions both writing, one logical DB | **Technical** — active-active, not async replication |
| Semantic + geo discovery, live stock | thoughtful **dual-DB** integration (Aurora PostgreSQL) |
| One-tap seat map, rotating gate code, clean console | **Design** + anti-scalp **Originality** |
| Fair-allocation ledger you can audit | **Impact** — provably fair on-sale infrastructure |

## Notes
- **Reset:** the proof simulator is deterministic (seeded) and idempotent — re-run
  **Fire stampede** as many times as you like; oversold stays **0**.
- **Seeded events are fictional** (SKYLINE HORIZON, LUMA, PHANTOM 92, DropZone,
  AURORA NIGHTS) — no real trademarks.
- **AWS DB evidence:** see the architecture diagram + AWS console screenshots in the
  submission; the `/demo` page is the live, in-app proof.
