import { createServerFn } from "@tanstack/react-start";

export type PhaseKey = "Menstrual" | "Follicular" | "Fertility" | "Luteal";
export const PHASES: PhaseKey[] = ["Menstrual", "Follicular", "Fertility", "Luteal"];

export interface ParticipantPhaseStats {
  participantId: number;
  counts: Record<PhaseKey, number>;
  total: number;
  dominant: PhaseKey;
}

export interface SplitBucket {
  name: "train" | "validation" | "test";
  participantIds: number[];
  phaseDayTotals: Record<PhaseKey, number>;
  phaseProportions: Record<PhaseKey, number>;
  participantCount: number;
  dayCount: number;
}

export interface SplitResult {
  seed: number;
  totalParticipants: number;
  totalDays: number;
  perParticipant: ParticipantPhaseStats[];
  splits: SplitBucket[];
  overallPhaseProportions: Record<PhaseKey, number>;
  assignment: Record<number, "train" | "validation" | "test">;
}

// Mulberry32 seeded PRNG for deterministic shuffling.
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

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function stratifiedSplit(
  perParticipant: ParticipantPhaseStats[],
  seed: number,
): { assignment: Record<number, "train" | "validation" | "test">; buckets: Record<PhaseKey, { train: number[]; validation: number[]; test: number[] }> } {
  const rng = mulberry32(seed);
  const groups: Record<PhaseKey, ParticipantPhaseStats[]> = {
    Menstrual: [], Follicular: [], Fertility: [], Luteal: [],
  };
  for (const p of perParticipant) groups[p.dominant].push(p);

  const assignment: Record<number, "train" | "validation" | "test"> = {};
  const buckets: Record<PhaseKey, { train: number[]; validation: number[]; test: number[] }> = {
    Menstrual: { train: [], validation: [], test: [] },
    Follicular: { train: [], validation: [], test: [] },
    Fertility: { train: [], validation: [], test: [] },
    Luteal: { train: [], validation: [], test: [] },
  };

  for (const phase of PHASES) {
    const shuffled = shuffle(groups[phase], rng);
    const n = shuffled.length;
    // 60/20/20 with rounding: test = round(n*0.2), val = round(n*0.2), train = rest.
    const nTest = Math.round(n * 0.2);
    const nVal = Math.round(n * 0.2);
    const nTrain = n - nTest - nVal;
    for (let i = 0; i < shuffled.length; i++) {
      const pid = shuffled[i].participantId;
      let label: "train" | "validation" | "test";
      if (i < nTrain) label = "train";
      else if (i < nTrain + nVal) label = "validation";
      else label = "test";
      assignment[pid] = label;
      buckets[phase][label].push(pid);
    }
  }
  return { assignment, buckets };
}

export const getTrainValTestSplit = createServerFn({ method: "GET" })
  .inputValidator((input: { seed?: number } | undefined) => ({ seed: input?.seed ?? 42 }))
  .handler(async ({ data }): Promise<SplitResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pull day-level phase records; ~5.6k rows, cheap.
    const rows: { participant_id: number; phase: string | null }[] = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data: page, error } = await supabaseAdmin
        .from("mcphases_hormones_selfreport")
        .select("participant_id, phase")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!page || page.length === 0) break;
      rows.push(...(page as { participant_id: number; phase: string | null }[]));
      if (page.length < pageSize) break;
      from += pageSize;
    }

    const byPid = new Map<number, Record<PhaseKey, number>>();
    for (const r of rows) {
      if (!r.phase || !(PHASES as string[]).includes(r.phase)) continue;
      const key = r.phase as PhaseKey;
      const rec = byPid.get(r.participant_id) ?? { Menstrual: 0, Follicular: 0, Fertility: 0, Luteal: 0 };
      rec[key] += 1;
      byPid.set(r.participant_id, rec);
    }

    const perParticipant: ParticipantPhaseStats[] = [];
    for (const [pid, counts] of byPid.entries()) {
      const total = PHASES.reduce((s, p) => s + counts[p], 0);
      let dominant: PhaseKey = "Luteal";
      let best = -1;
      for (const p of PHASES) if (counts[p] > best) { best = counts[p]; dominant = p; }
      perParticipant.push({ participantId: pid, counts, total, dominant });
    }
    perParticipant.sort((a, b) => a.participantId - b.participantId);

    const { assignment } = stratifiedSplit(perParticipant, data.seed);

    const totalDays = perParticipant.reduce((s, p) => s + p.total, 0);
    const overallCounts: Record<PhaseKey, number> = { Menstrual: 0, Follicular: 0, Fertility: 0, Luteal: 0 };
    for (const p of perParticipant) for (const ph of PHASES) overallCounts[ph] += p.counts[ph];
    const overallPhaseProportions: Record<PhaseKey, number> = { Menstrual: 0, Follicular: 0, Fertility: 0, Luteal: 0 };
    for (const ph of PHASES) overallPhaseProportions[ph] = totalDays ? overallCounts[ph] / totalDays : 0;

    const splits: SplitBucket[] = (["train", "validation", "test"] as const).map((name) => {
      const pids = perParticipant.filter((p) => assignment[p.participantId] === name).map((p) => p.participantId);
      const phaseDayTotals: Record<PhaseKey, number> = { Menstrual: 0, Follicular: 0, Fertility: 0, Luteal: 0 };
      let days = 0;
      for (const pid of pids) {
        const rec = byPid.get(pid);
        if (!rec) continue;
        for (const ph of PHASES) { phaseDayTotals[ph] += rec[ph]; days += rec[ph]; }
      }
      const phaseProportions: Record<PhaseKey, number> = { Menstrual: 0, Follicular: 0, Fertility: 0, Luteal: 0 };
      for (const ph of PHASES) phaseProportions[ph] = days ? phaseDayTotals[ph] / days : 0;
      return { name, participantIds: pids, phaseDayTotals, phaseProportions, participantCount: pids.length, dayCount: days };
    });

    return {
      seed: data.seed,
      totalParticipants: perParticipant.length,
      totalDays,
      perParticipant,
      splits,
      overallPhaseProportions,
      assignment,
    };
  });