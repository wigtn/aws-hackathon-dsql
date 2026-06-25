"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = ["concert", "sports", "drop", "event"] as const;

const PLANS = [
  {
    key: "self",
    name: "Self-serve",
    price: "5% per ticket",
    blurb: "Create on-sales instantly. Pay only when you sell.",
    points: ["instant setup", "up to 5k seats / drop", "anti-scalp included", "email support"],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "contract",
    blurb: "For stadium on-sales and global drops.",
    points: ["custom seat limits", "dedicated capacity", "advanced bot defense", "SLA + solutions engineer"],
  },
] as const;

interface OrgSession {
  name: string;
  category?: string;
  email?: string;
  plan?: "self" | "enterprise";
  agreedAt?: number;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "login">("create");
  const [existing, setExisting] = useState<OrgSession | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("concert");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"self" | "enterprise">("self");
  const [agree, setAgree] = useState(false);

  // Returning organizer? A session is restored from localStorage (demo auth).
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("openslot.org") || "null") as OrgSession | null;
      if (s?.name) {
        setExisting(s);
        setMode("login");
        setName(s.name);
      }
    } catch {}
  }, []);

  const createReady = name.trim() && /\S+@\S+/.test(email) && agree;
  const loginReady = name.trim().length > 0;

  function persistAndGo(session: OrgSession) {
    try {
      localStorage.setItem("openslot.org", JSON.stringify(session));
    } catch {}
    router.push("/org/console");
  }

  function submitCreate() {
    if (!createReady) return;
    persistAndGo({ name: name.trim(), category, email, plan, agreedAt: Date.now() });
  }

  function submitLogin() {
    if (!loginReady) return;
    // Demo auth: restore the local organizer session for this name. If we have
    // a prior session for the same org, keep its details; otherwise start fresh.
    const base = existing && existing.name.toLowerCase() === name.trim().toLowerCase() ? existing : {};
    persistAndGo({ ...base, name: name.trim() });
  }

  function logout() {
    try {
      localStorage.removeItem("openslot.org");
    } catch {}
    setExisting(null);
    setMode("create");
    setName("");
  }

  return (
    <div className="poster">
      <div className="wrap">
        <section className="band" data-wm="SELL">
          <span className="kick">For artists, brands, promoters &amp; ticket sellers</span>
          <h1>Start an on-sale.</h1>
          <p className="sub">
            Run your on-sale with <b>zero oversell</b>, scalpers priced out, and the revenue you&apos;d
            lose to crashes defended. Set up your account, pick a plan, and create your first drop.
          </p>
        </section>

        {/* returning organizer banner */}
        {existing && (
          <div
            className="pn"
            style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
          >
            <div>
              <div className="lbl" style={{ color: "var(--pk-ink2)" }}>Welcome back</div>
              <div style={{ fontFamily: "var(--font-syne)", fontWeight: 800, fontSize: 22, marginTop: 2 }}>{existing.name}</div>
            </div>
            <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
              <button className="btn btn-ink-fill focusable" onClick={() => router.push("/org/console")}>Go to console →</button>
              <button className="btn btn-ink focusable" onClick={logout}>Log out</button>
            </div>
          </div>
        )}

        <div className="cols2" style={{ alignItems: "start", marginTop: 18 }}>
          {/* form */}
          <div className="pn">
            {/* Create ⇄ Log in tabs */}
            <div className="flex gap-2" style={{ marginBottom: 18 }}>
              {(["create", "login"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className="mono focusable"
                  style={{
                    fontSize: 12.5, padding: "8px 14px", cursor: "pointer", borderRadius: 8,
                    border: `1.5px solid ${mode === m ? "var(--pk-ink)" : "var(--pink-line)"}`,
                    background: mode === m ? "var(--pk-ink)" : "transparent",
                    color: mode === m ? "var(--cream)" : "var(--pk-ink2)", fontWeight: 600,
                  }}
                >
                  {m === "create" ? "Create account" : "Log in"}
                </button>
              ))}
            </div>

            {mode === "create" ? (
              <>
                <div className="ph"><h3>Your account</h3></div>
                <div className="knob" style={{ marginBottom: 14 }}>
                  <label>Organization name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hallyu Touring" className="focusable" style={inp} />
                </div>
                <div className="knob" style={{ marginBottom: 14 }}>
                  <label>Primary category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="focusable" style={inp}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="knob">
                  <label>Billing contact</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ops@yourvenue.com" className="focusable" style={inp} />
                </div>

                <label className="flex items-start gap-2" style={{ marginTop: 18, cursor: "pointer" }}>
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
                  <span className="mono" style={{ fontSize: 12, color: "var(--pk-ink2)", lineHeight: 1.5 }}>
                    I agree to the OpenSlot organizer terms, fee schedule, and payout verification before first payout.
                  </span>
                </label>

                <button className="btn btn-ink-fill focusable" disabled={!createReady} onClick={submitCreate} style={{ marginTop: 18, width: "100%", textAlign: "center", opacity: createReady ? 1 : 0.45 }}>
                  {plan === "enterprise" ? "Request enterprise contract →" : "Create account →"}
                </button>
                <p className="mono" style={{ fontSize: 10.5, color: "var(--pk-ink2)", marginTop: 10 }}>
                  Demo: your account is a local session.
                </p>
              </>
            ) : (
              <>
                <div className="ph"><h3>Welcome back</h3></div>
                <div className="knob" style={{ marginBottom: 14, marginTop: 4 }}>
                  <label>Organization name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Hallyu Touring"
                    className="focusable"
                    style={inp}
                    onKeyDown={(e) => e.key === "Enter" && submitLogin()}
                  />
                </div>
                <button className="btn btn-ink-fill focusable" disabled={!loginReady} onClick={submitLogin} style={{ marginTop: 8, width: "100%", textAlign: "center", opacity: loginReady ? 1 : 0.45 }}>
                  Log in →
                </button>
                <p className="mono" style={{ fontSize: 10.5, color: "var(--pk-ink2)", marginTop: 10 }}>
                  Demo: signing in restores your local organizer session and shows your drops.
                </p>
                <button onClick={() => setMode("create")} className="mono focusable" style={{ marginTop: 12, background: "none", border: "none", cursor: "pointer", color: "var(--purple)", fontSize: 12, padding: 0, textDecoration: "underline" }}>
                  New here? Create an account →
                </button>
              </>
            )}
          </div>

          {/* right column: plan picker (create) or sign-in explainer (login) */}
          <div>
            {mode === "create" ? (
              <>
                <div className="lbl" style={{ color: "var(--pk-ink2)", marginBottom: 12 }}>Choose a plan</div>
                <div className="grid gap-3">
                  {PLANS.map((p) => (
                    <button key={p.key} onClick={() => setPlan(p.key)} aria-pressed={plan === p.key} className={`plan focusable${plan === p.key ? " on" : ""}`}>
                      <div className="pt">
                        <span className="nm">{p.name}</span>
                        <span className="mono" style={{ fontSize: 13 }}>{p.price}</span>
                      </div>
                      <div className="mono" style={{ fontSize: 12, marginTop: 8, opacity: 0.8 }}>{p.blurb}</div>
                      <ul>
                        {p.points.map((pt) => <li key={pt}>· {pt}</li>)}
                      </ul>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="pn">
                <div className="lbl" style={{ color: "var(--pk-ink2)", marginBottom: 8 }}>Sign in to your console</div>
                <p style={{ fontSize: 14, color: "var(--pk-ink2)", lineHeight: 1.6 }}>
                  Pick up where you left off — your drops, live sales, anti-scalp panel and fair re-release,
                  all in one organizer console.
                </p>
                <ul className="mono" style={{ fontSize: 12.5, color: "var(--pk-ink2)", lineHeight: 2, marginTop: 10 }}>
                  <li>· manage every drop you run</li>
                  <li>· live sell-through &amp; revenue protected</li>
                  <li>· schedule the next on-sale</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%",
  fontSize: 15,
  padding: "11px 13px",
  borderRadius: 8,
  background: "var(--cream)",
  border: "1.5px solid var(--pk-ink)",
  color: "var(--pk-ink)",
};
