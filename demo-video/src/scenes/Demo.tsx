import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, interpolate } from "remotion";
import { COLORS, MONO_FAMILY } from "../theme";
import { CLAMP } from "../kit/stage";

// SEGMENT 5 — LIVE SYSTEM. Real screen recording of the running app
// (public/demo.mp4 — 2170 frames @ 30fps ≈ 72.2s). Plays full-bleed with a
// short fade in/out and a LIVE badge that retires after the intro beat.
const DEMO_FRAMES = 2170;

export const Demo: React.FC = () => {
  const f = useCurrentFrame();
  const op = Math.min(
    interpolate(f, [0, 12], [0, 1], CLAMP),
    interpolate(f, [DEMO_FRAMES - 12, DEMO_FRAMES], [1, 0], CLAMP)
  );
  const badge = interpolate(f, [0, 16, 90, 120], [0, 1, 1, 0], CLAMP);
  return (
    <AbsoluteFill style={{ background: COLORS.black }}>
      <AbsoluteFill style={{ opacity: op, alignItems: "center", justifyContent: "center" }}>
        <OffthreadVideo
          src={staticFile("demo.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </AbsoluteFill>

      {/* LIVE badge — fades out once the recording is rolling */}
      <div style={{ position: "absolute", left: 44, top: 40, display: "flex", alignItems: "center", gap: 10, background: "#00000088", borderRadius: 10, padding: "10px 16px", opacity: badge }}>
        <div style={{ width: 11, height: 11, borderRadius: 6, background: COLORS.red, boxShadow: `0 0 10px ${COLORS.red}` }} />
        <span style={{ color: COLORS.ink, fontFamily: MONO_FAMILY, fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>LIVE SYSTEM — RUNNING BUILD</span>
      </div>
    </AbsoluteFill>
  );
};
