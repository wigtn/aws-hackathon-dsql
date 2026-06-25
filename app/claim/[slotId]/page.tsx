import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getData } from "@/lib/data";
import { ClaimFlow } from "@/components/ClaimFlow";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ slotId: string }>;
}) {
  const { slotId } = await params; // routed as eventId from the seat map
  const event = await getData().eventById(slotId);
  if (!event) notFound();

  return (
    <div className="poster">
      <div className="wrap" style={{ paddingTop: 24 }}>
        <Link href={`/event/${event.id}`} className="mono focusable" style={{ color: "var(--pk-ink2)", fontSize: 12 }}>
          ← back to {event.title}
        </Link>
        <div style={{ marginTop: 18 }}>
          <Suspense>
            <ClaimFlow eventId={event.id} title={event.title} />
          </Suspense>
        </div>
        <p className="mono" style={{ fontSize: 11, color: "var(--pk-ink2)", textAlign: "center", marginTop: 32, paddingBottom: 20 }}>
          powered by OpenSlot
        </p>
      </div>
    </div>
  );
}
