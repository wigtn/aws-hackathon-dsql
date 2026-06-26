import Link from "next/link";

// B2B landing — product-first. The paying customer is the event business; buyers
// transact free. Lead with the OUTCOME (sell out without disasters), not the
// plumbing. The single "How it works" strip is the one place tech is mentioned.
const GUARANTEES = [
  {
    no: "01",
    h: "Never sell the same seat twice",
    p: "Even in a worldwide rush, every seat sells exactly once. No oversells, no refunds, no chargebacks, no furious fans.",
    t: "Zero oversell",
  },
  {
    no: "02",
    h: "Scalpers and bots priced out",
    p: "Tickets are tied to a verified person and device, entry codes rotate at the gate, and a cancellation goes to the next real fan — not the fastest bot.",
    t: "Anti-scalp",
  },
  {
    no: "03",
    h: "Know your numbers in real time",
    p: "Live sales, sell-through, and the revenue you protected — per drop, as it happens.",
    t: "$ / drop",
  },
  {
    no: "04",
    h: "Provably fair",
    p: "Every fan got the same fair shot, in the exact order they arrived — and you can prove it to artists and regulators.",
    t: "Auditable",
  },
];

export default function HomePage() {
  return (
    <div className="poster">
      <div className="wrap">
        <section className="hero">
          <div className="top">
            <span className="kick">The on-sale platform for event businesses</span>
            <div className="stat0">
              <div className="n num">0</div>
              <div className="l">double-sold seats</div>
            </div>
          </div>
          <h1>Run a sold-out on-sale without the disasters.</h1>
          <p className="lead">
            OpenSlot powers high-demand ticket sales and product drops for artists, brands and
            promoters — with <b>no overselling</b>, no bot armies, and no refund nightmares. Even
            when the whole world shows up at once.
          </p>
          <div className="acts">
            <Link href="/org/onboarding" className="btn btn-fill focusable">
              Start an on-sale →
            </Link>
            <Link href="/demo" className="btn focusable">
              See how it works
            </Link>
          </div>
        </section>

        <div className="points">
          <div className="z">0 double-sold seats</div>
          <div>Bots priced out of the grab</div>
          <div>A fair shot for every fan</div>
          <div>Revenue protected, every drop</div>
        </div>

        <section className="sec">
          <div className="sh">
            <h2>What your business gets</h2>
            <span className="lbl" style={{ color: "var(--pk-ink2)" }}>
              Four guarantees
            </span>
          </div>
          {GUARANTEES.map((g) => (
            <div className="grow" key={g.no}>
              <div className="no">{g.no}</div>
              <h3>{g.h}</h3>
              <p>{g.p}</p>
              <div className="t">{g.t}</div>
            </div>
          ))}

          <div className="howto">
            <h4>How it works</h4>
            <p>
              OpenSlot keeps one global source of truth for every seat — strongly consistent across
              the world, on Amazon Aurora DSQL. So two buyers on opposite sides of the planet can
              never grab the same seat. Zero oversell isn&apos;t a policy we promise — it&apos;s
              structurally impossible.{" "}
              <Link href="/demo">See the cross-region proof →</Link>
            </p>
          </div>
        </section>

        <section className="proof">
          <div className="bg">0</div>
          <div className="l">
            <h2>Ready to sell out — safely?</h2>
            <p>One seat · thousands of buyers · oversold stays 0</p>
          </div>
          <Link href="/org/onboarding" className="btn btn-bright focusable">
            Start your on-sale →
          </Link>
        </section>
      </div>
    </div>
  );
}
