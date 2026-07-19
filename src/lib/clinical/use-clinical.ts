import * as React from "react";
import { useHormonalStore } from "@/lib/hormonal/store";
import { seedLabPanels, seedWearableSeries } from "./seed-clinical";
import type { LabPanel, WearableSample } from "./types";

export function useClinical(): { panels: LabPanel[]; wearables: WearableSample[] } {
  const { profile } = useHormonalStore();
  return React.useMemo(() => ({
    panels: seedLabPanels(profile.cycleLength, profile.lutealLength),
    wearables: seedWearableSeries(120, profile.cycleLength, profile.lutealLength),
  }), [profile.cycleLength, profile.lutealLength]);
}