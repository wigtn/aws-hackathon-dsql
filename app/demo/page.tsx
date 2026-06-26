import { DemoConsole } from "@/components/DemoConsole";

export const metadata = {
  title: "The proof — OpenSlot",
};

// The ONE place the technical story is welcome: the proof that zero oversell is
// structural, not a promise. Everywhere else, the product hides the plumbing.
export default function DemoPage() {
  return (
    <div className="poster">
      <div className="wrap">
        <section className="band" data-wm="PROOF">
          <span className="kick">The proof · how OpenSlot guarantees zero oversell</span>
          <h1>Don&apos;t take our word for it.</h1>
          <p className="sub">
            A deterministic load generator that models Aurora DSQL&apos;s OCC exactly: the same single
            seat under a worldwide rush, thousands of buyers hitting two regions in the same instant —
            the first commit wins, the rest get OC000 and retry. Run it: the number that matters never
            moves off zero. The live cross-region OC000 proof on real Aurora DSQL runs separately
            (linked below the result).
          </p>
        </section>
        <DemoConsole />
      </div>
    </div>
  );
}
