import type { TelemetryEntry, SyntheticCohortRecord } from "./types";
import { computePhase } from "./phase";

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function bbtCurve(cycleDay: number, cycleLength: number, lutealLength: number, jitter: number): number {
  const ovDay = cycleLength - lutealLength;
  const base = 36.4;
  if (cycleDay < ovDay) return +(base + jitter * 0.08).toFixed(2);
  if (cycleDay === ovDay) return +(base - 0.1 + jitter * 0.05).toFixed(2);
  return +(base + 0.35 + jitter * 0.08).toFixed(2);
}

export function generateSeed(cycleLength = 28, lutealLength = 14, days = 30): TelemetryEntry[] {
  const r = rand(20260718);
  const entries: TelemetryEntry[] = [];
  // anchor: cycle started (days) ago such that today has known cycleDay
  const cycleStartOffset = 26; // arbitrary but consistent
  for (let i = days - 1; i >= 0; i--) {
    const date = isoDaysAgo(i);
    const cycleDay = ((cycleStartOffset - i) % cycleLength + cycleLength) % cycleLength + 1;
    const phase = computePhase(cycleDay, cycleLength, lutealLength);
    const jitter = r() * 2 - 1;
    const cramps = phase === "Menstrual" ? Math.round(5 + r() * 4) : Math.round(r() * 2);
    const fatigue = phase === "Luteal" || phase === "Menstrual" ? Math.round(4 + r() * 4) : Math.round(1 + r() * 3);
    const bloating = phase === "Luteal" ? Math.round(4 + r() * 4) : Math.round(r() * 3);
    const headache = Math.round(r() * (phase === "Menstrual" ? 5 : 3));
    const nausea = Math.round(r() * (phase === "Menstrual" ? 3 : 1));
    const bt = Math.round(r() * (phase === "Luteal" ? 5 : 2));
    const moodBase = phase === "Ovulatory" ? 8 : phase === "Follicular" ? 7 : phase === "Menstrual" ? 5 : 5;
    const mood = Math.max(1, Math.min(10, Math.round(moodBase + jitter * 1.5)));
    const energyBase = phase === "Ovulatory" ? 8 : phase === "Follicular" ? 7 : phase === "Menstrual" ? 4 : 5;
    const energy = Math.max(1, Math.min(10, Math.round(energyBase + jitter * 1.3)));
    const stress = Math.max(1, Math.min(10, Math.round(5 + (phase === "Luteal" ? 1.5 : 0) + jitter * 1.5)));
    const sleepHours = +(7 + jitter * 0.8 - (phase === "Luteal" ? 0.4 : 0)).toFixed(1);
    const sleepQuality = Math.max(1, Math.min(10, Math.round(7 + jitter - (phase === "Luteal" ? 1 : 0))));
    const steps = Math.round(6000 + r() * 5000 + (phase === "Ovulatory" ? 1500 : 0));
    const restingHR = Math.round(62 + (phase === "Luteal" ? 3 : 0) + jitter * 2);
    const hrv = Math.round(55 - (phase === "Luteal" ? 5 : 0) + jitter * 6);

    const estrogen =
      phase === "Follicular" ? 80 + r() * 100 :
      phase === "Ovulatory" ? 250 + r() * 100 :
      phase === "Luteal" ? 120 + r() * 60 :
      50 + r() * 30;
    const progesterone =
      phase === "Luteal" ? 8 + r() * 8 :
      phase === "Ovulatory" ? 1 + r() * 2 :
      0.3 + r() * 0.6;
    const lh = phase === "Ovulatory" ? 30 + r() * 40 : 4 + r() * 6;
    const fsh = phase === "Follicular" ? 6 + r() * 5 : 4 + r() * 3;

    const now = new Date().toISOString();
    entries.push({
      id: `seed-${date}`,
      date,
      cycleDay,
      phase,
      subjective: {
        mood, energy, stress,
        symptoms: { cramps, fatigue, bloating, headache, nausea, breastTenderness: bt },
        notes: "",
      },
      objective: {
        bbt: bbtCurve(cycleDay, cycleLength, lutealLength, jitter),
        sleepHours, sleepQuality, steps, restingHR, hrv,
      },
      biomarkers: {
        estrogen: +estrogen.toFixed(1),
        progesterone: +progesterone.toFixed(2),
        lh: +lh.toFixed(1),
        fsh: +fsh.toFixed(1),
        notes: "",
      },
      researchConsent: true,
      anonymized: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  return entries;
}

export function generateCohort(size = 40, cycleLength = 28, lutealLength = 14): SyntheticCohortRecord[] {
  const r = rand(4242);
  const out: SyntheticCohortRecord[] = [];
  for (let i = 0; i < size; i++) {
    const cycleDay = Math.floor(r() * cycleLength) + 1;
    const phase = computePhase(cycleDay, cycleLength, lutealLength);
    const jitter = r() * 2 - 1;
    out.push({
      subject_id: `SYN-${(1000 + i).toString(16).toUpperCase()}`,
      cycle_day: cycleDay,
      phase,
      bbt: bbtCurve(cycleDay, cycleLength, lutealLength, jitter),
      mood: Math.max(1, Math.min(10, Math.round(6 + jitter))),
      energy: Math.max(1, Math.min(10, Math.round(6 + jitter))),
      sleep_hours: +(7 + jitter * 0.7).toFixed(1),
      estrogen: +(phase === "Ovulatory" ? 250 + r() * 100 : 100 + r() * 80).toFixed(1),
      progesterone: +(phase === "Luteal" ? 8 + r() * 6 : 1 + r() * 2).toFixed(2),
      lh: +(phase === "Ovulatory" ? 35 + r() * 30 : 5 + r() * 4).toFixed(1),
      fsh: +(5 + r() * 5).toFixed(1),
    });
  }
  return out;
}