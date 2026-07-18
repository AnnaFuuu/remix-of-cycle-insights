export type HormonalPhase = "Menstrual" | "Follicular" | "Ovulatory" | "Luteal";

export interface SubjectiveMetrics {
  mood: number; // 1-10
  energy: number; // 1-10
  stress: number; // 1-10
  symptoms: {
    cramps: number;
    fatigue: number;
    bloating: number;
    headache: number;
    nausea: number;
    breastTenderness: number;
  };
  notes: string;
}

export interface ObjectiveMetrics {
  bbt: number | null; // basal body temp (°C)
  sleepHours: number | null;
  sleepQuality: number | null; // 1-10
  steps: number | null;
  restingHR: number | null;
  hrv: number | null;
}

export interface Biomarkers {
  estrogen: number | null; // pg/mL
  progesterone: number | null; // ng/mL
  lh: number | null; // mIU/mL
  fsh: number | null; // mIU/mL
  notes: string;
}

export interface TelemetryEntry {
  id: string;
  date: string; // ISO yyyy-mm-dd
  cycleDay: number;
  phase: HormonalPhase;
  subjective: SubjectiveMetrics;
  objective: ObjectiveMetrics;
  biomarkers: Biomarkers;
  researchConsent: boolean;
  anonymized: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  alias: string;
  cycleLength: number;
  lutealLength: number;
  timezone: string;
  researchOptIn: boolean;
  units: {
    temperature: "C" | "F";
  };
  theme: "light" | "dark";
  anonymizationLevel: "standard" | "strict";
}

export interface ResearchExportPacket {
  subject_id: string;
  collection_date: string;
  cycle_day: number;
  phase: HormonalPhase;
  subjective: SubjectiveMetrics;
  objective: ObjectiveMetrics;
  biomarkers: Biomarkers;
  consent: {
    research_opt_in: boolean;
    anonymized: boolean;
    anonymization_level: "standard" | "strict";
  };
  version: string;
  source: string;
}

export interface SyntheticCohortRecord {
  subject_id: string;
  cycle_day: number;
  phase: HormonalPhase;
  bbt: number;
  mood: number;
  energy: number;
  sleep_hours: number;
  estrogen: number;
  progesterone: number;
  lh: number;
  fsh: number;
}

export const EXPORT_SCHEMA_VERSION = "hnhh.v1.0.0";