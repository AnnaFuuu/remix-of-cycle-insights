import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PredictorInput, PredictionResult } from "@/lib/prediction/types";

// Records a Dashboard prediction to cloud (opt-in per prediction).
// Client also keeps a local copy in localStorage regardless.

const UUID = z.string().uuid();

export interface StoredPrediction {
  id: string;
  predicted_at: string;
  inputs: PredictorInput;
  phase: string;
  confidence: number;
  probabilities: Record<string, number>;
  imputed: { lh?: number; estradiol?: number };
  matched_lab_report_id: string | null;
  actual_lh: number | null;
  actual_estradiol: number | null;
}

const SaveInput = z.object({
  ownerId: UUID,
  predictedAt: z.string(),
  inputs: z.record(z.string(), z.union([z.number(), z.null()])),
  phase: z.string(),
  confidence: z.number(),
  probabilities: z.record(z.string(), z.number()),
  imputed: z.object({ lh: z.number().optional(), estradiol: z.number().optional() }).default({}),
});

async function findMatchingLabReport(
  supabaseAdmin: {
    from: (t: string) => {
      select: (s: string) => {
        eq: (col: string, val: string) => {
          order: (c: string, o: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: unknown }>;
          };
        };
      };
    };
  },
  ownerId: string,
  predictedAt: string,
): Promise<{ id: string; lh: number | null; e2: number | null } | null> {
  // Find the lab report closest in time to the prediction (±60 days) that
  // contains LH or estradiol values. Used to compare predicted vs actual.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin.from("lab_reports" as any) as any)
    .select("id, report_date, extracted")
    .eq("owner_id", ownerId)
    .order("report_date", { ascending: false })
    .limit(50);
  if (!data || !Array.isArray(data)) return null;
  const target = new Date(predictedAt).getTime();
  let best: { id: string; date: number; lh: number | null; e2: number | null } | null = null;
  for (const row of data as { id: string; report_date: string; extracted: { name: string; value: number | null }[] }[]) {
    const d = new Date(row.report_date).getTime();
    if (Math.abs(d - target) > 60 * 86400e3) continue;
    let lh: number | null = null, e2: number | null = null;
    for (const b of row.extracted ?? []) {
      const n = (b.name || "").toLowerCase();
      if (lh === null && (n.includes("lh") || n.includes("luteinizing"))) lh = b.value;
      if (e2 === null && (n.includes("estradiol") || n.includes("e2") || n.includes("estrogen"))) e2 = b.value;
    }
    if (lh === null && e2 === null) continue;
    if (!best || Math.abs(d - target) < Math.abs(best.date - target)) {
      best = { id: row.id, date: d, lh, e2 };
    }
  }
  return best ? { id: best.id, lh: best.lh, e2: best.e2 } : null;
}

export const savePrediction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data }): Promise<StoredPrediction> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const match = await findMatchingLabReport(supabaseAdmin as never, data.ownerId, data.predictedAt);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ins = await (supabaseAdmin.from("prediction_history" as any) as any).insert({
      owner_id: data.ownerId,
      predicted_at: data.predictedAt,
      inputs: data.inputs,
      phase: data.phase,
      confidence: data.confidence,
      probabilities: data.probabilities,
      imputed: data.imputed,
      matched_lab_report_id: match?.id ?? null,
      actual_lh: match?.lh ?? null,
      actual_estradiol: match?.e2 ?? null,
    }).select("*").single();
    if (ins.error) throw ins.error;

    const row = ins.data;
    return {
      id: row.id,
      predicted_at: row.predicted_at,
      inputs: row.inputs as PredictorInput,
      phase: row.phase,
      confidence: Number(row.confidence),
      probabilities: row.probabilities,
      imputed: row.imputed,
      matched_lab_report_id: row.matched_lab_report_id,
      actual_lh: row.actual_lh !== null ? Number(row.actual_lh) : null,
      actual_estradiol: row.actual_estradiol !== null ? Number(row.actual_estradiol) : null,
    };
  });

export const listPredictions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ ownerId: UUID }).parse(input))
  .handler(async ({ data }): Promise<StoredPrediction[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (supabaseAdmin.from("prediction_history" as any) as any)
      .select("*")
      .eq("owner_id", data.ownerId)
      .order("predicted_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      predicted_at: r.predicted_at as string,
      inputs: r.inputs as PredictorInput,
      phase: r.phase as string,
      confidence: Number(r.confidence),
      probabilities: r.probabilities as Record<string, number>,
      imputed: (r.imputed ?? {}) as { lh?: number; estradiol?: number },
      matched_lab_report_id: (r.matched_lab_report_id ?? null) as string | null,
      actual_lh: r.actual_lh !== null && r.actual_lh !== undefined ? Number(r.actual_lh) : null,
      actual_estradiol: r.actual_estradiol !== null && r.actual_estradiol !== undefined ? Number(r.actual_estradiol) : null,
    }));
  });

export const deletePrediction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ ownerId: UUID, id: UUID }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin.from("prediction_history" as any) as any)
      .delete().eq("id", data.id).eq("owner_id", data.ownerId);
    return { ok: true };
  });

// Local (browser) history helpers — kept in localStorage so the user always
// sees their own results even before opting in to cloud sync.
const LOCAL_KEY = "cycloscope.predictionHistory.v1";

export interface LocalPrediction {
  id: string;
  predicted_at: string;
  inputs: PredictorInput;
  result: PredictionResult;
  synced_id: string | null; // set when uploaded to cloud
}

export function readLocalPredictions(): LocalPrediction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as LocalPrediction[]) : [];
  } catch { return []; }
}

export function writeLocalPredictions(list: LocalPrediction[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

export function appendLocalPrediction(p: Omit<LocalPrediction, "id" | "synced_id"> & { id?: string }): LocalPrediction {
  const rec: LocalPrediction = {
    id: p.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())),
    predicted_at: p.predicted_at,
    inputs: p.inputs,
    result: p.result,
    synced_id: null,
  };
  const list = readLocalPredictions();
  list.unshift(rec);
  writeLocalPredictions(list.slice(0, 200));
  return rec;
}

export function markLocalSynced(localId: string, syncedId: string): void {
  const list = readLocalPredictions();
  const idx = list.findIndex((p) => p.id === localId);
  if (idx >= 0) {
    list[idx].synced_id = syncedId;
    writeLocalPredictions(list);
  }
}
