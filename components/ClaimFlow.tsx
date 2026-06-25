"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ms } from "@/lib/format";

type Region = "us-east-1" | "us-east-2";
type Step = "otp" | "verify" | "claiming" | "done";

interface ClaimResult {
  ok: boolean;
  seat_no?: number;
  latency_ms: number;
  error?: string;
  remaining_open?: number;
}

export function ClaimFlow({ eventId, title }: { eventId: string; title: string }) {
  const sp = useSearchParams();
  const seat = sp.get("seat");
  const [step, setStep] = useState<Step>("otp");
  // Routing region is chosen for the buyer — never something a fan picks.
  const [region] = useState<Region>("us-east-1");
  const [phone, setPhone] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function requestOtp() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/otp", { method: "POST", body: JSON.stringify({ step: "request", phone }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(data.error ?? "failed");
    setHint(data.demo_hint ?? null);
    setStep("verify");
  }

  async function verifyOtp() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/otp", { method: "POST", body: JSON.stringify({ step: "verify", phone, code }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(data.error ?? "invalid code");
    setBuyerId(data.buyerId);
    try {
      localStorage.setItem("openslot.buyerId", data.buyerId);
      localStorage.setItem("openslot.phone", phone);
    } catch {}
    runClaim(data.buyerId);
  }

  async function runClaim(bid: string) {
    setStep("claiming");
    setErr(null);
    const res = await fetch("/api/claim", { method: "POST", body: JSON.stringify({ action: "claim", eventId, buyerId: bid, region }) });
    const data: ClaimResult = await res.json();
    setResult(data);
    if (data.ok)
      await fetch("/api/claim", { method: "POST", body: JSON.stringify({ action: "confirm", eventId, buyerId: bid, seatNo: data.seat_no }) });
    setStep("done");
  }

  async function joinWaitlist() {
    setBusy(true);
    await fetch("/api/claim", { method: "POST", body: JSON.stringify({ action: "waitlist", eventId, buyerId: buyerId || `buyer-anon` }) });
    setBusy(false);
    setErr("waitlisted");
  }

  return (
    <div className="poster">
      <div className="pn" style={{ padding: 0, maxWidth: 560, margin: "0 auto", overflow: "hidden" }}>
        {/* progress rail */}
        <div className="flex" style={{ borderBottom: "2px solid var(--pk-ink)" }}>
          {["verify it's you", "get your ticket"].map((s, i) => {
            const active =
              (i === 0 && (step === "otp" || step === "verify")) ||
              (i === 1 && (step === "claiming" || step === "done"));
            const passed = i === 0 && (step === "claiming" || step === "done");
            return (
              <div
                key={s}
                className="lbl"
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  background: active ? "var(--purple)" : "transparent",
                  color: active ? "var(--cream)" : passed ? "var(--pk-ink)" : "var(--pk-ink2)",
                  borderRight: i < 1 ? "1px solid var(--pink-line)" : "none",
                }}
              >
                {i + 1}. {s} {passed ? "✓" : ""}
              </div>
            );
          })}
        </div>

        <div style={{ padding: 24 }}>
          <div className="lbl" style={{ color: "var(--pk-ink2)" }}>Getting your ticket</div>
          <div style={{ fontFamily: "var(--font-syne)", fontWeight: 800, fontSize: 24, textTransform: "uppercase", letterSpacing: "-.02em", margin: "6px 0 18px" }}>
            {title}
            {seat ? <span className="num" style={{ fontSize: 15, color: "var(--pk-ink2)", textTransform: "none" }}> · seat #{seat}</span> : null}
          </div>

          {step === "otp" && (
            <div>
              <label className="lbl" style={{ color: "var(--pk-ink2)" }}>Your phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+82 10 1234 5678" className="mono focusable" style={inp} />
              <p className="mono" style={hintStyle}>One ticket binds to one verified person + this device.</p>
              {err && <ErrLine msg={err} />}
              <button className="btn btn-purple focusable" disabled={busy || phone.length < 6} onClick={requestOtp} style={{ opacity: busy || phone.length < 6 ? 0.5 : 1 }}>
                {busy ? "sending…" : "Send code"}
              </button>
            </div>
          )}

          {step === "verify" && (
            <div>
              <label className="lbl" style={{ color: "var(--pk-ink2)" }}>6-digit code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="••••••" className="num focusable" style={{ ...inp, letterSpacing: "0.5em", fontSize: 20 }} />
              {hint && (
                <p className="mono" style={hintStyle}>
                  demo code: <span className="num" style={{ color: "var(--purple)", fontWeight: 600 }}>{hint}</span>
                </p>
              )}
              {err && <ErrLine msg={err} />}
              <button className="btn btn-purple focusable" disabled={busy || code.length < 6} onClick={verifyOtp} style={{ opacity: busy || code.length < 6 ? 0.5 : 1 }}>
                {busy ? "verifying…" : "Verify & get ticket →"}
              </button>
            </div>
          )}

          {step === "claiming" && (
            <div className="mono" style={{ fontSize: 13, color: "var(--pk-ink2)", lineHeight: 1.9 }}>
              <div>→ finding your seat…</div>
              <div>→ locking it to you…</div>
              <div>→ confirming your ticket…</div>
            </div>
          )}

          {step === "done" && result && <Outcome result={result} onWaitlist={joinWaitlist} busy={busy} />}
        </div>
      </div>
    </div>
  );
}

