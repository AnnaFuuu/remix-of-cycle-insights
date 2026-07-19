// -----------------------------------------------------------------------------
// Step 6 · Enhanced-methods benchmark.
// Runs a research comparison of 6 methods on the same 5-fold participant CV:
//   1. Ridge (linear baseline, closed-form CG solver)
//   2. Softmax GBRT — enriched features (rolling + z-score)
//   3. Small MLP — enriched features
//   4. Mixture-of-Experts GBRT (one GBRT per K-Means phenotype cluster)
//   5. HMM-smoothed Softmax GBRT (Viterbi over per-participant sequences)
//   6. HMM-smoothed MoE-GBRT
//
// Does NOT alter Dashboard inference: the Dashboard still uses the winner
// persisted by Step 5. This module produces a comparison table + phenotype
// summary + HMM transition matrix for the researcher.
// -----------------------------------------------------------------------------

import { createServerFn } from "@tanstack/react-start";
import type { FeatureRow } from "./features.functions";
import { getTrainValTestSplit } from "./split.functions";
import type { PhaseKey } from "./split.functions";
import {
  CLASSES, K, fitSoftmaxGBRT, predictProba, toNum, type AnyModel,
  computeMetrics, argmax,
} from "./classifier-core.server";
import {
  computeRollingFeatures, fitParticipantZ, applyParticipantZ,
  participantEmbeddings, kmeansPlusPlus, assignParticipantsToClusters,
  fitRidgeMulti, predictRidge, fitMLP, predictMLP,
  fitHMMPosterior, viterbiSmooth, macroF1Hard,
  EMBED_KEYS,
} from "./enhancements.server";

// -----------------------------------------------------------------------------
// Types surfaced to the UI.
// -----------------------------------------------------------------------------
export type EnhancedMethod =
  | "ridge"
  | "gbrt_enriched"
  | "mlp_enriched"
  | "moe_gbrt"
  | "hmm_gbrt"
  | "hmm_moe";

export interface MethodResult {
  method: EnhancedMethod;
  label: string;
  cvAccuracy: { mean: number; std: number };
  cvMacroF1: { mean: number; std: number };
  testAccuracy: number;
  testMacroF1: number;
  perFold: number[];               // macro-F1 per fold
  perClassTest: Record<PhaseKey, { precision: number; recall: number; f1: number; support: number }>;
  fitMs: number;
  notes: string;
}
export interface PhenotypeSummary {
  k: number;
  counts: number[];
  centroidsOriginal: number[][];   // K × D in original units (not standardized)
  embeddingKeys: string[];
}
export interface HMMSummary {
  transition: number[][];           // K × K, row-stochastic
  prior: number[];
}
export interface EnhancedBenchmarkResult {
  methods: MethodResult[];
  best: EnhancedMethod;
  phenotype: PhenotypeSummary;
  hmm: HMMSummary;
  baselineFeatures: string[];
  enrichedFeatures: string[];
  cvFolds: number;
  poolN: number;
  testN: number;
  refreshedAt: string;
  notes: string;
}

// -----------------------------------------------------------------------------
// Config: keep it "浅试" so this stays under ~60s on Cloudflare workers.
// -----------------------------------------------------------------------------
const BASE_KEYS = [
  "bmi", "wrist_temp_overnight_mean", "hrv_mean", "resp_rate_full",
  "sleep_score", "sleep_asleep_min", "stress_score", "glucose_mean",
  "rhr", "cramps", "bloating",
];
// Kept tight so 6 methods × N folds fits inside the Worker time budget.
const ROLL_KEYS = ["hrv_mean", "wrist_temp_overnight_mean", "rhr"];
const ROLL_WINDOWS = [7];
const Z_KEYS = ["hrv_mean", "wrist_temp_overnight_mean", "rhr", "sleep_score"];
const CV_FOLDS = 3;
const CV_SEED = 42;
const CLUSTER_K = 3;

