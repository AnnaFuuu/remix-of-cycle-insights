
DROP MATERIALIZED VIEW IF EXISTS public.mcphases_daily_features;

CREATE MATERIALIZED VIEW public.mcphases_daily_features AS
WITH
hrv_daily AS (
  SELECT participant_id, day_in_study,
    AVG(rmssd) AS hrv_mean,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY rmssd) AS hrv_median,
    MIN(rmssd) AS hrv_min,
    MAX(rmssd) AS hrv_max,
    STDDEV_SAMP(rmssd) AS hrv_std,
    AVG(low_frequency) AS hrv_lf_mean,
    AVG(high_frequency) AS hrv_hf_mean,
    COUNT(*) AS hrv_samples
  FROM public.mcphases_hrv_details
  WHERE day_in_study IS NOT NULL AND rmssd IS NOT NULL AND (coverage IS NULL OR coverage >= 0.5)
  GROUP BY participant_id, day_in_study
),
sleep_daily AS (
  SELECT participant_id, sleep_start_day_in_study AS day_in_study,
    SUM(minutes_asleep) AS sleep_asleep_min,
    SUM(minutes_awake) AS sleep_awake_min,
    SUM(time_in_bed) AS sleep_in_bed_min,
    AVG(efficiency) AS sleep_efficiency,
    MIN(sleep_start_timestamp) AS sleep_start,
    MAX(sleep_end_timestamp) AS sleep_end,
    SUM(COALESCE((levels->'summary'->'deep'->>'minutes')::numeric, 0)) AS sleep_deep_min,
    SUM(COALESCE((levels->'summary'->'rem'->>'minutes')::numeric,  0)) AS sleep_rem_min,
    SUM(COALESCE((levels->'summary'->'light'->>'minutes')::numeric,0)) AS sleep_light_min,
    SUM(COALESCE((levels->'summary'->'wake'->>'minutes')::numeric, 0)) AS sleep_wake_min,
    COUNT(*) AS sleep_sessions
  FROM public.mcphases_sleep
  WHERE sleep_start_day_in_study IS NOT NULL
  GROUP BY participant_id, sleep_start_day_in_study
),
sleep_score_daily AS (
  SELECT participant_id, day_in_study,
    AVG(overall_score) AS sleep_score,
    AVG(composition_score) AS sleep_composition_score,
    AVG(revitalization_score) AS sleep_revitalization_score,
    AVG(duration_score) AS sleep_duration_score,
    AVG(deep_sleep_in_minutes) AS sleep_deep_score_min,
    AVG(resting_heart_rate) AS sleep_rhr,
    AVG(restlessness) AS sleep_restlessness
  FROM public.mcphases_sleep_score
  WHERE day_in_study IS NOT NULL
  GROUP BY participant_id, day_in_study
),
rhr_daily AS (
  SELECT participant_id, day_in_study,
    AVG(value) AS rhr, AVG(error) AS rhr_error
  FROM public.mcphases_resting_heart_rate
  WHERE day_in_study IS NOT NULL
  GROUP BY participant_id, day_in_study
),
rr_daily AS (
  SELECT participant_id, day_in_study,
    AVG(full_sleep_breathing_rate) AS resp_rate_full,
    AVG(deep_sleep_breathing_rate) AS resp_rate_deep,
    AVG(rem_sleep_breathing_rate) AS resp_rate_rem,
    AVG(light_sleep_breathing_rate) AS resp_rate_light
  FROM public.mcphases_respiratory_rate_summary
  WHERE day_in_study IS NOT NULL
  GROUP BY participant_id, day_in_study
),
stress_daily AS (
  SELECT participant_id, day_in_study,
    AVG(stress_score) AS stress_score,
    AVG(sleep_points) AS stress_sleep_points,
    AVG(responsiveness_points) AS stress_responsiveness_points,
    AVG(exertion_points) AS stress_exertion_points
  FROM public.mcphases_stress_score
  WHERE day_in_study IS NOT NULL
  GROUP BY participant_id, day_in_study
),
glucose_daily AS (
  SELECT participant_id, day_in_study,
    AVG(glucose_value) AS glucose_mean,
    MIN(glucose_value) AS glucose_min,
    MAX(glucose_value) AS glucose_max,
    STDDEV_SAMP(glucose_value) AS glucose_std,
    (MAX(glucose_value) - MIN(glucose_value)) AS glucose_range,
    COUNT(*) AS glucose_samples
  FROM public.mcphases_glucose
  WHERE day_in_study IS NOT NULL AND glucose_value IS NOT NULL
  GROUP BY participant_id, day_in_study
),
hw AS (
  SELECT participant_id,
    COALESCE(height_2024, height_2022) AS height_cm,
    COALESCE(weight_2024, weight_2022) AS weight_kg,
    CASE
      WHEN COALESCE(height_2024, height_2022) IS NOT NULL
       AND COALESCE(weight_2024, weight_2022) IS NOT NULL
       AND COALESCE(height_2024, height_2022) > 0
      THEN COALESCE(weight_2024, weight_2022)
           / ((COALESCE(height_2024, height_2022)/100.0)
            * (COALESCE(height_2024, height_2022)/100.0))
    END AS bmi
  FROM public.mcphases_height_weight
),
hormones AS (
  SELECT participant_id, day_in_study, study_interval, is_weekend,
    phase, lh, estrogen, pdg,
    cramps, bloating, fatigue, headaches, sorebreasts, sleepissue,
    moodswing, stress AS self_stress, appetite, exerciselevel,
    foodcravings, indigestion, flow_volume
  FROM public.mcphases_hormones_selfreport
  WHERE day_in_study IS NOT NULL
)
SELECT
  h.participant_id, h.day_in_study, h.study_interval, h.is_weekend,
  h.phase, h.lh, h.estrogen, h.pdg,
  h.cramps, h.bloating, h.fatigue, h.headaches, h.sorebreasts,
  h.sleepissue, h.moodswing, h.self_stress, h.appetite, h.exerciselevel,
  h.foodcravings, h.indigestion, h.flow_volume,
  hw.height_cm, hw.weight_kg, hw.bmi,
  hrv.hrv_mean, hrv.hrv_median, hrv.hrv_min, hrv.hrv_max, hrv.hrv_std,
  hrv.hrv_lf_mean, hrv.hrv_hf_mean, hrv.hrv_samples,
  sd.sleep_asleep_min, sd.sleep_awake_min, sd.sleep_in_bed_min, sd.sleep_efficiency,
  sd.sleep_start, sd.sleep_end,
  sd.sleep_deep_min, sd.sleep_rem_min, sd.sleep_light_min, sd.sleep_wake_min,
  sd.sleep_sessions,
  ss.sleep_score, ss.sleep_composition_score, ss.sleep_revitalization_score,
  ss.sleep_duration_score, ss.sleep_deep_score_min, ss.sleep_rhr, ss.sleep_restlessness,
  rhr.rhr, rhr.rhr_error,
  rr.resp_rate_full, rr.resp_rate_deep, rr.resp_rate_rem, rr.resp_rate_light,
  st.stress_score, st.stress_sleep_points, st.stress_responsiveness_points, st.stress_exertion_points,
  g.glucose_mean, g.glucose_min, g.glucose_max, g.glucose_std, g.glucose_range, g.glucose_samples
FROM hormones h
LEFT JOIN hw ON hw.participant_id = h.participant_id
LEFT JOIN hrv_daily hrv ON hrv.participant_id = h.participant_id AND hrv.day_in_study = h.day_in_study
LEFT JOIN sleep_daily sd ON sd.participant_id = h.participant_id AND sd.day_in_study = h.day_in_study
LEFT JOIN sleep_score_daily ss ON ss.participant_id = h.participant_id AND ss.day_in_study = h.day_in_study
LEFT JOIN rhr_daily rhr ON rhr.participant_id = h.participant_id AND rhr.day_in_study = h.day_in_study
LEFT JOIN rr_daily rr ON rr.participant_id = h.participant_id AND rr.day_in_study = h.day_in_study
LEFT JOIN stress_daily st ON st.participant_id = h.participant_id AND st.day_in_study = h.day_in_study
LEFT JOIN glucose_daily g ON g.participant_id = h.participant_id AND g.day_in_study = h.day_in_study;

CREATE UNIQUE INDEX mcphases_daily_features_pk
  ON public.mcphases_daily_features (participant_id, day_in_study);

GRANT SELECT ON public.mcphases_daily_features TO anon, authenticated;
GRANT ALL    ON public.mcphases_daily_features TO service_role;
