/**
 * WIGVO ACL 2026 — design system (rebuild v3, "editorial-technical").
 *
 * One cohesive, near-monochrome cool-neutral system with a SINGLE primary accent
 * (slate blue). Structure is neutral; colour means something only when it must:
 *   • slate blue  = the system / the fix / the positive path / emphasis
 *   • muted red   = the echo problem ONLY (used rarely)
 *   • gold        = a single rare highlight (cost / threshold)
 * Surfaces are flat with hairline borders (no neon, minimal shadow). Everything
 * snaps to an 8-px spacing scale and a 120-px margin grid for harmonious layout.
 */
export const COLORS = {
  paper: "#0C0E12", // canvas
  card: "#14171D", // surface
  cardHi: "#191D25", // elevated surface
  white: "#14171D", // legacy alias
  black: "#05070A",
  ink: "#ECEFF4", // text — high
  grayDim: "#A2AAB8", // text — mid
  gray: "#69707E", // text — low
  line: "#262A33", // hairline border / divider
  lineHi: "#333A45", // stronger divider
  // accents — clear semantics: blue = system/info, GREEN = positive, RED = negative
  sessionB: "#5E97D6", // primary blue — system / info / the relay path
  blue: "#5E97D6",
  accentHi: "#8FBAF0", // brighter blue for key emphasis
  ok: "#40BC88", // GREEN — positive / success / pass / "it works"
  green: "#40BC88",
  sessionA: "#E05D58", // RED — negative / problem / failure (echo, blocked, fails)
  red: "#E05D58",
  amber: "#D9A43E", // gold — caution / cost highlight
  cyan: "#5E97D6", // folded into the blue
  // soft shaded regions
  faint: "#141A24",
  faintR: "#1E1518",
  // waveform panel
  audBg: "#0E1218",
  audGrid: "#1E2530",
  audNum: "#69788A",
} as const;

// 8-px spacing scale and a 120-px margin grid — every layout snaps to these.
export const SP = { x1: 8, x2: 16, x3: 24, x4: 32, x5: 48, x6: 64, x7: 96 } as const;
export const GRID = { margin: 120, left: 120, right: 1800, width: 1680, cx: 960 } as const;
// type scale (px) — use these, not ad-hoc sizes.
export const TYPE = { display: 60, h1: 46, h2: 34, h3: 26, body: 22, cap: 18, micro: 14 } as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const FONT_FAMILY = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const MONO_FAMILY = '"Roboto Mono", "SF Mono", ui-monospace, "Cascadia Code", monospace';

export const SNAP = { damping: 200, stiffness: 120, mass: 0.6 };
export const SOFT = { damping: 200, stiffness: 60, mass: 1 };
