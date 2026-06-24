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
    <div className="shell" style={{ paddingTop: 28 }}>
      <Link href={`/event/${event.id}`} className="eyebrow ulink" style={{ borderBottom: "none" }}>
        ← back to {event.title}
      </Link>
      <div style={{ marginTop: 18 }}>
        <Suspense>
          <ClaimFlow eventId={event.id} title={event.title} />
        </Suspense>
      </div>
    </div>
  );
}
