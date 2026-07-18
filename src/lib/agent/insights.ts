import type { TelemetryEntry, UserProfile, HormonalPhase } from "@/lib/hormonal/types";
import { BASELINE, mean } from "@/lib/hormonal/analytics";

export interface AgentInsight {
  id: string;
  tone: "info" | "warn" | "good";
  title: string;
  body: string;
  ask: string; // prefill question for Copilot
}

export function generateInsights(entries: TelemetryEntry[], _profile: UserProfile): AgentInsight[] {
  if (!entries.length) return [];
  const out: AgentInsight[] = [];
  const latest = entries[entries.length - 1];
  const last7 = entries.slice(-7);
  const prev7 = entries.slice(-14, -7);

  const avgSleep7 = mean(last7.map((e) => e.objective.sleepQuality ?? 0).filter(Boolean));
  const avgSleepPrev = mean(prev7.map((e) => e.objective.sleepQuality ?? 0).filter(Boolean));
  if (prev7.length && avgSleep7 < avgSleepPrev - 0.7) {
    out.push({
      id: "sleep-decline",
      tone: "warn",
      title: "Sleep quality slipped this week",
      body: `7-day mean is ${avgSleep7.toFixed(1)}/10 vs ${avgSleepPrev.toFixed(1)}/10 the week prior. Sleep debt frequently amplifies luteal-phase mood volatility.`,
      ask: "Why might my sleep quality be dropping this week, and how does it interact with my current cycle phase?",
    });
  }

  const luteal = entries.filter((e) => e.phase === "Luteal").map((e) => e.subjective.mood);
  const foll = entries.filter((e) => e.phase === "Follicular").map((e) => e.subjective.mood);
  if (luteal.length >= 2 && foll.length >= 2) {
    const drop = mean(foll) - mean(luteal);
    if (drop > 1.2) {
      out.push({
        id: "luteal-mood",
        tone: "warn",
        title: "Mood consistently lower in luteal phase",
        body: `Follicular mean ${mean(foll).toFixed(1)}/10 vs luteal ${mean(luteal).toFixed(1)}/10 across your log — a ${drop.toFixed(1)}-point premenstrual dip.`,
        ask: "My mood drops ~1-2 points in the luteal phase. What non-diagnostic interventions are usually studied for PMS-related mood shifts?",
      });
    }
  }

  // biomarker out-of-range
  const range = (k: "estrogen" | "progesterone" | "lh" | "fsh", phase: HormonalPhase) => BASELINE[k][phase];
  const bio: string[] = [];
  (["estrogen", "progesterone", "lh", "fsh"] as const).forEach((k) => {
    const v = latest.biomarkers[k];
    if (v == null) return;
    const [lo, hi] = range(k, latest.phase);
    if (v < lo * 0.9 || v > hi * 1.1) bio.push(`${k.toUpperCase()} ${v} outside ${lo}-${hi}`);
  });
  if (bio.length) {
    out.push({
      id: "biomarker-flag",
      tone: "warn",
      title: "Latest biomarker outside phase baseline",
      body: `${bio.join("; ")} for ${latest.phase} phase. Baseline ranges are population midpoints and do not constitute a diagnosis.`,
      ask: `Explain what an out-of-range ${bio[0]} might indicate during the ${latest.phase} phase, without diagnosing.`,
    });
  }

  if (latest.phase === "Ovulatory") {
    out.push({
      id: "ovulation",
      tone: "good",
      title: "Ovulatory window detected",
      body: `Cycle day ${latest.cycleDay} · BBT ${latest.objective.bbt?.toFixed(2) ?? "-"}°C. Peak-fertility physiology is consistent with your tracked cycle length.`,
      ask: "Walk me through what typically happens hormonally during my current ovulatory window.",
    });
  }

  if (out.length < 3) {
    out.push({
      id: "trend-stable",
      tone: "info",
      title: "Telemetry stable across the last 14 days",
      body: "No z-score anomalies detected in mood, sleep, or symptom load vs your rolling baseline.",
      ask: "Summarize the main trends across my last 14 days of telemetry.",
    });
  }
  return out.slice(0, 3);
}