import Link from "next/link";
import { DiscoverClient } from "@/components/DiscoverClient";
import { Eyebrow } from "@/components/ui";

export default function HomePage() {
  return (
    <div className="shell" style={{ paddingTop: 40 }}>
      {/* Masthead — left-aligned editorial, not a centered hero. */}
      <section className="grid gap-8" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)" }}>
        <div>
          <Eyebrow>Global high-demand drops · ticketing</Eyebrow>
          <h1 className="display" style={{ fontSize: "clamp(40px, 6vw, 76px)", marginTop: 14 }}>
            The last seat,
            <br />
            sold once.
          </h1>
          <div className="rule-ink" style={{ width: 64, margin: "22px 0 18px" }} />
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.5,
              color: "var(--color-ink-2)",
              maxWidth: 460,
            }}
          >
            The whole world buys the same scarce seat at the same instant. OpenSlot
            takes those orders with <strong>zero oversell across regions</strong> — on
            Amazon Aurora DSQL multi-region strong consistency — and makes resale a
            losing trade.
          </p>
          <div className="flex flex-wrap gap-3" style={{ marginTop: 26 }}>
            <Link href="/demo" className="btn btn-primary focusable">
              Watch the cross-region stampede →
            </Link>
            <a href="#discover" className="btn focusable">
              Browse live drops
            </a>
          </div>
        </div>

        {/* spec card — engineering credibility, mono numerics */}
        <aside className="frame" style={{ padding: 18, alignSelf: "start" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            why it can&apos;t be oversold
          </div>
          {[
            ["data plane", "Aurora DSQL · multi-region"],
            ["regions", "us-east-1 · us-east-2"],
            ["witness", "us-west-2 (quorum)"],
            ["isolation", "snapshot · OCC"],
            ["conflict", "OC000 → bounded retry"],
            ["oversell", "0 · structural"],
          ].map(([k, v], i) => (
            <div
              key={k}
              className="flex items-center justify-between"
              style={{
                padding: "9px 0",
                borderBottom: i < 5 ? "1px solid var(--color-line)" : "none",
              }}
            >
              <span className="eyebrow">{k}</span>
              <span
                className="num"
                style={{
                  fontSize: 12.5,
                  color: k === "oversell" ? "var(--color-affirm)" : "var(--color-ink)",
                }}
              >
                {v}
              </span>
            </div>
          ))}
        </aside>
      </section>

      <div className="rule" style={{ margin: "48px 0 28px" }} />

      <section id="discover">
        <div className="flex items-baseline justify-between" style={{ marginBottom: 18 }}>
          <h2 className="display" style={{ fontSize: 26 }}>
            Discover
          </h2>
          <span className="eyebrow">PostGIS radius · pgvector meaning</span>
        </div>
        <DiscoverClient />
      </section>
    </div>
  );
}
