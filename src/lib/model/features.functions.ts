import { createServerFn } from "@tanstack/react-start";

export interface FeatureDef {
  key: string;
  label: string;
  group: "Label" | "Endocrine" | "Anthropometric" | "HRV" | "Sleep" | "Sleep score" | "Resting HR" | "Respiratory" | "Stress" | "Glucose" | "Self-report";
  source: string;
  description: string;
}

export const FEATURE_DEFS: FeatureDef[] = [
  { key: "phase",              label: "Menstrual phase",              group: "Label",         source: "hormones_selfreport",       description: "Classification target (Menstrual / Follicular / Fertility / Luteal)." },
  { key: "lh",                 label: "LH",                           group: "Endocrine",     source: "hormones_selfreport",       description: "Urinary LH strip reading (regression target when observed; predictor otherwise)." },
  { key: "estrogen",           label: "Estrogen (E3G)",               group: "Endocrine",     source: "hormones_selfreport",       description: "Urinary estrogen strip reading." },
  { key: "pdg",                label: "PdG",                          group: "Endocrine",     source: "hormones_selfreport",       description: "Urinary progesterone metabolite." },
  { key: "height_cm",          label: "Height (cm)",                  group: "Anthropometric",source: "height_weight",             description: "Latest available snapshot (2024 else 2022)." },
  { key: "weight_kg",          label: "Weight (kg)",                  group: "Anthropometric",source: "height_weight",             description: "Latest available snapshot (2024 else 2022)." },
  { key: "bmi",                label: "BMI",                          group: "Anthropometric",source: "derived",                    description: "weight / (height_m)^2, from latest snapshot." },
  { key: "hrv_mean",           label: "HRV mean (RMSSD)",             group: "HRV",           source: "hrv_details",               description: "Daily mean of 5-min RMSSD; low-coverage windows (<0.5) dropped." },
  { key: "hrv_median",         label: "HRV median",                   group: "HRV",           source: "hrv_details",               description: "Daily median RMSSD." },
  { key: "hrv_min",            label: "HRV min",                      group: "HRV",           source: "hrv_details",               description: "Daily minimum RMSSD." },
  { key: "hrv_max",            label: "HRV max",                      group: "HRV",           source: "hrv_details",               description: "Daily maximum RMSSD." },
  { key: "hrv_std",            label: "HRV std",                      group: "HRV",           source: "hrv_details",               description: "Daily sample standard deviation of RMSSD." },
  { key: "hrv_lf_mean",        label: "HRV LF power",                 group: "HRV",           source: "hrv_details",               description: "Mean low-frequency band power." },
  { key: "hrv_hf_mean",        label: "HRV HF power",                 group: "HRV",           source: "hrv_details",               description: "Mean high-frequency band power." },
  { key: "hrv_samples",        label: "HRV samples",                  group: "HRV",           source: "hrv_details",               description: "Number of valid 5-min windows used." },
  { key: "sleep_asleep_min",   label: "Sleep asleep (min)",           group: "Sleep",         source: "sleep",                     description: "Sum of minutes_asleep across sessions starting that day." },
  { key: "sleep_in_bed_min",   label: "Time in bed (min)",            group: "Sleep",         source: "sleep",                     description: "Sum of time_in_bed across sessions." },
  { key: "sleep_awake_min",    label: "Awake (min)",                  group: "Sleep",         source: "sleep",                     description: "Sum of minutes_awake." },
  { key: "sleep_efficiency",   label: "Sleep efficiency (%)",         group: "Sleep",         source: "sleep",                     description: "Mean session efficiency." },
  { key: "sleep_deep_min",     label: "Deep sleep (min)",             group: "Sleep",         source: "sleep.levels",              description: "Summed from levels.summary.deep.minutes." },
  { key: "sleep_rem_min",      label: "REM sleep (min)",              group: "Sleep",         source: "sleep.levels",              description: "Summed from levels.summary.rem.minutes." },
  { key: "sleep_light_min",    label: "Light sleep (min)",            group: "Sleep",         source: "sleep.levels",              description: "Summed from levels.summary.light.minutes." },
  { key: "sleep_wake_min",     label: "Wake epochs (min)",            group: "Sleep",         source: "sleep.levels",              description: "Summed from levels.summary.wake.minutes." },
  { key: "sleep_start",        label: "Sleep start",                  group: "Sleep",         source: "sleep",                     description: "Earliest session start timestamp." },
  { key: "sleep_end",          label: "Sleep end",                    group: "Sleep",         source: "sleep",                     description: "Latest session end timestamp." },
  { key: "sleep_sessions",     label: "Sleep sessions",               group: "Sleep",         source: "sleep",                     description: "Number of sleep sessions that day." },
  { key: "sleep_score",        label: "Sleep score",                  group: "Sleep score",   source: "sleep_score",               description: "Fitbit overall sleep score." },
  { key: "sleep_composition_score",   label: "Composition score",     group: "Sleep score",   source: "sleep_score",               description: "Composition sub-score." },
  { key: "sleep_revitalization_score",label: "Revitalization score",  group: "Sleep score",   source: "sleep_score",               description: "Revitalization sub-score." },
  { key: "sleep_duration_score",      label: "Duration score",        group: "Sleep score",   source: "sleep_score",               description: "Duration sub-score." },
  { key: "sleep_deep_score_min",      label: "Deep sleep (score)",    group: "Sleep score",   source: "sleep_score",               description: "Deep minutes reported by sleep score." },
  { key: "sleep_rhr",          label: "Resting HR (sleep)",           group: "Sleep score",   source: "sleep_score",               description: "Overnight resting heart rate." },
  { key: "sleep_restlessness", label: "Restlessness",                 group: "Sleep score",   source: "sleep_score",               description: "Restlessness index." },
  { key: "rhr",                label: "Resting HR",                   group: "Resting HR",    source: "resting_heart_rate",        description: "Daily resting heart rate." },
  { key: "rhr_error",          label: "Resting HR error",             group: "Resting HR",    source: "resting_heart_rate",        description: "Reported error / uncertainty." },
  { key: "resp_rate_full",     label: "Respiratory rate (full)",      group: "Respiratory",   source: "respiratory_rate_summary",  description: "Overnight full-sleep breathing rate." },
  { key: "resp_rate_deep",     label: "Respiratory rate (deep)",      group: "Respiratory",   source: "respiratory_rate_summary",  description: "Deep-sleep breathing rate." },
  { key: "resp_rate_rem",      label: "Respiratory rate (REM)",       group: "Respiratory",   source: "respiratory_rate_summary",  description: "REM-sleep breathing rate." },
  { key: "resp_rate_light",    label: "Respiratory rate (light)",     group: "Respiratory",   source: "respiratory_rate_summary",  description: "Light-sleep breathing rate." },
  { key: "stress_score",       label: "Stress score",                 group: "Stress",        source: "stress_score",              description: "Fitbit daily stress management score." },
  { key: "stress_sleep_points",         label: "Stress · sleep pts",  group: "Stress",        source: "stress_score",              description: "Sleep sub-points." },
  { key: "stress_responsiveness_points",label: "Stress · resp pts",   group: "Stress",        source: "stress_score",              description: "Responsiveness sub-points." },
  { key: "stress_exertion_points",      label: "Stress · exertion pts",group: "Stress",       source: "stress_score",              description: "Exertion sub-points." },
  { key: "glucose_mean",       label: "Glucose mean (mmol/L)",        group: "Glucose",       source: "glucose",                   description: "Daily mean CGM value." },
  { key: "glucose_min",        label: "Glucose min",                  group: "Glucose",       source: "glucose",                   description: "Daily minimum CGM value." },
  { key: "glucose_max",        label: "Glucose max",                  group: "Glucose",       source: "glucose",                   description: "Daily maximum CGM value." },
  { key: "glucose_std",        label: "Glucose std",                  group: "Glucose",       source: "glucose",                   description: "Daily standard deviation (variability)." },
  { key: "glucose_range",      label: "Glucose range",                group: "Glucose",       source: "glucose",                   description: "max - min for the day." },
  { key: "glucose_samples",    label: "Glucose samples",              group: "Glucose",       source: "glucose",                   description: "Number of CGM readings that day." },
  { key: "cramps",             label: "Cramps",                       group: "Self-report",   source: "hormones_selfreport",       description: "Ordinal 0-5 self-report." },
  { key: "bloating",           label: "Bloating",                     group: "Self-report",   source: "hormones_selfreport",       description: "Ordinal 0-5 self-report." },
  { key: "fatigue",            label: "Fatigue",                      group: "Self-report",   source: "hormones_selfreport",       description: "Ordinal 0-5 self-report." },
  { key: "headaches",          label: "Headaches",                    group: "Self-report",   source: "hormones_selfreport",       description: "Ordinal 0-5 self-report." },
  { key: "sorebreasts",        label: "Sore breasts",                 group: "Self-report",   source: "hormones_selfreport",       description: "Ordinal 0-5 self-report." },
  { key: "moodswing",          label: "Mood swings",                  group: "Self-report",   source: "hormones_selfreport",       description: "Ordinal 0-5 self-report." },
  { key: "self_stress",        label: "Stress (self)",                group: "Self-report",   source: "hormones_selfreport",       description: "Self-reported stress." },
  { key: "sleepissue",         label: "Sleep issues (self)",          group: "Self-report",   source: "hormones_selfreport",       description: "Self-reported sleep quality issue." },
];

