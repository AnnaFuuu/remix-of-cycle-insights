import { createServerFn } from "@tanstack/react-start";
import type { FeatureRow } from "./features.functions";
import { FEATURE_DEFS } from "./features.functions";
import { getTrainValTestSplit } from "./split.functions";
import { PHASES, type PhaseKey } from "./split.functions";

// -----------------------------------------------------------------------------
// Step 5 · Menstrual phase classification
//
// Target = `phase` ∈ {Menstrual, Follicular, Fertility, Luteal}. Predictors =
// every non-phase, non-identifier, non-timestamp feature (including LH / E3G /
// PdG when observed; the Step-4 imputer supplies them for new users).
//
// Three algorithms compete on the same participant-level 60/20/20 split as
// Steps 1/4:
//   · Softmax Gradient Boosted Trees (K trees per round, one per class)
//   · Random Forest classifier        (bagged trees, majority vote)
//   · Multinomial Logistic Regression (softmax + L2, full-batch GD)
//
// Winner = highest macro-F1 on validation. Held-out test metrics are the
// reported number. Confusion matrix + per-class precision/recall/F1 + top
// gain-based feature importances are all returned to the UI.
// -----------------------------------------------------------------------------

export type AlgoName = "softmax_gbrt" | "random_forest" | "logistic_regression";
export const CLASSES: PhaseKey[] = PHASES; // stable index → {0:Menstrual,1:Follicular,2:Fertility,3:Luteal}
const K = CLASSES.length;

export interface ClassMetrics {
  precision: number; recall: number; f1: number; support: number;
}
export interface AlgoResult {
  algo: AlgoName;
  label: string;
  hyperparams: Record<string, number | string>;
  accuracy: { train: number; val: number; test: number };
  macroF1:  { train: number; val: number; test: number };
  logLoss:  { train: number; val: number; test: number };
  perClass: { val: Record<PhaseKey, ClassMetrics>; test: Record<PhaseKey, ClassMetrics> };
  confusion: { val: number[][]; test: number[][] }; // K x K, rows = true, cols = pred
  fitMs: number;
}
export interface FeatureImportance { key: string; label: string; importance: number; }
export interface ClassificationResult {
  classes: PhaseKey[];
  predictors: string[];
  trainN: number; valN: number; testN: number;
  classCounts: { train: Record<PhaseKey, number>; val: Record<PhaseKey, number>; test: Record<PhaseKey, number> };
  algos: AlgoResult[];
  bestAlgo: AlgoName;
  featureImportances: FeatureImportance[]; // top-15 for winner (empty if logistic)
  refreshedAt: string;
  notes: string;
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------
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
function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t === "-" || t === "--" || /^na$/i.test(t) || /^n\/a$/i.test(t)) return null;
    const n = Number(t); return Number.isFinite(n) ? n : null;
  }
  return null;
}
function softmax(logits: Float64Array): Float64Array {
  const out = new Float64Array(logits.length);
  let mx = -Infinity;
  for (let i = 0; i < logits.length; i++) if (logits[i] > mx) mx = logits[i];
  let s = 0;
  for (let i = 0; i < logits.length; i++) { out[i] = Math.exp(logits[i] - mx); s += out[i]; }
  for (let i = 0; i < logits.length; i++) out[i] /= s || 1;
  return out;
}
function argmax(a: ArrayLike<number>): number {
  let bi = 0, bv = -Infinity;
  for (let i = 0; i < a.length; i++) if (a[i] > bv) { bv = a[i]; bi = i; }
  return bi;
}

