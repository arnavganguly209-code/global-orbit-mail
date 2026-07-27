"use client";

import * as React from "react";

/** Purpose-built breakpoints — not a single fluid stack. */
export type OrbitLayoutMode = "mobile" | "tablet" | "laptop" | "desktop";

function resolveMode(width: number): OrbitLayoutMode {
  if (width < 768) return "mobile";
  if (width < 1100) return "tablet";
  if (width < 1440) return "laptop";
  return "desktop";
}

/** null until mounted — avoids wrong layout + white flash. */
export function useLayoutMode(): OrbitLayoutMode | null {
  const [mode, setMode] = React.useState<OrbitLayoutMode | null>(null);

  React.useEffect(() => {
    const sync = () => setMode(resolveMode(window.innerWidth));
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return mode;
}
