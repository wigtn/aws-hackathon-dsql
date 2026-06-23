# OpenSlot — Test plan & 3-minute demo script

## A. How to verify (manual smoke test)

```bash
npm install && npm run build && PORT=3100 npm run start
```

### A1. Hero — cross-region stampede (the money shot)
1. Open `http://localhost:3100/demo`.
2. Preset **"last seat · 2 regions"** → **▶ fire stampede**.
3. Assert: **Oversold: 0**, granted = 1, OC000 conflicts > 0, both regions show
   activity, p95(us-east-2) ≥ p95(us-east-1).
4. Change seed → re-run → numbers differ but **Oversold stays 0**.
5. Same seed twice → identical numbers (reproducibility).

### A2. Capacity-N stampede
- Preset **"capacity 50 · stampede"** → fire → granted = exactly 50, oversold 0.

### A3. Full buyer path
1. `/` → search **"indie show this weekend near me"** → "Slow Static" ranks #1
   (pgvector). Toggle radius → list changes (PostGIS).
2. Open a **live** event (STRAY HORIZON / SNKRS) → pick a seat → **claim**.
3. Phone → **send code** → demo code appears → **verify & claim** → seat
   confirmed; panel shows commit latency, attempts, **OC000 absorbed, double
   sale 0**.
4. `/me` → ticket with a **rotating 6-digit gate code** counting down 30s.

### A4. Fair re-release (Originality)
1. `/org/console` → pick STRAY HORIZON.
2. **fill to sold out** → **+ waitlister** (×2) → **cancel a seat → re-offer**.
3. Assert log: "seat #N released → LOCKED offer to fan-1 (#1)". The seat shows ★
   (reserved), not grabbed by the open pool.

### A5. Security guards (curl)
```bash
# attacker cannot confirm someone else's seat (ownership predicate)
curl -s -XPOST localhost:3100/api/claim -d '{"action":"confirm","eventId":"ev-kpop-world","buyerId":"attacker","seatNo":1}'
# → {"ok":false}
```

### A6. Automated assertion (CI-style)
Run `node scripts/verify.mjs` (below) — exits non-zero if oversold ever > 0.

---

## B. 3-minute video script (Must-haves, in order)

> Headline framing: **"Competitors do these one at a time. We do them at once,
> on one strongly-consistent ledger."** Record in this order; keep the hero first.

**0:00–0:20 — The problem (1 line + 1 visual).**
Show the `/` masthead: "The last seat, sold once." Say: *"When a global drop
opens, the whole world buys the same seat in the same second. Everyone else
oversells, crashes, or shows stale availability."*

**0:20–1:10 — ★ HERO: cross-region stampede (`/demo`).**
*"Two AWS regions, active-active, on Aurora DSQL."* Fire the **last-seat** preset.
Land on **Oversold: 0**, point at OC000 conflicts and the per-region table. Say:
*"800 buyers across us-east-1 and us-east-2 fought for one seat. Exactly one won.
The losers got OC000 and retried — nobody got a double sale. Aurora PostgreSQL
Global is async — this is structurally impossible there."* Bump the seed, re-run,
**zero holds**. (1 line of honesty: *"cross-region commits pay ~2 RTT — that's the
price of zero data loss, and it's visible right here."*)

**1:10–1:40 — Capacity-N + the buyer path.**
Fire **capacity 50** → exactly 50. Then `/` → semantic search → open a live event
→ claim a seat → OTP → **confirmed**, with the OC000/double-sale=0 receipt.

**1:40–2:10 — Fair re-release (Originality) on `/org/console`.**
Fill to sold out, add 2 waitlisters, **cancel a seat**. Show it **locked-offered**
to #1, not thrown to the fastest bot. Say: *"Cancellations don't restart the bot
race — they're locked to the next real fan."*

**2:10–2:35 — Anti-scalp, honestly (`/me`).**
Show the ticket's **rotating 30s barcode**. Say: *"Identity- and device-bound,
with a rotating gate code — a screenshot is worthless. We don't claim resale is
impossible; we make it a losing trade."*

**2:35–3:00 — Why this stack (close on the architecture diagram).**
*"One ledger on Aurora DSQL for zero-oversell cross-region writes. A second plane
on Aurora PostgreSQL for PostGIS + pgvector discovery — extensions DSQL doesn't
have. Frontend on Vercel. Two databases, by design, because no single engine does
both."* End on the AWS console screenshot (DSQL multi-region ACTIVE + Aurora PG).

### Recording tips
- Record `/demo` with the seed fixed so the run is reproducible across takes.
- Keep the browser at a wide viewport — the editorial layout + mono numerics read
  as "engineering credibility," which is the Technical-score subtext.
- Capture the **AWS console** (DSQL cluster ACTIVE in 2 regions + witness, Aurora
  PG with postgis/vector) live, with secrets masked — required submission proof.
- Put 2–3 build-log posts on socials with **#H0Hackathon** for the +0.6 bonus.
