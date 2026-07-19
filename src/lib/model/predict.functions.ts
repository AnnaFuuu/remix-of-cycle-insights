import { createServerFn } from "@tanstack/react-start";
import type { PredictorInput, PredictionResult, MenstrualPhase } from "@/lib/prediction/types";
import {
  argmax, deserializeModel, predictProba, type SerializedArtifact,
} from "./classifier-core.server";

// -----------------------------------------------------------------------------
// Live phase inference using the winning classifier saved by
// `trainPhaseClassification`. Reads the artifact from Postgres, maps the
// dashboard's PredictorInput to the model's feature vector (train-median
// imputation for anything the user marked N/A), and returns per-class
// probabilities.
// -----------------------------------------------------------------------------

// Dashboard field name → matview column key.
const UI_TO_FEATURE: Record<string, string> = {
  bmi:              "bmi",
  wristTempDelta:   "wrist_temp_overnight_mean",
  lh:               "lh",
  estradiol:        "estrogen",
  restingHR:        "rhr",
  hrv:              "hrv_mean",
  respiratoryRate:  "resp_rate_full",
  sleepScore:       "sleep_score",
  sleepDuration:    "sleep_asleep_min",   // converted below (hours → minutes)
  stressScore:      "stress_score",
  glucose:          "glucose_mean",
  cramps:           "cramps",
  bloating:         "bloating",
};

// "Fertility" is the training-label name for the ovulatory window.
function toPublicPhase(label: string): MenstrualPhase {
  return label === "Fertility" ? "Ovulatory" : (label as MenstrualPhase);
}

function toFeatureValue(uiKey: string, raw: number | null): number | null {
  if (raw === null || raw === undefined || !Number.isFinite(raw)) return null;
  // Sleep duration is entered in hours; matview stores minutes.
  if (uiKey === "sleepDuration") return raw <= 24 ? raw * 60 : raw;
  return raw;
}

export interface PhaseModelInfo {
  algo: string;
  classes: string[];
  nPredictors: number;
  nTrain: number;
  metrics: Record<string, unknown> | null;
  trainedAt: string;
}

export const getPhaseModelInfo = createServerFn({ method: "GET" }).handler(async (): Promise<PhaseModelInfo | null> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin.from("mcphases_trained_models" as any) as any)
    .select("algo, classes, predictors, metrics, n_train, trained_at")
    .eq("kind", "phase_classifier").maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const d = data as { algo: string; classes: string[]; predictors: string[]; metrics: unknown; n_train: number; trained_at: string };
  return {
    algo: d.algo,
    classes: d.classes,
    nPredictors: d.predictors.length,
    nTrain: d.n_train,
    metrics: d.metrics,
    trainedAt: d.trained_at,
  };
});

export const predictPhase = createServerFn({ method: "POST" })
  .inputValidator((input: PredictorInput) => input)
  .handler(async ({ data }): Promise<PredictionResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabaseAdmin.from("mcphases_trained_models" as any) as any)
      .select("algo, predictors, medians, classes, artifact")
      .eq("kind", "phase_classifier").maybeSingle();
    if (error) throw error;
    if (!row) {
      throw new Error(
        "No trained phase classifier found. Please run Step 5 (Analytics → Phase classification) first.",
      );
    }
    const stored = row as {
      algo: string;
      predictors: string[];
      medians: number[];
      classes: string[];
      artifact: SerializedArtifact;
    };
    const model = deserializeModel(stored.artifact);
    const { predictors, medians, classes } = stored;

    // Build the feature vector from the UI payload.
    const uiByFeature: Record<string, number | null> = {};
    for (const uiKey of Object.keys(UI_TO_FEATURE)) {
      const featureKey = UI_TO_FEATURE[uiKey];
      const raw = (data as unknown as Record<string, number | null>)[uiKey];
      uiByFeature[featureKey] = toFeatureValue(uiKey, raw ?? null);
    }
    const imputedKeys: string[] = [];
    const x = new Float64Array(predictors.length);
    for (let f = 0; f < predictors.length; f++) {
      const key = predictors[f];
      const v = uiByFeature[key];
      if (v !== null && v !== undefined && Number.isFinite(v)) {
        x[f] = v;
      } else {
        x[f] = medians[f] ?? 0;
        imputedKeys.push(key);
      }
    }

    const probs = predictProba(model, x);
    const idx = argmax(probs);
    const probabilities = {} as Record<MenstrualPhase, number>;
    for (let k = 0; k < classes.length; k++) {
      probabilities[toPublicPhase(classes[k])] = +probs[k].toFixed(4);
    }
    const phase = toPublicPhase(classes[idx]);
    const confidence = +probs[idx].toFixed(4);

    const imputed: { lh?: number; estradiol?: number } = {};
    for (let f = 0; f < predictors.length; f++) {
      if (predictors[f] === "lh" && imputedKeys.includes("lh")) imputed.lh = +medians[f].toFixed(3);
      if (predictors[f] === "estrogen" && imputedKeys.includes("estrogen")) imputed.estradiol = +medians[f].toFixed(3);
    }

    return { phase, confidence, probabilities, imputed };
  });