function Outcome({ result, onWaitlist, busy }: { result: ClaimResult; onWaitlist: () => void; busy: boolean }) {
  if (result.ok) {
    return (
      <div>
        <span className="badge">✓ confirmed</span>
        <div style={{ fontFamily: "var(--font-syne)", fontWeight: 800, fontSize: 30, textTransform: "uppercase", letterSpacing: "-.02em", margin: "14px 0 4px" }}>
          Seat #{result.seat_no} is yours.
        </div>
        <p className="mono" style={{ fontSize: 13, color: "var(--pk-ink2)", marginBottom: 18 }}>
          It&apos;s locked to you — nobody else can buy this seat.
        </p>
        <ul className="brk" style={{ marginBottom: 18 }}>
          <li><span>Confirmed in</span><span className="num">{ms(result.latency_ms)}</span></li>
          <li><span>Double-booked</span><span className="num" style={{ color: "var(--pk-green)" }}>never</span></li>
        </ul>
        <Link href="/me" className="btn btn-ink-fill focusable">View my ticket →</Link>
      </div>
    );
  }

  const soldOut = result.error === "SOLD_OUT";
  return (
    <div>
      <span className="badge bad">{soldOut ? "sold out" : "busy"}</span>
      <div style={{ fontFamily: "var(--font-syne)", fontWeight: 800, fontSize: 26, textTransform: "uppercase", letterSpacing: "-.02em", margin: "14px 0 4px" }}>
        {soldOut ? "Gone — fairly." : "It's busy right now."}
      </div>
      <p className="mono" style={{ fontSize: 13, color: "var(--pk-ink2)", marginBottom: 16 }}>
        {soldOut
          ? "Every seat sold exactly once — you were never charged for one that wasn't there."
          : "Seats often free up — join the queue and you'll get first refusal."}
      </p>
      <button className="btn btn-purple focusable" disabled={busy} onClick={onWaitlist} style={{ opacity: busy ? 0.5 : 1 }}>
        {busy ? "…" : "Join the queue (first refusal on cancels)"}
      </button>
    </div>
  );
}

function ErrLine({ msg }: { msg: string }) {
  return (
    <p className="mono" style={{ fontSize: 12.5, color: "var(--pk-red)", margin: "10px 0" }}>
      ✕ {msg}
    </p>
  );
}

const inp: React.CSSProperties = {
  width: "100%",
  fontSize: 16,
  padding: "12px 14px",
  margin: "8px 0",
  borderRadius: 8,
  background: "var(--cream)",
  border: "1.5px solid var(--pk-ink)",
  color: "var(--pk-ink)",
};
const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--pk-ink2)",
  margin: "4px 0 16px",
};
