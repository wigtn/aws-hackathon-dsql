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
    return <span className="num" style={{ fontSize: 13, color: "var(--color-ink-3)" }}>—</span>;

  const d = target - now;
  if (d <= 0) {
    onLive?.();
    return (
      <span className="tag tag-signal" style={{ fontSize: 11 }}>
        <span className="dot dot-live" /> on sale now
      </span>
    );
  }
  const total = Math.floor(d / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return (
    <span className="num" style={{ fontSize: 14, letterSpacing: "0.02em" }}>
      {h > 0 ? `${pad(h)}:` : ""}
      {pad(m)}:{pad(s)}
    </span>
  );
}
