import { createServerFn } from "@tanstack/react-start";
import type { FeatureRow } from "./features.functions";
import { FEATURE_DEFS } from "./features.functions";
import { getTrainValTestSplit } from "./split.functions";

// -----------------------------------------------------------------------------
// Hormone regression pipeline (Step 4).
//
// One row per participant-day; each hormone target (LH, estrogen) is trained
// separately. Predictors = every non-hormone, non-phase, non-timestamp feature
// (predictors never include another hormone, so the model is usable when the
// user only supplies wearables). We fit three families:
//   · Random Forest        · bagged regression trees w/ feature subsampling
//   · Gradient Boosting    · shallow trees on residuals (learning rate 0.05)
//   · XGBoost-style GBRT   · gradient boosting w/ L2 leaf regularization (λ=1)
// Fit on train, tune / select on validation (highest R²), report held-out
// test metrics. Best model per hormone is cached in-memory for inference.
// -----------------------------------------------------------------------------

export type HormoneTarget = "lh" | "estrogen";
export type AlgoName = "random_forest" | "gradient_boosting" | "xgboost";

export interface Metrics { mae: number; rmse: number; r2: number; n: number }
export interface AlgoResult {
  algo: AlgoName;
  label: string;
  hyperparams: Record<string, number>;
  train: Metrics; val: Metrics; test: Metrics;
  fitMs: number;
}
export interface HormoneResult {
  target: HormoneTarget;
  label: string;
  unit: string;
  predictors: string[];
  trainN: number; valN: number; testN: number;
  yMean: number; yStd: number;
  algos: AlgoResult[];
  bestAlgo: AlgoName;
  bestVal: Metrics;
  bestTest: Metrics;
}
export interface RegressionResult {
  hormones: HormoneResult[];
  refreshedAt: string;
  notes: string;
}

// -----------------------------------------------------------------------------
// Regression tree ­ variance-reduction splits over quantile candidates.
// -----------------------------------------------------------------------------
interface TreeNode {
  leaf?: number;
  feature?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}
interface TreeOpts {
  maxDepth: number;
  minSamples: number;
  mtry: number;         // # features to consider per split
  candidates: number;   // # quantile thresholds per feature
  lambda?: number;      // L2 leaf regularization (XGBoost-style)
  rng: () => number;
}

function mean(a: number[]): number { let s = 0; for (const v of a) s += v; return a.length ? s / a.length : 0; }
function variance(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a); let s = 0;
  for (const v of a) { const d = v - m; s += d * d; }
  return s / a.length;
}
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
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function quantileThresholds(vals: number[], k: number): number[] {
  const s = vals.slice().sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 1; i <= k; i++) {
    const q = i / (k + 1);
    const idx = Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)));
    const v = s[idx];
    if (!out.length || v !== out[out.length - 1]) out.push(v);
  }
  return out;
}

function buildTree(
  X: Float64Array[], y: number[], indices: Int32Array, depth: number, opts: TreeOpts,
): TreeNode {
  const n = indices.length;
  if (n === 0) return { leaf: 0 };
  const ys = new Array(n);
  for (let i = 0; i < n; i++) ys[i] = y[indices[i]];
  const nodeMean = mean(ys);

  if (depth >= opts.maxDepth || n < opts.minSamples || variance(ys) < 1e-8) {
    return { leaf: nodeMean };
  }
  const nFeats = X[0].length;
  // Sample mtry features without replacement.
  const featOrder = shuffle(Array.from({ length: nFeats }, (_, i) => i), opts.rng);
  const trialFeats = featOrder.slice(0, Math.min(opts.mtry, nFeats));

  const parentSSE = variance(ys) * n;
  let bestGain = 0;
  let bestFeat = -1, bestThr = 0, bestLeft: Int32Array | null = null, bestRight: Int32Array | null = null;

  for (const f of trialFeats) {
    const vals: number[] = new Array(n);
    for (let i = 0; i < n; i++) vals[i] = X[indices[i]][f];
    const thrs = quantileThresholds(vals, opts.candidates);
    for (const thr of thrs) {
      let ls = 0, rs = 0, lc = 0, rc = 0, ls2 = 0, rs2 = 0;
      for (let i = 0; i < n; i++) {
        const yv = ys[i]; const xv = vals[i];
        if (xv <= thr) { ls += yv; ls2 += yv * yv; lc++; }
        else { rs += yv; rs2 += yv * yv; rc++; }
      }
      if (lc < 1 || rc < 1) continue;
      const lVar = ls2 / lc - (ls / lc) ** 2;
      const rVar = rs2 / rc - (rs / rc) ** 2;
      const childSSE = lVar * lc + rVar * rc;
      const gain = parentSSE - childSSE;
      if (gain > bestGain) {
        bestGain = gain; bestFeat = f; bestThr = thr;
        const l = new Int32Array(lc); const r = new Int32Array(rc);
        let li = 0, ri = 0;
        for (let i = 0; i < n; i++) {
          if (vals[i] <= thr) l[li++] = indices[i]; else r[ri++] = indices[i];
        }
        bestLeft = l; bestRight = r;
      }
    }
  }
  if (bestFeat === -1 || !bestLeft || !bestRight) return { leaf: nodeMean };
  return {
    feature: bestFeat, threshold: bestThr,
    left: buildTree(X, y, bestLeft, depth + 1, opts),
    right: buildTree(X, y, bestRight, depth + 1, opts),
  };
}

