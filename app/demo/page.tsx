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
            The same single seat under a worldwide rush, on real infrastructure. Thousands of
            buyers hit two regions at the same instant — the first commit wins, the rest retry.
            Run it: the number that matters never moves off zero.
          </p>
        </section>
        <DemoConsole />
      </div>
    </div>
  );
}
