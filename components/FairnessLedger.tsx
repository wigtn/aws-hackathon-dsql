"use client";
import { useEffect, useState, useCallback } from "react";
import { Eyebrow, Tag } from "@/components/ui";

interface Entry {
  seq: number;
  seat_no: number;
  region: string;
  buyer_fingerprint: string;
  hash: string;
}
interface Report {
  count: number;
  verified: boolean;
  broken_at: number | null;
  regions: Record<string, number>;
  entries: Entry[];
}

// Verifiable fair on-sale: the hash-chained allocation ledger + a tamper demo.
// This is the Originality money shot — only possible because DSQL gives one
// authoritative global commit order (async multi-region cannot).
export function FairnessLedger({ eventId }: { eventId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [tamper, setTamper] = useState<number | null>(null);

  const load = useCallback(async () => {
    const q = tamper ? `&tamper=${tamper}` : "";
    const res = await fetch(`/api/fairness?eventId=${eventId}${q}`, { cache: "no-store" });
    if (res.ok) setReport(await res.json());
  }, [eventId, tamper]);

  useEffect(() => {
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [load]);

  const entries = report?.entries ?? [];
  const ok = report?.verified ?? true;

  return (
    <div className="frame" style={{ padding: 16 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <Eyebrow>fairness ledger · tamper-evident</Eyebrow>
        {report && report.count > 0 ? (
          ok ? (
            <Tag tone="affirm">✓ verified</Tag>
          ) : (
            <Tag tone="signal">✗ tamper detected</Tag>
          )
        ) : (
          <span className="eyebrow">empty</span>
        )}
      </div>

      <p className="mono" style={{ fontSize: 11, color: "var(--color-ink-3)", marginBottom: 12, lineHeight: 1.5 }}>
        every allocation hash-chained in <strong>global commit order</strong> on one
        strongly-consistent DSQL ledger — no region, bot, or insider lane. async
        multi-region can&apos;t produce this single authoritative order.
      </p>

      {/* region split = global fairness */}
      {report && Object.keys(report.regions).length > 0 && (
        <div className="flex flex-wrap gap-2" style={{ marginBottom: 12 }}>
          {Object.entries(report.regions).map(([r, n]) => (
            <span key={r} className="tag" style={{ fontSize: 10.5 }}>
              {r} · {n}
            </span>
          ))}
        </div>
      )}

      {!ok && report?.broken_at != null && (
        <div
          className="mono"
          style={{ fontSize: 11, color: "var(--color-signal)", padding: "8px 10px", border: "1px solid var(--color-signal)", marginBottom: 12 }}
        >
          ✗ chain breaks at seq {report.broken_at} — every entry after it is provably altered.
        </div>
      )}

      <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--color-line)" }}>
        <table className="ledger" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th>#</th>
              <th>seat</th>
              <th>region</th>
              <th>buyer</th>
              <th>hash</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={5} className="mono" style={{ color: "var(--color-ink-3)" }}>fill seats to populate the ledger</td></tr>
            ) : (
              entries.map((e) => {
                const broken = !ok && report?.broken_at != null && e.seq >= report.broken_at;
                return (
                  <tr key={e.seq}>
                    <td className="num">{e.seq}</td>
                    <td className="num">#{e.seat_no}</td>
                    <td className="num" style={{ fontSize: 10 }}>{e.region}</td>
                    <td className="num" style={{ fontSize: 10, color: "var(--color-ink-3)" }}>{e.buyer_fingerprint}</td>
                    <td className="num" style={{ fontSize: 10, color: broken ? "var(--color-signal)" : "var(--color-ink-3)" }}>
                      {e.hash.slice(0, 10)}…
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {entries.length > 0 && (
        <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
          {tamper ? (
            <button className="btn focusable" onClick={() => setTamper(null)}>↻ re-verify (clean)</button>
          ) : (
            <button
              className="btn btn-signal focusable"
              onClick={() => setTamper(Math.max(1, Math.ceil(entries.length / 2)))}
            >
              simulate tampering
            </button>
          )}
          <span className="mono" style={{ fontSize: 10.5, color: "var(--color-ink-3)" }}>
            {tamper ? "one entry altered → chain fails from there" : "flip one record → detection"}
          </span>
        </div>
      )}
    </div>
  );
}
