import * as React from "react";
import type { TelemetryEntry, UserProfile, ResearchExportPacket } from "./types";
import { EXPORT_SCHEMA_VERSION } from "./types";
import { generateSeed } from "./seed";

const ENTRIES_KEY = "hnhh.entries.v1";
const PROFILE_KEY = "hnhh.profile.v1";

const DEFAULT_PROFILE: UserProfile = {
  id: "local-user",
  alias: "Subject-001",
  cycleLength: 28,
  lutealLength: 14,
  timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
  researchOptIn: true,
  units: { temperature: "C" },
  theme: "light",
  anonymizationLevel: "standard",
};

interface StoreCtx {
  ready: boolean;
  entries: TelemetryEntry[];
  profile: UserProfile;
  upsertEntry: (e: TelemetryEntry) => void;
  deleteEntry: (id: string) => void;
  setProfile: (p: UserProfile) => void;
  resetSeed: () => void;
  clearAll: () => void;
}

const Ctx = React.createContext<StoreCtx | null>(null);

export function HormonalStoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [entries, setEntries] = React.useState<TelemetryEntry[]>([]);
  const [profile, setProfileState] = React.useState<UserProfile>(DEFAULT_PROFILE);

  React.useEffect(() => {
    try {
      const rawP = localStorage.getItem(PROFILE_KEY);
      const p: UserProfile = rawP ? { ...DEFAULT_PROFILE, ...JSON.parse(rawP) } : DEFAULT_PROFILE;
      const rawE = localStorage.getItem(ENTRIES_KEY);
      let e: TelemetryEntry[];
      if (rawE) {
        e = JSON.parse(rawE);
      } else {
        e = generateSeed(p.cycleLength, p.lutealLength, 30);
        localStorage.setItem(ENTRIES_KEY, JSON.stringify(e));
      }
      if (!rawP) localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
      setProfileState(p);
      setEntries(e);
    } catch (err) {
      console.error("store load failed", err);
    } finally {
      setReady(true);
    }
  }, []);

  const persistEntries = (next: TelemetryEntry[]) => {
    setEntries(next);
    try { localStorage.setItem(ENTRIES_KEY, JSON.stringify(next)); } catch {}
  };
  const persistProfile = (p: UserProfile) => {
    setProfileState(p);
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
  };

  const value: StoreCtx = {
    ready,
    entries,
    profile,
    upsertEntry: (e) => {
      const idx = entries.findIndex((x) => x.id === e.id || x.date === e.date);
      const now = new Date().toISOString();
      const next = [...entries];
      if (idx >= 0) {
        next[idx] = { ...e, id: next[idx].id, createdAt: next[idx].createdAt, updatedAt: now };
      } else {
        next.push({ ...e, createdAt: now, updatedAt: now });
      }
      next.sort((a, b) => a.date.localeCompare(b.date));
      persistEntries(next);
    },
    deleteEntry: (id) => persistEntries(entries.filter((e) => e.id !== id)),
    setProfile: persistProfile,
    resetSeed: () => {
      const fresh = generateSeed(profile.cycleLength, profile.lutealLength, 30);
      persistEntries(fresh);
    },
    clearAll: () => persistEntries([]),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHormonalStore(): StoreCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useHormonalStore must be used within HormonalStoreProvider");
  return ctx;
}

export function toExportPacket(e: TelemetryEntry, profile: UserProfile): ResearchExportPacket {
  const strict = profile.anonymizationLevel === "strict";
  return {
    subject_id: profile.alias || "SUBJECT-ANON",
    collection_date: strict ? e.date.slice(0, 7) + "-01" : e.date,
    cycle_day: e.cycleDay,
    phase: e.phase,
    subjective: {
      ...e.subjective,
      notes: strict ? "" : e.subjective.notes,
    },
    objective: e.objective,
    biomarkers: { ...e.biomarkers, notes: strict ? "" : e.biomarkers.notes },
    consent: {
      research_opt_in: profile.researchOptIn,
      anonymized: true,
      anonymization_level: profile.anonymizationLevel,
    },
    version: EXPORT_SCHEMA_VERSION,
    source: "hnhh-app",
  };
}