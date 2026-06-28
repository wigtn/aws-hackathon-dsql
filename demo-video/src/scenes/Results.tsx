import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, MONO_FAMILY, GRID } from "../theme";
import { Frame, ease, clamp01 } from "../kit/stage";

// SEGMENT 6 — RESULTS & CLOSE. A capability matrix lands the point: only a
// strongly-consistent multi-region ledger (Aurora DSQL) + Postgres discovery
// does all five. Then four count-up metrics, then the close.
const CAPS = ["Multi-region\nwrites", "Strong\nconsistency", "Zero\noversell", "Provably\nfair", "Geo + vector\ndiscovery"];
const SYS = [
  { name: "Aurora Global DB · async", caps: [0, 0, 0, 0, 1] },
  { name: "Single-region SQL", caps: [0, 1, 1, 1, 1] },
  { name: "Sharded by region", caps: [1, 0, 0, 0, 0] },
  { name: "OpenSlot · DSQL + Postgres", caps: [1, 1, 1, 1, 1], us: true },
];
const METRICS = [
  { fmt: () => "0", sub: "oversold · structural", col: COLORS.ok },
  { fmt: (p: number) => `${(99.999 * p).toFixed(3)}%`, sub: "multi-region availability", col: COLORS.blue },
  { fmt: (p: number) => `${Math.round(20 * p)} ms`, sub: "p50 seat-claim commit", col: COLORS.blue },
  { fmt: (p: number) => `${Math.round(1 * p)} / 800`, sub: "exactly one winner", col: COLORS.ok },
];
const NX = 150;
const COLX = (i: number) => 760 + i * 212 + 106;

const Check: React.FC<{ x: number; y: number; o: number }> = ({ x, y, o }) => (
  <g opacity={o} transform={`translate(${x} ${y}) scale(${0.6 + 0.4 * o})`}>
    <path d="M -9 0 l 6 7 l 13 -15" fill="none" stroke={COLORS.ok} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </g>
);
const Cross: React.FC<{ x: number; y: number; o: number }> = ({ x, y, o }) => (
  <g opacity={o * 0.5} transform={`translate(${x} ${y})`} stroke={COLORS.gray} strokeWidth={2.6} strokeLinecap="round">
    <line x1={-7} y1={-7} x2={7} y2={7} /><line x1={7} y1={-7} x2={-7} y2={7} />
  </g>
);

export const Results: React.FC = () => {
  const f = useCurrentFrame();
  const out = clamp01(1 - ease(f, 384, 414));
  const closeIn = ease(f, 396, 440);
  const HY = 268, RH = 46;

  return (
    <Frame chapter={5}>
      <text x={GRID.cx} y={150} textAnchor="middle" fill={COLORS.grayDim} fontFamily={MONO_FAMILY} fontSize={26} fontWeight={700} letterSpacing={3} opacity={ease(f, 6, 36)}>RESULTS</text>
      <text x={GRID.cx} y={212} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={46} fontWeight={800} letterSpacing={-0.5} opacity={ease(f, 16, 52)}>
        Only one stack does <tspan fill={COLORS.blue}>all five.</tspan>
      </text>

      <g opacity={out}>
        {/* column headers */}
        {CAPS.map((c, i) => (
          <text key={i} x={COLX(i)} y={HY} textAnchor="middle" fill={COLORS.grayDim} fontFamily={MONO_FAMILY} fontSize={17} fontWeight={700} opacity={ease(f, 40, 70)}>
            {c.split("\n").map((ln, k) => <tspan key={k} x={COLX(i)} dy={k === 0 ? 0 : 20}>{ln}</tspan>)}
          </text>
        ))}
        {SYS.map((s, r) => {
          const ry = HY + 64 + r * RH;
          const rowO = ease(f, 48 + r * 16, 84 + r * 16);
          return (
            <g key={r}>
              {s.us && <rect x={130} y={ry - RH / 2} width={1660} height={RH} rx={12} fill={COLORS.blue} fillOpacity={0.08 * ease(f, 150, 196)} stroke={COLORS.blue} strokeWidth={1.6} strokeOpacity={0.8 * ease(f, 150, 196)} />}
              <text x={NX} y={ry + 7} fill={s.us ? COLORS.accentHi : COLORS.grayDim} fontFamily={FONT_FAMILY} fontSize={s.us ? 25 : 21} fontWeight={s.us ? 800 : 600} opacity={rowO}>{s.name}</text>
              {s.caps.map((on, i) => {
                const co = s.us ? ease(f, 152 + i * 13, 182 + i * 13) : rowO;
                return on ? <Check key={i} x={COLX(i)} y={ry} o={co} /> : <Cross key={i} x={COLX(i)} y={ry} o={co} />;
              })}
            </g>
          );
        })}

        {/* four count-up metrics */}
        {METRICS.map((m, i) => {
          const W = 388, G = 40, x0 = (1920 - (W * 4 + G * 3)) / 2, x = x0 + i * (W + G), o = ease(f, 250 + i * 12, 294 + i * 12);
          const cp = ease(f, 256 + i * 8, 320 + i * 8);
          return (
            <g key={i} opacity={o} transform={`translate(0 ${(1 - o) * 14})`}>
              <rect x={x} y={636} width={W} height={120} rx={16} fill={COLORS.card} stroke={COLORS.line} strokeWidth={1.4} filter="url(#soft)" />
              <text x={x + 28} y={698} fill={m.col} fontFamily={FONT_FAMILY} fontSize={48} fontWeight={800} letterSpacing={-1}>{m.fmt(cp)}</text>
              <text x={x + 28} y={732} fill={COLORS.grayDim} fontFamily={FONT_FAMILY} fontSize={20} fontWeight={500}>{m.sub}</text>
            </g>
          );
        })}
        <text x={GRID.cx} y={820} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={26} fontWeight={600} opacity={ease(f, 300, 340)}>
          Hash-chained in one global commit order — <tspan fill={COLORS.blue} fontWeight={800}>provably fair</tspan>. Async multi-region can&apos;t.
        </text>
      </g>

      {/* close */}
      <g opacity={closeIn} transform={`translate(0 ${(1 - closeIn) * 18})`}>
        <g opacity={closeIn}>
          <rect x={GRID.cx - 17} y={300} width={34} height={34} rx={8} fill={COLORS.blue} />
          <text x={GRID.cx + 32} y={328} fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={44} fontWeight={800} textAnchor="start" transform={`translate(-${0})`}>OpenSlot</text>
        </g>
        <text x={GRID.cx} y={446} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={74} fontWeight={800} letterSpacing={-1}>Sell out — <tspan fill={COLORS.blue}>safely.</tspan></text>
        <text x={GRID.cx} y={520} textAnchor="middle" fill={COLORS.grayDim} fontFamily={MONO_FAMILY} fontSize={26} fontWeight={500}>the on-sale platform for event businesses</text>
        <text x={GRID.cx} y={588} textAnchor="middle" fill={COLORS.blue} fontFamily={MONO_FAMILY} fontSize={24} fontWeight={700}>Amazon Aurora DSQL  +  Aurora PostgreSQL</text>
        <text x={GRID.cx} y={648} textAnchor="middle" fill={COLORS.gray} fontFamily={MONO_FAMILY} fontSize={20} fontWeight={500}>github.com/wigtn/aws-hackathon-dsql</text>
      </g>
    </Frame>
  );
};
