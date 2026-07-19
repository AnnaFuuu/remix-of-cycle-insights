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
// Step 5 · Menstrual phase classification (thin server-fn wrapper)
// Trains three classifiers, picks the winner by validation macro-F1, and
// persists the winning artifact to `mcphases_trained_models` so the dashboard
// can call `predictPhase` for live inference.
// -----------------------------------------------------------------------------

export type { AlgoName, ClassMetrics };
export { CLASSES };

export interface AlgoResult {
  algo: AlgoName;
  label: string;
  hyperparams: Record<string, number | string>;
  accuracy: { train: number; val: number; test: number };
  macroF1:  { train: number; val: number; test: number };
  logLoss:  { train: number; val: number; test: number };
  perClass: { val: Record<PhaseKey, ClassMetrics>; test: Record<PhaseKey, ClassMetrics> };
  confusion: { val: number[][]; test: number[][] };
  fitMs: number;
}
export interface FeatureImportance { key: string; label: string; importance: number }
export interface ClassificationResult {
  classes: PhaseKey[];
  predictors: string[];
  trainN: number; valN: number; testN: number;
  classCounts: { train: Record<PhaseKey, number>; val: Record<PhaseKey, number>; test: Record<PhaseKey, number> };
  algos: AlgoResult[];
  bestAlgo: AlgoName;
  featureImportances: FeatureImportance[];
  refreshedAt: string;
  notes: string;
  savedModelId?: string;
}

