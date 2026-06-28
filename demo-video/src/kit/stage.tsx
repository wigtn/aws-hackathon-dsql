import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, MONO_FAMILY } from "../theme";

/* ============================================================================
 * WIGVO film — shared design system (rebuild).
 *
 * Layout contract (1920×1080) — strictly non-overlapping zones:
 *   • CHROME top-left  : eyebrow chip          y 50–88,  x 120…
 *   • CHROME top-right : chapter stepper        y 50–88,  …x 1800
 *   • STAGE (scene art): y [140 … 905], x [100 … 1820]   ← scenes draw ONLY here
 *   • CHROME bottom    : caption lower-third     y 942–1016 (centered)
 * Every scene composes inside STAGE; chrome lives outside it. No overlaps.
 * ==========================================================================*/

export const Z = {
  stageTop: 140,
  stageBottom: 905,
  cx: 960,
} as const;

/**
 * v2.2 layout discipline — fixed grid + reserved zones (px on 1920×1080).
 * Elements must stay inside their zone; reserved zones never overlap.
 *   MAIN   : the card/architecture stage. Full-height beats may use to `mainFull`.
 *   STRIP  : the bottom principle strip (only on beats that explain a principle).
 *   HEAD   : the talking-head corner — RESERVED, nothing else enters.
 *   LOWER  : demo-only lower-third band (gate state / labels).
 */
export const ZONES = {
  margin: 96,
  mainTop: 96,
  mainBottom: 700,
  mainFull: 984,
  strip: { top: 720, bottom: 984, left: 96, right: 1440 },
  head: { left: 1480, right: 1824, top: 720, bottom: 984 },
  lower: { top: 900, bottom: 984 },
} as const;

// ---- motion ----------------------------------------------------------------
export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const OUT = Easing.bezier(0.16, 1, 0.3, 1); // crisp UI ease-out
export const INOUT = Easing.bezier(0.65, 0, 0.35, 1);

/** eased 0..1 reveal between frames a..b */
export const ease = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], { ...CLAMP, easing: OUT });
/** linear 0..1 progress */
export const seg = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], CLAMP);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** ease in, hold, ease out — for cross-fading captions/beats */
export const beat = (f: number, start: number, hold: number, fade = 14) =>
  Math.max(
    0,
    Math.min(
      interpolate(f, [start, start + fade], [0, 1], { ...CLAMP, easing: OUT }),
      interpolate(f, [start + fade + hold, start + fade + hold + fade], [1, 0], {
        ...CLAMP,
        easing: Easing.in(Easing.cubic),
      })
    )
  );
/** continuous gentle idle bob */
export const bob = (f: number, amp = 4, speed = 0.05, phase = 0) =>
  Math.sin(f * speed + phase) * amp;

// ---- background ------------------------------------------------------------
/** Shared defs (grid, vignette, glow, shadow, signature gradient). */
export const Defs: React.FC = () => (
  <defs>
    <radialGradient id="topglow" cx="50%" cy="-6%" r="70%">
      <stop offset="0%" stopColor="#151B26" stopOpacity="0.45" />
      <stop offset="60%" stopColor="#0C0E12" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="vignette" cx="50%" cy="44%" r="76%">
      <stop offset="58%" stopColor="#000000" stopOpacity="0" />
      <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
    </radialGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor={COLORS.sessionB} />
      <stop offset="100%" stopColor={COLORS.accentHi} />
    </linearGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="6" stdDeviation="14" floodColor="#000000" floodOpacity="0.3" />
    </filter>
    <filter id="glow" x="-150%" y="-150%" width="400%" height="400%">
      <feGaussianBlur stdDeviation="3" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
);

const CHAPTERS = ["INTRO", "PROBLEM", "DATABASES", "ARCHITECTURE", "DEMO", "RESULTS"];

