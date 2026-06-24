import { OrgConsole } from "@/components/OrgConsole";
import { Eyebrow } from "@/components/ui";
import { getData } from "@/lib/data";

export const metadata = { title: "Organizer console — OpenSlot" };
export const dynamic = "force-dynamic";

export default async function OrgPage() {
  const data = getData();
  const evs = await data.listEvents();
  const events = await Promise.all(
    evs.map(async (e) => {
      const slot = await data.slotForEvent(e.id);
      return { id: e.id, title: e.title, capacity: slot?.capacity ?? 0, price: e.price };
    }),
  );

  return (
    <div className="shell" style={{ paddingTop: 36 }}>
      <Eyebrow>organizer console · the product event businesses pay for</Eyebrow>
      <h1 className="display" style={{ fontSize: 44, marginTop: 12 }}>
        Run your on-sale.
      </h1>
      <p className="mono" style={{ fontSize: 13, color: "var(--color-ink-3)", margin: "12px 0 28px", maxWidth: 640 }}>
        Create a drop, watch it fill across both regions, see the revenue OpenSlot
        defends from oversell and scalpers, and prove the sale was fair with a
        tamper-evident allocation ledger — only a strongly-consistent DSQL can.
      </p>
      <OrgConsole events={events} />
    </div>
  );
}
