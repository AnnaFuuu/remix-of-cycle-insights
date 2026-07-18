import { tool } from "ai";
import { z } from "zod";
import type { AgentContextSnapshot } from "./context";
import { BASELINE, pearson, mean } from "@/lib/hormonal/analytics";
import type { HormonalPhase } from "@/lib/hormonal/types";

const PHASES: HormonalPhase[] = ["Menstrual", "Follicular", "Ovulatory", "Luteal"];

export function buildTools(ctx: AgentContextSnapshot) {
  return {
    get_recent_entries: tool({
      description: "Return the last N days of the user's telemetry entries. Use this whenever the user asks about specific days, trends, or symptoms.",
      inputSchema: z.object({ days: z.number().int().min(1).max(30).describe("Number of most recent days to return") }),
      execute: async ({ days }) => {
        return { entries: ctx.recent.slice(-days) };
      },
    }),

    get_phase_summary: tool({
      description: "Summarize the user's average mood, energy, stress, sleep, and BBT grouped by cycle phase.",
      inputSchema: z.object({}),
      execute: async () => {
        const byPhase = Object.fromEntries(PHASES.map((p) => [p, {
          count: 0,
          mood: 0, energy: 0, stress: 0,
          sleepHours: 0, sleepQuality: 0, bbt: 0,
          bbtSamples: 0, sleepSamples: 0,
        }])) as Record<HormonalPhase, { count: number; mood: number; energy: number; stress: number; sleepHours: number; sleepQuality: number; bbt: number; bbtSamples: number; sleepSamples: number }>;
        for (const e of ctx.recent) {
          const b = byPhase[e.phase];
          b.count++;
          b.mood += e.mood; b.energy += e.energy; b.stress += e.stress;
          if (e.bbt != null) { b.bbt += e.bbt; b.bbtSamples++; }
          if (e.sleepHours != null) { b.sleepHours += e.sleepHours; b.sleepSamples++; }
          if (e.sleepQuality != null) { b.sleepQuality += e.sleepQuality; }
        }
        const out: Record<string, { count: number; mood: number; energy: number; stress: number; sleepHours: number | null; sleepQuality: number | null; bbt: number | null }> = {};
        for (const p of PHASES) {
          const b = byPhase[p];
          if (!b.count) { out[p] = { count: 0, mood: 0, energy: 0, stress: 0, sleepHours: null, sleepQuality: null, bbt: null }; continue; }
          out[p] = {
            count: b.count,
            mood: +(b.mood / b.count).toFixed(2),
            energy: +(b.energy / b.count).toFixed(2),
            stress: +(b.stress / b.count).toFixed(2),
            sleepHours: b.sleepSamples ? +(b.sleepHours / b.sleepSamples).toFixed(2) : null,
            sleepQuality: b.count ? +(b.sleepQuality / b.count).toFixed(2) : null,
            bbt: b.bbtSamples ? +(b.bbt / b.bbtSamples).toFixed(2) : null,
          };
        }
        return out;
      },
    }),

    compute_correlation: tool({
      description: "Compute Pearson correlation between two metrics across the recent window. Metrics: mood, energy, stress, sleepHours, sleepQuality, bbt.",
      inputSchema: z.object({
        a: z.enum(["mood", "energy", "stress", "sleepHours", "sleepQuality", "bbt"]),
        b: z.enum(["mood", "energy", "stress", "sleepHours", "sleepQuality", "bbt"]),
      }),
      execute: async ({ a, b }) => {
        const xs: number[] = []; const ys: number[] = [];
        for (const e of ctx.recent) {
          const va = (e as unknown as Record<string, number | null>)[a];
          const vb = (e as unknown as Record<string, number | null>)[b];
          if (va != null && vb != null) { xs.push(va); ys.push(vb); }
        }
        return { a, b, n: xs.length, pearson: pearson(xs, ys) };
      },
    }),

    detect_anomalies: tool({
      description: "Flag entries in the recent window whose mood, sleep quality, or symptom load is unusually far from the user's own baseline (z-score > 1.5).",
      inputSchema: z.object({}),
      execute: async () => {
        const moods = ctx.recent.map((e) => e.mood);
        const sleeps = ctx.recent.map((e) => e.sleepQuality ?? mean(ctx.recent.map((x) => x.sleepQuality ?? 0)));
        const m = mean(moods);
        const sd = Math.sqrt(mean(moods.map((v) => (v - m) ** 2))) || 1;
        const sm = mean(sleeps);
        const ssd = Math.sqrt(mean(sleeps.map((v) => (v - sm) ** 2))) || 1;
        const flagged = ctx.recent
          .map((e) => {
            const symLoad = Object.values(e.symptoms).reduce((a, b) => a + b, 0);
            const zMood = (e.mood - m) / sd;
            const zSleep = e.sleepQuality != null ? (e.sleepQuality - sm) / ssd : 0;
            const reasons: string[] = [];
            if (Math.abs(zMood) > 1.5) reasons.push(`mood z=${zMood.toFixed(2)}`);
            if (Math.abs(zSleep) > 1.5) reasons.push(`sleep z=${zSleep.toFixed(2)}`);
            if (symLoad > 25) reasons.push(`heavy symptom load (${symLoad})`);
            return reasons.length ? { date: e.date, phase: e.phase, cycleDay: e.cycleDay, reasons } : null;
          })
          .filter((x): x is NonNullable<typeof x> => x != null);
        return { flagged, baselineMood: +m.toFixed(2), baselineSleepQuality: +sm.toFixed(2) };
      },
    }),

    baseline_lookup: tool({
      description: "Look up the population normative endocrine range (estrogen pg/mL, progesterone ng/mL, LH mIU/mL, FSH mIU/mL) for a given cycle phase.",
      inputSchema: z.object({ phase: z.enum(["Menstrual", "Follicular", "Ovulatory", "Luteal"]) }),
      execute: async ({ phase }) => ({
        phase,
        estrogen: BASELINE.estrogen[phase],
        progesterone: BASELINE.progesterone[phase],
        lh: BASELINE.lh[phase],
        fsh: BASELINE.fsh[phase],
      }),
    }),
  };
}