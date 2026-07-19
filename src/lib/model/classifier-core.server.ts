// -----------------------------------------------------------------------------
// Phase-classifier core: model types, training, inference, serialization.
// Server-only (imported by classification.functions.ts and predict.functions.ts).
// Split out per the `tanstack-serverfn-splitting` guidance so handlers stay thin.
// -----------------------------------------------------------------------------

import type { PhaseKey } from "./split.functions";
import { PHASES } from "./split.functions";

export const CLASSES: PhaseKey[] = PHASES;
export const K = CLASSES.length;

export type AlgoName = "softmax_gbrt" | "random_forest" | "logistic_regression";

export interface ClassMetrics { precision: number; recall: number; f1: number; support: number }

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t === "-" || t === "--" || /^na$/i.test(t) || /^n\/a$/i.test(t)) return null;
    const n = Number(t); return Number.isFinite(n) ? n : null;
  }
  return null;
}
export function softmax(logits: Float64Array): Float64Array {
  const out = new Float64Array(logits.length);
  let mx = -Infinity;
  for (let i = 0; i < logits.length; i++) if (logits[i] > mx) mx = logits[i];
  let s = 0;
  for (let i = 0; i < logits.length; i++) { out[i] = Math.exp(logits[i] - mx); s += out[i]; }
  for (let i = 0; i < logits.length; i++) out[i] /= s || 1;
  return out;
}
export function argmax(a: ArrayLike<number>): number {
  let bi = 0, bv = -Infinity;
  for (let i = 0; i < a.length; i++) if (a[i] > bv) { bv = a[i]; bi = i; }
  return bi;
}

// -----------------------------------------------------------------------------
// Trees
// -----------------------------------------------------------------------------
export interface TreeNode {
  leaf?: number;
  probs?: Float64Array;
  feature?: number; threshold?: number;
  left?: TreeNode; right?: TreeNode;
  gain?: number;
}
export interface TreeOpts {
  maxDepth: number; minSamples: number; mtry: number; candidates: number;
  lambda?: number; rng: () => number;
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

export function buildRegTreeL2(
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

export function buildClsTree(
  X: Float64Array[], y: Int32Array, indices: Int32Array,
  depth: number, opts: TreeOpts, importance: Float64Array,
): TreeNode {
  const n = indices.length;
  if (n === 0) return { probs: new Float64Array(K).fill(1 / K) };

  const counts = new Float64Array(K);
  for (let i = 0; i < n; i++) counts[y[indices[i]]]++;
  const probs = new Float64Array(K);
  for (let k = 0; k < K; k++) probs[k] = counts[k] / n;

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
// Model families
// -----------------------------------------------------------------------------
export interface SoftmaxGBRT {
  kind: "sgb"; base: Float64Array; rounds: TreeNode[][]; lr: number; importance: Float64Array;
}
export interface RFClassifier {
  kind: "rf"; trees: TreeNode[]; importance: Float64Array;
}
export interface LogRegModel {
  kind: "lr"; W: Float64Array[]; b: Float64Array; mu: Float64Array; sd: Float64Array;
}
export type AnyModel = SoftmaxGBRT | RFClassifier | LogRegModel;

export function fitSoftmaxGBRT(
  X: Float64Array[], y: Int32Array,
  hp: { nTrees: number; maxDepth: number; lr: number; mtry: number; minSamples: number; candidates: number; lambda: number; seed: number; classWeight: Float64Array },
): SoftmaxGBRT {
  const n = X.length;
  const nFeat = X[0].length;
  const rng = mulberry32(hp.seed);
  const counts = new Float64Array(K);
  for (let i = 0; i < n; i++) counts[y[i]]++;
  const base = new Float64Array(K);
  for (let k = 0; k < K; k++) base[k] = Math.log((counts[k] + 1) / (n + K));
  const F = new Array(n).fill(0).map(() => {
    const r = new Float64Array(K);
    for (let k = 0; k < K; k++) r[k] = base[k];
    return r;
  });
  const rounds: TreeNode[][] = [];
  const importance = new Float64Array(nFeat);
  for (let t = 0; t < hp.nTrees; t++) {
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

export function fitRandomForest(
  X: Float64Array[], y: Int32Array,
  hp: { nTrees: number; maxDepth: number; mtry: number; minSamples: number; candidates: number; seed: number },
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

export function fitLogReg(
  X: Float64Array[], y: Int32Array,
  hp: { epochs: number; lr: number; l2: number; classWeight: Float64Array },
): LogRegModel {
  const n = X.length;
  const nFeat = X[0].length;
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

export function predictProba(m: AnyModel, x: Float64Array): Float64Array {
  if (m.kind === "sgb") return predictProbaSGB(m, x);
  if (m.kind === "rf")  return predictProbaRF(m, x);
  return predictProbaLR(m, x);
}

// -----------------------------------------------------------------------------
// Metrics
// -----------------------------------------------------------------------------
export function computeMetrics(y: Int32Array, probs: Float64Array[]): {
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
// Serialization — Float64Array must become plain arrays for jsonb storage.
// -----------------------------------------------------------------------------
type SerNode = {
  leaf?: number;
  probs?: number[];
  feature?: number; threshold?: number;
  left?: SerNode; right?: SerNode;
};
export type SerializedArtifact =
  | { kind: "sgb"; base: number[]; rounds: SerNode[][]; lr: number }
  | { kind: "rf";  trees: SerNode[] }
  | { kind: "lr";  W: number[][]; b: number[]; mu: number[]; sd: number[] };

function serNode(n: TreeNode): SerNode {
  const o: SerNode = {};
  if (n.leaf !== undefined) o.leaf = n.leaf;
  if (n.probs !== undefined) o.probs = Array.from(n.probs);
  if (n.feature !== undefined) o.feature = n.feature;
  if (n.threshold !== undefined) o.threshold = n.threshold;
  if (n.left) o.left = serNode(n.left);
  if (n.right) o.right = serNode(n.right);
  return o;
}
function deNode(n: SerNode): TreeNode {
  const o: TreeNode = {};
  if (n.leaf !== undefined) o.leaf = n.leaf;
  if (n.probs !== undefined) o.probs = Float64Array.from(n.probs);
  if (n.feature !== undefined) o.feature = n.feature;
  if (n.threshold !== undefined) o.threshold = n.threshold;
  if (n.left) o.left = deNode(n.left);
  if (n.right) o.right = deNode(n.right);
  return o;
}
export function serializeModel(m: AnyModel): SerializedArtifact {
  if (m.kind === "sgb") return { kind: "sgb", base: Array.from(m.base), rounds: m.rounds.map((r) => r.map(serNode)), lr: m.lr };
  if (m.kind === "rf")  return { kind: "rf",  trees: m.trees.map(serNode) };
  return { kind: "lr", W: m.W.map((w) => Array.from(w)), b: Array.from(m.b), mu: Array.from(m.mu), sd: Array.from(m.sd) };
}
export function deserializeModel(a: SerializedArtifact): AnyModel {
  if (a.kind === "sgb") return { kind: "sgb", base: Float64Array.from(a.base), rounds: a.rounds.map((r) => r.map(deNode)), lr: a.lr, importance: new Float64Array(0) };
  if (a.kind === "rf")  return { kind: "rf",  trees: a.trees.map(deNode), importance: new Float64Array(0) };
  return { kind: "lr", W: a.W.map((w) => Float64Array.from(w)), b: Float64Array.from(a.b), mu: Float64Array.from(a.mu), sd: Float64Array.from(a.sd) };
}
