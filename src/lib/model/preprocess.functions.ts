import { createServerFn } from "@tanstack/react-start";
import { FEATURE_DEFS, type FeatureRow } from "./features.functions";
import { getTrainValTestSplit } from "./split.functions";

export type ImputeStrategy = "knn-continuous" | "knn-categorical" | "preserve" | "skip";

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
  // Fallback used when KNN neighbors have no observed value for this feature.
  fallback: number | string | null;
  // For continuous features: mean/std learned from train (used to z-score for distance).
  mean: number | null;
  std: number | null;
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
  knn: {
    k: number;
    referenceSize: number;
    distanceMetric: string;
    notes: string;
  };
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

// KNN hyperparameters. k=5 is standard for KNNImputer (sklearn default).
// Reference is capped for tractable in-worker computation; sampling is deterministic.
const K_NEIGHBORS = 5;
const REFERENCE_CAP = 1200;

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
      return { key: d.key, label: d.label, group: d.group, type: "categorical", strategy: "knn-categorical",
        rationale: "Ordinal self-report — KNN-imputed via the mode of the 5 nearest training neighbors (preserves the discrete scale while conditioning on physiology)." };
    }
    return { key: d.key, label: d.label, group: d.group, type: "continuous", strategy: "knn-continuous",
      rationale: "Continuous physiological signal — KNN-imputed via the mean of the 5 nearest training neighbors (Euclidean distance on z-scored observed features)." };
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

function mean(nums: number[]): number | null {
  if (!nums.length) return null;
  let s = 0;
  for (const n of nums) s += n;
  return s / nums.length;
}

function std(nums: number[], mu: number): number {
  if (nums.length < 2) return 1;
  let s = 0;
  for (const n of nums) s += (n - mu) * (n - mu);
  const v = s / (nums.length - 1);
  const sd = Math.sqrt(v);
  return sd > 1e-9 ? sd : 1;
}

