import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, MONO_FAMILY, GRID } from "../theme";
import { Frame, ease } from "../kit/stage";

// SEGMENT 4 — ARCHITECTURE. Vercel/Next.js → Aurora DSQL (ledger) + Aurora
// PostgreSQL (discovery). Animated data-flow in the editorial-technical style.
const Box: React.FC<{ x: number; y: number; w: number; h: number; title: string; sub: string; o: number; accent?: string; mono?: boolean }> = ({ x, y, w, h, title, sub, o, accent = COLORS.line, mono }) => (
  <g opacity={o} transform={`translate(0 ${(1 - o) * 12})`}>
    <rect x={x} y={y} width={w} height={h} rx={16} fill={COLORS.card} stroke={accent} strokeWidth={1.8} filter="url(#soft)" />
    <rect x={x + 18} y={y} width={w - 36} height={3} rx={1.5} fill={accent} opacity={0.7} />
    <text x={x + w / 2} y={y + h / 2 - 6} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={28} fontWeight={800} letterSpacing={-0.4}>{title}</text>
    <text x={x + w / 2} y={y + h / 2 + 26} textAnchor="middle" fill={COLORS.grayDim} fontFamily={mono ? MONO_FAMILY : FONT_FAMILY} fontSize={18} fontWeight={mono ? 400 : 500}>{sub}</text>
  </g>
);

const Flow: React.FC<{ d: string; o: number; f: number; color?: string; label?: string; lx?: number; ly?: number; dash?: boolean }> = ({ d, o, f, color = COLORS.blue, label, lx, ly, dash }) => (
  <g opacity={o}>
    <path d={d} fill="none" stroke={color} strokeWidth={2.4} strokeDasharray={dash ? "3 9" : "7 11"} strokeDashoffset={-(f * 1.6) % 1000} strokeLinecap="round" opacity={0.9} />
    {label && lx != null && ly != null && (
      <text x={lx} y={ly} textAnchor="middle" fill={COLORS.grayDim} fontFamily={MONO_FAMILY} fontSize={16} fontWeight={500}>{label}</text>
    )}
  </g>
);

export const Architecture: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Frame chapter={3}>
      <text x={GRID.cx} y={230} textAnchor="middle" fill={COLORS.grayDim} fontFamily={MONO_FAMILY} fontSize={26} fontWeight={700} letterSpacing={3} opacity={ease(f, 6, 36)}>ARCHITECTURE · HOW IT FITS TOGETHER</text>
      <text x={GRID.cx} y={296} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={46} fontWeight={800} letterSpacing={-0.5} opacity={ease(f, 16, 52)}>
        Vercel → <tspan fill={COLORS.blue}>Aurora DSQL</tspan> + <tspan fill={COLORS.blue}>Aurora PostgreSQL</tspan>
      </text>

      {/* nodes */}
      <Box x={150} y={470} w={250} h={150} title="Users" sub="organizers · buyers" o={ease(f, 50, 90)} />
      <Box x={560} y={470} w={330} h={150} title="Vercel" sub="Next.js — UI + API" o={ease(f, 80, 120)} accent={COLORS.lineHi} />
      <Box x={1230} y={344} w={540} h={150} title="Aurora DSQL" sub="seat ledger · strong consistency" o={ease(f, 150, 190)} accent={COLORS.blue} mono />
      <Box x={1230} y={596} w={540} h={150} title="Aurora PostgreSQL" sub="discovery · PostGIS + pgvector" o={ease(f, 180, 220)} mono />

      {/* flows */}
      <Flow f={f} o={ease(f, 110, 140)} d="M 400 545 L 555 545" />
      <Flow f={f} o={ease(f, 200, 232)} d="M 890 520 C 1040 520, 1060 419, 1225 419" color={COLORS.blue} label="seat claims · metrics · fairness" lx={1055} ly={452} />
      <Flow f={f} o={ease(f, 230, 262)} d="M 890 570 C 1040 570, 1060 671, 1225 671" color={COLORS.grayDim} label="discovery ranking" lx={1045} ly={700} />
      <Flow f={f} o={ease(f, 280, 312)} d="M 1500 596 L 1500 499" color={COLORS.ok} dash label="join live stock" lx={1610} ly={552} />

      <text x={GRID.cx} y={838} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={30} fontWeight={600} opacity={ease(f, 340, 380)}>
        Strong consistency where the <tspan fill={COLORS.blue} fontWeight={800}>money</tspan> is · geo + vector where <tspan fill={COLORS.blue} fontWeight={800}>discovery</tspan> is.
      </text>
    </Frame>
  );
};
