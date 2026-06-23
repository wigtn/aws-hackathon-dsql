import { DemoConsole } from "@/components/DemoConsole";
import { Eyebrow } from "@/components/ui";

export const metadata = {
  title: "Cross-region stampede — OpenSlot",
};

export default function DemoPage() {
  return (
    <div className="shell" style={{ paddingTop: 36 }}>
      <Eyebrow>the hero · best technical</Eyebrow>
      <h1 className="display" style={{ fontSize: "clamp(34px,5vw,56px)", marginTop: 12 }}>
        Two regions. One seat.
        <br />
        Zero oversell.
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.5, color: "var(--color-ink-2)", maxWidth: 620, marginTop: 16 }}>
        Buyers hit <span className="num">us-east-1</span> and{" "}
        <span className="num">us-east-2</span> at the same instant for the same scarce
        seats. Aurora DSQL serializes every write across regions with strong
        consistency — the first commit wins, the rest get <span className="num">OC000</span>{" "}
        and retry. Run it. The number that matters never moves off zero.
      </p>

      <div className="rule" style={{ margin: "30px 0 24px" }} />
      <DemoConsole />
    </div>
  );
}
