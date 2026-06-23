"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ms } from "@/lib/format";
import { Eyebrow, Tag } from "@/components/ui";

type Region = "us-east-1" | "us-east-2";
type Step = "region" | "otp" | "verify" | "claiming" | "done";

interface ClaimResult {
  ok: boolean;
  seat_no?: number;
  region: Region;
  attempts: number;
  oc000: number;
  latency_ms: number;
  error?: string;
  remaining_open?: number;
}

const REGIONS: { id: Region; label: string }[] = [
  { id: "us-east-1", label: "N. Virginia" },
  { id: "us-east-2", label: "Ohio" },
];

export function ClaimFlow({ eventId, title }: { eventId: string; title: string }) {
  const sp = useSearchParams();
  const seat = sp.get("seat");
  const [step, setStep] = useState<Step>("region");
  const [region, setRegion] = useState<Region>("us-east-1");
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
    const res = await fetch("/api/otp", {
      method: "POST",
      body: JSON.stringify({ step: "request", phone }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(data.error ?? "failed");
    setHint(data.demo_hint ?? null);
    setStep("verify");
  }

  async function verifyOtp() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/otp", {
      method: "POST",
      body: JSON.stringify({ step: "verify", phone, code }),
    });
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
    const res = await fetch("/api/claim", {
      method: "POST",
      body: JSON.stringify({ action: "claim", eventId, buyerId: bid, region }),
    });
    const data: ClaimResult = await res.json();
    setResult(data);
    if (data.ok) await fetch("/api/claim", {
      method: "POST",
      body: JSON.stringify({ action: "confirm", eventId, buyerId: bid, seatNo: data.seat_no }),
    });
    setStep("done");
  }

  async function joinWaitlist() {
    setBusy(true);
    await fetch("/api/claim", {
      method: "POST",
      body: JSON.stringify({ action: "waitlist", eventId, buyerId: buyerId || `buyer-anon` }),
    });
    setBusy(false);
    setErr("waitlisted");
  }

  return (
    <div className="frame" style={{ padding: 0, maxWidth: 560 }}>
      {/* progress rail */}
      <div className="flex" style={{ borderBottom: "1px solid var(--color-ink)" }}>
        {["region", "identity", "claim"].map((s, i) => {
          const active =
            (i === 0 && step === "region") ||
            (i === 1 && (step === "otp" || step === "verify")) ||
            (i === 2 && (step === "claiming" || step === "done"));
          const passed =
            (i === 0 && step !== "region") ||
            (i === 1 && (step === "claiming" || step === "done"));
          return (
            <div
              key={s}
              className="eyebrow"
              style={{
                flex: 1,
                padding: "10px 14px",
                background: active ? "var(--color-ink)" : "transparent",
                color: active ? "var(--color-paper)" : passed ? "var(--color-ink)" : "var(--color-ink-3)",
                borderRight: i < 2 ? "1px solid var(--color-line)" : "none",
              }}
            >
              {i + 1}. {s} {passed ? "✓" : ""}
            </div>
          );
        })}
      </div>

      <div style={{ padding: 22 }}>
        <Eyebrow>claiming</Eyebrow>
        <div className="display" style={{ fontSize: 24, marginTop: 6, marginBottom: 18 }}>
          {title}
          {seat ? <span className="num" style={{ fontSize: 16, color: "var(--color-ink-3)" }}> · seat #{seat}</span> : null}
        </div>

        {step === "region" && (
          <div className="rise">
            <p className="mono" style={{ fontSize: 13, color: "var(--color-ink-2)", marginBottom: 14 }}>
              Pick the endpoint you connect through. Both are active-active on one
              logical DSQL database — the demo proves the write is serialized either way.
            </p>
            <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 18 }}>
              {REGIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRegion(r.id)}
                  className="focusable"
                  style={{
                    padding: "14px",
                    textAlign: "left",
                    border: `1px solid ${region === r.id ? "var(--color-ink)" : "var(--color-line)"}`,
                    background: region === r.id ? "var(--color-ink)" : "var(--color-paper)",
                    color: region === r.id ? "var(--color-paper)" : "var(--color-ink)",
                    cursor: "pointer",
                  }}
                >
                  <div className="num" style={{ fontSize: 14 }}>{r.id}</div>
                  <div className="eyebrow" style={{ color: "inherit", opacity: 0.7 }}>{r.label}</div>
                </button>
              ))}
            </div>
            <button className="btn btn-primary focusable" onClick={() => setStep("otp")}>
              continue →
            </button>
          </div>
        )}

        {step === "otp" && (
          <div className="rise">
            <label className="eyebrow">phone — identity binding</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+82 10 1234 5678"
              className="mono focusable"
              style={inputStyle}
            />
            <p className="mono" style={hintStyle}>
              one ticket binds to one verified identity + this device.
            </p>
            {err && <ErrLine msg={err} />}
            <button className="btn btn-primary focusable" disabled={busy || phone.length < 6} onClick={requestOtp}>
              {busy ? "sending…" : "send code"}
            </button>
          </div>
        )}

        {step === "verify" && (
          <div className="rise">
            <label className="eyebrow">6-digit code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••"
              className="num focusable"
              style={{ ...inputStyle, letterSpacing: "0.5em", fontSize: 20 }}
            />
            {hint && (
              <p className="mono" style={hintStyle}>
                demo code: <span className="num" style={{ color: "var(--color-signal)" }}>{hint}</span>
              </p>
            )}
            {err && <ErrLine msg={err} />}
            <button className="btn btn-primary focusable" disabled={busy || code.length < 6} onClick={verifyOtp}>
              {busy ? "verifying…" : "verify & claim →"}
            </button>
          </div>
        )}

        {step === "claiming" && (
          <div className="rise mono" style={{ fontSize: 13, color: "var(--color-ink-2)" }}>
            <div>→ probing open seat by primary key…</div>
            <div>→ check-and-set on read-set version…</div>
            <div>→ committing via {region}…</div>
          </div>
        )}

        {step === "done" && result && <Outcome result={result} onWaitlist={joinWaitlist} busy={busy} />}
      </div>
    </div>
  );
}

