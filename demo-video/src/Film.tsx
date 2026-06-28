import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import "./font";
import { COLORS } from "./theme";
import { Title } from "./scenes/Title";
import { Problem } from "./scenes/Problem";
import { Databases } from "./scenes/Databases";
import { Architecture } from "./scenes/Architecture";
import { Demo } from "./scenes/Demo";
import { Results } from "./scenes/Results";
import { Subtitles } from "./Subtitles";

// OpenSlot — H0 submission overview, editorial-technical style.
//   Intro        0:00–0:10   frames    0– 300
//   Problem      0:10–0:22   frames  300– 660
//   Databases    0:22–0:48   frames  660–1440   (the required AWS-DB explainer)
//   Architecture 0:48–1:06   frames 1440–1980
//   Live demo    1:06–2:24   frames 1980–4150   (real screen recording, public/demo.mp4)
//   Results      2:24–2:36   frames 4150–4690
const SEG = { title: 300, problem: 360, databases: 780, architecture: 540, demo: 2170, results: 540 };
export const FILM_FRAMES = Object.values(SEG).reduce((a, b) => a + b, 0); // 4690 = 2:36

export const Film: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.paper }}>
    <Sequence from={0} durationInFrames={SEG.title}><Title /></Sequence>
    <Sequence from={300} durationInFrames={SEG.problem}><Problem /></Sequence>
    <Sequence from={660} durationInFrames={SEG.databases}><Databases /></Sequence>
    <Sequence from={1440} durationInFrames={SEG.architecture}><Architecture /></Sequence>
    <Sequence from={1980} durationInFrames={SEG.demo}><Demo /></Sequence>
    <Sequence from={4150} durationInFrames={SEG.results}><Results /></Sequence>

    {/* narration captions (top layer; demo segment stays caption-free) */}
    <Subtitles />
  </AbsoluteFill>
);
