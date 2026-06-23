"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { distanceLabel, relTime } from "@/lib/format";
import { Tag, Meter, LiveDot } from "@/components/ui";

interface Result {
  event: {
    id: string;
    title: string;
    subtitle: string;
    category: string;
    venue: string;
    city: string;
    organizer_name: string;
    sale_opens_at: number;
  };
  distance_km: number | null;
  score: number;
  remaining_open: number;
  status: "live" | "soon" | "ended";
}

const SEOUL = { lat: 37.5563, lng: 126.976 };
const CHIPS = [
  "indie show this weekend near me",
  "k-pop world tour",
  "limited sneaker drop",
  "labubu restock",
  "cup final",
];

export function DiscoverClient() {
  const [loc, setLoc] = useState(SEOUL);
  const [radius, setRadius] = useState(50);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingGeo, setUsingGeo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      lat: String(loc.lat),
      lng: String(loc.lng),
      radiusKm: String(radius),
    });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/discover?${params}`);
    const data = await res.json();
    setResults(data.results ?? []);
    setLoading(false);
  }, [loc, radius, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 220 : 0); // debounce semantic typing
    return () => clearTimeout(t);
  }, [load, q]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
        setUsingGeo(true);
      },
      () => setUsingGeo(false),
    );
  };

  return (
    <div>
      {/* control strip */}
      <div className="panel" style={{ padding: 16, marginBottom: 20 }}>
        <div className="flex flex-wrap items-center gap-3">
          <div style={{ flex: "1 1 320px" }}>
            <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>
              Semantic search · pgvector
            </label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="describe what you want to see…"
              className="mono focusable"
              style={{
                width: "100%",
                fontSize: 14,
                padding: "10px 12px",
                background: "var(--color-paper)",
                border: "1px solid var(--color-ink)",
                color: "var(--color-ink)",
              }}
            />
          </div>
          <div>
            <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>
              Radius · PostGIS
            </label>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="mono focusable"
              style={{
                fontSize: 14,
                padding: "10px 12px",
                background: "var(--color-paper)",
                border: "1px solid var(--color-ink)",
                color: "var(--color-ink)",
              }}
            >
              {[5, 10, 25, 50, 200, 20000].map((r) => (
                <option key={r} value={r}>
                  {r >= 20000 ? "global" : `${r} km`}
                </option>
              ))}
            </select>
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <button onClick={useMyLocation} className="btn focusable">
              {usingGeo ? "● located" : "use my location"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" style={{ marginTop: 12 }}>
          {CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => setQ(c)}
              className="mono focusable"
              style={{
                fontSize: 11.5,
                padding: "4px 10px",
                border: "1px solid var(--color-line-2)",
                background: q === c ? "var(--color-ink)" : "var(--color-paper)",
                color: q === c ? "var(--color-paper)" : "var(--color-ink-2)",
                cursor: "pointer",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* results */}
      <div className="flex items-baseline justify-between" style={{ marginBottom: 12 }}>
        <div className="eyebrow">
          {loading ? "querying…" : `${results.length} drops`}
          {q ? " · ranked by meaning" : " · ranked by distance"}
        </div>
        <div className="eyebrow">live stock joined from DSQL ledger</div>
      </div>

      {!loading && results.length === 0 ? (
        <div className="frame" style={{ padding: 28, textAlign: "center" }}>
          <div className="mono" style={{ color: "var(--color-ink-2)" }}>
            No drops in range. Widen the radius or clear the search.
          </div>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
          {results.map((r, i) => (
            <EventCard key={r.event.id} r={r} idx={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({ r, idx }: { r: Result; idx: number }) {
  const sold = r.status === "ended" || (r.status === "live" && r.remaining_open === 0);
  return (
    <Link
      href={`/event/${r.event.id}`}
      className="frame rise focusable"
      style={{
        textDecoration: "none",
        color: "inherit",
        padding: 0,
        display: "block",
        animationDelay: `${idx * 40}ms`,
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-line)" }}
      >
        <span className="eyebrow">{r.event.category}</span>
        {r.status === "live" ? (
          <Tag tone="signal">
            <LiveDot /> live
          </Tag>
        ) : r.status === "soon" ? (
          <span className="num" style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
            {relTime(r.event.sale_opens_at)}
          </span>
        ) : (
          <Tag tone="signal">sold out</Tag>
        )}
      </div>

      <div style={{ padding: 14 }}>
        <div className="display" style={{ fontSize: 21, marginBottom: 4 }}>
          {r.event.title}
        </div>
        <div className="mono" style={{ fontSize: 12.5, color: "var(--color-ink-3)", marginBottom: 14 }}>
          {r.event.venue} · {r.event.city}
        </div>

        <Meter
          value={sold ? 1 : Math.max(0, 1 - r.remaining_open / 60)}
          max={1}
          hot={r.status === "live"}
        />
        <div
          className="flex items-center justify-between num"
          style={{ marginTop: 8, fontSize: 12, color: "var(--color-ink-2)" }}
        >
          <span>{distanceLabel(r.distance_km)} away</span>
          <span>
            {r.status === "soon"
              ? "—"
              : r.remaining_open > 0
                ? `${r.remaining_open} open`
                : "0 open"}
          </span>
        </div>
      </div>
    </Link>
  );
}