/** Top-right chapter stepper — five bars, active one lit & widened. */
const ChapterRail: React.FC<{ active: number; o: number }> = ({ active, o }) => {
  const right = 1800;
  const widths = CHAPTERS.map((_, i) => (i === active ? 56 : 26));
  const gap = 12;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (CHAPTERS.length - 1);
  let x = right - total;
  const bars: React.ReactNode[] = [];
  const label = CHAPTERS[active] ?? "";
  CHAPTERS.forEach((_, i) => {
    const w = widths[i];
    const on = i <= active;
    bars.push(
      <rect key={i} x={x} y={70} width={w} height={6} rx={3}
        fill={i === active ? "url(#brand)" : on ? COLORS.grayDim : COLORS.line} />
    );
    x += w + gap;
  });
  return (
    <g opacity={o}>
      <text x={right - total - 18} y={77} textAnchor="end" fill={COLORS.grayDim}
        fontFamily={MONO_FAMILY} fontSize={22} fontWeight={700} letterSpacing={3}>
        {String(active + 1).padStart(2, "0")} · {label}
      </text>
      {bars}
    </g>
  );
};

/** Top-left eyebrow chip. */
export const Eyebrow: React.FC<{ text: string; o?: number; dot?: string }> = ({
  text,
  o = 1,
  dot = COLORS.sessionA,
}) => (
  <g opacity={o}>
    <circle cx={129} cy={70} r={7} fill={dot} />
    <text x={148} y={78} fill={COLORS.grayDim} fontFamily={MONO_FAMILY} fontSize={22}
      fontWeight={700} letterSpacing={3}>
      {text}
    </text>
  </g>
);

/** Bottom lower-third caption (single source of bottom text — own zone). */
export const Caption: React.FC<{ text: string; o?: number; color?: string; sub?: string }> = ({
  text,
  o = 1,
  color = COLORS.ink,
  sub,
}) => (
  <g opacity={o}>
    <rect x={Z.cx - 3} y={948} width={6} height={0} />
    <text x={Z.cx} y={sub ? 980 : 992} textAnchor="middle" fill={color}
      fontFamily={FONT_FAMILY} fontSize={34} fontWeight={700}>
      {text}
    </text>
    {sub && (
      <text x={Z.cx} y={1010} textAnchor="middle" fill={COLORS.gray}
        fontFamily={FONT_FAMILY} fontSize={21} fontWeight={500}>
        {sub}
      </text>
    )}
  </g>
);

/**
 * Frame — full-frame dark stage with chrome. Scenes render SVG children which
 * MUST stay within the STAGE zone (y 140…905). Chrome (eyebrow / chapter /
 * caption) is drawn by the scene via the exported atoms in their own zones.
 */
export const Frame: React.FC<{
  chapter: number;
  chapterO?: number;
  children: React.ReactNode;
}> = ({ chapter, chapterO = 1, children }) => (
  <AbsoluteFill style={{ backgroundColor: COLORS.paper, fontFamily: FONT_FAMILY }}>
    <svg width={1920} height={1080} viewBox="0 0 1920 1080">
      <Defs />
      <rect x={0} y={0} width={1920} height={1080} fill={COLORS.paper} />
      <rect x={0} y={0} width={1920} height={1080} fill="url(#topglow)" />
      {children}
      <rect x={0} y={0} width={1920} height={1080} fill="url(#vignette)" pointerEvents="none" />
      <ChapterRail active={chapter} o={chapterO} />
    </svg>
  </AbsoluteFill>
);

// ---- atoms -----------------------------------------------------------------
/** A rounded pill/tag with optional accent dot. */
export const Pill: React.FC<{
  x: number; y: number; w: number; h?: number; text: string;
  color?: string; fill?: string; dot?: string; size?: number; o?: number; anchor?: "start" | "middle";
}> = ({ x, y, w, h = 44, text, color = COLORS.ink, fill = COLORS.card, dot, size = 22, o = 1, anchor = "middle" }) => (
  <g opacity={o}>
    <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} stroke={COLORS.line} strokeWidth={1.4} />
    {dot && <circle cx={x + 22} cy={y + h / 2} r={6} fill={dot} />}
    <text x={anchor === "middle" ? x + w / 2 : x + (dot ? 40 : 22)} y={y + h / 2 + size * 0.34}
      textAnchor={anchor} fill={color} fontFamily={MONO_FAMILY} fontSize={size} fontWeight={700}>
      {text}
    </text>
  </g>
);

