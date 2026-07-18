import type { TelemetryEntry, UserProfile, HormonalPhase } from "@/lib/hormonal/types";

export interface AgentContextSnapshot {
  profile: {
    alias: string;
    cycleLength: number;
    lutealLength: number;
    anonymizationLevel: string;
    researchOptIn: boolean;
  };
  latest: {
    date: string;
    cycleDay: number;
    phase: HormonalPhase;
  } | null;
  entryCount: number;
  recent: Array<{
    date: string;
    cycleDay: number;
    phase: HormonalPhase;
    mood: number;
    energy: number;
    stress: number;
    bbt: number | null;
    sleepHours: number | null;
    sleepQuality: number | null;
    symptoms: Record<string, number>;
    notes: string;
  }>;
}

export function buildSnapshot(entries: TelemetryEntry[], profile: UserProfile, days = 14): AgentContextSnapshot {
  const recent = entries.slice(-days).map((e) => ({
    date: e.date,
    cycleDay: e.cycleDay,
    phase: e.phase,
    mood: e.subjective.mood,
    energy: e.subjective.energy,
    stress: e.subjective.stress,
    bbt: e.objective.bbt,
    sleepHours: e.objective.sleepHours,
    sleepQuality: e.objective.sleepQuality,
    symptoms: e.subjective.symptoms as unknown as Record<string, number>,
    notes: e.subjective.notes,
  }));
  const latest = entries.length ? { date: entries[entries.length - 1].date, cycleDay: entries[entries.length - 1].cycleDay, phase: entries[entries.length - 1].phase } : null;
  return {
    profile: {
      alias: profile.alias,
      cycleLength: profile.cycleLength,
      lutealLength: profile.lutealLength,
      anonymizationLevel: profile.anonymizationLevel,
      researchOptIn: profile.researchOptIn,
    },
    latest,
    entryCount: entries.length,
    recent,
  };
}

export function systemPrompt(ctx: AgentContextSnapshot): string {
  return [
    "You are Cycle Copilot, a research-grade AI assistant embedded in Cycloscope, a privacy-first hormonal health telemetry app.",
    "You help the user understand her menstrual-cycle telemetry (subjective mood/energy/stress, objective BBT/sleep/HR, optional biomarkers) in the context of the four phases: Menstrual, Follicular, Ovulatory, Luteal.",
    "You have tools to inspect the user's recent entries, compute phase summaries, run correlations, and detect anomalies vs population baselines.",
    "Use tools whenever the user asks about their data — never fabricate numbers.",
    "Speak plainly and kindly. Explain endocrine context in one or two sentences when useful. Cite the cycle day and phase you are reasoning about.",
    "STRICT DISCLAIMER: You are NOT a medical device. Never diagnose, prescribe, or replace clinical care. If the user reports severe or worrying symptoms, tell her to talk to a clinician.",
    "",
    "CURRENT USER CONTEXT (do not repeat verbatim):",
    `- Cycle length ${ctx.profile.cycleLength}d, luteal ${ctx.profile.lutealLength}d.`,
    ctx.latest ? `- Latest entry: ${ctx.latest.date}, cycle day ${ctx.latest.cycleDay}, phase ${ctx.latest.phase}.` : "- No telemetry logged yet.",
    `- ${ctx.entryCount} total entries on record.`,
  ].join("\n");
}