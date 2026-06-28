import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, MONO_FAMILY, GRID } from "../theme";
import { Frame, ease, Card } from "../kit/stage";

// SEGMENT 2 — PROBLEM. The three ways a high-demand on-sale breaks. Red is used
// ONLY here (the problem). Three flat cards, staggered in.
const ITEMS = [
  { n: "01", t: "Oversold seats", s: "two buyers, one seat — refunds, chargebacks, furious fans" },
  { n: "02", t: "Bot armies", s: "scripts sweep the inventory; real fans never get in" },
  { n: "03", t: "Crashes at peak", s: "the on-sale falls over the instant the world shows up" },
];

export const Problem: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Frame chapter={1}>
      <text x={GRID.cx} y={250} textAnchor="middle" fill={COLORS.grayDim} fontFamily={MONO_FAMILY} fontSize={26} fontWeight={700} letterSpacing={3} opacity={ease(f, 6, 36)}>PROBLEM</text>
      <text x={GRID.cx} y={320} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={50} fontWeight={800} letterSpacing={-0.5} opacity={ease(f, 16, 52)}>
        High-demand on-sales break the <tspan fill={COLORS.red}>same three ways.</tspan>
      </text>

      {ITEMS.map((it, i) => {
        const W = 520, G = 38, x0 = (1920 - (W * 3 + G * 2)) / 2, x = x0 + i * (W + G), y = 420;
        const o = ease(f, 48 + i * 16, 90 + i * 16);
        return (
          <g key={i} opacity={o} transform={`translate(0 ${(1 - o) * 16})`}>
            <Card x={x} y={y} w={W} h={260} accent={COLORS.line} o={1} />
            <circle cx={x + 36} cy={y + 50} r={8} fill={COLORS.red} />
            <text x={x + 60} y={y + 58} fill={COLORS.gray} fontFamily={MONO_FAMILY} fontSize={24} fontWeight={700} letterSpacing={2}>{it.n}</text>
            <text x={x + 34} y={y + 132} fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={40} fontWeight={800} letterSpacing={-0.5}>{it.t}</text>
            <text x={x + 34} y={y + 184} fill={COLORS.grayDim} fontFamily={FONT_FAMILY} fontSize={23} fontWeight={500}>
              <tspan x={x + 34} dy={0}>{it.s.length > 38 ? it.s.slice(0, it.s.lastIndexOf(" ", 38)) : it.s}</tspan>
              {it.s.length > 38 && <tspan x={x + 34} dy={30}>{it.s.slice(it.s.lastIndexOf(" ", 38) + 1)}</tspan>}
            </text>
          </g>
        );
      })}

      <text x={GRID.cx} y={780} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={32} fontWeight={600} opacity={ease(f, 150, 188)}>
        The root cause is the same: <tspan fill={COLORS.blue} fontWeight={800}>no single source of truth for a seat.</tspan>
      </text>
    </Frame>
  );
};
