DROP MATERIALIZED VIEW IF EXISTS public.mcphases_daily_features;

CREATE MATERIALIZED VIEW public.mcphases_daily_features AS
WITH hrv_daily AS (
  SELECT participant_id, day_in_study,
         avg(rmssd) AS hrv_mean,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY rmssd::double precision) AS hrv_median,
         min(rmssd) AS hrv_min, max(rmssd) AS hrv_max, stddev_samp(rmssd) AS hrv_std,
         avg(low_frequency) AS hrv_lf_mean, avg(high_frequency) AS hrv_hf_mean,
         count(*) AS hrv_samples
  FROM mcphases_hrv_details
  WHERE day_in_study IS NOT NULL AND rmssd IS NOT NULL AND (coverage IS NULL OR coverage >= 0.5)
  GROUP BY participant_id, day_in_study
), sleep_daily AS (
  SELECT participant_id, sleep_start_day_in_study AS day_in_study,
         sum(minutes_asleep) AS sleep_asleep_min, sum(minutes_awake) AS sleep_awake_min,
         sum(time_in_bed) AS sleep_in_bed_min, avg(efficiency) AS sleep_efficiency,
         min(sleep_start_timestamp) AS sleep_start, max(sleep_end_timestamp) AS sleep_end,
         sum(COALESCE(((levels->'summary'->'deep')->>'minutes')::numeric,0)) AS sleep_deep_min,
         sum(COALESCE(((levels->'summary'->'rem')->>'minutes')::numeric,0)) AS sleep_rem_min,
         sum(COALESCE(((levels->'summary'->'light')->>'minutes')::numeric,0)) AS sleep_light_min,
         sum(COALESCE(((levels->'summary'->'wake')->>'minutes')::numeric,0)) AS sleep_wake_min,
         count(*) AS sleep_sessions
  FROM mcphases_sleep WHERE sleep_start_day_in_study IS NOT NULL
  GROUP BY participant_id, sleep_start_day_in_study
), sleep_score_daily AS (
  SELECT participant_id, day_in_study,
         avg(overall_score) AS sleep_score, avg(composition_score) AS sleep_composition_score,
         avg(revitalization_score) AS sleep_revitalization_score, avg(duration_score) AS sleep_duration_score,
         avg(deep_sleep_in_minutes) AS sleep_deep_score_min, avg(resting_heart_rate) AS sleep_rhr,
         avg(restlessness) AS sleep_restlessness
  FROM mcphases_sleep_score WHERE day_in_study IS NOT NULL
  GROUP BY participant_id, day_in_study
), rhr_daily AS (
  SELECT participant_id, day_in_study, avg(value) AS rhr, avg(error) AS rhr_error
  FROM mcphases_resting_heart_rate WHERE day_in_study IS NOT NULL
  GROUP BY participant_id, day_in_study
), rr_daily AS (
  SELECT participant_id, day_in_study,
         avg(full_sleep_breathing_rate) AS resp_rate_full,
         avg(deep_sleep_breathing_rate) AS resp_rate_deep,
         avg(rem_sleep_breathing_rate) AS resp_rate_rem,
         avg(light_sleep_breathing_rate) AS resp_rate_light
  FROM mcphases_respiratory_rate_summary WHERE day_in_study IS NOT NULL
  GROUP BY participant_id, day_in_study
), stress_daily AS (
  SELECT participant_id, day_in_study,
         avg(stress_score) AS stress_score, avg(sleep_points) AS stress_sleep_points,
         avg(responsiveness_points) AS stress_responsiveness_points,
         avg(exertion_points) AS stress_exertion_points
  FROM mcphases_stress_score WHERE day_in_study IS NOT NULL
  GROUP BY participant_id, day_in_study
), glucose_daily AS (
  SELECT participant_id, day_in_study,
         avg(glucose_value) AS glucose_mean, min(glucose_value) AS glucose_min,
         max(glucose_value) AS glucose_max, stddev_samp(glucose_value) AS glucose_std,
         (max(glucose_value)-min(glucose_value)) AS glucose_range, count(*) AS glucose_samples
  FROM mcphases_glucose WHERE day_in_study IS NOT NULL AND glucose_value IS NOT NULL
  GROUP BY participant_id, day_in_study
), wrist_temp_daily AS (
  SELECT participant_id, day_in_study,
         avg(temperature_diff_from_baseline) AS wrist_temp_daily_mean,
         avg(temperature_diff_from_baseline) AS wrist_temp_overnight_mean,
         count(*) AS wrist_temp_samples
  FROM mcphases_wrist_temperature
  WHERE day_in_study IS NOT NULL AND temperature_diff_from_baseline IS NOT NULL
  GROUP BY participant_id, day_in_study
), hw AS (
  SELECT participant_id,
         COALESCE(height_2024, height_2022) AS height_cm,
         COALESCE(weight_2024, weight_2022) AS weight_kg,
         CASE WHEN COALESCE(height_2024,height_2022) IS NOT NULL
                 AND COALESCE(weight_2024,weight_2022) IS NOT NULL
                 AND COALESCE(height_2024,height_2022) > 0
              THEN COALESCE(weight_2024,weight_2022) /
                   ((COALESCE(height_2024,height_2022)/100.0)*(COALESCE(height_2024,height_2022)/100.0))
              ELSE NULL END AS bmi
  FROM mcphases_height_weight
), hormones AS (
  SELECT participant_id, day_in_study, study_interval, is_weekend, phase,
         lh, estrogen, pdg, cramps, bloating, fatigue, headaches, sorebreasts,
         sleepissue, moodswing, stress AS self_stress, appetite, exerciselevel,
         foodcravings, indigestion, flow_volume
  FROM mcphases_hormones_selfreport WHERE day_in_study IS NOT NULL
)
SELECT h.*,
       hw.height_cm, hw.weight_kg, hw.bmi,
       hrv.hrv_mean, hrv.hrv_median, hrv.hrv_min, hrv.hrv_max, hrv.hrv_std,
       hrv.hrv_lf_mean, hrv.hrv_hf_mean, hrv.hrv_samples,
       sd.sleep_asleep_min, sd.sleep_awake_min, sd.sleep_in_bed_min, sd.sleep_efficiency,
       sd.sleep_start, sd.sleep_end, sd.sleep_deep_min, sd.sleep_rem_min,
       sd.sleep_light_min, sd.sleep_wake_min, sd.sleep_sessions,
       ss.sleep_score, ss.sleep_composition_score, ss.sleep_revitalization_score,
       ss.sleep_duration_score, ss.sleep_deep_score_min, ss.sleep_rhr, ss.sleep_restlessness,
       rhr.rhr, rhr.rhr_error,
       rr.resp_rate_full, rr.resp_rate_deep, rr.resp_rate_rem, rr.resp_rate_light,
       st.stress_score, st.stress_sleep_points, st.stress_responsiveness_points, st.stress_exertion_points,
       g.glucose_mean, g.glucose_min, g.glucose_max, g.glucose_std, g.glucose_range, g.glucose_samples,
       wt.wrist_temp_daily_mean, wt.wrist_temp_overnight_mean, wt.wrist_temp_samples
FROM hormones h
LEFT JOIN hw ON hw.participant_id = h.participant_id
LEFT JOIN hrv_daily hrv ON hrv.participant_id = h.participant_id AND hrv.day_in_study = h.day_in_study
LEFT JOIN sleep_daily sd ON sd.participant_id = h.participant_id AND sd.day_in_study = h.day_in_study
LEFT JOIN sleep_score_daily ss ON ss.participant_id = h.participant_id AND ss.day_in_study = h.day_in_study
LEFT JOIN rhr_daily rhr ON rhr.participant_id = h.participant_id AND rhr.day_in_study = h.day_in_study
LEFT JOIN rr_daily rr ON rr.participant_id = h.participant_id AND rr.day_in_study = h.day_in_study
LEFT JOIN stress_daily st ON st.participant_id = h.participant_id AND st.day_in_study = h.day_in_study
LEFT JOIN glucose_daily g ON g.participant_id = h.participant_id AND g.day_in_study = h.day_in_study
LEFT JOIN wrist_temp_daily wt ON wt.participant_id = h.participant_id AND wt.day_in_study = h.day_in_study;

REFRESH MATERIALIZED VIEW public.mcphases_daily_features;