import { createServerFn } from "@tanstack/react-start";
import type { FeatureRow } from "./features.functions";
import { FEATURE_DEFS } from "./features.functions";
import { getTrainValTestSplit } from "./split.functions";
import type { PhaseKey } from "./split.functions";
import {
  CLASSES, K, computeMetrics, fitLogReg, fitRandomForest, fitSoftmaxGBRT,
  predictProba, serializeModel, toNum,
  type AlgoName, type AnyModel, type ClassMetrics,
} from "./classifier-core.server";

// -----------------------------------------------------------------------------
// Step 5 · Menstrual phase classification with 5-fold cross-validation.
// CV runs on the pre-split train+validation pool (test set held out). The
// winning algorithm — highest mean CV macro-F1 — is refit on the full
// train+val pool and evaluated on the held-out test set before being
// persisted to `mcphases_trained_models` for live dashboard inference.
// -----------------------------------------------------------------------------

export type { AlgoName, ClassMetrics };
export { CLASSES };

export interface FoldMetric { fold: number; accuracy: number; macroF1: number; logLoss: number }
export interface CVSummary {
  perFold: FoldMetric[];
  meanAccuracy: number; stdAccuracy: number;
  meanMacroF1:  number; stdMacroF1:  number;
  meanLogLoss:  number; stdLogLoss:  number;
}

export interface AlgoResult {
  algo: AlgoName;
  label: string;
  hyperparams: Record<string, number | string>;
  // train = final-refit train metrics; val = mean CV val; test = held-out test.
  accuracy: { train: number; val: number; test: number };
  macroF1:  { train: number; val: number; test: number };
  logLoss:  { train: number; val: number; test: number };
  perClass: { val: Record<PhaseKey, ClassMetrics>; test: Record<PhaseKey, ClassMetrics> };
  confusion: { val: number[][]; test: number[][] };
  fitMs: number;   // total training time (all folds + final refit)
  cv: CVSummary;
}
export interface FeatureImportance { key: string; label: string; importance: number }
export interface ClassificationResult {
  classes: PhaseKey[];
  predictors: string[];
  trainN: number; valN: number; testN: number;
  poolN: number;         // train+val rows used for CV
  cvFolds: number;       // = 5
  classCounts: { train: Record<PhaseKey, number>; val: Record<PhaseKey, number>; test: Record<PhaseKey, number> };
  algos: AlgoResult[];
  bestAlgo: AlgoName;
  featureImportances: FeatureImportance[];
  refreshedAt: string;
  notes: string;
  savedModelId?: string;
}

const EXCLUDE = new Set(["phase", "participant_id", "day_in_study", "sleep_start", "sleep_end"]);
const CV_FOLDS = 5;
const CV_SEED = 42;

// --- Deterministic RNG for CV fold shuffling (same style as split.functions) --
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

/** Stratified k-fold split by dominant phase — participants never span folds. */
function stratifiedKFold(
  pool: { participantId: number; dominant: PhaseKey }[],
  k: number,
  seed: number,
): number[][] {
  const rng = mulberry32(seed);
  const buckets: Record<PhaseKey, number[]> = { Menstrual: [], Follicular: [], Fertility: [], Luteal: [] };
  for (const p of pool) buckets[p.dominant].push(p.participantId);
  const folds: number[][] = Array.from({ length: k }, () => []);
  for (const phase of Object.keys(buckets) as PhaseKey[]) {
    const shuffled = shuffle(buckets[phase], rng);
    for (let i = 0; i < shuffled.length; i++) folds[i % k].push(shuffled[i]);
  }
  return folds;
}

