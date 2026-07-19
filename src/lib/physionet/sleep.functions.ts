import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AggregateStats, DatasetSummary, FieldKey, SleepRow } from "./mapping";

const sleepRowSchema = z.object({
  subject_id: z.string().min(1).max(128),
  recording_date: z.string().nullable(),
  night_index: z.number().nullable(),
  total_sleep_min: z.number().nullable(),
  deep_min: z.number().nullable(),
  light_min: z.number().nullable(),
  rem_min: z.number().nullable(),
  awake_min: z.number().nullable(),
  sleep_efficiency: z.number().nullable(),
  latency_min: z.number().nullable(),
  waso_min: z.number().nullable(),
  quality_score: z.number().nullable(),
  raw: z.record(z.string(), z.unknown()),
});

const importSchema = z.object({
  meta: z.object({
    slug: z.string().min(1).max(80).regex(/^[a-z0-9-_]+$/i),
    name: z.string().min(1).max(160),
    description: z.string().max(2000).optional().nullable(),
    citation: z.string().max(500).optional().nullable(),
    source_url: z.string().max(500).optional().nullable(),
  }),
  rows: z.array(sleepRowSchema).min(1).max(200000),
});

export const importSleepCsv = createServerFn({ method: "POST" })
  .inputValidator((data) => importSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const variablesCount = Math.max(0, Object.keys(data.rows[0]?.raw ?? {}).length);
    const subjects = new Set(data.rows.map((r) => r.subject_id));

    const { data: ds, error: dsErr } = await supabaseAdmin
      .from("physionet_datasets")
      .upsert(
        {
          slug: data.meta.slug,
          name: data.meta.name,
          description: data.meta.description ?? null,
          citation: data.meta.citation ?? null,
          source_url: data.meta.source_url ?? null,
          variables_count: variablesCount,
          subjects_count: subjects.size,
          row_count: data.rows.length,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (dsErr || !ds) throw new Error(dsErr?.message ?? "dataset upsert failed");

    // Clear previous rows for this dataset before re-import.
    await supabaseAdmin.from("physionet_sleep_records").delete().eq("dataset_id", ds.id);

    const BATCH = 500;
    for (let i = 0; i < data.rows.length; i += BATCH) {
      const chunk = data.rows.slice(i, i + BATCH).map((r) => ({
        dataset_id: ds.id,
        subject_id: r.subject_id,
        recording_date: r.recording_date,
        night_index: r.night_index,
        total_sleep_min: r.total_sleep_min,
        deep_min: r.deep_min,
        light_min: r.light_min,
        rem_min: r.rem_min,
        awake_min: r.awake_min,
        sleep_efficiency: r.sleep_efficiency,
        latency_min: r.latency_min,
        waso_min: r.waso_min,
        quality_score: r.quality_score,
        raw: r.raw as unknown as never,
      }));
      const { error } = await supabaseAdmin.from("physionet_sleep_records").insert(chunk);
      if (error) throw new Error(`row batch ${i} failed: ${error.message}`);
    }

    return { datasetId: ds.id, inserted: data.rows.length, subjects: subjects.size };
  });

export const listSleepDatasets = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("physionet_datasets")
    .select("id, slug, name, description, citation, source_url, uploaded_at, row_count, subjects_count, variables_count")
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DatasetSummary[];
});

const datasetIdSchema = z.object({ datasetId: z.string().uuid() });

export const getSleepStats = createServerFn({ method: "POST" })
  .inputValidator((data) => datasetIdSchema.parse(data))
  .handler(async ({ data }): Promise<AggregateStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("physionet_sleep_records")
      .select("subject_id, recording_date, total_sleep_min, deep_min, light_min, rem_min, awake_min, sleep_efficiency, latency_min, waso_min, quality_score, night_index")
      .eq("dataset_id", data.datasetId)
      .limit(20000);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<Record<string, number | string | null>>;

    const subjects = new Set<string>();
    const dates: string[] = [];
    const fields: FieldKey[] = [
      "subject_id","recording_date","night_index","total_sleep_min","deep_min","light_min","rem_min","awake_min","sleep_efficiency","latency_min","waso_min","quality_score",
    ];
    const completeness = Object.fromEntries(fields.map((f) => [f, 0])) as Record<FieldKey, number>;

    const tsts: number[] = [];
    const ses: number[] = [];
    const deeps: number[] = [];
    const rems: number[] = [];
    const qs: number[] = [];
    const bySubject = new Map<string, { tst: number[]; se: number[] }>();

    for (const r of list) {
      subjects.add(String(r.subject_id));
      for (const f of fields) if (r[f] != null && r[f] !== "") completeness[f]++;
      if (typeof r.recording_date === "string") dates.push(r.recording_date);
      if (typeof r.total_sleep_min === "number") tsts.push(r.total_sleep_min);
      if (typeof r.sleep_efficiency === "number") ses.push(r.sleep_efficiency);
      if (typeof r.deep_min === "number") deeps.push(r.deep_min);
      if (typeof r.rem_min === "number") rems.push(r.rem_min);
      if (typeof r.quality_score === "number") qs.push(r.quality_score);
      const s = String(r.subject_id);
      const agg = bySubject.get(s) ?? { tst: [], se: [] };
      if (typeof r.total_sleep_min === "number") agg.tst.push(r.total_sleep_min);
      if (typeof r.sleep_efficiency === "number") agg.se.push(r.sleep_efficiency);
      bySubject.set(s, agg);
    }

    const mean = (a: number[]) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : null);
    const total = Math.max(1, list.length);
    for (const f of fields) completeness[f] = +(completeness[f] / total).toFixed(3);

    // Quality bins (0–10 in 1-wide buckets; if data uses 0–100 scale, we bucket by tens).
    let qualityBins: AggregateStats["qualityBins"] = [];
    if (qs.length) {
      const maxQ = Math.max(...qs);
      const width = maxQ > 10 ? 10 : 1;
      const buckets = new Map<number, number>();
      for (const v of qs) {
        const b = Math.floor(v / width) * width;
        buckets.set(b, (buckets.get(b) ?? 0) + 1);
      }
      qualityBins = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([b, c]) => ({
        bin: `${b}${width === 10 ? `-${b + 9}` : ""}`,
        count: c,
      }));
    }

    const subjectAgg = [...bySubject.entries()]
      .map(([subject, v]) => ({
        subject,
        nights: v.tst.length,
        tst: mean(v.tst) ?? 0,
        se: mean(v.se) ?? 0,
      }))
      .sort((a, b) => b.nights - a.nights)
      .slice(0, 40);

    dates.sort();
    return {
      nRecords: list.length,
      nSubjects: subjects.size,
      dateStart: dates[0] ?? null,
      dateEnd: dates[dates.length - 1] ?? null,
      meanTST: mean(tsts),
      meanSE: mean(ses),
      meanDeep: mean(deeps),
      meanREM: mean(rems),
      completeness,
      qualityBins,
      subjectAgg,
    };
  });

export const deleteSleepDataset = createServerFn({ method: "POST" })
  .inputValidator((data) => datasetIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("physionet_datasets").delete().eq("id", data.datasetId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