function predictTree(node: TreeNode, x: Float64Array): number {
  let cur = node;
  while (cur.leaf === undefined) {
    cur = x[cur.feature!] <= cur.threshold! ? cur.left! : cur.right!;
  }
  return cur.leaf;
}

// XGBoost-style leaf value: sum(g) / (n + λ)   where g = residual
function buildTreeL2(
  X: Float64Array[], residuals: number[], indices: Int32Array, depth: number, opts: TreeOpts,
): TreeNode {
  const n = indices.length;
  const lambda = opts.lambda ?? 1;
  if (n === 0) return { leaf: 0 };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += residuals[indices[i]];
  const nodeVal = sum / (n + lambda);

  if (depth >= opts.maxDepth || n < opts.minSamples) return { leaf: nodeVal };

  const nFeats = X[0].length;
  const featOrder = shuffle(Array.from({ length: nFeats }, (_, i) => i), opts.rng);
  const trialFeats = featOrder.slice(0, Math.min(opts.mtry, nFeats));

  const parentScore = (sum * sum) / (n + lambda);
  let bestGain = 0;
  let bestFeat = -1, bestThr = 0, bestLeft: Int32Array | null = null, bestRight: Int32Array | null = null;

  for (const f of trialFeats) {
    const vals: number[] = new Array(n);
    for (let i = 0; i < n; i++) vals[i] = X[indices[i]][f];
    const thrs = quantileThresholds(vals, opts.candidates);
    for (const thr of thrs) {
      let ls = 0, rs = 0, lc = 0, rc = 0;
      for (let i = 0; i < n; i++) {
        const g = residuals[indices[i]]; const xv = vals[i];
        if (xv <= thr) { ls += g; lc++; } else { rs += g; rc++; }
      }
      if (lc < 1 || rc < 1) continue;
      const gain = (ls * ls) / (lc + lambda) + (rs * rs) / (rc + lambda) - parentScore;
      if (gain > bestGain) {
        bestGain = gain; bestFeat = f; bestThr = thr;
        const l = new Int32Array(lc); const r = new Int32Array(rc);
        let li = 0, ri = 0;
        for (let i = 0; i < n; i++) {
          if (vals[i] <= thr) l[li++] = indices[i]; else r[ri++] = indices[i];
        }
        bestLeft = l; bestRight = r;
      }
    }
  }
  if (bestFeat === -1 || !bestLeft || !bestRight) return { leaf: nodeVal };
  return {
    feature: bestFeat, threshold: bestThr,
    left: buildTreeL2(X, residuals, bestLeft, depth + 1, opts),
    right: buildTreeL2(X, residuals, bestRight, depth + 1, opts),
  };
}

// -----------------------------------------------------------------------------
// Ensembles
// -----------------------------------------------------------------------------
interface RFModel { kind: "rf"; trees: TreeNode[] }
interface GBModel { kind: "gb" | "xgb"; base: number; trees: TreeNode[]; lr: number }
type Model = RFModel | GBModel;

