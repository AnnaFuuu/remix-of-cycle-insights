// mcPHASES table registry. Every mcPHASES CSV documented in the study README
// has an entry here. `sleep_score` is fully active — column mapping populated
// and importer will parse it. Other tables have schemas in the database and
// stub column maps so the UI can list them as "awaiting data" slots; once you
// upload the corresponding CSV we just flip `status` to `"active"`.

export type ColumnCoercer = "string" | "number" | "int" | "bool" | "json";

export interface ColumnMap {
  csv: string;            // header in the CSV
  db: string;             // destination column
  coerce: ColumnCoercer;
  required?: boolean;
}

export type KeyStyle =
  | "day"          // unique per (participant, interval, day_in_study)
  | "day_ts"      // day + timestamp within day, multiple rows/day allowed
  | "window"       // sleep/session windows (start_day + start_ts)
  | "session"      // exercise-style sessions
  | "participant"; // one row per participant

export interface McphasesTable {
  key: string;           // registry key (matches suffix of DB table)
  table: string;         // full DB table name
  label: string;         // UI label
  description: string;   // short description from README
  status: "active" | "scaffold";
  keyStyle: KeyStyle;
  csvColumns: ColumnMap[]; // ordered mapping; empty for scaffold entries
  conflictColumns: string[]; // ON CONFLICT columns for upsert
  category: "sleep" | "cardio" | "activity" | "temperature" | "respiratory" | "metabolic" | "endocrine" | "demographic";
}

const scaffold = (
  key: string,
  table: string,
  label: string,
  description: string,
  keyStyle: KeyStyle,
  category: McphasesTable["category"],
): McphasesTable => ({
  key, table, label, description, status: "scaffold",
  keyStyle, csvColumns: [], conflictColumns: [], category,
});

