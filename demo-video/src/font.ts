import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";

// Load once at module import so all scenes share the same fontFamily handle.
// Only the weights/subset we actually use — keeps render fast.
export const inter = loadInter("normal", {
  weights: ["500", "600", "700", "800"],
  subsets: ["latin"],
});
export const mono = loadMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});
