import * as React from "react";

// Lightweight client-side gate for research/training pages. Not real auth —
// avoids the full Supabase auth scaffold. The passphrase can be shared with
// the research team; regular users never see the training UI.

const STORAGE_KEY = "cycloscope.researcher_mode";
const PASSPHRASE = "cycloscope-team";

type Ctx = {
  isResearcher: boolean;
  unlock: () => void;
  lock: () => void;
};

const ResearcherContext = React.createContext<Ctx | null>(null);

function readInitial(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(STORAGE_KEY) === "on"; } catch { return false; }
}

export function ResearcherModeProvider({ children }: { children: React.ReactNode }) {
  const [isResearcher, setIsResearcher] = React.useState(false);
  React.useEffect(() => { setIsResearcher(readInitial()); }, []);

  const unlock = React.useCallback(() => {
    try { window.localStorage.setItem(STORAGE_KEY, "on"); } catch { /* ignore */ }
    setIsResearcher(true);
  }, []);

  const lock = React.useCallback(() => {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setIsResearcher(false);
  }, []);

  const value = React.useMemo(() => ({ isResearcher, unlock, lock }), [isResearcher, unlock, lock]);
  return <ResearcherContext.Provider value={value}>{children}</ResearcherContext.Provider>;
}

export function useResearcherMode(): Ctx {
  const ctx = React.useContext(ResearcherContext);
  if (!ctx) throw new Error("useResearcherMode must be used inside ResearcherModeProvider");
  return ctx;
}

// Sync check for route guards — reads localStorage directly.
export function isResearcherSync(): boolean {
  return readInitial();
}
