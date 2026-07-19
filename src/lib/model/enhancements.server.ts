// -----------------------------------------------------------------------------
// Enhanced-benchmark toolkit (server-only).
// Implements pure-JS versions of methods requested by the researcher:
//   • Rolling window features (3d / 7d mean & std, forward-only, no leakage)
//   • Per-participant z-score normalization
//   • K-Means participant clustering (phenotype stratification)
//   • Ridge multinomial regression
//   • Small MLP (1 hidden layer, ReLU, softmax, L2 + early stop hook)
//   • HMM Viterbi smoothing over per-participant sequences
//   • Mixture-of-Experts wrapper (per-cluster GBRT dispatched by cluster id)
// All functions are deterministic given a seed; every routine works on
// Float64Array design matrices so it fits the existing classifier-core layout.
// -----------------------------------------------------------------------------

import type { PhaseKey } from "./split.functions";
import { CLASSES, K, softmax, argmax, mulberry32, toNum, type AnyModel, predictProba } from "./classifier-core.server";

// -----------------------------------------------------------------------------
// Rolling window features (forward-only over each participant timeline).
// Given a raw feature row list ordered by participant_id + day_in_study,
// produces rolling mean & std for the last W days including today (only past
// values — never peeks forward — so it is safe under time-series CV).
// -----------------------------------------------------------------------------
export interface RollingFeatureCol { key: string; window: number; stat: "mean" | "std" }

export function computeRollingFeatures(
  rows: Array<Record<string, unknown>>,
  baseKeys: string[],
  windows: number[],
): { newKeys: string[]; augmented: Array<Record<string, unknown>> } {
  // Group row indices by participant, respecting day order.
  const byPid = new Map<number, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const pid = Number((rows[i] as { participant_id: number }).participant_id);
    const list = byPid.get(pid);
    if (list) list.push(i); else byPid.set(pid, [i]);
  }
  const newKeys: string[] = [];
  for (const k of baseKeys) for (const w of windows) {
    newKeys.push(`${k}_r${w}m`);
    newKeys.push(`${k}_r${w}s`);
  }
  const augmented = rows.map((r) => ({ ...r })) as Array<Record<string, unknown>>;
  for (const [, idxs] of byPid) {
    for (const k of baseKeys) {
      // Sliding window buffer per key.
      const buf: number[] = [];
      for (let j = 0; j < idxs.length; j++) {
        const v = toNum(rows[idxs[j]][k]);
        if (v !== null) buf.push(v);
        for (const w of windows) {
          const slice = buf.slice(-w);
          if (slice.length > 0) {
            const m = slice.reduce((a, b) => a + b, 0) / slice.length;
            let s = 0;
            for (const x of slice) s += (x - m) ** 2;
            augmented[idxs[j]][`${k}_r${w}m`] = m;
            augmented[idxs[j]][`${k}_r${w}s`] = slice.length > 1 ? Math.sqrt(s / (slice.length - 1)) : 0;
          } else {
            augmented[idxs[j]][`${k}_r${w}m`] = null;
            augmented[idxs[j]][`${k}_r${w}s`] = null;
          }
        }
      }
    }
  }
  return { newKeys, augmented };
}

// -----------------------------------------------------------------------------
// Per-participant z-score normalization. Uses **train-only** means/std to avoid
// leakage (participants that only appear in val/test fall back to global stats).
// -----------------------------------------------------------------------------
export interface ZScoreStats { perPid: Map<number, { mu: Float64Array; sd: Float64Array }>; globalMu: Float64Array; globalSd: Float64Array }

