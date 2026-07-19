// Client-safe helpers for mapping CSV headers to our sleep record schema.

export interface SleepRow {
  subject_id: string;
  recording_date: string | null;
  night_index: number | null;
  total_sleep_min: number | null;
  deep_min: number | null;
  light_min: number | null;
  rem_min: number | null;
  awake_min: number | null;
  sleep_efficiency: number | null;
  latency_min: number | null;
  waso_min: number | null;
  quality_score: number | null;
  raw: Record<string, unknown>;
}

export type FieldKey = keyof Omit<SleepRow, "raw">;

const ALIASES: Record<FieldKey, string[]> = {
  subject_id: ["subject", "subject_id", "subjectid", "sid", "id", "nsrrid", "participant", "patient", "record"],
  recording_date: ["date", "recording_date", "night_date", "study_date", "visit_date"],
  night_index: ["night", "night_index", "session", "visit", "recording"],
  total_sleep_min: ["tst", "total_sleep_time", "total_sleep_min", "tst_min", "sleep_duration", "slp_time"],
  deep_min: ["deep", "n3", "sws", "deep_min", "n3_min", "slow_wave", "stage_n3"],
  light_min: ["light", "n1n2", "light_min", "stage_n1n2", "n2", "stage_n2"],
  rem_min: ["rem", "rem_min", "stage_rem", "rem_time"],
  awake_min: ["awake", "wake", "wake_min", "waso_wake", "awake_time", "stage_w"],
  sleep_efficiency: ["se", "sleep_efficiency", "efficiency", "slpeff", "sleep_eff"],
  latency_min: ["sol", "latency", "sleep_latency", "slp_latp", "sleep_onset_latency"],
  waso_min: ["waso", "waso_min", "wake_after_sleep_onset"],
  quality_score: ["quality", "quality_score", "psqi", "sq", "sleep_quality"],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function autoMapHeaders(headers: string[]): Partial<Record<FieldKey, string>> {
  const norm = headers.map((h) => ({ raw: h, n: normalize(h) }));
  const out: Partial<Record<FieldKey, string>> = {};
  for (const key of Object.keys(ALIASES) as FieldKey[]) {
    const aliases = ALIASES[key].map(normalize);
    const hit = norm.find((h) => aliases.includes(h.n));
    if (hit) out[key] = hit.raw;
  }
  return out;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v).trim();
}

function isoDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function projectRows(
  raw: Record<string, unknown>[],
  mapping: Partial<Record<FieldKey, string>>,
): SleepRow[] {
  const get = (row: Record<string, unknown>, key: FieldKey) =>
    mapping[key] ? row[mapping[key] as string] : null;
  return raw
    .map((r, i) => {
      const subject = str(get(r, "subject_id")) ?? `S${String(i + 1).padStart(4, "0")}`;
      return {
        subject_id: subject,
        recording_date: isoDate(get(r, "recording_date")),
        night_index: num(get(r, "night_index")),
        total_sleep_min: num(get(r, "total_sleep_min")),
        deep_min: num(get(r, "deep_min")),
        light_min: num(get(r, "light_min")),
        rem_min: num(get(r, "rem_min")),
        awake_min: num(get(r, "awake_min")),
        sleep_efficiency: num(get(r, "sleep_efficiency")),
        latency_min: num(get(r, "latency_min")),
        waso_min: num(get(r, "waso_min")),
        quality_score: num(get(r, "quality_score")),
        raw: r,
      } satisfies SleepRow;
    })
    .filter((r) => r.subject_id);
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  subject_id: "Subject ID",
  recording_date: "Date",
  night_index: "Night #",
  total_sleep_min: "Total sleep (min)",
  deep_min: "Deep (min)",
  light_min: "Light / N1+N2 (min)",
  rem_min: "REM (min)",
  awake_min: "Awake (min)",
  sleep_efficiency: "Sleep efficiency (%)",
  latency_min: "Sleep latency (min)",
  waso_min: "WASO (min)",
  quality_score: "Quality score",
};

export interface DatasetSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  citation: string | null;
  source_url: string | null;
  uploaded_at: string;
  row_count: number;
  subjects_count: number | null;
  variables_count: number | null;
}

export interface AggregateStats {
  nRecords: number;
  nSubjects: number;
  dateStart: string | null;
  dateEnd: string | null;
  meanTST: number | null;
  meanSE: number | null;
  meanDeep: number | null;
  meanREM: number | null;
  completeness: Record<FieldKey, number>;
  qualityBins: { bin: string; count: number }[];
  subjectAgg: { subject: string; nights: number; tst: number; se: number }[];
}