/** Titled card panel with optional clip region (chart-safe). */
export const Card: React.FC<{
  x: number; y: number; w: number; h: number; title?: string;
  accent?: string; o?: number; clipId?: string; pad?: number; titleSize?: number;
}> = ({ x, y, w, h, title, accent = COLORS.line, o = 1, clipId, pad = 16, titleSize = 22 }) => {
  const head = title ? 52 : pad;
  return (
    <g opacity={o}>
      {clipId && (
        <clipPath id={clipId}>
          <rect x={x + pad} y={y + head} width={w - 2 * pad} height={h - head - pad} rx={10} />
        </clipPath>
      )}
      <rect x={x} y={y} width={w} height={h} rx={18} fill={COLORS.card} stroke={accent}
        strokeWidth={1.6} filter="url(#soft)" />
      <rect x={x + 20} y={y} width={w - 40} height={3} rx={1.5} fill={accent} opacity={0.7} />
      {title && (
        <>
          <text x={x + 26} y={y + 35} fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={titleSize} fontWeight={700}>
            {title}
          </text>
          <line x1={x + 24} y1={y + 50} x2={x + w - 24} y2={y + 50} stroke={COLORS.line} strokeWidth={1.2} />
        </>
      )}
    </g>
  );
};

/** Big kinetic headline word-by-word (within stage). cx-anchored. */
export const Headline: React.FC<{
  lines: string[]; f: number; start: number; cx?: number; y: number;
  size?: number; weight?: number; color?: string; lh?: number; stagger?: number;
}> = ({ lines, f, start, cx = Z.cx, y, size = 60, weight = 800, color = COLORS.ink, lh = 1.16, stagger = 7 }) => (
  <>
    {lines.map((ln, i) => {
      const o = ease(f, start + i * stagger, start + i * stagger + 18);
      const dy = (1 - o) * 26;
      return (
        <text key={i} x={cx} y={y + i * size * lh + dy} textAnchor="middle" fill={color}
          fontFamily={FONT_FAMILY} fontSize={size} fontWeight={weight} opacity={o}
          letterSpacing={-0.5}>
          {ln}
        </text>
      );
    })}
  </>
);

/** Person / phone / browser glyph in a soft disc. */
export const Glyph: React.FC<{
  x: number; y: number; kind: "user" | "phone" | "browser"; r?: number;
  label?: string; sub?: string; o?: number; accent?: string;
}> = ({ x, y, kind, r = 50, label, sub, o = 1, accent = COLORS.ink }) => (
  <g opacity={o}>
    <circle cx={x} cy={y} r={r} fill={COLORS.card} stroke={COLORS.line} strokeWidth={2} filter="url(#soft)" />
    {kind === "user" && (
      <>
        <circle cx={x} cy={y - 12} r={14} fill="none" stroke={accent} strokeWidth={3.2} />
        <path d={`M ${x - 23} ${y + 24} a 23 20 0 0 1 46 0`} fill="none" stroke={accent} strokeWidth={3.2} />
      </>
    )}
    {kind === "phone" && (
      <rect x={x - 16} y={y - 26} width={32} height={52} rx={7} fill="none" stroke={accent} strokeWidth={3.2} />
    )}
    {kind === "browser" && (
      <>
        <rect x={x - 24} y={y - 20} width={48} height={40} rx={6} fill="none" stroke={accent} strokeWidth={3.2} />
        <line x1={x - 24} y1={y - 8} x2={x + 24} y2={y - 8} stroke={accent} strokeWidth={3.2} />
      </>
    )}
    {label && (
      <text x={x} y={y + r + 34} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT_FAMILY} fontSize={24} fontWeight={700}>
        {label}
      </text>
    )}
    {sub && (
      <text x={x} y={y + r + 60} textAnchor="middle" fill={COLORS.gray} fontFamily={FONT_FAMILY} fontSize={18}>
        {sub}
      </text>
    )}
  </g>
);
