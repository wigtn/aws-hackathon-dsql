## 💡 Inspiration

Every few weeks the same headline runs: a major on-sale melts down. The same seat
sells to two people, a refund war starts, bots scoop the inventory, and the site
falls over at the exact moment demand peaks. The fans lose, and the organizer —
the artist, the brand, the promoter — eats the cost and the reputation hit.

We kept asking *why* this still happens in 2026, and the answer was always the
same: **there is no single source of truth for a seat.** Most ticketing stacks
either run a single-region database (a global audience hammering one region) or
they scale out with **asynchronous** replication — which means two regions can
believe the same seat is free at the same instant. The oversell isn't a bug in
the checkout code; it's baked into the data layer.

So we flipped the question. Instead of *"how do we patch oversell,"* we asked
*"what database makes oversell structurally impossible?"* That question led us
straight to **Amazon Aurora DSQL**, and **OpenSlot** is what we built on top of it.

## 🎟️ What it does

OpenSlot is **on-sale infrastructure for event businesses** — the engine an
organizer runs a worldwide drop on without the disasters.

- **Zero oversell, by design.** Every seat is a row in a strongly-consistent,
  multi-region ledger. A seat is granted *exactly once*, even with the whole
  planet racing for the last one.
- **Provably fair.** Allocation order is projected from the ledger itself, so an
  organizer can show fans and regulators *exactly* who got each seat and why —
  no bot or insider lane.
- **Bound to a real person.** Tickets are identity- and device-bound, with a gate
  code that **rotates every 30 seconds**, so a screenshot is worthless to a scalper.
- **Discovery that understands intent.** Fans find drops *near them*, ranked by
  meaning, not just keywords.

The organizer console is the product: live sell-through, a real-time seat map,
revenue protected, and an on-sale health panel reading `0 double-sold ·
0 failed checkouts · bots blocked · fair allocation verified`.

## 🛠️ How we built it

**Two databases, one job each — because no single engine does both.**

**1) The seat ledger — Amazon Aurora DSQL.**
DSQL is active-active across `us-east-1` and `us-east-2` (with a `us-west-2`
witness for quorum), exposed as **one logical, strongly-consistent database**.
We modeled inventory as **one row per seat** and lean append-only, following
DSQL's high-contention guidance (small transactions, prefer new keys over
in-place updates). DSQL uses **optimistic concurrency control**: conflicts are
detected at commit and surface as `OC000`, which we catch and retry with
**exponential backoff + jitter**. Because commits share a single global order,
the oversell count is:

$$
\text{oversold} \;=\; \max\!\big(0,\; \text{granted} - \text{capacity}\big) \;=\; 0
$$

— not as a promise, but as a property of serialization. Contrast the async world,
where a replication lag $\Delta$ opens a race window and the probability of a
double-sell under demand rate $\lambda$ behaves like

$$
P(\text{double\text{-}sell}) \;\approx\; 1 - e^{-\lambda \Delta} \xrightarrow[\;\Delta \to 0\;]{} 0 ,
$$

and strong, synchronous multi-region replication is precisely what drives
$\Delta \to 0$.

**2) Discovery — Amazon Aurora PostgreSQL.**
Discovery needs **PostGIS** (geo-radius search) and **pgvector** (semantic
ranking) — extensions DSQL can't host. So a second database is *required*, not a
luxury. Discovery queries rank by meaning and distance, then **join live stock
straight from the DSQL ledger** so a "sold out" never lies.

**Frontend / edge.** Next.js 15 (App Router) on **Vercel** — the storefront, the
organizer console, the buyer claim flow, and the `/proof` page. API routes talk
to Aurora DSQL over the Postgres wire with **IAM-token auth**, and to Aurora
PostgreSQL for discovery.

**The honest tradeoff, on screen.** Strong multi-region consistency isn't free:

$$
T_{\text{commit}} \;\gtrsim\; 2 \cdot \mathrm{RTT}_{\text{inter\text{-}region}}
$$

We *show* this cost on the proof page (visible in the `us-east-2` p95) instead of
hiding it — that latency is the price of zero data loss and zero stale reads, and
it's the right trade for money-critical writes.

## 📚 What we learned

- **Pick the database for the invariant, not the feature list.** "Zero oversell"
  is a *consistency* invariant, so the consistency model — not the ORM or the
  framework — is the real design decision.
- **Design *for* conflict, not *against* it.** Under OCC, the winning pattern is
  many small, append-only transactions on distinct keys (row-per-seat) plus
  disciplined retry — fighting contention with row-level fan-out, not locks.
- **Constraints are documentation.** DSQL's missing features each *taught* us the
  right shape: no foreign keys → explicit app-level authorization; no partial
  indexes → reuse released-seat slots instead; transaction limits → chunked work.
- **Two databases can be the honest answer.** "Strongly-consistent concurrent
  writes" and "geo + vector discovery" genuinely cannot live in one engine today,
  and saying so is more credible than forcing one DB to fake both.

## 🧗 Challenges we faced

- **Optimistic concurrency at stampede scale.** Thousands of buyers hit the last
  seats at once. We tuned `OC000` retry with bounded exponential backoff and
  randomized jitter so retries don't synchronize into a thundering herd — and
  proved it: 2,000 buyers for 100 seats → **100 granted, 0 oversold, ~2,264
  conflicts retried, never double-sold.**
- **Asynchronous secondary indexes.** DSQL builds indexes with `CREATE INDEX
  ASYNC`; a unique constraint isn't enforced until the index is `ACTIVE`. We poll
  `sys.jobs` and only open the sale once the index is live — otherwise uniqueness
  is a lie during the build window.
- **No foreign keys → IDOR by default.** Without FK-enforced integrity, every
  cross-entity access needs explicit app-level authorization. We hardened the
  claim and ticket paths so one buyer can never read or grab another's seat.
- **Hard transaction limits.** DSQL caps a write transaction at **3,000 changed
  rows / 10 MiB / 5 minutes**. Pre-generating seats and re-releases had to be
  **chunked** to stay under the row limit, with an idempotent one-time seed.
- **Connection lifecycle.** Connections live at most 60 minutes and auth is via
  short-lived IAM tokens, so the data layer had to reconnect and re-sign
  transparently under sustained load.
- **Multi-region pairing reality.** DSQL multi-region clusters live within a
  single region set (no cross-continent pairs), so we anchored on the canonical
  `us-east-1 + us-east-2 + witness us-west-2` topology and kept a single-region
  fallback gate for safety.

OpenSlot is the result: **sell out — without the disasters.**
