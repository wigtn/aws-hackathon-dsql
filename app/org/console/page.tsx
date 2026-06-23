import { OrgConsole } from "@/components/OrgConsole";
import { Eyebrow } from "@/components/ui";
import { store } from "@/lib/sim/store";

export const metadata = { title: "Organizer console — OpenSlot" };

export default function OrgPage() {
  const s = store();
  const events = s.events.map((e) => ({
    id: e.id,
    title: e.title,
    capacity: s.slots.get(e.id)?.capacity ?? 0,
  }));

  return (
    <div className="shell" style={{ paddingTop: 36 }}>
      <Eyebrow>organizer · live sales + fair re-release</Eyebrow>
      <h1 className="display" style={{ fontSize: 40, marginTop: 12 }}>Console</h1>
      <p className="mono" style={{ fontSize: 13, color: "var(--color-ink-3)", margin: "10px 0 28px", maxWidth: 600 }}>
        Watch the floor fill in real time across both regions, then cancel a seat to
        see it locked-offered to the #1 in queue — the anti-scalp move competitors
        skip.
      </p>
      <OrgConsole events={events} />
    </div>
  );
}
