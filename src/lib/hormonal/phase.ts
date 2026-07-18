import type { HormonalPhase } from "./types";

export function computePhase(
  cycleDay: number,
  cycleLength: number,
  lutealLength: number,
): HormonalPhase {
  const ovulationDay = cycleLength - lutealLength;
  if (cycleDay <= 5) return "Menstrual";
  if (cycleDay < ovulationDay - 1) return "Follicular";
  if (cycleDay <= ovulationDay + 1) return "Ovulatory";
  return "Luteal";
}

export function cycleDayFor(dateISO: string, cycleStartISO: string, cycleLength: number): number {
  const d = new Date(dateISO + "T00:00:00Z").getTime();
  const start = new Date(cycleStartISO + "T00:00:00Z").getTime();
  const diff = Math.floor((d - start) / 86400000);
  return ((diff % cycleLength) + cycleLength) % cycleLength + 1;
}

export const PHASE_COLORS: Record<HormonalPhase, string> = {
  Menstrual: "oklch(0.75 0.12 25 / 0.15)",
  Follicular: "oklch(0.8 0.1 195 / 0.15)",
  Ovulatory: "oklch(0.78 0.14 150 / 0.18)",
  Luteal: "oklch(0.78 0.1 280 / 0.15)",
};

export const PHASE_ACCENT: Record<HormonalPhase, string> = {
  Menstrual: "oklch(0.6 0.15 25)",
  Follicular: "oklch(0.6 0.12 200)",
  Ovulatory: "oklch(0.55 0.15 150)",
  Luteal: "oklch(0.55 0.13 280)",
};