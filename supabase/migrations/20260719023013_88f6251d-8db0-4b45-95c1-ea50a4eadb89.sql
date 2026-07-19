
-- Drop demo tables (only demo data was there)
DROP TABLE IF EXISTS public.physionet_sleep_records CASCADE;
DROP TABLE IF EXISTS public.physionet_datasets CASCADE;

-- =============== Core registry tables ===============

CREATE TABLE public.mcphases_participants (
  participant_id integer PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
GRANT SELECT ON public.mcphases_participants TO anon, authenticated;
GRANT ALL ON public.mcphases_participants TO service_role;
ALTER TABLE public.mcphases_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read participants" ON public.mcphases_participants FOR SELECT USING (true);

CREATE TABLE public.mcphases_ingest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  filename text,
  rows_inserted integer NOT NULL DEFAULT 0,
  rows_updated integer NOT NULL DEFAULT 0,
  rows_skipped integer NOT NULL DEFAULT 0,
  participants integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mcphases_ingest_runs TO anon, authenticated;
GRANT ALL ON public.mcphases_ingest_runs TO service_role;
ALTER TABLE public.mcphases_ingest_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read ingest runs" ON public.mcphases_ingest_runs FOR SELECT USING (true);

-- =============== Helper: standard grants + RLS + public read ===============
-- We repeat the pattern per table to stay explicit.

-- =============== sleep_score (ACTIVE) ===============
CREATE TABLE public.mcphases_sleep_score (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer NOT NULL,
  timestamp_local text,
  is_weekend boolean,
  overall_score numeric,
  composition_score numeric,
  revitalization_score numeric,
  duration_score numeric,
  deep_sleep_in_minutes numeric,
  resting_heart_rate numeric,
  restlessness numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, study_interval, day_in_study)
);
CREATE INDEX ON public.mcphases_sleep_score (participant_id, study_interval, day_in_study);
GRANT SELECT ON public.mcphases_sleep_score TO anon, authenticated;
GRANT ALL ON public.mcphases_sleep_score TO service_role;
ALTER TABLE public.mcphases_sleep_score ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read sleep_score" ON public.mcphases_sleep_score FOR SELECT USING (true);

-- =============== sleep (session-keyed) ===============
CREATE TABLE public.mcphases_sleep (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  sleep_start_day_in_study integer NOT NULL,
  sleep_start_timestamp text,
  sleep_end_day_in_study integer,
  sleep_end_timestamp text,
  duration numeric,
  minutes_to_fall_asleep numeric,
  minutes_asleep numeric,
  minutes_awake numeric,
  minutes_after_wakeup numeric,
  time_in_bed numeric,
  efficiency numeric,
  type text,
  info_code text,
  levels jsonb,
  main_sleep boolean,
  is_weekend boolean,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, study_interval, sleep_start_day_in_study, sleep_start_timestamp)
);
GRANT SELECT ON public.mcphases_sleep TO anon, authenticated;
GRANT ALL ON public.mcphases_sleep TO service_role;
ALTER TABLE public.mcphases_sleep ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read sleep" ON public.mcphases_sleep FOR SELECT USING (true);

-- =============== hrv_details (5-min interval) ===============
CREATE TABLE public.mcphases_hrv_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer,
  timestamp_local text NOT NULL,
  is_weekend boolean,
  rmssd numeric,
  coverage numeric,
  low_frequency numeric,
  high_frequency numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mcphases_hrv_details (participant_id, study_interval, day_in_study);
GRANT SELECT ON public.mcphases_hrv_details TO anon, authenticated;
GRANT ALL ON public.mcphases_hrv_details TO service_role;
ALTER TABLE public.mcphases_hrv_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read hrv" ON public.mcphases_hrv_details FOR SELECT USING (true);

-- =============== resting_heart_rate (daily) ===============
CREATE TABLE public.mcphases_resting_heart_rate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer NOT NULL,
  is_weekend boolean,
  value numeric,
  error numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, study_interval, day_in_study)
);
GRANT SELECT ON public.mcphases_resting_heart_rate TO anon, authenticated;
GRANT ALL ON public.mcphases_resting_heart_rate TO service_role;
ALTER TABLE public.mcphases_resting_heart_rate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read rhr" ON public.mcphases_resting_heart_rate FOR SELECT USING (true);