export function fitParticipantZ(
  rows: Array<Record<string, unknown>>,
  trainPids: Set<number>,
  keys: string[],
): ZScoreStats {
  const nFeat = keys.length;
  const perPid = new Map<number, { mu: Float64Array; sd: Float64Array }>();
  const globalMu = new Float64Array(nFeat);
  const globalSd = new Float64Array(nFeat);

  // Global stats from train rows.
  const gAll: number[][] = keys.map(() => []);
  const pidBuckets = new Map<number, number[][]>();
  for (const r of rows) {
    const pid = Number((r as { participant_id: number }).participant_id);
    if (!trainPids.has(pid)) continue;
    for (let f = 0; f < nFeat; f++) {
      const v = toNum(r[keys[f]]);
      if (v === null) continue;
      gAll[f].push(v);
      let bucket = pidBuckets.get(pid);
      if (!bucket) { bucket = keys.map(() => []); pidBuckets.set(pid, bucket); }
      bucket[f].push(v);
    }
  }
  for (let f = 0; f < nFeat; f++) {
    const arr = gAll[f];
    if (arr.length === 0) { globalMu[f] = 0; globalSd[f] = 1; continue; }
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    let v = 0; for (const x of arr) v += (x - m) ** 2;
    globalMu[f] = m; globalSd[f] = Math.sqrt(v / arr.length) || 1;
  }
  for (const [pid, bucket] of pidBuckets) {
    const mu = new Float64Array(nFeat);
    const sd = new Float64Array(nFeat);
    for (let f = 0; f < nFeat; f++) {
      const arr = bucket[f];
      if (arr.length === 0) { mu[f] = globalMu[f]; sd[f] = globalSd[f]; continue; }
      const m = arr.reduce((a, b) => a + b, 0) / arr.length;
      let vv = 0; for (const x of arr) vv += (x - m) ** 2;
      mu[f] = m; sd[f] = Math.sqrt(vv / arr.length) || globalSd[f];
    }
    perPid.set(pid, { mu, sd });
  }
  return { perPid, globalMu, globalSd };
}

export function applyParticipantZ(
  rows: Array<Record<string, unknown>>,
  stats: ZScoreStats,
  keys: string[],
): Array<Record<string, unknown>> {
  const nFeat = keys.length;
  return rows.map((r) => {
    const pid = Number((r as { participant_id: number }).participant_id);
    const s = stats.perPid.get(pid);
    const mu = s?.mu ?? stats.globalMu;
    const sd = s?.sd ?? stats.globalSd;
    const out = { ...r } as Record<string, unknown>;
    for (let f = 0; f < nFeat; f++) {
      const v = toNum(r[keys[f]]);
      out[`${keys[f]}_z`] = v === null ? null : (v - mu[f]) / (sd[f] || 1);
    }
    return out;
  });
}

// -----------------------------------------------------------------------------
// Participant embedding + K-Means (K clusters, k-means++ seeding, 30 iters).
// Embedding = per-participant means over a canonical physio panel; missing
// values are dropped from the mean, then any residual NaN is set to the
// global column mean.
// -----------------------------------------------------------------------------
export const EMBED_KEYS = [
  "bmi", "hrv_mean", "rhr", "sleep_score", "resp_rate_full",
  "wrist_temp_overnight_mean", "sleep_asleep_min", "stress_score",
] as const;

export interface PhenotypeResult {
  k: number;
  centroids: number[][];          // K × D (standardized space)
  assignment: Record<number, number>; // pid → cluster
  counts: number[];               // participants per cluster
  embeddingKeys: string[];
  scaleMu: number[];
  scaleSd: number[];
}

