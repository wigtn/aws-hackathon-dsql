import { Composition } from "remotion";
import { Film, FILM_FRAMES } from "./Film";
import { FPS, HEIGHT, WIDTH } from "./theme";

export const Root: React.FC = () => {
  return (
    <Composition
      id="OpenSlotDemo"
      component={Film}
      durationInFrames={FILM_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
