import * as React from "react";

export type LabWorkItem = { id: string; test: string; result: string };
export type LabFile = { id: string; name: string; type: string; size: number; dataUrl: string };
export type UserLabEntry = {
  id: string;
  date: string; // yyyy-mm-dd
  items: LabWorkItem[];
  files: LabFile[];
  createdAt: number;
};

const STORAGE_KEY = "hnhh.userLabs.v1";

function read(): UserLabEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserLabEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: UserLabEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event("hnhh:user-labs-changed"));
}

export function useUserLabs() {
  const [entries, setEntries] = React.useState<UserLabEntry[]>(() => read());

  React.useEffect(() => {
    const sync = () => setEntries(read());
    window.addEventListener("hnhh:user-labs-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("hnhh:user-labs-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const addEntry = React.useCallback((entry: Omit<UserLabEntry, "id" | "createdAt">) => {
    const next: UserLabEntry = { ...entry, id: crypto.randomUUID(), createdAt: Date.now() };
    const all = [...read(), next].sort((a, b) => b.date.localeCompare(a.date));
    write(all);
  }, []);

  const removeEntry = React.useCallback((id: string) => {
    write(read().filter((e) => e.id !== id));
  }, []);

  return { entries, addEntry, removeEntry };
}
