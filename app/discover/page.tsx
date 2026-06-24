import Link from "next/link";
import { DiscoverClient } from "@/components/DiscoverClient";
import { Eyebrow } from "@/components/ui";

export const metadata = { title: "Buyer view — OpenSlot" };

// The consumer storefront — framed as "what fans see", powered by OpenSlot.
// The product OpenSlot sells is the organizer console; this is the surface their
// buyers use, so judges read it as the storefront, not OpenSlot's own marketplace.
export default function DiscoverPage() {
  return (
    <div className="shell" style={{ paddingTop: 28 }}>
      <div
        className="panel flex flex-wrap items-center justify-between gap-3"
        style={{ padding: "10px 14px", marginBottom: 22 }}
      >
        <span className="eyebrow">buyer view · the storefront your fans use</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--color-ink-3)" }}>
          powered by OpenSlot · live stock from the DSQL ledger
        </span>
      </div>

      <div className="flex items-baseline justify-between" style={{ marginBottom: 18 }}>
        <h1 className="display" style={{ fontSize: 30 }}>
          Find a drop
        </h1>
        <Link href="/" className="eyebrow ulink" style={{ borderBottom: "none" }}>
          ← for organizers
        </Link>
      </div>
      <DiscoverClient />
    </div>
  );
}