const EXCLUDE = new Set(["phase", "participant_id", "day_in_study", "sleep_start", "sleep_end"]);

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
  const predictors = FEATURE_DEFS.map((d) => d.key).filter((k) => !EXCLUDE.has(k));
  const nFeat = predictors.length;

  const phaseIdx: Record<string, number> = {};
  CLASSES.forEach((c, i) => (phaseIdx[c] = i));

  interface Row { i: number; y: number; s: "train" | "validation" | "test" }
  const kept: Row[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.phase || phaseIdx[r.phase] === undefined) continue;
    const s = assignment[r.participant_id];
    if (s !== "train" && s !== "validation" && s !== "test") continue;
    kept.push({ i, y: phaseIdx[r.phase], s });
  }

  const medians = new Float64Array(nFeat);
  for (let f = 0; f < nFeat; f++) {
    const vals: number[] = [];
    const key = predictors[f];
    for (const k of kept) if (k.s === "train") { const v = toNum(rows[k.i][key]); if (v !== null) vals.push(v); }
    vals.sort((a, b) => a - b);
    medians[f] = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) >> 1] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : 0;
  }

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

  const classWeight = new Float64Array(K);
  {
    const c = new Float64Array(K);
    for (const v of tr.y) c[v]++;
    const total = tr.y.length;
    for (let k = 0; k < K; k++) classWeight[k] = c[k] > 0 ? total / (K * c[k]) : 1;
  }

  const mtry = Math.max(4, Math.floor(Math.sqrt(nFeat)));
  const gbrtMtry = Math.max(6, Math.floor(Math.sqrt(nFeat) * 1.5));
  const algos: AlgoResult[] = [];
  const trainedByAlgo: Record<AlgoName, AnyModel> = {} as Record<AlgoName, AnyModel>;

  const evalOn = (m: AnyModel, X: Float64Array[], y: Int32Array) => {
    const probs = X.map((x) => predictProba(m, x));
    return computeMetrics(y, probs);
  };

  {
    // Deeper boosted stumps with a slower learning rate + column subsampling
    // (mtry < nFeat) generalize substantially better than the original shallow,
    // full-feature ensemble. More rounds + smaller lr shrinks bias without
    // over-fitting thanks to L2 leaf regularization.
    const hp = { nTrees: 250, maxDepth: 5, lr: 0.05, mtry: gbrtMtry, minSamples: 4, candidates: 24, lambda: 1, seed: 42 };
    const t0 = performance.now();
    const m = fitSoftmaxGBRT(tr.X, tr.y, { ...hp, classWeight });
    const fitMs = +(performance.now() - t0).toFixed(0);
    trainedByAlgo.softmax_gbrt = m;
    const mt = evalOn(m, tr.X, tr.y), mv = evalOn(m, va.X, va.y), me = evalOn(m, te.X, te.y);
    algos.push({
      algo: "softmax_gbrt", label: "Softmax GBRT",
      hyperparams: { nTrees: hp.nTrees, maxDepth: hp.maxDepth, lr: hp.lr, lambda: hp.lambda, mtry: hp.mtry },
      accuracy: { train: mt.accuracy, val: mv.accuracy, test: me.accuracy },
      macroF1:  { train: mt.macroF1,  val: mv.macroF1,  test: me.macroF1 },
      logLoss:  { train: mt.logLoss,  val: mv.logLoss,  test: me.logLoss },
      perClass: { val: mv.perClass, test: me.perClass },
      confusion: { val: mv.confusion, test: me.confusion },
      fitMs,
    });
  }
  {
    // Larger, deeper forest with min-leaf = 2 lets the trees resolve rare
    // phase transitions (Menstrual/Fertility) that the shallow forest missed.
    const hp = { nTrees: 300, maxDepth: 16, mtry, minSamples: 2, candidates: 20, seed: 42 };
    const t0 = performance.now();
    const m = fitRandomForest(tr.X, tr.y, hp);
    const fitMs = +(performance.now() - t0).toFixed(0);
    trainedByAlgo.random_forest = m;
    const mt = evalOn(m, tr.X, tr.y), mv = evalOn(m, va.X, va.y), me = evalOn(m, te.X, te.y);
    algos.push({
      algo: "random_forest", label: "Random Forest",
      hyperparams: { nTrees: hp.nTrees, maxDepth: hp.maxDepth, mtry: hp.mtry, minSamples: hp.minSamples },
      accuracy: { train: mt.accuracy, val: mv.accuracy, test: me.accuracy },
      macroF1:  { train: mt.macroF1,  val: mv.macroF1,  test: me.macroF1 },
      logLoss:  { train: mt.logLoss,  val: mv.logLoss,  test: me.logLoss },
      perClass: { val: mv.perClass, test: me.perClass },
      confusion: { val: mv.confusion, test: me.confusion },
      fitMs,
    });
  }
  {
    // Longer training with lighter L2 lets the standardized logistic model
    // fully converge; the previous 200-epoch run stopped short of optimum.
    const hp = { epochs: 500, lr: 0.2, l2: 1e-4 };
    const t0 = performance.now();
    const m = fitLogReg(tr.X, tr.y, { ...hp, classWeight });
    const fitMs = +(performance.now() - t0).toFixed(0);
    trainedByAlgo.logistic_regression = m;
    const mt = evalOn(m, tr.X, tr.y), mv = evalOn(m, va.X, va.y), me = evalOn(m, te.X, te.y);
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

  let bestAlgo: AlgoName = algos[0].algo;
  let bestVal = -Infinity;
  for (const a of algos) if (a.macroF1.val > bestVal) { bestVal = a.macroF1.val; bestAlgo = a.algo; }

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

  // Persist winner for live inference on the Dashboard.
  const winnerAlgo = algos.find((a) => a.algo === bestAlgo)!;
  let savedModelId: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: saved, error: saveErr } = await (supabaseAdmin.from("mcphases_trained_models" as any) as any)
      .upsert({
        kind: "phase_classifier",
        algo: bestAlgo,
        predictors,
        medians: Array.from(medians),
        classes: CLASSES,
        artifact: serializeModel(winnerModel),
        metrics: {
          accuracy: winnerAlgo.accuracy,
          macroF1: winnerAlgo.macroF1,
          logLoss: winnerAlgo.logLoss,
        },
        n_train: tr.y.length,
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
    trainN: tr.y.length, valN: va.y.length, testN: te.y.length,
    classCounts,
    algos,
    bestAlgo,
    featureImportances,
    refreshedAt: new Date().toISOString(),
    notes: "Winner selected by validation macro-F1; class weights = inverse train frequency; imputation uses train-set medians.",
    savedModelId,
  };
  try {
    const { savePipelineRun } = await import("./pipeline-runs.functions");
    await savePipelineRun("classification", payload);
  } catch (e) { console.error("[classification] savePipelineRun failed", e); }
  return payload;
});