function fitRandomForest(X: Float64Array[], y: number[], hp: {
  nTrees: number; maxDepth: number; mtry: number; minSamples: number; candidates: number; seed: number;
}): RFModel {
  const rng = mulberry32(hp.seed);
  const trees: TreeNode[] = [];
  const n = X.length;
  for (let t = 0; t < hp.nTrees; t++) {
    const idx = new Int32Array(n);
    for (let i = 0; i < n; i++) idx[i] = Math.floor(rng() * n); // bootstrap
    trees.push(buildTree(X, y, idx, 0, {
      maxDepth: hp.maxDepth, minSamples: hp.minSamples, mtry: hp.mtry,
      candidates: hp.candidates, rng,
    }));
  }
  return { kind: "rf", trees };
}

function fitGradientBoosting(X: Float64Array[], y: number[], hp: {
  nTrees: number; maxDepth: number; lr: number; mtry: number; minSamples: number; candidates: number; seed: number;
}): GBModel {
  const rng = mulberry32(hp.seed);
  const base = mean(y);
  const preds = new Array(X.length).fill(base);
  const trees: TreeNode[] = [];
  for (let t = 0; t < hp.nTrees; t++) {
    const resid = new Array(X.length);
    for (let i = 0; i < X.length; i++) resid[i] = y[i] - preds[i];
    const idx = new Int32Array(X.length);
    for (let i = 0; i < X.length; i++) idx[i] = i;
    const tree = buildTree(X, resid, idx, 0, {
      maxDepth: hp.maxDepth, minSamples: hp.minSamples, mtry: hp.mtry,
      candidates: hp.candidates, rng,
    });
    trees.push(tree);
    for (let i = 0; i < X.length; i++) preds[i] += hp.lr * predictTree(tree, X[i]);
  }
  return { kind: "gb", base, trees, lr: hp.lr };
}

function fitXGB(X: Float64Array[], y: number[], hp: {
  nTrees: number; maxDepth: number; lr: number; mtry: number; minSamples: number;
  candidates: number; lambda: number; seed: number;
}): GBModel {
  const rng = mulberry32(hp.seed);
  const base = mean(y);
  const preds = new Array(X.length).fill(base);
  const trees: TreeNode[] = [];
  for (let t = 0; t < hp.nTrees; t++) {
    const resid = new Array(X.length);
    for (let i = 0; i < X.length; i++) resid[i] = y[i] - preds[i];
    const idx = new Int32Array(X.length);
    for (let i = 0; i < X.length; i++) idx[i] = i;
    const tree = buildTreeL2(X, resid, idx, 0, {
      maxDepth: hp.maxDepth, minSamples: hp.minSamples, mtry: hp.mtry,
      candidates: hp.candidates, lambda: hp.lambda, rng,
    });
    trees.push(tree);
    for (let i = 0; i < X.length; i++) preds[i] += hp.lr * predictTree(tree, X[i]);
  }
  return { kind: "xgb", base, trees, lr: hp.lr };
}

function predictModel(m: Model, x: Float64Array): number {
  if (m.kind === "rf") {
    let s = 0;
    for (const t of m.trees) s += predictTree(t, x);
    return s / m.trees.length;
  }
  let p = m.base;
  for (const t of m.trees) p += m.lr * predictTree(t, x);
  return p;
}

function metrics(y: number[], yhat: number[]): Metrics {
  const n = y.length;
  if (!n) return { mae: 0, rmse: 0, r2: 0, n: 0 };
  let ae = 0, se = 0;
  for (let i = 0; i < n; i++) { const d = y[i] - yhat[i]; ae += Math.abs(d); se += d * d; }
  const mae = ae / n; const rmse = Math.sqrt(se / n);
  const ym = mean(y); let tss = 0;
  for (let i = 0; i < n; i++) { const d = y[i] - ym; tss += d * d; }
  const r2 = tss > 1e-12 ? 1 - se / tss : 0;
  return { mae: +mae.toFixed(4), rmse: +rmse.toFixed(4), r2: +r2.toFixed(4), n };
}

// -----------------------------------------------------------------------------
// Predictor construction
// -----------------------------------------------------------------------------
const EXCLUDE_FROM_PREDICTORS = new Set([
  "phase", "lh", "estrogen", "pdg", "sleep_start", "sleep_end",
  "participant_id", "day_in_study",
]);