export const MCPHASES_TABLES: McphasesTable[] = [
  {
    key: "sleep_score",
    table: "mcphases_sleep_score",
    label: "Sleep score",
    description: "Daily Fitbit sleep quality score with composition, revitalization, duration sub-scores.",
    status: "active",
    keyStyle: "day",
    category: "sleep",
    conflictColumns: ["participant_id", "study_interval", "day_in_study"],
    csvColumns: [
      { csv: "id", db: "participant_id", coerce: "int", required: true },
      { csv: "study_interval", db: "study_interval", coerce: "int", required: true },
      { csv: "is_weekend", db: "is_weekend", coerce: "bool" },
      { csv: "day_in_study", db: "day_in_study", coerce: "int", required: true },
      { csv: "timestamp", db: "timestamp_local", coerce: "string" },
      { csv: "overall_score", db: "overall_score", coerce: "number" },
      { csv: "composition_score", db: "composition_score", coerce: "number" },
      { csv: "revitalization_score", db: "revitalization_score", coerce: "number" },
      { csv: "duration_score", db: "duration_score", coerce: "number" },
      { csv: "deep_sleep_in_minutes", db: "deep_sleep_in_minutes", coerce: "number" },
      { csv: "resting_heart_rate", db: "resting_heart_rate", coerce: "number" },
      { csv: "restlessness", db: "restlessness", coerce: "number" },
    ],
  },
  {
    key: "sleep",
    table: "mcphases_sleep",
    label: "Sleep sessions",
    description: "Per-session Fitbit sleep logs with stages, efficiency, duration.",
    status: "active",
    keyStyle: "window",
    category: "sleep",
    conflictColumns: ["participant_id", "study_interval", "sleep_start_day_in_study", "sleep_start_timestamp"],
    csvColumns: [
      { csv: "id", db: "participant_id", coerce: "int", required: true },
      { csv: "study_interval", db: "study_interval", coerce: "int", required: true },
      { csv: "is_weekend", db: "is_weekend", coerce: "bool" },
      { csv: "sleep_start_day_in_study", db: "sleep_start_day_in_study", coerce: "int", required: true },
      { csv: "sleep_start_timestamp", db: "sleep_start_timestamp", coerce: "string", required: true },
      { csv: "sleep_end_day_in_study", db: "sleep_end_day_in_study", coerce: "int" },
      { csv: "sleep_end_timestamp", db: "sleep_end_timestamp", coerce: "string" },
      { csv: "duration", db: "duration", coerce: "number" },
      { csv: "minutestofallasleep", db: "minutes_to_fall_asleep", coerce: "number" },
      { csv: "minutesasleep", db: "minutes_asleep", coerce: "number" },
      { csv: "minutesawake", db: "minutes_awake", coerce: "number" },
      { csv: "minutesafterwakeup", db: "minutes_after_wakeup", coerce: "number" },
      { csv: "timeinbed", db: "time_in_bed", coerce: "number" },
      { csv: "efficiency", db: "efficiency", coerce: "number" },
      { csv: "type", db: "type", coerce: "string" },
      { csv: "infocode", db: "info_code", coerce: "string" },
      { csv: "levels", db: "levels", coerce: "json" },
      { csv: "mainsleep", db: "main_sleep", coerce: "bool" },
    ],
  },
  {
    key: "hrv_details",
    table: "mcphases_hrv_details",
    label: "HRV details",
    description: "5-min RMSSD / low & high frequency HRV during sleep.",
    status: "active",
    keyStyle: "day_ts",
    category: "cardio",
    conflictColumns: ["participant_id", "study_interval", "day_in_study", "timestamp_local"],
    csvColumns: [
      { csv: "id", db: "participant_id", coerce: "int", required: true },
      { csv: "study_interval", db: "study_interval", coerce: "int", required: true },
      { csv: "is_weekend", db: "is_weekend", coerce: "bool" },
      { csv: "day_in_study", db: "day_in_study", coerce: "int", required: true },
      { csv: "timestamp", db: "timestamp_local", coerce: "string", required: true },
      { csv: "rmssd", db: "rmssd", coerce: "number" },
      { csv: "coverage", db: "coverage", coerce: "number" },
      { csv: "low_frequency", db: "low_frequency", coerce: "number" },
      { csv: "high_frequency", db: "high_frequency", coerce: "number" },
    ],
  },
  {
    key: "resting_heart_rate",
    table: "mcphases_resting_heart_rate",
    label: "Resting heart rate",
    description: "Daily Fitbit resting heart rate with per-day error estimate.",
    status: "active",
    keyStyle: "day",
    category: "cardio",
    conflictColumns: ["participant_id", "study_interval", "day_in_study"],
    csvColumns: [
      { csv: "id", db: "participant_id", coerce: "int", required: true },
      { csv: "study_interval", db: "study_interval", coerce: "int", required: true },
      { csv: "is_weekend", db: "is_weekend", coerce: "bool" },
      { csv: "day_in_study", db: "day_in_study", coerce: "int", required: true },
      { csv: "value", db: "value", coerce: "number" },
      { csv: "error", db: "error", coerce: "number" },
    ],
  },
  scaffold("heart_rate", "mcphases_heart_rate", "Heart rate (continuous)", "Continuous Fitbit BPM samples.", "day_ts", "cardio"),
  scaffold("steps", "mcphases_steps", "Steps", "Timestamped step counts.", "day_ts", "activity"),
  scaffold("distance", "mcphases_distance", "Distance", "Distance covered in meters.", "day_ts", "activity"),
  scaffold("calories", "mcphases_calories", "Calories", "Calories burned (resting + active).", "day_ts", "activity"),
  scaffold("altitude", "mcphases_altitude", "Altitude", "Relative altitude gain (no GPS).", "day_ts", "activity"),
  scaffold("active_minutes", "mcphases_active_minutes", "Active minutes", "Daily minutes sedentary/light/moderate/very.", "day", "activity"),
  scaffold("active_zone_minutes", "mcphases_active_zone_minutes", "Active zone minutes", "Time in fat-burn / cardio / peak zones.", "day_ts", "activity"),
  scaffold("time_in_hr_zones", "mcphases_time_in_hr_zones", "Time in HR zones", "Time below/in default HR zones per day.", "day", "cardio"),
  scaffold("exercise", "mcphases_exercise", "Exercise sessions", "Auto-detected & manual workout logs.", "session", "activity"),
  scaffold("computed_temperature", "mcphases_computed_temperature", "Nightly skin temp", "Fitbit skin temperature computed per sleep window.", "window", "temperature"),
  scaffold("wrist_temperature", "mcphases_wrist_temperature", "Wrist temperature", "Skin temp deviation from personal baseline.", "day_ts", "temperature"),
  {
    key: "respiratory_rate_summary",
    table: "mcphases_respiratory_rate_summary",
    label: "Respiratory rate",
    description: "Nightly respiratory rate by sleep stage (full / deep / light / REM) with SD and SNR.",
    status: "active",
    keyStyle: "day",
    category: "respiratory",
    conflictColumns: ["participant_id", "study_interval", "day_in_study"],
    csvColumns: [
      { csv: "id", db: "participant_id", coerce: "int", required: true },
      { csv: "study_interval", db: "study_interval", coerce: "int", required: true },
      { csv: "is_weekend", db: "is_weekend", coerce: "bool" },
      { csv: "day_in_study", db: "day_in_study", coerce: "int", required: true },
      { csv: "timestamp", db: "timestamp_local", coerce: "string" },
      { csv: "full_sleep_breathing_rate", db: "full_sleep_breathing_rate", coerce: "number" },
      { csv: "full_sleep_standard_deviation", db: "full_sleep_standard_deviation", coerce: "number" },
      { csv: "full_sleep_signal_to_noise", db: "full_sleep_signal_to_noise", coerce: "number" },
      { csv: "deep_sleep_breathing_rate", db: "deep_sleep_breathing_rate", coerce: "number" },
      { csv: "deep_sleep_standard_deviation", db: "deep_sleep_standard_deviation", coerce: "number" },
      { csv: "deep_sleep_signal_to_noise", db: "deep_sleep_signal_to_noise", coerce: "number" },
      { csv: "light_sleep_breathing_rate", db: "light_sleep_breathing_rate", coerce: "number" },
      { csv: "light_sleep_standard_deviation", db: "light_sleep_standard_deviation", coerce: "number" },
      { csv: "light_sleep_signal_to_noise", db: "light_sleep_signal_to_noise", coerce: "number" },
      { csv: "rem_sleep_breathing_rate", db: "rem_sleep_breathing_rate", coerce: "number" },
      { csv: "rem_sleep_standard_deviation", db: "rem_sleep_standard_deviation", coerce: "number" },
      { csv: "rem_sleep_signal_to_noise", db: "rem_sleep_signal_to_noise", coerce: "number" },
    ],
  },
  scaffold("estimated_oxygen_variation", "mcphases_estimated_oxygen_variation", "SpO₂ variation", "Estimated oxygen variation during sleep.", "day_ts", "respiratory"),
  {
    key: "stress_score",
    table: "mcphases_stress_score",
    label: "Stress score",
    description: "Daily Fitbit stress management score with sleep / responsiveness / exertion sub-points.",
    status: "active",
    keyStyle: "day",
    category: "cardio",
    conflictColumns: ["participant_id", "study_interval", "day_in_study"],
    csvColumns: [
      { csv: "id", db: "participant_id", coerce: "int", required: true },
      { csv: "study_interval", db: "study_interval", coerce: "int", required: true },
      { csv: "is_weekend", db: "is_weekend", coerce: "bool" },
      { csv: "day_in_study", db: "day_in_study", coerce: "int", required: true },
      { csv: "timestamp", db: "timestamp_local", coerce: "string" },
      { csv: "stress_score", db: "stress_score", coerce: "number" },
      { csv: "sleep_points", db: "sleep_points", coerce: "number" },
      { csv: "max_sleep_points", db: "max_sleep_points", coerce: "number" },
      { csv: "responsiveness_points", db: "responsiveness_points", coerce: "number" },
      { csv: "max_responsiveness_points", db: "max_responsiveness_points", coerce: "number" },
      { csv: "exertion_points", db: "exertion_points", coerce: "number" },
      { csv: "max_exertion_points", db: "max_exertion_points", coerce: "number" },
      { csv: "status", db: "status", coerce: "string" },
      { csv: "calculation_failed", db: "calculation_failed", coerce: "bool" },
    ],
  },
  scaffold("glucose", "mcphases_glucose", "Glucose (CGM)", "Continuous glucose monitoring from Dexcom.", "day_ts", "metabolic"),
  {
    key: "hormones_selfreport",
    table: "mcphases_hormones_selfreport",
    label: "Hormones & self-report",
    description: "Mira hormones (LH, estrogen, PDG) + symptom survey — carries phase label.",
    status: "active",
    keyStyle: "day",
    category: "endocrine",
    conflictColumns: ["participant_id", "study_interval", "day_in_study"],
    csvColumns: [
      { csv: "id", db: "participant_id", coerce: "int", required: true },
      { csv: "study_interval", db: "study_interval", coerce: "int", required: true },
      { csv: "day_in_study", db: "day_in_study", coerce: "int", required: true },
      { csv: "is_weekend", db: "is_weekend", coerce: "bool" },
      { csv: "phase", db: "phase", coerce: "string" },
      { csv: "lh", db: "lh", coerce: "number" },
      { csv: "estrogen", db: "estrogen", coerce: "number" },
      { csv: "pdg", db: "pdg", coerce: "number" },
    ],
  },
  scaffold("subject_info", "mcphases_subject_info", "Subject info", "Demographic + background survey.", "participant", "demographic"),
  scaffold("height_weight", "mcphases_height_weight", "Height & weight", "Self-reported height/weight 2022 & 2024.", "participant", "demographic"),
  scaffold("demographic_vo2_max", "mcphases_demographic_vo2_max", "Demographic VO₂ max", "Fitbit VO₂ max estimate from demographics + HR.", "day", "cardio"),
];

export function getMcphasesTable(key: string): McphasesTable | undefined {
  return MCPHASES_TABLES.find((t) => t.key === key);
}