"use client";
import { useState } from "react";
import { ms } from "@/lib/format";
import { Eyebrow, Tag, LiveDot } from "@/components/ui";

interface RegionStats {
  region: string;
  attempts: number;
  success: number;
  rejected: number;
  oc000: number;
  p50: number;
  p95: number;
}
interface Result {
  capacity: number;
  buyers: number;
  seed: number;
  granted: number;
  rejected: number;
  oversold: number;
  oc000_total: number;
  commit_p50: number;
  commit_p95: number;
  duration_ms: number;
  regions: RegionStats[];
  histogram: { label: string; lo: number; hi: number; count: number }[];
}

const PRESETS = [
  { label: "last seat · 2 regions", capacity: 1, buyers: 800 },
  { label: "capacity 50 · stampede", capacity: 50, buyers: 1200 },
  { label: "capacity 100 · flash", capacity: 100, buyers: 2000 },
];

export function DemoConsole() {
  const [capacity, setCapacity] = useState(1);
  const [buyers, setBuyers] = useState(800);
  const [seed, setSeed] = useState(42);
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setResult(null);
    const res = await fetch("/api/demo/run", {
      method: "POST",
      body: JSON.stringify({ capacity, buyers, seed }),
    });
    const data = await res.json();
    // brief beat so the "firing" state reads on screen
    setTimeout(() => {
      setResult(data.result);
      setRunning(false);
    }, 420);
  }

  const maxBar = result ? Math.max(1, ...result.histogram.map((h) => h.count)) : 1;
  const peakIdx = result
    ? result.histogram.reduce((mi, h, i, a) => (h.count > a[mi].count ? i : mi), 0)
    : -1;

  return (
    <div>
      {/* topology strip */}
      <div className="frame" style={{ padding: "14px 18px", marginBottom: 20 }}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="flex items-center gap-2">
            <LiveDot />
            <span className="num" style={{ fontSize: 13 }}>us-east-1</span>
            <span className="eyebrow">virginia · active</span>
          </span>
          <span className="mono" style={{ color: "var(--color-ink-3)" }}>⇄ synchronous quorum ⇄</span>
          <span className="flex items-center gap-2">
            <LiveDot />
            <span className="num" style={{ fontSize: 13 }}>us-east-2</span>
            <span className="eyebrow">ohio · active</span>
          </span>
          <span className="mono" style={{ color: "var(--color-ink-3)", marginLeft: "auto" }}>
            witness us-west-2 · tiebreaker (no endpoint)
          </span>
        </div>
      </div>

      {/* controls */}
      <div className="panel" style={{ padding: 18, marginBottom: 20 }}>
        <div className="flex flex-wrap gap-2" style={{ marginBottom: 16 }}>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setCapacity(p.capacity);
                setBuyers(p.buyers);
              }}
              className="mono focusable"
              style={{
                fontSize: 12,
                padding: "6px 12px",
                cursor: "pointer",
                border: `1px solid ${capacity === p.capacity && buyers === p.buyers ? "var(--color-ink)" : "var(--color-line-2)"}`,
                background: capacity === p.capacity && buyers === p.buyers ? "var(--color-ink)" : "var(--color-paper)",
                color: capacity === p.capacity && buyers === p.buyers ? "var(--color-paper)" : "var(--color-ink-2)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-5">
          <Knob label="capacity (seats)" value={capacity} min={1} max={200} onChange={setCapacity} />
          <Knob label="concurrent buyers" value={buyers} min={2} max={2000} step={50} onChange={setBuyers} />
          <Knob label="seed (reproducible)" value={seed} min={1} max={9999} onChange={setSeed} />
          <button
            onClick={run}
            disabled={running}
            className="btn btn-signal focusable"
            style={{ fontSize: 14, padding: "13px 24px" }}
          >
            {running ? "firing…" : "▶ fire stampede"}
          </button>
        </div>
      </div>

      {/* result */}
      {running && (
        <div className="frame" style={{ padding: 40, textAlign: "center" }}>
          <div className="mono" style={{ color: "var(--color-ink-2)" }}>
            {buyers.toLocaleString()} buyers hitting both regions within ±50ms…
          </div>
        </div>
      )}

      {result && (
        <div className="rise">
          {/* headline verdict */}
          <div
            className="frame"
            style={{
              padding: 22,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              borderColor: "var(--color-ink)",
            }}
          >
            <div>
              <Eyebrow>verdict</Eyebrow>
              <div className="display" style={{ fontSize: 40, marginTop: 4 }}>
                Oversold:{" "}
                <span style={{ color: "var(--color-affirm)" }}>{result.oversold}</span>
              </div>
              <div className="mono" style={{ fontSize: 13, color: "var(--color-ink-3)", marginTop: 4 }}>
                {result.granted} of {result.capacity} seats granted ·{" "}
                {result.buyers.toLocaleString()} buyers · {result.rejected.toLocaleString()} fairly rejected
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <Tag tone="affirm">RPO 0 · stale read 0</Tag>
              <div className="num" style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 8 }}>
                seed {result.seed} · {ms(result.duration_ms)}
              </div>
            </div>
          </div>

          {/* stat grid */}
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", marginBottom: 20 }}>
            <BigStat label="granted" value={result.granted} tone="affirm" />
            <BigStat label="OC000 conflicts" value={result.oc000_total} tone="signal" />
            <BigStat label="commit p50" value={result.commit_p50} unit="ms" />
            <BigStat label="commit p95" value={result.commit_p95} unit="ms" />
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)" }}>
            {/* histogram */}
            <div className="frame" style={{ padding: 18 }}>
              <div className="flex items-baseline justify-between" style={{ marginBottom: 16 }}>
                <Eyebrow>commit latency distribution</Eyebrow>
                <span className="eyebrow">ms →</span>
              </div>
              <div className="flex items-end gap-1" style={{ height: 160 }}>
                {result.histogram.map((h, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                    <div
                      className={`hbar${i === peakIdx ? " peak" : ""}`}
                      style={{ height: `${(h.count / maxBar) * 100}%`, minHeight: h.count ? 2 : 0 }}
                      title={`${h.lo}–${h.hi}ms · ${h.count}`}
                    />
                    <div className="num" style={{ fontSize: 9, color: "var(--color-ink-3)", textAlign: "center", marginTop: 4 }}>
                      {h.lo}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* per-region ledger */}
            <div className="frame" style={{ padding: 0, overflow: "hidden" }}>
              <table className="ledger">
                <thead>
                  <tr>
                    <th>region</th>
                    <th>won</th>
                    <th>OC000</th>
                    <th>p95</th>
                  </tr>
                </thead>
                <tbody>
                  {result.regions.map((r) => (
                    <tr key={r.region}>
                      <td className="num" style={{ fontSize: 12.5 }}>{r.region}</td>
                      <td className="num">{r.success}</td>
                      <td className="num" style={{ color: r.oc000 ? "var(--color-signal)" : "inherit" }}>{r.oc000}</td>
                      <td className="num">{r.p95}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mono" style={{ fontSize: 11, color: "var(--color-ink-3)", padding: "12px 14px", borderTop: "1px solid var(--color-line)" }}>
                Aurora PostgreSQL Global DB is async — this cross-region serialization is structurally impossible there.
              </div>
            </div>
          </div>

          <p className="mono" style={{ fontSize: 11.5, color: "var(--color-ink-3)", marginTop: 16 }}>
            honest cost: cross-region commits pay ~2 RTT of synchronous replication
            (visible in us-east-2 p95). That latency is the price of zero data loss
            and zero stale reads — Postgres has no option that buys it.
          </p>
        </div>
      )}
    </div>
  );
}

function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        className="num focusable"
        style={{
          width: 130,
          fontSize: 16,
          padding: "10px 12px",
          background: "var(--color-paper)",
          border: "1px solid var(--color-ink)",
          color: "var(--color-ink)",
        }}
      />
    </div>
  );
}

function BigStat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: number;
  unit?: string;
  tone?: "signal" | "affirm";
}) {
  const color =
    tone === "signal" ? "var(--color-signal)" : tone === "affirm" ? "var(--color-affirm)" : "var(--color-ink)";
  return (
    <div className="panel" style={{ padding: "16px 18px" }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div className="num" style={{ fontSize: 34, lineHeight: 1, color }}>
        {value.toLocaleString()}
        {unit ? <span style={{ fontSize: 14, color: "var(--color-ink-3)", marginLeft: 3 }}>{unit}</span> : null}
      </div>
    </div>
  );
}
