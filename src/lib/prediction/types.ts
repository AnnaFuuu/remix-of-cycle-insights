export interface PredictorInput {
  age: number;
  bmi: number | null;
  wristTempDelta: number | null;
  lh: number | null;
  estradiol: number | null;
  restingHR: number | null;
  hrv: number | null;
  respiratoryRate: number | null;
  sleepScore: number | null;
  sleepDuration: number | null;
  stressScore: number | null;
  glucose: number | null;
  cramps: number | null;
  bloating: number | null;
}

export type MenstrualPhase = "Menstrual" | "Follicular" | "Ovulatory" | "Luteal";

export interface PredictionResult {
  phase: MenstrualPhase;
  confidence: number;
  probabilities: Record<MenstrualPhase, number>;
  imputed: {
    lh?: number;
    estradiol?: number;
  };
}