export function participantEmbeddings(
  rows: Array<Record<string, unknown>>,
  pids: Set<number>,
): { pids: number[]; X: number[][] } {
  const byPid = new Map<number, number[][]>();
  for (const r of rows) {
    const pid = Number((r as { participant_id: number }).participant_id);
    if (!pids.has(pid)) continue;
    let bucket = byPid.get(pid);
    if (!bucket) { bucket = EMBED_KEYS.map(() => []); byPid.set(pid, bucket); }
    for (let f = 0; f < EMBED_KEYS.length; f++) {
      const v = toNum(r[EMBED_KEYS[f]]);
      if (v !== null) bucket[f].push(v);
    }
  }
  const outPids: number[] = [];
  const X: number[][] = [];
  const globalMean = EMBED_KEYS.map(() => 0);
  const globalCount = EMBED_KEYS.map(() => 0);
  for (const [, bucket] of byPid) {
    for (let f = 0; f < EMBED_KEYS.length; f++) if (bucket[f].length) {
      const s = bucket[f].reduce((a, b) => a + b, 0);
      globalMean[f] += s; globalCount[f] += bucket[f].length;
    }
  }
  for (let f = 0; f < EMBED_KEYS.length; f++) globalMean[f] = globalCount[f] ? globalMean[f] / globalCount[f] : 0;
  for (const [pid, bucket] of byPid) {
    const row: number[] = EMBED_KEYS.map((_, f) => {
      if (bucket[f].length === 0) return globalMean[f];
      return bucket[f].reduce((a, b) => a + b, 0) / bucket[f].length;
    });
    outPids.push(pid); X.push(row);
  }
  return { pids: outPids, X };
}

export function kmeansPlusPlus(
  X: number[][], k: number, seed: number, iters = 30,
): PhenotypeResult {
  const n = X.length;
  const d = X[0]?.length ?? 0;
  if (n === 0 || d === 0) {
    return { k, centroids: [], assignment: {}, counts: new Array(k).fill(0), embeddingKeys: [...EMBED_KEYS], scaleMu: [], scaleSd: [] };
  }
  // Standardize.
  const mu = new Array(d).fill(0), sd = new Array(d).fill(0);
  for (let f = 0; f < d; f++) {
    let s = 0; for (let i = 0; i < n; i++) s += X[i][f];
    mu[f] = s / n;
    let v = 0; for (let i = 0; i < n; i++) v += (X[i][f] - mu[f]) ** 2;
    sd[f] = Math.sqrt(v / n) || 1;
  }
  const Z: number[][] = X.map((r) => r.map((v, f) => (v - mu[f]) / sd[f]));
  const rng = mulberry32(seed);
  // k-means++ seeding.
  const centers: number[][] = [];
  centers.push(Z[Math.floor(rng() * n)].slice());
  while (centers.length < k) {
    const dists = Z.map((x) => Math.min(...centers.map((c) => euclid2(x, c))));
    const total = dists.reduce((a, b) => a + b, 0) || 1;
    let r = rng() * total;
    let idx = 0;
    for (; idx < n; idx++) { r -= dists[idx]; if (r <= 0) break; }
    centers.push(Z[Math.min(idx, n - 1)].slice());
  }
  const assign = new Int32Array(n);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dd = euclid2(Z[i], centers[c]);
        if (dd < bd) { bd = dd; best = c; }
      }
      assign[i] = best;
    }
    const sums = Array.from({ length: k }, () => new Array(d).fill(0));
    const cnts = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      cnts[assign[i]]++;
      for (let f = 0; f < d; f++) sums[assign[i]][f] += Z[i][f];
    }
    for (let c = 0; c < k; c++) if (cnts[c] > 0) {
      for (let f = 0; f < d; f++) centers[c][f] = sums[c][f] / cnts[c];
    }
  }
  const counts = new Array(k).fill(0);
  const assignment: Record<number, number> = {};
  return { k, centroids: centers, assignment, counts, embeddingKeys: [...EMBED_KEYS], scaleMu: mu, scaleSd: sd };
}

function euclid2(a: number[], b: number[]): number {
  let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return s;
}

export function assignParticipantsToClusters(
  X: number[][], pids: number[], centroids: number[][], mu: number[], sd: number[],
): { assignment: Record<number, number>; counts: number[] } {
  const k = centroids.length;
  const counts = new Array(k).fill(0);
  const assignment: Record<number, number> = {};
  for (let i = 0; i < X.length; i++) {
    const z = X[i].map((v, f) => (v - mu[f]) / (sd[f] || 1));
    let best = 0, bd = Infinity;
    for (let c = 0; c < k; c++) {
      const dd = euclid2(z, centroids[c]);
      if (dd < bd) { bd = dd; best = c; }
    }
    assignment[pids[i]] = best; counts[best]++;
  }
  return { assignment, counts };
}