function meanStd(xs: number[]): { mean: number; std: number } {
  if (xs.length === 0) return { mean: 0, std: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const varr = xs.reduce((s, v) => s + (v - mean) ** 2, 0) / xs.length;
  return { mean, std: Math.sqrt(varr) };
}

export const trainPhaseClassification = createServerFn({ method: "POST" }).handler(async (): Promise<ClassificationResult> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // --- 1. Load feature matview ------------------------------------------------
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
  const predictors = FEATURE_DEFS.map((d) => d.key).filter((k) => !EXCLUDE.has(k));
  const nFeat = predictors.length;

  const phaseIdx: Record<string, number> = {};
  CLASSES.forEach((c, i) => (phaseIdx[c] = i));

  // --- 2. Filter labeled rows and tag by split subset -------------------------
  interface Row { i: number; y: number; pid: number; s: "train" | "validation" | "test" }
  const kept: Row[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.phase || phaseIdx[r.phase] === undefined) continue;
    const s = assignment[r.participant_id];
    if (s !== "train" && s !== "validation" && s !== "test") continue;
    kept.push({ i, y: phaseIdx[r.phase], pid: r.participant_id, s });
  }

  // --- 3. Helpers: medians / build / classWeight scoped to a participant set --
  const rowsByPid = new Map<number, Row[]>();
  for (const r of kept) {
    const list = rowsByPid.get(r.pid);
    if (list) list.push(r); else rowsByPid.set(r.pid, [r]);
  }
  const computeMedians = (pids: Set<number>): Float64Array => {
    const meds = new Float64Array(nFeat);
    for (let f = 0; f < nFeat; f++) {
      const key = predictors[f];
      const vals: number[] = [];
      for (const pid of pids) {
        const list = rowsByPid.get(pid); if (!list) continue;
        for (const r of list) { const v = toNum(rows[r.i][key]); if (v !== null) vals.push(v); }
      }
      vals.sort((a, b) => a - b);
      meds[f] = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) >> 1] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : 0;
    }
    return meds;
  };
  const build = (pids: Set<number>, meds: Float64Array): { X: Float64Array[]; y: Int32Array } => {
    const list: Row[] = [];
    for (const pid of pids) { const l = rowsByPid.get(pid); if (l) list.push(...l); }
    const X: Float64Array[] = new Array(list.length);
    const y = new Int32Array(list.length);
    for (let j = 0; j < list.length; j++) {
      const r = rows[list[j].i];
      const row = new Float64Array(nFeat);
      for (let f = 0; f < nFeat; f++) {
        const v = toNum(r[predictors[f]]);
        row[f] = v !== null ? v : meds[f];
      }
      X[j] = row; y[j] = list[j].y;
    }
    return { X, y };
  };
  const classWeightFor = (y: Int32Array): Float64Array => {
    const cw = new Float64Array(K); const c = new Float64Array(K);
    for (const v of y) c[v]++;
    const total = y.length;
    for (let k = 0; k < K; k++) cw[k] = c[k] > 0 ? total / (K * c[k]) : 1;
    return cw;
  };

  // --- 4. Partition participants ---------------------------------------------
  const trainPids = new Set<number>();
  const valPids   = new Set<number>();
  const testPids  = new Set<number>();
  for (const r of kept) {
    if (r.s === "train")      trainPids.add(r.pid);
    else if (r.s === "validation") valPids.add(r.pid);
    else                      testPids.add(r.pid);
  }
  const poolPids = new Set<number>([...trainPids, ...valPids]);
  const poolByPid = new Map(split.perParticipant.map((p) => [p.participantId, p.dominant]));
  const poolList = Array.from(poolPids).map((pid) => ({ participantId: pid, dominant: (poolByPid.get(pid) ?? "Luteal") as PhaseKey }));

  // --- 5. Class-count summary (for the UI legend) ----------------------------
  const classCounts = { train: {} as Record<PhaseKey, number>, val: {} as Record<PhaseKey, number>, test: {} as Record<PhaseKey, number> };
  for (const c of CLASSES) { classCounts.train[c] = 0; classCounts.val[c] = 0; classCounts.test[c] = 0; }
  for (const r of kept) {
    const bucket = r.s === "train" ? classCounts.train : r.s === "validation" ? classCounts.val : classCounts.test;
    bucket[CLASSES[r.y] as PhaseKey]++;
  }

  // --- 6. Hyperparameters (shared across folds and final refit) --------------
  const mtry = Math.max(4, Math.floor(Math.sqrt(nFeat)));
  const gbrtMtry = Math.max(6, Math.floor(Math.sqrt(nFeat) * 1.5));
  const HP = {
    softmax_gbrt: { nTrees: 250, maxDepth: 5, lr: 0.05, mtry: gbrtMtry, minSamples: 4, candidates: 24, lambda: 1, seed: 42 } as const,
    random_forest: { nTrees: 300, maxDepth: 16, mtry, minSamples: 2, candidates: 20, seed: 42 } as const,
    logistic_regression: { epochs: 500, lr: 0.2, l2: 1e-4 } as const,
  };
  const ALGOS: AlgoName[] = ["softmax_gbrt", "random_forest", "logistic_regression"];
  const LABEL: Record<AlgoName, string> = {
    softmax_gbrt: "Softmax GBRT",
    random_forest: "Random Forest",
    logistic_regression: "Multinomial Logistic Regression",
  };

  const fitOne = (algo: AlgoName, X: Float64Array[], y: Int32Array): { model: AnyModel; fitMs: number } => {
    const cw = classWeightFor(y);
    const t0 = performance.now();
    let model: AnyModel;
    if (algo === "softmax_gbrt") model = fitSoftmaxGBRT(X, y, { ...HP.softmax_gbrt, classWeight: cw });
    else if (algo === "random_forest") model = fitRandomForest(X, y, HP.random_forest);
    else model = fitLogReg(X, y, { ...HP.logistic_regression, classWeight: cw });
    return { model, fitMs: performance.now() - t0 };
  };
  const evalOn = (m: AnyModel, X: Float64Array[], y: Int32Array) => {
    const probs = X.map((x) => predictProba(m, x));
    return computeMetrics(y, probs);
  };

  // --- 7. Five-fold CV over the train+val pool -------------------------------
  const folds = stratifiedKFold(poolList, CV_FOLDS, CV_SEED);
  const cvPerAlgo: Record<AlgoName, FoldMetric[]> = {
    softmax_gbrt: [], random_forest: [], logistic_regression: [],
  };
  const cvFitMs: Record<AlgoName, number> = { softmax_gbrt: 0, random_forest: 0, logistic_regression: 0 };

  for (let fi = 0; fi < folds.length; fi++) {
    const valSet = new Set<number>(folds[fi]);
    const trainSet = new Set<number>();
    for (let fj = 0; fj < folds.length; fj++) if (fj !== fi) for (const pid of folds[fj]) trainSet.add(pid);
    const meds = computeMedians(trainSet);
    const trFold = build(trainSet, meds);
    const vaFold = build(valSet,   meds);
    for (const algo of ALGOS) {
      const { model, fitMs } = fitOne(algo, trFold.X, trFold.y);
      cvFitMs[algo] += fitMs;
      const mv = evalOn(model, vaFold.X, vaFold.y);
      cvPerAlgo[algo].push({ fold: fi + 1, accuracy: mv.accuracy, macroF1: mv.macroF1, logLoss: mv.logLoss });
    }
  }

  // --- 8. Final refit on full train+val pool + held-out test evaluation ------
  const poolMedians = computeMedians(poolPids);
  const poolData   = build(poolPids,  poolMedians);
  const testData   = build(testPids,  poolMedians);

  const algos: AlgoResult[] = [];
  const trainedByAlgo: Record<AlgoName, AnyModel> = {} as Record<AlgoName, AnyModel>;

  for (const algo of ALGOS) {
    const perFold = cvPerAlgo[algo];
    const accStats = meanStd(perFold.map((f) => f.accuracy));
    const f1Stats  = meanStd(perFold.map((f) => f.macroF1));
    const llStats  = meanStd(perFold.map((f) => f.logLoss));

    const { model, fitMs: refitMs } = fitOne(algo, poolData.X, poolData.y);
    trainedByAlgo[algo] = model;
    const mt = evalOn(model, poolData.X, poolData.y);
    const me = evalOn(model, testData.X, testData.y);

    // Use last-fold val metrics as the illustrative "val" per-class + confusion
    // so the UI can still render a validation confusion matrix — the CV summary
    // captures the aggregate statistical picture.
    const lastFoldValSet = new Set<number>(folds[folds.length - 1]);
    const lastFoldTrainSet = new Set<number>();
    for (let fj = 0; fj < folds.length - 1; fj++) for (const pid of folds[fj]) lastFoldTrainSet.add(pid);
    const meds = computeMedians(lastFoldTrainSet);
    const vaFold = build(lastFoldValSet, meds);
    const { model: valModel } = fitOne(algo, build(lastFoldTrainSet, meds).X, build(lastFoldTrainSet, meds).y);
    const mv = evalOn(valModel, vaFold.X, vaFold.y);

    const totalFitMs = +(cvFitMs[algo] + refitMs).toFixed(0);
    algos.push({
      algo, label: LABEL[algo],
      hyperparams: algoHp(algo, HP),
      accuracy: { train: mt.accuracy, val: accStats.mean, test: me.accuracy },
      macroF1:  { train: mt.macroF1,  val: f1Stats.mean,  test: me.macroF1  },
      logLoss:  { train: mt.logLoss,  val: llStats.mean,  test: me.logLoss  },
      perClass: { val: mv.perClass, test: me.perClass },
      confusion: { val: mv.confusion, test: me.confusion },
      fitMs: totalFitMs,
      cv: {
        perFold,
        meanAccuracy: accStats.mean, stdAccuracy: accStats.std,
        meanMacroF1:  f1Stats.mean,  stdMacroF1:  f1Stats.std,
        meanLogLoss:  llStats.mean,  stdLogLoss:  llStats.std,
      },
    });
  }

  // Winner selected by mean CV macro-F1 (out-of-fold, unbiased by the test set).
  let bestAlgo: AlgoName = algos[0].algo;
  let bestVal = -Infinity;
  for (const a of algos) if (a.cv.meanMacroF1 > bestVal) { bestVal = a.cv.meanMacroF1; bestAlgo = a.algo; }

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

  // --- 9. Persist winner (refit on full train+val) for live inference --------
  const winnerAlgo = algos.find((a) => a.algo === bestAlgo)!;
  let savedModelId: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: saved, error: saveErr } = await (supabaseAdmin.from("mcphases_trained_models" as any) as any)
      .upsert({
        kind: "phase_classifier",
        algo: bestAlgo,
        predictors,
        medians: Array.from(poolMedians),
        classes: CLASSES,
        artifact: serializeModel(winnerModel),
        metrics: {
          accuracy: winnerAlgo.accuracy,
          macroF1: winnerAlgo.macroF1,
          logLoss: winnerAlgo.logLoss,
          cv: winnerAlgo.cv,
        },
        n_train: poolData.y.length,
        trained_at: new Date().toISOString(),
      }, { onConflict: "kind" })
      .select("id").single();
    if (saveErr) throw saveErr;
    savedModelId = (saved as { id: string } | null)?.id;
  } catch (e) {
    console.error("[classification] failed to persist winner", e);
  }

  const payload: ClassificationResult = {
    classes: CLASSES,
    predictors,
    trainN: classCounts.train.Menstrual + classCounts.train.Follicular + classCounts.train.Fertility + classCounts.train.Luteal,
    valN:   classCounts.val.Menstrual   + classCounts.val.Follicular   + classCounts.val.Fertility   + classCounts.val.Luteal,
    testN:  classCounts.test.Menstrual  + classCounts.test.Follicular  + classCounts.test.Fertility  + classCounts.test.Luteal,
    poolN:  poolData.y.length,
    cvFolds: CV_FOLDS,
    classCounts,
    algos,
    bestAlgo,
    featureImportances,
    refreshedAt: new Date().toISOString(),
    notes: `5-fold stratified CV by participant over the pre-split train+validation pool (${poolPids.size} participants); winner refit on the full pool and evaluated on the held-out test set. Class weights = inverse fold-train frequency; imputation uses fold-train medians.`,
    savedModelId,
  };
  try {
    const { savePipelineRun } = await import("./pipeline-runs.functions");
    await savePipelineRun("classification", payload);
  } catch (e) { console.error("[classification] savePipelineRun failed", e); }
  return payload;
});

function algoHp(algo: AlgoName, HP: {
  softmax_gbrt: { nTrees: number; maxDepth: number; lr: number; lambda: number; mtry: number };
  random_forest: { nTrees: number; maxDepth: number; mtry: number; minSamples: number };
  logistic_regression: { epochs: number; lr: number; l2: number };
}): Record<string, number | string> {
  if (algo === "softmax_gbrt") {
    const h = HP.softmax_gbrt;
    return { nTrees: h.nTrees, maxDepth: h.maxDepth, lr: h.lr, lambda: h.lambda, mtry: h.mtry };
  }
  if (algo === "random_forest") {
    const h = HP.random_forest;
    return { nTrees: h.nTrees, maxDepth: h.maxDepth, mtry: h.mtry, minSamples: h.minSamples };
  }
  const h = HP.logistic_regression;
  return { epochs: h.epochs, lr: h.lr, l2: h.l2 };
}
