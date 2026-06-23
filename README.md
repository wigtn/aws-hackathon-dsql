# OpenSlot — the on-sale infrastructure for high-demand drops

> **H0: Hack the Zero Stack** submission · Track: **Monetizable B2B App**
> The on-sale/drop infrastructure that event businesses — artists, brands,
> promoters, ticket sellers — run to take a worldwide rush for the same scarce
> seat with **zero oversell across regions** and resale made a losing trade.
> Built on **Amazon Aurora DSQL** multi-region strong consistency (seat ledger)
> + **Amazon Aurora PostgreSQL** PostGIS/pgvector (discovery). Frontend on
> **Vercel** / **Next.js**.
>
> **Who pays:** the organizers (B2B — fees / subscription / anti-scalp value).
> Buyers transact free. The product surface that sells it is the **organizer
> console** (`/org/console`); the consumer flow shows the guarantee it delivers.

---

## The one-sentence pitch

When a global drop goes on sale, the whole world hits the same limited inventory
in the same second. Single-region or async-replicated databases either oversell,
fall over, or serve stale "still available" reads. **Aurora DSQL is the only
engine that takes those writes active-active across regions with strong
consistency** — so OpenSlot can promise *double-sell = 0* as a structural
guarantee, not a hope.

## Why two databases (deliberate — see PRD §5)

| Plane | Engine | Job | Why it's forced |
|---|---|---|---|
| **Seat ledger** | **Aurora DSQL** | multi-region active-active strong-consistency claims | Only DSQL gives zero-oversell **cross-region writes**. Aurora PG (incl. Global DB) is **async** → structurally can't. |
| **Discovery** | **Aurora PostgreSQL** | "drops near me / by meaning" — PostGIS radius + pgvector semantic | DSQL doesn't support extensions → Postgres is forced. |

A single database forces you to drop **either** geo+vector **or** multi-region
strong-consistent writes. We need both → two planes, DSQL is the source of truth
for availability.

## What's in the box

| Route | What it proves |
|---|---|
| `/` | Discovery — PostGIS radius + pgvector semantic search, live stock joined from the DSQL ledger |
| `/demo` | **★ HERO** — cross-region stampede console: fire N buyers at two regions, watch oversold stay **0** |
| `/event/[id]` | Live seat map (relational render), countdown, capacity, on-sale state |
| `/claim/[id]` | OTP → device-bound session → OCC claim, surfacing `OC000` honestly |
| `/me` | Identity+device-bound tickets with a **rotating 30s barcode** (screenshot expires) |
| `/org/console` | Live floor + **fair re-release**: cancel → locked offer to waitlist #1 (bots can't grab it) |
| `/admin` | Stub — but auth is enforced independently of `NODE_ENV` |

## Run it

```bash
npm install
npm run dev        # http://localhost:3000  (use PORT=3100 if 3000 is taken)
```

No AWS credentials are required to run the demo. OpenSlot ships with a
**deterministic in-memory simulation** of the DSQL seat ledger that reproduces
its exact semantics — row-per-seat contention, snapshot isolation, commit-time
`OC000` conflicts, cross-region commit latency, exactly-N capacity, fair
re-release. Same `seed` → identical run (reproducible for the video).

### Pointing at real Aurora (optional)

Set these and the real adapters activate with **no call-site changes** — the
ledger SQL in `lib/db.ts` (`DSQL_CLAIM_SQL`) is a 1:1 translation of the
simulation's check-and-set, wrapped in `lib/occ.ts` (`withOccRetry`, handles
`OC000`/`OC001`):

```
DSQL_ENDPOINT_US_EAST_1=...     # us-east-1 regional endpoint
DSQL_ENDPOINT_US_EAST_2=...     # us-east-2 regional endpoint
DSQL_WITNESS_REGION=us-west-2   # quorum tiebreaker, no endpoint
AURORA_PG_URL=...               # PostGIS + pgvector discovery plane
OPENSLOT_DEMO_OTP=off           # hide the demo OTP hint in a real deploy
```

## Architecture

```
 Vercel (Next.js, edge/functions)
   ├─ /demo, /event, /claim, /me, /org   ← UI
   └─ /api/* route handlers
        ├─ claim engine  → Aurora DSQL  (seat ledger · OCC · OC000 retry)   [source of truth]
        ├─ discovery     → Aurora PostgreSQL (PostGIS radius + pgvector)
        └─ otp / session → device-bound, sealed buyer_id

 Aurora DSQL  ── us-east-1 ⇄ us-east-2  (synchronous, strong-consistent)
              └─ witness us-west-2 (quorum tiebreaker)
```

## Honesty fences (we don't overclaim)

- **DSQL solves double-sell only.** Resale/bots are solved by the *other* layers
  (identity+device binding, rotating barcode + gate scan, BotID, fair
  re-release). DSQL is necessary, not sufficient.
- **"Resale impossible" is never claimed** — accounts/devices can be transferred.
  We claim **resale friction up, bot mass-claiming uneconomic**.
- **Cross-region commits cost ~2 RTT.** That's the honest price of zero data loss
  and zero stale reads. It's visible in the demo (us-east-2 p95 > us-east-1).
- **Multi-region pairing** uses the documented US example (us-east-1 + us-east-2
  + witness us-west-2). Region/pair availability is re-checked at deploy time.

See `CLAUDE.md` for the full rules + judging criteria + AWS DSQL official facts,
and `docs/prd.md` for the product spec (§17 = binding implementation decisions).

#H0Hackathon
