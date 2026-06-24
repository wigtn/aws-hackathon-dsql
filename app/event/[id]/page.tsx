import Link from "next/link";
import { notFound } from "next/navigation";
import { getData } from "@/lib/data";
import { SeatMap } from "@/components/SeatMap";
import { Countdown } from "@/components/Countdown";
import { Eyebrow, Tag } from "@/components/ui";
import { REGION_LABEL } from "@/lib/sim/types";

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
    <div className="shell" style={{ paddingTop: 28 }}>
      <Link href="/" className="eyebrow ulink" style={{ borderBottom: "none" }}>
        ← discover
      </Link>

      <div
        className="grid gap-8"
        style={{ gridTemplateColumns: "minmax(0,1fr) 320px", marginTop: 16, alignItems: "start" }}
      >
        {/* main */}
        <div>
          <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
            <Tag tone="solid">{event.category}</Tag>
            <span className="eyebrow">{event.organizer_name}</span>
          </div>
          <h1 className="display" style={{ fontSize: "clamp(34px,5vw,56px)" }}>
            {event.title}
          </h1>
          <p className="mono" style={{ fontSize: 14, color: "var(--color-ink-3)", marginTop: 10 }}>
            {event.subtitle} · {event.venue}, {event.city}
          </p>

          <div className="rule" style={{ margin: "24px 0" }} />
          <SeatMap eventId={event.id} />
        </div>

        {/* rail */}
        <aside style={{ position: "sticky", top: 20 }}>
          <div className="frame" style={{ padding: 18, marginBottom: 14 }}>
            <Eyebrow>on sale</Eyebrow>
            <div style={{ marginTop: 10 }}>
              <Countdown target={event.sale_opens_at} />
            </div>
            <div className="rule" style={{ margin: "16px 0" }} />
            <Eyebrow>availability source of truth</Eyebrow>
            <div className="num" style={{ fontSize: 13, marginTop: 8, color: "var(--color-ink)" }}>
              Aurora DSQL ledger
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--color-ink-3)", marginTop: 4 }}>
              strong-consistent · {Object.values(REGION_LABEL).join(" + ")}
            </div>
          </div>

          <div className="panel" style={{ padding: 16 }}>
            <Eyebrow>anti-scalp</Eyebrow>
            <ul
              className="mono"
              style={{ fontSize: 12, color: "var(--color-ink-2)", lineHeight: 1.7, marginTop: 8, listStyle: "none" }}
            >
              <li>· identity + device-bound ticket</li>
              <li>· rotating barcode (TOTP, 30s)</li>
              <li>· cancellations re-offered to #1 in queue</li>
              <li>· bot mass-claiming made uneconomic</li>
            </ul>
            <div className="mono" style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 10 }}>
              friction raised — not “resale impossible.”
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