// Deterministic PRNG (Mulberry32) so the reference subsample is reproducible.
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
  const imputableSpecs = specs.filter((s) => s.strategy === "knn-continuous" || s.strategy === "knn-categorical");

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
      } else if (s.type === "categorical") {
        // Coerce ordinal self-reports to numeric where possible.
        const n = toNumber(v);
        out[s.key] = n !== null ? n : v;
      }
    }
    return out;
  });

  const trainRows = sanitized.filter((r) => assignment[r.participant_id] === "train");

  // Learn per-feature statistics from train only: mean/std (for z-scoring the
  // distance metric) and a global fallback (median for continuous, mode for
  // ordinal) used when the KNN neighborhood has no observed value.
  const params: ImputationParam[] = specs.map((s) => {
    if (s.strategy === "knn-continuous") {
      const nums: number[] = [];
      for (const r of trainRows) {
        const n = r[s.key];
        if (typeof n === "number" && Number.isFinite(n)) nums.push(n);
      }
      const mu = mean(nums);
      const sd = mu !== null ? std(nums, mu) : null;
      return {
        key: s.key, strategy: s.strategy,
        fallback: median(nums), mean: mu, std: sd,
        trainNonNull: nums.length, trainMissing: trainRows.length - nums.length,
      };
    }
    if (s.strategy === "knn-categorical") {
      const vals: (number | string)[] = [];
      const nums: number[] = [];
      for (const r of trainRows) {
        const v = r[s.key];
        if (v !== null && v !== undefined) vals.push(v as number | string);
        if (typeof v === "number" && Number.isFinite(v)) nums.push(v);
      }
      const mu = nums.length ? mean(nums) : null;
      const sd = mu !== null ? std(nums, mu) : null;
      return {
        key: s.key, strategy: s.strategy,
        fallback: mode(vals), mean: mu, std: sd,
        trainNonNull: vals.length, trainMissing: trainRows.length - vals.length,
      };
    }
    // preserve / skip: no learned value.
    let nonNull = 0;
    for (const r of trainRows) if (r[s.key] !== null && r[s.key] !== undefined) nonNull++;
    return {
      key: s.key, strategy: s.strategy,
      fallback: null, mean: null, std: null,
      trainNonNull: nonNull, trainMissing: trainRows.length - nonNull,
    };
  });

  const paramByKey = new Map(params.map((p) => [p.key, p]));

  // ---- Build the KNN reference matrix from train (deterministic subsample). ----
  // Rows are z-scored; missing entries stay as NaN and are ignored in the
  // pairwise distance (mean of squared diffs over jointly observed features).
  const featKeys = imputableSpecs.map((s) => s.key);
  const featCount = featKeys.length;
  const toZ = (r: FeatureRow): Float64Array => {
    const z = new Float64Array(featCount);
    for (let i = 0; i < featCount; i++) {
      const p = paramByKey.get(featKeys[i])!;
      const v = r[featKeys[i]];
      if (typeof v === "number" && Number.isFinite(v) && p.mean !== null && p.std !== null) {
        z[i] = (v - p.mean) / p.std;
      } else {
        z[i] = Number.NaN;
      }
    }
    return z;
  };

  const rng = mulberry32(42);
  const trainIdx = trainRows.map((_, i) => i);
  // Fisher–Yates shuffle for a stable reference subsample.
  for (let i = trainIdx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [trainIdx[i], trainIdx[j]] = [trainIdx[j], trainIdx[i]];
  }
  const refPick = trainIdx.slice(0, Math.min(REFERENCE_CAP, trainIdx.length));
  const refRows = refPick.map((i) => trainRows[i]);
  const refZ = refRows.map(toZ);
  // Pre-cache raw observed values per reference row for the imputation step.
  const refRaw: (number | string | null)[][] = refRows.map((r) =>
    featKeys.map((k) => {
      const v = r[k];
      return v === undefined || v === null ? null : (v as number | string);
    }),
  );

  // Impute one row: returns a new FeatureRow with KNN fills applied.
  function imputeRow(row: FeatureRow): FeatureRow {
    const out: FeatureRow = { ...row };
    const qz = toZ(row);
    // Find missing imputable features for this row.
    const missIdx: number[] = [];
    for (let i = 0; i < featCount; i++) {
      const v = row[featKeys[i]];
      if (v === null || v === undefined) missIdx.push(i);
    }
    if (missIdx.length === 0) return out;

    // Distances (query → each ref) — ignore self by identity where present.
    const dists = new Float64Array(refRows.length);
    for (let r = 0; r < refRows.length; r++) {
      const rz = refZ[r];
      let sum = 0;
      let n = 0;
      for (let i = 0; i < featCount; i++) {
        const a = qz[i];
        const b = rz[i];
        if (Number.isNaN(a) || Number.isNaN(b)) continue;
        const d = a - b;
        sum += d * d;
        n++;
      }
      // Scale by total feature count so rows with more overlap aren't unfairly closer.
      dists[r] = n > 0 ? Math.sqrt((sum / n) * featCount) : Number.POSITIVE_INFINITY;
    }

    // Argsort indices by distance ascending; we just need the top-K per target.
    const order = new Int32Array(refRows.length);
    for (let i = 0; i < order.length; i++) order[i] = i;
    order.sort((a, b) => dists[a] - dists[b]);

    for (const mi of missIdx) {
      const spec = imputableSpecs[mi];
      const p = paramByKey.get(spec.key)!;
      // Walk sorted neighbors, collecting up to K that have the target observed.
      if (spec.strategy === "knn-continuous") {
        const vals: number[] = [];
        for (let r = 0; r < order.length && vals.length < K_NEIGHBORS; r++) {
          const raw = refRaw[order[r]][mi];
          if (typeof raw === "number" && Number.isFinite(raw)) vals.push(raw);
        }
        const filled = vals.length ? mean(vals) : p.fallback;
        if (filled !== null && filled !== undefined) out[spec.key] = filled as number;
      } else {
        const vals: (number | string)[] = [];
        for (let r = 0; r < order.length && vals.length < K_NEIGHBORS; r++) {
          const raw = refRaw[order[r]][mi];
          if (raw !== null && raw !== undefined) vals.push(raw);
        }
        const filled = vals.length ? mode(vals) : p.fallback;
        if (filled !== null && filled !== undefined) out[spec.key] = filled;
      }
    }
    return out;
  }

  // Apply KNN to each split, compute before/after missingness.
  const splitsOut: SplitMissingness[] = (["train", "validation", "test"] as const).map((name) => {
    const subset = sanitized.filter((r) => assignment[r.participant_id] === name);
    const before: Record<string, number> = {};
    const after: Record<string, number> = {};
    for (const s of specs) { before[s.key] = 0; after[s.key] = 0; }
    for (const r of subset) {
      for (const s of specs) {
        if (r[s.key] === null || r[s.key] === undefined) before[s.key]++;
      }
      const filled = imputeRow(r);
      for (const s of specs) {
        if (filled[s.key] === null || filled[s.key] === undefined) after[s.key]++;
      }
    }
    const n = subset.length || 1;
    for (const s of specs) { before[s.key] /= n; after[s.key] /= n; }
    return { split: name, rows: subset.length, before, after };
  });

  // Build preview from train, imputed.
  const preview: FeatureRow[] = trainRows.slice(0, 25).map((r) => imputeRow(r));

  return {
    specs,
    params,
    splits: splitsOut,
    sanitizedDashCount,
    preview,
    knn: {
      k: K_NEIGHBORS,
      referenceSize: refRows.length,
      distanceMetric: "Euclidean on z-scored features (per-pair mean-of-squared-diffs over jointly observed features, rescaled by feature count)",
      notes: "Reference rows are a deterministic (seed=42) subsample of the training split, capped at 1200 rows for tractable in-worker computation.",
    },
    refreshedAt: new Date().toISOString(),
  };
});