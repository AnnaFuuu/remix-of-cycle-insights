import type { HormonalPhase } from "@/lib/hormonal/types";
import type { LabPanel, LabAssay, WearableSample, LabAnalyte } from "./types";
import { REF_UNITS, REF_METHOD, refRange, flagFor, ANALYTE_ORDER } from "./reference-ranges";
import { computePhase } from "@/lib/hormonal/phase";

// Deterministic PRNG (mulberry32)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function seedLabPanels(cycleLength = 28, lutealLength = 14): LabPanel[] {
  const rand = mulberry32(20260713);
  // 6 panels roughly at day 3, 10, 14, 19, 24, and one 60 days ago
  const offsets: { daysAgo: number; cycleDay: number }[] = [
    { daysAgo: 87, cycleDay: 3 },
    { daysAgo: 60, cycleDay: 10 },
    { daysAgo: 45, cycleDay: 14 },
    { daysAgo: 32, cycleDay: 19 },
    { daysAgo: 18, cycleDay: 24 },
    { daysAgo: 4,  cycleDay: 3  },
  ];
  return offsets.map((o, i) => {
    const phase: HormonalPhase = computePhase(o.cycleDay, cycleLength, lutealLength);
    const assays: LabAssay[] = ANALYTE_ORDER.map((analyte) => {
      const [lo, hi] = refRange(analyte, phase);
      const mid = (lo + hi) / 2;
      const spread = (hi - lo) / 2;
      // occasionally flag outside range
      const jitter = (rand() - 0.5) * spread * 2.2;
      const raw = mid + jitter;
      const value = analyte === "Progesterone" || analyte === "FreeT4" || analyte === "AMH"
        ? +raw.toFixed(2)
        : +raw.toFixed(1);
      return {
        analyte,
        value: Math.max(0.01, value),
        unit: REF_UNITS[analyte],
        refLow: lo,
        refHigh: hi,
        flag: flagFor(value, [lo, hi]),
        method: REF_METHOD[analyte],
      };
    });
    return {
      id: `panel-${i + 1}`,
      collectedAt: dateNDaysAgo(o.daysAgo),
      cycleDay: o.cycleDay,
      phase,
      fasting: i % 2 === 0,
      lab: i < 3 ? "Quest Diagnostics" : "LabCorp",
      assays,
    };
  });
}

export function seedWearableSeries(days = 120, cycleLength = 28, lutealLength = 14): WearableSample[] {
  const rand = mulberry32(20260714);
  const out: WearableSample[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dateNDaysAgo(i);
    const cycleDay = ((days - 1 - i) % cycleLength) + 1;
    const phase = computePhase(cycleDay, cycleLength, lutealLength);
    const ovulation = cycleLength - lutealLength;
    // skin temp rises after ovulation
    const tempDelta = phase === "Luteal"
      ? 0.25 + (rand() - 0.5) * 0.15
      : (rand() - 0.5) * 0.2;
    // HRV drops during luteal & menstrual
    const hrvBase = phase === "Luteal" ? 42 : phase === "Menstrual" ? 45 : phase === "Ovulatory" ? 58 : 55;
    const hrv = +(hrvBase + (rand() - 0.5) * 10).toFixed(1);
    const rhrBase = phase === "Luteal" ? 66 : phase === "Menstrual" ? 65 : 60;
    const restingHR = +(rhrBase + (rand() - 0.5) * 5).toFixed(1);
    const respRate = +(15.5 + (rand() - 0.5) * 1.2 + (phase === "Luteal" ? 0.4 : 0)).toFixed(1);
    const spo2 = +(97.5 + (rand() - 0.5) * 1.5).toFixed(1);
    const steps = Math.round(6500 + rand() * 4500 - (phase === "Menstrual" ? 1500 : 0));
    const activeMinutes = Math.round(steps / 130);
    // sleep stages (~7h)
    const total = 380 + Math.round(rand() * 90);
    const deep = Math.round(total * (0.14 + rand() * 0.05));
    const rem = Math.round(total * (0.20 + rand() * 0.05));
    const awake = Math.round(total * (0.05 + rand() * 0.03));
    const light = total - deep - rem - awake;
    out.push({
      date, hrv, restingHR, skinTempDelta: +tempDelta.toFixed(2), respRate, spo2, steps, activeMinutes,
      sleepStages: { deep, light, rem, awake },
      _cyclePhase: phase,
      _cycleDay: cycleDay,
    } as WearableSample & { _cyclePhase: HormonalPhase; _cycleDay: number });
  }
  return out;
}

export function panelAssay(panel: LabPanel, a: LabAnalyte): LabAssay | undefined {
  return panel.assays.find((x) => x.analyte === a);
}