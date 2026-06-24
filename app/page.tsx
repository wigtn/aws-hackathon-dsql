import Link from "next/link";
import { Eyebrow } from "@/components/ui";

// B2B landing. The customer is the event business (they pay); buyers transact
// free on the organizer's storefront (/discover). Lead with business value, not
// a consumer marketplace — so judges read this as on-sale infrastructure.
export default function HomePage() {
  return (
    <div className="shell" style={{ paddingTop: 40 }}>
      {/* Masthead — business value, left-aligned editorial. */}
      <section className="grid gap-8" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)" }}>
        <div>
          <Eyebrow>for event businesses · artists · brands · promoters · ticket sellers</Eyebrow>
          <h1 className="display" style={{ fontSize: "clamp(38px, 5.5vw, 68px)", marginTop: 14 }}>
            Run a global on-sale
            <br />
            without overselling.
          </h1>
          <div className="rule-ink" style={{ width: 64, margin: "22px 0 18px" }} />
          <p style={{ fontSize: 17, lineHeight: 1.5, color: "var(--color-ink-2)", maxWidth: 480 }}>
            OpenSlot is the on-sale infrastructure event businesses run to take a
            worldwide rush for the same scarce seat — with{" "}
            <strong>zero oversell across regions</strong>, scalpers priced out, and the
            revenue you&apos;d lose to crashes and refunds defended. Built on Amazon
            Aurora DSQL.
          </p>
          <div className="flex flex-wrap gap-3" style={{ marginTop: 26 }}>
            <Link href="/org/onboarding" className="btn btn-primary focusable">
              Run your on-sale →
            </Link>
            <Link href="/org/console" className="btn focusable">
              Open the console
            </Link>
            <Link href="/demo" className="btn focusable">
              Cross-region proof
            </Link>
          </div>
          <p className="mono" style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 14 }}>
            buyers transact free on your storefront ·{" "}
            <Link href="/discover" className="ulink">see the buyer view →</Link>
          </p>
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
              style={{ padding: "9px 0", borderBottom: i < 5 ? "1px solid var(--color-line)" : "none" }}
            >
              <span className="eyebrow">{k}</span>
              <span className="num" style={{ fontSize: 12.5, color: k === "oversell" ? "var(--color-affirm)" : "var(--color-ink)" }}>
                {v}
              </span>
            </div>
          ))}
        </aside>
      </section>

      <div className="rule" style={{ margin: "48px 0 28px" }} />

      {/* What the business gets */}
      <section>
        <Eyebrow>what your business gets</Eyebrow>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", marginTop: 16 }}>
          {[
            {
              h: "Zero oversell, worldwide",
              p: "The seat ledger takes writes in two regions with strong consistency. The same seat is never sold twice — no refunds, no chargebacks, no reputation hit.",
              tag: "Aurora DSQL",
            },
            {
              h: "Scalpers priced out",
              p: "Identity + device-bound tickets, rotating gate codes, and fair re-release: cancellations are locked to the next real fan, not the fastest bot.",
              tag: "anti-scalp",
            },
            {
              h: "Revenue defended",
              p: "See, per drop, the money OpenSlot keeps in your primary sale — oversell refunds avoided and resale margin repatriated.",
              tag: "$ / drop",
            },
          ].map((c) => (
            <div key={c.h} className="frame" style={{ padding: 18 }}>
              <span className="tag" style={{ marginBottom: 12, display: "inline-flex" }}>{c.tag}</span>
              <div className="display" style={{ fontSize: 21, margin: "10px 0 8px" }}>{c.h}</div>
              <p className="mono" style={{ fontSize: 12.5, color: "var(--color-ink-2)", lineHeight: 1.6 }}>{c.p}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="rule" style={{ margin: "40px 0 24px" }} />

      <section className="flex flex-wrap items-center justify-between gap-4" style={{ paddingBottom: 8 }}>
        <div>
          <div className="display" style={{ fontSize: 24 }}>See it take a stampede.</div>
          <p className="mono" style={{ fontSize: 12.5, color: "var(--color-ink-3)", marginTop: 6 }}>
            Two regions, one seat, thousands of buyers — oversold stays 0.
          </p>
        </div>
        <Link href="/demo" className="btn btn-primary focusable">
          Watch the cross-region demo →
        </Link>
      </section>
    </div>
  );
}
