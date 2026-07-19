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
  scaffold("sleep", "mcphases_sleep", "Sleep sessions", "Per-session Fitbit sleep logs with stages, efficiency, duration.", "window", "sleep"),
  scaffold("hrv_details", "mcphases_hrv_details", "HRV details", "5-min RMSSD / low & high frequency HRV during sleep.", "day_ts", "cardio"),
  scaffold("resting_heart_rate", "mcphases_resting_heart_rate", "Resting heart rate", "Daily resting heart rate.", "day", "cardio"),
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
  scaffold("respiratory_rate_summary", "mcphases_respiratory_rate_summary", "Respiratory rate", "Nightly respiratory rate by sleep stage.", "day", "respiratory"),
  scaffold("estimated_oxygen_variation", "mcphases_estimated_oxygen_variation", "SpO₂ variation", "Estimated oxygen variation during sleep.", "day_ts", "respiratory"),
  scaffold("stress_score", "mcphases_stress_score", "Stress score", "Daily Fitbit stress management score.", "day", "cardio"),
  scaffold("glucose", "mcphases_glucose", "Glucose (CGM)", "Continuous glucose monitoring from Dexcom.", "day_ts", "metabolic"),
  scaffold("hormones_selfreport", "mcphases_hormones_selfreport", "Hormones & self-report", "Mira hormones (LH, estrogen, PDG) + symptom survey — carries phase label.", "day", "endocrine"),
  scaffold("subject_info", "mcphases_subject_info", "Subject info", "Demographic + background survey.", "participant", "demographic"),
  scaffold("height_weight", "mcphases_height_weight", "Height & weight", "Self-reported height/weight 2022 & 2024.", "participant", "demographic"),
  scaffold("demographic_vo2_max", "mcphases_demographic_vo2_max", "Demographic VO₂ max", "Fitbit VO₂ max estimate from demographics + HR.", "day", "cardio"),
];

export function getMcphasesTable(key: string): McphasesTable | undefined {
  return MCPHASES_TABLES.find((t) => t.key === key);
}