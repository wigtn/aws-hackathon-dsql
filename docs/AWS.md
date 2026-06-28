# AWS — Aurora DSQL multi-region (live)

Provisioned for the H0 submission. The hero claim (zero oversell across regions)
is **proven on real infrastructure**, not just simulated.

## Clusters (account 800445863365)

| Role | Region | Cluster ID | Endpoint |
|---|---|---|---|
| active | us-east-1 (N. Virginia) | `fjt32vzqea4jm366gb2ssonbiq` | `fjt32vzqea4jm366gb2ssonbiq.dsql.us-east-1.on.aws` |
| active | us-east-2 (Ohio) | `5rt32vy2c7qvvcptxzxsjjwiji` | `5rt32vy2c7qvvcptxzxsjjwiji.dsql.us-east-2.on.aws` |
| witness | us-west-2 (Oregon) | — | quorum tiebreaker, no endpoint |

Both endpoints are one logical, strongly-consistent database (active-active).

## Connect (IAM auth, no static password)

```bash
# admin auth token (valid up to 1h), used as the Postgres password
aws dsql generate-db-connect-admin-auth-token \
  --hostname fjt32vzqea4jm366gb2ssonbiq.dsql.us-east-1.on.aws \
  --region us-east-1 --expires-in 3600 --output text
# then: user=admin db=postgres port=5432 sslmode=require
```

## Reproduce the cross-region proof

```bash
node scripts/dsql-setup.mjs
# applies the seat-ledger schema (+ ASYNC unique index, polled via sys.jobs),
# seeds one last seat, fires 24 concurrent claims across BOTH regions, asserts:
#   winners = 1 · OC000 = 23 · oversold = 0 · strong-consistent read in both regions
```

Latest run: **24 buyers → 1 winner, 23 OC000, 0 oversold**, both endpoints read the
same buyer instantly (RPO 0, stale read 0).

## App wiring

Set these (e.g. in `.env.local`, gitignored) and the app's data plane flips from
simulation to real Aurora DSQL with no code changes (see `lib/db.ts`):

```
DSQL_ENDPOINT_US_EAST_1=fjt32vzqea4jm366gb2ssonbiq.dsql.us-east-1.on.aws
DSQL_ENDPOINT_US_EAST_2=5rt32vy2c7qvvcptxzxsjjwiji.dsql.us-east-2.on.aws
DSQL_WITNESS_REGION=us-west-2
```

## Teardown (after the demo — stop credit burn)

```bash
aws dsql delete-cluster --region us-east-1 --identifier fjt32vzqea4jm366gb2ssonbiq
aws dsql delete-cluster --region us-east-2 --identifier 5rt32vy2c7qvvcptxzxsjjwiji
# deleting one peer tears down the multi-region link; delete both.
```

> DSQL is serverless (pay per request + storage) — idle cost is negligible, but
> delete after the submission video is recorded to be safe.

---

# AWS — Aurora PostgreSQL (discovery plane)

The **second** database, by deliberate design. DSQL gives strong-consistent
cross-region writes but does **not** support PostGIS or pgvector — so geo radius
search and semantic ranking force a real Postgres (CLAUDE.md §4, PRD §5). This is
the dual-DB justification made literal, and the second AWS-DB submission screenshot.

## Cluster (live · account 800445863365)

| Item | Value |
|---|---|
| Cluster | `openslot-discovery` (Aurora PostgreSQL **16.9**, Serverless v2 0.5–2 ACU) |
| Writer | `openslot-discovery-1` (`db.serverless`, publicly accessible) |
| Region | us-east-1 (N. Virginia) |
| Writer endpoint | `openslot-discovery.cluster-cmx2ig2owws2.us-east-1.rds.amazonaws.com:5432` |
| Master user | `openslot` · db `postgres` (password in `.env`, gitignored) |
| Security group | `sg-0d7eb7de881a17630` (inbound 5432) |

**Proof run (real infra):** `postgis 3.5.1` + `vector 0.8.0` enabled · GiST +
HNSW(`vector_cosine_ops`) indexes · PROOF A `ST_DWithin ≤ 50 km` returns Seoul
events and excludes the NYC drop · PROOF B `pgvector <=>` ranks the indie show #1
for "indie show this weekend near me" → **RESULT: PASS**.

## Provision (Aurora PostgreSQL Serverless v2)

Use an existing default VPC's subnets + a security group that allows inbound 5432
from your IP (or run the script from inside the VPC). PostGIS + pgvector ship with
Aurora PostgreSQL 15.4+/16.x — no extra setup beyond `CREATE EXTENSION`.

```bash
REGION=us-east-1
# 1. subnet group (two AZs from your default VPC)
aws rds create-db-subnet-group --region $REGION \
  --db-subnet-group-name openslot-pg --db-subnet-group-description "openslot discovery" \
  --subnet-ids <subnet-az-a> <subnet-az-b>

# 2. serverless v2 cluster (0.5–2 ACU is plenty for the demo)
aws rds create-db-cluster --region $REGION \
  --db-cluster-identifier openslot-pg --engine aurora-postgresql --engine-version 16.4 \
  --master-username openslot --master-user-password '<STRONG_PW>' \
  --db-subnet-group-name openslot-pg --vpc-security-group-ids <sg-id> \
  --serverless-v2-scaling-configuration MinCapacity=0.5,MaxCapacity=2

# 3. one writer instance
aws rds create-db-instance --region $REGION \
  --db-instance-identifier openslot-pg-1 --db-cluster-identifier openslot-pg \
  --engine aurora-postgresql --db-instance-class db.serverless

# 4. wait, then read the writer endpoint
aws rds describe-db-clusters --region $REGION --db-cluster-identifier openslot-pg \
  --query 'DBClusters[0].Endpoint' --output text
```

## Setup + proof (the screenshot)

```bash
export AURORA_PG_URL='postgresql://openslot:<PW>@<writer-endpoint>:5432/postgres'
node scripts/pg-setup.mjs
# CREATE EXTENSION postgis + vector → events(venue_geom geography, embedding vector(12))
#   with GiST + HNSW(vector_cosine_ops) indexes → seeds the catalog → then proves:
#   PROOF A  ST_DWithin(≤50 km of Seoul) returns Seoul events, excludes NYC SNKRS
#   PROOF B  embedding <=> "indie show this weekend near me" ranks Slow Static #1
# → RESULT: PASS. Screenshot the extension versions + both proof tables.
```

## App wiring

```
AURORA_PG_URL=postgresql://openslot:<PW>@<writer-endpoint>:5432/postgres
```

With this set, `/api/discover` runs real PostGIS + pgvector (`lib/db/pg-discovery.ts`)
and reports `plane: "aurora-postgresql · postgis + pgvector"`; live seat stock is
JOINed from the DSQL ledger. Unset → discovery falls back to the deterministic
model and the API honestly reports `plane: "simulation"` (no false real-plane claim).

## Teardown (after the demo)

```bash
aws rds delete-db-instance --region us-east-1 --db-instance-identifier openslot-discovery-1 --skip-final-snapshot
aws rds delete-db-cluster  --region us-east-1 --db-cluster-identifier openslot-discovery --skip-final-snapshot
```

> Serverless v2 bills per ACU-hour — min 0.5 ACU runs ~24/7 while the cluster
> exists. Delete the instance + cluster once the screenshot/video are captured.
