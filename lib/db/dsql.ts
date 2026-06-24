// Aurora DSQL connection pools, one per active region, with IAM-token auth.
// The pg password is a provider function → a fresh admin token is minted per new
// connection via the DSQL signer (no static secret; tokens are short-lived).
import pg from "pg";
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import { RegionId } from "@/lib/sim/types";

const ENDPOINTS: Record<RegionId, string | undefined> = {
  "us-east-1": process.env.DSQL_ENDPOINT_US_EAST_1,
  "us-east-2": process.env.DSQL_ENDPOINT_US_EAST_2,
};

export const PRIMARY: RegionId = "us-east-1";

const pools: Partial<Record<RegionId, pg.Pool>> = {};

export function poolFor(region: RegionId): pg.Pool {
  const existing = pools[region];
  if (existing) return existing;
  const host = ENDPOINTS[region] ?? ENDPOINTS[PRIMARY];
  if (!host) throw new Error("DSQL_ENDPOINT_US_EAST_1 is not set");
  const r = ENDPOINTS[region] ? region : PRIMARY;
  const signer = new DsqlSigner({ hostname: host, region: r });
  const pool = new pg.Pool({
    host,
    port: 5432,
    user: "admin",
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    password: async () => signer.getDbConnectAdminAuthToken(),
  });
  pools[region] = pool;
  return pool;
}

export async function q(
  region: RegionId,
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult> {
  return poolFor(region).query(text, params);
}