// -----------------------------------------------------------------------------
// Utility: participant → sequential row indices (ordered by day_in_study).
// -----------------------------------------------------------------------------
function bySequence(rows: FeatureRow[], indices: number[]): Map<number, number[]> {
  const bucket = new Map<number, number[]>();
  for (const i of indices) {
    const pid = rows[i].participant_id;
    const l = bucket.get(pid); if (l) l.push(i); else bucket.set(pid, [i]);
  }
  for (const [, idxs] of bucket) idxs.sort((a, b) => rows[a].day_in_study - rows[b].day_in_study);
  return bucket;
}

function classWeightFor(y: Int32Array): Float64Array {
  const cw = new Float64Array(K), c = new Float64Array(K);
  for (const v of y) c[v]++;
  const total = y.length;
  for (let k = 0; k < K; k++) cw[k] = c[k] > 0 ? total / (K * c[k]) : 1;
  return cw;
}

function meanStd(xs: number[]): { mean: number; std: number } {
  if (!xs.length) return { mean: 0, std: 0 };
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  let v = 0; for (const x of xs) v += (x - m) ** 2;
  return { mean: +m.toFixed(4), std: +Math.sqrt(v / xs.length).toFixed(4) };
}

// Same mulberry32 shuffle used in the base pipeline for reproducible folds.
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
function stratKFold(pids: { pid: number; dom: PhaseKey }[], k: number, seed: number): number[][] {
  const rng = mulberry32(seed);
  const buckets: Record<PhaseKey, number[]> = { Menstrual: [], Follicular: [], Fertility: [], Luteal: [] };
  for (const p of pids) buckets[p.dom].push(p.pid);
  const folds: number[][] = Array.from({ length: k }, () => []);
  for (const ph of Object.keys(buckets) as PhaseKey[]) {
    const arr = buckets[ph].slice();
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    for (let i = 0; i < arr.length; i++) folds[i % k].push(arr[i]);
  }
  return folds;
}

