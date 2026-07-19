import type { HormonalPhase } from "@/lib/hormonal/types";

export type LabAnalyte =
  | "LH"
  | "FSH"
  | "Estradiol"
  | "Progesterone"
  | "AMH"
  | "Testosterone"
  | "DHEA_S"
  | "Prolactin"
  | "TSH"
  | "FreeT4"
  | "Cortisol";

export type AssayFlag = "L" | "N" | "H";

export interface LabAssay {
  analyte: LabAnalyte;
  value: number;
  unit: string;
  refLow: number;
  refHigh: number;
  flag: AssayFlag;
  method: string;
}

export interface LabPanel {
  id: string;
  collectedAt: string; // ISO yyyy-mm-dd
  cycleDay: number;
  phase: HormonalPhase;
  fasting: boolean;
  lab: string;
  assays: LabAssay[];
}

export interface SleepStages {
  deep: number; // minutes
  light: number;
  rem: number;
  awake: number;
}

export interface WearableSample {
  date: string; // ISO
  hrv: number; // ms (RMSSD)
  restingHR: number; // bpm
  skinTempDelta: number; // °C from personal baseline
  respRate: number; // breaths/min
  spo2: number; // %
  steps: number;
  activeMinutes: number;
  sleepStages: SleepStages;
}

export interface FoundationHormonePrediction {
  analyte: LabAnalyte;
  unit: string;
  mean: number;
  ciLow: number;
  ciHigh: number;
  observed: number | null;
}

export interface FeatureImportance {
  feature: string;
  weight: number; // 0..1
}

export interface ShapContribution {
  feature: string;
  contribution: number; // signed
  direction: "increases" | "decreases";
  rationale: string;
}

export interface PhaseProbabilities {
  Menstrual: number;
  Follicular: number;
  Ovulatory: number;
  Luteal: number;
}

export interface FoundationPrediction {
  modelName: string;
  modelVersion: string;
  trainingCorpus: string;
  predictedPhase: HormonalPhase;
  confidence: number; // 0..1
  probabilities: PhaseProbabilities;
  hormones: FoundationHormonePrediction[];
  featureImportance: FeatureImportance[];
  shap: ShapContribution[];
  forecast: { date: string; e2: number; e2Low: number; e2High: number; p4: number; p4Low: number; p4High: number }[];
}

export interface DataQualityReport {
  overallCompleteness: number; // 0..1
  streams: {
    stream: string;
    completeness: number;
    missing: number;
    outliers: number;
    lastSample: string;
    uptimeDays: number;
  }[];
  driftScore: number; // 0..1
  heatmap: { date: string; streams: Record<string, 0 | 1> }[];
}

export interface DatasetMeta {
  id: string;
  name: string;
  sampleSize: number;
  subjects: string;
  modalities: string[];
  variables: number;
  provenance: string;
  license: string;
  citation: string;
  usedForPretraining: boolean;
  description: string;
}