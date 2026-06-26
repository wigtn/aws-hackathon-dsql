import { cookies } from "next/headers";

export const metadata = { title: "Admin — OpenSlot" };
// Never let a preview build cache an authenticated render.
export const dynamic = "force-dynamic";

// P2 · the point this page makes is the SECURITY posture, not feature surface.
// Access is enforced HERE, server-side, independently of NODE_ENV: a default
// visit (no admin cookie, or no secret configured) actually renders the locked
// state — the screen never claims "locked" while showing the ops surface. The
// gate is a server-side equality check against OPENSLOT_ADMIN_SECRET; the
// operator sets the matching `openslot_admin` cookie out-of-band. When the
// secret is unset the surface is locked to everyone (fail-closed).
async function isAuthed(): Promise<boolean> {
  const secret = process.env.OPENSLOT_ADMIN_SECRET;
  if (!secret) return false; // fail closed — no secret configured ⇒ nobody is in
  const jar = await cookies();
  return jar.get("openslot_admin")?.value === secret;
}

export default async function AdminPage() {
  const authed = await isAuthed();

  if (!authed) {
    return (
      <div className="poster">
        <div className="wrap">
          <section className="band" data-wm="403">
            <span className="kick">Operations · access denied</span>
            <h1>Locked.</h1>
            <p className="sub">
              This operations surface is enforced server-side and is fail-closed by default. You are
              seeing the lock, not the contents — a preview build never grants access.
            </p>
          </section>

          <div className="pn" style={{ marginTop: 28 }}>
            <div className="ph"><h3>Access control</h3><span className="badge bad">locked · 403</span></div>
            <ul className="check">
              <li><span className="ck">✓</span> Enforced in the server component, independently of NODE_ENV</li>
              <li><span className="ck">✓</span> Fail-closed: unset secret ⇒ no one is admitted</li>
              <li><span className="ck">✓</span> Hardens with a shared secret + IP allowlist + Vercel password protection</li>
            </ul>
            <p className="mono" style={{ fontSize: 12, color: "var(--pk-ink2)", marginTop: 16, lineHeight: 1.6 }}>
              Every object access behind this gate also carries a server-side ownership predicate
              (no FK in DSQL → authorization is app-level). The seat ledger&apos;s append-only log is
              the audit source.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="poster">
      <div className="wrap">
        <section className="band" data-wm="OPS">
          <span className="kick">Operations · disputes + reputation</span>
          <h1>Admin</h1>
          <p className="sub">Authenticated operations surface. Dispute resolution, organizer reputation, and forced re-release.</p>
        </section>

        <div className="pn" style={{ marginTop: 28 }}>
          <div className="ph"><h3>Access control</h3><span className="badge">authenticated · P2</span></div>
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
