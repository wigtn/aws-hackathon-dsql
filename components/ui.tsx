// Server-safe presentational primitives. The vocabulary of the whole product:
// stats, tags, labels, hairline rules. Numbers always render in tabular mono.
import { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

export function Stat({
  label,
  value,
  unit,
  tone = "ink",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: "ink" | "signal" | "affirm" | "hold";
}) {
  const color =
    tone === "signal"
      ? "var(--color-signal)"
      : tone === "affirm"
        ? "var(--color-affirm)"
        : tone === "hold"
          ? "var(--color-hold)"
          : "var(--color-ink)";
  return (
    <div className="panel" style={{ padding: "14px 16px" }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <div className="num" style={{ fontSize: 30, lineHeight: 1, color }}>
        {value}
        {unit ? (
          <span style={{ fontSize: 13, color: "var(--color-ink-3)", marginLeft: 4 }}>
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function Tag({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "signal" | "affirm" | "hold" | "solid";
}) {
  const cls =
    tone === "signal"
      ? "tag tag-signal"
      : tone === "affirm"
        ? "tag tag-affirm"
        : tone === "hold"
          ? "tag tag-hold"
          : tone === "solid"
            ? "tag tag-solid"
            : "tag";
  return <span className={cls}>{children}</span>;
}

export function LiveDot() {
  return <span className="dot dot-live" />;
}

export function KV({ k, v, mono = true }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div
      className="flex items-baseline justify-between"
      style={{ padding: "7px 0", borderBottom: "1px solid var(--color-line)" }}
    >
      <span className="eyebrow">{k}</span>
      <span className={mono ? "num" : ""} style={{ fontSize: 13, color: "var(--color-ink)" }}>
        {v}
      </span>
    </div>
  );
}

export function Meter({ value, max, hot }: { value: number; max: number; hot?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`meter${hot ? " is-hot" : ""}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PlaneBadge({ plane }: { plane: "dsql" | "postgres" }) {
  return (
    <Tag tone={plane === "dsql" ? "solid" : "default"}>
      {plane === "dsql" ? "Aurora DSQL" : "Aurora PostgreSQL"}
    </Tag>
  );
}
