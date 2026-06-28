import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT_FAMILY, MONO_FAMILY, GRID } from "../theme";
import { Frame, ease, Card, Pill, CLAMP } from "../kit/stage";

// SEGMENT 3 — THE AWS DATABASES (required). Two engines, one job each:
// Aurora DSQL = the strongly-consistent multi-region seat ledger (zero oversell);
// Aurora PostgreSQL = discovery (PostGIS geo + pgvector semantic).
const DSQL = [
  ["Multi-region, active-active", "us-east-1 + us-east-2 both take reads AND writes"],
  ["Strongly consistent", "one global commit order across regions"],
  ["Zero oversell — structural", "conflicts surface as OC000 and retry; never a double-sell"],
];

const RegionNode: React.FC<{ x: number; y: number; label: string; sub: string; o: number }> = ({ x, y, label, sub, o }) => (
  <g opacity={o}>
    <rect x={x} y={y} width={300} height={78} rx={12} fill={COLORS.cardHi} stroke={COLORS.blue} strokeWidth={1.6} />
    <text x={x + 150} y={y + 34} textAnchor="middle" fill={COLORS.ink} fontFamily={MONO_FAMILY} fontSize={22} fontWeight={700}>{label}</text>
    <text x={x + 150} y={y + 60} textAnchor="middle" fill={COLORS.grayDim} fontFamily={MONO_FAMILY} fontSize={15}>{sub}</text>
  </g>
);

export const Databases: React.FC = () => {
  const f = useCurrentFrame();
  const pulse = interpolate(f % 60, [0, 30, 60], [0.35, 1, 0.35], CLAMP);
  return (
    <Frame chapter={2}>
      <text x={GRID.cx} y={220} textAnchor="middle" fill={COLORS.grayDim} fontFamily={MONO_FAMILY} fontSize={26} fontWeight={700} letterSpacing={3} opacity={ease(f, 6, 36)}>THE AWS DATABASES — AND WHY TWO</text>
      <text x={GRID.cx} y={284} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={48} fontWeight={800} letterSpacing={-0.5} opacity={ease(f, 16, 52)}>
        One job each. <tspan fill={COLORS.blue}>Only AWS can do both.</tspan>
      </text>

      {/* ---- Database 1 — Aurora DSQL ---- */}
      <g opacity={ease(f, 48, 88)}>
        <Card x={150} y={324} w={1620} h={332} accent={COLORS.blue} o={1} />
        <Pill x={186} y={356} w={344} h={40} text="DATABASE 1 · THE SEAT LEDGER" fill={COLORS.cardHi} color={COLORS.accentHi} size={17} />
        <text x={186} y={452} fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={44} fontWeight={800} letterSpacing={-0.5}>Amazon Aurora DSQL</text>
        {DSQL.map((r, i) => {
          const o = ease(f, 96 + i * 16, 134 + i * 16), y = 506 + i * 54;
          return (
            <g key={i} opacity={o}>
              <circle cx={196} cy={y - 7} r={5} fill={COLORS.ok} />
              <text x={216} y={y} fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={24} fontWeight={700}>{r[0]}</text>
              <text x={216} y={y + 25} fill={COLORS.grayDim} fontFamily={MONO_FAMILY} fontSize={17}>{r[1]}</text>
            </g>
          );
        })}
        {/* region diagram (right) */}
        <RegionNode x={1240} y={360} label="us-east-1" sub="N. Virginia · read + write" o={ease(f, 150, 188)} />
        <text x={1390} y={466} textAnchor="middle" fill={COLORS.accentHi} fontFamily={MONO_FAMILY} fontSize={16} opacity={pulse}>[ one logical DB ]</text>
        <RegionNode x={1240} y={486} label="us-east-2" sub="Ohio · read + write" o={ease(f, 168, 206)} />
      </g>

      {/* ---- Database 2 — Aurora PostgreSQL ---- */}
      <g opacity={ease(f, 360, 404)}>
        <Card x={150} y={664} w={1620} h={200} accent={COLORS.line} o={1} />
        <Pill x={186} y={696} w={300} h={40} text="DATABASE 2 · DISCOVERY" fill={COLORS.cardHi} color={COLORS.grayDim} size={17} />
        <text x={186} y={792} fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={40} fontWeight={800} letterSpacing={-0.5}>Amazon Aurora PostgreSQL</text>
        <text x={186} y={832} fill={COLORS.grayDim} fontFamily={MONO_FAMILY} fontSize={19}>PostGIS (geo radius) + pgvector (semantic) — extensions DSQL can&apos;t host. So fans find drops near them.</text>
        <g opacity={ease(f, 410, 448)}>
          <rect x={1300} y={700} width={210} height={120} rx={14} fill={COLORS.cardHi} stroke={COLORS.line} strokeWidth={1.4} />
          <text x={1405} y={752} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={24} fontWeight={800}>PostGIS</text>
          <text x={1405} y={784} textAnchor="middle" fill={COLORS.grayDim} fontFamily={MONO_FAMILY} fontSize={16}>geo radius</text>
          <rect x={1540} y={700} width={210} height={120} rx={14} fill={COLORS.cardHi} stroke={COLORS.line} strokeWidth={1.4} />
          <text x={1645} y={752} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={24} fontWeight={800}>pgvector</text>
          <text x={1645} y={784} textAnchor="middle" fill={COLORS.grayDim} fontFamily={MONO_FAMILY} fontSize={16}>semantic</text>
        </g>
      </g>
    </Frame>
  );
};
