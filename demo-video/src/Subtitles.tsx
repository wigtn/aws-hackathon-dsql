import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { FONT_FAMILY } from "./theme";

const CLAMP = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

export type NarrationSeg = { id: string; from: number; dur: number; lines: string[] };

// Narration captions (no separate VO track — captions carry the voice). Synced
// to the scene boundaries in Film.tsx. The DEMO segment (D1..D13) is timed to the
// real screen recording so each on-screen moment is named and tied to the story.
export const NARRATION: NarrationSeg[] = [
  { id: "T", from: 70, dur: 200, lines: [
    "OpenSlot is the on-sale platform for event businesses —",
    "run a worldwide rush for the same scarce seat, with zero oversell.",
  ] },
  { id: "P", from: 330, dur: 300, lines: [
    "High-demand on-sales break the same three ways:",
    "oversold seats, bot armies, and crashes at peak.",
    "The root cause — no single source of truth for a seat.",
  ] },
  { id: "DB1", from: 700, dur: 360, lines: [
    "So the seat ledger runs on Amazon Aurora DSQL —",
    "multi-region, active-active, strongly consistent.",
    "A seat is sold exactly once; that's structural, not a promise.",
  ] },
  { id: "DB2", from: 1080, dur: 320, lines: [
    "Discovery runs on a second database — Aurora PostgreSQL,",
    "with PostGIS and pgvector, the extensions DSQL can't host.",
  ] },
  { id: "A", from: 1460, dur: 380, lines: [
    "Vercel and Next.js sit in front.",
    "Aurora DSQL owns the money; Aurora PostgreSQL owns discovery —",
    "and discovery joins live stock from the ledger.",
  ] },

  // ── DEMO captions — synced to the screen recording (segment starts at f1980) ──
  { id: "D1", from: 2000, dur: 100, lines: ["The live product — one running build, no edits."] },
  { id: "D2", from: 2225, dur: 95, lines: ["An organizer opens their on-sale console."] },
  { id: "D3", from: 2360, dur: 150, lines: ["Buyers rush in — seats fill, revenue climbs live."] },
  { id: "D4", from: 2560, dur: 160, lines: ["Zero double-sold · zero failed checkouts · bots blocked."] },
  { id: "D5", from: 2900, dur: 150, lines: ["Sold out — 60 of 60, each seat sold exactly once."] },
  { id: "D6", from: 3060, dur: 120, lines: ["Provably fair — the exact order fans committed."] },
  { id: "D7", from: 3195, dur: 140, lines: ["Buyers find drops near them — that's Aurora PostgreSQL."] },
  { id: "D8", from: 3345, dur: 120, lines: ["Pick a seat, and claim it."] },
  { id: "D9", from: 3490, dur: 150, lines: ["One ticket binds to one verified person and device."] },
  { id: "D10", from: 3670, dur: 120, lines: ["Locked to you in 88 ms — double-booked: never."] },
  { id: "D11", from: 3800, dur: 120, lines: ["A gate code rotates every 30s — a screenshot is useless."] },
  { id: "D12", from: 3950, dur: 90, lines: ["The stress test — 2,000 buyers across two regions."] },
  { id: "D13", from: 4045, dur: 100, lines: ["Oversold: zero. Structural — not a promise."] },

  { id: "R", from: 4230, dur: 420, lines: [
    "Only a strongly-consistent, multi-region ledger does all five.",
    "Zero oversell, provably fair, on the line everyone already has.",
    "OpenSlot — sell out, safely.",
  ] },
];

type Cue = { from: number; to: number; text: string };
const CUES: Cue[] = NARRATION.flatMap((s) => {
  const total = s.lines.reduce((a, l) => a + l.length, 0);
  let t = s.from;
  return s.lines.map((text, i) => {
    const from = t;
    const to = i === s.lines.length - 1 ? s.from + s.dur : Math.round(t + (s.dur * text.length) / total);
    t = to;
    return { from, to, text };
  });
});

export const Subtitles: React.FC = () => {
  const f = useCurrentFrame();
  const cue = CUES.find((c) => f >= c.from && f < c.to);
  if (!cue) return null;
  const fade = Math.min(
    interpolate(f, [cue.from, cue.from + 5], [0, 1], CLAMP),
    interpolate(f, [cue.to - 6, cue.to], [1, 0], CLAMP)
  );
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", pointerEvents: "none" }}>
      <div style={{ marginBottom: 60, maxWidth: 1480, opacity: fade, transform: `translateY(${(1 - fade) * 8}px)`, textAlign: "center" }}>
        <span style={{ display: "inline", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", background: "rgba(8,10,14,0.66)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 24px", color: "#F4F7FB", fontFamily: FONT_FAMILY, fontSize: 38, fontWeight: 600, lineHeight: 1.5, letterSpacing: -0.2, boxShadow: "0 10px 30px rgba(0,0,0,0.45)" }}>
          {cue.text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
