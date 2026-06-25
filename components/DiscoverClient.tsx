"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { distanceLabel, relTime } from "@/lib/format";

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
    price?: number;
  };
  distance_km: number | null;
  score: number;
  remaining_open: number;
  status: "live" | "soon" | "ended";
}

const SEOUL = { lat: 37.5563, lng: 126.976 };
const CHIPS = [
  "indie shows this weekend",
  "k-pop world tour",
  "sneaker drops",
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
    const t = setTimeout(load, q ? 220 : 0);
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
    <div className="poster">
      <div className="wrap">
        <section className="band" data-wm="FIND">
          <span className="kick">Find your next show</span>
          <h1>Tickets that don&apos;t sell out from under you.</h1>
          <p className="sub">
            Every event here runs on OpenSlot — so the seat you pick is the seat you get.
          </p>
        </section>

        {/* search controls */}
        <div className="ctrl">
          <div className="row">
            <div className="fld">
              <label>Search events</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Concerts, drops, sports near you…"
                className="focusable"
              />
            </div>
            <div className="fld short">
              <label>Within</label>
              <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="focusable">
                {[5, 10, 25, 50, 200, 20000].map((r) => (
                  <option key={r} value={r}>{r >= 20000 ? "anywhere" : `${r} km`}</option>
                ))}
              </select>
            </div>
            <button onClick={useMyLocation} className="chip" style={{ alignSelf: "flex-end" }}>
              {usingGeo ? "● located" : "Use my location"}
            </button>
          </div>
          <div className="chips">
            {CHIPS.map((c) => (
              <button key={c} onClick={() => setQ(c)} className={`chip${q === c ? " on" : ""}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="resultline">
          <span>{loading ? "searching…" : `${results.length} events near ${usingGeo ? "you" : "Seoul"}`}</span>
          <span>Sort: Soonest</span>
        </div>

        {!loading && results.length === 0 ? (
          <div className="pn" style={{ textAlign: "center", marginTop: 18 }}>
            <p className="mono" style={{ color: "var(--pk-ink2)" }}>No events in range. Widen the distance or clear the search.</p>
          </div>
        ) : (
          <div className="cards">
            {results.map((r) => (
              <EventCard key={r.event.id} r={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ r }: { r: Result }) {
  const lastSeat = r.status === "live" && r.remaining_open === 1;
  const stateClass = r.status === "soon" ? "soon" : lastSeat ? "last" : r.status === "live" ? "live" : "last";
  const stateLabel =
    r.status === "soon"
      ? `on sale ${relTime(r.event.sale_opens_at)}`
      : r.status === "ended"
        ? "sold out"
        : lastSeat
          ? "last seat"
          : "live";
  const sold = r.status === "ended" || (r.status === "live" && r.remaining_open === 0);
  const price = r.event.price;
  return (
    <Link href={`/event/${r.event.id}`} className="ecard focusable" style={{ color: "inherit" }}>
      <div className="ct">
        <span className="cat">{r.event.category}</span>
        <span className={`state ${stateClass}`}>{stateLabel}</span>
      </div>
      <h3>{r.event.title}</h3>
      <div className="venue">{r.event.venue} · {r.event.city}</div>
      <div className="cf">
        <span className="meta">
          {distanceLabel(r.distance_km)} ·{" "}
          {r.status === "soon" ? "—" : sold ? "0 open" : `${r.remaining_open} open`}
        </span>
        <span className="price">{price ? `from $${price}` : "free"}</span>
      </div>
      <div style={{ marginTop: 16 }}>
        <span className="btn-purple" style={{ display: "block", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12.5, padding: "11px 0", borderRadius: 8, background: sold ? "var(--pk-ink2)" : "var(--purple)", color: "#fff", fontWeight: 600 }}>
          {sold ? "Sold out" : r.status === "soon" ? "Join the queue" : "Get tickets"}
        </span>
      </div>
    </Link>
  );
}
