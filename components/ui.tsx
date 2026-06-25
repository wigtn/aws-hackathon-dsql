// Server-safe presentational primitive. (The legacy Stat/Tag/Meter/etc. were
// removed with the poster migration; only Eyebrow remains, used by the
// organizer create-drop modal.)
import { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}
