"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eyebrow, Tag, Meter } from "@/components/ui";

interface EvOpt {
  id: string;
  title: string;
  capacity: number;
  price: number;
}
interface Seat {
  seat_no: number;
  status: string;
  reserved_for: string | null;
}
interface Snapshot {
  capacity: number;
  remaining_open: number;
  counts: Record<string, number>;
  seats: Seat[];
}
interface Metrics {
  organizer: string;
  price: number;
  capacity: number;
  taken: number;
  sell_through: number;
  gross_revenue: number;
  region: Record<string, number>;
  defended: {
    oversell_blocked: number;
    oversell_defended_usd: number;
    bots_blocked: number;
    resale_repatriated_usd: number;
    total_defended_usd: number;
  };
}
interface RushResult {
  buyers: number;
  granted: number;
  oversold: number;
  oc000_total: number;
  commit_p95: number;
}

const usd = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-US");

export function OrgConsole({ events: initial }: { events: EvOpt[] }) {
  const router = useRouter();
  const [events, setEvents] = useState(initial);
  const [eventId, setEventId] = useState(
    initial.find((e) => e.capacity > 1)?.id ?? initial[0].id,
  );
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [rush, setRush] = useState<RushResult | null>(null);
  const [rushing, setRushing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const owned = useRef<Map<number, string>>(new Map());

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      fetch(`/api/claim?eventId=${eventId}`, { cache: "no-store" }),
      fetch(`/api/org/metrics?eventId=${eventId}`, { cache: "no-store" }),
    ]);
    if (a.ok) setSnap(await a.json());
    if (b.ok) setMetrics(await b.json());
  }, [eventId]);

  useEffect(() => {
    owned.current = new Map();
    setQueue([]);
    setLog([]);
    setRush(null);
    load();
    const id = setInterval(load, 1300);
    return () => clearInterval(id);
  }, [load, eventId]);

  const say = (m: string) => setLog((l) => [m, ...l].slice(0, 7));
  const ev = events.find((e) => e.id === eventId);

  async function fillSome(n: number) {
    if (n <= 0) return;
    setBusy(true);
    for (let i = 0; i < n; i++) {
      const buyer = `sim-${Math.floor(Math.random() * 1e6)}`;
      const region = i % 2 ? "us-east-2" : "us-east-1";
      const res = await fetch("/api/claim", {
        method: "POST",
        body: JSON.stringify({ action: "claim", eventId, buyerId: buyer, region }),
      });
      const d = await res.json();
      if (d.ok) {
        owned.current.set(d.seat_no, buyer);
        await fetch("/api/claim", {
          method: "POST",
          body: JSON.stringify({ action: "confirm", eventId, buyerId: buyer, seatNo: d.seat_no }),
        });
      }
    }
    say(`${n} buyers claimed + confirmed across both regions`);
    await load();
    setBusy(false);
  }

  async function addWaitlister() {
    const buyer = `fan-${queue.length + 1}`;
    await fetch("/api/claim", {
      method: "POST",
      body: JSON.stringify({ action: "waitlist", eventId, buyerId: buyer }),
    });
    setQueue((q) => [...q, buyer]);
    say(`${buyer} joined the waitlist at #${queue.length + 1}`);
  }

  async function cancelAndReoffer() {
    const entry = [...owned.current.entries()][0];
    if (!entry) return say("no confirmed seat to cancel — fill some first");
    const [seatNo, buyer] = entry;
    const res = await fetch("/api/claim", {
      method: "POST",
      body: JSON.stringify({ action: "cancel", eventId, buyerId: buyer, seatNo }),
    });
    const d = await res.json();
    owned.current.delete(seatNo);
    if (d.reoffered_to) {
      setQueue((q) => q.filter((x) => x !== d.reoffered_to));
      say(`seat #${seatNo} released → LOCKED offer to ${d.reoffered_to} (#1). bots can't grab it.`);
    } else say(`seat #${seatNo} released → open (no one waiting)`);
    await load();
  }

  // On-sale rush simulator: fire a real stampede at this drop's size → the OC000
  // count IS the number of double-sells blocked, which we turn into defended $.
  async function simulateRush() {
    if (!ev) return;
    setRushing(true);
    setRush(null);
    const buyers = Math.min(2000, Math.max(200, ev.capacity * 18));
    const res = await fetch("/api/demo/run", {
      method: "POST",
      body: JSON.stringify({ capacity: ev.capacity, buyers, seed: 42 }),
    });
    const data = await res.json();
    setTimeout(() => {
      setRush(data.result);
      setRushing(false);
      say(`on-sale rush: ${data.result.oc000_total.toLocaleString()} double-sells blocked, oversold ${data.result.oversold}`);
    }, 400);
  }

  const filled = snap ? snap.capacity - snap.remaining_open : 0;
  const rushDefended = rush && ev ? Math.round(rush.oc000_total * ev.price * 1.3) : 0;

  return (
    <div>
      {/* operator top bar */}
      <div className="frame" style={{ padding: "12px 16px", marginBottom: 18 }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow">organizer</span>
          <span className="num" style={{ fontSize: 13 }}>{metrics?.organizer ?? "Your venue"}</span>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="mono focusable"
            style={{ fontSize: 13, padding: "8px 11px", border: "1px solid var(--color-ink)", background: "var(--color-paper)", color: "var(--color-ink)" }}
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.title} · {usd(e.price)} · cap {e.capacity}</option>
            ))}
          </select>
          <div style={{ marginLeft: "auto" }} className="flex items-center gap-2">
            {snap && snap.remaining_open === 0 && <Tag tone="signal">sold out</Tag>}
            <button className="btn btn-primary focusable" onClick={() => setShowCreate(true)}>+ new drop</button>
          </div>
        </div>
      </div>

      {/* KPI row — the B2B headline numbers */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", marginBottom: 18 }}>
        <Kpi label="gross revenue" value={metrics ? usd(metrics.gross_revenue) : "—"} sub={metrics ? `${usd(metrics.price)} × ${metrics.taken}` : ""} />
        <Kpi label="sell-through" value={metrics ? `${Math.round(metrics.sell_through * 100)}%` : "—"} sub={metrics ? `${metrics.taken}/${metrics.capacity} seats` : ""} hot={!!metrics && metrics.sell_through >= 1} />
        <Kpi label="bots blocked" value={metrics ? metrics.defended.bots_blocked.toLocaleString() : "—"} sub="rate-limit + BotID" tone="signal" />
        <Kpi label="revenue defended" value={metrics ? usd(metrics.defended.total_defended_usd) : "—"} sub="oversell + resale · est." tone="affirm" />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) 330px", alignItems: "start" }}>
        {/* main column */}
        <div>
          {/* live floor */}
          {snap && (
            <div className="frame" style={{ padding: 16, marginBottom: 16 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <Eyebrow>live floor · DSQL ledger</Eyebrow>
                <span className="num" style={{ fontSize: 13 }}>{filled}/{snap.capacity} filled</span>
              </div>
              <Meter value={filled} max={snap.capacity} hot={snap.remaining_open === 0} />
              <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(22px,1fr))", marginTop: 14 }}>
                {snap.seats.slice(0, 120).map((s) => (
                  <div key={s.seat_no} className="seat" data-status={s.reserved_for ? "held" : s.status} style={{ fontSize: 7 }} title={s.reserved_for ? `locked offer → ${s.reserved_for}` : s.status}>
                    {s.reserved_for ? "★" : ""}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2" style={{ marginTop: 14 }}>
                <button className="btn focusable" disabled={busy} onClick={() => fillSome(8)}>+ 8 buyers</button>
                <button className="btn focusable" disabled={busy} onClick={() => fillSome(snap.remaining_open)}>fill to sold out</button>
                <button className="btn focusable" onClick={addWaitlister}>+ waitlister</button>
                <button className="btn btn-signal focusable" onClick={cancelAndReoffer}>cancel → re-offer</button>
              </div>
            </div>
          )}

          {/* on-sale rush simulator — ties defended $ to real conflicts */}
          <div className="frame" style={{ padding: 16 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <Eyebrow>on-sale rush simulator</Eyebrow>
              <button className="btn btn-primary focusable" disabled={rushing} onClick={simulateRush}>
                {rushing ? "firing…" : "▶ simulate the on-sale"}
              </button>
            </div>
            <p className="mono" style={{ fontSize: 12, color: "var(--color-ink-3)", marginBottom: rush ? 14 : 0 }}>
              Fires a worldwide rush at this drop&apos;s size across both regions. Every
              OC000 conflict is a double-sale the ledger refused — money you didn&apos;t
              have to refund.
            </p>
            {rush && ev && (
              <div className="rise">
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))" }}>
                  <MiniStat label="peak buyers" value={rush.buyers.toLocaleString()} />
                  <MiniStat label="granted" value={`${rush.granted}/${ev.capacity}`} tone="affirm" />
                  <MiniStat label="oversold" value={String(rush.oversold)} tone="affirm" />
                  <MiniStat label="double-sells blocked" value={rush.oc000_total.toLocaleString()} tone="signal" />
                </div>
                <div className="panel" style={{ padding: "12px 14px", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="eyebrow">refunds/chargebacks avoided (est.)</span>
                  <span className="num" style={{ fontSize: 22, color: "var(--color-affirm)" }}>{usd(rushDefended)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* rail */}
        <aside>
          {/* region split */}
          {metrics && (
            <div className="frame" style={{ padding: 16, marginBottom: 14 }}>
              <Eyebrow>writes by region · active-active</Eyebrow>
              {(["us-east-1", "us-east-2"] as const).map((r) => {
                const v = metrics.region[r] ?? 0;
                const max = Math.max(1, metrics.region["us-east-1"] + metrics.region["us-east-2"]);
                return (
                  <div key={r} style={{ marginTop: 10 }}>
                    <div className="flex justify-between" style={{ marginBottom: 4 }}>
                      <span className="num" style={{ fontSize: 12 }}>{r}</span>
                      <span className="num" style={{ fontSize: 12, color: "var(--color-ink-3)" }}>{v}</span>
                    </div>
                    <Meter value={v} max={max} />
                  </div>
                );
              })}
              <p className="mono" style={{ fontSize: 10.5, color: "var(--color-ink-3)", marginTop: 10 }}>
                one logical DSQL database · both endpoints take writes
              </p>
            </div>
          )}

          {/* defended breakdown */}
          {metrics && (
            <div className="frame" style={{ padding: 16, marginBottom: 14 }}>
              <Eyebrow>revenue defended · estimated</Eyebrow>
              <KvRow k="oversell (refund/chargeback)" v={usd(metrics.defended.oversell_defended_usd)} />
              <KvRow k="resale margin repatriated" v={usd(metrics.defended.resale_repatriated_usd)} />
              <div className="flex justify-between" style={{ paddingTop: 9, marginTop: 4, borderTop: "2px solid var(--color-ink)" }}>
                <span className="eyebrow">total</span>
                <span className="num" style={{ fontSize: 15, color: "var(--color-affirm)" }}>{usd(metrics.defended.total_defended_usd)}</span>
              </div>
            </div>
          )}

          {/* waitlist + fair re-release */}
          <div className="frame" style={{ padding: 16, marginBottom: 14 }}>
            <Eyebrow>waitlist · {queue.length} · first refusal</Eyebrow>
            {queue.length === 0 ? (
              <p className="mono" style={{ fontSize: 11.5, color: "var(--color-ink-3)", marginTop: 8 }}>
                add fans, then cancel a seat → #1 gets a LOCKED offer (no bot race).
              </p>
            ) : (
              <ol style={{ marginTop: 8, listStyle: "none" }}>
                {queue.map((b, i) => (
                  <li key={b} className="flex justify-between" style={{ padding: "5px 0", borderBottom: "1px solid var(--color-line)" }}>
                    <span className="num" style={{ fontSize: 12 }}>#{i + 1}</span>
                    <span className="mono" style={{ fontSize: 12, color: i === 0 ? "var(--color-signal)" : "var(--color-ink-2)" }}>{b}{i === 0 ? " ←" : ""}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* event log */}
          <div className="panel" style={{ padding: 14 }}>
            <Eyebrow>event log</Eyebrow>
            <div style={{ marginTop: 8 }}>
              {log.length === 0 ? <span className="mono" style={{ fontSize: 11.5, color: "var(--color-ink-3)" }}>—</span> :
                log.map((l, i) => (
                  <div key={i} className="mono" style={{ fontSize: 11, color: i === 0 ? "var(--color-ink)" : "var(--color-ink-3)", padding: "3px 0" }}>→ {l}</div>
                ))}
            </div>
          </div>
        </aside>
      </div>

      {showCreate && (
        <CreateDrop
          onClose={() => setShowCreate(false)}
          onCreated={(id, opt) => {
            setEvents((e) => [opt, ...e]);
            setEventId(id);
            setShowCreate(false);
            say(`new drop created: ${opt.title} (cap ${opt.capacity}, ${usd(opt.price)})`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateDrop({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string, opt: EvOpt) => void;
}) {
  const PRESETS = [
    { label: "arena concert", category: "concert", capacity: 80, price: 120 },
    { label: "limited drop", category: "drop", capacity: 30, price: 60 },
    { label: "sports final", category: "sports", capacity: 60, price: 95 },
    { label: "club night", category: "concert", capacity: 24, price: 35 },
  ];
  const [title, setTitle] = useState("");
  const [preset, setPreset] = useState(0);
  const [capacity, setCapacity] = useState(80);
  const [price, setPrice] = useState(120);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    const res = await fetch("/api/org/create", {
      method: "POST",
      body: JSON.stringify({ title, category: PRESETS[preset].category, capacity, price }),
    });
    const d = await res.json();
    setBusy(false);
    if (d.ok) onCreated(d.event_id, { id: d.event_id, title: d.title, capacity, price });
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "color-mix(in srgb, var(--color-ink) 40%, transparent)", display: "grid", placeItems: "center", zIndex: 50, padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} className="frame" style={{ background: "var(--color-paper)", padding: 24, width: 520, maxWidth: "100%" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div>
            <Eyebrow>onboarding · category → preset</Eyebrow>
            <div className="display" style={{ fontSize: 24, marginTop: 4 }}>New drop</div>
          </div>
          <button className="mono focusable" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        <label className="eyebrow">title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Midnight Pulse — Seoul" className="focusable" style={inp} />

        <label className="eyebrow" style={{ display: "block", marginTop: 14, marginBottom: 6 }}>preset</label>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => { setPreset(i); setCapacity(p.capacity); setPrice(p.price); }} className="focusable" style={{ padding: 10, textAlign: "left", cursor: "pointer", border: `1px solid ${preset === i ? "var(--color-ink)" : "var(--color-line)"}`, background: preset === i ? "var(--color-ink)" : "var(--color-paper)", color: preset === i ? "var(--color-paper)" : "var(--color-ink)" }}>
              <div className="mono" style={{ fontSize: 13 }}>{p.label}</div>
              <div className="eyebrow" style={{ color: "inherit", opacity: 0.7 }}>cap {p.capacity} · ${p.price}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-3" style={{ marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <label className="eyebrow">capacity</label>
            <input type="number" value={capacity} min={1} max={500} onChange={(e) => setCapacity(Number(e.target.value))} className="num focusable" style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="eyebrow">price (USD)</label>
            <input type="number" value={price} min={1} onChange={(e) => setPrice(Number(e.target.value))} className="num focusable" style={inp} />
          </div>
        </div>

        <div className="flex justify-end gap-2" style={{ marginTop: 20 }}>
          <button className="btn focusable" onClick={onClose}>cancel</button>
          <button className="btn btn-primary focusable" disabled={busy || !title.trim()} onClick={submit}>{busy ? "provisioning…" : "create + open sale →"}</button>
        </div>
        <p className="mono" style={{ fontSize: 10.5, color: "var(--color-ink-3)", marginTop: 12 }}>
          provisions PG catalog row (discovery) + DSQL slot/seats (ledger), opens immediately.
        </p>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone, hot }: { label: string; value: string; sub?: string; tone?: "signal" | "affirm"; hot?: boolean }) {
  const color = tone === "signal" ? "var(--color-signal)" : tone === "affirm" ? "var(--color-affirm)" : "var(--color-ink)";
  return (
    <div className="frame" style={{ padding: "14px 16px" }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}{hot ? " ●" : ""}</div>
      <div className="num" style={{ fontSize: 27, lineHeight: 1, color }}>{value}</div>
      {sub ? <div className="mono" style={{ fontSize: 10.5, color: "var(--color-ink-3)", marginTop: 5 }}>{sub}</div> : null}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "signal" | "affirm" }) {
  const color = tone === "signal" ? "var(--color-signal)" : tone === "affirm" ? "var(--color-affirm)" : "var(--color-ink)";
  return (
    <div className="panel" style={{ padding: "10px 12px" }}>
      <div className="eyebrow" style={{ marginBottom: 5 }}>{label}</div>
      <div className="num" style={{ fontSize: 19, color }}>{value}</div>
    </div>
  );
}

function KvRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between" style={{ padding: "7px 0", borderBottom: "1px solid var(--color-line)" }}>
      <span className="eyebrow">{k}</span>
      <span className="num" style={{ fontSize: 13 }}>{v}</span>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%",
  fontSize: 15,
  padding: "10px 12px",
  marginTop: 6,
  background: "var(--color-paper)",
  border: "1px solid var(--color-ink)",
  color: "var(--color-ink)",
};
