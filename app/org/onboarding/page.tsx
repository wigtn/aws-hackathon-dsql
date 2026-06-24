"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eyebrow, Tag } from "@/components/ui";

const CATEGORIES = ["concert", "sports", "drop", "event"] as const;

const PLANS = [
  {
    key: "self",
    name: "Self-serve",
    price: "5% per ticket",
    blurb: "Create drops instantly. Pay only when you sell.",
    points: ["instant onboarding", "up to 5k seats / drop", "standard anti-scalp", "email support"],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "contract",
    blurb: "For stadium on-sales and global drops.",
    points: ["custom seat limits", "dedicated multi-region capacity", "advanced BotID + allowlists", "SLA + solutions engineer"],
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
    <div className="shell" style={{ paddingTop: 36, maxWidth: 920 }}>
      <Link href="/org/console" className="eyebrow ulink" style={{ borderBottom: "none" }}>
        ← organizer console
      </Link>

      <Eyebrow>for event businesses · artists · brands · promoters · ticket sellers</Eyebrow>
      <h1 className="display" style={{ fontSize: "clamp(34px,5vw,52px)", marginTop: 12 }}>
        Sell on OpenSlot.
      </h1>
      <p className="mono" style={{ fontSize: 13.5, color: "var(--color-ink-3)", margin: "12px 0 30px", maxWidth: 620 }}>
        Run your on-sale on a seat ledger that takes a worldwide rush with zero
        oversell and keeps scalpers out. Set up your organizer account, pick a plan,
        and create your first drop.
      </p>

      <div className="grid gap-8" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", alignItems: "start" }}>
        {/* form */}
        <div className="frame" style={{ padding: 22 }}>
          <Eyebrow>organizer account</Eyebrow>
          <div style={{ marginTop: 14 }}>
            <label className="eyebrow">organization name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hallyu Touring" className="focusable" style={inp} />
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="eyebrow">primary category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="mono focusable" style={inp}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="eyebrow">billing contact</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ops@yourvenue.com" className="mono focusable" style={inp} />
          </div>

          <label className="flex items-start gap-2" style={{ marginTop: 18, cursor: "pointer" }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
            <span className="mono" style={{ fontSize: 12, color: "var(--color-ink-2)", lineHeight: 1.5 }}>
              I agree to the OpenSlot organizer terms, fee schedule, and payout/KYC
              verification before first payout.
            </span>
          </label>

          <button className="btn btn-primary focusable" disabled={!ready} onClick={submit} style={{ marginTop: 18, width: "100%" }}>
            {plan === "enterprise" ? "request enterprise contract →" : "create organizer account →"}
          </button>
          <p className="mono" style={{ fontSize: 10.5, color: "var(--color-ink-3)", marginTop: 10 }}>
            demo: account is a local session. Production = real auth + KYC + payouts (post-MVP).
          </p>
        </div>

        {/* plan picker */}
        <div>
          <Eyebrow>plan</Eyebrow>
          <div className="grid gap-3" style={{ marginTop: 12 }}>
            {PLANS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPlan(p.key)}
                className="frame focusable"
                style={{ textAlign: "left", padding: 16, cursor: "pointer", background: plan === p.key ? "var(--color-paper-2)" : "var(--color-paper)", borderColor: plan === p.key ? "var(--color-ink)" : "var(--color-line)", borderWidth: plan === p.key ? 2 : 1 }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="display" style={{ fontSize: 20 }}>{p.name}</span>
                  <span className="num" style={{ fontSize: 13, color: plan === p.key ? "var(--color-ink)" : "var(--color-ink-3)" }}>{p.price}</span>
                </div>
                <div className="mono" style={{ fontSize: 12, color: "var(--color-ink-3)", margin: "6px 0 10px" }}>{p.blurb}</div>
                <ul className="mono" style={{ fontSize: 11.5, color: "var(--color-ink-2)", lineHeight: 1.7, listStyle: "none" }}>
                  {p.points.map((pt) => <li key={pt}>· {pt}</li>)}
                </ul>
                {plan === p.key && <div style={{ marginTop: 10 }}><Tag tone="solid">selected</Tag></div>}
              </button>
            ))}
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
  marginTop: 6,
  background: "var(--color-paper)",
  border: "1px solid var(--color-ink)",
  color: "var(--color-ink)",
};
