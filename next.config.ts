import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // OpenSlot runs in a deterministic in-memory simulation by default (no live AWS
  // required for the demo). Real Aurora DSQL / Aurora PostgreSQL adapters activate
  // automatically when DSQL_ENDPOINT / AURORA_PG_URL env vars are present. See lib/db.
  env: {
    OPENSLOT_DATA_PLANE: process.env.DSQL_ENDPOINT ? "aurora" : "simulation",
  },
};

export default nextConfig;
