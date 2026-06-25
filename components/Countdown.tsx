"use client";
import { useEffect, useState } from "react";
import { pad } from "@/lib/format";

// On-sale countdown. When it crosses zero it flips to a LIVE signal.
export function Countdown({
  target,
  onLive,
}: {
  target: number;
  onLive?: () => void;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  if (now === null)
    return <span className="num" style={{ fontSize: 13, color: "var(--pk-ink2)" }}>—</span>;

  const d = target - now;
  if (d <= 0) {
    onLive?.();
    return (
      <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--purple)", fontWeight: 600 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--purple)", display: "inline-block" }} /> On sale now
      </span>
    );
  }
  const total = Math.floor(d / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return (
    <span className="num" style={{ fontFamily: "var(--font-syne)", fontWeight: 800, fontSize: 30, letterSpacing: "0.01em" }}>
      {h > 0 ? `${pad(h)}:` : ""}
      {pad(m)}:{pad(s)}
    </span>
  );
}
