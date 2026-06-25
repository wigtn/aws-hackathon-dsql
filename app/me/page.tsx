import { MyTickets } from "@/components/MyTickets";

export const metadata = { title: "My tickets — OpenSlot" };

export default function MePage() {
  return (
    <div className="poster">
      <div className="wrap">
        <section className="band" data-wm="TIX">
          <span className="kick">Identity + device bound · non-transferable</span>
          <h1>My tickets</h1>
        </section>
        <div style={{ marginTop: 28 }}>
          <MyTickets />
        </div>
        <p className="mono" style={{ fontSize: 11, color: "var(--pk-ink2)", textAlign: "center", marginTop: 40, paddingBottom: 20 }}>
          powered by OpenSlot
        </p>
      </div>
    </div>
  );
}