function Outcome({
  result,
  onWaitlist,
  busy,
}: {
  result: ClaimResult;
  onWaitlist: () => void;
  busy: boolean;
}) {
  if (result.ok) {
    return (
      <div className="rise">
        <Tag tone="affirm">confirmed</Tag>
        <div className="display" style={{ fontSize: 30, margin: "12px 0 4px" }}>
          Seat #{result.seat_no} is yours.
        </div>
        <p className="mono" style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 18 }}>
          committed via {result.region}. every other region reads “taken” instantly.
        </p>
        <div className="panel" style={{ padding: 14, marginBottom: 18 }}>
          {[
            ["commit latency", ms(result.latency_ms)],
            ["attempts", String(result.attempts)],
            ["OC000 absorbed", String(result.oc000)],
            ["double sale", "0"],
          ].map(([k, v], i) => (
            <div key={k} className="flex justify-between" style={{ padding: "6px 0", borderBottom: i < 3 ? "1px solid var(--color-line)" : "none" }}>
              <span className="eyebrow">{k}</span>
              <span className="num" style={{ fontSize: 13, color: k === "double sale" ? "var(--color-affirm)" : "var(--color-ink)" }}>{v}</span>
            </div>
          ))}
        </div>
        <Link href="/me" className="btn btn-primary focusable">view my ticket →</Link>
      </div>
    );
  }

  const soldOut = result.error === "SOLD_OUT";
  return (
    <div className="rise">
      <Tag tone="signal">{soldOut ? "sold out" : "congested"}</Tag>
      <div className="display" style={{ fontSize: 26, margin: "12px 0 4px" }}>
        {soldOut ? "Gone — fairly." : "Heavy contention."}
      </div>
      <p className="mono" style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 16 }}>
        {soldOut
          ? "the ledger serialized every region; you weren’t double-charged for a seat that didn’t exist."
          : `5 retries hit ${result.oc000} OC000 conflicts. seats may free up — join the queue for first refusal.`}
      </p>
      <button className="btn btn-signal focusable" disabled={busy} onClick={onWaitlist}>
        {busy ? "…" : "join waitlist (first refusal on cancels)"}
      </button>
    </div>
  );
}

function ErrLine({ msg }: { msg: string }) {
  return (
    <p className="mono" style={{ fontSize: 12.5, color: "var(--color-signal)", margin: "10px 0" }}>
      ✕ {msg}
    </p>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 16,
  padding: "12px 14px",
  margin: "8px 0",
  background: "var(--color-paper)",
  border: "1px solid var(--color-ink)",
  color: "var(--color-ink)",
};
const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--color-ink-3)",
  margin: "4px 0 16px",
};
