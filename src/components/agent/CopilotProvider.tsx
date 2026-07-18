import * as React from "react";

interface CopilotCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  prefill: string | null;
  ask: (q: string) => void;
  consumePrefill: () => string | null;
}

const Ctx = React.createContext<CopilotCtx | null>(null);

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [prefill, setPrefill] = React.useState<string | null>(null);
  const value: CopilotCtx = {
    open,
    setOpen,
    prefill,
    ask: (q) => { setPrefill(q); setOpen(true); },
    consumePrefill: () => { const p = prefill; setPrefill(null); return p; },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCopilot() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useCopilot must be used within CopilotProvider");
  return c;
}