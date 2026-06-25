export const metadata = { title: "Admin — OpenSlot" };

// P2 · intentionally a stub. The point this page makes is the SECURITY posture,
// not feature surface: admin auth is enforced independently of NODE_ENV — a
// preview URL never grants access.
export default function AdminPage() {
  return (
    <div className="poster">
      <div className="wrap">
        <section className="band" data-wm="OPS">
          <span className="kick">Operations · disputes + reputation</span>
          <h1>Admin</h1>
          <p className="sub">A locked operations surface — access is enforced server-side, never opened by a preview build.</p>
        </section>

        <div className="pn" style={{ marginTop: 28 }}>
          <div className="ph"><h3>Access control</h3><span className="badge bad">locked · P2</span></div>
          <ul className="check">
            <li><span className="ck">✓</span> Enforced independently of NODE_ENV — never opened by a preview build</li>
            <li><span className="ck">✓</span> Strong shared secret + IP allowlist + Vercel password protection</li>
            <li><span className="ck">✓</span> Every object access carries a server-side ownership predicate</li>
          </ul>
          <p className="mono" style={{ fontSize: 12, color: "var(--pk-ink2)", marginTop: 16, lineHeight: 1.6 }}>
            Dispute resolution, organizer reputation, and forced re-release are post-MVP. The seat
            ledger&apos;s append-only log is the audit source.
          </p>
        </div>
      </div>
    </div>
  );
}
