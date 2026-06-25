"use client";
import { useState } from "react";
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

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("concert");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"self" | "enterprise">("self");
  const [agree, setAgree] = useState(false);

  const ready = name.trim() && /\S+@\S+/.test(email) && agree;

  function submit() {
    if (!ready) return;
    try {
      localStorage.setItem(
        "openslot.org",
        JSON.stringify({ name: name.trim(), category, email, plan, agreedAt: Date.now() }),
      );
    } catch {}
    router.push("/org/console");
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

        <div className="cols2" style={{ alignItems: "start" }}>
          {/* form */}
          <div className="pn">
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

            <button className="btn btn-ink-fill focusable" disabled={!ready} onClick={submit} style={{ marginTop: 18, width: "100%", textAlign: "center", opacity: ready ? 1 : 0.45 }}>
              {plan === "enterprise" ? "Request enterprise contract →" : "Create account →"}
            </button>
            <p className="mono" style={{ fontSize: 10.5, color: "var(--pk-ink2)", marginTop: 10 }}>
              Demo: your account is a local session.
            </p>
          </div>

          {/* plan picker */}
          <div>
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
