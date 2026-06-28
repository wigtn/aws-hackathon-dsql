import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS, FONT_FAMILY, MONO_FAMILY } from "../theme";
import { Frame, ease, CLAMP } from "../kit/stage";

// SEGMENT 1 — INTRO. Editorial title card: brand lockup, eyebrow, the value
// proposition as the readable hero, a hairline rule, then the AWS hook.
const X = 150;
const TITLE = ["Zero-oversell", "on-sale infrastructure", "for event businesses."];

export const Title: React.FC = () => {
  const f = useCurrentFrame();
  const push = interpolate(f, [0, 130], [1.03, 1], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  const rule = ease(f, 96, 150);

  // faint seat-grid motif on the right (fills space, hann-enveloped)
  const grid = Array.from({ length: 48 }).map((_, k) => {
    const col = k % 8, row = Math.floor(k / 8);
    const x = 1300 + col * 56, y = 300 + row * 56;
    const o = ease(f, 50 + k * 1.5, 96 + k * 1.5) * 0.14;
    const hot = k === 21;
    return <rect key={k} x={x} y={y} width={42} height={42} rx={6} fill="none" stroke={hot ? COLORS.blue : COLORS.line} strokeWidth={hot ? 2.4 : 1.4} opacity={hot ? Math.min(1, o * 5) : o} />;
  });

  return (
    <Frame chapter={0} chapterO={0}>
      <g transform={`translate(960 430) scale(${push}) translate(-960 -430)`}>
        {grid}

        {/* brand lockup */}
        <g opacity={ease(f, 8, 40)}>
          <rect x={X} y={188} width={26} height={26} rx={6} fill={COLORS.blue} />
          <text x={X + 40} y={210} fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={30} fontWeight={800} letterSpacing={-0.5}>OpenSlot</text>
        </g>

        {/* eyebrow */}
        <g opacity={ease(f, 44, 80)}>
          <rect x={X} y={262} width={34} height={3} rx={1.5} fill={COLORS.blue} />
          <text x={X + 48} y={274} fill={COLORS.blue} fontFamily={MONO_FAMILY} fontSize={26} fontWeight={700} letterSpacing={3}>H0 HACKATHON · MONETIZABLE B2B</text>
        </g>

        {/* hero title */}
        {TITLE.map((ln, i) => {
          const o = ease(f, 58 + i * 9, 92 + i * 9);
          return (
            <text key={i} x={X} y={356 + i * 84 + (1 - o) * 22} fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={70} fontWeight={800} letterSpacing={-1} opacity={o}>{ln}</text>
          );
        })}

        {/* hairline rule */}
        <rect x={X} y={650} width={260 * rule} height={3} rx={1.5} fill="url(#brand)" />

        {/* author */}
        <text x={X} y={714} fill={COLORS.grayDim} fontFamily={MONO_FAMILY} fontSize={28} fontWeight={700} letterSpacing={1} opacity={ease(f, 120, 156)}>WIGTN · the on-sale platform for event businesses</text>

        {/* value line */}
        <text x={X} y={784} fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={38} fontWeight={600} opacity={ease(f, 150, 188)}>Run a sold-out on-sale without the disasters.</text>

        {/* AWS hook */}
        <text x={X} y={852} fill={COLORS.grayDim} fontFamily={FONT_FAMILY} fontSize={31} fontWeight={500} opacity={ease(f, 196, 232)}>Built on <tspan fill={COLORS.blue} fontWeight={700}>Amazon Aurora DSQL</tspan> + <tspan fill={COLORS.blue} fontWeight={700}>Aurora PostgreSQL</tspan>.</text>
      </g>
    </Frame>
  );
};
