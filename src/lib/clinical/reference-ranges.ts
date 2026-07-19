import type { HormonalPhase } from "@/lib/hormonal/types";
import type { LabAnalyte, AssayFlag } from "./types";

// Adult premenopausal reference ranges (phase-aware where applicable).
// Sources: LabCorp / Quest / Mayo panels. Approximate midranges for hackathon use.
type Range = [number, number];

export const REF_UNITS: Record<LabAnalyte, string> = {
  LH: "mIU/mL",
  FSH: "mIU/mL",
  Estradiol: "pg/mL",
  Progesterone: "ng/mL",
  AMH: "ng/mL",
  Testosterone: "ng/dL",
  DHEA_S: "µg/dL",
  Prolactin: "ng/mL",
  TSH: "µIU/mL",
  FreeT4: "ng/dL",
  Cortisol: "µg/dL",
};

export const REF_METHOD: Record<LabAnalyte, string> = {
  LH: "ECLIA",
  FSH: "ECLIA",
  Estradiol: "LC-MS/MS",
  Progesterone: "LC-MS/MS",
  AMH: "ELISA",
  Testosterone: "LC-MS/MS",
  DHEA_S: "ECLIA",
  Prolactin: "ECLIA",
  TSH: "ECLIA",
  FreeT4: "ECLIA",
  Cortisol: "LC-MS/MS (AM)",
};

const PHASE_RANGES: Partial<Record<LabAnalyte, Record<HormonalPhase, Range>>> = {
  LH:  { Menstrual: [2, 12], Follicular: [2, 12], Ovulatory: [20, 90], Luteal: [1, 12] },
  FSH: { Menstrual: [3, 12], Follicular: [3, 12], Ovulatory: [4, 20],  Luteal: [1, 8]  },
  Estradiol:    { Menstrual: [20, 80], Follicular: [40, 200], Ovulatory: [150, 400], Luteal: [80, 250] },
  Progesterone: { Menstrual: [0.1, 0.7], Follicular: [0.1, 1.5], Ovulatory: [0.5, 3], Luteal: [3, 25] },
};

const NON_PHASE_RANGES: Partial<Record<LabAnalyte, Range>> = {
  AMH:          [1.0, 4.0],
  Testosterone: [15, 70],
  DHEA_S:       [60, 380],
  Prolactin:    [4, 23],
  TSH:          [0.45, 4.5],
  FreeT4:       [0.82, 1.77],
  Cortisol:     [6, 23],
};

export function refRange(analyte: LabAnalyte, phase: HormonalPhase): Range {
  const p = PHASE_RANGES[analyte];
  if (p) return p[phase];
  const n = NON_PHASE_RANGES[analyte];
  if (n) return n;
  return [0, 0];
}

export function flagFor(value: number, [low, high]: Range): AssayFlag {
  if (value < low) return "L";
  if (value > high) return "H";
  return "N";
}

export const ANALYTE_LABEL: Record<LabAnalyte, string> = {
  LH: "LH",
  FSH: "FSH",
  Estradiol: "Estradiol (E₂)",
  Progesterone: "Progesterone (P₄)",
  AMH: "AMH",
  Testosterone: "Testosterone, total",
  DHEA_S: "DHEA-S",
  Prolactin: "Prolactin",
  TSH: "TSH",
  FreeT4: "Free T4",
  Cortisol: "Cortisol, AM",
};

export const ANALYTE_ORDER: LabAnalyte[] = [
  "LH", "FSH", "Estradiol", "Progesterone", "AMH",
  "Testosterone", "DHEA_S", "Prolactin", "TSH", "FreeT4", "Cortisol",
];