function selectPredictors(): string[] {
  return FEATURE_DEFS.map((d) => d.key).filter((k) => !EXCLUDE_FROM_PREDICTORS.has(k));
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "" || t === "-" || t === "--" || t.toUpperCase() === "NA" || t.toUpperCase() === "N/A") return null;
    const n = Number(t); return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Cached models (module-scope in-worker cache — sufficient for interactive use).
const MODEL_CACHE: Partial<Record<HormoneTarget, { model: Model; predictors: string[]; medians: number[]; algo: AlgoName }>> = {};

export const trainHormoneRegression = createServerFn({ method: "POST" }).handler(async (): Promise<RegressionResult> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Pull merged daily features (paged).
  const rows: FeatureRow[] = [];
  const pageSize = 1000; let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin.from("mcphases_daily_features" as any) as any)
      .select("*").order("participant_id", { ascending: true }).order("day_in_study", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as FeatureRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const split = await getTrainValTestSplit({ data: { seed: 42 } });
  const assignment = split.assignment;
  const predictors = selectPredictors();

  // Build a global row-level predictor matrix once.
  const nRows = rows.length;
  const nFeat = predictors.length;
  const trainMedians = new Float64Array(nFeat);
  // Compute train medians per feature.
  const bySplit = { train: [] as number[], validation: [] as number[], test: [] as number[] };
  for (let i = 0; i < nRows; i++) {
    const s = assignment[rows[i].participant_id];
    if (s === "train" || s === "validation" || s === "test") bySplit[s].push(i);
  }
  for (let f = 0; f < nFeat; f++) {
    const key = predictors[f];
    const vals: number[] = [];
    for (const i of bySplit.train) { const v = toNum(rows[i][key]); if (v !== null) vals.push(v); }
    vals.sort((a, b) => a - b);
    trainMedians[f] = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) >> 1] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : 0;
  }

  // Predictor matrix with train-median imputation.
  const X: Float64Array[] = new Array(nRows);
  for (let i = 0; i < nRows; i++) {
    const row = new Float64Array(nFeat);
    for (let f = 0; f < nFeat; f++) {
      const v = toNum(rows[i][predictors[f]]);
      row[f] = v !== null ? v : trainMedians[f];
    }
    X[i] = row;
  }

  const hormoneMeta: Record<HormoneTarget, { label: string; unit: string }> = {
    lh:       { label: "LH",              unit: "urinary strip (a.u.)" },
    estrogen: { label: "Estrogen (E3G)",  unit: "urinary strip (a.u.)" },
  };

  const results: HormoneResult[] = [];
  const targets: HormoneTarget[] = ["lh", "estrogen"];

  for (const target of targets) {
    // Rows where hormone is observed, per split.
    const idxTr: number[] = []; const idxVa: number[] = []; const idxTe: number[] = [];
    for (let i = 0; i < nRows; i++) {
      const y = toNum(rows[i][target]); if (y === null) continue;
      const s = assignment[rows[i].participant_id];
      if (s === "train") idxTr.push(i);
      else if (s === "validation") idxVa.push(i);
      else if (s === "test") idxTe.push(i);
    }
    const Xtr = idxTr.map((i) => X[i]); const ytr = idxTr.map((i) => toNum(rows[i][target])!);
    const Xva = idxVa.map((i) => X[i]); const yva = idxVa.map((i) => toNum(rows[i][target])!);
    const Xte = idxTe.map((i) => X[i]); const yte = idxTe.map((i) => toNum(rows[i][target])!);

    const yMean = mean(ytr);
    let yss = 0; for (const v of ytr) { const d = v - yMean; yss += d * d; }
    const yStd = ytr.length > 1 ? Math.sqrt(yss / (ytr.length - 1)) : 0;

    const mtry = Math.max(3, Math.floor(Math.sqrt(nFeat)));
    const algos: AlgoResult[] = [];
    const trained: Record<AlgoName, Model> = { random_forest: null as unknown as Model, gradient_boosting: null as unknown as Model, xgboost: null as unknown as Model };

    // Random Forest
    {
      const hp = { nTrees: 40, maxDepth: 8, mtry, minSamples: 5, candidates: 12, seed: 42 };
      const t0 = performance.now();
      const m = fitRandomForest(Xtr, ytr, hp);
      const fitMs = +(performance.now() - t0).toFixed(0);
      trained.random_forest = m;
      algos.push({
        algo: "random_forest", label: "Random Forest", hyperparams: hp, fitMs,
        train: metrics(ytr, Xtr.map((x) => predictModel(m, x))),
        val: metrics(yva, Xva.map((x) => predictModel(m, x))),
        test: metrics(yte, Xte.map((x) => predictModel(m, x))),
      });
    }
    // Gradient Boosting
    {
      const hp = { nTrees: 120, maxDepth: 3, lr: 0.05, mtry: nFeat, minSamples: 5, candidates: 12, seed: 42 };
      const t0 = performance.now();
      const m = fitGradientBoosting(Xtr, ytr, hp);
      const fitMs = +(performance.now() - t0).toFixed(0);
      trained.gradient_boosting = m;
      algos.push({
        algo: "gradient_boosting", label: "Gradient Boosting", hyperparams: hp, fitMs,
        train: metrics(ytr, Xtr.map((x) => predictModel(m, x))),
        val: metrics(yva, Xva.map((x) => predictModel(m, x))),
        test: metrics(yte, Xte.map((x) => predictModel(m, x))),
      });
    }
    // XGBoost-style (L2-regularized GBRT)
    {
      const hp = { nTrees: 150, maxDepth: 4, lr: 0.05, mtry: Math.max(mtry * 2, 12), minSamples: 5, candidates: 16, lambda: 1, seed: 42 };
      const t0 = performance.now();
      const m = fitXGB(Xtr, ytr, hp);
      const fitMs = +(performance.now() - t0).toFixed(0);
      trained.xgboost = m;
      algos.push({
        algo: "xgboost", label: "XGBoost (L2-regularized GBRT)", hyperparams: hp, fitMs,
        train: metrics(ytr, Xtr.map((x) => predictModel(m, x))),
        val: metrics(yva, Xva.map((x) => predictModel(m, x))),
        test: metrics(yte, Xte.map((x) => predictModel(m, x))),
      });
    }

    // Select best by validation R² (higher is better).
    let best = algos[0];
    for (const a of algos) if (a.val.r2 > best.val.r2) best = a;
    MODEL_CACHE[target] = {
      model: trained[best.algo], predictors, medians: Array.from(trainMedians) as unknown as number[] & Float64Array,
      algo: best.algo,
    };

    results.push({
      target, label: hormoneMeta[target].label, unit: hormoneMeta[target].unit,
      predictors, trainN: ytr.length, valN: yva.length, testN: yte.length,
      yMean: +yMean.toFixed(3), yStd: +yStd.toFixed(3),
      algos, bestAlgo: best.algo, bestVal: best.val, bestTest: best.test,
    });
  }

  return {
    hormones: results,
    refreshedAt: new Date().toISOString(),
    notes: "Predictors exclude phase, hormones, and timestamps. Missing predictors are filled with the train-set median (learned on train only). Best model per hormone is selected by validation R² and cached in-worker so inference on new user rows uses the saved artifact.",
  };
});

// Inference API for callers with wearables-only rows (predictors keyed by feature name).
// Values omitted / null fall back to the train medians persisted from the last fit.
export const predictHormones = createServerFn({ method: "POST" })
  .inputValidator((d: { row: Record<string, number | null | undefined | string> }) => d)
  .handler(async ({ data }): Promise<{ lh: number | null; estrogen: number | null; algos: Partial<Record<HormoneTarget, AlgoName>> }> => {
    const out: { lh: number | null; estrogen: number | null; algos: Partial<Record<HormoneTarget, AlgoName>> } = { lh: null, estrogen: null, algos: {} };
    for (const t of ["lh", "estrogen"] as HormoneTarget[]) {
      const entry = MODEL_CACHE[t]; if (!entry) continue;
      const x = new Float64Array(entry.predictors.length);
      for (let f = 0; f < entry.predictors.length; f++) {
        const v = toNum(data.row[entry.predictors[f]]);
        x[f] = v !== null ? v : entry.medians[f];
      }
      out[t] = +predictModel(entry.model, x).toFixed(3);
      out.algos[t] = entry.algo;
    }
    return out;
  });