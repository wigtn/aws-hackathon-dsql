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
