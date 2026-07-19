import { createServerFn } from "@tanstack/react-start";
import { FEATURE_DEFS, type FeatureRow } from "./features.functions";
import { getTrainValTestSplit } from "./split.functions";

export type ImputeStrategy = "median" | "mode" | "preserve" | "skip";

export interface FeatureSpec {
  key: string;
  label: string;
  group: string;
  type: "continuous" | "categorical" | "hormone" | "label" | "timestamp";
  strategy: ImputeStrategy;
  rationale: string;
}

export interface ImputationParam {
  key: string;
  strategy: ImputeStrategy;
  value: number | string | null;
  trainNonNull: number;
  trainMissing: number;
}

export interface SplitMissingness {
  split: "train" | "validation" | "test";
  rows: number;
  before: Record<string, number>; // fraction missing before
  after: Record<string, number>;  // fraction missing after
}

export interface PreprocessResult {
  specs: FeatureSpec[];
  params: ImputationParam[];
  splits: SplitMissingness[];
  sanitizedDashCount: number;
  preview: FeatureRow[]; // 25 rows from train, post-imputation
  refreshedAt: string;
}

// Feature typing / strategy assignments.
const HORMONES = new Set(["lh", "estrogen", "pdg"]);
const CATEGORICAL = new Set([
  "cramps", "bloating", "fatigue", "headaches", "sorebreasts",
  "moodswing", "self_stress", "sleepissue",
]);
const TIMESTAMPS = new Set(["sleep_start", "sleep_end"]);
const LABELS = new Set(["phase"]);

export function buildFeatureSpecs(): FeatureSpec[] {
  return FEATURE_DEFS.map((d) => {
    if (LABELS.has(d.key)) {
      return { key: d.key, label: d.label, group: d.group, type: "label", strategy: "skip",
        rationale: "Classification target — never imputed; rows with missing label are excluded from supervised training." };
    }
    if (HORMONES.has(d.key)) {
      return { key: d.key, label: d.label, group: d.group, type: "hormone", strategy: "preserve",
        rationale: "Hormone biomarker — kept as NA so the dedicated hormone regression model estimates it at inference time." };
    }
    if (TIMESTAMPS.has(d.key)) {
      return { key: d.key, label: d.label, group: d.group, type: "timestamp", strategy: "skip",
        rationale: "Absolute timestamp — not used as a numeric predictor; derived durations carry the signal." };
    }
    if (CATEGORICAL.has(d.key)) {
      return { key: d.key, label: d.label, group: d.group, type: "categorical", strategy: "mode",
        rationale: "Ordinal self-report (0–5) — imputed with the training-set mode to preserve the discrete scale." };
    }
    return { key: d.key, label: d.label, group: d.group, type: "continuous", strategy: "median",
      rationale: "Continuous physiological signal — imputed with the training-set median (robust to skew and outliers)." };
  });
}

function isMissing(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "" || t === "-" || t === "--" || t.toUpperCase() === "NA" || t.toUpperCase() === "N/A" || t.toLowerCase() === "nan") return true;
  }
  if (typeof v === "number" && Number.isNaN(v)) return true;
  return false;
}

function toNumber(v: unknown): number | null {
  if (isMissing(v)) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = nums.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mode(vals: (number | string)[]): number | string | null {
  if (!vals.length) return null;
  const m = new Map<string, { v: number | string; c: number }>();
  for (const v of vals) {
    const k = String(v);
    const e = m.get(k);
    if (e) e.c++;
    else m.set(k, { v, c: 1 });
  }
  let best: { v: number | string; c: number } | null = null;
  for (const e of m.values()) if (!best || e.c > best.c) best = e;
  return best?.v ?? null;
}

export const getPreprocessing = createServerFn({ method: "GET" }).handler(async (): Promise<PreprocessResult> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Pull merged daily features.
  const rows: FeatureRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin.from("mcphases_daily_features" as any) as any)
      .select("*")
      .order("participant_id", { ascending: true })
      .order("day_in_study", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as FeatureRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const split = await getTrainValTestSplit({ data: { seed: 42 } });
  const assignment = split.assignment;

  const specs = buildFeatureSpecs();

  // Sanitize "-" style strings → null; count occurrences.
  let sanitizedDashCount = 0;
  const sanitized: FeatureRow[] = rows.map((r) => {
    const out: FeatureRow = { ...r };
    for (const s of specs) {
      const v = out[s.key];
      if (typeof v === "string" && (v.trim() === "-" || v.trim() === "--")) sanitizedDashCount++;
      if (isMissing(v)) out[s.key] = null;
      else if (s.type === "continuous" || s.type === "hormone") {
        const n = toNumber(v);
        out[s.key] = n;
      }
    }
    return out;
  });

  const trainRows = sanitized.filter((r) => assignment[r.participant_id] === "train");

  // Learn imputation params from train only.
  const params: ImputationParam[] = specs.map((s) => {
    if (s.strategy === "median") {
      const nums: number[] = [];
      for (const r of trainRows) {
        const n = r[s.key];
        if (typeof n === "number" && Number.isFinite(n)) nums.push(n);
      }
      const missing = trainRows.length - nums.length;
      return { key: s.key, strategy: s.strategy, value: median(nums), trainNonNull: nums.length, trainMissing: missing };
    }
    if (s.strategy === "mode") {
      const vals: (number | string)[] = [];
      for (const r of trainRows) {
        const v = r[s.key];
        if (v !== null && v !== undefined) vals.push(v as number | string);
      }
      const missing = trainRows.length - vals.length;
      return { key: s.key, strategy: s.strategy, value: mode(vals), trainNonNull: vals.length, trainMissing: missing };
    }
    // preserve / skip: no learned value.
    let nonNull = 0;
    for (const r of trainRows) if (r[s.key] !== null && r[s.key] !== undefined) nonNull++;
    return { key: s.key, strategy: s.strategy, value: null, trainNonNull: nonNull, trainMissing: trainRows.length - nonNull };
  });

  const paramByKey = new Map(params.map((p) => [p.key, p]));

  // Apply to each split, compute before/after missingness.
  const splitsOut: SplitMissingness[] = (["train", "validation", "test"] as const).map((name) => {
    const subset = sanitized.filter((r) => assignment[r.participant_id] === name);
    const before: Record<string, number> = {};
    const after: Record<string, number> = {};
    for (const s of specs) {
      let missBefore = 0;
      let missAfter = 0;
      for (const r of subset) {
        const v = r[s.key];
        const isMiss = v === null || v === undefined;
        if (isMiss) missBefore++;
        if (s.strategy === "median" || s.strategy === "mode") {
          const filled = paramByKey.get(s.key)?.value;
          if (isMiss && (filled === null || filled === undefined)) missAfter++;
        } else {
          if (isMiss) missAfter++;
        }
      }
      const n = subset.length || 1;
      before[s.key] = missBefore / n;
      after[s.key] = missAfter / n;
    }
    return { split: name, rows: subset.length, before, after };
  });

  // Build preview from train, imputed.
  const preview: FeatureRow[] = trainRows.slice(0, 25).map((r) => {
    const out: FeatureRow = { ...r };
    for (const s of specs) {
      if (s.strategy !== "median" && s.strategy !== "mode") continue;
      if (out[s.key] === null || out[s.key] === undefined) {
        const p = paramByKey.get(s.key);
        if (p && p.value !== null) out[s.key] = p.value as number | string;
      }
    }
    return out;
  });

  return {
    specs,
    params,
    splits: splitsOut,
    sanitizedDashCount,
    preview,
    refreshedAt: new Date().toISOString(),
  };
});