-- =============== heart_rate (continuous) ===============
CREATE TABLE public.mcphases_heart_rate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer,
  timestamp_local text NOT NULL,
  is_weekend boolean,
  bpm numeric,
  confidence numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mcphases_heart_rate (participant_id, study_interval, day_in_study);
GRANT SELECT ON public.mcphases_heart_rate TO anon, authenticated;
GRANT ALL ON public.mcphases_heart_rate TO service_role;
ALTER TABLE public.mcphases_heart_rate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read hr" ON public.mcphases_heart_rate FOR SELECT USING (true);

-- =============== steps ===============
CREATE TABLE public.mcphases_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer,
  timestamp_local text NOT NULL,
  is_weekend boolean,
  steps numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mcphases_steps (participant_id, study_interval, day_in_study);
GRANT SELECT ON public.mcphases_steps TO anon, authenticated;
GRANT ALL ON public.mcphases_steps TO service_role;
ALTER TABLE public.mcphases_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read steps" ON public.mcphases_steps FOR SELECT USING (true);

-- =============== distance ===============
CREATE TABLE public.mcphases_distance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer,
  timestamp_local text NOT NULL,
  is_weekend boolean,
  distance numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mcphases_distance (participant_id, study_interval, day_in_study);
GRANT SELECT ON public.mcphases_distance TO anon, authenticated;
GRANT ALL ON public.mcphases_distance TO service_role;
ALTER TABLE public.mcphases_distance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read distance" ON public.mcphases_distance FOR SELECT USING (true);

-- =============== calories ===============
CREATE TABLE public.mcphases_calories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer,
  timestamp_local text NOT NULL,
  is_weekend boolean,
  calories numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mcphases_calories (participant_id, study_interval, day_in_study);
GRANT SELECT ON public.mcphases_calories TO anon, authenticated;
GRANT ALL ON public.mcphases_calories TO service_role;
ALTER TABLE public.mcphases_calories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read calories" ON public.mcphases_calories FOR SELECT USING (true);

-- =============== altitude ===============
CREATE TABLE public.mcphases_altitude (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer,
  timestamp_local text NOT NULL,
  is_weekend boolean,
  altitude numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mcphases_altitude (participant_id, study_interval, day_in_study);
GRANT SELECT ON public.mcphases_altitude TO anon, authenticated;
GRANT ALL ON public.mcphases_altitude TO service_role;
ALTER TABLE public.mcphases_altitude ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read altitude" ON public.mcphases_altitude FOR SELECT USING (true);

-- =============== active_minutes (daily) ===============
CREATE TABLE public.mcphases_active_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer NOT NULL,
  is_weekend boolean,
  sedentary numeric,
  lightly numeric,
  moderately numeric,
  very numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, study_interval, day_in_study)
);
GRANT SELECT ON public.mcphases_active_minutes TO anon, authenticated;
GRANT ALL ON public.mcphases_active_minutes TO service_role;
ALTER TABLE public.mcphases_active_minutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active_minutes" ON public.mcphases_active_minutes FOR SELECT USING (true);

-- =============== active_zone_minutes ===============
CREATE TABLE public.mcphases_active_zone_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer,
  timestamp_local text,
  is_weekend boolean,
  heart_zone_id text,
  total_minutes numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mcphases_active_zone_minutes (participant_id, study_interval, day_in_study);
GRANT SELECT ON public.mcphases_active_zone_minutes TO anon, authenticated;
GRANT ALL ON public.mcphases_active_zone_minutes TO service_role;
ALTER TABLE public.mcphases_active_zone_minutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read azm" ON public.mcphases_active_zone_minutes FOR SELECT USING (true);

-- =============== time_in_hr_zones (daily) ===============
CREATE TABLE public.mcphases_time_in_hr_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer NOT NULL,
  is_weekend boolean,
  below_default_zone_1 numeric,
  in_default_zone_1 numeric,
  in_default_zone_2 numeric,
  in_default_zone_3 numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, study_interval, day_in_study)
);
GRANT SELECT ON public.mcphases_time_in_hr_zones TO anon, authenticated;
GRANT ALL ON public.mcphases_time_in_hr_zones TO service_role;
ALTER TABLE public.mcphases_time_in_hr_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read hr_zones" ON public.mcphases_time_in_hr_zones FOR SELECT USING (true);