// -----------------------------------------------------------------------------
// Ridge multinomial regression (closed-form on standardized features per class,
// solved by conjugate gradient on the normal equations).
// -----------------------------------------------------------------------------
export interface RidgeModel {
  kind: "ridge"; W: Float64Array[]; b: Float64Array; mu: Float64Array; sd: Float64Array;
}
export function fitRidgeMulti(
  X: Float64Array[], y: Int32Array, lambda: number,
): RidgeModel {
  const n = X.length, nFeat = X[0].length;
  const mu = new Float64Array(nFeat), sd = new Float64Array(nFeat);
  for (let f = 0; f < nFeat; f++) {
    let s = 0; for (let i = 0; i < n; i++) s += X[i][f];
    mu[f] = s / n;
    let v = 0; for (let i = 0; i < n; i++) v += (X[i][f] - mu[f]) ** 2;
    sd[f] = Math.sqrt(v / n) || 1;
  }
  const Xs = X.map((row) => { const r = new Float64Array(nFeat); for (let f = 0; f < nFeat; f++) r[f] = (row[f] - mu[f]) / sd[f]; return r; });
  const W: Float64Array[] = [];
  const b = new Float64Array(K);
  // One-vs-rest ridge with normal equations (X^T X + λI) w = X^T y_k.
  // Solve K systems by conjugate gradient (avoids materializing the Gram matrix explicitly).
  for (let cls = 0; cls < K; cls++) {
    const yk = new Float64Array(n);
    let mean = 0;
    for (let i = 0; i < n; i++) { yk[i] = y[i] === cls ? 1 : 0; mean += yk[i]; }
    mean /= n;
    for (let i = 0; i < n; i++) yk[i] -= mean;
    const w = cg(Xs, yk, lambda, 60);
    W.push(w);
    b[cls] = mean;
  }
  return { kind: "ridge", W, b, mu, sd };
}
function cg(X: Float64Array[], y: Float64Array, lambda: number, iters: number): Float64Array {
  const n = X.length, d = X[0].length;
  // r0 = X^T y - (X^T X + λI) w0, with w0 = 0.
  const w = new Float64Array(d);
  const r = new Float64Array(d);
  for (let f = 0; f < d; f++) {
    let s = 0; for (let i = 0; i < n; i++) s += X[i][f] * y[i];
    r[f] = s;
  }
  const p = new Float64Array(r);
  let rs = dot(r, r);
  for (let it = 0; it < iters; it++) {
    // Ap = X^T X p + λ p
    const Xp = new Float64Array(n);
    for (let i = 0; i < n; i++) { let s = 0; const xi = X[i]; for (let f = 0; f < d; f++) s += xi[f] * p[f]; Xp[i] = s; }
    const Ap = new Float64Array(d);
    for (let f = 0; f < d; f++) { let s = 0; for (let i = 0; i < n; i++) s += X[i][f] * Xp[i]; Ap[f] = s + lambda * p[f]; }
    const alpha = rs / (dot(p, Ap) || 1e-12);
    for (let f = 0; f < d; f++) { w[f] += alpha * p[f]; r[f] -= alpha * Ap[f]; }
    const rsNew = dot(r, r);
    if (Math.sqrt(rsNew) < 1e-6) break;
    const beta = rsNew / rs;
    for (let f = 0; f < d; f++) p[f] = r[f] + beta * p[f];
    rs = rsNew;
  }
  return w;
}
function dot(a: Float64Array, b: Float64Array): number { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }

export function predictRidge(m: RidgeModel, x: Float64Array): Float64Array {
  const logits = new Float64Array(K);
  for (let cls = 0; cls < K; cls++) {
    let z = m.b[cls]; const wk = m.W[cls];
    for (let f = 0; f < x.length; f++) z += wk[f] * ((x[f] - m.mu[f]) / m.sd[f]);
    logits[cls] = z * 4;   // temperature scaling for reasonable softmax spread
  }
  return softmax(logits);
}