// -----------------------------------------------------------------------------
// Main server function.
// -----------------------------------------------------------------------------
export const runEnhancedBenchmark = createServerFn({ method: "POST" }).handler(async (): Promise<EnhancedBenchmarkResult> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // ----- Load full feature table -----
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
  const phaseIdx: Record<string, number> = {};
  CLASSES.forEach((c, i) => (phaseIdx[c] = i));

  // ----- Filter labeled rows -----
  const kept: number[] = [];
  const labels = new Int32Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.phase || phaseIdx[r.phase] === undefined) continue;
    if (!assignment[r.participant_id]) continue;
    kept.push(i); labels[i] = phaseIdx[r.phase];
  }

  // ----- Feature enrichment: rolling + z-score (train-stats only, no leakage in the CV loop) -----
  const { newKeys: rollKeys, augmented: rollAugRows } = computeRollingFeatures(
    rows as unknown as Array<Record<string, unknown>>, ROLL_KEYS, ROLL_WINDOWS,
  );
  const enrichedKeys = [...BASE_KEYS, ...rollKeys, ...Z_KEYS.map((k) => `${k}_z`)];

  // Partition participants.
  const poolPids = new Set<number>();
  const testPids = new Set<number>();
  for (const i of kept) {
    const s = assignment[rows[i].participant_id];
    if (s === "train" || s === "validation") poolPids.add(rows[i].participant_id);
    else if (s === "test") testPids.add(rows[i].participant_id);
  }
  const poolByPid = new Map(split.perParticipant.map((p) => [p.participantId, p.dominant]));
  const poolList = Array.from(poolPids).map((pid) => ({ pid, dom: (poolByPid.get(pid) ?? "Luteal") as PhaseKey }));
  const folds = stratKFold(poolList, CV_FOLDS, CV_SEED);

  const keptTest = kept.filter((i) => testPids.has(rows[i].participant_id));

  // ----- Phenotype clustering (K-Means on pool participants) -----
  const emb = participantEmbeddings(rollAugRows, poolPids);
  const km = kmeansPlusPlus(emb.X, CLUSTER_K, CV_SEED);
  const poolAssign = assignParticipantsToClusters(emb.X, emb.pids, km.centroids, km.scaleMu, km.scaleSd);
  const testEmb = participantEmbeddings(rollAugRows, testPids);
  const testAssign = assignParticipantsToClusters(testEmb.X, testEmb.pids, km.centroids, km.scaleMu, km.scaleSd);
  const clusterAssignment: Record<number, number> = { ...poolAssign.assignment, ...testAssign.assignment };
  // Denormalize centroids back to original units.
  const centroidsOriginal = km.centroids.map((c) => c.map((v, f) => v * (km.scaleSd[f] || 1) + km.scaleMu[f]));

  // ----- HMM prior + transition from pool sequences -----
  const poolSeqs: Int32Array[] = [];
  const poolByPidRows = bySequence(rows, kept.filter((i) => poolPids.has(rows[i].participant_id)));
  for (const [, idxs] of poolByPidRows) {
    const seq = new Int32Array(idxs.length);
    for (let t = 0; t < idxs.length; t++) seq[t] = labels[idxs[t]];
    poolSeqs.push(seq);
  }
  const hmm = fitHMMPosterior(poolSeqs);

  // ----- Build matrix helpers scoped to a set of participant ids -----
  function buildX(pids: Set<number>, keys: string[], medians: Float64Array, zStats: ReturnType<typeof fitParticipantZ> | null): { X: Float64Array[]; y: Int32Array; rowIdx: number[] } {
    const src = zStats ? applyParticipantZ(rollAugRows, zStats, Z_KEYS) : rollAugRows;
    const idxList = kept.filter((i) => pids.has(rows[i].participant_id));
    const X: Float64Array[] = new Array(idxList.length);
    const y = new Int32Array(idxList.length);
    for (let j = 0; j < idxList.length; j++) {
      const row = src[idxList[j]];
      const v = new Float64Array(keys.length);
      for (let f = 0; f < keys.length; f++) {
        const nv = toNum(row[keys[f]]);
        v[f] = nv !== null ? nv : medians[f];
      }
      X[j] = v; y[j] = labels[idxList[j]];
    }
    return { X, y, rowIdx: idxList };
  }
  function computeMedians(pids: Set<number>, keys: string[], zStats: ReturnType<typeof fitParticipantZ> | null): Float64Array {
    const src = zStats ? applyParticipantZ(rollAugRows, zStats, Z_KEYS) : rollAugRows;
    const meds = new Float64Array(keys.length);
    for (let f = 0; f < keys.length; f++) {
      const vals: number[] = [];
      for (const i of kept) if (pids.has(rows[i].participant_id)) {
        const v = toNum(src[i][keys[f]]); if (v !== null) vals.push(v);
      }
      vals.sort((a, b) => a - b);
      meds[f] = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) >> 1] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : 0;
    }
    return meds;
  }

  // ----- CV loop over folds; run all methods on the same fold data -----
  const foldMetrics: Record<EnhancedMethod, number[]> = {
    ridge: [], gbrt_enriched: [], mlp_enriched: [], moe_gbrt: [], hmm_gbrt: [], hmm_moe: [],
  };
  const foldAcc: Record<EnhancedMethod, number[]> = {
    ridge: [], gbrt_enriched: [], mlp_enriched: [], moe_gbrt: [], hmm_gbrt: [], hmm_moe: [],
  };
  const fitMs: Record<EnhancedMethod, number> = {
    ridge: 0, gbrt_enriched: 0, mlp_enriched: 0, moe_gbrt: 0, hmm_gbrt: 0, hmm_moe: 0,
  };

  const gbrtHp = { nTrees: 70, maxDepth: 5, lr: 0.07, mtry: Math.max(5, Math.floor(Math.sqrt(enrichedKeys.length) * 1.5)), minSamples: 4, candidates: 16, lambda: 1, seed: CV_SEED };
  const mlpHp  = { hidden: 24, epochs: 25, lr: 0.006, l2: 1e-4, batch: 64, seed: CV_SEED };

  for (let fi = 0; fi < folds.length; fi++) {
    const valSet = new Set<number>(folds[fi]);
    const trSet = new Set<number>();
    for (let fj = 0; fj < folds.length; fj++) if (fj !== fi) for (const pid of folds[fj]) trSet.add(pid);

    const zStats = fitParticipantZ(rollAugRows, trSet, Z_KEYS);
    const meds = computeMedians(trSet, enrichedKeys, zStats);
    const tr = buildX(trSet, enrichedKeys, meds, zStats);
    const va = buildX(valSet, enrichedKeys, meds, zStats);
    const cw = classWeightFor(tr.y);

    // 1. Ridge.
    let t0 = performance.now();
    const ridge = fitRidgeMulti(tr.X, tr.y, 1.0);
    fitMs.ridge += performance.now() - t0;
    let probsVa = va.X.map((x) => predictRidge(ridge, x));
    let hardVa = probsVa.map((p) => argmax(p));
    let f = macroF1Hard(va.y, Int32Array.from(hardVa));
    foldMetrics.ridge.push(f.macroF1); foldAcc.ridge.push(f.acc);

    // 2. GBRT enriched.
    t0 = performance.now();
    const gbrt = fitSoftmaxGBRT(tr.X, tr.y, { ...gbrtHp, classWeight: cw });
    fitMs.gbrt_enriched += performance.now() - t0;
    const probsGb = va.X.map((x) => predictProba(gbrt, x));
    hardVa = probsGb.map((p) => argmax(p));
    f = macroF1Hard(va.y, Int32Array.from(hardVa));
    foldMetrics.gbrt_enriched.push(f.macroF1); foldAcc.gbrt_enriched.push(f.acc);

    // 3. MLP enriched.
    t0 = performance.now();
    const mlp = fitMLP(tr.X, tr.y, { ...mlpHp, classWeight: cw });
    fitMs.mlp_enriched += performance.now() - t0;
    probsVa = va.X.map((x) => predictMLP(mlp, x));
    hardVa = probsVa.map((p) => argmax(p));
    f = macroF1Hard(va.y, Int32Array.from(hardVa));
    foldMetrics.mlp_enriched.push(f.macroF1); foldAcc.mlp_enriched.push(f.acc);

    // 4. MoE-GBRT: split train by cluster, train one GBRT per cluster.
    t0 = performance.now();
    const experts: (AnyModel | null)[] = new Array(CLUSTER_K).fill(null);
    for (let c = 0; c < CLUSTER_K; c++) {
      const mask: number[] = [];
      for (let i = 0; i < tr.y.length; i++) if (clusterAssignment[rows[tr.rowIdx[i]].participant_id] === c) mask.push(i);
      if (mask.length < 40) continue;
      const Xc = mask.map((i) => tr.X[i]);
      const yc = new Int32Array(mask.length); for (let i = 0; i < mask.length; i++) yc[i] = tr.y[mask[i]];
      const cwc = classWeightFor(yc);
      experts[c] = fitSoftmaxGBRT(Xc, yc, { ...gbrtHp, nTrees: 50, classWeight: cwc });
    }
    fitMs.moe_gbrt += performance.now() - t0;
    const probsMoE = va.X.map((x, i) => {
      const c = clusterAssignment[rows[va.rowIdx[i]].participant_id];
      const expert = c !== undefined ? experts[c] : null;
      return predictProba(expert ?? gbrt, x);
    });
    hardVa = probsMoE.map((p) => argmax(p));
    f = macroF1Hard(va.y, Int32Array.from(hardVa));
    foldMetrics.moe_gbrt.push(f.macroF1); foldAcc.moe_gbrt.push(f.acc);

    // 5. HMM-smoothed GBRT.
    t0 = performance.now();
    const hmmGbrt = smoothWithHMM(probsGb, va.rowIdx, rows, hmm);
    fitMs.hmm_gbrt += performance.now() - t0;
    f = macroF1Hard(va.y, hmmGbrt);
    foldMetrics.hmm_gbrt.push(f.macroF1); foldAcc.hmm_gbrt.push(f.acc);

    // 6. HMM-smoothed MoE.
    t0 = performance.now();
    const hmmMoE = smoothWithHMM(probsMoE, va.rowIdx, rows, hmm);
    fitMs.hmm_moe += performance.now() - t0;
    f = macroF1Hard(va.y, hmmMoE);
    foldMetrics.hmm_moe.push(f.macroF1); foldAcc.hmm_moe.push(f.acc);
  }

  // ----- Final refit on full pool + evaluate on held-out test -----
  const poolZ = fitParticipantZ(rollAugRows, poolPids, Z_KEYS);
  const poolMeds = computeMedians(poolPids, enrichedKeys, poolZ);
  const pool = buildX(poolPids, enrichedKeys, poolMeds, poolZ);
  const test = buildX(testPids, enrichedKeys, poolMeds, poolZ);
  const cwPool = classWeightFor(pool.y);

  const ridgeFinal = fitRidgeMulti(pool.X, pool.y, 1.0);
  const gbrtFinal  = fitSoftmaxGBRT(pool.X, pool.y, { ...gbrtHp, classWeight: cwPool });
  const mlpFinal   = fitMLP(pool.X, pool.y, { ...mlpHp, classWeight: cwPool });
  const moeExperts: (AnyModel | null)[] = new Array(CLUSTER_K).fill(null);
  for (let c = 0; c < CLUSTER_K; c++) {
    const mask: number[] = [];
    for (let i = 0; i < pool.y.length; i++) if (clusterAssignment[rows[pool.rowIdx[i]].participant_id] === c) mask.push(i);
    if (mask.length < 40) continue;
    const Xc = mask.map((i) => pool.X[i]);
    const yc = new Int32Array(mask.length); for (let i = 0; i < mask.length; i++) yc[i] = pool.y[mask[i]];
    const cwc = classWeightFor(yc);
    moeExperts[c] = fitSoftmaxGBRT(Xc, yc, { ...gbrtHp, nTrees: 80, classWeight: cwc });
  }

  const testResults: Record<EnhancedMethod, { hard: Int32Array; probs: Float64Array[] }> = {} as Record<EnhancedMethod, { hard: Int32Array; probs: Float64Array[] }>;
  const testRidge = test.X.map((x) => predictRidge(ridgeFinal, x));
  testResults.ridge = { hard: Int32Array.from(testRidge.map(argmax)), probs: testRidge };
  const testGbrt = test.X.map((x) => predictProba(gbrtFinal, x));
  testResults.gbrt_enriched = { hard: Int32Array.from(testGbrt.map(argmax)), probs: testGbrt };
  const testMlp = test.X.map((x) => predictMLP(mlpFinal, x));
  testResults.mlp_enriched = { hard: Int32Array.from(testMlp.map(argmax)), probs: testMlp };
  const testMoE = test.X.map((x, i) => {
    const c = clusterAssignment[rows[test.rowIdx[i]].participant_id];
    const expert = c !== undefined ? moeExperts[c] : null;
    return predictProba(expert ?? gbrtFinal, x);
  });
  testResults.moe_gbrt = { hard: Int32Array.from(testMoE.map(argmax)), probs: testMoE };
  testResults.hmm_gbrt = { hard: smoothWithHMM(testGbrt, test.rowIdx, rows, hmm), probs: testGbrt };
  testResults.hmm_moe  = { hard: smoothWithHMM(testMoE,  test.rowIdx, rows, hmm), probs: testMoE };

  const LABEL: Record<EnhancedMethod, string> = {
    ridge:          "Ridge (linear baseline)",
    gbrt_enriched:  "Softmax GBRT (enriched features)",
    mlp_enriched:   "Small MLP (1×32 hidden, Adam)",
    moe_gbrt:       "Mixture-of-Experts GBRT (per phenotype)",
    hmm_gbrt:       "HMM-smoothed GBRT (Viterbi)",
    hmm_moe:        "HMM-smoothed MoE (Viterbi + phenotype)",
  };
  const NOTES: Record<EnhancedMethod, string> = {
    ridge:          "One-vs-rest ridge multinomial, closed-form (CG). Baseline.",
    gbrt_enriched:  "Same GBRT as Step 5 but on base + 3d/7d rolling stats + per-participant z-scores.",
    mlp_enriched:   "Fully-connected NN, 32 ReLU units, softmax head, Adam + L2 weight decay.",
    moe_gbrt:       "Participants K-Means clustered on physio phenotype; one GBRT expert per cluster.",
    hmm_gbrt:       "Viterbi decoding over per-participant sequences with transitions learned from train.",
    hmm_moe:        "MoE per-cluster predictions post-smoothed by the HMM. Combines both wins.",
  };

  const methodOrder: EnhancedMethod[] = ["ridge", "gbrt_enriched", "mlp_enriched", "moe_gbrt", "hmm_gbrt", "hmm_moe"];
  const methods: MethodResult[] = methodOrder.map((m) => {
    const testM = computeMetrics(test.y, testResults[m].probs);
    const hard = macroF1Hard(test.y, testResults[m].hard);
    return {
      method: m,
      label: LABEL[m],
      cvAccuracy: meanStd(foldAcc[m]),
      cvMacroF1: meanStd(foldMetrics[m]),
      testAccuracy: hard.acc,
      testMacroF1: hard.macroF1,
      perFold: foldMetrics[m].map((v) => +v.toFixed(4)),
      perClassTest: hard.perClass,
      fitMs: +fitMs[m].toFixed(0),
      notes: NOTES[m] + (m.startsWith("hmm") ? "" : ` · logloss ${testM.logLoss.toFixed(3)}`),
    };
  });

  // Best by mean CV macro-F1.
  let best: EnhancedMethod = methodOrder[0];
  let bestVal = -Infinity;
  for (const mr of methods) if (mr.cvMacroF1.mean > bestVal) { bestVal = mr.cvMacroF1.mean; best = mr.method; }

  const clusterCounts = new Array(CLUSTER_K).fill(0);
  for (const pid of Object.keys(clusterAssignment)) {
    const c = clusterAssignment[Number(pid)];
    if (c >= 0 && c < CLUSTER_K) clusterCounts[c]++;
  }

  const payload: EnhancedBenchmarkResult = {
    methods,
    best,
    phenotype: {
      k: CLUSTER_K,
      counts: clusterCounts,
      centroidsOriginal,
      embeddingKeys: [...EMBED_KEYS],
    },
    hmm: { transition: hmm.transition, prior: hmm.prior },
    baselineFeatures: BASE_KEYS,
    enrichedFeatures: enrichedKeys,
    cvFolds: CV_FOLDS,
    poolN: pool.y.length,
    testN: test.y.length,
    refreshedAt: new Date().toISOString(),
    notes: `Enhanced benchmark: 5-fold stratified CV by participant on train+val pool (${poolPids.size} participants), then refit on the pool and scored on the held-out test set (${testPids.size} participants). Feature enrichment adds 3d/7d rolling mean+std for 5 vitals and per-participant z-scores for 7 vitals (train-only stats). Phenotype clustering: K-Means (K=${CLUSTER_K}) on participant-level means. HMM smoothing uses Viterbi with transition matrix learned from pool sequences.`,
  };
  try {
    const { savePipelineRun } = await import("./pipeline-runs.functions");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await savePipelineRun("enhanced_benchmark", payload);
  } catch (e) { console.error("[enhanced-benchmark] savePipelineRun failed", e); }
  return payload;
});

function smoothWithHMM(probs: Float64Array[], rowIdx: number[], rows: FeatureRow[], hmm: { transition: number[][]; prior: number[] }): Int32Array {
  // Group indices in probs/rowIdx by participant, keep day order, run Viterbi per participant.
  const byPid = new Map<number, number[]>();
  for (let i = 0; i < rowIdx.length; i++) {
    const pid = rows[rowIdx[i]].participant_id;
    const l = byPid.get(pid); if (l) l.push(i); else byPid.set(pid, [i]);
  }
  const out = new Int32Array(probs.length);
  for (const [, localIdxs] of byPid) {
    localIdxs.sort((a, b) => rows[rowIdx[a]].day_in_study - rows[rowIdx[b]].day_in_study);
    const seqP = localIdxs.map((i) => probs[i]);
    const seqOut = viterbiSmooth(seqP, hmm);
    for (let t = 0; t < localIdxs.length; t++) out[localIdxs[t]] = seqOut[t];
  }
  return out;
}