export interface FeatureCoverage {
  key: string;
  nonNull: number;
  completeness: number;
}

export interface FeatureRow {
  participant_id: number;
  day_in_study: number;
  phase: string | null;
  [k: string]: number | string | boolean | null;
}

export interface FeatureEngineeringResult {
  totalRows: number;
  totalParticipants: number;
  dayMin: number | null;
  dayMax: number | null;
  coverage: FeatureCoverage[];
  preview: FeatureRow[];
  definitions: FeatureDef[];
  refreshedAt: string;
}

export const refreshDailyFeatures = createServerFn({ method: "POST" }).handler(async (): Promise<{ ok: true }> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any).rpc("refresh_mcphases_daily_features");
  if (error) throw error;
  return { ok: true };
});

export const getDailyFeatures = createServerFn({ method: "GET" }).handler(async (): Promise<FeatureEngineeringResult> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const rows: FeatureRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin.from("mcphases_daily_features" as any) as any)
      .select("*")
      .order("participant_id", { ascending: true })
      .order("day_in_study", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as FeatureRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const subjSet = new Set<number>();
  let dayMin: number | null = null;
  let dayMax: number | null = null;
  const nonNull = new Map<string, number>();
  for (const def of FEATURE_DEFS) nonNull.set(def.key, 0);

  for (const r of rows) {
    subjSet.add(r.participant_id);
    if (typeof r.day_in_study === "number") {
      if (dayMin == null || r.day_in_study < dayMin) dayMin = r.day_in_study;
      if (dayMax == null || r.day_in_study > dayMax) dayMax = r.day_in_study;
    }
    for (const def of FEATURE_DEFS) {
      const v = r[def.key];
      if (v !== null && v !== undefined) nonNull.set(def.key, (nonNull.get(def.key) ?? 0) + 1);
    }
  }

  const total = rows.length;
  const coverage: FeatureCoverage[] = FEATURE_DEFS.map((d) => {
    const nn = nonNull.get(d.key) ?? 0;
    return { key: d.key, nonNull: nn, completeness: total ? nn / total : 0 };
  });

  return {
    totalRows: total,
    totalParticipants: subjSet.size,
    dayMin,
    dayMax,
    coverage,
    preview: rows.slice(0, 25),
    definitions: FEATURE_DEFS,
    refreshedAt: new Date().toISOString(),
  };
});
