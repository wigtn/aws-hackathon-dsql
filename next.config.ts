import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // OpenSlot runs in a deterministic in-memory simulation by default (no live AWS
  // required for the demo). Real Aurora DSQL / Aurora PostgreSQL adapters activate
  // automatically when DSQL_ENDPOINT / AURORA_PG_URL env vars are present. See lib/db.
  env: {
    // Keyed on the SAME var that actually selects the data plane (lib/db.ts)
    // so the displayed plane can never disagree with the live plane (FR-A1).
    OPENSLOT_DATA_PLANE: process.env.DSQL_ENDPOINT_US_EAST_1 ? "aurora" : "simulation",
  },
};

export default nextConfig;
