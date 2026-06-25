"use client";
import { useState } from "react";
import { ms } from "@/lib/format";

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
    <div className="poster">
      {/* topology */}
      <div className="pn" style={{ marginTop: 24 }}>
        <div className="topo">
          <span className="reg"><span className="dot" /> us-east-1 · N. Virginia · active</span>
          <span className="mono" style={{ color: "var(--pk-ink2)" }}>⇄ synchronous quorum ⇄</span>
          <span className="reg"><span className="dot" /> us-east-2 · Ohio · active</span>
          <span className="mono" style={{ color: "var(--pk-ink2)", marginLeft: "auto" }}>witness us-west-2 · tiebreaker</span>
        </div>
      </div>

      {/* controls */}
      <div className="pn" style={{ marginTop: 18 }}>
        <div className="chips" style={{ marginBottom: 18 }}>
          {PRESETS.map((p) => {
            const on = capacity === p.capacity && buyers === p.buyers;
            return (
              <button key={p.label} onClick={() => { setCapacity(p.capacity); setBuyers(p.buyers); }} className={`chip${on ? " on" : ""}`}>
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-5">
          <Knob label="capacity" value={capacity} min={1} max={200} onChange={setCapacity} />
          <Knob label="concurrent buyers" value={buyers} min={2} max={2000} step={50} onChange={setBuyers} />
          <Knob label="seed" value={seed} min={1} max={9999} onChange={setSeed} />
          <button onClick={run} disabled={running} className="btn btn-purple focusable" style={{ padding: "13px 24px" }}>
            {running ? "firing…" : "▶ Fire stampede"}
          </button>
        </div>
      </div>

      {running && (
        <div className="pn" style={{ marginTop: 18, textAlign: "center", padding: 40 }}>
          <span className="mono" style={{ color: "var(--pk-ink2)" }}>
            {buyers.toLocaleString()} buyers hitting both regions within ±50ms…
          </span>
        </div>
      )}

      {result && (
        <>
          <div className="resgrid">
            <div className="res hot">
              <dt>Oversold</dt>
              <div className="v num">{result.oversold}</div>
              <div className="sub">structural</div>
            </div>
            <div className="res">
              <dt>Granted</dt>
              <div className="v num">{result.granted}</div>
              <div className="sub">of {result.capacity} seats</div>
            </div>
            <div className="res">
              <dt>OC000 conflicts</dt>
              <div className="v num">{result.oc000_total.toLocaleString()}</div>
              <div className="sub">retried, never double-sold</div>
            </div>
            <div className="res">
              <dt>Buyers</dt>
              <div className="v num">{result.buyers.toLocaleString()}</div>
              <div className="sub">seed {result.seed} · {ms(result.duration_ms)}</div>
            </div>
          </div>

          <div className="cols2 wide-left" style={{ marginTop: 24 }}>
            {/* histogram */}
            <div className="pn">
              <div className="ph"><h3>Commit latency</h3><span className="tag">ms →</span></div>
              <div className="histo">
                {result.histogram.map((h, i) => (
                  <div key={i} className={`col${i === peakIdx ? " peak" : ""}`}>
                    <div className="bar" style={{ height: `${(h.count / maxBar) * 100}%`, minHeight: h.count ? 2 : 0 }} title={`${h.lo}–${h.hi}ms · ${h.count}`} />
                    <div className="x">{h.lo}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* per-region */}
            <div className="regcol">
              <h3>By region</h3>
              {result.regions.map((r) => (
                <div className="rowstat" key={r.region}>
                  <span>{r.region}</span>
                  <span><b>{r.success}</b> won · {r.oc000} OC000 · <span className="p95">{r.p95}ms p95</span></span>
                </div>
              ))}
            </div>
          </div>

          <p className="mono" style={{ fontSize: 11.5, color: "var(--pk-ink2)", marginTop: 18, lineHeight: 1.6 }}>
            Honest cost: cross-region commits pay ~2 RTT of synchronous replication (visible in us-east-2 p95).
            That latency is the price of zero data loss and zero stale reads — async Postgres has no option that buys it.
          </p>
        </>
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
    <div className="knob">
      <label>{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        className="focusable"
      />
    </div>
  );
}