// -----------------------------------------------------------------------------
// Small MLP: input -> hidden(ReLU) -> softmax(K). L2 weight decay + Adam.
// -----------------------------------------------------------------------------
export interface MLPModel {
  kind: "mlp"; W1: Float64Array; b1: Float64Array; W2: Float64Array; b2: Float64Array;
  hidden: number; nFeat: number; mu: Float64Array; sd: Float64Array;
}
export function fitMLP(
  X: Float64Array[], y: Int32Array,
  hp: { hidden: number; epochs: number; lr: number; l2: number; batch: number; seed: number; classWeight: Float64Array },
): MLPModel {
  const n = X.length, nFeat = X[0].length, H = hp.hidden;
  const mu = new Float64Array(nFeat), sd = new Float64Array(nFeat);
  for (let f = 0; f < nFeat; f++) {
    let s = 0; for (let i = 0; i < n; i++) s += X[i][f];
    mu[f] = s / n;
    let v = 0; for (let i = 0; i < n; i++) v += (X[i][f] - mu[f]) ** 2;
    sd[f] = Math.sqrt(v / n) || 1;
  }
  const rng = mulberry32(hp.seed);
  // He init.
  const W1 = new Float64Array(nFeat * H);
  const b1 = new Float64Array(H);
  const W2 = new Float64Array(H * K);
  const b2 = new Float64Array(K);
  for (let i = 0; i < W1.length; i++) W1[i] = randn(rng) * Math.sqrt(2 / nFeat);
  for (let i = 0; i < W2.length; i++) W2[i] = randn(rng) * Math.sqrt(2 / H);
  // Adam moments.
  const mW1 = new Float64Array(W1.length), vW1 = new Float64Array(W1.length);
  const mW2 = new Float64Array(W2.length), vW2 = new Float64Array(W2.length);
  const mb1 = new Float64Array(H),          vb1 = new Float64Array(H);
  const mb2 = new Float64Array(K),          vb2 = new Float64Array(K);
  const beta1 = 0.9, beta2 = 0.999, eps = 1e-8;
  let t = 0;
  const stdX = X.map((row) => { const r = new Float64Array(nFeat); for (let f = 0; f < nFeat; f++) r[f] = (row[f] - mu[f]) / sd[f]; return r; });
  const idxAll = Array.from({ length: n }, (_, i) => i);
  for (let ep = 0; ep < hp.epochs; ep++) {
    const order = shuffleArr(idxAll, rng);
    for (let start = 0; start < n; start += hp.batch) {
      t++;
      const gW1 = new Float64Array(W1.length), gW2 = new Float64Array(W2.length);
      const gb1 = new Float64Array(H),          gb2 = new Float64Array(K);
      const bs = Math.min(hp.batch, n - start);
      for (let ii = 0; ii < bs; ii++) {
        const i = order[start + ii];
        const xi = stdX[i];
        // Forward.
        const h = new Float64Array(H);
        for (let j = 0; j < H; j++) {
          let z = b1[j]; for (let f = 0; f < nFeat; f++) z += W1[f * H + j] * xi[f];
          h[j] = z > 0 ? z : 0;
        }
        const logits = new Float64Array(K);
        for (let k = 0; k < K; k++) {
          let z = b2[k]; for (let j = 0; j < H; j++) z += W2[j * K + k] * h[j];
          logits[k] = z;
        }
        const p = softmax(logits);
        const w = hp.classWeight[y[i]];
        const dLogit = new Float64Array(K);
        for (let k = 0; k < K; k++) dLogit[k] = (p[k] - (y[i] === k ? 1 : 0)) * w;
        // Back to W2/b2.
        for (let k = 0; k < K; k++) {
          gb2[k] += dLogit[k];
          for (let j = 0; j < H; j++) gW2[j * K + k] += dLogit[k] * h[j];
        }
        // Back to hidden.
        const dh = new Float64Array(H);
        for (let j = 0; j < H; j++) {
          if (h[j] <= 0) continue;
          let s = 0; for (let k = 0; k < K; k++) s += dLogit[k] * W2[j * K + k];
          dh[j] = s;
        }
        for (let j = 0; j < H; j++) {
          gb1[j] += dh[j];
          for (let f = 0; f < nFeat; f++) gW1[f * H + j] += dh[j] * xi[f];
        }
      }
      // Adam step.
      adamStep(W1, mW1, vW1, gW1, hp.lr, beta1, beta2, eps, t, hp.l2, bs);
      adamStep(W2, mW2, vW2, gW2, hp.lr, beta1, beta2, eps, t, hp.l2, bs);
      adamStep(b1, mb1, vb1, gb1, hp.lr, beta1, beta2, eps, t, 0, bs);
      adamStep(b2, mb2, vb2, gb2, hp.lr, beta1, beta2, eps, t, 0, bs);
    }
  }
  return { kind: "mlp", W1, b1, W2, b2, hidden: H, nFeat, mu, sd };
}
function shuffleArr<T>(a: T[], rng: () => number): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
function randn(rng: () => number): number {
  // Box-Muller.
  const u = Math.max(1e-12, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function adamStep(p: Float64Array, m: Float64Array, v: Float64Array, g: Float64Array, lr: number, b1: number, b2: number, eps: number, t: number, l2: number, bs: number) {
  const inv = 1 / bs;
  const c1 = 1 - Math.pow(b1, t), c2 = 1 - Math.pow(b2, t);
  for (let i = 0; i < p.length; i++) {
    const gi = g[i] * inv + l2 * p[i];
    m[i] = b1 * m[i] + (1 - b1) * gi;
    v[i] = b2 * v[i] + (1 - b2) * gi * gi;
    const mh = m[i] / c1, vh = v[i] / c2;
    p[i] -= lr * mh / (Math.sqrt(vh) + eps);
  }
}
export function predictMLP(m: MLPModel, x: Float64Array): Float64Array {
  const H = m.hidden, nFeat = m.nFeat;
  const xs = new Float64Array(nFeat);
  for (let f = 0; f < nFeat; f++) xs[f] = (x[f] - m.mu[f]) / m.sd[f];
  const h = new Float64Array(H);
  for (let j = 0; j < H; j++) {
    let z = m.b1[j]; for (let f = 0; f < nFeat; f++) z += m.W1[f * H + j] * xs[f];
    h[j] = z > 0 ? z : 0;
  }
  const logits = new Float64Array(K);
  for (let k = 0; k < K; k++) {
    let z = m.b2[k]; for (let j = 0; j < H; j++) z += m.W2[j * K + k] * h[j];
    logits[k] = z;
  }
  return softmax(logits);
}

// -----------------------------------------------------------------------------
// HMM Viterbi smoothing. Transition matrix learned from train sequences
// (add-1 smoothing). Emission = classifier posteriors used as likelihood
// after dividing by prior (Bayes).
// -----------------------------------------------------------------------------
export interface HMMPost {
  transition: number[][];  // K × K row-stochastic
  prior: number[];         // K
}

export function fitHMMPosterior(
  seqs: Int32Array[],
): HMMPost {
  const trans: number[][] = Array.from({ length: K }, () => new Array(K).fill(1));
  const prior = new Array(K).fill(1);
  for (const seq of seqs) {
    for (let t = 0; t < seq.length; t++) prior[seq[t]]++;
    for (let t = 1; t < seq.length; t++) trans[seq[t - 1]][seq[t]]++;
  }
  const totalPrior = prior.reduce((a, b) => a + b, 0);
  const priorN = prior.map((v) => v / totalPrior);
  const transN = trans.map((row) => {
    const s = row.reduce((a, b) => a + b, 0);
    return row.map((v) => v / s);
  });
  return { transition: transN, prior: priorN };
}

export function viterbiSmooth(
  probs: Float64Array[],   // T × K (already row-normalized posteriors)
  hmm: HMMPost,
): Int32Array {
  const T = probs.length;
  if (T === 0) return new Int32Array(0);
  const logTrans = hmm.transition.map((row) => row.map((v) => Math.log(v + 1e-12)));
  const logPrior = hmm.prior.map((v) => Math.log(v + 1e-12));
  // Convert posterior p(y|x) to emission likelihood p(x|y) ∝ p(y|x) / p(y).
  const emis = probs.map((p) => {
    const out = new Float64Array(K);
    for (let k = 0; k < K; k++) out[k] = Math.log(Math.max(1e-12, p[k])) - logPrior[k];
    return out;
  });
  const V = Array.from({ length: T }, () => new Float64Array(K));
  const back = Array.from({ length: T }, () => new Int32Array(K));
  for (let k = 0; k < K; k++) V[0][k] = logPrior[k] + emis[0][k];
  for (let t = 1; t < T; t++) {
    for (let k = 0; k < K; k++) {
      let bestP = -Infinity, bestPrev = 0;
      for (let j = 0; j < K; j++) {
        const p = V[t - 1][j] + logTrans[j][k];
        if (p > bestP) { bestP = p; bestPrev = j; }
      }
      V[t][k] = bestP + emis[t][k];
      back[t][k] = bestPrev;
    }
  }
  const path = new Int32Array(T);
  path[T - 1] = argmax(V[T - 1]);
  for (let t = T - 2; t >= 0; t--) path[t] = back[t + 1][path[t + 1]];
  return path;
}

// -----------------------------------------------------------------------------
// Mixture of Experts: one classifier per cluster; inference dispatches by
// participant cluster id. Falls back to the aggregated global model if a
// cluster receives no training rows.
// -----------------------------------------------------------------------------
export interface MoEModel {
  kind: "moe"; experts: (AnyModel | null)[]; fallback: AnyModel; clusterAssignment: Record<number, number>;
}
export function predictMoE(m: MoEModel, x: Float64Array, pid: number): Float64Array {
  const c = m.clusterAssignment[pid];
  const expert = c !== undefined ? m.experts[c] : null;
  const model = expert ?? m.fallback;
  return predictProba(model, x);
}

// -----------------------------------------------------------------------------
// Confusion matrix + macro-F1 for hard predictions (used by HMM path).
// -----------------------------------------------------------------------------
export function macroF1Hard(y: Int32Array, yhat: Int32Array): { acc: number; macroF1: number; perClass: Record<PhaseKey, { precision: number; recall: number; f1: number; support: number }> } {
  const conf: number[][] = Array.from({ length: K }, () => new Array(K).fill(0));
  let correct = 0;
  for (let i = 0; i < y.length; i++) { conf[y[i]][yhat[i]]++; if (y[i] === yhat[i]) correct++; }
  const perClass: Record<PhaseKey, { precision: number; recall: number; f1: number; support: number }> = {} as Record<PhaseKey, { precision: number; recall: number; f1: number; support: number }>;
  let macro = 0;
  for (let k = 0; k < K; k++) {
    const tp = conf[k][k]; let fp = 0, fn = 0;
    for (let j = 0; j < K; j++) if (j !== k) { fp += conf[j][k]; fn += conf[k][j]; }
    const sup = tp + fn;
    const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
    const rec = sup > 0 ? tp / sup : 0;
    const f1 = prec + rec > 0 ? 2 * prec * rec / (prec + rec) : 0;
    perClass[CLASSES[k]] = { precision: +prec.toFixed(4), recall: +rec.toFixed(4), f1: +f1.toFixed(4), support: sup };
    macro += f1;
  }
  return { acc: +(correct / (y.length || 1)).toFixed(4), macroF1: +(macro / K).toFixed(4), perClass };
}
