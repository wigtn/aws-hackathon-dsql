import Link from "next/link";
import { notFound } from "next/navigation";
import { getData } from "@/lib/data";
import { SeatMap } from "@/components/SeatMap";
import { Countdown } from "@/components/Countdown";

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = getData();
  const event = await data.eventById(id);
  const slot = await data.slotForEvent(id);
  if (!event || !slot) notFound();

  return (
    <div className="poster">
      <div className="wrap">
        <section className="band" data-wm="LIVE">
          <span className="kick">{event.organizer_name} · {event.category}</span>
          <h1>{event.title}</h1>
          <p className="sub">{event.subtitle} · {event.venue}, {event.city}</p>
        </section>

        <div className="cols2 wide-left" style={{ alignItems: "start" }}>
          {/* seat map */}
          <div>
            <SeatMap eventId={event.id} />
          </div>

          {/* rail */}
          <aside>
            <div className="pn" style={{ marginBottom: 18 }}>
              <div className="ph"><h3>On sale</h3></div>
              <Countdown target={event.sale_opens_at} />
              <div style={{ borderTop: "1px solid var(--pink-line)", margin: "16px 0" }} />
              <div className="lbl" style={{ color: "var(--pk-ink2)" }}>Your guarantee</div>
              <div style={{ fontFamily: "var(--font-syne)", fontWeight: 700, fontSize: 18, letterSpacing: "-.02em", marginTop: 8 }}>
                The seat you pick is yours
              </div>
              <div className="mono" style={{ fontSize: 11.5, color: "var(--pk-ink2)", marginTop: 4 }}>
                never oversold · never double-booked
              </div>
            </div>

            <div className="pn">
              <div className="ph"><h3>Fair for fans</h3></div>
              <ul className="check" style={{ fontSize: 12.5 }}>
                <li><span className="ck">✓</span> Tied to a verified person + device</li>
                <li><span className="ck">✓</span> Rotating entry code at the gate</li>
                <li><span className="ck">✓</span> Cancellations go to the next real fan</li>
                <li><span className="ck">✓</span> Bots priced out</li>
              </ul>
            </div>

            <p className="mono" style={{ fontSize: 11, color: "var(--pk-ink2)", textAlign: "center", marginTop: 18 }}>
              powered by OpenSlot · <Link href="/discover" style={{ color: "var(--purple)" }}>back to events →</Link>
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
