// White-label marker for buyer-facing surfaces: this is the organizer's
// storefront, powered by OpenSlot (FR-B2). Reinforces the B2B read — OpenSlot
// is the infrastructure behind the business's storefront, not a consumer brand.
export function StorefrontBar({ organizer }: { organizer?: string }) {
  return (
    <div
      className="panel flex flex-wrap items-center justify-between gap-2"
      style={{ padding: "8px 14px", marginBottom: 18 }}
    >
      <span className="eyebrow">
        {organizer ? `${organizer} · storefront` : "storefront"}
      </span>
      <span className="mono" style={{ fontSize: 10.5, color: "var(--color-ink-3)" }}>
        powered by OpenSlot
      </span>
    </div>
  );
}

export function PoweredBy() {
  return (
    <div
      className="mono"
      style={{ fontSize: 10.5, color: "var(--color-ink-3)", textAlign: "center", marginTop: 28 }}
    >
      powered by OpenSlot · on-sale infrastructure
    </div>
  );
}