-- =============== exercise (session) ===============
CREATE TABLE public.mcphases_exercise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  start_day_in_study integer NOT NULL,
  start_timestamp text,
  activityname text,
  activitytypeid text,
  duration numeric,
  activeduration numeric,
  averageheartrate numeric,
  calories numeric,
  steps numeric,
  elevationgain numeric,
  hasgps boolean,
  is_weekend boolean,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mcphases_exercise (participant_id, study_interval, start_day_in_study);
GRANT SELECT ON public.mcphases_exercise TO anon, authenticated;
GRANT ALL ON public.mcphases_exercise TO service_role;
ALTER TABLE public.mcphases_exercise ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read exercise" ON public.mcphases_exercise FOR SELECT USING (true);

-- =============== computed_temperature (sleep window) ===============
CREATE TABLE public.mcphases_computed_temperature (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  sleep_start_day_in_study integer NOT NULL,
  sleep_start_timestamp text,
  sleep_end_day_in_study integer,
  sleep_end_timestamp text,
  is_weekend boolean,
  type text,
  temperature_samples numeric,
  nightly_temperature numeric,
  baseline_relative_sample_sum numeric,
  baseline_relative_sample_sum_of_squares numeric,
  baseline_relative_nightly_standard_deviation numeric,
  baseline_relative_sample_standard_deviation numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mcphases_computed_temperature (participant_id, study_interval, sleep_start_day_in_study);
GRANT SELECT ON public.mcphases_computed_temperature TO anon, authenticated;
GRANT ALL ON public.mcphases_computed_temperature TO service_role;
ALTER TABLE public.mcphases_computed_temperature ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read comp_temp" ON public.mcphases_computed_temperature FOR SELECT USING (true);

-- =============== wrist_temperature ===============
CREATE TABLE public.mcphases_wrist_temperature (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer,
  timestamp_local text NOT NULL,
  is_weekend boolean,
  temperature_diff_from_baseline numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mcphases_wrist_temperature (participant_id, study_interval, day_in_study);
GRANT SELECT ON public.mcphases_wrist_temperature TO anon, authenticated;
GRANT ALL ON public.mcphases_wrist_temperature TO service_role;
ALTER TABLE public.mcphases_wrist_temperature ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read wrist_temp" ON public.mcphases_wrist_temperature FOR SELECT USING (true);

-- =============== respiratory_rate_summary (nightly) ===============
CREATE TABLE public.mcphases_respiratory_rate_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer,
  timestamp_local text,
  is_weekend boolean,
  full_sleep_breathing_rate numeric,
  full_sleep_standard_deviation numeric,
  full_sleep_signal_to_noise numeric,
  deep_sleep_breathing_rate numeric,
  deep_sleep_standard_deviation numeric,
  deep_sleep_signal_to_noise numeric,
  light_sleep_breathing_rate numeric,
  light_sleep_standard_deviation numeric,
  light_sleep_signal_to_noise numeric,
  rem_sleep_breathing_rate numeric,
  rem_sleep_standard_deviation numeric,
  rem_sleep_signal_to_noise numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mcphases_respiratory_rate_summary (participant_id, study_interval, day_in_study);
GRANT SELECT ON public.mcphases_respiratory_rate_summary TO anon, authenticated;
GRANT ALL ON public.mcphases_respiratory_rate_summary TO service_role;
ALTER TABLE public.mcphases_respiratory_rate_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read resp_rate" ON public.mcphases_respiratory_rate_summary FOR SELECT USING (true);

-- =============== estimated_oxygen_variation ===============
CREATE TABLE public.mcphases_estimated_oxygen_variation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer,
  timestamp_local text NOT NULL,
  is_weekend boolean,
  infrared_to_red_signal_ratio numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mcphases_estimated_oxygen_variation (participant_id, study_interval, day_in_study);
GRANT SELECT ON public.mcphases_estimated_oxygen_variation TO anon, authenticated;
GRANT ALL ON public.mcphases_estimated_oxygen_variation TO service_role;
ALTER TABLE public.mcphases_estimated_oxygen_variation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read spo2" ON public.mcphases_estimated_oxygen_variation FOR SELECT USING (true);

-- =============== stress_score (daily) ===============
CREATE TABLE public.mcphases_stress_score (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer NOT NULL,
  timestamp_local text,
  is_weekend boolean,
  stress_score numeric,
  sleep_points numeric,
  max_sleep_points numeric,
  responsiveness_points numeric,
  max_responsiveness_points numeric,
  exertion_points numeric,
  max_exertion_points numeric,
  status text,
  calculation_failed boolean,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, study_interval, day_in_study)
);
GRANT SELECT ON public.mcphases_stress_score TO anon, authenticated;
GRANT ALL ON public.mcphases_stress_score TO service_role;
ALTER TABLE public.mcphases_stress_score ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read stress" ON public.mcphases_stress_score FOR SELECT USING (true);

-- =============== glucose (CGM) ===============
CREATE TABLE public.mcphases_glucose (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer,
  timestamp_local text NOT NULL,
  is_weekend boolean,
  glucose_value numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mcphases_glucose (participant_id, study_interval, day_in_study);
GRANT SELECT ON public.mcphases_glucose TO anon, authenticated;
GRANT ALL ON public.mcphases_glucose TO service_role;
ALTER TABLE public.mcphases_glucose ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read glucose" ON public.mcphases_glucose FOR SELECT USING (true);

-- =============== hormones_selfreport (daily; carries phase label) ===============
CREATE TABLE public.mcphases_hormones_selfreport (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer NOT NULL,
  is_weekend boolean,
  phase text,
  lh numeric,
  estrogen numeric,
  pdg numeric,
  flow_volume numeric,
  flow_color text,
  appetite numeric,
  exerciselevel numeric,
  headaches numeric,
  cramps numeric,
  sorebreasts numeric,
  fatigue numeric,
  sleepissue numeric,
  moodswing numeric,
  stress numeric,
  foodcravings numeric,
  indigestion numeric,
  bloating numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, study_interval, day_in_study)
);
GRANT SELECT ON public.mcphases_hormones_selfreport TO anon, authenticated;
GRANT ALL ON public.mcphases_hormones_selfreport TO service_role;
ALTER TABLE public.mcphases_hormones_selfreport ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read hormones" ON public.mcphases_hormones_selfreport FOR SELECT USING (true);

-- =============== subject_info (participant-keyed) ===============
CREATE TABLE public.mcphases_subject_info (
  participant_id integer PRIMARY KEY REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  birth_year integer,
  gender text,
  ethnicity text,
  education text,
  employment text,
  income text,
  sexually_active text,
  self_report_menstrual_health_literacy text,
  age_of_first_menarche numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mcphases_subject_info TO anon, authenticated;
GRANT ALL ON public.mcphases_subject_info TO service_role;
ALTER TABLE public.mcphases_subject_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read subject_info" ON public.mcphases_subject_info FOR SELECT USING (true);

-- =============== height_weight ===============
CREATE TABLE public.mcphases_height_weight (
  participant_id integer PRIMARY KEY REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  height_2022 numeric,
  weight_2022 numeric,
  height_2024 numeric,
  weight_2024 numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mcphases_height_weight TO anon, authenticated;
GRANT ALL ON public.mcphases_height_weight TO service_role;
ALTER TABLE public.mcphases_height_weight ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read height_weight" ON public.mcphases_height_weight FOR SELECT USING (true);

-- =============== demographic_vo2_max ===============
CREATE TABLE public.mcphases_demographic_vo2_max (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id integer NOT NULL REFERENCES public.mcphases_participants(participant_id) ON DELETE CASCADE,
  study_interval integer NOT NULL,
  day_in_study integer,
  is_weekend boolean,
  demographic_vo2_max numeric,
  demographic_vo2_max_error numeric,
  filtered_demographic_vo2_max numeric,
  filtered_demographic_vo2_max_error numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mcphases_demographic_vo2_max (participant_id, study_interval, day_in_study);
GRANT SELECT ON public.mcphases_demographic_vo2_max TO anon, authenticated;
GRANT ALL ON public.mcphases_demographic_vo2_max TO service_role;
ALTER TABLE public.mcphases_demographic_vo2_max ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read vo2" ON public.mcphases_demographic_vo2_max FOR SELECT USING (true);