// -----------------------------------------------------------------------------
// Trees (regression tree for GBRT residuals; classification tree for RF)
// -----------------------------------------------------------------------------
interface TreeNode {
  leaf?: number;                              // regression leaf value
  probs?: Float64Array;                       // classification leaf (RF)
  feature?: number; threshold?: number;
  left?: TreeNode; right?: TreeNode;
  gain?: number;                              // for importance
}
interface TreeOpts {
  maxDepth: number;
  minSamples: number;
  mtry: number;
  candidates: number;
  lambda?: number;
  rng: () => number;
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

// XGBoost-style regression tree on residuals w/ L2 leaf regularization.
function buildRegTreeL2(
  X: Float64Array[], residuals: Float64Array, indices: Int32Array,
  depth: number, opts: TreeOpts, importance: Float64Array,
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
  let bestGain = 0, bestFeat = -1, bestThr = 0;
  let bestLeft: Int32Array | null = null, bestRight: Int32Array | null = null;

  for (const f of trialFeats) {
    const vals: number[] = new Array(n);
    for (let i = 0; i < n; i++) vals[i] = X[indices[i]][f];
    const thrs = quantileThresholds(vals, opts.candidates);
    for (const thr of thrs) {
      let ls = 0, rs = 0, lc = 0, rc = 0;
      for (let i = 0; i < n; i++) {
        const g = residuals[indices[i]];
        if (vals[i] <= thr) { ls += g; lc++; } else { rs += g; rc++; }
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
  importance[bestFeat] += bestGain;
  return {
    feature: bestFeat, threshold: bestThr, gain: bestGain,
    left: buildRegTreeL2(X, residuals, bestLeft, depth + 1, opts, importance),
    right: buildRegTreeL2(X, residuals, bestRight, depth + 1, opts, importance),
  };
}

// Classification tree (Gini splits, K-class probabilities at leaves).
function buildClsTree(
  X: Float64Array[], y: Int32Array, indices: Int32Array,
  depth: number, opts: TreeOpts, importance: Float64Array,
): TreeNode {
  const n = indices.length;
  if (n === 0) return { probs: new Float64Array(K).fill(1 / K) };

  const counts = new Float64Array(K);
  for (let i = 0; i < n; i++) counts[y[indices[i]]]++;
  const probs = new Float64Array(K);
  for (let k = 0; k < K; k++) probs[k] = counts[k] / n;

  // Gini impurity
  let gini = 1;
  for (let k = 0; k < K; k++) gini -= probs[k] * probs[k];
  if (depth >= opts.maxDepth || n < opts.minSamples || gini < 1e-6) return { probs };

  const nFeats = X[0].length;
  const featOrder = shuffle(Array.from({ length: nFeats }, (_, i) => i), opts.rng);
  const trialFeats = featOrder.slice(0, Math.min(opts.mtry, nFeats));

  let bestGain = 0, bestFeat = -1, bestThr = 0;
  let bestLeft: Int32Array | null = null, bestRight: Int32Array | null = null;

  for (const f of trialFeats) {
    const vals: number[] = new Array(n);
    for (let i = 0; i < n; i++) vals[i] = X[indices[i]][f];
    const thrs = quantileThresholds(vals, opts.candidates);
    for (const thr of thrs) {
      const lc = new Float64Array(K), rc = new Float64Array(K);
      let ln = 0, rn = 0;
      for (let i = 0; i < n; i++) {
        const yi = y[indices[i]];
        if (vals[i] <= thr) { lc[yi]++; ln++; } else { rc[yi]++; rn++; }
      }
      if (ln < 1 || rn < 1) continue;
      let lg = 1, rg = 1;
      for (let k = 0; k < K; k++) { const p = lc[k] / ln; lg -= p * p; const q = rc[k] / rn; rg -= q * q; }
      const childGini = (ln * lg + rn * rg) / n;
      const gain = gini - childGini;
      if (gain > bestGain) {
        bestGain = gain; bestFeat = f; bestThr = thr;
        const l = new Int32Array(ln), r = new Int32Array(rn);
        let li = 0, ri = 0;
        for (let i = 0; i < n; i++) {
          if (vals[i] <= thr) l[li++] = indices[i]; else r[ri++] = indices[i];
        }
        bestLeft = l; bestRight = r;
      }
    }
  }
  if (bestFeat === -1 || !bestLeft || !bestRight) return { probs };
  importance[bestFeat] += bestGain * n;
  return {
    feature: bestFeat, threshold: bestThr, gain: bestGain,
    left: buildClsTree(X, y, bestLeft, depth + 1, opts, importance),
    right: buildClsTree(X, y, bestRight, depth + 1, opts, importance),
  };
}

function predictRegTree(node: TreeNode, x: Float64Array): number {
  let cur = node;
  while (cur.leaf === undefined) cur = x[cur.feature!] <= cur.threshold! ? cur.left! : cur.right!;
  return cur.leaf;
}
function predictClsTree(node: TreeNode, x: Float64Array): Float64Array {
  let cur = node;
  while (!cur.probs) cur = x[cur.feature!] <= cur.threshold! ? cur.left! : cur.right!;
  return cur.probs;
}

// -----------------------------------------------------------------------------
// Softmax GBRT
// -----------------------------------------------------------------------------
interface SoftmaxGBRT {
  kind: "sgb";
  base: Float64Array;                        // per-class log-prior
  rounds: TreeNode[][];                      // rounds[t][k]
  lr: number;
  importance: Float64Array;
}
function fitSoftmaxGBRT(
  X: Float64Array[], y: Int32Array, hp: { nTrees: number; maxDepth: number; lr: number; mtry: number; minSamples: number; candidates: number; lambda: number; seed: number; classWeight: Float64Array },
): SoftmaxGBRT {
  const n = X.length;
  const nFeat = X[0].length;
  const rng = mulberry32(hp.seed);
  // Log-prior init (helps convergence)
  const counts = new Float64Array(K);
  for (let i = 0; i < n; i++) counts[y[i]]++;
  const base = new Float64Array(K);
  for (let k = 0; k < K; k++) base[k] = Math.log((counts[k] + 1) / (n + K));
  // F[i][k]
  const F = new Array(n).fill(0).map(() => {
    const r = new Float64Array(K);
    for (let k = 0; k < K; k++) r[k] = base[k];
    return r;
  });
  const rounds: TreeNode[][] = [];
  const importance = new Float64Array(nFeat);

  for (let t = 0; t < hp.nTrees; t++) {
    // Compute residuals (y_ik - p_ik), weighted by class weight
    const perClassResid: Float64Array[] = [];
    for (let k = 0; k < K; k++) perClassResid.push(new Float64Array(n));
    for (let i = 0; i < n; i++) {
      const p = softmax(F[i]);
      const w = hp.classWeight[y[i]];
      for (let k = 0; k < K; k++) {
        const yik = y[i] === k ? 1 : 0;
        perClassResid[k][i] = (yik - p[k]) * w;
      }
    }
    const roundTrees: TreeNode[] = [];
    for (let k = 0; k < K; k++) {
      const idx = new Int32Array(n); for (let i = 0; i < n; i++) idx[i] = i;
      const tree = buildRegTreeL2(X, perClassResid[k], idx, 0, {
        maxDepth: hp.maxDepth, minSamples: hp.minSamples, mtry: hp.mtry,
        candidates: hp.candidates, lambda: hp.lambda, rng,
      }, importance);
      roundTrees.push(tree);
      for (let i = 0; i < n; i++) F[i][k] += hp.lr * predictRegTree(tree, X[i]);
    }
    rounds.push(roundTrees);
  }
  return { kind: "sgb", base, rounds, lr: hp.lr, importance };
}
function predictProbaSGB(m: SoftmaxGBRT, x: Float64Array): Float64Array {
  const F = new Float64Array(K);
  for (let k = 0; k < K; k++) F[k] = m.base[k];
  for (const round of m.rounds) {
    for (let k = 0; k < K; k++) F[k] += m.lr * predictRegTree(round[k], x);
  }
  return softmax(F);
}

// -----------------------------------------------------------------------------
// Random Forest classifier
// -----------------------------------------------------------------------------
interface RFClassifier {
  kind: "rf";
  trees: TreeNode[];
  importance: Float64Array;
}
function fitRandomForest(
  X: Float64Array[], y: Int32Array, hp: { nTrees: number; maxDepth: number; mtry: number; minSamples: number; candidates: number; seed: number },
): RFClassifier {
  const n = X.length;
  const nFeat = X[0].length;
  const rng = mulberry32(hp.seed);
  const trees: TreeNode[] = [];
  const importance = new Float64Array(nFeat);
  for (let t = 0; t < hp.nTrees; t++) {
    const idx = new Int32Array(n);
    for (let i = 0; i < n; i++) idx[i] = Math.floor(rng() * n);
    trees.push(buildClsTree(X, y, idx, 0, {
      maxDepth: hp.maxDepth, minSamples: hp.minSamples, mtry: hp.mtry,
      candidates: hp.candidates, rng,
    }, importance));
  }
  return { kind: "rf", trees, importance };
}
function predictProbaRF(m: RFClassifier, x: Float64Array): Float64Array {
  const out = new Float64Array(K);
  for (const t of m.trees) {
    const p = predictClsTree(t, x);
    for (let k = 0; k < K; k++) out[k] += p[k];
  }
  for (let k = 0; k < K; k++) out[k] /= m.trees.length;
  return out;
}

// -----------------------------------------------------------------------------
// Multinomial Logistic Regression (softmax + L2, full-batch GD)
// -----------------------------------------------------------------------------
interface LogRegModel {
  kind: "lr";
  W: Float64Array[]; // K x nFeat
  b: Float64Array;   // K
  mu: Float64Array; sd: Float64Array; // standardisation
}
function fitLogReg(
  X: Float64Array[], y: Int32Array, hp: { epochs: number; lr: number; l2: number; classWeight: Float64Array },
): LogRegModel {
  const n = X.length;
  const nFeat = X[0].length;
  // Standardise
  const mu = new Float64Array(nFeat), sd = new Float64Array(nFeat);
  for (let f = 0; f < nFeat; f++) {
    let s = 0; for (let i = 0; i < n; i++) s += X[i][f];
    mu[f] = s / n;
    let v = 0; for (let i = 0; i < n; i++) { const d = X[i][f] - mu[f]; v += d * d; }
    sd[f] = Math.sqrt(v / n) || 1;
  }
  const Xs = X.map((row) => {
    const r = new Float64Array(nFeat);
    for (let f = 0; f < nFeat; f++) r[f] = (row[f] - mu[f]) / sd[f];
    return r;
  });
  const W: Float64Array[] = [];
  for (let k = 0; k < K; k++) W.push(new Float64Array(nFeat));
  const b = new Float64Array(K);

  for (let ep = 0; ep < hp.epochs; ep++) {
    const gW: Float64Array[] = [];
    for (let k = 0; k < K; k++) gW.push(new Float64Array(nFeat));
    const gb = new Float64Array(K);
    for (let i = 0; i < n; i++) {
      const logits = new Float64Array(K);
      for (let k = 0; k < K; k++) {
        let z = b[k]; const wk = W[k]; const xi = Xs[i];
        for (let f = 0; f < nFeat; f++) z += wk[f] * xi[f];
        logits[k] = z;
      }
      const p = softmax(logits);
      const w = hp.classWeight[y[i]];
      for (let k = 0; k < K; k++) {
        const err = (p[k] - (y[i] === k ? 1 : 0)) * w;
        gb[k] += err;
        const gk = gW[k]; const xi = Xs[i];
        for (let f = 0; f < nFeat; f++) gk[f] += err * xi[f];
      }
    }
    for (let k = 0; k < K; k++) {
      b[k] -= hp.lr * gb[k] / n;
      const gk = gW[k], wk = W[k];
      for (let f = 0; f < nFeat; f++) wk[f] -= hp.lr * (gk[f] / n + hp.l2 * wk[f]);
    }
  }
  return { kind: "lr", W, b, mu, sd };
}
function predictProbaLR(m: LogRegModel, x: Float64Array): Float64Array {
  const nFeat = x.length;
  const logits = new Float64Array(K);
  for (let k = 0; k < K; k++) {
    let z = m.b[k]; const wk = m.W[k];
    for (let f = 0; f < nFeat; f++) z += wk[f] * ((x[f] - m.mu[f]) / m.sd[f]);
    logits[k] = z;
  }
  return softmax(logits);
}

type AnyModel = SoftmaxGBRT | RFClassifier | LogRegModel;
function predictProba(m: AnyModel, x: Float64Array): Float64Array {
  if (m.kind === "sgb") return predictProbaSGB(m, x);
  if (m.kind === "rf")  return predictProbaRF(m, x);
  return predictProbaLR(m, x);
}

// -----------------------------------------------------------------------------
// Metrics
// -----------------------------------------------------------------------------
function computeMetrics(y: Int32Array, probs: Float64Array[]): {
  accuracy: number; macroF1: number; logLoss: number;
  perClass: Record<PhaseKey, ClassMetrics>; confusion: number[][];
} {
  const n = y.length;
  const conf: number[][] = Array.from({ length: K }, () => new Array<number>(K).fill(0));
  let correct = 0, ll = 0;
  for (let i = 0; i < n; i++) {
    const p = probs[i];
    const pred = argmax(p);
    conf[y[i]][pred]++;
    if (pred === y[i]) correct++;
    const py = Math.max(1e-12, p[y[i]]);
    ll -= Math.log(py);
  }
  const perClass: Record<PhaseKey, ClassMetrics> = {} as Record<PhaseKey, ClassMetrics>;
  let macroF1 = 0;
  for (let k = 0; k < K; k++) {
    const tp = conf[k][k];
    let fp = 0, fn = 0;
    for (let j = 0; j < K; j++) if (j !== k) { fp += conf[j][k]; fn += conf[k][j]; }
    const support = tp + fn;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = support > 0 ? tp / support : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    perClass[CLASSES[k]] = {
      precision: +precision.toFixed(4),
      recall:    +recall.toFixed(4),
      f1:        +f1.toFixed(4),
      support,
    };
    macroF1 += f1;
  }
  macroF1 /= K;
  return {
    accuracy: +(correct / (n || 1)).toFixed(4),
    macroF1:  +macroF1.toFixed(4),
    logLoss:  +(ll / (n || 1)).toFixed(4),
    perClass,
    confusion: conf,
  };
}

// -----------------------------------------------------------------------------
// Predictor construction
// -----------------------------------------------------------------------------
const EXCLUDE = new Set(["phase", "participant_id", "day_in_study", "sleep_start", "sleep_end"]);
function selectPredictors(): string[] {
  return FEATURE_DEFS.map((d) => d.key).filter((k) => !EXCLUDE.has(k));
}

// In-worker cache for downstream inference.
const MODEL_CACHE: { model: AnyModel; predictors: string[]; medians: Float64Array; algo: AlgoName } | null = null;
export function getCachedClassifier() { return MODEL_CACHE; }

export const trainPhaseClassification = createServerFn({ method: "POST" }).handler(async (): Promise<ClassificationResult> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Load matview.
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
  const nFeat = predictors.length;

  // Class encoding
  const phaseIdx: Record<string, number> = {};
  CLASSES.forEach((c, i) => (phaseIdx[c] = i));

  // Filter rows with labels + a split assignment
  interface Row { i: number; y: number; s: "train" | "validation" | "test" }
  const kept: Row[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.phase || phaseIdx[r.phase] === undefined) continue;
    const s = assignment[r.participant_id];
    if (s !== "train" && s !== "validation" && s !== "test") continue;
    kept.push({ i, y: phaseIdx[r.phase], s });
  }

  // Train medians (per feature) for imputation.
  const medians = new Float64Array(nFeat);
  for (let f = 0; f < nFeat; f++) {
    const vals: number[] = [];
    const key = predictors[f];
    for (const k of kept) if (k.s === "train") { const v = toNum(rows[k.i][key]); if (v !== null) vals.push(v); }
    vals.sort((a, b) => a - b);
    medians[f] = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) >> 1] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : 0;
  }

  // Build design matrices.
  const build = (subset: "train" | "validation" | "test") => {
    const list = kept.filter((k) => k.s === subset);
    const X: Float64Array[] = new Array(list.length);
    const y = new Int32Array(list.length);
    for (let j = 0; j < list.length; j++) {
      const r = rows[list[j].i];
      const row = new Float64Array(nFeat);
      for (let f = 0; f < nFeat; f++) {
        const v = toNum(r[predictors[f]]);
        row[f] = v !== null ? v : medians[f];
      }
      X[j] = row; y[j] = list[j].y;
    }
    return { X, y };
  };
  const tr = build("train");
  const va = build("validation");
  const te = build("test");

  const classCounts = { train: {} as Record<PhaseKey, number>, val: {} as Record<PhaseKey, number>, test: {} as Record<PhaseKey, number> };
  for (const c of CLASSES) { classCounts.train[c] = 0; classCounts.val[c] = 0; classCounts.test[c] = 0; }
  for (const v of tr.y) classCounts.train[CLASSES[v]]++;
  for (const v of va.y) classCounts.val[CLASSES[v]]++;
  for (const v of te.y) classCounts.test[CLASSES[v]]++;

  // Inverse-frequency class weights from training set.
  const classWeight = new Float64Array(K);
  {
    const c = new Float64Array(K);
    for (const v of tr.y) c[v]++;
    const total = tr.y.length;
    for (let k = 0; k < K; k++) classWeight[k] = c[k] > 0 ? total / (K * c[k]) : 1;
  }

  const mtry = Math.max(3, Math.floor(Math.sqrt(nFeat)));
  const algos: AlgoResult[] = [];
  const trainedByAlgo: Record<AlgoName, AnyModel> = {} as Record<AlgoName, AnyModel>;

  const evalOn = (m: AnyModel, X: Float64Array[], y: Int32Array) => {
    const probs = X.map((x) => predictProba(m, x));
    return computeMetrics(y, probs);
  };

  // 1. Softmax GBRT
  {
    const hp = { nTrees: 60, maxDepth: 4, lr: 0.1, mtry: nFeat, minSamples: 5, candidates: 10, lambda: 1, seed: 42 };
    const t0 = performance.now();
    const m = fitSoftmaxGBRT(tr.X, tr.y, { ...hp, classWeight });
    const fitMs = +(performance.now() - t0).toFixed(0);
    trainedByAlgo.softmax_gbrt = m;
    const mt = evalOn(m, tr.X, tr.y);
    const mv = evalOn(m, va.X, va.y);
    const me = evalOn(m, te.X, te.y);
    algos.push({
      algo: "softmax_gbrt", label: "Softmax GBRT",
      hyperparams: { nTrees: hp.nTrees, maxDepth: hp.maxDepth, lr: hp.lr, lambda: hp.lambda },
      accuracy: { train: mt.accuracy, val: mv.accuracy, test: me.accuracy },
      macroF1:  { train: mt.macroF1,  val: mv.macroF1,  test: me.macroF1 },
      logLoss:  { train: mt.logLoss,  val: mv.logLoss,  test: me.logLoss },
      perClass: { val: mv.perClass, test: me.perClass },
      confusion: { val: mv.confusion, test: me.confusion },
      fitMs,
    });
  }

  // 2. Random Forest
  {
    const hp = { nTrees: 60, maxDepth: 10, mtry, minSamples: 5, candidates: 10, seed: 42 };
    const t0 = performance.now();
    const m = fitRandomForest(tr.X, tr.y, hp);
    const fitMs = +(performance.now() - t0).toFixed(0);
    trainedByAlgo.random_forest = m;
    const mt = evalOn(m, tr.X, tr.y);
    const mv = evalOn(m, va.X, va.y);
    const me = evalOn(m, te.X, te.y);
    algos.push({
      algo: "random_forest", label: "Random Forest",
      hyperparams: { nTrees: hp.nTrees, maxDepth: hp.maxDepth, mtry: hp.mtry },
      accuracy: { train: mt.accuracy, val: mv.accuracy, test: me.accuracy },
      macroF1:  { train: mt.macroF1,  val: mv.macroF1,  test: me.macroF1 },
      logLoss:  { train: mt.logLoss,  val: mv.logLoss,  test: me.logLoss },
      perClass: { val: mv.perClass, test: me.perClass },
      confusion: { val: mv.confusion, test: me.confusion },
      fitMs,
    });
  }

  // 3. Multinomial Logistic Regression
  {
    const hp = { epochs: 200, lr: 0.3, l2: 1e-3 };
    const t0 = performance.now();
    const m = fitLogReg(tr.X, tr.y, { ...hp, classWeight });
    const fitMs = +(performance.now() - t0).toFixed(0);
    trainedByAlgo.logistic_regression = m;
    const mt = evalOn(m, tr.X, tr.y);
    const mv = evalOn(m, va.X, va.y);
    const me = evalOn(m, te.X, te.y);
    algos.push({
      algo: "logistic_regression", label: "Multinomial Logistic Regression",
      hyperparams: { epochs: hp.epochs, lr: hp.lr, l2: hp.l2 },
      accuracy: { train: mt.accuracy, val: mv.accuracy, test: me.accuracy },
      macroF1:  { train: mt.macroF1,  val: mv.macroF1,  test: me.macroF1 },
      logLoss:  { train: mt.logLoss,  val: mv.logLoss,  test: me.logLoss },
      perClass: { val: mv.perClass, test: me.perClass },
      confusion: { val: mv.confusion, test: me.confusion },
      fitMs,
    });
  }

  // Pick winner by validation macro-F1.
  let bestAlgo: AlgoName = algos[0].algo;
  let bestVal = -Infinity;
  for (const a of algos) if (a.macroF1.val > bestVal) { bestVal = a.macroF1.val; bestAlgo = a.algo; }

  // Feature importances for tree-based winners
  const winnerModel = trainedByAlgo[bestAlgo];
  let featureImportances: FeatureImportance[] = [];
  const labelByKey = new Map(FEATURE_DEFS.map((d) => [d.key, d.label]));
  if (winnerModel.kind === "sgb" || winnerModel.kind === "rf") {
    const imp = winnerModel.importance;
    let total = 0; for (let f = 0; f < imp.length; f++) total += imp[f];
    const arr: FeatureImportance[] = [];
    for (let f = 0; f < imp.length; f++) {
      const norm = total > 0 ? imp[f] / total : 0;
      arr.push({ key: predictors[f], label: labelByKey.get(predictors[f]) ?? predictors[f], importance: +norm.toFixed(4) });
    }
    arr.sort((a, b) => b.importance - a.importance);
    featureImportances = arr.slice(0, 15);
  }

  return {
    classes: CLASSES,
    predictors,
    trainN: tr.y.length, valN: va.y.length, testN: te.y.length,
    classCounts,
    algos,
    bestAlgo,
    featureImportances,
    refreshedAt: new Date().toISOString(),
    notes: "Winner selected by validation macro-F1; class weights = inverse train frequency; imputation uses train-set medians.",
  };
});
