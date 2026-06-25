"use client";
// Click-to-place location picker for the organizer's drop. Leaflet is loaded
// dynamically (client-only) so it never touches SSR; we use a divIcon marker to
// avoid Leaflet's default image-asset path breaking under the bundler. The pin
// the organizer drops becomes the event's lat/lng — the exact value PostGIS
// radius discovery uses, so a created drop is findable "near me" like the seeds.
import { useEffect, useRef } from "react";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

function ensureLeafletCss() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = LEAFLET_CSS;
  document.head.appendChild(link);
}

export function MapPicker({
  lat,
  lng,
  onChange,
  height = 200,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  height?: number;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  // map + marker handles, plus the latest onChange (avoid re-binding listeners)
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // init once
  useEffect(() => {
    let disposed = false;
    ensureLeafletCss();
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !elRef.current || mapRef.current) return;
      const map = L.map(elRef.current, { attributionControl: false, zoomControl: true }).setView([lat, lng], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      const icon = L.divIcon({
        className: "os-pin",
        html: '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:var(--vermilion,#e8472b);transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 18],
      });
      const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onChangeRef.current(Number(p.lat.toFixed(5)), Number(p.lng.toFixed(5)));
      });
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        onChangeRef.current(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)));
      });
      mapRef.current = map;
      markerRef.current = marker;
      // tiles can mis-measure inside a just-opened modal → nudge a resize
      setTimeout(() => map.invalidateSize(), 60);
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // external lat/lng changes (e.g. a city preset) → recenter + move the pin
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], map.getZoom() < 11 ? 12 : map.getZoom());
  }, [lat, lng]);

  return (
    <div
      ref={elRef}
      style={{ height, width: "100%", borderRadius: 8, overflow: "hidden", border: "1.5px solid var(--pk-ink)", background: "#dfe3e6" }}
    />
  );
}
