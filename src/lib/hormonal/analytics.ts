import type { TelemetryEntry, HormonalPhase } from "./types";

export function rollingAvg(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v != null);
    if (!slice.length) return null;
    return +(slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2);
  });
}

export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const d = Math.sqrt(dx * dy);
  return d === 0 ? 0 : +(num / d).toFixed(3);
}

export function byPhase<T>(entries: TelemetryEntry[], pick: (e: TelemetryEntry) => T | null): Record<HormonalPhase, T[]> {
  const out: Record<HormonalPhase, T[]> = { Menstrual: [], Follicular: [], Ovulatory: [], Luteal: [] };
  for (const e of entries) {
    const v = pick(e);
    if (v != null) out[e.phase].push(v);
  }
  return out;
}

export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2);
}

export const BASELINE = {
  estrogen: { Menstrual: [20, 80], Follicular: [40, 200], Ovulatory: [150, 400], Luteal: [80, 250] },
  progesterone: { Menstrual: [0.1, 0.7], Follicular: [0.1, 1.5], Ovulatory: [0.5, 3], Luteal: [3, 25] },
  lh: { Menstrual: [2, 12], Follicular: [2, 12], Ovulatory: [20, 90], Luteal: [1, 12] },
  fsh: { Menstrual: [3, 12], Follicular: [3, 12], Ovulatory: [4, 20], Luteal: [1, 8] },
} as const;