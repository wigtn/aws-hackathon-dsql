import { Eyebrow, Tag } from "@/components/ui";

export const metadata = { title: "Admin — OpenSlot" };

// P2 · intentionally a stub (PRD §17 priority labels). The point this page makes
// is the SECURITY posture, not feature surface: admin auth is enforced
// independently of NODE_ENV (PRD §17 C-4) — a preview URL never grants access.
export default function AdminPage() {
  return (
    <div className="shell" style={{ paddingTop: 36, maxWidth: 760 }}>
      <Eyebrow>operations · disputes + reputation</Eyebrow>
      <div className="flex items-center gap-3" style={{ marginTop: 12, marginBottom: 24 }}>
        <h1 className="display" style={{ fontSize: 40 }}>Admin</h1>
        <Tag tone="signal">stub · P2</Tag>
      </div>

      <div className="frame" style={{ padding: 24 }}>
        <Eyebrow>access control</Eyebrow>
        <div className="num" style={{ fontSize: 18, margin: "10px 0 14px" }}>
          locked — auth required
        </div>
        <ul className="mono" style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.8, listStyle: "none" }}>
          <li>· enforced independently of NODE_ENV — never opened by a preview build</li>
          <li>· strong shared secret + IP allowlist + Vercel password protection</li>
          <li>· every object access carries a server-side ownership predicate</li>
        </ul>
      </div>

      <p className="mono" style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 16 }}>
        Dispute resolution, organizer reputation, and forced re-release are
        post-MVP. The seat ledger&apos;s append-only events_log is the audit source.
      </p>
    </div>
  );
}
