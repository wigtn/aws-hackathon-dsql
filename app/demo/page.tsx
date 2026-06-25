import { DemoConsole } from "@/components/DemoConsole";
import { Eyebrow } from "@/components/ui";

export const metadata = {
  title: "The proof — OpenSlot",
};

// The ONE place the technical story is welcome: the proof that zero oversell is
// structural, not a promise. Everywhere else, the product hides the plumbing.
export default function DemoPage() {
  return (
    <div className="shell" style={{ paddingTop: 36 }}>
      <Eyebrow>the proof · how OpenSlot guarantees zero oversell</Eyebrow>
      <h1 className="display" style={{ fontSize: "clamp(34px,5vw,56px)", marginTop: 12 }}>
        Don&apos;t take our word for it.
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.5, color: "var(--color-ink-2)", maxWidth: 640, marginTop: 16 }}>
        Here&apos;s the same single seat under a worldwide rush, on real infrastructure.
        Thousands of buyers hit <span className="num">us-east-1</span> and{" "}
        <span className="num">us-east-2</span> at the same instant. Amazon Aurora DSQL
        serializes every write across regions with strong consistency — the first commit
        wins, the rest get <span className="num">OC000</span> and retry. Run it: the number
        that matters never moves off zero.
      </p>

      <div className="rule" style={{ margin: "30px 0 24px" }} />
      <DemoConsole />
    </div>
  );
}
